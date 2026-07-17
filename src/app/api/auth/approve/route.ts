import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, verifyPassword } from "@/lib/auth";
import { rateLimitApiWrite, rateLimitResponse, getClientIp } from "@/lib/rate-limit";
import { auditLog } from "@/lib/audit";

// POST /api/auth/approve
// Premium: manager approval flow for sensitive actions (voids > GHS 100, refunds, etc.)
// Body: { action: "void" | "refund" | "discount" | "delete", amount?: number, reason?: string, managerUsername: string, managerPassword: string }
// Returns: { approved: true, approver: { id, username, role } } or 401 / 403
export async function POST(req: NextRequest) {
  let requestingUser;
  try { requestingUser = await requireAuth(); } catch (e) { return e as Response; }

  const ip = getClientIp(req);
  const rl = rateLimitApiWrite(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { action, amount, reason, managerUsername, managerPassword } = body;

  if (!managerUsername || !managerPassword) {
    return NextResponse.json({ error: "Manager username and password required" }, { status: 400 });
  }

  if (!action) {
    return NextResponse.json({ error: "Action is required" }, { status: 400 });
  }

  // Find the manager/admin user
  const manager = await db.systemUser.findUnique({ where: { username: String(managerUsername) } });
  if (!manager) {
    await auditLog({
      userId: requestingUser.uid,
      user: requestingUser.username,
      action: "APPROVE_DENIED",
      module: "auth",
      details: `Approval denied for action ${action}${amount ? ` (GHS ${amount})` : ""} — unknown manager username "${managerUsername}"`,
      severity: "warning",
      ipAddress: ip,
      userAgent: req.headers.get("user-agent") || "",
    });
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  if (!manager.active) {
    await auditLog({
      userId: requestingUser.uid,
      user: requestingUser.username,
      action: "APPROVE_DENIED",
      module: "auth",
      details: `Approval denied — manager account "${managerUsername}" is deactivated`,
      severity: "warning",
      ipAddress: ip,
      userAgent: req.headers.get("user-agent") || "",
    });
    return NextResponse.json({ error: "Account deactivated" }, { status: 403 });
  }

  // Verify password
  let valid = false;
  if (manager.password.startsWith("pbkdf2$")) {
    valid = await verifyPassword(String(managerPassword), manager.password);
  } else {
    // Legacy plaintext
    valid = manager.password === String(managerPassword);
  }

  if (!valid) {
    await auditLog({
      userId: requestingUser.uid,
      user: requestingUser.username,
      action: "APPROVE_DENIED",
      module: "auth",
      details: `Approval denied for ${action}${amount ? ` (GHS ${amount})` : ""} — bad password for "${managerUsername}"`,
      severity: "warning",
      ipAddress: ip,
      userAgent: req.headers.get("user-agent") || "",
    });
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  // Check role — must be manager or admin
  if (manager.role !== "manager" && manager.role !== "admin") {
    await auditLog({
      userId: requestingUser.uid,
      user: requestingUser.username,
      action: "APPROVE_DENIED",
      module: "auth",
      details: `Approval denied — "${managerUsername}" is ${manager.role}, not manager/admin`,
      severity: "warning",
      ipAddress: ip,
      userAgent: req.headers.get("user-agent") || "",
    });
    return NextResponse.json({ error: "Insufficient role — manager or admin required" }, { status: 403 });
  }

  // Approved
  await auditLog({
    userId: requestingUser.uid,
    user: requestingUser.username,
    action: "APPROVE_GRANTED",
    module: "auth",
    details: `${manager.username} (${manager.role}) approved ${requestingUser.username}'s ${action}${amount ? ` of GHS ${Number(amount).toFixed(2)}` : ""}${reason ? ` — reason: ${reason}` : ""}`,
    severity: "warning",
    ipAddress: ip,
    userAgent: req.headers.get("user-agent") || "",
  });

  return NextResponse.json({
    approved: true,
    approver: {
      id: manager.id,
      username: manager.username,
      fullName: manager.fullName,
      role: manager.role,
    },
    action,
    amount: amount ? Number(amount) : undefined,
    reason: reason || "",
    approvedAt: new Date().toISOString(),
  });
}
