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

/** Login: 5 attempts per 15 minutes per IP. */
export function rateLimitLogin(ip: string): RateLimitResult {
  return rateLimit(`login:${ip}`, 5, 15 * 60);
}

/** General API write: 60 requests per minute per IP. */
export function rateLimitApiWrite(ip: string): RateLimitResult {
  return rateLimit(`api-write:${ip}`, 60, 60);
}

/** General API read: 120 requests per minute per IP. */
export function rateLimitApiRead(ip: string): RateLimitResult {
  return rateLimit(`api-read:${ip}`, 120, 60);
}

/** Email sending: 5 per hour per IP (anti-spam). */
export function rateLimitEmail(ip: string): RateLimitResult {
  return rateLimit(`email:${ip}`, 5, 60 * 60);
}

/** Seed endpoint: 3 per hour per IP (very destructive). */
export function rateLimitSeed(ip: string): RateLimitResult {
  return rateLimit(`seed:${ip}`, 3, 60 * 60);
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
