import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { rateLimitApiRead, rateLimitResponse, getClientIp } from "@/lib/rate-limit";
import { getExpiryTracking } from "@/lib/reports";

// GET /api/reports/expiry — expiry tracking report
export async function GET(req: NextRequest) {
  try { await requireAuth(); } catch (e) { return e as Response; }

  const ip = getClientIp(req);
  const rl = rateLimitApiRead(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  try {
    const items = await getExpiryTracking();
    const expired = items.filter(i => i.urgency === "expired");
    const critical = items.filter(i => i.urgency === "critical");  // <= 7 days
    const warning = items.filter(i => i.urgency === "warning");    // <= 14 days
    const soon = items.filter(i => i.urgency === "soon");          // <= 30 days

    return NextResponse.json({
      items,
      summary: {
        total: items.length,
        expired: expired.length,
        critical: critical.length,
        warning: warning.length,
        soon: soon.length,
        valueAtRisk: items.reduce((s, i) => s + i.stockValueAtRisk, 0),
        expiredValue: expired.reduce((s, i) => s + i.stockValueAtRisk, 0),
      },
      expired,
      critical,
      warning,
      soon,
      generatedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error("GET /api/reports/expiry error:", e);
    return NextResponse.json({ error: "Failed to generate expiry report" }, { status: 500 });
  }
}
