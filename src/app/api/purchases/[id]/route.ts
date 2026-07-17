import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requirePermission } from "@/lib/auth";
import { rateLimitApiRead, rateLimitApiWrite, rateLimitResponse, getClientIp } from "@/lib/rate-limit";
import { auditLogTx } from "@/lib/audit";

// GET /api/purchases/[id] — fetch a single purchase with all relations
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { await requireAuth(); } catch (e) { return e as Response; }

  const ip = getClientIp(req);
  const rl = rateLimitApiRead(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  try {
    const { id } = await params;
    let purchase = await db.purchase.findUnique({
      where: { id },
      include: {
        items: true,
        supplier: true,
        payments: true,
        createdBy: { select: { id: true, fullName: true, username: true } },
        receivedBy: { select: { id: true, fullName: true, username: true } },
      },
    });
    if (!purchase) {
      purchase = await db.purchase.findUnique({
        where: { refNo: id },
        include: {
          items: true,
          supplier: true,
          payments: true,
          createdBy: { select: { id: true, fullName: true, username: true } },
          receivedBy: { select: { id: true, fullName: true, username: true } },
        },
      });
    }
    if (!purchase) return NextResponse.json({ error: "Purchase not found" }, { status: 404 });
    return NextResponse.json({ purchase });
  } catch (e) {
    console.error("GET /api/purchases/[id] error:", e);
    return NextResponse.json({ error: "Failed to fetch purchase" }, { status: 500 });
  }
}

// PUT /api/purchases/[id] — mark ordered purchase as received (transactional stock increment)
// Body: { action: "receive" | "cancel", receivedItems?: [{id, receivedQty}] }
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let user;
  try { user = await requireAuth(); requirePermission(user.role, "purchase"); } catch (e) { return e as Response; }

  const ip = getClientIp(req);
  const rl = rateLimitApiWrite(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  try {
    const { id } = await params;

    if (body.action === "receive") {
      const updated = await db.$transaction(async (tx) => {
        const purchase = await tx.purchase.findUnique({
          where: { id },
          include: { items: true, supplier: true },
        });
        if (!purchase) throw new Error("Purchase not found");
        if (purchase.status === "received") throw new Error("Purchase already received");
        if (purchase.status === "cancelled") throw new Error("Cannot receive a cancelled purchase");

        // Increment stock + create stock history for each item
        for (const item of purchase.items) {
          if (!item.productId) continue;
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
              reason: `Purchase ${purchase.refNo} received`,
              reference: purchase.refNo,
              purchaseId: purchase.id,
              userId: user.uid,
            },
          });
        }

        // Update supplier balance if amountPaid < total
        if (purchase.supplierId && purchase.total > purchase.amountPaid) {
          const outstanding = purchase.total - purchase.amountPaid;
          await tx.supplier.update({
            where: { id: purchase.supplierId },
            data: { balance: { increment: outstanding } },
          });
        }

        const updatedPurchase = await tx.purchase.update({
          where: { id },
          data: {
            status: "received",
            receivedAt: new Date(),
            receivedById: user.uid,
          },
          include: { items: true, supplier: true },
        });

        await auditLogTx(tx, {
          userId: user.uid,
          user: user.username,
          action: "UPDATE",
          module: "purchase",
          details: `Purchase ${purchase.refNo} marked as received — ${purchase.items.length} items, stock incremented`,
          severity: "info",
          ipAddress: ip,
          userAgent: req.headers.get("user-agent") || "",
        });

        return updatedPurchase;
      });

      return NextResponse.json({ success: true, purchase: updated });
    }

    if (body.action === "cancel") {
      const updated = await db.$transaction(async (tx) => {
        const purchase = await tx.purchase.findUnique({ where: { id }, include: { items: true } });
        if (!purchase) throw new Error("Purchase not found");
        if (purchase.status === "cancelled") throw new Error("Purchase already cancelled");
        if (purchase.status === "received") {
          // If already received, we need to reverse the stock increment too
          for (const item of purchase.items) {
            if (item.productId) {
              await tx.product.update({
                where: { id: item.productId },
                data: { quantity: { decrement: item.quantity } },
              });
              await tx.stockHistory.create({
                data: {
                  productId: item.productId,
                  action: "adjusted",
                  quantity: -item.quantity,
                  reason: `Reversal of cancelled purchase ${purchase.refNo}`,
                  reference: purchase.refNo,
                  purchaseId: purchase.id,
                  userId: user.uid,
                },
              });
            }
          }
          // Reverse supplier balance update
          if (purchase.supplierId && purchase.total > purchase.amountPaid) {
            const outstanding = purchase.total - purchase.amountPaid;
            await tx.supplier.update({
              where: { id: purchase.supplierId },
              data: { balance: { decrement: outstanding } },
            });
          }
        }
        const updatedPurchase = await tx.purchase.update({
          where: { id },
          data: { status: "cancelled" },
          include: { items: true },
        });
        await auditLogTx(tx, {
          userId: user.uid,
          user: user.username,
          action: "CANCEL",
          module: "purchase",
          details: `Purchase ${purchase.refNo} cancelled${purchase.status === "received" ? " — stock + supplier balance reversed" : ""}`,
          severity: "warning",
          ipAddress: ip,
          userAgent: req.headers.get("user-agent") || "",
        });
        return updatedPurchase;
      });
      return NextResponse.json({ success: true, purchase: updated });
    }

    return NextResponse.json({ error: "Unknown action. Use 'receive' or 'cancel'." }, { status: 400 });
  } catch (e: any) {
    console.error("PUT /api/purchases/[id] error:", e);
    const msg = e?.message || "Failed to update purchase";
    if (msg.includes("not found") || msg.includes("already") || msg.includes("Cannot")) {
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
