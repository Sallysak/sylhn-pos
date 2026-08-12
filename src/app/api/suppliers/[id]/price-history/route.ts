import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { rateLimitApiRead, rateLimitResponse, getClientIp } from "@/lib/rate-limit";

// GET /api/suppliers/[id]/price-history?productId=xxx&limit=50
// Returns the price-change history for this supplier, optionally filtered
// to a specific product. Each entry shows the unitCost at a point in time,
// the previous cost, who changed it, and when.
//
// Powers the price-trend chart in the Supplier form.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { await requireAuth(); } catch (e: any) { return e as Response; }

  const ip = getClientIp(req);
  const rl = rateLimitApiRead(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const productId = searchParams.get("productId");
    const limit = Math.min(parseInt(searchParams.get("limit") || "100", 10), 500);

    const where: any = { supplierId: id };
    if (productId) where.productId = productId;

    const history = await db.supplierPriceHistory.findMany({
      where,
      include: {
        product: { select: { id: true, sku: true, name: true, emoji: true } },
        changedBy: { select: { id: true, fullName: true, username: true } },
      },
      orderBy: { changedAt: "desc" },
      take: limit,
    });

    // Compute deltas + trend stats
    const enriched = history.map(h => {
      const delta = h.unitCost - h.previousCost;
      const deltaPct = h.previousCost > 0 ? (delta / h.previousCost) * 100 : 0;
      return {
        ...h,
        delta: Math.round(delta * 10000) / 10000,
        deltaPct: Math.round(deltaPct * 100) / 100,
        isIncrease: delta > 0,
        isDecrease: delta < 0,
      };
    });

    // Trend stats: total change %, # increases, # decreases
    const increases = enriched.filter(e => e.isIncrease).length;
    const decreases = enriched.filter(e => e.isDecrease).length;
    const firstEntry = enriched[enriched.length - 1]; // oldest
    const lastEntry = enriched[0]; // newest
    const totalChangePct = firstEntry && lastEntry && firstEntry.unitCost > 0
      ? Math.round(((lastEntry.unitCost - firstEntry.unitCost) / firstEntry.unitCost) * 10000) / 100
      : 0;

    return NextResponse.json({
      supplierId: id,
      history: enriched,
      stats: {
        totalEntries: enriched.length,
        increases,
        decreases,
        firstCost: firstEntry?.unitCost || 0,
        lastCost: lastEntry?.unitCost || 0,
        totalChangePct,
        trend: totalChangePct > 5 ? "increasing" : totalChangePct < -5 ? "decreasing" : "stable",
      },
    });
  } catch (e: any) {
    console.error("GET /api/suppliers/[id]/price-history error:", e);
    return NextResponse.json({ error: "Failed to fetch price history" }, { status: 500 });
  }
}
