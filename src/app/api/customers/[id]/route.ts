import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { rateLimitApiRead, rateLimitApiWrite, rateLimitResponse, getClientIp } from "@/lib/rate-limit";
import { auditLog } from "@/lib/audit";
import { tierFromSpend } from "@/lib/loyalty";

// GET /api/customers/[id] — full customer profile (sales, loyalty history, stats)
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { await requireAuth(); } catch (e) { return e as Response; }

  const ip = getClientIp(req);
  const rl = rateLimitApiRead(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  try {
    const { id } = await params;
    const customer = await db.customer.findUnique({
      where: { id },
      include: {
        sales: {
          take: 20,
          orderBy: { createdAt: "desc" },
          select: { id: true, invoiceNumber: true, total: true, status: true, createdAt: true, pointsEarned: true, pointsRedeemed: true },
        },
        loyaltyTransactions: {
          take: 30,
          orderBy: { createdAt: "desc" },
        },
        createdBy: { select: { fullName: true, username: true } },
        _count: { select: { sales: true, loyaltyTransactions: true } },
      },
    });
    if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    return NextResponse.json({ customer });
  } catch (e) {
    console.error("GET /api/customers/[id] error:", e);
    return NextResponse.json({ error: "Failed to fetch customer" }, { status: 500 });
  }
}

// PUT /api/customers/[id] — update customer details
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let user;
  try { user = await requireAuth(); } catch (e) { return e as Response; }

  const ip = getClientIp(req);
  const rl = rateLimitApiWrite(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  try {
    const { id } = await params;
    const existing = await db.customer.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Customer not found" }, { status: 404 });

    const updated = await db.customer.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: String(body.name).slice(0, 200) }),
        ...(body.phone !== undefined && { phone: String(body.phone).slice(0, 32) }),
        ...(body.mobile !== undefined && { mobile: String(body.mobile).slice(0, 32) }),
        ...(body.email !== undefined && { email: String(body.email).slice(0, 200) }),
        ...(body.address !== undefined && { address: String(body.address).slice(0, 500) }),
        ...(body.city !== undefined && { city: String(body.city).slice(0, 100) }),
        ...(body.group !== undefined && { group: String(body.group).slice(0, 50) }),
        ...(body.creditLimit !== undefined && { creditLimit: Number(body.creditLimit) || 0 }),
        ...(body.notes !== undefined && { notes: String(body.notes).slice(0, 2000) }),
        ...(body.active !== undefined && { active: Boolean(body.active) }),
        // Manual tier override is allowed (auto-eval will still happen on next sale)
        ...(body.tier !== undefined && { tier: String(body.tier).slice(0, 50) }),
      },
    });

    await auditLog({
      userId: user.uid,
      user: user.username,
      action: "UPDATE",
      module: "customers",
      details: `Customer ${updated.name} updated`,
      severity: "info",
      ipAddress: ip,
      userAgent: req.headers.get("user-agent") || "",
    });

    return NextResponse.json({ success: true, customer: updated });
  } catch (e) {
    console.error("PUT /api/customers/[id] error:", e);
    return NextResponse.json({ error: "Failed to update customer" }, { status: 500 });
  }
}

// DELETE /api/customers/[id] — soft-delete (set active=false)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let user;
  try { user = await requireAuth(); } catch (e) { return e as Response; }

  const ip = getClientIp(req);
  const rl = rateLimitApiWrite(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  try {
    const { id } = await params;
    const existing = await db.customer.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Customer not found" }, { status: 404 });

    // Soft delete — preserves sales history
    const updated = await db.customer.update({
      where: { id },
      data: { active: false },
    });

    await auditLog({
      userId: user.uid,
      user: user.username,
      action: "DELETE",
      module: "customers",
      details: `Customer ${existing.name} deactivated`,
      severity: "warning",
      ipAddress: ip,
      userAgent: req.headers.get("user-agent") || "",
    });

    return NextResponse.json({ success: true, customer: updated });
  } catch (e) {
    console.error("DELETE /api/customers/[id] error:", e);
    return NextResponse.json({ error: "Failed to deactivate customer" }, { status: 500 });
  }
}
