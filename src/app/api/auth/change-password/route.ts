import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, hashPassword, verifyPassword } from "@/lib/auth";
import { validate, PasswordChangeSchema, validationError } from "@/lib/validation";
import { rateLimitApiWrite, rateLimitResponse, getClientIp } from "@/lib/rate-limit";
import { auditLog } from "@/lib/audit";

// POST /api/auth/change-password — change the current user's password
// Body: { currentPassword: string, newPassword: string }
//
// The new password must meet the strong password policy (min 8 chars, must
// contain a letter + a number, not in the weak-password list).
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  const ip = getClientIp(req);
  const rl = rateLimitApiWrite(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  let body: unknown;
  try { body = await req.json(); } catch { return validationError("Invalid JSON body"); }
  const result = validate(PasswordChangeSchema, body);
  if (!result.success) return validationError(result.error);
  const { currentPassword, newPassword } = result.data;

  try {
    const user = await db.systemUser.findUnique({ where: { id: session.uid } });
    if (!user || !user.active) {
      return NextResponse.json({ error: "User not found or deactivated" }, { status: 404 });
    }

    // Verify current password
    let valid = false;
    if (user.password.startsWith("pbkdf2$")) {
      valid = await verifyPassword(currentPassword, user.password);
    } else {
      // Legacy plaintext — accept and upgrade
      valid = user.password === currentPassword;
    }
    if (!valid) {
      await auditLog({
        userId: user.id,
        user: user.username,
        action: "PASSWORD_CHANGE_FAILED",
        module: "auth",
        details: `Failed password change for "${user.username}" (bad current password)`,
        severity: "warning",
        ipAddress: ip,
        userAgent: req.headers.get("user-agent") || "",
      }).catch(() => {});
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
    }

    // Don't allow same password
    if (currentPassword === newPassword) {
      return NextResponse.json({ error: "New password must be different from current" }, { status: 400 });
    }

    // Hash + save
    const newHash = await hashPassword(newPassword);
    await db.systemUser.update({
      where: { id: user.id },
      data: { password: newHash },
    });

    await auditLog({
      userId: user.id,
      user: user.username,
      action: "PASSWORD_CHANGE",
      module: "auth",
      details: `User ${user.username} changed their password`,
      severity: "info",
      ipAddress: ip,
      userAgent: req.headers.get("user-agent") || "",
    }).catch(() => {});

    return NextResponse.json({ success: true, message: "Password changed successfully" });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Password change failed" }, { status: 500 });
  }
}
