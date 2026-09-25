import { supabase } from './supabaseClient';

// Helper to convert snake_case to camelCase
const toCamel = (obj) => {
  if (!obj) return obj;
  const newObj = {};
  for (const key in obj) {
    const camelKey = key.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
    newObj[camelKey] = obj[key];
  }
  return newObj;
};

// Helper to convert camelCase to snake_case
const toSnake = (obj) => {
  if (!obj) return obj;
  const newObj = {};
  for (const key in obj) {
    const snakeKey = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
    newObj[snakeKey] = obj[key];
  }
  return newObj;
};

// Upsert that survives schema drift: if PostgREST reports a column that doesn't
// exist (PGRST204), drop that field and retry instead of losing the whole write.
async function safeUpsert(table, payload, onConflict) {
  let rows = Array.isArray(payload) ? payload.map((r) => ({ ...r })) : [{ ...payload }];
  for (let attempt = 0; attempt < 6; attempt++) {
    const { error } = await supabase.from(table).upsert(rows, { onConflict });
    if (!error) return;
    const missing = error.code === 'PGRST204' && /'([^']+)' column/.exec(error.message || '');
    if (!missing) {
      console.error(`Error upserting ${table}:`, error);
      throw error;
    }
    console.warn(`[${table}] column "${missing[1]}" not in schema — saving without it`);
    rows = rows.map(({ [missing[1]]: _drop, ...rest }) => rest);
  }
  throw new Error(`Could not save to ${table}`);
}

async function checked(promise, label) {
  const { error } = await promise;
  if (error) {
    console.error(`Error ${label}:`, error);
    throw error;
  }
}

export async function fetchAllData() {
  const [
    { data: clients },
    { data: invoices },
    { data: finance },
    { data: salaries },
    { data: settings },
    { data: employees },
  ] = await Promise.all([
    supabase.from('clients').select('*').order('created_at', { ascending: false }),
    supabase.from('invoices').select('*').order('created_at', { ascending: false }),
    supabase.from('finance_ledger').select('*').order('created_at', { ascending: false }),
    supabase.from('salaries_ledger').select('*').order('created_at', { ascending: false }),
    supabase.from('app_settings').select('*'),
    supabase.from('employees').select('*').order('created_at', { ascending: false }),
  ]);

  // Surface a failed core query instead of silently rendering an empty portal
  if (settings === null && clients === null && invoices === null) {
    throw new Error('Could not reach the database');
  }

  // Fetch bills separately so a missing table doesn't break the whole load
  const miscBillsSet = (settings || []).find(s => s.key === 'misc_bills');
  let billsData = [];
  try {
    billsData = miscBillsSet ? JSON.parse(miscBillsSet.value || '[]') : [];
  } catch (_) { billsData = []; }

  const billSectionsSet = (settings || []).find(s => s.key === 'misc_bill_sections');
  let sectionsData = [];
  try {
    sectionsData = billSectionsSet ? JSON.parse(billSectionsSet.value || '[]') : [];
  } catch (_) { sectionsData = []; }

  const billPaymentsSet = (settings || []).find(s => s.key === 'misc_bill_payments');
  let billPaymentsData = {};
  try {
    billPaymentsData = billPaymentsSet ? JSON.parse(billPaymentsSet.value || '{}') : {};
  } catch (_) { billPaymentsData = {}; }

  const nextNumSet = (settings || []).find(s => s.key === 'next_invoice_num');
  const lastRolloverSet = (settings || []).find(s => s.key === 'last_rollover');
  const invoiceOrderSet = (settings || []).find(s => s.key === 'invoice_order');
  let invoiceOrder = [];
  try {
    invoiceOrder = invoiceOrderSet ? JSON.parse(invoiceOrderSet.value || '[]') : [];
  } catch (_) { invoiceOrder = []; }

  const clientsOrderSet = (settings || []).find(s => s.key === 'clients_order');
  let clientsOrder = [];
  try {
    clientsOrder = clientsOrderSet ? JSON.parse(clientsOrderSet.value || '[]') : [];
  } catch (_) { clientsOrder = []; }

  const personalPaymentsSet = (settings || []).find(s => s.key === 'personal_payments');
  let personalData = { allahPaid: 0, savedAmount: 0 };
  try {
    personalData = personalPaymentsSet ? toCamel(JSON.parse(personalPaymentsSet.value || '{}')) : { allahPaid: 0, savedAmount: 0 };
  } catch (_) { personalData = { allahPaid: 0, savedAmount: 0 }; }

  const employeesOrderSet = (settings || []).find(s => s.key === 'employees_order');
  let employeesOrder = [];
  try {
    employeesOrder = employeesOrderSet ? JSON.parse(employeesOrderSet.value || '[]') : [];
  } catch (_) { employeesOrder = []; }

  const expensesSet = (settings || []).find(s => s.key === 'expenses');
  let expensesData = [];
  try {
    expensesData = expensesSet ? JSON.parse(expensesSet.value || '[]') : [];
  } catch (_) { expensesData = []; }

  const urgentSalaryIdsSet = (settings || []).find(s => s.key === 'urgent_salary_ids');
  let urgentSalaryIds = [];
  try {
    urgentSalaryIds = urgentSalaryIdsSet ? JSON.parse(urgentSalaryIdsSet.value || '[]') : [];
  } catch (_) { urgentSalaryIds = []; }

  return {
    clients: (clients || []).map(toCamel).sort((a, b) => {
      const idxA = clientsOrder.indexOf(a.name);
      const idxB = clientsOrder.indexOf(b.name);
      if (idxA !== -1 && idxB !== -1) {
        return idxA - idxB;
      }
      if (idxA !== -1) return 1;
      if (idxB !== -1) return -1;
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    }),
    invoices: (invoices || []).map(inv => {
      const camelInv = toCamel(inv);
      if (camelInv.financeRaw) {
        camelInv.financeData = camelInv.financeRaw;
      }
      if (camelInv.financeRaw && camelInv.financeRaw.scheduled_date) {
        camelInv.scheduledDate = camelInv.financeRaw.scheduled_date;
      }
      if (camelInv.financeRaw && camelInv.financeRaw.paid_at) {
        camelInv.paidAt = camelInv.financeRaw.paid_at;
      }
      return camelInv;
    }).sort((a, b) => {
      const idxA = invoiceOrder.indexOf(String(a.invoiceNumber));
      const idxB = invoiceOrder.indexOf(String(b.invoiceNumber));
      if (idxA !== -1 && idxB !== -1) {
        return idxA - idxB;
      }
      if (idxA !== -1) return 1;
      if (idxB !== -1) return -1;
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0) || Number(b.invoiceNumber) - Number(a.invoiceNumber);
    }),
    finance: (finance || []).map(toCamel),
    salaries: (salaries || []).map(toCamel).sort((a, b) => (a.displayOrder ?? 999) - (b.displayOrder ?? 999)),
    employees: (employees || []).map(toCamel).sort((a, b) => {
      const idxA = employeesOrder.indexOf(a.id);
      const idxB = employeesOrder.indexOf(b.id);
      if (idxA === -1 && idxB === -1) return 0;
      if (idxA === -1) return -1; // new employees (not yet ordered) first
      if (idxB === -1) return 1;
      return idxA - idxB;
    }),
    bills: billsData.map(toCamel),
    expenses: expensesData.map(toCamel),
    billSections: sectionsData,
    billPayments: billPaymentsData,
    personal: personalData,
    nextNum: nextNumSet ? Number(nextNumSet.value) : 4001,
    lastRollover: lastRolloverSet ? lastRolloverSet.value : null,
    urgentSalaryIds
  };
}

export async function upsertClient(client) {
  const payload = toSnake(client);
  // Prefer conflict resolution by 'id' if we have it, otherwise fallback to 'name'
  await safeUpsert('clients', payload, payload.id ? 'id' : 'name');
}

export async function deleteClient(name) {
  await checked(supabase.from('clients').delete().eq('name', name), 'deleting client');
}

export async function upsertInvoice(invoice) {
  const payload = toSnake(invoice);
  // Remap financeData → finance_raw (jsonb column)
  if (payload.finance_data) {
    payload.finance_raw = payload.finance_data;
    delete payload.finance_data;
  }
  payload.finance_raw = { ...(payload.finance_raw || {}) };
  // Store scheduled_date / paid_at inside finance_raw to avoid schema issues if the columns are missing.
  // Always overwrite so clearing a value (e.g. un-scheduling) is persisted too.
  if ('scheduled_date' in payload) {
    if (payload.scheduled_date) payload.finance_raw.scheduled_date = payload.scheduled_date;
    else delete payload.finance_raw.scheduled_date;
    delete payload.scheduled_date;
  }
  if ('paid_at' in payload) {
    if (payload.paid_at) payload.finance_raw.paid_at = payload.paid_at;
    else delete payload.finance_raw.paid_at;
    delete payload.paid_at;
  }
  // Ensure project_name is always explicitly set
  if (!('project_name' in payload)) {
    payload.project_name = invoice.projectName || '';
  }
  await safeUpsert('invoices', payload, 'invoice_number');
}

export async function deleteInvoice(invoiceNumber) {
  await checked(supabase.from('invoices').delete().eq('invoice_number', invoiceNumber), 'deleting invoice');
}

export async function upsertFinance(records) {
  if (!records || records.length === 0) return;
  await safeUpsert('finance_ledger', records.map(toSnake), 'id');
}

export async function deleteFinance(id) {
  await checked(supabase.from('finance_ledger').delete().eq('id', id), 'deleting finance row');
}

export async function upsertSalaries(records) {
  if (!records || records.length === 0) return;
  await safeUpsert('salaries_ledger', records.map(toSnake), 'id');
}

export async function deleteSalary(id) {
  await checked(supabase.from('salaries_ledger').delete().eq('id', id), 'deleting salary');
}

export async function updateSetting(key, value) {
  await checked(
    supabase.from('app_settings').upsert({ key, value: String(value) }, { onConflict: 'key' }),
    `updating setting ${key}`
  );
}

export async function upsertEmployee(employee) {
  await safeUpsert('employees', toSnake(employee), 'id');
}

export async function deleteEmployee(id) {
  await checked(supabase.from('employees').delete().eq('id', id), 'deleting employee');
}

// Save entire bills array to app_settings as JSON (no separate table needed)
export async function saveMiscBills(bills) {
  await updateSetting('misc_bills', JSON.stringify(bills.map(toSnake)));
}

// Save important expenses (fines, renewals, fees…) to app_settings as JSON
export async function saveExpenses(expenses) {
  await updateSetting('expenses', JSON.stringify(expenses.map(toSnake)));
}

// Save personal payments (Allah Share & Savings) to app_settings
export async function savePersonalPayments(personalObj) {
  await updateSetting('personal_payments', JSON.stringify(toSnake(personalObj)));
}

// Save month-wise bill payments map: { "YYYY-MM": { "bill-id": paidAmount } }
export async function saveBillPayments(paymentsObj) {
  await updateSetting('misc_bill_payments', JSON.stringify(paymentsObj));
}

/* ── Auth (Supabase Auth — credentials never live in the bundle) ── */
export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export function onAuthChange(cb) {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => cb(session));
  return () => data.subscription.unsubscribe();
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.session;
}

export async function signOut() {
  await supabase.auth.signOut();
}
