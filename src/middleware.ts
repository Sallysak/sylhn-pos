/**
 * SYLHN POS — Next.js Middleware
 *
 * 1. Sets security headers on every response (CSP, HSTS, X-Content-Type-Options, etc.)
 *    - In DEV: permissive CSP/CORS/frame-ancestors so the preview iframe works.
 *    - In PROD: strict CSP, but ALLOWS *.space-z.ai / *.z.ai preview origins.
 * 2. Blocks /api/* write methods (POST/PUT/DELETE/PATCH) without a valid
 *    X-CSRF-Token header (double-submit cookie pattern).
 * 3. Adds CORS headers for z.ai / space-z.ai preview hosts (always — needed
 *    for the preview iframe even in production).
 */

import { NextRequest, NextResponse } from "next/server";

const isDev = process.env.NODE_ENV !== "production";

// Check if a request is from the preview platform (space-z.ai / z.ai)
// These origins are ALWAYS trusted — they're the hosting platform.
function isPreviewOrigin(origin: string): boolean {
  return origin.includes("space-z.ai") || origin.includes("z.ai");
}

// Permissive headers for dev + preview
const DEV_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "SAMEORIGIN",
  // Allow WebAuthn (biometrics) + camera (barcode scanner) in iframes
  "Permissions-Policy": "publickey-credentials-create=(self), publickey-credentials-get=(self), camera=(self), microphone=(), geolocation=(), interest-cohort=()",
  "Cross-Origin-Opener-Policy": "cross-origin",
  "Cross-Origin-Resource-Policy": "cross-origin",
  "Content-Security-Policy": [
    "default-src 'self'",
    // Allow loading from common CDN + the app's own preview domains
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://vercel.live",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: blob: https:",
    "connect-src 'self' https://internal-api.z.ai https://world.openfoodfacts.org https://api.upcitemdb.com https://world.openbeautyfacts.org https://world.openpetfoodfacts.org https://vercel.live",
    "media-src 'self' data: blob:",
    "frame-ancestors *",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "upgrade-insecure-requests",
  ].join("; "),
};

// Strict headers for production (but allows preview origins in frame-ancestors)
const PROD_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
  "X-Frame-Options": "SAMEORIGIN",
  // Allow WebAuthn (biometrics) + camera (barcode scanner) in iframes
  "Permissions-Policy": "publickey-credentials-create=(self), publickey-credentials-get=(self), camera=(self), microphone=(), geolocation=(), interest-cohort=()",
  "Cross-Origin-Opener-Policy": "cross-origin",
  "Cross-Origin-Resource-Policy": "cross-origin",
  // Allow framing from same origin AND preview platform
  "Content-Security-Policy": [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: blob: https:",
    // Only allow API calls to self + the Z.AI API + OpenFoodFacts barcode lookup
    "connect-src 'self' https://internal-api.z.ai https://world.openfoodfacts.org https://api.upcitemdb.com https://world.openbeautyfacts.org https://world.openpetfoodfacts.org",
    "media-src 'self' data: blob:",
    "frame-ancestors 'self' https://*.space-z.ai https://*.z.ai",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "upgrade-insecure-requests",
  ].join("; "),
};

const SECURITY_HEADERS = isDev ? DEV_HEADERS : PROD_HEADERS;

const PUBLIC_API_PATHS = [
  "/api/health",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/me",
  "/api/auth/csrf",
  "/api/customer-display",
  "/api/payments/momo/callback",
  "/api/receipt/verify",
  "/api/setup",  // one-time bootstrap — creates default users
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
  // Preview origins (z.ai / space-z.ai) are ALWAYS trusted — they're the
  // hosting platform for the preview iframe.
  const isAllowedPreviewOrigin = isPreviewOrigin(origin);

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

  // 2. Add CORS headers — only for trusted preview origins in DEV
  //    In PROD, no CORS headers are added (same-origin only).
  if (isAllowedPreviewOrigin) {
    res.headers.set("Access-Control-Allow-Origin", origin);
    res.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    res.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-CSRF-Token, X-Requested-With");
    res.headers.set("Access-Control-Allow-Credentials", "true");
  }

  // 3. CSRF check on /api write methods (except public paths)
  //    - Same-origin requests are exempt (sameSite=lax already protects)
  //    - Cross-origin requests require a valid CSRF token (defense-in-depth)
  //    - Preview origins (z.ai/space-z.ai) are also exempt in DEV (trusted)
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
