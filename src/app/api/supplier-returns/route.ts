import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requirePermission } from "@/lib/auth";
import { rateLimitApiRead, rateLimitApiWrite, rateLimitResponse, getClientIp } from "@/lib/rate-limit";
import { auditLogTx } from "@/lib/audit";

// GET /api/supplier-returns?supplierId=xxx&status=pending&limit=100
export async function GET(req: NextRequest) {
  try { await requireAuth(); } catch (e) { return e as Response; }

  const ip = getClientIp(req);
  const rl = rateLimitApiRead(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  try {
    const { searchParams } = new URL(req.url);
    const supplierId = searchParams.get("supplierId");
    const status = searchParams.get("status");
    const limit = Math.min(parseInt(searchParams.get("limit") || "200", 10), 1000);

    const where: any = {};
    if (supplierId) where.supplierId = supplierId;
    if (status) where.status = status;

    const returns = await db.supplierReturn.findMany({
      where,
      include: {
        supplier: { select: { id: true, name: true, code: true } },
        purchase: { select: { id: true, refNo: true } },
        creditNote: { select: { id: true, creditNoteNo: true, amount: true } },
        items: true,
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return NextResponse.json({ returns });
  } catch (e) {
    console.error("GET /api/supplier-returns error:", e);
    return NextResponse.json({ error: "Failed to fetch supplier returns" }, { status: 500 });
  }
}

// POST /api/supplier-returns
// Create a return-to-supplier. Decrements stock + creates an audit trail.
// Body: {
//   supplierId, purchaseId?, returnType, notes?,
//   items: [{ productId, partNo, details, quantity, cost, reason? }]
// }
// The return starts in "pending" status. When goods are shipped, status → "shipped".
// When the supplier confirms receipt, status → "received_by_supplier".
// When the supplier issues a credit note, link it via PUT and status → "credit_issued".
export async function POST(req: NextRequest) {
  let user;
  try {
    user = await requireAuth();
    requirePermission(user.role, "purchase");
  } catch (e) { return e as Response; }

  const ip = getClientIp(req);
  const rl = rateLimitApiWrite(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  if (!body.supplierId || !Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json({
      error: "supplierId and a non-empty items array are required",
    }, { status: 400 });
  }

  try {
    const ret = await db.$transaction(async (tx) => {
      // Generate return number: RTN-YYYY-NNNNNN
      const year = new Date().getFullYear();
      const countThisYear = await tx.supplierReturn.count({
        where: { returnNo: { startsWith: `RTN-${year}-` } },
      });
      const returnNo = `RTN-${year}-${String(countThisYear + 1).padStart(6, "0")}`;

      // Compute total value + decrement stock for each item
      let totalValue = 0;
      const itemRows: any[] = [];
      for (const it of body.items) {
        const qty = Number(it.quantity) || 0;
        const cost = Number(it.cost) || 0;
        const lineTotal = qty * cost;
        totalValue += lineTotal;

        // Decrement product stock (cannot go below 0)
        if (it.productId) {
          const product = await tx.product.findUnique({
            where: { id: it.productId },
            select: { id: true, name: true, quantity: true, sku: true },
          });
          if (product) {
            const newQty = Math.max(0, product.quantity - qty);
            await tx.product.update({
              where: { id: it.productId },
              data: { quantity: newQty },
            });
            // StockHistory entry — 'damaged' action type represents the outbound
            await tx.stockHistory.create({
              data: {
                productId: it.productId,
                action: "damaged", // closest existing action type for outbound returns
                quantity: -qty,
                reason: `Return to supplier · ${returnNo} · ${body.returnType || "damaged"}`,
                reference: returnNo,
                purchaseId: body.purchaseId || null,
                userId: user.uid,
              },
            });
          }
        }

        itemRows.push({
          productId: it.productId || null,
          partNo: String(it.partNo || "").slice(0, 100),
          details: String(it.details || "").slice(0, 200),
          quantity: qty,
          cost,
          total: lineTotal,
          reason: String(it.reason || body.returnType || "damaged").slice(0, 100),
        });
      }

      const newReturn = await tx.supplierReturn.create({
        data: {
          returnNo,
          supplierId: body.supplierId,
          purchaseId: body.purchaseId || null,
          returnType: String(body.returnType || "damaged").slice(0, 30),
          status: "pending",
          notes: String(body.notes || "").slice(0, 2000),
          totalValue: Math.round(totalValue * 100) / 100,
          createdById: user.uid,
          items: { create: itemRows },
        },
        include: {
          supplier: { select: { name: true, code: true } },
          items: true,
        },
      });

      await auditLogTx(tx, {
        userId: user.uid,
        user: user.username,
        action: "CREATE",
        module: "purchase",
        details: `Supplier return ${returnNo} created — ${newReturn.supplier?.name} · ${itemRows.length} items · total value: GHS ${totalValue.toFixed(2)} · type: ${newReturn.returnType}`,
        severity: "warning",
        ipAddress: ip,
        userAgent: req.headers.get("user-agent") || "",
      });

      return newReturn;
    });

    return NextResponse.json({ success: true, return: ret });
  } catch (e: any) {
    console.error("POST /api/supplier-returns error:", e);
    return NextResponse.json({ error: e?.message || "Failed to create supplier return" }, { status: 500 });
  }
}
