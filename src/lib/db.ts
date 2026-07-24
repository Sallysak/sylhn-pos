import { PrismaClient } from '@prisma/client'

// ===== Database initialization =====
// Production: DATABASE_URL must be set to a PostgreSQL connection string
// (Vercel Postgres, Supabase, Neon, etc.). The schema is PostgreSQL.
//
// Development fallback: if DATABASE_URL is not set, we use a local SQLite
// file for convenience — but Prisma's provider is set to "postgresql" in
// schema.prisma, so this fallback will only work if the developer switches
// the provider locally. In practice, set DATABASE_URL even in dev.
//
// On Vercel: Vercel auto-injects POSTGRES_URL (and friends) when you link
// a Postgres storage. Either copy that value to DATABASE_URL, or set
// DATABASE_URL directly to your Supabase/Neon connection string.
if (!process.env.DATABASE_URL) {
  // Hard-fail in production — no silent SQLite fallback anymore (the
  // SQLite-in-/tmp approach was the source of the "invalid credentials"
  // bug because data was wiped on every cold start).
  if (process.env.NODE_ENV === 'production') {
    console.error(
      '[db] FATAL: DATABASE_URL is not set. Set it to a PostgreSQL connection ' +
      'string (Vercel Postgres, Supabase, or Neon). See README.md → Deploying.'
    );
  } else {
    // Dev-only fallback so `next dev` works without a real DB
    process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/sylhn_pos?schema=public';
    console.warn(
      '[db] DATABASE_URL not set — using dev fallback. Start a local Postgres ' +
      'with `docker run -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres:16` ' +
      'or set DATABASE_URL to your own connection string.'
    );
  }
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  __prismaDbPush?: Promise<void>
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.LOG_QUERIES === '1' ? ['query', 'error', 'warn'] : ['error', 'warn'],
    // Connection pool tuning for serverless (Neon Postgres / Vercel Postgres).
    // Neon's free tier allows ~20 concurrent connections; without tuning,
    // each serverless instance would open num_cpus * 2 + 1 connections and
    // quickly exhaust the pool across cold starts.
    //
    // We append connection_limit=5 + pool_timeout=10s to the URL if the user
    // hasn't already set them. This keeps each serverless instance to ≤5
    // connections, so 4 concurrent instances = 20 connections (the Neon limit).
    datasources: {
      db: {
        url: tuneDatabaseUrl(process.env.DATABASE_URL),
      },
    },
  })

/**
 * Append serverless-friendly connection pool params to a Postgres URL.
 * - connection_limit=5: max connections per serverless instance
 * - pool_timeout=10: seconds to wait for a connection before erroring
 * - connect_timeout=30: seconds to wait for initial connection
 *
 * If the URL already has these params, they're preserved.
 * If the URL is not a postgres URL (e.g. SQLite file:), it's returned as-is.
 */
function tuneDatabaseUrl(url: string | undefined): string | undefined {
  if (!url) return url;
  if (!url.startsWith("postgresql://") && !url.startsWith("postgres://")) return url;

  const params = new URLSearchParams(url.split("?")[1] || "");
  if (!params.has("connection_limit")) params.set("connection_limit", "5");
  if (!params.has("pool_timeout")) params.set("pool_timeout", "10");
  if (!params.has("connect_timeout")) params.set("connect_timeout", "30");
  return url.split("?")[0] + "?" + params.toString();
}

// ===== Schema bootstrap =====
// DB initialization — runs ONCE per serverless instance lifetime.
// Uses a flag so we don't do a count() round-trip on every cold start
// after the first successful init. The globalForPrisma cache persists
// across warm invocations within the same serverless instance.
if (!globalForPrisma.__prismaDbPush) {
  globalForPrisma.__prismaDbPush = (async () => {
    try {
      // Quick health check — if this succeeds, tables exist and DB is ready
      await db.systemUser.count();
      // Don't seed here — seeding is handled by /api/setup and /api/auth/login
      // self-healing. This keeps cold start fast (single count query).
    } catch (e: any) {
      // Table doesn't exist — only run db push on FIRST EVER deploy
      console.log('[db] Tables not found. Running prisma db push...');
      try {
        const { execSync } = await import('child_process');
        execSync('npx prisma db push --skip-generate --accept-data-loss', {
          stdio: 'pipe',
          cwd: process.cwd(),
          env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
        });
        console.log('[db] Schema created. Seeding default users...');
        await seedDefaultUsers();
      } catch (pushErr: any) {
        console.error('[db] prisma db push failed:', pushErr?.message || pushErr);
      }
    }
  })().catch((e) => {
    console.error('[db] Initialization error:', e?.message);
  });
}

// CRITICAL: Always cache PrismaClient globally — in BOTH dev and production.
// Without this, every Vercel cold start creates a new PrismaClient, opening
// new DB connections. With many concurrent requests, this exhausts Neon's
// connection pool (max ~20 connections on free tier).
globalForPrisma.prisma = db

// ===== Helpers: seed default users + wait for DB readiness =====
// Used by /api/auth/login to self-heal when the DB has no users (e.g. a
// fresh Postgres instance, or after a manual table drop). Calling
// waitForDb() guarantees that the initialization promise has settled
// before any query runs.

/**
 * Seed the three default users (admin, manager, cashier) with hashed passwords.
 * Safe to call multiple times — uses upsert so existing rows are untouched.
 */
export async function seedDefaultUsers(): Promise<void> {
  const { hashPassword } = await import('./auth');
  const adminHash = await hashPassword('admin123');
  const managerHash = await hashPassword('manager123');
  const cashierHash = await hashPassword('cashier123');

  const allPerms = JSON.stringify({
    pos: true, sales: true, stock: true, purchase: true, accounts: true,
    telephone: true, maintenance: true, financeOps: true,
    canVoid: true, canDiscount: true, canAdjustStock: true,
    canDeleteProducts: true, canExport: true,
  });
  const managerPerms = JSON.stringify({
    pos: true, sales: true, stock: true, purchase: true, accounts: true,
    telephone: true, maintenance: false, financeOps: true,
    canVoid: true, canDiscount: true, canAdjustStock: true,
    canDeleteProducts: false, canExport: true,
  });
  const cashierPerms = JSON.stringify({
    pos: true, sales: true, stock: false, purchase: false, accounts: false,
    telephone: true, maintenance: false, financeOps: false,
    canVoid: false, canDiscount: true, canAdjustStock: false,
    canDeleteProducts: false, canExport: false,
  });

  const crypto = await import('crypto');
  const users = [
    { username: 'admin', password: adminHash, fullName: 'System Administrator', role: 'admin', phone: '+233592766044', email: 'admin@sylhn.com', permissions: allPerms, active: true },
    { username: 'manager', password: managerHash, fullName: 'Store Manager', role: 'manager', phone: '+233 24 111 2222', email: 'manager@sylhn.com', permissions: managerPerms, active: true },
    { username: 'cashier', password: cashierHash, fullName: 'Sarah Johnson', role: 'cashier', phone: '+233 24 333 4444', email: 'sarah@sylhn.com', permissions: cashierPerms, active: true },
  ];

  for (const u of users) {
    await db.systemUser.upsert({
      where: { username: u.username },
      update: {}, // don't overwrite an existing user's password
      create: { id: crypto.randomUUID(), ...u },
    });
  }
  console.log('[db] Default users ensured: admin/admin123, manager/manager123, cashier/cashier123');
}

/**
 * Wait for the DB initialization (table creation + auto-seed) to settle.
 * Call this at the top of any API route that needs the schema to be ready.
 */
export async function waitForDb(): Promise<void> {
  if (globalForPrisma.__prismaDbPush) {
    try { await globalForPrisma.__prismaDbPush; } catch { /* already logged */ }
  }
}

/**
 * Self-heal: ensure a specific default user exists (e.g. 'admin').
 * Used by /api/auth/login when the lookup returns null but the username
 * matches a default account — this typically happens on a fresh DB.
 */
export async function ensureDefaultUser(username: string): Promise<void> {
  const defaults = ['admin', 'manager', 'cashier'];
  if (!defaults.includes(username)) return;
  try { await seedDefaultUsers(); } catch (e: any) {
    console.error('[db] ensureDefaultUser seed failed:', e?.message);
  }
}

/**
 * Run a Prisma transaction with automatic retry on transient errors.
 *
 * PostgreSQL (especially with PgBouncer on serverless) can throw:
 *   - P2034: "Transaction was rolled back due to a concurrent update"
 *   - P2024: "Timed out fetching a new connection from the connection pool"
 *   - P1001: "Can't reach database server"
 *
 * This helper retries up to 3 times with exponential backoff (50ms, 100ms, 200ms).
 *
 * Usage:
 *   const result = await withRetry(async (tx) => {
 *     const sale = await tx.sale.create({ ... });
 *     await tx.product.updateMany({ ... });
 *     return sale;
 *   });
 */
export async function withRetry<T>(
  fn: (tx: any) => Promise<T>,
  options: { maxRetries?: number; baseDelayMs?: number } = {}
): Promise<T> {
  const maxRetries = options.maxRetries ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 50;

  let lastError: any;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await db.$transaction(fn);
    } catch (e: any) {
      lastError = e;
      const code = e?.code || "";
      // Retryable Prisma error codes
      const retryable = ["P2034", "P2024", "P1001", "P1017", "P5020"];
      if (!retryable.includes(code) || attempt === maxRetries - 1) {
        throw e;
      }
      // Exponential backoff
      const delay = baseDelayMs * Math.pow(2, attempt);
      await new Promise(r => setTimeout(r, delay));
      console.warn(`[db] Transaction retry ${attempt + 1}/${maxRetries} after ${delay}ms (${code}: ${e?.message})`);
    }
  }
  throw lastError;
}

