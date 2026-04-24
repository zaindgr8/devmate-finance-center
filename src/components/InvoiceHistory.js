import React from 'react';
import Icon from './Icon';
import { Badge, Btn } from './UI';
import { fmtDate, fmtCurrency } from '../utils/helpers';

export default function InvoiceHistory({ invoices, searchQ, setSearchQ, clientFilter, setClientFilter, onPreview, onEdit, onDelete, onUpdateStatus, onConfirmPayment }) {
  let list = invoices;
  if (clientFilter) list = list.filter((i) => i.clientName === clientFilter);
  if (searchQ) {
    const q = searchQ.toLowerCase();
    list = list.filter((i) => i.clientName?.toLowerCase().includes(q) || i.invoiceNumber?.includes(q) || i.businessName?.toLowerCase().includes(q));
  }

  return (
    <div className="animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>
          Invoices {clientFilter && <span style={{ fontSize: 14, color: 'var(--primary)' }}>· {clientFilter}</span>}
        </h1>
        {clientFilter && (
          <Btn variant="ghost" size="sm" onClick={() => setClientFilter('')}>
            <Icon name="x" size={12} /> Clear
          </Btn>
        )}
      </div>

      <div style={{ position: 'relative', marginBottom: 20, maxWidth: 400 }}>
        <input
          className="search-input"
          value={searchQ}
          onChange={(e) => setSearchQ(e.target.value)}
          placeholder="Search invoices..."
        />
        <div className="search-icon"><Icon name="search" size={14} /></div>
      </div>

      {list.length === 0 ? (
        <div className="card" style={{ padding: 60, textAlign: 'center', color: 'var(--text-light)', fontSize: 13 }}>
          No invoices found
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {list.map((inv) => (
            <div key={inv.invoiceNumber} className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 160 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>
                  #{inv.invoiceNumber}{' '}
                  <span style={{ fontWeight: 400, color: 'var(--text-light)', fontSize: 12 }}>· {inv.clientName}</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-light)', marginTop: 2 }}>
                  {inv.businessName} · {fmtDate(inv.date)}
                </div>
              </div>
              <div style={{ minWidth: 100, textAlign: 'right' }}>
                <div style={{ fontWeight: 700 }}>{fmtCurrency(inv.totalPayment, inv.currency)}</div>
                <div style={{ fontSize: 11, color: 'var(--text-light)', marginTop: 2 }}>
                  {inv.status === 'pending' ? 'Pending Confirm: ' : inv.status === 'scheduled' ? '🕐 Activates: ' : 'Paid: '}
                  {inv.status === 'scheduled' ? (inv.scheduledDate ? new Date(inv.scheduledDate).toLocaleString() : '–') : fmtCurrency(inv.payingNow, inv.currency)}
                </div>
              </div>
              {inv.status === 'scheduled' ? (
                <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: 'rgba(124,58,237,0.12)', color: '#7c3aed', whiteSpace: 'nowrap' }}>SCHEDULED</span>
              ) : (
                <Badge color={inv.status === 'paid' ? 'green' : inv.status === 'partial' ? 'yellow' : inv.status === 'pending' ? 'blue' : 'red'}>
                  {inv.status === 'pending' ? 'pending' : (inv.status || 'unpaid')}
                </Badge>
              )}
              <div style={{ display: 'flex', gap: 6 }}>
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
                {inv.status === 'scheduled' && (
                  <Btn variant="ghost" size="sm" onClick={() => onUpdateStatus(inv.invoiceNumber, 'pending')} title="Activate Now">
                    ▶ Activate
                  </Btn>
                )}
                <Btn variant="ghost" size="sm" onClick={() => onPreview(inv)} title="Preview"><Icon name="eye" size={12} /></Btn>
                <Btn variant="ghost" size="sm" onClick={() => onEdit(inv)} title="Edit"><Icon name="edit" size={12} /></Btn>
                <Btn variant="danger" size="sm" onClick={() => onDelete(inv.invoiceNumber)} title="Delete"><Icon name="trash" size={12} /></Btn>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
