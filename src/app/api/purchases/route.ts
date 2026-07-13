import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type"); // purchase | order
    const status = searchParams.get("status");
    const supplierId = searchParams.get("supplierId");
    const limit = parseInt(searchParams.get("limit") || "100", 10);

    const where: any = {};
    if (type) where.type = type;
    if (status) where.status = status;
    if (supplierId) where.supplierId = supplierId;

    const purchases = await db.purchase.findMany({
      where,
      include: { items: true, supplier: true },
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
  try {
    const body = await req.json();
    const refNo = body.refNo || `PUR-${Date.now()}`;

    const purchase = await db.purchase.create({
      data: {
        refNo,
        type: body.type || "purchase",
        supplierId: body.supplierId || null,
        supplierName: body.supplierName || "",
        status: body.status || "received",
        subtotal: Number(body.subtotal) || 0,
        discount: Number(body.discount) || 0,
        taxAmount: Number(body.taxAmount) || 0,
        total: Number(body.total) || 0,
        amountPaid: Number(body.amountPaid) || 0,
        notes: body.notes || "",
        createdBy: body.createdBy || "system",
        receivedAt: body.receivedAt ? new Date(body.receivedAt) : (body.status === "received" ? new Date() : null),
        items: {
          create: (body.items || []).map((item: any) => ({
            productId: item.productId || null,
            partNo: item.partNo,
            details: item.details,
            quantity: Number(item.quantity) || 1,
            cost: Number(item.cost) || 0,
            tax: item.tax !== false,
            total: Number(item.total) || 0,
            expiryDate: item.expiryDate ? new Date(item.expiryDate) : null,
          })),
        },
      },
      include: { items: true },
    });

    // If received, increment stock
    if (purchase.status === "received") {
      for (const item of purchase.items) {
        if (item.productId) {
          await db.product.update({
            where: { id: item.productId },
            data: {
              quantity: { increment: item.quantity },
              ...(item.cost > 0 && { costPrice: item.cost }),
            },
          });
          await db.stockHistory.create({
            data: {
              productId: item.productId,
              action: "received",
              quantity: item.quantity,
              reason: `Purchase ${refNo}`,
              reference: refNo,
            },
          });
        }
      }
    }

    return NextResponse.json({ success: true, purchase });
  } catch (e) {
    console.error("POST /api/purchases error:", e);
    return NextResponse.json({ error: "Failed to create purchase" }, { status: 500 });
  }
}
