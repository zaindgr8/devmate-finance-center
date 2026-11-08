// Tools the AI assistant can call. Each one mirrors what the matching screen in
// src/App.js does, so records created here look the same as ones made by hand.
// (Files under api/_lib are not exposed as Vercel routes.)

const TIME_ZONE = 'Asia/Dubai';

// Keep in sync with AED_RATES / EXPENSE_CATEGORIES in src/utils/helpers.js
const AED_RATES = { AED: 1, USD: 3.6725, OMR: 9.5475, GBP: 4.9, EUR: 4.25 };
const CURRENCIES = Object.keys(AED_RATES);
const EXPENSE_CATEGORIES = ['fine', 'license', 'visa', 'vehicle', 'insurance', 'government', 'tax', 'rent', 'software', 'equipment', 'travel', 'other'];

/* ── small helpers ─────────────────────────────────────────── */

const localDate = () => new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE }).format(new Date()); // YYYY-MM-DD
const currentYM = () => localDate().slice(0, 7);
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const num = (v) => Number(v) || 0;
const uid = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const escLike = (s) => String(s).replace(/[%_\\]/g, (c) => `\\${c}`);
const sameName = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
const statusFor = (total, paid) => (paid >= total && total > 0 ? 'paid' : paid > 0 ? 'partial' : 'unpaid');

function nextYM(ym) {
  const [y, m] = ym.split('-').map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
}

// Shift YYYY-MM-DD by N months, clamping the day (Jan 31 + 1 → Feb 28)
function addMonths(dateStr, months) {
  const [y, m, d] = (dateStr || localDate()).split('-').map(Number);
  const first = new Date(Date.UTC(y, m - 1 + months, 1));
  const maxDay = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  first.setUTCDate(Math.min(d || 1, maxDay));
  return first.toISOString().slice(0, 10);
}

// Deletes and other irreversible changes need the user's go-ahead first
function needsConfirm(args, summary) {
  if (args.confirm === true) return null;
  return {
    needs_confirmation: true,
    summary,
    instruction: 'Do not proceed yet. Ask the user to confirm exactly this, then call the tool again with confirm=true.',
  };
}

function check({ error }) {
  if (error) throw error;
}

// Insert/upsert that survives schema drift (same approach as safeUpsert in src/api.js)
async function safeWrite(db, table, row, onConflict) {
  let payload = Array.isArray(row) ? row.map((r) => ({ ...r })) : { ...row };
  for (let attempt = 0; attempt < 8; attempt++) {
    const q = onConflict ? db.from(table).upsert(payload, { onConflict }) : db.from(table).insert(payload);
    const { error } = await q;
    if (!error) return payload;
    const missing = error.code === 'PGRST204' && /'([^']+)' column/.exec(error.message || '');
    if (!missing) throw error;
    const drop = (r) => { const { [missing[1]]: _x, ...rest } = r; return rest; };
    payload = Array.isArray(payload) ? payload.map(drop) : drop(payload);
  }
  throw new Error(`Could not save to ${table}`);
}

async function getSetting(db, key, fallback) {
  const { data, error } = await db.from('app_settings').select('value').eq('key', key).maybeSingle();
  if (error) throw error;
  if (!data) return fallback;
  try { return JSON.parse(data.value); } catch (_) { return data.value; }
}

async function setSetting(db, key, value) {
  check(await db.from('app_settings').upsert(
    { key, value: typeof value === 'string' ? value : JSON.stringify(value) },
    { onConflict: 'key' }
  ));
}

async function findClient(db, name) {
  const { data, error } = await db.from('clients').select('*').ilike('name', escLike(String(name).trim())).limit(1);
  if (error) throw error;
  return data && data[0];
}

async function findInvoice(db, invoiceNumber) {
  const n = String(invoiceNumber || '').replace(/^#/, '').trim();
  if (!n) throw new Error('invoice_number is required');
  const { data, error } = await db.from('invoices').select('*').eq('invoice_number', n).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error(`Invoice #${n} not found`);
  return data;
}

async function findEmployee(db, name) {
  const { data, error } = await db.from('employees').select('*').ilike('name', escLike(String(name).trim())).limit(1);
  if (error) throw error;
  return data && data[0];
}

// Next free invoice number, starting at 4001, skipping any that already exist
async function claimInvoiceNumber(db) {
  let n = num(await getSetting(db, 'next_invoice_num', 4001)) || 4001;
  for (let i = 0; i < 50; i++) {
    const { data } = await db.from('invoices').select('invoice_number').eq('invoice_number', String(n)).limit(1);
    if (!data || data.length === 0) break;
    n += 1;
  }
  await setSetting(db, 'next_invoice_num', String(n + 1));
  return String(n);
}

function convertItems(items, currency, ratesCurrency) {
  if (!AED_RATES[currency]) throw new Error(`Unsupported currency ${currency}. Use one of ${CURRENCIES.join(', ')}`);
  if (!AED_RATES[ratesCurrency]) throw new Error(`Unsupported currency ${ratesCurrency}. Use one of ${CURRENCIES.join(', ')}`);
  const factor = AED_RATES[ratesCurrency] / AED_RATES[currency];
  const out = (Array.isArray(items) ? items : [])
    .map((it) => ({
      description: String(it.description || 'Professional services'),
      qty: num(it.qty) || 1,
      rate: round2(num(it.rate) * factor),
    }))
    .filter((it) => it.rate > 0);
  if (out.length === 0) throw new Error('At least one item with a rate above zero is required');
  return out;
}

const itemsTotal = (items) => round2(items.reduce((s, it) => s + num(it.qty) * num(it.rate), 0));

// Mirrors createFinanceRecord() in src/utils/helpers.js
function financeRowFor(inv) {
  const fd = inv.finance_raw || {};
  const isPending = inv.status === 'pending';
  const paid = isPending ? 0 : num(inv.paying_now);
  const totalSalaries = num(fd.totalSalaries);
  const allahShare = fd._allahManual ? num(fd.allahShare) : Math.max(0, (paid - totalSalaries) * 0.05);
  const saving = num(fd.saving);
  const ym = currentYM();
  return {
    id: `fin-${inv.invoice_number}-${Date.now()}`,
    invoice_id: inv.invoice_number,
    month: ym,
    original_month: ym,
    client_name: inv.client_name,
    business_name: inv.business_name || '',
    total_amount: num(inv.total_payment),
    paid_amount: paid,
    payment_type: fd.paymentType || 'project',
    salaries: fd.salaries || [],
    total_salaries: totalSalaries,
    allah_share: allahShare,
    saving,
    profit: paid - totalSalaries - allahShare - saving,
    status: inv.status || 'unpaid',
    notes: inv.special_notes || '',
    rolled_over: false,
    created_at: new Date().toISOString(),
  };
}

// Mirrors extractSalariesFromInvoice() in src/utils/helpers.js
function salariesFor(inv) {
  const fd = inv.finance_raw || {};
  return (fd.salaries || [])
    .filter((s) => s.employee && num(s.amount) > 0)
    .map((s) => ({
      id: uid(`sal-${inv.invoice_number}`),
      invoice_id: inv.invoice_number,
      employee_name: s.employee,
      project_name: inv.business_name || inv.client_name || 'Unknown Project',
      total_salary: num(s.amount),
      paid_amount: 0,
      month: currentYM(),
      status: 'unpaid',
      created_at: new Date().toISOString(),
    }));
}

async function removeUrgentIds(db, ids) {
  const urgent = await getSetting(db, 'urgent_salary_ids', []);
  if (!Array.isArray(urgent)) return;
  const set = new Set(ids);
  const next = urgent.filter((id) => !set.has(id));
  if (next.length !== urgent.length) await setSetting(db, 'urgent_salary_ids', next);
}

/* ── reads ─────────────────────────────────────────────────── */

async function getSummary(db) {
  const ym = currentYM();
  const [{ count: clients }, inv, sal] = await Promise.all([
    db.from('clients').select('*', { count: 'exact', head: true }),
    db.from('invoices').select('status, remaining, currency'),
    db.from('salaries_ledger').select('total_salary, paid_amount, status, month').eq('month', ym),
  ]);
  check(inv); check(sal);
  const byStatus = {};
  const outstanding = {};
  (inv.data || []).forEach((i) => {
    byStatus[i.status] = (byStatus[i.status] || 0) + 1;
    if (i.status !== 'paid' && i.status !== 'scheduled') {
      outstanding[i.currency || 'AED'] = round2((outstanding[i.currency || 'AED'] || 0) + num(i.remaining));
    }
  });
  const salariesDue = round2((sal.data || [])
    .filter((s) => s.status !== 'paid' && s.status !== 'pushed')
    .reduce((s, r) => s + Math.max(0, num(r.total_salary) - num(r.paid_amount)), 0));
  return { month: ym, clients, invoices: (inv.data || []).length, invoicesByStatus: byStatus, outstandingByCurrency: outstanding, salariesDueThisMonthAED: salariesDue };
}

async function listInvoices(db, args) {
  let q = db.from('invoices')
    .select('invoice_number, client_name, business_name, project_name, status, total_payment, paying_now, remaining, currency, date, due_date')
    .order('created_at', { ascending: false })
    .limit(Math.min(num(args.limit) || 20, 200));
  if (args.status) q = q.eq('status', args.status);
  if (args.client_name) q = q.ilike('client_name', `%${escLike(args.client_name)}%`);
  const { data, error } = await q;
  if (error) throw error;
  return { invoices: data };
}

async function getInvoice(db, args) {
  const inv = await findInvoice(db, args.invoice_number);
  const { data: fin } = await db.from('finance_ledger').select('*').eq('invoice_id', inv.invoice_number);
  return { invoice: inv, financeRows: fin || [] };
}

async function listClients(db, args) {
  let q = db.from('clients').select('name, business_name, designation, email, phone, address, payment_link').order('name');
  if (args.search) q = q.ilike('name', `%${escLike(args.search)}%`);
  const { data, error } = await q.limit(200);
  if (error) throw error;
  return { clients: data };
}

async function listEmployees(db) {
  const { data, error } = await db.from('employees').select('*').limit(300);
  if (error) throw error;
  return {
    employees: (data || []).map((e) => ({
      name: e.name, role: e.role, department: e.department, baseSalary: e.base_salary,
      salaryType: e.salary_type, status: e.status, email: e.email, phone: e.phone,
    })),
  };
}

async function listSalaries(db, args) {
  let q = db.from('salaries_ledger').select('*').order('created_at', { ascending: true }).limit(300);
  if (!args.all_months) q = q.eq('month', args.month || currentYM());
  if (args.employee_name) q = q.ilike('employee_name', `%${escLike(args.employee_name)}%`);
  if (args.status) q = q.eq('status', args.status);
  const { data, error } = await q;
  if (error) throw error;
  return {
    salaries: (data || []).map((s) => ({
      id: s.id, employee: s.employee_name, project: s.project_name, month: s.month,
      total: num(s.total_salary), paid: num(s.paid_amount),
      remaining: Math.max(0, num(s.total_salary) - num(s.paid_amount)),
      status: s.status, type: s.salary_type, invoice: s.invoice_id,
    })),
  };
}

async function listBills(db, args) {
  const month = args.month || currentYM();
  const bills = await getSetting(db, 'misc_bills', []);
  const payments = await getSetting(db, 'misc_bill_payments', {});
  const paidMap = (payments && payments[month]) || {};
  const forMonth = (Array.isArray(bills) ? bills : []).filter((b) => {
    if (b.type === 'one-time') return b.month === month;
    const since = (b.created_at || '').slice(0, 7);
    return !since || since <= month;
  });
  return {
    month,
    bills: forMonth.map((b) => {
      const paid = Math.min(num(paidMap[b.id]), num(b.amount));
      return { id: b.id, name: b.name, amount: num(b.amount), section: b.type, category: b.category, paid, status: paid >= num(b.amount) ? 'paid' : paid > 0 ? 'partial' : 'unpaid' };
    }),
  };
}

async function listExpenses(db, args) {
  const expenses = await getSetting(db, 'expenses', []);
  let list = Array.isArray(expenses) ? expenses : [];
  if (args.status === 'paid') list = list.filter((e) => e.status === 'paid');
  else if (args.status !== 'all') list = list.filter((e) => e.status !== 'paid');
  return {
    expenses: list.map((e) => ({
      id: e.id, title: e.title, amount: num(e.amount), currency: e.currency, category: e.category,
      dueDate: e.due_date, status: e.status, paidDate: e.paid_date, repeat: e.repeat,
    })),
  };
}

/* ── clients ───────────────────────────────────────────────── */

const CLIENT_FIELDS = ['business_name', 'designation', 'email', 'phone', 'address', 'payment_link'];

async function createClient(db, args) {
  const name = String(args.name || '').trim();
  if (!name) throw new Error('name is required');
  if (await findClient(db, name)) return { error: `A client named "${name}" already exists` };
  const row = { name, business_name: args.business_name || name, payment_link: '', projects: [], created_at: new Date().toISOString() };
  CLIENT_FIELDS.forEach((k) => { if (args[k] != null && args[k] !== '') row[k] = String(args[k]); });
  await safeWrite(db, 'clients', row, 'name');
  return { created: { name } };
}

async function updateClient(db, args) {
  const client = await findClient(db, args.name || '');
  if (!client) throw new Error(`Client "${args.name}" not found`);

  const patch = {};
  CLIENT_FIELDS.forEach((k) => { if (args[k] != null) patch[k] = String(args[k]); });
  const newName = args.new_name != null ? String(args.new_name).trim() : '';

  // Plain field edit
  if (!newName || newName === client.name) {
    if (!Object.keys(patch).length) return { error: 'Nothing to change' };
    check(await db.from('clients').update(patch).eq('name', client.name));
    return { updated: { name: client.name, ...patch } };
  }

  // Rename: clients are keyed by name, so move the row and every reference to it
  const clash = await findClient(db, newName);
  const isOtherClient = clash && clash.name !== client.name;
  if (isOtherClient && !args.merge) {
    return {
      error: `A client named "${clash.name}" already exists.`,
      instruction: 'Ask the user whether to merge the two clients (moves all invoices onto the existing one). If yes, call again with merge=true.',
    };
  }

  const targetName = isOtherClient ? clash.name : newName;
  if (isOtherClient) {
    if (Object.keys(patch).length) check(await db.from('clients').update(patch).eq('name', targetName));
  } else {
    const { name: _old, ...rest } = client;
    await safeWrite(db, 'clients', { ...rest, ...patch, name: targetName }, 'name');
  }

  const [invRes, finRes] = await Promise.all([
    db.from('invoices').update({ client_name: targetName }).eq('client_name', client.name).select('invoice_number'),
    db.from('finance_ledger').update({ client_name: targetName }).eq('client_name', client.name).select('id'),
  ]);
  check(invRes); check(finRes);
  if (client.name !== targetName) check(await db.from('clients').delete().eq('name', client.name));

  const order = await getSetting(db, 'clients_order', []);
  if (Array.isArray(order) && order.includes(client.name)) {
    const next = isOtherClient ? order.filter((n) => n !== client.name) : order.map((n) => (n === client.name ? targetName : n));
    await setSetting(db, 'clients_order', next);
  }

  return {
    [isOtherClient ? 'merged' : 'renamed']: { from: client.name, to: targetName },
    invoicesMoved: (invRes.data || []).map((r) => r.invoice_number),
    note: 'Business name on existing invoices was not changed.',
  };
}

async function deleteClient(db, args) {
  const client = await findClient(db, args.name || '');
  if (!client) throw new Error(`Client "${args.name}" not found`);
  const { count } = await db.from('invoices').select('*', { count: 'exact', head: true }).eq('client_name', client.name);
  const gate = needsConfirm(args, `Delete client "${client.name}"? Their ${count || 0} invoice(s) are kept.`);
  if (gate) return gate;
  check(await db.from('clients').delete().eq('name', client.name));
  return { deleted: client.name, invoicesKept: count || 0 };
}

/* ── invoices ──────────────────────────────────────────────── */

async function createInvoice(db, args) {
  const clientName = String(args.client_name || '').trim();
  if (!clientName) throw new Error('client_name is required');
  const currency = String(args.currency || 'AED').toUpperCase();
  const items = convertItems(args.items, currency, String(args.rates_currency || currency).toUpperCase());
  const total = itemsTotal(items);

  let client = await findClient(db, clientName);
  if (!client) {
    client = { name: clientName, business_name: args.business_name || clientName, payment_link: '', projects: [], created_at: new Date().toISOString() };
    await safeWrite(db, 'clients', client, 'name');
  }

  const recurring = args.payment_type === 'recurring';
  const invoice = {
    invoice_number: await claimInvoiceNumber(db),
    client_name: client.name,
    client_designation: client.designation || '',
    business_name: args.business_name || client.business_name || client.name,
    client_email: client.email || '',
    client_phone: client.phone || '',
    client_address: client.address || '',
    payment_link: client.payment_link || '',
    date: args.date || localDate(),
    due_date: args.due_date || '',
    currency,
    items,
    paying_now: 0,
    special_notes: args.notes || '',
    status: 'pending',
    project_name: args.project_name || '',
    total_payment: total,
    remaining: total,
    finance_raw: { paymentType: recurring ? 'recurring' : 'project', salaries: [], totalSalaries: 0, allahShare: 0, saving: 0, _allahManual: false },
    created_at: new Date().toISOString(),
  };
  await safeWrite(db, 'invoices', invoice, 'invoice_number');
  await safeWrite(db, 'finance_ledger', financeRowFor(invoice), 'id');

  return { created: { invoiceNumber: invoice.invoice_number, client: invoice.client_name, currency, total, items, status: 'pending', recurring } };
}

async function updateInvoice(db, args) {
  const inv = await findInvoice(db, args.invoice_number);
  const patch = {};
  ['due_date', 'date', 'project_name', 'business_name'].forEach((k) => { if (args[k] != null) patch[k] = String(args[k]); });
  if (args.notes != null) patch.special_notes = String(args.notes);

  if (args.client_name != null && !sameName(args.client_name, inv.client_name)) {
    const client = await findClient(db, args.client_name);
    if (!client) return { error: `Client "${args.client_name}" not found. Create it first or check the name.` };
    Object.assign(patch, {
      client_name: client.name,
      client_designation: client.designation || '',
      client_email: client.email || '',
      client_phone: client.phone || '',
      client_address: client.address || '',
      payment_link: client.payment_link || '',
    });
  }

  const currency = String(args.currency || inv.currency || 'AED').toUpperCase();
  if (args.items || (args.currency && currency !== inv.currency)) {
    const ratesCurrency = String(args.rates_currency || (args.items ? currency : inv.currency)).toUpperCase();
    const items = convertItems(args.items || inv.items, currency, ratesCurrency);
    const total = itemsTotal(items);
    const paid = num(inv.paying_now);
    if (['paid', 'partial'].includes(inv.status) && paid > total) {
      return { error: `New total ${total} ${currency} is less than the ${paid} already received.` };
    }
    Object.assign(patch, { items, currency, total_payment: total, remaining: Math.max(0, round2(total - paid)) });
    if (['paid', 'partial'].includes(inv.status)) patch.status = statusFor(total, paid);
  }

  if (!Object.keys(patch).length) return { error: 'Nothing to change' };
  check(await db.from('invoices').update(patch).eq('invoice_number', inv.invoice_number));

  // Keep the linked finance row in step (the edit form does the same)
  const finPatch = {};
  if (patch.total_payment != null) finPatch.total_amount = patch.total_payment;
  if (patch.status) finPatch.status = patch.status;
  if (patch.client_name) finPatch.client_name = patch.client_name;
  if (patch.business_name != null) finPatch.business_name = patch.business_name;
  if (patch.special_notes != null) finPatch.notes = patch.special_notes;
  if (Object.keys(finPatch).length) check(await db.from('finance_ledger').update(finPatch).eq('invoice_id', inv.invoice_number));

  return { updated: { invoiceNumber: inv.invoice_number, ...patch } };
}

// Recurring invoices clone themselves into next month once fully paid
// (mirrors checkAndCloneRecurring in src/App.js)
async function cloneRecurring(db, inv) {
  const fd = inv.finance_raw || {};
  if (fd.paymentType !== 'recurring' || fd.clonedToNextMonth) return null;

  const { paid_at: _p, scheduled_date: _s, ...cleanFd } = fd;
  const clone = {
    ...inv,
    invoice_number: await claimInvoiceNumber(db),
    status: 'pending',
    paying_now: num(inv.total_payment),
    remaining: num(inv.total_payment),
    date: addMonths(inv.date, 1),
    due_date: inv.due_date ? addMonths(inv.due_date, 1) : '',
    created_at: new Date().toISOString(),
    finance_raw: { ...cleanFd, clonedToNextMonth: false },
  };
  delete clone.id;
  await safeWrite(db, 'invoices', clone, 'invoice_number');
  check(await db.from('invoices').update({ finance_raw: { ...fd, clonedToNextMonth: true } }).eq('invoice_number', inv.invoice_number));
  await safeWrite(db, 'finance_ledger', financeRowFor(clone), 'id');
  const sals = salariesFor(clone);
  if (sals.length) await safeWrite(db, 'salaries_ledger', sals, 'id');
  return clone.invoice_number;
}

async function recordPayment(db, args) {
  const inv = await findInvoice(db, args.invoice_number);
  const total = num(inv.total_payment);
  // Pending/unpaid invoices have received nothing yet; partial ones keep what was recorded
  const already = ['partial', 'paid'].includes(inv.status) ? num(inv.paying_now) : 0;
  if (already >= total && total > 0) return { error: `Invoice #${inv.invoice_number} is already fully paid` };

  const amount = args.amount != null ? num(args.amount) : total - already;
  if (amount <= 0) throw new Error('amount must be above zero');
  const paid = round2(Math.min(total, already + amount));
  const status = statusFor(total, paid);
  const paidAt = new Date().toISOString();

  check(await db.from('invoices').update({
    status,
    paying_now: paid,
    remaining: Math.max(0, round2(total - paid)),
    finance_raw: { ...(inv.finance_raw || {}), paid_at: paidAt },
  }).eq('invoice_number', inv.invoice_number));

  const { data: finRows, error: finErr } = await db.from('finance_ledger').select('*').eq('invoice_id', inv.invoice_number);
  if (finErr) throw finErr;
  for (const r of finRows || []) {
    const totalSalaries = num(r.total_salaries);
    const allahShare = Math.max(0, (paid - totalSalaries) * 0.05);
    const profit = paid - totalSalaries - allahShare - num(r.saving);
    check(await db.from('finance_ledger').update({ paid_amount: paid, allah_share: allahShare, profit, status }).eq('id', r.id));
  }

  let clonedAs = null;
  if (status === 'paid') {
    clonedAs = await cloneRecurring(db, { ...inv, status, paying_now: paid, finance_raw: { ...(inv.finance_raw || {}), paid_at: paidAt } });
  }

  return {
    payment: {
      invoiceNumber: inv.invoice_number,
      thisPayment: round2(paid - already),
      receivedTotal: paid,
      remaining: Math.max(0, round2(total - paid)),
      currency: inv.currency,
      status,
      recurringClonedAs: clonedAs || undefined,
    },
  };
}

async function deleteInvoice(db, args) {
  const inv = await findInvoice(db, args.invoice_number);
  const { data: sals } = await db.from('salaries_ledger').select('*').eq('invoice_id', inv.invoice_number);
  // Unpaid salaries created from this invoice go with it; paid history is kept (same as the UI)
  const orphans = (sals || []).filter((s) => !(num(s.paid_amount) > 0) && s.status !== 'paid' && s.status !== 'pushed');
  const gate = needsConfirm(args,
    `Delete invoice #${inv.invoice_number} (${inv.client_name}, ${inv.total_payment} ${inv.currency})?` +
    (orphans.length ? ` This also removes ${orphans.length} unpaid salary record(s) linked to it.` : ''));
  if (gate) return gate;

  check(await db.from('invoices').delete().eq('invoice_number', inv.invoice_number));
  check(await db.from('finance_ledger').delete().eq('invoice_id', inv.invoice_number));
  if (orphans.length) {
    check(await db.from('salaries_ledger').delete().in('id', orphans.map((s) => s.id)));
    await removeUrgentIds(db, orphans.map((s) => s.id));
  }
  return { deleted: inv.invoice_number, salariesRemoved: orphans.length };
}

/* ── employees ─────────────────────────────────────────────── */

const EMPLOYEE_FIELDS = ['role', 'department', 'email', 'phone', 'join_date', 'notes', 'salary_type', 'status'];

async function createEmployee(db, args) {
  const name = String(args.name || '').trim();
  if (!name) throw new Error('name is required');
  const dup = await findEmployee(db, name);
  if (dup) return { error: `An employee named "${dup.name}" already exists. Salaries are matched by name, so names must be unique.` };
  const row = {
    id: `emp-${Date.now()}`,
    name,
    base_salary: num(args.base_salary),
    status: 'active',
    salary_type: 'monthly',
    created_at: new Date().toISOString(),
  };
  EMPLOYEE_FIELDS.forEach((k) => { if (args[k] != null && args[k] !== '') row[k] = String(args[k]); });
  await safeWrite(db, 'employees', row, 'id');
  return { created: { name, baseSalary: row.base_salary, department: row.department } };
}

async function updateEmployee(db, args) {
  const emp = await findEmployee(db, args.name || '');
  if (!emp) throw new Error(`Employee "${args.name}" not found`);
  const patch = {};
  EMPLOYEE_FIELDS.forEach((k) => { if (args[k] != null) patch[k] = String(args[k]); });
  if (args.base_salary != null) patch.base_salary = num(args.base_salary);

  const newName = args.new_name != null ? String(args.new_name).trim() : '';
  let salariesRenamed = 0;
  if (newName && newName !== emp.name) {
    const dup = await findEmployee(db, newName);
    if (dup && dup.id !== emp.id) return { error: `An employee named "${dup.name}" already exists.` };
    patch.name = newName;
  }
  if (!Object.keys(patch).length) return { error: 'Nothing to change' };
  check(await db.from('employees').update(patch).eq('id', emp.id));

  // Salaries are linked by name, so a rename carries over to them (same as the UI)
  if (patch.name) {
    const res = await db.from('salaries_ledger').update({ employee_name: patch.name })
      .ilike('employee_name', escLike(emp.name)).select('id');
    check(res);
    salariesRenamed = (res.data || []).length;
  }
  return { updated: { name: patch.name || emp.name, ...patch }, salariesRenamed };
}

async function deleteEmployee(db, args) {
  const emp = await findEmployee(db, args.name || '');
  if (!emp) throw new Error(`Employee "${args.name}" not found`);
  const gate = needsConfirm(args, `Delete employee "${emp.name}"? Their salary records are kept.`);
  if (gate) return gate;
  check(await db.from('employees').delete().eq('id', emp.id));
  return { deleted: emp.name };
}

/* ── salaries ──────────────────────────────────────────────── */

const salaryKey = (r) => `${String(r.employee_name || '').trim().toLowerCase()}|${String(r.project_name || '').trim().toLowerCase()}`;

// When a monthly salary is fully paid, queue next month's installment once
// (mirrors withAutoPush in src/App.js)
async function autoPush(db, row) {
  if (row.salary_type !== 'monthly' || row.status !== 'paid' || row.auto_pushed) return null;
  check(await db.from('salaries_ledger').update({ auto_pushed: true }).eq('id', row.id));
  const month = nextYM(row.month);
  const { data: existing } = await db.from('salaries_ledger').select('*').eq('month', month).eq('salary_type', 'monthly');
  if ((existing || []).some((r) => r.id !== row.id && salaryKey(r) === salaryKey(row))) return null;
  const next = {
    ...row,
    id: `sal-auto-monthly-${row.id}-${Date.now()}`,
    month,
    paid_amount: 0,
    status: 'unpaid',
    rolled_over: true,
    auto_pushed: false,
    original_month: row.original_month || row.month,
    created_at: new Date().toISOString(),
  };
  await safeWrite(db, 'salaries_ledger', next, 'id');
  return month;
}

async function addSalary(db, args) {
  const name = String(args.employee_name || '').trim();
  const amount = num(args.amount);
  if (!name) throw new Error('employee_name is required');
  if (amount <= 0) throw new Error('amount must be above zero');
  const emp = await findEmployee(db, name);
  const row = {
    id: `sal-${Date.now()}`,
    employee_name: emp ? emp.name : name,
    project_name: args.project_name || '',
    salary_type: args.salary_type || (emp && emp.salary_type) || 'monthly',
    total_salary: amount,
    paid_amount: 0,
    status: 'unpaid',
    month: args.month || currentYM(),
    created_at: new Date().toISOString(),
  };
  await safeWrite(db, 'salaries_ledger', row, 'id');
  return { created: { id: row.id, employee: row.employee_name, amount, month: row.month, type: row.salary_type }, warning: emp ? undefined : `"${name}" is not in Employees` };
}

async function paySalary(db, args) {
  let rows;
  if (args.salary_id) {
    const { data, error } = await db.from('salaries_ledger').select('*').eq('id', args.salary_id);
    if (error) throw error;
    if (!data || !data.length) throw new Error(`Salary ${args.salary_id} not found`);
    rows = data;
  } else {
    if (!args.employee_name) throw new Error('Give salary_id or employee_name');
    const { data, error } = await db.from('salaries_ledger').select('*')
      .ilike('employee_name', escLike(String(args.employee_name).trim()))
      .order('month', { ascending: true }).order('created_at', { ascending: true });
    if (error) throw error;
    rows = (data || []).filter((s) => s.status !== 'paid' && s.status !== 'pushed' && num(s.total_salary) > num(s.paid_amount));
    if (!rows.length) return { error: `No outstanding salary for "${args.employee_name}"` };
    // No amount: settle only the oldest outstanding record in full
    if (args.amount == null) rows = rows.slice(0, 1);
  }

  let left = args.amount != null ? num(args.amount) : Infinity;
  if (left <= 0) throw new Error('amount must be above zero');
  const paidRows = [];
  for (const s of rows) {
    if (left <= 0) break;
    const due = Math.max(0, num(s.total_salary) - num(s.paid_amount));
    if (due <= 0) continue;
    const pay = Math.min(due, left);
    left -= pay;
    const paidAmount = round2(num(s.paid_amount) + pay);
    const status = statusFor(num(s.total_salary), paidAmount);
    check(await db.from('salaries_ledger').update({ paid_amount: paidAmount, status }).eq('id', s.id));
    const nextQueued = await autoPush(db, { ...s, paid_amount: paidAmount, status });
    paidRows.push({ id: s.id, employee: s.employee_name, month: s.month, paid: round2(pay), status, nextMonthQueued: nextQueued || undefined });
  }
  return { paid: paidRows, unallocated: Number.isFinite(left) && left > 0 ? round2(left) : undefined };
}

async function updateSalary(db, args) {
  const { data, error } = await db.from('salaries_ledger').select('*').eq('id', args.salary_id || '').maybeSingle();
  if (error) throw error;
  if (!data) throw new Error(`Salary ${args.salary_id} not found`);
  const patch = {};
  if (args.total_salary != null) patch.total_salary = num(args.total_salary);
  if (args.paid_amount != null) patch.paid_amount = num(args.paid_amount);
  ['month', 'project_name', 'salary_type'].forEach((k) => { if (args[k] != null) patch[k] = String(args[k]); });
  if (!Object.keys(patch).length) return { error: 'Nothing to change' };
  const total = patch.total_salary != null ? patch.total_salary : num(data.total_salary);
  const paid = patch.paid_amount != null ? patch.paid_amount : num(data.paid_amount);
  if (paid > total) return { error: 'Paid cannot be more than the total' };
  patch.status = data.status === 'pushed' ? 'pushed' : statusFor(total, paid);
  check(await db.from('salaries_ledger').update(patch).eq('id', data.id));
  const nextQueued = await autoPush(db, { ...data, ...patch });
  return { updated: { id: data.id, ...patch }, nextMonthQueued: nextQueued || undefined };
}

async function deleteSalary(db, args) {
  const { data, error } = await db.from('salaries_ledger').select('*').eq('id', args.salary_id || '').maybeSingle();
  if (error) throw error;
  if (!data) throw new Error(`Salary ${args.salary_id} not found`);
  const gate = needsConfirm(args, `Delete ${data.employee_name}'s salary record for ${data.month} (${data.total_salary}, paid ${data.paid_amount || 0})?`);
  if (gate) return gate;
  check(await db.from('salaries_ledger').delete().eq('id', data.id));
  await removeUrgentIds(db, [data.id]);
  return { deleted: data.id };
}

/* ── bills (stored as JSON in app_settings.misc_bills) ─────── */

function pickOne(list, args, idKey, nameKey, label) {
  if (args[idKey]) {
    const hit = list.find((x) => x.id === args[idKey]);
    if (!hit) throw new Error(`${label} ${args[idKey]} not found`);
    return hit;
  }
  const q = String(args[nameKey] || '').trim().toLowerCase();
  if (!q) throw new Error(`Give ${idKey} or ${nameKey}`);
  const exact = list.filter((x) => String(x[nameKey] || '').trim().toLowerCase() === q);
  const hits = exact.length ? exact : list.filter((x) => String(x[nameKey] || '').toLowerCase().includes(q));
  if (!hits.length) throw new Error(`No ${label.toLowerCase()} matching "${args[nameKey]}"`);
  if (hits.length > 1) {
    throw new Error(`Several ${label.toLowerCase()}s match "${args[nameKey]}": ${hits.map((h) => `${h[nameKey]} (${h.id})`).join(', ')}. Use the id.`);
  }
  return hits[0];
}

async function addBill(db, args) {
  const name = String(args.name || '').trim();
  const amount = num(args.amount);
  if (!name) throw new Error('name is required');
  if (amount <= 0) throw new Error('amount must be above zero');
  const bills = await getSetting(db, 'misc_bills', []);
  const list = Array.isArray(bills) ? bills : [];
  const type = args.type || 'monthly';
  const bill = {
    name,
    amount,
    type,
    category: args.category || 'Other',
    month: args.month || currentYM(),
    order: list.filter((b) => b.type === type).length,
    id: uid('bill'),
    created_at: new Date().toISOString(),
  };
  await setSetting(db, 'misc_bills', [bill, ...list]);
  return { created: { id: bill.id, name, amount, type, month: type === 'one-time' ? bill.month : undefined } };
}

async function updateBill(db, args) {
  const bills = await getSetting(db, 'misc_bills', []);
  const list = Array.isArray(bills) ? bills : [];
  const bill = pickOne(list, args, 'bill_id', 'name', 'Bill');
  const patch = {};
  if (args.new_name != null) patch.name = String(args.new_name).trim();
  if (args.amount != null) patch.amount = num(args.amount);
  ['type', 'category', 'month'].forEach((k) => { if (args[k] != null) patch[k] = String(args[k]); });
  if (!Object.keys(patch).length) return { error: 'Nothing to change' };
  await setSetting(db, 'misc_bills', list.map((b) => (b.id === bill.id ? { ...b, ...patch } : b)));
  return { updated: { id: bill.id, ...patch } };
}

async function payBill(db, args) {
  const bills = await getSetting(db, 'misc_bills', []);
  const list = Array.isArray(bills) ? bills : [];
  const bill = pickOne(list, args, 'bill_id', 'name', 'Bill');
  const month = args.month || currentYM();
  const amount = args.amount != null ? num(args.amount) : num(bill.amount); // 0 marks it unpaid
  const payments = await getSetting(db, 'misc_bill_payments', {});
  const next = { ...(payments || {}), [month]: { ...((payments || {})[month] || {}), [bill.id]: amount } };
  await setSetting(db, 'misc_bill_payments', next);
  return { bill: bill.name, month, paid: amount, of: num(bill.amount), status: amount >= num(bill.amount) ? 'paid' : amount > 0 ? 'partial' : 'unpaid' };
}

async function deleteBill(db, args) {
  const bills = await getSetting(db, 'misc_bills', []);
  const list = Array.isArray(bills) ? bills : [];
  const bill = pickOne(list, args, 'bill_id', 'name', 'Bill');
  const gate = needsConfirm(args, `Delete bill "${bill.name}" (${bill.amount})?`);
  if (gate) return gate;
  await setSetting(db, 'misc_bills', list.filter((b) => b.id !== bill.id));
  return { deleted: bill.name };
}

/* ── expenses (stored as JSON in app_settings.expenses) ────── */

// Paying a repeating expense schedules its next occurrence once (mirrors withRenewal in ExpensesView)
function withRenewal(list, exp) {
  if (exp.status !== 'paid' || !exp.repeat || exp.repeat === 'none' || exp.renewed_id) return { list, renewed: null };
  const months = { monthly: 1, quarterly: 3, yearly: 12 }[exp.repeat];
  if (!months) return { list, renewed: null };
  const next = {
    ...exp,
    id: uid('exp'),
    due_date: addMonths(exp.due_date || exp.paid_date || localDate(), months),
    status: 'unpaid',
    paid_date: '',
    renewed_id: null,
    renewed_from: exp.id,
    created_at: new Date().toISOString(),
  };
  return { list: [next, ...list.map((e) => (e.id === exp.id ? { ...exp, renewed_id: next.id } : e))], renewed: next };
}

async function addExpense(db, args) {
  const title = String(args.title || '').trim();
  const amount = num(args.amount);
  if (!title) throw new Error('title is required');
  if (amount <= 0) throw new Error('amount must be above zero');
  const currency = String(args.currency || 'AED').toUpperCase();
  if (!AED_RATES[currency]) throw new Error(`Unsupported currency ${currency}`);
  const category = EXPENSE_CATEGORIES.includes(args.category) ? args.category : 'other';
  const paid = args.status === 'paid';
  const exp = {
    title, category, amount, currency,
    due_date: args.due_date || '',
    status: paid ? 'paid' : 'unpaid',
    paid_date: paid ? (args.paid_date || localDate()) : '',
    repeat: args.repeat || 'none',
    reference: args.reference || '',
    authority: args.authority || '',
    notes: args.notes || '',
    id: uid('exp'),
    created_at: new Date().toISOString(),
  };
  const expenses = await getSetting(db, 'expenses', []);
  const { list, renewed } = withRenewal([exp, ...(Array.isArray(expenses) ? expenses : [])], exp);
  await setSetting(db, 'expenses', list);
  return { created: { id: exp.id, title, amount, currency, status: exp.status }, nextRenewalDue: renewed ? renewed.due_date : undefined };
}

async function payExpense(db, args) {
  const expenses = await getSetting(db, 'expenses', []);
  const list0 = Array.isArray(expenses) ? expenses : [];
  const exp = pickOne(list0, args, 'expense_id', 'title', 'Expense');
  if (exp.status === 'paid') return { error: `"${exp.title}" is already paid` };
  const paid = { ...exp, status: 'paid', paid_date: args.paid_date || localDate() };
  const { list, renewed } = withRenewal(list0.map((e) => (e.id === exp.id ? paid : e)), paid);
  await setSetting(db, 'expenses', list);
  return { paid: { id: exp.id, title: exp.title, amount: num(exp.amount), currency: exp.currency }, nextRenewalDue: renewed ? renewed.due_date : undefined };
}

async function deleteExpense(db, args) {
  const expenses = await getSetting(db, 'expenses', []);
  const list = Array.isArray(expenses) ? expenses : [];
  const exp = pickOne(list, args, 'expense_id', 'title', 'Expense');
  const gate = needsConfirm(args, `Delete expense "${exp.title}" (${exp.amount} ${exp.currency})?`);
  if (gate) return gate;
  await setSetting(db, 'expenses', list.filter((e) => e.id !== exp.id));
  return { deleted: exp.title };
}

/* ── declarations for Gemini ───────────────────────────────── */

const S = (description) => ({ type: 'STRING', description });
const N = (description) => ({ type: 'NUMBER', description });
const CONFIRM = { type: 'BOOLEAN', description: 'Only true after the user has explicitly confirmed this deletion' };
const obj = (properties, required) => ({ type: 'OBJECT', properties, ...(required ? { required } : {}) });
const CUR = `One of ${CURRENCIES.join(', ')}`;

const ITEMS = {
  type: 'ARRAY',
  description: 'Line items',
  items: obj({ description: S('What the line is for'), qty: N('Quantity, default 1'), rate: N('Price per unit') }, ['rate']),
};

const TOOLS = [
  // reads
  { name: 'get_summary', description: 'Overview: clients, invoice counts by status, outstanding amounts by currency, salaries still due this month.', parameters: obj({}), run: getSummary },
  { name: 'list_invoices', description: 'List invoices, newest first, optionally by status (pending, unpaid, partial, paid, scheduled) or client name.', parameters: obj({ status: S('pending, unpaid, partial, paid or scheduled'), client_name: S('Partial client name'), limit: N('Max rows, default 20') }), run: listInvoices },
  { name: 'get_invoice', description: 'Full details of one invoice, including items and its finance ledger row.', parameters: obj({ invoice_number: S('e.g. 4056') }, ['invoice_number']), run: getInvoice },
  { name: 'list_clients', description: 'List clients, optionally matching a name.', parameters: obj({ search: S('Partial name') }), run: listClients },
  { name: 'list_employees', description: 'List employees with role, department, base salary and status.', parameters: obj({}), run: listEmployees },
  { name: 'list_salaries', description: 'Salary records with ids. Defaults to the current month.', parameters: obj({ month: S('YYYY-MM'), all_months: { type: 'BOOLEAN', description: 'Every month instead of one' }, employee_name: S('Partial name'), status: S('unpaid, partial, paid or pushed') }), run: listSalaries },
  { name: 'list_bills', description: 'Bills that apply to a month (default current) with what has been paid.', parameters: obj({ month: S('YYYY-MM') }), run: listBills },
  { name: 'list_expenses', description: 'Expenses such as fines, renewals and fees. Defaults to the unpaid ones.', parameters: obj({ status: S('open (default), paid or all') }), run: listExpenses },

  // clients
  { name: 'create_client', description: 'Add a new client.', write: true, parameters: obj({ name: S('Client name'), business_name: S(''), designation: S(''), email: S(''), phone: S(''), address: S(''), payment_link: S('') }, ['name']), run: createClient },
  { name: 'update_client', description: 'Edit or rename a client. A rename also moves their invoices and finance rows to the new name.', write: true, parameters: obj({ name: S('Current client name'), new_name: S('New name, to rename'), merge: { type: 'BOOLEAN', description: 'Merge into an existing client with new_name. Only after the user agrees.' }, business_name: S(''), designation: S(''), email: S(''), phone: S(''), address: S(''), payment_link: S('') }, ['name']), run: updateClient },
  { name: 'delete_client', description: 'Delete a client (their invoices are kept). Needs confirmation.', write: true, parameters: obj({ name: S('Client name'), confirm: CONFIRM }, ['name']), run: deleteClient },

  // invoices
  { name: 'create_invoice', description: 'Create a new pending invoice. Adds the client if they do not exist.', write: true, parameters: obj({ client_name: S('Client name'), currency: S(`Invoice currency. ${CUR}. Default AED`), rates_currency: S('Currency the rates are given in, if different (the tool converts)'), items: ITEMS, project_name: S(''), business_name: S(''), date: S('YYYY-MM-DD, default today'), due_date: S('YYYY-MM-DD'), notes: S(''), payment_type: S('project (default) or recurring (monthly, auto-cloned when paid)') }, ['client_name', 'items']), run: createInvoice },
  { name: 'update_invoice', description: 'Edit an invoice: items, amounts, currency, dates, project, notes, or move it to another client.', write: true, parameters: obj({ invoice_number: S('e.g. 4056'), items: ITEMS, currency: S(CUR), rates_currency: S('Currency the new rates are given in, if different'), date: S('YYYY-MM-DD'), due_date: S('YYYY-MM-DD'), project_name: S(''), business_name: S(''), notes: S(''), client_name: S('Move to this existing client') }, ['invoice_number']), run: updateInvoice },
  { name: 'record_payment', description: 'Record money received for an invoice (confirms a pending invoice). Without amount, marks it fully paid. Updates the finance ledger; recurring invoices clone into next month when fully paid.', write: true, parameters: obj({ invoice_number: S('e.g. 4056'), amount: N('Amount received in this payment, in the invoice currency. Omit to pay in full.') }, ['invoice_number']), run: recordPayment },
  { name: 'delete_invoice', description: 'Delete an invoice, its finance row and its unpaid linked salaries. Needs confirmation.', write: true, parameters: obj({ invoice_number: S('e.g. 4056'), confirm: CONFIRM }, ['invoice_number']), run: deleteInvoice },

  // employees
  { name: 'create_employee', description: 'Add an employee.', write: true, parameters: obj({ name: S(''), base_salary: N('Monthly base salary in AED'), role: S(''), department: S(''), email: S(''), phone: S(''), join_date: S('YYYY-MM-DD'), salary_type: S('monthly or project'), notes: S('') }, ['name']), run: createEmployee },
  { name: 'update_employee', description: 'Edit or rename an employee (a rename carries over to their salary records), or set status active/inactive.', write: true, parameters: obj({ name: S('Current name'), new_name: S(''), base_salary: N(''), role: S(''), department: S(''), email: S(''), phone: S(''), join_date: S('YYYY-MM-DD'), salary_type: S('monthly or project'), status: S('active or inactive'), notes: S('') }, ['name']), run: updateEmployee },
  { name: 'delete_employee', description: 'Delete an employee (salary records are kept). Needs confirmation.', write: true, parameters: obj({ name: S(''), confirm: CONFIRM }, ['name']), run: deleteEmployee },

  // salaries
  { name: 'add_salary', description: 'Add a salary record to pay an employee.', write: true, parameters: obj({ employee_name: S(''), amount: N('Salary amount in AED'), month: S('YYYY-MM, default current'), salary_type: S('monthly or project'), project_name: S('') }, ['employee_name', 'amount']), run: addSalary },
  { name: 'pay_salary', description: 'Pay salary. With salary_id pays that record (default in full). With employee_name and amount, applies it to their oldest outstanding records first; without amount pays only the oldest outstanding record in full.', write: true, parameters: obj({ salary_id: S('From list_salaries'), employee_name: S(''), amount: N('Amount paid in AED') }), run: paySalary },
  { name: 'update_salary', description: 'Edit a salary record: total, paid amount, month, project or type.', write: true, parameters: obj({ salary_id: S('From list_salaries'), total_salary: N(''), paid_amount: N('Total paid so far'), month: S('YYYY-MM'), project_name: S(''), salary_type: S('monthly or project') }, ['salary_id']), run: updateSalary },
  { name: 'delete_salary', description: 'Delete a salary record. Needs confirmation.', write: true, parameters: obj({ salary_id: S(''), confirm: CONFIRM }, ['salary_id']), run: deleteSalary },

  // bills
  { name: 'add_bill', description: 'Add a bill (rent, internet, etc.) on the Payments page.', write: true, parameters: obj({ name: S(''), amount: N('Amount in AED'), type: S('monthly (default), one-time, or a custom section id'), category: S(''), month: S('YYYY-MM, for one-time bills') }, ['name', 'amount']), run: addBill },
  { name: 'update_bill', description: 'Edit a bill by id or name.', write: true, parameters: obj({ bill_id: S(''), name: S('Current name'), new_name: S(''), amount: N(''), type: S(''), category: S(''), month: S('YYYY-MM') }), run: updateBill },
  { name: 'pay_bill', description: 'Set how much of a bill is paid for a month (default current). Without amount, marks it fully paid; amount 0 marks it unpaid.', write: true, parameters: obj({ bill_id: S(''), name: S('Bill name'), amount: N('Total paid for that month'), month: S('YYYY-MM') }), run: payBill },
  { name: 'delete_bill', description: 'Delete a bill. Needs confirmation.', write: true, parameters: obj({ bill_id: S(''), name: S(''), confirm: CONFIRM }), run: deleteBill },

  // expenses
  { name: 'add_expense', description: 'Add an important expense (fine, license, visa, renewal, fee...).', write: true, parameters: obj({ title: S(''), amount: N(''), currency: S(CUR), category: S(EXPENSE_CATEGORIES.join(', ')), due_date: S('YYYY-MM-DD'), repeat: S('none, monthly, quarterly or yearly'), status: S('unpaid (default) or paid'), paid_date: S('YYYY-MM-DD'), reference: S(''), authority: S(''), notes: S('') }, ['title', 'amount']), run: addExpense },
  { name: 'pay_expense', description: 'Mark an expense paid (repeating ones schedule the next renewal).', write: true, parameters: obj({ expense_id: S(''), title: S(''), paid_date: S('YYYY-MM-DD, default today') }), run: payExpense },
  { name: 'delete_expense', description: 'Delete an expense. Needs confirmation.', write: true, parameters: obj({ expense_id: S(''), title: S(''), confirm: CONFIRM }), run: deleteExpense },
];

const BY_NAME = Object.fromEntries(TOOLS.map((t) => [t.name, t]));

async function runTool(db, name, args) {
  const tool = BY_NAME[name];
  if (!tool) throw new Error(`Unknown tool: ${name}`);
  return tool.run(db, args || {});
}

const isWrite = (name) => !!(BY_NAME[name] && BY_NAME[name].write);
const declarations = () => TOOLS.map(({ name, description, parameters }) => ({ name, description, parameters }));

module.exports = { runTool, isWrite, declarations, localDate, CURRENCIES };
