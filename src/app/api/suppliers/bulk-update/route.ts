import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requirePermission } from "@/lib/auth";
import { rateLimitApiWrite, rateLimitResponse, getClientIp } from "@/lib/rate-limit";
import { auditLog } from "@/lib/audit";

// POST /api/suppliers/bulk-update
// Apply the same field updates to multiple suppliers at once.
// Body: {
//   supplierIds: string[],          // required — list of supplier IDs to update
//   rating?: number,                // 0-5 stars
//   blacklist?: boolean,
//   blacklistReason?: string,
//   tin?: string,
//   earlyPayDiscountPct?: number,
//   earlyPayDays?: number,
//   netDays?: number,
//   mobileMoneyProvider?: string,
//   mobileMoneyNumber?: string,
// }
//
// Only fields that are present in the body are updated. This lets the
// admin set ratings + blacklist for many suppliers in one call, which
// is much faster than editing each supplier individually.
//
// Admin/manager only. Audit-logged.
export async function POST(req: NextRequest) {
  let user;
  try {
    user = await requireAuth();
    requirePermission(user.role, "purchase");
  } catch (e: any) { return e as Response; }

  const ip = getClientIp(req);
  const rl = rateLimitApiWrite(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  let body: any;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const ids: string[] = Array.isArray(body.supplierIds) ? body.supplierIds : [];
  if (ids.length === 0) {
    return NextResponse.json({ error: "supplierIds array is required (and must be non-empty)" }, { status: 400 });
  }
  if (ids.length > 500) {
    return NextResponse.json({ error: "Cannot update more than 500 suppliers at once" }, { status: 400 });
  }

  // Build the update data — only include fields that are present
  const updateData: any = {};
  if (body.rating !== undefined) updateData.rating = Math.max(0, Math.min(5, parseInt(body.rating, 10) || 0));
  if (body.blacklist !== undefined) {
    updateData.blacklist = Boolean(body.blacklist);
    updateData.blacklistedAt = Boolean(body.blacklist) ? new Date() : null;
  }
  if (body.blacklistReason !== undefined) updateData.blacklistReason = String(body.blacklistReason).slice(0, 500);
  if (body.tin !== undefined) updateData.tin = String(body.tin).slice(0, 20);
  if (body.earlyPayDiscountPct !== undefined) updateData.earlyPayDiscountPct = Number(body.earlyPayDiscountPct) || 0;
  if (body.earlyPayDays !== undefined) updateData.earlyPayDays = parseInt(body.earlyPayDays, 10) || 0;
  if (body.netDays !== undefined) updateData.netDays = parseInt(body.netDays, 10) || 30;
  if (body.mobileMoneyProvider !== undefined) updateData.mobileMoneyProvider = String(body.mobileMoneyProvider).slice(0, 30);
  if (body.mobileMoneyNumber !== undefined) updateData.mobileMoneyNumber = String(body.mobileMoneyNumber).slice(0, 20);

  const fieldsToUpdate = Object.keys(updateData);
  if (fieldsToUpdate.length === 0) {
    return NextResponse.json({ error: "No fields to update — include at least one of: rating, blacklist, blacklistReason, tin, earlyPayDiscountPct, earlyPayDays, netDays, mobileMoneyProvider, mobileMoneyNumber" }, { status: 400 });
  }

  try {
    // Fetch existing suppliers for audit log
    const existing = await db.supplier.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, code: true, rating: true, blacklist: true, tin: true },
    });
    if (existing.length === 0) {
      return NextResponse.json({ error: "No suppliers found with the given IDs" }, { status: 404 });
    }

    // Perform the bulk update
    const result = await db.supplier.updateMany({
      where: { id: { in: ids } },
      data: updateData,
    });

    // Audit log
    const fieldSummary = fieldsToUpdate.map(f => `${f}=${f === "blacklist" ? updateData.blacklist : f === "rating" ? updateData.rating : "…"}`).join(", ");
    await auditLog({
      userId: user.uid,
      user: user.username,
      action: "BULK_UPDATE",
      module: "supplier",
      details: `Bulk updated ${result.count} supplier(s) — fields: ${fieldSummary}. Suppliers: ${existing.slice(0, 5).map(s => s.name).join(", ")}${existing.length > 5 ? ` +${existing.length - 5} more` : ""}`,
      severity: "warning",
      ipAddress: ip,
      userAgent: req.headers.get("user-agent") || "",
    });

    return NextResponse.json({
      success: true,
      updatedCount: result.count,
      requestedCount: ids.length,
      fieldsUpdated: fieldsToUpdate,
    });
  } catch (e: any) {
    console.error("POST /api/suppliers/bulk-update error:", e);
    return NextResponse.json({ error: e?.message || "Failed to bulk update suppliers" }, { status: 500 });
  }
}
