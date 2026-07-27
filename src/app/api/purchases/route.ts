import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requirePermission } from "@/lib/auth";
import { PurchaseSchema, validate, validationError } from "@/lib/validation";
import { rateLimitApiRead, rateLimitApiWrite, rateLimitResponse, getClientIp } from "@/lib/rate-limit";
import { auditLogTx } from "@/lib/audit";
import { generatePurchaseRefNo } from "@/lib/identifiers";

export async function GET(req: NextRequest) {
  try { await requireAuth(); } catch (e) { return e as Response; }

  const ip = getClientIp(req);
  const rl = rateLimitApiRead(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");
    const status = searchParams.get("status");
    const supplierId = searchParams.get("supplierId");
    const limit = Math.min(parseInt(searchParams.get("limit") || "100", 10), 1000);

    const where: any = {};
    if (type) where.type = type;
    if (status) where.status = status;
    if (supplierId) where.supplierId = supplierId;

    const purchases = await db.purchase.findMany({
      where,
      include: {
        items: true,
        supplier: true,
        createdBy: { select: { id: true, fullName: true, username: true } },
        receivedBy: { select: { id: true, fullName: true, username: true } },
        payments: true,
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return NextResponse.json({ purchases });
  } catch (e) {
    console.error("GET /api/purchases error:", e);
    return NextResponse.json({ error: "Failed to fetch purchases" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let user;
  try {
    user = await requireAuth();
    requirePermission(user.role, "purchase");
  } catch (e) { return e as Response; }

  const ip = getClientIp(req);
  const rl = rateLimitApiWrite(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  let body: unknown;
  try { body = await req.json(); } catch { return validationError("Invalid JSON body"); }

  const result = validate(PurchaseSchema, body);
  if (!result.success) return validationError(result.error);
  const p = result.data;

  // Pull expectedAt separately (not in schema to keep it loose)
  const expectedAt = (body as any).expectedAt ? new Date((body as any).expectedAt) : null;

  // FIX: Foreign-key constraint violation on purchase_supplierid_fkey.
  // The client sometimes sends a supplier NAME (e.g. "AgriCorp Ghana") instead
  // of the supplier UUID, which Prisma rejects with P2003. We verify the
  // supplier exists BEFORE entering the transaction and return a friendly 400
  // instead of letting the error bubble up as a 500.
  //
  // Note: we no longer reject non-UUID-shaped strings here. The previous UUID
  // regex check was too strict — it rejected temporary client-side IDs (like
  // "s1" or "s-1234567890") that the supplier form uses optimistically before
  // the server returns the real UUID. Instead, we just look up the supplier
  // by ID and return SUPPLIER_NOT_FOUND if it doesn't exist. The DB lookup is
  // cheap and unambiguous.
  if (p.supplierId) {
    const supplier = await db.supplier.findUnique({
      where: { id: String(p.supplierId) },
      select: { id: true, name: true, active: true },
    });
    if (!supplier) {
      return NextResponse.json(
        {
          error: "Supplier not found",
          detail: `No supplier exists with id "${p.supplierId}". Please re-select the supplier from the dropdown.`,
          code: "SUPPLIER_NOT_FOUND",
        },
        { status: 400 }
      );
    }
    if (!supplier.active) {
      return NextResponse.json(
        { error: "Supplier deactivated", detail: `Supplier "${supplier.name}" is inactive. Reactivate them first.` },
        { status: 400 }
      );
    }
  }

  try {
    const purchase = await db.$transaction(async (tx) => {
      const refNo = p.refNo || generatePurchaseRefNo();
      const status = p.status || "received";
      const total = Number(p.total) || 0;
      const amountPaid = Number(p.amountPaid) || 0;

      // Phase 2: pull new optional fields from the body (all defaulted so
      // missing values don't break older clients)
      const body = p as any;
      const currency = String(body.currency || "GHS");
      const exchangeRate = Number(body.exchangeRate) || 1;
      const freightCost = Number(body.freightCost) || 0;
      const insuranceCost = Number(body.insuranceCost) || 0;
      const customsDuty = Number(body.customsDuty) || 0;
      const otherLandedCosts = Number(body.otherLandedCosts) || 0;
      // Tier 1.2 — landed-cost allocation method
      const landedCostAllocationMethod = String(body.landedCostAllocationMethod || "none");
      const totalLandedCosts = freightCost + insuranceCost + customsDuty + otherLandedCosts;

      // Tier 1.2 — compute per-line landed cost allocation
      // Method: by_value (default) — proportional to line net total
      //         by_qty           — proportional to quantity
      //         manual           — caller supplies landedCostPerUnit per line
      //         none             — no allocation (legacy behaviour)
      const lineItemsData = p.items.map((item: any) => {
        const lineGross = (Number(item.quantity) || 0) * (Number(item.cost) || 0);
        let discountAmount = 0;
        if (item.discountType === "amount") {
          discountAmount = Math.min(Number(item.discountValue) || 0, lineGross);
        } else if (item.discountType === "percent") {
          discountAmount = (lineGross * Math.min(Number(item.discountValue) || 0, 100)) / 100;
        }
        const lineNet = lineGross - discountAmount;
        const taxRate = Number(item.taxRate) || 0;
        const taxAmount = lineNet * taxRate;
        const lineTotalWithTax = lineNet + taxAmount;

        return {
          productId: item.productId || null,
          partNo: item.partNo,
          details: item.details,
          emoji: item.emoji || "📦",
          quantity: Number(item.quantity) || 1,
          cost: Number(item.cost) || 0,
          tax: item.tax !== false,
          total: Number(item.total) || lineTotalWithTax,
          expiryDate: item.expiryDate ? new Date(item.expiryDate as string) : null,
          // Phase 2 fields
          discountType: item.discountType || null,
          discountValue: Number(item.discountValue) || 0,
          discountAmount,
          taxRate,
          taxAmount,
          batchNumber: item.batchNumber || null,
          freeQuantity: Number(item.freeQuantity) || 0,
          retailPrice: Number(item.retailPrice) || 0,
          tradePrice: Number(item.tradePrice) || 0,
          wholesalePrice: Number(item.wholesalePrice) || 0,
          // Tier 1.2 — per-line landed cost (filled below after allocation)
          landedCostPerUnit: 0,
          totalLandedCost: 0,
          // Stash for allocation
          _lineNet: lineNet,
        };
      });

      // Allocate landed costs to lines if method != "none" and there are landed costs
      if (landedCostAllocationMethod !== "none" && totalLandedCosts > 0 && lineItemsData.length > 0) {
        if (landedCostAllocationMethod === "by_value") {
          const totalLineNet = lineItemsData.reduce((s, l) => s + l._lineNet, 0);
          if (totalLineNet > 0) {
            for (const l of lineItemsData) {
              const share = l._lineNet / totalLineNet;
              const lineLanded = totalLandedCosts * share;
              l.totalLandedCost = Math.round(lineLanded * 100) / 100;
              l.landedCostPerUnit = l.quantity > 0 ? Math.round((lineLanded / l.quantity) * 10000) / 10000 : 0;
            }
          }
        } else if (landedCostAllocationMethod === "by_qty") {
          const totalQty = lineItemsData.reduce((s, l) => s + l.quantity, 0);
          if (totalQty > 0) {
            for (const l of lineItemsData) {
              const share = l.quantity / totalQty;
              const lineLanded = totalLandedCosts * share;
              l.totalLandedCost = Math.round(lineLanded * 100) / 100;
              l.landedCostPerUnit = l.quantity > 0 ? Math.round((lineLanded / l.quantity) * 10000) / 10000 : 0;
            }
          }
        } else if (landedCostAllocationMethod === "manual") {
          // Caller supplies landedCostPerUnit per line — trust their values
          for (const l of lineItemsData) {
            // No transformation needed — landedCostPerUnit already set by caller
            // (default 0 if not provided)
          }
        }
      }

      // Strip the _lineNet helper field before create
      const cleanLineItems = lineItemsData.map(({ _lineNet, ...rest }: any) => rest);

      // Create purchase + items
      const newPurchase = await tx.purchase.create({
        data: {
          refNo,
          type: p.type || "purchase",
          supplierId: p.supplierId || null,
          supplierName: p.supplierName || "",
          status,
          subtotal: Number(p.subtotal) || 0,
          discount: Number(p.discount) || 0,
          taxAmount: Number(p.taxAmount) || 0,
          total,
          amountPaid,
          notes: p.notes || "",
          createdById: user.uid,
          receivedById: status === "received" ? user.uid : null,
          receivedAt: p.receivedAt ? new Date(p.receivedAt as string) : (status === "received" ? new Date() : null),
          expectedAt,
          // Phase 2 fields
          currency,
          exchangeRate,
          freightCost,
          insuranceCost,
          customsDuty,
          otherLandedCosts,
          // Tier 1.2 — landed cost allocation method
          landedCostAllocationMethod,
          items: { create: cleanLineItems },
        },
        include: { items: true, supplier: true },
      });

      // If received, increment stock + create linked StockHistory entries atomically
      // Phase 2: also increment by freeQuantity (buy 10 get 1 free → stock gets 11)
      // Tier 1.2: update product costPrice to use LANDED cost (raw cost + landedCostPerUnit)
      //          so margin reports reflect the true cost of goods sold.
      if (newPurchase.status === "received") {
        for (const item of newPurchase.items) {
          if (item.productId) {
            const totalReceived = item.quantity + (item.freeQuantity || 0);
            // Tier 1.2 — landed cost per unit (0 if not allocated)
            const landedUnitCost = item.cost + (item.landedCostPerUnit || 0);
            // Update product: increment qty, update costPrice (with landed cost) + receivedDate + expiryDate
            await tx.product.update({
              where: { id: item.productId },
              data: {
                quantity: { increment: totalReceived },
                ...(item.cost > 0 && { costPrice: landedUnitCost }),
                receivedDate: new Date(),
                ...(item.expiryDate && { expiryDate: item.expiryDate }),
                // Phase 2: update retail/trade/wholesale prices if provided
                ...(item.retailPrice > 0 && { retailPrice: item.retailPrice }),
                ...(item.tradePrice > 0 && { tradePrice: item.tradePrice }),
                ...(item.wholesalePrice > 0 && { wholesalePrice: item.wholesalePrice }),
              },
            });
            await tx.stockHistory.create({
              data: {
                productId: item.productId,
                action: "received",
                quantity: totalReceived,
                reason: `Purchase ${refNo}${item.batchNumber ? ` · batch ${item.batchNumber}` : ""}${item.landedCostPerUnit > 0 ? ` · landed ₵${item.landedCostPerUnit.toFixed(2)}/unit` : ""}`,
                reference: refNo,
                purchaseId: newPurchase.id,
                userId: user.uid,
              },
            });
          }
        }
      }

      // Update supplier balance: if received but not fully paid, the outstanding
      // amount (total - amountPaid) is now owed to the supplier.
      if (newPurchase.supplierId && status === "received" && total > amountPaid) {
        const outstanding = total - amountPaid;
        await tx.supplier.update({
          where: { id: newPurchase.supplierId },
          data: { balance: { increment: outstanding } },
        });
      }

      // Audit log inside the transaction
      await auditLogTx(tx, {
        userId: user.uid,
        user: user.username,
        action: "CREATE",
        module: "purchase",
        details: `Purchase ${refNo} created — ${newPurchase.items.length} items, total ${total.toFixed(2)}, status: ${status}${newPurchase.supplier ? `, supplier: ${newPurchase.supplier.name}` : ""}`,
        severity: "info",
        ipAddress: ip,
        userAgent: req.headers.get("user-agent") || "",
      });

      return newPurchase;
    });

    return NextResponse.json({ success: true, purchase });
  } catch (e: any) {
    console.error("POST /api/purchases error:", e);
    // Surface FK violations as friendly 400s — defense in depth in case the
    // pre-check above somehow misses a case (e.g. race condition where the
    // supplier is deleted between the check and the create).
    if (e?.code === "P2003" && typeof e?.meta?.constraint === "string" && e.meta.constraint.includes("supplierid")) {
      return NextResponse.json(
        { error: "Invalid supplier", detail: "The selected supplier does not exist. Please re-select the supplier.", code: "FK_SUPPLIER" },
        { status: 400 }
      );
    }
    if (e?.code === "P2003") {
      return NextResponse.json(
        { error: "Reference error", detail: `A referenced record does not exist: ${e?.meta?.constraint}`, code: "FK_VIOLATION" },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: e?.message || "Failed to create purchase" }, { status: 500 });
  }
}
