import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { rateLimitApiRead, rateLimitApiWrite, rateLimitResponse, getClientIp } from "@/lib/rate-limit";

// GET /api/shifts — list cashier shifts
export async function GET(req: NextRequest) {
  try { await requireAuth(); } catch (e) { return e as Response; }

  const ip = getClientIp(req);
  const rl = rateLimitApiRead(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const cashierId = searchParams.get("cashierId");

    const where: any = {};
    if (status) where.status = status;
    if (cashierId) where.cashierId = cashierId;

    const shifts = await db.cashierShift.findMany({
      where,
      include: {
        cashier: { select: { id: true, fullName: true, username: true } },
        _count: { select: { sales: true, heldOrders: true } },
      },
      orderBy: { openedAt: "desc" },
    });
    return NextResponse.json({ shifts });
  } catch (e) {
    console.error("GET /api/shifts error:", e);
    return NextResponse.json({ error: "Failed to fetch shifts" }, { status: 500 });
  }
}

// POST /api/shifts — open/close a cashier shift
export async function POST(req: NextRequest) {
  let user;
  try { user = await requireAuth(); } catch (e) { return e as Response; }

  const ip = getClientIp(req);
  const rl = rateLimitApiWrite(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  try {
    if (body.action === "open") {
      // Open a new shift
      const shift = await db.cashierShift.create({
        data: {
          cashierId: user.uid,
          cashierName: user.username,
          openingFloat: Number(body.openingFloat) || 0,
          status: "open",
        },
      });

      await db.auditLog.create({
        data: {
          userId: user.uid,
          user: user.username,
          action: "SHIFT_OPEN",
          module: "maintenance",
          details: `Shift opened with float ${shift.openingFloat}`,
          severity: "info",
        },
      });

      return NextResponse.json({ success: true, shift });
    }

    if (body.action === "close") {
      // Close an existing shift
      const shift = await db.cashierShift.findUnique({ where: { id: body.shiftId } });
      if (!shift) return NextResponse.json({ error: "Shift not found" }, { status: 404 });
      if (shift.status === "closed") return NextResponse.json({ error: "Shift already closed" }, { status: 400 });

      // Calculate expected cash from sales
      const sales = await db.sale.findMany({
        where: { shiftId: shift.id, status: "completed", paymentMethod: "cash" },
        select: { amountPaid: true, change: true },
      });
      const expectedCash = shift.openingFloat + sales.reduce((sum, s) => sum + s.amountPaid - s.change, 0);
      const actualCash = Number(body.actualCash) || 0;
      const variance = actualCash - expectedCash;

      const updated = await db.cashierShift.update({
        where: { id: body.shiftId },
        data: {
          status: "closed",
          closedAt: new Date(),
          closingFloat: actualCash,
          expectedCash,
          actualCash,
          variance,
          notes: String(body.notes || "").slice(0, 2000),
        },
      });

      await db.auditLog.create({
        data: {
          userId: user.uid,
          user: user.username,
          action: "SHIFT_CLOSE",
          module: "maintenance",
          details: `Shift closed. Expected: ${expectedCash}, Actual: ${actualCash}, Variance: ${variance}`,
          severity: variance !== 0 ? "warning" : "info",
        },
      });

      return NextResponse.json({ success: true, shift: updated });
    }

    return NextResponse.json({ error: "Invalid action (use 'open' or 'close')" }, { status: 400 });
  } catch (e) {
    console.error("POST /api/shifts error:", e);
    return NextResponse.json({ error: "Failed to process shift" }, { status: 500 });
  }
}
