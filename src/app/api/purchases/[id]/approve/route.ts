import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requirePermission } from "@/lib/auth";
import { rateLimitApiWrite, rateLimitResponse, getClientIp } from "@/lib/rate-limit";
import { auditLog } from "@/lib/audit";

// POST /api/purchases/[id]/approve
// Body: { managerUsername: string, managerPassword: string }
//
// Verifies manager credentials via the existing /api/auth/approve endpoint,
// then marks the purchase as approved.
//
// Tier 2 #16 — Real approval status:
// Status flow is now: draft → pending_approval → approved → ordered → received
//   - POs over the approval threshold are saved with status='pending_approval'
//   - This endpoint transitions pending_approval → approved
//   - Once approved, the PO can be Sent (status='ordered') and Received
// For backwards compat: if the PO is already 'ordered' or 'received',
// approval just confirms it (audit-logged, no status change).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let user;
  try { user = await requireAuth(); requirePermission(user.role, "purchase"); } catch (e) { return e as Response; }
  const ip = getClientIp(req);
  const rl = rateLimitApiWrite(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  const { id } = await params;

  let purchase = await db.purchase.findUnique({
    where: { id },
    select: { id: true, refNo: true, total: true, status: true, supplierId: true, approvedById: true, approvedAt: true },
  });
  if (!purchase) {
    purchase = await db.purchase.findUnique({
      where: { refNo: id },
      select: { id: true, refNo: true, total: true, status: true, supplierId: true, approvedById: true, approvedAt: true },
    });
  }
  if (!purchase) return NextResponse.json({ error: "Purchase not found" }, { status: 404 });

  let body: any;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.managerUsername || !body.managerPassword) {
    return NextResponse.json({ error: "Manager username and password required" }, { status: 400 });
  }

  // Verify manager credentials by calling the existing approve endpoint
  const approveRes = await fetch(new URL("/api/auth/approve", req.url), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cookie": req.headers.get("cookie") || "",
    },
    body: JSON.stringify({
      action: "po_approve",
      amount: Number(purchase.total),
      reason: `Approve PO ${purchase.refNo}`,
      managerUsername: body.managerUsername,
      managerPassword: body.managerPassword,
    }),
  });
  const approveData = await approveRes.json();
  if (!approveRes.ok || !approveData.approved) {
    return NextResponse.json(
      { error: approveData.error || "Approval denied" },
      { status: 401 }
    );
  }

  // Tier 2 #16 — actually update the Purchase record:
  // - Set approvedById + approvedAt (always)
  // - If status was 'pending_approval', transition to 'approved'
  // - For backwards compat, 'ordered' and 'received' stay as-is
  const updateData: any = {
    approvedById: approveData.approver.uid,
    approvedAt: new Date(),
  };
  let statusChanged = false;
  if (purchase.status === "pending_approval") {
    updateData.status = "approved";
    statusChanged = true;
  }

  const updated = await db.purchase.update({
    where: { id: purchase.id },
    data: updateData,
    select: { id: true, refNo: true, status: true, approvedById: true, approvedAt: true },
  }).catch((e) => {
    console.error("Failed to update purchase approval:", e);
    return null;
  });

  await auditLog({
    userId: user.uid,
    user: user.username,
    action: "APPROVE",
    module: "purchase",
    details: `PO ${purchase.refNo} approved by ${approveData.approver.username} (${approveData.approver.role}) — ₵${Number(purchase.total).toFixed(2)}${statusChanged ? ` · status: pending_approval → approved` : ` · status: ${purchase.status} (confirmed)`}`,
    severity: "warning",
    ipAddress: ip,
    userAgent: req.headers.get("user-agent") || "",
  }).catch(() => {});

  return NextResponse.json({
    success: true,
    approver: approveData.approver,
    approvedAt: updated?.approvedAt?.toISOString() || new Date().toISOString(),
    previousStatus: purchase.status,
    newStatus: updated?.status || purchase.status,
    statusChanged,
  });
}
