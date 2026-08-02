import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requirePermission } from "@/lib/auth";
import { rateLimitApiWrite, rateLimitResponse, getClientIp } from "@/lib/rate-limit";

// POST /api/stocktakes/[id]/complete — apply variances to stock, mark as completed
// This is the missing piece that makes stocktakes actually affect inventory.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let user;
  try {
    user = await requireAuth();
    requirePermission(user.role, "canAdjustStock");
  } catch (e) { return e as Response; }

  const ip = getClientIp(req);
  const rl = rateLimitApiWrite(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  let body: any = {};
  try { body = await req.json(); } catch { /* allow empty body */ }

  try {
    const { id } = await params;
    const stocktake = await db.stocktake.findUnique({
      where: { id },
      include: { items: { include: { product: true } } },
    });
    if (!stocktake) return NextResponse.json({ error: "Stocktake not found" }, { status: 404 });
    if (stocktake.status === "completed") {
      return NextResponse.json({ error: "Stocktake already completed" }, { status: 400 });
    }

    // If client passed items with countedQty, update them; otherwise use what's already in DB.
    const incomingItems: Array<{ productId?: string; countedQty?: number; reason?: string }> = Array.isArray(body.items) ? body.items : [];
    const incomingByPid = new Map(incomingItems.map(i => [i.productId, i]));

    let totalVariance = 0;
    let itemsApplied = 0;
    const now = new Date();

    // Update each item: compute variance, apply to product, write StockHistory
    for (const item of stocktake.items) {
      const incoming = incomingByPid.get(item.productId);
      const countedQty = incoming?.countedQty != null ? Number(incoming.countedQty) : item.countedQty;
      if (countedQty == null) continue; // skip uncounted

      const variance = countedQty - item.expectedQty;
      const reason = incoming?.reason || item.reason || `Stocktake ${stocktake.refNo}`;

      // Update StocktakeItem
      await db.stocktakeItem.update({
        where: { id: item.id },
        data: { countedQty, variance, reason, countedAt: now },
      });

      // Apply variance to Product.quantity (only if non-zero)
      if (variance !== 0) {
        await db.product.update({
          where: { id: item.productId },
          data: { quantity: { increment: variance } },
        });

        // Write StockHistory entry — action='adjusted'
        await db.stockHistory.create({
          data: {
            productId: item.productId,
            action: "adjusted",
            quantity: variance,
            reason: `Stocktake ${stocktake.refNo} — ${reason}`,
            reference: stocktake.refNo,
            stocktakeId: stocktake.id,
            userId: user.uid,
          },
        });
        totalVariance += Math.abs(variance);
      }
      itemsApplied++;
    }

    // Mark stocktake as completed
    const updated = await db.stocktake.update({
      where: { id },
      data: {
        status: "completed",
        startedAt: stocktake.startedAt || now,
        completedAt: now,
        notes: body.notes ? String(body.notes).slice(0, 2000) : stocktake.notes,
      },
      include: { items: true, conductedBy: { select: { fullName: true, username: true } } },
    });

    await db.auditLog.create({
      data: {
        userId: user.uid,
        user: user.username,
        action: "COMPLETE",
        module: "maintenance",
        details: `Stocktake ${stocktake.refNo} completed — ${itemsApplied} items counted, total variance magnitude ${totalVariance}`,
        severity: totalVariance > 0 ? "warning" : "info",
      },
    });

    return NextResponse.json({
      success: true,
      stocktake: updated,
      summary: { itemsApplied, totalVariance },
    });
  } catch (e) {
    console.error("POST /api/stocktakes/[id]/complete error:", e);
    return NextResponse.json({ error: "Failed to complete stocktake" }, { status: 500 });
  }
}
