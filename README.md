# Devmate Finance Center

Internal finance portal for **Devmate Solutions**: invoices, clients & projects, employees, salaries and misc bills, backed by Supabase.

## Features

- **Dashboard**: cash received this month (vs last month), net cash, outstanding & overdue receivables, salaries due, bills, 6‑month revenue chart, "Needs attention" queue, top clients
- **Invoices**: auto-numbering from #4001, pending → confirm flow, scheduled & recurring invoices (auto-cloned when paid), overdue tracking, duplicate, copy payment reminder, PDF download, CSV export
- **Clients**: saved details & default payment link,a projects with collection progress, per-client ledger
- **Salaries**: month tabs, monthly/one-time salaries, inline edits, pay-in-full, push to next month, automatic month rollover, urgent-salaries side panel, CSV exportb
- **Employees**: base salary, departments, quick payments to the oldest outstanding salary
- **Payments (bills)**: monthly/one-time/custom sections, month-wise payments & history, CSV export. Each bill row shows **Total | Paid | Pending**; editing opens **inline under that row** (never at the top). Partial payments **add a log entry** (amount + date) instead of overwriting a total; Mark Paid logs the remaining balance; Undo removes only the last log. Categories are only **Personal / Business / Loan**.
- **Bill Logs**: separate view under Misc Payments — one expandable title per bill/person (▶ arrow) with its full payment history (date, type, amount, note). Logs are keyed by bill id and never store the name, so renaming a bill in Payments renames it in Bill Logs automatically. Each bill also has a **Logs** button that jumps straight to its history. Existing paid totals are migrated once into "Opening balance" logs, so no history is lost. No new Supabase table — logs live in the `misc_bill_payment_logs` app setting, like the other bill data.
- **Expenses**: commented out / hidden from the sidebar (18 Nov 2026) — the code and data are kept, nothing deleted.
- **Reports**: monthly invoiced vs cash received, salaries, bills, expected profit & net cash, CSV export
- Multi-currency (AED, USD, OMR, GBP, EUR). Cross-currency totals are converted to AED using `AED_RATES` in `src/utils/helpers.js`

## Setup

```bash
npm install
```

Create `.env.local`:

```
REACT_APP_SUPABASE_URL=https://<project>.supabase.co
REACT_APP_SUPABASE_ANON_KEY=<anon key>
```

### Authentication (one-time)

Sign-in uses **Supabase Auth**. No credentials live in the code.

1. Supabase dashboard → **Authentication → Users → Add user** (email + password, auto-confirm).
2. **Authentication → Providers → Email** → disable "Allow new users to sign up".
3. Deploy this version of the app and sign in.
4. Run `supabase_auth_rls_migration.sql` in the SQL editor. It restricts every table to signed-in users (previously the public anon key could read/write everything).

```bash
npm start       # dev server on http://localhost:3000
npm run build   # production build in build/
```

## Project structure

```
src/
├── api.js                  # Supabase reads/writes + auth
├── supabaseClient.js
├── utils/helpers.js        # dates, currency, rollover, bills, CSV, print HTML
├── components/             # one file per view (Dashboard, InvoiceForm, SalariesView, …)
├── App.js                  # state, persistence, routing
└── index.css               # design tokens & styles
supabase_*_migration.sql    # run in the Supabase SQL editor
```
