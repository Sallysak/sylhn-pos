import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requirePermission } from "@/lib/auth";
import { SaleSchema, validate, validationError } from "@/lib/validation";
import { rateLimitApiRead, rateLimitApiWrite, rateLimitResponse, getClientIp } from "@/lib/rate-limit";

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
    const cashier = searchParams.get("cashier");
    const limit = Math.min(parseInt(searchParams.get("limit") || "100", 10), 1000);

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

  try {
    const invoiceNumber = s.invoiceNumber || `INV-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const sale = await db.sale.create({
      data: {
        invoiceNumber,
        customerName: s.customerName || "",
        cashierName: s.cashierName,
        subtotal: Number(s.subtotal) || 0,
        discount: Number(s.discount) || 0,
        discountPct: Number(s.discountPct) || 0,
        taxRate: Number(s.taxRate) || 0,
        taxAmount: Number(s.taxAmount) || 0,
        total: Number(s.total) || 0,
        amountPaid: Number(s.amountPaid) || 0,
        change: Number(s.change) || 0,
        paymentMethod: s.paymentMethod || "cash",
        paymentRef: s.paymentRef || "",
        status: s.status || "completed",
        notes: s.notes || "",
        items: {
          create: s.items.map((item) => ({
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
