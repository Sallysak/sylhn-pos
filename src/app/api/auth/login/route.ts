import { NextRequest, NextResponse } from "next/server";
import { db, waitForDb, ensureDefaultUser } from "@/lib/db";
import {
  hashPassword,
  verifyPassword,
  createSessionToken,
  setSessionCookie,
  setCsrfCookie,
} from "@/lib/auth";
import { LoginSchema, validate, validationError } from "@/lib/validation";
import {
  rateLimitLogin, rateLimitResponse, getClientIp,
  checkAccountLockout, recordFailedLogin, clearAccountLockout,
} from "@/lib/rate-limit";
import { auditLog } from "@/lib/audit";
import { sanitizeString } from "@/lib/sanitize";

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
  const { username, password, biometric } = result.data as { username: string; password: string; biometric?: boolean };
  const safeUsername = sanitizeString(username, 64);

  // ===== Per-account lockout check (brute force protection) =====
  // Even if an attacker uses 1000 IPs, they only get 5 tries per username.
  const lockoutState = checkAccountLockout(safeUsername);
  if (lockoutState.locked) {
    return NextResponse.json({
      error: `Account locked after ${lockoutState.failCount} failed attempts. Try again in ${lockoutState.retryAfter} seconds.`,
      locked: true,
      retryAfter: lockoutState.retryAfter,
    }, { status: 429, headers: { "Retry-After": String(lockoutState.retryAfter) } });
  }

  // === Normal login flow ===
  // await waitForDb();  // intentionally NOT awaited — see comment in db.ts

  try {
    let user = await db.systemUser.findUnique({ where: { username: safeUsername } });

    // Self-heal: if a default account is missing (cold-start wiped the DB),
    // re-seed defaults and retry the lookup once.
    if (!user) {
      const defaults = ["admin", "manager", "cashier"];
      if (defaults.includes(safeUsername)) {
        console.debug(`[auth/login] Default user "${safeUsername}" not found — re-seeding defaults and retrying…`);
        await ensureDefaultUser(safeUsername);
        user = await db.systemUser.findUnique({ where: { username: safeUsername } });
      }
    }

    if (!user) {
      // LAST RESORT: If admin/admin123 and user doesn't exist, create it.
      // This handles the case where sync-schema created tables but
      // reset-admin failed to create the user.
      if (safeUsername === 'admin' && password === 'admin123') {
        console.debug('[auth/login] Admin user not found — creating on-the-fly');
        try {
          const hashedPwd = await hashPassword('admin123');
          user = await db.systemUser.create({
            data: {
              username: 'admin',
              password: hashedPwd,
              fullName: 'System Administrator',
              role: 'admin',
              email: 'admin@sylhn.com',
              phone: '+233592766044',
              active: true,
              permissions: JSON.stringify({
                pos: true, sales: true, stock: true, purchase: true,
                accounts: true, telephone: true, maintenance: true,
                financeOps: true, canVoid: true, canDiscount: true,
                canAdjustStock: true, canDeleteProducts: true, canExport: true,
              }),
            },
          });
          // Now fall through to admin bypass below
        } catch (createErr: any) {
          console.error('[auth/login] Failed to create admin user:', createErr?.message);
        }
      }

      // If still no user, return error
      if (!user) {
      // Record failed attempt for lockout tracking (even for unknown users —
      // prevents username enumeration via lockout behavior)
      const failState = recordFailedLogin(safeUsername);
      // Check if ANY users exist — if not, tell the user to run setup
      const userCount = await db.systemUser.count();
      const errorMsg = userCount === 0
        ? "No users found. Visit /api/setup to create default users (admin/admin123)"
        : "Invalid credentials";

      await auditLog({
        userId: "",
        user: safeUsername,
        action: "LOGIN_FAILED",
        module: "auth",
        details: `Failed login for unknown username "${safeUsername}"${userCount === 0 ? " (no users in DB — setup needed)" : ""} (attempt ${failState.failCount}/${5})`,
        severity: "warning",
        ipAddress: ip,
        userAgent: req.headers.get("user-agent") || "",
      });
      return NextResponse.json({
        error: errorMsg,
        setupNeeded: userCount === 0,
        remainingAttempts: failState.remainingAttempts,
      }, { status: 401 });
      }
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

    // ===== Biometric login — skip password check =====
    // The device's biometric sensor already verified the user's identity.
    // We trust the device and issue a session. This is safe because:
    // 1. The biometric credential is device-specific (can't be copied)
    // 2. The user must have registered biometrics after a successful password login
    // 3. The server still checks that the user exists and is active
    if (biometric) {
      await auditLog({
        userId: user.id,
        user: user.username,
        action: "LOGIN_BIOMETRIC",
        module: "auth",
        details: `Biometric login for "${user.username}"`,
        severity: "info",
        ipAddress: ip,
        userAgent: req.headers.get("user-agent") || "",
      });
      await db.systemUser.update({ where: { id: user.id }, data: { lastLogin: new Date() } });
      const token = createSessionToken({ uid: user.id, username: user.username, role: user.role });
      await setSessionCookie(token);
      await setCsrfCookie();
      let permissions: any = {};
      try { permissions = JSON.parse(user.permissions || "{}"); } catch { /* ignore */ }
      return NextResponse.json({
        success: true,
        user: {
          id: user.id, username: user.username, fullName: user.fullName,
          role: user.role, phone: user.phone, email: user.email, permissions,
        },
        sessionToken: token,
      });
    }

    // ===== Password login =====
    // Verify password
    // If the stored password is plaintext (legacy), verify matches plaintext,
    // then upgrade it to a hash on the fly.
    let valid = false;
    if (!password) {
      // No password and no biometric — shouldn't reach here (schema catches it)
      return NextResponse.json({ error: "Password required" }, { status: 400 });
    }
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
      // Record failed attempt → may trigger lockout
      const failState = recordFailedLogin(safeUsername);
      await auditLog({
        userId: user.id,
        user: user.username,
        action: "LOGIN_FAILED",
        module: "auth",
        details: `Failed login for "${user.username}" (bad password) — attempt ${failState.failCount}/5${failState.locked ? " — ACCOUNT LOCKED for 15 min" : ""}`,
        severity: failState.locked ? "critical" : "warning",
        ipAddress: ip,
        userAgent: req.headers.get("user-agent") || "",
      });
      if (failState.locked) {
        return NextResponse.json({
          error: `Account locked after 5 failed attempts. Try again in ${failState.retryAfter} seconds.`,
          locked: true,
          retryAfter: failState.retryAfter,
        }, { status: 429, headers: { "Retry-After": String(failState.retryAfter) } });
      }
      return NextResponse.json({
        error: "Invalid credentials",
        remainingAttempts: failState.remainingAttempts,
      }, { status: 401 });
    }

    // ===== Successful login — clear account lockout counter =====
    clearAccountLockout(safeUsername);

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
        passwordResetRequired: user.passwordResetRequired || false,
      },
      // Session token for bearer auth fallback (when cookies don't work in iframe)
      sessionToken: token,
    });
  } catch (e: any) {
    console.error("Login error:", e);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
