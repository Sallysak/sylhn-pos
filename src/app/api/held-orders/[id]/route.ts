import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requirePermission } from "@/lib/auth";
import { rateLimitApiRead, rateLimitApiWrite, rateLimitResponse, getClientIp } from "@/lib/rate-limit";

// GET /api/held-orders/[id] — fetch a single held order (for recall)
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let user;
  try { user = await requireAuth(); } catch (e) { return e as Response; }

  const ip = getClientIp(req);
  const rl = rateLimitApiRead(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  try {
    const { id } = await params;
    const held = await db.heldOrder.findUnique({ where: { id } });
    if (!held) return NextResponse.json({ error: "Held order not found" }, { status: 404 });

    // Cashier can only fetch their own
    if (user.role === "cashier" && held.cashierId !== user.uid) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ heldOrder: held });
  } catch (e) {
    console.error("GET /api/held-orders/[id] error:", e);
    return NextResponse.json({ error: "Failed to fetch held order" }, { status: 500 });
  }
}

// DELETE /api/held-orders/[id] — recall (mark as recalled) or hard delete
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let user;
  try { user = await requireAuth(); requirePermission(user.role, "pos"); } catch (e) { return e as Response; }

  const ip = getClientIp(req);
  const rl = rateLimitApiWrite(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  try {
    const { id } = await params;
    const held = await db.heldOrder.findUnique({ where: { id } });
    if (!held) return NextResponse.json({ error: "Held order not found" }, { status: 404 });

    if (user.role === "cashier" && held.cashierId !== user.uid) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Mark as recalled (soft delete — keep the audit trail)
    const updated = await db.heldOrder.update({
      where: { id },
      data: { recalledAt: new Date() },
    });

    await db.auditLog.create({
      data: {
        userId: user.uid,
        user: user.username,
        action: "RECALL",
        module: "pos",
        details: `Held order ${held.invoiceNumber} recalled`,
        severity: "info",
      },
    });

    return NextResponse.json({ success: true, heldOrder: updated });
  } catch (e) {
    console.error("DELETE /api/held-orders/[id] error:", e);
    return NextResponse.json({ error: "Failed to recall held order" }, { status: 500 });
  }
}
