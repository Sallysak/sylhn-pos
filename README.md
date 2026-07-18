# SYLHN POS — Grocery Store Point of Sale System

A production-grade, mobile-first Point of Sale system for **SYLHN COMPANY LTD**, a grocery store in East Legon, Accra, Ghana. Built with Next.js 16, Prisma, and SQLite.

![SYLHN POS](public/icon-512.png)

## Features

### Point of Sale
- Mobile-first responsive UI with bottom tab navigation
- Speed Dial (expandable FAB) for quick actions
- Barcode scanning (camera + manual entry)
- Quick Keys for top-selling products
- Held orders (park & recall carts)
- Cash denomination calculator (GHS denominations)
- Multi-currency display (GHS, USD, EUR, GBP, NGN, CFA)
- Dark mode

### Inventory
- Product CRUD with bulk upsert, barcode, expiry date, supplier linking
- Stock groups, stocktake module with variance tracking
- Stock history (full movement log)
- Low-stock alerts + auto-replenish rules
- Expiry date tracking + urgency tiers
- Multi-location stock + stock transfers

### Sales & Customers
- Server-side total recalculation (cashier can't fake totals)
- Race-condition-safe stock decrement
- Idempotent void/refund with stock restoration + loyalty reversal
- Loyalty program with tier auto-upgrade
- Customer credit accounts (buy-now-pay-later) with FIFO settlement
- WhatsApp receipts + QR code verification
- ESC/POS thermal printer (58mm/80mm via Web Bluetooth)

### Reporting
- Z-Report (gross/voids/refunds, payment breakdown, per-cashier)
- GRA VAT filing report (output VAT, input VAT, NHIL split)
- Sales, profit, low-stock, expiry, supplier-aging, inventory-valuation reports
- CSV/Excel/PDF export for all reports

### Operations
- Manager approval flow for voids/refunds/discounts/deletions
- Cashier shifts (open/close, opening float, expected vs actual cash)
- Audit log for every sensitive action
- AI Business Assistant (LLM-backed)
- AI Demand Forecasting (90-day history, day-of-week seasonality)
- Offline sale queue (IndexedDB, auto-flush on reconnect)
- PWA (installable, service worker, offline support)

### Security
- PBKDF2 password hashing (100k iterations, SHA-256, per-user salt)
- Signed session cookies (HMAC-SHA256 JWT-like tokens, httpOnly)
- CSRF protection (double-submit cookie)
- Rate limiting (login, API writes, reads, seed, email)
- Role-based access control (admin, manager, cashier, stockkeeper, accountant)
- Strict CSP + frame-ancestors in production
- Path-traversal protection on backup operations
- Strong password policy (min 8 chars, letter+number, no common passwords)

## Quick Start (Development)

### Prerequisites
- Node.js 18+ or Bun 1.0+
- SQLite (bundled with the project)

### Install & Run

```bash
# 1. Install dependencies
bun install

# 2. Copy env template and set required vars
cp .env.example .env
# Edit .env — at minimum set SESSION_SECRET to a random 32+ char string:
#   openssl rand -hex 32

# 3. Create the database + apply schema (uses migrations)
bun run db:migrate:deploy

# 4. Seed the database (generates RANDOM passwords, prints them ONCE)
bun run seed
# Save the printed credentials — they will NOT be shown again.

# 5. Start the dev server
bun run dev
# Open http://localhost:3000
```

### Login

Use the credentials printed by `bun run seed`. Default usernames are `admin`, `manager`, `cashier`, `stockkeeper`, `accountant`. **Passwords are random** — there are no default passwords.

If you lose the passwords, re-run `bun run seed` to regenerate them (this wipes all data — use only for fresh installs).

## Production Deployment

### Option 1: Docker (recommended)

```bash
# 1. Build the image
docker build -t sylhn-pos .

# 2. Run with persistent volumes
docker run -d \
  --name sylhn-pos \
  -p 3000:3000 \
  -v sylhn-pos-db:/app/db \
  -v sylhn-pos-backups:/app/backups \
  -e SESSION_SECRET=$(openssl rand -hex 32) \
  -e NODE_ENV=production \
  --restart unless-stopped \
  sylhn-pos

# 3. Run the initial migration + seed (one-time)
docker exec -it sylhn-pos bun run db:migrate:deploy
docker exec -it sylhn-pos bun run seed
```

### Option 2: Direct deployment with Caddy + systemd

See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for a step-by-step guide including TLS via Caddy and a systemd service file.

### Production Checklist

Before going live, ensure ALL of the following are set:

- [ ] `SESSION_SECRET` env var is set to a random 32+ char string
- [ ] `NODE_ENV=production`
- [ ] HTTPS is enabled (Caddy, nginx, or a reverse proxy with TLS)
- [ ] `bun run seed` has been run and credentials saved securely
- [ ] All default users have logged in and changed their passwords
- [ ] Daily backup cron is configured (see `docs/OPERATIONS.md`)
- [ ] `/api/health` returns 200 (verify with `curl https://yourdomain.com/api/health`)
- [ ] Sentry / error monitoring is configured (see `docs/OPERATIONS.md`)
- [ ] Firewall allows only ports 80 (HTTP→HTTPS redirect) and 443 (HTTPS)

## Project Structure

```
src/
├── app/
│   ├── api/              # API routes (auth, sales, products, reports, etc.)
│   ├── page.tsx          # Main POS page (login + POS interface)
│   ├── forecast/         # AI demand forecast dashboard
│   ├── display/          # Customer-facing secondary display
│   └── globals.css       # Premium design system
├── components/           # React components (admin panel, mobile nav, AI assistant, etc.)
├── lib/                  # Shared libraries (auth, db, validation, rate-limit, audit, etc.)
├── middleware.ts         # Security headers, CSRF, CORS
└── hooks/                # React hooks

prisma/
├── schema.prisma         # Database schema (30+ models)
└── migrations/           # Migration history (NEVER use db:push in prod)

tests/                    # Vitest integration tests
scripts/                  # Seed + maintenance scripts
docs/                     # Documentation (DEPLOYMENT.md, OPERATIONS.md)
```

## Documentation

- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — Production deployment guide (Docker, Caddy, systemd)
- [`docs/OPERATIONS.md`](docs/OPERATIONS.md) — Day-to-day operations (backups, monitoring, troubleshooting)
- [`docs/API.md`](docs/API.md) — API reference for all endpoints
- [`docs/SECURITY.md`](docs/SECURITY.md) — Security architecture and best practices

## Testing

```bash
# Run all tests
bun run test

# Watch mode (re-runs on file change)
bun run test:watch

# Coverage report
bun run test:coverage
```

## Database Migrations

**NEVER use `prisma db push` in production.** Always use migrations:

```bash
# Create a new migration after editing prisma/schema.prisma
bun run db:migrate --name describe_your_change

# Apply pending migrations in production
bun run db:migrate:deploy

# Reset DB (dev only — destroys all data)
bun run db:reset
```

## Backups

### Manual backup
```bash
curl -X POST https://yourdomain.com/api/backups \
  -H "Authorization: Bearer $TOKEN"
```

### Restore
```bash
curl -X POST https://yourdomain.com/api/backups/restore \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"filename":"backup-2026-07-18.db"}'
# A pre-restore safety backup is automatically created.
```

### Automated daily backup (cron)
See [`docs/OPERATIONS.md`](docs/OPERATIONS.md) for the cron setup.

## Tech Stack

- **Framework**: Next.js 16 (Turbopack, App Router)
- **Language**: TypeScript (strict mode)
- **Database**: SQLite + Prisma ORM (with WAL mode for concurrent reads)
- **Auth**: PBKDF2 + HMAC-SHA256 JWT-like tokens, httpOnly cookies
- **UI**: Tailwind CSS 4, shadcn/ui, Framer Motion, Lucide icons
- **Charts**: Recharts
- **AI**: z-ai-web-dev-sdk (LLM for AI Assistant + Demand Forecasting)
- **Printer**: Web Bluetooth ESC/POS
- **Offline**: IndexedDB sale queue, service worker
- **Testing**: Vitest

## License

Proprietary — © SYLHN COMPANY LTD. All rights reserved.

## Support

For support, contact the system administrator at `admin@sylhn.com` or call `+233 59 276 6044`.
