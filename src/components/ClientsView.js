import React, { useMemo, useState } from 'react';
import Icon from './Icon';
import { Btn, Badge, Avatar, Segmented, Drawer, Empty } from './UI';
import {
  fmtAED, fmtDate, fmtCurrency, toAED, invoiceReceived, invoiceOutstanding, isInvoiceOverdue, statusColor, today,
} from '../utils/helpers';

const EMPTY_CLIENT = { clientName: '', clientDesignation: '', businessName: '', clientEmail: '', clientPhone: '', clientAddress: '', paymentLink: '' };
const EMPTY_PROJECT = { name: '', type: 'One Time', total: '', details: '' };
const waLink = (phone) => `https://wa.me/${String(phone || '').replace(/[^\d]/g, '')}`;

export default function ClientsView({ clients = [], invoices = [], onDelete, onLedger, onAddClient, onNewInvoice, onPreview }) {
  const todayStr = today();
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('outstanding');
  const [q, setQ] = useState('');
  const [openName, setOpenName] = useState(null);
  const [form, setForm] = useState(null); // { data, editing }

  // Money facts per client (all converted to AED)
  const facts = useMemo(() => {
    const out = {};
    clients.forEach((c) => {
      const ci = invoices.filter((i) => i.clientName === c.name);
      const contract = (c.projects || []).reduce((s, p) => s + (Number(p.total) || 0), 0);
      const invoiced = ci.reduce((s, i) => s + toAED(i.totalPayment, i.currency), 0);
      const received = ci.reduce((s, i) => s + toAED(invoiceReceived(i), i.currency), 0);
      const outstanding = ci.reduce((s, i) => s + toAED(invoiceOutstanding(i), i.currency), 0);
      const overdue = ci.filter((i) => isInvoiceOverdue(i, todayStr));
      const lastDate = ci.map((i) => i.date || '').sort().pop() || '';
      const base = contract > 0 ? contract : invoiced;
      out[c.name] = {
        invoices: [...ci].sort((a, b) => (b.date || '').localeCompare(a.date || '')),
        contract, invoiced, received, outstanding, overdue, lastDate,
        progress: base > 0 ? Math.min(100, (received / base) * 100) : 0,
        base,
      };
    });
    return out;
  }, [clients, invoices, todayStr]);

  const totals = {
    outstanding: clients.reduce((s, c) => s + (facts[c.name]?.outstanding || 0), 0),
    received: clients.reduce((s, c) => s + (facts[c.name]?.received || 0), 0),
    owing: clients.filter((c) => facts[c.name]?.outstanding > 0).length,
    overdue: clients.filter((c) => facts[c.name]?.overdue.length > 0).length,
  };

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    const filtered = clients.filter((c) => {
      const f = facts[c.name] || {};
      if (filter === 'owing' && !(f.outstanding > 0)) return false;
      if (filter === 'overdue' && !(f.overdue?.length > 0)) return false;
      if (s && ![c.name, c.businessName, c.email, c.phone].some((v) => (v || '').toLowerCase().includes(s))) return false;
      return true;
    });
    const by = {
      outstanding: (a, b) => (facts[b.name]?.outstanding || 0) - (facts[a.name]?.outstanding || 0),
      revenue: (a, b) => (facts[b.name]?.received || 0) - (facts[a.name]?.received || 0),
      recent: (a, b) => (facts[b.name]?.lastDate || '').localeCompare(facts[a.name]?.lastDate || ''),
      name: (a, b) => a.name.localeCompare(b.name),
    };
    return [...filtered].sort((a, b) => by[sort](a, b) || a.name.localeCompare(b.name));
  }, [clients, facts, filter, sort, q]);

  const openClient = clients.find((c) => c.name === openName);

  const startEdit = (c) => setForm({
    editing: c.name,
    data: {
      clientName: c.name, clientDesignation: c.designation || '', businessName: c.businessName || '',
      clientEmail: c.email || '', clientPhone: c.phone || '', clientAddress: c.address || '', paymentLink: c.paymentLink || '',
    },
  });

  return (
    <div className="animate-fade-in">
      <div className="page-head">
        <div>
          <h1 className="page-title">Clients</h1>
          <p className="page-sub">{clients.length} client{clients.length === 1 ? '' : 's'} · amounts in AED</p>
        </div>
        <Btn onClick={() => setForm({ editing: null, data: { ...EMPTY_CLIENT } })}><Icon name="plus" size={14} /> Add client</Btn>
      </div>

      <div className="stat-strip">
        <div>
          <div className="stat-strip-label">Outstanding</div>
          <div className="stat-strip-value" style={{ color: totals.outstanding ? 'var(--warning)' : 'var(--text)' }}>{fmtAED(totals.outstanding, 0)}</div>
          <div className="stat-strip-sub">{totals.owing} client{totals.owing === 1 ? '' : 's'} owe you</div>
        </div>
        <div>
          <div className="stat-strip-label">Overdue clients</div>
          <div className="stat-strip-value" style={{ color: totals.overdue ? 'var(--danger)' : 'var(--text)' }}>{totals.overdue}</div>
          <div className="stat-strip-sub">past their due date</div>
        </div>
        <div>
          <div className="stat-strip-label">Collected (all time)</div>
          <div className="stat-strip-value" style={{ color: 'var(--success)' }}>{fmtAED(totals.received, 0)}</div>
          <div className="stat-strip-sub">across all clients</div>
        </div>
      </div>

      <div className="toolbar">
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'All', count: clients.length },
            { value: 'owing', label: 'Owes money', count: totals.owing },
            { value: 'overdue', label: 'Overdue', count: totals.overdue },
          ]}
        />
        <select className="form-select" style={{ width: 'auto' }} value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort clients">
          <option value="outstanding">Sort: Outstanding</option>
          <option value="revenue">Sort: Revenue</option>
          <option value="recent">Sort: Recent activity</option>
          <option value="name">Sort: Name</option>
        </select>
        <div className="search-wrap">
          <input className="search-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, business, email…" />
          <div className="search-icon"><Icon name="search" size={14} /></div>
        </div>
      </div>

      <div className="list">
        {list.length === 0 ? (
          <Empty
            icon={clients.length ? '🔍' : '🤝'}
            title={clients.length ? 'No matching clients' : 'No clients yet'}
            text={clients.length ? 'Try another filter or search.' : 'Add a client, or create an invoice and they are saved automatically.'}
            action={!clients.length && <Btn size="sm" onClick={() => setForm({ editing: null, data: { ...EMPTY_CLIENT } })}>+ Add client</Btn>}
          />
        ) : list.map((c) => {
          const f = facts[c.name] || {};
          return (
            <div key={c.name} className="list-row clickable" onClick={() => setOpenName(c.name)}>
              <Avatar name={c.name} size={40} />
              <div className="row-main">
                <div className="row-title">
                  {c.name}
                  {f.overdue?.length > 0 && <Badge color="red">{f.overdue.length} overdue</Badge>}
                </div>
                <div className="row-sub">{[c.businessName, f.lastDate && `last invoice ${fmtDate(f.lastDate)}`].filter(Boolean).join(' · ')}</div>
              </div>
              <div className="row-amount hide-sm" style={{ minWidth: 150 }}>
                <div className="row-amount-sub">{f.base ? `${Math.round(f.progress)}% collected` : 'No invoices yet'}</div>
                <div className="meter-sm"><div style={{ width: `${f.progress}%` }} /></div>
                <div className="row-amount-sub">{fmtAED(f.received, 0)} received</div>
              </div>
              <div className="row-amount" style={{ minWidth: 120 }}>
                {f.outstanding > 0 ? (
                  <>
                    <div className="row-amount-main" style={{ color: f.overdue.length ? 'var(--danger)' : 'var(--warning)' }}>{fmtAED(f.outstanding, 0)}</div>
                    <div className="row-amount-sub">outstanding</div>
                  </>
                ) : <div className="row-amount-sub" style={{ color: 'var(--success)', fontWeight: 600 }}>✓ Settled</div>}
              </div>
              <div className="row-actions hide-sm" onClick={(e) => e.stopPropagation()}>
                {c.email && <a className="contact-link" href={`mailto:${c.email}`} title={`Email ${c.email}`}>✉</a>}
                {c.phone && <a className="contact-link" href={waLink(c.phone)} target="_blank" rel="noreferrer" title="WhatsApp">💬</a>}
              </div>
            </div>
          );
        })}
      </div>

      {openClient && (
        <ClientDrawer
          key={openClient.name}
          client={openClient}
          f={facts[openClient.name] || {}}
          onClose={() => setOpenName(null)}
          onEdit={() => startEdit(openClient)}
          onDelete={() => { setOpenName(null); onDelete(openClient.name); }}
          onLedger={() => onLedger(openClient.name)}
          onNewInvoice={() => onNewInvoice(openClient)}
          onPreview={onPreview}
          onSaveProjects={(projects) => onAddClient({ ...openClient, projects })}
        />
      )}

      {form && (
        <ClientForm
          key={form.editing || 'new'}
          initial={form.data}
          editing={form.editing}
          clients={clients}
          onClose={() => setForm(null)}
          onSave={(data) => {
            onAddClient({ ...data, clientName: data.clientName.trim() });
            setForm(null);
          }}
        />
      )}
    </div>
  );
}

function ClientDrawer({ client: c, f, onClose, onEdit, onDelete, onLedger, onNewInvoice, onPreview, onSaveProjects }) {
  const [proj, setProj] = useState(null); // { data, id }

  const saveProject = () => {
    const d = proj.data;
    if (!d.name.trim() || !(Number(d.total) > 0)) return alert('Project name and total are required.');
    const projects = proj.id
      ? (c.projects || []).map((p) => (p.id === proj.id ? { ...d, id: proj.id } : p))
      : [...(c.projects || []), { ...d, id: Date.now() }];
    onSaveProjects(projects);
    setProj(null);
  };

  const deleteProject = (id) => {
    if (!window.confirm('Delete this project? Invoices linked to it are kept.')) return;
    onSaveProjects((c.projects || []).filter((p) => p.id !== id));
  };

  return (
    <Drawer
      open
      onClose={onClose}
      width={540}
      title={<div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><Avatar name={c.name} size={44} /><div><div>{c.name}</div><div className="drawer-sub">{[c.designation, c.businessName].filter(Boolean).join(' · ')}</div></div></div>}
      footer={<>
        <Btn variant="danger" onClick={onDelete} style={{ marginRight: 'auto' }}><Icon name="trash" size={13} /> Delete</Btn>
        <Btn variant="ghost" onClick={onEdit}><Icon name="edit" size={13} /> Edit</Btn>
      </>}
    >
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
        <Btn size="sm" onClick={onNewInvoice}><Icon name="plus" size={13} /> New invoice</Btn>
        <Btn size="sm" variant="ghost" onClick={onLedger}><Icon name="file" size={13} /> All invoices</Btn>
        {c.email && <a className="btn btn-ghost btn-sm" href={`mailto:${c.email}`}>✉ Email</a>}
        {c.phone && <a className="btn btn-ghost btn-sm" href={waLink(c.phone)} target="_blank" rel="noreferrer">💬 WhatsApp</a>}
      </div>

      <div className="stat-strip" style={{ marginBottom: 18 }}>
        <div>
          <div className="stat-strip-label">{f.contract ? 'Contract' : 'Invoiced'}</div>
          <div className="stat-strip-value" style={{ fontSize: 17 }}>{fmtAED(f.base, 0)}</div>
        </div>
        <div>
          <div className="stat-strip-label">Received</div>
          <div className="stat-strip-value" style={{ fontSize: 17, color: 'var(--success)' }}>{fmtAED(f.received, 0)}</div>
        </div>
        <div>
          <div className="stat-strip-label">Outstanding</div>
          <div className="stat-strip-value" style={{ fontSize: 17, color: f.outstanding ? 'var(--warning)' : 'var(--text)' }}>{fmtAED(f.outstanding, 0)}</div>
        </div>
      </div>

      <div className="drawer-section">
        <div className="drawer-section-title">Contact</div>
        <dl className="kv">
          <dt>Email</dt><dd>{c.email ? <a href={`mailto:${c.email}`}>{c.email}</a> : '—'}</dd>
          <dt>Phone</dt><dd>{c.phone || '—'}</dd>
          <dt>Address</dt><dd>{c.address || '—'}</dd>
          <dt>Payment link</dt><dd>{c.paymentLink ? <a href={c.paymentLink} target="_blank" rel="noreferrer">{c.paymentLink}</a> : '—'}</dd>
        </dl>
      </div>

      <div className="drawer-section">
        <div className="drawer-section-title">
          Projects
          <button className="link-btn" onClick={() => setProj(proj ? null : { id: null, data: { ...EMPTY_PROJECT } })}>{proj ? 'Cancel' : '+ Add project'}</button>
        </div>
        {proj && (
          <div className="inset-box">
            <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0 12px' }}>
              <div className="form-group"><label className="form-label">Name *</label><input className="form-input" autoFocus value={proj.data.name} onChange={(e) => setProj({ ...proj, data: { ...proj.data, name: e.target.value } })} placeholder="e.g. Admin Panel" /></div>
              <div className="form-group"><label className="form-label">Total (AED) *</label><input className="form-input" type="number" value={proj.data.total} onChange={(e) => setProj({ ...proj, data: { ...proj.data, total: e.target.value } })} /></div>
            </div>
            <div className="form-group"><label className="form-label">Details</label><input className="form-input" value={proj.data.details || ''} onChange={(e) => setProj({ ...proj, data: { ...proj.data, details: e.target.value } })} placeholder="Scope, milestones…" /></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Segmented value={proj.data.type} onChange={(v) => setProj({ ...proj, data: { ...proj.data, type: v } })} options={[{ value: 'One Time', label: 'One time' }, { value: 'Recurring', label: 'Recurring' }]} />
              <Btn size="sm" onClick={saveProject}>{proj.id ? 'Save' : 'Add'}</Btn>
            </div>
          </div>
        )}
        {(c.projects || []).length === 0 && !proj ? (
          <div className="empty-mini">No projects yet. Add one to track contract value vs. collected.</div>
        ) : (c.projects || []).map((p) => {
          const pInv = f.invoices.filter((i) => i.projectName === p.name);
          const paid = pInv.reduce((s, i) => s + toAED(invoiceReceived(i), i.currency), 0);
          const pct = Number(p.total) ? Math.min(100, (paid / Number(p.total)) * 100) : 0;
          return (
            <div key={p.id} className="history-row" style={{ alignItems: 'flex-start' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13, display: 'flex', gap: 6, alignItems: 'center' }}>{p.name} <span className="badge badge-blue">{p.type}</span></div>
                {p.details && <div style={{ fontSize: 11, color: 'var(--text-light)', marginTop: 2 }}>{p.details}</div>}
                <div className="meter-sm" style={{ maxWidth: 260 }}><div style={{ width: `${pct}%` }} /></div>
                <div style={{ fontSize: 11, color: 'var(--text-light)', marginTop: 3 }}>{fmtAED(paid, 0)} of {fmtAED(p.total, 0)} collected · {pInv.length} invoice{pInv.length === 1 ? '' : 's'}</div>
              </div>
              <button className="icon-btn" title="Edit project" onClick={() => setProj({ id: p.id, data: { name: p.name, type: p.type || 'One Time', total: p.total, details: p.details || '' } })}><Icon name="edit" size={12} /></button>
              <button className="icon-btn danger" title="Delete project" onClick={() => deleteProject(p.id)}><Icon name="trash" size={12} /></button>
            </div>
          );
        })}
      </div>

      <div className="drawer-section">
        <div className="drawer-section-title">
          Invoices ({f.invoices.length})
          {f.invoices.length > 6 && <button className="link-btn" onClick={onLedger}>View all →</button>}
        </div>
        {f.invoices.length === 0 ? (
          <div className="empty-mini">No invoices yet.</div>
        ) : f.invoices.slice(0, 6).map((inv) => {
          const overdue = isInvoiceOverdue(inv);
          return (
            <button key={inv.invoiceNumber} className="history-row history-btn" onClick={() => onPreview(inv)}>
              <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>#{inv.invoiceNumber}{inv.projectName ? ` · ${inv.projectName}` : ''}</div>
                <div style={{ fontSize: 11, color: 'var(--text-light)' }}>{fmtDate(inv.date)}{inv.dueDate && inv.status !== 'paid' ? ` · due ${fmtDate(inv.dueDate)}` : ''}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="num" style={{ fontWeight: 700, fontSize: 13 }}>{fmtCurrency(inv.totalPayment, inv.currency)}</div>
                <Badge color={overdue ? 'red' : statusColor(inv.status)}>{overdue ? 'overdue' : (inv.status || 'unpaid')}</Badge>
              </div>
            </button>
          );
        })}
      </div>
    </Drawer>
  );
}

function ClientForm({ initial, editing, clients, onClose, onSave }) {
  const [d, setD] = useState(initial);
  const set = (k, v) => setD((x) => ({ ...x, [k]: v }));

  const save = () => {
    if (!d.clientName.trim() || !d.businessName.trim()) return alert('Client name and business name are required.');
    if (!editing && clients.some((c) => c.name.trim().toLowerCase() === d.clientName.trim().toLowerCase())) {
      return alert('A client with this name already exists.');
    }
    onSave(d);
  };

  return (
    <Drawer
      open
      onClose={onClose}
      title={editing ? `Edit ${editing}` : 'Add client'}
      footer={<><Btn variant="ghost" onClick={onClose}>Cancel</Btn><Btn onClick={save}><Icon name="check" size={14} /> {editing ? 'Save changes' : 'Add client'}</Btn></>}
    >
      <div className="form-group">
        <label className="form-label">Client name *</label>
        <input className="form-input" autoFocus={!editing} value={d.clientName} disabled={!!editing} onChange={(e) => set('clientName', e.target.value)} placeholder="John Doe" />
        {editing && <div style={{ fontSize: 11, color: 'var(--text-light)', marginTop: 4 }}>The name links this client to their invoices, so it can't be changed here.</div>}
      </div>
      <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 14px' }}>
        <div className="form-group"><label className="form-label">Business name *</label><input className="form-input" value={d.businessName} onChange={(e) => set('businessName', e.target.value)} placeholder="Company LLC" /></div>
        <div className="form-group"><label className="form-label">Designation</label><input className="form-input" value={d.clientDesignation} onChange={(e) => set('clientDesignation', e.target.value)} placeholder="CEO, Director…" /></div>
        <div className="form-group"><label className="form-label">Email</label><input className="form-input" type="email" value={d.clientEmail} onChange={(e) => set('clientEmail', e.target.value)} placeholder="client@email.com" /></div>
        <div className="form-group"><label className="form-label">Phone / WhatsApp</label><input className="form-input" value={d.clientPhone} onChange={(e) => set('clientPhone', e.target.value)} placeholder="+971…" /></div>
      </div>
      <div className="form-group"><label className="form-label">Address</label><input className="form-input" value={d.clientAddress} onChange={(e) => set('clientAddress', e.target.value)} placeholder="Business address" /></div>
      <div className="form-group"><label className="form-label">Default payment link</label><input className="form-input" value={d.paymentLink} onChange={(e) => set('paymentLink', e.target.value)} placeholder="https://…" /></div>
    </Drawer>
  );
}
