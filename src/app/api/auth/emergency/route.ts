import { NextRequest, NextResponse } from "next/server";
import { createSessionToken, setSessionCookie, setCsrfCookie } from "@/lib/auth";
import { auditLog } from "@/lib/audit";

// POST /api/auth/emergency — TRUE LAST RESORT login.
// Issues a full admin session token with NO credentials required.
//
// This endpoint exists for situations where:
//  - The DB is unreachable AND the operator needs to get in
//  - The /api/auth/login route itself is broken
//  - The operator forgot the admin password and DB auth doesn't work
//
// SECURITY: This is intentionally unauthenticated. It is mitigated by:
//  1. It only works if the request body contains the literal string
//     "BREAK_GLASS" — a small speed bump that prevents drive-by abuse
//     (e.g. CSRF from a malicious site won't include this exact body).
//  2. It is logged as severity=critical to auditLog.
//  3. After login, the operator should immediately change the admin password
//     and rotate SESSION_SECRET.
//
// Usage from a browser:
//   fetch('/api/auth/emergency', {
//     method: 'POST',
//     headers: {'Content-Type':'application/json'},
//     body: JSON.stringify({ breakGlass: 'BREAK_GLASS' })
//   }).then(r => r.json()).then(console.log)

export async function POST(req: NextRequest) {
  let body: any = {};
  try { body = await req.json(); } catch { /* ignore */ }

  if (body?.breakGlass !== 'BREAK_GLASS') {
    return NextResponse.json(
      { error: "Missing or invalid breakGlass parameter. Send { \"breakGlass\": \"BREAK_GLASS\" }" },
      { status: 400 }
    );
  }

  // Issue a synthetic admin session token — no DB lookup required.
  const adminId = 'admin-emergency';
  const token = createSessionToken({
    uid: adminId,
    username: 'admin',
    role: 'admin',
  });

  try { await setSessionCookie(token); } catch { /* ignore */ }
  try { await setCsrfCookie(); } catch { /* ignore */ }

  // Log it as critical so it's visible in the audit trail.
  auditLog({
    userId: adminId,
    user: 'admin',
    action: 'EMERGENCY_LOGIN',
    module: 'auth',
    details: 'Break-glass emergency login — no credentials, no DB lookup',
    severity: 'critical',
    ipAddress: req.headers.get('x-forwarded-for') || 'unknown',
    userAgent: req.headers.get('user-agent') || '',
  }).catch(() => {});

  return NextResponse.json({
    success: true,
    user: {
      id: adminId,
      username: 'admin',
      fullName: 'System Administrator (Emergency)',
      role: 'admin',
      phone: '',
      email: '',
      permissions: {
        pos: true, sales: true, stock: true, purchase: true,
        accounts: true, telephone: true, maintenance: true,
        financeOps: true, canVoid: true, canDiscount: true,
        canAdjustStock: true, canDeleteProducts: true, canExport: true,
      },
      passwordResetRequired: true,
    },
    sessionToken: token,
    warning: 'Emergency login. Rotate SESSION_SECRET and change admin password ASAP.',
  });
}
