import React, { useMemo, useState } from 'react';
import Icon from './Icon';
import { Badge, Btn } from './UI';
import {
  fmtDate, fmtCurrency, fmtAED, fmtMonth, today, currentYM, prevYM, toAED,
  invoiceReceived, invoiceOutstanding, isInvoiceOverdue, daysBetween, billsSummary, statusColor,
  expensesPaidIn, expenseCategory,
} from '../utils/helpers';

// Month an invoice's money was received: payment date when known, else invoice date
const receivedMonth = (inv) => (inv.paidAt ? String(inv.paidAt).slice(0, 7) : (inv.date || '').slice(0, 7));

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

function Kpi({ label, value, sub, icon, tone = 'neutral', onClick }) {
  return (
    <button type="button" className={`kpi kpi-${tone}`} onClick={onClick} disabled={!onClick}>
      <div className="kpi-head">
        <span className="kpi-icon"><Icon name={icon} size={16} /></span>
        <span className="kpi-label">{label}</span>
      </div>
      <div className="kpi-value">{value}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </button>
  );
}

function RevenueChart({ data }) {
  const [hover, setHover] = useState(null);
  const [showTable, setShowTable] = useState(false);
  const max = Math.max(1, ...data.flatMap(d => [d.invoiced, d.received]));
  // Clean y-axis ticks
  const step = Math.pow(10, Math.floor(Math.log10(max)));
  const niceMax = Math.ceil(max / step) * step;
  const ticks = [0, niceMax / 2, niceMax];
  const H = 160;

  if (showTable) {
    return (
      <div>
        <table className="inv-table">
          <thead><tr><th>Month</th><th style={{ textAlign: 'right' }}>Invoiced</th><th style={{ textAlign: 'right' }}>Received</th></tr></thead>
          <tbody>
            {data.map(d => (
              <tr key={d.ym} style={{ borderTop: '1px solid var(--border-light)' }}>
                <td>{fmtMonth(d.ym)}</td>
                <td className="num">{fmtAED(d.invoiced, 0)}</td>
                <td className="num">{fmtAED(d.received, 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <button className="link-btn" onClick={() => setShowTable(false)}>Show chart</button>
      </div>
    );
  }

  return (
    <div className="viz-root">
      <div className="chart-legend">
        <span><i style={{ background: 'var(--series-1)' }} />Received</span>
        <span><i style={{ background: 'var(--series-2)' }} />Invoiced</span>
        <button className="link-btn" style={{ marginLeft: 'auto' }} onClick={() => setShowTable(true)}>View as table</button>
      </div>
      <div className="chart" style={{ height: H + 28 }}>
        <div className="chart-grid" style={{ height: H }}>
          {ticks.slice().reverse().map(t => (
            <div key={t} className="chart-gridline"><span>{t >= 1000 ? `${Math.round(t / 1000)}k` : t}</span></div>
          ))}
        </div>
        <div className="chart-cols" style={{ height: H }}>
          {data.map((d, i) => (
            <div
              key={d.ym}
              className="chart-col"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            >
              <div className="chart-bars">
                <div className="chart-bar" style={{ height: `${(d.received / niceMax) * 100}%`, background: 'var(--series-1)' }} />
                <div className="chart-bar" style={{ height: `${(d.invoiced / niceMax) * 100}%`, background: 'var(--series-2)' }} />
              </div>
              <div className="chart-x">{fmtMonth(d.ym).split(' ')[0]}</div>
              {hover === i && (
                <div className="chart-tip" style={{ bottom: `${Math.max(d.received, d.invoiced) / niceMax * H + 30}px` }}>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>{fmtMonth(d.ym)}</div>
                  <div><i style={{ background: 'var(--series-1)' }} />Received <b>{fmtAED(d.received, 0)}</b></div>
                  <div><i style={{ background: 'var(--series-2)' }} />Invoiced <b>{fmtAED(d.invoiced, 0)}</b></div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Dashboard({
  invoices = [], clients = [], salaries = [], bills = [], billPayments = {}, expenses = [], urgentSalaryIds = [],
  onNew, onView, onNavigate, onConfirmPayment,
}) {
  const todayStr = today();
  const ym = currentYM();
  const lastYm = prevYM(ym);

  const stats = useMemo(() => {
    const receivedIn = (m) => invoices
      .filter(i => invoiceReceived(i) > 0 && receivedMonth(i) === m)
      .reduce((s, i) => s + toAED(invoiceReceived(i), i.currency), 0);

    const receivedThis = receivedIn(ym);
    const receivedLast = receivedIn(lastYm);

    const outstandingList = invoices.filter(i => invoiceOutstanding(i) > 0);
    const outstanding = outstandingList.reduce((s, i) => s + toAED(invoiceOutstanding(i), i.currency), 0);
    const overdue = outstandingList.filter(i => isInvoiceOverdue(i, todayStr));
    const overdueAmt = overdue.reduce((s, i) => s + toAED(invoiceOutstanding(i), i.currency), 0);

    const dueSalaries = salaries.filter(s => s.month <= ym && s.status !== 'paid' && s.status !== 'pushed');
    const salariesDue = dueSalaries.reduce((s, r) => s + Math.max(0, (Number(r.totalSalary) || 0) - (Number(r.paidAmount) || 0)), 0);
    const salariesPaidThis = salaries.filter(s => s.month === ym).reduce((s, r) => s + (Number(r.paidAmount) || 0), 0);

    const billSum = billsSummary(bills, billPayments, ym);
    const expensesPaid = expensesPaidIn(expenses, ym);
    const net = receivedThis - salariesPaidThis - billSum.paid - expensesPaid;

    // 6-month trend
    const months = [];
    let m = ym;
    for (let k = 0; k < 6; k++) { months.unshift(m); m = prevYM(m); }
    const trend = months.map(mm => ({
      ym: mm,
      received: receivedIn(mm),
      invoiced: invoices.filter(i => (i.date || '').slice(0, 7) === mm && i.status !== 'scheduled')
        .reduce((s, i) => s + toAED(i.totalPayment, i.currency), 0),
    }));

    // Top clients by lifetime received
    const byClient = {};
    invoices.forEach(i => {
      const r = toAED(invoiceReceived(i), i.currency);
      if (r > 0) byClient[i.clientName] = (byClient[i.clientName] || 0) + r;
    });
    const topClients = Object.entries(byClient).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const totalReceivedAll = Object.values(byClient).reduce((a, b) => a + b, 0);

    return {
      receivedThis, receivedLast, outstanding, overdue, overdueAmt, outstandingCount: outstandingList.length,
      salariesDue, dueSalariesCount: dueSalaries.length, billSum, net, trend, topClients, totalReceivedAll, expensesPaid,
    };
  }, [invoices, salaries, bills, billPayments, expenses, ym, lastYm, todayStr]);

  const delta = stats.receivedLast > 0 ? ((stats.receivedThis - stats.receivedLast) / stats.receivedLast) * 100 : null;

  // Things that need a decision today
  const attention = useMemo(() => {
    const items = [];
    stats.overdue
      .slice()
      .sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''))
      .forEach(inv => items.push({
        key: `od-${inv.invoiceNumber}`, tone: 'danger', icon: 'alert',
        title: `#${inv.invoiceNumber} · ${inv.clientName}`,
        sub: `${fmtCurrency(invoiceOutstanding(inv), inv.currency)} overdue by ${daysBetween(inv.dueDate, todayStr)} day(s)`,
        action: { label: 'Open', fn: () => onView(inv) },
      }));
    invoices
      .filter(i => i.status === 'pending' && !isInvoiceOverdue(i, todayStr))
      .slice(0, 4)
      .forEach(inv => items.push({
        key: `pd-${inv.invoiceNumber}`, tone: 'info', icon: 'clock',
        title: `#${inv.invoiceNumber} · ${inv.clientName}`,
        sub: `Awaiting payment confirmation · ${fmtCurrency(inv.payingNow || inv.totalPayment, inv.currency)}`,
        action: { label: 'Confirm', fn: () => onConfirmPayment(inv.invoiceNumber) },
      }));
    // Expenses overdue or due within 7 days
    expenses
      .filter(e => e.status !== 'paid' && e.dueDate && daysBetween(todayStr, e.dueDate) <= 7)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      .forEach(e => {
        const d = daysBetween(todayStr, e.dueDate);
        items.push({
          key: `exp-${e.id}`, tone: d < 0 ? 'danger' : 'warning', icon: d < 0 ? 'alert' : 'calendar',
          title: `${expenseCategory(e.category).emoji} ${e.title}`,
          sub: `${fmtCurrency(e.amount, e.currency)} · ${d < 0 ? `overdue by ${-d} day(s)` : d === 0 ? 'due today' : `due in ${d} day(s)`}`,
          action: { label: 'Open', fn: () => onNavigate('expenses') },
        });
      });
    const urgent = salaries.filter(s => urgentSalaryIds.includes(s.id) && s.status !== 'paid' && s.status !== 'pushed');
    if (urgent.length) {
      const amt = urgent.reduce((s, r) => s + Math.max(0, (Number(r.totalSalary) || 0) - (Number(r.paidAmount) || 0)), 0);
      items.push({
        key: 'urgent', tone: 'warning', icon: 'bell',
        title: `${urgent.length} urgent salar${urgent.length === 1 ? 'y' : 'ies'}`,
        sub: `${fmtAED(amt)} to pay`,
        action: { label: 'Review', fn: () => onNavigate('salaries') },
      });
    }
    if (stats.billSum.pending > 0) {
      items.push({
        key: 'bills', tone: 'neutral', icon: 'receipt',
        title: `Bills for ${fmtMonth(ym)}`,
        sub: `${fmtAED(stats.billSum.pending)} still unpaid`,
        action: { label: 'Open', fn: () => onNavigate('bills') },
      });
    }
    return items;
  }, [stats, invoices, salaries, expenses, urgentSalaryIds, todayStr, ym, onView, onConfirmPayment, onNavigate]);

  const recent = invoices.slice(0, 6);

  return (
    <div className="animate-fade-in">
      <div className="page-head">
        <div>
          <h1 className="page-title">{greeting()} 👋</h1>
          <p className="page-sub">{fmtDate(todayStr)} · Here's where Devmate stands this month</p>
        </div>
        <Btn onClick={onNew}><Icon name="plus" size={14} /> New Invoice</Btn>
      </div>

      {/* Hero + KPIs */}
      <div className="dash-hero">
        <div className="hero-card">
          <div className="hero-label">Received in {fmtMonth(ym)}</div>
          <div className="hero-value">{fmtAED(stats.receivedThis, 0)}</div>
          <div className="hero-sub">
            {delta === null ? 'No payments last month to compare' : (
              <span className={delta >= 0 ? 'delta-up' : 'delta-down'}>
                {delta >= 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(0)}% vs {fmtMonth(lastYm)}
              </span>
            )}
          </div>
          <div className="hero-net">
            <span>Net this month</span>
            <b>{fmtAED(stats.net, 0)}</b>
          </div>
          <div className="hero-foot">Received − salaries − bills − expenses paid (in AED)</div>
        </div>

        <div className="kpi-grid">
          <Kpi
            label="Outstanding" icon="wallet" tone="info"
            value={fmtAED(stats.outstanding, 0)}
            sub={`${stats.outstandingCount} open invoice${stats.outstandingCount === 1 ? '' : 's'}`}
            onClick={() => onNavigate('history')}
          />
          <Kpi
            label="Overdue" icon="alert" tone={stats.overdue.length ? 'danger' : 'neutral'}
            value={fmtAED(stats.overdueAmt, 0)}
            sub={stats.overdue.length ? `${stats.overdue.length} past due date` : 'Nothing overdue 🎉'}
            onClick={() => onNavigate('history')}
          />
          <Kpi
            label="Salaries due" icon="salaries" tone="warning"
            value={fmtAED(stats.salariesDue, 0)}
            sub={`${stats.dueSalariesCount} unpaid record${stats.dueSalariesCount === 1 ? '' : 's'}`}
            onClick={() => onNavigate('salaries')}
          />
          <Kpi
            label="Bills this month" icon="receipt" tone="neutral"
            value={fmtAED(stats.billSum.total, 0)}
            sub={`${fmtAED(stats.billSum.paid, 0)} paid`}
            onClick={() => onNavigate('bills')}
          />
        </div>
      </div>

      <div className="dash-grid">
        <div className="card dash-panel">
          <div className="panel-head">
            <div>
              <div className="panel-title">Revenue, last 6 months</div>
              <div className="panel-sub">All currencies converted to AED</div>
            </div>
            <Icon name="trend-up" size={18} color="var(--text-faint)" />
          </div>
          <RevenueChart data={stats.trend} />
        </div>

        <div className="card dash-panel">
          <div className="panel-head">
            <div>
              <div className="panel-title">Needs attention</div>
              <div className="panel-sub">{attention.length ? `${attention.length} item${attention.length === 1 ? '' : 's'}` : 'All clear'}</div>
            </div>
          </div>
          {attention.length === 0 ? (
            <div className="empty-mini">✅ Nothing waiting on you. Nice.</div>
          ) : (
            <div className="attention-list">
              {attention.slice(0, 7).map(a => (
                <div key={a.key} className={`attention-item tone-${a.tone}`}>
                  <span className="attention-icon"><Icon name={a.icon} size={14} /></span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="attention-title">{a.title}</div>
                    <div className="attention-sub">{a.sub}</div>
                  </div>
                  <button className="chip-btn" onClick={a.action.fn}>{a.action.label}</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="dash-grid">
        <div className="card" style={{ overflow: 'hidden' }}>
          <div className="panel-head" style={{ padding: '16px 22px', margin: 0, borderBottom: '1px solid var(--border-light)' }}>
            <div className="panel-title">Recent invoices</div>
            <button className="link-btn" onClick={() => onNavigate('history')}>View all →</button>
          </div>
          {recent.length === 0 ? (
            <div className="empty-mini" style={{ padding: 40 }}>No invoices yet. Create your first one!</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="inv-table">
                <thead>
                  <tr>
                    {['Invoice', 'Client', 'Amount', 'Status', 'Date'].map((h) => <th key={h}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {recent.map((inv) => (
                    <tr key={inv.invoiceNumber} className="row-link" onClick={() => onView(inv)}>
                      <td style={{ fontWeight: 600 }}>#{inv.invoiceNumber}</td>
                      <td style={{ color: 'var(--text-mid)' }}>{inv.clientName}</td>
                      <td className="num">{fmtCurrency(inv.totalPayment, inv.currency)}</td>
                      <td>
                        <Badge color={isInvoiceOverdue(inv, todayStr) ? 'red' : statusColor(inv.status)}>
                          {isInvoiceOverdue(inv, todayStr) ? 'overdue' : (inv.status || 'unpaid')}
                        </Badge>
                      </td>
                      <td style={{ color: 'var(--text-light)' }}>{fmtDate(inv.date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card dash-panel">
          <div className="panel-head">
            <div>
              <div className="panel-title">Top clients</div>
              <div className="panel-sub">By amount received, all time</div>
            </div>
            <button className="link-btn" onClick={() => onNavigate('clients')}>All {clients.length} →</button>
          </div>
          {stats.topClients.length === 0 ? (
            <div className="empty-mini">No payments received yet.</div>
          ) : stats.topClients.map(([name, amt]) => {
            const pct = stats.totalReceivedAll ? (amt / stats.totalReceivedAll) * 100 : 0;
            return (
              <div key={name} className="top-client">
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                  <span style={{ fontWeight: 600 }}>{name}</span>
                  <span className="num" style={{ color: 'var(--text-mid)' }}>{fmtAED(amt, 0)}</span>
                </div>
                <div className="meter"><div style={{ width: `${pct}%` }} /></div>
                <div style={{ fontSize: 10, color: 'var(--text-light)', marginTop: 3 }}>{pct.toFixed(0)}% of revenue</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
