import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { rateLimitApiRead, rateLimitResponse, getClientIp } from "@/lib/rate-limit";
import { db } from "@/lib/db";

// GET /api/reports/profit-margin?days=30&category=beverages
// Per-product profit margin report. Uses the Tier 1.2 landed cost data
// (PurchaseItem.landedCostPerUnit) when available — falls back to
// Product.costPrice for products without landed cost history.
//
// Returns:
//   - summary: total revenue, total cost, total profit, avg margin %,
//     # profitable products, # loss-making products
//   - products: per-product breakdown with:
//     * units sold
//     * revenue
//     * cost (using landed cost when available)
//     * gross profit
//     * margin %
//     * flag: profit | loss | break-even
//     * last cost (raw supplier cost)
//     * last landed cost (with freight/customs/etc. allocated)
//     * suggested price (cost × 1.25 default markup)
//
// Sortable by: profit desc (default), margin %, revenue, units sold.
// Filterable by: category, days, low-margin threshold.
export async function GET(req: NextRequest) {
  try { await requireAuth(); } catch (e: any) { return e as Response; }

  const ip = getClientIp(req);
  const rl = rateLimitApiRead(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  try {
    const { searchParams } = new URL(req.url);
    const days = Math.min(Math.max(parseInt(searchParams.get("days") || "30", 10), 1), 365);
    const category = searchParams.get("category") || "";
    const sortBy = searchParams.get("sortBy") || "profit"; // profit | margin | revenue | units
    const minMargin = parseFloat(searchParams.get("minMargin") || "0"); // filter: only show margins below this %

    const since = new Date();
    since.setDate(since.getDate() - days);
    since.setHours(0, 0, 0, 0);

    // Fetch all completed sale items in the window
    const saleItems = await db.saleItem.findMany({
      where: {
        sale: {
          status: "completed",
          createdAt: { gte: since },
        },
        ...(category ? { product: { category } } : {}),
      },
      select: {
        productId: true,
        sku: true,
        name: true,
        emoji: true,
        quantity: true,
        price: true,
        total: true,
        costPrice: true,
        product: {
          select: {
            id: true,
            category: true,
            costPrice: true,
            price: true,
            quantity: true,
            active: true,
          },
        },
      },
    });

    // Fetch the latest landed cost per product (from the most recent
    // received PurchaseItem with landedCostPerUnit > 0)
    const latestLandedCosts = await db.purchaseItem.findMany({
      where: {
        productId: { not: null },
        landedCostPerUnit: { gt: 0 },
        purchase: { status: "received" },
      },
      distinct: ["productId"],
      orderBy: [{ productId: "asc" }, { purchase: { createdAt: "desc" } }],
      select: {
        productId: true,
        cost: true,
        landedCostPerUnit: true,
        totalLandedCost: true,
        purchase: { select: { createdAt: true, refNo: true } },
      },
    });
    const landedCostMap = new Map<string, { cost: number; landedCostPerUnit: number; refNo: string; date: string }>();
    for (const li of latestLandedCosts) {
      if (li.productId) {
        landedCostMap.set(li.productId, {
          cost: li.cost,
          landedCostPerUnit: li.landedCostPerUnit,
          refNo: li.purchase.refNo,
          date: li.purchase.createdAt.toISOString(),
        });
      }
    }

    // Aggregate per product
    const productMap = new Map<string, {
      productId: string;
      sku: string;
      name: string;
      emoji: string;
      category: string;
      unitsSold: number;
      revenue: number;
      cost: number;
      lastCost: number;        // raw supplier cost
      lastLandedCost: number;  // with freight/customs allocated
      landedCostRefNo: string;
      landedCostDate: string | null;
      currentStock: number;
      currentPrice: number;
    }>();

    for (const si of saleItems) {
      const pid = si.productId || si.sku; // fallback to SKU if productId null
      const existing = productMap.get(pid) || {
        productId: pid,
        sku: si.sku,
        name: si.name,
        emoji: si.emoji || "📦",
        category: si.product?.category || "uncategorized",
        unitsSold: 0,
        revenue: 0,
        cost: 0,
        lastCost: si.costPrice || si.product?.costPrice || 0,
        lastLandedCost: 0,
        landedCostRefNo: "",
        landedCostDate: null,
        currentStock: si.product?.quantity || 0,
        currentPrice: si.product?.price || si.price,
      };

      existing.unitsSold += si.quantity;
      existing.revenue += si.total;
      // Use landed cost when available; otherwise fall back to costPrice
      const landed = si.productId ? landedCostMap.get(si.productId) : null;
      const effectiveCost = landed ? (landed.cost + landed.landedCostPerUnit) : (si.costPrice || si.product?.costPrice || 0);
      existing.cost += effectiveCost * si.quantity;
      if (landed) {
        existing.lastLandedCost = landed.cost + landed.landedCostPerUnit;
        existing.lastCost = landed.cost;
        existing.landedCostRefNo = landed.refNo;
        existing.landedCostDate = landed.date;
      } else {
        existing.lastCost = si.costPrice || si.product?.costPrice || 0;
      }

      productMap.set(pid, existing);
    }

    // Build the final per-product rows
    let products = Array.from(productMap.values()).map(p => {
      const profit = p.revenue - p.cost;
      const marginPct = p.revenue > 0 ? (profit / p.revenue) * 100 : 0;
      const markupPct = p.cost > 0 ? ((p.currentPrice - p.lastLandedCost) / p.lastLandedCost) * 100 : 0;
      const suggestedPrice = p.lastLandedCost > 0 ? p.lastLandedCost * 1.25 : p.lastCost * 1.25; // 25% markup
      return {
        ...p,
        profit,
        marginPct: Math.round(marginPct * 100) / 100,
        markupPct: Math.round(markupPct * 100) / 100,
        suggestedPrice: Math.round(suggestedPrice * 100) / 100,
        flag: profit > 0.01 ? "profit" : profit < -0.01 ? "loss" : "break-even",
        usingLandedCost: p.lastLandedCost > 0,
      };
    });

    // Filter: low-margin threshold (e.g. minMargin=10 shows only products with margin < 10%)
    if (minMargin > 0) {
      products = products.filter(p => p.marginPct < minMargin);
    }

    // Sort
    products.sort((a, b) => {
      switch (sortBy) {
        case "margin": return a.marginPct - b.marginPct;
        case "revenue": return b.revenue - a.revenue;
        case "units": return b.unitsSold - a.unitsSold;
        case "profit":
        default: return b.profit - a.profit;
      }
    });

    // Summary
    const totalRevenue = products.reduce((s, p) => s + p.revenue, 0);
    const totalCost = products.reduce((s, p) => s + p.cost, 0);
    const totalProfit = totalRevenue - totalCost;
    const avgMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
    const profitableCount = products.filter(p => p.flag === "profit").length;
    const lossCount = products.filter(p => p.flag === "loss").length;
    const breakEvenCount = products.filter(p => p.flag === "break-even").length;
    const usingLandedCostCount = products.filter(p => p.usingLandedCost).length;

    return NextResponse.json({
      summary: {
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        totalCost: Math.round(totalCost * 100) / 100,
        totalProfit: Math.round(totalProfit * 100) / 100,
        avgMarginPct: Math.round(avgMargin * 100) / 100,
        totalProducts: products.length,
        profitableCount,
        lossCount,
        breakEvenCount,
        usingLandedCostCount,
        days,
        category: category || "all",
      },
      products,
    });
  } catch (e: any) {
    console.error("GET /api/reports/profit-margin error:", e);
    return NextResponse.json({ error: "Failed to generate profit margin report" }, { status: 500 });
  }
}
