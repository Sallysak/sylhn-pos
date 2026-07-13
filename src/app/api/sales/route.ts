import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/sales — list sales (with optional date filter)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const cashier = searchParams.get("cashier");
    const limit = parseInt(searchParams.get("limit") || "100", 10);

    const where: any = {};
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }
    if (cashier) where.cashierName = cashier;

    const sales = await db.sale.findMany({
      where,
      include: { items: true },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return NextResponse.json({ sales });
  } catch (e) {
    console.error("GET /api/sales error:", e);
    return NextResponse.json({ error: "Failed to fetch sales" }, { status: 500 });
  }
}

// POST /api/sales — create a new sale
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Generate invoice number if not provided
    const invoiceNumber = body.invoiceNumber || `INV-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const sale = await db.sale.create({
      data: {
        invoiceNumber,
        customerName: body.customerName || "",
        cashierName: body.cashierName || "Unknown",
        subtotal: Number(body.subtotal) || 0,
        discount: Number(body.discount) || 0,
        discountPct: Number(body.discountPct) || 0,
        taxRate: Number(body.taxRate) || 0,
        taxAmount: Number(body.taxAmount) || 0,
        total: Number(body.total) || 0,
        amountPaid: Number(body.amountPaid) || 0,
        change: Number(body.change) || 0,
        paymentMethod: body.paymentMethod || "cash",
        paymentRef: body.paymentRef || "",
        status: body.status || "completed",
        notes: body.notes || "",
        items: {
          create: (body.items || []).map((item: any) => ({
            productId: item.productId || null,
            sku: item.sku,
            name: item.name,
            price: Number(item.price) || 0,
            quantity: Number(item.quantity) || 1,
            unit: item.unit || "each",
            discount: Number(item.discount) || 0,
            taxable: item.taxable !== false,
            total: Number(item.total) || 0,
          })),
        },
      },
      include: { items: true },
    });

    // Decrement stock for each item
    for (const item of sale.items) {
      if (item.productId) {
        await db.product.update({
          where: { id: item.productId },
          data: { quantity: { decrement: item.quantity } },
        });
        await db.stockHistory.create({
          data: {
            productId: item.productId,
            action: "sold",
            quantity: -item.quantity,
            reason: `Sale ${invoiceNumber}`,
            reference: invoiceNumber,
          },
        });
      }
    }

    return NextResponse.json({ success: true, sale });
  } catch (e) {
    console.error("POST /api/sales error:", e);
    return NextResponse.json({ error: "Failed to create sale" }, { status: 500 });
  }
}
