import React from 'react';
import Icon from './Icon';
import { Badge, Btn } from './UI';
import { fmtDate, fmtCurrency, generatePrintHTML } from '../utils/helpers';

export default function InvoicePreview({ inv, onBack }) {
  const handleDownloadPDF = () => {
    // Load html2pdf.js from CDN if not already loaded
    const load = () => new Promise((resolve) => {
      if (window.html2pdf) { resolve(); return; }
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
      s.onload = resolve;
      document.head.appendChild(s);
    });

    load().then(() => {
      const htmlString = generatePrintHTML(inv);
      const container = document.createElement('div');
      container.innerHTML = htmlString;
      // Extract the inner body content
      const body = container.querySelector('body') || container;
      const opt = {
        margin: 0,
        filename: `Invoice-${inv.invoiceNumber}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      };
      window.html2pdf().set(opt).from(body).save();
    });
  };

  return (
    <div className="animate-fade-in">
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'var(--text-light)', cursor: 'pointer' }}>
            <Icon name="back" />
          </button>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>Invoice #{inv.invoiceNumber}</h1>
          <Badge color={inv.status === 'paid' ? 'green' : inv.status === 'partial' ? 'yellow' : 'red'}>
            {inv.status || 'unpaid'}
          </Badge>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn onClick={handleDownloadPDF}>
            <Icon name="file-text" size={14} /> Download PDF
          </Btn>
        </div>
      </div>

      <div style={{ overflow: 'hidden', maxWidth: 800 }}>
        {/* Header */}
        <div className="invoice-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 20, letterSpacing: 0.5 }}>DEVMATE SOLUTIONS</div>
              <div style={{ fontSize: 11, opacity: 0.85, letterSpacing: 1, marginTop: 2 }}>AI Powered Agency</div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: 2 }}>INVOICE</div>
            <div style={{ fontSize: 13, opacity: 0.9 }}>#{inv.invoiceNumber}</div>
          </div>
        </div>

        <div className="invoice-body">
          {/* Meta */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 28, marginBottom: 28 }}>
            <div>
              <div className="section-title" style={{ marginBottom: 8 }}>Bill To</div>
              <div style={{ fontWeight: 600, fontSize: 15 }}>{inv.clientName}</div>
              {inv.clientDesignation && <div style={{ fontSize: 12, color: 'var(--text-light)' }}>{inv.clientDesignation}</div>}
              <div style={{ fontWeight: 500, marginTop: 2 }}>{inv.businessName}</div>
              {inv.clientEmail && <div style={{ fontSize: 12, color: 'var(--text-light)', marginTop: 4 }}>{inv.clientEmail}</div>}
              {inv.clientPhone && <div style={{ fontSize: 12, color: 'var(--text-light)' }}>{inv.clientPhone}</div>}
              {inv.clientAddress && <div style={{ fontSize: 12, color: 'var(--text-light)' }}>{inv.clientAddress}</div>}
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="section-title" style={{ marginBottom: 8 }}>Details</div>
              <div style={{ fontSize: 13, color: 'var(--text-light)', lineHeight: 2 }}>
                <div>Date: <span style={{ color: 'var(--text)' }}>{fmtDate(inv.date)}</span></div>
                <div>Due: <span style={{ color: 'var(--text)' }}>{inv.dueDate ? fmtDate(inv.dueDate) : 'Upon Receipt'}</span></div>
                <div>Currency: <span style={{ color: 'var(--text)' }}>{inv.currency}</span></div>
              </div>
            </div>
          </div>

          {/* Table */}
          <div style={{ overflowX: 'auto', marginBottom: 24 }}>
            <table className="inv-table">
              <thead>
                <tr style={{ background: 'var(--bg)' }}>
                  {['#', 'Description', 'Qty', 'Rate', 'Amount'].map((h, i) => (
                    <th key={h} style={{ textAlign: i >= 2 ? (i === 2 ? 'center' : 'right') : 'left', borderBottom: '2px solid var(--primary)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(inv.items || []).map((it, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border-light)' }}>
                    <td style={{ color: 'var(--text-light)' }}>{i + 1}</td>
                    <td>{it.description}</td>
                    <td style={{ textAlign: 'center', color: 'var(--text-mid)' }}>{it.qty}</td>
                    <td style={{ textAlign: 'right', color: 'var(--text-mid)' }}>{fmtCurrency(it.rate, inv.currency)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmtCurrency((it.qty || 0) * (it.rate || 0), inv.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 24 }}>
            <div style={{ width: 260 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: 13, color: 'var(--text-mid)', borderBottom: '1px solid var(--border-light)' }}>
                <span>Subtotal</span><span>{fmtCurrency(inv.totalPayment, inv.currency)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: 13, color: 'var(--success)', borderBottom: '1px solid var(--border-light)' }}>
                <span>Paid</span><span>- {fmtCurrency(inv.payingNow, inv.currency)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: 13, color: 'var(--warning)', fontWeight: 600, borderBottom: '1px solid var(--border-light)' }}>
                <span>Balance Due</span><span>{fmtCurrency(inv.remaining, inv.currency)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0 0', fontSize: 17, color: 'var(--primary)', fontWeight: 700, borderTop: '2px solid var(--primary)', marginTop: 4 }}>
                <span>Total</span><span>{fmtCurrency(inv.totalPayment, inv.currency)}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {inv.specialNotes && (
            <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '14px 18px', marginBottom: 18 }}>
              <div className="section-title" style={{ marginBottom: 6 }}>Special Notes</div>
              <div style={{ fontSize: 12, color: 'var(--text-mid)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{inv.specialNotes}</div>
            </div>
          )}

          {/* Payment Link */}
          {inv.paymentLink && (
            <div style={{ background: 'linear-gradient(135deg, var(--primary), #A00D2E)', borderRadius: 8, padding: '14px 18px', textAlign: 'center', marginBottom: 18 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>💳 Pay Now: </span>
              <a
                href={inv.paymentLink}
                target="_blank"
                rel="noreferrer"
                style={{
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 700,
                  textDecoration: 'underline',
                  textUnderlineOffset: 3,
                  letterSpacing: 0.3,
                }}
              >
                Click Here to Pay
              </a>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="invoice-footer">
          <div style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 700, letterSpacing: 1.5 }}>DUBAI · MUSCAT · NEW YORK</div>
          <div style={{ fontSize: 11, color: 'var(--text-light)', marginTop: 4 }}>management@devmatesolutions.com · devmatesolutions.com</div>
          <div style={{ fontSize: 11, color: 'var(--text-light)', marginTop: 2 }}>THANK YOU FOR YOUR TRUST!</div>
        </div>
      </div>
    </div>
  );
}
