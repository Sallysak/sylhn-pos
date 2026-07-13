import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requirePermission } from "@/lib/auth";
import { PurchaseSchema, validate, validationError } from "@/lib/validation";
import { rateLimitApiRead, rateLimitApiWrite, rateLimitResponse, getClientIp } from "@/lib/rate-limit";

export async function GET(req: NextRequest) {
  try { await requireAuth(); } catch (e) { return e as Response; }

  const ip = getClientIp(req);
  const rl = rateLimitApiRead(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");
    const status = searchParams.get("status");
    const supplierId = searchParams.get("supplierId");
    const limit = Math.min(parseInt(searchParams.get("limit") || "100", 10), 1000);

    const where: any = {};
    if (type) where.type = type;
    if (status) where.status = status;
    if (supplierId) where.supplierId = supplierId;

    const purchases = await db.purchase.findMany({
      where,
      include: {
        items: true,
        supplier: true,
        createdBy: { select: { id: true, fullName: true, username: true } },
        receivedBy: { select: { id: true, fullName: true, username: true } },
        payments: true,
      },
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
  let user;
  try {
    user = await requireAuth();
    requirePermission(user.role, "purchase");
  } catch (e) { return e as Response; }

  const ip = getClientIp(req);
  const rl = rateLimitApiWrite(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  let body: unknown;
  try { body = await req.json(); } catch { return validationError("Invalid JSON body"); }

  const result = validate(PurchaseSchema, body);
  if (!result.success) return validationError(result.error);
  const p = result.data;

  try {
    const refNo = p.refNo || `PUR-${Date.now()}`;

    const purchase = await db.purchase.create({
      data: {
        refNo,
        type: p.type || "purchase",
        supplierId: p.supplierId || null,
        supplierName: p.supplierName || "",
        status: p.status || "received",
        subtotal: Number(p.subtotal) || 0,
        discount: Number(p.discount) || 0,
        taxAmount: Number(p.taxAmount) || 0,
        total: Number(p.total) || 0,
        amountPaid: Number(p.amountPaid) || 0,
        notes: p.notes || "",
        createdById: user.uid, // link to logged-in SystemUser
        receivedById: p.status === "received" ? user.uid : null,
        receivedAt: p.receivedAt ? new Date(p.receivedAt as string) : (p.status === "received" ? new Date() : null),
        expectedAt: (body as any).expectedAt ? new Date((body as any).expectedAt) : null,
        items: {
          create: p.items.map((item) => ({
            productId: item.productId || null,
            partNo: item.partNo,
            details: item.details,
            quantity: Number(item.quantity) || 1,
            cost: Number(item.cost) || 0,
            tax: item.tax !== false,
            total: Number(item.total) || 0,
            expiryDate: item.expiryDate ? new Date(item.expiryDate as string) : null,
          })),
        },
      },
      include: { items: true },
    });

    // If received, increment stock + create linked StockHistory entries
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
              purchaseId: purchase.id,
              userId: user.uid,
            },
          });
        }
      }
    }

    // Log audit
    await db.auditLog.create({
      data: {
        userId: user.uid,
        user: user.username,
        action: "CREATE",
        module: "purchase",
        details: `Purchase ${refNo} created — ${purchase.items.length} items, total ${purchase.total}`,
        severity: "info",
      },
    });

    return NextResponse.json({ success: true, purchase });
  } catch (e) {
    console.error("POST /api/purchases error:", e);
    return NextResponse.json({ error: "Failed to create purchase" }, { status: 500 });
  }
}
