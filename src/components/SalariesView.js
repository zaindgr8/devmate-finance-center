import React, { useMemo, useState } from 'react';
import Icon from './Icon';
import { Btn, Avatar, Segmented, Drawer, Empty } from './UI';
import { nextYM, prevYM, fmtMonth, currentYM, fmtAED, downloadCSV } from '../utils/helpers';

const isOpen = (s) => s.status !== 'paid' && s.status !== 'pushed';
const remainingOf = (s) => (isOpen(s) ? Math.max(0, (Number(s.totalSalary) || 0) - (Number(s.paidAmount) || 0)) : 0);
const statusFor = (total, paid) => (paid >= total && total > 0 ? 'paid' : paid > 0 ? 'partial' : 'unpaid');

const PILL = {
  paid: { cls: 'badge-green', label: 'Paid' },
  pushed: { cls: 'badge-green', label: 'Settled' },
  partial: { cls: 'badge-yellow', label: 'Partial' },
  unpaid: { cls: 'badge-red', label: 'Unpaid' },
};

const EMPTY_ROW = { employeeName: '', projectName: '', invoiceId: '', salaryType: 'monthly', totalSalary: '', paidAmount: '' };

export default function SalariesView({
  salaries = [], invoices = [], clients = [], employees = [],
  onAdd, onUpdate, onDelete, onPushToNextMonth, urgentSalaryIds = [], onToggleUrgent,
}) {
  const thisMonth = currentYM();
  const [month, setMonth] = useState(thisMonth);
  const [status, setStatus] = useState('due'); // due | paid | all
  const [type, setType] = useState('all'); // all | monthly | project
  const [q, setQ] = useState('');
  const [expanded, setExpanded] = useState({});
  const [payFor, setPayFor] = useState(null); // employee name with open pay box
  const [payAmt, setPayAmt] = useState('');
  const [editor, setEditor] = useState(null); // { mode: 'new' | 'edit', row }

  const monthRows = useMemo(() => salaries.filter((s) => s.month === month), [salaries, month]);

  // Month summary (ignores filters so the numbers always describe the whole month)
  const summary = useMemo(() => {
    const total = monthRows.reduce((s, r) => s + (Number(r.totalSalary) || 0), 0);
    const paid = monthRows.reduce((s, r) => s + (Number(r.paidAmount) || 0), 0);
    const remaining = monthRows.reduce((s, r) => s + remainingOf(r), 0);
    const owed = new Set(monthRows.filter((r) => remainingOf(r) > 0).map((r) => r.employeeName)).size;
    return { total, paid, remaining, owed };
  }, [monthRows]);

  // Anything still unpaid from earlier months
  const arrears = useMemo(() => {
    const list = salaries.filter((s) => s.month < month && remainingOf(s) > 0);
    const months = [...new Set(list.map((s) => s.month))].sort();
    return { amount: list.reduce((s, r) => s + remainingOf(r), 0), count: list.length, oldest: months[0] };
  }, [salaries, month]);

  const counts = {
    due: monthRows.filter(isOpen).length,
    paid: monthRows.filter((r) => !isOpen(r)).length,
    all: monthRows.length,
  };

  // Filter → group by employee → sort (owed most first)
  const groups = useMemo(() => {
    const s = q.trim().toLowerCase();
    const rows = monthRows.filter((r) => {
      if (status === 'due' && !isOpen(r)) return false;
      if (status === 'paid' && isOpen(r)) return false;
      if (type === 'monthly' && r.salaryType !== 'monthly') return false;
      if (type === 'project' && r.salaryType === 'monthly') return false;
      if (s && ![r.employeeName, r.projectName, r.invoiceId].some((v) => String(v || '').toLowerCase().includes(s))) return false;
      return true;
    });
    const map = new Map();
    rows.forEach((r) => {
      const key = (r.employeeName || 'Unassigned').trim();
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(r);
    });
    return [...map.entries()].map(([name, items]) => {
      const total = items.reduce((a, r) => a + (Number(r.totalSalary) || 0), 0);
      const paid = items.reduce((a, r) => a + (Number(r.paidAmount) || 0), 0);
      const remaining = items.reduce((a, r) => a + remainingOf(r), 0);
      return { name, items, total, paid, remaining, status: remaining <= 0 ? 'paid' : paid > 0 ? 'partial' : 'unpaid' };
    }).sort((a, b) => (b.remaining > 0) - (a.remaining > 0) || b.remaining - a.remaining || a.name.localeCompare(b.name));
  }, [monthRows, status, type, q]);

  // ── Actions ──
  const toggle = (name) => setExpanded((e) => ({ ...e, [name]: !e[name] }));

  const openPay = (g, e) => {
    e.stopPropagation();
    setPayFor(g.name);
    setPayAmt(String(g.remaining));
  };

  // Spread a payment over the employee's open items, oldest first
  const applyPay = (g) => {
    let left = Number(payAmt) || 0;
    if (left <= 0) return;
    const patches = [];
    [...g.items].filter(isOpen).sort((a, b) => (a.month || '').localeCompare(b.month || '')).forEach((item) => {
      if (left <= 0) return;
      const add = Math.min(remainingOf(item), left);
      left -= add;
      const newPaid = (Number(item.paidAmount) || 0) + add;
      patches.push({ id: item.id, patch: { paidAmount: newPaid, status: statusFor(Number(item.totalSalary) || 0, newPaid) } });
    });
    if (patches.length) onUpdate(patches);
    setPayFor(null);
    setPayAmt('');
  };

  const payItemInFull = (row) => {
    const total = Number(row.totalSalary) || 0;
    if (total > 0) onUpdate(row.id, { paidAmount: total, status: 'paid' });
  };

  const pushToNextMonth = (row) => {
    const next = nextYM(row.month);
    const total = Number(row.totalSalary) || 0;
    const paid = Number(row.paidAmount) || 0;
    if (paid > 0) {
      onPushToNextMonth({ ...row, status: 'pushed' }, {
        ...row,
        id: `sal-manual-push-${row.id}-${Date.now()}`,
        month: next,
        totalSalary: Math.max(0, total - paid),
        paidAmount: 0,
        status: 'unpaid',
        rolledOver: true,
        originalMonth: row.originalMonth || row.month,
        createdAt: new Date().toISOString(),
      });
    } else {
      onPushToNextMonth({ ...row, month: next, rolledOver: true }, null);
    }
  };

  const exportCSV = () => {
    const out = [['Employee', 'Project / Client', 'Type', 'Invoice', 'Month', 'Total (AED)', 'Paid (AED)', 'Remaining (AED)', 'Status']];
    groups.forEach((g) => g.items.forEach((r) => out.push([
      r.employeeName, r.projectName || '', r.salaryType === 'monthly' ? 'monthly' : 'one-time', r.invoiceId || '', r.month,
      Number(r.totalSalary) || 0, Number(r.paidAmount) || 0, remainingOf(r), r.status || 'unpaid',
    ])));
    downloadCSV(`salaries-${month}.csv`, out);
  };

  const newRow = () => setEditor({ mode: 'new', row: { ...EMPTY_ROW, month } });

  return (
    <div className="animate-fade-in">
      <div className="page-head">
        <div>
          <h1 className="page-title">Salaries</h1>
          <p className="page-sub">Who's owed what, month by month</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="month-nav">
            <button onClick={() => setMonth(prevYM(month))} aria-label="Previous month">‹</button>
            <span>{fmtMonth(month)}</span>
            <button onClick={() => setMonth(nextYM(month))} aria-label="Next month">›</button>
          </div>
          {month !== thisMonth && <button className="chip-btn" onClick={() => setMonth(thisMonth)}>This month</button>}
          <Btn onClick={newRow}><Icon name="plus" size={14} /> Add salary</Btn>
        </div>
      </div>

      {/* Month summary */}
      <div className="stat-strip">
        <div>
          <div className="stat-strip-label">Payroll</div>
          <div className="stat-strip-value">{fmtAED(summary.total, 0)}</div>
          <div className="meter-sm"><div style={{ width: `${summary.total ? Math.min(100, (summary.paid / summary.total) * 100) : 0}%` }} /></div>
        </div>
        <div>
          <div className="stat-strip-label">Paid</div>
          <div className="stat-strip-value" style={{ color: 'var(--success)' }}>{fmtAED(summary.paid, 0)}</div>
          <div className="stat-strip-sub">{summary.total ? Math.round((summary.paid / summary.total) * 100) : 0}% of payroll</div>
        </div>
        <div>
          <div className="stat-strip-label">Still to pay</div>
          <div className="stat-strip-value" style={{ color: summary.remaining ? 'var(--warning)' : 'var(--text)' }}>{fmtAED(summary.remaining, 0)}</div>
          <div className="stat-strip-sub">{summary.owed} {summary.owed === 1 ? 'person' : 'people'} waiting</div>
        </div>
      </div>

      {arrears.count > 0 && (
        <div className="notice notice-warning">
          <Icon name="alert" size={16} />
          <span style={{ flex: 1 }}><b>{fmtAED(arrears.amount, 0)}</b> is still unpaid from earlier months ({arrears.count} record{arrears.count === 1 ? '' : 's'}).</span>
          <button className="link-btn" onClick={() => setMonth(arrears.oldest)}>Go to {fmtMonth(arrears.oldest)} →</button>
        </div>
      )}

      <div className="toolbar">
        <Segmented
          value={status}
          onChange={setStatus}
          options={[
            { value: 'due', label: 'To pay', count: counts.due },
            { value: 'paid', label: 'Paid', count: counts.paid },
            { value: 'all', label: 'All', count: counts.all },
          ]}
        />
        <Segmented
          value={type}
          onChange={setType}
          options={[{ value: 'all', label: 'All types' }, { value: 'monthly', label: 'Monthly' }, { value: 'project', label: 'One-time' }]}
        />
        <div className="search-wrap">
          <input className="search-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, project or invoice…" />
          <div className="search-icon"><Icon name="search" size={14} /></div>
        </div>
        <button className="link-btn" style={{ marginLeft: 'auto' }} onClick={exportCSV} disabled={groups.length === 0}>⬇ Export CSV</button>
      </div>

      {groups.length === 0 ? (
        <div className="list">
          <Empty
            icon={status === 'due' && monthRows.length ? '🎉' : '💼'}
            title={status === 'due' && monthRows.length ? `Everyone's paid for ${fmtMonth(month)}` : `No salaries for ${fmtMonth(month)}`}
            text={monthRows.length ? 'Switch to "All" to see settled salaries.' : 'Salaries are created from invoices, or add one manually.'}
            action={!monthRows.length && <Btn size="sm" onClick={newRow}>+ Add salary</Btn>}
          />
        </div>
      ) : (
        <div className="list">
          {groups.map((g) => {
            const open = !!expanded[g.name];
            const projects = [...new Set(g.items.map((i) => i.projectName).filter(Boolean))];
            return (
              <React.Fragment key={g.name}>
                <div className="list-row clickable" onClick={() => toggle(g.name)} aria-expanded={open}>
                  <span className="chevron" style={{ transform: open ? 'rotate(90deg)' : 'none' }}>▶</span>
                  <Avatar name={g.name} />
                  <div className="row-main">
                    <div className="row-title">
                      {g.name}
                      <span className={`badge ${PILL[g.status].cls}`}>{PILL[g.status].label}</span>
                    </div>
                    <div className="row-sub">
                      {g.items.length > 1 ? `${g.items.length} items · ` : ''}{projects.join(', ') || (g.items[0].salaryType === 'monthly' ? 'Monthly salary' : 'One-time')}
                    </div>
                  </div>
                  <div className="row-amount" style={{ minWidth: 150 }}>
                    <div className="row-amount-main" style={{ color: g.remaining ? 'var(--text)' : 'var(--success)' }}>
                      {g.remaining ? `${fmtAED(g.remaining, 0)} due` : '✓ Settled'}
                    </div>
                    <div className="row-amount-sub">{fmtAED(g.paid, 0)} of {fmtAED(g.total, 0)} paid</div>
                    <div className="meter-sm"><div style={{ width: `${g.total ? Math.min(100, (g.paid / g.total) * 100) : 0}%` }} /></div>
                  </div>
                  <div className="row-actions" style={{ minWidth: 72, justifyContent: 'flex-end' }} onClick={(e) => e.stopPropagation()}>
                    {payFor === g.name ? (
                      <div className="pay-inline">
                        <input
                          autoFocus type="number" className="form-input" value={payAmt}
                          onChange={(e) => setPayAmt(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') applyPay(g); if (e.key === 'Escape') setPayFor(null); }}
                          aria-label={`Amount to pay ${g.name}`}
                        />
                        <Btn size="sm" variant="success" onClick={() => applyPay(g)}>Pay</Btn>
                        <button className="icon-btn" onClick={() => setPayFor(null)} aria-label="Cancel">✕</button>
                      </div>
                    ) : g.remaining > 0 ? (
                      <Btn size="sm" onClick={(e) => openPay(g, e)}>Pay</Btn>
                    ) : null}
                  </div>
                </div>

                {open && g.items.map((r) => {
                  const rem = remainingOf(r);
                  const pill = PILL[r.status] || PILL.unpaid;
                  const urgent = urgentSalaryIds.includes(r.id);
                  return (
                    <div
                      key={r.id}
                      className="list-sub-row"
                      draggable={isOpen(r)}
                      onDragStart={(e) => { e.dataTransfer.setData('salaryId', r.id); e.dataTransfer.effectAllowed = 'copy'; }}
                    >
                      <div className="row-main">
                        <div style={{ fontWeight: 600, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                          {r.projectName || (r.salaryType === 'monthly' ? 'Monthly salary' : 'Unnamed')}
                          <span className="badge badge-blue">{r.salaryType === 'monthly' ? 'Monthly' : 'One-time'}</span>
                          {r.rolledOver && <span className="badge badge-yellow" title={r.originalMonth ? `From ${fmtMonth(r.originalMonth)}` : 'Carried over'}>↩ carried over</span>}
                        </div>
                        <div className="row-sub">{r.invoiceId ? `Invoice #${r.invoiceId}` : 'No invoice linked'}</div>
                      </div>
                      <div className="row-amount">
                        <div className="row-amount-main" style={{ fontSize: 13 }}>{fmtAED(r.totalSalary, 0)}</div>
                        <div className="row-amount-sub">{rem ? `${fmtAED(rem, 0)} left` : <span className={`badge ${pill.cls}`}>{pill.label}</span>}</div>
                      </div>
                      <div className="row-actions">
                        {rem > 0 && <button className="chip-btn chip-success" style={{ marginRight: 0 }} onClick={() => payItemInFull(r)}>✓ Pay in full</button>}
                        {onToggleUrgent && isOpen(r) && (
                          <button className="icon-btn" onClick={() => onToggleUrgent(r.id)} title={urgent ? 'Remove from urgent' : 'Mark urgent'} style={urgent ? { borderColor: 'var(--danger)', background: 'var(--danger-soft)' } : { opacity: 0.6 }}>🚨</button>
                        )}
                        {isOpen(r) && <button className="icon-btn" onClick={() => pushToNextMonth(r)} title="Move balance to next month">⏭</button>}
                        <button className="icon-btn" onClick={() => setEditor({ mode: 'edit', row: r })} title="Edit"><Icon name="edit" size={13} /></button>
                        <button className="icon-btn danger" onClick={() => { if (window.confirm('Delete this salary record?')) onDelete(r.id); }} title="Delete"><Icon name="trash" size={13} /></button>
                      </div>
                    </div>
                  );
                })}
              </React.Fragment>
            );
          })}
        </div>
      )}

      {groups.length > 0 && (
        <div className="hint">Tap a person to see their items · drag an item onto the Urgent panel to flag it</div>
      )}

      {editor && (
        <SalaryEditor
          key={editor.row.id || 'new'}
          editor={editor}
          onClose={() => setEditor(null)}
          employees={employees}
          clients={clients}
          invoices={invoices}
          onSubmit={(row, mode) => {
            if (mode === 'new') onAdd(row);
            else onUpdate(row.id, row);
            if (row.month !== month) setMonth(row.month);
            setEditor(null);
          }}
        />
      )}
    </div>
  );
}

function SalaryEditor({ editor, onClose, employees, clients, invoices, onSubmit }) {
  const [row, setRow] = useState(() => ({
    ...EMPTY_ROW,
    ...editor.row,
    totalSalary: String(editor.row.totalSalary ?? ''),
    paidAmount: String(editor.row.paidAmount || ''),
  }));

  const set = (k, v) => setRow((r) => ({ ...r, [k]: v }));
  const active = employees.filter((e) => e.status === 'active' || !e.status);
  const projectOptions = clients.flatMap((c) => [c.name, ...(c.projects || []).map((p) => `${c.name} - ${p.name}`)]);

  const pickEmployee = (name) => {
    const emp = employees.find((e) => e.name === name);
    setRow((r) => ({
      ...r,
      employeeName: name,
      ...(editor.mode === 'new' && emp ? {
        totalSalary: r.totalSalary || (Number(emp.baseSalary) ? String(emp.baseSalary) : ''),
        salaryType: emp.salaryType || r.salaryType,
      } : {}),
    }));
  };

  const submit = () => {
    const total = Number(row.totalSalary) || 0;
    const paid = Number(row.paidAmount) || 0;
    if (!row.employeeName) return alert('Please choose an employee.');
    if (total <= 0) return alert('Please enter the salary amount.');
    if (paid > total) return alert('Paid cannot be more than the total.');
    const keepPushed = editor.mode === 'edit' && editor.row.status === 'pushed';
    onSubmit({
      ...editor.row,
      ...row,
      totalSalary: total,
      paidAmount: paid,
      status: keepPushed ? 'pushed' : statusFor(total, paid),
      ...(editor.mode === 'new' ? { id: `man-sal-${Date.now()}`, createdAt: new Date().toISOString() } : {}),
    }, editor.mode);
  };

  return (
    <Drawer
      open
      onClose={onClose}
      title={editor.mode === 'new' ? 'Add salary' : 'Edit salary'}
      subtitle={editor.mode === 'edit' ? `${editor.row.employeeName} · ${fmtMonth(editor.row.month)}` : 'Record a salary or one-time payout'}
      footer={<><Btn variant="ghost" onClick={onClose}>Cancel</Btn><Btn onClick={submit}><Icon name="check" size={14} /> Save</Btn></>}
    >
      <div className="form-group">
        <label className="form-label">Employee *</label>
        <select className="form-select" value={row.employeeName} onChange={(e) => pickEmployee(e.target.value)}>
          <option value="">Choose employee…</option>
          {active.map((e) => <option key={e.id} value={e.name}>{e.name}{Number(e.baseSalary) ? ` · AED ${Number(e.baseSalary).toLocaleString()}` : ''}</option>)}
          {row.employeeName && !active.some((e) => e.name === row.employeeName) && <option value={row.employeeName}>{row.employeeName}</option>}
        </select>
      </div>

      <div className="form-group">
        <label className="form-label">Type</label>
        <Segmented value={row.salaryType === 'monthly' ? 'monthly' : 'project'} onChange={(v) => set('salaryType', v)} options={[{ value: 'monthly', label: '🔄 Monthly' }, { value: 'project', label: '📦 One-time / project' }]} />
      </div>

      <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 14px' }}>
        <div className="form-group">
          <label className="form-label">Amount (AED) *</label>
          <input className="form-input" type="number" min="0" value={row.totalSalary} onChange={(e) => set('totalSalary', e.target.value)} placeholder="0" />
        </div>
        <div className="form-group">
          <label className="form-label">Already paid</label>
          <input className="form-input" type="number" min="0" value={row.paidAmount} onChange={(e) => set('paidAmount', e.target.value)} placeholder="0" />
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Project / client</label>
        <input className="form-input" list="salary-projects" value={row.projectName || ''} onChange={(e) => set('projectName', e.target.value)} placeholder="e.g. Acme - Website" />
        <datalist id="salary-projects">{projectOptions.map((p) => <option key={p} value={p} />)}</datalist>
      </div>

      <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 14px' }}>
        <div className="form-group">
          <label className="form-label">Month</label>
          <input className="form-input" type="month" value={row.month || ''} onChange={(e) => set('month', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Linked invoice</label>
          <select className="form-select" value={row.invoiceId || ''} onChange={(e) => set('invoiceId', e.target.value)}>
            <option value="">None</option>
            {invoices.map((inv) => <option key={inv.invoiceNumber} value={inv.invoiceNumber}>#{inv.invoiceNumber} · {inv.clientName}</option>)}
          </select>
        </div>
      </div>
    </Drawer>
  );
}
