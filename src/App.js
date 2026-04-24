import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Icon from './components/Icon';
import Dashboard from './components/Dashboard';
import InvoiceForm from './components/InvoiceForm';
import InvoiceHistory from './components/InvoiceHistory';
import InvoicePreview from './components/InvoicePreview';
import FinanceView from './components/FinanceView';
import SalariesView from './components/SalariesView';
import LoginView from './components/LoginView';
import EmployeesView from './components/EmployeesView';
import { ClientsView, ReportsView } from './components/ClientsReports';
import { today, createFinanceRecord, rolloverMonth, currentYM, extractSalariesFromInvoice } from './utils/helpers';
import { fetchAllData, upsertClient, deleteClient, upsertInvoice, deleteInvoice, upsertFinance, deleteFinance, upsertSalaries, deleteSalary, updateSetting, upsertEmployee, deleteEmployee } from './api';
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
  EMPLOYEES: 'employees',
};

export default function App() {
  const [view, setView] = useState(VIEWS.DASHBOARD);
  const [invoices, setInvoices] = useState([]);
  const [clients, setClients] = useState([]);
  const [finance, setFinance] = useState([]);
  const [salaries, setSalaries] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [nextNum, setNextNum] = useState(4001);
  const [loading, setLoading] = useState(true);
  const [previewInv, setPreviewInv] = useState(null);
  const [editInv, setEditInv] = useState(null);
  const [searchQ, setSearchQ] = useState('');
  const [clientFilter, setClientFilter] = useState('');
  const [toast, setToast] = useState(null);
  const [dbStatus, setDbStatus] = useState('connecting'); // 'connecting', 'connected', 'error'
  const [isLoggedIn, setIsLoggedIn] = useState(localStorage.getItem('dm_logged_in') === 'true');
  const [mobileNav, setMobileNav] = useState(false);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };


  // Load data from Supabase + rollover check
  useEffect(() => {
    if (!isLoggedIn) return;
    
    async function init() {
      console.log("Supabase Init: Starting fetch...");
      try {
        const db = await fetchAllData();
        console.log("Supabase Init: Data received", db);

        // Auto-activate any scheduled invoices whose time has passed
        const now = new Date();
        const activatedInvoices = db.invoices.map((inv) => {
          if (inv.status === 'scheduled' && inv.scheduledDate && new Date(inv.scheduledDate) <= now) {
            return { ...inv, status: 'pending' };
          }
          return inv;
        });
        const toActivate = activatedInvoices.filter(
          (inv, idx) => inv.status !== db.invoices[idx].status
        );
        if (toActivate.length > 0) {
          await Promise.all(toActivate.map((inv) => upsertInvoice(inv)));
          showToast(`${toActivate.length} scheduled invoice(s) activated!`);
        }
        setInvoices(activatedInvoices);
        setClients(db.clients);
        setNextNum(db.nextNum);
        setEmployees(db.employees || []);

        let currentSals = [...(db.salaries || [])];
        const thisMonth = currentYM();
        const newSalsToUpsert = [];

        (db.employees || []).forEach(emp => {
          if (emp.status !== 'active') return;
          const empMonthlySals = currentSals.filter(s => s.employeeName === emp.name && s.salaryType === 'monthly');
          
          const projects = [...new Set(empMonthlySals.map(s => s.projectName))];
          projects.forEach(proj => {
            const projSals = empMonthlySals.filter(s => s.projectName === proj);
            projSals.sort((a, b) => (b.month || '').localeCompare(a.month || ''));
            const latest = projSals[0];
            
            if (latest.month && latest.month < thisMonth) {
              const renewed = {
                ...latest,
                id: `sal-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                month: thisMonth,
                paidAmount: 0,
                status: 'unpaid',
                createdAt: new Date().toISOString()
              };
              newSalsToUpsert.push(renewed);
              currentSals.push(renewed);
            }
          });
        });

        if (newSalsToUpsert.length > 0) {
          await upsertSalaries(newSalsToUpsert);
        }
        setSalaries(currentSals);

        let fin = db.finance;
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
  }, [isLoggedIn]);

  const handleLogin = () => {
    localStorage.setItem('dm_logged_in', 'true');
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('dm_logged_in');
    setIsLoggedIn(false);
    setView(VIEWS.DASHBOARD);
  };

  // Save helpers
  const saveInvoices = useCallback((v, invToUpsert) => {
    setInvoices(v);
    if (invToUpsert) upsertInvoice(invToUpsert);
  }, []);

  const saveClients = useCallback(async (v, clientToUpsert) => {
    setClients(v);
    if (clientToUpsert) {
      try {
        await upsertClient(clientToUpsert);
        showToast('Client data synced to database');
      } catch (err) {
        showToast('Failed to sync with database!', 'error');
      }
    }
  }, [showToast]);

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

  const saveEmployees = useCallback(async (v, empToUpsert) => {
    setEmployees(v);
    if (empToUpsert) {
      try { await upsertEmployee(empToUpsert); }
      catch (err) { showToast('Failed to save employee to database!', 'error'); }
    }
  }, [showToast]);

  const handleDeleteEmployee = useCallback((id) => {
    setEmployees(prev => prev.filter(e => e.id !== id));
    deleteEmployee(id);
    showToast('Employee removed', 'error');
  }, []);

  // Client management
  const addOrUpdateClient = useCallback(
    (d) => {
      const name = d.clientName || d.name;
      if (!name) return;
      const ex = clients.find((c) => c.name.toLowerCase() === name.toLowerCase());
      if (ex) {
        const newClient = {
          ...ex,
          designation: d.clientDesignation || d.designation || ex.designation,
          businessName: d.businessName || ex.businessName,
          email: d.clientEmail || d.email || ex.email,
          phone: d.clientPhone || d.phone || ex.phone,
          address: d.clientAddress || d.address || ex.address,
          projects: d.projects || ex.projects,
        };
        saveClients(
          clients.map((c) => c.name.toLowerCase() === name.toLowerCase() ? newClient : c),
          newClient
        );
      } else {
        const newClient = {
          name: name,
          designation: d.clientDesignation || d.designation,
          businessName: d.businessName,
          email: d.clientEmail || d.email,
          phone: d.clientPhone || d.phone,
          address: d.clientAddress || d.address,
          projects: d.projects || [],
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

  // Confirm a pending invoice — sets status to paid/partial and updates finance record
  const handleConfirmPayment = useCallback(
    (num) => {
      const inv = invoices.find(i => i.invoiceNumber === num);
      if (!inv) return;
      const newStatus = Number(inv.payingNow) >= Number(inv.totalPayment)
        ? 'paid'
        : Number(inv.payingNow) > 0 ? 'partial' : 'unpaid';
      const updatedInv = { ...inv, status: newStatus };
      saveInvoices(invoices.map(i => i.invoiceNumber === num ? updatedInv : i), updatedInv);

      // Update linked finance record — inject paidAmount now that payment is confirmed
      const updatedFinList = finance.map(r => {
        if (r.invoiceId === num) {
          const paidAmount = Number(inv.payingNow) || 0;
          const totalSalaries = Number(r.totalSalaries) || 0;
          const allahShare = r._allahManual
            ? Number(r.allahShare)
            : Math.max(0, (paidAmount - totalSalaries) * 0.05);
          const profit = paidAmount - totalSalaries - allahShare - (Number(r.saving) || 0);
          return { ...r, paidAmount, allahShare, profit, status: newStatus };
        }
        return r;
      });
      const updatedFinItem = updatedFinList.find(r => r.invoiceId === num);
      saveFinanceState(updatedFinList, updatedFinItem);
      showToast(`Invoice #${num} confirmed as ${newStatus}`);
    },
    [invoices, finance, saveInvoices, saveFinanceState]
  );

  // Merge standalone salary records into finance rows so Finance Ledger reflects them
  const mergedFinance = useMemo(() => {
    return finance.map(row => {
      // find all standalone salaries linked to this invoice
      const linked = salaries.filter(s => s.invoiceId === row.invoiceId && s.invoiceId);
      if (linked.length === 0) return row;
      const linkedTotal = linked.reduce((s, sal) => s + (Number(sal.totalSalary) || 0), 0);
      // Build merged salaries array: original entries + linked standalone entries
      const origSalaries = row.salaries || [];
      const linkedEntries = linked.map(s => ({ employee: s.employeeName, amount: Number(s.totalSalary) || 0 }));
      const mergedSalaries = [...origSalaries, ...linkedEntries];
      const newTotalSalaries = (Number(row.totalSalaries) || 0) + linkedTotal;
      const newAllahShare = row._allahManual
        ? Number(row.allahShare)
        : Math.max(0, ((Number(row.paidAmount) || 0) - newTotalSalaries) * 0.05);
      const newProfit = (Number(row.paidAmount) || 0) - newTotalSalaries - newAllahShare - (Number(row.saving) || 0);
      return { ...row, salaries: mergedSalaries, totalSalaries: newTotalSalaries, allahShare: newAllahShare, profit: newProfit };
    });
  }, [finance, salaries]);

  // Stats — only count confirmed (non-pending) invoices in received/outstanding
  const globalTotal = clients.reduce((sum, c) => {
    const ci = invoices.filter((i) => i.clientName === c.name);
    const projectsTotal = (c.projects || []).reduce((s, p) => s + (Number(p.total) || 0), 0);
    const invoiced = ci.reduce((s, i) => s + (Number(i.totalPayment) || 0), 0);
    return sum + (projectsTotal > 0 ? projectsTotal : invoiced);
  }, 0);
  const globalInvoiced = invoices.reduce((s, i) => s + (Number(i.totalPayment) || 0), 0);
  const globalReceived = invoices.filter(i => i.status !== 'pending').reduce((s, i) => s + (Number(i.payingNow) || 0), 0);
  const globalPending = Math.max(0, globalTotal - globalReceived);

  // Nav items
  const navGroups = [
    {
      title: 'MAIN',
      items: [
        { id: VIEWS.DASHBOARD, label: 'Dashboard', icon: 'home' },
        { id: VIEWS.REPORTS, label: 'Reports', icon: 'chart' },
      ]
    },
    {
      title: 'INVOICES',
      items: [
        { id: VIEWS.CREATE, label: 'New Invoice', icon: 'plus' },
        { id: VIEWS.HISTORY, label: 'Invoices', icon: 'file' },
      ]
    },
    {
      title: 'CLIENTS',
      items: [
        { id: VIEWS.CLIENTS, label: 'Clients', icon: 'users' },
        { id: VIEWS.FINANCE, label: 'Finance', icon: 'finance' },
      ]
    },
    {
      title: 'EMPLOYEES',
      items: [
        { id: VIEWS.EMPLOYEES, label: 'Employees', icon: 'users' },
        { id: VIEWS.SALARIES, label: 'Salaries', icon: 'salaries' },
      ]
    }
  ];

  // Auth Check
  if (!isLoggedIn) {
    return <LoginView onLogin={handleLogin} />;
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
            {navGroups.map((group) => (
              <div key={group.title} style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: 1.5, padding: '0 16px', marginBottom: 8 }}>
                  {group.title}
                </div>
                {group.items.map((n) => (
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
              </div>
            ))}
          </nav>

          <div className="sidebar-footer">
            <div className="sidebar-footer-loc">DUBAI · MUSCAT · NY</div>
            <div style={{ marginBottom: 12 }}>management@devmatesolutions.com</div>
            <button 
              onClick={handleLogout}
              style={{
                width: '100%',
                padding: '10px',
                background: 'rgba(239, 68, 68, 0.08)',
                color: '#ef4444',
                border: '1px solid rgba(239, 68, 68, 0.15)',
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
              globalTotal={globalTotal}
              globalInvoiced={globalInvoiced}
              globalReceived={globalReceived}
              globalPending={globalPending}
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
              salaries={salaries}
              searchQ={searchQ}
              setSearchQ={setSearchQ}
              clientFilter={clientFilter}
              setClientFilter={setClientFilter}
              onPreview={(inv) => { setPreviewInv(inv); setView(VIEWS.PREVIEW); }}
              onEdit={(inv) => { setEditInv(inv); setView(VIEWS.CREATE); }}
              onDelete={handleDeleteInvoice}
              onUpdateStatus={handleUpdateStatus}
              onConfirmPayment={handleConfirmPayment}
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
              salaries={salaries}
              onBack={() => setView(VIEWS.HISTORY)}
            />
          )}

          {view === VIEWS.FINANCE && (
            <FinanceView
              finance={mergedFinance}
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
              invoices={invoices}
              clients={clients}
              employees={employees}
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

          {view === VIEWS.EMPLOYEES && (
            <EmployeesView
              employees={employees}
              salaries={salaries}
              invoices={invoices}
              clients={clients}
              onAdd={(emp) => saveEmployees([emp, ...employees], emp)}
              onUpdate={(id, emp) => saveEmployees(employees.map(e => e.id === id ? emp : e), emp)}
              onDelete={handleDeleteEmployee}
              onAddSalary={(row) => saveSalariesState([row, ...salaries], row)}
              onUpdateSalary={(id, patch) => {
                const updatedItem = { ...salaries.find(r => r.id === id), ...patch };
                const updated = salaries.map((r) => r.id === id ? updatedItem : r);
                saveSalariesState(updated, updatedItem);
              }}
              onDeleteSalary={(id) => {
                saveSalariesState(salaries.filter((r) => r.id !== id));
                deleteSalary(id);
              }}
            />
          )}

          {view === VIEWS.REPORTS && (
            <ReportsView invoices={invoices} clients={clients} salaries={salaries} />
          )}
        </main>
      </div>
    </div>
  );
}
