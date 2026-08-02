import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { rateLimitApiRead, rateLimitApiWrite, rateLimitResponse, getClientIp } from "@/lib/rate-limit";
import { auditLog } from "@/lib/audit";
import { trimOldAuditLogs } from "@/lib/data-protection";

// GET /api/admin/data-protection — overview of data protection status
// Shows: PII count, encryption status, audit log size, retention policy
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
    const [customerCount, auditLogCount, oldestAudit, newestAudit, encryptedUsers] = await Promise.all([
      db.customer.count(),
      db.auditLog.count(),
      db.auditLog.findFirst({ orderBy: { timestamp: "asc" }, select: { timestamp: true } }),
      db.auditLog.findFirst({ orderBy: { timestamp: "desc" }, select: { timestamp: true } }),
      db.systemUser.count({ where: { password: { startsWith: "pbkdf2$" } } }),
    ]);

    // Estimate PII data volume
    const customersWithEmail = await db.customer.count({ where: { email: { not: "" } } });
    const customersWithPhone = await db.customer.count({ where: { OR: [{ phone: { not: "" } }, { mobile: { not: "" } }] } });
    const suppliersWithContact = await db.supplier.count({
      where: { OR: [{ phone: { not: "" } }, { email: { not: "" } }, { mobile: { not: "" } }] }
    });

    return NextResponse.json({
      piiInventory: {
        customers: { total: customerCount, withEmail: customersWithEmail, withPhone: customersWithPhone },
        suppliers: { withContactInfo: suppliersWithContact },
      },
      auditLog: {
        total: auditLogCount,
        oldestEntry: oldestAudit?.timestamp?.toISOString() || null,
        newestEntry: newestAudit?.timestamp?.toISOString() || null,
        retentionDays: {
          general: 365,
          financial: 2555, // 7 years (GRA requirement)
        },
      },
      security: {
        usersWithHashedPasswords: encryptedUsers,
        encryptionEnabled: !!(process.env.DATA_ENCRYPTION_KEY || process.env.SESSION_SECRET || process.env.JWT_SECRET),
        csrfProtectionEnabled: true,
        rateLimitingEnabled: true,
      },
    });
  } catch (e: any) {
    console.error("GET /api/admin/data-protection error:", e);
    return NextResponse.json({ error: "Failed to fetch data protection status" }, { status: 500 });
  }
}

// POST /api/admin/data-protection — run maintenance actions
// Body: { action: "trim-audit-logs" }
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

  let body: any;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    let result: any = null;
    let auditDetails = "";

    switch (body.action) {
      case "trim-audit-logs": {
        result = await trimOldAuditLogs({
          generalRetentionDays: body.generalRetentionDays,
          financialRetentionDays: body.financialRetentionDays,
        });
        auditDetails = `Trimmed ${result.trimmed} old audit log entries (general >365d, financial >7y)`;
        break;
      }

      case "vacuum-analyze": {
        // PostgreSQL maintenance — reclaims space + updates planner stats
        // (Only works on Postgres, not SQLite)
        try {
          await db.$executeRawUnsafe("VACUUM ANALYZE;");
          result = { vacuumed: true };
          auditDetails = "Ran VACUUM ANALYZE on database";
        } catch (e: any) {
          // SQLite doesn't support VACUUM ANALYZE — try plain VACUUM
          try {
            await db.$executeRawUnsafe("VACUUM;");
            result = { vacuumed: true };
            auditDetails = "Ran VACUUM on database";
          } catch (e2: any) {
            result = { vacuumed: false, error: e2?.message };
            auditDetails = `VACUUM failed: ${e2?.message}`;
          }
        }
        break;
      }

      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }

    await auditLog({
      userId: user.uid,
      user: user.username,
      action: "DATA_PROTECTION_ACTION",
      module: "admin",
      details: auditDetails,
      severity: "warning",
      ipAddress: ip,
      userAgent: req.headers.get("user-agent") || "",
    });

    return NextResponse.json({ success: true, result });
  } catch (e: any) {
    console.error("POST /api/admin/data-protection error:", e);
    return NextResponse.json({ error: "Action failed", detail: e?.message }, { status: 500 });
  }
}
