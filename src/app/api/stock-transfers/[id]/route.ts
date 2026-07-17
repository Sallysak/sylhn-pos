import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requirePermission } from "@/lib/auth";
import { rateLimitApiRead, rateLimitApiWrite, rateLimitResponse, getClientIp } from "@/lib/rate-limit";
import { auditLogTx } from "@/lib/audit";

// GET /api/stock-transfers/[id] — fetch a single transfer
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { await requireAuth(); } catch (e) { return e as Response; }

  const ip = getClientIp(req);
  const rl = rateLimitApiRead(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  try {
    const { id } = await params;
    const transfer = await db.stockTransfer.findUnique({
      where: { id },
      include: {
        fromLocation: true,
        toLocation: true,
        createdBy: { select: { fullName: true, username: true } },
        receivedBy: { select: { fullName: true, username: true } },
        items: { include: { product: { select: { id: true, sku: true, name: true, emoji: true, quantity: true } } } },
      },
    });
    if (!transfer) {
      // Try by refNo
      const byRef = await db.stockTransfer.findUnique({
        where: { refNo: id },
        include: {
          fromLocation: true,
          toLocation: true,
          createdBy: { select: { fullName: true, username: true } },
          receivedBy: { select: { fullName: true, username: true } },
          items: { include: { product: { select: { id: true, sku: true, name: true, emoji: true, quantity: true } } } },
        },
      });
      if (!byRef) return NextResponse.json({ error: "Transfer not found" }, { status: 404 });
      return NextResponse.json({ transfer: byRef });
    }
    return NextResponse.json({ transfer });
  } catch (e) {
    console.error("GET /api/stock-transfers/[id] error:", e);
    return NextResponse.json({ error: "Failed to fetch transfer" }, { status: 500 });
  }
}

// PUT /api/stock-transfers/[id] — mark as received or cancel
// Body: { action: "receive" | "cancel" }
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let user;
  try { user = await requireAuth(); requirePermission(user.role, "canAdjustStock"); } catch (e) { return e as Response; }

  const ip = getClientIp(req);
  const rl = rateLimitApiWrite(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  try {
    const { id } = await params;

    if (body.action === "receive") {
      const result = await db.$transaction(async (tx) => {
        const transfer = await tx.stockTransfer.findUnique({
          where: { id },
          include: { items: true, fromLocation: true, toLocation: true },
        });
        if (!transfer) throw new Error("Transfer not found");
        if (transfer.status === "received") throw new Error("Transfer already received");
        if (transfer.status === "cancelled") throw new Error("Cannot receive a cancelled transfer");

        // Move stock: decrement from-location, increment to-location
        for (const item of transfer.items) {
          // Decrement from-location (or Product.quantity fallback)
          const fromStock = await tx.locationStock.findUnique({
            where: { locationId_productId: { locationId: transfer.fromLocationId, productId: item.productId } },
          });
          if (fromStock) {
            await tx.locationStock.update({
              where: { id: fromStock.id },
              data: { quantity: { decrement: item.quantity } },
            });
          } else {
            await tx.product.update({
              where: { id: item.productId },
              data: { quantity: { decrement: item.quantity } },
            });
          }

          // Increment to-location
          await tx.locationStock.upsert({
            where: { locationId_productId: { locationId: transfer.toLocationId, productId: item.productId } },
            update: { quantity: { increment: item.quantity } },
            create: {
              locationId: transfer.toLocationId,
              productId: item.productId,
              quantity: item.quantity,
            },
          });

          // Stock history
          await tx.stockHistory.create({
            data: {
              productId: item.productId,
              action: "transfer",
              quantity: -item.quantity,
              reason: `Transfer ${transfer.refNo} received at ${transfer.toLocation.name}`,
              reference: transfer.refNo,
              userId: user.uid,
            },
          });
          await tx.stockHistory.create({
            data: {
              productId: item.productId,
              action: "transfer",
              quantity: item.quantity,
              reason: `Transfer ${transfer.refNo} dispatched from ${transfer.fromLocation.name}`,
              reference: transfer.refNo,
              userId: user.uid,
            },
          });
        }

        const updated = await tx.stockTransfer.update({
          where: { id },
          data: {
            status: "received",
            receivedAt: new Date(),
            receivedById: user.uid,
          },
          include: { items: true },
        });

        await auditLogTx(tx, {
          userId: user.uid,
          user: user.username,
          action: "RECEIVE",
          module: "stock",
          details: `Stock transfer ${transfer.refNo} received — ${transfer.items.length} items moved from ${transfer.fromLocation.name} to ${transfer.toLocation.name}`,
          severity: "warning",
          ipAddress: ip,
          userAgent: req.headers.get("user-agent") || "",
        });

        return updated;
      });
      return NextResponse.json({ success: true, transfer: result });
    }

    if (body.action === "cancel") {
      const updated = await db.stockTransfer.update({
        where: { id },
        data: { status: "cancelled" },
      });
      await auditLog({
        userId: user.uid,
        user: user.username,
        action: "CANCEL",
        module: "stock",
        details: `Stock transfer ${updated.refNo} cancelled`,
        severity: "warning",
        ipAddress: ip,
        userAgent: req.headers.get("user-agent") || "",
      });
      return NextResponse.json({ success: true, transfer: updated });
    }

    return NextResponse.json({ error: "Unknown action (use 'receive' or 'cancel')" }, { status: 400 });
  } catch (e: any) {
    console.error("PUT /api/stock-transfers/[id] error:", e);
    return NextResponse.json({ error: e?.message || "Failed to update transfer" }, { status: 400 });
  }
}
