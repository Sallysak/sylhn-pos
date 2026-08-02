import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { rateLimitApiRead, rateLimitResponse, getClientIp } from "@/lib/rate-limit";
import { db } from "@/lib/db";

// GET /api/reports/employee-performance?days=30
// Per-cashier performance report. For each cashier who made sales in the
// window, returns:
//   - total sales (count + revenue)
//   - average sale value
//   - refund count + refund total
//   - void count + void total
//   - payment method breakdown (cash, MoMo, card)
//   - shift hours (estimated from first → last sale of each day)
//
// Useful for HR, payroll, bonus calculations, and detecting fraud
// (e.g. a cashier with abnormally high void/refund rates).
export async function GET(req: NextRequest) {
  try { await requireAuth(); } catch (e) { return e as Response; }

  const ip = getClientIp(req);
  const rl = rateLimitApiRead(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  try {
    const { searchParams } = new URL(req.url);
    const days = Math.min(Math.max(parseInt(searchParams.get("days") || "30", 10), 1), 365);
    const since = new Date();
    since.setDate(since.getDate() - days);
    since.setHours(0, 0, 0, 0);

    // Fetch all sales in window with cashier info
    const sales = await db.sale.findMany({
      where: { createdAt: { gte: since } },
      select: {
        id: true, total: true, subtotal: true, discount: true,
        paymentMethod: true, status: true, createdAt: true,
        cashierId: true, cashierName: true,
        refundedAt: true, voidedAt: true,
      },
    });

    // Group by cashier
    const cashierMap = new Map<string, {
      cashierId: string;
      cashierName: string;
      totalSales: number;
      totalRevenue: number;
      totalDiscount: number;
      refundCount: number;
      refundTotal: number;
      voidCount: number;
      voidTotal: number;
      paymentBreakdown: Record<string, { count: number; total: number }>;
      firstSaleAt: Date | null;
      lastSaleAt: Date | null;
      salesByDay: Set<string>;
    }>();

    for (const s of sales) {
      const id = s.cashierId || "unknown";
      if (!cashierMap.has(id)) {
        cashierMap.set(id, {
          cashierId: id,
          cashierName: s.cashierName || "Unknown",
          totalSales: 0, totalRevenue: 0, totalDiscount: 0,
          refundCount: 0, refundTotal: 0,
          voidCount: 0, voidTotal: 0,
          paymentBreakdown: {},
          firstSaleAt: null, lastSaleAt: null,
          salesByDay: new Set(),
        });
      }
      const c = cashierMap.get(id)!;
      c.salesByDay.add(s.createdAt.toISOString().split("T")[0]);

      if (s.status === "voided") {
        c.voidCount++;
        c.voidTotal += s.total;
      } else if (s.status === "refunded" || s.refundedAt) {
        c.refundCount++;
        c.refundTotal += s.total;
      } else if (s.status === "completed") {
        c.totalSales++;
        c.totalRevenue += s.total;
        c.totalDiscount += s.discount || 0;
        const method = s.paymentMethod || "cash";
        if (!c.paymentBreakdown[method]) c.paymentBreakdown[method] = { count: 0, total: 0 };
        c.paymentBreakdown[method].count++;
        c.paymentBreakdown[method].total += s.total;
      }

      // Track first/last sale time for shift-hours estimate
      if (!c.firstSaleAt || s.createdAt < c.firstSaleAt) c.firstSaleAt = s.createdAt;
      if (!c.lastSaleAt || s.createdAt > c.lastSaleAt) c.lastSaleAt = s.createdAt;
    }

    // Build the final array + compute derived stats
    const cashiers = Array.from(cashierMap.values()).map(c => {
      const avgSale = c.totalSales > 0 ? c.totalRevenue / c.totalSales : 0;
      const refundRate = c.totalSales > 0 ? (c.refundCount / (c.totalSales + c.refundCount)) * 100 : 0;
      const voidRate = c.totalSales > 0 ? (c.voidCount / (c.totalSales + c.voidCount)) * 100 : 0;
      // Estimate shift hours: last sale - first sale, summed across days
      // This is a rough estimate — assumes 8 hours per day worked
      const shiftHours = c.salesByDay.size * 8;
      const salesPerHour = shiftHours > 0 ? c.totalSales / shiftHours : 0;
      const revenuePerHour = shiftHours > 0 ? c.totalRevenue / shiftHours : 0;

      return {
        ...c,
        avgSale: Math.round(avgSale * 100) / 100,
        refundRate: Math.round(refundRate * 100) / 100,
        voidRate: Math.round(voidRate * 100) / 100,
        daysWorked: c.salesByDay.size,
        shiftHours,
        salesPerHour: Math.round(salesPerHour * 100) / 100,
        revenuePerHour: Math.round(revenuePerHour * 100) / 100,
        firstSaleAt: c.firstSaleAt?.toISOString() || null,
        lastSaleAt: c.lastSaleAt?.toISOString() || null,
      };
    });

    // Sort by total revenue desc
    cashiers.sort((a, b) => b.totalRevenue - a.totalRevenue);

    // Summary
    const summary = {
      totalCashiers: cashiers.length,
      totalSales: cashiers.reduce((s, c) => s + c.totalSales, 0),
      totalRevenue: Math.round(cashiers.reduce((s, c) => s + c.totalRevenue, 0) * 100) / 100,
      totalRefunds: cashiers.reduce((s, c) => s + c.refundCount, 0),
      totalVoids: cashiers.reduce((s, c) => s + c.voidCount, 0),
      avgRefundRate: cashiers.length > 0 ? Math.round((cashiers.reduce((s, c) => s + c.refundRate, 0) / cashiers.length) * 100) / 100 : 0,
      avgVoidRate: cashiers.length > 0 ? Math.round((cashiers.reduce((s, c) => s + c.voidRate, 0) / cashiers.length) * 100) / 100 : 0,
      days,
    };

    return NextResponse.json({ summary, cashiers });
  } catch (e) {
    console.error("GET /api/reports/employee-performance error:", e);
    return NextResponse.json({ error: "Failed to generate employee performance report" }, { status: 500 });
  }
}
