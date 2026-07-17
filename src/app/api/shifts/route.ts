import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { rateLimitApiRead, rateLimitApiWrite, rateLimitResponse, getClientIp } from "@/lib/rate-limit";
import { auditLogTx } from "@/lib/audit";

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
    const limit = Math.min(parseInt(searchParams.get("limit") || "100", 10), 1000);

    const where: any = {};
    if (status) where.status = status;
    if (cashierId) where.cashierId = cashierId;

    const shifts = await db.cashierShift.findMany({
      where,
      include: {
        cashier: { select: { id: true, fullName: true, username: true } },
        sales: {
          where: { status: "completed" },
          select: { id: true, invoiceNumber: true, total: true, paymentMethod: true, createdAt: true },
        },
        _count: { select: { sales: true, heldOrders: true } },
      },
      orderBy: { openedAt: "desc" },
      take: limit,
    });
    return NextResponse.json({ shifts });
  } catch (e) {
    console.error("GET /api/shifts error:", e);
    return NextResponse.json({ error: "Failed to fetch shifts" }, { status: 500 });
  }
}

// POST /api/shifts — open/close a cashier shift (transactional + audited)
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
      // Premium fix: prevent opening a new shift if one is already open for this cashier
      const existing = await db.cashierShift.findFirst({
        where: { cashierId: user.uid, status: "open" },
      });
      if (existing) {
        return NextResponse.json({
          error: `You already have an open shift (opened ${existing.openedAt.toLocaleString()}). Close it first.`,
        }, { status: 400 });
      }

      const shift = await db.$transaction(async (tx) => {
        const newShift = await tx.cashierShift.create({
          data: {
            cashierId: user.uid,
            cashierName: user.username,
            openingFloat: Number(body.openingFloat) || 0,
            status: "open",
          },
        });

        await auditLogTx(tx, {
          userId: user.uid,
          user: user.username,
          action: "SHIFT_OPEN",
          module: "maintenance",
          details: `Shift opened with float GHS ${newShift.openingFloat.toFixed(2)}`,
          severity: "info",
          ipAddress: ip,
          userAgent: req.headers.get("user-agent") || "",
        });

        return newShift;
      });

      return NextResponse.json({ success: true, shift });
    }

    if (body.action === "close") {
      // Premium fix: transactional close + permission check
      // Only the cashier who opened the shift, or a manager/admin, can close it
      const existing = await db.cashierShift.findUnique({ where: { id: body.shiftId } });
      if (!existing) return NextResponse.json({ error: "Shift not found" }, { status: 404 });
      if (existing.status === "closed") return NextResponse.json({ error: "Shift already closed" }, { status: 400 });
      if (user.role === "cashier" && existing.cashierId !== user.uid) {
        return NextResponse.json({ error: "You can only close your own shift" }, { status: 403 });
      }

      const result = await db.$transaction(async (tx) => {
        // Calculate expected cash from sales (cash payments only)
        const sales = await tx.sale.findMany({
          where: { shiftId: existing.id, status: "completed", paymentMethod: "cash" },
          select: { amountPaid: true, change: true },
        });
        const expectedCash = existing.openingFloat + sales.reduce((sum, s) => sum + s.amountPaid - s.change, 0);
        const actualCash = Number(body.actualCash) || 0;
        const variance = Math.round((actualCash - expectedCash) * 100) / 100;

        const updated = await tx.cashierShift.update({
          where: { id: existing.id },
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

        // Severity: critical if variance exceeds GHS 5 (premium variance alert)
        const severity = Math.abs(variance) > 5 ? "critical" : (variance !== 0 ? "warning" : "info");

        await auditLogTx(tx, {
          userId: user.uid,
          user: user.username,
          action: "SHIFT_CLOSE",
          module: "maintenance",
          details: `Shift closed. Expected: GHS ${expectedCash.toFixed(2)}, Actual: GHS ${actualCash.toFixed(2)}, Variance: GHS ${variance.toFixed(2)}${Math.abs(variance) > 5 ? " (over GHS 5 threshold — manager review recommended)" : ""}`,
          severity,
          ipAddress: ip,
          userAgent: req.headers.get("user-agent") || "",
        });

        return { shift: updated, expectedCash, variance };
      });

      return NextResponse.json({ success: true, ...result });
    }

    return NextResponse.json({ error: "Invalid action (use 'open' or 'close')" }, { status: 400 });
  } catch (e: any) {
    console.error("POST /api/shifts error:", e);
    return NextResponse.json({ error: e?.message || "Failed to process shift" }, { status: 500 });
  }
}
