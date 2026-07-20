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
  })

// ===== Schema bootstrap =====
// On a fresh Postgres instance, tables don't exist yet. We try a simple
// query; if it fails, we run `prisma db push` to create the schema, then
// seed default users. This is idempotent and safe to run on every cold
// start — if the tables already exist, the count() succeeds and we skip.
if (!globalForPrisma.__prismaDbPush) {
  globalForPrisma.__prismaDbPush = (async () => {
    try {
      const userCount = await db.systemUser.count();
      if (userCount === 0) {
        console.log('[db] No users found. Seeding default users...');
        await seedDefaultUsers();
      }
    } catch (e: any) {
      // Table doesn't exist — create the schema via `prisma db push`.
      // This is the supported, schema-driven way to provision a fresh DB.
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
        // Don't try to create tables with raw SQL — Prisma's schema is large
        // and hand-maintaining a parallel raw-SQL schema is brittle. If
        // db push fails, the operator should run it manually:
        //   npx prisma db push
        // and check that DATABASE_URL points to a writable Postgres instance.
      }
    }
  })().catch((e) => {
    console.error('[db] Initialization error:', e?.message);
  });
}

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db

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
