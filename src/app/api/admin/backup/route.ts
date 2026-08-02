import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { rateLimitApiRead, rateLimitApiWrite, rateLimitResponse, getClientIp } from "@/lib/rate-limit";
import { auditLog } from "@/lib/audit";

// ===== Database Backup / Restore API =====
//
// GET  /api/admin/backup         — download a JSON dump of all business data
// POST /api/admin/backup         — restore from a JSON dump (multipart/form-data or raw JSON)
//
// Backup format: a single JSON object with all tables, schema version, and metadata.
// Sensitive fields (user passwords) are EXCLUDED — restore re-uses existing user accounts.
//
// Access: admin only.

const BACKUP_VERSION = "1.0";

// Tables to include in backup, in dependency-safe order
const TABLES = [
  // Reference data
  "systemSetting",
  "stockGroup",
  "location",
  "register",
  // Catalog
  "product",
  "productSupplier",
  "supplier",
  // Customers
  "customer",
  "telephoneDirectoryEntry",
  // Sales (with line items)
  "sale",
  "saleItem",
  "salePayment",
  "heldOrder",
  "loyaltyTransaction",
  // Purchases
  "purchase",
  "purchaseItem",
  "supplierPayment",
  // Stock operations
  "stockHistory",
  "stocktake",
  "stocktakeItem",
  "stockTransfer",
  "stockTransferItem",
  "locationStock",
  // Auto-replenish + forecasting
  "autoReplenishRule",
  "recurringPO",
  "forecastSnapshot",
  // Finance
  "expense",
  "cashierShift",
  // Audit + email logs
  "auditLog",
  "emailLog",
  "backupRecord",
];

// ===== GET: download backup =====
export async function GET(req: NextRequest) {
  let user;
  try {
    user = await requireAuth();
    if (user.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }
  } catch (e) { return e as Response; }

  const ip = getClientIp(req);
  const rl = rateLimitApiRead(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  try {
    const dump: Record<string, any[]> = {};
    let totalRecords = 0;

    for (const table of TABLES) {
      try {
        const records = await (db as any)[table].findMany({ take: 50000 });
        dump[table] = records;
        totalRecords += records.length;
      } catch (e: any) {
        console.warn(`[backup] could not dump ${table}:`, e?.message);
        dump[table] = [];
      }
    }

    // Strip password hashes — never include in backups
    if (dump.systemUser) {
      dump.systemUser = dump.systemUser.map((u: any) => ({
        ...u,
        password: "[REDACTED]",
      }));
    }

    const backup = {
      version: BACKUP_VERSION,
      app: "SYLHN POS",
      exportedAt: new Date().toISOString(),
      exportedBy: user.username,
      totalRecords,
      tableCount: TABLES.length,
      data: dump,
    };

    await auditLog({
      userId: user.uid,
      user: user.username,
      action: "BACKUP_DOWNLOAD",
      module: "admin",
      details: `Admin ${user.username} downloaded database backup — ${totalRecords} records across ${TABLES.length} tables`,
      severity: "warning",
      ipAddress: ip,
      userAgent: req.headers.get("user-agent") || "",
    });

    const filename = `sylhn-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    return new NextResponse(JSON.stringify(backup, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (e: any) {
    console.error("GET /api/admin/backup error:", e);
    return NextResponse.json({ error: "Backup failed", detail: e?.message }, { status: 500 });
  }
}

// ===== POST: restore from backup =====
export async function POST(req: NextRequest) {
  let user;
  try {
    user = await requireAuth();
    if (user.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }
  } catch (e) { return e as Response; }

  const ip = getClientIp(req);
  const rl = rateLimitApiWrite(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  try {
    const body = await req.json();
    if (!body || !body.data || body.version !== BACKUP_VERSION) {
      return NextResponse.json({
        error: "Invalid backup file",
        hint: `Expected version ${BACKUP_VERSION} JSON with a 'data' field`,
      }, { status: 400 });
    }

    const dump: Record<string, any[]> = body.data;
    const restored: Record<string, number> = {};
    const errors: string[] = [];

    // Restore in dependency order (reverse of TABLES to handle children first)
    // Actually we restore in TOP-DOWN order because parents need to exist first.
    for (const table of TABLES) {
      const records = dump[table];
      if (!Array.isArray(records) || records.length === 0) {
        restored[table] = 0;
        continue;
      }
      try {
        // Use createMany for bulk insert (skip duplicates with skipDuplicates)
        // Note: this won't update existing records — it's a clean restore.
        // For an existing DB, recommend wiping first (POST /api/admin/wipe-data)
        const result = await (db as any)[table].createMany({
          data: records.map((r: any) => {
            // Strip password field if present (restore reuses existing users)
            if (table === "systemUser") return { ...r, password: undefined };
            return r;
          }).filter((r: any) => r.id), // require id field
          skipDuplicates: true,
        });
        restored[table] = result.count;
      } catch (e: any) {
        const errMsg = `${table}: ${e?.message || "unknown"}`;
        errors.push(errMsg);
        restored[table] = 0;
      }
    }

    const totalRestored = Object.values(restored).reduce((s, n) => s + n, 0);

    await auditLog({
      userId: user.uid,
      user: user.username,
      action: "BACKUP_RESTORE",
      module: "admin",
      details: `Admin ${user.username} restored database backup — ${totalRestored} records across ${TABLES.length} tables. Errors: ${errors.length}`,
      severity: "critical",
      ipAddress: ip,
      userAgent: req.headers.get("user-agent") || "",
    });

    return NextResponse.json({
      success: true,
      restored,
      totalRestored,
      errorCount: errors.length,
      errors: errors.slice(0, 10),
    });
  } catch (e: any) {
    console.error("POST /api/admin/backup error:", e);
    return NextResponse.json({ error: "Restore failed", detail: e?.message }, { status: 500 });
  }
}
