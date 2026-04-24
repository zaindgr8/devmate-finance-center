import React, { useState } from 'react';
import Icon from './Icon';
import { Btn, StatCard, Input } from './UI';

/* ═══ CLIENTS VIEW ═══ */
export function ClientsView({ clients, invoices, onDelete, onLedger, onAddClient }) {
  const [showAdd, setShowAdd] = useState(false);
  const [newC, setNewC] = useState({ clientName: '', clientDesignation: '', businessName: '', clientEmail: '', clientPhone: '', clientAddress: '', paymentLink: '' });
  const [viewProjClient, setViewProjClient] = useState(null);
  const [showAddProj, setShowAddProj] = useState(false);
  const [newProj, setNewProj] = useState({ name: '', type: 'One Time', total: '', details: '' });
  const [editProjId, setEditProjId] = useState(null);

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
            return (
              <div key={c.name} className="card" style={{ padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 10 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{c.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-light)' }}>
                      {c.designation && `${c.designation} · `}{c.businessName}
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
export function ReportsView({ invoices, clients }) {
  const months = {};
  invoices.forEach((inv) => {
    const m = inv.date ? inv.date.substring(0, 7) : 'N/A';
    if (!months[m]) months[m] = { total: 0, paid: 0, count: 0 };
    months[m].total += Number(inv.totalPayment) || 0;
    if (inv.status !== 'pending') {
      months[m].paid += Number(inv.payingNow) || 0;
    }
    months[m].count += 1;
  });
  const sorted = Object.entries(months).sort((a, b) => b[0].localeCompare(a[0]));

  const statusC = { paid: 0, partial: 0, unpaid: 0, pending: 0 };
  invoices.forEach((i) => { statusC[i.status || 'unpaid']++; });

  const topC = clients
    .map((c) => {
      const ci = invoices.filter((i) => i.clientName === c.name);
      return { name: c.name, total: ci.reduce((s, i) => s + (Number(i.totalPayment) || 0), 0), count: ci.length };
    })
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  const maxB = Math.max(...sorted.map(([, v]) => v.total), 1);

  return (
    <div className="animate-fade-in">
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 24 }}>Reports</h1>

      <div className="stats-grid" style={{ display: 'flex', gap: 14, marginBottom: 24, flexWrap: 'wrap' }}>
        <StatCard label="Paid Invoices" value={statusC.paid} accent="var(--success)" />
        <StatCard label="Partially Paid" value={statusC.partial} accent="var(--warning)" />
        <StatCard label="Unpaid" value={statusC.unpaid} accent="var(--primary)" />
        <StatCard label="Pending Confirm" value={statusC.pending} accent="var(--info)" />
      </div>

      <div className="reports-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 20 }}>
        {/* Monthly Revenue */}
        <div className="card" style={{ padding: 24 }}>
          <h3 className="section-title">Monthly Revenue</h3>
          {sorted.length === 0 ? (
            <div style={{ color: 'var(--text-light)', fontSize: 13 }}>No data yet</div>
          ) : (
            sorted.map(([m, d]) => (
              <div key={m} style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                  <span style={{ color: 'var(--text-light)' }}>{m}</span>
                  <span style={{ fontWeight: 600 }}>
                    AED {d.total.toLocaleString()}{' '}
                    <span style={{ color: 'var(--text-light)', fontWeight: 400 }}>({d.count})</span>
                  </span>
                </div>
                <div style={{ height: 6, background: 'var(--bg)', borderRadius: 3, overflow: 'hidden', border: '1px solid var(--border-light)' }}>
                  <div style={{ height: '100%', width: `${(d.paid / Math.max(d.total, 1)) * 100}%`, background: 'var(--success)', borderRadius: 3 }} />
                </div>
                <div style={{ height: 6, background: 'var(--bg)', borderRadius: 3, overflow: 'hidden', marginTop: 3, border: '1px solid var(--border-light)' }}>
                  <div style={{ height: '100%', width: `${(d.total / maxB) * 100}%`, background: 'var(--primary)', borderRadius: 3 }} />
                </div>
              </div>
            ))
          )}
          <div style={{ display: 'flex', gap: 16, marginTop: 10, fontSize: 10, color: 'var(--text-light)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 10, height: 4, background: 'var(--success)', borderRadius: 2 }} /> Paid
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 10, height: 4, background: 'var(--primary)', borderRadius: 2 }} /> Total
            </div>
          </div>
        </div>

        {/* Top Clients */}
        <div className="card" style={{ padding: 24 }}>
          <h3 className="section-title">Top Clients</h3>
          {topC.length === 0 ? (
            <div style={{ color: 'var(--text-light)', fontSize: 13 }}>No clients yet</div>
          ) : (
            topC.map((c, i) => (
              <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: i < topC.length - 1 ? '1px solid var(--border-light)' : 'none' }}>
                <div style={{ width: 28, height: 28, background: 'var(--primary-soft)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'var(--primary)' }}>
                  {i + 1}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{c.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-light)' }}>{c.count} invoice{c.count !== 1 ? 's' : ''}</div>
                </div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>AED {c.total.toLocaleString()}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
