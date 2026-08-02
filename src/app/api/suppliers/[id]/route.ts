import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requirePermission } from "@/lib/auth";
import { rateLimitApiRead, rateLimitApiWrite, rateLimitResponse, getClientIp } from "@/lib/rate-limit";
import { auditLog } from "@/lib/audit";

// GET /api/suppliers/[id] — full supplier profile (purchases, payments, balance aging)
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { await requireAuth(); } catch (e) { return e as Response; }

  const ip = getClientIp(req);
  const rl = rateLimitApiRead(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  try {
    const { id } = await params;
    const supplier = await db.supplier.findUnique({
      where: { id },
      include: {
        products: { include: { product: { select: { id: true, sku: true, name: true, emoji: true } } } },
        purchases: {
          take: 50,
          orderBy: { createdAt: "desc" },
          select: { id: true, refNo: true, total: true, amountPaid: true, status: true, createdAt: true },
        },
        payments: {
          take: 50,
          orderBy: { paymentDate: "desc" },
          include: { user: { select: { fullName: true, username: true } } },
        },
      },
    });
    if (!supplier) return NextResponse.json({ error: "Supplier not found" }, { status: 404 });
    return NextResponse.json({ supplier });
  } catch (e) {
    console.error("GET /api/suppliers/[id] error:", e);
    return NextResponse.json({ error: "Failed to fetch supplier" }, { status: 500 });
  }
}

// PUT /api/suppliers/[id] — update supplier details
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
    const existing = await db.supplier.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Supplier not found" }, { status: 404 });

    const updated = await db.supplier.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: String(body.name).slice(0, 200) }),
        ...(body.contactName !== undefined && { contactName: String(body.contactName).slice(0, 200) }),
        ...(body.phone !== undefined && { phone: String(body.phone).slice(0, 32) }),
        ...(body.mobile !== undefined && { mobile: String(body.mobile).slice(0, 32) }),
        ...(body.email !== undefined && { email: String(body.email).slice(0, 200) }),
        ...(body.fax !== undefined && { fax: String(body.fax).slice(0, 64) }),
        ...(body.address !== undefined && { address: String(body.address).slice(0, 500) }),
        ...(body.city !== undefined && { city: String(body.city).slice(0, 100) }),
        ...(body.state !== undefined && { state: String(body.state).slice(0, 100) }),
        ...(body.country !== undefined && { country: String(body.country).slice(0, 64) }),
        ...(body.businessNo !== undefined && { businessNo: String(body.businessNo).slice(0, 64) }),
        ...(body.tradingTerms !== undefined && { tradingTerms: String(body.tradingTerms).slice(0, 32) }),
        ...(body.creditLimit !== undefined && { creditLimit: Number(body.creditLimit) || 0 }),
        ...(body.taxInclusive !== undefined && { taxInclusive: Boolean(body.taxInclusive) }),
        ...(body.notes !== undefined && { notes: String(body.notes).slice(0, 2000) }),
        ...(body.active !== undefined && { active: Boolean(body.active) }),
        // Tier 1.6 — rating + blacklist
        ...(body.rating !== undefined && { rating: Math.max(0, Math.min(5, parseInt(body.rating, 10) || 0)) }),
        ...(body.blacklist !== undefined && {
          blacklist: Boolean(body.blacklist),
          blacklistedAt: Boolean(body.blacklist) ? (existing.blacklistedAt || new Date()) : null,
          ...(body.blacklistReason !== undefined && { blacklistReason: String(body.blacklistReason).slice(0, 500) }),
        }),
        ...(body.blacklistReason !== undefined && { blacklistReason: String(body.blacklistReason).slice(0, 500) }),
        // Tier 1.8 — structured early-payment discount terms
        ...(body.earlyPayDiscountPct !== undefined && { earlyPayDiscountPct: Number(body.earlyPayDiscountPct) || 0 }),
        ...(body.earlyPayDays !== undefined && { earlyPayDays: parseInt(body.earlyPayDays, 10) || 0 }),
        ...(body.netDays !== undefined && { netDays: parseInt(body.netDays, 10) || 30 }),
        // Tier 1.10 — TIN
        ...(body.tin !== undefined && { tin: String(body.tin).slice(0, 20) }),
        // Tier 1.15 — bank details
        ...(body.bankName !== undefined && { bankName: String(body.bankName).slice(0, 100) }),
        ...(body.bankAccountName !== undefined && { bankAccountName: String(body.bankAccountName).slice(0, 100) }),
        ...(body.bankAccountNo !== undefined && { bankAccountNo: String(body.bankAccountNo).slice(0, 50) }),
        ...(body.bankBranchCode !== undefined && { bankBranchCode: String(body.bankBranchCode).slice(0, 30) }),
        ...(body.mobileMoneyProvider !== undefined && { mobileMoneyProvider: String(body.mobileMoneyProvider).slice(0, 30) }),
        ...(body.mobileMoneyNumber !== undefined && { mobileMoneyNumber: String(body.mobileMoneyNumber).slice(0, 20) }),
      },
    });

    await auditLog({
      userId: user.uid,
      user: user.username,
      action: "UPDATE",
      module: "supplier",
      details: `Supplier ${updated.code} (${updated.name}) updated`,
      severity: "info",
      ipAddress: ip,
      userAgent: req.headers.get("user-agent") || "",
    });

    return NextResponse.json({ success: true, supplier: updated });
  } catch (e) {
    console.error("PUT /api/suppliers/[id] error:", e);
    return NextResponse.json({ error: "Failed to update supplier" }, { status: 500 });
  }
}

// DELETE /api/suppliers/[id] — soft-delete (set active=false)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let user;
  try { user = await requireAuth(); requirePermission(user.role, "purchase"); } catch (e) { return e as Response; }

  const ip = getClientIp(req);
  const rl = rateLimitApiWrite(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  try {
    const { id } = await params;
    const existing = await db.supplier.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Supplier not found" }, { status: 404 });

    await db.supplier.update({
      where: { id },
      data: { active: false },
    });

    await auditLog({
      userId: user.uid,
      user: user.username,
      action: "DELETE",
      module: "supplier",
      details: `Supplier ${existing.code} (${existing.name}) deactivated`,
      severity: "warning",
      ipAddress: ip,
      userAgent: req.headers.get("user-agent") || "",
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("DELETE /api/suppliers/[id] error:", e);
    return NextResponse.json({ error: "Failed to deactivate supplier" }, { status: 500 });
  }
}
