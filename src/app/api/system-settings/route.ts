import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requirePermission } from "@/lib/auth";
import { rateLimitApiRead, rateLimitApiWrite, rateLimitResponse, getClientIp } from "@/lib/rate-limit";
import { auditLog } from "@/lib/audit";
import { clearLoyaltyConfigCache } from "@/lib/loyalty";

// GET /api/system-settings — list all settings
export async function GET(req: NextRequest) {
  try { await requireAuth(); } catch (e) { return e as Response; }

  const ip = getClientIp(req);
  const rl = rateLimitApiRead(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  try {
    const settings = await db.systemSetting.findMany({ orderBy: { key: "asc" } });
    const map: Record<string, string> = {};
    for (const s of settings) map[s.key] = s.value;
    return NextResponse.json({ settings: map });
  } catch (e) {
    console.error("GET /api/system-settings error:", e);
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
  }
}

// PUT /api/system-settings — bulk update (admin only)
export async function PUT(req: NextRequest) {
  let user;
  try { user = await requireAuth(); requirePermission(user.role, "maintenance"); } catch (e) { return e as Response; }

  const ip = getClientIp(req);
  const rl = rateLimitApiWrite(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  if (!body.settings || typeof body.settings !== "object") {
    return NextResponse.json({ error: "Body must contain a 'settings' object" }, { status: 400 });
  }

  try {
    const entries = Object.entries(body.settings) as [string, string|number|boolean][];
    const updates: Promise<any>[] = entries.map(([key, value]) =>
      db.systemSetting.upsert({
        where: { key },
        update: { value: String(value), updatedAt: new Date() },
        create: { key, value: String(value) },
      })
    );
    await Promise.all(updates);

    // Invalidate loyalty config cache (in case loyalty.* keys changed)
    if (entries.some(([k]) => k.startsWith("loyalty."))) {
      clearLoyaltyConfigCache();
    }

    await auditLog({
      userId: user.uid,
      user: user.username,
      action: "UPDATE",
      module: "maintenance",
      details: `Updated ${entries.length} system settings: ${entries.map(([k]) => k).join(", ")}`,
      severity: "warning",
      ipAddress: ip,
      userAgent: req.headers.get("user-agent") || "",
    });

    return NextResponse.json({ success: true, count: entries.length });
  } catch (e) {
    console.error("PUT /api/system-settings error:", e);
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}
