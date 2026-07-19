import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requireRole } from "@/lib/auth";
import { rateLimitApiRead, rateLimitResponse, getClientIp } from "@/lib/rate-limit";

// GET /api/system-health — admin/manager only dashboard
export async function GET(req: NextRequest) {
  try { await requireRole("admin", "manager"); } catch (e) { return e as Response; }
  const ip = getClientIp(req);
  const rl = rateLimitApiRead(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  try {
    const [productCount, saleCount, userCount, auditCount, backupCount, openShifts, lastBackup] = await Promise.all([
      db.product.count(),
      db.sale.count(),
      db.systemUser.count({ where: { active: true } }),
      db.auditLog.count(),
      db.backupRecord.count(),
      db.cashierShift.count({ where: { status: "open" } }),
      db.backupRecord.findFirst({ orderBy: { createdAt: "desc" } }),
    ]);

    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const [todaySales, todayErrors, todayRevenue] = await Promise.all([
      db.sale.count({ where: { createdAt: { gte: todayStart } } }),
      db.auditLog.count({ where: { severity: "critical", timestamp: { gte: todayStart } } }),
      db.sale.aggregate({ where: { status: "completed", createdAt: { gte: todayStart } }, _sum: { total: true } }),
    ]);

    return NextResponse.json({
      database: { products: productCount, sales: saleCount, users: userCount, auditLogs: auditCount, backups: backupCount },
      today: { sales: todaySales, revenue: todayRevenue._sum.total || 0, errors: todayErrors },
      shifts: { open: openShifts },
      lastBackup: lastBackup ? { filename: lastBackup.filename, createdAt: lastBackup.createdAt, sizeBytes: lastBackup.sizeBytes } : null,
      uptime: process.uptime(),
      memory: process.memoryUsage ? { rss: Math.round(process.memoryUsage().rss / 1024 / 1024) + " MB" } : null,
      generatedAt: new Date().toISOString(),
    });
  } catch (e) {
    return NextResponse.json({ error: "Failed to get system health" }, { status: 500 });
  }
}
