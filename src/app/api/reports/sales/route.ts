import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { rateLimitApiRead, rateLimitResponse, getClientIp } from "@/lib/rate-limit";
import { getSalesSummary, getDailyTrend, getHourlySales, getTopProducts } from "@/lib/reports";
import { db } from "@/lib/db";

// GET /api/reports/sales — sales report (today, trend, hourly, top products)
export async function GET(req: NextRequest) {
  try { await requireAuth(); } catch (e) { return e as Response; }

  const ip = getClientIp(req);
  const rl = rateLimitApiRead(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  try {
    const { searchParams } = new URL(req.url);
    const days = parseInt(searchParams.get("days") || "30", 10);

    const [summary, dailyTrend, hourly, topProducts, paymentBreakdown] = await Promise.all([
      getSalesSummary(),
      getDailyTrend(days),
      getHourlySales(),
      getTopProducts(days, 20),
      db.sale.groupBy({
        where: { status: "completed" },
        by: ["paymentMethod"],
        _sum: { total: true },
        _count: true,
      }),
    ]);

    return NextResponse.json({
      summary,
      dailyTrend,
      hourly,
      topProducts,
      paymentBreakdown,
      generatedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error("GET /api/reports/sales error:", e);
    return NextResponse.json({ error: "Failed to generate sales report" }, { status: 500 });
  }
}
