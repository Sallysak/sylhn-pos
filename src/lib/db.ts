import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  __prismaWalSetup?: Promise<void>
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    // Only log queries in dev when explicitly enabled via LOG_QUERIES=1
    log: process.env.LOG_QUERIES === '1' ? ['query', 'error', 'warn'] : ['error', 'warn'],
  })

// Enable SQLite WAL mode once per process.
// WAL (Write-Ahead Logging) allows concurrent readers during writes — critical
// for a multi-cashier POS where one terminal writes a sale while another reads
// the product list. Without WAL, writes lock the DB and reads can fail with
// "database is locked" errors.
//
// We run this async (don't await) so it doesn't block app startup. The pragma
// persists across connections (it's a DB-level setting, not connection-level).
// Note: PRAGMA returns a result row in SQLite, so we use $queryRaw (not
// $executeRaw, which fails with "Execute returned results, which is not
// allowed in SQLite").
if (!globalForPrisma.__prismaWalSetup) {
  globalForPrisma.__prismaWalSetup = db.$queryRaw`PRAGMA journal_mode=WAL`
    .then(() => {
      if (process.env.LOG_QUERIES === '1') console.log('[db] SQLite WAL mode enabled')
    })
    .catch((e: any) => {
      console.warn('[db] Failed to enable WAL mode (continuing with default rollback-journal):', e?.message || e)
    })
}

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
