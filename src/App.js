import React, { useState, useEffect, useCallback } from 'react';
import Icon from './components/Icon';
import Dashboard from './components/Dashboard';
import InvoiceForm from './components/InvoiceForm';
import InvoiceHistory from './components/InvoiceHistory';
import InvoicePreview from './components/InvoicePreview';
import FinanceView from './components/FinanceView';
import SalariesView from './components/SalariesView';
import LoginView from './components/LoginView';
import { ClientsView, ReportsView } from './components/ClientsReports';
import { supabase } from './supabaseClient';
import { today, createFinanceRecord, rolloverMonth, currentYM, extractSalariesFromInvoice } from './utils/helpers';
import { fetchAllData, upsertClient, deleteClient, upsertInvoice, deleteInvoice, upsertFinance, deleteFinance, upsertSalaries, deleteSalary, updateSetting } from './api';
// Using PNG logo from public/logo_2.png

const VIEWS = {
  DASHBOARD: 'dashboard',
  CREATE: 'create',
  HISTORY: 'history',
  CLIENTS: 'clients',
  PREVIEW: 'preview',
  REPORTS: 'reports',
  FINANCE: 'finance',
  SALARIES: 'salaries',
};

export default function App() {
  const [view, setView] = useState(VIEWS.DASHBOARD);
  const [invoices, setInvoices] = useState([]);
  const [clients, setClients] = useState([]);
  const [finance, setFinance] = useState([]);
  const [salaries, setSalaries] = useState([]);
  const [nextNum, setNextNum] = useState(4001);
  const [loading, setLoading] = useState(true);
  const [previewInv, setPreviewInv] = useState(null);
  const [editInv, setEditInv] = useState(null);
  const [searchQ, setSearchQ] = useState('');
  const [clientFilter, setClientFilter] = useState('');
  const [toast, setToast] = useState(null);
  const [dbStatus, setDbStatus] = useState('connecting'); // 'connecting', 'connected', 'error'
  const [session, setSession] = useState(null);
  const [mobileNav, setMobileNav] = useState(false);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };


  // Auth Listener
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Load data from Supabase + rollover check
  useEffect(() => {
    if (!session) return;
    
    async function init() {
      console.log("Supabase Init: Starting fetch...");
      try {
        const db = await fetchAllData();
        console.log("Supabase Init: Data received", db);
        setInvoices(db.invoices);
        setClients(db.clients);
        setNextNum(db.nextNum);
        setSalaries(db.salaries);

        let fin = db.finance;
        const thisMonth = currentYM();
        const today1st = new Date().getDate() === 1;
        
        if (today1st && db.lastRollover !== thisMonth && fin.some((r) => r.month !== thisMonth)) {
          fin = rolloverMonth(fin, thisMonth);
          await upsertFinance(fin);
          await updateSetting('last_rollover', thisMonth);
        }
        
        setFinance(fin);
        setDbStatus('connected');
      } catch (err) {
        console.error("Supabase Init Error:", err);
        setDbStatus('error');
        showToast("Database Connection Failed. Check console for details.", "error");
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [session]);

  // Save helpers
  const saveInvoices = useCallback((v, invToUpsert) => {
    setInvoices(v);
    if (invToUpsert) upsertInvoice(invToUpsert);
  }, []);

  const saveClients = useCallback((v, clientToUpsert) => {
    setClients(v);
    if (clientToUpsert) upsertClient(clientToUpsert);
  }, []);

  const saveNextNum = useCallback((v) => {
    setNextNum(v);
    updateSetting('next_invoice_num', v);
  }, []);

  const saveFinanceState = useCallback((v, finToUpsert) => {
    setFinance(v);
    if (finToUpsert) upsertFinance(Array.isArray(finToUpsert) ? finToUpsert : [finToUpsert]);
  }, []);

  const saveSalariesState = useCallback((v, salariesToUpsert) => {
    setSalaries(v);
    if (salariesToUpsert) upsertSalaries(Array.isArray(salariesToUpsert) ? salariesToUpsert : [salariesToUpsert]);
  }, []);

  // Client management
  const addOrUpdateClient = useCallback(
    (d) => {
      const ex = clients.find((c) => c.name.toLowerCase() === d.clientName.toLowerCase());
      if (ex) {
        const newClient = {
          ...ex,
          designation: d.clientDesignation || ex.designation,
          businessName: d.businessName || ex.businessName,
          email: d.clientEmail || ex.email,
          phone: d.clientPhone || ex.phone,
          address: d.clientAddress || ex.address,
        };
        saveClients(
          clients.map((c) => c.name.toLowerCase() === d.clientName.toLowerCase() ? newClient : c),
          newClient
        );
      } else {
        const newClient = {
          name: d.clientName,
          designation: d.clientDesignation,
          businessName: d.businessName,
          email: d.clientEmail,
          phone: d.clientPhone,
          address: d.clientAddress,
          createdAt: today(),
        };
        saveClients([...clients, newClient], newClient);
      }
    },
    [clients, saveClients]
  );

  // Invoice handlers
  const handleSaveInvoice = useCallback(
    (inv) => {
      addOrUpdateClient(inv);
      if (editInv) {
        const updated = { ...inv, invoiceNumber: editInv.invoiceNumber };
        saveInvoices(
          invoices.map((i) => i.invoiceNumber === editInv.invoiceNumber ? updated : i),
          updated
        );
        // Update linked finance record if exists
        const updatedFinList = finance.map((r) =>
          r.invoiceId === editInv.invoiceNumber
            ? { ...r, paidAmount: Number(updated.payingNow) || 0, totalAmount: Number(updated.totalPayment) || 0, status: updated.status }
            : r
        );
        const updatedFinItem = updatedFinList.find(r => r.invoiceId === editInv.invoiceNumber);
        saveFinanceState(updatedFinList, updatedFinItem);
        showToast(`Invoice #${editInv.invoiceNumber} updated`);
      } else {
        const num = nextNum;
        const saved = { ...inv, invoiceNumber: String(num), createdAt: new Date().toISOString() };
        saveInvoices([saved, ...invoices], saved);
        saveNextNum(num + 1);
        // Create finance record
        const finRow = createFinanceRecord(saved);
        saveFinanceState([finRow, ...finance], finRow);

        // Extract and save salaries
        const newSalaries = extractSalariesFromInvoice(saved);
        if (newSalaries.length > 0) {
          saveSalariesState([...newSalaries, ...salaries], newSalaries);
        }

        showToast(`Invoice #${num} created`);
      }
      setEditInv(null);
      setView(VIEWS.HISTORY);
    },
    [editInv, invoices, nextNum, finance, salaries, addOrUpdateClient, saveInvoices, saveNextNum, saveFinanceState, saveSalariesState]
  );

  const handleDeleteInvoice = useCallback(
    (num) => {
      if (!window.confirm(`Delete invoice #${num}?`)) return;
      saveInvoices(invoices.filter((i) => i.invoiceNumber !== num));
      deleteInvoice(String(num));
      showToast('Invoice deleted', 'error');
    },
    [invoices, saveInvoices]
  );

  const handleUpdateStatus = useCallback(
    (num, st) => {
      const updatedItem = { ...invoices.find(i => i.invoiceNumber === num), status: st };
      saveInvoices(invoices.map((i) => (i.invoiceNumber === num ? updatedItem : i)), updatedItem);
      showToast(`Invoice #${num} marked ${st}`);
    },
    [invoices, saveInvoices]
  );

  const handleDeleteClient = useCallback(
    (name) => {
      if (!window.confirm(`Remove "${name}"?`)) return;
      saveClients(clients.filter((c) => c.name !== name));
      deleteClient(name);
      showToast('Client removed', 'error');
    },
    [clients, saveClients]
  );

  // Stats
  const totalRevenue = invoices.reduce((s, i) => s + (Number(i.totalPayment) || 0), 0);
  const totalPaid = invoices.reduce((s, i) => s + (Number(i.payingNow) || 0), 0);
  const totalOutstanding = invoices.reduce((s, i) => s + (Number(i.remaining) || 0), 0);

  // Nav items
  const nav = [
    { id: VIEWS.DASHBOARD, label: 'Dashboard', icon: 'home' },
    { id: VIEWS.CREATE, label: 'New Invoice', icon: 'plus' },
    { id: VIEWS.HISTORY, label: 'Invoices', icon: 'file' },
    { id: VIEWS.CLIENTS, label: 'Clients', icon: 'users' },
    { id: VIEWS.FINANCE, label: 'Finance', icon: 'finance' },
    { id: VIEWS.SALARIES, label: 'Salaries', icon: 'salaries' },
    { id: VIEWS.REPORTS, label: 'Reports', icon: 'chart' },
  ];

  // Auth Check
  if (!session) {
    return <LoginView />;
  }

  // Loading
  if (loading) {
    return (
      <div className="app-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              width: 44, height: 44,
              border: '3px solid var(--border)',
              borderTopColor: 'var(--primary)',
              borderRadius: '50%',
              margin: '0 auto 14px',
            }}
            className="animate-spin"
          />
          <div style={{ color: 'var(--text-light)', fontSize: 14 }}>Loading Devmate Invoicing...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Toast */}
      {toast && (
        <div className={`toast ${toast.type === 'error' ? 'toast-error' : 'toast-success'}`}>
          {toast.msg}
        </div>
      )}

      {/* Mobile Header */}
      <div className="mobile-header no-print">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={() => setMobileNav(!mobileNav)}
            style={{ background: 'none', border: 'none', color: 'var(--text)', cursor: 'pointer', padding: 4 }}
          >
            <Icon name="menu" size={22} />
          </button>
          <img src="/logo_2.png" alt="DM" style={{ width: 28, height: 28 }} />
          <span style={{ fontWeight: 700, color: 'var(--primary)', fontSize: 14, letterSpacing: 0.5 }}>DEVMATE</span>
        </div>
      </div>

      {/* Mobile overlay */}
      {mobileNav && <div className="mobile-overlay" onClick={() => setMobileNav(false)} />}

      <div className="app-layout">
        {/* Sidebar */}
        <aside className={`sidebar no-print ${mobileNav ? 'mobile-open' : ''}`}>
          <div className="sidebar-brand">
            <img src="/logo_2.png" alt="Devmate" style={{ width: 38, height: 38 }} />
            <div>
              <div className="sidebar-brand-name">DEVMATE</div>
              <div className="sidebar-brand-sub" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                Invoice System
                <div 
                  title={dbStatus === 'connected' ? 'Cloud Connected' : 'Connection Error'}
                  style={{ 
                    width: 8, height: 8, borderRadius: '50%', 
                    background: dbStatus === 'connected' ? '#10b981' : dbStatus === 'error' ? '#ef4444' : '#f59e0b',
                    boxShadow: dbStatus === 'connected' ? '0 0 8px rgba(16,185,129,0.5)' : 'none'
                  }} 
                />
              </div>
            </div>
          </div>

          <nav className="sidebar-nav">
            {nav.map((n) => (
              <button
                key={n.id}
                onClick={() => {
                  setView(n.id);
                  setEditInv(null);
                  setMobileNav(false);
                }}
                className={`sidebar-nav-btn ${view === n.id ? 'active' : ''}`}
              >
                <Icon name={n.icon} size={16} />
                {n.label}
              </button>
            ))}
          </nav>

          <div className="sidebar-footer">
            <div className="sidebar-footer-loc">DUBAI · MUSCAT · NY</div>
            <div style={{ marginBottom: 12 }}>management@devmatesolutions.com</div>
            <button 
              onClick={() => supabase.auth.signOut()}
              style={{
                width: '100%',
                padding: '10px',
                background: 'rgba(239, 68, 68, 0.1)',
                color: '#ef4444',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => e.target.style.background = 'rgba(239, 68, 68, 0.2)'}
              onMouseOut={(e) => e.target.style.background = 'rgba(239, 68, 68, 0.1)'}
            >
              <Icon name="plus" size={14} style={{ transform: 'rotate(45deg)' }} />
              Logout
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="main-content">
          {view === VIEWS.DASHBOARD && (
            <Dashboard
              invoices={invoices}
              clients={clients}
              totalRevenue={totalRevenue}
              totalPaid={totalPaid}
              totalOutstanding={totalOutstanding}
              onNew={() => { setEditInv(null); setView(VIEWS.CREATE); }}
              onView={(inv) => { setPreviewInv(inv); setView(VIEWS.PREVIEW); }}
            />
          )}

          {view === VIEWS.CREATE && (
            <InvoiceForm
              clients={clients}
              finance={finance}
              editInv={editInv}
              onSave={handleSaveInvoice}
              onCancel={() => { setEditInv(null); setView(VIEWS.HISTORY); }}
            />
          )}

          {view === VIEWS.HISTORY && (
            <InvoiceHistory
              invoices={invoices}
              searchQ={searchQ}
              setSearchQ={setSearchQ}
              clientFilter={clientFilter}
              setClientFilter={setClientFilter}
              onPreview={(inv) => { setPreviewInv(inv); setView(VIEWS.PREVIEW); }}
              onEdit={(inv) => { setEditInv(inv); setView(VIEWS.CREATE); }}
              onDelete={handleDeleteInvoice}
              onUpdateStatus={handleUpdateStatus}
            />
          )}

          {view === VIEWS.CLIENTS && (
            <ClientsView
              clients={clients}
              invoices={invoices}
              onDelete={handleDeleteClient}
              onLedger={(name) => { setClientFilter(name); setSearchQ(''); setView(VIEWS.HISTORY); }}
              onAddClient={addOrUpdateClient}
            />
          )}

          {view === VIEWS.PREVIEW && previewInv && (
            <InvoicePreview
              inv={previewInv}
              onBack={() => setView(VIEWS.HISTORY)}
            />
          )}

          {view === VIEWS.FINANCE && (
            <FinanceView
              finance={finance}
              onUpdate={(id, patch) => {
                const updatedItem = { ...finance.find(r => r.id === id), ...patch };
                const updated = finance.map((r) => r.id === id ? updatedItem : r);
                saveFinanceState(updated, updatedItem);
              }}
              onAdd={(row) => saveFinanceState([row, ...finance], row)}
              onDelete={(id) => {
                saveFinanceState(finance.filter((r) => r.id !== id));
                deleteFinance(id);
              }}
            />
          )}

          {view === VIEWS.SALARIES && (
            <SalariesView
              salaries={salaries}
              onUpdate={(id, patch) => {
                const updatedItem = { ...salaries.find(r => r.id === id), ...patch };
                const updated = salaries.map((r) => r.id === id ? updatedItem : r);
                saveSalariesState(updated, updatedItem);
              }}
              onAdd={(row) => saveSalariesState([row, ...salaries], row)}
              onDelete={(id) => {
                saveSalariesState(salaries.filter((r) => r.id !== id));
                deleteSalary(id);
              }}
            />
          )}

          {view === VIEWS.REPORTS && (
            <ReportsView invoices={invoices} clients={clients} />
          )}
        </main>
      </div>
    </div>
  );
}
