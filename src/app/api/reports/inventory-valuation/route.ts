import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { rateLimitApiRead, rateLimitResponse, getClientIp } from "@/lib/rate-limit";
import { auditLog } from "@/lib/audit";

// GET /api/reports/inventory-valuation?method=weighted-average|fifo|lifo
// Premium: Inventory valuation using 3 standard accounting methods.
//
// - Weighted Average: uses Product.costPrice (the current average cost)
// - FIFO (First In, First Out): assumes oldest stock is sold first.
//   We approximate this by walking StockHistory in chronological order —
//   each "received" entry adds a cost layer, each "sold"/"returned" entry
//   consumes from the oldest layers first.
// - LIFO (Last In, First Out): assumes newest stock is sold first.
//   Same layer approach but consumes from newest layers.
//
// Returns: per-product valuation + total inventory value.
export async function GET(req: NextRequest) {
  try { await requireAuth(); } catch (e) { return e as Response; }

  const ip = getClientIp(req);
  const rl = rateLimitApiRead(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  try {
    const { searchParams } = new URL(req.url);
    const method = (searchParams.get("method") || "weighted-average").toLowerCase();
    if (!["weighted-average", "fifo", "lifo"].includes(method)) {
      return NextResponse.json({ error: "Invalid method (use 'weighted-average', 'fifo', or 'lifo')" }, { status: 400 });
    }

    const products = await db.product.findMany({
      where: { active: true },
      include: {
        stockHistory: {
          where: { action: { in: ["received", "sold", "returned", "adjusted", "transfer"] } },
          orderBy: { createdAt: "asc" },
          select: { action: true, quantity: true, createdAt: true, reference: true },
        },
        group: { select: { name: true } },
      },
    });

    const valuations = products.map(p => {
      let value = 0;
      let qtyOnHand = p.quantity;
      let methodNote = "";

      if (method === "weighted-average") {
        value = p.quantity * p.costPrice;
        methodNote = `Current avg cost × qty on hand`;
      } else {
        // FIFO / LIFO — walk stock history to build cost layers
        // Each "received" entry adds a layer { qty, cost }
        // Each outflow (sold/adjusted/transfer negative) consumes layers
        const layers: Array<{ qty: number; cost: number; date: Date }> = [];
        for (const h of p.stockHistory) {
          if (h.quantity > 0) {
            // Inflow — add a layer at current costPrice (we don't track per-shipment cost historically,
            // so we approximate using the PurchaseItem cost via the product's current costPrice as fallback).
            // For a more accurate FIFO/LIFO, capture costPrice on StockHistory at receipt time.
            layers.push({ qty: h.quantity, cost: p.costPrice, date: h.createdAt });
          } else if (h.quantity < 0) {
            // Outflow — consume from layers
            let toConsume = -h.quantity;
            while (toConsume > 0 && layers.length > 0) {
              const layer = method === "fifo" ? layers[0] : layers[layers.length - 1];
              const consumed = Math.min(toConsume, layer.qty);
              layer.qty -= consumed;
              toConsume -= consumed;
              if (layer.qty <= 0) {
                if (method === "fifo") layers.shift();
                else layers.pop();
              }
            }
          }
        }
        // Remaining layers = current inventory
        value = layers.reduce((s, l) => s + l.qty * l.cost, 0);
        methodNote = `${layers.length} cost layer(s) remaining`;
      }

      const marketValue = p.quantity * p.price;
      const potentialProfit = marketValue - value;

      return {
        id: p.id,
        sku: p.sku,
        name: p.name,
        emoji: p.emoji,
        category: p.category,
        group: p.group?.name || null,
        quantityOnHand: qtyOnHand,
        costPrice: p.costPrice,
        sellingPrice: p.price,
        valuation: Math.round(value * 100) / 100,
        marketValue: Math.round(marketValue * 100) / 100,
        potentialProfit: Math.round(potentialProfit * 100) / 100,
        methodNote,
      };
    });

    const totalValuation = valuations.reduce((s, v) => s + v.valuation, 0);
    const totalMarketValue = valuations.reduce((s, v) => s + v.marketValue, 0);
    const totalPotentialProfit = totalMarketValue - totalValuation;
    const totalUnits = valuations.reduce((s, v) => s + v.quantityOnHand, 0);

    // Top 10 by valuation
    const topByValue = [...valuations].sort((a, b) => b.valuation - a.valuation).slice(0, 10);

    // Group by category
    const byCategory: Record<string, { valuation: number; marketValue: number; units: number; count: number }> = {};
    for (const v of valuations) {
      const cat = v.category || "other";
      if (!byCategory[cat]) byCategory[cat] = { valuation: 0, marketValue: 0, units: 0, count: 0 };
      byCategory[cat].valuation += v.valuation;
      byCategory[cat].marketValue += v.marketValue;
      byCategory[cat].units += v.quantityOnHand;
      byCategory[cat].count += 1;
    }

    await auditLog({
      userId: "",
      user: "system",
      action: "REPORT",
      module: "accounts",
      details: `Inventory valuation report generated (${method}) — ${valuations.length} products, total value GHS ${totalValuation.toFixed(2)}`,
      severity: "info",
      ipAddress: ip,
    }).catch(() => {});

    return NextResponse.json({
      method,
      generatedAt: new Date().toISOString(),
      summary: {
        productCount: valuations.length,
        totalUnits,
        totalValuation: Math.round(totalValuation * 100) / 100,
        totalMarketValue: Math.round(totalMarketValue * 100) / 100,
        totalPotentialProfit: Math.round(totalPotentialProfit * 100) / 100,
      },
      byCategory: Object.entries(byCategory).map(([category, data]) => ({
        category,
        ...data,
        valuation: Math.round(data.valuation * 100) / 100,
        marketValue: Math.round(data.marketValue * 100) / 100,
      })),
      topByValue,
      products: valuations,
    });
  } catch (e) {
    console.error("GET /api/reports/inventory-valuation error:", e);
    return NextResponse.json({ error: "Failed to generate valuation" }, { status: 500 });
  }
}
