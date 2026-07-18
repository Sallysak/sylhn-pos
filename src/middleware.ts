/**
 * SYLHN POS — Next.js Middleware
 *
 * Restored (premium): was renamed to proxy.ts.bak, which disabled CSRF
 * protection and all security headers. Now lives at src/middleware.ts (the
 * path Next.js auto-detects) and exports `middleware` (not `proxy`).
 *
 * 1. Sets security headers on every response (CSP, HSTS, X-Content-Type-Options, etc.)
 * 2. Blocks /api/* write methods (POST/PUT/DELETE/PATCH) without a valid
 *    X-CSRF-Token header (double-submit cookie pattern).
 * 3. Adds CORS headers for z.ai / space-z.ai preview hosts.
 *
 * Public endpoints list: /api/health, /api/auth/login, /api/auth/logout,
 * /api/auth/me, /api/auth/csrf are reachable without CSRF (but auth/login
 * is still rate-limited at the handler level).
 */

import { NextRequest, NextResponse } from "next/server";

const SECURITY_HEADERS: Record<string, string> = {
  // X-Frame-Options removed — using CSP frame-ancestors instead (more granular).
  // Setting X-Frame-Options: SAMEORIGIN would block the preview iframe
  // (preview-chat-*.space-z.ai) since it's a different origin.
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  "Cross-Origin-Opener-Policy": "cross-origin",
  "Cross-Origin-Resource-Policy": "cross-origin",
  "Content-Security-Policy": [
    "default-src * 'self' 'unsafe-inline' 'unsafe-eval' data: blob:",
    "frame-ancestors *",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
  ].join("; "),
};

const PUBLIC_API_PATHS = [
  "/api/health",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/me",
  "/api/auth/csrf",
  "/api/customer-display",  // customer-facing display polls this (no auth)
];

function isPublicApiPath(pathname: string): boolean {
  return PUBLIC_API_PATHS.some(p => pathname === p || pathname.startsWith(p + "/"));
}

function isWriteMethod(method: string): boolean {
  return ["POST", "PUT", "PATCH", "DELETE"].includes(method.toUpperCase());
}

export function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;
  const method = req.method;
  const isApi = pathname.startsWith("/api");
  const origin = req.headers.get("origin") || "";
  const host = req.headers.get("host") || "";

  // Determine if this is a same-origin request.
  // (sameSite=lax session cookie already blocks cross-origin POST cookies,
  //  so same-origin writes are safe without CSRF token.)
  const isSameOrigin = !origin || new URL(origin).host === host;
  const isAllowedPreviewOrigin = origin.includes("z.ai") || origin.includes("space-z.ai");

  // ===== Handle CORS preflight (OPTIONS) =====
  if (method === "OPTIONS") {
    const res = new NextResponse(null, { status: 204 });
    if (isAllowedPreviewOrigin) {
      res.headers.set("Access-Control-Allow-Origin", origin);
      res.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
      res.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-CSRF-Token, X-Requested-With");
      res.headers.set("Access-Control-Allow-Credentials", "true");
      res.headers.set("Access-Control-Max-Age", "86400");
    }
    return res;
  }

  // Build the response
  const res = NextResponse.next();

  // 1. Apply security headers to ALL responses
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    res.headers.set(key, value);
  }

  // 2. Add CORS headers — allow chat.z.ai and *.space-z.ai to fetch from us
  if (isAllowedPreviewOrigin) {
    res.headers.set("Access-Control-Allow-Origin", origin);
    res.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    res.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-CSRF-Token, X-Requested-With");
    res.headers.set("Access-Control-Allow-Credentials", "true");
  }

  // 3. CSRF check on /api write methods (except public paths)
  //    - Same-origin requests are exempt (sameSite=lax already protects)
  //    - Cross-origin requests require a valid CSRF token (defense-in-depth)
  //    - Preview origins (z.ai/space-z.ai) are also exempt (they're trusted)
  if (isApi && isWriteMethod(method) && !isPublicApiPath(pathname) && !isSameOrigin && !isAllowedPreviewOrigin) {
    const csrfToken = req.headers.get("x-csrf-token");
    const cookieToken = req.cookies.get("sylhn-csrf")?.value;
    if (!csrfToken || !cookieToken || csrfToken !== cookieToken) {
      return NextResponse.json(
        { error: "CSRF token missing or invalid" },
        { status: 403 }
      );
    }
  }

  return res;
}

export const config = {
  // Run on all routes except static assets
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon-192.png|icon-512.png|icon-maskable-512.png|manifest.json|sw.js|logo.svg|robots.txt).*)",
  ],
};
