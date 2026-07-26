import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requirePermission } from "@/lib/auth";
import { PurchaseSchema, validate, validationError } from "@/lib/validation";
import { rateLimitApiRead, rateLimitApiWrite, rateLimitResponse, getClientIp } from "@/lib/rate-limit";
import { auditLogTx } from "@/lib/audit";
import { generatePurchaseRefNo } from "@/lib/identifiers";

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

  // Pull expectedAt separately (not in schema to keep it loose)
  const expectedAt = (body as any).expectedAt ? new Date((body as any).expectedAt) : null;

  // FIX: Foreign-key constraint violation on purchase_supplierid_fkey.
  // The client sometimes sends a supplier NAME (e.g. "AgriCorp Ghana") instead
  // of the supplier UUID, which Prisma rejects with P2003. We verify the
  // supplier exists BEFORE entering the transaction and return a friendly 400
  // instead of letting the error bubble up as a 500.
  if (p.supplierId) {
    // Reject obvious non-UUID values (names, codes, etc.) — UUIDs are 36 chars
    // with dashes. This catches the most common client-side mistake.
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_RE.test(String(p.supplierId))) {
      return NextResponse.json(
        {
          error: "Invalid supplier reference",
          detail: "The supplier value looks like a name, not an ID. Please re-select the supplier from the dropdown.",
          code: "SUPPLIER_NOT_UUID",
        },
        { status: 400 }
      );
    }
    const supplier = await db.supplier.findUnique({
      where: { id: String(p.supplierId) },
      select: { id: true, name: true, active: true },
    });
    if (!supplier) {
      return NextResponse.json(
        {
          error: "Supplier not found",
          detail: `No supplier exists with id "${p.supplierId}". Please re-select the supplier from the dropdown.`,
          code: "SUPPLIER_NOT_FOUND",
        },
        { status: 400 }
      );
    }
    if (!supplier.active) {
      return NextResponse.json(
        { error: "Supplier deactivated", detail: `Supplier "${supplier.name}" is inactive. Reactivate them first.` },
        { status: 400 }
      );
    }
  }

  try {
    const purchase = await db.$transaction(async (tx) => {
      const refNo = p.refNo || generatePurchaseRefNo();
      const status = p.status || "received";
      const total = Number(p.total) || 0;
      const amountPaid = Number(p.amountPaid) || 0;

      // Create purchase + items
      const newPurchase = await tx.purchase.create({
        data: {
          refNo,
          type: p.type || "purchase",
          supplierId: p.supplierId || null,
          supplierName: p.supplierName || "",
          status,
          subtotal: Number(p.subtotal) || 0,
          discount: Number(p.discount) || 0,
          taxAmount: Number(p.taxAmount) || 0,
          total,
          amountPaid,
          notes: p.notes || "",
          createdById: user.uid,
          receivedById: status === "received" ? user.uid : null,
          receivedAt: p.receivedAt ? new Date(p.receivedAt as string) : (status === "received" ? new Date() : null),
          expectedAt,
          items: {
            create: p.items.map((item) => ({
              productId: item.productId || null,
              partNo: item.partNo,
              details: item.details,
              emoji: "📦",
              quantity: Number(item.quantity) || 1,
              cost: Number(item.cost) || 0,
              tax: item.tax !== false,
              total: Number(item.total) || 0,
              expiryDate: item.expiryDate ? new Date(item.expiryDate as string) : null,
            })),
          },
        },
        include: { items: true, supplier: true },
      });

      // If received, increment stock + create linked StockHistory entries atomically
      if (newPurchase.status === "received") {
        for (const item of newPurchase.items) {
          if (item.productId) {
            // Update product: increment qty, update costPrice + receivedDate + expiryDate
            await tx.product.update({
              where: { id: item.productId },
              data: {
                quantity: { increment: item.quantity },
                ...(item.cost > 0 && { costPrice: item.cost }),
                receivedDate: new Date(),
                ...(item.expiryDate && { expiryDate: item.expiryDate }),
              },
            });
            await tx.stockHistory.create({
              data: {
                productId: item.productId,
                action: "received",
                quantity: item.quantity,
                reason: `Purchase ${refNo}`,
                reference: refNo,
                purchaseId: newPurchase.id,
                userId: user.uid,
              },
            });
          }
        }
      }

      // Update supplier balance: if received but not fully paid, the outstanding
      // amount (total - amountPaid) is now owed to the supplier.
      if (newPurchase.supplierId && status === "received" && total > amountPaid) {
        const outstanding = total - amountPaid;
        await tx.supplier.update({
          where: { id: newPurchase.supplierId },
          data: { balance: { increment: outstanding } },
        });
      }

      // Audit log inside the transaction
      await auditLogTx(tx, {
        userId: user.uid,
        user: user.username,
        action: "CREATE",
        module: "purchase",
        details: `Purchase ${refNo} created — ${newPurchase.items.length} items, total ${total.toFixed(2)}, status: ${status}${newPurchase.supplier ? `, supplier: ${newPurchase.supplier.name}` : ""}`,
        severity: "info",
        ipAddress: ip,
        userAgent: req.headers.get("user-agent") || "",
      });

      return newPurchase;
    });

    return NextResponse.json({ success: true, purchase });
  } catch (e: any) {
    console.error("POST /api/purchases error:", e);
    // Surface FK violations as friendly 400s — defense in depth in case the
    // pre-check above somehow misses a case (e.g. race condition where the
    // supplier is deleted between the check and the create).
    if (e?.code === "P2003" && typeof e?.meta?.constraint === "string" && e.meta.constraint.includes("supplierid")) {
      return NextResponse.json(
        { error: "Invalid supplier", detail: "The selected supplier does not exist. Please re-select the supplier.", code: "FK_SUPPLIER" },
        { status: 400 }
      );
    }
    if (e?.code === "P2003") {
      return NextResponse.json(
        { error: "Reference error", detail: `A referenced record does not exist: ${e?.meta?.constraint}`, code: "FK_VIOLATION" },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: e?.message || "Failed to create purchase" }, { status: 500 });
  }
}
