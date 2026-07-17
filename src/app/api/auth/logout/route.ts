import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookie, getSession } from "@/lib/auth";
import { auditLog } from "@/lib/audit";
import { getClientIp } from "@/lib/rate-limit";

// POST /api/auth/logout — clear session cookie + audit log
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (session) {
    await auditLog({
      userId: session.uid,
      user: session.username,
      action: "LOGOUT",
      module: "auth",
      details: `User ${session.username} logged out`,
      severity: "info",
      ipAddress: getClientIp(req),
      userAgent: req.headers.get("user-agent") || "",
    });
  }
  await clearSessionCookie();
  return NextResponse.json({ success: true });
}
