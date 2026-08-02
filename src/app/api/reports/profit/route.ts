import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { rateLimitApiRead, rateLimitResponse, getClientIp } from "@/lib/rate-limit";
import { db } from "@/lib/db";

// GET /api/reports/profit — profit analytics (daily profit trend, margin by product, profit by category)
export async function GET(req: NextRequest) {
  try { await requireAuth(); } catch (e) { return e as Response; }

  const ip = getClientIp(req);
  const rl = rateLimitApiRead(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  try {
    const { searchParams } = new URL(req.url);
    const days = parseInt(searchParams.get("days") || "30", 10);
    const since = new Date();
    since.setDate(since.getDate() - days);
    since.setHours(0, 0, 0, 0);

    const [dailySales, topProfitProducts, categoryProfit, summary] = await Promise.all([
      // Daily profit trend
      db.sale.findMany({
        where: { status: "completed", createdAt: { gte: since } },
        select: { total: true, costOfGoods: true, grossProfit: true, createdAt: true },
      }),
      // Top profit products
      db.saleItem.findMany({
        where: { sale: { status: "completed", createdAt: { gte: since } } },
        select: { sku: true, name: true, emoji: true, quantity: true, total: true, costPrice: true, product: { select: { category: true } } },
      }),
      // Category lookup
      db.product.findMany({ select: { sku: true, category: true } }),
      // Summary
      db.sale.aggregate({
        where: { status: "completed", createdAt: { gte: since } },
        _sum: { total: true, costOfGoods: true, grossProfit: true },
        _count: true,
      }),
    ]);

    // Build daily trend
    const dailyTrend: Record<string, { revenue: number; cost: number; profit: number; count: number }> = {};
    for (let i = 0; i < days; i++) {
      const d = new Date(since);
      d.setDate(d.getDate() + i);
      const key = d.toISOString().split("T")[0];
      dailyTrend[key] = { revenue: 0, cost: 0, profit: 0, count: 0 };
    }
    for (const s of dailySales) {
      const key = s.createdAt.toISOString().split("T")[0];
      if (dailyTrend[key]) {
        dailyTrend[key].revenue += s.total;
        dailyTrend[key].cost += s.costOfGoods || 0;
        dailyTrend[key].profit += s.grossProfit || 0;
        dailyTrend[key].count += 1;
      }
    }

    // Profit by product
    const productProfit: Record<string, { name: string; emoji: string; category: string; qty: number; revenue: number; cost: number; profit: number; margin: number }> = {};
    const categoryMap: Record<string, string> = {};
    for (const p of categoryProfit) categoryMap[p.sku] = p.category;
    for (const item of topProfitProducts) {
      const key = item.sku;
      const cat = item.product?.category || categoryMap[item.sku] || "other";
      if (!productProfit[key]) {
        productProfit[key] = { name: item.name, emoji: item.emoji || "📦", category: cat, qty: 0, revenue: 0, cost: 0, profit: 0, margin: 0 };
      }
      productProfit[key].qty += item.quantity;
      productProfit[key].revenue += item.total;
      productProfit[key].cost += (item.costPrice || 0) * item.quantity;
    }
    for (const k of Object.keys(productProfit)) {
      productProfit[k].profit = productProfit[k].revenue - productProfit[k].cost;
      productProfit[k].margin = productProfit[k].revenue > 0 ? (productProfit[k].profit / productProfit[k].revenue) * 100 : 0;
    }
    const topProfit = Object.values(productProfit).sort((a, b) => b.profit - a.profit).slice(0, 20);

    // Profit by category
    const catAgg: Record<string, { revenue: number; cost: number; profit: number; count: number }> = {};
    for (const p of Object.values(productProfit)) {
      if (!catAgg[p.category]) catAgg[p.category] = { revenue: 0, cost: 0, profit: 0, count: 0 };
      catAgg[p.category].revenue += p.revenue;
      catAgg[p.category].cost += p.cost;
      catAgg[p.category].profit += p.profit;
      catAgg[p.category].count += 1;
    }

    return NextResponse.json({
      period: { days, since: since.toISOString(), until: new Date().toISOString() },
      summary: {
        totalRevenue: summary._sum.total || 0,
        totalCost: summary._sum.costOfGoods || 0,
        totalProfit: summary._sum.grossProfit || 0,
        transactionCount: summary._count,
        avgMargin: (summary._sum.total || 0) > 0 ? ((summary._sum.grossProfit || 0) / (summary._sum.total || 1)) * 100 : 0,
      },
      dailyTrend: Object.entries(dailyTrend).map(([date, v]) => ({ date, ...v })),
      topProfitProducts: topProfit,
      profitByCategory: Object.entries(catAgg).map(([category, v]) => ({ category, ...v, margin: v.revenue > 0 ? (v.profit / v.revenue) * 100 : 0 })),
      generatedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error("GET /api/reports/profit error:", e);
    return NextResponse.json({ error: "Failed to generate profit report" }, { status: 500 });
  }
}
