import React, { useState, useRef } from 'react';

const EMPTY_EMP = {
  name: '', role: '', department: 'Management', email: '',
  phone: '', joinDate: '', status: 'active', notes: '',
};

const STATUS_COLORS = {
  active: { bg: '#ECFDF3', color: '#0D9F5F' },
  inactive: { bg: '#FEF2F4', color: '#DC143C' },
  onleave: { bg: '#FFFBEB', color: '#D97706' },
};

function currentYM() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function Avatar({ name }) {
  const initials = (name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  const hue = [...(name || 'X')].reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
  return (
    <div style={{
      width: 42, height: 42, borderRadius: '50%', flexShrink: 0,
      background: `hsl(${hue},55%,88%)`, color: `hsl(${hue},55%,35%)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 700, fontSize: 15, letterSpacing: 0.5,
    }}>
      {initials}
    </div>
  );
}

export default function EmployeesView({
  employees = [], salaries = [],
  onAdd, onUpdate, onDelete,
  onAddSalary, onUpdateSalary, onDeleteSalary,
  onReorder,
}) {
  const topRef = useRef(null);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editEmp, setEditEmp] = useState(null);
  const [form, setForm] = useState({ ...EMPTY_EMP });

  // Search + filter
  const [searchQ, setSearchQ] = useState('');
  const [filterMode, setFilterMode] = useState('pending'); // 'pending' | 'all'
  const [filterMonth, setFilterMonth] = useState(currentYM());

  // Salary sub-form
  const [showAddSal, setShowAddSal] = useState(false);
  const [editSalId, setEditSalId] = useState(null);
  const [newSal, setNewSal] = useState({
    projectName: '', salaryType: 'project',
    totalSalary: '', paidAmount: '', status: 'unpaid',
  });

  // Quick-pay
  const [quickPayEmpId, setQuickPayEmpId] = useState(null);
  const [quickPayAmount, setQuickPayAmount] = useState('');

  // Card expand sections
  const [expandedCardSections, setExpandedCardSections] = useState({});

  // Drag state for cards
  const [dragEmpId, setDragEmpId] = useState(null);
  const [dragOverEmpId, setDragOverEmpId] = useState(null);
  const [localOrder, setLocalOrder] = useState(null);

  // ─── helpers ──────────────────────────────────────────
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const toggleCardSection = (empId, section) => {
    setExpandedCardSections(prev => ({
      ...prev,
      [empId]: { ...(prev[empId] || {}), [section]: !(prev[empId]?.[section]) },
    }));
  };

  // ─── form handlers ────────────────────────────────────
  const openAdd = () => {
    setForm({ ...EMPTY_EMP });
    setEditEmp(null);
    setShowForm(true);
    setTimeout(() => topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30);
  };

  const openEdit = (emp) => {
    const validDepts = ['Management', 'Web Development', 'App Development', 'Designing', 'Digital Marketing', 'BlockChain', 'AI'];
    setForm({ ...emp, department: validDepts.includes(emp.department) ? emp.department : 'Management' });
    setEditEmp(emp);
    setShowForm(true);
    // Scroll to top so the form is immediately visible
    setTimeout(() => topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30);
  };

  const cancel = () => {
    setShowForm(false); setEditEmp(null);
    setShowAddSal(false); setEditSalId(null);
  };

  const save = () => {
    if (!form.name.trim()) { alert('Employee name is required.'); return; }
    const emp = {
      ...form,
      id: editEmp ? editEmp.id : `emp-${Date.now()}`,
      createdAt: editEmp ? editEmp.createdAt : new Date().toISOString(),
    };
    if (editEmp) onUpdate(emp.id, emp); else onAdd(emp);
    setShowForm(false); setEditEmp(null); setShowAddSal(false);
  };

  const handleAddSal = () => {
    if (!newSal.totalSalary) { alert('Amount is required.'); return; }
    const total = Number(newSal.totalSalary) || 0;
    const paid  = Number(newSal.paidAmount)  || 0;
    let status  = 'unpaid';
    if (paid >= total && total > 0) status = 'paid';
    else if (paid > 0) status = 'partial';

    if (editSalId) {
      onUpdateSalary(editSalId, { projectName: newSal.projectName, salaryType: newSal.salaryType, totalSalary: total, paidAmount: paid, status });
    } else {
      onAddSalary({
        employeeName: editEmp.name,
        projectName: newSal.projectName,
        salaryType: newSal.salaryType,
        totalSalary: total, paidAmount: paid, status,
        month: currentYM(),
        id: `sal-${Date.now()}`,
        createdAt: new Date().toISOString(),
      });
    }
    setNewSal({ projectName: '', salaryType: 'project', totalSalary: '', paidAmount: '', status: 'unpaid' });
    setShowAddSal(false); setEditSalId(null);
  };

  // ─── drag handlers for employee cards ─────────────────
  const handleEmpDragStart = (e, empId) => {
    setDragEmpId(empId);
    e.dataTransfer.effectAllowed = 'move';
  };
  const handleEmpDragOver = (e, empId) => {
    e.preventDefault();
    if (empId !== dragEmpId) setDragOverEmpId(empId);
  };
  const handleEmpDrop = (e) => {
    e.preventDefault();
    if (!dragEmpId || !dragOverEmpId || dragEmpId === dragOverEmpId) {
      setDragEmpId(null); setDragOverEmpId(null); return;
    }
    const base = localOrder || [...employees];
    const fromIdx = base.findIndex(x => x.id === dragEmpId);
    const toIdx   = base.findIndex(x => x.id === dragOverEmpId);
    if (fromIdx === -1 || toIdx === -1) { setDragEmpId(null); setDragOverEmpId(null); return; }
    const next = [...base];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    setLocalOrder(next);
    if (onReorder) onReorder(next);
    setDragEmpId(null); setDragOverEmpId(null);
  };

  // ─── filtering ────────────────────────────────────────
  const thisMonth = currentYM();
  const orderedEmps = localOrder || [...employees];

  const baseFiltered = orderedEmps.filter(e =>
    !searchQ ||
    e.name?.toLowerCase().includes(searchQ.toLowerCase()) ||
    e.role?.toLowerCase().includes(searchQ.toLowerCase()) ||
    e.department?.toLowerCase().includes(searchQ.toLowerCase())
  );

  const filtered = baseFiltered.filter(emp => {
    if (filterMode !== 'pending') return true;
    // "Pending only": show employees with ≥1 non-paid salary this month
    const empSals = salaries.filter(s =>
      s.employeeName?.trim().toLowerCase() === emp.name?.trim().toLowerCase() &&
      s.month === thisMonth
    );
    return empSals.some(s => s.status !== 'paid' && s.status !== 'pushed');
  });

  // ─── stats ────────────────────────────────────────────
  const activeCount     = employees.filter(e => e.status === 'active').length;
  const totalBaseSalary = employees.reduce((s, e) => s + (Number(e.baseSalary) || 0), 0);
  const totalPaidOut    = salaries.reduce((s, sal) => s + (Number(sal.paidAmount) || 0), 0);

  // ─── render ───────────────────────────────────────────
  return (
    <div className="animate-fade-in" ref={topRef}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 2 }}>Employees</h1>
          <div style={{ fontSize: 12, color: 'var(--text-light)' }}>Manage your team — link employees to salary records</div>
        </div>
        <button
          onClick={openAdd}
          style={{ background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'Poppins, sans-serif', display: 'flex', alignItems: 'center', gap: 8 }}
        >
          + Add Employee
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Active Employees', val: activeCount, color: 'var(--success)' },
          { label: 'Total Base Salary / Mo', val: `AED ${totalBaseSalary.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, color: 'var(--warning)' },
          { label: 'Total Paid Out (All Time)', val: `AED ${totalPaidOut.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, color: 'var(--info)' },
        ].map(({ label, val, color }) => (
          <div key={label} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 20px', boxShadow: 'var(--shadow)' }}>
            <div style={{ fontSize: 11, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 600, marginBottom: 8 }}>{label}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color }}>{val}</div>
          </div>
        ))}
      </div>

      {/* ── Add / Edit Form ── */}
      {showForm && (
        <div style={{ background: 'var(--card)', border: '1.5px solid var(--primary)', borderRadius: 12, padding: 24, marginBottom: 24, boxShadow: 'var(--shadow-md)' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 18 }}>
            {editEmp ? `Edit — ${editEmp.name}` : 'New Employee'}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 14 }}>
            {[
              { label: 'Full Name *', key: 'name', type: 'text', placeholder: 'e.g. Ahmed Faraz' },
              { label: 'Role / Position', key: 'role', type: 'text', placeholder: 'e.g. Web Developer' },
              { label: 'Email', key: 'email', type: 'email', placeholder: 'employee@email.com' },
              { label: 'Phone', key: 'phone', type: 'text', placeholder: '+971...' },
              { label: 'Join Date', key: 'joinDate', type: 'date' },
            ].map(({ label, key, type, placeholder }) => (
              <div key={key}>
                <div style={{ fontSize: 11, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 4, fontWeight: 600 }}>{label}</div>
                <input type={type} value={form[key] || ''} placeholder={placeholder} onChange={e => set(key, e.target.value)} className="form-input" />
              </div>
            ))}
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 4, fontWeight: 600 }}>Department</div>
              <select value={form.department} onChange={e => set('department', e.target.value)} className="form-select">
                {['Management', 'Web Development', 'App Development', 'Designing', 'Digital Marketing', 'BlockChain', 'AI'].map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 4, fontWeight: 600 }}>Status</div>
              <select value={form.status} onChange={e => set('status', e.target.value)} className="form-select">
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="onleave">On Leave</option>
              </select>
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 4, fontWeight: 600 }}>Notes</div>
            <textarea value={form.notes || ''} onChange={e => set('notes', e.target.value)} placeholder="Skills, contract type, additional info..." className="form-input" rows={2} style={{ resize: 'vertical', minHeight: 60 }} />
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginBottom: 24 }}>
            <button onClick={cancel} style={{ padding: '9px 20px', border: '1px solid var(--border)', borderRadius: 8, background: 'transparent', cursor: 'pointer', fontFamily: 'Poppins, sans-serif', fontSize: 13 }}>Cancel</button>
            <button onClick={save} style={{ padding: '9px 20px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontFamily: 'Poppins, sans-serif', fontSize: 13 }}>
              {editEmp ? 'Save Changes' : 'Add Employee'}
            </button>
          </div>

          {/* Projects & Salaries (edit mode only) */}
          {editEmp && (
            <div style={{ paddingTop: 24, borderTop: '1px solid var(--border-light)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-mid)', textTransform: 'uppercase', letterSpacing: 1.5 }}>Projects &amp; Salaries</h3>
                <button
                  onClick={() => { setNewSal({ projectName: '', salaryType: 'project', totalSalary: '', paidAmount: '', status: 'unpaid' }); setEditSalId(null); setShowAddSal(!showAddSal); }}
                  style={{ background: 'var(--primary-soft)', color: 'var(--primary)', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                >
                  {showAddSal ? 'Cancel' : '+ Add Salary'}
                </button>
              </div>

              {showAddSal && (
                <div style={{ background: 'var(--bg)', padding: 16, borderRadius: 8, marginBottom: 16, border: '1px solid var(--border)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 4, fontWeight: 600 }}>Project Description</div>
                      <input type="text" className="form-input" value={newSal.projectName} onChange={e => setNewSal({ ...newSal, projectName: e.target.value })} placeholder="e.g. NextJS Website" />
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 4, fontWeight: 600 }}>Salary Type</div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        {[{ val: 'project', label: '📦 One-Time' }, { val: 'monthly', label: '🔄 Monthly' }].map(({ val, label }) => (
                          <button key={val} type="button" onClick={() => setNewSal({ ...newSal, salaryType: val })}
                            style={{ flex: 1, padding: '7px 6px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'Poppins,sans-serif', transition: 'all 0.15s', border: newSal.salaryType === val ? '2px solid var(--primary)' : '1.5px solid var(--border)', background: newSal.salaryType === val ? 'var(--primary-soft)' : 'var(--input-bg)', color: newSal.salaryType === val ? 'var(--primary)' : 'var(--text-mid)' }}
                          >{label}</button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 4, fontWeight: 600 }}>Amount (AED)</div>
                      <input type="number" className="form-input" value={newSal.totalSalary} onChange={e => setNewSal({ ...newSal, totalSalary: e.target.value })} placeholder="0" />
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 4, fontWeight: 600 }}>Paid (AED)</div>
                      <input type="number" className="form-input" value={newSal.paidAmount} onChange={e => setNewSal({ ...newSal, paidAmount: e.target.value })} placeholder="0" />
                    </div>
                    <div style={{ gridColumn: 'span 2' }}>
                      <div style={{ fontSize: 11, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 4, fontWeight: 600 }}>Status</div>
                      <select className="form-select" value={newSal.status} onChange={e => setNewSal({ ...newSal, status: e.target.value })}>
                        <option value="unpaid">Unpaid</option>
                        <option value="partial">Partial</option>
                        <option value="paid">Paid</option>
                      </select>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button onClick={handleAddSal} style={{ background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Save Salary</button>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(() => {
                  const empSals = salaries.filter(s => s.employeeName?.trim().toLowerCase() === editEmp.name?.trim().toLowerCase());
                  if (empSals.length === 0) return <div style={{ fontSize: 12, color: 'var(--text-light)' }}>No salaries or projects assigned yet.</div>;
                  return empSals.map(s => {
                    const isPaid = s.status === 'paid' || s.status === 'pushed';
                    return (
                      <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg)', padding: '10px 14px', borderRadius: 8, fontSize: 12, border: '1px solid var(--border)', borderLeft: `3px solid ${isPaid ? '#0D9F5F' : '#D97706'}` }}>
                        <div>
                          <div style={{ fontWeight: 600 }}>{s.projectName || '—'}</div>
                          <div style={{ color: 'var(--text-light)', fontSize: 11, marginTop: 2 }}>
                            {s.salaryType === 'monthly' ? '🔄 Monthly' : '📦 One-Time'} · <span style={{ textTransform: 'capitalize', color: isPaid ? '#0D9F5F' : '#D97706', fontWeight: 600 }}>{s.status}</span>
                            {s.month && <span style={{ marginLeft: 6, color: 'var(--text-faint)' }}>· {s.month}</span>}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontWeight: 700, color: isPaid ? '#0D9F5F' : '#D97706', fontSize: 13 }}>AED {Number(s.totalSalary).toLocaleString()}</div>
                            {Number(s.paidAmount) > 0 && <div style={{ color: '#0D9F5F', fontSize: 10, fontWeight: 600 }}>Paid: AED {Number(s.paidAmount).toLocaleString()}</div>}
                          </div>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button onClick={() => { setNewSal({ projectName: s.projectName, salaryType: s.salaryType, totalSalary: s.totalSalary, paidAmount: s.paidAmount || '', status: s.status }); setEditSalId(s.id); setShowAddSal(true); }}
                              style={{ background: 'var(--primary-soft)', border: '1px solid var(--border-light)', color: 'var(--primary)', cursor: 'pointer', width: 24, height: 24, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10 }}>✏️</button>
                            <button onClick={() => { if (window.confirm('Delete this salary record?')) onDeleteSalary(s.id); }}
                              style={{ background: 'var(--bg)', border: '1px solid var(--border-light)', color: 'var(--text-faint)', cursor: 'pointer', width: 24, height: 24, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                          </div>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Search + Filter Bar ── */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <input className="search-input" value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Search employees..." />
          <div style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-faint)' }}>🔍</div>
        </div>

        {/* Mode toggle */}
        <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
          {[{ id: 'pending', label: '⏳ Pending Only' }, { id: 'all', label: '📋 All' }].map(opt => (
            <button key={opt.id} onClick={() => setFilterMode(opt.id)}
              style={{ padding: '7px 14px', border: 'none', cursor: 'pointer', fontFamily: 'Poppins, sans-serif', fontSize: 12, fontWeight: 600, background: filterMode === opt.id ? 'var(--primary)' : 'var(--card)', color: filterMode === opt.id ? '#fff' : 'var(--text-light)', transition: 'all 0.15s' }}
            >{opt.label}</button>
          ))}
        </div>

        {/* Month picker — only in "all" mode */}
        {filterMode === 'all' && (
          <input type="month" value={filterMonth} onChange={e => setFilterMonth(e.target.value)}
            className="form-input" style={{ padding: '7px 12px', fontSize: 12, width: 'auto' }} />
        )}

        {filterMode === 'pending' && (
          <div style={{ fontSize: 11, color: 'var(--text-faint)', fontStyle: 'italic' }}>
            Showing employees with pending salaries this month
          </div>
        )}
      </div>

      {/* ── Employee Cards Grid ── */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-light)' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>
            {filterMode === 'pending' ? '🎉' : '👤'}
          </div>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>
            {employees.length === 0 ? 'No employees yet'
              : filterMode === 'pending' ? 'All salaries cleared for this month!'
              : 'No results found'}
          </div>
          <div style={{ fontSize: 13 }}>
            {employees.length === 0 ? 'Add your first employee to get started.'
              : filterMode === 'pending' ? 'Switch to "All" to view full history.'
              : 'Try a different search or month.'}
          </div>
        </div>
      ) : (
        <div
          style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}
          onDragOver={e => e.preventDefault()}
          onDrop={handleEmpDrop}
        >
          {filtered.map(emp => {
            const allEmpSals = salaries.filter(s =>
              s.employeeName?.trim().toLowerCase() === emp.name?.trim().toLowerCase()
            );
            // Which salaries to show on card depends on filter mode
            const displaySals = filterMode === 'all'
              ? allEmpSals.filter(s => s.month === filterMonth)
              : allEmpSals.filter(s => s.month === thisMonth);

            const st = STATUS_COLORS[emp.status] || STATUS_COLORS.active;
            const isDragging  = dragEmpId === emp.id;
            const isDragOver  = dragOverEmpId === emp.id && !isDragging;

            const pendingSals  = displaySals.filter(s => s.status !== 'paid' && s.status !== 'pushed');
            const paidSals     = displaySals.filter(s => s.status === 'paid' || s.status === 'pushed');
            const pendingTotal = pendingSals.reduce((sum, s) => sum + Math.max(0, (Number(s.totalSalary) || 0) - (Number(s.paidAmount) || 0)), 0);
            const paidTotal    = paidSals.reduce((sum, s) => sum + (Number(s.paidAmount) || 0), 0);
            const isPendingOpen = expandedCardSections[emp.id]?.pending;
            const isPaidOpen    = expandedCardSections[emp.id]?.paid;

            return (
              <div
                key={emp.id}
                className="card"
                draggable
                onDragStart={e => handleEmpDragStart(e, emp.id)}
                onDragOver={e => handleEmpDragOver(e, emp.id)}
                onDragEnd={() => { setDragEmpId(null); setDragOverEmpId(null); }}
                style={{
                  padding: '18px 20px', position: 'relative',
                  opacity: isDragging ? 0.4 : 1,
                  outline: isDragOver ? '2.5px solid var(--primary)' : 'none',
                  outlineOffset: 3,
                  transition: 'opacity 0.15s, outline 0.1s',
                  cursor: 'grab',
                }}
              >
                {/* Drag hint */}
                <div style={{ position: 'absolute', top: 10, left: 14, color: 'var(--border)', fontSize: 14, userSelect: 'none', lineHeight: 1 }}>⠿</div>

                {/* Delete */}
                <button
                  onClick={() => { if (window.confirm(`Remove ${emp.name}?`)) onDelete(emp.id); }}
                  style={{ position: 'absolute', top: 12, right: 12, background: 'none', border: 'none', color: 'var(--text-faint)', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}
                  title="Delete"
                >×</button>

                {/* Avatar + name */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, paddingLeft: 18 }}>
                  <Avatar name={emp.name} />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{emp.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-light)' }}>{emp.role}{emp.department ? ` · ${emp.department}` : ''}</div>
                  </div>
                  <span style={{ marginLeft: 'auto', marginRight: 28, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, background: st.bg, color: st.color, borderRadius: 20, padding: '3px 10px' }}>
                    {emp.status === 'onleave' ? 'On Leave' : emp.status}
                  </span>
                </div>

                {/* Info */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px 14px', fontSize: 12, marginBottom: 12 }}>
                  {emp.email    && <div><span style={{ color: 'var(--text-faint)' }}>📧 </span>{emp.email}</div>}
                  {emp.phone    && <div><span style={{ color: 'var(--text-faint)' }}>📞 </span>{emp.phone}</div>}
                  {emp.joinDate && <div><span style={{ color: 'var(--text-faint)' }}>📅 Joined: </span>{new Date(emp.joinDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</div>}
                </div>

                {/* Minimalist salary section */}
                {displaySals.length > 0 && (
                  <div style={{ marginBottom: 12, border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', fontSize: 12 }}>

                    {/* Pending Salary row */}
                    {pendingSals.length > 0 && (
                      <>
                        <div
                          onClick={() => toggleCardSection(emp.id, 'pending')}
                          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', cursor: 'pointer', background: 'var(--bg)', borderBottom: (isPendingOpen || paidSals.length > 0) ? '1px solid var(--border)' : 'none', userSelect: 'none' }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, color: 'var(--text-mid)' }}>
                            <span style={{ display: 'inline-block', transition: 'transform 0.2s', transform: isPendingOpen ? 'rotate(90deg)' : 'none', fontSize: 9, color: 'var(--text-faint)' }}>▶</span>
                            Pending Salary
                            <span style={{ background: '#FFFBEB', color: '#D97706', borderRadius: 10, fontSize: 9, fontWeight: 700, padding: '1px 6px' }}>{pendingSals.length}</span>
                          </div>
                          <span style={{ fontWeight: 700, color: '#D97706' }}>AED {pendingTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                        </div>
                        {isPendingOpen && pendingSals.map(s => {
                          const rem = Math.max(0, (Number(s.totalSalary) || 0) - (Number(s.paidAmount) || 0));
                          return (
                            <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 12px 5px 22px', borderBottom: '1px solid var(--border-light)', background: 'var(--card)' }}>
                              <div style={{ color: 'var(--text-mid)' }}>
                                <span style={{ color: 'var(--text-faint)', marginRight: 4 }}>↳</span>
                                {s.projectName || (s.salaryType === 'monthly' ? 'Monthly Salary' : '—')}
                                <span style={{ marginLeft: 5, fontSize: 9, color: 'var(--text-faint)' }}>{s.salaryType === 'monthly' ? '🔄' : '📦'}</span>
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <div style={{ fontWeight: 700, color: '#D97706' }}>AED {rem.toLocaleString()}</div>
                                {Number(s.paidAmount) > 0 && <div style={{ fontSize: 10, color: 'var(--text-faint)' }}>of {Number(s.totalSalary).toLocaleString()}</div>}
                              </div>
                            </div>
                          );
                        })}
                      </>
                    )}

                    {/* Paid Salaries row */}
                    {paidSals.length > 0 && (
                      <>
                        <div
                          onClick={() => toggleCardSection(emp.id, 'paid')}
                          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', cursor: 'pointer', background: 'var(--bg)', userSelect: 'none' }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, color: 'var(--text-mid)' }}>
                            <span style={{ display: 'inline-block', transition: 'transform 0.2s', transform: isPaidOpen ? 'rotate(90deg)' : 'none', fontSize: 9, color: 'var(--text-faint)' }}>▶</span>
                            Paid Salaries
                            <span style={{ background: '#ECFDF3', color: '#0D9F5F', borderRadius: 10, fontSize: 9, fontWeight: 700, padding: '1px 6px' }}>{paidSals.length}</span>
                          </div>
                          <span style={{ fontWeight: 700, color: '#0D9F5F' }}>AED {paidTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                        </div>
                        {isPaidOpen && paidSals.map(s => (
                          <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 12px 5px 22px', borderBottom: '1px solid var(--border-light)', background: 'var(--card)' }}>
                            <div style={{ color: 'var(--text-mid)' }}>
                              <span style={{ color: 'var(--text-faint)', marginRight: 4 }}>↳</span>
                              {s.projectName || (s.salaryType === 'monthly' ? 'Monthly Salary' : '—')}
                              <span style={{ marginLeft: 5, fontSize: 9, color: 'var(--text-faint)' }}>{s.salaryType === 'monthly' ? '🔄' : '📦'}</span>
                            </div>
                            <span style={{ fontWeight: 700, color: '#0D9F5F' }}>AED {Number(s.paidAmount).toLocaleString()}</span>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                )}

                {emp.notes && (
                  <div style={{ fontSize: 11, color: 'var(--text-light)', fontStyle: 'italic', borderTop: '1px solid var(--border-light)', paddingTop: 8, marginBottom: 10 }}>{emp.notes}</div>
                )}

                {/* Quick-pay inline / Edit + Add Payment buttons */}
                {quickPayEmpId === emp.id ? (
                  <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: 12, marginBottom: 10 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 6, fontWeight: 600 }}>Add Payment to Top Project</div>
                    {allEmpSals.length > 0 ? (
                      <>
                        <div style={{ fontSize: 11, color: 'var(--text-mid)', marginBottom: 8 }}>Project: <strong>{allEmpSals[0].projectName || 'Unnamed'}</strong></div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <input
                            autoFocus type="number" className="form-input"
                            placeholder="Amount..." value={quickPayAmount}
                            onChange={e => setQuickPayAmount(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                const t = allEmpSals[0];
                                const np = (Number(t.paidAmount) || 0) + (Number(quickPayAmount) || 0);
                                const tot = Number(t.totalSalary) || 0;
                                onUpdateSalary(t.id, { paidAmount: np, status: np >= tot && tot > 0 ? 'paid' : np > 0 ? 'partial' : 'unpaid' });
                                setQuickPayEmpId(null); setQuickPayAmount('');
                              }
                              if (e.key === 'Escape') { setQuickPayEmpId(null); setQuickPayAmount(''); }
                            }}
                            style={{ padding: '6px 10px', fontSize: 13 }}
                          />
                          <button
                            onClick={() => {
                              const t = allEmpSals[0];
                              const np = (Number(t.paidAmount) || 0) + (Number(quickPayAmount) || 0);
                              const tot = Number(t.totalSalary) || 0;
                              onUpdateSalary(t.id, { paidAmount: np, status: np >= tot && tot > 0 ? 'paid' : np > 0 ? 'partial' : 'unpaid' });
                              setQuickPayEmpId(null); setQuickPayAmount('');
                            }}
                            style={{ background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 6, padding: '0 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                          >Add</button>
                        </div>
                      </>
                    ) : <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>No projects for this employee.</div>}
                    <button onClick={() => { setQuickPayEmpId(null); setQuickPayAmount(''); }} style={{ marginTop: 8, background: 'none', border: 'none', color: 'var(--text-light)', fontSize: 11, cursor: 'pointer', padding: 0 }}>Cancel</button>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <button onClick={() => openEdit(emp)} style={{ padding: '8px', background: 'var(--bg)', color: 'var(--text-mid)', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 12, fontFamily: 'Poppins, sans-serif' }}>
                      ✏️ Edit
                    </button>
                    <button onClick={() => { setQuickPayEmpId(emp.id); setQuickPayAmount(''); }} style={{ padding: '8px', background: 'var(--primary-soft)', color: 'var(--primary)', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 12, fontFamily: 'Poppins, sans-serif' }}>
                      💰 Add Payment
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
