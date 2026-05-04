import React, { useState, useCallback, useEffect } from 'react';
import { nextYM } from '../utils/helpers';

function fmtMonth(ym) {
  const [y, m] = ym.split('-');
  return new Date(Number(y), Number(m) - 1, 1)
    .toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function currentYM() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const EMPTY_SALARY_ROW = {
  employeeName: '',
  projectName: '',
  totalSalary: 0,
  paidAmount: 0,
  status: 'unpaid',
  salaryType: 'project'
};

function EditCell({ value, onSave, prefix = '', type = 'number', style = {} }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value);

  useEffect(() => { setVal(value); }, [value]);

  if (editing) {
    return (
      <input
        autoFocus
        type={type}
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={() => { setEditing(false); onSave(val); }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { setEditing(false); onSave(val); }
          if (e.key === 'Escape') { setEditing(false); setVal(value); }
        }}
        style={{
          width: '100%', minWidth: 80, padding: '4px 8px',
          border: '1.5px solid var(--primary)', borderRadius: 6,
          fontSize: 13, fontFamily: 'Poppins, sans-serif',
          background: '#fff', color: 'var(--text)',
          ...style,
        }}
      />
    );
  }

  return (
    <span
      onClick={() => setEditing(true)}
      title="Click to edit"
      style={{
        cursor: 'pointer', display: 'inline-block', minWidth: 60,
        padding: '2px 4px', borderRadius: 4,
        borderBottom: '1px dashed var(--border)',
        transition: 'background 0.15s',
        ...style,
      }}
      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--primary-soft)'}
      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
    >
      {prefix}{typeof value === 'number' ? value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : value}
    </span>
  );
}

function StatusPill({ status }) {
  const map = { paid: ['#0D9F5F', '#ECFDF3'], partial: ['#D97706', '#FFFBEB'], unpaid: ['#DC143C', '#FEF2F4'] };
  const [clr, bg] = map[status] || map.unpaid;
  return (
    <span style={{
      background: bg, color: clr, borderRadius: 20, padding: '3px 10px',
      fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1,
      display: 'inline-block'
    }}>
      {status}
    </span>
  );
}

function InvoiceEditCell({ value, invoices = [], onSave }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value || '');

  useEffect(() => { setVal(value || ''); }, [value]);

  if (editing) {
    return (
      <select
        autoFocus
        value={val}
        onChange={(e) => {
          setVal(e.target.value);
          setEditing(false);
          onSave(e.target.value);
        }}
        onBlur={() => setEditing(false)}
        style={{ width: '100%', padding: '4px 8px', border: '1.5px solid var(--primary)', borderRadius: 6, fontSize: 13, fontFamily: 'Poppins, sans-serif' }}
      >
        <option value="">-- No Invoice --</option>
        {invoices.map(inv => (
          <option key={inv.invoiceNumber} value={inv.invoiceNumber}>
            #{inv.invoiceNumber} - {inv.clientName}
          </option>
        ))}
      </select>
    );
  }

  return (
    <span onClick={() => setEditing(true)} title="Click to edit invoice" style={{ cursor: 'pointer', display: 'inline-block', borderBottom: '1px dashed var(--border)', fontSize: 10, color: 'var(--text-faint)', marginTop: 2 }}>
      {value ? `From Inv #${value}` : 'Link Invoice +'}
    </span>
  );
}

function ProjectClientEditCell({ value, clients = [], onSave }) {
  const [editing, setEditing] = useState(false);
  const [selectedClient, setSelectedClient] = useState('');

  if (editing) {
    const clientObj = clients.find(c => c.name === selectedClient);
    const projects = clientObj ? clientObj.projects || [] : [];
    
    return (
      <div style={{ position: 'absolute', zIndex: 10, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, padding: 10, boxShadow: 'var(--shadow-md)', minWidth: 200, marginTop: 4 }}>
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--text-light)', marginBottom: 4 }}>Select Client</div>
          <select 
            autoFocus
            value={selectedClient} 
            onChange={(e) => setSelectedClient(e.target.value)}
            style={{ width: '100%', padding: '6px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 12 }}
          >
            <option value="">-- Choose Client --</option>
            {clients.map(c => (
              <option key={c.name} value={c.name}>{c.name}</option>
            ))}
          </select>
        </div>
        
        {selectedClient && (
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--text-light)', marginBottom: 4 }}>Select Project</div>
            <select 
              onChange={(e) => {
                const proj = e.target.value;
                setEditing(false);
                onSave(proj ? `${selectedClient} - ${proj}` : selectedClient);
              }}
              style={{ width: '100%', padding: '6px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 12 }}
            >
              <option value="">-- Choose Project --</option>
              {projects.map(p => (
                <option key={p.id} value={p.name}>{p.name}</option>
              ))}
            </select>
          </div>
        )}
        <div style={{ textAlign: 'right' }}>
           <button onClick={() => setEditing(false)} style={{ fontSize: 11, background: 'none', border: 'none', color: 'var(--text-light)', cursor: 'pointer', padding: '4px 8px' }}>Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <span
      onClick={() => setEditing(true)}
      title="Click to edit project"
      style={{
        cursor: 'pointer', display: 'inline-block', minWidth: 60,
        padding: '2px 4px', borderRadius: 4,
        borderBottom: '1px dashed var(--border)',
        transition: 'background 0.15s',
      }}
      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--primary-soft)'}
      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
    >
      {value || 'Assign Project +'}
    </span>
  );
}

function EmployeeEditCell({ value, employees = [], onSave }) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    const activeEmps = employees.filter(e => e.status === 'active' || !e.status);
    return (
      <div style={{ position: 'absolute', zIndex: 10, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, padding: 10, boxShadow: 'var(--shadow-md)', minWidth: 200, marginTop: 4 }}>
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--text-light)', marginBottom: 4 }}>Select Employee</div>
          <select 
            autoFocus
            value={value || ''} 
            onChange={(e) => {
              setEditing(false);
              onSave(e.target.value);
            }}
            style={{ width: '100%', padding: '6px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 12 }}
          >
            <option value="">-- Choose Employee --</option>
            {activeEmps.map(e => (
              <option key={e.id} value={e.name}>{e.name}</option>
            ))}
          </select>
        </div>
        <div style={{ textAlign: 'right' }}>
           <button onClick={() => setEditing(false)} style={{ fontSize: 11, background: 'none', border: 'none', color: 'var(--text-light)', cursor: 'pointer', padding: '4px 8px' }}>Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <span
      onClick={() => setEditing(true)}
      title="Click to select employee"
      style={{
        cursor: 'pointer', display: 'inline-block', minWidth: 80,
        padding: '2px 4px', borderRadius: 4,
        borderBottom: '1px dashed var(--border)',
        transition: 'background 0.15s',
      }}
      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--primary-soft)'}
      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
    >
      {value || 'Assign Employee +'}
    </span>
  );
}

export default function SalariesView({ salaries = [], invoices = [], clients = [], employees = [], onAdd, onUpdate, onDelete, onReorder, onPushToNextMonth }) {
  const months = [...new Set(salaries.map((s) => s.month))].sort((a, b) => b.localeCompare(a));
  const [activeMonth, setActiveMonth] = useState(months[0] || currentYM());
  const [showAddRow, setShowAddRow] = useState(false);
  const [newRow, setNewRow] = useState({ ...EMPTY_SALARY_ROW, month: activeMonth });
  const [dragId, setDragId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);

  const rows = salaries.filter((s) => s.month === activeMonth);

  const totalPool = rows.reduce((sum, s) => sum + (Number(s.totalSalary) || 0), 0);
  const totalPaid = rows.reduce((sum, s) => sum + (Number(s.paidAmount) || 0), 0);
  const totalRemaining = totalPool - totalPaid;

  const updateRow = useCallback((id, patch) => {
    onUpdate(id, patch);
  }, [onUpdate]);

  const handleFieldSave = (row, field, rawVal) => {
    const stringFields = ['employeeName', 'projectName', 'invoiceId', 'salaryType', 'status', 'month'];
    const val = stringFields.includes(field) ? rawVal : Number(rawVal) || 0;
    const updated = { ...row, [field]: val };

    if (field !== 'status') {
      const total = Number(updated.totalSalary) || 0;
      const paid = Number(updated.paidAmount) || 0;
      if (paid >= total && total > 0) updated.status = 'paid';
      else if (paid > 0) updated.status = 'partial';
      else updated.status = 'unpaid';
    }

    updateRow(row.id, updated);
  };

  const handleDragStart = (e, id) => {
    setDragId(id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, id) => {
    e.preventDefault();
    if (id !== dragId) setDragOverId(id);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (!dragId || !dragOverId || dragId === dragOverId) {
      setDragId(null); setDragOverId(null); return;
    }

    const fromIdx = salaries.findIndex(s => s.id === dragId);
    const toIdx = salaries.findIndex(s => s.id === dragOverId);
    
    if (fromIdx === -1 || toIdx === -1) {
      setDragId(null); setDragOverId(null); return;
    }

    const newSalaries = [...salaries];
    const [moved] = newSalaries.splice(fromIdx, 1);
    newSalaries.splice(toIdx, 0, moved);

    // Assign new display order to all items
    const reordered = newSalaries.map((s, idx) => ({ ...s, displayOrder: idx }));

    if (onReorder) onReorder(reordered);
    setDragId(null); setDragOverId(null);
  };

  const handlePushNextMonth = (row) => {
    if (row.status === 'paid') {
      alert('This salary is already fully paid!');
      return;
    }
    
    const next = nextYM(row.month);
    const total = Number(row.totalSalary) || 0;
    const paid = Number(row.paidAmount) || 0;
    const remaining = Math.max(0, total - paid);

    if (paid > 0) {
      // Split the record
      const updatedCurrentRow = { ...row, status: 'pushed' };
      const newNextMonthRow = {
        ...row,
        id: `sal-manual-push-${row.id}-${Date.now()}`,
        month: next,
        totalSalary: remaining,
        paidAmount: 0,
        status: 'unpaid',
        rolledOver: true,
        originalMonth: row.originalMonth || row.month,
        createdAt: new Date().toISOString()
      };
      
      onPushToNextMonth(updatedCurrentRow, newNextMonthRow);
    } else {
      // Completely unpaid, just move it
      const updatedCurrentRow = { ...row, month: next, rolledOver: true };
      onPushToNextMonth(updatedCurrentRow, null);
    }
  };

  return (
    <div className="animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 2 }}>Salaries Tracker</h1>
          <div style={{ fontSize: 12, color: 'var(--text-light)' }}>Track individual employee payouts and balances cross-project</div>
        </div>
        <button
          onClick={() => { setNewRow({ ...EMPTY_SALARY_ROW, month: activeMonth }); setShowAddRow(true); }}
          style={{
            background: 'var(--primary)', color: '#fff', border: 'none',
            borderRadius: 8, padding: '10px 20px', fontSize: 13, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'Poppins, sans-serif', display: 'flex', alignItems: 'center', gap: 8,
          }}
        >
          + Custom Salary
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
        {(months.length === 0 ? [currentYM()] : months).map((m) => (
          <button
            key={m}
            onClick={() => setActiveMonth(m)}
            className={`month-tab ${activeMonth === m ? 'month-tab-active' : ''}`}
          >
            {fmtMonth(m)}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Total Salary Pool', val: totalPool, color: 'var(--text)' },
          { label: 'Total Paid Out', val: totalPaid, color: 'var(--success)' },
          { label: 'Total Remaining', val: totalRemaining, color: 'var(--warning)' },
        ].map(({ label, val, color }) => (
          <div key={label} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 20px', boxShadow: 'var(--shadow)' }}>
            <div style={{ fontSize: 11, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 600, marginBottom: 8 }}>{label}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color }}>AED {val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          </div>
        ))}
      </div>

      {showAddRow && (
        <div style={{ background: 'var(--card)', border: '1.5px solid var(--primary)', borderRadius: 12, padding: 20, marginBottom: 24, boxShadow: 'var(--shadow-md)' }}>
          <div style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 14 }}>Add Custom Salary</div>

          {employees.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 8, fontWeight: 600 }}>👤 Pick from Employees</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {employees.filter(e => e.status === 'active' || !e.status).map(emp => (
                  <button
                    key={emp.id}
                    type="button"
                    onClick={() => setNewRow(r => ({
                      ...r,
                      employeeName: emp.name,
                      totalSalary: Number(emp.baseSalary) || r.totalSalary,
                      salaryType: emp.salaryType || 'monthly',
                    }))}
                    style={{
                      padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                      cursor: 'pointer', fontFamily: 'Poppins,sans-serif', transition: 'all 0.15s',
                      border: newRow.employeeName === emp.name ? '2px solid var(--primary)' : '1.5px solid var(--border)',
                      background: newRow.employeeName === emp.name ? 'var(--primary-soft)' : 'var(--card)',
                      color: newRow.employeeName === emp.name ? 'var(--primary)' : 'var(--text-mid)',
                    }}
                  >
                    {emp.name}
                    {emp.baseSalary > 0 && <span style={{ fontWeight: 400, marginLeft: 6, color: 'var(--text-faint)', fontSize: 10 }}>AED {Number(emp.baseSalary).toLocaleString()}</span>}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 4, fontWeight: 600 }}>Employee Name</div>
              <select
                value={newRow.employeeName || ''}
                onChange={(e) => {
                  const name = e.target.value;
                  setNewRow((r) => ({
                    ...r,
                    employeeName: name,
                  }));
                }}
                className="form-select"
              >
                <option value="">-- Select Employee --</option>
                {employees.filter(e => e.status === 'active' || !e.status).map(e => (
                  <option key={e.id} value={e.name}>{e.name}</option>
                ))}
              </select>
            </div>
            {[
              { label: 'Project Name', key: 'projectName', type: 'text' },
              { label: 'Invoice # (Optional)', key: 'invoiceId', type: 'text' },
              { label: 'Total Salary', key: 'totalSalary', type: 'number' },
              { label: 'Paid Amount', key: 'paidAmount', type: 'number' },
            ].map(({ label, key, type }) => (
              <div key={key}>
                <div style={{ fontSize: 11, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 4, fontWeight: 600 }}>{label}</div>
                <input
                  type={type}
                  value={newRow[key] || ''}
                  onChange={(e) => setNewRow((r) => ({ ...r, [key]: type === 'number' ? Number(e.target.value) : e.target.value }))}
                  className="form-input"
                />
              </div>
            ))}
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 4, fontWeight: 600 }}>Salary Type</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
                {[{ val: 'project', label: '📦 Project' }, { val: 'monthly', label: '🔄 Monthly' }].map(({ val, label }) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setNewRow(r => ({ ...r, salaryType: val }))}
                    style={{
                      flex: 1, padding: '8px 6px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                      cursor: 'pointer', fontFamily: 'Poppins,sans-serif', transition: 'all 0.15s',
                      border: (newRow.salaryType || 'project') === val ? '2px solid var(--primary)' : '1.5px solid var(--border)',
                      background: (newRow.salaryType || 'project') === val ? 'var(--primary-soft)' : 'var(--input-bg)',
                      color: (newRow.salaryType || 'project') === val ? 'var(--primary)' : 'var(--text-mid)',
                    }}
                  >{label}</button>
                ))}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 4, fontWeight: 600 }}>Status</div>
              <select
                value={newRow.status}
                onChange={(e) => setNewRow((r) => ({ ...r, status: e.target.value }))}
                className="form-select"
              >
                <option value="unpaid">Unpaid</option>
                <option value="partial">Partial</option>
                <option value="paid">Paid</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button onClick={() => setShowAddRow(false)} style={{ padding: '8px 18px', border: '1px solid var(--border)', borderRadius: 8, background: 'transparent', cursor: 'pointer', fontFamily: 'Poppins, sans-serif', fontSize: 13 }}>Cancel</button>
            <button
              onClick={() => {
                const row = {
                  ...newRow,
                  id: `man-sal-${Date.now()}`,
                  createdAt: new Date().toISOString(),
                };
                onAdd(row);
                setShowAddRow(false);
              }}
              style={{ padding: '8px 18px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontFamily: 'Poppins, sans-serif', fontSize: 13 }}
            >
              Add Salary
            </button>
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-light)' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>💼</div>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>No salary records for {fmtMonth(activeMonth)}</div>
          <div style={{ fontSize: 13 }}>Create invoices or add a custom salary to get started.</div>
        </div>
      ) : (
        <div className="finance-table-wrap">
          <table className="finance-table" onDragOver={e => e.preventDefault()} onDrop={handleDrop}>
            <thead>
              <tr>
                <th style={{ width: 40 }}></th>
                <th>Employee Name</th>
                <th>Project / Client</th>
                <th style={{ textAlign: 'center' }}>Type</th>
                <th style={{ textAlign: 'right' }}>Total Salary</th>
                <th style={{ textAlign: 'right' }}>Paid</th>
                <th style={{ textAlign: 'right' }}>Remaining</th>
                <th style={{ textAlign: 'center' }}>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const total = Number(row.totalSalary) || 0;
                const paid = Number(row.paidAmount) || 0;
                const remaining = Math.max(0, total - paid);
                const rowStatus = row.status || 'unpaid';
                const rowBorder = rowStatus === 'paid' ? '#0D9F5F' : rowStatus === 'partial' ? '#D97706' : '#DC143C';
                const isDragTarget = dragOverId === row.id && dragId !== row.id;
                
                return (
                  <tr 
                    key={row.id} 
                    draggable
                    onDragStart={e => handleDragStart(e, row.id)}
                    onDragOver={e => handleDragOver(e, row.id)}
                    onDragEnd={() => { setDragId(null); setDragOverId(null); }}
                    style={{ 
                      borderLeft: `3px solid ${rowBorder}`,
                      opacity: dragId === row.id ? 0.45 : 1,
                      borderTop: isDragTarget ? '2px solid var(--primary)' : 'none',
                      cursor: 'grab'
                    }}
                  >
                    <td style={{ color: 'var(--text-faint)', fontSize: 16, textAlign: 'center', cursor: 'grab', userSelect: 'none' }}>⠿</td>
                    <td style={{ position: 'relative' }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>
                        <EmployeeEditCell value={row.employeeName} employees={employees} onSave={(v) => handleFieldSave(row, 'employeeName', v)} />
                      </div>
                      {row.rolledOver && (
                        <span style={{ fontSize: 10, color: 'var(--info)', background: 'var(--info-soft)', borderRadius: 4, padding: '1px 6px', marginTop: 2, display: 'inline-block' }}>
                          ↩ carried over
                        </span>
                      )}
                      <InvoiceEditCell value={row.invoiceId} invoices={invoices} onSave={(v) => handleFieldSave(row, 'invoiceId', v)} />
                    </td>
                    <td style={{ position: 'relative' }}>
                      <div style={{ color: 'var(--text-mid)', fontWeight: 500 }}>
                        <ProjectClientEditCell value={row.projectName} clients={clients} onSave={(v) => handleFieldSave(row, 'projectName', v)} />
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        onClick={() => handleFieldSave(row, 'salaryType', row.salaryType === 'monthly' ? 'project' : 'monthly')}
                        title="Click to toggle type"
                        style={{
                          fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8,
                          border: 'none', borderRadius: 6, padding: '3px 10px', cursor: 'pointer',
                          fontFamily: 'Poppins,sans-serif',
                          background: row.salaryType === 'monthly' ? 'var(--info-soft)' : 'var(--border-light)',
                          color: row.salaryType === 'monthly' ? 'var(--info)' : 'var(--text-mid)',
                        }}
                      >
                        {row.salaryType === 'monthly' ? '🔄 Monthly' : '📦 Project'}
                      </button>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600, fontSize: 14 }}>
                      <EditCell value={total} onSave={(v) => handleFieldSave(row, 'totalSalary', v)} prefix="AED " />
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--success)', fontSize: 14 }}>
                      <EditCell value={paid} onSave={(v) => handleFieldSave(row, 'paidAmount', v)} prefix="AED " />
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: remaining > 0 ? 'var(--warning)' : 'var(--text-mid)', fontSize: 14 }}>
                      AED {remaining.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <StatusPill status={rowStatus === 'pushed' ? 'paid' : rowStatus} />
                    </td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {rowStatus !== 'paid' && rowStatus !== 'pushed' && (
                        <button
                          onClick={() => handlePushNextMonth(row)}
                          style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', padding: '4px 8px', fontSize: 13, fontWeight: 600, marginRight: 8, fontFamily: 'Poppins, sans-serif' }}
                          title="Push to Next Month"
                        >
                          Push ⏭️
                        </button>
                      )}
                      <button
                        onClick={() => { if (window.confirm('Delete this salary record?')) onDelete(row.id); }}
                        style={{ background: 'none', border: 'none', color: 'var(--text-faint)', cursor: 'pointer', padding: 4, fontSize: 18, lineHeight: 1 }}
                        title="Delete"
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {rows.length > 0 && (
        <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-faint)', textAlign: 'right' }}>
          💡 Click any value to edit inline. Drag ⠿ to reorder.
        </div>
      )}
    </div>
  );
}
