import React, { useState } from 'react';
import Icon from './Icon';
import { Badge, Btn } from './UI';
import { fmtDate, fmtCurrency } from '../utils/helpers';

const TABS = [
  { id: 'pending_one_time', label: 'Pending Invoices (One-Time)', color: '#3b82f6' },
  { id: 'pending_recurring', label: 'Pending Invoices (Re-Occuring)', color: '#2563eb' },
  { id: 'scheduled', label: 'Scheduled', color: '#7c3aed' },
  { id: 'paid', label: 'Paid', color: '#10b981' },
];

export default function InvoiceHistory({ invoices, searchQ, setSearchQ, clientFilter, setClientFilter, onNew, onPreview, onEdit, onDelete, onUpdateStatus, onConfirmPayment, onReorder }) {
  const [activeTab, setActiveTab] = useState('pending_one_time');

  // Date range state for Paid tab
  const todayStr = new Date().toISOString().slice(0, 10);
  const firstOfMonth = new Date();
  firstOfMonth.setDate(1);
  const firstOfMonthStr = firstOfMonth.toISOString().slice(0, 10);
  const [dateFrom, setDateFrom] = useState(firstOfMonthStr);
  const [dateTo, setDateTo] = useState(todayStr);

  // Drag-and-drop state
  const [dragId, setDragId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);

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
    const fromIdx = invoices.findIndex(i => i.invoiceNumber === dragId);
    const toIdx = invoices.findIndex(i => i.invoiceNumber === dragOverId);
    if (fromIdx === -1 || toIdx === -1) {
      setDragId(null); setDragOverId(null); return;
    }
    const newInvoices = [...invoices];
    const [moved] = newInvoices.splice(fromIdx, 1);
    newInvoices.splice(toIdx, 0, moved);
    if (onReorder) onReorder(newInvoices);
    setDragId(null); setDragOverId(null);
  };

  // Base filtering (client + search)
  let baseList = invoices;
  if (clientFilter) baseList = baseList.filter(i => i.clientName === clientFilter);
  if (searchQ) {
    const q = searchQ.toLowerCase();
    baseList = baseList.filter(i =>
      i.clientName?.toLowerCase().includes(q) ||
      i.invoiceNumber?.includes(q) ||
      i.businessName?.toLowerCase().includes(q)
    );
  }

  // Tab-specific filtering
  const isRecurring = (i) => (i.financeData?.paymentType || i.financeRaw?.paymentType) === 'recurring';

  const pendingList = baseList.filter(i => i.status === 'pending' || i.status === 'unpaid' || (!i.status));
  const pendingOneTimeList = pendingList.filter(i => !isRecurring(i));

  // Re-Occurring: pending-recurring + scheduled-recurring (awaiting activation)
  const pendingRecurringList = [
    ...pendingList.filter(isRecurring),
    ...baseList.filter(i => i.status === 'scheduled' && isRecurring(i)),
  ];

  // Scheduled tab: only non-recurring scheduled invoices
  const scheduledList = baseList.filter(i => i.status === 'scheduled' && !isRecurring(i));

  const paidList = baseList.filter(i => {
    if (i.status !== 'paid' && i.status !== 'partial') return false;
    // Use paidAt (actual payment date) for filtering; fall back to invoice date for old records
    const dateToCheck = (i.paidAt || i.date || '').slice(0, 10);
    if (!dateToCheck) return true;
    if (dateFrom && dateToCheck < dateFrom) return false;
    if (dateTo && dateToCheck > dateTo) return false;
    return true;
  });

  const listMap = {
    pending_one_time: pendingOneTimeList,
    pending_recurring: pendingRecurringList,
    scheduled: scheduledList,
    paid: paidList
  };
  const activeList = listMap[activeTab] || [];

  const tabCounts = {
    pending_one_time: pendingOneTimeList.length,
    pending_recurring: pendingRecurringList.length,
    scheduled: scheduledList.length,
    paid: paidList.length,
  };

  const renderInvoiceCard = (inv) => {
    const isDragTarget = dragOverId === inv.invoiceNumber && dragId !== inv.invoiceNumber;
    return (
      <div
        key={inv.invoiceNumber}
        className="card"
        draggable
        onDragStart={(e) => handleDragStart(e, inv.invoiceNumber)}
        onDragOver={(e) => handleDragOver(e, inv.invoiceNumber)}
        onDragEnd={() => { setDragId(null); setDragOverId(null); }}
        onDrop={handleDrop}
        style={{
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          flexWrap: 'wrap',
          cursor: 'grab',
          opacity: dragId === inv.invoiceNumber ? 0.45 : 1,
          borderTop: isDragTarget ? '3.5px solid var(--primary)' : '1px solid var(--border)',
          transition: 'all 0.15s ease',
        }}
      >
        {/* Drag handle */}
        <div
          style={{ color: 'var(--text-faint)', fontSize: 16, cursor: 'grab', userSelect: 'none', paddingRight: 4, display: 'flex', alignItems: 'center' }}
          title="Drag to reorder"
        >
          ⠿
        </div>

        {/* Invoice info */}
        <div style={{ flex: 1, minWidth: 160 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>
            #{inv.invoiceNumber}{' '}
            <span style={{ fontWeight: 400, color: 'var(--text-light)', fontSize: 12 }}>· {inv.clientName}</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-light)', marginTop: 2 }}>
            {inv.businessName} · {fmtDate(inv.date)}
            {/* Show paid date when the invoice is paid/partial */}
            {(inv.status === 'paid' || inv.status === 'partial') && inv.paidAt && (
              <span style={{ marginLeft: 8, color: 'var(--success)', fontWeight: 600 }}>
                · Paid {fmtDate(inv.paidAt)}
              </span>
            )}
          </div>
        </div>

        {/* Amount */}
        <div style={{ minWidth: 100, textAlign: 'right' }}>
          <div style={{ fontWeight: 700 }}>{fmtCurrency(inv.totalPayment, inv.currency)}</div>
          <div style={{ fontSize: 11, color: 'var(--text-light)', marginTop: 2 }}>
            {inv.status === 'pending' ? 'Pending Confirm: '
              : inv.status === 'scheduled' ? '🕐 Activates: '
              : (inv.status === 'paid' || inv.status === 'partial') ? 'Paid: '
              : 'Amount: '}
            {inv.status === 'scheduled'
              ? (inv.scheduledDate ? new Date(inv.scheduledDate).toLocaleString() : '–')
              : fmtCurrency(inv.payingNow, inv.currency)}
          </div>
        </div>

        {/* Status badge */}
        {inv.status === 'scheduled' && isRecurring(inv) ? (
          // Scheduled + recurring: show combined badge in the Re-Occurring tab
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
            <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: 'rgba(124,58,237,0.12)', color: '#7c3aed', whiteSpace: 'nowrap' }}>
              SCHEDULED
            </span>
            <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: 'rgba(37,99,235,0.10)', color: '#2563eb', whiteSpace: 'nowrap' }}>
              🔄 RE-OCCURRING
            </span>
          </div>
        ) : inv.status === 'scheduled' ? (
          <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: 'rgba(124,58,237,0.12)', color: '#7c3aed', whiteSpace: 'nowrap' }}>
            SCHEDULED
          </span>
        ) : isRecurring(inv) && (inv.status === 'pending' || inv.status === 'unpaid') ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
            <Badge color="blue">{inv.status === 'pending' ? 'pending' : (inv.status || 'unpaid')}</Badge>
            <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: 'rgba(37,99,235,0.10)', color: '#2563eb', whiteSpace: 'nowrap' }}>
              🔄 RE-OCCURRING
            </span>
          </div>
        ) : (
          <Badge color={inv.status === 'paid' ? 'green' : inv.status === 'partial' ? 'yellow' : inv.status === 'pending' ? 'blue' : 'red'}>
            {inv.status === 'pending' ? 'pending' : (inv.status || 'unpaid')}
          </Badge>
        )}

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 6 }}>
          {/* Scheduled recurring in Re-Occurring tab: show Activate button */}
          {inv.status === 'scheduled' && isRecurring(inv) && (
            <Btn variant="ghost" size="sm" onClick={() => onUpdateStatus(inv.invoiceNumber, 'pending')} title="Activate Now">
              ▶ Activate
            </Btn>
          )}
          {/* Normal pending: show Confirm button */}
          {inv.status === 'pending' && (
            <Btn variant="primary" size="sm" onClick={() => onConfirmPayment(inv.invoiceNumber)} title="Confirm Payment">
              Confirm
            </Btn>
          )}
          {inv.status !== 'paid' && inv.status !== 'pending' && inv.status !== 'scheduled' && (
            <Btn variant="success" size="sm" onClick={() => onUpdateStatus(inv.invoiceNumber, 'paid')} title="Mark Paid">
              <Icon name="check" size={12} />
            </Btn>
          )}
          {/* Non-recurring scheduled: show standard Activate */}
          {inv.status === 'scheduled' && !isRecurring(inv) && (
            <Btn variant="ghost" size="sm" onClick={() => onUpdateStatus(inv.invoiceNumber, 'pending')} title="Activate Now">
              ▶ Activate
            </Btn>
          )}
          <Btn variant="ghost" size="sm" onClick={() => onPreview(inv)} title="Preview"><Icon name="eye" size={12} /></Btn>
          <Btn variant="ghost" size="sm" onClick={() => onEdit(inv)} title="Edit"><Icon name="edit" size={12} /></Btn>
          <Btn variant="danger" size="sm" onClick={() => onDelete(inv.invoiceNumber)} title="Delete"><Icon name="trash" size={12} /></Btn>
        </div>
      </div>
    );
  };

  return (
    <div className="animate-fade-in">
      {/* ── Header row ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>
            Invoices {clientFilter && <span style={{ fontSize: 14, color: 'var(--primary)' }}>· {clientFilter}</span>}
          </h1>
          {clientFilter && (
            <Btn variant="ghost" size="sm" onClick={() => setClientFilter('')}>
              <Icon name="x" size={12} /> Clear
            </Btn>
          )}
        </div>
        <button
          onClick={onNew}
          style={{
            background: 'var(--primary)',
            color: '#fff',
            border: 'none',
            borderRadius: 10,
            padding: '10px 20px',
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: 'Poppins, sans-serif',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            boxShadow: '0 4px 14px rgba(99,102,241,0.35)',
            transition: 'all 0.2s',
          }}
          onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
        >
          <Icon name="plus" size={14} />
          New Invoice
        </button>
      </div>

      {/* ── Search bar ── */}
      <div style={{ position: 'relative', marginBottom: 20, maxWidth: 400 }}>
        <input
          className="search-input"
          value={searchQ}
          onChange={(e) => setSearchQ(e.target.value)}
          placeholder="Search invoices..."
        />
        <div className="search-icon"><Icon name="search" size={14} /></div>
      </div>

      {/* ── Tab bar ── */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '2px solid var(--border)', paddingBottom: 0 }}>
        {TABS.map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                background: 'none',
                border: 'none',
                borderBottom: isActive ? `3px solid ${tab.color}` : '3px solid transparent',
                padding: '10px 20px',
                fontSize: 13,
                fontWeight: isActive ? 700 : 500,
                color: isActive ? tab.color : 'var(--text-light)',
                cursor: 'pointer',
                fontFamily: 'Poppins, sans-serif',
                transition: 'all 0.18s',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: -2,
                borderRadius: '6px 6px 0 0',
                whiteSpace: 'nowrap',
              }}
            >
              {tab.label}
              <span style={{
                background: isActive ? tab.color : 'var(--border)',
                color: isActive ? '#fff' : 'var(--text-light)',
                borderRadius: 20,
                fontSize: 10,
                fontWeight: 700,
                padding: '1px 7px',
                minWidth: 20,
                textAlign: 'center',
                transition: 'all 0.18s',
              }}>
                {tabCounts[tab.id]}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Paid tab: Date range filter ── */}
      {activeTab === 'paid' && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginBottom: 20,
          padding: '12px 18px',
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-light)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 15 }}>📅</span> Filter by date:
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <label style={{ fontSize: 11, color: 'var(--text-faint)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8 }}>From</label>
              <input
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                style={{
                  padding: '6px 10px',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  fontSize: 13,
                  background: 'var(--input-bg)',
                  color: 'var(--text)',
                  fontFamily: 'Poppins, sans-serif',
                  cursor: 'pointer',
                }}
              />
            </div>
            <span style={{ color: 'var(--text-faint)', fontSize: 14 }}>→</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <label style={{ fontSize: 11, color: 'var(--text-faint)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8 }}>To</label>
              <input
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                style={{
                  padding: '6px 10px',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  fontSize: 13,
                  background: 'var(--input-bg)',
                  color: 'var(--text)',
                  fontFamily: 'Poppins, sans-serif',
                  cursor: 'pointer',
                }}
              />
            </div>
            <button
              onClick={() => { setDateFrom(firstOfMonthStr); setDateTo(todayStr); }}
              style={{
                padding: '6px 12px',
                border: '1px solid var(--border)',
                borderRadius: 8,
                background: 'transparent',
                fontSize: 11,
                color: 'var(--text-light)',
                cursor: 'pointer',
                fontFamily: 'Poppins, sans-serif',
                fontWeight: 600,
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--border-light)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              This Month
            </button>
            <button
              onClick={() => { setDateFrom(''); setDateTo(''); }}
              style={{
                padding: '6px 12px',
                border: '1px solid var(--border)',
                borderRadius: 8,
                background: 'transparent',
                fontSize: 11,
                color: 'var(--text-light)',
                cursor: 'pointer',
                fontFamily: 'Poppins, sans-serif',
                fontWeight: 600,
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--border-light)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              All Time
            </button>
          </div>
          <div style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-light)', fontWeight: 600 }}>
            {paidList.length} invoice{paidList.length !== 1 ? 's' : ''} ·{' '}
            <span style={{ color: 'var(--success)' }}>
              AED {paidList.reduce((s, i) => s + (Number(i.payingNow) || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      )}

      {/* ── Invoice list ── */}
      {activeList.length === 0 ? (
        <div className="card" style={{ padding: 60, textAlign: 'center', color: 'var(--text-light)', fontSize: 13 }}>
          {activeTab === 'pending_one_time' && '✅ No pending one-time invoices — all caught up!'}
          {activeTab === 'pending_recurring' && '🔄 No pending recurring invoices.'}
          {activeTab === 'scheduled' && '📅 No scheduled invoices.'}
          {activeTab === 'paid' && '💸 No paid invoices in this date range.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {activeList.map(inv => renderInvoiceCard(inv))}
        </div>
      )}

      {/* ── Footer hint ── */}
      {activeList.length > 0 && (
        <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-faint)', textAlign: 'right' }}>
          💡 Drag ⠿ to reorder invoices
        </div>
      )}
    </div>
  );
}
