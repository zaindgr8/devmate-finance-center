import React, { useState, useMemo } from 'react';
import Icon from './Icon';
import { Btn, Input, TextArea, Select } from './UI';
import { today, fmtCurrency, CURRENCIES, nowLocalDateTime, localDateStr } from '../utils/helpers';

// Due date = invoice date + N days
const plusDays = (dateStr, n) => {
  const d = new Date(`${dateStr || today()}T00:00:00`);
  d.setDate(d.getDate() + n);
  return localDateStr(d);
};

export default function InvoiceForm({ clients, finance, employees = [], editInv, draftInv, onSave, onCancel }) {
  const [clientSearch, setClientSearch] = useState('');
  const [showSug, setShowSug] = useState(false);
  const empty = { description: '', qty: 1, rate: 0 };
  const dflt = {
    clientName: '', clientDesignation: '', businessName: '', clientEmail: '',
    clientPhone: '', clientAddress: '', paymentLink: '', date: today(),
    dueDate: '', currency: 'AED', items: [{ ...empty }], payingNow: 0,
    specialNotes: '', status: 'pending', projectName: '',
  };
  const seed = editInv || draftInv;
  const [form, setForm] = useState(seed ? { ...dflt, ...seed } : dflt);
  const [paymentConfirmed, setPaymentConfirmed] = useState(editInv && editInv.status !== 'pending' && editInv.status !== 'scheduled');
  const [isScheduled, setIsScheduled] = useState(editInv?.status === 'scheduled');
  const [scheduledDate, setScheduledDate] = useState(editInv?.scheduledDate || '');

  // ── Finance state ──────────────────────────────────────────────
  const finDflt = { paymentType: 'project', salaries: [], allahShare: 0, saving: 0, _allahManual: false, ...(seed?.financeData || {}) };
  const [finData, setFinData] = useState(finDflt);
  const [showEmpSug, setShowEmpSug] = useState(null); // index of active salary row

  // Employee suggestions: active employees first, plus names used on past invoices
  const pastEmployees = useMemo(() => {
    const map = {};
    (finance || []).forEach((r) => (r.salaries || []).forEach((e) => {
      if (e.employee) map[e.employee] = e.amount;
    }));
    employees
      .filter((e) => e.name && (e.status === 'active' || !e.status))
      .forEach((e) => { if (!(e.name in map)) map[e.name] = Number(e.baseSalary) || 0; });
    return Object.entries(map).map(([employee, amount]) => ({ employee, amount }));
  }, [finance, employees]);

  const setFin = (k, v) => setFinData((f) => ({ ...f, [k]: v }));

  const totalSalaries = finData.salaries.reduce((s, e) => s + (Number(e.amount) || 0), 0);

  // auto-recalc allah share unless manually overridden
  const payingNow = Number(form.payingNow) || 0;
  const autoAllah = Math.max(0, (payingNow - totalSalaries) * 0.05);
  const allahShare = finData._allahManual ? finData.allahShare : autoAllah;

  const total = form.items.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.rate) || 0), 0);
  const rem = total - (Number(form.payingNow) || 0);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setItem = (i, k, v) => setForm((f) => ({ ...f, items: f.items.map((it, j) => (j === i ? { ...it, [k]: v } : it)) }));

  const selectClient = (c) => {
    setForm((f) => ({
      ...f, clientName: c.name, clientDesignation: c.designation || '',
      businessName: c.businessName || '', clientEmail: c.email || '',
      clientPhone: c.phone || '', clientAddress: c.address || '',
      paymentLink: c.paymentLink || '',
    }));
    setClientSearch(c.name);
    setShowSug(false);
  };

  const filtered = clients.filter((c) => c.name.toLowerCase().includes(clientSearch.toLowerCase()));

  const submit = () => {
    if (!form.clientName || !form.businessName || form.items.length === 0) {
      alert('Please fill client name, business name, and at least one item.');
      return;
    }
    if (total <= 0) {
      alert('Invoice total must be greater than zero. Check line item quantities and rates.');
      return;
    }
    if ((Number(form.payingNow) || 0) > total) {
      alert(`Paying amount (${fmtCurrency(form.payingNow, form.currency)}) is more than the invoice total (${fmtCurrency(total, form.currency)}).`);
      return;
    }
    // Scheduled invoice
    if (isScheduled) {
      if (!scheduledDate) { alert('Please select a scheduled date and time.'); return; }
      const schedTime = new Date(scheduledDate);
      if (schedTime <= new Date()) { alert('Scheduled date must be in the future.'); return; }
      const finRecord = { ...finData, salaries: finData.salaries.filter((e) => e.employee || e.amount), totalSalaries, allahShare, saving: Number(finData.saving) || 0 };
      onSave({ ...form, date: scheduledDate.split('T')[0], totalPayment: total, remaining: Math.max(0, rem), status: 'scheduled', scheduledDate, financeData: finRecord });
      return;
    }
    let st = 'unpaid';
    if (paymentConfirmed) {
      st = Number(form.payingNow) >= total ? 'paid' : Number(form.payingNow) > 0 ? 'partial' : 'unpaid';
    } else {
      st = 'pending';
    }
    const finRecord = {
      ...finData,
      salaries: finData.salaries.filter((e) => e.employee || e.amount),
      totalSalaries,
      allahShare,
      saving: Number(finData.saving) || 0,
    };
    onSave({ ...form, totalPayment: total, remaining: Math.max(0, rem), status: st, financeData: finRecord });
  };

  return (
    <div className="animate-fade-in" style={{ maxWidth: 780 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button onClick={onCancel} style={{ background: 'none', border: 'none', color: 'var(--text-light)', cursor: 'pointer' }}>
          <Icon name="back" />
        </button>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>
          {editInv ? `Edit #${editInv.invoiceNumber}` : draftInv?.items ? 'Duplicate Invoice' : draftInv?.clientName ? `New Invoice · ${draftInv.clientName}` : 'Create Invoice'}
        </h1>
      </div>

      {/* Client Details */}
      <div className="section-card">
        <h3 className="section-title">Client Details</h3>
        <div style={{ position: 'relative', marginBottom: 14 }}>
          <label className="form-label">Client Name *</label>
          <div style={{ position: 'relative' }}>
            <input
              className="form-input"
              style={{ paddingLeft: 36 }}
              value={clientSearch || form.clientName}
              onChange={(e) => { setClientSearch(e.target.value); set('clientName', e.target.value); setShowSug(true); }}
              onFocus={() => setShowSug(true)}
              placeholder="Search or enter client name..."
            />
            <div className="search-icon"><Icon name="search" size={14} /></div>
          </div>
          {showSug && filtered.length > 0 && (
            <div className="suggestion-dropdown">
              {filtered.map((c) => (
                <button key={c.name} onClick={() => selectClient(c)} className="suggestion-item">
                  <div style={{ fontWeight: 600 }}>{c.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-light)' }}>
                    {c.businessName}{c.designation ? ` · ${c.designation}` : ''}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
          <Input label="Designation" value={form.clientDesignation} onChange={(e) => set('clientDesignation', e.target.value)} placeholder="e.g. CEO, Director" />
          <Input label="Business Name *" value={form.businessName} onChange={(e) => set('businessName', e.target.value)} placeholder="Company name" />
          <Input label="Email" value={form.clientEmail} onChange={(e) => set('clientEmail', e.target.value)} placeholder="client@email.com" type="email" />
          <Input label="Phone" value={form.clientPhone} onChange={(e) => set('clientPhone', e.target.value)} placeholder="+971..." />
        </div>
        <Input label="Address" value={form.clientAddress} onChange={(e) => set('clientAddress', e.target.value)} placeholder="Business address" />
        <Input label="Payment Link" value={form.paymentLink} onChange={(e) => set('paymentLink', e.target.value)} placeholder="https://payment-link.com/..." />
        
        {/* Project Selection */}
        {(() => {
          const searchName = (form.clientName || '').toLowerCase().trim();
          const selectedClientObj = clients.find(c => (c.name || '').toLowerCase().trim() === searchName);
          const clientProjects = selectedClientObj?.projects || [];
          if (clientProjects.length > 0) {
            return (
              <div className="form-group" style={{ marginTop: 16 }}>
                <label className="form-label">Client Project</label>
                <select className="form-select" value={form.projectName || ''} onChange={(e) => set('projectName', e.target.value)}>
                  <option value="">-- No Project Selected --</option>
                  {clientProjects.map(p => (
                    <option key={p.id} value={p.name}>{p.name} (AED {Number(p.total).toLocaleString()})</option>
                  ))}
                </select>
              </div>
            );
          }
          return null;
        })()}
      </div>

      {/* Invoice Details */}
      <div className="section-card">
        <h3 className="section-title">Invoice Details</h3>
        <div className="form-grid-3" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0 16px' }}>
          <Input label="Invoice Date" type="date" value={form.date} onChange={(e) => set('date', e.target.value)} />
          <Input label="Due Date" type="date" value={form.dueDate} onChange={(e) => set('dueDate', e.target.value)} />
          <Select label="Currency" value={form.currency} onChange={(e) => set('currency', e.target.value)} options={CURRENCIES} />
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: -4 }}>
          <span className="form-label" style={{ marginBottom: 0, marginRight: 4 }}>Payment terms</span>
          {[['On receipt', 0], ['7 days', 7], ['15 days', 15], ['30 days', 30]].map(([label, n]) => {
            const val = n === 0 ? '' : plusDays(form.date, n);
            const active = (form.dueDate || '') === val;
            return (
              <button key={label} type="button" className="chip-btn" onClick={() => set('dueDate', val)}
                style={active ? { borderColor: 'var(--primary)', color: 'var(--primary)', background: 'var(--primary-soft)' } : undefined}>
                {label}
              </button>
            );
          })}
        </div>

        {/* Schedule Invoice Toggle */}
        <div style={{ marginTop: 18, padding: '14px 18px', borderRadius: 10, border: `1.5px solid ${isScheduled ? 'rgba(124,58,237,0.4)' : 'var(--border)'}`, background: isScheduled ? 'rgba(124,58,237,0.05)' : 'transparent', transition: 'all 0.2s' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13, color: isScheduled ? '#7c3aed' : 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 6 }}>🕐 Schedule Invoice for Later</div>
              <div style={{ fontSize: 11, color: 'var(--text-light)', marginTop: 2 }}>Invoice activates automatically at the scheduled time</div>
            </div>
            <button
              type="button"
              onClick={() => { setIsScheduled(!isScheduled); if (isScheduled) setScheduledDate(''); }}
              style={{ width: 44, height: 24, borderRadius: 12, border: 'none', position: 'relative', background: isScheduled ? '#7c3aed' : 'var(--border)', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0 }}
            >
              <div style={{ position: 'absolute', top: 2, left: isScheduled ? 22 : 2, width: 20, height: 20, background: '#fff', borderRadius: '50%', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
            </button>
          </div>
          {isScheduled && (
            <div style={{ marginTop: 14 }}>
              <label className="form-label">Activate On (Date & Time) *</label>
              <input
                type="datetime-local"
                className="form-input"
                value={scheduledDate}
                onChange={(e) => {
                  const val = e.target.value;
                  setScheduledDate(val);
                  if (val) {
                    set('date', val.split('T')[0]);
                  }
                }}
                min={nowLocalDateTime()}
              />
              <div style={{ marginTop: 8, fontSize: 12, color: '#7c3aed', background: 'rgba(124,58,237,0.08)', borderRadius: 6, padding: '6px 12px' }}>
                📅 This invoice will automatically switch to <strong>Pending Confirmation</strong> status at the scheduled time when the app is opened.
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Line Items */}
      <div className="section-card">
        <h3 className="section-title">Line Items</h3>
        {form.items.map((it, idx) => (
          <div key={idx} className="item-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 80px 120px 110px 40px', gap: 10, alignItems: 'end', marginBottom: 8 }}>
            <Input label={idx === 0 ? 'Description' : undefined} value={it.description} onChange={(e) => setItem(idx, 'description', e.target.value)} placeholder="Service description" />
            <Input label={idx === 0 ? 'Qty' : undefined} type="number" value={it.qty} onChange={(e) => setItem(idx, 'qty', e.target.value)} min="1" />
            <Input label={idx === 0 ? 'Rate' : undefined} type="number" value={it.rate} onChange={(e) => setItem(idx, 'rate', e.target.value)} min="0" />
            <div className="form-group">
              {idx === 0 && <label className="form-label">Amount</label>}
              <div className="num" style={{ padding: '10px 0', fontWeight: 600, fontSize: 13 }}>{fmtCurrency((Number(it.qty) || 0) * (Number(it.rate) || 0), form.currency)}</div>
            </div>
            <div className="form-group">
              {form.items.length > 1 && (
                <button
                  onClick={() => setForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== idx) }))}
                  className="btn btn-danger btn-sm"
                  style={{ width: 36, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
                >
                  <Icon name="trash" size={14} />
                </button>
              )}
            </div>
          </div>
        ))}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <Btn variant="ghost" size="sm" onClick={() => setForm((f) => ({ ...f, items: [...f.items, { ...empty }] }))}>
            <Icon name="plus" size={14} /> Add Item
          </Btn>
          <div style={{ fontSize: 13, color: 'var(--text-light)' }}>
            Total <b className="num" style={{ fontSize: 16, color: 'var(--text)', marginLeft: 8 }}>{fmtCurrency(total, form.currency)}</b>
          </div>
        </div>
      </div>

      {/* Payment Summary */}
      <div className="section-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 className="section-title" style={{ marginBottom: 0 }}>Payment Summary</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: paymentConfirmed ? 'var(--text-mid)' : 'var(--info)' }}>Pending</span>
            <button
              type="button"
              onClick={() => setPaymentConfirmed(!paymentConfirmed)}
              style={{
                width: 44, height: 24, borderRadius: 12, border: 'none', position: 'relative',
                background: paymentConfirmed ? 'var(--success)' : 'var(--border)',
                cursor: 'pointer', transition: 'background 0.2s'
              }}
            >
              <div style={{
                position: 'absolute', top: 2, left: paymentConfirmed ? 22 : 2, width: 20, height: 20,
                background: '#fff', borderRadius: '50%', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
              }} />
            </button>
            <span style={{ fontSize: 13, fontWeight: 600, color: paymentConfirmed ? 'var(--success)' : 'var(--text-mid)' }}>Confirmed</span>
          </div>
        </div>
        {!paymentConfirmed && (
          <div style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#3b82f6', display: 'flex', alignItems: 'center', gap: 8 }}>
            ℹ️ Invoice will be created as <strong>Pending Confirmation</strong>. Go to Invoices to confirm once payment is received.
          </div>
        )}
        <div className="form-grid-3" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
          <div>
            <div className="form-label">Total Invoice Amount</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--primary)' }}>{fmtCurrency(total, form.currency)}</div>
          </div>
          <div>
            <Input label="Invoice Amount (Paying)" type="number" value={form.payingNow} onChange={(e) => set('payingNow', e.target.value)} min="0" max={total} style={Number(form.payingNow) > total ? { borderColor: 'var(--danger)' } : undefined} />
            {total > 0 && Number(form.payingNow) !== total && (
              <button type="button" className="link-btn" style={{ marginTop: -8 }} onClick={() => set('payingNow', total)}>Use full amount</button>
            )}
          </div>
          <div>
            <div className="form-label">Remaining</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: rem > 0 ? 'var(--warning)' : 'var(--success)' }}>
              {fmtCurrency(Math.max(0, rem), form.currency)}
            </div>
          </div>
        </div>
      </div>

      {/* Notes */}
      <div className="section-card">
        <TextArea label="Special Notes" value={form.specialNotes} onChange={(e) => set('specialNotes', e.target.value)} placeholder="Payment terms, project milestones, additional notes..." />
      </div>

      {/* Finance Details */}
      <div className="section-card" style={{ borderTop: '3px solid var(--primary)' }}>
        <h3 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>💰 Finance Details <span style={{ fontWeight: 400, color: 'var(--text-light)', fontSize: 11, letterSpacing: 1 }}>(for your accounts ledger)</span></h3>

        {/* Payment type */}
        <div style={{ marginBottom: 18 }}>
          <div className="form-label" style={{ marginBottom: 8 }}>Payment Structure</div>
          <div style={{ display: 'flex', gap: 10 }}>
            {[{ val: 'project', label: '📦 Project (One-time)' }, { val: 'recurring', label: '🔄 Recurring (Monthly)' }].map(({ val, label }) => (
              <button
                key={val}
                type="button"
                onClick={() => setFin('paymentType', val)}
                style={{
                  padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'Poppins,sans-serif', transition: 'all 0.15s',
                  border: finData.paymentType === val ? '2px solid var(--primary)' : '1.5px solid var(--border)',
                  background: finData.paymentType === val ? 'var(--primary-soft)' : 'var(--input-bg)',
                  color: finData.paymentType === val ? 'var(--primary)' : 'var(--text-mid)',
                }}
              >
                {label}
              </button>
            ))}
          </div>
          {finData.paymentType === 'recurring' && (
            <div style={{ marginTop: 8, fontSize: 12, color: 'var(--info)', background: 'var(--info-soft)', borderRadius: 6, padding: '6px 12px' }}>
              ℹ️ This will auto-roll into next month's finance ledger on the 1st.
            </div>
          )}
          {finData.paymentType === 'project' && form.payingNow < total && (
            <div style={{ marginTop: 8, fontSize: 12, color: 'var(--warning)', background: 'var(--warning-soft)', borderRadius: 6, padding: '6px 12px' }}>
              ⚠️ Partial payment — unpaid portion will carry forward to next month.
            </div>
          )}
        </div>

        {/* Salaries */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div className="form-label" style={{ marginBottom: 0 }}>Salaries Paid This Month</div>
            <button
              type="button"
              onClick={() => setFin('salaries', [...finData.salaries, { employee: '', amount: '' }])}
              style={{ background: 'var(--primary-soft)', color: 'var(--primary)', border: 'none', borderRadius: 6, padding: '4px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'Poppins,sans-serif' }}
            >
              + Add Employee
            </button>
          </div>
          {finData.salaries.map((sal, idx) => {
            const filtered = pastEmployees.filter((e) => e.employee.toLowerCase().includes((sal.employee || '').toLowerCase()) && sal.employee);
            return (
              <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 140px 36px', gap: 8, marginBottom: 8, alignItems: 'end', position: 'relative' }}>
                <div style={{ position: 'relative' }}>
                  {idx === 0 && <div className="form-label">Employee Name</div>}
                  <input
                    className="form-input"
                    value={sal.employee}
                    placeholder="Employee name"
                    onChange={(e) => {
                      const s = finData.salaries.map((x, i) => i === idx ? { ...x, employee: e.target.value } : x);
                      setFin('salaries', s);
                      setShowEmpSug(idx);
                    }}
                    onFocus={() => setShowEmpSug(idx)}
                    onBlur={() => setTimeout(() => setShowEmpSug(null), 200)}
                    autoComplete="off"
                  />
                  {showEmpSug === idx && filtered.length > 0 && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.10)', marginTop: 2 }}>
                      {filtered.map((e) => (
                        <button
                          key={e.employee}
                          type="button"
                          onMouseDown={() => {
                            const s = finData.salaries.map((x, i) => i === idx ? { employee: e.employee, amount: e.amount } : x);
                            setFin('salaries', s);
                            setShowEmpSug(null);
                          }}
                          style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 14px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontFamily: 'Poppins,sans-serif', borderBottom: '1px solid var(--border-light)' }}
                        >
                          <span style={{ fontWeight: 600 }}>{e.employee}</span>
                          {Number(e.amount) > 0 && <span style={{ color: 'var(--text-light)', marginLeft: 8, fontSize: 12 }}>Last: AED {Number(e.amount).toLocaleString()}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  {idx === 0 && <div className="form-label">Amount</div>}
                  <input
                    className="form-input"
                    type="number"
                    value={sal.amount}
                    placeholder="0"
                    min="0"
                    onChange={(e) => {
                      const s = finData.salaries.map((x, i) => i === idx ? { ...x, amount: e.target.value } : x);
                      setFin('salaries', s);
                    }}
                  />
                </div>
                <div style={{ marginTop: idx === 0 ? 22 : 0 }}>
                  <button
                    type="button"
                    onClick={() => setFin('salaries', finData.salaries.filter((_, i) => i !== idx))}
                    style={{ width: 36, height: 38, background: '#FEF2F2', color: '#DC2626', border: 'none', borderRadius: 8, cursor: 'pointer' }}
                  >×</button>
                </div>
              </div>
            );
          })}
          {finData.salaries.length > 0 && (
            <div style={{ textAlign: 'right', fontSize: 13, fontWeight: 700, color: 'var(--warning)', marginTop: 4 }}>
              Total Salaries: {fmtCurrency(totalSalaries, form.currency)}
            </div>
          )}
        </div>

        {/* Allah Share & Saving */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <div className="form-label">Allah's Share <span style={{ fontWeight: 400, color: 'var(--text-faint)' }}>(auto: 5% of received − salaries)</span></div>
            <div style={{ position: 'relative' }}>
              <input
                className="form-input"
                type="number"
                value={finData._allahManual ? finData.allahShare : autoAllah.toFixed(2)}
                min="0"
                onChange={(e) => setFinData((f) => ({ ...f, allahShare: Number(e.target.value), _allahManual: true }))}
                style={{ paddingRight: finData._allahManual ? 80 : 14 }}
              />
              {finData._allahManual && (
                <button
                  type="button"
                  onClick={() => setFinData((f) => ({ ...f, _allahManual: false, allahShare: autoAllah }))}
                  style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: 'var(--info)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Poppins,sans-serif' }}
                >↺ reset</button>
              )}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-light)', marginTop: 4 }}>
              = ({fmtCurrency(payingNow, form.currency)} − {fmtCurrency(totalSalaries, form.currency)}) × 5%
            </div>
          </div>
          <Input
            label="Saving Amount"
            type="number"
            value={finData.saving}
            min="0"
            onChange={(e) => setFin('saving', e.target.value)}
            placeholder="0"
          />
        </div>

        {/* Profit preview */}
        <div style={{ marginTop: 18, background: 'var(--bg)', borderRadius: 10, padding: '14px 18px', display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
          {[
            { label: 'Received', val: payingNow, color: 'var(--info)' },
            { label: 'Salaries', val: -totalSalaries, color: 'var(--warning)' },
            { label: "Allah's Share", val: -allahShare, color: '#8B5CF6' },
            { label: 'Saving', val: -(Number(finData.saving) || 0), color: 'var(--success)' },
          ].map(({ label, val, color }) => (
            <div key={label}>
              <div style={{ fontSize: 10, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: 1.2, fontWeight: 600, marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: 15, fontWeight: 700, color }}>{val >= 0 ? '' : '−'}{fmtCurrency(Math.abs(val), form.currency)}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 10, textAlign: 'right' }}>
          <span style={{ fontSize: 12, color: 'var(--text-light)' }}>Net Profit: </span>
          <span style={{ fontSize: 18, fontWeight: 700, color: (payingNow - totalSalaries - allahShare - (Number(finData.saving) || 0)) >= 0 ? 'var(--success)' : 'var(--primary)' }}>
            {fmtCurrency(payingNow - totalSalaries - allahShare - (Number(finData.saving) || 0), form.currency)}
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <Btn variant="ghost" onClick={onCancel}>Cancel</Btn>
        <Btn onClick={submit}><Icon name="check" size={14} /> {editInv ? 'Update Invoice' : 'Create Invoice'}</Btn>
      </div>
    </div>
  );
}
