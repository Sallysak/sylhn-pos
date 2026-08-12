import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requirePermission } from "@/lib/auth";
import { rateLimitApiWrite, rateLimitResponse, getClientIp } from "@/lib/rate-limit";
import { auditLogTx } from "@/lib/audit";

// POST /api/supplier-price-history
// Records a price change for a (supplier, product) pair.
// Body: { supplierId, productId, unitCost, previousCost?, notes? }
//
// Typically called automatically by /api/suppliers/[id]/products when
// updating ProductSupplier.supplierCost — but also exposed directly so
// buyers can record manual price quotes received from suppliers.
export async function POST(req: NextRequest) {
  let user;
  try {
    user = await requireAuth();
    requirePermission(user.role, "purchase");
  } catch (e: any) { return e as Response; }

  const ip = getClientIp(req);
  const rl = rateLimitApiWrite(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  let body: any;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.supplierId || !body.productId || body.unitCost === undefined) {
    return NextResponse.json({
      error: "supplierId, productId, and unitCost are required",
    }, { status: 400 });
  }

  try {
    const unitCost = Number(body.unitCost);
    if (unitCost < 0) {
      return NextResponse.json({ error: "unitCost must be >= 0" }, { status: 400 });
    }

    const entry = await db.$transaction(async (tx) => {
      // Look up the previous cost from ProductSupplier if not provided
      let previousCost = Number(body.previousCost) || 0;
      if (!previousCost) {
        const link = await tx.productSupplier.findUnique({
          where: {
            productId_supplierId: {
              productId: body.productId,
              supplierId: body.supplierId,
            },
          },
          select: { supplierCost: true },
        });
        previousCost = link?.supplierCost || 0;
      }

      // If new cost equals previous, skip recording (no change)
      if (Math.abs(unitCost - previousCost) < 0.0001) {
        return { skipped: true, reason: "no_change", previousCost };
      }

      const newEntry = await tx.supplierPriceHistory.create({
        data: {
          supplierId: body.supplierId,
          productId: body.productId,
          unitCost,
          previousCost,
          changedById: user.uid,
          notes: String(body.notes || "").slice(0, 500),
        },
        include: {
          product: { select: { sku: true, name: true } },
          supplier: { select: { name: true, code: true } },
        },
      });

      // Update ProductSupplier.supplierCost to the new value
      await tx.productSupplier.upsert({
        where: {
          productId_supplierId: {
            productId: body.productId,
            supplierId: body.supplierId,
          },
        },
        create: {
          productId: body.productId,
          supplierId: body.supplierId,
          supplierCost: unitCost,
        },
        update: {
          supplierCost: unitCost,
        },
      });

      await auditLogTx(tx, {
        userId: user.uid,
        user: user.username,
        action: "PRICE_CHANGE",
        module: "supplier",
        details: `Price change recorded — ${newEntry.supplier.name} → ${newEntry.product.name}: ₵${previousCost.toFixed(2)} → ₵${unitCost.toFixed(2)} (${unitCost > previousCost ? "+" : ""}${((unitCost - previousCost) / (previousCost || 1) * 100).toFixed(1)}%)`,
        severity: "info",
        ipAddress: ip,
        userAgent: req.headers.get("user-agent") || "",
      });

      return newEntry;
    });

    return NextResponse.json({ success: true, entry });
  } catch (e: any) {
    console.error("POST /api/supplier-price-history error:", e);
    return NextResponse.json({ error: e?.message || "Failed to record price change" }, { status: 500 });
  }
}
