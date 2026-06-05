import React, { useState } from 'react';
import Icon from './Icon';
import { Btn, StatCard, Input } from './UI';

/* ═══ CLIENTS VIEW ═══ */
export function ClientsView({ clients, invoices, onDelete, onLedger, onAddClient, onReorder }) {
  const [showAdd, setShowAdd] = useState(false);
  const [newC, setNewC] = useState({ clientName: '', clientDesignation: '', businessName: '', clientEmail: '', clientPhone: '', clientAddress: '', paymentLink: '' });
  const [viewProjClient, setViewProjClient] = useState(null);
  const [showAddProj, setShowAddProj] = useState(false);
  const [newProj, setNewProj] = useState({ name: '', type: 'One Time', total: '', details: '' });
  const [editProjId, setEditProjId] = useState(null);

  const [dragName, setDragName] = useState(null);
  const [dragOverName, setDragOverName] = useState(null);

  const handleDragStart = (e, name) => {
    setDragName(name);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, name) => {
    e.preventDefault();
    if (name !== dragName) setDragOverName(name);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (!dragName || !dragOverName || dragName === dragOverName) {
      setDragName(null); setDragOverName(null); return;
    }

    const fromIdx = clients.findIndex(c => c.name === dragName);
    const toIdx = clients.findIndex(c => c.name === dragOverName);

    if (fromIdx === -1 || toIdx === -1) {
      setDragName(null); setDragOverName(null); return;
    }

    const newClients = [...clients];
    const [moved] = newClients.splice(fromIdx, 1);
    newClients.splice(toIdx, 0, moved);

    if (onReorder) onReorder(newClients);
    setDragName(null); setDragOverName(null);
  };

  const handleAdd = () => {
    if (!newC.clientName || !newC.businessName) {
      alert('Client Name and Business Name are required.');
      return;
    }
    onAddClient(newC);
    setNewC({ clientName: '', clientDesignation: '', businessName: '', clientEmail: '', clientPhone: '', clientAddress: '', paymentLink: '' });
    setShowAdd(false);
  };

  const handleAddProj = () => {
    if (!newProj.name || !newProj.total) return alert('Name and Total are required.');
    const clientObj = clients.find(c => c.name === viewProjClient);
    if (!clientObj) return;

    let updatedProjects;
    if (editProjId) {
      updatedProjects = (clientObj.projects || []).map(p => p.id === editProjId ? { ...newProj, id: editProjId } : p);
    } else {
      updatedProjects = [...(clientObj.projects || []), { ...newProj, id: Date.now() }];
    }

    const updatedClient = { ...clientObj, projects: updatedProjects };
    onAddClient(updatedClient);
    setNewProj({ name: '', type: 'One Time', total: '', details: '' });
    setShowAddProj(false);
    setEditProjId(null);
  };
  const stats = (c) => {
    const ci = invoices.filter((i) => i.clientName === c.name);
    const projectsTotal = (c.projects || []).reduce((sum, p) => sum + (Number(p.total) || 0), 0);
    const invoiced = ci.reduce((s, i) => s + (Number(i.totalPayment) || 0), 0);
    const received = ci.filter((i) => i.status !== 'pending').reduce((s, i) => s + (Number(i.payingNow) || 0), 0);
    const finalTotal = projectsTotal > 0 ? projectsTotal : invoiced;
    const pending = Math.max(0, finalTotal - received);
    return {
      total: finalTotal,
      invoiced: invoiced,
      received: received,
      pending: pending,
    };
  };

  return (
    <div className="animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>Clients</h1>
        <Btn onClick={() => setShowAdd(!showAdd)}>+ Add Client</Btn>
      </div>

      {showAdd && (
        <div className="card" style={{ padding: 24, marginBottom: 24, border: '1.5px solid var(--primary)' }}>
          <h3 className="section-title">New Client Details</h3>
          <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
            <Input label="Client Name *" value={newC.clientName} onChange={(e) => setNewC({ ...newC, clientName: e.target.value })} placeholder="John Doe" />
            <Input label="Business Name *" value={newC.businessName} onChange={(e) => setNewC({ ...newC, businessName: e.target.value })} placeholder="Company name" />
            <Input label="Designation" value={newC.clientDesignation} onChange={(e) => setNewC({ ...newC, clientDesignation: e.target.value })} placeholder="e.g. CEO, Director" />
            <Input label="Email" value={newC.clientEmail} onChange={(e) => setNewC({ ...newC, clientEmail: e.target.value })} placeholder="client@email.com" type="email" />
            <Input label="Phone" value={newC.clientPhone} onChange={(e) => setNewC({ ...newC, clientPhone: e.target.value })} placeholder="+971..." />
            <Input label="Address" value={newC.clientAddress} onChange={(e) => setNewC({ ...newC, clientAddress: e.target.value })} placeholder="Business address" />
          </div>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 16 }}>
            <Btn variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Btn>
            <Btn onClick={handleAdd}>Save Client</Btn>
          </div>
        </div>
      )}
      {clients.length === 0 ? (
        <div className="card" style={{ padding: 60, textAlign: 'center', color: 'var(--text-light)' }}>
          No clients yet. Create an invoice to add your first client.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {clients.map((c) => {
            const st = stats(c);
            const isDragTarget = dragOverName === c.name && dragName !== c.name;
            return (
              <div
                key={c.name}
                className="card"
                draggable
                onDragStart={(e) => handleDragStart(e, c.name)}
                onDragOver={(e) => handleDragOver(e, c.name)}
                onDragEnd={() => { setDragName(null); setDragOverName(null); }}
                onDrop={handleDrop}
                style={{
                  padding: 20,
                  cursor: 'grab',
                  opacity: dragName === c.name ? 0.45 : 1,
                  border: isDragTarget ? '2.5px solid var(--primary)' : '1px solid var(--border)',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 10 }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <div style={{ color: 'var(--text-faint)', fontSize: 16, cursor: 'grab', userSelect: 'none', display: 'flex', alignItems: 'center' }} title="Drag to reorder">
                      ⠿
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>{c.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-light)' }}>
                        {c.designation && `${c.designation} · `}{c.businessName}
                      </div>
                    </div>
                  </div>
                  <Btn variant="danger" size="sm" onClick={() => onDelete(c.name)}>
                    <Icon name="trash" size={12} />
                  </Btn>
                </div>
                {c.email && <div style={{ fontSize: 12, color: 'var(--text-light)', marginBottom: 2 }}>{c.email}</div>}
                {c.phone && <div style={{ fontSize: 12, color: 'var(--text-light)', marginBottom: 8 }}>{c.phone}</div>}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 12, paddingTop: 10, borderTop: '1px solid var(--border-light)' }}>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--text-light)', textTransform: 'uppercase' }}>Total</div>
                    <div style={{ fontWeight: 700 }}>AED {st.total.toLocaleString()}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--text-light)', textTransform: 'uppercase' }}>Invoiced</div>
                    <div style={{ fontWeight: 700, color: 'var(--text-mid)' }}>AED {st.invoiced.toLocaleString()}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--text-light)', textTransform: 'uppercase' }}>Received</div>
                    <div style={{ fontWeight: 700, color: 'var(--success)' }}>AED {st.received.toLocaleString()}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--text-light)', textTransform: 'uppercase' }}>Pending</div>
                    <div style={{ fontWeight: 700, color: 'var(--info)' }}>AED {st.pending.toLocaleString()}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Btn variant="secondary" size="sm" onClick={() => setViewProjClient(c.name)} style={{ flex: 1 }}>
                    <Icon name="folder" size={12} /> View Projects
                  </Btn>
                  <Btn variant="secondary" size="sm" onClick={() => onLedger(c.name)} style={{ flex: 1 }}>
                    <Icon name="file" size={12} /> View Ledger
                  </Btn>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Projects Modal */}
      {viewProjClient && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div className="card animate-fade-in" style={{ width: '100%', maxWidth: 800, maxHeight: '90vh', overflowY: 'auto', padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700 }}>Projects · {viewProjClient}</h2>
              <button onClick={() => setViewProjClient(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-light)' }}><Icon name="x" size={20} /></button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
              <Btn size="sm" onClick={() => {
                setNewProj({ name: '', type: 'One Time', total: '', details: '' });
                setEditProjId(null);
                setShowAddProj(!showAddProj);
              }}>{showAddProj ? 'Close Form' : '+ Add Project'}</Btn>
            </div>

            {showAddProj && (
              <div style={{ background: 'var(--bg)', padding: 16, borderRadius: 8, marginBottom: 20, border: '1px solid var(--border)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
                  <Input label="Project Name *" value={newProj.name} onChange={(e) => setNewProj({ ...newProj, name: e.target.value })} placeholder="e.g. Admin Panel" />
                  <div className="form-group">
                    <label className="form-label">Type</label>
                    <select className="form-select" value={newProj.type} onChange={(e) => setNewProj({ ...newProj, type: e.target.value })}>
                      <option value="One Time">One Time</option>
                      <option value="Recurring">Recurring</option>
                    </select>
                  </div>
                  <Input label="Total Payment (AED) *" type="number" value={newProj.total} onChange={(e) => setNewProj({ ...newProj, total: e.target.value })} placeholder="e.g. 20000" />
                </div>
                <Input label="Project Details" value={newProj.details} onChange={(e) => setNewProj({ ...newProj, details: e.target.value })} placeholder="Scope, milestones..." />
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                  <Btn variant="ghost" size="sm" onClick={() => {
                    setShowAddProj(false);
                    setEditProjId(null);
                    setNewProj({ name: '', type: 'One Time', total: '', details: '' });
                  }}>Cancel</Btn>
                  <Btn size="sm" onClick={handleAddProj}>Save Project</Btn>
                </div>
              </div>
            )}

            <table className="inv-table" style={{ marginTop: 10 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Total Payment</th>
                  <th>Paid</th>
                  <th>Pending Confirmation</th>
                  <th>Details</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const clientObj = clients.find(c => c.name === viewProjClient);
                  const projects = clientObj?.projects || [];
                  if (projects.length === 0) return <tr><td colSpan="7" style={{ textAlign: 'center', padding: 20, color: 'var(--text-light)' }}>No projects found for this client.</td></tr>;

                  return projects.map((p) => {
                    const pInvs = invoices.filter(i => i.clientName === viewProjClient && i.projectName === p.name);
                    const pPaid = pInvs.filter(i => i.status !== 'pending').reduce((s, i) => s + (Number(i.payingNow) || 0), 0);
                    const pPending = pInvs.filter(i => i.status === 'pending').reduce((s, i) => s + (Number(i.payingNow) || 0), 0);
                    return (
                      <tr key={p.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                        <td style={{ fontWeight: 600 }}>{p.name}</td>
                        <td><span className="badge badge-blue">{p.type}</span></td>
                        <td style={{ fontWeight: 600 }}>AED {Number(p.total).toLocaleString()}</td>
                        <td style={{ color: 'var(--success)', fontWeight: 600 }}>AED {pPaid.toLocaleString()}</td>
                        <td style={{ color: 'var(--info)' }}>AED {pPending.toLocaleString()}</td>
                        <td style={{ fontSize: 12, color: 'var(--text-light)', maxWidth: 200, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={p.details}>{p.details || '-'}</td>
                        <td style={{ textAlign: 'right' }}>
                          <Btn variant="ghost" size="sm" onClick={() => {
                            setNewProj({ name: p.name, type: p.type, total: p.total, details: p.details });
                            setEditProjId(p.id);
                            setShowAddProj(true);
                          }}>
                            <Icon name="edit" size={12} />
                          </Btn>
                        </td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══ REPORTS VIEW ═══ */
export function ReportsView({ invoices = [], clients = [], salaries = [], bills = [] }) {
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().substring(0, 7));

  // Extract all available months from invoices and salaries
  const allMonths = new Set();
  invoices.forEach(inv => {
    if (inv.date) allMonths.add(inv.date.substring(0, 7));
  });
  salaries.forEach(sal => {
    if (sal.month) allMonths.add(sal.month.substring(0, 7));
  });
  const availableMonths = Array.from(allMonths).sort().reverse();
  if (!availableMonths.includes(selectedMonth)) {
    availableMonths.unshift(selectedMonth);
  }

  // Filter Data
  const monthInvoices = invoices.filter(inv => inv.date && inv.date.substring(0, 7) === selectedMonth);
  const monthSalaries = salaries.filter(sal => sal.month && sal.month.substring(0, 7) === selectedMonth);

  // Calculate Metrics
  const totalInvoiced = monthInvoices.reduce((sum, inv) => sum + (Number(inv.totalPayment) || 0), 0);
  const totalReceived = monthInvoices.filter(inv => inv.status !== 'pending' && inv.status !== 'unpaid')
    .reduce((sum, inv) => sum + (inv.status === 'paid' ? (Number(inv.totalPayment) || 0) : (Number(inv.payingNow) || 0)), 0);
  const totalPending = Math.max(0, totalInvoiced - totalReceived);

  const totalSalaries = monthSalaries.reduce((sum, sal) => sum + (Number(sal.totalSalary) || 0), 0);

  // Bills for this month: monthly bills always apply, one-time bills only if their month matches
  const monthBills = bills.filter(b => b.type === 'monthly' || (b.type === 'one-time' && b.month && b.month.substring(0, 7) === selectedMonth));
  const totalBills = monthBills.reduce((sum, b) => sum + (Number(b.amount) || 0), 0);

  const expectedProfit = totalInvoiced - totalSalaries - totalBills;
  const netSavings = totalReceived - totalSalaries - totalBills;

  return (
    <div className="animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>Monthly Reports</h1>
        <div>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="form-select"
            style={{ width: 200, padding: '10px 14px', fontWeight: 600, fontSize: 14 }}
          >
            {availableMonths.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 24 }}>
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 20px' }}>
          <div style={{ fontSize: 11, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 600, marginBottom: 8 }}>Total Invoiced</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--primary)' }}>AED {totalInvoiced.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
        </div>
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 20px' }}>
          <div style={{ fontSize: 11, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 600, marginBottom: 8 }}>Total Received</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--success)' }}>AED {totalReceived.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
        </div>
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 20px' }}>
          <div style={{ fontSize: 11, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 600, marginBottom: 8 }}>Total Pending</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--warning)' }}>AED {totalPending.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
        </div>
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 20px' }}>
          <div style={{ fontSize: 11, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 600, marginBottom: 8 }}>Total Salaries</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#DC143C' }}>AED {totalSalaries.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
        </div>
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 20px' }}>
          <div style={{ fontSize: 11, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 600, marginBottom: 8 }}>Regular Bills</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#f97316' }}>AED {totalBills.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14, marginBottom: 32 }}>
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px', background: 'linear-gradient(145deg, #1e1e1e, #111)' }}>
          <div style={{ fontSize: 11, color: '#999', textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 600, marginBottom: 8 }}>Expected Profit (Invoiced − Salaries − Bills)</div>
          <div style={{ fontSize: 32, fontWeight: 700, color: expectedProfit >= 0 ? '#10b981' : '#ef4444' }}>
            AED {expectedProfit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
        </div>
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px', background: 'linear-gradient(145deg, #1e1e1e, #111)' }}>
          <div style={{ fontSize: 11, color: '#999', textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 600, marginBottom: 8 }}>Net Profit / Savings (Received − Salaries − Bills)</div>
          <div style={{ fontSize: 32, fontWeight: 700, color: netSavings >= 0 ? '#10b981' : '#ef4444' }}>
            AED {netSavings.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
        <div className="card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 className="section-title" style={{ margin: 0 }}>Invoices ({monthInvoices.length})</h3>
          </div>
          {monthInvoices.length === 0 ? (
            <div style={{ color: 'var(--text-light)', fontSize: 13 }}>No invoices generated this month</div>
          ) : (
            monthInvoices.map((inv) => (
              <div key={inv.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border-light)' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{inv.clientName}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-light)', marginTop: 4 }}>
                    <span style={{ color: inv.status === 'paid' ? 'var(--success)' : inv.status === 'partial' ? 'var(--warning)' : 'var(--danger)', fontWeight: 700, marginRight: 6 }}>{inv.status.toUpperCase()}</span>
                    Inv #{inv.invoiceNumber}
                  </div>
                </div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>AED {(Number(inv.totalPayment) || 0).toLocaleString()}</div>
              </div>
            ))
          )}
        </div>

        <div className="card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 className="section-title" style={{ margin: 0 }}>Salaries Allocated ({monthSalaries.length})</h3>
          </div>
          {monthSalaries.length === 0 ? (
            <div style={{ color: 'var(--text-light)', fontSize: 13 }}>No salaries allocated this month</div>
          ) : (
            monthSalaries.map((sal) => (
              <div key={sal.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border-light)' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{sal.employeeName}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-light)', marginTop: 4 }}>{sal.projectName || 'N/A'} • {sal.salaryType === 'monthly' ? '🔄 Monthly' : '📦 One-Time'}</div>
                </div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>AED {(Number(sal.totalSalary) || 0).toLocaleString()}</div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Bills breakdown for selected month */}
      {monthBills.length > 0 && (
        <div className="card" style={{ padding: 24, marginTop: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 className="section-title" style={{ margin: 0 }}>🧾 Regular Bills ({monthBills.length})</h3>
            <div style={{ fontWeight: 700, color: '#f97316', fontSize: 14 }}>−AED {totalBills.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
          </div>
          {monthBills.map((bill) => (
            <div key={bill.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border-light)' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{bill.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-light)', marginTop: 3 }}>
                  {bill.category || 'Other'} · {bill.type === 'monthly' ? '🔄 Monthly' : `📌 One-Time (${bill.month})`}
                </div>
              </div>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#f97316' }}>AED {(Number(bill.amount) || 0).toLocaleString()}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
