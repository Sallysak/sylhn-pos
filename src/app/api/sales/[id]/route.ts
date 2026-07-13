import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/sales/[id] — get one sale by ID or invoice number
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    // Try by ID first, then by invoice number
    let sale = await db.sale.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!sale) {
      sale = await db.sale.findUnique({
        where: { invoiceNumber: id },
        include: { items: true },
      });
    }
    if (!sale) return NextResponse.json({ error: "Sale not found" }, { status: 404 });
    return NextResponse.json({ sale });
  } catch (e) {
    console.error("GET /api/sales/[id] error:", e);
    return NextResponse.json({ error: "Failed to fetch sale" }, { status: 500 });
  }
}

// PUT /api/sales/[id] — update (e.g. void)
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();

    if (body.status === "voided") {
      // Voiding: restore stock
      const sale = await db.sale.findUnique({
        where: { id },
        include: { items: true },
      });
      if (!sale) return NextResponse.json({ error: "Sale not found" }, { status: 404 });
      if (sale.status === "voided") {
        return NextResponse.json({ error: "Sale already voided" }, { status: 400 });
      }

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
            },
          });
        }
      }

      const updated = await db.sale.update({
        where: { id },
        data: {
          status: "voided",
          voidedAt: new Date(),
          voidedBy: body.voidedBy || "system",
        },
        include: { items: true },
      });
      return NextResponse.json({ success: true, sale: updated });
    }

    const updated = await db.sale.update({
      where: { id },
      data: {
        ...(body.customerName !== undefined && { customerName: body.customerName }),
        ...(body.notes !== undefined && { notes: body.notes }),
        ...(body.paymentMethod && { paymentMethod: body.paymentMethod }),
        ...(body.paymentRef !== undefined && { paymentRef: body.paymentRef }),
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
  try {
    const { id } = await params;
    await db.sale.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("DELETE /api/sales/[id] error:", e);
    return NextResponse.json({ error: "Failed to delete sale" }, { status: 500 });
  }
}
