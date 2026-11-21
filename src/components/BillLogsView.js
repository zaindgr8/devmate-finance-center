import React, { useState, useEffect, useRef } from 'react';
import RecurIcon from './RecurIcon';
import { currentYM, fmtMonth, fmtDate, normalizeBillCategory, billLogsFor, BILL_GROUPS, billCategoryLabel } from '../utils/helpers';

// Logs (formerly Bill Logs) — every payment ever recorded on a bill.
//
// Logs are keyed by bill.id, so renaming a bill (or person) in Payments keeps
// its whole history; the current name is always read from the bill itself.
// Newer logs also snapshot the bill's name and total at payment time, which
// lets this page show "paid as <old name>" and the balance left after each
// payment even if the bill's amount changed later.

const money = (n) => `AED ${(Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const isOneTime = (b) => b.type === 'one-time';
const KIND = {
  full: { label: 'Full', cls: 'full' },
  partial: { label: 'Partial', cls: 'partial' },
  payment: { label: 'Opening', cls: 'opening' },
};
const kindOf = (k) => KIND[k] || KIND.partial;
// Time the payment was entered (newer logs only)
const fmtTime = (iso) => (iso ? new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '');

function usePref(key, initial) {
  const [val, setVal] = useState(() => {
    try { const v = localStorage.getItem(key); return v == null ? initial : JSON.parse(v); } catch { return initial; }
  });
  const set = (v) => {
    setVal(v);
    try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* private mode */ }
  };
  return [val, set];
}

// Oldest first, with the balance left after each payment within its month
function ledgerFor(entries, currentTotal) {
  let running = 0;
  return [...entries]
    .sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.recordedAt || '').localeCompare(b.recordedAt || ''))
    .map((e) => {
      running += Number(e.amount) || 0;
      const total = e.billTotal != null ? Number(e.billTotal) : currentTotal;
      return { ...e, left: Math.max(0, total - running) };
    });
}

export default function BillLogsView({
  bills = [],
  billPaymentLogs = {},
  focusBillId = null,
  onFocusBillChange,
  onDeleteLog,
  onBack,
}) {
  const [mode, setMode] = usePref('bill_logs_mode', 'bill'); // 'bill' | 'timeline'
  const [filterMonth, setFilterMonth] = useState(currentYM());
  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = usePref('bill_logs_group', 'All');
  const [typeFilter, setTypeFilter] = usePref('bill_logs_type', 'all');
  const [sortBy, setSortBy] = usePref('bill_logs_sort', 'normal');
  const [expandedIds, setExpandedIds] = useState(() => (focusBillId ? [focusBillId] : []));
  const rowRefs = useRef({});

  const allMonths = [...new Set([
    currentYM(),
    ...Object.keys(billPaymentLogs || {}),
  ])].sort().reverse();
  const monthsInScope = filterMonth === 'all' ? allMonths : [filterMonth];
  const scopeLabel = filterMonth === 'all' ? 'all months' : fmtMonth(filterMonth);

  // Arriving from a bill's "Logs ›": open By bill, expand it and scroll to it
  useEffect(() => {
    if (!focusBillId) return;
    setMode('bill');
    setExpandedIds(prev => (prev.includes(focusBillId) ? prev : [...prev, focusBillId]));
    const t = setTimeout(() => {
      const el = rowRefs.current[focusBillId];
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusBillId]);

  // { month: [entries] } for one bill inside the selected scope
  const logsByMonth = (billId) => monthsInScope
    .map(month => ({ month, entries: billLogsFor(billPaymentLogs, month, billId) }))
    .filter(m => m.entries.length);
  const paidInScope = (billId) => logsByMonth(billId).reduce((s, m) => s + m.entries.reduce((x, e) => x + (Number(e.amount) || 0), 0), 0);
  const countInScope = (billId) => logsByMonth(billId).reduce((s, m) => s + m.entries.length, 0);

  const matches = (b) => {
    if (search.trim() && !(b.name || '').toLowerCase().includes(search.trim().toLowerCase())) return false;
    if (groupFilter !== 'All' && normalizeBillCategory(b.category) !== groupFilter) return false;
    if (typeFilter !== 'all' && (typeFilter === 'one-time') !== isOneTime(b)) return false;
    return true;
  };
  const filtered = bills.filter(matches);
  const withPayments = filtered.filter(b => countInScope(b.id) > 0 || b.id === focusBillId);
  const noPayments = filtered.length - filtered.filter(b => countInScope(b.id) > 0).length;

  const normalOrder = (a, b) => (a.order ?? 9999) - (b.order ?? 9999) || (a.name || '').localeCompare(b.name || '');
  const visible = [...withPayments].sort(
    sortBy === 'asc' ? (a, b) => paidInScope(a.id) - paidInScope(b.id) || normalOrder(a, b)
      : sortBy === 'desc' ? (a, b) => paidInScope(b.id) - paidInScope(a.id) || normalOrder(a, b)
        : normalOrder
  );

  const totalPaid = filtered.reduce((s, b) => s + paidInScope(b.id), 0);
  const paymentsCount = filtered.reduce((s, b) => s + countInScope(b.id), 0);

  const toggle = (billId) => {
    setExpandedIds(prev => (prev.includes(billId) ? prev.filter(id => id !== billId) : [...prev, billId]));
    if (onFocusBillChange) onFocusBillChange(billId);
  };

  const confirmDelete = (bill, month, entry) => {
    if (window.confirm(`Delete the ${money(entry.amount)} payment for "${bill.name}" on ${fmtDate(entry.date)}? Paid and pending for ${fmtMonth(month)} will be recalculated.`)) {
      onDeleteLog(month, bill.id, entry.id);
    }
  };

  // Timeline: every payment in scope, newest day first
  const timeline = [];
  if (mode === 'timeline') {
    filtered.forEach(bill => {
      logsByMonth(bill.id).forEach(({ month, entries }) => {
        ledgerFor(entries, Number(bill.amount) || 0).forEach(e => timeline.push({ ...e, month, bill }));
      });
    });
    timeline.sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.recordedAt || '').localeCompare(a.recordedAt || ''));
    if (sortBy === 'asc') timeline.sort((a, b) => (Number(a.amount) || 0) - (Number(b.amount) || 0));
    if (sortBy === 'desc') timeline.sort((a, b) => (Number(b.amount) || 0) - (Number(a.amount) || 0));
  }
  const byDay = [];
  timeline.forEach(e => {
    const key = sortBy === 'normal' ? (e.date || e.month) : 'all';
    const last = byDay[byDay.length - 1];
    if (last && last.key === key) last.items.push(e); else byDay.push({ key, items: [e] });
  });

  const nameNote = (bill, entry) => (entry.billName && entry.billName !== bill.name
    ? <div className="was-name">paid as “{entry.billName}”</div>
    : null);

  return (
    <div className="animate-fade-in">
      <div className="pay-head">
        <div>
          <h1>Logs</h1>
          <div className="pay-sub">Every payment, when it was made and what was left after it.</div>
        </div>
        <div className="pay-actions">
          <div className="seg" role="tablist" aria-label="View">
            <button role="tab" aria-selected={mode === 'bill'} className={mode === 'bill' ? 'on' : ''} onClick={() => setMode('bill')}>By bill</button>
            <button role="tab" aria-selected={mode === 'timeline'} className={mode === 'timeline' ? 'on' : ''} onClick={() => setMode('timeline')}>Timeline</button>
          </div>
          <div className="month-nav">
            <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)} aria-label="Month" style={{ padding: '8px 10px' }}>
              <option value="all">All months</option>
              {allMonths.map(m => <option key={m} value={m}>{fmtMonth(m)}</option>)}
            </select>
          </div>
          {onBack && <button className="btn btn-ghost btn-md" onClick={onBack}>‹ Accounts</button>}
        </div>
      </div>

      <div className="pay-summary">
        <div className="pay-summary-grid">
          <div>
            <div className="pay-stat-label">Paid · {scopeLabel}</div>
            <div className="pay-stat-val paid">{money(totalPaid)}</div>
          </div>
          <div>
            <div className="pay-stat-label">Payments</div>
            <div className="pay-stat-val">{paymentsCount}</div>
          </div>
          <div>
            <div className="pay-stat-label">Bills paid</div>
            <div className="pay-stat-val">{filtered.filter(b => countInScope(b.id) > 0).length}</div>
          </div>
        </div>
      </div>

      <div className="pay-toolbar">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="seg" role="tablist" aria-label="Category">
            {BILL_GROUPS.map(g => (
              <button key={g} role="tab" aria-selected={groupFilter === g} className={groupFilter === g ? 'on' : ''} onClick={() => setGroupFilter(g)}>{billCategoryLabel(g)}</button>
            ))}
          </div>
          <div className="seg" role="tablist" aria-label="Type">
            {[['all', 'All'], ['monthly', 'Monthly'], ['one-time', 'One-time']].map(([id, label]) => (
              <button key={id} role="tab" aria-selected={typeFilter === id} className={typeFilter === id ? 'on' : ''} onClick={() => setTypeFilter(id)}>{label}</button>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input className="form-input" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search bill or person…" style={{ width: 200, padding: '8px 12px' }} />
          <select className="sort-select" value={sortBy} onChange={e => setSortBy(e.target.value)} aria-label="Sort">
            <option value="normal">{mode === 'timeline' ? 'Newest first' : 'Normal order'}</option>
            <option value="asc">Amount ↑</option>
            <option value="desc">Amount ↓</option>
          </select>
        </div>
      </div>

      {mode === 'bill' && (
        <>
          {visible.length === 0 && (
            <div className="empty-note" style={{ padding: '24px 2px' }}>No payments recorded for {scopeLabel}{filtered.length !== bills.length ? ' with these filters' : ''}.</div>
          )}

          {visible.map(bill => {
            const currentTotal = Number(bill.amount) || 0;
            const months = logsByMonth(bill.id);
            const paid = paidInScope(bill.id);
            const count = countInScope(bill.id);
            const expanded = expandedIds.includes(bill.id);
            const singleMonth = filterMonth !== 'all';
            const lastEntry = months[0] && months[0].entries[months[0].entries.length - 1];
            const monthTotal = lastEntry && lastEntry.billTotal != null ? Number(lastEntry.billTotal) : currentTotal;
            const left = Math.max(0, monthTotal - paid);
            const renamed = months.some(m => m.entries.some(e => e.billName && e.billName !== bill.name));

            return (
              <div key={bill.id} ref={el => { rowRefs.current[bill.id] = el; }} className={`log-bill${bill.id === focusBillId ? ' focus' : ''}`}>
                <button className="log-bill-head" onClick={() => toggle(bill.id)} aria-expanded={expanded}>
                  <span className="chevron" style={{ transform: expanded ? 'rotate(90deg)' : 'none' }}>▶</span>
                  <span style={{ minWidth: 0 }}>
                    <span className="bill-name" style={{ display: 'block' }}>{bill.name}{!isOneTime(bill) && <RecurIcon />}</span>
                    <span className="bill-meta">
                      <span className="chip">{billCategoryLabel(normalizeBillCategory(bill.category))}</span>
                      <span>{count} payment{count === 1 ? '' : 's'}</span>
                      {renamed && <span className="was-name">· renamed, history kept</span>}
                    </span>
                  </span>
                  <span className="bill-amounts" style={{ minWidth: 0 }}>
                    {singleMonth ? (
                      <>
                        <span className="bill-total" style={{ display: 'block' }}>{money(monthTotal)}</span>
                        <span className="bill-split">
                          <span className={left > 0 ? 'p' : 'z'}>Pending {money(left)}</span>
                          <span className="sep">|</span>
                          <span className={paid > 0 ? 'd' : 'z'}>Paid {money(paid)}</span>
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="bill-total" style={{ display: 'block', color: 'var(--success)' }}>{money(paid)}</span>
                        <span className="bill-split">paid across {months.length} month{months.length === 1 ? '' : 's'}</span>
                      </>
                    )}
                  </span>
                </button>

                {expanded && (
                  months.length === 0 ? (
                    <div className="log-month"><div className="empty-note">No payments for {scopeLabel} yet. Record one with Pay full or Partial on Accounts.</div></div>
                  ) : months.map(({ month, entries }) => {
                    const rows = ledgerFor(entries, currentTotal);
                    const mPaid = entries.reduce((s, e) => s + (Number(e.amount) || 0), 0);
                    const mTotal = rows.length && rows[rows.length - 1].billTotal != null ? Number(rows[rows.length - 1].billTotal) : currentTotal;
                    return (
                      <div key={month} className="log-month">
                        <div className="log-month-head">
                          <b>{fmtMonth(month)}</b>
                          <span>Total {money(mTotal)} · Paid {money(mPaid)} · Left {money(Math.max(0, mTotal - mPaid))}</span>
                        </div>
                        <table className="ledger">
                          <thead>
                            <tr>
                              <th>Paid on</th>
                              <th className="num">Amount paid</th>
                              <th className="num">Left after</th>
                              <th className="hide-sm">Type</th>
                              <th className="hide-sm">Note</th>
                              <th aria-label="Actions" />
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map(entry => (
                              <tr key={entry.id}>
                                <td className="when">
                                  {fmtDate(entry.date)}
                                  {entry.recordedAt && <small>recorded {fmtDate(entry.recordedAt)} {fmtTime(entry.recordedAt)}</small>}
                                  {nameNote(bill, entry)}
                                </td>
                                <td className="num amt">{money(entry.amount)}</td>
                                <td className={`num bal${entry.left === 0 ? ' zero' : ''}`}>{entry.left === 0 ? 'Settled' : money(entry.left)}</td>
                                <td className="hide-sm"><span className={`kind ${kindOf(entry.kind).cls}`}>{kindOf(entry.kind).label}</span></td>
                                <td className="hide-sm" style={{ color: 'var(--text-light)' }}>{entry.note || '—'}</td>
                                <td style={{ textAlign: 'right' }}>
                                  {onDeleteLog && <button className="icon-btn" title="Delete this payment" aria-label="Delete this payment" onClick={() => confirmDelete(bill, month, entry)}>×</button>}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    );
                  })
                )}
              </div>
            );
          })}

          {noPayments > 0 && visible.length > 0 && (
            <div className="hint" style={{ textAlign: 'left' }}>{noPayments} bill{noPayments === 1 ? ' has' : 's have'} no payments in {scopeLabel}.</div>
          )}
        </>
      )}

      {mode === 'timeline' && (
        <>
          {timeline.length === 0 && <div className="empty-note" style={{ padding: '24px 2px' }}>No payments recorded for {scopeLabel}.</div>}
          {byDay.map(day => (
            <div key={day.key}>
              {sortBy === 'normal' && <div className="tl-day">{fmtDate(day.key)}</div>}
              {day.items.map(e => (
                <div key={e.id} className="tl-row">
                  <div style={{ minWidth: 0 }}>
                    <button className="tl-name" onClick={() => { setExpandedIds(prev => (prev.includes(e.bill.id) ? prev : [...prev, e.bill.id])); if (onFocusBillChange) onFocusBillChange(e.bill.id); setMode('bill'); }}>
                      {e.bill.name}
                    </button>
                    <div className="bill-meta">
                      <span className={`kind ${kindOf(e.kind).cls}`}>{kindOf(e.kind).label}</span>
                      <span>{billCategoryLabel(normalizeBillCategory(e.bill.category))}</span>
                      {sortBy !== 'normal' && <span>· {fmtDate(e.date)}</span>}
                      {e.recordedAt && <span>· {fmtTime(e.recordedAt)}</span>}
                      {e.note && <span>· {e.note}</span>}
                      {e.billName && e.billName !== e.bill.name && <span className="was-name">· paid as “{e.billName}”</span>}
                    </div>
                  </div>
                  <div className="bill-amounts" style={{ minWidth: 0 }}>
                    <div className="bill-total" style={{ color: 'var(--success)' }}>{money(e.amount)}</div>
                    <div className="bill-split">{e.left === 0 ? 'Settled' : `${money(e.left)} left`}</div>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </>
      )}
    </div>
  );
}
