import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { rateLimitApiRead, rateLimitResponse, getClientIp } from "@/lib/rate-limit";
import { db } from "@/lib/db";

// GET /api/reports/reorder-effectiveness?days=90
// Evaluates how well the auto-replenish rules are working:
//   - # rules active
//   - # times rules have triggered (triggerCount)
//   - # stockouts that happened despite having a rule
//   - # rules that never triggered (stale)
//   - # products with rules that still went below reorder level
//
// Helps managers decide whether to adjust trigger levels or remove
// rules that aren't working.
export async function GET(req: NextRequest) {
  try { await requireAuth(); } catch (e) { return e as Response; }
  const ip = getClientIp(req);
  const rl = rateLimitApiRead(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  try {
    const { searchParams } = new URL(req.url);
    const days = Math.min(Math.max(parseInt(searchParams.get("days") || "90", 10), 7), 365);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Fetch all auto-replenish rules with their products
    const rules = await db.autoReplenishRule.findMany({
      include: {
        product: { select: { id: true, sku: true, name: true, emoji: true, quantity: true, reorderLevel: true, category: true } },
        supplier: { select: { id: true, name: true } },
      },
    });

    // Fetch stockouts (products that hit 0 quantity) in the window
    // We approximate this with StockHistory entries where action='adjusted'
    // and quantity <= 0, or products currently at 0 with past sales
    const stockHistory = await db.stockHistory.findMany({
      where: {
        action: "sold",
        createdAt: { gte: since },
      },
      select: { productId: true, createdAt: true },
      distinct: ["productId"],
    });

    // Fetch current products at 0 quantity (stockouts right now)
    const zeroStockProducts = await db.product.findMany({
      where: { quantity: { lte: 0 }, active: true },
      select: { id: true, name: true, sku: true },
    });
    const zeroStockIds = new Set(zeroStockProducts.map(p => p.id));

    // Build the report
    const ruleReports = rules.map(r => {
      const product = r.product;
      const isStockedOut = zeroStockIds.has(product.id);
      const lastTriggeredDaysAgo = r.lastTriggeredAt
        ? Math.floor((Date.now() - r.lastTriggeredAt.getTime()) / (24 * 60 * 60 * 1000))
        : null;
      const isStale = !r.lastTriggeredAt || (lastTriggeredDaysAgo !== null && lastTriggeredDaysAgo > days);
      const currentStockVsTrigger = product.quantity - r.triggerLevel;
      const needsAttention = product.quantity <= r.triggerLevel && r.triggerCount === 0;

      return {
        ruleId: r.id,
        productId: product.id,
        productName: product.name,
        productSku: product.sku,
        productEmoji: product.emoji,
        category: product.category,
        supplierName: r.supplier?.name || "Unassigned",
        triggerLevel: r.triggerLevel,
        reorderQty: r.reorderQty,
        currentStock: product.quantity,
        reorderLevel: product.reorderLevel,
        triggerCount: r.triggerCount,
        lastTriggeredAt: r.lastTriggeredAt?.toISOString() || null,
        lastTriggeredDaysAgo,
        isStale,
        isStockedOut,
        currentStockVsTrigger,
        needsAttention,
        status: isStockedOut ? "stockout" : isStale ? "stale" : needsAttention ? "needs-attention" : "ok",
      };
    });

    const summary = {
      totalRules: rules.length,
      activeRules: rules.filter(r => r.triggerCount > 0).length,
      staleRules: ruleReports.filter(r => r.isStale).length,
      stockouts: ruleReports.filter(r => r.isStockedOut).length,
      needsAttention: ruleReports.filter(r => r.needsAttention).length,
      totalTriggers: rules.reduce((s, r) => s + r.triggerCount, 0),
      days,
    };

    return NextResponse.json({ summary, rules: ruleReports });
  } catch (e) {
    console.error("GET /api/reports/reorder-effectiveness error:", e);
    return NextResponse.json({ error: "Failed to generate reorder effectiveness report" }, { status: 500 });
  }
}
