import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requireRole } from "@/lib/auth";
import { rateLimitApiRead, rateLimitResponse, getClientIp } from "@/lib/rate-limit";

// GET /api/audit-logs — list audit logs (admin/manager only)
export async function GET(req: NextRequest) {
  try { await requireRole("admin", "manager"); } catch (e) { return e as Response; }

  const ip = getClientIp(req);
  const rl = rateLimitApiRead(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "100", 10), 1000);
    const moduleFilter = searchParams.get("module");
    const severity = searchParams.get("severity");
    const userFilter = searchParams.get("user");

    const where: any = {};
    if (moduleFilter) where.module = moduleFilter;
    if (severity) where.severity = severity;
    if (userFilter) where.user = { contains: userFilter };

    const logs = await db.auditLog.findMany({
      where,
      include: { systemUser: { select: { fullName: true, username: true } } },
      orderBy: { timestamp: "desc" },
      take: limit,
    });
    return NextResponse.json({ logs });
  } catch (e) {
    console.error("GET /api/audit-logs error:", e);
    return NextResponse.json({ error: "Failed to fetch audit logs" }, { status: 500 });
  }
}
