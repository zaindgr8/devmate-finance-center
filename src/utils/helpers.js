/* ── Date helpers ── */
export function today() {
  return new Date().toISOString().split('T')[0];
}

export function fmtDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
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
    <td style="padding:11px 14px;border-bottom:1px solid #EAECF0;color:#1A1D26;font-size:13px;">${it.description}</td>
    <td style="padding:11px 14px;border-bottom:1px solid #EAECF0;color:#4A5068;text-align:center;font-size:13px;">${it.qty}</td>
    <td style="padding:11px 14px;border-bottom:1px solid #EAECF0;color:#1A1D26;text-align:right;font-size:13px;">${fmtCurrency(it.rate, inv.currency)}</td>
    <td style="padding:11px 14px;border-bottom:1px solid #EAECF0;color:#1A1D26;text-align:right;font-size:13px;font-weight:600;">${fmtCurrency(it.qty * it.rate, inv.currency)}</td>
  </tr>`
    )
    .join('');

  const statusColor = inv.status === 'paid' ? '#0D9F5F' : inv.status === 'partial' ? '#D97706' : '#DC143C';

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
        <div class="num">#${inv.invoiceNumber}</div>
      </div>
    </div>
    <div class="body">
      <div class="mg">
        <div class="ms">
          <h3>Bill To</h3>
          <p class="v">${inv.clientName}${inv.clientDesignation ? `<br/><span style="color:#8892A7;font-size:12px">${inv.clientDesignation}</span>` : ''}</p>
          <p class="v" style="margin-top:2px">${inv.businessName}</p>
          ${inv.clientEmail ? `<p style="font-size:12px;margin-top:2px">${inv.clientEmail}</p>` : ''}
          ${inv.clientPhone ? `<p style="font-size:12px">${inv.clientPhone}</p>` : ''}
          ${inv.clientAddress ? `<p style="font-size:12px">${inv.clientAddress}</p>` : ''}
        </div>
        <div class="ms" style="text-align:right">
          <h3>Invoice Details</h3>
          <p><span style="color:#8892A7">Date:</span> <span class="v">${fmtDate(inv.date)}</span></p>
          <p><span style="color:#8892A7">Due:</span> <span class="v">${inv.dueDate ? fmtDate(inv.dueDate) : 'Upon Receipt'}</span></p>
          <p><span style="color:#8892A7">Currency:</span> <span class="v">${inv.currency}</span></p>
          <p><span style="color:#8892A7">Status:</span> <span class="v" style="color:${statusColor}">${(inv.status || 'unpaid').toUpperCase()}</span></p>
        </div>
      </div>
      <table><thead><tr><th>#</th><th>Description</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="tots"><div class="tots-b">
        <div class="tr"><span>Subtotal</span><span>${fmtCurrency(inv.totalPayment, inv.currency)}</span></div>
        <div class="tr paid"><span>Paid</span><span>- ${fmtCurrency(inv.payingNow, inv.currency)}</span></div>
        <div class="tr rem"><span>Balance Due</span><span>${fmtCurrency(inv.remaining, inv.currency)}</span></div>
        <div class="tr total"><span>Total</span><span>${fmtCurrency(inv.totalPayment, inv.currency)}</span></div>
      </div></div>
      ${inv.specialNotes ? `<div class="notes"><h4>Special Notes</h4><p>${inv.specialNotes.replace(/\n/g, '<br/>')}</p></div>` : ''}
      ${inv.paymentLink ? `<div class="pay"><a href="${inv.paymentLink}">💳 Pay Now: [Click Here To Pay]</a></div>` : ''}
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
        result.push({
          ...row,
          id: `sal-rollover-${row.id}-${Date.now()}`,
          month: newMonth,
          paidAmount: 0,
          status: 'unpaid',
          rolledOver: true,
          originalMonth: row.originalMonth || last,
          createdAt: new Date().toISOString(),
        });

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
          result.push({ ...row, month: newMonth, rolledOver: true });
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

