import { PrismaClient } from '@prisma/client'
import { mkdirSync, existsSync } from 'fs'
import { join } from 'path'

// ===== Database initialization =====
// On Vercel/serverless: DATABASE_URL may not be set, or may point to a
// path that doesn't exist. We ensure the directory exists and use a
// writable location (/tmp on Vercel, local dir in dev).
//
// For production with persistence, set DATABASE_URL to a persistent
// PostgreSQL connection string (e.g., via Vercel Postgres or Supabase).
function getDatabaseUrl(): string {
  // If DATABASE_URL is explicitly set, use it
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  // Default: SQLite in /tmp (works on Vercel serverless)
  // Note: /tmp is ephemeral on serverless — data won't persist across
  // cold starts. For production, use PostgreSQL.
  const isProduction = process.env.NODE_ENV === 'production';
  const dbPath = isProduction
    ? '/tmp/sylhn-pos.db'
    : join(process.cwd(), 'db', 'custom.db');

  // Ensure directory exists
  const dbDir = isProduction ? '/tmp' : join(process.cwd(), 'db');
  if (!existsSync(dbDir)) {
    try { mkdirSync(dbDir, { recursive: true }); } catch { /* ignore */ }
  }

  return `file:${dbPath}`;
}

// Set DATABASE_URL before creating PrismaClient (only if not already set)
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = getDatabaseUrl();
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  __prismaWalSetup?: Promise<void>
  __prismaDbPush?: Promise<void>
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.LOG_QUERIES === '1' ? ['query', 'error', 'warn'] : ['error', 'warn'],
  })

// Enable SQLite WAL mode once per process
if (!globalForPrisma.__prismaWalSetup) {
  globalForPrisma.__prismaWalSetup = db.$queryRaw`PRAGMA journal_mode=WAL`
    .then(() => {
      if (process.env.LOG_QUERIES === '1') console.log('[db] SQLite WAL mode enabled')
    })
    .catch((e: any) => {
      console.warn('[db] WAL mode failed (non-critical):', e?.message || e)
    })
}

// Auto-create tables AND seed default users on first run
if (!globalForPrisma.__prismaDbPush) {
  globalForPrisma.__prismaDbPush = (async () => {
    try {
      // Check if the SystemUser table exists by trying a simple count
      const userCount = await db.systemUser.count();

      // If no users exist, auto-seed default users
      if (userCount === 0) {
        console.log('[db] No users found. Auto-seeding default users...');
        try {
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

          await db.systemUser.createMany({
            data: [
              { username: 'admin', password: adminHash, fullName: 'System Administrator', role: 'admin', phone: '+233592766044', email: 'admin@sylhn.com', permissions: allPerms, active: true },
              { username: 'manager', password: managerHash, fullName: 'Store Manager', role: 'manager', phone: '+233 24 111 2222', email: 'manager@sylhn.com', permissions: managerPerms, active: true },
              { username: 'cashier', password: cashierHash, fullName: 'Sarah Johnson', role: 'cashier', phone: '+233 24 333 4444', email: 'sarah@sylhn.com', permissions: cashierPerms, active: true },
            ],
          });
          console.log('[db] Default users created: admin/admin123, manager/manager123, cashier/cashier123');
        } catch (seedErr: any) {
          console.error('[db] Auto-seed failed:', seedErr?.message);
        }
      }
    } catch (e: any) {
      // Table doesn't exist — we need to create the schema
      console.log('[db] Tables not found. Creating schema...');
      try {
        // Use Prisma's internal SQL execution to create tables
        // This is the equivalent of `prisma db push` but at runtime
        const { execSync } = await import('child_process');
        try {
          execSync('npx prisma db push --skip-generate --accept-data-loss', {
            stdio: 'pipe',
            cwd: process.cwd(),
            env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
          });
          console.log('[db] Schema created successfully');
        } catch (pushErr: any) {
          console.warn('[db] prisma db push failed, trying direct SQL...');
          // Fallback: create tables manually with raw SQL
          // This is a minimal schema — just enough for auth to work
          await db.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "SystemUser" (
              id TEXT PRIMARY KEY NOT NULL,
              username TEXT NOT NULL UNIQUE,
              password TEXT NOT NULL,
              fullName TEXT NOT NULL,
              role TEXT NOT NULL DEFAULT 'cashier',
              phone TEXT DEFAULT '',
              email TEXT DEFAULT '',
              permissions TEXT DEFAULT '{}',
              active BOOLEAN NOT NULL DEFAULT true,
              lastLogin DATETIME,
              createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
              updatedAt DATETIME NOT NULL
            );
          `);
          await db.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "SystemSetting" (
              id TEXT PRIMARY KEY NOT NULL,
              key TEXT NOT NULL UNIQUE,
              value TEXT NOT NULL,
              updatedAt DATETIME NOT NULL,
              updatedBy TEXT
            );
          `);
          await db.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "AuditLog" (
              id TEXT PRIMARY KEY NOT NULL,
              timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
              userId TEXT,
              user TEXT NOT NULL,
              action TEXT NOT NULL,
              module TEXT NOT NULL,
              details TEXT NOT NULL,
              severity TEXT NOT NULL DEFAULT 'info',
              ipAddress TEXT DEFAULT '',
              userAgent TEXT DEFAULT ''
            );
          `);
          console.log('[db] Basic tables created via raw SQL');
        }
      } catch (sqlErr: any) {
        console.error('[db] Failed to create tables:', sqlErr?.message);
      }
    }
  })().catch((e) => {
    console.error('[db] Initialization error:', e?.message);
  });
}

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
