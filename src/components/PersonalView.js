import React, { useState } from 'react';

function fmt(n) {
  return Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function ProgressBar({ paid, total, color }) {
  const pct = total > 0 ? Math.min(100, (paid / total) * 100) : 0;
  return (
    <div style={{ background: 'var(--border-light)', borderRadius: 8, height: 8, marginTop: 10, overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 8, transition: 'width 0.5s ease' }} />
    </div>
  );
}

export default function PersonalView({ finance = [], personal = { allahPaid: 0, savedAmount: 0 }, onUpdatePersonal }) {
  const [editingAllahPaid, setEditingAllahPaid] = useState(false);
  const [editingSaved, setEditingSaved] = useState(false);
  const [editingAllahTotal, setEditingAllahTotal] = useState(false);
  const [editingSavingTotal, setEditingSavingTotal] = useState(false);

  const [allahPaidInput, setAllahPaidInput] = useState('');
  const [savedInput, setSavedInput] = useState('');
  const [allahTotalInput, setAllahTotalInput] = useState('');
  const [savingTotalInput, setSavingTotalInput] = useState('');

  // Calculate totals from confirmed finance records
  const calcAllahShareTotal = finance
    .filter(r => r.status !== 'pending' && r.status !== 'scheduled')
    .reduce((s, r) => s + (Number(r.allahShare) || 0), 0);

  const calcSavingTotal = finance
    .filter(r => r.status !== 'pending' && r.status !== 'scheduled')
    .reduce((s, r) => s + (Number(r.saving) || 0), 0);

  // Use manual override if set, otherwise use calculated total
  const allahShareTotal = personal.allahTotal != null && personal.allahTotal !== '' ? Number(personal.allahTotal) : calcAllahShareTotal;
  const savingTotal = personal.savingTotal != null && personal.savingTotal !== '' ? Number(personal.savingTotal) : calcSavingTotal;

  const allahPaid = Number(personal.allahPaid) || 0;
  const savedAmount = Number(personal.savedAmount) || 0;

  const allahRemaining = Math.max(0, allahShareTotal - allahPaid);
  const savingRemaining = Math.max(0, savingTotal - savedAmount);

  const allahStatus = allahPaid >= allahShareTotal && allahShareTotal > 0 ? 'paid' : allahPaid > 0 ? 'partial' : 'pending';
  const savingStatus = savedAmount >= savingTotal && savingTotal > 0 ? 'saved' : savedAmount > 0 ? 'partial' : 'pending';

  const statusBadge = (st, colorMap) => {
    const s = colorMap[st] || colorMap.pending;
    return (
      <span style={{ fontSize: 11, fontWeight: 700, borderRadius: 20, padding: '4px 12px', background: s.bg, color: s.color }}>
        {s.label}
      </span>
    );
  };

  const allahColors = {
    paid: { bg: 'rgba(16,185,129,0.12)', color: '#10b981', label: '✓ Fully Paid' },
    partial: { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b', label: '◑ Partially Paid' },
    pending: { bg: 'rgba(139,92,246,0.12)', color: '#8b5cf6', label: '● Pending' },
  };
  const savingColors = {
    saved: { bg: 'rgba(16,185,129,0.12)', color: '#10b981', label: '✓ Fully Saved' },
    partial: { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b', label: '◑ Partially Saved' },
    pending: { bg: 'rgba(59,130,246,0.12)', color: '#3b82f6', label: '● Not Saved Yet' },
  };

  const cardStyle = {
    background: 'var(--card)', border: '1px solid var(--border)',
    borderRadius: 18, padding: '28px 28px 24px', boxShadow: 'var(--shadow-md)',
    display: 'flex', flexDirection: 'column', gap: 4,
  };

  const inputStyle = {
    padding: '10px 14px', borderRadius: 8, border: '1.5px solid var(--primary)',
    background: 'var(--input-bg)', color: 'inherit', fontFamily: 'inherit',
    fontSize: 15, fontWeight: 600, outline: 'none', width: '100%', boxSizing: 'border-box',
  };

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Personal</h1>
        <div style={{ fontSize: 13, color: 'var(--text-light)' }}>
          Personal financial obligations — auto-calculated from Finance Ledger
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24 }}>

        {/* Allah Share Card */}
        <div style={{ ...cardStyle, borderTop: '3px solid #8b5cf6' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 700, marginBottom: 6 }}>Allah's Share (5%)</div>
              {editingAllahTotal ? (
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <input
                    autoFocus
                    type="number"
                    min="0"
                    value={allahTotalInput}
                    onChange={e => setAllahTotalInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') { 
                        onUpdatePersonal({ ...personal, allahTotal: allahTotalInput === '' ? null : Number(allahTotalInput) }); 
                        setEditingAllahTotal(false); 
                      }
                      if (e.key === 'Escape') setEditingAllahTotal(false);
                    }}
                    style={{ ...inputStyle, width: 140, padding: '6px 10px', fontSize: 20 }}
                  />
                  <button onClick={() => { onUpdatePersonal({ ...personal, allahTotal: allahTotalInput === '' ? null : Number(allahTotalInput) }); setEditingAllahTotal(false); }}
                    style={{ padding: '6px 12px', background: '#8b5cf6', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700 }}>
                    Save
                  </button>
                  <button onClick={() => setEditingAllahTotal(false)}
                    style={{ padding: '6px 10px', background: 'none', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer' }}>
                    ✕
                  </button>
                </div>
              ) : (
                <div 
                  onClick={() => { setAllahTotalInput(personal.allahTotal != null ? personal.allahTotal : calcAllahShareTotal); setEditingAllahTotal(true); }}
                  style={{ fontSize: 34, fontWeight: 800, color: '#8b5cf6', lineHeight: 1, cursor: 'pointer', display: 'inline-block' }}
                  title="Click to edit total"
                >
                  AED {fmt(allahShareTotal)} <span style={{ fontSize: 16, opacity: 0.5, verticalAlign: 'middle' }}>✏️</span>
                </div>
              )}
              {/* <div style={{ fontSize: 12, color: 'var(--text-light)', marginTop: 8 }}>
                {personal.allahTotal != null && personal.allahTotal !== ''
                  ? <span style={{ color: '#8b5cf6', fontWeight: 600 }}>Manual Override Active (<button onClick={(e) => { e.stopPropagation(); onUpdatePersonal({...personal, allahTotal: null}); }} style={{background:'none', border:'none', color:'inherit', textDecoration:'underline', cursor:'pointer', padding:0}}>Reset to Auto</button>)</span>
                  : '5% of (Received − Salaries) across all confirmed invoices'
                }
              </div> */}
            </div>
            {statusBadge(allahStatus, allahColors)}
          </div>

          {/* <ProgressBar paid={allahPaid} total={allahShareTotal} color="#8b5cf6" /> */}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 20 }}>
            <div style={{ background: 'rgba(139,92,246,0.06)', borderRadius: 10, padding: '14px 16px', border: '1px solid rgba(139,92,246,0.15)' }}>
              <div style={{ fontSize: 10, color: '#8b5cf6', textTransform: 'uppercase', letterSpacing: 1.2, fontWeight: 700, marginBottom: 4 }}>Total Obligation</div>
              <div style={{ fontWeight: 700, fontSize: 18, color: '#8b5cf6' }}>AED {fmt(allahShareTotal)}</div>
            </div>
            <div style={{ background: 'rgba(16,185,129,0.06)', borderRadius: 10, padding: '14px 16px', border: '1px solid rgba(16,185,129,0.15)' }}>
              <div style={{ fontSize: 10, color: '#10b981', textTransform: 'uppercase', letterSpacing: 1.2, fontWeight: 700, marginBottom: 4 }}>Paid</div>
              <div style={{ fontWeight: 700, fontSize: 18, color: '#10b981' }}>AED {fmt(allahPaid)}</div>
            </div>
          </div>

          {/* {allahRemaining > 0 && (
            <div style={{ marginTop: 10, padding: '10px 14px', background: 'rgba(239,68,68,0.06)', borderRadius: 8, border: '1px solid rgba(239,68,68,0.12)', fontSize: 13, color: '#ef4444', fontWeight: 600 }}>
              ⏳ Still owed: AED {fmt(allahRemaining)}
            </div>
          )} */}

          {/* Edit Paid */}
          <div style={{ marginTop: 18, borderTop: '1px solid var(--border-light)', paddingTop: 16 }}>
            <div style={{ fontSize: 11, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: 1.2, fontWeight: 600, marginBottom: 8 }}>Update Paid Amount</div>
            {editingAllahPaid ? (
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  autoFocus
                  type="number"
                  min="0"
                  value={allahPaidInput}
                  onChange={e => setAllahPaidInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') { onUpdatePersonal({ ...personal, allahPaid: Number(allahPaidInput) || 0 }); setEditingAllahPaid(false); }
                    if (e.key === 'Escape') setEditingAllahPaid(false);
                  }}
                  style={inputStyle}
                  placeholder="Enter paid amount..."
                />
                <button onClick={() => { onUpdatePersonal({ ...personal, allahPaid: Number(allahPaidInput) || 0 }); setEditingAllahPaid(false); }}
                  style={{ padding: '10px 18px', background: '#8b5cf6', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 13, fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                  Save
                </button>
                <button onClick={() => setEditingAllahPaid(false)}
                  style={{ padding: '10px 14px', background: 'none', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>
                  ✕
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => { setAllahPaidInput(String(allahPaid)); setEditingAllahPaid(true); }}
                  style={{ flex: 1, padding: '10px 16px', background: 'rgba(139,92,246,0.08)', color: '#8b5cf6', border: '1.5px solid rgba(139,92,246,0.3)', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13, fontFamily: 'inherit' }}>
                  ✏️ Edit Paid Amount (AED {fmt(allahPaid)})
                </button>
                {allahStatus !== 'paid' && allahShareTotal > 0 && (
                  <button onClick={() => onUpdatePersonal({ ...personal, allahPaid: allahShareTotal })}
                    style={{ padding: '10px 14px', background: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1.5px solid rgba(16,185,129,0.3)', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 12, fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                    Mark Paid
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Savings Card */}
        <div style={{ ...cardStyle, borderTop: '3px solid #10b981' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 700, marginBottom: 6 }}>Savings</div>
              {editingSavingTotal ? (
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <input
                    autoFocus
                    type="number"
                    min="0"
                    value={savingTotalInput}
                    onChange={e => setSavingTotalInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') { 
                        onUpdatePersonal({ ...personal, savingTotal: savingTotalInput === '' ? null : Number(savingTotalInput) }); 
                        setEditingSavingTotal(false); 
                      }
                      if (e.key === 'Escape') setEditingSavingTotal(false);
                    }}
                    style={{ ...inputStyle, width: 140, padding: '6px 10px', fontSize: 20 }}
                  />
                  <button onClick={() => { onUpdatePersonal({ ...personal, savingTotal: savingTotalInput === '' ? null : Number(savingTotalInput) }); setEditingSavingTotal(false); }}
                    style={{ padding: '6px 12px', background: '#10b981', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700 }}>
                    Save
                  </button>
                  <button onClick={() => setEditingSavingTotal(false)}
                    style={{ padding: '6px 10px', background: 'none', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer' }}>
                    ✕
                  </button>
                </div>
              ) : (
                <div 
                  onClick={() => { setSavingTotalInput(personal.savingTotal != null ? personal.savingTotal : calcSavingTotal); setEditingSavingTotal(true); }}
                  style={{ fontSize: 34, fontWeight: 800, color: '#10b981', lineHeight: 1, cursor: 'pointer', display: 'inline-block' }}
                  title="Click to edit total"
                >
                  AED {fmt(savingTotal)} <span style={{ fontSize: 16, opacity: 0.5, verticalAlign: 'middle' }}>✏️</span>
                </div>
              )}
              {/* <div style={{ fontSize: 12, color: 'var(--text-light)', marginTop: 8 }}>
                {personal.savingTotal != null && personal.savingTotal !== ''
                  ? <span style={{ color: '#10b981', fontWeight: 600 }}>Manual Override Active (<button onClick={(e) => { e.stopPropagation(); onUpdatePersonal({...personal, savingTotal: null}); }} style={{background:'none', border:'none', color:'inherit', textDecoration:'underline', cursor:'pointer', padding:0}}>Reset to Auto</button>)</span>
                  : 'Total savings allocated from confirmed invoices'
                }
              </div> */}
            </div>
            {/* {statusBadge(savingStatus, savingColors)} */}
          </div>

          {/* <ProgressBar paid={savedAmount} total={savingTotal} color="#10b981" /> */}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 20 }}>
            <div style={{ background: 'rgba(16,185,129,0.06)', borderRadius: 10, padding: '14px 16px', border: '1px solid rgba(16,185,129,0.15)' }}>
              <div style={{ fontSize: 10, color: '#10b981', textTransform: 'uppercase', letterSpacing: 1.2, fontWeight: 700, marginBottom: 4 }}>Total Saving</div>
              <div style={{ fontWeight: 700, fontSize: 18, color: '#10b981' }}>AED {fmt(savingTotal)}</div>
            </div>
            <div style={{ background: 'rgba(59,130,246,0.06)', borderRadius: 10, padding: '14px 16px', border: '1px solid rgba(59,130,246,0.15)' }}>
              <div style={{ fontSize: 10, color: '#3b82f6', textTransform: 'uppercase', letterSpacing: 1.2, fontWeight: 700, marginBottom: 4 }}>Saved</div>
              <div style={{ fontWeight: 700, fontSize: 18, color: '#3b82f6' }}>AED {fmt(savedAmount)}</div>
            </div>
          </div>

          {/* {savingRemaining > 0 && (
            <div style={{ marginTop: 10, padding: '10px 14px', background: 'rgba(59,130,246,0.06)', borderRadius: 8, border: '1px solid rgba(59,130,246,0.12)', fontSize: 13, color: '#3b82f6', fontWeight: 600 }}>
              💰 Yet to save: AED {fmt(savingRemaining)}
            </div>
          )} */}

          {/* Edit Saved */}
          <div style={{ marginTop: 18, borderTop: '1px solid var(--border-light)', paddingTop: 16 }}>
            <div style={{ fontSize: 11, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: 1.2, fontWeight: 600, marginBottom: 8 }}>Update Saved Amount</div>
            {editingSaved ? (
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  autoFocus
                  type="number"
                  min="0"
                  value={savedInput}
                  onChange={e => setSavedInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') { onUpdatePersonal({ ...personal, savedAmount: Number(savedInput) || 0 }); setEditingSaved(false); }
                    if (e.key === 'Escape') setEditingSaved(false);
                  }}
                  style={inputStyle}
                  placeholder="Enter saved amount..."
                />
                <button onClick={() => { onUpdatePersonal({ ...personal, savedAmount: Number(savedInput) || 0 }); setEditingSaved(false); }}
                  style={{ padding: '10px 18px', background: '#10b981', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 13, fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                  Save
                </button>
                <button onClick={() => setEditingSaved(false)}
                  style={{ padding: '10px 14px', background: 'none', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>
                  ✕
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => { setSavedInput(String(savedAmount)); setEditingSaved(true); }}
                  style={{ flex: 1, padding: '10px 16px', background: 'rgba(16,185,129,0.08)', color: '#10b981', border: '1.5px solid rgba(16,185,129,0.3)', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13, fontFamily: 'inherit' }}>
                  ✏️ Edit Saved Amount (AED {fmt(savedAmount)})
                </button>
                {savingStatus !== 'saved' && savingTotal > 0 && (
                  <button onClick={() => onUpdatePersonal({ ...personal, savedAmount: savingTotal })}
                    style={{ padding: '10px 14px', background: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1.5px solid rgba(16,185,129,0.3)', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 12, fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                    Mark Saved
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* <div style={{ marginTop: 28, padding: '14px 20px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 12, color: 'var(--text-light)' }}>
        💡 Totals are auto-calculated from all <strong>confirmed</strong> (non-pending) invoices in the Finance Ledger. Update the "Paid" and "Saved" amounts to track what has actually been given/transferred.
      </div> */}
    </div>
  );
}
