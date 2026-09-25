import React, { useMemo, useState } from 'react';
import Icon from './Icon';
import { Badge, Btn, Segmented, Empty } from './UI';
import {
  fmtDate, fmtCurrency, fmtAED, today, firstOfMonthStr, currentYM, isInvoiceOverdue, invoiceReceived, invoiceOutstanding,
  daysBetween, buildReminderText, downloadCSV, toAED, statusColor,
} from '../utils/helpers';

// paidAt is an ISO timestamp; compare using the local calendar day
const localDay = (iso) => {
  const d = new Date(iso);
  return isNaN(d) ? String(iso).slice(0, 10) : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const isRecurring = (i) => (i.financeData?.paymentType || i.financeRaw?.paymentType) === 'recurring';
const isOpenStatus = (i) => i.status === 'pending' || i.status === 'unpaid' || i.status === 'partial' || !i.status;

export default function InvoiceHistory({
  invoices, clients = [], searchQ, setSearchQ, clientFilter, setClientFilter,
  onNew, onPreview, onEdit, onDelete, onUpdateStatus, onConfirmPayment, onDuplicate, onNotify,
}) {
  const todayStr = today();
  const monthStartStr = firstOfMonthStr();
  const [tab, setTab] = useState('open');
  const [sort, setSort] = useState('manual');
  const [dateFrom, setDateFrom] = useState(monthStartStr);
  const [dateTo, setDateTo] = useState(todayStr);

  // Client + search filter shared by every tab
  const base = useMemo(() => {
    let l = invoices;
    if (clientFilter) l = l.filter((i) => i.clientName === clientFilter);
    const q = (searchQ || '').trim().toLowerCase();
    if (q) {
      l = l.filter((i) => [i.clientName, i.businessName, i.projectName, String(i.invoiceNumber || '')]
        .some((v) => (v || '').toLowerCase().includes(q)));
    }
    return l;
  }, [invoices, clientFilter, searchQ]);

  const lists = useMemo(() => ({
    // Anything still to collect (partial invoices stay here until fully paid)
    open: base.filter((i) => isOpenStatus(i) && !isRecurring(i)),
    recurring: base.filter((i) => isRecurring(i) && (isOpenStatus(i) || i.status === 'scheduled')),
    scheduled: base.filter((i) => i.status === 'scheduled' && !isRecurring(i)),
    // Money received in the date range (by payment date)
    paid: base.filter((i) => {
      if (i.status !== 'paid' && i.status !== 'partial') return false;
      const d = i.paidAt ? localDay(i.paidAt) : (i.date || '').slice(0, 10);
      if (!d) return true;
      if (dateFrom && d < dateFrom) return false;
      if (dateTo && d > dateTo) return false;
      return true;
    }),
    all: base,
  }), [base, dateFrom, dateTo]);

  const active = useMemo(() => {
    const l = [...(lists[tab] || [])];
    const by = {
      manual: null, // keep saved order
      newest: (a, b) => (b.date || '').localeCompare(a.date || '') || Number(b.invoiceNumber) - Number(a.invoiceNumber),
      due: (a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999'),
      amount: (a, b) => toAED(b.totalPayment, b.currency) - toAED(a.totalPayment, a.currency),
    };
    return by[sort] ? l.sort(by[sort]) : l;
  }, [lists, tab, sort]);

  // Summary (for the current client/search filter)
  const summary = useMemo(() => {
    const outstanding = base.reduce((s, i) => s + toAED(invoiceOutstanding(i), i.currency), 0);
    const overdue = base.filter((i) => isInvoiceOverdue(i, todayStr));
    const ym = currentYM();
    const receivedMonth = base
      .filter((i) => invoiceReceived(i) > 0 && (i.paidAt ? localDay(i.paidAt) : (i.date || '')).slice(0, 7) === ym)
      .reduce((s, i) => s + toAED(invoiceReceived(i), i.currency), 0);
    const awaiting = base.filter((i) => i.status === 'pending').length;
    return {
      outstanding, receivedMonth, awaiting,
      overdueCount: overdue.length,
      overdueAmt: overdue.reduce((s, i) => s + toAED(invoiceOutstanding(i), i.currency), 0),
    };
  }, [base, todayStr]);

  const copyReminder = async (inv) => {
    const text = buildReminderText(inv);
    try {
      await navigator.clipboard.writeText(text);
      onNotify && onNotify('Reminder copied. Paste it into WhatsApp or email');
    } catch {
      window.prompt('Copy this reminder:', text);
    }
  };

  const exportCSV = () => {
    const rows = [['Invoice #', 'Client', 'Business', 'Project', 'Date', 'Due', 'Paid on', 'Status', 'Currency', 'Total', 'Received', 'Outstanding', 'Total (AED)', 'Type']];
    active.forEach((i) => rows.push([
      i.invoiceNumber, i.clientName, i.businessName, i.projectName || '', i.date || '', i.dueDate || '',
      i.paidAt ? localDay(i.paidAt) : '', isInvoiceOverdue(i, todayStr) ? 'overdue' : (i.status || 'unpaid'), i.currency,
      Number(i.totalPayment) || 0, invoiceReceived(i), invoiceOutstanding(i), toAED(i.totalPayment, i.currency).toFixed(2),
      isRecurring(i) ? 'recurring' : 'one-time',
    ]));
    downloadCSV(`invoices-${tab}-${todayStr}.csv`, rows);
  };

  const clientNames = useMemo(
    () => [...new Set([...clients.map((c) => c.name), ...invoices.map((i) => i.clientName)].filter(Boolean))].sort(),
    [clients, invoices],
  );

  const primaryAction = (inv) => {
    if (inv.status === 'scheduled') {
      return <Btn size="sm" variant="ghost" onClick={() => onUpdateStatus(inv.invoiceNumber, 'pending')}>▶ Activate</Btn>;
    }
    if (inv.status === 'pending') {
      return <Btn size="sm" onClick={() => onConfirmPayment(inv.invoiceNumber)} title="Record the payment as received">Confirm</Btn>;
    }
    if (inv.status !== 'paid') {
      return <Btn size="sm" variant="success" onClick={() => onUpdateStatus(inv.invoiceNumber, 'paid')} title="Mark fully paid"><Icon name="check" size={12} /> Paid</Btn>;
    }
    return null;
  };

  const statusLine = (inv, overdue, outstanding) => {
    if (inv.status === 'scheduled') return <span style={{ color: '#7c3aed' }}>🕐 Activates {inv.scheduledDate ? new Date(inv.scheduledDate).toLocaleString() : '—'}</span>;
    if (inv.status === 'paid') return <span style={{ color: 'var(--success)' }}>Paid {inv.paidAt ? fmtDate(inv.paidAt) : ''}</span>;
    if (overdue) return <span style={{ color: 'var(--danger)', fontWeight: 600 }}>Overdue {daysBetween(inv.dueDate, todayStr)}d · {fmtCurrency(outstanding, inv.currency)} due</span>;
    if (inv.status === 'partial') return <span style={{ color: 'var(--warning)' }}>{fmtCurrency(outstanding, inv.currency)} balance</span>;
    if (inv.dueDate) return <span>Due {fmtDate(inv.dueDate)}</span>;
    return <span>Due on receipt</span>;
  };

  const TABS = [
    { value: 'open', label: 'Open', count: lists.open.length },
    { value: 'recurring', label: 'Recurring', count: lists.recurring.length },
    { value: 'scheduled', label: 'Scheduled', count: lists.scheduled.length },
    { value: 'paid', label: 'Paid', count: lists.paid.length },
    { value: 'all', label: 'All', count: lists.all.length },
  ];

  return (
    <div className="animate-fade-in">
      <div className="page-head">
        <div>
          <h1 className="page-title">Invoices</h1>
          <p className="page-sub">{clientFilter ? <>Showing <b>{clientFilter}</b> · <button className="link-btn" onClick={() => setClientFilter('')}>show all clients</button></> : 'Everything you have billed, and what is still to collect'}</p>
        </div>
        <Btn onClick={onNew}><Icon name="plus" size={14} /> New invoice</Btn>
      </div>

      <div className="stat-strip">
        <div>
          <div className="stat-strip-label">Outstanding</div>
          <div className="stat-strip-value" style={{ color: summary.outstanding ? 'var(--warning)' : 'var(--text)' }}>{fmtAED(summary.outstanding, 0)}</div>
          <div className="stat-strip-sub">{summary.awaiting} awaiting confirmation</div>
        </div>
        <div>
          <div className="stat-strip-label">Overdue</div>
          <div className="stat-strip-value" style={{ color: summary.overdueCount ? 'var(--danger)' : 'var(--text)' }}>{fmtAED(summary.overdueAmt, 0)}</div>
          <div className="stat-strip-sub">{summary.overdueCount} invoice{summary.overdueCount === 1 ? '' : 's'} past due</div>
        </div>
        <div>
          <div className="stat-strip-label">Received this month</div>
          <div className="stat-strip-value" style={{ color: 'var(--success)' }}>{fmtAED(summary.receivedMonth, 0)}</div>
          <div className="stat-strip-sub">by payment date</div>
        </div>
      </div>

      <div className="toolbar">
        <Segmented value={tab} onChange={setTab} options={TABS} />
      </div>
      <div className="toolbar">
        <div className="search-wrap">
          <input className="search-input" value={searchQ} onChange={(e) => setSearchQ(e.target.value)} placeholder="Search client, project or #…" />
          <div className="search-icon"><Icon name="search" size={14} /></div>
        </div>
        <select className="form-select" style={{ width: 'auto', maxWidth: 200 }} value={clientFilter} onChange={(e) => setClientFilter(e.target.value)} aria-label="Filter by client">
          <option value="">All clients</option>
          {clientNames.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        <select className="form-select" style={{ width: 'auto' }} value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort invoices">
          <option value="manual">Sort: Default</option>
          <option value="newest">Sort: Newest</option>
          <option value="due">Sort: Due date</option>
          <option value="amount">Sort: Amount</option>
        </select>
        <button className="link-btn" style={{ marginLeft: 'auto' }} onClick={exportCSV} disabled={active.length === 0}>⬇ Export CSV</button>
      </div>

      {tab === 'paid' && (
        <div className="toolbar" style={{ fontSize: 12, color: 'var(--text-light)' }}>
          <span>Paid between</span>
          <input type="date" className="form-input" style={{ width: 'auto', padding: '6px 10px' }} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} aria-label="From" />
          <span>and</span>
          <input type="date" className="form-input" style={{ width: 'auto', padding: '6px 10px' }} value={dateTo} onChange={(e) => setDateTo(e.target.value)} aria-label="To" />
          <button className="chip-btn" onClick={() => { setDateFrom(monthStartStr); setDateTo(todayStr); }}>This month</button>
          <button className="chip-btn" onClick={() => { setDateFrom(''); setDateTo(''); }}>All time</button>
          <span style={{ marginLeft: 'auto', fontWeight: 600 }}>
            Received <span style={{ color: 'var(--success)' }}>{fmtAED(lists.paid.reduce((s, i) => s + toAED(invoiceReceived(i), i.currency), 0))}</span>
          </span>
        </div>
      )}

      <div className="list">
        {active.length === 0 ? (
          <Empty
            icon={{ open: '✅', recurring: '🔄', scheduled: '📅', paid: '💸', all: '🧾' }[tab]}
            title={{
              open: 'Nothing left to collect',
              recurring: 'No open recurring invoices',
              scheduled: 'No scheduled invoices',
              paid: 'No payments in this date range',
              all: 'No invoices yet',
            }[tab]}
            text={searchQ || clientFilter ? 'Try clearing the search or client filter.' : undefined}
            action={tab === 'all' && !invoices.length && <Btn size="sm" onClick={onNew}>+ New invoice</Btn>}
          />
        ) : active.map((inv) => {
          const overdue = isInvoiceOverdue(inv, todayStr);
          const outstanding = invoiceOutstanding(inv);
          return (
            <div key={inv.invoiceNumber} className="list-row clickable" onClick={() => onPreview(inv)} style={overdue ? { boxShadow: 'inset 3px 0 0 var(--danger)' } : undefined}>
              <div className="inv-num">#{inv.invoiceNumber}</div>
              <div className="row-main">
                <div className="row-title">
                  {inv.clientName}
                  {isRecurring(inv) && <span className="badge badge-blue">🔄 Recurring</span>}
                </div>
                <div className="row-sub">{[inv.projectName || inv.businessName, fmtDate(inv.date)].filter(Boolean).join(' · ')}</div>
              </div>
              <div className="row-amount hide-sm" style={{ minWidth: 170, textAlign: 'left', fontSize: 12, color: 'var(--text-light)' }}>
                {statusLine(inv, overdue, outstanding)}
              </div>
              <div className="row-amount" style={{ minWidth: 120 }}>
                <div className="row-amount-main">{fmtCurrency(inv.totalPayment, inv.currency)}</div>
                <div className="row-amount-sub">
                  <Badge color={overdue ? 'red' : statusColor(inv.status)}>{overdue ? 'overdue' : (inv.status || 'unpaid')}</Badge>
                </div>
              </div>
              <div className="row-actions" onClick={(e) => e.stopPropagation()}>
                {primaryAction(inv)}
                {outstanding > 0 && inv.status !== 'scheduled' && (
                  <button className="icon-btn" onClick={() => copyReminder(inv)} title="Copy payment reminder"><Icon name="bell" size={13} /></button>
                )}
                <RowMenu
                  items={[
                    { label: 'Edit', icon: 'edit', onClick: () => onEdit(inv) },
                    onDuplicate && { label: 'Duplicate', icon: 'copy', onClick: () => onDuplicate(inv) },
                    { label: 'Delete', icon: 'trash', danger: true, onClick: () => onDelete(inv.invoiceNumber) },
                  ].filter(Boolean)}
                />
              </div>
            </div>
          );
        })}
      </div>
      {active.length > 0 && <div className="hint">Click an invoice to open it</div>}
    </div>
  );
}

/* Small "⋯" menu so rows keep only one or two visible actions */
function RowMenu({ items }) {
  const [open, setOpen] = useState(false);
  React.useEffect(() => {
    if (!open) return undefined;
    const close = () => setOpen(false);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [open]);
  return (
    <div style={{ position: 'relative' }}>
      <button className="icon-btn" aria-label="More actions" aria-expanded={open} onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}>⋯</button>
      {open && (
        <div className="row-menu" role="menu">
          {items.map((it) => (
            <button key={it.label} role="menuitem" className={it.danger ? 'danger' : ''} onClick={() => { setOpen(false); it.onClick(); }}>
              <Icon name={it.icon} size={13} /> {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
