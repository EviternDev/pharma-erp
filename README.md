# PharmaCare ERP

Lightweight, offline-first desktop pharmacy management application built for Indian pharmacies. Runs on older PCs (2GB RAM, dual-core, Windows 10+) with full GST compliance.

## Tech Stack

- **Desktop Runtime**: Tauri 2 (Rust backend, ~15-30MB installer)
- **Frontend**: React 19 + TypeScript 5.8
- **UI**: shadcn/ui + Tailwind CSS v4
- **Database**: SQLite (via `@tauri-apps/plugin-sql`)
- **Auth**: bcryptjs (local, no server)
- **Testing**: Vitest + React Testing Library

## Features

### Implemented (v0.1.0)

- **Authentication** — Login, first-launch admin setup wizard, session persistence via localStorage
- **User Management** — Create, edit, activate/deactivate users with role assignment
- **RBAC** — Three fixed roles (Admin / Pharmacist / Cashier) with route protection and sidebar filtering
- **Pharmacy Settings** — GSTIN validation (15-char regex), drug license, invoice prefix, stock/expiry thresholds
- **Database Layer** — Typed query modules for users, medicines, batches, customers, suppliers, sales, settings, GST slabs, prescriptions, reports
- **App Shell** — Collapsible sidebar, 16 route pages, print-friendly CSS

### Planned

- Medicine & batch CRUD with FEFO stock management
- GST-compliant POS/billing (CGST + SGST split, MRP enforcement)
- Customer management with prescription tracking
- Supplier management with payment tracking
- CSV import for bulk medicine data
- Medium-format receipt printing (`@media print`)
- Reports: sales, stock, profit/loss, expiry (tabular)
- Manual backup/restore

## Indian GST Compliance

- **4 GST slabs**: 0%, 5%, 12%, 18%
- **MRP is GST-inclusive** — taxable value back-calculated: `taxable = selling_price * 100 / (100 + gst_rate)`
- **CGST = SGST = gst_rate / 2** (intra-state only, no IGST in v1)
- **Selling above MRP is blocked** (Essential Commodities Act)
- All monetary values stored as **paise** (integers, no floating-point)
- Invoice fields per Rule 46, CGST Rules 2017

## Getting Started

### Prerequisites

- [Rust](https://rustup.rs/) (1.70+)
- [Node.js](https://nodejs.org/) (18+)
- [Bun](https://bun.sh/) (package manager)

### Setup

```bash
# Clone
git clone https://github.com/EviternDev/pharma-erp.git
cd pharma-erp

# Install dependencies
bun install

# Run in development
bun tauri dev

# Run tests
bun test

# Type check
bunx tsc --noEmit

# Build for production
bun tauri build
```

## Project Structure

```
src/
├── features/           # Feature modules
│   ├── auth/           # AuthContext, LoginPage, FirstLaunchWizard, RBAC
│   ├── settings/       # Pharmacy settings form
│   └── users/          # User CRUD table + dialog
├── db/                 # Database access layer
│   ├── queries/        # Typed query modules (users, medicines, batches, etc.)
│   ├── DbProvider.tsx  # React context for DB connection
│   └── utils.ts        # camelCase mapping, toBool
├── components/
│   ├── layout/         # AppLayout, Sidebar
│   └── ui/             # shadcn components (14)
├── hooks/              # useSettings, usePermission
├── pages/              # Route page components (re-export from features)
├── types/              # TypeScript interfaces (User, Medicine, Batch, Sale, etc.)
├── lib/                # Utilities (cn, currency/paise helpers)
└── styles/             # Tailwind + print CSS

src-tauri/
├── src/lib.rs          # Tauri plugin setup + SQLite migrations
└── tauri.conf.json     # App config
```

## Role Permissions

| Capability | Admin | Pharmacist | Cashier |
|---|:---:|:---:|:---:|
| Dashboard | ✓ | ✓ | ✓ |
| Inventory (view/edit) | ✓ | ✓ | — |
| Sales (create/view) | ✓ | ✓ | ✓ |
| Customers (view/edit) | ✓ | ✓ | view |
| Suppliers | ✓ | view | — |
| Reports | ✓ | ✓ | — |
| User Management | ✓ | — | — |
| Settings | ✓ | — | — |

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

## License

Private — Evitern Dev
