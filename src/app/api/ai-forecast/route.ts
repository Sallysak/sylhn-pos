import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { rateLimitApiRead, rateLimitResponse, getClientIp } from "@/lib/rate-limit";
import { auditLog } from "@/lib/audit";
import ZAI from "z-ai-web-dev-sdk";

export const runtime = "nodejs";
export const maxDuration = 60;

// GET /api/ai-forecast?days=30
// Premium: AI-powered demand forecasting.
//
// Analyzes the last 90 days of sales history to compute:
//   - Average daily sales velocity per product (units/day)
//   - Trend (increasing / decreasing / stable)
//   - Projected stockout date
//   - Recommended reorder quantity
//
// Then calls the LLM to generate a natural-language summary + actionable
// recommendations for the store owner.
export async function GET(req: NextRequest) {
  try { await requireAuth(); } catch (e) { return e as Response; }

  const ip = getClientIp(req);
  const rl = rateLimitApiRead(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  try {
    const { searchParams } = new URL(req.url);
    const forecastDays = parseInt(searchParams.get("days") || "30", 10);

    // Fetch last 90 days of sales items
    const since = new Date();
    since.setDate(since.getDate() - 90);

    const saleItems = await db.saleItem.findMany({
      where: { sale: { status: "completed", createdAt: { gte: since } } },
      select: {
        productId: true, sku: true, name: true, emoji: true,
        quantity: true, total: true, costPrice: true,
        sale: { select: { createdAt: true } },
      },
    });

    const products = await db.product.findMany({
      where: { active: true },
      select: { id: true, sku: true, name: true, emoji: true, quantity: true, reorderLevel: true, costPrice: true, price: true, unit: true, category: true },
    });

    // ===== Compute per-product forecasts =====
    const now = Date.now();
    const DAY_MS = 1000 * 60 * 60 * 24;
    const daysOfData = 90;

    const forecasts = products.map(p => {
      const items = saleItems.filter(i => i.productId === p.id);
      const totalQtySold = items.reduce((s, i) => s + i.quantity, 0);
      const avgDailyVelocity = totalQtySold / daysOfData;

      // Trend: compare last 30 days vs previous 60 days
      const last30 = items.filter(i => new Date(i.sale.createdAt).getTime() > now - 30 * DAY_MS);
      const prev60 = items.filter(i => new Date(i.sale.createdAt).getTime() <= now - 30 * DAY_MS && new Date(i.sale.createdAt).getTime() > now - 90 * DAY_MS);
      const last30Qty = last30.reduce((s, i) => s + i.quantity, 0);
      const prev60Qty = prev60.reduce((s, i) => s + i.quantity, 0);
      const last30Daily = last30Qty / 30;
      const prev60Daily = prev60Qty / 60;

      let trend: "increasing" | "decreasing" | "stable" | "new";
      let trendPct = 0;
      if (totalQtySold === 0) {
        trend = "new";
      } else if (prev60Daily === 0) {
        trend = last30Daily > 0 ? "increasing" : "stable";
      } else {
        trendPct = ((last30Daily - prev60Daily) / prev60Daily) * 100;
        if (Math.abs(trendPct) < 10) trend = "stable";
        else if (trendPct > 0) trend = "increasing";
        else trend = "decreasing";
      }

      // Projected stockout date
      const projectedStockoutDays = avgDailyVelocity > 0 ? Math.floor(p.quantity / avgDailyVelocity) : null;
      const stockoutDate = projectedStockoutDays !== null ? new Date(now + projectedStockoutDays * DAY_MS).toISOString().split("T")[0] : null;

      // Recommended reorder qty (cover forecast period + buffer)
      const projectedDemand = Math.ceil(avgDailyVelocity * forecastDays);
      const buffer = Math.max(p.reorderLevel, projectedDemand * 0.2);
      const recommendedReorderQty = Math.max(0, Math.ceil(projectedDemand + buffer - p.quantity));

      // Urgency
      let urgency: "critical" | "high" | "medium" | "low";
      if (projectedStockoutDays !== null && projectedStockoutDays <= 3) urgency = "critical";
      else if (projectedStockoutDays !== null && projectedStockoutDays <= 7) urgency = "high";
      else if (p.quantity <= p.reorderLevel) urgency = "high";
      else if (recommendedReorderQty > 0) urgency = "medium";
      else urgency = "low";

      // Revenue projection
      const projectedRevenue = projectedDemand * p.price;
      const projectedProfit = projectedDemand * (p.price - p.costPrice);

      return {
        productId: p.id,
        sku: p.sku,
        name: p.name,
        emoji: p.emoji,
        category: p.category,
        unit: p.unit,
        currentStock: p.quantity,
        reorderLevel: p.reorderLevel,
        costPrice: p.costPrice,
        sellingPrice: p.price,
        // Stats
        totalSold90d: totalQtySold,
        avgDailyVelocity: Math.round(avgDailyVelocity * 100) / 100,
        trend,
        trendPct: Math.round(trendPct * 10) / 10,
        // Forecast
        projectedDemand: projectedDemand,
        projectedStockoutDays,
        stockoutDate,
        recommendedReorderQty,
        urgency,
        projectedRevenue: Math.round(projectedRevenue * 100) / 100,
        projectedProfit: Math.round(projectedProfit * 100) / 100,
      };
    });

    // Sort by urgency (critical first), then by stockout date (soonest first)
    const urgencyOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    const sorted = forecasts.sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency] || (a.projectedStockoutDays || 999) - (b.projectedStockoutDays || 999));

    // Summary
    const summary = {
      totalProducts: forecasts.length,
      criticalCount: forecasts.filter(f => f.urgency === "critical").length,
      highCount: forecasts.filter(f => f.urgency === "high").length,
      mediumCount: forecasts.filter(f => f.urgency === "medium").length,
      lowCount: forecasts.filter(f => f.urgency === "low").length,
      totalRecommendedReorderQty: forecasts.reduce((s, f) => s + f.recommendedReorderQty, 0),
      totalReorderCost: forecasts.reduce((s, f) => s + (f.recommendedReorderQty * f.costPrice), 0),
      totalProjectedRevenue: forecasts.reduce((s, f) => s + f.projectedRevenue, 0),
      totalProjectedProfit: forecasts.reduce((s, f) => s + f.projectedProfit, 0),
      forecastDays,
    };

    // ===== Call LLM for natural-language summary =====
    let aiSummary = "";
    try {
      const topUrgent = sorted.filter(f => f.urgency === "critical" || f.urgency === "high").slice(0, 10);
      const zai = await ZAI.create();
      const completion = await zai.chat.completions.create({
        messages: [
          {
            role: "assistant",
            content: `You are SYLHN AI, a demand forecasting assistant for a grocery store in Ghana. Analyze the forecast data and write a concise, actionable summary for the store owner. Use GHS for money. Highlight: (1) which products need immediate reordering, (2) which are trending up (stock more), (3) which are trending down (stock less), (4) overall projected revenue for the next ${forecastDays} days. Be practical and specific — name products. Keep it under 200 words.`,
          },
          {
            role: "user",
            content: `Forecast for next ${forecastDays} days:\n\nSummary: ${JSON.stringify(summary)}\n\nTop urgent products:\n${JSON.stringify(topUrgent, null, 2)}\n\nAll products with velocity > 0:\n${JSON.stringify(forecasts.filter(f => f.avgDailyVelocity > 0).slice(0, 20), null, 2)}`,
          },
        ],
        thinking: { type: "disabled" },
      });
      aiSummary = completion.choices[0]?.message?.content || "";
    } catch (e) {
      console.warn("LLM summary failed:", e);
      aiSummary = "AI summary unavailable. See the data below for forecast details.";
    }

    await auditLog({
      userId: "",
      user: "system",
      action: "AI_FORECAST",
      module: "dashboard",
      details: `Demand forecast generated for ${forecastDays} days — ${summary.criticalCount} critical, ${summary.highCount} high priority, total reorder cost GHS ${summary.totalReorderCost.toFixed(2)}`,
      severity: "info",
      ipAddress: ip,
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      forecastDays,
      summary,
      aiSummary,
      forecasts: sorted,
      generatedAt: new Date().toISOString(),
    });
  } catch (e: any) {
    console.error("GET /api/ai-forecast error:", e);
    return NextResponse.json({ error: "Failed to generate forecast" }, { status: 500 });
  }
}
