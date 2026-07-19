# SYLHN POS — Grocery Store Point of Sale

A premium, production-ready Point of Sale system for grocery stores and retail businesses in Ghana. Built with Next.js 16, TypeScript, Prisma, and Tailwind CSS. Installable as a PWA on any device.

![SYLHN POS](https://img.shields.io/badge/SYLHN-POS-059669?style=for-the-badge&logo=shopify)

## Features

### Sales & Checkout
- **Fast POS screen** with product grid, barcode scanner, quick-add keys
- **Multiple payment methods** — Cash (with denomination calculator), Card, Mobile Money (MTN MoMo API)
- **Held orders** — park a sale and resume later
- **Refunds & returns** — full or partial refunds with manager approval for amounts over GHS 100
- **Receipt printing** — thermal printer support, PDF, CSV, WhatsApp delivery
- **QR code receipts** — customers scan to verify receipt authenticity

### Stock Management
- **Full product CRUD** — add, modify, delete products with images, barcodes, SKUs
- **Stock groups** — organize products into categories
- **Quantity adjustments** — with reason codes and audit trail
- **Stock history** — complete movement log with filters
- **Stock History Pro** — advanced analytics with charts
- **Bulk CSV import** — import hundreds of products at once
- **Low-stock alerts** — automatic notifications when items hit reorder level
- **Expiry tracking** — alerts for products expiring soon

### Purchasing & Suppliers
- **Purchase orders** — create, send, and track POs to suppliers
- **Supplier management** — contacts, balances, payment terms
- **Receive stock** — increment inventory when deliveries arrive
- **Supplier payments** — track payables and aging

### Reports & Analytics
- **Operations Dashboard** — real-time KPIs (revenue, txn count, top products, low stock, expiry)
- **Sales reports** — daily, monthly, custom date ranges
- **Profit & Loss** — margin analysis per product/category
- **VAT filing** — Ghana-standard VAT report with e-file export
- **Inventory valuation** — current stock value at cost or retail
- **Inventory aging** — identify slow-moving stock
- **Supplier aging** — track payables by age
- **Z-Report** — end-of-day reconciliation with auto-email cron

### Finance
- **Expense tracking** — record business expenses with categories
- **Cash reconciliation** — denomination counter for shift close
- **Mobile Money tracking** — reconcile MoMo payments
- **Customer credit** — track customer balances and credit limits

### Communication
- **Email system** — send invoices, reports, statements via SMTP
- **Telephone directory** — customer/supplier contacts
- **WhatsApp receipts** — send receipts via wa.me link
- **Daily summary email** — automated 8 AM business summary (cron)

### Admin & Security
- **Role-based access** — admin, manager, cashier, stockkeeper, accountant
- **Permission system** — granular per-module permissions
- **Audit log** — every action is logged with user, IP, timestamp
- **Manager approval** — required for voids, large discounts, refunds over GHS 100
- **Strong password policy** — zxcvbn-based with weak-password blocklist
- **Rate limiting** — login (10/15min), API read (300/min), API write (120/min)
- **CSRF protection** — double-submit cookie pattern
- **Security headers** — CSP, HSTS, X-Content-Type-Options, Permissions-Policy

### Premium Mobile Experience
- **PWA installable** — add to home screen, works offline
- **Mobile-first design** — all modules optimized for touch
- **Bottom navigation** — POS, Cart, Dashboard, Reports, More
- **Premium glass UI** — frosted backgrounds, spring animations, haptic feedback
- **Safe-area aware** — notched device support
- **Offline cart persistence** — IndexedDB survives crashes/refreshes
- **Data persistence** — products, held orders, history survive logout/login

### AI Features
- **AI Business Assistant** — natural-language queries about your business
- **AI Demand Forecast** — predict future product demand
- **Auto-replenish rules** — automatic reorder suggestions

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript 5 |
| Database | SQLite (dev) / PostgreSQL (prod) via Prisma ORM |
| Styling | Tailwind CSS 4 + custom premium glass components |
| Auth | JWT sessions + httpOnly cookies + CSRF |
| Email | Nodemailer (SMTP) |
| PDF | jsPDF + jspdf-autotable |
| Charts | Recharts |
| Icons | Lucide React |
| Animations | Framer Motion |

## Quick Start

### Prerequisites
- Node.js 18+ and Bun (or npm)
- SQLite (for dev) or PostgreSQL (for prod)

### Installation

```bash
# Clone
git clone https://github.com/Sallysak/sylhn-pos.git
cd sylhn-pos

# Install dependencies
bun install   # or npm install

# Set up environment
cp .env.example .env
# Edit .env with your settings (see below)

# Set up database
bun run db:generate
bun run db:push
bun run seed   # creates default admin user + sample products

# Start dev server
bun run dev
```

Open http://localhost:3000 and log in with:
- Username: `admin`
- Password: `admin123`

### Environment Variables

Create a `.env` file:

```env
# Database
DATABASE_URL="file:./db/custom.db"  # SQLite dev
# DATABASE_URL="postgresql://user:pass@localhost:5432/sylhn_pos"  # PostgreSQL prod

# Auth
JWT_SECRET="your-super-secret-jwt-key-change-this"
SESSION_MAX_AGE_SECONDS="2592000"  # 30 days

# Cron (for automated emails)
CRON_SECRET="your-cron-secret"

# MTN MoMo (optional)
MTN_MOMO_USER_ID="your-momo-user-id"
MTN_MOMO_API_KEY="your-momo-api-key"
MTN_MOMO_SUBSCRIPTION_KEY="your-momo-subscription-key"
MTN_MOMO_ENVIRONMENT="sandbox"  # or "production"

# Email (optional, for reports and daily summary)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"
SMTP_FROM='"SYLHN POS" <your-email@gmail.com>'

# AI (optional)
ZAI_API_KEY="your-zai-api-key"
```

## Deployment

### Option 1: Vercel (recommended)

1. Push to GitHub
2. Import project at https://vercel.com/new
3. Add all env vars in Vercel dashboard
4. Deploy

### Option 2: Self-hosted (VPS)

```bash
# Build
bun run build

# Start production server
bun run start

# Or use PM2 for process management
pm2 start "bun .next/standalone/server.js" --name sylhn-pos
pm2 save
pm2 startup
```

### Option 3: Docker (coming soon)

### Post-Deployment Setup

1. **Change admin password** — log in as `admin/admin123`, then Maintenance → User Management
2. **Configure SMTP** — Maintenance → System Settings → Email (for receipts and reports)
3. **Set daily summary recipient** — add `email.dailySummaryTo` in system settings
4. **Set up cron jobs** — use cron-job.org or Vercel Cron:
   - **Daily Z-Report at 23:59**: `POST https://your-domain/api/z-report/cron` with header `x-cron-secret: your-secret`
   - **Daily summary at 08:00**: `POST https://your-domain/api/notifications/daily-summary` with header `x-cron-secret: your-secret`
5. **Install PWA** — open the app on your phone, tap "Add to Home Screen"
6. **Set up registers** — Maintenance → System Settings → Registers (if multi-terminal)

## Default Users

| Username | Password | Role |
|----------|----------|------|
| admin | admin123 | Administrator |
| sarah | (set during seed) | Admin |
| mike | (set during seed) | Manager |
| grace | (set during seed) | Cashier |

**⚠️ Change all passwords immediately after first login.**

## API Reference

The API is documented via the source files in `src/app/api/`. Key endpoints:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/login` | POST | Authenticate user, set session cookie |
| `/api/auth/logout` | POST | Clear session |
| `/api/auth/me` | GET | Current user info |
| `/api/products` | GET/POST | List/create products |
| `/api/products/import` | POST | Bulk CSV import |
| `/api/sales` | GET/POST | List/create sales |
| `/api/sales/[id]/refund` | POST | Process a refund |
| `/api/reports/*` | GET | Various reports |
| `/api/z-report` | GET | End-of-day Z-Report |
| `/api/z-report/cron` | POST | Auto-email Z-Report (cron) |
| `/api/notifications/daily-summary` | POST | Daily summary email (cron) |
| `/api/dashboard` | GET | Operations dashboard data |
| `/api/receipt/verify` | GET | Public receipt verification |

## Project Structure

```
src/
├── app/
│   ├── api/              # API routes (80+ endpoints)
│   ├── display/          # Customer-facing display page
│   ├── forecast/         # AI demand forecast page
│   ├── globals.css       # Global styles + premium mobile polish
│   ├── layout.tsx        # Root layout (ErrorBoundary, Toaster, fonts)
│   ├── loading.tsx       # Loading skeleton
│   ├── error.tsx         # Error boundary
│   ├── not-found.tsx     # 404 page
│   └── page.tsx          # Main POS page (4500+ lines)
├── components/
│   ├── features-map.tsx  # "Where to find everything" guide
│   ├── mobile-nav.tsx    # Premium bottom nav + More drawer
│   ├── stock-management.tsx
│   ├── operations-dashboard.tsx
│   ├── sales-reports.tsx
│   ├── maintenance-module.tsx
│   └── ... (30+ components)
├── lib/
│   ├── auth.ts           # JWT sessions, CSRF, permissions
│   ├── pos-data.ts       # Constants (TAX_RATE, COMPANY, formatGHS)
│   ├── pos-types.ts      # TypeScript types (ViewMode, CartItem, etc.)
│   ├── session-data.ts   # Logout/login data persistence
│   ├── cart-persistence.ts # IndexedDB cart recovery
│   └── ...
└── prisma/
    └── schema.prisma     # 30+ models (Sale, Product, SystemUser, etc.)
```

## Mobile Features Map

| Where | What |
|-------|------|
| Bottom Nav → POS tab | Main checkout screen |
| Bottom Nav → Cart tab | View/edit current sale |
| Bottom Nav → Dashboard tab | Operations Dashboard (KPIs) |
| Bottom Nav → Reports tab | Sales Menu |
| Bottom Nav → More tab | All other modules (categorized) |
| Floating + button (bottom-left) | SpeedDial: AI, Scan, Printer, Cash Calc |
| More → Features Map | Visual guide to every feature's location |

## Security Checklist

- [x] Strong password policy (zxcvbn)
- [x] Rate limiting on login + API
- [x] CSRF protection (double-submit cookie)
- [x] Security headers (CSP, HSTS, X-Content-Type-Options)
- [x] httpOnly session cookies
- [x] Audit logging for all actions
- [x] Manager approval for high-value voids/refunds
- [x] Input validation (Zod schemas)
- [x] SQL injection protection (Prisma parameterized queries)
- [x] XSS protection (React escaping + CSP)

## License

Proprietary — © SYLHN COMPANY LTD. All rights reserved.

## Support

- **Phone**: +233 59 276 6044
- **Email**: admin@sylhn.com
- **Address**: East Legon, Accra, Ghana
