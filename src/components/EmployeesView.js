import React, { useMemo, useState } from 'react';
import Icon from './Icon';
import { Btn, Avatar, Segmented, Drawer, Empty } from './UI';
import { currentYM, fmtMonth, fmtDate, fmtAED } from '../utils/helpers';

const DEPARTMENTS = ['Management', 'Web Development', 'App Development', 'Designing', 'Digital Marketing', 'BlockChain', 'AI', 'IOT'];

const EMPTY_EMP = {
  name: '', role: '', department: 'Management', email: '', phone: '', joinDate: '',
  status: 'active', notes: '', baseSalary: '', salaryType: 'monthly',
};

const STATUS = {
  active: { cls: 'badge-green', label: 'Active' },
  onleave: { cls: 'badge-yellow', label: 'On leave' },
  inactive: { cls: 'badge-red', label: 'Inactive' },
};

const isOpen = (s) => s.status !== 'paid' && s.status !== 'pushed';
const remainingOf = (s) => (isOpen(s) ? Math.max(0, (Number(s.totalSalary) || 0) - (Number(s.paidAmount) || 0)) : 0);
const statusFor = (total, paid) => (paid >= total && total > 0 ? 'paid' : paid > 0 ? 'partial' : 'unpaid');
const sameName = (a, b) => (a || '').trim().toLowerCase() === (b || '').trim().toLowerCase();
const waLink = (phone) => `https://wa.me/${String(phone || '').replace(/[^\d]/g, '')}`;

export default function EmployeesView({
  employees = [], salaries = [],
  onAdd, onUpdate, onDelete,
  onAddSalary, onUpdateSalary, onDeleteSalary,
}) {
  const thisMonth = currentYM();
  const [filter, setFilter] = useState('active');
  const [dept, setDept] = useState('');
  const [q, setQ] = useState('');
  const [profileId, setProfileId] = useState(null);
  const [form, setForm] = useState(null); // employee being added/edited
  const [payFor, setPayFor] = useState(null);
  const [payAmt, setPayAmt] = useState('');

  // Per-employee money facts (salaries are linked by name)
  const facts = useMemo(() => {
    const out = {};
    employees.forEach((e) => {
      const mine = salaries.filter((s) => sameName(s.employeeName, e.name));
      const due = mine.filter((s) => s.month <= thisMonth && remainingOf(s) > 0);
      out[e.id] = {
        salaries: mine,
        owed: due.reduce((a, s) => a + remainingOf(s), 0),
        dueItems: due,
        paidThisMonth: mine.filter((s) => s.month === thisMonth).reduce((a, s) => a + (Number(s.paidAmount) || 0), 0),
        paidYear: mine.filter((s) => (s.month || '').startsWith(thisMonth.slice(0, 4))).reduce((a, s) => a + (Number(s.paidAmount) || 0), 0),
        paidAll: mine.reduce((a, s) => a + (Number(s.paidAmount) || 0), 0),
      };
    });
    return out;
  }, [employees, salaries, thisMonth]);

  const isActive = (e) => e.status === 'active' || !e.status;
  const active = employees.filter(isActive);
  const stats = {
    team: active.length,
    payroll: active.reduce((a, e) => a + (Number(e.baseSalary) || 0), 0),
    owed: employees.reduce((a, e) => a + (facts[e.id]?.owed || 0), 0),
    owedPeople: employees.filter((e) => facts[e.id]?.owed > 0).length,
    paidThisMonth: employees.reduce((a, e) => a + (facts[e.id]?.paidThisMonth || 0), 0),
  };

  const counts = {
    active: active.length,
    owed: stats.owedPeople,
    inactive: employees.length - active.length,
    all: employees.length,
  };

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return employees
      .filter((e) => {
        if (filter === 'active' && !isActive(e)) return false;
        if (filter === 'inactive' && isActive(e)) return false;
        if (filter === 'owed' && !(facts[e.id]?.owed > 0)) return false;
        if (dept && e.department !== dept) return false;
        if (s && ![e.name, e.role, e.department, e.email, e.phone].some((v) => (v || '').toLowerCase().includes(s))) return false;
        return true;
      })
      .sort((a, b) => (facts[b.id]?.owed || 0) - (facts[a.id]?.owed || 0) || (a.name || '').localeCompare(b.name || ''));
  }, [employees, facts, filter, dept, q]);

  // Pay an employee: oldest outstanding items first
  const pay = (emp, amount) => {
    let left = Number(amount) || 0;
    if (left <= 0) return;
    const patches = [];
    [...(facts[emp.id]?.dueItems || [])].sort((a, b) => (a.month || '').localeCompare(b.month || '')).forEach((s) => {
      if (left <= 0) return;
      const add = Math.min(remainingOf(s), left);
      left -= add;
      const np = (Number(s.paidAmount) || 0) + add;
      patches.push({ id: s.id, patch: { paidAmount: np, status: statusFor(Number(s.totalSalary) || 0, np) } });
    });
    if (patches.length) onUpdateSalary(patches);
    setPayFor(null);
    setPayAmt('');
  };

  const profile = employees.find((e) => e.id === profileId);

  return (
    <div className="animate-fade-in">
      <div className="page-head">
        <div>
          <h1 className="page-title">Employees</h1>
          <p className="page-sub">Your team and what each person is owed</p>
        </div>
        <Btn onClick={() => setForm({ ...EMPTY_EMP })}><Icon name="plus" size={14} /> Add employee</Btn>
      </div>

      <div className="stat-strip">
        <div>
          <div className="stat-strip-label">Active team</div>
          <div className="stat-strip-value">{stats.team}</div>
          <div className="stat-strip-sub">{employees.length - stats.team} inactive / on leave</div>
        </div>
        <div>
          <div className="stat-strip-label">Monthly payroll</div>
          <div className="stat-strip-value">{fmtAED(stats.payroll, 0)}</div>
          <div className="stat-strip-sub">base salaries, active team</div>
        </div>
        <div>
          <div className="stat-strip-label">Owed now</div>
          <div className="stat-strip-value" style={{ color: stats.owed ? 'var(--warning)' : 'var(--text)' }}>{fmtAED(stats.owed, 0)}</div>
          <div className="stat-strip-sub">{stats.owedPeople} {stats.owedPeople === 1 ? 'person' : 'people'}</div>
        </div>
        <div>
          <div className="stat-strip-label">Paid this month</div>
          <div className="stat-strip-value" style={{ color: 'var(--success)' }}>{fmtAED(stats.paidThisMonth, 0)}</div>
          <div className="stat-strip-sub">{fmtMonth(thisMonth)}</div>
        </div>
      </div>

      <div className="toolbar">
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'active', label: 'Active', count: counts.active },
            { value: 'owed', label: 'Owed money', count: counts.owed },
            { value: 'inactive', label: 'Inactive', count: counts.inactive },
            { value: 'all', label: 'All', count: counts.all },
          ]}
        />
        <select className="form-select" style={{ width: 'auto' }} value={dept} onChange={(e) => setDept(e.target.value)} aria-label="Department">
          <option value="">All departments</option>
          {[...new Set([...DEPARTMENTS, ...employees.map((e) => e.department).filter(Boolean)])].map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <div className="search-wrap">
          <input className="search-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, role, phone…" />
          <div className="search-icon"><Icon name="search" size={14} /></div>
        </div>
      </div>

      <div className="list">
        {list.length === 0 ? (
          <Empty
            icon={employees.length ? (filter === 'owed' ? '🎉' : '🔍') : '👥'}
            title={employees.length ? (filter === 'owed' ? 'Nobody is owed anything' : 'No matches') : 'No employees yet'}
            text={employees.length ? 'Try another filter or search.' : 'Add your team to track salaries and payouts.'}
            action={!employees.length && <Btn size="sm" onClick={() => setForm({ ...EMPTY_EMP })}>+ Add employee</Btn>}
          />
        ) : list.map((e) => {
          const f = facts[e.id] || {};
          const st = STATUS[e.status] || STATUS.active;
          return (
            <div key={e.id} className="list-row clickable" onClick={() => setProfileId(e.id)}>
              <Avatar name={e.name} size={40} />
              <div className="row-main">
                <div className="row-title">
                  {e.name}
                  {!isActive(e) && <span className={`badge ${st.cls}`}>{st.label}</span>}
                </div>
                <div className="row-sub">{[e.role, e.department].filter(Boolean).join(' · ') || 'No role set'}</div>
              </div>
              <div className="row-amount hide-sm" style={{ minWidth: 120 }}>
                <div className="row-amount-main" style={{ fontWeight: 600, color: 'var(--text-mid)' }}>{Number(e.baseSalary) ? fmtAED(e.baseSalary, 0) : '—'}</div>
                <div className="row-amount-sub">{e.salaryType === 'project' ? 'per project' : 'per month'}</div>
              </div>
              <div className="row-amount" style={{ minWidth: 130 }}>
                {f.owed > 0 ? (
                  <>
                    <div className="row-amount-main" style={{ color: 'var(--warning)' }}>{fmtAED(f.owed, 0)}</div>
                    <div className="row-amount-sub">owed · {f.dueItems.length} item{f.dueItems.length === 1 ? '' : 's'}</div>
                  </>
                ) : (
                  <div className="row-amount-sub" style={{ color: 'var(--success)', fontWeight: 600 }}>✓ Up to date</div>
                )}
              </div>
              <div className="row-actions" style={{ minWidth: 72, justifyContent: 'flex-end' }} onClick={(ev) => ev.stopPropagation()}>
                {payFor === e.id ? (
                  <div className="pay-inline">
                    <input autoFocus type="number" className="form-input" value={payAmt} onChange={(ev) => setPayAmt(ev.target.value)}
                      onKeyDown={(ev) => { if (ev.key === 'Enter') pay(e, payAmt); if (ev.key === 'Escape') setPayFor(null); }} aria-label={`Amount to pay ${e.name}`} />
                    <Btn size="sm" variant="success" onClick={() => pay(e, payAmt)}>Pay</Btn>
                    <button className="icon-btn" onClick={() => setPayFor(null)} aria-label="Cancel">✕</button>
                  </div>
                ) : f.owed > 0 ? (
                  <Btn size="sm" onClick={() => { setPayFor(e.id); setPayAmt(String(f.owed)); }}>Pay</Btn>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {profile && (
        <EmployeeProfile
          key={profile.id}
          emp={profile}
          facts={facts[profile.id] || {}}
          thisMonth={thisMonth}
          onClose={() => setProfileId(null)}
          onEdit={() => setForm({ ...EMPTY_EMP, ...profile, baseSalary: profile.baseSalary ?? '' })}
          onDelete={() => { if (window.confirm(`Remove ${profile.name}? Their salary records are kept.`)) { onDelete(profile.id); setProfileId(null); } }}
          onPay={(amt) => pay(profile, amt)}
          onAddSalary={onAddSalary}
          onUpdateSalary={onUpdateSalary}
          onDeleteSalary={onDeleteSalary}
        />
      )}

      {form && (
        <EmployeeForm
          key={form.id || 'new'}
          initial={form}
          employees={employees}
          onClose={() => setForm(null)}
          onSave={(emp) => {
            if (form.id) onUpdate(emp.id, emp); else onAdd(emp);
            setForm(null);
          }}
        />
      )}
    </div>
  );
}

function EmployeeProfile({ emp, facts, thisMonth, onClose, onEdit, onDelete, onPay, onAddSalary, onUpdateSalary, onDeleteSalary }) {
  const [amt, setAmt] = useState(facts.owed ? String(facts.owed) : '');
  const [adding, setAdding] = useState(false);
  const [newSal, setNewSal] = useState({ projectName: '', salaryType: emp.salaryType || 'monthly', totalSalary: emp.baseSalary ? String(emp.baseSalary) : '', month: thisMonth });

  const byMonth = useMemo(() => {
    const m = {};
    (facts.salaries || []).forEach((s) => { (m[s.month || 'Unknown'] = m[s.month || 'Unknown'] || []).push(s); });
    return Object.entries(m).sort((a, b) => b[0].localeCompare(a[0]));
  }, [facts.salaries]);

  const saveNew = () => {
    const total = Number(newSal.totalSalary) || 0;
    if (total <= 0) return alert('Enter an amount.');
    onAddSalary({
      id: `sal-${Date.now()}`,
      employeeName: emp.name,
      projectName: newSal.projectName,
      salaryType: newSal.salaryType,
      totalSalary: total,
      paidAmount: 0,
      status: 'unpaid',
      month: newSal.month || thisMonth,
      createdAt: new Date().toISOString(),
    });
    setAdding(false);
    setNewSal((n) => ({ ...n, projectName: '' }));
  };

  const st = STATUS[emp.status] || STATUS.active;

  return (
    <Drawer
      open
      onClose={onClose}
      width={520}
      title={<div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><Avatar name={emp.name} size={44} /><div><div>{emp.name}</div><div className="drawer-sub">{[emp.role, emp.department].filter(Boolean).join(' · ')}</div></div></div>}
      footer={<>
        <Btn variant="danger" onClick={onDelete} style={{ marginRight: 'auto' }}><Icon name="trash" size={13} /> Remove</Btn>
        <Btn variant="ghost" onClick={onEdit}><Icon name="edit" size={13} /> Edit details</Btn>
      </>}
    >
      <div className="stat-strip" style={{ marginBottom: 18 }}>
        <div>
          <div className="stat-strip-label">Owed now</div>
          <div className="stat-strip-value" style={{ fontSize: 17, color: facts.owed ? 'var(--warning)' : 'var(--success)' }}>{facts.owed ? fmtAED(facts.owed, 0) : '✓ None'}</div>
        </div>
        <div>
          <div className="stat-strip-label">Paid {thisMonth.slice(0, 4)}</div>
          <div className="stat-strip-value" style={{ fontSize: 17 }}>{fmtAED(facts.paidYear, 0)}</div>
        </div>
        <div>
          <div className="stat-strip-label">All time</div>
          <div className="stat-strip-value" style={{ fontSize: 17 }}>{fmtAED(facts.paidAll, 0)}</div>
        </div>
      </div>

      {facts.owed > 0 && (
        <div className="drawer-section">
          <div className="drawer-section-title">Record a payment</div>
          <div className="pay-inline">
            <input className="form-input" type="number" value={amt} onChange={(e) => setAmt(e.target.value)} style={{ width: 160 }} aria-label="Payment amount" />
            <Btn variant="success" onClick={() => { onPay(amt); setAmt(''); }}>Pay</Btn>
            <span style={{ fontSize: 11, color: 'var(--text-light)' }}>Applied to the oldest unpaid salary first</span>
          </div>
        </div>
      )}

      <div className="drawer-section">
        <div className="drawer-section-title">Details <span className={`badge ${st.cls}`}>{st.label}</span></div>
        <dl className="kv">
          <dt>Base salary</dt><dd>{Number(emp.baseSalary) ? `${fmtAED(emp.baseSalary, 0)} ${emp.salaryType === 'project' ? 'per project' : 'per month'}` : '—'}</dd>
          <dt>Email</dt><dd>{emp.email ? <a href={`mailto:${emp.email}`}>{emp.email}</a> : '—'}</dd>
          <dt>Phone</dt><dd>{emp.phone ? <>{emp.phone} · <a href={waLink(emp.phone)} target="_blank" rel="noreferrer">WhatsApp</a></> : '—'}</dd>
          <dt>Joined</dt><dd>{emp.joinDate ? fmtDate(emp.joinDate) : '—'}</dd>
          {emp.notes && <><dt>Notes</dt><dd style={{ whiteSpace: 'pre-wrap' }}>{emp.notes}</dd></>}
        </dl>
      </div>

      <div className="drawer-section">
        <div className="drawer-section-title">
          Salary history
          <button className="link-btn" onClick={() => setAdding((v) => !v)}>{adding ? 'Cancel' : '+ Add salary'}</button>
        </div>

        {adding && (
          <div className="inset-box">
            <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
              <div className="form-group"><label className="form-label">Amount (AED)</label><input className="form-input" type="number" value={newSal.totalSalary} onChange={(e) => setNewSal({ ...newSal, totalSalary: e.target.value })} /></div>
              <div className="form-group"><label className="form-label">Month</label><input className="form-input" type="month" value={newSal.month} onChange={(e) => setNewSal({ ...newSal, month: e.target.value })} /></div>
            </div>
            <div className="form-group"><label className="form-label">Project (optional)</label><input className="form-input" value={newSal.projectName} onChange={(e) => setNewSal({ ...newSal, projectName: e.target.value })} placeholder="e.g. Acme - Website" /></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <Segmented value={newSal.salaryType === 'monthly' ? 'monthly' : 'project'} onChange={(v) => setNewSal({ ...newSal, salaryType: v })} options={[{ value: 'monthly', label: 'Monthly' }, { value: 'project', label: 'One-time' }]} />
              <Btn size="sm" onClick={saveNew}>Add</Btn>
            </div>
          </div>
        )}

        {byMonth.length === 0 ? (
          <div className="empty-mini">No salary records yet.</div>
        ) : byMonth.map(([m, items]) => (
          <div key={m} style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-light)', marginBottom: 6 }}>{m === 'Unknown' ? m : fmtMonth(m)}</div>
            {items.map((s) => {
              const rem = remainingOf(s);
              return (
                <div key={s.id} className="history-row">
                  <span className="dot" style={{ background: rem > 0 ? (Number(s.paidAmount) > 0 ? 'var(--warning)' : 'var(--danger)') : 'var(--success)' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.projectName || (s.salaryType === 'monthly' ? 'Monthly salary' : 'One-time')}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-light)' }}>{rem > 0 ? `${fmtAED(rem, 0)} left of ${fmtAED(s.totalSalary, 0)}` : `Paid ${fmtAED(s.paidAmount, 0)}`}</div>
                  </div>
                  {rem > 0 && <button className="chip-btn chip-success" style={{ marginRight: 0 }} onClick={() => onUpdateSalary(s.id, { paidAmount: Number(s.totalSalary) || 0, status: 'paid' })}>✓ Pay</button>}
                  <button className="icon-btn danger" onClick={() => { if (window.confirm('Delete this salary record?')) onDeleteSalary(s.id); }} title="Delete"><Icon name="trash" size={12} /></button>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </Drawer>
  );
}

function EmployeeForm({ initial, employees, onClose, onSave }) {
  const [f, setF] = useState(initial);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const isEdit = !!initial.id;

  const save = () => {
    const name = (f.name || '').trim();
    if (!name) return alert('Employee name is required.');
    const dup = employees.find((e) => sameName(e.name, name) && e.id !== initial.id);
    if (dup) return alert(`An employee named "${dup.name}" already exists. Salaries are matched by name, so names must be unique.`);
    onSave({
      ...f,
      name,
      baseSalary: Number(f.baseSalary) || 0,
      id: initial.id || `emp-${Date.now()}`,
      createdAt: initial.createdAt || new Date().toISOString(),
    });
  };

  const depts = [...DEPARTMENTS, ...(f.department && !DEPARTMENTS.includes(f.department) ? [f.department] : [])];

  return (
    <Drawer
      open
      onClose={onClose}
      title={isEdit ? `Edit ${initial.name}` : 'Add employee'}
      subtitle={isEdit && initial.name !== f.name ? 'Renaming also updates their salary records' : undefined}
      footer={<><Btn variant="ghost" onClick={onClose}>Cancel</Btn><Btn onClick={save}><Icon name="check" size={14} /> {isEdit ? 'Save changes' : 'Add employee'}</Btn></>}
    >
      <div className="form-group"><label className="form-label">Full name *</label><input className="form-input" autoFocus value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Ahmed Faraz" /></div>
      <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 14px' }}>
        <div className="form-group"><label className="form-label">Role</label><input className="form-input" value={f.role || ''} onChange={(e) => set('role', e.target.value)} placeholder="e.g. Web Developer" /></div>
        <div className="form-group"><label className="form-label">Department</label>
          <select className="form-select" value={f.department || 'Management'} onChange={(e) => set('department', e.target.value)}>{depts.map((d) => <option key={d}>{d}</option>)}</select>
        </div>
        <div className="form-group"><label className="form-label">Base salary (AED)</label><input className="form-input" type="number" min="0" value={f.baseSalary ?? ''} onChange={(e) => set('baseSalary', e.target.value)} placeholder="0" /></div>
        <div className="form-group"><label className="form-label">Paid</label>
          <select className="form-select" value={f.salaryType || 'monthly'} onChange={(e) => set('salaryType', e.target.value)}>
            <option value="monthly">Monthly</option>
            <option value="project">Per project</option>
          </select>
        </div>
        <div className="form-group"><label className="form-label">Email</label><input className="form-input" type="email" value={f.email || ''} onChange={(e) => set('email', e.target.value)} /></div>
        <div className="form-group"><label className="form-label">Phone</label><input className="form-input" value={f.phone || ''} onChange={(e) => set('phone', e.target.value)} placeholder="+971…" /></div>
        <div className="form-group"><label className="form-label">Join date</label><input className="form-input" type="date" value={f.joinDate || ''} onChange={(e) => set('joinDate', e.target.value)} /></div>
        <div className="form-group"><label className="form-label">Status</label>
          <select className="form-select" value={f.status || 'active'} onChange={(e) => set('status', e.target.value)}>
            <option value="active">Active</option>
            <option value="onleave">On leave</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>
      <div className="form-group"><label className="form-label">Notes</label><textarea className="form-textarea" value={f.notes || ''} onChange={(e) => set('notes', e.target.value)} placeholder="Skills, contract type, bank details reference…" /></div>
    </Drawer>
  );
}
