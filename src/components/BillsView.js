import React, { useState, useEffect } from 'react';
import Icon from './Icon';
import {
  currentYM, fmtMonth, billsForMonth, downloadCSV, localDateStr,
  BILL_CATEGORIES, BILL_GROUPS, normalizeBillCategory,
  billPaidFromLogs, billLogsFor,
} from '../utils/helpers';

const DEFAULT_SECTIONS = [
  { id: 'monthly', label: '🔄 Monthly Bills', color: '#ef4444' },
  { id: 'one-time', label: '📌 One-Time Expense', color: '#f59e0b' },
];

const EMPTY_FORM = { name: '', amount: '', type: 'monthly', category: 'Personal', month: currentYM() };

// billPaymentLogs: { "YYYY-MM": { "bill-id": [{ id, amount, date, kind, note }] } }
// Paid is always the SUM of a bill's logs for that month — a partial payment
// ADDS a log, it never overwrites a total, so history is never lost.
function getBillStatus(paidAmt, totalAmt) {
  if (paidAmt <= 0) return 'pending';
  if (paidAmt >= totalAmt) return 'paid';
  return 'partial';
}

export default function BillsView({
  bills = [],
  sections: propSections = [],
  billPaymentLogs = {},
  onUpdateSections,
  onAdd,
  onUpdate,
  onDelete,
  onReorder,
  onAddPayment,
  onUndoLastPayment,
  onViewLogs,
}) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState(EMPTY_FORM);
  // Inline edit: the editor renders directly under the bill row being edited,
  // never at the top of the page.
  const [editingBillId, setEditingBillId] = useState(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const [filterMonth, setFilterMonth] = useState(currentYM());
  // Toggle bar filter — All | Personal | Company | House | Dues.
  // The toggle IS the category, so filtering and the dropdown never disagree.
  const [groupFilter, setGroupFilter] = useState('All');
  const [editSectionId, setEditSectionId] = useState(null);
  const [editSectionLabel, setEditSectionLabel] = useState('');
  const [showAddSection, setShowAddSection] = useState(false);
  const [newSectionLabel, setNewSectionLabel] = useState('');
  const [dragBillId, setDragBillId] = useState(null);
  const [dragOverBillId, setDragOverBillId] = useState(null);
  const [dragSectionId, setDragSectionId] = useState(null);
  // Inline "add a payment" panel (partial or full) — also under the bill row
  const [paymentBillId, setPaymentBillId] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(localDateStr(new Date()));

  const isCurrentMonth = filterMonth === currentYM();

  // Sections fallback (seed the DB once, outside render)
  const hasSections = propSections && propSections.length > 0;
  let activeSections = propSections;
  if (!hasSections) {
    try {
      const s = localStorage.getItem('misc_bill_sections');
      activeSections = s ? JSON.parse(s) : DEFAULT_SECTIONS;
    } catch {
      activeSections = DEFAULT_SECTIONS;
    }
  }
  useEffect(() => {
    if (!hasSections && onUpdateSections) onUpdateSections(activeSections);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasSections]);

  const updateSections = (ns) => {
    if (onUpdateSections) onUpdateSections(ns);
    try { localStorage.setItem('misc_bill_sections', JSON.stringify(ns)); } catch (e) {}
  };

  // Build allMonths: current month + any month that has payments/logs recorded
  const allMonths = [...new Set([
    currentYM(),
    ...Object.keys(billPaymentLogs || {}),
    // also months from one-time bills
    ...bills.filter(b => b.type === 'one-time' && b.month).map(b => b.month),
  ])].sort().reverse();

  // Bills that apply to the selected month (recurring ones only from the month they were added)
  const monthBills = billsForMonth(bills, filterMonth);
  // Toggle bar: show one group at a time. Summary cards, CSV and the list
  // below all follow the toggle, so e.g. "House" shows house totals only.
  const filteredBills = groupFilter === 'All'
    ? monthBills
    : monthBills.filter(b => normalizeBillCategory(b.category) === groupFilter);
  const groupCounts = BILL_GROUPS.reduce((acc, g) => {
    acc[g] = g === 'All' ? monthBills.length : monthBills.filter(b => normalizeBillCategory(b.category) === g).length;
    return acc;
  }, {});
  // Bills whose section was deleted still count; show them under Monthly so they stay editable
  const knownSections = new Set(activeSections.map(s => s.id));
  const sectionOf = (b) => (knownSections.has(b.type) ? b.type : 'monthly');

  const getBillsForSection = (sectionId) => {
    const filtered = filteredBills.filter(b => sectionOf(b) === sectionId);
    return [...filtered].sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999));
  };

  const sumOf = (list) => list.reduce((s, b) => s + (Number(b.amount) || 0), 0);
  const monthlyTemplateTotal = sumOf(filteredBills.filter(b => b.type !== 'one-time'));
  const oneTimeTotal = sumOf(filteredBills.filter(b => b.type === 'one-time'));
  const totalThisMonth = monthlyTemplateTotal + oneTimeTotal;

  // Paid / pending derived from the payment LOGS for the selected month
  const paidFor = (billId) => billPaidFromLogs(billPaymentLogs, filterMonth, billId);
  const paidTotal = filteredBills.reduce((s, b) => s + Math.min(paidFor(b.id), Number(b.amount) || 0), 0);
  const pendingTotal = Math.max(0, totalThisMonth - paidTotal);

  const exportCSV = () => {
    const rows = [['Bill', 'Section', 'Category', 'Total (AED)', 'Paid (AED)', 'Pending (AED)', 'Status']];
    filteredBills.forEach(b => {
      const total = Number(b.amount) || 0;
      const paid = paidFor(b.id);
      rows.push([b.name, (activeSections.find(s => s.id === sectionOf(b)) || {}).label || b.type, normalizeBillCategory(b.category), total, paid, Math.max(0, total - paid), getBillStatus(paid, total)]);
    });
    downloadCSV(`bills-${filterMonth}.csv`, rows);
  };

  const resetAddForm = () => { setAddForm(EMPTY_FORM); setShowAddForm(false); };

  const handleAddSave = () => {
    if (!addForm.name.trim()) return alert('Bill name is required.');
    if (!addForm.amount || Number(addForm.amount) <= 0) return alert('Please enter a valid amount.');
    const payload = { ...addForm, amount: Number(addForm.amount), category: normalizeBillCategory(addForm.category) };
    delete payload.paidAmount;
    onAdd({
      ...payload,
      order: getBillsForSection(addForm.type).length,
      id: `bill-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      createdAt: new Date().toISOString(),
    });
    resetAddForm();
  };

  // Inline edit — opens right under this bill's row
  const handleEdit = (bill) => {
    setPaymentBillId(null);
    setEditForm({ name: bill.name, amount: bill.amount, type: bill.type, category: normalizeBillCategory(bill.category), month: bill.month || currentYM() });
    setEditingBillId(bill.id);
  };

  const handleEditSave = () => {
    if (!editForm.name.trim()) return alert('Bill name is required.');
    if (!editForm.amount || Number(editForm.amount) <= 0) return alert('Please enter a valid amount.');
    const payload = { ...editForm, amount: Number(editForm.amount), category: normalizeBillCategory(editForm.category) };
    delete payload.paidAmount;
    onUpdate(editingBillId, payload);
    setEditingBillId(null);
  };

  // Mark Paid adds ONE log for the remaining balance (kind 'full'), so the
  // payment is visible in Bill Logs like every other payment.
  const handleMarkPaid = (bill) => {
    if (!isCurrentMonth) return;
    const pending = Math.max(0, (Number(bill.amount) || 0) - paidFor(bill.id));
    if (pending <= 0) return;
    if (onAddPayment) onAddPayment(filterMonth, bill.id, pending, localDateStr(new Date()), 'full');
  };

  const handleMarkUnpaid = (bill) => {
    if (!isCurrentMonth) return;
    // Undo removes only the LAST payment log for this bill/month — earlier
    // partial payments stay in the history instead of being wiped.
    if (onUndoLastPayment) onUndoLastPayment(filterMonth, bill.id);
  };

  const startAddPayment = (bill) => {
    if (!isCurrentMonth) return;
    setEditingBillId(null);
    setPaymentAmount('');
    setPaymentDate(localDateStr(new Date()));
    setPaymentBillId(bill.id);
  };

  const saveAddPayment = (bill) => {
    const val = Number(paymentAmount) || 0;
    const pending = Math.max(0, (Number(bill.amount) || 0) - paidFor(bill.id));
    if (val <= 0) return alert('Enter an amount greater than 0.');
    if (val > pending) return alert(`Only AED ${pending.toLocaleString()} is still pending for "${bill.name}".`);
    if (onAddPayment) onAddPayment(filterMonth, bill.id, val, paymentDate || localDateStr(new Date()), val >= pending ? 'full' : 'partial');
    setPaymentBillId(null);
    setPaymentAmount('');
  };

  // Drag handlers
  const handleDragStart = (e, billId, sectionId) => {
    setDragBillId(billId);
    setDragSectionId(sectionId);
    e.dataTransfer.effectAllowed = 'move';
  };
  const handleDragOver = (e, billId) => {
    e.preventDefault();
    if (billId !== dragBillId) setDragOverBillId(billId);
  };
  const handleDrop = (e, sectionId) => {
    e.preventDefault();
    if (!dragBillId || dragSectionId !== sectionId || !dragOverBillId || dragBillId === dragOverBillId) {
      setDragBillId(null); setDragOverBillId(null); setDragSectionId(null); return;
    }
    const secBills = getBillsForSection(sectionId);
    const fromIdx = secBills.findIndex(b => b.id === dragBillId);
    const toIdx = secBills.findIndex(b => b.id === dragOverBillId);
    if (fromIdx === -1 || toIdx === -1) { setDragBillId(null); setDragOverBillId(null); setDragSectionId(null); return; }
    const reordered = [...secBills];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    const updatedBills = bills.map(b => {
      const idx = reordered.findIndex(r => r.id === b.id);
      return idx !== -1 ? { ...b, order: idx } : b;
    });
    if (onReorder) onReorder(updatedBills);
    setDragBillId(null); setDragOverBillId(null); setDragSectionId(null);
  };

  // Section edit
  const startEditSection = (sec) => { setEditSectionId(sec.id); setEditSectionLabel(sec.label); };
  const saveEditSection = () => {
    if (editSectionLabel.trim()) updateSections(activeSections.map(s => s.id === editSectionId ? { ...s, label: editSectionLabel.trim() } : s));
    setEditSectionId(null);
  };
  const handleAddSection = () => {
    if (!newSectionLabel.trim()) return;
    updateSections([...activeSections, { id: `custom-${Date.now()}`, label: newSectionLabel.trim(), color: '#6366f1' }]);
    setNewSectionLabel(''); setShowAddSection(false);
  };
  const handleDeleteSection = (sectionId) => {
    if (['monthly', 'one-time'].includes(sectionId)) return;
    const moved = bills.filter(b => b.type === sectionId);
    if (!window.confirm(`Delete this section?${moved.length ? ` Its ${moved.length} bill(s) will move to Monthly Bills.` : ''}`)) return;
    if (moved.length && onReorder) onReorder(bills.map(b => (b.type === sectionId ? { ...b, type: 'monthly' } : b)));
    updateSections(activeSections.filter(s => s.id !== sectionId));
  };

  const statusBadge = (paidAmt, totalAmt) => {
    const st = getBillStatus(paidAmt, totalAmt);
    const map = {
      paid: { bg: 'rgba(16,185,129,0.12)', color: '#10b981', label: '✓ Paid' },
      partial: { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b', label: '◑ Partial' },
      pending: { bg: 'rgba(239,68,68,0.1)', color: '#ef4444', label: '● Pending' },
    };
    const s = map[st];
    return <span style={{ fontSize: 11, fontWeight: 700, borderRadius: 6, padding: '3px 10px', background: s.bg, color: s.color, whiteSpace: 'nowrap' }}>{s.label}</span>;
  };

  const cardStyle = { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: '18px 20px', boxShadow: 'var(--shadow)' };

  const formatMonth = fmtMonth;

  // Shared inline form fields (used by both Add at top and Edit under a row)
  const formFields = (form, setForm) => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 14 }}>
      <div>
        <div style={{ fontSize: 11, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 6, fontWeight: 600 }}>Bill Name *</div>
        <input className="form-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. House Rent, Gulraiz — Loan" />
      </div>
      <div>
        <div style={{ fontSize: 11, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 6, fontWeight: 600 }}>Amount (AED) *</div>
        <input className="form-input" type="number" min="0" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="0.00" />
      </div>
      <div>
        <div style={{ fontSize: 11, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 6, fontWeight: 600 }}>Section</div>
        <select className="form-select" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
          {activeSections.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
      </div>
      <div>
        <div style={{ fontSize: 11, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 6, fontWeight: 600 }}>Category</div>
        <select className="form-select" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
          {BILL_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      {form.type === 'one-time' && (
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 6, fontWeight: 600 }}>Month</div>
          <input className="form-input" type="month" value={form.month} onChange={e => setForm({ ...form, month: e.target.value })} />
        </div>
      )}
    </div>
  );

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Misc Payments</h1>
          <div style={{ fontSize: 13, color: 'var(--text-light)' }}>Regular bills &amp; expenses · deducted from net profit</div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            value={filterMonth}
            onChange={e => setFilterMonth(e.target.value)}
            className="form-select"
            style={{ padding: '9px 14px', fontSize: 13, fontWeight: 600 }}
          >
            {allMonths.map(m => (
              <option key={m} value={m}>{formatMonth(m)}{m === currentYM() ? ' (Current)' : ''}</option>
            ))}
          </select>
          {!isCurrentMonth && (
            <span style={{ fontSize: 11, fontWeight: 700, borderRadius: 6, padding: '4px 12px', background: 'rgba(99,102,241,0.12)', color: '#6366f1' }}>
              📅 Viewing History
            </span>
          )}
          <button
            onClick={exportCSV}
            disabled={filteredBills.length === 0}
            className="btn btn-ghost btn-md"
            title="Export this month to CSV"
          >
            <Icon name="download" size={14} /> CSV
          </button>
          {onViewLogs && (
            <button
              onClick={() => onViewLogs(null)}
              className="btn btn-ghost btn-md"
              title="Open Bill Logs — payment history by bill"
            >
              <Icon name="file-text" size={14} /> Bill Logs
            </button>
          )}
          <button
            onClick={() => { resetAddForm(); setShowAddForm(true); }}
            style={{ background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'inherit' }}
          >
            <Icon name="plus" size={14} /> Add Bill
          </button>
        </div>
      </div>

      {/* Month banner for history view */}
      {!isCurrentMonth && (
        <div style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(99,102,241,0.03))', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 12, padding: '12px 18px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 18 }}>📅</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#6366f1' }}>Viewing {formatMonth(filterMonth)}</div>
            <div style={{ fontSize: 12, color: 'var(--text-light)' }}>This is a historical record — payments are read-only. Switch to current month to make changes.</div>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 14, marginBottom: 28 }}>
        {[
          { label: 'Monthly Bills', val: monthlyTemplateTotal, color: '#ef4444' },
          { label: 'One-Time', val: oneTimeTotal, color: '#f59e0b' },
          { label: 'Total Amount', val: totalThisMonth, color: '#8b5cf6' },
          { label: 'Paid Amount', val: paidTotal, color: '#10b981' },
          { label: 'Pending Amount', val: pendingTotal, color: '#ef4444' },
        ].map(({ label, val, color }) => (
          <div key={label} style={cardStyle}>
            <div style={{ fontSize: 10, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 600, marginBottom: 8 }}>{label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color }}>AED {Number(val).toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
          </div>
        ))}
      </div>

      {/* Toggle bar — All | Personal | Company | House | Dues */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }} role="tablist" aria-label="Filter bills by group">
        {BILL_GROUPS.map(g => {
          const active = groupFilter === g;
          return (
            <button
              key={g}
              role="tab"
              aria-selected={active}
              onClick={() => setGroupFilter(g)}
              style={{
                padding: '8px 18px', borderRadius: 999, cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
                background: active ? 'var(--primary)' : 'var(--card)',
                color: active ? '#fff' : 'var(--text-mid)',
                border: active ? '1.5px solid var(--primary)' : '1.5px solid var(--border)',
                boxShadow: active ? 'var(--shadow)' : 'none',
              }}
            >
              {g} ({groupCounts[g]})
            </button>
          );
        })}
        {groupFilter !== 'All' && (
          <span style={{ alignSelf: 'center', fontSize: 12, color: 'var(--text-light)', marginLeft: 4 }}>
            Showing {filteredBills.length} of {monthBills.length} bills · totals above are for {groupFilter} only
          </span>
        )}
      </div>

      {/* Add Bill form (new bills only — editing happens inline under the row) */}
      {showAddForm && (
        <div style={{ background: 'var(--card)', border: '1.5px solid var(--primary)', borderRadius: 14, padding: 24, marginBottom: 24, boxShadow: 'var(--shadow-md)' }}>
          <div style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 18 }}>
            ➕ Add New Bill
          </div>
          {formFields(addForm, setAddForm)}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button onClick={resetAddForm} style={{ padding: '9px 20px', border: '1px solid var(--border)', borderRadius: 8, background: 'transparent', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>Cancel</button>
            <button onClick={handleAddSave} style={{ padding: '9px 20px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13, fontFamily: 'inherit' }}>
              Save Bill
            </button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {bills.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-light)', background: 'var(--card)', borderRadius: 16, border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🧾</div>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>No bills added yet</div>
          <div style={{ fontSize: 13 }}>Add your recurring bills like rent, groceries, utilities to track and deduct from net profit.</div>
        </div>
      )}

      {/* Sections */}
      {activeSections.map(section => {
        const items = getBillsForSection(section.id);
        return (
          <div key={section.id} style={{ marginBottom: 24 }}
            onDragOver={e => e.preventDefault()}
            onDrop={e => handleDrop(e, section.id)}
          >
            {/* Section Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: '1px solid var(--border-light)', marginBottom: 10 }}>
              {editSectionId === section.id ? (
                <>
                  <input
                    autoFocus
                    value={editSectionLabel}
                    onChange={e => setEditSectionLabel(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveEditSection(); if (e.key === 'Escape') setEditSectionId(null); }}
                    style={{ fontSize: 12, fontWeight: 700, background: 'var(--input-bg)', border: '1px solid var(--primary)', borderRadius: 6, padding: '3px 10px', color: 'inherit', fontFamily: 'inherit', outline: 'none', width: 220 }}
                  />
                  <button onClick={saveEditSection} style={{ fontSize: 11, padding: '3px 10px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>Save</button>
                  <button onClick={() => setEditSectionId(null)} style={{ fontSize: 11, padding: '3px 10px', background: 'none', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit' }}>✕</button>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: 1.5, flex: 1 }}>{section.label}</div>
                  <button onClick={() => startEditSection(section)} title="Rename section" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-faint)', fontSize: 13, padding: '2px 6px' }}>✎</button>
                  {!['monthly', 'one-time'].includes(section.id) && (
                    <button onClick={() => handleDeleteSection(section.id)} title="Delete section" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-faint)', fontSize: 16, padding: '2px 6px', lineHeight: 1 }}>×</button>
                  )}
                </>
              )}
            </div>

            {/* Bill rows */}
            {items.length === 0 && (
              <div style={{ fontSize: 12, color: 'var(--text-faint)', padding: '10px 0 4px', fontStyle: 'italic' }}>No bills in this section</div>
            )}
            {items.map(bill => {
              const totalAmt = Number(bill.amount) || 0;
              const paidAmt = paidFor(bill.id);
              const pendingAmt = Math.max(0, totalAmt - paidAmt);
              const status = getBillStatus(paidAmt, totalAmt);
              const isDragTarget = dragOverBillId === bill.id && dragSectionId === section.id && dragBillId !== bill.id;
              const isEditingThisBill = editingBillId === bill.id;
              const isAddingPayment = paymentBillId === bill.id;
              const logCount = billLogsFor(billPaymentLogs, filterMonth, bill.id).length;

              return (
                <React.Fragment key={bill.id}>
                  <div
                    draggable={isCurrentMonth}
                    onDragStart={e => handleDragStart(e, bill.id, section.id)}
                    onDragOver={e => handleDragOver(e, bill.id)}
                    onDragEnd={() => { setDragBillId(null); setDragOverBillId(null); setDragSectionId(null); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
                      padding: '13px 16px', background: 'var(--card)',
                      border: isDragTarget ? `2px solid var(--primary)` : `1px solid ${status === 'paid' ? 'rgba(16,185,129,0.2)' : 'var(--border)'}`,
                      borderRadius: 12, marginBottom: isEditingThisBill || isAddingPayment ? 0 : 8,
                      borderBottomLeftRadius: isEditingThisBill || isAddingPayment ? 0 : 12,
                      borderBottomRightRadius: isEditingThisBill || isAddingPayment ? 0 : 12,
                      cursor: isCurrentMonth ? 'grab' : 'default',
                      transition: 'box-shadow 0.2s, opacity 0.2s',
                      opacity: dragBillId === bill.id ? 0.45 : 1,
                    }}
                    onMouseEnter={e => e.currentTarget.style.boxShadow = 'var(--shadow-md)'}
                    onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
                  >
                    {/* Drag handle */}
                    <div style={{ color: 'var(--text-faint)', fontSize: 16, flexShrink: 0, cursor: isCurrentMonth ? 'grab' : 'default', userSelect: 'none' }}>⠿</div>

                    <div style={{ flex: 1, minWidth: 180 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        {bill.name}
                        {statusBadge(paidAmt, totalAmt)}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-light)', marginTop: 4, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                        <span style={{ background: 'var(--border-light)', borderRadius: 4, padding: '1px 8px' }}>{normalizeBillCategory(bill.category)}</span>
                        {bill.type === 'one-time' && bill.month && (
                          <span style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b', borderRadius: 4, padding: '1px 8px', fontWeight: 600 }}>{formatMonth(bill.month)}</span>
                        )}
                        {paidAmt > 0 && paidAmt < totalAmt && (
                          <span style={{ color: '#f59e0b' }}>Paid AED {paidAmt.toLocaleString()} of {totalAmt.toLocaleString()}</span>
                        )}
                      </div>
                    </div>

                    {/* Total | Paid | Pending — always visible per bill */}
                    <div style={{ display: 'flex', gap: 16, flexShrink: 0, textAlign: 'right' }}>
                      <div>
                        <div style={{ fontSize: 10, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: 1 }}>Total</div>
                        <div style={{ fontWeight: 700, fontSize: 15, color: section.color }}>AED {totalAmt.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: 1 }}>Paid</div>
                        <div style={{ fontWeight: 700, fontSize: 15, color: '#10b981' }}>AED {paidAmt.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: 1 }}>Pending</div>
                        <div style={{ fontWeight: 700, fontSize: 15, color: pendingAmt > 0 ? '#ef4444' : '#10b981' }}>AED {pendingAmt.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div style={{ display: 'flex', gap: 5, flexShrink: 0, flexWrap: 'wrap' }}>
                      {onViewLogs && (
                        <button
                          onClick={() => onViewLogs(bill.id)}
                          title="Open this bill's payment history in Bill Logs"
                          style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', color: '#6366f1', fontSize: 11, fontWeight: 700, fontFamily: 'inherit', whiteSpace: 'nowrap' }}
                        >
                          Logs{logCount > 0 ? ` (${logCount})` : ''}
                        </button>
                      )}
                      {isCurrentMonth && status !== 'paid' && (
                        <>
                          <button
                            onClick={() => handleMarkPaid(bill)}
                            title="Mark as Fully Paid (adds a payment log for the remaining amount)"
                            style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', color: '#10b981', fontSize: 11, fontWeight: 700, fontFamily: 'inherit', whiteSpace: 'nowrap' }}
                          >
                            Mark Paid
                          </button>
                          <button
                            onClick={() => startAddPayment(bill)}
                            title="Record a partial payment (adds to Paid, keeps a log)"
                            style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', color: '#f59e0b', fontSize: 11, fontWeight: 700, fontFamily: 'inherit', whiteSpace: 'nowrap' }}
                          >
                            Partial
                          </button>
                        </>
                      )}
                      {isCurrentMonth && status === 'paid' && (
                        <button
                          onClick={() => handleMarkUnpaid(bill)}
                          title="Undo the last payment for this bill"
                          style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', color: '#ef4444', fontSize: 11, fontWeight: 700, fontFamily: 'inherit', whiteSpace: 'nowrap' }}
                        >
                          Undo
                        </button>
                      )}
                      {isCurrentMonth && (
                        <>
                          <button onClick={() => handleEdit(bill)} title="Edit this bill (inline, right here)" style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', color: 'var(--text-mid)', display: 'flex', alignItems: 'center' }}>
                            <Icon name="edit" size={12} />
                          </button>
                          <button onClick={() => { if (window.confirm(`Delete "${bill.name}"? Its payment logs will be removed too.`)) onDelete(bill.id); }} title="Delete" style={{ background: 'none', border: 'none', color: 'var(--text-faint)', cursor: 'pointer', padding: '5px 8px', fontSize: 18, lineHeight: 1 }}>×</button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Inline edit panel — directly under this bill's row */}
                  {isEditingThisBill && (
                    <div style={{ background: 'var(--card)', border: '1.5px solid var(--primary)', borderTop: 'none', borderRadius: '0 0 12px 12px', padding: '18px 20px', marginBottom: 8, boxShadow: 'var(--shadow-md)' }}>
                      <div style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 14 }}>
                        ✏️ Edit Bill — {bill.name}
                      </div>
                      {formFields(editForm, setEditForm)}
                      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                        <button onClick={() => setEditingBillId(null)} style={{ padding: '9px 20px', border: '1px solid var(--border)', borderRadius: 8, background: 'transparent', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>Cancel</button>
                        <button onClick={handleEditSave} style={{ padding: '9px 20px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13, fontFamily: 'inherit' }}>
                          Update Bill
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Inline partial-payment panel — directly under this bill's row */}
                  {isAddingPayment && (
                    <div style={{ background: 'var(--card)', border: '1.5px solid #f59e0b', borderTop: 'none', borderRadius: '0 0 12px 12px', padding: '18px 20px', marginBottom: 8, boxShadow: 'var(--shadow-md)' }}>
                      <div style={{ fontSize: 12, color: '#f59e0b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 6 }}>
                        💰 Record a Payment — {bill.name}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-light)', marginBottom: 14 }}>
                        This ADDS to Paid (AED {paidAmt.toLocaleString()} paid so far, AED {pendingAmt.toLocaleString()} still pending) and writes a log entry — it does not replace the paid total.
                      </div>
                      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 14 }}>
                        <div>
                          <div style={{ fontSize: 11, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 6, fontWeight: 600 }}>Amount (AED) *</div>
                          <input
                            autoFocus
                            className="form-input"
                            type="number" min="0" max={pendingAmt}
                            value={paymentAmount}
                            onChange={e => setPaymentAmount(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') saveAddPayment(bill); if (e.key === 'Escape') setPaymentBillId(null); }}
                            placeholder="0.00"
                            style={{ width: 160 }}
                          />
                        </div>
                        <div>
                          <div style={{ fontSize: 11, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 6, fontWeight: 600 }}>Payment Date</div>
                          <input className="form-input" type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} style={{ width: 170 }} />
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                        <button onClick={() => setPaymentBillId(null)} style={{ padding: '9px 20px', border: '1px solid var(--border)', borderRadius: 8, background: 'transparent', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>Cancel</button>
                        <button onClick={() => saveAddPayment(bill)} style={{ padding: '9px 20px', background: '#f59e0b', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13, fontFamily: 'inherit' }}>
                          Save Payment
                        </button>
                      </div>
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        );
      })}

      {/* Add Section */}
      {isCurrentMonth && (
        showAddSection ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8, marginBottom: 24 }}>
            <input
              autoFocus
              value={newSectionLabel}
              onChange={e => setNewSectionLabel(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAddSection(); if (e.key === 'Escape') setShowAddSection(false); }}
              placeholder="Section name e.g. 💼 Business Expenses"
              style={{ flex: 1, padding: '9px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--input-bg)', color: 'inherit', fontFamily: 'inherit', fontSize: 13, outline: 'none' }}
            />
            <button onClick={handleAddSection} style={{ padding: '9px 18px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13, fontFamily: 'inherit' }}>Add</button>
            <button onClick={() => setShowAddSection(false)} style={{ padding: '9px 14px', background: 'none', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>Cancel</button>
          </div>
        ) : (
          <button onClick={() => setShowAddSection(true)} style={{ marginTop: 4, marginBottom: 24, background: 'none', border: '1.5px dashed var(--border)', borderRadius: 10, padding: '10px 20px', cursor: 'pointer', color: 'var(--text-light)', fontSize: 13, fontFamily: 'inherit', width: '100%' }}>
            + Add New Section
          </button>
        )
      )}
    </div>
  );
}
