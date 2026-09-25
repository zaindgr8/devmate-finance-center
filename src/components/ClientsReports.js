import React, { useState } from 'react';
import Icon from './Icon';
import { Btn } from './UI';
import { currentYM, fmtMonth, fmtAED, fmtDate, toAED, invoiceReceived, invoiceOutstanding, billsSummary, downloadCSV, expenseCategory } from '../utils/helpers';


/* ═══ REPORTS VIEW ═══ */
const receivedMonth = (inv) => (inv.paidAt ? String(inv.paidAt).slice(0, 7) : (inv.date || '').slice(0, 7));

function Metric({ label, value, color, hint }) {
  return (
    <div className="metric-card">
      <div className="metric-label">{label}</div>
      <div className="metric-value" style={{ color }}>{fmtAED(value)}</div>
      {hint && <div className="metric-hint">{hint}</div>}
    </div>
  );
}

export function ReportsView({ invoices = [], clients = [], salaries = [], bills = [], billPayments = {}, expenses = [] }) {
  const [selectedMonth, setSelectedMonth] = useState(currentYM());

  // Extract all available months from invoices, payments and salaries
  const allMonths = new Set([currentYM()]);
  invoices.forEach(inv => {
    if (inv.date) allMonths.add(inv.date.substring(0, 7));
    if (inv.paidAt) allMonths.add(receivedMonth(inv));
  });
  salaries.forEach(sal => {
    if (sal.month) allMonths.add(sal.month.substring(0, 7));
  });
  Object.keys(billPayments).forEach(m => allMonths.add(m));
  expenses.forEach(e => { if (e.paidDate) allMonths.add(e.paidDate.slice(0, 7)); });
  const availableMonths = Array.from(allMonths).sort().reverse();

  // Accrual view: invoices issued this month. Cash view: money received this month.
  const monthInvoices = invoices.filter(inv => inv.date && inv.date.substring(0, 7) === selectedMonth && inv.status !== 'scheduled');
  const receivedInvoices = invoices.filter(inv => invoiceReceived(inv) > 0 && receivedMonth(inv) === selectedMonth);
  const monthSalaries = salaries.filter(sal => sal.month && sal.month.substring(0, 7) === selectedMonth);

  const totalInvoiced = monthInvoices.reduce((sum, inv) => sum + toAED(inv.totalPayment, inv.currency), 0);
  const totalReceived = receivedInvoices.reduce((sum, inv) => sum + toAED(invoiceReceived(inv), inv.currency), 0);
  const totalPending = monthInvoices.reduce((sum, inv) => sum + toAED(invoiceOutstanding(inv), inv.currency), 0);

  const totalSalaries = monthSalaries.reduce((sum, sal) => sum + (Number(sal.totalSalary) || 0), 0);
  const salariesPaid = monthSalaries.reduce((sum, sal) => sum + (Number(sal.paidAmount) || 0), 0);

  const billSum = billsSummary(bills, billPayments, selectedMonth);
  const monthBills = billSum.list;
  const totalBills = billSum.total;

  // Important expenses count in the month they were paid
  const monthExpenses = expenses.filter(e => e.status === 'paid' && (e.paidDate || '').slice(0, 7) === selectedMonth);
  const totalExpenses = monthExpenses.reduce((s, e) => s + toAED(e.amount, e.currency), 0);

  const expectedProfit = totalInvoiced - totalSalaries - totalBills - totalExpenses;
  const netSavings = totalReceived - salariesPaid - billSum.paid - totalExpenses;

  const exportCSV = () => {
    const rows = [
      [`Devmate Finance Report: ${fmtMonth(selectedMonth)}`], [],
      ['Summary', 'AED'],
      ['Invoiced', totalInvoiced.toFixed(2)], ['Received (cash)', totalReceived.toFixed(2)], ['Outstanding from this month', totalPending.toFixed(2)],
      ['Salaries allocated', totalSalaries.toFixed(2)], ['Salaries paid', salariesPaid.toFixed(2)],
      ['Bills', totalBills.toFixed(2)], ['Bills paid', billSum.paid.toFixed(2)], ['Expenses paid', totalExpenses.toFixed(2)],
      ['Expected profit', expectedProfit.toFixed(2)], ['Net cash', netSavings.toFixed(2)], [],
      ['Invoices issued', 'Client', 'Status', 'Currency', 'Total', 'Total (AED)'],
      ...monthInvoices.map(i => [`#${i.invoiceNumber}`, i.clientName, i.status || 'unpaid', i.currency, i.totalPayment, toAED(i.totalPayment, i.currency).toFixed(2)]),
      [], ['Salaries', 'Project', 'Type', 'Total', 'Paid', 'Status'],
      ...monthSalaries.map(s => [s.employeeName, s.projectName || '', s.salaryType || 'project', s.totalSalary, s.paidAmount || 0, s.status || 'unpaid']),
      [], ['Bills', 'Category', 'Type', 'Amount', 'Paid'],
      ...monthBills.map(b => [b.name, b.category || 'Other', b.type, b.amount, (billPayments[selectedMonth] || {})[b.id] || 0]),
      [], ['Expenses', 'Category', 'Paid on', 'Currency', 'Amount', 'Amount (AED)'],
      ...monthExpenses.map(e => [e.title, expenseCategory(e.category).label, e.paidDate, e.currency, e.amount, toAED(e.amount, e.currency).toFixed(2)]),
    ];
    downloadCSV(`devmate-report-${selectedMonth}.csv`, rows);
  };

  return (
    <div className="animate-fade-in">
      <div className="page-head">
        <div>
          <h1 className="page-title">Monthly Reports</h1>
          <p className="page-sub">All currencies converted to AED · received = cash in during the month</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="form-select"
            style={{ width: 180, fontWeight: 600 }}
          >
            {availableMonths.map(m => (
              <option key={m} value={m}>{fmtMonth(m)}{m === currentYM() ? ' (Current)' : ''}</option>
            ))}
          </select>
          <Btn variant="ghost" onClick={exportCSV}><Icon name="download" size={14} /> Export</Btn>
        </div>
      </div>

      <div className="metric-grid">
        <Metric label="Invoiced" value={totalInvoiced} color="var(--text)" hint={`${monthInvoices.length} invoice${monthInvoices.length === 1 ? '' : 's'} issued`} />
        <Metric label="Received" value={totalReceived} color="var(--success)" hint={`${receivedInvoices.length} payment${receivedInvoices.length === 1 ? '' : 's'}`} />
        <Metric label="Still outstanding" value={totalPending} color="var(--warning)" hint="from invoices issued this month" />
        <Metric label="Salaries" value={totalSalaries} color="var(--primary)" hint={`${fmtAED(salariesPaid, 0)} paid`} />
        <Metric label="Bills" value={totalBills} color="var(--text-mid)" hint={`${fmtAED(billSum.paid, 0)} paid`} />
        <Metric label="Expenses" value={totalExpenses} color="var(--text-mid)" hint={`${monthExpenses.length} paid this month`} />
      </div>

      <div className="report-hero-grid">
        <div className="report-hero">
          <div className="report-hero-label">Expected profit</div>
          <div className="report-hero-formula">Invoiced − salaries − bills − expenses</div>
          <div className="report-hero-value" style={{ color: expectedProfit >= 0 ? '#34d399' : '#f87171' }}>{fmtAED(expectedProfit)}</div>
        </div>
        <div className="report-hero">
          <div className="report-hero-label">Net cash</div>
          <div className="report-hero-formula">Received − salaries paid − bills paid − expenses</div>
          <div className="report-hero-value" style={{ color: netSavings >= 0 ? '#34d399' : '#f87171' }}>{fmtAED(netSavings)}</div>
        </div>
      </div>

      <div className="reports-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
        <div className="card" style={{ padding: 24 }}>
          <h3 className="section-title">Invoices issued ({monthInvoices.length})</h3>
          {monthInvoices.length === 0 ? (
            <div style={{ color: 'var(--text-light)', fontSize: 13 }}>No invoices generated this month</div>
          ) : (
            monthInvoices.map((inv) => {
              const st = inv.status || 'unpaid';
              return (
                <div key={inv.invoiceNumber} className="report-row">
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{inv.clientName}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-light)', marginTop: 4 }}>
                      <span style={{ color: st === 'paid' ? 'var(--success)' : st === 'partial' ? 'var(--warning)' : st === 'pending' ? 'var(--info)' : 'var(--danger)', fontWeight: 700, marginRight: 6 }}>{st.toUpperCase()}</span>
                      Inv #{inv.invoiceNumber}{inv.currency !== 'AED' ? ` · ${inv.currency}` : ''}
                    </div>
                  </div>
                  <div className="num" style={{ fontWeight: 700, fontSize: 14 }}>{fmtAED(toAED(inv.totalPayment, inv.currency), 0)}</div>
                </div>
              );
            })
          )}
        </div>

        <div className="card" style={{ padding: 24 }}>
          <h3 className="section-title">Salaries allocated ({monthSalaries.length})</h3>
          {monthSalaries.length === 0 ? (
            <div style={{ color: 'var(--text-light)', fontSize: 13 }}>No salaries allocated this month</div>
          ) : (
            monthSalaries.map((sal) => (
              <div key={sal.id} className="report-row">
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{sal.employeeName}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-light)', marginTop: 4 }}>{sal.projectName || 'N/A'} • {sal.salaryType === 'monthly' ? '🔄 Monthly' : '📦 One-Time'}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="num" style={{ fontWeight: 700, fontSize: 14 }}>{fmtAED(sal.totalSalary, 0)}</div>
                  {Number(sal.paidAmount) > 0 && <div style={{ fontSize: 11, color: 'var(--success)' }}>paid {fmtAED(sal.paidAmount, 0)}</div>}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Bills breakdown for selected month */}
      {monthBills.length > 0 && (
        <div className="card" style={{ padding: 24, marginTop: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 className="section-title" style={{ margin: 0 }}>🧾 Bills ({monthBills.length})</h3>
            <div className="num" style={{ fontWeight: 700, fontSize: 14 }}>{fmtAED(billSum.paid, 0)} of {fmtAED(totalBills, 0)} paid</div>
          </div>
          {monthBills.map((bill) => {
            const paid = Number((billPayments[selectedMonth] || {})[bill.id]) || 0;
            return (
              <div key={bill.id} className="report-row">
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{bill.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-light)', marginTop: 3 }}>
                    {bill.category || 'Other'} · {bill.type === 'one-time' ? `📌 One-Time (${bill.month})` : '🔄 Recurring'}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="num" style={{ fontWeight: 700, fontSize: 14 }}>{fmtAED(bill.amount, 0)}</div>
                  <div style={{ fontSize: 11, color: paid >= Number(bill.amount) ? 'var(--success)' : 'var(--text-light)' }}>{paid >= Number(bill.amount) ? 'paid' : paid > 0 ? `paid ${fmtAED(paid, 0)}` : 'unpaid'}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {monthExpenses.length > 0 && (
        <div className="card" style={{ padding: 24, marginTop: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 className="section-title" style={{ margin: 0 }}>💼 Expenses paid ({monthExpenses.length})</h3>
            <div className="num" style={{ fontWeight: 700, fontSize: 14 }}>{fmtAED(totalExpenses, 0)}</div>
          </div>
          {monthExpenses.map((e) => (
            <div key={e.id} className="report-row">
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{expenseCategory(e.category).emoji} {e.title}</div>
                <div style={{ fontSize: 11, color: 'var(--text-light)', marginTop: 3 }}>
                  {expenseCategory(e.category).label} · paid {fmtDate(e.paidDate)}{e.reference ? ` · Ref ${e.reference}` : ''}
                </div>
              </div>
              <div className="num" style={{ fontWeight: 700, fontSize: 14 }}>{fmtAED(toAED(e.amount, e.currency), 0)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
