import React, { useState } from 'react';

const STATUS_MAP = {
  paid:    { color: '#0D9F5F', bg: '#ECFDF3', label: 'PAID' },
  partial: { color: '#D97706', bg: '#FFFBEB', label: 'PARTIAL' },
  unpaid:  { color: '#DC143C', bg: '#FEF2F4', label: 'UNPAID' },
  pushed:  { color: '#0D9F5F', bg: '#ECFDF3', label: 'PUSHED' },
};

function StatusPill({ status }) {
  const s = STATUS_MAP[status] || STATUS_MAP.unpaid;
  return (
    <span style={{ fontSize: 9, fontWeight: 800, background: s.bg, color: s.color, borderRadius: 20, padding: '2px 8px', letterSpacing: 0.8, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
      {s.label}
    </span>
  );
}

export default function UrgentSalariesPanel({
  urgentSalaryIds = [],
  salaries = [],
  onAdd,
  onRemove,
  onToggle,      // hide/show panel
  onUpdateSalary,
}) {
  const [dropActive, setDropActive] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerQ, setPickerQ] = useState('');
  const [urgentAmounts, setUrgentAmounts] = useState({});

  const urgentSalaries = salaries.filter(s => urgentSalaryIds.includes(s.id));
  const totalUrgentRemaining = urgentSalaries.reduce((sum, s) => {
    return sum + Math.max(0, (Number(s.totalSalary) || 0) - (Number(s.paidAmount) || 0));
  }, 0);

  // Picker: non-urgent, non-paid salaries
  const pickerItems = salaries.filter(s =>
    !urgentSalaryIds.includes(s.id) &&
    s.status !== 'paid' &&
    (!pickerQ ||
      s.employeeName?.toLowerCase().includes(pickerQ.toLowerCase()) ||
      s.projectName?.toLowerCase().includes(pickerQ.toLowerCase()))
  );

  const handleDragOver = (e) => { e.preventDefault(); setDropActive(true); };
  const handleDragLeave = () => setDropActive(false);
  const handleDrop = (e) => {
    e.preventDefault();
    setDropActive(false);
    const id = e.dataTransfer.getData('salaryId');
    if (id && !urgentSalaryIds.includes(id)) onAdd(id);
  };

  return (
    <div className="no-print" style={{
      width: 258, minWidth: 258, flexShrink: 0,
      display: 'flex', flexDirection: 'column',
      background: 'var(--card)',
      borderLeft: '1px solid var(--border)',
      height: '100vh',
      overflow: 'hidden',
      position: 'sticky',
      top: 0,
    }}>

      {/* ── Header ── */}
      <div style={{
        padding: '14px 14px 10px',
        borderBottom: '1px solid var(--border)',
        background: 'linear-gradient(135deg, rgba(220,20,60,0.06) 0%, rgba(255,130,0,0.04) 100%)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 20 }}>🚨</span>
            <div>
              <div style={{ fontWeight: 800, fontSize: 13, color: '#DC143C', letterSpacing: 0.3 }}>Urgent Salaries</div>
              <div style={{ fontSize: 10, color: 'var(--text-faint)', marginTop: 1 }}>
                {urgentSalaries.length} item{urgentSalaries.length !== 1 ? 's' : ''} · AED {totalUrgentRemaining.toLocaleString('en-US', { minimumFractionDigits: 2 })} pending
              </div>
            </div>
          </div>
          <button
            onClick={onToggle}
            title="Collapse panel"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-faint)', fontSize: 18, lineHeight: 1, padding: 2, marginTop: -2 }}
          >×</button>
        </div>
      </div>

      {/* ── Drag Drop Zone ── */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{
          margin: '10px 10px 0',
          padding: '10px 8px',
          borderRadius: 8,
          border: dropActive ? '2px solid #DC143C' : '2px dashed var(--border)',
          background: dropActive ? 'rgba(220,20,60,0.06)' : 'var(--bg)',
          textAlign: 'center',
          fontSize: 11,
          color: dropActive ? '#DC143C' : 'var(--text-faint)',
          fontWeight: dropActive ? 700 : 400,
          transition: 'all 0.15s',
          flexShrink: 0,
        }}
      >
        {dropActive ? '🎯 Drop to mark urgent!' : '⠿ Drag a salary row here to mark urgent'}
      </div>

      {/* ── Picker Button ── */}
      <div style={{ padding: '8px 10px 0', flexShrink: 0 }}>
        <button
          onClick={() => { setShowPicker(v => !v); setPickerQ(''); }}
          style={{
            width: '100%', padding: '7px', borderRadius: 8, fontSize: 11, fontWeight: 700,
            cursor: 'pointer', fontFamily: 'Poppins, sans-serif', border: 'none',
            background: showPicker ? '#DC143C' : 'rgba(220,20,60,0.08)',
            color: showPicker ? '#fff' : '#DC143C',
            transition: 'all 0.15s',
          }}
        >
          {showPicker ? '✕ Close Picker' : '⚡ Choose from Salaries'}
        </button>

        {showPicker && (
          <div style={{ marginTop: 8, border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', background: 'var(--card)', boxShadow: 'var(--shadow-md)' }}>
            <input
              autoFocus
              type="text"
              value={pickerQ}
              onChange={e => setPickerQ(e.target.value)}
              placeholder="Search employee / project..."
              style={{ width: '100%', padding: '8px 10px', border: 'none', borderBottom: '1px solid var(--border)', fontSize: 11, fontFamily: 'Poppins, sans-serif', background: 'var(--bg)', boxSizing: 'border-box', outline: 'none' }}
            />
            <div style={{ maxHeight: 180, overflowY: 'auto' }}>
              {pickerItems.length === 0 ? (
                <div style={{ padding: '14px', textAlign: 'center', fontSize: 11, color: 'var(--text-faint)' }}>
                  {salaries.filter(s => s.status !== 'paid').length === 0 ? '✅ All salaries paid!' : 'No matching results'}
                </div>
              ) : pickerItems.map(s => {
                const rem = Math.max(0, (Number(s.totalSalary) || 0) - (Number(s.paidAmount) || 0));
                return (
                  <div
                    key={s.id}
                    onClick={() => { onAdd(s.id); setShowPicker(false); setPickerQ(''); }}
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 10px', cursor: 'pointer', borderBottom: '1px solid var(--border-light)', fontSize: 11, transition: 'background 0.1s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(220,20,60,0.05)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: 12 }}>{s.employeeName || '—'}</div>
                      <div style={{ color: 'var(--text-faint)', fontSize: 10, marginTop: 1 }}>
                        {s.projectName || (s.salaryType === 'monthly' ? '🔄 Monthly' : '—')}
                        <span style={{ marginLeft: 4, color: 'var(--border)', fontSize: 9 }}>· {s.month}</span>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontWeight: 700, color: '#DC143C', fontSize: 11 }}>AED {rem.toLocaleString()}</div>
                      <StatusPill status={s.status} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Urgent List ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px 12px' }}>
        {urgentSalaries.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 12px', color: 'var(--text-faint)' }}>
            <div style={{ fontSize: 30, marginBottom: 8 }}>✅</div>
            <div style={{ fontSize: 11, lineHeight: 1.6 }}>
              No urgent salaries yet.<br />
              Drag rows from the table<br />or use the picker above.
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {urgentSalaries.map(s => {
              const total = Number(s.totalSalary) || 0;
              const paid  = Number(s.paidAmount)  || 0;
              const rem   = Math.max(0, total - paid);
              const st    = STATUS_MAP[s.status] || STATUS_MAP.unpaid;

              return (
                <div
                  key={s.id}
                  style={{
                    background: 'var(--bg)',
                    borderRadius: 8,
                    padding: '10px 12px',
                    border: '1px solid var(--border)',
                    borderLeft: `3px solid ${st.color}`,
                    position: 'relative',
                    animation: 'fadeIn 0.2s ease',
                  }}
                >
                  {/* Remove */}
                  <button
                    onClick={() => onRemove(s.id)}
                    title="Remove from urgent"
                    style={{ position: 'absolute', top: 5, right: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-faint)', fontSize: 15, lineHeight: 1, padding: 2 }}
                  >×</button>

                  {/* Employee name */}
                  <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--text)', marginBottom: 1, paddingRight: 16 }}>
                    {s.employeeName || '—'}
                  </div>

                  {/* Project */}
                  <div style={{ fontSize: 10, color: 'var(--text-light)', marginBottom: 7 }}>
                    {s.projectName || (s.salaryType === 'monthly' ? '🔄 Monthly Salary' : '📦 One-Time')}
                    <span style={{ marginLeft: 5, color: 'var(--text-faint)', fontSize: 9 }}>· {s.month}</span>
                  </div>

                  {/* Status + Amount */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <StatusPill status={s.status} />
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: st.color }}>
                        AED {rem.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </div>
                      {paid > 0 && (
                        <div style={{ fontSize: 9, color: 'var(--text-faint)' }}>
                          Paid AED {paid.toLocaleString()} of {total.toLocaleString()}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Payment controls: custom amount & Done button */}
                  {rem > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, paddingTop: 8, borderTop: '1px dashed var(--border-light)' }}>
                      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', flex: 1 }}>
                        <span style={{ position: 'absolute', left: 6, fontSize: 10, color: 'var(--text-faint)', fontWeight: 600 }}>AED</span>
                        <input
                          type="number"
                          value={urgentAmounts[s.id] !== undefined ? urgentAmounts[s.id] : String(rem)}
                          onChange={e => setUrgentAmounts({ ...urgentAmounts, [s.id]: e.target.value })}
                          placeholder="Amount"
                          style={{
                            width: '100%',
                            padding: '4px 6px 4px 26px',
                            fontSize: 11,
                            borderRadius: 6,
                            border: '1px solid var(--border)',
                            background: 'var(--bg)',
                            color: 'var(--text)',
                            outline: 'none',
                            fontFamily: 'Poppins, sans-serif',
                            boxSizing: 'border-box',
                          }}
                        />
                      </div>
                      <button
                        onClick={() => {
                          const inputVal = urgentAmounts[s.id] !== undefined ? urgentAmounts[s.id] : String(rem);
                          const amt = Number(inputVal) || 0;
                          if (amt <= 0) return;
                          
                          const newPaid = paid + amt;
                          const newStatus = newPaid >= total ? 'paid' : 'partial';
                          
                          if (onUpdateSalary) {
                            onUpdateSalary(s.id, { paidAmount: newPaid, status: newStatus });
                          }
                          onRemove(s.id);
                          
                          // clean state
                          const copy = { ...urgentAmounts };
                          delete copy[s.id];
                          setUrgentAmounts(copy);
                        }}
                        style={{
                          padding: '5px 12px',
                          fontSize: 10,
                          fontWeight: 700,
                          background: '#0D9F5F',
                          color: '#fff',
                          border: 'none',
                          borderRadius: 6,
                          cursor: 'pointer',
                          fontFamily: 'Poppins, sans-serif',
                          letterSpacing: 0.5,
                          transition: 'background 0.15s',
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = '#0b8a52'}
                        onMouseLeave={e => e.currentTarget.style.background = '#0D9F5F'}
                      >
                        Done
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Footer total ── */}
      {urgentSalaries.length > 0 && (
        <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border)', background: 'rgba(220,20,60,0.04)', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: 1 }}>Total Urgent Pending</span>
            <span style={{ fontSize: 14, fontWeight: 800, color: '#DC143C' }}>
              AED {totalUrgentRemaining.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
