import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole, hashPassword, verifyPassword } from "@/lib/auth";
import { rateLimitApiWrite, rateLimitApiRead, rateLimitResponse, getClientIp } from "@/lib/rate-limit";
import { auditLog } from "@/lib/audit";

// PUT /api/users/[id] — update a user (admin only)
// Body can include: fullName, role, phone, email, active, permissions,
// username (change username), newPassword (reset password)
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let adminUser;
  try { adminUser = await requireRole("admin"); } catch (e) { return e as Response; }

  const ip = getClientIp(req);
  const rl = rateLimitApiWrite(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  try {
    const { id } = await params;
    const existing = await db.systemUser.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "User not found" }, { status: 404 });

    // Build update data — only include fields that are provided
    const data: any = {};
    if (body.fullName !== undefined) data.fullName = String(body.fullName).slice(0, 200);
    if (body.role !== undefined) {
      const validRoles = ["admin", "manager", "cashier", "stockkeeper", "accountant"];
      if (!validRoles.includes(body.role)) return NextResponse.json({ error: "Invalid role" }, { status: 400 });
      data.role = body.role;
    }
    if (body.phone !== undefined) data.phone = String(body.phone).slice(0, 32);
    if (body.email !== undefined) data.email = String(body.email).slice(0, 200);
    if (body.active !== undefined) data.active = Boolean(body.active);
    if (body.permissions !== undefined) {
      data.permissions = typeof body.permissions === "string" ? body.permissions : JSON.stringify(body.permissions);
    }

    // Username change — check for conflicts
    if (body.username !== undefined && body.username !== existing.username) {
      const conflict = await db.systemUser.findUnique({ where: { username: body.username } });
      if (conflict) return NextResponse.json({ error: "Username already taken" }, { status: 409 });
      data.username = String(body.username).slice(0, 64);
    }

    // Password reset (admin sets a new password for the user)
    if (body.newPassword) {
      if (body.newPassword.length < 4) {
        return NextResponse.json({ error: "Password must be at least 4 characters" }, { status: 400 });
      }
      data.password = await hashPassword(body.newPassword);
      data.passwordResetRequired = false; // admin set it, so it's intentional
    }

    // Password reset flag (force user to change on next login)
    if (body.forcePasswordReset !== undefined) {
      data.passwordResetRequired = Boolean(body.forcePasswordReset);
    }

    const updated = await db.systemUser.update({ where: { id }, data });

    // Audit log
    const changes: string[] = [];
    if (data.role && data.role !== existing.role) changes.push(`role: ${existing.role}→${data.role}`);
    if (data.active !== undefined && data.active !== existing.active) changes.push(`active: ${existing.active}→${data.active}`);
    if (data.username) changes.push(`username: ${existing.username}→${data.username}`);
    if (data.password) changes.push("password reset");
    if (data.permissions) changes.push("permissions updated");

    await auditLog({
      userId: adminUser.uid,
      user: adminUser.username,
      action: "UPDATE",
      module: "auth",
      details: `Admin ${adminUser.username} updated user ${existing.username} (${existing.fullName})${changes.length ? ` — ${changes.join(", ")}` : ""}`,
      severity: "warning",
      ipAddress: ip,
      userAgent: req.headers.get("user-agent") || "",
    }).catch(() => {});

    return NextResponse.json({ success: true, user: { ...updated, password: undefined } });
  } catch (e: any) {
    console.error("PUT /api/users/[id] error:", e);
    return NextResponse.json({ error: "Failed to update user", detail: e?.message }, { status: 500 });
  }
}

// DELETE /api/users/[id] — deactivate (soft delete) or hard delete with ?force=true
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let adminUser;
  try { adminUser = await requireRole("admin"); } catch (e) { return e as Response; }

  const ip = getClientIp(req);
  const rl = rateLimitApiWrite(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  try {
    const { id } = await params;
    const force = req.nextUrl.searchParams.get("force") === "true";

    const user = await db.systemUser.findUnique({ where: { id } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    // Prevent self-deletion
    if (user.id === adminUser.uid) {
      return NextResponse.json({ error: "You cannot delete your own account" }, { status: 400 });
    }

    // Prevent deleting the last admin
    if (user.role === "admin") {
      const adminCount = await db.systemUser.count({ where: { role: "admin", active: true } });
      if (adminCount <= 1) {
        return NextResponse.json({ error: "Cannot delete the last admin account" }, { status: 400 });
      }
    }

    if (force) {
      await db.systemUser.delete({ where: { id } });
    } else {
      await db.systemUser.update({ where: { id }, data: { active: false } });
    }

    await auditLog({
      userId: adminUser.uid,
      user: adminUser.username,
      action: "DELETE",
      module: "auth",
      details: `Admin ${adminUser.username} ${force ? "hard-deleted" : "deactivated"} user ${user.username} (${user.fullName})`,
      severity: "critical",
      ipAddress: ip,
      userAgent: req.headers.get("user-agent") || "",
    }).catch(() => {});

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error("DELETE /api/users/[id] error:", e);
    return NextResponse.json({ error: "Failed to delete user" }, { status: 500 });
  }
}
