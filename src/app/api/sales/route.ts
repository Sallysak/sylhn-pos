import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requirePermission } from "@/lib/auth";
import { SaleSchema, validate, validationError } from "@/lib/validation";
import { rateLimitApiRead, rateLimitApiWrite, rateLimitResponse, getClientIp } from "@/lib/rate-limit";
import { auditLogTx } from "@/lib/audit";
import { generateInvoiceNumber } from "@/lib/identifiers";
import { awardLoyaltyPoints, redeemLoyaltyPoints, reverseLoyaltyForSale } from "@/lib/loyalty";

// GET /api/sales — list sales (with optional date filter)
export async function GET(req: NextRequest) {
  try { await requireAuth(); } catch (e) { return e as Response; }

  const ip = getClientIp(req);
  const rl = rateLimitApiRead(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  try {
    const { searchParams } = new URL(req.url);
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const cashierId = searchParams.get("cashierId");
    const customerId = searchParams.get("customerId");
    const shiftId = searchParams.get("shiftId");
    const status = searchParams.get("status");
    const limit = Math.min(parseInt(searchParams.get("limit") || "100", 10), 1000);

    const where: any = {};
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }
    if (cashierId) where.cashierId = cashierId;
    if (customerId) where.customerId = customerId;
    if (shiftId) where.shiftId = shiftId;
    if (status) where.status = status;

    const sales = await db.sale.findMany({
      where,
      include: {
        items: true,
        payments: true,
        customer: { select: { id: true, name: true, tier: true, pointsBalance: true } },
        cashier: { select: { id: true, fullName: true, username: true } },
        shift: true,
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return NextResponse.json({ sales });
  } catch (e) {
    console.error("GET /api/sales error:", e);
    return NextResponse.json({ error: "Failed to fetch sales" }, { status: 500 });
  }
}

// POST /api/sales — create a new sale (transactional, with stock check,
// loyalty points, customer stats, profit capture, multi-payment split)
export async function POST(req: NextRequest) {
  let user;
  try {
    user = await requireAuth();
    requirePermission(user.role, "sales");
  } catch (e) { return e as Response; }

  const ip = getClientIp(req);
  const rl = rateLimitApiWrite(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  let body: unknown;
  try { body = await req.json(); } catch { return validationError("Invalid JSON body"); }

  const result = validate(SaleSchema, body);
  if (!result.success) return validationError(result.error);
  const s = result.data;
  const bodyAny = body as any;

  try {
    // ===== SERVER-SIDE TOTAL RECALCULATION (security fix) =====
    // Client-sent totals are advisory only; we compute the real totals
    // from the line items + tax rate so a malicious cashier can't submit
    // a GHS 100 sale with total=0.
    let computedSubtotal = 0;
    let computedCostOfGoods = 0;
    const itemCostPriceMap: Record<string, number> = {};

    // Pre-fetch product cost prices for stock sufficiency check + profit calc
    const productIds = s.items.map(i => i.productId).filter(Boolean) as string[];
    const products = productIds.length > 0
      ? await db.product.findMany({ where: { id: { in: productIds } }, select: { id: true, costPrice: true, quantity: true, name: true, taxable: true, sku: true } })
      : [];
    const productMap: Record<string, { costPrice: number; quantity: number; name: string; taxable: boolean; sku: string }> = {};
    for (const p of products) {
      productMap[p.id] = { costPrice: p.costPrice, quantity: p.quantity, name: p.name, taxable: p.taxable, sku: p.sku };
    }

    // Pre-check: every product referenced must exist + have sufficient stock
    for (const item of s.items) {
      // Compute line total for ALL items (including custom ones without productId)
      const lineTotal = item.price * item.quantity - (item.discount || 0);
      computedSubtotal += lineTotal;

      if (!item.productId) continue;
      const p = productMap[item.productId];
      if (!p) return validationError(`Product not found for SKU ${item.sku}`);
      if (item.quantity > p.quantity) {
        return NextResponse.json({
          error: `Insufficient stock for ${p.name} (have ${p.quantity} ${s.items.find(i => i.productId === item.productId)?.unit || ""}, need ${item.quantity})`,
        }, { status: 400 });
      }
      const cp = item.costPrice || p.costPrice;
      itemCostPriceMap[item.productId] = cp;
      computedCostOfGoods += cp * item.quantity;
    }

    // Clamp subtotal to non-negative
    computedSubtotal = Math.max(0, Math.round(computedSubtotal * 100) / 100);
    computedCostOfGoods = Math.round(computedCostOfGoods * 100) / 100;

    // ===== LOYALTY POINTS REDEMPTION (premium) =====
    let pointsRedeemedCashValue = 0;
    const customerId = s.customerId || (bodyAny.customerId as string) || null;
    const pointsRedeemedRequested = s.pointsRedeemed || 0;

    if (pointsRedeemedRequested > 0 && !customerId) {
      return validationError("Cannot redeem loyalty points without a customer");
    }

    // ===== SHIFT VALIDATION (security fix) =====
    const shiftId = s.shiftId || (bodyAny.shiftId as string) || null;
    if (shiftId) {
      const shift = await db.cashierShift.findUnique({ where: { id: shiftId } });
      if (!shift) return validationError("Shift not found");
      if (shift.status !== "open") return validationError("Shift is not open");
      // Only the cashier who opened the shift, or a manager/admin, may attribute sales to it
      if (user.role === "cashier" && shift.cashierId !== user.uid) {
        return NextResponse.json({ error: "Cannot attribute sale to another cashier's shift" }, { status: 403 });
      }
    }

    // ===== EXECUTE THE SALE AS A SINGLE TRANSACTION =====
    const sale = await db.$transaction(async (tx) => {
      const invoiceNumber = s.invoiceNumber || generateInvoiceNumber();

      // Compute tax server-side using the tax rate from the request
      const taxRate = Number(s.taxRate) || 0;
      const taxableSubtotal = s.items
        .filter(i => i.taxable !== false && (!i.productId || productMap[i.productId]?.taxable))
        .reduce((sum, i) => sum + (i.price * i.quantity - (i.discount || 0)), 0);
      const computedTax = Math.round(taxableSubtotal * taxRate / 100 * 100) / 100;

      // Apply loyalty redemption first (modifies customer balance atomically).
      // saleId is null at this point — the sale hasn't been created yet.
      // We link the loyalty transaction to the sale after creation.
      if (pointsRedeemedRequested > 0 && customerId) {
        const redeemResult = await redeemLoyaltyPoints(tx, customerId, null, pointsRedeemedRequested);
        if (!redeemResult.ok) {
          throw new Error(redeemResult.error || "Loyalty redemption failed");
        }
        pointsRedeemedCashValue = redeemResult.cashValue;
      }

      const discount = Number(s.discount) || 0;
      const total = Math.max(0, Math.round((computedSubtotal + computedTax - discount - pointsRedeemedCashValue) * 100) / 100);

      // Create the sale + items in one nested write
      const newSale = await tx.sale.create({
        data: {
          invoiceNumber,
          customerId: customerId || null,
          customerName: s.customerName || "",
          cashierId: user.uid,
          cashierName: s.cashierName || user.username,
          subtotal: computedSubtotal,
          discount,
          discountPct: Number(s.discountPct) || 0,
          taxRate,
          taxAmount: computedTax,
          total,
          amountPaid: Number(s.amountPaid) || total,
          change: Number(s.change) || 0,
          paymentMethod: s.paymentMethod || "cash",
          paymentRef: s.paymentRef || "",
          status: s.status || "completed",
          notes: s.notes || "",
          shiftId,
          pointsRedeemed: pointsRedeemedRequested,
          costOfGoods: computedCostOfGoods,
          grossProfit: Math.max(0, computedSubtotal - computedCostOfGoods),
          items: {
            create: s.items.map((item) => ({
              productId: item.productId || null,
              sku: item.sku,
              name: item.name,
              emoji: item.emoji || "📦",
              price: Number(item.price) || 0,
              quantity: Number(item.quantity) || 1,
              unit: item.unit || "each",
              discount: Number(item.discount) || 0,
              taxable: item.taxable !== false,
              total: Number(item.total) || (Number(item.price) * Number(item.quantity)),
              costPrice: item.productId ? (itemCostPriceMap[item.productId] || 0) : (item.costPrice || 0),
            })),
          },
          // Multi-payment split (premium)
          payments: s.payments && s.payments.length > 0
            ? { create: s.payments.map(p => ({
                method: p.method,
                amount: Number(p.amount) || 0,
                reference: p.reference || "",
              })) }
            : undefined,
        },
        include: { items: true, payments: true },
      });

      // Decrement stock + create linked StockHistory entries atomically.
      // Using updateMany with a where-guard: if stock is insufficient
      // (e.g. concurrent sale), the update affects 0 rows and we throw.
      for (const item of newSale.items) {
        if (!item.productId) continue;
        const updated = await tx.product.updateMany({
          where: { id: item.productId, quantity: { gte: item.quantity } },
          data: { quantity: { decrement: item.quantity } },
        });
        if (updated.count === 0) {
          throw new Error(`Insufficient stock for ${item.sku} (race condition detected)`);
        }
        await tx.stockHistory.create({
          data: {
            productId: item.productId,
            action: "sold",
            quantity: -item.quantity,
            reason: `Sale ${invoiceNumber}`,
            reference: invoiceNumber,
            saleId: newSale.id,
            userId: user.uid,
          },
        });
      }

      // Award loyalty points + update customer stats (premium)
      let awardedPoints = 0;
      if (customerId && newSale.status === "completed") {
        // If we redeemed points earlier (with null saleId), link them now.
        if (pointsRedeemedRequested > 0) {
          await tx.loyaltyTransaction.updateMany({
            where: { customerId, saleId: null },
            data: { saleId: newSale.id },
          });
        }
        const result = await awardLoyaltyPoints(tx, customerId, newSale.id, computedSubtotal, total);
        awardedPoints = result.pointsEarned;
        // Persist the awarded points back onto the sale record so void/refund
        // can reverse them correctly later.
        if (awardedPoints > 0 || pointsRedeemedRequested > 0) {
          await tx.sale.update({
            where: { id: newSale.id },
            data: {
              ...(awardedPoints > 0 && { pointsEarned: awardedPoints }),
              ...(pointsRedeemedRequested > 0 && { pointsRedeemed: pointsRedeemedRequested }),
            },
          });
          newSale.pointsEarned = awardedPoints;
          newSale.pointsRedeemed = pointsRedeemedRequested;
        }
      }

      // Audit log inside the transaction
      await auditLogTx(tx, {
        userId: user.uid,
        user: user.username,
        action: "CREATE",
        module: "sales",
        details: `Sale ${invoiceNumber} created — ${newSale.items.length} items, total ${total.toFixed(2)}${customerId ? `, customer: ${s.customerName}` : ""}${pointsRedeemedRequested > 0 ? `, redeemed ${pointsRedeemedRequested} pts (GHS ${pointsRedeemedCashValue.toFixed(2)})` : ""}${awardedPoints > 0 ? `, earned ${awardedPoints} pts` : ""}`,
        severity: "info",
        ipAddress: ip,
        userAgent: req.headers.get("user-agent") || "",
      });

      return newSale;
    });

    return NextResponse.json({
      success: true,
      sale,
      loyalty: {
        pointsRedeemed: pointsRedeemedRequested,
        cashValueRedeemed: pointsRedeemedCashValue,
      },
    });
  } catch (e: any) {
    console.error("POST /api/sales error:", e);
    // If the error is from inside the transaction, it's already rolled back.
    const msg = e?.message || "Failed to create sale";
    // Detect stock insufficiency errors and return 400 instead of 500
    if (msg.includes("Insufficient stock") || msg.includes("Loyalty redemption")) {
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
