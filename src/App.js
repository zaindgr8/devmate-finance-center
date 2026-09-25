import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Icon from './components/Icon';
import Dashboard from './components/Dashboard';
import InvoiceForm from './components/InvoiceForm';
import InvoiceHistory from './components/InvoiceHistory';
import InvoicePreview from './components/InvoicePreview';
// import FinanceView from './components/FinanceView';
import SalariesView from './components/SalariesView';
import LoginView from './components/LoginView';
import EmployeesView from './components/EmployeesView';
import BillsView from './components/BillsView';
import ExpensesView from './components/ExpensesView';
import { ReportsView } from './components/ClientsReports';
import ClientsView from './components/ClientsView';
// import PersonalView from './components/PersonalView';
import UrgentSalariesPanel from './components/UrgentSalariesPanel';
import { today, createFinanceRecord, rolloverMonth, rolloverSalariesMonth, currentYM, extractSalariesFromInvoice, getNextMonthDate, nextYM, hasMonthlyInstallment, isInvoiceOverdue, localDateStr } from './utils/helpers';
import { fetchAllData, upsertClient, deleteClient, upsertInvoice, deleteInvoice, upsertFinance, deleteFinance, upsertSalaries, deleteSalary, updateSetting, upsertEmployee, deleteEmployee, saveMiscBills, saveExpenses, savePersonalPayments, saveBillPayments, getSession, onAuthChange, signOut } from './api';
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
  BILLS: 'bills',
  EXPENSES: 'expenses',
  PERSONAL: 'personal',
};

const addDaysStr = (dateStr, days) => {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + days);
  return localDateStr(d);
};

const VIEW_TITLES = {
  dashboard: 'Dashboard', create: 'New Invoice', history: 'Invoices', clients: 'Clients',
  preview: 'Invoice', reports: 'Reports', finance: 'Finance', salaries: 'Salaries',
  employees: 'Employees', bills: 'Payments', expenses: 'Expenses', personal: 'Personal',
};

export default function App() {
  const [view, setView] = useState(VIEWS.DASHBOARD);
  const [invoices, setInvoices] = useState([]);
  const [clients, setClients] = useState([]);
  const [finance, setFinance] = useState([]);
  const [salaries, setSalaries] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [bills, setBills] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [billSections, setBillSections] = useState([]);
  const [billPayments, setBillPayments] = useState({}); // { "YYYY-MM": { "bill-id": paidAmount } }
  // eslint-disable-next-line no-unused-vars
  const [personal, setPersonal] = useState({ allahPaid: 0, savedAmount: 0 });
  const [nextNum, setNextNum] = useState(4001);
  const [loading, setLoading] = useState(true);
  const [previewInv, setPreviewInv] = useState(null);
  const [editInv, setEditInv] = useState(null);
  const [draftInv, setDraftInv] = useState(null); // prefill for "Duplicate invoice"

  const [searchQ, setSearchQ] = useState('');
  const [clientFilter, setClientFilter] = useState('');
  const [toast, setToast] = useState(null);
  const [dbStatus, setDbStatus] = useState('connecting'); // 'connecting', 'connected', 'error'
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const isLoggedIn = !!session;
  const [mobileNav, setMobileNav] = useState(false);
  const [urgentSalaryIds, setUrgentSalaryIds] = useState([]);
  const [showUrgentPanel, setShowUrgentPanel] = useState(() => {
    return localStorage.getItem('dm_show_urgent_panel') !== 'false';
  });

  const toastTimer = useRef(null);
  const showToast = useCallback((msg, type = 'success') => {
    clearTimeout(toastTimer.current);
    setToast({ msg, type, key: Date.now() });
    toastTimer.current = setTimeout(() => setToast(null), type === 'error' ? 5000 : 3000);
  }, []);

  // Fire-and-forget DB writes, but never silently: failures show a toast
  const persist = useCallback((promise, label = 'Save') => {
    Promise.resolve(promise).catch((err) => {
      console.error(`${label} failed:`, err);
      setDbStatus('error');
      showToast(`${label} failed. Changes may not be saved: ${err?.message || 'network error'}`, 'error');
    });
  }, [showToast]);

  // Side effects stay out of the state updater (StrictMode runs updaters twice)
  const urgentRef = useRef(urgentSalaryIds);
  urgentRef.current = urgentSalaryIds;
  const saveUrgentIds = useCallback((updater) => {
    const prev = urgentRef.current;
    const next = updater(prev);
    if (next === prev) return;
    urgentRef.current = next;
    setUrgentSalaryIds(next);
    persist(updateSetting('urgent_salary_ids', JSON.stringify(next)), 'Updating urgent list');
  }, [persist]);

  // Supabase Auth session
  useEffect(() => {
    let alive = true;
    getSession().then((s) => { if (alive) { setSession(s); setAuthReady(true); } });
    const unsub = onAuthChange((s) => { setSession(s); if (!s) setLoading(true); });
    return () => { alive = false; unsub(); };
  }, []);

  useEffect(() => {
    document.title = `${VIEW_TITLES[view] || 'Portal'} · Devmate Finance`;
  }, [view]);


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
          persist(Promise.all(toActivate.map((inv) => upsertInvoice(inv))), 'Activating scheduled invoices');
          showToast(`${toActivate.length} scheduled invoice(s) activated!`);
        }
        setInvoices(activatedInvoices);
        setClients(db.clients);
        setNextNum(db.nextNum);
        setEmployees(db.employees || []);
        setBills(db.bills || []);
        setExpenses(db.expenses || []);
        setBillSections(db.billSections || []);

        // Load month-wise payments. Migrate legacy paidAmount from bill templates into current month.
        let loadedPayments = db.billPayments || {};
        const thisMonthKey = currentYM();
        const legacyBills = (db.bills || []).filter(b => b.type === 'monthly' && Number(b.paidAmount) > 0);
        if (legacyBills.length > 0 && !loadedPayments[thisMonthKey]) {
          const migrated = { ...loadedPayments };
          migrated[thisMonthKey] = migrated[thisMonthKey] || {};
          legacyBills.forEach(b => {
            if (!migrated[thisMonthKey][b.id]) {
              migrated[thisMonthKey][b.id] = Number(b.paidAmount);
            }
          });
          loadedPayments = migrated;
          // Strip paidAmount from templates so they're clean
          const cleanBills = (db.bills || []).map(b => { const { paidAmount, ...rest } = b; return rest; });
          setBills(cleanBills);
          persist(Promise.all([saveMiscBills(cleanBills), saveBillPayments(loadedPayments)]), 'Migrating bill payments');
        }
        setBillPayments(loadedPayments);
        setUrgentSalaryIds(db.urgentSalaryIds || []);
        if (db.personal) setPersonal(db.personal);

        let currentSals = [...(db.salaries || [])];
        let fin = db.finance || [];
        const thisMonth = currentYM();

        if (db.lastRollover !== thisMonth) {
          // Only mark the month as rolled over once the writes succeed, so a
          // failed rollover is retried next load instead of being skipped forever.
          try {
            if (fin.length > 0 && fin.some((r) => r.month !== thisMonth)) {
              fin = rolloverMonth(fin, thisMonth);
              await upsertFinance(fin);
            }
            if (currentSals.length > 0 && currentSals.some((r) => r.month !== thisMonth)) {
              currentSals = rolloverSalariesMonth(currentSals, thisMonth);
              await upsertSalaries(currentSals);
            }
            await updateSetting('last_rollover', thisMonth);
          } catch (err) {
            console.error('Month rollover failed:', err);
            fin = db.finance || [];
            currentSals = [...(db.salaries || [])];
            showToast('Monthly rollover failed. It will retry next time you open the portal.', 'error');
          }
        }

        setSalaries(currentSals);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn]);

  // Keep a ref to invoices to access the latest state in the periodic checker
  const invoicesRef = useRef(invoices);
  useEffect(() => {
    invoicesRef.current = invoices;
  }, [invoices]);

  // Periodic check to auto-activate scheduled invoices whose time has passed
  useEffect(() => {
    if (!isLoggedIn) return;

    const checkScheduled = async () => {
      const currentInvoices = invoicesRef.current;
      if (!currentInvoices || currentInvoices.length === 0) return;

      const now = new Date();
      const toActivate = currentInvoices.filter(
        (inv) =>
          inv.status === 'scheduled' &&
          inv.scheduledDate &&
          new Date(inv.scheduledDate) <= now
      );

      if (toActivate.length > 0) {
        try {
          console.log(`Auto-activating ${toActivate.length} scheduled invoice(s)...`);
          const updatedList = currentInvoices.map((inv) => {
            const match = toActivate.find((a) => a.invoiceNumber === inv.invoiceNumber);
            return match ? { ...inv, status: 'pending' } : inv;
          });
          // Update state
          setInvoices(updatedList);
          // Sync to Supabase database
          await Promise.all(
            toActivate.map((inv) => upsertInvoice({ ...inv, status: 'pending' }))
          );
          showToast(`${toActivate.length} scheduled invoice(s) activated!`);
        } catch (err) {
          console.error("Failed to auto-activate scheduled invoices:", err);
        }
      }
    };

    // Run immediately when component mounts/isLoggedIn changes
    checkScheduled();

    // Check every 10 seconds
    const intervalId = setInterval(checkScheduled, 10000);

    return () => clearInterval(intervalId);
  }, [isLoggedIn, showToast]);

  const handleLogout = async () => {
    await signOut();
    setView(VIEWS.DASHBOARD);
  };

  // Save helpers
  const saveInvoices = useCallback((v, invToUpsert) => {
    setInvoices(v);
    if (invToUpsert) persist(upsertInvoice(invToUpsert), 'Saving invoice');
  }, [persist]);

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
    persist(updateSetting('next_invoice_num', v), 'Saving invoice counter');
  }, [persist]);

  const saveFinanceState = useCallback((v, finToUpsert) => {
    setFinance(v);
    if (finToUpsert) persist(upsertFinance(Array.isArray(finToUpsert) ? finToUpsert : [finToUpsert]), 'Saving finance');
  }, [persist]);

  const saveSalariesState = useCallback((v, salariesToUpsert) => {
    setSalaries(v);
    if (salariesToUpsert) {
      persist(upsertSalaries(Array.isArray(salariesToUpsert) ? salariesToUpsert : [salariesToUpsert]), 'Saving salaries');
    }
  }, [persist]);

  // When a monthly salary is fully paid, queue next month's installment — unless
  // one already exists (e.g. arrears + current month both paid, or month rollover ran).
  const withAutoPush = useCallback((list, item) => {
    if (!item || item.salaryType !== 'monthly' || item.status !== 'paid' || item.autoPushed) {
      return { list, upserts: [item] };
    }
    const pushed = { ...item, autoPushed: true };
    let next = list.map(r => (r.id === item.id ? pushed : r));
    const nextMonth = nextYM(item.month);
    if (hasMonthlyInstallment(next, item, nextMonth)) return { list: next, upserts: [pushed] };
    const nextRow = {
      ...item,
      id: `sal-auto-monthly-${item.id}-${Date.now()}`,
      month: nextMonth,
      paidAmount: 0,
      status: 'unpaid',
      rolledOver: true,
      autoPushed: false,
      originalMonth: item.originalMonth || item.month,
      createdAt: new Date().toISOString(),
    };
    return { list: [nextRow, ...next], upserts: [pushed, nextRow] };
  }, []);

  // Single entry point for salary edits: accepts (id, patch) or ([{id, patch}, ...])
  const handleUpdateSalary = useCallback((idOrList, patch) => {
    const patches = Array.isArray(idOrList) ? idOrList : [{ id: idOrList, patch }];
    let list = [...salaries];
    const upsertMap = new Map();
    patches.forEach(({ id, patch: p }) => {
      const current = list.find(r => r.id === id);
      if (!current) return;
      const updated = { ...current, ...p };
      list = list.map(r => (r.id === id ? updated : r));
      const res = withAutoPush(list, updated);
      list = res.list;
      res.upserts.forEach(u => upsertMap.set(u.id, u));
    });
    if (upsertMap.size) saveSalariesState(list, [...upsertMap.values()]);
  }, [salaries, withAutoPush, saveSalariesState]);

  const handleAddSalary = useCallback((row) => {
    const { list, upserts } = withAutoPush([row, ...salaries], row);
    saveSalariesState(list, upserts);
  }, [salaries, withAutoPush, saveSalariesState]);

  const handleDeleteSalary = useCallback((id) => {
    saveSalariesState(salaries.filter((r) => r.id !== id));
    persist(deleteSalary(id), 'Deleting salary');
    saveUrgentIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : prev));
  }, [salaries, saveSalariesState, saveUrgentIds, persist]);

  const saveEmployees = useCallback(async (v, empToUpsert) => {
    setEmployees(v);
    if (empToUpsert) {
      try { await upsertEmployee(empToUpsert); }
      catch (err) { showToast('Failed to save employee to database!', 'error'); }
    }
  }, [showToast]);

  const saveExpensesState = useCallback((v) => {
    setExpenses(v);
    persist(saveExpenses(v), 'Saving expenses');
  }, [persist]);

  const saveBills = useCallback(async (v) => {
    setBills(v);
    try { await saveMiscBills(v); }
    catch (err) { showToast('Failed to save bills!', 'error'); }
  }, [showToast]);

  const saveBillSectionsState = useCallback(async (v) => {
    setBillSections(v);
    persist(updateSetting('misc_bill_sections', JSON.stringify(v)), 'Saving bill sections');
  }, [persist]);

  const saveBillPaymentsState = useCallback(async (v) => {
    setBillPayments(v);
    try { await saveBillPayments(v); }
    catch (err) { showToast('Failed to save bill payments!', 'error'); }
  }, [showToast]);

  // eslint-disable-next-line no-unused-vars
  const savePersonalState = useCallback(async (v) => {
    setPersonal(v);
    try { await savePersonalPayments(v); }
    catch (err) { showToast('Failed to save personal payments!', 'error'); }
  }, [showToast]);

  const handleDeleteBill = useCallback((id) => {
    const updated = bills.filter(b => b.id !== id);
    setBills(updated);
    persist(saveMiscBills(updated), 'Deleting bill');
    showToast('Bill removed', 'error');
  }, [bills, persist, showToast]);

  const handleDeleteEmployee = useCallback((id) => {
    setEmployees(prev => prev.filter(e => e.id !== id));
    persist(deleteEmployee(id), 'Deleting employee');
    showToast('Employee removed', 'error');
  }, [persist, showToast]);

  // Renaming an employee keeps their salary records linked (salaries match by name)
  const handleUpdateEmployee = useCallback((id, emp) => {
    const prev = employees.find(e => e.id === id);
    saveEmployees(employees.map(e => (e.id === id ? emp : e)), emp);
    const oldName = (prev?.name || '').trim();
    const newName = (emp.name || '').trim();
    if (oldName && newName && oldName !== newName) {
      const renamed = salaries
        .filter(s => (s.employeeName || '').trim().toLowerCase() === oldName.toLowerCase())
        .map(s => ({ ...s, employeeName: newName }));
      if (renamed.length) {
        saveSalariesState(salaries.map(s => renamed.find(r => r.id === s.id) || s), renamed);
        showToast(`Renamed across ${renamed.length} salary record(s)`);
      }
    }
  }, [employees, salaries, saveEmployees, saveSalariesState, showToast]);


  const handleToggleUrgent = useCallback((id) => {
    saveUrgentIds(prev => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, [saveUrgentIds]);

  const handleAddUrgent = useCallback((id) => {
    saveUrgentIds(prev => (prev.includes(id) ? prev : [...prev, id]));
  }, [saveUrgentIds]);

  const handleRemoveUrgent = useCallback((id) => {
    saveUrgentIds(prev => (prev.includes(id) ? prev.filter((x) => x !== id) : prev));
  }, [saveUrgentIds]);

  const toggleUrgentPanel = useCallback(() => {
    setShowUrgentPanel((prev) => {
      const next = !prev;
      localStorage.setItem('dm_show_urgent_panel', String(next));
      return next;
    });
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
          paymentLink: d.paymentLink || ex.paymentLink,
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
          paymentLink: d.paymentLink || '',
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
    [editInv, invoices, nextNum, finance, salaries, addOrUpdateClient, saveInvoices, saveNextNum, saveFinanceState, saveSalariesState, showToast]
  );

  const handleDeleteInvoice = useCallback(
    (num) => {
      // Salaries auto-created from this invoice that were never paid go with it; paid history is kept
      const orphanSalaries = salaries.filter(s => s.invoiceId === num && !(Number(s.paidAmount) > 0) && s.status !== 'paid' && s.status !== 'pushed');
      const extra = orphanSalaries.length ? `\n\nThis also removes ${orphanSalaries.length} unpaid salary record(s) linked to it.` : '';
      if (!window.confirm(`Delete invoice #${num}?${extra}`)) return;
      saveInvoices(invoices.filter((i) => i.invoiceNumber !== num));
      persist(deleteInvoice(String(num)), 'Deleting invoice');
      const finRows = finance.filter(r => r.invoiceId === num);
      if (finRows.length) {
        saveFinanceState(finance.filter(r => r.invoiceId !== num));
        finRows.forEach(r => persist(deleteFinance(r.id), 'Deleting finance row'));
      }
      if (orphanSalaries.length) {
        const ids = new Set(orphanSalaries.map(s => s.id));
        saveSalariesState(salaries.filter(s => !ids.has(s.id)));
        orphanSalaries.forEach(s => persist(deleteSalary(s.id), 'Deleting salary'));
        saveUrgentIds(prev => (prev.some(id => ids.has(id)) ? prev.filter(id => !ids.has(id)) : prev));
      }
      showToast('Invoice deleted', 'error');
    },
    [invoices, finance, salaries, saveInvoices, saveFinanceState, saveSalariesState, saveUrgentIds, persist, showToast]
  );

  const checkAndCloneRecurring = useCallback(
    async (invoice, updatedInvoicesList, currentFinance, currentSalaries, nextInvoiceNum) => {
      const paymentType = invoice.financeData?.paymentType || invoice.financeRaw?.paymentType;
      const clonedToNextMonth = invoice.financeData?.clonedToNextMonth || invoice.financeRaw?.clonedToNextMonth;
      if (paymentType === 'recurring' && !clonedToNextMonth) {
        const nextDate = getNextMonthDate(invoice.date);
        const nextDueDate = invoice.dueDate ? getNextMonthDate(invoice.dueDate) : '';

        // Mark current invoice as cloned
        const updatedOriginal = {
          ...invoice,
          financeData: {
            ...(invoice.financeData || {}),
            clonedToNextMonth: true
          },
          financeRaw: {
            ...(invoice.financeRaw || {}),
            clonedToNextMonth: true
          }
        };

        // Clone invoice to next month (without the original's payment/schedule stamps)
        const stripStamps = ({ paid_at, scheduled_date, ...rest } = {}) => ({ ...rest, clonedToNextMonth: false });
        const { paidAt: _paidAt, scheduledDate: _scheduledDate, ...invoiceBase } = invoice;
        const clonedInvoice = {
          ...invoiceBase,
          invoiceNumber: String(nextInvoiceNum),
          status: 'pending',
          payingNow: Number(invoice.totalPayment) || 0,
          remaining: invoice.totalPayment,
          date: nextDate,
          dueDate: nextDueDate,
          createdAt: new Date().toISOString(),
          financeData: stripStamps(invoice.financeData),
          financeRaw: stripStamps(invoice.financeRaw),
        };

        const finRow = createFinanceRecord(clonedInvoice);
        const newSalaries = extractSalariesFromInvoice(clonedInvoice);

        // Update setting & sync DB
        await upsertInvoice(clonedInvoice);
        await upsertInvoice(updatedOriginal);
        saveNextNum(nextInvoiceNum + 1);

        const newList = [
          clonedInvoice,
          ...updatedInvoicesList.map(i => i.invoiceNumber === invoice.invoiceNumber ? updatedOriginal : i)
        ];

        saveInvoices(newList);
        saveFinanceState([finRow, ...currentFinance], finRow);
        if (newSalaries.length > 0) {
          saveSalariesState([...newSalaries, ...currentSalaries], newSalaries);
        }

        showToast(`Invoice #${invoice.invoiceNumber} paid! Cloned to next month as #${nextInvoiceNum}`);
        return true;
      }
      return false;
    },
    [saveInvoices, saveFinanceState, saveSalariesState, saveNextNum, showToast]
  );

  const handleUpdateStatus = useCallback(
    async (num, st) => {
      const inv = invoices.find(i => i.invoiceNumber === num);
      if (!inv) return;
      // Stamp paidAt when marking as paid
      const paidAt = st === 'paid' ? new Date().toISOString() : inv.paidAt;
      // "Mark paid" settles the full amount; otherwise keep what was recorded
      const total = Number(inv.totalPayment) || 0;
      const effectivePaid = st === 'paid' ? total : (Number(inv.payingNow) > 0 ? Number(inv.payingNow) : total);
      const updatedItem = {
        ...inv,
        status: st,
        payingNow: effectivePaid,
        remaining: Math.max(0, total - effectivePaid),
        ...(paidAt ? { paidAt } : {}),
      };
      const updatedList = invoices.map((i) => (i.invoiceNumber === num ? updatedItem : i));

      // Compute updated finance list (update paidAmount when marking paid/partial)
      let updatedFinList = finance;
      let updatedFinItem = null;
      if (st === 'paid' || st === 'partial') {
        updatedFinList = finance.map(r => {
          if (r.invoiceId === num) {
            const totalSalaries = Number(r.totalSalaries) || 0;
            const allahShare = r._allahManual
              ? Number(r.allahShare)
              : Math.max(0, (effectivePaid - totalSalaries) * 0.05);
            const profit = effectivePaid - totalSalaries - allahShare - (Number(r.saving) || 0);
            return { ...r, paidAmount: effectivePaid, allahShare, profit, status: st };
          }
          return r;
        });
        updatedFinItem = updatedFinList.find(r => r.invoiceId === num);
      }

      // Handle recurring clone BEFORE any state updates
      if (st === 'paid') {
        try {
          const cloned = await checkAndCloneRecurring(updatedItem, updatedList, updatedFinList, salaries, nextNum);
          if (cloned) return; // checkAndCloneRecurring handles its own saves
        } catch (err) {
          console.error('Error cloning recurring invoice:', err);
        }
      }

      // Save invoice + finance state together
      saveInvoices(updatedList, updatedItem);
      if (updatedFinItem) saveFinanceState(updatedFinList, updatedFinItem);
      showToast(`Invoice #${num} marked ${st}`);
    },
    [invoices, finance, salaries, nextNum, checkAndCloneRecurring, saveInvoices, saveFinanceState, showToast]
  );

  const handleDeleteClient = useCallback(
    (name) => {
      const count = invoices.filter(i => i.clientName === name).length;
      if (!window.confirm(`Remove "${name}"?${count ? `\n\nTheir ${count} invoice(s) are kept.` : ''}`)) return;
      saveClients(clients.filter((c) => c.name !== name));
      persist(deleteClient(name), 'Deleting client');
      showToast('Client removed', 'error');
    },
    [clients, invoices, saveClients, persist, showToast]
  );

  const handleDuplicateInvoice = useCallback((inv) => {
    const { invoiceNumber, createdAt, paidAt, scheduledDate, id, financeRaw, ...rest } = inv;
    const { paid_at, scheduled_date, clonedToNextMonth, ...fin } = inv.financeData || financeRaw || {};
    setEditInv(null);
    setDraftInv({ ...rest, date: today(), dueDate: '', status: 'pending', payingNow: Number(inv.totalPayment) || 0, financeData: fin });
    setView(VIEWS.CREATE);
    showToast(`Duplicating #${invoiceNumber}. Review and save`);
  }, [showToast]);

  // Confirm a pending invoice — sets status to paid/partial and updates finance record
  const handleConfirmPayment = useCallback(
    async (num) => {
      const inv = invoices.find(i => i.invoiceNumber === num);
      if (!inv) return;
      // Use payingNow if set, otherwise fall back to totalPayment
      const effectivePaid = Number(inv.payingNow) > 0 ? Number(inv.payingNow) : Number(inv.totalPayment) || 0;
      const newStatus = effectivePaid >= Number(inv.totalPayment)
        ? 'paid'
        : effectivePaid > 0 ? 'partial' : 'unpaid';
      // Stamp paidAt with the exact moment Confirm is clicked
      const paidAt = new Date().toISOString();
      const updatedInv = { ...inv, status: newStatus, payingNow: effectivePaid, remaining: Math.max(0, (Number(inv.totalPayment) || 0) - effectivePaid), paidAt };
      const updatedList = invoices.map(i => i.invoiceNumber === num ? updatedInv : i);

      // Compute updated finance list (pure calculation — no state update yet)
      const updatedFinList = finance.map(r => {
        if (r.invoiceId === num) {
          const totalSalaries = Number(r.totalSalaries) || 0;
          const allahShare = r._allahManual
            ? Number(r.allahShare)
            : Math.max(0, (effectivePaid - totalSalaries) * 0.05);
          const profit = effectivePaid - totalSalaries - allahShare - (Number(r.saving) || 0);
          return { ...r, paidAmount: effectivePaid, allahShare, profit, status: newStatus };
        }
        return r;
      });
      const updatedFinItem = updatedFinList.find(r => r.invoiceId === num);

      // Handle recurring clone BEFORE any state updates
      if (newStatus === 'paid') {
        try {
          const cloned = await checkAndCloneRecurring(updatedInv, updatedList, updatedFinList, salaries, nextNum);
          if (cloned) return; // checkAndCloneRecurring handles its own saves
        } catch (err) {
          console.error('Error cloning recurring invoice:', err);
          showToast('Payment confirmed but recurring clone failed. Check console.', 'error');
        }
      }

      // Save invoice + finance together after all async work is done
      saveInvoices(updatedList, updatedInv);
      if (updatedFinItem) saveFinanceState(updatedFinList, updatedFinItem);
      showToast(`Invoice #${num} confirmed as ${newStatus}`);
    },
    [invoices, finance, salaries, nextNum, checkAndCloneRecurring, saveInvoices, saveFinanceState, showToast]
  );

  // Merge standalone salary records into finance rows so Finance Ledger reflects them
  // eslint-disable-next-line no-unused-vars
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

  // Nav badges
  const todayStr = today();
  const overdueCount = invoices.filter(i => isInvoiceOverdue(i, todayStr)).length;
  const thisYM = currentYM();
  // Overdue or due within 7 days
  const expenseAlertCount = expenses.filter(e => e.status !== 'paid' && e.dueDate && e.dueDate <= addDaysStr(todayStr, 7)).length;
  const unpaidSalaryCount = salaries.filter(s => s.month <= thisYM && s.status !== 'paid' && s.status !== 'pushed').length;

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
        { id: VIEWS.HISTORY, label: 'Invoices', icon: 'file', badge: overdueCount, badgeTitle: 'Overdue invoices' },
      ]
    },
    {
      title: 'CLIENTS',
      items: [
        { id: VIEWS.CLIENTS, label: 'Clients', icon: 'users' },
        // { id: VIEWS.FINANCE, label: 'Finance', icon: 'finance' }, // COMMENTED OUT
      ]
    },
    {
      title: 'EMPLOYEES',
      items: [
        { id: VIEWS.EMPLOYEES, label: 'Employees', icon: 'users' },
        { id: VIEWS.SALARIES, label: 'Salaries', icon: 'salaries', badge: unpaidSalaryCount, badgeTitle: 'Unpaid salaries up to this month', soft: true },
      ]
    },
    {
      title: 'MISC PAYMENTS',
      items: [
        { id: VIEWS.BILLS, label: 'Payments', icon: 'receipt' },
        { id: VIEWS.EXPENSES, label: 'Expenses', icon: 'briefcase', badge: expenseAlertCount, badgeTitle: 'Expenses overdue or due within 7 days' },
        // { id: VIEWS.PERSONAL, label: 'Personal', icon: 'user' }, // COMMENTED OUT
      ]
    }
  ];

  // Auth Check
  if (!authReady) return <div className="app-container" />;
  if (!isLoggedIn) {
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
          <div style={{ color: 'var(--text-light)', fontSize: 14 }}>Loading your ledger…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Toast */}
      {toast && (
        <div key={toast.key} role="status" className={`toast ${toast.type === 'error' ? 'toast-error' : 'toast-success'}`} onClick={() => setToast(null)}>
          <Icon name={toast.type === 'error' ? 'alert' : 'check'} size={16} />
          <span>{toast.msg}</span>
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
                Finance Center
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
                      setDraftInv(null);
                      setMobileNav(false);
                    }}
                    className={`sidebar-nav-btn ${view === n.id ? 'active' : ''}`}
                  >
                    <Icon name={n.icon} size={16} />
                    <span style={{ flex: 1, textAlign: 'left' }}>{n.label}</span>
                    {n.badge > 0 && (
                      <span className={`nav-badge ${n.soft ? 'nav-badge-soft' : ''}`} title={n.badgeTitle}>{n.badge}</span>
                    )}
                  </button>
                ))}
              </div>
            ))}
          </nav>

          <div className="sidebar-footer">
            <div className="sidebar-user">
              <div className="sidebar-user-avatar">{(session?.user?.email || '?')[0].toUpperCase()}</div>
              <div style={{ minWidth: 0, flex: 1, textAlign: 'left' }}>
                <div className="sidebar-user-email" title={session?.user?.email}>{session?.user?.email}</div>
                <div className="sidebar-footer-loc">DUBAI · MUSCAT · NY</div>
              </div>
              <button onClick={handleLogout} className="sidebar-logout" title="Sign out" aria-label="Sign out">
                <Icon name="logout" size={16} />
              </button>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="main-content">
          {view === VIEWS.DASHBOARD && (
            <Dashboard
              invoices={invoices}
              clients={clients}
              salaries={salaries}
              bills={bills}
              billPayments={billPayments}
              expenses={expenses}
              urgentSalaryIds={urgentSalaryIds}
              onNew={() => { setEditInv(null); setDraftInv(null); setView(VIEWS.CREATE); }}
              onView={(inv) => { setPreviewInv(inv); setView(VIEWS.PREVIEW); }}
              onNavigate={setView}
              onConfirmPayment={handleConfirmPayment}
            />
          )}

          {view === VIEWS.CREATE && (
            <InvoiceForm
              key={editInv?.invoiceNumber || (draftInv ? `draft-${draftInv.clientName}` : 'new')}
              clients={clients}
              finance={finance}
              employees={employees}
              editInv={editInv}
              draftInv={draftInv}
              onSave={(inv) => { handleSaveInvoice(inv); setDraftInv(null); }}
              onCancel={() => { setEditInv(null); setDraftInv(null); setView(VIEWS.HISTORY); }}
            />
          )}

          {view === VIEWS.HISTORY && (
            <InvoiceHistory
              invoices={invoices}
              clients={clients}
              salaries={salaries}
              searchQ={searchQ}
              setSearchQ={setSearchQ}
              clientFilter={clientFilter}
              setClientFilter={setClientFilter}
              onNew={() => { setEditInv(null); setDraftInv(null); setView(VIEWS.CREATE); }}
              onPreview={(inv) => { setPreviewInv(inv); setView(VIEWS.PREVIEW); }}
              onEdit={(inv) => { setEditInv(inv); setDraftInv(null); setView(VIEWS.CREATE); }}
              onDuplicate={handleDuplicateInvoice}
              onNotify={showToast}
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
              onPreview={(inv) => { setPreviewInv(inv); setView(VIEWS.PREVIEW); }}
              onNewInvoice={(c) => {
                setEditInv(null);
                setDraftInv({
                  clientName: c.name, clientDesignation: c.designation || '', businessName: c.businessName || '',
                  clientEmail: c.email || '', clientPhone: c.phone || '', clientAddress: c.address || '', paymentLink: c.paymentLink || '',
                });
                setView(VIEWS.CREATE);
              }}
            />
          )}

          {view === VIEWS.PREVIEW && previewInv && (
            <InvoicePreview
              inv={invoices.find(i => i.invoiceNumber === previewInv.invoiceNumber) || previewInv}
              salaries={salaries}
              onBack={() => setView(VIEWS.HISTORY)}
              onEdit={(inv) => { setEditInv(inv); setDraftInv(null); setView(VIEWS.CREATE); }}
              onNotify={showToast}
            />
          )}

          {/* Finance section commented out
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
          */}

          {view === VIEWS.SALARIES && (
            <SalariesView
              salaries={salaries}
              invoices={invoices}
              clients={clients}
              employees={employees}
              onUpdate={handleUpdateSalary}
              onAdd={handleAddSalary}
              onDelete={handleDeleteSalary}
              onPushToNextMonth={(updatedRow, newRow) => {
                const updatedList = salaries.map((r) => r.id === updatedRow.id ? updatedRow : r);
                if (newRow) updatedList.unshift(newRow);
                saveSalariesState(updatedList, newRow ? [updatedRow, newRow] : [updatedRow]);
              }}
              urgentSalaryIds={urgentSalaryIds}
              onToggleUrgent={handleToggleUrgent}
            />
          )}

          {view === VIEWS.EMPLOYEES && (
            <EmployeesView
              employees={employees}
              salaries={salaries}
              invoices={invoices}
              clients={clients}
              onAdd={(emp) => saveEmployees([emp, ...employees], emp)}
              onUpdate={handleUpdateEmployee}
              onDelete={handleDeleteEmployee}
              onAddSalary={handleAddSalary}
              onUpdateSalary={handleUpdateSalary}
              onDeleteSalary={handleDeleteSalary}
            />
          )}

          {view === VIEWS.REPORTS && (
            <ReportsView invoices={invoices} clients={clients} salaries={salaries} bills={bills} billPayments={billPayments} expenses={expenses} />
          )}

          {view === VIEWS.EXPENSES && (
            <ExpensesView expenses={expenses} onSave={saveExpensesState} onNotify={showToast} />
          )}

          {view === VIEWS.BILLS && (
            <BillsView
              bills={bills}
              sections={billSections}
              billPayments={billPayments}
              onUpdateSections={saveBillSectionsState}
              onAdd={(bill) => saveBills([bill, ...bills])}
              onUpdate={(id, patch) => {
                const updated = bills.map(b => b.id === id ? { ...b, ...patch } : b);
                saveBills(updated);
              }}
              onDelete={handleDeleteBill}
              onReorder={(updatedBills) => saveBills(updatedBills)}
              onPaymentUpdate={(month, billId, paidAmt) => {
                const updated = {
                  ...billPayments,
                  [month]: { ...(billPayments[month] || {}), [billId]: paidAmt },
                };
                saveBillPaymentsState(updated);
              }}
            />
          )}

          {/* Personal section commented out
          {view === VIEWS.PERSONAL && (
            <PersonalView
              finance={finance}
              personal={personal}
              onUpdatePersonal={savePersonalState}
            />
          )}
          */}
        </main>

        {view === VIEWS.SALARIES && (showUrgentPanel ? (
          <UrgentSalariesPanel
            urgentSalaryIds={urgentSalaryIds}
            salaries={salaries}
            onAdd={handleAddUrgent}
            onRemove={handleRemoveUrgent}
            onToggle={toggleUrgentPanel}
            onUpdateSalary={handleUpdateSalary}
          />
        ) : (
          <div
            onClick={toggleUrgentPanel}
            title="Expand Urgent Salaries"
            className="no-print"
            style={{
              position: 'fixed',
              right: 0,
              top: '50%',
              transform: 'translateY(-50%)',
              writingMode: 'vertical-rl',
              textOrientation: 'mixed',
              background: '#DC143C',
              color: '#fff',
              padding: '12px 6px',
              borderRadius: '8px 0 0 8px',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '11px',
              letterSpacing: '1px',
              boxShadow: '-2px 0 8px rgba(0,0,0,0.15)',
              zIndex: 100,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              userSelect: 'none',
              transition: 'background 0.2s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#b01030'}
            onMouseLeave={e => e.currentTarget.style.background = '#DC143C'}
          >
            <span>🚨</span>
            <span>URGENT SALARIES</span>
          </div>
        ))}
      </div>
    </div>
  );
}
