/**
 * SYLHN POS — Server-side authentication & authorization
 *
 * Uses Web Crypto API (SubtleCrypto) for password hashing (PBKDF2 + SHA-256,
 * 100k iterations) — no external dependencies, works in edge runtime.
 *
 * Session tokens are signed HMAC-SHA256 JWTs stored in httpOnly cookies.
 */

import { cookies } from "next/headers";
import crypto from "crypto";
import { db } from "./db";

// ===== Configuration =====
const SESSION_COOKIE = "sylhn-session";
const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60; // 8 hours
const PBKDF2_ITERATIONS = 100_000;
const SALT_BYTES = 16;
const KEY_BYTES = 32;

// Secret key — falls back to a dev-only key (with a warning) if env not set.
function getSessionSecret(): string {
  const env = process.env.SESSION_SECRET;
  if (env && env.length >= 32) return env;
  if (process.env.NODE_ENV === "production") {
    console.warn("WARNING: SESSION_SECRET not set in production. Using insecure default.");
  }
  return "dev-only-insecure-session-secret-please-set-SESSION_SECRET-env-var-at-least-32-chars";
}

// ===== Password hashing =====

/**
 * Hash a password using PBKDF2 + SHA-256.
 * Returns: `pbkdf2$<iterations>$<salt_hex>$<hash_hex>`
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(SALT_BYTES);
  const hash = crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, KEY_BYTES, "sha256");
  return `pbkdf2$${PBKDF2_ITERATIONS}$${salt.toString("hex")}$${hash.toString("hex")}`;
}

/**
 * Verify a password against a stored hash.
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  try {
    const parts = stored.split("$");
    if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
    const iterations = parseInt(parts[1], 10);
    const salt = Buffer.from(parts[2], "hex");
    const expectedHash = Buffer.from(parts[3], "hex");
    const hash = crypto.pbkdf2Sync(password, salt, iterations, KEY_BYTES, "sha256");
    // Constant-time comparison
    return crypto.timingSafeEqual(hash, expectedHash);
  } catch {
    return false;
  }
}

// ===== Session tokens (JWT-like, HMAC-SHA256 signed) =====

interface SessionPayload {
  uid: string;
  username: string;
  role: string;
  iat: number; // issued at
  exp: number; // expiry
}

function base64UrlEncode(buf: Buffer | string): string {
  const b = typeof buf === "string" ? Buffer.from(buf) : buf;
  return b.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(s: string): Buffer {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

export function createSessionToken(payload: Omit<SessionPayload, "iat" | "exp">): string {
  const now = Math.floor(Date.now() / 1000);
  const fullPayload: SessionPayload = {
    ...payload,
    iat: now,
    exp: now + SESSION_MAX_AGE_SECONDS,
  };
  const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64UrlEncode(JSON.stringify(fullPayload));
  const data = `${header}.${body}`;
  const signature = crypto.createHmac("sha256", getSessionSecret()).update(data).digest();
  return `${data}.${base64UrlEncode(signature)}`;
}

export function verifySessionToken(token: string): SessionPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [header, body, signature] = parts;
    const data = `${header}.${body}`;
    const expectedSig = crypto.createHmac("sha256", getSessionSecret()).update(data).digest();
    const actualSig = base64UrlDecode(signature);
    if (!crypto.timingSafeEqual(expectedSig, actualSig)) return null;

    const payload: SessionPayload = JSON.parse(base64UrlDecode(body).toString());
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

// ===== Cookie helpers =====

export async function setSessionCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function getSession(): Promise<SessionPayload | null> {
  try {
    const store = await cookies();
    const token = store.get(SESSION_COOKIE)?.value;
    if (!token) return null;
    return verifySessionToken(token);
  } catch {
    return null;
  }
}

export async function getCurrentUser(): Promise<SessionPayload | null> {
  return getSession();
}

// ===== Full user with permissions (premium) =====
// Returns the user's stored permissions so /api/auth/me can include them
// in the response — the frontend no longer needs to trust localStorage for
// permission checks (security fix).
export interface FullUser extends SessionPayload {
  fullName: string;
  permissions: Record<string, boolean>;
}

export async function getFullUser(): Promise<FullUser | null> {
  const session = await getSession();
  if (!session) return null;
  const user = await db.systemUser.findUnique({
    where: { id: session.uid },
    select: { fullName: true, permissions: true, active: true },
  });
  if (!user || !user.active) return null;
  let perms: Record<string, boolean> = {};
  try { perms = JSON.parse(user.permissions || "{}"); } catch {}
  return { ...session, fullName: user.fullName, permissions: perms };
}

// ===== Authorization =====

export type Permission =
  | "pos" | "sales" | "stock" | "purchase" | "accounts"
  | "telephone" | "maintenance" | "financeOps"
  | "canVoid" | "canDiscount" | "canAdjustStock"
  | "canDeleteProducts" | "canExport";

const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  admin: [
    "pos", "sales", "stock", "purchase", "accounts", "telephone", "maintenance",
    "financeOps", "canVoid", "canDiscount", "canAdjustStock", "canDeleteProducts", "canExport",
  ],
  manager: [
    "pos", "sales", "stock", "purchase", "accounts", "telephone",
    "financeOps", "canVoid", "canDiscount", "canAdjustStock", "canExport",
  ],
  cashier: ["pos", "sales", "telephone", "canDiscount"],
  stockkeeper: ["pos", "stock", "purchase", "canAdjustStock", "canExport"],
  accountant: ["pos", "accounts", "financeOps", "canExport"],
};

export function hasPermission(role: string, perm: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(perm) ?? false;
}

export function requirePermission(role: string, perm: Permission): void {
  if (!hasPermission(role, perm)) {
    throw new Response(JSON.stringify({ error: "Insufficient permissions" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export async function requireAuth(): Promise<SessionPayload> {
  const user = await getSession();
  if (!user) {
    throw new Response(JSON.stringify({ error: "Authentication required" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  return user;
}

export async function requireRole(...roles: string[]): Promise<SessionPayload> {
  const user = await requireAuth();
  if (!roles.includes(user.role)) {
    throw new Response(JSON.stringify({ error: "Insufficient role" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }
  return user;
}

// ===== CSRF protection =====
// Double-submit cookie pattern: a token is set as a cookie + must be sent
// in the X-CSRF-Token header for any state-changing request.

const CSRF_COOKIE = "sylhn-csrf";

export async function setCsrfCookie(): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex");
  const store = await cookies();
  store.set(CSRF_COOKIE, token, {
    httpOnly: false, // JS needs to read it to send in header
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return token;
}

export async function validateCsrfToken(headerToken: string | null): Promise<boolean> {
  if (!headerToken) return false;
  const store = await cookies();
  const cookieToken = store.get(CSRF_COOKIE)?.value;
  if (!cookieToken) return false;
  try {
    const a = Buffer.from(headerToken, "hex");
    const b = Buffer.from(cookieToken, "hex");
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export { SESSION_COOKIE, CSRF_COOKIE };
