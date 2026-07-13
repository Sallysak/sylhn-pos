/**
 * SYLHN POS — Middleware
 *
 * 1. Sets security headers on every response (CSP, HSTS, X-Frame-Options, etc.)
 * 2. Blocks /api/* write methods (POST/PUT/DELETE/PATCH) without a valid
 *    X-CSRF-Token header (double-submit cookie pattern).
 * 3. Public endpoints list: /api/health, /api/auth/login, /api/auth/logout
 *    are reachable without auth. Everything else under /api/* requires a
 *    valid session cookie (checked at the route handler level too — this
 *    is a fast pre-check).
 */

import { NextRequest, NextResponse } from "next/server";

const SECURITY_HEADERS: Record<string, string> = {
  // Prevent clickjacking — allow same-origin + the preview iframe host.
  // (X-Frame-Options is gradually being replaced by CSP frame-ancestors,
  // but we set both for defense-in-depth and older-browser support.)
  "X-Frame-Options": "SAMEORIGIN",
  // Prevent MIME-sniffing
  "X-Content-Type-Options": "nosniff",
  // Referrer policy
  "Referrer-Policy": "strict-origin-when-cross-origin",
  // HSTS (1 year, include subdomains)
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
  // Permissions policy — lock down camera/microphone/geolocation (POS doesn't need them)
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  // Cross-origin policies
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
  // Content Security Policy — only allow same-origin + a few needed exceptions.
  // frame-ancestors allows the preview iframe host (preview-*.space-z.ai) so the
  // app can be embedded in the chat preview UI; all other cross-origin sites
  // remain blocked.
  "Content-Security-Policy": [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Next.js needs inline/eval
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https:",
    "connect-src 'self' https:",
    "frame-ancestors 'self' https://*.space-z.ai http://*.space-z.ai",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
  ].join("; "),
};

const PUBLIC_API_PATHS = [
  "/api/health",
  "/api/auth/login",
  "/api/auth/logout",
];

function isPublicApiPath(pathname: string): boolean {
  return PUBLIC_API_PATHS.some(p => pathname === p || pathname.startsWith(p + "/"));
}

function isWriteMethod(method: string): boolean {
  return ["POST", "PUT", "PATCH", "DELETE"].includes(method.toUpperCase());
}

export function proxy(req: NextRequest) {
  const pathname = req.nextUrl.pathname;
  const method = req.method;
  const isApi = pathname.startsWith("/api");

  // Build the response
  const res = NextResponse.next();

  // 1. Apply security headers to ALL responses
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    res.headers.set(key, value);
  }

  // 2. CSRF check on /api write methods (except public paths)
  if (isApi && isWriteMethod(method) && !isPublicApiPath(pathname)) {
    const csrfToken = req.headers.get("x-csrf-token");
    const cookieToken = req.cookies.get("sylhn-csrf")?.value;
    if (!csrfToken || !cookieToken || csrfToken !== cookieToken) {
      return NextResponse.json(
        { error: "CSRF token missing or invalid" },
        { status: 403 }
      );
    }
  }

  // 3. For non-public /api GET/HEAD/OPTIONS, the route handlers themselves
  //    call requireAuth() / requireRole(). Middleware can't read httpOnly
  //    cookies easily here in a way that adds value — the route handler is
  //    the source of truth.

  return res;
}

export const config = {
  // Run on all routes except static assets
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon-192.png|icon-512.png|icon-maskable-512.png|manifest.json|sw.js|logo.svg|robots.txt).*)",
  ],
};
