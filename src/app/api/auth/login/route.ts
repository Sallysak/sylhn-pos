import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  hashPassword,
  verifyPassword,
  createSessionToken,
  setSessionCookie,
  setCsrfCookie,
} from "@/lib/auth";
import { LoginSchema, validate, validationError } from "@/lib/validation";
import { rateLimitLogin, rateLimitResponse, getClientIp } from "@/lib/rate-limit";
import { auditLog } from "@/lib/audit";

// POST /api/auth/login — authenticate user, set session cookie
export async function POST(req: NextRequest) {
  // Rate limit
  const ip = getClientIp(req);
  const rl = rateLimitLogin(ip);
  if (!rl.allowed) {
    return rateLimitResponse(rl, "Too many login attempts. Please try again later.");
  }

  // Parse + validate
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return validationError("Invalid JSON body");
  }

  const result = validate(LoginSchema, body);
  if (!result.success) return validationError(result.error);
  const { username, password } = result.data;

  // Find user in DB
  try {
    const user = await db.systemUser.findUnique({ where: { username } });
    if (!user) {
      // Audit failed login (no PII)
      await auditLog({
        userId: "",
        user: username,
        action: "LOGIN_FAILED",
        module: "auth",
        details: `Failed login for unknown username "${username}"`,
        severity: "warning",
        ipAddress: ip,
        userAgent: req.headers.get("user-agent") || "",
      });
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }
    if (!user.active) {
      await auditLog({
        userId: user.id,
        user: user.username,
        action: "LOGIN_BLOCKED",
        module: "auth",
        details: `Login blocked for deactivated account "${user.username}"`,
        severity: "warning",
        ipAddress: ip,
        userAgent: req.headers.get("user-agent") || "",
      });
      return NextResponse.json({ error: "Account deactivated" }, { status: 403 });
    }

    // Verify password
    // If the stored password is plaintext (legacy), verify matches plaintext,
    // then upgrade it to a hash on the fly.
    let valid = false;
    if (user.password.startsWith("pbkdf2$")) {
      valid = await verifyPassword(password, user.password);
    } else {
      // Legacy plaintext — verify then upgrade
      valid = user.password === password;
      if (valid) {
        const hashed = await hashPassword(password);
        await db.systemUser.update({
          where: { id: user.id },
          data: { password: hashed, lastLogin: new Date() },
        });
      }
    }

    if (!valid) {
      await auditLog({
        userId: user.id,
        user: user.username,
        action: "LOGIN_FAILED",
        module: "auth",
        details: `Failed login for "${user.username}" (bad password)`,
        severity: "warning",
        ipAddress: ip,
        userAgent: req.headers.get("user-agent") || "",
      });
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    // Update lastLogin
    await db.systemUser.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    // Create session token + cookies
    const token = createSessionToken({
      uid: user.id,
      username: user.username,
      role: user.role,
    });
    await setSessionCookie(token);
    await setCsrfCookie();

    // Audit successful login
    await auditLog({
      userId: user.id,
      user: user.username,
      action: "LOGIN",
      module: "auth",
      details: `User ${user.username} (${user.role}) logged in`,
      severity: "info",
      ipAddress: ip,
      userAgent: req.headers.get("user-agent") || "",
    });

    // Parse permissions for the client
    let permissions: any = {};
    try { permissions = JSON.parse(user.permissions || "{}"); } catch { /* ignore */ }

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
        phone: user.phone,
        email: user.email,
        permissions,
      },
    });
  } catch (e) {
    console.error("Login error:", e);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
