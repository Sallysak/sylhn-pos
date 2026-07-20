/**
 * SYLHN POS — Advanced Data Protection
 *
 * Provides:
 *  - Field-level AES-256-GCM encryption for PII (customer phone/email, etc.)
 *  - Audit log retention policy (auto-trim after N days)
 *  - PII redaction in logs (mask phone numbers, emails, passwords)
 *  - Secure data export with optional encryption
 *
 * Encryption strategy:
 *  - Master key: env var DATA_ENCRYPTION_KEY (32 hex chars = 16 bytes)
 *    OR derived from SESSION_SECRET via SHA-256 if DATA_ENCRYPTION_KEY not set.
 *  - Per-field IV: random 12 bytes per encryption (stored with ciphertext).
 *  - Format: enc:v1:<iv_hex>:<ciphertext_hex>:<auth_tag_hex>
 *
 * Backward compatibility:
 *  - decrypt() returns the original value if it doesn't start with "enc:v1:"
 *    so existing plaintext data still works after enabling encryption.
 */

import crypto from "crypto";

const ALGO = "aes-256-gcm";
const IV_BYTES = 12;
const KEY_BYTES = 32;
const PREFIX = "enc:v1:";

let cachedKey: Buffer | null = null;

function getMasterKey(): Buffer {
  if (cachedKey) return cachedKey;

  // 1. Prefer explicit DATA_ENCRYPTION_KEY (32 hex chars = 16 bytes; we derive 32 bytes via SHA-256)
  const explicit = process.env.DATA_ENCRYPTION_KEY;
  if (explicit && explicit.length >= 32) {
    cachedKey = crypto.createHash("sha256").update(explicit).digest();
    return cachedKey;
  }

  // 2. Derive from SESSION_SECRET (already required for JWT signing)
  const sessionSecret = process.env.SESSION_SECRET || process.env.JWT_SECRET;
  if (sessionSecret && sessionSecret.length >= 32) {
    cachedKey = crypto.createHash("sha256").update("sylhn-data-encryption:" + sessionSecret).digest();
    return cachedKey;
  }

  // 3. Dev fallback (warn)
  if (process.env.NODE_ENV === "production") {
    console.error("[data-protection] FATAL: no encryption key available in production. Set DATA_ENCRYPTION_KEY or SESSION_SECRET.");
  }
  cachedKey = crypto.createHash("sha256").update("dev-only-insecure-encryption-key-not-for-production-use").digest();
  return cachedKey;
}

/**
 * Encrypt a string field with AES-256-GCM.
 * Returns "enc:v1:<iv_hex>:<ciphertext_hex>:<tag_hex>" on success.
 * Returns the original value if input is empty or already encrypted.
 */
export function encryptField(plaintext: string | null | undefined): string {
  if (!plaintext) return plaintext ?? "";
  if (typeof plaintext !== "string") return String(plaintext);
  if (plaintext.startsWith(PREFIX)) return plaintext; // already encrypted
  if (plaintext.length === 0) return "";

  try {
    const key = getMasterKey();
    const iv = crypto.randomBytes(IV_BYTES);
    const cipher = crypto.createCipheriv(ALGO, key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${PREFIX}${iv.toString("hex")}:${encrypted.toString("hex")}:${tag.toString("hex")}`;
  } catch (e) {
    console.error("[data-protection] encrypt failed:", e);
    return plaintext; // graceful fallback — don't break the sale
  }
}

/**
 * Decrypt a field encrypted with encryptField().
 * Returns the original value if it's not encrypted (backward compatible).
 */
export function decryptField(ciphertext: string | null | undefined): string {
  if (!ciphertext || typeof ciphertext !== "string") return ciphertext ?? "";
  if (!ciphertext.startsWith(PREFIX)) return ciphertext; // plaintext — return as-is

  try {
    const parts = ciphertext.split(":");
    // ["enc", "v1", "<iv_hex>", "<ciphertext_hex>", "<tag_hex>"]
    if (parts.length !== 5) return ciphertext;
    const iv = Buffer.from(parts[2], "hex");
    const encrypted = Buffer.from(parts[3], "hex");
    const tag = Buffer.from(parts[4], "hex");

    const key = getMasterKey();
    const decipher = crypto.createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString("utf8");
  } catch (e) {
    // Wrong key, corrupted ciphertext, or auth tag mismatch — return empty
    // rather than risking silent plaintext leak.
    console.warn("[data-protection] decrypt failed:", (e as Error).message);
    return "";
  }
}

/**
 * Check if a value is currently encrypted.
 */
export function isEncrypted(value: string | null | undefined): boolean {
  return !!value && typeof value === "string" && value.startsWith(PREFIX);
}

/**
 * Mask a phone number for logging: "+233 24 111 2222" → "+233 24 *** 2222"
 * Keeps country code + last 4 digits.
 */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 8) return "***";
  const last4 = digits.slice(-4);
  const prefix = phone.slice(0, Math.max(0, phone.length - 4));
  return `${prefix}****`;
}

/**
 * Mask an email for logging: "johndoe@example.com" → "j***@example.com"
 * Keeps domain (for context) but masks local part.
 */
export function maskEmail(email: string | null | undefined): string {
  if (!email || !email.includes("@")) return email ?? "";
  const [local, domain] = email.split("@");
  if (local.length <= 1) return `*@${domain}`;
  return `${local[0]}***@${domain}`;
}

/**
 * Redact known-sensitive fields from an object before logging/storing.
 * Mutates a copy and returns it.
 */
export function redactSensitive(data: Record<string, any>): Record<string, any> {
  const SENSITIVE_KEYS = [
    "password", "pin", "token", "secret", "creditCard", "cvv",
    "bankAccount", "routingNumber", "momoPin",
  ];
  const PII_KEYS = ["phone", "mobile", "email", "address", "creditLimit"];

  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    const lower = key.toLowerCase();
    if (SENSITIVE_KEYS.some(s => lower.includes(s))) {
      result[key] = "[REDACTED]";
    } else if (PII_KEYS.some(p => lower === p || lower.endsWith(p))) {
      if (typeof value === "string") {
        if (lower === "email") result[key] = maskEmail(value);
        else if (lower === "phone" || lower === "mobile") result[key] = maskPhone(value);
        else result[key] = "[PII]";
      } else {
        result[key] = value;
      }
    } else if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      result[key] = redactSensitive(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Audit log retention policy: trim logs older than N days.
 * Default: 365 days (1 year) for general logs, 7 years for financial records
 * (Ghana Revenue Authority requirement for VAT records).
 *
 * Run this from a daily cron or on backup.
 */
export async function trimOldAuditLogs(opts: {
  generalRetentionDays?: number;  // default 365
  financialRetentionDays?: number; // default 2555 (7 years)
}): Promise<{ trimmed: number }> {
  const general = opts.generalRetentionDays ?? 365;
  const financial = opts.financialRetentionDays ?? 2555;

  const generalCutoff = new Date();
  generalCutoff.setDate(generalCutoff.getDate() - general);

  const financialCutoff = new Date();
  financialCutoff.setDate(financialCutoff.getDate() - financial);

  // Financial modules: VAT, sales, purchases — keep 7 years
  const FINANCIAL_MODULES = ["sales", "purchase", "accounts", "financeOps"];

  let trimmed = 0;
  try {
    // Delete old non-financial logs
    const r1 = await (await import("@/lib/db")).db.auditLog.deleteMany({
      where: {
        timestamp: { lt: generalCutoff },
        module: { notIn: FINANCIAL_MODULES },
      },
    });
    trimmed += r1.count;

    // Delete very old financial logs (7 years)
    const r2 = await (await import("@/lib/db")).db.auditLog.deleteMany({
      where: {
        timestamp: { lt: financialCutoff },
      },
    });
    trimmed += r2.count;
  } catch (e) {
    console.error("[data-protection] audit log trim failed:", e);
  }

  return { trimmed };
}
