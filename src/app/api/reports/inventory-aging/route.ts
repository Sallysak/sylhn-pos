import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { rateLimitApiRead, rateLimitResponse, getClientIp } from "@/lib/rate-limit";

// GET /api/reports/inventory-aging
// Premium: Inventory aging report — how long each product has been on the shelf.
//
// Uses StockHistory to determine the last "received" date for each product,
// then categorizes by age bucket: 0-30, 31-60, 61-90, 90+ days.
// Also flags "dead stock" (no sales in 90+ days) and identifies products
// at risk of expiry.
export async function GET(req: NextRequest) {
  try { await requireAuth(); } catch (e) { return e as Response; }

  const ip = getClientIp(req);
  const rl = rateLimitApiRead(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  try {
    const products = await db.product.findMany({
      where: { active: true, quantity: { gt: 0 } },
      include: {
        stockHistory: {
          where: { action: { in: ["received", "sold", "adjusted", "transfer"] } },
          orderBy: { createdAt: "desc" },
          take: 50,  // last 50 movements
          select: { action: true, quantity: true, createdAt: true, reference: true },
        },
        group: { select: { name: true } },
      },
    });

    const now = Date.now();
    const DAY_MS = 1000 * 60 * 60 * 24;

    const aging = products.map(p => {
      // Find the last "received" date (when current stock likely arrived)
      const lastReceived = p.stockHistory.find(h => h.action === "received" && h.quantity > 0);
      const lastReceivedDate = lastReceived ? new Date(lastReceived.createdAt) : null;
      const daysOnShelf = lastReceivedDate ? Math.floor((now - lastReceivedDate.getTime()) / DAY_MS) : null;

      // Last sale date
      const lastSale = p.stockHistory.find(h => h.action === "sold");
      const lastSaleDate = lastSale ? new Date(lastSale.createdAt) : null;
      const daysSinceLastSale = lastSaleDate ? Math.floor((now - lastSaleDate.getTime()) / DAY_MS) : null;

      // Categorize by age bucket
      let ageBucket: "fresh" | "30-60" | "60-90" | "90+" | "unknown";
      if (daysOnShelf === null) ageBucket = "unknown";
      else if (daysOnShelf <= 30) ageBucket = "fresh";
      else if (daysOnShelf <= 60) ageBucket = "30-60";
      else if (daysOnShelf <= 90) ageBucket = "60-90";
      else ageBucket = "90+";

      // Dead stock = no sales in 90+ days
      const isDeadStock = daysSinceLastSale !== null && daysSinceLastSale >= 90;
      const isSlowMoving = daysSinceLastSale !== null && daysSinceLastSale >= 30 && daysSinceLastSale < 90;

      // Value at risk
      const stockValue = p.quantity * p.costPrice;
      const retailValue = p.quantity * p.price;

      // Expiry risk
      let expiryRisk: "none" | "expired" | "critical" | "warning" | "soon" = "none";
      if (p.expiryDate) {
        const daysToExpiry = Math.floor((new Date(p.expiryDate).getTime() - now) / DAY_MS);
        if (daysToExpiry < 0) expiryRisk = "expired";
        else if (daysToExpiry <= 7) expiryRisk = "critical";
        else if (daysToExpiry <= 14) expiryRisk = "warning";
        else if (daysToExpiry <= 30) expiryRisk = "soon";
      }

      return {
        id: p.id,
        sku: p.sku,
        name: p.name,
        emoji: p.emoji,
        category: p.category,
        group: p.group?.name || null,
        quantity: p.quantity,
        unit: p.unit,
        costPrice: p.costPrice,
        sellingPrice: p.price,
        stockValue: Math.round(stockValue * 100) / 100,
        retailValue: Math.round(retailValue * 100) / 100,
        lastReceivedDate: lastReceivedDate?.toISOString().split("T")[0] || null,
        daysOnShelf,
        ageBucket,
        lastSaleDate: lastSaleDate?.toISOString().split("T")[0] || null,
        daysSinceLastSale,
        isDeadStock,
        isSlowMoving,
        expiryDate: p.expiryDate?.toISOString().split("T")[0] || null,
        expiryRisk,
      };
    });

    // Sort: dead stock first, then by days on shelf descending
    const sorted = aging.sort((a, b) => {
      if (a.isDeadStock && !b.isDeadStock) return -1;
      if (!a.isDeadStock && b.isDeadStock) return 1;
      return (b.daysOnShelf || 0) - (a.daysOnShelf || 0);
    });

    // Summary
    const summary = {
      totalProducts: aging.length,
      totalStockValue: aging.reduce((s, a) => s + a.stockValue, 0),
      deadStockCount: aging.filter(a => a.isDeadStock).length,
      deadStockValue: aging.filter(a => a.isDeadStock).reduce((s, a) => s + a.stockValue, 0),
      slowMovingCount: aging.filter(a => a.isSlowMoving).length,
      slowMovingValue: aging.filter(a => a.isSlowMoving).reduce((s, a) => s + a.stockValue, 0),
      byAgeBucket: {
        fresh: { count: aging.filter(a => a.ageBucket === "fresh").length, value: aging.filter(a => a.ageBucket === "fresh").reduce((s, a) => s + a.stockValue, 0) },
        "30-60": { count: aging.filter(a => a.ageBucket === "30-60").length, value: aging.filter(a => a.ageBucket === "30-60").reduce((s, a) => s + a.stockValue, 0) },
        "60-90": { count: aging.filter(a => a.ageBucket === "60-90").length, value: aging.filter(a => a.ageBucket === "60-90").reduce((s, a) => s + a.stockValue, 0) },
        "90+": { count: aging.filter(a => a.ageBucket === "90+").length, value: aging.filter(a => a.ageBucket === "90+").reduce((s, a) => s + a.stockValue, 0) },
      },
      byExpiryRisk: {
        expired: aging.filter(a => a.expiryRisk === "expired").length,
        critical: aging.filter(a => a.expiryRisk === "critical").length,
        warning: aging.filter(a => a.expiryRisk === "warning").length,
        soon: aging.filter(a => a.expiryRisk === "soon").length,
      },
    };

    return NextResponse.json({
      summary,
      products: sorted,
      generatedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error("GET /api/reports/inventory-aging error:", e);
    return NextResponse.json({ error: "Failed to generate aging report" }, { status: 500 });
  }
}
