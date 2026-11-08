// Vercel serverless function: AI assistant for the finance portal.
// Gemini decides which tool to call; the tools run against Supabase using the
// signed-in user's own token, so row-level security still applies.
// Env (set in Vercel project settings and .env.local for `vercel dev`):
//   GEMINI_API_KEY, GEMINI_MODEL (optional), SUPABASE_URL, SUPABASE_ANON_KEY
const { createClient } = require('@supabase/supabase-js');

const MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
const MAX_TOOL_ROUNDS = 6;
const TIME_ZONE = 'Asia/Dubai';

// Keep in sync with AED_RATES in src/utils/helpers.js
const AED_RATES = { AED: 1, USD: 3.6725, OMR: 9.5475, GBP: 4.9, EUR: 4.25 };
const CURRENCIES = Object.keys(AED_RATES);

const WRITE_TOOLS = new Set(['create_client', 'create_invoice']);

const localDate = () => new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE }).format(new Date()); // YYYY-MM-DD
const round2 = (n) => Math.round(n * 100) / 100;

const systemPrompt = () => `You are the assistant for Devmate Solutions' finance portal.
Today is ${localDate()}. Use the tools to look up or create records.
Never invent figures: if a tool does not return the data, say so.
Supported currencies: ${CURRENCIES.join(', ')}.
Creating invoices: only the client and an amount are required, so do not ask for anything else.
If no description is given, use "Professional services". If the user names a project, pass it as project_name.
If the user gives an amount in one currency but wants the invoice in another (e.g. "2350 USD > AED"),
pass the amount as given with rates_currency set to the original currency and currency set to the
invoice currency; the tool converts it. Never do currency maths yourself.
After creating something, confirm it with the invoice number and total the tool returned.
Keep answers short and plain.`;

const TOOLS = [
  {
    name: 'get_summary',
    description: 'Totals: number of clients, number of invoices, and invoice counts by status.',
    parameters: { type: 'OBJECT', properties: {} },
  },
  {
    name: 'list_invoices',
    description: 'List invoices, optionally filtered by status (pending, paid, partial, unpaid, scheduled) or client name.',
    parameters: {
      type: 'OBJECT',
      properties: {
        status: { type: 'STRING', description: 'pending, paid, partial, unpaid or scheduled' },
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
        business_name: { type: 'STRING' },
        email: { type: 'STRING' },
        phone: { type: 'STRING' },
        address: { type: 'STRING' },
      },
      required: ['name'],
    },
  },
  {
    name: 'create_invoice',
    description: 'Create a new pending invoice (not yet paid). Adds the client if they do not exist yet.',
    parameters: {
      type: 'OBJECT',
      properties: {
        client_name: { type: 'STRING', description: 'Client name (required)' },
        currency: { type: 'STRING', description: `Invoice currency: ${CURRENCIES.join(', ')}. Default AED.` },
        rates_currency: { type: 'STRING', description: 'Currency the item rates are given in, if different from the invoice currency' },
        items: {
          type: 'ARRAY',
          description: 'Line items (required)',
          items: {
            type: 'OBJECT',
            properties: {
              description: { type: 'STRING' },
              qty: { type: 'NUMBER' },
              rate: { type: 'NUMBER' },
            },
            required: ['rate'],
          },
        },
        project_name: { type: 'STRING' },
        business_name: { type: 'STRING' },
        due_date: { type: 'STRING', description: 'YYYY-MM-DD' },
        notes: { type: 'STRING' },
      },
      required: ['client_name', 'items'],
    },
  },
];

// Insert that survives schema drift: drop a column PostgREST says doesn't exist and retry
// (same approach as safeUpsert in src/api.js)
async function safeWrite(db, table, row, onConflict) {
  let payload = { ...row };
  for (let attempt = 0; attempt < 8; attempt++) {
    const q = onConflict
      ? db.from(table).upsert(payload, { onConflict })
      : db.from(table).insert(payload);
    const { error } = await q;
    if (!error) return payload;
    const missing = error.code === 'PGRST204' && /'([^']+)' column/.exec(error.message || '');
    if (!missing) throw error;
    const { [missing[1]]: _drop, ...rest } = payload;
    payload = rest;
  }
  throw new Error(`Could not save to ${table}`);
}

async function findClient(db, name) {
  const { data, error } = await db.from('clients').select('*').ilike('name', name).limit(1);
  if (error) throw error;
  return data && data[0];
}

async function createInvoice(db, args) {
  const clientName = String(args.client_name || '').trim();
  if (!clientName) throw new Error('client_name is required');

  const currency = String(args.currency || 'AED').toUpperCase();
  if (!AED_RATES[currency]) throw new Error(`Unsupported currency ${currency}`);
  const ratesCurrency = String(args.rates_currency || currency).toUpperCase();
  if (!AED_RATES[ratesCurrency]) throw new Error(`Unsupported currency ${ratesCurrency}`);
  const factor = AED_RATES[ratesCurrency] / AED_RATES[currency];

  const items = (Array.isArray(args.items) ? args.items : [])
    .map((it) => ({
      description: String(it.description || 'Professional services'),
      qty: Number(it.qty) || 1,
      rate: round2((Number(it.rate) || 0) * factor),
    }))
    .filter((it) => it.rate > 0);
  if (items.length === 0) throw new Error('At least one item with a rate above zero is required');
  const total = round2(items.reduce((s, it) => s + it.qty * it.rate, 0));

  // Reuse saved client details, or create the client (the app's form does the same)
  let client = await findClient(db, clientName);
  if (!client) {
    const newClient = {
      name: clientName,
      business_name: args.business_name || clientName,
      payment_link: '',
      projects: [],
      created_at: localDate(),
    };
    await safeWrite(db, 'clients', newClient, 'name');
    client = newClient;
  }

  // Next invoice number lives in app_settings, starting at 4001
  const { data: numRow, error: numErr } = await db
    .from('app_settings').select('value').eq('key', 'next_invoice_num').maybeSingle();
  if (numErr) throw numErr;
  let num = numRow ? Number(numRow.value) : 4001;
  // Never reuse a number that already exists
  for (let i = 0; i < 20; i++) {
    const { data: clash } = await db.from('invoices').select('invoice_number').eq('invoice_number', String(num)).limit(1);
    if (!clash || clash.length === 0) break;
    num += 1;
  }
  const invoiceNumber = String(num);
  const createdAt = new Date().toISOString();

  const financeRaw = { paymentType: 'project', salaries: [], totalSalaries: 0, allahShare: 0, saving: 0, _allahManual: false };
  const invoice = {
    invoice_number: invoiceNumber,
    client_name: client.name,
    client_designation: client.designation || '',
    business_name: args.business_name || client.business_name || client.name,
    client_email: client.email || '',
    client_phone: client.phone || '',
    client_address: client.address || '',
    payment_link: client.payment_link || '',
    date: localDate(),
    due_date: args.due_date || '',
    currency,
    items,
    paying_now: 0,
    special_notes: args.notes || '',
    status: 'pending',
    project_name: args.project_name || '',
    total_payment: total,
    remaining: total,
    finance_raw: financeRaw,
    created_at: createdAt,
  };
  await safeWrite(db, 'invoices', invoice, 'invoice_number');

  const { error: setErr } = await db
    .from('app_settings').upsert({ key: 'next_invoice_num', value: String(num + 1) }, { onConflict: 'key' });
  if (setErr) throw setErr;

  // Finance ledger row, mirroring createFinanceRecord() in src/utils/helpers.js
  const ym = localDate().slice(0, 7);
  await safeWrite(db, 'finance_ledger', {
    id: `fin-${invoiceNumber}-${Date.now()}`,
    invoice_id: invoiceNumber,
    month: ym,
    original_month: ym,
    client_name: invoice.client_name,
    business_name: invoice.business_name,
    total_amount: total,
    paid_amount: 0,
    payment_type: 'project',
    salaries: [],
    total_salaries: 0,
    allah_share: 0,
    saving: 0,
    profit: 0,
    status: 'pending',
    notes: invoice.special_notes,
    rolled_over: false,
    created_at: createdAt,
  }, 'id');

  return {
    created: {
      invoiceNumber,
      client: invoice.client_name,
      currency,
      total,
      items,
      status: 'pending',
      convertedFrom: ratesCurrency !== currency ? ratesCurrency : undefined,
    },
  };
}

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
        .select('invoice_number, client_name, project_name, status, total_payment, remaining, currency, date, due_date')
        .order('created_at', { ascending: false })
        .limit(Math.min(Number(args.limit) || 20, 100));
      if (args.status) q = q.eq('status', args.status);
      if (args.client_name) q = q.ilike('client_name', `%${args.client_name}%`);
      const { data, error } = await q;
      if (error) throw error;
      return { invoices: data };
    }
    case 'list_clients': {
      let q = db.from('clients').select('name, business_name, email, phone').order('name');
      if (args.search) q = q.ilike('name', `%${args.search}%`);
      const { data, error } = await q.limit(100);
      if (error) throw error;
      return { clients: data };
    }
    case 'list_employees': {
      const { data, error } = await db.from('employees').select('*').limit(200);
      if (error) throw error;
      return {
        employees: (data || []).map((e) => ({
          name: e.name, baseSalary: e.base_salary, status: e.status, department: e.department,
        })),
      };
    }
    case 'create_client': {
      const name = String(args.name || '').trim();
      if (!name) throw new Error('name is required');
      if (await findClient(db, name)) return { error: `Client "${name}" already exists` };
      const row = { name, business_name: args.business_name || name, payment_link: '', projects: [], created_at: localDate() };
      ['email', 'phone', 'address'].forEach((k) => { if (args[k]) row[k] = String(args[k]); });
      await safeWrite(db, 'clients', row, 'name');
      return { created: { name } };
    }
    case 'create_invoice':
      return createInvoice(db, args);
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
        systemInstruction: { parts: [{ text: systemPrompt() }] },
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

  // Earlier turns of this chat, so follow-ups like "make it 3000 instead" work
  const history = (Array.isArray(req.body?.history) ? req.body.history : [])
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && m.text)
    .slice(-10)
    .map((m) => ({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: String(m.text).slice(0, 2000) }] }));

  // Acts as the signed-in user: RLS applies to every query
  const db = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
  const { data: userData, error: userErr } = await db.auth.getUser(token);
  if (userErr || !userData?.user) return res.status(401).json({ error: 'Session expired, sign in again' });

  const toolLog = [];
  try {
    const contents = [...history, { role: 'user', parts: [{ text: prompt }] }];

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const data = await callGemini(apiKey, contents);
      const parts = data.candidates?.[0]?.content?.parts || [];
      const calls = parts.filter((p) => p.functionCall);

      if (calls.length === 0) {
        const reply = parts.filter((p) => !p.thought).map((p) => p.text || '').join('').trim();
        return res.status(200).json({ reply: reply || 'Done.', toolLog, changed: toolLog.some((t) => t.ok && WRITE_TOOLS.has(t.name)) });
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
        toolLog.push({ name: functionCall.name, ok: !result.error });
        const response = { name: functionCall.name, response: result };
        if (functionCall.id) response.id = functionCall.id;
        responses.push({ functionResponse: response });
      }
      contents.push({ role: 'user', parts: responses });
    }

    return res.status(200).json({
      reply: 'I stopped after too many steps. Try a narrower request.',
      toolLog,
      changed: toolLog.some((t) => t.ok && WRITE_TOOLS.has(t.name)),
    });
  } catch (e) {
    return res.status(500).json({ error: e.message, changed: toolLog.some((t) => t.ok && WRITE_TOOLS.has(t.name)) });
  }
};
