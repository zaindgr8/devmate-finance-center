import React, { useState, useMemo } from 'react';
import Icon from './Icon';
import { Btn, Input, TextArea, Select } from './UI';
import { today, fmtCurrency, CURRENCIES } from '../utils/helpers';

export default function InvoiceForm({ clients, finance, editInv, onSave, onCancel }) {
  const [clientSearch, setClientSearch] = useState('');
  const [showSug, setShowSug] = useState(false);
  const empty = { description: '', qty: 1, rate: 0 };
  const dflt = {
    clientName: '', clientDesignation: '', businessName: '', clientEmail: '',
    clientPhone: '', clientAddress: '', paymentLink: '', date: today(),
    dueDate: '', currency: 'USD', items: [{ ...empty }], payingNow: 0,
    specialNotes: '', status: 'unpaid',
  };
  const [form, setForm] = useState(editInv ? { ...dflt, ...editInv } : dflt);

  // ── Finance state ──────────────────────────────────────────────
  const finDflt = editInv?.financeData || { paymentType: 'project', salaries: [], allahShare: 0, saving: 0, _allahManual: false };
  const [finData, setFinData] = useState(finDflt);
  const [showEmpSug, setShowEmpSug] = useState(null); // index of active salary row

  // collect past employee names from finance records
  const pastEmployees = useMemo(() => {
    const records = finance || [];
    const map = {};
    records.forEach((r) => (r.salaries || []).forEach((e) => {
      if (e.employee) map[e.employee] = e.amount;
    }));
    return Object.entries(map).map(([employee, amount]) => ({ employee, amount }));
  }, []);

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
    const st = Number(form.payingNow) >= total ? 'paid' : Number(form.payingNow) > 0 ? 'partial' : 'unpaid';
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
          {editInv ? `Edit #${editInv.invoiceNumber}` : 'Create Invoice'}
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
      </div>

      {/* Invoice Details */}
      <div className="section-card">
        <h3 className="section-title">Invoice Details</h3>
        <div className="form-grid-3" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0 16px' }}>
          <Input label="Invoice Date" type="date" value={form.date} onChange={(e) => set('date', e.target.value)} />
          <Input label="Due Date" type="date" value={form.dueDate} onChange={(e) => set('dueDate', e.target.value)} />
          <Select label="Currency" value={form.currency} onChange={(e) => set('currency', e.target.value)} options={CURRENCIES} />
        </div>
      </div>

      {/* Line Items */}
      <div className="section-card">
        <h3 className="section-title">Line Items</h3>
        {form.items.map((it, idx) => (
          <div key={idx} className="item-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 80px 120px 40px', gap: 10, alignItems: 'end', marginBottom: 8 }}>
            <Input label={idx === 0 ? 'Description' : undefined} value={it.description} onChange={(e) => setItem(idx, 'description', e.target.value)} placeholder="Service description" />
            <Input label={idx === 0 ? 'Qty' : undefined} type="number" value={it.qty} onChange={(e) => setItem(idx, 'qty', e.target.value)} min="1" />
            <Input label={idx === 0 ? 'Rate' : undefined} type="number" value={it.rate} onChange={(e) => setItem(idx, 'rate', e.target.value)} min="0" />
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
        <Btn variant="ghost" size="sm" onClick={() => setForm((f) => ({ ...f, items: [...f.items, { ...empty }] }))}>
          <Icon name="plus" size={14} /> Add Item
        </Btn>
      </div>

      {/* Payment Summary */}
      <div className="section-card">
        <h3 className="section-title">Payment Summary</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
          <div>
            <div className="form-label">Total</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--primary)' }}>{fmtCurrency(total, form.currency)}</div>
          </div>
          <Input label="Paying Now" type="number" value={form.payingNow} onChange={(e) => set('payingNow', e.target.value)} min="0" max={total} />
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
                          <span style={{ color: 'var(--text-light)', marginLeft: 8, fontSize: 12 }}>Last: ${Number(e.amount).toLocaleString()}</span>
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
