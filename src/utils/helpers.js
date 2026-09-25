/* ── Date helpers ── */
// All "calendar" dates use the local timezone. toISOString() is UTC, which in
// Dubai/Muscat (UTC+4) returns yesterday's date between 00:00 and 04:00.
export function localDateStr(d = new Date()) {
  const dt = d instanceof Date ? d : new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

export function today() {
  return localDateStr();
}

export function firstOfMonthStr() {
  const d = new Date();
  return localDateStr(new Date(d.getFullYear(), d.getMonth(), 1));
}

// Local datetime string for <input type="datetime-local"> min values
export function nowLocalDateTime() {
  const d = new Date();
  return `${localDateStr(d)}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function fmtDate(d) {
  if (!d) return '';
  // Plain YYYY-MM-DD strings are parsed as UTC midnight by Date(); parse them as local instead
  const dt = /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(`${d}T00:00:00`) : new Date(d);
  return dt.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function fmtMonth(ym) {
  if (!ym) return '';
  const [y, m] = ym.split('-');
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

export function daysBetween(fromDateStr, toDateStr) {
  const a = new Date(`${fromDateStr}T00:00:00`);
  const b = new Date(`${toDateStr}T00:00:00`);
  return Math.round((b - a) / 86400000);
}

/* ── Amount helpers ── */
// Approximate AED conversion used for cross-currency totals.
// USD and OMR are pegged; GBP/EUR float, so update these occasionally.
export const AED_RATES = { AED: 1, USD: 3.6725, OMR: 9.5475, GBP: 4.9, EUR: 4.25 };

export function toAED(amount, currency = 'AED') {
  return (Number(amount) || 0) * (AED_RATES[currency] || 1);
}

export function fmtAED(n, digits = 2) {
  return `AED ${(Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

// Amount actually received on an invoice (pending/scheduled invoices haven't been received yet)
export function invoiceReceived(inv) {
  if (!inv || inv.status === 'pending' || inv.status === 'scheduled') return 0;
  if (inv.status === 'paid') return Number(inv.totalPayment) || Number(inv.payingNow) || 0;
  return Number(inv.payingNow) || 0;
}

export function invoiceOutstanding(inv) {
  if (!inv || inv.status === 'paid' || inv.status === 'scheduled') return 0;
  return Math.max(0, (Number(inv.totalPayment) || 0) - invoiceReceived(inv));
}

export function isInvoiceOverdue(inv, todayStr = today()) {
  return !!inv && !!inv.dueDate && inv.status !== 'paid' && inv.status !== 'scheduled' && inv.dueDate < todayStr;
}

export function statusColor(status) {
  return status === 'paid' ? 'green' : status === 'partial' ? 'yellow' : status === 'pending' || status === 'scheduled' ? 'blue' : 'red';
}

/* ── HTML escaping for generated documents ── */
export function escapeHTML(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeUrl(u) {
  return /^https?:\/\//i.test(String(u || '').trim()) ? escapeHTML(u.trim()) : '';
}

/* ── CSV export ── */
export function downloadCSV(filename, rows) {
  const esc = (v) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = rows.map((r) => r.map(esc).join(',')).join('\n');
  const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* ── Payment reminder text ── */
export function buildReminderText(inv) {
  const due = invoiceOutstanding(inv) || Number(inv.totalPayment) || 0;
  const lines = [
    `Dear ${inv.clientName || 'Client'},`,
    '',
    `This is a friendly reminder that invoice #${inv.invoiceNumber}${inv.projectName ? ` (${inv.projectName})` : ''} for ${fmtCurrency(due, inv.currency)} is ${isInvoiceOverdue(inv) ? `overdue since ${fmtDate(inv.dueDate)}` : inv.dueDate ? `due on ${fmtDate(inv.dueDate)}` : 'awaiting payment'}.`,
  ];
  if (inv.paymentLink) lines.push('', `You can pay securely here: ${inv.paymentLink}`);
  lines.push('', 'Thank you for your trust!', 'Devmate Solutions');
  return lines.join('\n');
}

/* ── Currency formatter ── */
export function fmtCurrency(n, cur = 'USD') {
  const symbols = { USD: '$', AED: 'AED ', OMR: 'OMR ', GBP: '£', EUR: '€' };
  return (
    (symbols[cur] || '$') +
    Number(n || 0).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

/* ── Currency options ── */
export const CURRENCIES = [
  { value: 'USD', label: 'USD ($)' },
  { value: 'AED', label: 'AED' },
  { value: 'OMR', label: 'OMR' },
  { value: 'GBP', label: 'GBP (£)' },
  { value: 'EUR', label: 'EUR (€)' },
];

/* ── Generate printable invoice HTML ── */
export function generatePrintHTML(inv, logoBase64) {
  const rows = (inv.items || [])
    .map(
      (it, i) => `<tr>
    <td style="padding:11px 14px;border-bottom:1px solid #EAECF0;color:#8892A7;font-size:13px;">${i + 1}</td>
    <td style="padding:11px 14px;border-bottom:1px solid #EAECF0;color:#1A1D26;font-size:13px;">${escapeHTML(it.description)}</td>
    <td style="padding:11px 14px;border-bottom:1px solid #EAECF0;color:#4A5068;text-align:center;font-size:13px;">${escapeHTML(it.qty)}</td>
    <td style="padding:11px 14px;border-bottom:1px solid #EAECF0;color:#1A1D26;text-align:right;font-size:13px;">${fmtCurrency(it.rate, inv.currency)}</td>
    <td style="padding:11px 14px;border-bottom:1px solid #EAECF0;color:#1A1D26;text-align:right;font-size:13px;font-weight:600;">${fmtCurrency(it.qty * it.rate, inv.currency)}</td>
  </tr>`
    )
    .join('');

  const stColor = inv.status === 'paid' ? '#0D9F5F' : inv.status === 'partial' ? '#D97706' : '#DC143C';
  const e = escapeHTML;
  const payLink = safeUrl(inv.paymentLink);

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap');
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Poppins',sans-serif;background:#fff;color:#1A1D26;padding:32px}
    .box{max-width:780px;margin:0 auto;border:1px solid #E8ECF1;border-radius:12px;overflow:hidden}
    .hdr{background:linear-gradient(135deg,#DC143C 0%,#A00D2E 100%);padding:28px 36px;display:flex;justify-content:space-between;align-items:center}
    .hdr-l{display:flex;align-items:center;gap:14px;color:#fff}
    .hdr-l h1{font-size:18px;font-weight:700;letter-spacing:.5px}
    .hdr-l small{font-size:11px;opacity:.85;letter-spacing:1px;display:block;margin-top:2px}
    .hdr-r{text-align:right;color:#fff}
    .hdr-r .inv{font-size:26px;font-weight:700;letter-spacing:2px}
    .hdr-r .num{font-size:13px;opacity:.9;margin-top:2px}
    .body{padding:28px 36px;background:#fff}
    .mg{display:grid;grid-template-columns:1fr 1fr;gap:28px;margin-bottom:28px}
    .ms h3{font-size:10px;text-transform:uppercase;letter-spacing:2px;color:#DC143C;margin-bottom:6px;font-weight:700}
    .ms p{font-size:13px;color:#4A5068;line-height:1.7}.ms .v{color:#1A1D26;font-weight:500}
    table{width:100%;border-collapse:collapse;margin-bottom:20px}
    thead th{background:#F7F8FA;padding:11px 14px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:1.5px;color:#DC143C;font-weight:700;border-bottom:2px solid #DC143C}
    thead th:nth-child(3){text-align:center}thead th:nth-child(4),thead th:nth-child(5){text-align:right}
    .tots{display:flex;justify-content:flex-end;margin-bottom:20px}
    .tots-b{width:260px}
    .tr{display:flex;justify-content:space-between;padding:7px 0;font-size:13px;color:#4A5068;border-bottom:1px solid #F0F2F5}
    .tr.total{font-size:16px;font-weight:700;color:#DC143C;border-top:2px solid #DC143C;border-bottom:none;padding-top:10px;margin-top:4px}
    .tr.paid{color:#0D9F5F}.tr.rem{color:#D97706;font-weight:600}
    .notes{background:#F7F8FA;border:1px solid #E8ECF1;border-radius:8px;padding:14px 18px;margin-bottom:18px}
    .notes h4{font-size:10px;text-transform:uppercase;letter-spacing:2px;color:#DC143C;margin-bottom:6px;font-weight:700}
    .notes p{font-size:12px;color:#4A5068;line-height:1.6}
    .pay{background:linear-gradient(135deg,#DC143C,#A00D2E);border-radius:8px;padding:14px 18px;text-align:center;margin-bottom:18px}
    .pay a{color:#fff;text-decoration:none;font-weight:600;font-size:13px}
    .ft{background:#F7F8FA;padding:16px 36px;text-align:center;border-top:1px solid #E8ECF1}
    .ft p{font-size:11px;color:#8892A7;line-height:1.8}.ft .loc{color:#DC143C;font-weight:700;letter-spacing:1px}
    @media print{body{padding:0}.box{border:none}}
  </style></head><body><div class="box">
    <div class="hdr">
      <div class="hdr-l">
        <div><h1>DEVMATE SOLUTIONS</h1><small>AI Powered Agency</small></div>
      </div>
      <div class="hdr-r">
        <div class="inv">INVOICE</div>
        <div class="num">#${e(inv.invoiceNumber)}</div>
      </div>
    </div>
    <div class="body">
      <div class="mg">
        <div class="ms">
          <h3>Bill To</h3>
          <p class="v">${e(inv.clientName)}${inv.clientDesignation ? `<br/><span style="color:#8892A7;font-size:12px">${e(inv.clientDesignation)}</span>` : ''}</p>
          <p class="v" style="margin-top:2px">${e(inv.businessName)}</p>
          ${inv.clientEmail ? `<p style="font-size:12px;margin-top:2px">${e(inv.clientEmail)}</p>` : ''}
          ${inv.clientPhone ? `<p style="font-size:12px">${e(inv.clientPhone)}</p>` : ''}
          ${inv.clientAddress ? `<p style="font-size:12px">${e(inv.clientAddress)}</p>` : ''}
        </div>
        <div class="ms" style="text-align:right">
          <h3>Invoice Details</h3>
          <p><span style="color:#8892A7">Date:</span> <span class="v">${fmtDate(inv.date)}</span></p>
          <p><span style="color:#8892A7">Due:</span> <span class="v">${inv.dueDate ? fmtDate(inv.dueDate) : 'Upon Receipt'}</span></p>
          <p><span style="color:#8892A7">Currency:</span> <span class="v">${e(inv.currency)}</span></p>
          <p><span style="color:#8892A7">Status:</span> <span class="v" style="color:${stColor}">${e((inv.status || 'unpaid').toUpperCase())}</span></p>
        </div>
      </div>
      <table><thead><tr><th>#</th><th>Description</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="tots"><div class="tots-b">
        <div class="tr"><span>Subtotal</span><span>${fmtCurrency(inv.totalPayment, inv.currency)}</span></div>
        <div class="tr total"><span>Total</span><span>${fmtCurrency(inv.totalPayment, inv.currency)}</span></div>
        <div class="tr paid"><span>Paid</span><span>- ${fmtCurrency(invoiceReceived(inv), inv.currency)}</span></div>
        <div class="tr rem"><span>Balance Due</span><span>${fmtCurrency(inv.status === 'paid' ? 0 : Math.max(0, (Number(inv.totalPayment) || 0) - invoiceReceived(inv)), inv.currency)}</span></div>
      </div></div>
      ${inv.specialNotes ? `<div class="notes"><h4>Special Notes</h4><p>${e(inv.specialNotes).replace(/\n/g, '<br/>')}</p></div>` : ''}
      ${payLink ? `<div class="pay"><a href="${payLink}">💳 Pay Now: [Click Here To Pay]</a></div>` : ''}
    </div>
    <div class="ft">
      <p class="loc">DUBAI · MUSCAT · NEW YORK</p>
      <p>management@devmatesolutions.com · devmatesolutions.com</p>
      <p style="margin-top:4px">THANK YOU FOR YOUR TRUST!</p>
    </div>
  </div></body></html>`;
}

export function currentYM() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function prevYM(ym) {
  const [y, m] = ym.split('-').map(Number);
  if (m === 1) return `${y - 1}-12`;
  return `${y}-${String(m - 1).padStart(2, '0')}`;
}

export function nextYM(ym) {
  const [y, m] = ym.split('-').map(Number);
  if (m === 12) return `${y + 1}-01`;
  return `${y}-${String(m + 1).padStart(2, '0')}`;
}

/**
 * Build a finance ledger row from a saved invoice.
 * financeData is the extra block collected in InvoiceForm.
 */
export function createFinanceRecord(inv) {
  const fd = inv.financeData || {};
  // Pending invoices haven't been confirmed yet, so paidAmount starts at 0
  const isPending = inv.status === 'pending';
  const paidAmount = isPending ? 0 : (Number(inv.payingNow) || 0);
  const totalSalaries = Number(fd.totalSalaries) || 0;
  const allahShare = fd._allahManual
    ? Number(fd.allahShare) || 0
    : Math.max(0, (paidAmount - totalSalaries) * 0.05);
  const saving = Number(fd.saving) || 0;
  const profit = paidAmount - totalSalaries - allahShare - saving;
  const ym = currentYM();

  return {
    id: `fin-${inv.invoiceNumber}-${Date.now()}`,
    invoiceId: inv.invoiceNumber,
    month: ym,
    originalMonth: ym,
    clientName: inv.clientName,
    businessName: inv.businessName || '',
    totalAmount: Number(inv.totalPayment) || 0,
    paidAmount,
    paymentType: fd.paymentType || 'project',
    salaries: fd.salaries || [],
    totalSalaries,
    allahShare,
    saving,
    profit,
    status: inv.status || 'unpaid',
    notes: inv.specialNotes || '',
    rolledOver: false,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Called on 1st of a new month.
 * - recurring  → always clone to new month
 * - project+unpaid/partial → clone to new month (still outstanding)
 * - project+paid → stays in original month only
 */
export function rolloverMonth(records, newMonth) {
  const last = prevYM(newMonth);
  const lastMonthRows = records.filter((r) => r.month === last);
  const newRows = [];

  lastMonthRows.forEach((row) => {
    if (row.paymentType === 'recurring') {
      newRows.push({
        ...row,
        id: `rollover-${row.id}-${Date.now()}`,
        month: newMonth,
        paidAmount: 0,
        profit: 0 - (row.totalSalaries || 0) - (row.allahShare || 0) - (row.saving || 0),
        status: 'unpaid',
        rolledOver: true,
        originalMonth: row.originalMonth || last,
        createdAt: new Date().toISOString(),
      });
    } else if (row.paymentType === 'project' && row.status !== 'paid') {
      newRows.push({
        ...row,
        id: `rollover-${row.id}-${Date.now()}`,
        month: newMonth,
        paidAmount: 0,
        profit: -(row.totalSalaries || 0) - (row.allahShare || 0) - (row.saving || 0),
        status: 'unpaid',
        rolledOver: true,
        originalMonth: row.originalMonth || last,
        createdAt: new Date().toISOString(),
      });
    }
  });

  return [...records, ...newRows];
}

/**
 * Extract salaries from a saved invoice and create salary records.
 */
export function extractSalariesFromInvoice(inv) {
  const fd = inv.financeData || {};
  const salariesData = fd.salaries || [];
  const ym = currentYM();

  return salariesData
    .filter((s) => s.employee && Number(s.amount) > 0)
    .map((s) => ({
      id: `sal-${inv.invoiceNumber}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      invoiceId: inv.invoiceNumber,
      employeeName: s.employee,
      projectName: inv.businessName || inv.clientName || 'Unknown Project',
      totalSalary: Number(s.amount) || 0,
      paidAmount: 0,
      month: ym,
      status: 'unpaid',
      createdAt: new Date().toISOString(),
    }));
}

/**
 * Called on 1st of a new month for salaries.
 * - monthly → always clone a fresh one for the new month. 
 * - fully unpaid → completely moved to the new month (no trace left in old month).
 * - partially paid → capped at paid amount in old month (marked paid), remaining balance cloned to new month.
 * - fully paid → stays in old month.
 */
const monthlyKey = (r) => `${(r.employeeName || '').trim().toLowerCase()}|${(r.projectName || '').trim().toLowerCase()}`;

/**
 * True when `month` already has a monthly salary installment for the same
 * employee + project. Used to stop the "auto-push on paid" and the monthly
 * rollover from both creating next month's installment (duplicate salaries).
 */
export function hasMonthlyInstallment(records, row, month) {
  const key = monthlyKey(row);
  return records.some((r) => r.month === month && r.salaryType === 'monthly' && r.id !== row.id && monthlyKey(r) === key);
}

export function rolloverSalariesMonth(records, newMonth) {
  const last = prevYM(newMonth);
  const result = [];

  records.forEach((row) => {
    if (row.month === last) {
      const total = Number(row.totalSalary) || 0;
      const paid = Number(row.paidAmount) || 0;
      const remaining = Math.max(0, total - paid);

      if (row.salaryType === 'monthly') {
        // 1. Create the NEW regular monthly installment for the new month
        //    (unless one already exists, e.g. auto-pushed when this row was paid)
        if (!hasMonthlyInstallment([...records, ...result], row, newMonth)) {
          result.push({
            ...row,
            id: `sal-rollover-${row.id}-${Date.now()}`,
            month: newMonth,
            paidAmount: 0,
            status: 'unpaid',
            rolledOver: true,
            autoPushed: false,
            originalMonth: row.originalMonth || last,
            createdAt: new Date().toISOString(),
          });
        }

        // Fully paid last month → nothing more to carry
        if (paid >= total && total > 0) {
          result.push(row);
          return;
        }

        // 2. Handle the OLD installment
        if (paid > 0) {
          result.push({ ...row, status: 'pushed' });
          if (remaining > 0) {
            result.push({
              ...row,
              id: `sal-arrears-${row.id}-${Date.now()}`,
              month: newMonth,
              totalSalary: remaining,
              paidAmount: 0,
              status: 'unpaid',
              rolledOver: true,
            });
          }
        } else {
          result.push({ ...row, month: newMonth, rolledOver: true });
        }
      } else if (row.salaryType === 'project') {
        // One-Time/Project salaries: only carry over the remaining balance if partially paid.
        // Fully unpaid project salaries stay in their original month — they do NOT auto-roll.
        if (paid > 0) {
          result.push({ ...row, status: 'pushed' });
          if (remaining > 0) {
            result.push({
              ...row,
              id: `sal-carry-${row.id}-${Date.now()}`,
              month: newMonth,
              totalSalary: remaining,
              paidAmount: 0,
              status: 'unpaid',
              rolledOver: true,
            });
          }
        } else {
          // Unpaid one-time salary: keep it in its original month, do not roll over
          result.push(row);
        }
      } else {
        result.push(row);
      }
    } else {
      result.push(row);
    }
  });

  return result;
}

export function getNextMonthDate(dateStr) {
  if (!dateStr) return today();
  const parts = dateStr.split('-');
  if (parts.length !== 3) return today();
  let year = parseInt(parts[0], 10);
  let month = parseInt(parts[1], 10);
  let day = parseInt(parts[2], 10);

  month += 1;
  if (month > 12) {
    month = 1;
    year += 1;
  }

  const maxDays = new Date(year, month, 0).getDate();
  if (day > maxDays) {
    day = maxDays;
  }

  const yStr = String(year);
  const mStr = String(month).padStart(2, '0');
  const dStr = String(day).padStart(2, '0');
  return `${yStr}-${mStr}-${dStr}`;
}


/* ── Bills (misc payments) ── */
export const FIXED_BILL_SECTIONS = ['monthly', 'one-time'];

// Bills that apply to a given month: one-time bills only in their month,
// monthly/custom-section bills from the month they were created onwards.
export function billsForMonth(bills = [], month) {
  return bills.filter((b) => {
    if (b.type === 'one-time') return b.month === month;
    const since = (b.createdAt || '').slice(0, 7);
    return !since || since <= month;
  });
}

export function billsSummary(bills = [], billPayments = {}, month) {
  const list = billsForMonth(bills, month);
  const payments = billPayments[month] || {};
  const total = list.reduce((s, b) => s + (Number(b.amount) || 0), 0);
  const paid = list.reduce((s, b) => s + Math.min(Number(payments[b.id]) || 0, Number(b.amount) || 0), 0);
  return { list, total, paid, pending: Math.max(0, total - paid) };
}
