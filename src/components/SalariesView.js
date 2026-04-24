import React, { useState, useCallback, useEffect } from 'react';

function currentYM() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const EMPTY_SALARY_ROW = {
  employeeName: '',
  projectName: '',
  totalSalary: 0,
  paidAmount: 0,
  status: 'unpaid'
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

export default function SalariesView({ salaries, onUpdate, onAdd, onDelete }) {
  const [showAddRow, setShowAddRow] = useState(false);
  const [newRow, setNewRow] = useState({ ...EMPTY_SALARY_ROW, month: currentYM() });

  const totalPool = salaries.reduce((sum, s) => sum + (Number(s.totalSalary) || 0), 0);
  const totalPaid = salaries.reduce((sum, s) => sum + (Number(s.paidAmount) || 0), 0);
  const totalRemaining = totalPool - totalPaid;

  const updateRow = useCallback((id, patch) => {
    onUpdate(id, patch);
  }, [onUpdate]);

  const handleFieldSave = (row, field, rawVal) => {
    const val = field === 'employeeName' || field === 'projectName' ? rawVal : Number(rawVal) || 0;
    const updated = { ...row, [field]: val };
    
    // Auto-update status based on paid vs total
    const total = Number(updated.totalSalary) || 0;
    const paid = Number(updated.paidAmount) || 0;
    
    if (paid >= total && total > 0) {
      updated.status = 'paid';
    } else if (paid > 0) {
      updated.status = 'partial';
    } else {
      updated.status = 'unpaid';
    }

    updateRow(row.id, updated);
  };

  return (
    <div className="animate-fade-in">
      {/* Page header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 2 }}>Salaries Tracker</h1>
          <div style={{ fontSize: 12, color: 'var(--text-light)' }}>Track individual employee payouts and balances cross-project</div>
        </div>
        <button
          onClick={() => { setNewRow({ ...EMPTY_SALARY_ROW, month: currentYM() }); setShowAddRow(true); }}
          style={{
            background: 'var(--primary)', color: '#fff', border: 'none',
            borderRadius: 8, padding: '10px 20px', fontSize: 13, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'Poppins, sans-serif', display: 'flex', alignItems: 'center', gap: 8,
          }}
        >
          + Custom Salary
        </button>
      </div>

      {/* Summary bar */}
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

      {/* Manual add row form */}
      {showAddRow && (
        <div style={{ background: 'var(--card)', border: '1.5px solid var(--primary)', borderRadius: 12, padding: 20, marginBottom: 24, boxShadow: 'var(--shadow-md)' }}>
          <div style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 14 }}>Add Custom Salary</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 16 }}>
            {[
              { label: 'Employee Name', key: 'employeeName', type: 'text' },
              { label: 'Project Name', key: 'projectName', type: 'text' },
              { label: 'Total Salary', key: 'totalSalary', type: 'number' },
              { label: 'Paid Amount', key: 'paidAmount', type: 'number' },
            ].map(({ label, key, type }) => (
              <div key={key}>
                <div style={{ fontSize: 11, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 4, fontWeight: 600 }}>{label}</div>
                <input
                  type={type}
                  value={newRow[key]}
                  onChange={(e) => setNewRow((r) => ({ ...r, [key]: type === 'number' ? Number(e.target.value) : e.target.value }))}
                  className="form-input"
                />
              </div>
            ))}
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

      {/* Table */}
      {salaries.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-light)' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>💼</div>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>No salary records available</div>
          <div style={{ fontSize: 13 }}>Create invoices or add a custom salary to get started.</div>
        </div>
      ) : (
        <div className="finance-table-wrap">
          <table className="finance-table">
            <thead>
              <tr>
                <th>Employee Name</th>
                <th>Project / Client</th>
                <th style={{ textAlign: 'right' }}>Total Salary</th>
                <th style={{ textAlign: 'right' }}>Paid</th>
                <th style={{ textAlign: 'right' }}>Remaining</th>
                <th style={{ textAlign: 'center' }}>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {salaries.map((row) => {
                const total = Number(row.totalSalary) || 0;
                const paid = Number(row.paidAmount) || 0;
                const remaining = Math.max(0, total - paid);
                const rowStatus = row.status || 'unpaid';
                const rowBorder = rowStatus === 'paid' ? '#0D9F5F' : rowStatus === 'partial' ? '#D97706' : '#DC143C';
                
                return (
                  <tr key={row.id} style={{ borderLeft: `3px solid ${rowBorder}` }}>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>
                        <EditCell value={row.employeeName} type="text" onSave={(v) => handleFieldSave(row, 'employeeName', v)} />
                      </div>
                      {row.invoiceId && (
                        <div style={{ fontSize: 10, color: 'var(--text-faint)', marginTop: 2 }}>From Inv #{row.invoiceId}</div>
                      )}
                    </td>
                    <td>
                      <div style={{ color: 'var(--text-mid)', fontWeight: 500 }}>
                        <EditCell value={row.projectName} type="text" onSave={(v) => handleFieldSave(row, 'projectName', v)} />
                      </div>
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
                      <StatusPill status={rowStatus} />
                    </td>
                    <td style={{ textAlign: 'right' }}>
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

      {salaries.length > 0 && (
        <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-faint)', textAlign: 'right' }}>
          💡 Click any value to edit inline.
        </div>
      )}
    </div>
  );
}
