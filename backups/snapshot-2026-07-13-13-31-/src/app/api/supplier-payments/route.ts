import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requirePermission } from "@/lib/auth";
import { rateLimitApiRead, rateLimitApiWrite, rateLimitResponse, getClientIp } from "@/lib/rate-limit";

// GET /api/supplier-payments — list supplier payments
export async function GET(req: NextRequest) {
  try { await requireAuth(); } catch (e) { return e as Response; }

  const ip = getClientIp(req);
  const rl = rateLimitApiRead(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  try {
    const { searchParams } = new URL(req.url);
    const supplierId = searchParams.get("supplierId");
    const purchaseId = searchParams.get("purchaseId");

    const where: any = {};
    if (supplierId) where.supplierId = supplierId;
    if (purchaseId) where.purchaseId = purchaseId;

    const payments = await db.supplierPayment.findMany({
      where,
      include: {
        supplier: { select: { id: true, name: true, code: true } },
        purchase: { select: { id: true, refNo: true } },
        user: { select: { id: true, fullName: true, username: true } },
      },
      orderBy: { paymentDate: "desc" },
    });
    return NextResponse.json({ payments });
  } catch (e) {
    console.error("GET /api/supplier-payments error:", e);
    return NextResponse.json({ error: "Failed to fetch payments" }, { status: 500 });
  }
}

// POST /api/supplier-payments — record a supplier payment
export async function POST(req: NextRequest) {
  let user;
  try {
    user = await requireAuth();
    requirePermission(user.role, "financeOps");
  } catch (e) { return e as Response; }

  const ip = getClientIp(req);
  const rl = rateLimitApiWrite(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  try {
    if (!body.supplierId || !body.amount) {
      return NextResponse.json({ error: "supplierId and amount are required" }, { status: 400 });
    }

    const payment = await db.supplierPayment.create({
      data: {
        supplierId: body.supplierId,
        purchaseId: body.purchaseId || null,
        amount: Number(body.amount) || 0,
        paymentMode: String(body.paymentMode || "cash").slice(0, 32),
        reference: String(body.reference || "").slice(0, 200),
        notes: String(body.notes || "").slice(0, 2000),
        createdBy: user.uid,
        paymentDate: body.paymentDate ? new Date(body.paymentDate) : new Date(),
      },
      include: { supplier: { select: { name: true, code: true } } },
    });

    // Update supplier balance (reduce what's owed)
    await db.supplier.update({
      where: { id: body.supplierId },
      data: { balance: { decrement: Number(body.amount) || 0 } },
    });

    // If linked to a purchase, update its amountPaid
    if (body.purchaseId) {
      const purchase = await db.purchase.findUnique({ where: { id: body.purchaseId } });
      if (purchase) {
        await db.purchase.update({
          where: { id: body.purchaseId },
          data: { amountPaid: { increment: Number(body.amount) || 0 } },
        });
      }
    }

    await db.auditLog.create({
      data: {
        userId: user.uid,
        user: user.username,
        action: "CREATE",
        module: "accounts",
        details: `Supplier payment of ${payment.amount} to ${payment.supplier.name} (${payment.supplier.code})`,
        severity: "info",
      },
    });

    return NextResponse.json({ success: true, payment });
  } catch (e) {
    console.error("POST /api/supplier-payments error:", e);
    return NextResponse.json({ error: "Failed to create payment" }, { status: 500 });
  }
}
