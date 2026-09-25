import React, { useMemo, useState } from 'react';
import Icon from './Icon';
import { Btn } from './UI';
import {
  EXPENSE_CATEGORIES, expenseCategory, expenseState, nextRenewalDate, CURRENCIES,
  today, fmtDate, fmtCurrency, fmtAED, toAED, daysBetween, downloadCSV,
} from '../utils/helpers';

const REPEATS = [
  { id: 'none', label: 'One-time' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'quarterly', label: 'Quarterly' },
  { id: 'yearly', label: 'Yearly' },
];

// One-click starting points for the most common entries
const TEMPLATES = [
  { title: 'Traffic fine', category: 'fine', repeat: 'none', authority: 'Dubai Police / RTA' },
  { title: 'Trade license renewal', category: 'license', repeat: 'yearly', authority: 'DED' },
  { title: 'Employee visa renewal', category: 'visa', repeat: 'none', authority: 'GDRFA / ICP' },
  { title: 'Vehicle registration', category: 'vehicle', repeat: 'yearly', authority: 'RTA' },
  { title: 'Insurance renewal', category: 'insurance', repeat: 'yearly' },
  { title: 'Ejari renewal', category: 'rent', repeat: 'yearly' },
  { title: 'VAT return payment', category: 'tax', repeat: 'quarterly', authority: 'FTA' },
  { title: 'Domain / hosting renewal', category: 'software', repeat: 'yearly' },
];

const EMPTY = {
  title: '', category: 'other', amount: '', currency: 'AED', dueDate: '', status: 'unpaid',
  paidDate: '', repeat: 'none', reference: '', authority: '', notes: '',
};

const STATE_STYLE = {
  overdue: { label: 'Overdue', cls: 'badge-red' },
  'due-soon': { label: 'Due soon', cls: 'badge-yellow' },
  upcoming: { label: 'Upcoming', cls: 'badge-blue' },
  unscheduled: { label: 'No due date', cls: 'badge-blue' },
  paid: { label: 'Paid', cls: 'badge-green' },
};

const TABS = [
  { id: 'open', label: 'To Pay' },
  { id: 'overdue', label: 'Overdue' },
  { id: 'paid', label: 'Paid' },
  { id: 'all', label: 'All' },
];

function dueText(exp, todayStr) {
  const st = expenseState(exp, todayStr);
  if (st === 'paid') return exp.paidDate ? `Paid ${fmtDate(exp.paidDate)}` : 'Paid';
  if (st === 'unscheduled') return 'No due date';
  const d = daysBetween(todayStr, exp.dueDate);
  if (d < 0) return `Overdue by ${-d} day${d === -1 ? '' : 's'} · ${fmtDate(exp.dueDate)}`;
  if (d === 0) return 'Due today';
  if (d === 1) return 'Due tomorrow';
  return `Due in ${d} days · ${fmtDate(exp.dueDate)}`;
}

export default function ExpensesView({ expenses = [], onSave, onNotify }) {
  const todayStr = today();
  const [tab, setTab] = useState('open');
  const [catFilter, setCatFilter] = useState('');
  const [q, setQ] = useState('');
  const [year, setYear] = useState(todayStr.slice(0, 4));
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(EMPTY);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // ── Summary ──
  const summary = useMemo(() => {
    const open = expenses.filter((e) => e.status !== 'paid');
    const overdue = open.filter((e) => expenseState(e, todayStr) === 'overdue');
    const soon = open.filter((e) => e.dueDate && e.dueDate >= todayStr && daysBetween(todayStr, e.dueDate) <= 30);
    const paidYear = expenses.filter((e) => e.status === 'paid' && (e.paidDate || '').startsWith(year));
    const sum = (list) => list.reduce((s, e) => s + toAED(e.amount, e.currency), 0);
    return {
      open: sum(open), openCount: open.length,
      overdue: sum(overdue), overdueCount: overdue.length,
      soon: sum(soon), soonCount: soon.length,
      paidYear: sum(paidYear), paidYearCount: paidYear.length,
      paidByCat: EXPENSE_CATEGORIES
        .map((c) => ({ ...c, total: sum(paidYear.filter((e) => e.category === c.id)) }))
        .filter((c) => c.total > 0)
        .sort((a, b) => b.total - a.total),
    };
  }, [expenses, todayStr, year]);

  const years = useMemo(() => {
    const ys = new Set([todayStr.slice(0, 4)]);
    expenses.forEach((e) => { if (e.paidDate) ys.add(e.paidDate.slice(0, 4)); });
    return [...ys].sort().reverse();
  }, [expenses, todayStr]);

  // ── Filtering ──
  const list = useMemo(() => {
    let l = expenses;
    if (tab === 'open') l = l.filter((e) => e.status !== 'paid');
    if (tab === 'overdue') l = l.filter((e) => expenseState(e, todayStr) === 'overdue');
    if (tab === 'paid') l = l.filter((e) => e.status === 'paid' && (e.paidDate || '').startsWith(year));
    if (catFilter) l = l.filter((e) => e.category === catFilter);
    if (q) {
      const s = q.toLowerCase();
      l = l.filter((e) => [e.title, e.reference, e.authority, e.notes].some((v) => (v || '').toLowerCase().includes(s)));
    }
    // To-pay: soonest due first (undated last). Paid: most recent first.
    return [...l].sort((a, b) => {
      if (tab === 'paid') return (b.paidDate || '').localeCompare(a.paidDate || '');
      if (a.status !== b.status) return a.status === 'paid' ? 1 : -1;
      return (a.dueDate || '9999').localeCompare(b.dueDate || '9999');
    });
  }, [expenses, tab, catFilter, q, year, todayStr]);

  const counts = {
    open: expenses.filter((e) => e.status !== 'paid').length,
    overdue: summary.overdueCount,
    paid: expenses.filter((e) => e.status === 'paid' && (e.paidDate || '').startsWith(year)).length,
    all: expenses.length,
  };

  // ── Actions ──
  const openAdd = (template) => {
    setForm({ ...EMPTY, ...(template || {}) });
    setEditId(null);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openEdit = (exp) => {
    setForm({ ...EMPTY, ...exp, amount: String(exp.amount ?? '') });
    setEditId(exp.id);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const closeForm = () => { setShowForm(false); setEditId(null); setForm(EMPTY); };

  // Paying a repeating expense schedules its next occurrence (once)
  const withRenewal = (list, exp) => {
    if (exp.status !== 'paid' || !exp.repeat || exp.repeat === 'none' || exp.renewedId) return { list, renewed: null };
    const base = exp.dueDate || exp.paidDate || todayStr;
    const next = {
      ...exp,
      id: `exp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      dueDate: nextRenewalDate(base, exp.repeat),
      status: 'unpaid',
      paidDate: '',
      renewedId: null,
      renewedFrom: exp.id,
      createdAt: new Date().toISOString(),
    };
    const marked = { ...exp, renewedId: next.id };
    return { list: [next, ...list.map((e) => (e.id === exp.id ? marked : e))], renewed: next };
  };

  const handleSubmit = () => {
    const amount = Number(form.amount);
    if (!form.title.trim()) return alert('Please enter what this expense is for.');
    if (!(amount > 0)) return alert('Please enter a valid amount.');

    const exp = {
      ...form,
      title: form.title.trim(),
      amount,
      paidDate: form.status === 'paid' ? (form.paidDate || todayStr) : '',
      id: editId || `exp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      createdAt: form.createdAt || new Date().toISOString(),
    };
    const next = editId ? expenses.map((e) => (e.id === editId ? exp : e)) : [exp, ...expenses];
    const { list: withNext, renewed } = withRenewal(next, exp);
    onSave(withNext);
    onNotify && onNotify(renewed
      ? `Saved. Next ${exp.repeat} renewal scheduled for ${fmtDate(renewed.dueDate)}`
      : editId ? 'Expense updated' : 'Expense added');
    closeForm();
  };

  const markPaid = (exp) => {
    const paid = { ...exp, status: 'paid', paidDate: todayStr };
    const { list: next, renewed } = withRenewal(expenses.map((e) => (e.id === exp.id ? paid : e)), paid);
    onSave(next);
    onNotify && onNotify(renewed ? `Marked paid. Next renewal due ${fmtDate(renewed.dueDate)}` : 'Marked as paid');
  };

  const markUnpaid = (exp) => {
    onSave(expenses.map((e) => (e.id === exp.id ? { ...e, status: 'unpaid', paidDate: '' } : e)));
  };

  const remove = (exp) => {
    if (!window.confirm(`Delete "${exp.title}"?`)) return;
    onSave(expenses.filter((e) => e.id !== exp.id));
    onNotify && onNotify('Expense deleted', 'error');
  };

  const exportCSV = () => {
    const rows = [['Title', 'Category', 'Amount', 'Currency', 'Amount (AED)', 'Due date', 'Status', 'Paid date', 'Repeats', 'Reference', 'Authority / Vendor', 'Notes']];
    list.forEach((e) => rows.push([
      e.title, expenseCategory(e.category).label, e.amount, e.currency, toAED(e.amount, e.currency).toFixed(2),
      e.dueDate || '', expenseState(e, todayStr), e.paidDate || '', e.repeat || 'none', e.reference || '', e.authority || '', e.notes || '',
    ]));
    downloadCSV(`expenses-${tab}-${todayStr}.csv`, rows);
  };

  return (
    <div className="animate-fade-in">
      <div className="page-head">
        <div>
          <h1 className="page-title">Expenses</h1>
          <p className="page-sub">Fines, renewals, government fees and other important one-off costs</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Btn variant="ghost" onClick={exportCSV} disabled={list.length === 0}><Icon name="download" size={14} /> CSV</Btn>
          <Btn onClick={() => openAdd()}><Icon name="plus" size={14} /> Add Expense</Btn>
        </div>
      </div>

      {/* Summary */}
      <div className="metric-grid">
        <button type="button" className={`kpi ${summary.overdueCount ? 'kpi-danger' : ''}`} onClick={() => setTab('overdue')}>
          <div className="kpi-head"><span className="kpi-icon"><Icon name="alert" size={16} /></span><span className="kpi-label">Overdue</span></div>
          <div className="kpi-value">{fmtAED(summary.overdue, 0)}</div>
          <div className="kpi-sub">{summary.overdueCount ? `${summary.overdueCount} past due. Pay these first` : 'Nothing overdue 🎉'}</div>
        </button>
        <button type="button" className="kpi kpi-warning" onClick={() => setTab('open')}>
          <div className="kpi-head"><span className="kpi-icon"><Icon name="calendar" size={16} /></span><span className="kpi-label">Due in 30 days</span></div>
          <div className="kpi-value">{fmtAED(summary.soon, 0)}</div>
          <div className="kpi-sub">{summary.soonCount} upcoming</div>
        </button>
        <button type="button" className="kpi kpi-info" onClick={() => setTab('open')}>
          <div className="kpi-head"><span className="kpi-icon"><Icon name="wallet" size={16} /></span><span className="kpi-label">Total to pay</span></div>
          <div className="kpi-value">{fmtAED(summary.open, 0)}</div>
          <div className="kpi-sub">{summary.openCount} unpaid</div>
        </button>
        <button type="button" className="kpi" onClick={() => setTab('paid')}>
          <div className="kpi-head"><span className="kpi-icon"><Icon name="check" size={16} /></span><span className="kpi-label">Paid in {year}</span></div>
          <div className="kpi-value">{fmtAED(summary.paidYear, 0)}</div>
          <div className="kpi-sub">{summary.paidYearCount} expense{summary.paidYearCount === 1 ? '' : 's'}</div>
        </button>
      </div>

      {/* Add / edit form */}
      {showForm && (
        <div className="section-card" style={{ border: '1.5px solid var(--primary)' }}>
          <h3 className="section-title">{editId ? 'Edit Expense' : 'New Expense'}</h3>

          {!editId && (
            <div style={{ marginBottom: 16 }}>
              <div className="form-label">Quick start</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {TEMPLATES.map((t) => (
                  <button key={t.title} type="button" className="chip-btn" onClick={() => setForm((f) => ({ ...f, ...t }))}>
                    {expenseCategory(t.category).emoji} {t.title}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="form-grid-3" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '0 14px' }}>
            <div className="form-group">
              <label className="form-label">What is it for? *</label>
              <input className="form-input" value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Speeding fine – Sheikh Zayed Rd" autoFocus />
            </div>
            <div className="form-group">
              <label className="form-label">Amount *</label>
              <input className="form-input" type="number" min="0" value={form.amount} onChange={(e) => set('amount', e.target.value)} placeholder="0.00" />
            </div>
            <div className="form-group">
              <label className="form-label">Currency</label>
              <select className="form-select" value={form.currency} onChange={(e) => set('currency', e.target.value)}>
                {CURRENCIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
          </div>

          <div className="form-grid-3" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0 14px' }}>
            <div className="form-group">
              <label className="form-label">Category</label>
              <select className="form-select" value={form.category} onChange={(e) => set('category', e.target.value)}>
                {EXPENSE_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Due date</label>
              <input className="form-input" type="date" value={form.dueDate} onChange={(e) => set('dueDate', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Repeats</label>
              <select className="form-select" value={form.repeat} onChange={(e) => set('repeat', e.target.value)}>
                {REPEATS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
              </select>
            </div>
          </div>

          <div className="form-grid-3" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0 14px' }}>
            <div className="form-group">
              <label className="form-label">Reference no.</label>
              <input className="form-input" value={form.reference} onChange={(e) => set('reference', e.target.value)} placeholder="Fine / license / plate no." />
            </div>
            <div className="form-group">
              <label className="form-label">Authority / Vendor</label>
              <input className="form-input" value={form.authority} onChange={(e) => set('authority', e.target.value)} placeholder="e.g. RTA, DED, Emirates NBD" />
            </div>
            <div className="form-group">
              <label className="form-label">Status</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {['unpaid', 'paid'].map((st) => (
                  <button
                    key={st} type="button"
                    className="chip-btn"
                    style={form.status === st ? { borderColor: 'var(--primary)', color: 'var(--primary)', background: 'var(--primary-soft)' } : undefined}
                    onClick={() => setForm((f) => ({ ...f, status: st, paidDate: st === 'paid' ? (f.paidDate || todayStr) : '' }))}
                  >
                    {st === 'paid' ? '✓ Paid' : 'Unpaid'}
                  </button>
                ))}
                {form.status === 'paid' && (
                  <input className="form-input" type="date" value={form.paidDate} onChange={(e) => set('paidDate', e.target.value)} style={{ padding: '6px 10px' }} title="Paid on" />
                )}
              </div>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea className="form-textarea" style={{ minHeight: 56 }} value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Who incurred it, which vehicle, payment method…" />
          </div>

          {form.repeat !== 'none' && (
            <div style={{ fontSize: 12, color: 'var(--info)', background: 'var(--info-soft)', borderRadius: 8, padding: '8px 12px', marginBottom: 14 }}>
              🔄 When you mark this paid, the next {form.repeat} renewal is scheduled automatically{form.dueDate ? ` for ${fmtDate(nextRenewalDate(form.dueDate, form.repeat))}` : ''}.
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <Btn variant="ghost" onClick={closeForm}>Cancel</Btn>
            <Btn onClick={handleSubmit}><Icon name="check" size={14} /> {editId ? 'Save Changes' : 'Add Expense'}</Btn>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="tab-bar">
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                background: 'none', border: 'none', padding: '10px 18px', marginBottom: -2, cursor: 'pointer', whiteSpace: 'nowrap',
                borderBottom: active ? '3px solid var(--primary)' : '3px solid transparent',
                fontFamily: 'Poppins, sans-serif', fontSize: 13, fontWeight: active ? 700 : 500,
                color: active ? 'var(--text)' : 'var(--text-light)', display: 'flex', alignItems: 'center', gap: 8,
              }}
            >
              {t.label}
              <span className={`nav-badge ${t.id === 'overdue' && counts.overdue ? '' : 'nav-badge-soft'}`}>{counts[t.id]}</span>
            </button>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ position: 'relative', flex: '1 1 220px', maxWidth: 320 }}>
          <input className="search-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title, reference, authority…" />
          <div className="search-icon"><Icon name="search" size={14} /></div>
        </div>
        <select className="form-select" style={{ width: 'auto' }} value={catFilter} onChange={(e) => setCatFilter(e.target.value)}>
          <option value="">All categories</option>
          {EXPENSE_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>)}
        </select>
        {tab === 'paid' && (
          <select className="form-select" style={{ width: 'auto' }} value={year} onChange={(e) => setYear(e.target.value)}>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        )}
      </div>

      <div className="dash-grid" style={{ gridTemplateColumns: summary.paidByCat.length ? '3fr 1fr' : '1fr' }}>
        {/* List */}
        <div>
          {list.length === 0 ? (
            <div className="card" style={{ padding: 48, textAlign: 'center', color: 'var(--text-light)' }}>
              <div style={{ fontSize: 34, marginBottom: 10 }}>{expenses.length === 0 ? '🧾' : '✅'}</div>
              <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
                {expenses.length === 0 ? 'No expenses recorded yet' : tab === 'overdue' ? 'Nothing overdue' : 'Nothing here'}
              </div>
              <div style={{ fontSize: 13, marginBottom: expenses.length === 0 ? 16 : 0 }}>
                {expenses.length === 0 ? 'Track fines, license and visa renewals, insurance and fees so nothing slips.' : 'Try another tab or filter.'}
              </div>
              {expenses.length === 0 && <Btn onClick={() => openAdd()}><Icon name="plus" size={14} /> Add your first expense</Btn>}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {list.map((e) => {
                const cat = expenseCategory(e.category);
                const st = expenseState(e, todayStr);
                const style = STATE_STYLE[st];
                return (
                  <div key={e.id} className="card expense-row" style={{ borderLeft: `3px solid ${st === 'overdue' ? 'var(--danger)' : st === 'due-soon' ? 'var(--warning)' : st === 'paid' ? 'var(--success)' : 'var(--border)'}` }}>
                    <div className="expense-emoji" title={cat.label}>{cat.emoji}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        {e.title}
                        <span className={`badge ${style.cls}`}>{style.label}</span>
                        {e.repeat && e.repeat !== 'none' && <span className="badge badge-blue">🔄 {e.repeat}</span>}
                      </div>
                      <div style={{ fontSize: 12, color: st === 'overdue' ? 'var(--danger)' : 'var(--text-light)', marginTop: 3, fontWeight: st === 'overdue' ? 600 : 400 }}>
                        {dueText(e, todayStr)}
                      </div>
                      {(e.reference || e.authority || e.notes) && (
                        <div style={{ fontSize: 11, color: 'var(--text-light)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={e.notes}>
                          {[cat.label, e.authority, e.reference && `Ref ${e.reference}`, e.notes].filter(Boolean).join(' · ')}
                        </div>
                      )}
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div className="num" style={{ fontWeight: 700, fontSize: 15 }}>{fmtCurrency(e.amount, e.currency)}</div>
                      {e.currency !== 'AED' && <div style={{ fontSize: 11, color: 'var(--text-light)' }}>≈ {fmtAED(toAED(e.amount, e.currency), 0)}</div>}
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      {e.status !== 'paid'
                        ? <button className="chip-btn chip-success" style={{ marginRight: 0 }} onClick={() => markPaid(e)}>✓ Mark paid</button>
                        : <button className="chip-btn" onClick={() => markUnpaid(e)} title="Mark as unpaid">Undo</button>}
                      <Btn variant="ghost" size="sm" onClick={() => openEdit(e)} title="Edit"><Icon name="edit" size={12} /></Btn>
                      <Btn variant="danger" size="sm" onClick={() => remove(e)} title="Delete"><Icon name="trash" size={12} /></Btn>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Where the money went */}
        {summary.paidByCat.length > 0 && (
          <div className="card dash-panel" style={{ alignSelf: 'start' }}>
            <div className="panel-title">Paid in {year} by category</div>
            <div className="panel-sub" style={{ marginBottom: 14 }}>Converted to AED</div>
            {summary.paidByCat.map((c) => (
              <div key={c.id} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4, gap: 8 }}>
                  <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.emoji} {c.label}</span>
                  <span className="num" style={{ color: 'var(--text-mid)' }}>{fmtAED(c.total, 0)}</span>
                </div>
                <div className="meter"><div style={{ width: `${(c.total / summary.paidYear) * 100}%` }} /></div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
