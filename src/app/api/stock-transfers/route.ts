import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requirePermission } from "@/lib/auth";
import { rateLimitApiRead, rateLimitApiWrite, rateLimitResponse, getClientIp } from "@/lib/rate-limit";
import { auditLogTx } from "@/lib/audit";
import { generateStockTransferRefNo } from "@/lib/identifiers";

// GET /api/stock-transfers — list transfers
export async function GET(req: NextRequest) {
  try { await requireAuth(); } catch (e) { return e as Response; }

  const ip = getClientIp(req);
  const rl = rateLimitApiRead(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const limit = Math.min(parseInt(searchParams.get("limit") || "100", 10), 1000);

    const where: any = {};
    if (status) where.status = status;

    const transfers = await db.stockTransfer.findMany({
      where,
      include: {
        fromLocation: { select: { id: true, code: true, name: true } },
        toLocation: { select: { id: true, code: true, name: true } },
        createdBy: { select: { fullName: true, username: true } },
        receivedBy: { select: { fullName: true, username: true } },
        items: { include: { product: { select: { id: true, sku: true, name: true, emoji: true } } } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return NextResponse.json({ transfers });
  } catch (e) {
    console.error("GET /api/stock-transfers error:", e);
    return NextResponse.json({ error: "Failed to fetch transfers" }, { status: 500 });
  }
}

// POST /api/stock-transfers — create a new stock transfer
// Body: { fromLocationId, toLocationId, items: [{productId, quantity}], notes? }
export async function POST(req: NextRequest) {
  let user;
  try { user = await requireAuth(); requirePermission(user.role, "canAdjustStock"); } catch (e) { return e as Response; }

  const ip = getClientIp(req);
  const rl = rateLimitApiWrite(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { fromLocationId, toLocationId, items, notes, status } = body;
  if (!fromLocationId || !toLocationId) {
    return NextResponse.json({ error: "fromLocationId and toLocationId are required" }, { status: 400 });
  }
  if (fromLocationId === toLocationId) {
    return NextResponse.json({ error: "From and To locations must be different" }, { status: 400 });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "items array is required" }, { status: 400 });
  }

  try {
    const transfer = await db.$transaction(async (tx) => {
      // Validate locations
      const [fromLoc, toLoc] = await Promise.all([
        tx.location.findUnique({ where: { id: String(fromLocationId) } }),
        tx.location.findUnique({ where: { id: String(toLocationId) } }),
      ]);
      if (!fromLoc) throw new Error("From location not found");
      if (!toLoc) throw new Error("To location not found");

      // Validate items + check stock availability at the from location
      const productIds = items.map((i: any) => String(i.productId));
      const products = await tx.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, sku: true, name: true, emoji: true, quantity: true },
      });
      const productMap: Record<string, any> = {};
      for (const p of products) productMap[p.id] = p;

      // Get current location stock levels (or fall back to Product.quantity if no LocationStock record)
      const locationStocks = await tx.locationStock.findMany({
        where: { locationId: String(fromLocationId), productId: { in: productIds } },
      });
      const stockMap: Record<string, number> = {};
      for (const ls of locationStocks) {
        stockMap[ls.productId] = ls.quantity;
      }

      // Validate each item
      for (const item of items) {
        const product = productMap[item.productId];
        if (!product) throw new Error(`Product ${item.productId} not found`);
        const available = stockMap[item.productId] ?? product.quantity;
        const qty = Number(item.quantity);
        if (qty <= 0) throw new Error(`Invalid quantity for ${product.name}`);
        // For received transfers, check that we have enough stock
        if (status === "received" && qty > available) {
          throw new Error(`Insufficient stock at ${fromLoc.name} for ${product.name} (have ${available}, need ${qty})`);
        }
      }

      const refNo = generateStockTransferRefNo();
      const newTransfer = await tx.stockTransfer.create({
        data: {
          refNo,
          fromLocationId: String(fromLocationId),
          toLocationId: String(toLocationId),
          status: status || "draft",
          notes: String(notes || "").slice(0, 2000),
          createdById: user.uid,
          receivedAt: status === "received" ? new Date() : null,
          receivedById: status === "received" ? user.uid : null,
          items: {
            create: items.map((item: any) => {
              const product = productMap[item.productId];
              return {
                productId: String(item.productId),
                quantity: Number(item.quantity),
                productName: product.name,
                sku: product.sku,
                emoji: product.emoji,
              };
            }),
          },
        },
        include: { items: true },
      });

      // If status is "received", move the stock NOW (decrement from-location, increment to-location)
      if (status === "received") {
        for (const item of newTransfer.items) {
          // Decrement from-location stock (or Product.quantity if no LocationStock)
          const fromStock = await tx.locationStock.findUnique({
            where: { locationId_productId: { locationId: String(fromLocationId), productId: item.productId } },
          });
          if (fromStock) {
            await tx.locationStock.update({
              where: { id: fromStock.id },
              data: { quantity: { decrement: item.quantity } },
            });
          } else {
            // Fall back to decrementing Product.quantity
            await tx.product.update({
              where: { id: item.productId },
              data: { quantity: { decrement: item.quantity } },
            });
          }

          // Increment to-location stock (upsert LocationStock)
          await tx.locationStock.upsert({
            where: { locationId_productId: { locationId: String(toLocationId), productId: item.productId } },
            update: { quantity: { increment: item.quantity } },
            create: {
              locationId: String(toLocationId),
              productId: item.productId,
              quantity: item.quantity,
            },
          });

          // Create stock history entries
          await tx.stockHistory.create({
            data: {
              productId: item.productId,
              action: "transfer",
              quantity: -item.quantity,
              reason: `Transfer ${refNo} to ${toLoc.name}`,
              reference: refNo,
              userId: user.uid,
            },
          });
          await tx.stockHistory.create({
            data: {
              productId: item.productId,
              action: "transfer",
              quantity: item.quantity,
              reason: `Transfer ${refNo} from ${fromLoc.name}`,
              reference: refNo,
              userId: user.uid,
            },
          });
        }
      }

      await auditLogTx(tx, {
        userId: user.uid,
        user: user.username,
        action: "CREATE",
        module: "stock",
        details: `Stock transfer ${refNo} created: ${fromLoc.name} → ${toLoc.name} (${items.length} items, status: ${status || "draft"})`,
        severity: "warning",
        ipAddress: ip,
        userAgent: req.headers.get("user-agent") || "",
      });

      return newTransfer;
    });

    return NextResponse.json({ success: true, transfer });
  } catch (e: any) {
    console.error("POST /api/stock-transfers error:", e);
    return NextResponse.json({ error: e?.message || "Failed to create transfer" }, { status: 400 });
  }
}
