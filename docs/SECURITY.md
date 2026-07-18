# SYLHN POS — Security Architecture

## Overview

SYLHN POS implements defense-in-depth security across multiple layers.

## Authentication

### Password storage
- **Algorithm**: PBKDF2 with SHA-256, 100,000 iterations, 16-byte salt, 32-byte key
- **Format**: `pbkdf2$<iterations>$<salt_hex>$<hash_hex>`
- **Verification**: Constant-time comparison via `crypto.timingSafeEqual`
- **Legacy upgrade**: Plaintext passwords (from earlier versions) are auto-upgraded to PBKDF2 on next login

### Password policy
- Minimum 8 characters
- Must contain at least one letter AND one number
- Common weak passwords are rejected (`admin123`, `password1`, `12345678`, etc.)
- Enforced on: user creation, password change

### Session tokens
- **Format**: JWT-like (`header.body.signature`), HMAC-SHA256 signed
- **Storage**: `httpOnly` cookie (`sylhn-session`), `sameSite=lax`, `secure=true` in prod
- **Lifetime**: 8 hours
- **Verification**: Server-side signature check + expiry check
- **Dev-only fallback**: `sylhn-session-visible` non-httpOnly cookie + Bearer token (for cross-origin preview iframe)

### Session secret
- **Source**: `SESSION_SECRET` env var
- **Production**: Server REFUSES to start if not set or < 32 chars
- **Dev**: Falls back to insecure default (with console warning)

## Authorization

### Role-based access control (RBAC)
Five roles with predefined permissions:
- **admin**: All permissions
- **manager**: All except `maintenance` and `canDeleteProducts`
- **cashier**: POS + sales + telephone + `canDiscount`
- **stockkeeper**: POS + stock + purchase + `canAdjustStock` + `canExport`
- **accountant**: POS + accounts + `financeOps` + `canExport`

### Permission checks
- Server-side: `requirePermission(role, perm)` throws 403 if missing
- Client-side: UI hides buttons the user can't use (cosmetic only — server enforces)

### Manager approval flow
For sensitive operations (voids > GHS 100, discounts > 10%, stock adjustments, deletions):
1. Cashier initiates the action
2. UI prompts for manager credentials
3. Server validates manager credentials in `/api/auth/approve`
4. Audit log records BOTH the cashier (who initiated) and the manager (who approved)

## Network Security

### CSRF protection
- **Pattern**: Double-submit cookie
- **Implementation**: `sylhn-csrf` cookie (non-httpOnly) + `X-CSRF-Token` header
- **Validation**: Constant-time comparison via `crypto.timingSafeEqual`
- **Exemptions**: Same-origin requests (sameSite=lax already protects), public API paths, trusted preview origins in dev

### CORS
- **Dev**: Allows `*.z.ai` and `*.space-z.ai` origins (for preview iframe)
- **Production**: No CORS headers added (same-origin only)
- **Credentials**: Only sent for trusted origins

### Content Security Policy (CSP)
- **Dev**: Permissive (needed for Next.js dev server + preview iframe)
- **Production**: Strict — `default-src 'self'`, `frame-ancestors 'self'`, no `unsafe-eval`

### Other security headers
- `Strict-Transport-Security`: 1 year + preload (production only)
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- `X-Frame-Options: SAMEORIGIN` (production)
- `Cross-Origin-Opener-Policy: same-origin` (production)

## Input Validation

### Schema validation
All API inputs are validated with Zod schemas (`src/lib/validation.ts`):
- Length limits on all strings (prevents memory exhaustion)
- Numeric ranges on all numbers (prevents integer overflow)
- Regex patterns on usernames, SKUs, etc. (prevents injection)
- Maximum array sizes (prevents DoS via huge payloads)

### SQL injection
- **Prevention**: Prisma ORM uses parameterized queries everywhere
- **No raw SQL**: The only raw SQL is `PRAGMA journal_mode=WAL` (a SQLite pragma, not user data)

### Path traversal
- **Backup DELETE/restore**: Filename is sanitized via `path.basename()` and the resolved path is verified to be inside the `backups/` directory
- **All file operations**: Use `path.resolve()` + `startsWith()` check

## Rate Limiting

| Endpoint type | Limit | Window |
|---|---|---|
| Login | 10 requests | 15 minutes |
| API write (POST/PUT/DELETE) | 120 requests | 1 minute |
| API read (GET) | 300 requests | 1 minute |
| Seed | 3 requests | 1 hour |
| Email | 5 requests | 1 hour |

Rate limiting is in-memory (per-instance). For multi-instance deployments, use Redis-backed rate limiting (TODO).

## Audit Logging

Every sensitive action is logged to the `AuditLog` table:
- **User actions**: LOGIN, LOGIN_FAILED, LOGIN_BLOCKED, LOGOUT, PASSWORD_CHANGE
- **Sales**: VOID, REFUND, DISCOUNT_GRANTED
- **Inventory**: STOCK_ADJUST, STOCKTAKE, DELETE_PRODUCT
- **System**: BACKUP, RESTORE, SEED, Z_REPORT, CREDIT_SETTLE
- **Approvals**: APPROVE_GRANTED, APPROVE_DENIED

Each log entry includes: user, action, module, details, severity, IP, user-agent, timestamp.

Logs are written transactionally with the action they record (so they survive even if the action fails).

## Data Integrity

### Transactional sales
- Sale POST runs in a `db.$transaction` block
- Stock is decremented with `updateMany({ where: { quantity: { gte: item.quantity } } })` — atomic check-and-decrement prevents overselling
- If any item's stock is insufficient, the entire transaction rolls back

### Idempotent void/refund
- Server checks `sale.status === "voided"` / `"refunded"` before processing
- Stock restoration + loyalty reversal happen in the same transaction
- Audit log records the action regardless of success

### Data integrity checker
- `/api/data-integrity` reconciles `Product.quantity` against the sum of `StockHistory` entries
- Run after any data migration or restore
- Reports any drift for manual correction

## Offline Mode

### Sale queue
- Sales made offline are queued in IndexedDB
- Queue is flushed FIFO when the network reconnects
- Each sale is idempotent (server deduplicates by invoice number)
- Queue size is shown in the mobile nav badge

### Security considerations
- Offline sales are stored unencrypted in IndexedDB (browser sandbox provides isolation)
- If a device is lost/stolen, the cashier's session cookie expires in 8 hours
- For high-security deployments, enable Full Disk Encryption on the POS device

## Known Limitations

1. **Rate limiting is per-instance**: Multi-instance deployments need Redis-backed rate limiting
2. **Sessions are stateless**: There's no way to revoke a specific session without rotating `SESSION_SECRET` (which logs out everyone)
3. **SQLite in multi-cashier**: WAL mode handles this, but PostgreSQL is recommended for > 5 concurrent cashiers
4. **No 2FA**: TODO — add TOTP-based 2FA for admin/manager roles

## Security Disclosure

If you discover a security vulnerability, please email `admin@sylhn.com` with details. Please DO NOT open a public GitHub issue for security vulnerabilities.

We will acknowledge receipt within 48 hours and provide a fix timeline within 7 days.
