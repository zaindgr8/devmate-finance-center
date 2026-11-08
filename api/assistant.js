// Vercel serverless function: AI assistant for the finance portal.
// Gemini decides which tool to call; the tools (api/_lib/tools.js) run against
// Supabase using the signed-in user's own token, so row-level security applies.
// Env (set in Vercel project settings and .env.local for `vercel dev`):
//   GEMINI_API_KEY, GEMINI_MODEL (optional), SUPABASE_URL, SUPABASE_ANON_KEY
const { createClient } = require('@supabase/supabase-js');
const { runTool, isWrite, declarations, localDate, CURRENCIES } = require('./_lib/tools');

const MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
const MAX_TOOL_ROUNDS = 10;

const systemPrompt = () => `You are the operator of Devmate Solutions' finance portal, with full authority
to read and change its data through the tools: clients, invoices and payments, employees, salaries,
bills (Payments page) and expenses. Do what the user asks directly; do not tell them to do it by hand
if a tool can do it. Today is ${localDate()}.

Rules:
- Never invent figures or ids. Look records up with the list/get tools first when you need an id or
  are unsure of an exact name, then act.
- Deletions return needs_confirmation first. Show the user the summary, wait for an explicit yes,
  then call again with confirm=true. Never set confirm=true on your own.
- If a tool returns an instruction (for example asking whether to merge two clients), follow it.
- Money: currencies are ${CURRENCIES.join(', ')}. Salaries, bills and base salaries are in AED.
  Never do currency maths yourself: for "2350 USD > AED" pass the amount as given with
  rates_currency=USD and currency=AED and the tool converts.
- Invoices: only the client and an amount are required. Default item description
  "Professional services". New invoices are pending until a payment is recorded.
- After any change, confirm what was done using the numbers the tool returned (invoice numbers,
  totals, names). Keep answers short and plain.`;

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const apiKey = process.env.GEMINI_API_KEY;
  const url = process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY;
  if (!apiKey || !url || !anon) return res.status(500).json({ error: 'Assistant is not configured' });

  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'Sign in first' });

  const prompt = String(req.body?.prompt || '').slice(0, 4000);
  if (!prompt) return res.status(400).json({ error: 'prompt is required' });

  // Earlier turns of this chat, so follow-ups ("yes, delete it", "make it 3000") have context
  const history = (Array.isArray(req.body?.history) ? req.body.history : [])
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && m.text)
    .slice(-16)
    .map((m) => ({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: String(m.text).slice(0, 4000) }] }));

  // Acts as the signed-in user: RLS applies to every query
  const db = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
  const { data: userData, error: userErr } = await db.auth.getUser(token);
  if (userErr || !userData?.user) return res.status(401).json({ error: 'Session expired, sign in again' });

  const toolLog = [];
  const changed = () => toolLog.some((t) => t.ok && t.write);

  try {
    const contents = [...history, { role: 'user', parts: [{ text: prompt }] }];

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const data = await callGemini(apiKey, contents);
      const parts = data.candidates?.[0]?.content?.parts || [];
      const calls = parts.filter((p) => p.functionCall);

      if (calls.length === 0) {
        const reply = parts.filter((p) => !p.thought).map((p) => p.text || '').join('').trim();
        return res.status(200).json({ reply: reply || 'Done.', toolLog, changed: changed() });
      }

      // Send the model's parts back unchanged: they carry thought signatures Gemini needs
      contents.push({ role: 'model', parts });
      const responses = [];
      for (const { functionCall } of calls) {
        let result;
        try {
          result = await runTool(db, functionCall.name, functionCall.args || {});
        } catch (e) {
          result = { error: e.message };
        }
        toolLog.push({
          name: functionCall.name,
          ok: !result.error && !result.needs_confirmation,
          write: isWrite(functionCall.name),
        });
        const response = { name: functionCall.name, response: result };
        if (functionCall.id) response.id = functionCall.id;
        responses.push({ functionResponse: response });
      }
      contents.push({ role: 'user', parts: responses });
    }

    return res.status(200).json({ reply: 'I stopped after too many steps. Try a narrower request.', toolLog, changed: changed() });
  } catch (e) {
    return res.status(500).json({ error: e.message, changed: changed() });
  }
};

async function callGemini(apiKey, contents) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt() }] },
        contents,
        tools: [{ functionDeclarations: declarations() }],
      }),
    }
  );
  const json = await res.json();
  if (!res.ok) throw new Error(json.error?.message || `Gemini error ${res.status}`);
  return json;
}
