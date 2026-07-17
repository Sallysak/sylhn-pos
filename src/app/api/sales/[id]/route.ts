import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requirePermission } from "@/lib/auth";
import { rateLimitApiRead, rateLimitApiWrite, rateLimitResponse, getClientIp } from "@/lib/rate-limit";
import { auditLogTx } from "@/lib/audit";
import { reverseLoyaltyForSale } from "@/lib/loyalty";

// GET /api/sales/[id] — get one sale by ID or invoice number
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { await requireAuth(); } catch (e) { return e as Response; }

  const ip = getClientIp(req);
  const rl = rateLimitApiRead(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  try {
    const { id } = await params;
    let sale = await db.sale.findUnique({
      where: { id },
      include: {
        items: true,
        payments: true,
        customer: true,
        cashier: { select: { id: true, fullName: true, username: true } },
        voidedBy: { select: { id: true, fullName: true, username: true } },
        shift: true,
      },
    });
    if (!sale) {
      sale = await db.sale.findUnique({
        where: { invoiceNumber: id },
        include: {
          items: true,
          payments: true,
          customer: true,
          cashier: { select: { id: true, fullName: true, username: true } },
          voidedBy: { select: { id: true, fullName: true, username: true } },
          shift: true,
        },
      });
    }
    if (!sale) return NextResponse.json({ error: "Sale not found" }, { status: 404 });
    return NextResponse.json({ sale });
  } catch (e) {
    console.error("GET /api/sales/[id] error:", e);
    return NextResponse.json({ error: "Failed to fetch sale" }, { status: 500 });
  }
}

// PUT /api/sales/[id] — update (void/refund needs canVoid permission)
// Transactional: stock restoration + loyalty reversal + audit log all atomic.
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let user;
  try { user = await requireAuth(); } catch (e) { return e as Response; }

  const ip = getClientIp(req);
  const rl = rateLimitApiWrite(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  try {
    const { id } = await params;

    if (body.status === "voided" || body.status === "refunded") {
      // Void/refund requires canVoid permission
      try { requirePermission(user.role, "canVoid"); } catch (e) { return e as Response; }

      const action = body.status === "voided" ? "VOID" : "REFUND";
      const severity = body.status === "voided" ? "warning" : "critical";

      const updated = await db.$transaction(async (tx) => {
        // Lock the sale by reading it inside the transaction
        const sale = await tx.sale.findUnique({
          where: { id },
          include: { items: true },
        });
        if (!sale) throw new Error("Sale not found");

        // Idempotency check — already voided/refunded?
        if (sale.status === "voided") throw new Error("Sale already voided");
        if (sale.status === "refunded") throw new Error("Sale already refunded");
        if (body.status === "refunded" && sale.status === "voided") {
          throw new Error("Cannot refund a voided sale");
        }

        // Restore stock for each item + create linked StockHistory entries
        for (const item of sale.items) {
          if (item.productId) {
            await tx.product.update({
              where: { id: item.productId },
              data: { quantity: { increment: item.quantity } },
            });
            await tx.stockHistory.create({
              data: {
                productId: item.productId,
                action: "returned",
                quantity: item.quantity,
                reason: `${action === "VOID" ? "Void" : "Refund"} of ${sale.invoiceNumber}`,
                reference: sale.invoiceNumber,
                saleId: sale.id,
                userId: user.uid,
              },
            });
          }
        }

        // Reverse loyalty points (premium)
        if (sale.customerId) {
          await reverseLoyaltyForSale(
            tx,
            sale.id,
            sale.total,
            sale.pointsEarned,
            sale.pointsRedeemed,
            sale.customerId,
          );
        }

        // Update sale status
        const updateData: any = { status: body.status };
        if (body.status === "voided") {
          updateData.voidedAt = new Date();
          updateData.voidedById = user.uid;
        } else {
          updateData.refundedAt = new Date();
        }

        const updatedSale = await tx.sale.update({
          where: { id },
          data: updateData,
          include: {
            items: true,
            payments: true,
            customer: true,
            cashier: { select: { fullName: true, username: true } },
          },
        });

        // Audit log inside the transaction
        await auditLogTx(tx, {
          userId: user.uid,
          user: user.username,
          action,
          module: "sales",
          details: `Sale ${sale.invoiceNumber} ${body.status} — ${sale.items.length} items, total ${sale.total.toFixed(2)} restored to stock${sale.customerId ? ", loyalty reversed" : ""}`,
          severity,
          ipAddress: ip,
          userAgent: req.headers.get("user-agent") || "",
        });

        return updatedSale;
      });

      return NextResponse.json({ success: true, sale: updated });
    }

    // Generic update (metadata only — no status change)
    const updated = await db.sale.update({
      where: { id },
      data: {
        ...(body.customerName !== undefined && { customerName: String(body.customerName).slice(0, 200) }),
        ...(body.notes !== undefined && { notes: String(body.notes).slice(0, 2000) }),
        ...(body.paymentMethod && { paymentMethod: String(body.paymentMethod).slice(0, 32) }),
        ...(body.paymentRef !== undefined && { paymentRef: String(body.paymentRef).slice(0, 128) }),
      },
      include: { items: true },
    });
    return NextResponse.json({ success: true, sale: updated });
  } catch (e: any) {
    console.error("PUT /api/sales/[id] error:", e);
    const msg = e?.message || "Failed to update sale";
    if (msg.includes("not found") || msg.includes("already")) {
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// DELETE /api/sales/[id] — hard delete (admin only) + audit log
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let user;
  try { user = await requirePermission((await requireAuth()).role, "canVoid"); } catch (e) { return e as Response; }

  const ip = getClientIp(req);
  const rl = rateLimitApiWrite(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  try {
    const { id } = await params;
    const sale = await db.sale.findUnique({ where: { id }, select: { invoiceNumber: true, total: true } });
    if (!sale) return NextResponse.json({ error: "Sale not found" }, { status: 404 });

    await db.sale.delete({ where: { id } });

    // Audit log (fire-and-forget outside transaction — deletion already succeeded)
    await db.auditLog.create({
      data: {
        userId: user.uid,
        user: user.username,
        action: "DELETE",
        module: "sales",
        details: `Sale ${sale.invoiceNumber} (total ${sale.total.toFixed(2)}) hard-deleted by admin`,
        severity: "critical",
        ipAddress: ip,
        userAgent: req.headers.get("user-agent") || "",
      },
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("DELETE /api/sales/[id] error:", e);
    return NextResponse.json({ error: "Failed to delete sale" }, { status: 500 });
  }
}
