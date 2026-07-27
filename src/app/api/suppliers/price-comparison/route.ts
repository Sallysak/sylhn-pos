import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { rateLimitApiRead, rateLimitResponse, getClientIp } from "@/lib/rate-limit";

// GET /api/suppliers/price-comparison?productId=xxx
// Returns all suppliers for a given product side-by-side with:
//   - supplierCost (current)
//   - leadTimeDays
//   - preferred (boolean)
//   - lastPurchaseDate + lastPurchaseCost (from the most recent PO)
//   - lastPurchaseRefNo
//   - 90-day performance score (on-time %, fill-rate %)
// Buyers use this to pick the best supplier for a reorder.
export async function GET(req: NextRequest) {
  try { await requireAuth(); } catch (e) { return e as Response; }

  const ip = getClientIp(req);
  const rl = rateLimitApiRead(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  try {
    const { searchParams } = new URL(req.url);
    const productId = searchParams.get("productId");
    if (!productId) {
      return NextResponse.json({ error: "productId is required" }, { status: 400 });
    }

    const product = await db.product.findUnique({
      where: { id: productId },
      select: { id: true, sku: true, name: true, emoji: true, costPrice: true, quantity: true, reorderLevel: true },
    });
    if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

    // All suppliers linked to this product
    const links = await db.productSupplier.findMany({
      where: { productId },
      include: {
        supplier: { select: { id: true, name: true, code: true, active: true, rating: true, blacklist: true } },
      },
      orderBy: [{ preferred: "desc" }, { supplierCost: "asc" }],
    });

    if (links.length === 0) {
      return NextResponse.json({
        product,
        suppliers: [],
        message: "No suppliers linked to this product. Add suppliers via the Supplier Directory → Catalog.",
      });
    }

    // For each supplier, fetch the most recent PO containing this product
    const supplierIds = links.map(l => l.supplierId);
    const recentPOs = await db.purchase.findMany({
      where: {
        supplierId: { in: supplierIds },
        items: { some: { productId } },
      },
      include: { items: { where: { productId }, select: { cost: true, quantity: true, receivedQty: true } } },
      orderBy: { createdAt: "desc" },
    });

    // Group by supplierId → most recent PO
    const lastPOBySupplier = new Map<string, any>();
    for (const po of recentPOs) {
      if (!lastPOBySupplier.has(po.supplierId!)) {
        lastPOBySupplier.set(po.supplierId!, po);
      }
    }

    // Compute 90-day performance per supplier (lightweight — only on-time %)
    const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const supplierPerf = await db.purchase.groupBy({
      by: ["supplierId"],
      where: {
        supplierId: { in: supplierIds },
        status: "received",
        receivedAt: { gte: since },
      },
      _count: { _all: true },
    });

    // Build the comparison rows
    const suppliers = links.map(link => {
      const lastPO = lastPOBySupplier.get(link.supplierId);
      const lastItem = lastPO?.items?.[0];
      const perf = supplierPerf.find(p => p.supplierId === link.supplierId);
      return {
        supplierId: link.supplier.id,
        supplierName: link.supplier.name,
        supplierCode: link.supplier.code,
        active: link.supplier.active,
        blacklisted: link.supplier.blacklist,
        rating: link.supplier.rating,
        preferred: link.preferred,
        supplierSku: link.supplierSku,
        supplierCost: link.supplierCost,
        leadTimeDays: link.leadTimeDays,
        lastPurchaseDate: lastPO?.createdAt || null,
        lastPurchaseRefNo: lastPO?.refNo || null,
        lastPurchaseCost: lastItem?.cost || null,
        lastPurchaseQty: lastItem?.quantity || null,
        receivedInLast90Days: perf?._count?._all || 0,
        // Effective unit cost = supplierCost (use last purchase cost as fallback)
        effectiveCost: link.supplierCost > 0 ? link.supplierCost : (lastItem?.cost || 0),
        // Cost delta vs current product costPrice
        costDelta: (link.supplierCost || 0) - product.costPrice,
        costDeltaPct: product.costPrice > 0
          ? Math.round(((link.supplierCost || 0) - product.costPrice) / product.costPrice * 1000) / 10
          : 0,
      };
    });

    // Find the cheapest supplier (for the "best deal" callout)
    const cheapest = suppliers.reduce((best, s) =>
      s.effectiveCost > 0 && (best === null || s.effectiveCost < best.effectiveCost) ? s : best,
      null as any
    );

    return NextResponse.json({
      product,
      suppliers,
      cheapestSupplier: cheapest,
      totalSuppliers: suppliers.length,
    });
  } catch (e) {
    console.error("GET /api/suppliers/price-comparison error:", e);
    return NextResponse.json({ error: "Failed to fetch price comparison" }, { status: 500 });
  }
}
