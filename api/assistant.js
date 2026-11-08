// Vercel serverless function: AI assistant for the finance portal.
// Gemini decides which tool to call; the tools run against Supabase using the
// signed-in user's own token, so row-level security still applies.
// Env (set in Vercel project settings and .env.local for `vercel dev`):
//   GEMINI_API_KEY, GEMINI_MODEL (optional), SUPABASE_URL, SUPABASE_ANON_KEY
const { createClient } = require('@supabase/supabase-js');

const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const MAX_TOOL_ROUNDS = 5;

const SYSTEM_PROMPT = `You are the assistant for Devmate Solutions' finance portal.
Use the tools to look up or create records. Never invent figures: if a tool does not
return the data, say so. Amounts are in the currency stored on each record.
Keep answers short and plain.`;

const TOOLS = [
  {
    name: 'get_summary',
    description: 'Totals: number of clients, number of invoices, and invoice counts by status.',
    parameters: { type: 'OBJECT', properties: {} },
  },
  {
    name: 'list_invoices',
    description: 'List invoices, optionally filtered by status (pending, paid, overdue, scheduled) or client name.',
    parameters: {
      type: 'OBJECT',
      properties: {
        status: { type: 'STRING', description: 'pending, paid, overdue or scheduled' },
        client_name: { type: 'STRING', description: 'Partial client name to match' },
        limit: { type: 'NUMBER', description: 'Max rows, default 20' },
      },
    },
  },
  {
    name: 'list_clients',
    description: 'List clients, optionally matching a name.',
    parameters: {
      type: 'OBJECT',
      properties: { search: { type: 'STRING', description: 'Partial name to match' } },
    },
  },
  {
    name: 'list_employees',
    description: 'List employees with their base salary and status.',
    parameters: { type: 'OBJECT', properties: {} },
  },
  {
    name: 'create_client',
    description: 'Create a new client. Only call this when the user clearly asks to add a client.',
    parameters: {
      type: 'OBJECT',
      properties: {
        name: { type: 'STRING', description: 'Client name (required)' },
        email: { type: 'STRING' },
        phone: { type: 'STRING' },
        address: { type: 'STRING' },
      },
      required: ['name'],
    },
  },
];

async function runTool(db, name, args) {
  switch (name) {
    case 'get_summary': {
      const [{ count: clients }, { data: invoices, error }] = await Promise.all([
        db.from('clients').select('*', { count: 'exact', head: true }),
        db.from('invoices').select('status'),
      ]);
      if (error) throw error;
      const byStatus = {};
      (invoices || []).forEach((i) => { byStatus[i.status] = (byStatus[i.status] || 0) + 1; });
      return { clients, invoices: invoices.length, invoicesByStatus: byStatus };
    }
    case 'list_invoices': {
      let q = db.from('invoices')
        .select('invoice_number, client_name, status, total_payment, currency, date, due_date')
        .order('created_at', { ascending: false })
        .limit(Math.min(Number(args.limit) || 20, 100));
      if (args.status) q = q.eq('status', args.status);
      if (args.client_name) q = q.ilike('client_name', `%${args.client_name}%`);
      const { data, error } = await q;
      if (error) throw error;
      return { invoices: data };
    }
    case 'list_clients': {
      let q = db.from('clients').select('name, email, phone, address').order('name');
      if (args.search) q = q.ilike('name', `%${args.search}%`);
      const { data, error } = await q.limit(100);
      if (error) throw error;
      return { clients: data };
    }
    case 'list_employees': {
      const { data, error } = await db.from('employees').select('name, base_salary, status, department').limit(200);
      if (error) throw error;
      return { employees: data };
    }
    case 'create_client': {
      if (!args.name) throw new Error('name is required');
      const row = { name: String(args.name).trim() };
      ['email', 'phone', 'address'].forEach((k) => { if (args[k]) row[k] = String(args[k]); });
      const { data, error } = await db.from('clients').insert(row).select('name').single();
      if (error) throw error;
      return { created: data };
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

async function callGemini(apiKey, contents) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents,
        tools: [{ functionDeclarations: TOOLS }],
      }),
    }
  );
  const json = await res.json();
  if (!res.ok) throw new Error(json.error?.message || `Gemini error ${res.status}`);
  return json;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const apiKey = process.env.GEMINI_API_KEY;
  const url = process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY;
  if (!apiKey || !url || !anon) return res.status(500).json({ error: 'Assistant is not configured' });

  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'Sign in first' });

  const prompt = String(req.body?.prompt || '').slice(0, 2000);
  if (!prompt) return res.status(400).json({ error: 'prompt is required' });

  // Acts as the signed-in user: RLS applies to every query
  const db = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
  const { data: userData, error: userErr } = await db.auth.getUser(token);
  if (userErr || !userData?.user) return res.status(401).json({ error: 'Session expired, sign in again' });

  try {
    const contents = [{ role: 'user', parts: [{ text: prompt }] }];
    const toolLog = [];

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const data = await callGemini(apiKey, contents);
      const parts = data.candidates?.[0]?.content?.parts || [];
      const calls = parts.filter((p) => p.functionCall);

      if (calls.length === 0) {
        const reply = parts.map((p) => p.text || '').join('').trim();
        return res.status(200).json({ reply: reply || 'Done.', toolLog });
      }

      contents.push({ role: 'model', parts });
      const responses = [];
      for (const { functionCall } of calls) {
        let result;
        try {
          result = await runTool(db, functionCall.name, functionCall.args || {});
        } catch (e) {
          result = { error: e.message };
        }
        toolLog.push({ name: functionCall.name, args: functionCall.args || {}, ok: !result.error });
        responses.push({ functionResponse: { name: functionCall.name, response: result } });
      }
      contents.push({ role: 'user', parts: responses });
    }

    return res.status(200).json({ reply: 'I stopped after too many steps. Try a narrower request.', toolLog });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
