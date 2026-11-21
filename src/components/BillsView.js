import React, { useState, useEffect, useRef } from 'react';
import Icon from './Icon';
import RecurIcon from './RecurIcon';
import {
  currentYM, fmtMonth, fmtDate, billsForMonth, downloadCSV, localDateStr,
  BILL_CATEGORIES, BILL_GROUPS, normalizeBillCategory, billCategoryLabel,
  billPaidFromLogs, billLogsFor,
} from '../utils/helpers';

// Accounts (formerly Payments) — one list of bills for the selected month.
//
// Every payment is a LOG entry ({ id, amount, date, kind, note, billTotal,
// billName, recordedAt }) stored under the bill's id, never its name. So a
// bill (or person) can be renamed freely and keeps all of its payment history.
// Paid = sum of the month's logs, Pending = Total − Paid.
//
// Filters: category (All / Personal / Company / House / Dues), type
// (All / Monthly / One-time) and sort (Normal = your drag order, Amount ↑/↓).

const TYPE_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'one-time', label: 'One-time' },
];
const SORTS = [
  { id: 'normal', label: 'Normal order' },
  { id: 'asc', label: 'Amount ↑' },
  { id: 'desc', label: 'Amount ↓' },
];

const EMPTY_FORM = { name: '', amount: '', type: 'monthly', category: 'Personal', month: currentYM() };
// Anything that isn't one-time recurs monthly (old custom sections included)
const isOneTime = (b) => b.type === 'one-time';
const money = (n) => `AED ${(Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

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

// ⋯ menu for less frequent actions. An item with `submenu` opens a second
// list in place (e.g. Category › Personal / Company / House / Dues).
function RowMenu({ items }) {
  const [open, setOpen] = useState(false);
  const [sub, setSub] = useState(null); // label of the open submenu
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setSub(null); } };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);
  const list = items.filter(Boolean);
  const active = sub && list.find((it) => it.label === sub);
  const done = (fn) => { setOpen(false); setSub(null); fn(); };
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button className="icon-btn" aria-label="More actions" aria-expanded={open} onClick={() => { setOpen((o) => !o); setSub(null); }} style={{ fontSize: 18 }}>⋯</button>
      {open && (
        <div className="row-menu" role="menu">
          {active ? (
            <>
              <button role="menuitem" className="menu-back" onClick={() => setSub(null)}>‹ {active.label}</button>
              {active.submenu.map((opt) => (
                <button key={opt.label} role="menuitemradio" aria-checked={!!opt.checked} onClick={() => done(opt.onClick)}>
                  <span className="menu-check">{opt.checked ? '✓' : ''}</span>{opt.label}
                </button>
              ))}
            </>
          ) : list.map((it) => (
            <button
              key={it.label} role="menuitem" className={it.danger ? 'danger' : ''}
              aria-haspopup={it.submenu ? 'menu' : undefined}
              onClick={() => (it.submenu ? setSub(it.label) : done(it.onClick))}
            >
              <span style={{ flex: 1 }}>{it.label}</span>
              {it.submenu && <span className="menu-hint">{it.hint} ›</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function BillsView({
  bills = [],
  billPaymentLogs = {},
  onAdd,
  onUpdate,
  onDelete,
  onReorder,
  onAddPayment,
  onViewLogs,
}) {
  const [filterMonth, setFilterMonth] = useState(currentYM());
  const [groupFilter, setGroupFilter] = usePref('bills_group_filter', 'All');
  const [typeFilter, setTypeFilter] = usePref('bills_type_filter', 'all');
  const [sortBy, setSortBy] = usePref('bills_sort', 'normal');
  const [showPaid, setShowPaid] = usePref('bills_show_paid', false);

  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState(EMPTY_FORM);
  const [editingBillId, setEditingBillId] = useState(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const [payingBillId, setPayingBillId] = useState(null);
  const [payForm, setPayForm] = useState({ amount: '', date: localDateStr(new Date()), note: '' });
  // Inline edit of a bill's Total (double-click the amount)
  const [totalEditId, setTotalEditId] = useState(null);
  const [totalDraft, setTotalDraft] = useState('');
  const cancelTotalRef = useRef(false);
  const [dragBillId, setDragBillId] = useState(null);
  const [dragOverBillId, setDragOverBillId] = useState(null);

  const isCurrentMonth = filterMonth === currentYM();

  // Current month + every month that has logs or a one-time bill, newest first
  const allMonths = [...new Set([
    currentYM(),
    ...Object.keys(billPaymentLogs || {}),
    ...bills.filter(b => isOneTime(b) && b.month).map(b => b.month),
  ])].sort().reverse();
  const monthIdx = allMonths.indexOf(filterMonth);

  const paidFor = (billId) => billPaidFromLogs(billPaymentLogs, filterMonth, billId);
  const logCountFor = (billId) => billLogsFor(billPaymentLogs, filterMonth, billId).length;
  const lastPaymentFor = (billId) => [...billLogsFor(billPaymentLogs, filterMonth, billId)]
    .sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.recordedAt || '').localeCompare(b.recordedAt || ''))
    .pop();

  // Filters
  const monthBills = billsForMonth(bills, filterMonth);
  const byType = (b) => typeFilter === 'all' || (typeFilter === 'one-time' ? isOneTime(b) : !isOneTime(b));
  const byGroup = (b) => groupFilter === 'All' || normalizeBillCategory(b.category) === groupFilter;
  const filteredBills = monthBills.filter(b => byType(b) && byGroup(b));
  const groupCounts = BILL_GROUPS.reduce((acc, g) => {
    acc[g] = monthBills.filter(b => byType(b) && (g === 'All' || normalizeBillCategory(b.category) === g)).length;
    return acc;
  }, {});
  const typeCounts = TYPE_FILTERS.reduce((acc, t) => {
    acc[t.id] = monthBills.filter(b => byGroup(b) && (t.id === 'all' || (t.id === 'one-time' ? isOneTime(b) : !isOneTime(b)))).length;
    return acc;
  }, {});

  // Sort: normal = saved drag order; otherwise by total amount
  const normalOrder = (a, b) => (a.order ?? 9999) - (b.order ?? 9999) || (a.createdAt || '').localeCompare(b.createdAt || '');
  const sorter = sortBy === 'asc'
    ? (a, b) => (Number(a.amount) || 0) - (Number(b.amount) || 0) || normalOrder(a, b)
    : sortBy === 'desc'
      ? (a, b) => (Number(b.amount) || 0) - (Number(a.amount) || 0) || normalOrder(a, b)
      : normalOrder;
  const sorted = [...filteredBills].sort(sorter);
  const isSettled = (b) => (Number(b.amount) || 0) > 0 && paidFor(b.id) >= (Number(b.amount) || 0);
  const toPay = sorted.filter(b => !isSettled(b));
  const settled = sorted.filter(isSettled);

  // Summary (follows the filters)
  const total = filteredBills.reduce((s, b) => s + (Number(b.amount) || 0), 0);
  const paid = filteredBills.reduce((s, b) => s + Math.min(paidFor(b.id), Number(b.amount) || 0), 0);
  const pending = Math.max(0, total - paid);
  const pct = total > 0 ? Math.round((paid / total) * 100) : 0;

  const exportCSV = () => {
    const rows = [['Bill', 'Type', 'Category', 'Total (AED)', 'Paid (AED)', 'Pending (AED)', 'Payments']];
    sorted.forEach(b => {
      const t = Number(b.amount) || 0;
      const p = paidFor(b.id);
      rows.push([b.name, isOneTime(b) ? 'One-time' : 'Monthly', billCategoryLabel(normalizeBillCategory(b.category)), t, p, Math.max(0, t - p), logCountFor(b.id)]);
    });
    downloadCSV(`bills-${filterMonth}.csv`, rows);
  };

  /* ── add / edit ── */
  const validate = (form) => {
    if (!form.name.trim()) { alert('Bill name is required.'); return false; }
    if (!form.amount || Number(form.amount) <= 0) { alert('Please enter a valid amount.'); return false; }
    return true;
  };
  const toPayload = (form) => {
    const { paidAmount: _p, ...rest } = form;
    return { ...rest, name: form.name.trim(), amount: Number(form.amount), category: normalizeBillCategory(form.category) };
  };

  const openAdd = () => {
    setEditingBillId(null); setPayingBillId(null);
    setAddForm({ ...EMPTY_FORM, month: filterMonth, category: groupFilter !== 'All' ? groupFilter : 'Personal', type: typeFilter === 'one-time' ? 'one-time' : 'monthly' });
    setShowAddForm(true);
  };
  const saveAdd = () => {
    if (!validate(addForm)) return;
    const maxOrder = bills.reduce((m, b) => Math.max(m, b.order ?? -1), -1);
    onAdd({
      ...toPayload(addForm),
      order: maxOrder + 1,
      id: `bill-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      createdAt: new Date().toISOString(),
    });
    setShowAddForm(false);
  };

  const openEdit = (bill) => {
    setPayingBillId(null); setShowAddForm(false);
    setEditForm({ name: bill.name, amount: bill.amount, type: isOneTime(bill) ? 'one-time' : 'monthly', category: normalizeBillCategory(bill.category), month: bill.month || currentYM() });
    setEditingBillId(bill.id);
  };
  const saveEdit = () => {
    if (!validate(editForm)) return;
    // Same id, so every payment log stays attached after a rename
    onUpdate(editingBillId, toPayload(editForm));
    setEditingBillId(null);
  };

  const startTotalEdit = (bill) => {
    if (!isCurrentMonth) return;
    setTotalDraft(String(Number(bill.amount) || ''));
    setTotalEditId(bill.id);
  };
  // Runs once, on blur (Enter blurs the field; Escape blurs with cancel set)
  const saveTotalEdit = (bill) => {
    setTotalEditId(null);
    if (cancelTotalRef.current) { cancelTotalRef.current = false; return; }
    const next = Number(totalDraft);
    if (!(next > 0)) return alert('Total must be greater than 0.');
    const alreadyPaid = paidFor(bill.id);
    if (next < alreadyPaid) return alert(`${money(alreadyPaid)} is already paid for "${bill.name}" this month, so the total can't be lower than that.`);
    if (next !== (Number(bill.amount) || 0)) onUpdate(bill.id, { amount: Math.round(next * 100) / 100 });
  };

  /* ── payments ── */
  // Partial: any amount up to what's pending, with a date and note
  const openPartial = (bill) => {
    setEditingBillId(null); setShowAddForm(false);
    setPayForm({ amount: '', date: localDateStr(new Date()), note: '' });
    setPayingBillId(bill.id);
  };
  // Pay full: one click records the whole pending balance (Undo is in the ⋯ menu)
  const payFull = (bill) => {
    const due = Math.max(0, (Number(bill.amount) || 0) - paidFor(bill.id));
    if (due <= 0) return;
    onAddPayment(filterMonth, bill.id, due, localDateStr(new Date()), 'full', '', {
      billTotal: Number(bill.amount) || 0,
      billName: bill.name,
    });
    if (payingBillId === bill.id) setPayingBillId(null);
  };
  const savePay = (bill) => {
    const amount = Number(payForm.amount) || 0;
    const due = Math.max(0, (Number(bill.amount) || 0) - paidFor(bill.id));
    if (amount <= 0) return alert('Enter an amount greater than 0.');
    if (amount > due + 0.001) return alert(`Only ${money(due)} is still pending for "${bill.name}".`);
    onAddPayment(filterMonth, bill.id, amount, payForm.date || localDateStr(new Date()), amount >= due ? 'full' : 'partial', payForm.note.trim(), {
      billTotal: Number(bill.amount) || 0,
      billName: bill.name,
    });
    setPayingBillId(null);
  };

  /* ── drag to reorder (normal order only) ── */
  const canDrag = isCurrentMonth && sortBy === 'normal';
  const handleDrop = (e) => {
    e.preventDefault();
    if (dragBillId && dragOverBillId && dragBillId !== dragOverBillId) {
      const all = [...bills].sort(normalOrder);
      const from = all.findIndex(b => b.id === dragBillId);
      const to = all.findIndex(b => b.id === dragOverBillId);
      if (from !== -1 && to !== -1) {
        const [moved] = all.splice(from, 1);
        all.splice(to, 0, moved);
        const orderOf = new Map(all.map((b, i) => [b.id, i]));
        onReorder(bills.map(b => ({ ...b, order: orderOf.get(b.id) })));
      }
    }
    setDragBillId(null); setDragOverBillId(null);
  };

  /* ── pieces ── */
  const formFields = (form, setForm) => (
    <div className="pay-fields">
      <div>
        <div className="field-label">Name *</div>
        <input className="form-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. House rent, Gulraiz loan" autoFocus />
      </div>
      <div>
        <div className="field-label">Amount (AED) *</div>
        <input className="form-input" type="number" min="0" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="0.00" />
      </div>
      <div>
        <div className="field-label">Type</div>
        <select className="form-select" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
          <option value="monthly">Monthly</option>
          <option value="one-time">One-time</option>
        </select>
      </div>
      <div>
        <div className="field-label">Category</div>
        <select className="form-select" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
          {BILL_CATEGORIES.map(c => <option key={c} value={c}>{billCategoryLabel(c)}</option>)}
        </select>
      </div>
      {form.type === 'one-time' && (
        <div>
          <div className="field-label">Month</div>
          <input className="form-input" type="month" value={form.month} onChange={e => setForm({ ...form, month: e.target.value })} />
        </div>
      )}
    </div>
  );

  const renderRow = (bill) => {
    const t = Number(bill.amount) || 0;
    const p = paidFor(bill.id);
    const due = Math.max(0, t - p);
    const done = isSettled(bill);
    const logs = logCountFor(bill.id);
    const editing = editingBillId === bill.id;
    const paying = payingBillId === bill.id;
    const rowPct = t > 0 ? Math.min(100, (p / t) * 100) : 0;
    const last = lastPaymentFor(bill.id);

    return (
      <React.Fragment key={bill.id}>
        <div
          className={[
            'bill-row',
            done && 'settled',
            (editing || paying) && 'open',
            dragOverBillId === bill.id && dragBillId !== bill.id && 'drop-target',
            dragBillId === bill.id && 'dragging',
          ].filter(Boolean).join(' ')}
          draggable={canDrag}
          onDragStart={e => { setDragBillId(bill.id); e.dataTransfer.effectAllowed = 'move'; }}
          onDragOver={e => { if (!canDrag) return; e.preventDefault(); if (bill.id !== dragBillId) setDragOverBillId(bill.id); }}
          onDrop={handleDrop}
          onDragEnd={() => { setDragBillId(null); setDragOverBillId(null); }}
        >
          <div className={`drag-handle${canDrag ? '' : ' off'}`} title="Drag to reorder">⠿</div>

          <div style={{ minWidth: 0 }}>
            <div className="bill-name" title={bill.name}>{bill.name}{!isOneTime(bill) && <RecurIcon />}</div>
            <div className="bill-meta">
              <span className="chip">{billCategoryLabel(normalizeBillCategory(bill.category))}</span>
              {last && <span className="last-paid">Last paid {money(last.amount)} · {fmtDate(last.date)}</span>}
            </div>
          </div>

          <div className="bill-amounts">
            {totalEditId === bill.id ? (
              <input
                className="total-input"
                type="number" min="0" step="any" autoFocus
                aria-label={`Total for ${bill.name}`}
                value={totalDraft}
                onChange={e => setTotalDraft(e.target.value)}
                onFocus={e => e.target.select()}
                onKeyDown={e => {
                  if (e.key === 'Enter') e.currentTarget.blur();
                  if (e.key === 'Escape') { cancelTotalRef.current = true; e.currentTarget.blur(); }
                }}
                onBlur={() => saveTotalEdit(bill)}
              />
            ) : (
              <div
                className={`bill-total${isCurrentMonth ? ' editable' : ''}`}
                onDoubleClick={() => startTotalEdit(bill)}
                title={isCurrentMonth ? 'Double-click to change the total' : undefined}
              >
                {money(t)}
              </div>
            )}
            <div className="bill-split">
              <span className={due > 0 ? 'p' : 'z'}>Pending {money(due)}</span>
              <span className="sep">|</span>
              <span className={p > 0 ? 'd' : 'z'}>Paid {money(p)}</span>
            </div>
            {onViewLogs && (
              <button className="logs-link" onClick={() => onViewLogs(bill.id)} title="Payment history for this bill">
                Logs{logs ? ` (${logs})` : ''} ›
              </button>
            )}
          </div>

          <div className="bill-actions">
            {done ? (
              <span className="paid-badge">✓ Paid</span>
            ) : isCurrentMonth ? (
              <>
                <button className="pay-btn" onClick={() => payFull(bill)} title={`Record ${money(due)} paid today`}>Pay full</button>
                <button className={`partial-btn${paying ? ' on' : ''}`} onClick={() => (paying ? setPayingBillId(null) : openPartial(bill))} aria-expanded={paying}>Partial</button>
              </>
            ) : (
              <span className="paid-badge" style={{ color: 'var(--text-light)', background: 'var(--border-light)' }}>{p > 0 ? 'Partial' : 'Unpaid'}</span>
            )}
            {isCurrentMonth && (
              <RowMenu items={[
                { label: 'Edit bill', onClick: () => openEdit(bill) },
                {
                  label: 'Category',
                  hint: billCategoryLabel(normalizeBillCategory(bill.category)),
                  submenu: BILL_CATEGORIES.map(c => ({
                    label: billCategoryLabel(c),
                    checked: normalizeBillCategory(bill.category) === c,
                    onClick: () => { if (normalizeBillCategory(bill.category) !== c) onUpdate(bill.id, { category: c }); },
                  })),
                },
                { label: 'Delete bill', danger: true, onClick: () => { if (window.confirm(`Delete "${bill.name}"? Its payment logs will be removed too.`)) onDelete(bill.id); } },
              ]} />
            )}
          </div>

          {t > 0 && <div className="bill-bar" aria-hidden="true"><span style={{ width: `${rowPct}%` }} /></div>}
        </div>

        {paying && (
          <div className="row-panel">
            <div className="row-panel-title">Partial payment · {bill.name}</div>
            <div className="row-panel-sub">Pay any amount up to {money(due)}{p > 0 ? ` (${money(p)} of ${money(t)} already paid)` : ''}. It is saved to Logs with its date.</div>
            <div className="pay-fields">
              <div>
                <div className="field-label">Amount paid (AED)</div>
                <input
                  autoFocus className="form-input" type="number" min="0" max={due} step="any" value={payForm.amount}
                  placeholder={`Up to ${money(due)}`}
                  onChange={e => setPayForm({ ...payForm, amount: e.target.value })}
                  onKeyDown={e => { if (e.key === 'Enter') savePay(bill); if (e.key === 'Escape') setPayingBillId(null); }}
                />
                {Number(payForm.amount) > 0 && Number(payForm.amount) <= due && (
                  <div className="pay-preview">{money(Math.max(0, due - Number(payForm.amount)))} will still be pending</div>
                )}
              </div>
              <div>
                <div className="field-label">Date paid</div>
                <input className="form-input" type="date" value={payForm.date} onChange={e => setPayForm({ ...payForm, date: e.target.value })} />
              </div>
              <div>
                <div className="field-label">Note</div>
                <input className="form-input" value={payForm.note} onChange={e => setPayForm({ ...payForm, note: e.target.value })} placeholder="Cash, bank transfer…" onKeyDown={e => { if (e.key === 'Enter') savePay(bill); }} />
              </div>
            </div>
            <div className="panel-foot">
              <button className="btn btn-ghost btn-sm" onClick={() => setPayingBillId(null)}>Cancel</button>
              <button className="btn btn-primary btn-sm" onClick={() => savePay(bill)} disabled={!(Number(payForm.amount) > 0)}>Save payment</button>
            </div>
          </div>
        )}

        {editing && (
          <div className="row-panel">
            <div className="row-panel-title">Edit · {bill.name}</div>
            <div className="row-panel-sub">Renaming keeps all of this bill's payment logs.</div>
            {formFields(editForm, setEditForm)}
            <div className="panel-foot">
              <button className="btn btn-ghost btn-sm" onClick={() => setEditingBillId(null)}>Cancel</button>
              <button className="btn btn-primary btn-sm" onClick={saveEdit}>Save changes</button>
            </div>
          </div>
        )}
      </React.Fragment>
    );
  };

  return (
    <div className="animate-fade-in">
      <div className="pay-head">
        <div>
          <h1>Accounts</h1>
          <div className="pay-sub">Bills for the month. Every payment is kept in Logs.</div>
        </div>
        <div className="pay-actions">
          <div className="month-nav">
            <button aria-label="Previous month" disabled={monthIdx >= allMonths.length - 1} onClick={() => setFilterMonth(allMonths[monthIdx + 1])}>‹</button>
            <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)} aria-label="Month">
              {allMonths.map(m => <option key={m} value={m}>{fmtMonth(m)}</option>)}
            </select>
            <button aria-label="Next month" disabled={monthIdx <= 0} onClick={() => setFilterMonth(allMonths[monthIdx - 1])}>›</button>
          </div>
          {onViewLogs && <button className="btn btn-ghost btn-md" onClick={() => onViewLogs(null)}>Logs</button>}
          <button className="btn btn-ghost btn-md" onClick={exportCSV} disabled={!sorted.length} title="Export to CSV"><Icon name="download" size={14} /> CSV</button>
          {isCurrentMonth && <button className="btn btn-primary btn-md" onClick={openAdd}><Icon name="plus" size={14} /> Add bill</button>}
        </div>
      </div>

      {!isCurrentMonth && (
        <div className="history-banner">
          Viewing {fmtMonth(filterMonth)}. Past months are read-only.
          <button onClick={() => setFilterMonth(currentYM())}>Back to this month</button>
        </div>
      )}

      <div className="pay-summary">
        <div className="pay-summary-grid">
          <div>
            <div className="pay-stat-label">Total</div>
            <div className="pay-stat-val">{money(total)}</div>
          </div>
          <div>
            <div className="pay-stat-label">Pending</div>
            <div className="pay-stat-val pending">{money(pending)}</div>
          </div>
          <div>
            <div className="pay-stat-label">Paid</div>
            <div className="pay-stat-val paid">{money(paid)}</div>
          </div>
        </div>
        <div className="pay-progress" aria-hidden="true"><span style={{ width: `${pct}%` }} /></div>
        <div className="pay-progress-note">{pct}% paid · {settled.length} of {sorted.length} bill{sorted.length === 1 ? '' : 's'} settled</div>
      </div>

      <div className="pay-toolbar">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <div className="seg" role="tablist" aria-label="Category">
            {BILL_GROUPS.map(g => (
              <button key={g} role="tab" aria-selected={groupFilter === g} className={groupFilter === g ? 'on' : ''} onClick={() => setGroupFilter(g)}>
                {billCategoryLabel(g)}<span className="count">{groupCounts[g]}</span>
              </button>
            ))}
          </div>
          <div className="seg" role="tablist" aria-label="Type">
            {TYPE_FILTERS.map(t => (
              <button key={t.id} role="tab" aria-selected={typeFilter === t.id} className={typeFilter === t.id ? 'on' : ''} onClick={() => setTypeFilter(t.id)}>
                {t.label}<span className="count">{typeCounts[t.id]}</span>
              </button>
            ))}
          </div>
        </div>
        <select className="sort-select" value={sortBy} onChange={e => setSortBy(e.target.value)} aria-label="Sort">
          {SORTS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
      </div>

      {showAddForm && (
        <div className="row-panel" style={{ borderRadius: 12, borderTop: '1px solid var(--text-faint)', marginBottom: 18 }}>
          <div className="row-panel-title" style={{ marginBottom: 12 }}>New bill</div>
          {formFields(addForm, setAddForm)}
          <div className="panel-foot">
            <button className="btn btn-ghost btn-sm" onClick={() => setShowAddForm(false)}>Cancel</button>
            <button className="btn btn-primary btn-sm" onClick={saveAdd}>Add bill</button>
          </div>
        </div>
      )}

      {bills.length === 0 ? (
        <div className="empty-state" style={{ textAlign: 'center', padding: '56px 20px', color: 'var(--text-light)', background: 'var(--card)', borderRadius: 14, border: '1px solid var(--border)' }}>
          <div style={{ fontWeight: 600, marginBottom: 6, color: 'var(--text)' }}>No bills yet</div>
          <div style={{ fontSize: 13 }}>Add rent, utilities, loans and other regular payments to track them here.</div>
        </div>
      ) : sorted.length === 0 ? (
        <div className="empty-note" style={{ padding: '24px 2px' }}>No bills match these filters for {fmtMonth(filterMonth)}.</div>
      ) : (
        <>
          {toPay.length > 0 ? toPay.map(renderRow) : (
            <div className="empty-note" style={{ paddingBottom: 10 }}>Everything here is paid for {fmtMonth(filterMonth)}.</div>
          )}
          {settled.length > 0 && (
            <>
              <button className="paid-toggle" onClick={() => setShowPaid(!showPaid)} aria-expanded={showPaid}>
                <span className="chevron" style={{ transform: showPaid ? 'rotate(90deg)' : 'none' }}>▶</span>
                Paid · {settled.length} · {money(settled.reduce((s, b) => s + (Number(b.amount) || 0), 0))}
              </button>
              {showPaid && settled.map(renderRow)}
            </>
          )}
          {!canDrag && isCurrentMonth && sorted.length > 1 && (
            <div className="hint">Switch sort to "Normal order" to drag bills into your own order.</div>
          )}
        </>
      )}
    </div>
  );
}
