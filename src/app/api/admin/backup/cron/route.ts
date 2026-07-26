import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

// POST /api/admin/backup/cron — automated daily backup (called by external cron)
// Setup: create a cron job at cron-job.org that POSTs to this URL with
// header x-cron-secret matching your CRON_SECRET env var. Schedule: "0 2 * * *"
const BACKUP_VERSION = "2.0";
const RETENTION_DAYS = 30;
const TABLES = [
  "systemSetting", "stockGroup", "location", "register",
  "product", "productSupplier", "supplier",
  "customer", "telephoneDirectoryEntry",
  "sale", "saleItem", "salePayment", "heldOrder", "loyaltyTransaction",
  "purchase", "purchaseItem", "supplierPayment",
  "cashierShift", "expense", "stockHistory",
  "stockTransfer", "stockTransferItem", "locationStock",
  "autoReplenishRule", "recurringPO",
  "stocktake", "stocktakeItem",
];

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret") || new URL(req.url).searchParams.get("secret");
  const expectedSecret = process.env.CRON_SECRET;
  if (!expectedSecret) return NextResponse.json({ error: "CRON_SECRET not set" }, { status: 503 });
  if (secret !== expectedSecret) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const now = new Date();
    const dateStr = now.toISOString().split("T")[0];
    const dump: Record<string, any[]> = {};
    for (const table of TABLES) {
      try {
        
        dump[table] = await db[table].findMany({ take: 100000 });
      } catch {
        dump[table] = [];
      }
    }
    if (dump.systemUser) {
      dump.systemUser = dump.systemUser.map(({ password, ...safe }: any) => safe);
    }
    const backupData = JSON.stringify({ version: BACKUP_VERSION, createdAt: now.toISOString(), data: dump });
    const sizeBytes = Buffer.byteLength(backupData, "utf-8");
    const recordCount = Object.values(dump).reduce((s: number, v: any[]) => s + v.length, 0);

    const backup = await db.backupRecord.create({
      data: {
        filename: `auto-backup-${dateStr}.json`,
        sizeBytes,
        type: "auto",
        status: "completed",
        notes: `v${BACKUP_VERSION} · ${recordCount} records · ${TABLES.length} tables`,
      },
    });

    // Retention: delete auto-backups older than 30 days
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);
    const deleted = await db.backupRecord.deleteMany({
      where: { createdAt: { lt: cutoff }, type: "auto" },
    });

    logger.info("Auto-backup completed", { backupId: backup.id, sizeBytes, retentionDeleted: deleted.count });

    return NextResponse.json({
      success: true,
      backup: { id: backup.id, filename: backup.filename, sizeBytes },
      retention: { deleted: deleted.count, cutoff: cutoff.toISOString() },
    });
  } catch (e: any) {
    logger.error("Auto-backup failed", { error: e?.message });
    return NextResponse.json({ error: "Backup failed", detail: e?.message }, { status: 500 });
  }
}
