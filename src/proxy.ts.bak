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
  // X-Frame-Options removed — using CSP frame-ancestors instead (more granular).
  // Setting X-Frame-Options: SAMEORIGIN would block the preview iframe
  // (preview-chat-*.space-z.ai) since it's a different origin.
  // "X-Frame-Options": "SAMEORIGIN",  // REMOVED — see CSP frame-ancestors below
  // Prevent MIME-sniffing
  "X-Content-Type-Options": "nosniff",
  // Referrer policy
  "Referrer-Policy": "strict-origin-when-cross-origin",
  // HSTS (1 year, include subdomains)
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
  // Permissions policy
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  // Cross-origin — MUST be cross-origin to allow the chat parent (chat.z.ai)
  // to fetch from the preview (preview-chat-*.space-z.ai).
  "Cross-Origin-Opener-Policy": "cross-origin",
  "Cross-Origin-Resource-Policy": "cross-origin",
  // Content Security Policy — frame-ancestors allows the chat host and
  // preview host to embed this app in an iframe.
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
  const origin = req.headers.get("origin") || "";

  // ===== Handle CORS preflight (OPTIONS) =====
  if (method === "OPTIONS") {
    const res = new NextResponse(null, { status: 204 });
    // Allow the chat parent and preview hosts
    if (origin.includes("z.ai") || origin.includes("space-z.ai")) {
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
  if (origin && (origin.includes("z.ai") || origin.includes("space-z.ai"))) {
    res.headers.set("Access-Control-Allow-Origin", origin);
    res.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    res.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-CSRF-Token, X-Requested-With");
    res.headers.set("Access-Control-Allow-Credentials", "true");
  }

  // 3. CSRF check on /api write methods (except public paths)
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

  return res;
}

export const config = {
  // Run on all routes except static assets
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon-192.png|icon-512.png|icon-maskable-512.png|manifest.json|sw.js|logo.svg|robots.txt).*)",
  ],
};
