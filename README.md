# Devmate Solutions — Invoice Generator

A professional invoice management system built with React.js for **Devmate Solutions**.

![Devmate](src/assets/logo.png)

## Features

- **Auto-incrementing invoices** starting from #4001
- **Client memory** — returning clients auto-fill from saved data
- **Multi-currency** support (USD, AED, OMR, GBP, EUR)
- **Payment tracking** — Total / Paying Now / Remaining with auto status
- **Payment link** integration on invoices
- **Print / PDF** export with branded layout
- **Client ledger** — view all invoices per client
- **Reports** — monthly revenue, top clients, payment status
- **Mobile responsive** with collapsible sidebar
- **Data persistence** via localStorage

## Quick Start

### Prerequisites

- **Node.js** v16+ installed ([download](https://nodejs.org/))
- **npm** (comes with Node.js)

### Installation

```bash
# 1. Navigate to the project folder
cd devmate-invoice

# 2. Install dependencies
npm install

# 3. Start development server
npm start
```

The app will open at **http://localhost:3000**

### Build for Production

```bash
npm run build
```

This creates an optimized build in the `build/` folder.

## Project Structure

```
devmate-invoice/
├── public/
│   └── index.html            # HTML template with Poppins font
├── src/
│   ├── assets/
│   │   └── logo.png           # Devmate logo
│   ├── components/
│   │   ├── Icon.js            # SVG icon component
│   │   ├── UI.js              # Shared UI (Button, Input, Badge, etc.)
│   │   ├── Dashboard.js       # Dashboard view
│   │   ├── InvoiceForm.js     # Create/edit invoice form
│   │   ├── InvoiceHistory.js  # Invoice list with search & filter
│   │   ├── InvoicePreview.js  # Invoice preview & print
│   │   └── ClientsReports.js  # Clients & Reports views
│   ├── utils/
│   │   └── helpers.js         # Storage, formatting, PDF generation
│   ├── App.js                 # Main app with routing & state
│   ├── index.js               # React entry point
│   └── index.css              # All styles (CSS custom properties)
└── package.json
```

## Brand Guidelines

| Element     | Value                          |
|-------------|--------------------------------|
| Primary     | `#DC143C` (Crimson Red)        |
| Font        | Poppins (Google Fonts)         |
| Locations   | Dubai · Muscat · New York      |
| Email       | management@devmatesolutions.com|
| Website     | devmatesolutions.com           |

## Tech Stack

- **React 18** — UI framework
- **CSS Custom Properties** — theming (no Tailwind dependency)
- **localStorage** — data persistence
- **Poppins** — typography via Google Fonts

## Notes

- All data is stored in your browser's localStorage
- Invoice numbers auto-increment and persist across sessions
- The Print/PDF feature opens a new window with a branded invoice
- Works in VS Code, Cursor, WebStorm, or any IDE with terminal access
# devmate-finance-center
