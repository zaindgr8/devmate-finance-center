import React, { useState } from 'react';
import Icon from './Icon';
import { Btn, Input } from './UI';
import { currentYM, fmtMonth, fmtAED, toAED, invoiceReceived, invoiceOutstanding, isInvoiceOverdue, billsSummary, downloadCSV } from '../utils/helpers';

const EMPTY_CLIENT = { clientName: '', clientDesignation: '', businessName: '', clientEmail: '', clientPhone: '', clientAddress: '', paymentLink: '' };

/* ═══ CLIENTS VIEW ═══ */
export function ClientsView({ clients, invoices, onDelete, onLedger, onAddClient, onReorder }) {
  const [showAdd, setShowAdd] = useState(false);
  const [editingName, setEditingName] = useState(null);
  const [newC, setNewC] = useState(EMPTY_CLIENT);
  const [q, setQ] = useState('');
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
    if (!editingName && clients.some(c => c.name.trim().toLowerCase() === newC.clientName.trim().toLowerCase())) {
      alert('A client with this name already exists. Use Edit on their card instead.');
      return;
    }
    // Existing clients are matched by name, so blank fields would keep old values; send explicit values
    onAddClient({ ...newC, clientName: newC.clientName.trim() });
    setNewC(EMPTY_CLIENT);
    setEditingName(null);
    setShowAdd(false);
  };

  const startEdit = (c) => {
    setNewC({
      clientName: c.name, clientDesignation: c.designation || '', businessName: c.businessName || '',
      clientEmail: c.email || '', clientPhone: c.phone || '', clientAddress: c.address || '', paymentLink: c.paymentLink || '',
    });
    setEditingName(c.name);
    setShowAdd(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteProj = (projId) => {
    const clientObj = clients.find(c => c.name === viewProjClient);
    if (!clientObj || !window.confirm('Delete this project? Invoices linked to it are kept.')) return;
    onAddClient({ ...clientObj, projects: (clientObj.projects || []).filter(p => p.id !== projId) });
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
    const invoiced = ci.reduce((s, i) => s + toAED(i.totalPayment, i.currency), 0);
    const received = ci.reduce((s, i) => s + toAED(invoiceReceived(i), i.currency), 0);
    const finalTotal = projectsTotal > 0 ? projectsTotal : invoiced;
    const pending = Math.max(0, finalTotal - received);
    const overdue = ci.filter(i => isInvoiceOverdue(i)).length;
    return {
      total: finalTotal,
      invoiced: invoiced,
      received: received,
      pending: pending,
      overdue,
      progress: finalTotal > 0 ? Math.min(100, (received / finalTotal) * 100) : 0,
    };
  };

  return (
    <div className="animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>Clients</h1>
          <div style={{ fontSize: 12, color: 'var(--text-light)' }}>{clients.length} client{clients.length === 1 ? '' : 's'} · amounts in AED</div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', width: 240 }}>
            <input className="search-input" value={q} onChange={e => setQ(e.target.value)} placeholder="Search clients…" />
            <div className="search-icon"><Icon name="search" size={14} /></div>
          </div>
          <Btn onClick={() => { setNewC(EMPTY_CLIENT); setEditingName(null); setShowAdd(!showAdd); }}>+ Add Client</Btn>
        </div>
      </div>

      {showAdd && (
        <div className="card" style={{ padding: 24, marginBottom: 24, border: '1.5px solid var(--primary)' }}>
          <h3 className="section-title">{editingName ? `Edit · ${editingName}` : 'New Client Details'}</h3>
          <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
            <Input label="Client Name *" value={newC.clientName} disabled={!!editingName} title={editingName ? 'Client name links invoices and cannot be changed here' : undefined} onChange={(e) => setNewC({ ...newC, clientName: e.target.value })} placeholder="John Doe" />
            <Input label="Business Name *" value={newC.businessName} onChange={(e) => setNewC({ ...newC, businessName: e.target.value })} placeholder="Company name" />
            <Input label="Designation" value={newC.clientDesignation} onChange={(e) => setNewC({ ...newC, clientDesignation: e.target.value })} placeholder="e.g. CEO, Director" />
            <Input label="Email" value={newC.clientEmail} onChange={(e) => setNewC({ ...newC, clientEmail: e.target.value })} placeholder="client@email.com" type="email" />
            <Input label="Phone" value={newC.clientPhone} onChange={(e) => setNewC({ ...newC, clientPhone: e.target.value })} placeholder="+971..." />
            <Input label="Address" value={newC.clientAddress} onChange={(e) => setNewC({ ...newC, clientAddress: e.target.value })} placeholder="Business address" />
            <Input label="Default Payment Link" value={newC.paymentLink} onChange={(e) => setNewC({ ...newC, paymentLink: e.target.value })} placeholder="https://…" />
          </div>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 16 }}>
            <Btn variant="ghost" onClick={() => { setShowAdd(false); setEditingName(null); }}>Cancel</Btn>
            <Btn onClick={handleAdd}>{editingName ? 'Save Changes' : 'Save Client'}</Btn>
          </div>
        </div>
      )}
      {clients.length === 0 ? (
        <div className="card" style={{ padding: 60, textAlign: 'center', color: 'var(--text-light)' }}>
          No clients yet. Create an invoice to add your first client.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {clients.filter(c => !q || [c.name, c.businessName, c.email].some(v => (v || '').toLowerCase().includes(q.toLowerCase()))).map((c) => {
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
                  <div style={{ display: 'flex', gap: 6 }}>
                    <Btn variant="ghost" size="sm" onClick={() => startEdit(c)} title="Edit client"><Icon name="edit" size={12} /></Btn>
                    <Btn variant="danger" size="sm" onClick={() => onDelete(c.name)} title="Delete client"><Icon name="trash" size={12} /></Btn>
                  </div>
                </div>
                {st.overdue > 0 && (
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--danger)', marginBottom: 6 }}>⚠ {st.overdue} overdue invoice{st.overdue === 1 ? '' : 's'}</div>
                )}
                {c.email && <div style={{ fontSize: 12, color: 'var(--text-light)', marginBottom: 2 }}>{c.email}</div>}
                {c.phone && <div style={{ fontSize: 12, color: 'var(--text-light)', marginBottom: 8 }}>{c.phone}</div>}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 12, paddingTop: 10, borderTop: '1px solid var(--border-light)' }}>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--text-light)', textTransform: 'uppercase' }}>Total</div>
                    <div style={{ fontWeight: 700 }}>AED {Math.round(st.total).toLocaleString()}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--text-light)', textTransform: 'uppercase' }}>Invoiced</div>
                    <div style={{ fontWeight: 700, color: 'var(--text-mid)' }}>AED {Math.round(st.invoiced).toLocaleString()}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--text-light)', textTransform: 'uppercase' }}>Received</div>
                    <div style={{ fontWeight: 700, color: 'var(--success)' }}>AED {Math.round(st.received).toLocaleString()}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--text-light)', textTransform: 'uppercase' }}>Pending</div>
                    <div style={{ fontWeight: 700, color: 'var(--info)' }}>AED {Math.round(st.pending).toLocaleString()}</div>
                  </div>
                </div>
                <div className="meter" style={{ marginBottom: 12 }} title={`${st.progress.toFixed(0)}% collected`}><div style={{ width: `${st.progress}%`, background: 'var(--success)' }} /></div>
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
        <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setViewProjClient(null); }}>
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
                <div className="form-grid-3" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
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

            <div style={{ overflowX: 'auto' }}>
            <table className="inv-table" style={{ marginTop: 10, minWidth: 640 }}>
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
                    const pPaid = pInvs.reduce((s, i) => s + toAED(invoiceReceived(i), i.currency), 0);
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
                          <div style={{ display: 'inline-flex', gap: 6 }}>
                            <Btn variant="ghost" size="sm" title="Edit project" onClick={() => {
                              setNewProj({ name: p.name, type: p.type, total: p.total, details: p.details });
                              setEditProjId(p.id);
                              setShowAddProj(true);
                            }}>
                              <Icon name="edit" size={12} />
                            </Btn>
                            <Btn variant="danger" size="sm" title="Delete project" onClick={() => handleDeleteProj(p.id)}>
                              <Icon name="trash" size={12} />
                            </Btn>
                          </div>
                        </td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══ REPORTS VIEW ═══ */
const receivedMonth = (inv) => (inv.paidAt ? String(inv.paidAt).slice(0, 7) : (inv.date || '').slice(0, 7));

function Metric({ label, value, color, hint }) {
  return (
    <div className="metric-card">
      <div className="metric-label">{label}</div>
      <div className="metric-value" style={{ color }}>{fmtAED(value)}</div>
      {hint && <div className="metric-hint">{hint}</div>}
    </div>
  );
}

export function ReportsView({ invoices = [], clients = [], salaries = [], bills = [], billPayments = {} }) {
  const [selectedMonth, setSelectedMonth] = useState(currentYM());

  // Extract all available months from invoices, payments and salaries
  const allMonths = new Set([currentYM()]);
  invoices.forEach(inv => {
    if (inv.date) allMonths.add(inv.date.substring(0, 7));
    if (inv.paidAt) allMonths.add(receivedMonth(inv));
  });
  salaries.forEach(sal => {
    if (sal.month) allMonths.add(sal.month.substring(0, 7));
  });
  Object.keys(billPayments).forEach(m => allMonths.add(m));
  const availableMonths = Array.from(allMonths).sort().reverse();

  // Accrual view: invoices issued this month. Cash view: money received this month.
  const monthInvoices = invoices.filter(inv => inv.date && inv.date.substring(0, 7) === selectedMonth && inv.status !== 'scheduled');
  const receivedInvoices = invoices.filter(inv => invoiceReceived(inv) > 0 && receivedMonth(inv) === selectedMonth);
  const monthSalaries = salaries.filter(sal => sal.month && sal.month.substring(0, 7) === selectedMonth);

  const totalInvoiced = monthInvoices.reduce((sum, inv) => sum + toAED(inv.totalPayment, inv.currency), 0);
  const totalReceived = receivedInvoices.reduce((sum, inv) => sum + toAED(invoiceReceived(inv), inv.currency), 0);
  const totalPending = monthInvoices.reduce((sum, inv) => sum + toAED(invoiceOutstanding(inv), inv.currency), 0);

  const totalSalaries = monthSalaries.reduce((sum, sal) => sum + (Number(sal.totalSalary) || 0), 0);
  const salariesPaid = monthSalaries.reduce((sum, sal) => sum + (Number(sal.paidAmount) || 0), 0);

  const billSum = billsSummary(bills, billPayments, selectedMonth);
  const monthBills = billSum.list;
  const totalBills = billSum.total;

  const expectedProfit = totalInvoiced - totalSalaries - totalBills;
  const netSavings = totalReceived - salariesPaid - billSum.paid;

  const exportCSV = () => {
    const rows = [
      [`Devmate Finance Report: ${fmtMonth(selectedMonth)}`], [],
      ['Summary', 'AED'],
      ['Invoiced', totalInvoiced.toFixed(2)], ['Received (cash)', totalReceived.toFixed(2)], ['Outstanding from this month', totalPending.toFixed(2)],
      ['Salaries allocated', totalSalaries.toFixed(2)], ['Salaries paid', salariesPaid.toFixed(2)],
      ['Bills', totalBills.toFixed(2)], ['Bills paid', billSum.paid.toFixed(2)],
      ['Expected profit', expectedProfit.toFixed(2)], ['Net cash', netSavings.toFixed(2)], [],
      ['Invoices issued', 'Client', 'Status', 'Currency', 'Total', 'Total (AED)'],
      ...monthInvoices.map(i => [`#${i.invoiceNumber}`, i.clientName, i.status || 'unpaid', i.currency, i.totalPayment, toAED(i.totalPayment, i.currency).toFixed(2)]),
      [], ['Salaries', 'Project', 'Type', 'Total', 'Paid', 'Status'],
      ...monthSalaries.map(s => [s.employeeName, s.projectName || '', s.salaryType || 'project', s.totalSalary, s.paidAmount || 0, s.status || 'unpaid']),
      [], ['Bills', 'Category', 'Type', 'Amount', 'Paid'],
      ...monthBills.map(b => [b.name, b.category || 'Other', b.type, b.amount, (billPayments[selectedMonth] || {})[b.id] || 0]),
    ];
    downloadCSV(`devmate-report-${selectedMonth}.csv`, rows);
  };

  return (
    <div className="animate-fade-in">
      <div className="page-head">
        <div>
          <h1 className="page-title">Monthly Reports</h1>
          <p className="page-sub">All currencies converted to AED · received = cash in during the month</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="form-select"
            style={{ width: 180, fontWeight: 600 }}
          >
            {availableMonths.map(m => (
              <option key={m} value={m}>{fmtMonth(m)}{m === currentYM() ? ' (Current)' : ''}</option>
            ))}
          </select>
          <Btn variant="ghost" onClick={exportCSV}><Icon name="download" size={14} /> Export</Btn>
        </div>
      </div>

      <div className="metric-grid">
        <Metric label="Invoiced" value={totalInvoiced} color="var(--text)" hint={`${monthInvoices.length} invoice${monthInvoices.length === 1 ? '' : 's'} issued`} />
        <Metric label="Received" value={totalReceived} color="var(--success)" hint={`${receivedInvoices.length} payment${receivedInvoices.length === 1 ? '' : 's'}`} />
        <Metric label="Still outstanding" value={totalPending} color="var(--warning)" hint="from invoices issued this month" />
        <Metric label="Salaries" value={totalSalaries} color="var(--primary)" hint={`${fmtAED(salariesPaid, 0)} paid`} />
        <Metric label="Bills" value={totalBills} color="var(--text-mid)" hint={`${fmtAED(billSum.paid, 0)} paid`} />
      </div>

      <div className="report-hero-grid">
        <div className="report-hero">
          <div className="report-hero-label">Expected profit</div>
          <div className="report-hero-formula">Invoiced − salaries − bills</div>
          <div className="report-hero-value" style={{ color: expectedProfit >= 0 ? '#34d399' : '#f87171' }}>{fmtAED(expectedProfit)}</div>
        </div>
        <div className="report-hero">
          <div className="report-hero-label">Net cash</div>
          <div className="report-hero-formula">Received − salaries paid − bills paid</div>
          <div className="report-hero-value" style={{ color: netSavings >= 0 ? '#34d399' : '#f87171' }}>{fmtAED(netSavings)}</div>
        </div>
      </div>

      <div className="reports-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
        <div className="card" style={{ padding: 24 }}>
          <h3 className="section-title">Invoices issued ({monthInvoices.length})</h3>
          {monthInvoices.length === 0 ? (
            <div style={{ color: 'var(--text-light)', fontSize: 13 }}>No invoices generated this month</div>
          ) : (
            monthInvoices.map((inv) => {
              const st = inv.status || 'unpaid';
              return (
                <div key={inv.invoiceNumber} className="report-row">
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{inv.clientName}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-light)', marginTop: 4 }}>
                      <span style={{ color: st === 'paid' ? 'var(--success)' : st === 'partial' ? 'var(--warning)' : st === 'pending' ? 'var(--info)' : 'var(--danger)', fontWeight: 700, marginRight: 6 }}>{st.toUpperCase()}</span>
                      Inv #{inv.invoiceNumber}{inv.currency !== 'AED' ? ` · ${inv.currency}` : ''}
                    </div>
                  </div>
                  <div className="num" style={{ fontWeight: 700, fontSize: 14 }}>{fmtAED(toAED(inv.totalPayment, inv.currency), 0)}</div>
                </div>
              );
            })
          )}
        </div>

        <div className="card" style={{ padding: 24 }}>
          <h3 className="section-title">Salaries allocated ({monthSalaries.length})</h3>
          {monthSalaries.length === 0 ? (
            <div style={{ color: 'var(--text-light)', fontSize: 13 }}>No salaries allocated this month</div>
          ) : (
            monthSalaries.map((sal) => (
              <div key={sal.id} className="report-row">
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{sal.employeeName}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-light)', marginTop: 4 }}>{sal.projectName || 'N/A'} • {sal.salaryType === 'monthly' ? '🔄 Monthly' : '📦 One-Time'}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="num" style={{ fontWeight: 700, fontSize: 14 }}>{fmtAED(sal.totalSalary, 0)}</div>
                  {Number(sal.paidAmount) > 0 && <div style={{ fontSize: 11, color: 'var(--success)' }}>paid {fmtAED(sal.paidAmount, 0)}</div>}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Bills breakdown for selected month */}
      {monthBills.length > 0 && (
        <div className="card" style={{ padding: 24, marginTop: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 className="section-title" style={{ margin: 0 }}>🧾 Bills ({monthBills.length})</h3>
            <div className="num" style={{ fontWeight: 700, fontSize: 14 }}>{fmtAED(billSum.paid, 0)} of {fmtAED(totalBills, 0)} paid</div>
          </div>
          {monthBills.map((bill) => {
            const paid = Number((billPayments[selectedMonth] || {})[bill.id]) || 0;
            return (
              <div key={bill.id} className="report-row">
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{bill.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-light)', marginTop: 3 }}>
                    {bill.category || 'Other'} · {bill.type === 'one-time' ? `📌 One-Time (${bill.month})` : '🔄 Recurring'}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="num" style={{ fontWeight: 700, fontSize: 14 }}>{fmtAED(bill.amount, 0)}</div>
                  <div style={{ fontSize: 11, color: paid >= Number(bill.amount) ? 'var(--success)' : 'var(--text-light)' }}>{paid >= Number(bill.amount) ? 'paid' : paid > 0 ? `paid ${fmtAED(paid, 0)}` : 'unpaid'}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
