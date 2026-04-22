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
    { data: settings }
  ] = await Promise.all([
    supabase.from('clients').select('*').order('created_at', { ascending: false }),
    supabase.from('invoices').select('*').order('created_at', { ascending: false }),
    supabase.from('finance_ledger').select('*').order('created_at', { ascending: false }),
    supabase.from('salaries_ledger').select('*').order('created_at', { ascending: false }),
    supabase.from('app_settings').select('*')
  ]);

  const nextNumSet = (settings || []).find(s => s.key === 'next_invoice_num');
  const lastRolloverSet = (settings || []).find(s => s.key === 'last_rollover');

  return {
    clients: (clients || []).map(toCamel),
    invoices: (invoices || []).map(toCamel),
    finance: (finance || []).map(toCamel),
    salaries: (salaries || []).map(toCamel),
    nextNum: nextNumSet ? Number(nextNumSet.value) : 4001,
    lastRollover: lastRolloverSet ? lastRolloverSet.value : null
  };
}

export async function upsertClient(client) {
  const { error } = await supabase.from('clients').upsert(toSnake(client), { onConflict: 'name' });
  if (error) console.error('Error upserting client:', error);
}

export async function deleteClient(name) {
  const { error } = await supabase.from('clients').delete().eq('name', name);
  if (error) console.error('Error deleting client:', error);
}

export async function upsertInvoice(invoice) {
  // Extract and map specific nested or mismatched fields if needed
  // UI keeps financeData mixed in occasionally. We should store it in finance_raw as jsonb.
  const payload = toSnake(invoice);
  if (payload.finance_data) {
    payload.finance_raw = payload.finance_data;
    delete payload.finance_data;
  }
  const { error } = await supabase.from('invoices').upsert(payload, { onConflict: 'invoice_number' });
  if (error) console.error('Error upserting invoice:', error);
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
