import React, { useState } from 'react';
import Icon from './Icon';

const CATEGORIES = ['Personal', 'Private', 'Business', 'Other'];

function currentYM() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const DEFAULT_SECTIONS = [
  { id: 'monthly', label: '🔄 Monthly Bills', color: '#ef4444' },
  { id: 'one-time', label: '📌 One-Time Expense', color: '#f59e0b' },
];

const EMPTY_FORM = { name: '', amount: '', type: 'monthly', category: 'Other', month: currentYM() };

// billPayments: { "YYYY-MM": { "bill-id": paidAmount } }
function getPaidForMonth(billPayments, month, billId) {
  return Number((billPayments[month] || {})[billId]) || 0;
}

function getBillStatus(paidAmt, totalAmt) {
  if (paidAmt <= 0) return 'pending';
  if (paidAmt >= totalAmt) return 'paid';
  return 'partial';
}

export default function BillsView({
  bills = [],
  sections: propSections = [],
  billPayments = {},
  onUpdateSections,
  onAdd,
  onUpdate,
  onDelete,
  onReorder,
  onPaymentUpdate,
}) {
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [filterMonth, setFilterMonth] = useState(currentYM());
  const [editSectionId, setEditSectionId] = useState(null);
  const [editSectionLabel, setEditSectionLabel] = useState('');
  const [showAddSection, setShowAddSection] = useState(false);
  const [newSectionLabel, setNewSectionLabel] = useState('');
  const [dragBillId, setDragBillId] = useState(null);
  const [dragOverBillId, setDragOverBillId] = useState(null);
  const [dragSectionId, setDragSectionId] = useState(null);
  // Inline partial payment editor
  const [editingPaymentId, setEditingPaymentId] = useState(null);
  const [paymentDraft, setPaymentDraft] = useState('');

  const isCurrentMonth = filterMonth === currentYM();

  // Sections fallback
  let activeSections = propSections;
  if (!activeSections || activeSections.length === 0) {
    try {
      const s = localStorage.getItem('misc_bill_sections');
      activeSections = s ? JSON.parse(s) : DEFAULT_SECTIONS;
      if (onUpdateSections) onUpdateSections(activeSections);
    } catch {
      activeSections = DEFAULT_SECTIONS;
    }
  }

  const updateSections = (ns) => {
    if (onUpdateSections) onUpdateSections(ns);
    try { localStorage.setItem('misc_bill_sections', JSON.stringify(ns)); } catch (e) {}
  };

  // Build allMonths: current month + any month that has payments recorded
  const allMonths = [...new Set([
    currentYM(),
    ...Object.keys(billPayments),
    // also months from one-time bills
    ...bills.filter(b => b.type === 'one-time' && b.month).map(b => b.month),
  ])].sort().reverse();

  const getBillsForSection = (sectionId) => {
    const filtered = sectionId === 'one-time'
      ? bills.filter(b => b.type === 'one-time' && b.month === filterMonth)
      : bills.filter(b => b.type === sectionId);
    return [...filtered].sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999));
  };

  // Totals — monthly bills always counted, one-time only for the selected month
  const monthlyTemplateTotal = bills.filter(b => b.type === 'monthly').reduce((s, b) => s + (Number(b.amount) || 0), 0);
  const oneTimeTotal = bills.filter(b => b.type === 'one-time' && b.month === filterMonth).reduce((s, b) => s + (Number(b.amount) || 0), 0);
  const customTotal = activeSections.filter(s => !['monthly', 'one-time'].includes(s.id))
    .reduce((sum, s) => sum + bills.filter(b => b.type === s.id).reduce((ss, b) => ss + (Number(b.amount) || 0), 0), 0);
  const totalThisMonth = monthlyTemplateTotal + oneTimeTotal + customTotal;

  // Paid / pending derived from billPayments for the selected month
  const monthPayments = billPayments[filterMonth] || {};
  const paidTotal = bills.reduce((s, b) => {
    const paid = getPaidForMonth(billPayments, filterMonth, b.id);
    return s + Math.min(paid, Number(b.amount) || 0);
  }, 0);
  const pendingTotal = totalThisMonth - paidTotal;

  const resetForm = () => { setForm(EMPTY_FORM); setEditId(null); setShowForm(false); };

  const handleSave = () => {
    if (!form.name.trim()) return alert('Bill name is required.');
    if (!form.amount || Number(form.amount) <= 0) return alert('Please enter a valid amount.');
    const payload = { ...form, amount: Number(form.amount) };
    // Remove any paidAmount that might have been on old records
    delete payload.paidAmount;
    if (editId) {
      onUpdate(editId, payload);
    } else {
      onAdd({
        ...payload,
        order: getBillsForSection(form.type).length,
        id: `bill-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        createdAt: new Date().toISOString(),
      });
    }
    resetForm();
  };

  const handleEdit = (bill) => {
    setForm({ name: bill.name, amount: bill.amount, type: bill.type, category: bill.category || 'Other', month: bill.month || currentYM() });
    setEditId(bill.id);
    setShowForm(true);
  };

  const handleMarkPaid = (bill) => {
    if (!isCurrentMonth) return;
    onPaymentUpdate(filterMonth, bill.id, Number(bill.amount));
  };

  const handleMarkUnpaid = (bill) => {
    if (!isCurrentMonth) return;
    onPaymentUpdate(filterMonth, bill.id, 0);
  };

  const startEditPayment = (bill) => {
    if (!isCurrentMonth) return;
    const current = getPaidForMonth(billPayments, filterMonth, bill.id);
    setPaymentDraft(current > 0 ? String(current) : '');
    setEditingPaymentId(bill.id);
  };

  const savePaymentDraft = (bill) => {
    const val = Number(paymentDraft) || 0;
    onPaymentUpdate(filterMonth, bill.id, val);
    setEditingPaymentId(null);
    setPaymentDraft('');
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
    if (window.confirm('Delete this section? Bills in it won\'t be lost.')) updateSections(activeSections.filter(s => s.id !== sectionId));
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

  // Format month label nicely e.g. "2026-08" → "Aug 2026"
  const formatMonth = (ym) => {
    const [y, m] = ym.split('-');
    return new Date(Number(y), Number(m) - 1).toLocaleString('default', { month: 'short', year: 'numeric' });
  };

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
            onClick={() => { resetForm(); setShowForm(true); }}
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

      {/* Add / Edit Form */}
      {showForm && (
        <div style={{ background: 'var(--card)', border: '1.5px solid var(--primary)', borderRadius: 14, padding: 24, marginBottom: 24, boxShadow: 'var(--shadow-md)' }}>
          <div style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 18 }}>
            {editId ? '✏️ Edit Bill' : '➕ Add New Bill'}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 6, fontWeight: 600 }}>Bill Name *</div>
              <input className="form-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. House Rent, Grocery" />
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
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            {form.type === 'one-time' && (
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 6, fontWeight: 600 }}>Month</div>
                <input className="form-input" type="month" value={form.month} onChange={e => setForm({ ...form, month: e.target.value })} />
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button onClick={resetForm} style={{ padding: '9px 20px', border: '1px solid var(--border)', borderRadius: 8, background: 'transparent', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>Cancel</button>
            <button onClick={handleSave} style={{ padding: '9px 20px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13, fontFamily: 'inherit' }}>
              {editId ? 'Update Bill' : 'Save Bill'}
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
              const paidAmt = getPaidForMonth(billPayments, filterMonth, bill.id);
              const status = getBillStatus(paidAmt, totalAmt);
              const isDragTarget = dragOverBillId === bill.id && dragSectionId === section.id && dragBillId !== bill.id;
              const isEditingThisPayment = editingPaymentId === bill.id;

              return (
                <div
                  key={bill.id}
                  draggable={isCurrentMonth}
                  onDragStart={e => handleDragStart(e, bill.id, section.id)}
                  onDragOver={e => handleDragOver(e, bill.id)}
                  onDragEnd={() => { setDragBillId(null); setDragOverBillId(null); setDragSectionId(null); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '13px 16px', background: 'var(--card)',
                    border: isDragTarget ? `2px solid var(--primary)` : `1px solid ${status === 'paid' ? 'rgba(16,185,129,0.2)' : 'var(--border)'}`,
                    borderRadius: 12, marginBottom: 8,
                    cursor: isCurrentMonth ? 'grab' : 'default',
                    transition: 'box-shadow 0.2s, opacity 0.2s',
                    opacity: dragBillId === bill.id ? 0.45 : 1,
                  }}
                  onMouseEnter={e => e.currentTarget.style.boxShadow = 'var(--shadow-md)'}
                  onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
                >
                  {/* Drag handle */}
                  <div style={{ color: 'var(--text-faint)', fontSize: 16, flexShrink: 0, cursor: isCurrentMonth ? 'grab' : 'default', userSelect: 'none' }}>⠿</div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      {bill.name}
                      {statusBadge(paidAmt, totalAmt)}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-light)', marginTop: 4, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                      <span style={{ background: 'var(--border-light)', borderRadius: 4, padding: '1px 8px' }}>{bill.category || 'Other'}</span>
                      {bill.type === 'one-time' && bill.month && (
                        <span style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b', borderRadius: 4, padding: '1px 8px', fontWeight: 600 }}>{formatMonth(bill.month)}</span>
                      )}
                      {paidAmt > 0 && paidAmt < totalAmt && (
                        <span style={{ color: '#f59e0b' }}>Paid AED {paidAmt.toLocaleString()} of {totalAmt.toLocaleString()}</span>
                      )}
                    </div>
                  </div>

                  {/* Inline partial payment editor */}
                  {isEditingThisPayment ? (
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                      <input
                        autoFocus
                        type="number"
                        min="0"
                        max={totalAmt}
                        value={paymentDraft}
                        onChange={e => setPaymentDraft(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') savePaymentDraft(bill); if (e.key === 'Escape') setEditingPaymentId(null); }}
                        style={{ width: 100, padding: '5px 10px', borderRadius: 6, border: '1.5px solid var(--primary)', background: 'var(--input-bg)', color: 'inherit', fontFamily: 'inherit', fontSize: 13, outline: 'none' }}
                        placeholder="0.00"
                      />
                      <button onClick={() => savePaymentDraft(bill)} style={{ padding: '5px 10px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'inherit' }}>✓</button>
                      <button onClick={() => setEditingPaymentId(null)} style={{ padding: '5px 8px', background: 'none', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>✕</button>
                    </div>
                  ) : (
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 15, color: section.color }}>AED {totalAmt.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                      {paidAmt > 0 && (
                        <div style={{ fontSize: 11, color: '#10b981', marginTop: 2 }}>✓ Paid AED {paidAmt.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                      )}
                    </div>
                  )}

                  {/* Action buttons */}
                  {!isEditingThisPayment && (
                    <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                      {isCurrentMonth && status !== 'paid' && (
                        <>
                          <button
                            onClick={() => handleMarkPaid(bill)}
                            title="Mark as Fully Paid"
                            style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', color: '#10b981', fontSize: 11, fontWeight: 700, fontFamily: 'inherit', whiteSpace: 'nowrap' }}
                          >
                            Mark Paid
                          </button>
                          <button
                            onClick={() => startEditPayment(bill)}
                            title="Enter partial payment"
                            style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', color: '#f59e0b', fontSize: 11, fontWeight: 700, fontFamily: 'inherit', whiteSpace: 'nowrap' }}
                          >
                            Partial
                          </button>
                        </>
                      )}
                      {isCurrentMonth && status === 'paid' && (
                        <button
                          onClick={() => handleMarkUnpaid(bill)}
                          title="Mark as Unpaid"
                          style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', color: '#ef4444', fontSize: 11, fontWeight: 700, fontFamily: 'inherit', whiteSpace: 'nowrap' }}
                        >
                          Undo
                        </button>
                      )}
                      {isCurrentMonth && (
                        <>
                          <button onClick={() => handleEdit(bill)} title="Edit" style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', color: 'var(--text-mid)', display: 'flex', alignItems: 'center' }}>
                            <Icon name="edit" size={12} />
                          </button>
                          <button onClick={() => { if (window.confirm(`Delete "${bill.name}"?`)) onDelete(bill.id); }} title="Delete" style={{ background: 'none', border: 'none', color: 'var(--text-faint)', cursor: 'pointer', padding: '5px 8px', fontSize: 18, lineHeight: 1 }}>×</button>
                        </>
                      )}
                    </div>
                  )}
                </div>
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
