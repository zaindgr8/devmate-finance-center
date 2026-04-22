import React from 'react';
import Icon from './Icon';
import { Badge, StatCard, Btn } from './UI';
import { fmtDate, fmtCurrency, today } from '../utils/helpers';

export default function Dashboard({ invoices, clients, totalRevenue, totalPaid, totalOutstanding, onNew, onView }) {
  const recent = invoices.slice(0, 5);

  return (
    <div className="animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700 }}>Dashboard</h1>
          <p style={{ color: 'var(--text-light)', fontSize: 13, marginTop: 4 }}>
            {fmtDate(today())} · Devmate Solutions
          </p>
        </div>
        <Btn onClick={onNew}>
          <Icon name="plus" size={14} /> New Invoice
        </Btn>
      </div>

      <div className="stats-grid" style={{ display: 'flex', gap: 14, marginBottom: 24, flexWrap: 'wrap' }}>
        <StatCard label="Total Revenue" value={`$${totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 0 })}`} accent="var(--primary)" />
        <StatCard label="Amount Received" value={`$${totalPaid.toLocaleString('en-US', { minimumFractionDigits: 0 })}`} accent="var(--success)" />
        <StatCard label="Outstanding" value={`$${totalOutstanding.toLocaleString('en-US', { minimumFractionDigits: 0 })}`} accent="var(--warning)" />
        <StatCard label="Total Clients" value={clients.length} accent="var(--info)" />
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '16px 22px', borderBottom: '1px solid var(--border-light)', fontWeight: 600, fontSize: 14 }}>
          Recent Invoices
        </div>
        {recent.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-light)', fontSize: 13 }}>
            No invoices yet. Create your first one!
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="inv-table">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Invoice', 'Client', 'Amount', 'Paid', 'Status', 'Date', ''].map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recent.map((inv) => (
                  <tr key={inv.invoiceNumber} style={{ borderBottom: '1px solid var(--border-light)' }}>
                    <td style={{ fontWeight: 600 }}>#{inv.invoiceNumber}</td>
                    <td style={{ color: 'var(--text-mid)' }}>{inv.clientName}</td>
                    <td>{fmtCurrency(inv.totalPayment, inv.currency)}</td>
                    <td style={{ color: 'var(--success)' }}>{fmtCurrency(inv.payingNow, inv.currency)}</td>
                    <td>
                      <Badge color={inv.status === 'paid' ? 'green' : inv.status === 'partial' ? 'yellow' : 'red'}>
                        {inv.status || 'unpaid'}
                      </Badge>
                    </td>
                    <td style={{ color: 'var(--text-light)' }}>{fmtDate(inv.date)}</td>
                    <td>
                      <button onClick={() => onView(inv)} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer' }}>
                        <Icon name="eye" size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
