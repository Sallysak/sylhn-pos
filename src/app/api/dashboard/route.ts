import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { rateLimitApiRead, rateLimitResponse, getClientIp } from "@/lib/rate-limit";
import {
  getSalesSummary,
  getTopProducts,
  getLowStockReorder,
  getExpiryTracking,
  getHourlySales,
  getDailyTrend,
  getInventorySnapshot,
  getSupplierAging,
} from "@/lib/reports";
import { db, waitForDb } from "@/lib/db";

// GET /api/dashboard — single endpoint returning all KPIs for the dashboard
// Premium feature: one round-trip gets the operations dashboard everything
// it needs (sales, top products, low stock, expiry, hourly, trend, inventory).
export async function GET(req: NextRequest) {
  try { await requireAuth(); } catch (e) { return e as Response; }
  await waitForDb();

  const ip = getClientIp(req);
  const rl = rateLimitApiRead(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  try {
    const [
      salesSummary,
      topProducts,
      lowStock,
      expiry,
      hourly,
      dailyTrend,
      inventory,
      supplierAging,
      openShifts,
      recentAlerts,
    ] = await Promise.all([
      getSalesSummary(),
      getTopProducts(30, 10),
      getLowStockReorder(),
      getExpiryTracking(),
      getHourlySales(),
      getDailyTrend(14),
      getInventorySnapshot(),
      getSupplierAging(),
      db.cashierShift.findMany({
        where: { status: "open" },
        include: { _count: { select: { sales: true, heldOrders: true } } },
      }),
      db.auditLog.findMany({
        take: 10,
        orderBy: { timestamp: "desc" },
        select: { id: true, action: true, module: true, details: true, severity: true, timestamp: true, user: true },
      }),
    ]);

    return NextResponse.json({
      salesSummary,
      topProducts,
      lowStock,
      expiry,
      hourly,
      dailyTrend,
      inventory,
      supplierAging,
      openShifts,
      recentAlerts,
      generatedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error("GET /api/dashboard error:", e);
    return NextResponse.json({ error: "Failed to fetch dashboard data" }, { status: 500 });
  }
}
