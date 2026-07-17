import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { rateLimitApiRead, rateLimitResponse, getClientIp } from "@/lib/rate-limit";
import { auditLog } from "@/lib/audit";
import ZAI from "z-ai-web-dev-sdk";

export const runtime = "nodejs";
export const maxDuration = 60;

const DAY_MS = 1000 * 60 * 60 * 24;
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAY_ABBR = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// GET /api/ai-forecast?days=30&save=true
//
// Premium: AI-powered demand forecasting with day-of-week seasonality.
//
// Algorithm:
// 1. Fetch last 90 days of sale items per product
// 2. Compute day-of-week velocity (how many units sell on each day of the week)
// 3. Compute seasonality multipliers (e.g. Saturday = 1.8x average day)
// 4. Project forward day-by-day using seasonality-adjusted velocity
// 5. Compute confidence score based on:
//    - Data volume (more sales data = higher confidence)
//    - Consistency (low variance = higher confidence)
//    - Trend stability (stable trend = higher confidence)
// 6. Save snapshot for accuracy tracking (if save=true)
// 7. Call LLM for natural-language summary
export async function GET(req: NextRequest) {
  try { await requireAuth(); } catch (e) { return e as Response; }

  const ip = getClientIp(req);
  const rl = rateLimitApiRead(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  try {
    const { searchParams } = new URL(req.url);
    const forecastDays = Math.min(Math.max(parseInt(searchParams.get("days") || "30", 10), 7), 90);
    const saveSnapshot = searchParams.get("save") === "true";

    // Fetch last 90 days of sales items with timestamps
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
      select: {
        id: true, sku: true, name: true, emoji: true,
        quantity: true, reorderLevel: true, costPrice: true, price: true,
        unit: true, category: true,
        suppliers: { where: { preferred: true }, include: { supplier: { select: { id: true, name: true, code: true } } }, take: 1 },
      },
    });

    // ===== Per-product forecasting =====
    const now = Date.now();
    const forecasts = products.map(p => {
      const items = saleItems.filter(i => i.productId === p.id);

      // --- 1. Basic velocity ---
      const totalQtySold = items.reduce((s, i) => s + i.quantity, 0);
      const daysOfData = 90;
      const avgDailyVelocity = totalQtySold / daysOfData;

      // --- 2. Day-of-week seasonality ---
      // Count how many units sold on each day of the week
      const dowBuckets = [0, 0, 0, 0, 0, 0, 0]; // Sun=0, Mon=1, ..., Sat=6
      const dowSaleDays = [0, 0, 0, 0, 0, 0, 0]; // how many of each day occurred in our data
      for (const item of items) {
        const dow = new Date(item.sale.createdAt).getDay();
        dowBuckets[dow] += item.quantity;
      }
      // Count how many of each day of week occurred in last 90 days
      for (let d = 0; d < 90; d++) {
        const date = new Date(now - (90 - d) * DAY_MS);
        dowSaleDays[date.getDay()]++;
      }
      // Compute per-day-of-week velocity
      const dowVelocity = dowBuckets.map((qty, dow) =>
        dowSaleDays[dow] > 0 ? qty / dowSaleDays[dow] : 0
      );
      // Compute seasonality multipliers (relative to average day)
      const seasonality = dowVelocity.map(v =>
        avgDailyVelocity > 0 ? Math.round((v / avgDailyVelocity) * 100) / 100 : 1
      );
      // Find peak day
      let peakDayIdx = 0;
      for (let i = 1; i < 7; i++) if (dowVelocity[i] > dowVelocity[peakDayIdx]) peakDayIdx = i;
      const peakDay = DAY_NAMES[peakDayIdx];
      const peakMultiplier = seasonality[peakDayIdx];

      // --- 3. Trend analysis (last 30d vs previous 60d) ---
      const last30 = items.filter(i => new Date(i.sale.createdAt).getTime() > now - 30 * DAY_MS);
      const prev60 = items.filter(i => {
        const t = new Date(i.sale.createdAt).getTime();
        return t <= now - 30 * DAY_MS && t > now - 90 * DAY_MS;
      });
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

      // --- 4. Seasonality-adjusted demand projection ---
      // Walk forward day-by-day, using the day-of-week velocity for each future day
      let projectedDemand = 0;
      let remainingStock = p.quantity;
      let projectedStockoutDay: number | null = null;
      const dailyProjections: { day: string; date: string; demand: number; stockAfter: number }[] = [];

      for (let d = 0; d < forecastDays; d++) {
        const futureDate = new Date(now + (d + 1) * DAY_MS);
        const dow = futureDate.getDay();
        // Apply trend adjustment to the day-of-week velocity
        const trendMultiplier = trend === "increasing" ? 1 + (trendPct / 100) * 0.5
                              : trend === "decreasing" ? 1 + (trendPct / 100) * 0.5
                              : 1;
        const dayDemand = dowVelocity[dow] * trendMultiplier;
        projectedDemand += dayDemand;
        remainingStock -= dayDemand;
        if (projectedStockoutDay === null && remainingStock <= 0) {
          projectedStockoutDay = d + 1;
        }
        if (d < 14) { // store first 14 days for the chart
          dailyProjections.push({
            day: DAY_ABBR[dow],
            date: futureDate.toISOString().split("T")[0],
            demand: Math.round(dayDemand * 100) / 100,
            stockAfter: Math.max(0, Math.round(remainingStock * 100) / 100),
          });
        }
      }
      projectedDemand = Math.round(projectedDemand);

      // --- 5. Stockout projection ---
      const projectedStockoutDate = projectedStockoutDay !== null
        ? new Date(now + projectedStockoutDay * DAY_MS).toISOString().split("T")[0]
        : null;

      // --- 6. Recommended reorder ---
      const buffer = Math.max(p.reorderLevel, projectedDemand * 0.2);
      const recommendedReorderQty = Math.max(0, Math.ceil(projectedDemand + buffer - p.quantity));

      // --- 7. Urgency ---
      let urgency: "critical" | "high" | "medium" | "low";
      if (projectedStockoutDay !== null && projectedStockoutDay <= 3) urgency = "critical";
      else if (projectedStockoutDay !== null && projectedStockoutDay <= 7) urgency = "high";
      else if (p.quantity <= p.reorderLevel) urgency = "high";
      else if (recommendedReorderQty > 0) urgency = "medium";
      else urgency = "low";

      // --- 8. Confidence score ---
      // Factors:
      //   - Data volume: more total sales = higher confidence (capped at 0.4)
      //   - Consistency: lower coefficient of variation = higher confidence (up to 0.3)
      //   - Recency: more recent sales data = higher confidence (up to 0.2)
      //   - Trend stability: stable trend = higher confidence (up to 0.1)
      let confidence = 0.2; // baseline

      // Data volume factor
      if (totalQtySold >= 50) confidence += 0.4;
      else if (totalQtySold >= 20) confidence += 0.3;
      else if (totalQtySold >= 10) confidence += 0.2;
      else if (totalQtySold >= 5) confidence += 0.1;

      // Consistency factor (coefficient of variation across day-of-week buckets)
      if (totalQtySold > 0) {
        const meanDow = dowBuckets.reduce((s, x) => s + x, 0) / 7;
        if (meanDow > 0) {
          const variance = dowBuckets.reduce((s, x) => s + Math.pow(x - meanDow, 2), 0) / 7;
          const stdDev = Math.sqrt(variance);
          const cv = stdDev / meanDow; // coefficient of variation
          // Lower CV = more consistent = higher confidence
          if (cv < 0.5) confidence += 0.3;
          else if (cv < 1.0) confidence += 0.2;
          else if (cv < 1.5) confidence += 0.1;
        }
      }

      // Recency factor
      if (last30Qty > 0) confidence += 0.2;
      else if (prev60Qty > 0) confidence += 0.1;

      // Trend stability
      if (trend === "stable") confidence += 0.1;
      else if (trend === "new") confidence = Math.min(confidence, 0.3); // low confidence for new products

      confidence = Math.min(1, Math.round(confidence * 100) / 100);

      // Revenue + profit projection
      const projectedRevenue = Math.round(projectedDemand * p.price * 100) / 100;
      const projectedProfit = Math.round(projectedDemand * (p.price - p.costPrice) * 100) / 100;

      // Preferred supplier info
      const preferredSupplier = p.suppliers[0]?.supplier || null;

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
        // Seasonality
        seasonality: {
          multipliers: seasonality,
          dowVelocity: dowVelocity.map(v => Math.round(v * 100) / 100),
          peakDay,
          peakMultiplier,
          chart: DAY_ABBR.map((day, i) => ({ day, velocity: Math.round(dowVelocity[i] * 100) / 100, multiplier: seasonality[i] })),
        },
        // Forecast
        projectedDemand,
        projectedStockoutDays: projectedStockoutDay,
        projectedStockoutDate,
        recommendedReorderQty,
        urgency,
        confidenceScore: confidence,
        projectedRevenue,
        projectedProfit,
        reorderCost: Math.round(recommendedReorderQty * p.costPrice * 100) / 100,
        // Supplier
        preferredSupplierId: preferredSupplier?.id || null,
        preferredSupplierName: preferredSupplier?.name || null,
        preferredSupplierCode: preferredSupplier?.code || null,
        // Chart data (first 14 days)
        dailyProjections,
      };
    });

    // Sort by urgency (critical first), then by stockout date (soonest first)
    const urgencyOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    const sorted = forecasts.sort((a, b) =>
      urgencyOrder[a.urgency] - urgencyOrder[b.urgency] ||
      (a.projectedStockoutDays || 999) - (b.projectedStockoutDays || 999)
    );

    // Summary
    const summary = {
      totalProducts: forecasts.length,
      criticalCount: forecasts.filter(f => f.urgency === "critical").length,
      highCount: forecasts.filter(f => f.urgency === "high").length,
      mediumCount: forecasts.filter(f => f.urgency === "medium").length,
      lowCount: forecasts.filter(f => f.urgency === "low").length,
      totalRecommendedReorderQty: forecasts.reduce((s, f) => s + f.recommendedReorderQty, 0),
      totalReorderCost: Math.round(forecasts.reduce((s, f) => s + f.reorderCost, 0) * 100) / 100,
      totalProjectedRevenue: Math.round(forecasts.reduce((s, f) => s + f.projectedRevenue, 0) * 100) / 100,
      totalProjectedProfit: Math.round(forecasts.reduce((s, f) => s + f.projectedProfit, 0) * 100) / 100,
      avgConfidence: Math.round((forecasts.reduce((s, f) => s + f.confidenceScore, 0) / forecasts.length) * 100) / 100,
      forecastDays,
      dataPointsAnalyzed: saleItems.length,
    };

    // ===== Save snapshots for accuracy tracking =====
    if (saveSnapshot) {
      try {
        await db.forecastSnapshot.createMany({
          data: forecasts.map(f => ({
            productId: f.productId,
            forecastDate: new Date(),
            forecastDays,
            predictedDemand: f.projectedDemand,
            projectedStockoutDate: f.projectedStockoutDate ? new Date(f.projectedStockoutDate) : null,
            avgDailyVelocity: f.avgDailyVelocity,
            trend: f.trend,
            urgency: f.urgency,
            recommendedReorderQty: f.recommendedReorderQty,
            confidenceScore: f.confidenceScore,
            seasonality: JSON.stringify(f.seasonality.multipliers),
          })),
        });
      } catch (e) {
        console.warn("Failed to save forecast snapshots:", e);
      }
    }

    // ===== Evaluate past forecast accuracy =====
    // Find forecasts from >30 days ago that haven't been evaluated
    const unevaluated = await db.forecastSnapshot.findMany({
      where: {
        evaluatedAt: null,
        forecastDate: { lte: new Date(now - 30 * DAY_MS) },
        forecastDays: 30,
      },
      take: 50,
    });

    let evaluatedCount = 0;
    for (const snap of unevaluated) {
      const actualItems = await db.saleItem.findMany({
        where: {
          productId: snap.productId,
          sale: {
            status: "completed",
            createdAt: {
              gte: snap.forecastDate,
              lte: new Date(snap.forecastDate.getTime() + 30 * DAY_MS),
            },
          },
        },
        select: { quantity: true },
      });
      const actualDemand = actualItems.reduce((s, i) => s + i.quantity, 0);
      const accuracy = snap.predictedDemand > 0
        ? Math.max(0, 100 - Math.abs((actualDemand - snap.predictedDemand) / snap.predictedDemand) * 100)
        : (actualDemand === 0 ? 100 : 0);

      await db.forecastSnapshot.update({
        where: { id: snap.id },
        data: {
          actualDemand,
          accuracyPct: Math.round(accuracy * 100) / 100,
          evaluatedAt: new Date(),
        },
      });
      evaluatedCount++;
    }

    // Fetch accuracy stats from evaluated forecasts
    const evaluatedForecasts = await db.forecastSnapshot.findMany({
      where: { evaluatedAt: { not: null }, accuracyPct: { not: null } },
      take: 100,
      orderBy: { evaluatedAt: "desc" },
      select: { accuracyPct: true, predictedDemand: true, actualDemand: true, productId: true, product: { select: { name: true } } },
    });
    const avgAccuracy = evaluatedForecasts.length > 0
      ? Math.round(evaluatedForecasts.reduce((s, f) => s + (f.accuracyPct || 0), 0) / evaluatedForecasts.length * 100) / 100
      : null;

    // ===== Call LLM for natural-language summary =====
    let aiSummary = "";
    try {
      const topUrgent = sorted.filter(f => f.urgency === "critical" || f.urgency === "high").slice(0, 10);
      const trendingUp = sorted.filter(f => f.trend === "increasing").slice(0, 5);
      const trendingDown = sorted.filter(f => f.trend === "decreasing").slice(0, 5);
      const zai = await ZAI.create();
      const completion = await zai.chat.completions.create({
        messages: [
          {
            role: "assistant",
            content: `You are SYLHN AI, a demand forecasting assistant for a grocery store in Ghana. Analyze the forecast data and write a concise, actionable summary for the store owner. Use GHS for money. Structure your response as:
1. **Critical Reorders** — products that will stock out within 7 days
2. **Trending Up** — products selling faster (stock more)
3. **Trending Down** — products selling slower (reduce orders)
4. **Seasonality Insight** — which day of week sells most
5. **Projected Revenue** — total for next ${forecastDays} days
Keep it under 250 words. Be specific — name products and quantities.`,
          },
          {
            role: "user",
            content: `Forecast for next ${forecastDays} days:
Summary: ${JSON.stringify(summary)}
Avg forecast accuracy so far: ${avgAccuracy !== null ? avgAccuracy + "%" : "N/A (first forecast)"}
Evaluated past forecasts: ${evaluatedForecasts.length}

Top urgent products:
${JSON.stringify(topUrgent.map(f => ({ name: f.name, stock: f.currentStock, velocity: f.avgDailyVelocity, stockoutDays: f.projectedStockoutDays, reorder: f.recommendedReorderQty, confidence: f.confidenceScore, peakDay: f.seasonality.peakDay })), null, 2)}

Trending up:
${JSON.stringify(trendingUp.map(f => ({ name: f.name, trendPct: f.trendPct, velocity: f.avgDailyVelocity })), null, 2)}

Trending down:
${JSON.stringify(trendingDown.map(f => ({ name: f.name, trendPct: f.trendPct, velocity: f.avgDailyVelocity })), null, 2)}`,
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
      details: `Demand forecast generated for ${forecastDays} days — ${summary.criticalCount} critical, ${summary.highCount} high, avg confidence ${(summary.avgConfidence * 100).toFixed(0)}%, total reorder cost GHS ${summary.totalReorderCost.toFixed(2)}${evaluatedCount > 0 ? `, evaluated ${evaluatedCount} past forecasts` : ""}`,
      severity: "info",
      ipAddress: ip,
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      forecastDays,
      summary,
      aiSummary,
      forecasts: sorted,
      accuracy: {
        avgAccuracyPct: avgAccuracy,
        evaluatedCount: evaluatedForecasts.length,
        recentEvaluations: evaluatedForecasts.slice(0, 10).map(f => ({
          productName: f.product?.name || "Unknown",
          predicted: f.predictedDemand,
          actual: f.actualDemand || 0,
          accuracyPct: f.accuracyPct || 0,
        })),
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (e: any) {
    console.error("GET /api/ai-forecast error:", e);
    return NextResponse.json({ error: "Failed to generate forecast" }, { status: 500 });
  }
}
