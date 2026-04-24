import React, { useState } from 'react';

const EMPTY_EMP = {
  name: '', role: '', department: 'Management', email: '',
  phone: '', joinDate: '', status: 'active', notes: '',
};

const STATUS_COLORS = {
  active: { bg: '#ECFDF3', color: '#0D9F5F' },
  inactive: { bg: '#FEF2F4', color: '#DC143C' },
  onleave: { bg: '#FFFBEB', color: '#D97706' },
};

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

export default function EmployeesView({ employees = [], salaries = [], onAdd, onUpdate, onDelete, onAddSalary, onUpdateSalary, onDeleteSalary }) {
  const [showForm, setShowForm] = useState(false);
  const [editEmp, setEditEmp] = useState(null);
  const [form, setForm] = useState({ ...EMPTY_EMP });
  const [searchQ, setSearchQ] = useState('');
  
  // Projects/Salaries states for the inline modal
  const [showAddSal, setShowAddSal] = useState(false);
  const [editSalId, setEditSalId] = useState(null);
  const [newSal, setNewSal] = useState({ projectName: '', salaryType: 'project', totalSalary: '', status: 'unpaid', notes: '' });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const openAdd = () => { setForm({ ...EMPTY_EMP }); setEditEmp(null); setShowForm(true); };
  const openEdit = (emp) => {
    const validDepts = ['Management', 'Web Development', 'App Development', 'Designing', 'Digital Marketing', 'BlockChain', 'AI'];
    const safeDept = validDepts.includes(emp.department) ? emp.department : 'Management';
    setForm({ ...emp, department: safeDept });
    setEditEmp(emp);
    setShowForm(true);
  };
  const cancel = () => { setShowForm(false); setEditEmp(null); setShowAddSal(false); setEditSalId(null); };

  const save = () => {
    if (!form.name.trim()) { alert('Employee name is required.'); return; }
    const emp = {
      ...form,
      id: editEmp ? editEmp.id : `emp-${Date.now()}`,
      createdAt: editEmp ? editEmp.createdAt : new Date().toISOString(),
    };
    if (editEmp) {
      onUpdate(emp.id, emp);
    } else {
      onAdd(emp);
    }
    setShowForm(false);
    setEditEmp(null);
    setShowAddSal(false);
  };

  const handleAddSal = () => {
    if (!newSal.totalSalary) { alert('Amount is required.'); return; }
    
    if (editSalId) {
      onUpdateSalary(editSalId, {
        projectName: newSal.projectName,
        salaryType: newSal.salaryType,
        totalSalary: Number(newSal.totalSalary) || 0,
        status: newSal.status,
      });
    } else {
      onAddSalary({
        employeeName: editEmp.name,
        projectName: newSal.projectName,
        salaryType: newSal.salaryType,
        totalSalary: Number(newSal.totalSalary) || 0,
        paidAmount: 0,
        status: newSal.status,
        month: new Date().toISOString().substring(0, 7),
        id: `sal-${Date.now()}`,
        createdAt: new Date().toISOString()
      });
    }
    setNewSal({ projectName: '', salaryType: 'project', totalSalary: '', status: 'unpaid', notes: '' });
    setShowAddSal(false);
    setEditSalId(null);
  };

  const filtered = employees.filter(e =>
    !searchQ || e.name?.toLowerCase().includes(searchQ.toLowerCase()) ||
    e.role?.toLowerCase().includes(searchQ.toLowerCase()) ||
    e.department?.toLowerCase().includes(searchQ.toLowerCase())
  );

  // stats
  const activeCount = employees.filter(e => e.status === 'active').length;
  const totalBaseSalary = employees.reduce((s, e) => s + (Number(e.baseSalary) || 0), 0);
  const totalPaidOut = salaries.reduce((s, sal) => s + (Number(sal.paidAmount) || 0), 0);

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 2 }}>Employees</h1>
          <div style={{ fontSize: 12, color: 'var(--text-light)' }}>Manage your team — link employees to salary records</div>
        </div>
        <button
          onClick={openAdd}
          style={{
            background: 'var(--primary)', color: '#fff', border: 'none',
            borderRadius: 8, padding: '10px 20px', fontSize: 13, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'Poppins, sans-serif', display: 'flex', alignItems: 'center', gap: 8,
          }}
        >
          + Add Employee
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Active Employees', val: activeCount, color: 'var(--success)', prefix: '' },
          { label: 'Total Base Salary / Mo', val: `AED ${totalBaseSalary.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, color: 'var(--warning)', raw: true },
          { label: 'Total Paid Out (All Time)', val: `AED ${totalPaidOut.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, color: 'var(--info)', raw: true },
        ].map(({ label, val, color, raw }) => (
          <div key={label} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 20px', boxShadow: 'var(--shadow)' }}>
            <div style={{ fontSize: 11, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 600, marginBottom: 8 }}>{label}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color }}>{val}</div>
          </div>
        ))}
      </div>

      {/* Add / Edit Form */}
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
              { label: 'Join Date', key: 'joinDate', type: 'date', placeholder: '' },
            ].map(({ label, key, type, placeholder }) => (
              <div key={key}>
                <div style={{ fontSize: 11, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 4, fontWeight: 600 }}>{label}</div>
                <input
                  type={type}
                  value={form[key] || ''}
                  placeholder={placeholder}
                  onChange={e => set(key, type === 'number' ? e.target.value : e.target.value)}
                  className="form-input"
                />
              </div>
            ))}
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 4, fontWeight: 600 }}>Department</div>
              <select value={form.department} onChange={e => set('department', e.target.value)} className="form-select">
                {['Management', 'Web Development', 'App Development', 'Designing', 'Digital Marketing', 'BlockChain', 'AI'].map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
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
            <textarea
              value={form.notes || ''}
              onChange={e => set('notes', e.target.value)}
              placeholder="Skills, contract type, additional info..."
              className="form-input"
              rows={2}
              style={{ resize: 'vertical', minHeight: 60 }}
            />
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginBottom: 24 }}>
            <button onClick={cancel} style={{ padding: '9px 20px', border: '1px solid var(--border)', borderRadius: 8, background: 'transparent', cursor: 'pointer', fontFamily: 'Poppins, sans-serif', fontSize: 13 }}>Cancel</button>
            <button onClick={save} style={{ padding: '9px 20px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontFamily: 'Poppins, sans-serif', fontSize: 13 }}>
              {editEmp ? 'Save Changes' : 'Add Employee'}
            </button>
          </div>

          {editEmp && (
            <div style={{ paddingTop: 24, borderTop: '1px solid var(--border-light)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-mid)', textTransform: 'uppercase', letterSpacing: 1.5 }}>Projects & Salaries</h3>
                <button onClick={() => {
                  setNewSal({ projectName: '', salaryType: 'project', totalSalary: '', status: 'unpaid', notes: '' });
                  setEditSalId(null);
                  setShowAddSal(!showAddSal);
                }} style={{ background: 'var(--primary-soft)', color: 'var(--primary)', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
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
                        {[{ val: 'project', label: '📦 Project' }, { val: 'monthly', label: '🔄 Monthly' }].map(({ val, label }) => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => setNewSal({ ...newSal, salaryType: val })}
                            style={{
                              flex: 1, padding: '7px 6px', borderRadius: 8, fontSize: 11, fontWeight: 600,
                              cursor: 'pointer', fontFamily: 'Poppins,sans-serif', transition: 'all 0.15s',
                              border: newSal.salaryType === val ? '2px solid var(--primary)' : '1.5px solid var(--border)',
                              background: newSal.salaryType === val ? 'var(--primary-soft)' : 'var(--input-bg)',
                              color: newSal.salaryType === val ? 'var(--primary)' : 'var(--text-mid)',
                            }}
                          >{label}</button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 4, fontWeight: 600 }}>Amount (AED)</div>
                      <input type="number" className="form-input" value={newSal.totalSalary} onChange={e => setNewSal({ ...newSal, totalSalary: e.target.value })} placeholder="0" />
                    </div>
                    <div>
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

              {/* Existing Salaries List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(() => {
                  const empSals = salaries.filter(s => s.employeeName?.trim().toLowerCase() === editEmp.name?.trim().toLowerCase());
                  if (empSals.length === 0) return <div style={{ fontSize: 12, color: 'var(--text-light)' }}>No salaries or projects assigned yet.</div>;
                  return empSals.map(s => (
                    <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg)', padding: '10px 14px', borderRadius: 8, fontSize: 12, border: '1px solid var(--border)' }}>
                      <div>
                        <div style={{ fontWeight: 600 }}>{s.projectName || '—'}</div>
                        <div style={{ color: 'var(--text-light)', fontSize: 11, marginTop: 2 }}>
                          {s.salaryType === 'monthly' ? '🔄 Monthly' : '📦 Project'} · Status: <span style={{ textTransform: 'capitalize' }}>{s.status}</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <div style={{ fontWeight: 700, color: 'var(--warning)', fontSize: 13 }}>AED {Number(s.totalSalary).toLocaleString()}</div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => {
                            setNewSal({ projectName: s.projectName, salaryType: s.salaryType, totalSalary: s.totalSalary, status: s.status, notes: s.notes });
                            setEditSalId(s.id);
                            setShowAddSal(true);
                          }} style={{ background: 'var(--primary-soft)', border: '1px solid var(--border-light)', color: 'var(--primary)', cursor: 'pointer', width: 24, height: 24, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10 }}>✏️</button>
                          <button onClick={() => { if(window.confirm('Delete this salary record?')) onDeleteSalary(s.id); }} style={{ background: 'var(--bg)', border: '1px solid var(--border-light)', color: 'var(--text-faint)', cursor: 'pointer', width: 24, height: 24, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                        </div>
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 20, maxWidth: 380 }}>
        <input
          className="search-input"
          value={searchQ}
          onChange={e => setSearchQ(e.target.value)}
          placeholder="Search employees..."
        />
        <div className="search-icon" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-faint)' }}>🔍</div>
      </div>

      {/* Employee Cards */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-light)' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>👤</div>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>{employees.length === 0 ? 'No employees yet' : 'No results found'}</div>
          <div style={{ fontSize: 13 }}>{employees.length === 0 ? 'Add your first employee to get started.' : 'Try a different search.'}</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {filtered.map(emp => {
            const empSalaries = salaries.filter(s => s.employeeName?.trim().toLowerCase() === emp.name?.trim().toLowerCase());
            const totalPaid = empSalaries.reduce((s, x) => s + (Number(x.paidAmount) || 0), 0);
            const st = STATUS_COLORS[emp.status] || STATUS_COLORS.active;
            return (
              <div key={emp.id} className="card" style={{ padding: '18px 20px', position: 'relative' }}>
                {/* Delete */}
                <button
                  onClick={() => { if (window.confirm(`Remove ${emp.name}?`)) onDelete(emp.id); }}
                  style={{ position: 'absolute', top: 12, right: 12, background: 'none', border: 'none', color: 'var(--text-faint)', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}
                  title="Delete"
                >×</button>

                {/* Avatar + name */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                  <Avatar name={emp.name} />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{emp.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-light)' }}>{emp.role}{emp.department ? ` · ${emp.department}` : ''}</div>
                  </div>
                  <span style={{ marginLeft: 'auto', marginRight: 28, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, background: st.bg, color: st.color, borderRadius: 20, padding: '3px 10px' }}>
                    {emp.status === 'onleave' ? 'On Leave' : emp.status}
                  </span>
                </div>

                {/* Info grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 14px', fontSize: 12, marginBottom: 14 }}>
                  {emp.email && <div><span style={{ color: 'var(--text-faint)' }}>📧 </span>{emp.email}</div>}
                  {emp.phone && <div><span style={{ color: 'var(--text-faint)' }}>📞 </span>{emp.phone}</div>}
                  {emp.joinDate && <div><span style={{ color: 'var(--text-faint)' }}>📅 Joined: </span>{new Date(emp.joinDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</div>}
                </div>

                {/* Salary summary */}
                {empSalaries.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                    {empSalaries.map(s => (
                      <div key={s.id} style={{ background: 'var(--bg)', borderRadius: 8, padding: '8px 12px', fontSize: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ background: 'var(--border)', color: 'var(--text-mid)', padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                            {s.salaryType === 'monthly' ? 'Monthly' : 'Project Based'}
                          </span>
                          {s.projectName && <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{s.projectName}</span>}
                        </div>
                        <span style={{ fontWeight: 700, color: 'var(--warning)' }}>AED {Number(s.totalSalary).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                )}

                {emp.notes && (
                  <div style={{ fontSize: 11, color: 'var(--text-light)', fontStyle: 'italic', borderTop: '1px solid var(--border-light)', paddingTop: 8, marginBottom: 10 }}>{emp.notes}</div>
                )}

                <button
                  onClick={() => openEdit(emp)}
                  style={{ width: '100%', padding: '8px', background: 'var(--primary-soft)', color: 'var(--primary)', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 12, fontFamily: 'Poppins, sans-serif' }}
                >
                  ✏️ Edit Employee
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
