/**
 * SYLHN POS — TOTP 2FA (Time-based One-Time Password)
 *
 * Implements RFC 6238 TOTP for two-factor authentication on admin/manager accounts.
 *
 * Uses:
 *  - SHA-1 HMAC (RFC 6238 standard — Google Authenticator compatible)
 *  - 30-second time step
 *  - 6-digit codes
 *  - Base32-encoded secrets (40 chars = 20 bytes of entropy)
 *
 * Setup flow:
 *   1. User enables 2FA in security settings
 *   2. Server generates a random secret, stores it on SystemUser
 *   3. User scans QR code (otpauth:// URL) with Google Authenticator / Authy
 *   4. User enters 6-digit code to verify setup
 *   5. Server enables 2FA flag on the user account
 *
 * Login flow:
 *   1. User submits username + password
 *   2. If 2FA enabled, server returns { needsTwoFactor: true, challenge: <jwt> }
 *   3. User submits TOTP code
 *   4. Server verifies code against stored secret
 *   5. Server issues session token
 */

import crypto from "crypto";

const STEP_SECONDS = 30;
const DIGITS = 6;
const WINDOW = 1; // accept codes from current step ± 1 (90 second drift window)

// ===== Base32 encoding (RFC 4648) =====
const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(buffer: Buffer): string {
  let result = "";
  let bits = 0;
  let value = 0;
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      result += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    result += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return result;
}

export function base32Decode(b32: string): Buffer {
  const cleaned = b32.replace(/=+$/, "").toUpperCase().replace(/\s/g, "");
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of cleaned) {
    const idx = BASE32_ALPHABET.indexOf(char);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

// ===== TOTP core =====

/**
 * Generate a TOTP code for a given secret + timestamp.
 */
export function generateTOTP(secret: Buffer, timestamp: number = Date.now()): string {
  const counter = Math.floor(timestamp / 1000 / STEP_SECONDS);
  const counterBuffer = Buffer.alloc(8);
  // Write counter as big-endian 64-bit
  counterBuffer.writeBigUInt64BE(BigInt(counter));

  const hmac = crypto.createHmac("sha1", secret).update(counterBuffer).digest();

  // Dynamic truncation (RFC 4226)
  const offset = hmac[hmac.length - 1] & 0x0f;
  const truncated = (
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff)
  );
  const code = truncated % (10 ** DIGITS);
  return code.toString().padStart(DIGITS, "0");
}

/**
 * Verify a TOTP code against a secret, allowing for clock drift (± window steps).
 * Uses constant-time comparison to prevent timing attacks.
 */
export function verifyTOTP(secret: Buffer, code: string, timestamp: number = Date.now()): boolean {
  if (!/^\d{6}$/.test(code)) return false;

  const counter = Math.floor(timestamp / 1000 / STEP_SECONDS);
  for (let drift = -WINDOW; drift <= WINDOW; drift++) {
    const testTime = (counter + drift) * STEP_SECONDS * 1000;
    const expected = generateTOTP(secret, testTime);
    if (constantTimeCompare(code, expected)) return true;
  }
  return false;
}

function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

// ===== Setup helpers =====

/**
 * Generate a new random TOTP secret (20 bytes = 160 bits of entropy).
 */
export function generateSecret(): { secret: Buffer; base32: string } {
  const secret = crypto.randomBytes(20);
  return { secret, base32: base32Encode(secret) };
}

/**
 * Build the otpauth:// URL for QR code generation.
 * Format: otpauth://totp/<label>?secret=<base32>&issuer=<issuer>&algorithm=SHA1&digits=6&period=30
 */
export function buildOtpAuthURL(opts: {
  issuer: string;       // e.g. "SYLHN POS"
  accountName: string;  // e.g. user email or username
  secretBase32: string;
}): string {
  const label = encodeURIComponent(`${opts.issuer}:${opts.accountName}`);
  const params = new URLSearchParams({
    secret: opts.secretBase32,
    issuer: opts.issuer,
    algorithm: "SHA1",
    digits: String(DIGITS),
    period: String(STEP_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

/**
 * Generate a set of one-time backup codes (10 codes, 8 chars each).
 * Used when the user loses their authenticator device.
 * Returns the codes as plain strings; the caller should hash them before storing.
 */
export function generateBackupCodes(): string[] {
  const codes: string[] = [];
  for (let i = 0; i < 10; i++) {
    const bytes = crypto.randomBytes(4);
    const code = Array.from(bytes, b => (b % 36).toString(36)).join("").toUpperCase().padStart(8, "0").slice(-8);
    codes.push(code);
  }
  return codes;
}

/**
 * Hash a backup code for storage (SHA-256 with pepper).
 * Backup codes are one-time-use, so a simple hash is fine — no need for bcrypt.
 */
export function hashBackupCode(code: string): string {
  const pepper = process.env.SESSION_SECRET || process.env.JWT_SECRET || "dev-pepper";
  return crypto.createHash("sha256").update("backup-code:" + code + ":" + pepper).digest("hex");
}
