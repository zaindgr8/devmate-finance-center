import React, { useState, useEffect } from 'react';

// ── tiny helpers ──────────────────────────────────────────────────
function calcProfit(r) {
  return (Number(r.paidAmount) || 0)
    - (Number(r.totalSalaries) || 0)
    - (Number(r.allahShare) || 0)
    - (Number(r.saving) || 0);
}

function calcAllahShare(r) {
  const base = (Number(r.paidAmount) || 0) - (Number(r.totalSalaries) || 0);
  return Math.max(0, base * 0.05);
}

function fmtMonth(ym) {
  const [y, m] = ym.split('-');
  return new Date(Number(y), Number(m) - 1, 1)
    .toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function currentYM() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const EMPTY_ROW = {
  clientName: '', totalAmount: 0, paidAmount: 0, paymentType: 'project',
  salaries: [], totalSalaries: 0, allahShare: 0, saving: 0, profit: 0,
  status: 'unpaid', notes: '', rolledOver: false,
};

// ── inline edit cell ──────────────────────────────────────────────
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

// ── salary badge ──────────────────────────────────────────────────
function SalaryBadge({ salaries }) {
  const [open, setOpen] = useState(false);
  if (!salaries || salaries.length === 0) return <span style={{ color: 'var(--text-faint)', fontSize: 12 }}>—</span>;
  const total = salaries.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          background: 'var(--warning-soft)', color: 'var(--warning)',
          border: 'none', borderRadius: 6, padding: '3px 10px',
          fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'Poppins, sans-serif',
        }}
      >
        AED {total.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} ▾
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '110%', left: 0, zIndex: 50,
          background: 'var(--card)', border: '1px solid var(--border)',
          borderRadius: 8, padding: '10px 14px', minWidth: 180,
          boxShadow: '0 8px 30px rgba(0,0,0,0.10)',
        }}>
          {salaries.map((e, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '3px 0', borderBottom: '1px solid var(--border-light)' }}>
              <span style={{ color: 'var(--text-mid)' }}>{e.employee || 'Unknown'}</span>
              <span style={{ fontWeight: 600 }}>AED {Number(e.amount).toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── status badge ──────────────────────────────────────────────────
function StatusPill({ status }) {
  const map = { paid: ['#0D9F5F', '#ECFDF3'], partial: ['#D97706', '#FFFBEB'], unpaid: ['#DC143C', '#FEF2F4'] };
  const [clr, bg] = map[status] || map.unpaid;
  return (
    <span style={{
      background: bg, color: clr, borderRadius: 20, padding: '3px 10px',
      fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1,
    }}>
      {status}
    </span>
  );
}

// ── main component ────────────────────────────────────────────────
export default function FinanceView({ finance, onUpdate, onAdd, onDelete, currency = 'USD' }) {
  const months = [...new Set(finance.map((r) => r.month))].sort((a, b) => b.localeCompare(a));
  const [activeMonth, setActiveMonth] = useState(months[0] || currentYM());
  const [showAddRow, setShowAddRow] = useState(false);
  const [newRow, setNewRow] = useState({ ...EMPTY_ROW, month: activeMonth });

  const rows = finance.filter((r) => r.month === activeMonth);

  // summary - only include confirmed (not pending, not scheduled) in metrics other than Total Invoiced
  const sum = rows.reduce((acc, r) => {
    const isConfirmed = r.status !== 'pending' && r.status !== 'scheduled';
    return {
      total: acc.total + (Number(r.totalAmount) || 0),
      paid: acc.paid + (isConfirmed ? (Number(r.paidAmount) || 0) : 0),
      salaries: acc.salaries + (isConfirmed ? (Number(r.totalSalaries) || 0) : 0),
      allah: acc.allah + (isConfirmed ? (Number(r.allahShare) || 0) : 0),
      saving: acc.saving + (isConfirmed ? (Number(r.saving) || 0) : 0),
      profit: acc.profit + (isConfirmed ? calcProfit(r) : 0),
    };
  }, { total: 0, paid: 0, salaries: 0, allah: 0, saving: 0, profit: 0 });

  const updateRow = (id, patch) => {
    onUpdate(id, patch);
  };

  const handleFieldSave = (row, field, rawVal) => {
    const val = field === 'notes' || field === 'clientName' ? rawVal : Number(rawVal) || 0;
    const updated = { ...row, [field]: val };

    // recalculate allah share if paidAmount or totalSalaries changed
    if (field === 'paidAmount' || field === 'totalSalaries') {
      if (!row._allahManual) {
        updated.allahShare = calcAllahShare(updated);
      }
    }
    updated.profit = calcProfit(updated);
    updateRow(row.id, updated);
  };

  const handleAllahSave = (row, val) => {
    const updated = { ...row, allahShare: Number(val) || 0, _allahManual: true };
    updated.profit = calcProfit(updated);
    updateRow(row.id, updated);
  };

  return (
    <div className="animate-fade-in">
      {/* Page header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 2 }}>Finance Ledger</h1>
          <div style={{ fontSize: 12, color: 'var(--text-light)' }}>Monthly accounts · auto-synced from invoices</div>
        </div>
        <button
          onClick={() => { setNewRow({ ...EMPTY_ROW, month: activeMonth }); setShowAddRow(true); }}
          style={{
            background: 'var(--primary)', color: '#fff', border: 'none',
            borderRadius: 8, padding: '10px 20px', fontSize: 13, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'Poppins, sans-serif', display: 'flex', alignItems: 'center', gap: 8,
          }}
        >
          + Manual Entry
        </button>
      </div>

      {/* Month tabs */}
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

      {/* Summary bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10, marginBottom: 22 }}>
        {[
          { label: 'Total Invoiced', val: sum.total, color: 'var(--text)' },
          { label: 'Total Received', val: sum.paid, color: 'var(--info)' },
          { label: 'Salaries', val: sum.salaries, color: 'var(--warning)' },
          { label: "Allah's Share", val: sum.allah, color: '#8B5CF6' },
          { label: 'Saving', val: sum.saving, color: 'var(--success)' },
          { label: 'Net Profit', val: sum.profit, color: sum.profit >= 0 ? 'var(--success)' : 'var(--primary)' },
        ].map(({ label, val, color }) => (
          <div key={label} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', boxShadow: 'var(--shadow)' }}>
            <div style={{ fontSize: 10, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 600, marginBottom: 6 }}>{label}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color }}>AED {val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          </div>
        ))}
      </div>

      {/* Manual add row form */}
      {showAddRow && (
        <div style={{ background: 'var(--card)', border: '1.5px solid var(--primary)', borderRadius: 12, padding: 20, marginBottom: 18, boxShadow: 'var(--shadow-md)' }}>
          <div style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 14 }}>Manual Entry</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 12 }}>
            {[
              { label: 'Client Name', key: 'clientName', type: 'text' },
              { label: 'Total Amount', key: 'totalAmount', type: 'number' },
              { label: 'Paid Amount', key: 'paidAmount', type: 'number' },
              { label: 'Total Salaries', key: 'totalSalaries', type: 'number' },
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
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 14 }}>
            {[
              { label: "Allah's Share (5%)", key: 'allahShare', type: 'number' },
              { label: 'Saving', key: 'saving', type: 'number' },
            ].map(({ label, key, type }) => (
              <div key={key}>
                <div style={{ fontSize: 11, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 4, fontWeight: 600 }}>{label}</div>
                <input
                  type={type}
                  value={newRow[key]}
                  onChange={(e) => setNewRow((r) => ({ ...r, [key]: Number(e.target.value) }))}
                  className="form-input"
                />
              </div>
            ))}
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 4, fontWeight: 600 }}>Payment Type</div>
              <select
                value={newRow.paymentType}
                onChange={(e) => setNewRow((r) => ({ ...r, paymentType: e.target.value }))}
                className="form-select"
              >
                <option value="project">Project (One-time)</option>
                <option value="recurring">Recurring (Monthly)</option>
              </select>
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
                  id: `manual-${Date.now()}`,
                  profit: (newRow.paidAmount || 0) - (newRow.totalSalaries || 0) - (newRow.allahShare || 0) - (newRow.saving || 0),
                  createdAt: new Date().toISOString(),
                };
                onAdd(row);
                setShowAddRow(false);
              }}
              style={{ padding: '8px 18px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontFamily: 'Poppins, sans-serif', fontSize: 13 }}
            >
              Add Entry
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      {rows.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-light)' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📊</div>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>No finance records for {fmtMonth(activeMonth)}</div>
          <div style={{ fontSize: 13 }}>Create invoices or add a manual entry to get started.</div>
        </div>
      ) : (
        <div className="finance-table-wrap">
          <table className="finance-table">
            <thead>
              <tr>
                {['Client', 'Type', 'Total', 'Received', 'Salaries', 'Allah Share', 'Saving', 'Profit', 'Status', ''].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const rowStatus = row.status || 'unpaid';
                const rowBorder = rowStatus === 'paid' ? '#0D9F5F' : rowStatus === 'partial' ? '#D97706' : '#DC143C';
                return (
                  <tr key={row.id} style={{ borderLeft: `3px solid ${rowBorder}` }}>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>
                        <EditCell value={row.clientName} type="text" onSave={(v) => handleFieldSave(row, 'clientName', v)} />
                      </div>
                      {row.rolledOver && (
                        <span style={{ fontSize: 10, color: 'var(--info)', background: 'var(--info-soft)', borderRadius: 4, padding: '1px 6px', marginTop: 2, display: 'inline-block' }}>
                          ↩ carried over
                        </span>
                      )}
                    </td>
                    <td>
                      <span style={{
                        fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8,
                        color: row.paymentType === 'recurring' ? 'var(--info)' : 'var(--text-mid)',
                        background: row.paymentType === 'recurring' ? 'var(--info-soft)' : 'var(--border-light)',
                        borderRadius: 6, padding: '3px 8px',
                      }}>
                        {row.paymentType === 'recurring' ? '🔄 Recurring' : '📦 Project'}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600 }}>
                      <EditCell value={Number(row.totalAmount) || 0} onSave={(v) => handleFieldSave(row, 'totalAmount', v)} prefix="AED " />
                    </td>
                    <td style={{ color: 'var(--info)', fontWeight: 600 }}>
                      <EditCell value={Number(row.paidAmount) || 0} onSave={(v) => handleFieldSave(row, 'paidAmount', v)} prefix="AED " />
                    </td>
                    <td>
                      <SalaryBadge salaries={row.salaries} />
                      {row.salaries && row.salaries.length > 0 && (
                        <div style={{ fontSize: 11, color: 'var(--warning)', marginTop: 2 }}>
                          <EditCell
                            value={Number(row.totalSalaries) || 0}
                            onSave={(v) => handleFieldSave(row, 'totalSalaries', v)}
                            prefix="AED "
                          />
                        </div>
                      )}
                      {(!row.salaries || row.salaries.length === 0) && (
                        <EditCell value={Number(row.totalSalaries) || 0} onSave={(v) => handleFieldSave(row, 'totalSalaries', v)} prefix="AED " />
                      )}
                    </td>
                    <td style={{ color: '#8B5CF6', fontWeight: 600 }}>
                      <EditCell value={Number(row.allahShare) || 0} onSave={(v) => handleAllahSave(row, v)} prefix="AED " />
                    </td>
                    <td style={{ color: 'var(--success)', fontWeight: 600 }}>
                      <EditCell value={Number(row.saving) || 0} onSave={(v) => handleFieldSave(row, 'saving', v)} prefix="AED " />
                    </td>
                    <td style={{ fontWeight: 700, color: calcProfit(row) >= 0 ? 'var(--success)' : 'var(--primary)' }}>
                      AED {calcProfit(row).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td><StatusPill status={rowStatus} /></td>
                    <td>
                      <button
                        onClick={() => { if (window.confirm('Delete this record?')) onDelete(row.id); }}
                        style={{ background: 'none', border: 'none', color: 'var(--text-faint)', cursor: 'pointer', padding: 4, fontSize: 15, lineHeight: 1 }}
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
          💡 Click any value to edit inline. Allah Share auto-calculates at 5% of (Received − Salaries).
        </div>
      )}
    </div>
  );
}
