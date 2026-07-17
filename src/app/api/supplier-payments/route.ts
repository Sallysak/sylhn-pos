import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requirePermission } from "@/lib/auth";
import { rateLimitApiRead, rateLimitApiWrite, rateLimitResponse, getClientIp } from "@/lib/rate-limit";
import { auditLogTx } from "@/lib/audit";

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
    const limit = Math.min(parseInt(searchParams.get("limit") || "200", 10), 1000);

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
      take: limit,
    });
    return NextResponse.json({ payments });
  } catch (e) {
    console.error("GET /api/supplier-payments error:", e);
    return NextResponse.json({ error: "Failed to fetch payments" }, { status: 500 });
  }
}

// POST /api/supplier-payments — record a supplier payment (transactional)
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

  if (!body.supplierId || !body.amount || Number(body.amount) <= 0) {
    return NextResponse.json({ error: "supplierId and a positive amount are required" }, { status: 400 });
  }

  try {
    const amount = Number(body.amount);

    const payment = await db.$transaction(async (tx) => {
      // Create the payment record
      const isScheduled = body.scheduledFor && body.status !== "completed";
      const newPayment = await tx.supplierPayment.create({
        data: {
          supplierId: body.supplierId,
          purchaseId: body.purchaseId || null,
          amount,
          paymentMode: String(body.paymentMode || "cash").slice(0, 32),
          reference: String(body.reference || "").slice(0, 200),
          notes: String(body.notes || "").slice(0, 2000),
          createdBy: user.uid,
          paymentDate: isScheduled ? new Date(0) : (body.paymentDate ? new Date(body.paymentDate) : new Date()),
          scheduledFor: body.scheduledFor ? new Date(body.scheduledFor) : null,
          status: isScheduled ? "scheduled" : "completed",
        },
        include: { supplier: { select: { name: true, code: true } } },
      });

      // Only update supplier balance + purchase amountPaid if NOT scheduled
      // (scheduled payments don't actually move money yet)
      if (!isScheduled) {
        // Decrement supplier balance (cannot go below 0 — clamp)
        const supplier = await tx.supplier.findUnique({ where: { id: body.supplierId }, select: { balance: true } });
        if (supplier) {
          const newBalance = Math.max(0, supplier.balance - amount);
          await tx.supplier.update({
            where: { id: body.supplierId },
            data: { balance: newBalance },
          });
        }

        // If linked to a purchase, increment its amountPaid
        if (body.purchaseId) {
          const purchase = await tx.purchase.findUnique({ where: { id: body.purchaseId }, select: { amountPaid: true, total: true, status: true } });
          if (purchase) {
            const newAmountPaid = purchase.amountPaid + amount;
            await tx.purchase.update({
              where: { id: body.purchaseId },
              data: {
                amountPaid: newAmountPaid,
                // Auto-mark purchase as fully paid if amountPaid >= total
                ...(newAmountPaid >= purchase.total && purchase.status !== "received" && { status: "received" }),
              },
            });
          }
        }
      }

      // Audit log inside the transaction
      await auditLogTx(tx, {
        userId: user.uid,
        user: user.username,
        action: isScheduled ? "SCHEDULE" : "CREATE",
        module: "accounts",
        details: isScheduled
          ? `Scheduled payment of GHS ${amount.toFixed(2)} to ${newPayment.supplier.name} (${newPayment.supplier.code}) for ${new Date(body.scheduledFor).toLocaleDateString()}`
          : `Supplier payment of GHS ${amount.toFixed(2)} to ${newPayment.supplier.name} (${newPayment.supplier.code})${body.purchaseId ? ` for purchase ${body.purchaseId}` : ""}`,
        severity: isScheduled ? "info" : "info",
        ipAddress: ip,
        userAgent: req.headers.get("user-agent") || "",
      });

      return newPayment;
    });

    return NextResponse.json({ success: true, payment });
  } catch (e: any) {
    console.error("POST /api/supplier-payments error:", e);
    return NextResponse.json({ error: e?.message || "Failed to create payment" }, { status: 500 });
  }
}
