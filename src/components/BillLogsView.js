import React, { useState, useEffect, useRef } from 'react';
import { currentYM, fmtMonth, normalizeBillCategory, sumBillLogs, billLogsFor, BILL_CATEGORIES } from '../utils/helpers';

// Bill Logs — payment history grouped by bill (person / bill name).
//
// One rule makes renames work everywhere: logs are keyed by bill.id and
// never store the bill name. This view reads the name from the bill record
// itself, so editing a name in Accounts renames it here automatically.
// A bill's Paid amount is always the sum of its logs; Pending = Total - Paid.
export default function BillLogsView({
  bills = [],
  billPaymentLogs = {},
  focusBillId = null,
  onFocusBillChange,
  onDeleteLog,
  onBack,
}) {
  const [filterMonth, setFilterMonth] = useState(currentYM());
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [expandedIds, setExpandedIds] = useState(() => (focusBillId ? [focusBillId] : []));
  const rowRefs = useRef({});

  // Months that have any logs, plus the current month
  const allMonths = [...new Set([
    currentYM(),
    ...Object.keys(billPaymentLogs || {}),
    ...bills.filter(b => b.type === 'one-time' && b.month).map(b => b.month),
  ])].sort().reverse();

  // Coming from a bill's "Logs" button: expand that bill and scroll to it.
  useEffect(() => {
    if (!focusBillId) return;
    setExpandedIds(prev => (prev.includes(focusBillId) ? prev : [...prev, focusBillId]));
    const el = rowRefs.current[focusBillId];
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [focusBillId]);

  const monthsInScope = filterMonth === 'all' ? allMonths : [filterMonth];

  // All logs for one bill inside the selected scope, newest first
  const logsForBill = (billId) => {
    const out = [];
    monthsInScope.forEach(month => {
      billLogsFor(billPaymentLogs, month, billId).forEach(entry => {
        out.push({ ...entry, month });
      });
    });
    return out.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  };

  const paidForBill = (billId) => sumBillLogs(logsForBill(billId));

  const visibleBills = [...bills]
    .filter(b => {
      if (search.trim() && !b.name.toLowerCase().includes(search.trim().toLowerCase())) return false;
      if (categoryFilter !== 'All' && normalizeBillCategory(b.category) !== categoryFilter) return false;
      return true;
    })
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  const totalPaidScope = visibleBills.reduce((s, b) => s + paidForBill(b.id), 0);
  const paymentsCount = visibleBills.reduce((s, b) => s + logsForBill(b.id).length, 0);
  const billsWithPayments = visibleBills.filter(b => logsForBill(b.id).length > 0).length;

  const toggle = (billId) => {
    setExpandedIds(prev => (prev.includes(billId) ? prev.filter(id => id !== billId) : [...prev, billId]));
    if (onFocusBillChange) onFocusBillChange(billId);
  };

  const cardStyle = { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: '18px 20px', boxShadow: 'var(--shadow)' };
  const kindLabel = (kind) => (kind === 'full' ? 'Full payment' : kind === 'payment' ? 'Opening balance' : 'Partial payment');

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Bill Logs</h1>
          <div style={{ fontSize: 13, color: 'var(--text-light)' }}>
            Payment history by bill · each title opens its logs. Logs are linked to the bill, not its name — rename a bill in Accounts and it updates here too.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search a bill / person…"
            className="form-input"
            style={{ padding: '9px 14px', fontSize: 13, width: 200 }}
          />
          <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="form-select" style={{ padding: '9px 14px', fontSize: 13, fontWeight: 600 }}>
            <option value="All">All categories</option>
            {BILL_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)} className="form-select" style={{ padding: '9px 14px', fontSize: 13, fontWeight: 600 }}>
            <option value="all">All months</option>
            {allMonths.map(m => (
              <option key={m} value={m}>{fmtMonth(m)}{m === currentYM() ? ' (Current)' : ''}</option>
            ))}
          </select>
          {onBack && (
            <button onClick={onBack} className="btn btn-ghost btn-md" title="Back to Accounts">← Accounts</button>
          )}
        </div>
      </div>

      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 14, marginBottom: 28 }}>
        {[
          { label: filterMonth === 'all' ? 'Total Paid (All Months)' : `Total Paid (${fmtMonth(filterMonth)})`, val: totalPaidScope, color: '#10b981' },
          { label: 'Payments Recorded', val: paymentsCount, color: '#8b5cf6', plain: true },
          { label: 'Bills With Payments', val: billsWithPayments, color: '#ef4444', plain: true },
        ].map(({ label, val, color, plain }) => (
          <div key={label} style={cardStyle}>
            <div style={{ fontSize: 10, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 600, marginBottom: 8 }}>{label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color }}>{plain ? val : `AED ${Number(val).toLocaleString('en-US', { minimumFractionDigits: 2 })}`}</div>
          </div>
        ))}
      </div>

      {/* Empty state */}
      {visibleBills.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-light)', background: 'var(--card)', borderRadius: 16, border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📒</div>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>No bills match</div>
          <div style={{ fontSize: 13 }}>Try a different search or category — or add a bill from Accounts first.</div>
        </div>
      )}

      {/* One expandable title per bill */}
      {visibleBills.map(bill => {
        const total = Number(bill.amount) || 0;
        const logs = logsForBill(bill.id);
        const paid = sumBillLogs(logs);
        const pending = Math.max(0, total - paid);
        const expanded = expandedIds.includes(bill.id);
        return (
          <div
            key={bill.id}
            ref={el => { rowRefs.current[bill.id] = el; }}
            style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, marginBottom: 8, overflow: 'hidden' }}
          >
            <button
              onClick={() => toggle(bill.id)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontFamily: 'inherit', textAlign: 'left' }}
            >
              <span style={{ fontSize: 12, color: 'var(--text-faint)', flexShrink: 0, transition: 'transform 0.2s', transform: expanded ? 'rotate(90deg)' : 'none' }}>▶</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>{bill.name}</span>
                <span style={{ marginLeft: 8, fontSize: 11, background: 'var(--border-light)', borderRadius: 4, padding: '1px 8px', color: 'var(--text-light)' }}>{normalizeBillCategory(bill.category)}</span>
                <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--text-light)' }}>{logs.length} payment{logs.length === 1 ? '' : 's'}</span>
              </span>
              <span style={{ display: 'flex', gap: 18, flexShrink: 0, textAlign: 'right' }}>
                <span>
                  <span style={{ display: 'block', fontSize: 10, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: 1 }}>Total</span>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>AED {total.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                </span>
                <span>
                  <span style={{ display: 'block', fontSize: 10, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: 1 }}>Paid</span>
                  <span style={{ fontWeight: 700, fontSize: 14, color: '#10b981' }}>AED {paid.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                </span>
                <span>
                  <span style={{ display: 'block', fontSize: 10, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: 1 }}>Pending</span>
                  <span style={{ fontWeight: 700, fontSize: 14, color: pending > 0 ? '#ef4444' : '#10b981' }}>AED {pending.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                </span>
              </span>
            </button>

            {expanded && (
              <div style={{ borderTop: '1px solid var(--border-light)', padding: '12px 16px 16px 42px' }}>
                {logs.length === 0 ? (
                  <div style={{ fontSize: 13, color: 'var(--text-light)', fontStyle: 'italic' }}>No payments recorded yet — record one from Payments (Partial or Mark Paid).</div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ textAlign: 'left', color: 'var(--text-light)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>
                        <th style={{ padding: '6px 8px 6px 0' }}>Date</th>
                        <th style={{ padding: '6px 8px' }}>Type</th>
                        <th style={{ padding: '6px 8px', textAlign: 'right' }}>Amount</th>
                        <th style={{ padding: '6px 8px' }}>Note</th>
                        <th style={{ padding: '6px 0 6px 8px', width: 32 }} />
                      </tr>
                    </thead>
                    <tbody>
                      {logs.map(entry => (
                        <tr key={entry.id} style={{ borderTop: '1px solid var(--border-light)' }}>
                          <td style={{ padding: '8px 8px 8px 0', whiteSpace: 'nowrap' }}>{entry.date || entry.month}</td>
                          <td style={{ padding: '8px' }}>{kindLabel(entry.kind)}</td>
                          <td style={{ padding: '8px', textAlign: 'right', fontWeight: 700, color: '#10b981' }}>AED {Number(entry.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                          <td style={{ padding: '8px', color: 'var(--text-light)' }}>{entry.note || '—'}</td>
                          <td style={{ padding: '8px 0 8px 8px', textAlign: 'right' }}>
                            {onDeleteLog && (
                              <button
                                onClick={() => { if (window.confirm(`Delete this ${kindLabel(entry.kind).toLowerCase()} of AED ${Number(entry.amount || 0).toLocaleString()} for "${bill.name}" on ${entry.date}?`)) onDeleteLog(entry.month, bill.id, entry.id); }}
                                title="Delete this payment log"
                                style={{ background: 'none', border: 'none', color: 'var(--text-faint)', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '2px 6px' }}
                              >×</button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
