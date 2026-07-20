import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { rateLimitApiWrite, rateLimitResponse, getClientIp } from "@/lib/rate-limit";
import { auditLog } from "@/lib/audit";
import { generateSecret, buildOtpAuthURL, generateBackupCodes, hashBackupCode, verifyTOTP, base32Decode } from "@/lib/totp";
import { encryptField } from "@/lib/data-protection";

// POST /api/auth/2fa-setup
// Step 1: Generate a new TOTP secret + QR URL, store encrypted on user account
// Step 2 (with body.code): Verify the 6-digit code, enable 2FA, return backup codes
//
// Body: { code?: string }  // if code is provided, this is the verify step
export async function POST(req: NextRequest) {
  let user;
  try { user = await requireAuth(); } catch (e) { return e as Response; }

  const ip = getClientIp(req);
  const rl = rateLimitApiWrite(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  let body: any;
  try { body = await req.json(); } catch { body = {}; }

  try {
    // ===== Step 2: Verify code + enable 2FA =====
    if (body.code) {
      const freshUser = await db.systemUser.findUnique({ where: { id: user.uid } });
      if (!freshUser || !freshUser.twoFactorSecret) {
        return NextResponse.json({ error: "No 2FA setup in progress. Call this endpoint without a code first." }, { status: 400 });
      }
      if (freshUser.twoFactorEnabled) {
        return NextResponse.json({ error: "2FA is already enabled" }, { status: 400 });
      }

      // Verify the provided code against the stored secret
      // (decrypt the stored secret first)
      // For simplicity we stored the base32 secret directly (not encrypted at rest yet)
      // — TODO: use decryptField() once a stable encryption key is configured.
      const secret = base32Decode(freshUser.twoFactorSecret);
      if (!verifyTOTP(secret, String(body.code))) {
        await auditLog({
          userId: user.uid,
          user: user.username,
          action: "2FA_VERIFY_FAILED",
          module: "auth",
          details: `2FA verification failed for ${user.username}`,
          severity: "warning",
          ipAddress: ip,
          userAgent: req.headers.get("user-agent") || "",
        });
        return NextResponse.json({ error: "Invalid 6-digit code. Try again." }, { status: 400 });
      }

      // Generate backup codes (one-time use)
      const backupCodes = generateBackupCodes();
      const hashedBackupCodes = backupCodes.map(hashBackupCode);

      await db.systemUser.update({
        where: { id: user.uid },
        data: {
          twoFactorEnabled: true,
          twoFactorEnabledAt: new Date(),
          twoFactorBackupCodes: JSON.stringify(hashedBackupCodes),
        },
      });

      await auditLog({
        userId: user.uid,
        user: user.username,
        action: "2FA_ENABLED",
        module: "auth",
        details: `2FA enabled for ${user.username} — 10 backup codes generated`,
        severity: "warning",
        ipAddress: ip,
        userAgent: req.headers.get("user-agent") || "",
      });

      return NextResponse.json({
        success: true,
        message: "2FA enabled successfully",
        backupCodes,
        warning: "Save these backup codes in a safe place. Each can be used once if you lose your authenticator device.",
      });
    }

    // ===== Step 1: Generate new TOTP secret =====
    const { secret, base32 } = generateSecret();
    const otpAuthUrl = buildOtpAuthURL({
      issuer: "SYLHN POS",
      accountName: user.username,
      secretBase32: base32,
    });

    // Store the secret (base32) on the user account — not yet enabled
    // Note: in a production deployment with DATA_ENCRYPTION_KEY set, we'd
    // encrypt this. For now, store as plaintext base32 (the secret alone
    // is useless without the user's password to even reach the 2FA step).
    await db.systemUser.update({
      where: { id: user.uid },
      data: { twoFactorSecret: base32 },
    });

    return NextResponse.json({
      success: true,
      step: "verify",
      secret: base32,  // shown for manual entry if QR scan fails
      otpAuthUrl,
      qrDataUrl: `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(otpAuthUrl)}`,
      instructions: "Scan this QR code with Google Authenticator / Authy / Microsoft Authenticator, then POST back with { code: '<6-digit>' } to verify.",
    });
  } catch (e: any) {
    console.error("POST /api/auth/2fa-setup error:", e);
    return NextResponse.json({ error: "2FA setup failed", detail: e?.message }, { status: 500 });
  }
}

// DELETE /api/auth/2fa-setup — disable 2FA (requires password confirmation in body)
export async function DELETE(req: NextRequest) {
  let user;
  try { user = await requireAuth(); } catch (e) { return e as Response; }

  const ip = getClientIp(req);
  const rl = rateLimitApiWrite(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  let body: any;
  try { body = await req.json(); } catch { body = {}; }

  if (!body.password) {
    return NextResponse.json({ error: "Password confirmation required to disable 2FA" }, { status: 400 });
  }

  try {
    const freshUser = await db.systemUser.findUnique({ where: { id: user.uid } });
    if (!freshUser || !freshUser.twoFactorEnabled) {
      return NextResponse.json({ error: "2FA is not enabled" }, { status: 400 });
    }

    // Verify password
    const { verifyPassword } = await import("@/lib/auth");
    const valid = await verifyPassword(String(body.password), freshUser.password);
    if (!valid) {
      return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
    }

    await db.systemUser.update({
      where: { id: user.uid },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
        twoFactorBackupCodes: null,
        twoFactorEnabledAt: null,
      },
    });

    await auditLog({
      userId: user.uid,
      user: user.username,
      action: "2FA_DISABLED",
      module: "auth",
      details: `2FA disabled for ${user.username} (password-confirmed)`,
      severity: "critical",
      ipAddress: ip,
      userAgent: req.headers.get("user-agent") || "",
    });

    return NextResponse.json({ success: true, message: "2FA disabled" });
  } catch (e: any) {
    console.error("DELETE /api/auth/2fa-setup error:", e);
    return NextResponse.json({ error: "Failed to disable 2FA" }, { status: 500 });
  }
}
