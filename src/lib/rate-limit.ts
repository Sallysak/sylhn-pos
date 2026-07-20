/**
 * SYLHN POS — Rate limiting (in-memory, edge-compatible)
 *
 * Tracks request counts per IP+endpoint. Returns 429 with Retry-After
 * when limit exceeded.
 *
 * Note: in-memory limits reset on serverless cold starts. For production
 * at scale, swap the Map for Redis. For a single-instance POS this is fine.
 */

interface RateBucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, RateBucket>();

// Periodic cleanup (every 5 minutes)
const CLEANUP_INTERVAL = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt < now) buckets.delete(key);
  }
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfter: number; // seconds
}

export function rateLimit(
  identifier: string,
  limit: number,
  windowSeconds: number
): RateLimitResult {
  cleanup();
  const now = Date.now();
  const key = identifier;
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt < now) {
    // New window
    buckets.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return { allowed: true, remaining: limit - 1, resetAt: now + windowSeconds * 1000, retryAfter: 0 };
  }

  bucket.count++;
  const remaining = Math.max(0, limit - bucket.count);
  const allowed = bucket.count <= limit;
  const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);

  return { allowed, remaining, resetAt: bucket.resetAt, retryAfter: Math.max(0, retryAfter) };
}

// ===== Pre-configured limits =====

/** Login: 5 attempts per 15 minutes per IP (tightened from 10 for security).
 *  Combined with per-account lockout (5 failed attempts → 15-min account lock). */
export function rateLimitLogin(ip: string): RateLimitResult {
  return rateLimit(`login:${ip}`, 5, 15 * 60);
}

/** General API write: 60 requests per minute per IP (tightened from 120).
 *  Production apps should aim for ~60/min for write endpoints. */
export function rateLimitApiWrite(ip: string): RateLimitResult {
  return rateLimit(`api-write:${ip}`, 60, 60);
}

/** General API read: 200 requests per minute per IP (tightened from 300). */
export function rateLimitApiRead(ip: string): RateLimitResult {
  return rateLimit(`api-read:${ip}`, 200, 60);
}

/** Sensitive operations (wipe data, restore backup, user management):
 *  10 requests per minute per IP — very tight. */
export function rateLimitSensitive(ip: string): RateLimitResult {
  return rateLimit(`sensitive:${ip}`, 10, 60);
}

/** AI queries: 20 requests per minute per IP — LLM calls are expensive. */
export function rateLimitAi(ip: string): RateLimitResult {
  return rateLimit(`ai:${ip}`, 20, 60);
}

/** Email sending: 5 per hour per IP (anti-spam). */
export function rateLimitEmail(ip: string): RateLimitResult {
  return rateLimit(`email:${ip}`, 5, 60 * 60);
}

/** Seed endpoint: 3 per hour per IP (very destructive). */
export function rateLimitSeed(ip: string): RateLimitResult {
  return rateLimit(`seed:${ip}`, 3, 60 * 60);
}

// ===== Account lockout (per-user, brute force protection) =====
//
// After 5 failed login attempts for a specific username, the account is
// locked for 15 minutes. Successful login clears the counter.
//
// This is SEPARATE from IP rate limiting — even if an attacker uses
// 1000 different IPs, they only get 5 attempts per username per 15min.

export const ACCOUNT_LOCKOUT_THRESHOLD = 5;
export const ACCOUNT_LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

interface AccountLockout {
  failCount: number;
  lockedUntil: number; // 0 if not locked
}

const accountLockouts = new Map<string, AccountLockout>();

export interface AccountLockoutResult {
  locked: boolean;
  failCount: number;
  remainingAttempts: number;
  lockedUntil: number; // epoch ms
  retryAfter: number; // seconds
}

/** Check if an account is currently locked. Call BEFORE password verify. */
export function checkAccountLockout(username: string): AccountLockoutResult {
  cleanupAccountLockouts();
  const key = `lockout:${username.toLowerCase()}`;
  const state = accountLockouts.get(key);

  if (!state || state.lockedUntil < Date.now()) {
    // Not locked (or lockout expired)
    return {
      locked: false,
      failCount: state?.failCount || 0,
      remainingAttempts: ACCOUNT_LOCKOUT_THRESHOLD - (state?.failCount || 0),
      lockedUntil: 0,
      retryAfter: 0,
    };
  }

  // Currently locked
  const retryAfter = Math.ceil((state.lockedUntil - Date.now()) / 1000);
  return {
    locked: true,
    failCount: state.failCount,
    remainingAttempts: 0,
    lockedUntil: state.lockedUntil,
    retryAfter: Math.max(0, retryAfter),
  };
}

/** Record a failed login attempt. Locks the account if threshold reached. */
export function recordFailedLogin(username: string): AccountLockoutResult {
  cleanupAccountLockouts();
  const key = `lockout:${username.toLowerCase()}`;
  const now = Date.now();
  const existing = accountLockouts.get(key);
  const failCount = (existing?.failCount || 0) + 1;
  const locked = failCount >= ACCOUNT_LOCKOUT_THRESHOLD;
  const lockedUntil = locked ? now + ACCOUNT_LOCKOUT_DURATION_MS : 0;

  accountLockouts.set(key, { failCount, lockedUntil });

  return {
    locked,
    failCount,
    remainingAttempts: Math.max(0, ACCOUNT_LOCKOUT_THRESHOLD - failCount),
    lockedUntil,
    retryAfter: locked ? Math.ceil((lockedUntil - now) / 1000) : 0,
  };
}

/** Clear lockout on successful login. */
export function clearAccountLockout(username: string): void {
  const key = `lockout:${username.toLowerCase()}`;
  accountLockouts.delete(key);
}

function cleanupAccountLockouts() {
  const now = Date.now();
  // Run cleanup at most every 5 minutes
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  for (const [key, state] of accountLockouts) {
    // Remove entries where lockout has expired AND no recent failures
    if (state.lockedUntil < now && state.failCount === 0) {
      accountLockouts.delete(key);
    } else if (state.lockedUntil < now && state.lockedUntil > 0) {
      // Lockout expired — reset fail count but keep entry to track
      accountLockouts.set(key, { failCount: 0, lockedUntil: 0 });
    }
  }
}

// ===== Helper: extract client IP =====

export function getClientIp(req: Request): string {
  const headers = req.headers;
  // Behind a proxy / Caddy / nginx
  const fwd = headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  const real = headers.get("x-real-ip");
  if (real) return real;
  return "127.0.0.1";
}

// ===== Helper: build 429 response =====

export function rateLimitResponse(result: RateLimitResult, message = "Too many requests"): Response {
  return new Response(JSON.stringify({ error: message, retryAfter: result.retryAfter }), {
    status: 429,
    headers: {
      "Content-Type": "application/json",
      "X-RateLimit-Limit": "true",
      "X-RateLimit-Remaining": String(result.remaining),
      "X-RateLimit-Reset": String(Math.floor(result.resetAt / 1000)),
      "Retry-After": String(result.retryAfter),
    },
  });
}
