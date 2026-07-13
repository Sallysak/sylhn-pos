import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requirePermission } from "@/lib/auth";
import { rateLimitApiRead, rateLimitApiWrite, rateLimitResponse, getClientIp } from "@/lib/rate-limit";

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

// PUT /api/sales/[id] — update (void needs canVoid permission)
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

    if (body.status === "voided") {
      // Voiding requires canVoid permission
      try { requirePermission(user.role, "canVoid"); } catch (e) { return e as Response; }

      const sale = await db.sale.findUnique({
        where: { id },
        include: { items: true },
      });
      if (!sale) return NextResponse.json({ error: "Sale not found" }, { status: 404 });
      if (sale.status === "voided") {
        return NextResponse.json({ error: "Sale already voided" }, { status: 400 });
      }

      // Restore stock + create linked StockHistory entries
      for (const item of sale.items) {
        if (item.productId) {
          await db.product.update({
            where: { id: item.productId },
            data: { quantity: { increment: item.quantity } },
          });
          await db.stockHistory.create({
            data: {
              productId: item.productId,
              action: "returned",
              quantity: item.quantity,
              reason: `Void of ${sale.invoiceNumber}`,
              reference: sale.invoiceNumber,
              saleId: sale.id,
              userId: user.uid,
            },
          });
        }
      }

      const updated = await db.sale.update({
        where: { id },
        data: {
          status: "voided",
          voidedAt: new Date(),
          voidedById: user.uid,
        },
        include: { items: true },
      });

      await db.auditLog.create({
        data: {
          userId: user.uid,
          user: user.username,
          action: "VOID",
          module: "sales",
          details: `Sale ${sale.invoiceNumber} voided`,
          severity: "warning",
        },
      });

      return NextResponse.json({ success: true, sale: updated });
    }

    if (body.status === "refunded") {
      // Refunding requires canVoid permission (same trust level)
      try { requirePermission(user.role, "canVoid"); } catch (e) { return e as Response; }

      const sale = await db.sale.findUnique({
        where: { id },
        include: { items: true },
      });
      if (!sale) return NextResponse.json({ error: "Sale not found" }, { status: 404 });
      if (sale.status === "refunded") {
        return NextResponse.json({ error: "Sale already refunded" }, { status: 400 });
      }
      if (sale.status === "voided") {
        return NextResponse.json({ error: "Cannot refund a voided sale" }, { status: 400 });
      }

      // Restore stock for each item + create linked StockHistory entries
      for (const item of sale.items) {
        if (item.productId) {
          await db.product.update({
            where: { id: item.productId },
            data: { quantity: { increment: item.quantity } },
          });
          await db.stockHistory.create({
            data: {
              productId: item.productId,
              action: "returned",
              quantity: item.quantity,
              reason: `Refund of ${sale.invoiceNumber}`,
              reference: sale.invoiceNumber,
              saleId: sale.id,
              userId: user.uid,
            },
          });
        }
      }

      const updated = await db.sale.update({
        where: { id },
        data: {
          status: "refunded",
          refundedAt: new Date(),
        },
        include: { items: true, customer: true, cashier: { select: { fullName: true, username: true } } },
      });

      await db.auditLog.create({
        data: {
          userId: user.uid,
          user: user.username,
          action: "REFUND",
          module: "sales",
          details: `Sale ${sale.invoiceNumber} refunded — ${sale.items.length} items, total ${sale.total} restored to stock`,
          severity: "critical",
        },
      });

      return NextResponse.json({ success: true, sale: updated });
    }

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
  } catch (e) {
    console.error("PUT /api/sales/[id] error:", e);
    return NextResponse.json({ error: "Failed to update sale" }, { status: 500 });
  }
}

// DELETE /api/sales/[id] — hard delete (admin only)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { await requirePermission((await requireAuth()).role, "canVoid"); } catch (e) { return e as Response; }

  const ip = getClientIp(req);
  const rl = rateLimitApiWrite(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  try {
    const { id } = await params;
    await db.sale.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("DELETE /api/sales/[id] error:", e);
    return NextResponse.json({ error: "Failed to delete sale" }, { status: 500 });
  }
}
