import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requirePermission } from "@/lib/auth";
import { rateLimitApiWrite, rateLimitResponse, getClientIp } from "@/lib/rate-limit";
import { auditLogTx } from "@/lib/audit";

// POST /api/stocktakes/scan
// Premium: scan a barcode during stocktake and update the counted quantity
// for the matching product in the active stocktake session.
//
// Body: { stocktakeId, barcode, countedQty? }
//   - If countedQty is omitted, increments the existing count by 1 (efficient for "scan each item" workflow)
//   - If countedQty is provided, sets the count to that value
//
// Returns: { product, stocktakeItem, isNew }
export async function POST(req: NextRequest) {
  let user;
  try {
    user = await requireAuth();
    requirePermission(user.role, "canAdjustStock");
  } catch (e) { return e as Response; }

  const ip = getClientIp(req);
  const rl = rateLimitApiWrite(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { stocktakeId, barcode, countedQty } = body;
  if (!stocktakeId || !barcode) {
    return NextResponse.json({ error: "stocktakeId and barcode are required" }, { status: 400 });
  }

  try {
    const result = await db.$transaction(async (tx) => {
      // Find the product by barcode OR SKU
      const product = await tx.product.findFirst({
        where: {
          OR: [
            { barcode: String(barcode) },
            { sku: String(barcode) },
          ],
        },
      });
      if (!product) {
        throw new Error(`No product found for barcode/SKU "${barcode}"`);
      }

      // Find the active stocktake
      const stocktake = await tx.stocktake.findUnique({ where: { id: String(stocktakeId) } });
      if (!stocktake) throw new Error("Stocktake not found");
      if (stocktake.status === "completed") throw new Error("Stocktake is already completed");
      if (stocktake.status === "scheduled") {
        // Auto-start the stocktake on first scan
        await tx.stocktake.update({
          where: { id: stocktake.id },
          data: { status: "in-progress", startedAt: new Date(), conductedById: user.uid },
        });
      }

      // Find or create the stocktake item
      let stocktakeItem = await tx.stocktakeItem.findUnique({
        where: { stocktakeId_productId: { stocktakeId: stocktake.id, productId: product.id } },
      });

      const previousCount = stocktakeItem?.countedQty ?? null;
      const newCount = countedQty !== undefined
        ? Number(countedQty)
        : (stocktakeItem?.countedQty ?? 0) + 1;

      const variance = newCount - product.quantity;

      if (stocktakeItem) {
        stocktakeItem = await tx.stocktakeItem.update({
          where: { id: stocktakeItem.id },
          data: {
            countedQty: newCount,
            variance,
            countedAt: new Date(),
          },
        });
      } else {
        stocktakeItem = await tx.stocktakeItem.create({
          data: {
            stocktakeId: stocktake.id,
            productId: product.id,
            expectedQty: product.quantity,
            countedQty: newCount,
            variance,
            countedAt: new Date(),
            reason: "Scanned via mobile camera",
          },
        });
      }

      // Audit
      await auditLogTx(tx, {
        userId: user.uid,
        user: user.username,
        action: "SCAN",
        module: "stock",
        details: `Stocktake scan: ${product.sku} (${product.name}) — count ${previousCount ?? 0} → ${newCount} (expected ${product.quantity})`,
        severity: "info",
        ipAddress: ip,
        userAgent: req.headers.get("user-agent") || "",
      });

      return { product, stocktakeItem, isNew: previousCount === null };
    });

    return NextResponse.json({
      success: true,
      product: {
        id: result.product.id,
        sku: result.product.sku,
        name: result.product.name,
        emoji: result.product.emoji,
        expectedQty: result.product.quantity,
        unit: result.product.unit,
      },
      stocktakeItem: result.stocktakeItem,
      isNew: result.isNew,
    });
  } catch (e: any) {
    console.error("POST /api/stocktakes/scan error:", e);
    const msg = e?.message || "Failed to scan";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
