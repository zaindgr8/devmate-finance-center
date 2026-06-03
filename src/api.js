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
    employees: (employees || []).map(toCamel),
    bills: billsData.map(toCamel),
    billSections: sectionsData,
    personal: personalData,
    nextNum: nextNumSet ? Number(nextNumSet.value) : 4001,
    lastRollover: lastRolloverSet ? lastRolloverSet.value : null
  };
}

export async function upsertClient(client) {
  const payload = toSnake(client);
  // Prefer conflict resolution by 'id' if we have it, otherwise fallback to 'name'
  const conflictTarget = payload.id ? 'id' : 'name';
  const { error } = await supabase.from('clients').upsert(payload, { onConflict: conflictTarget });
  if (error) {
    console.error('Error upserting client:', error);
    throw error;
  }
}

export async function deleteClient(name) {
  const { error } = await supabase.from('clients').delete().eq('name', name);
  if (error) console.error('Error deleting client:', error);
}

export async function upsertInvoice(invoice) {
  const payload = toSnake(invoice);
  // Remap financeData → finance_raw (jsonb column)
  if (payload.finance_data) {
    payload.finance_raw = payload.finance_data;
    delete payload.finance_data;
  }
  // Store scheduled_date inside finance_raw to avoid schema issues if column is missing
  if (payload.scheduled_date) {
    payload.finance_raw = payload.finance_raw || {};
    payload.finance_raw.scheduled_date = payload.scheduled_date;
    delete payload.scheduled_date;
  }
  // Ensure project_name is always explicitly set
  if (!('project_name' in payload)) {
    payload.project_name = invoice.projectName || '';
  }
  const { error } = await supabase.from('invoices').upsert(payload, { onConflict: 'invoice_number' });
  if (error) {
    console.error('Error upserting invoice:', error);
    throw error;
  }
}

export async function deleteInvoice(invoiceNumber) {
  const { error } = await supabase.from('invoices').delete().eq('invoice_number', invoiceNumber);
  if (error) console.error('Error deleting invoice:', error);
}

export async function upsertFinance(records) {
  if (!records || records.length === 0) return;
  const payload = records.map(toSnake);
  const { error } = await supabase.from('finance_ledger').upsert(payload, { onConflict: 'id' });
  if (error) console.error('Error upserting finance:', error);
}

export async function deleteFinance(id) {
  const { error } = await supabase.from('finance_ledger').delete().eq('id', id);
  if (error) console.error('Error deleting finance:', error);
}

export async function upsertSalaries(records) {
  if (!records || records.length === 0) return;
  const payload = records.map(toSnake);
  const { error } = await supabase.from('salaries_ledger').upsert(payload, { onConflict: 'id' });
  if (error) console.error('Error upserting salaries:', error);
}

export async function deleteSalary(id) {
  const { error } = await supabase.from('salaries_ledger').delete().eq('id', id);
  if (error) console.error('Error deleting salary:', error);
}

export async function updateSetting(key, value) {
  const { error } = await supabase.from('app_settings').upsert({ key, value: String(value) }, { onConflict: 'key' });
  if (error) console.error('Error updating setting:', error);
}

export async function upsertEmployee(employee) {
  const payload = toSnake(employee);
  const { error } = await supabase.from('employees').upsert(payload, { onConflict: 'id' });
  if (error) {
    console.error('Error upserting employee:', error);
    throw error;
  }
}

export async function deleteEmployee(id) {
  const { error } = await supabase.from('employees').delete().eq('id', id);
  if (error) console.error('Error deleting employee:', error);
}

// Save entire bills array to app_settings as JSON (no separate table needed)
export async function saveMiscBills(bills) {
  const value = JSON.stringify(bills.map(toSnake));
  const { error } = await supabase
    .from('app_settings')
    .upsert({ key: 'misc_bills', value }, { onConflict: 'key' });
  if (error) console.error('Error saving misc bills:', error);
}

// Save personal payments (Allah Share & Savings) to app_settings
export async function savePersonalPayments(personalObj) {
  const value = JSON.stringify(toSnake(personalObj));
  const { error } = await supabase
    .from('app_settings')
    .upsert({ key: 'personal_payments', value }, { onConflict: 'key' });
  if (error) console.error('Error saving personal payments:', error);
}
