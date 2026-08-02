import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requirePermission } from "@/lib/auth";
import { rateLimitApiRead, rateLimitApiWrite, rateLimitResponse, getClientIp } from "@/lib/rate-limit";

// GET /api/held-orders — list held orders for the current cashier (or all if manager+)
export async function GET(req: NextRequest) {
  let user;
  try { user = await requireAuth(); } catch (e) { return e as Response; }

  const ip = getClientIp(req);
  const rl = rateLimitApiRead(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  try {
    const { searchParams } = new URL(req.url);
    const cashierId = searchParams.get("cashierId");
    const shiftId = searchParams.get("shiftId");
    const includeRecalled = searchParams.get("includeRecalled") === "true";

    const where: any = {};
    if (cashierId) where.cashierId = cashierId;
    if (shiftId) where.shiftId = shiftId;
    if (!includeRecalled) where.recalledAt = null;

    // Cashier only sees their own held orders; manager+ can see all
    if (user.role === "cashier") where.cashierId = user.uid;

    const orders = await db.heldOrder.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return NextResponse.json({ heldOrders: orders });
  } catch (e) {
    console.error("GET /api/held-orders error:", e);
    return NextResponse.json({ error: "Failed to fetch held orders" }, { status: 500 });
  }
}

// POST /api/held-orders — park a cart for later recall
export async function POST(req: NextRequest) {
  let user;
  try { user = await requireAuth(); requirePermission(user.role, "pos"); } catch (e) { return e as Response; }

  const ip = getClientIp(req);
  const rl = rateLimitApiWrite(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  try {
    if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json({ error: "items array is required" }, { status: 400 });
    }

    // Auto-attach shiftId from cashier's open shift if not provided
    let shiftId = body.shiftId || null;
    if (!shiftId) {
      const openShift = await db.cashierShift.findFirst({
        where: { cashierId: user.uid, status: "open" },
        orderBy: { openedAt: "desc" },
      });
      if (openShift) shiftId = openShift.id;
    }

    const held = await db.heldOrder.create({
      data: {
        invoiceNumber: body.invoiceNumber || `HELD-${Date.now()}`,
        items: JSON.stringify(body.items), // store cart items as JSON
        customerName: String(body.customerName || "").slice(0, 200),
        cashierId: user.uid,
        cashierName: user.username,
        shiftId,
      },
    });

    await db.auditLog.create({
      data: {
        userId: user.uid,
        user: user.username,
        action: "CREATE",
        module: "pos",
        details: `Held order ${held.invoiceNumber} parked — ${body.items.length} items`,
        severity: "info",
      },
    });

    return NextResponse.json({ success: true, heldOrder: held });
  } catch (e) {
    console.error("POST /api/held-orders error:", e);
    return NextResponse.json({ error: "Failed to create held order" }, { status: 500 });
  }
}
