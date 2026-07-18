import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requirePermission } from "@/lib/auth";
import { rateLimitApiRead, rateLimitApiWrite, rateLimitResponse, getClientIp } from "@/lib/rate-limit";

// GET /api/email/settings — get SMTP settings (password masked)
export async function GET(req: NextRequest) {
  try { await requireAuth(); } catch (e) { return e as Response; }
  const ip = getClientIp(req);
  const rl = rateLimitApiRead(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  try {
    const settings = await db.systemSetting.findMany({
      where: { key: { startsWith: "smtp." } },
    });
    const result: Record<string, string> = {};
    for (const s of settings) {
      // Mask the password
      if (s.key === "smtp.password") {
        result[s.key] = s.value ? "••••••••" : "";
      } else {
        result[s.key] = s.value;
      }
    }
    return NextResponse.json({ settings: result });
  } catch (e) {
    return NextResponse.json({ error: "Failed to fetch email settings" }, { status: 500 });
  }
}

// POST /api/email/settings — save SMTP settings (admin only)
export async function POST(req: NextRequest) {
  let user;
  try {
    user = await requireAuth();
    requirePermission(user.role, "maintenance");
  } catch (e) { return e as Response; }
  const ip = getClientIp(req);
  const rl = rateLimitApiWrite(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  try {
    const { host, port, user: smtpUser, password, from } = body;

    // Upsert each setting
    const settings = [
      { key: "smtp.host", value: host || "" },
      { key: "smtp.port", value: String(port || "587") },
      { key: "smtp.user", value: smtpUser || "" },
      { key: "smtp.password", value: password || "" },
      { key: "smtp.from", value: from || smtpUser || "" },
    ];

    for (const s of settings) {
      // Skip password if it's the mask (don't overwrite with dots)
      if (s.key === "smtp.password" && s.value === "••••••••") continue;

      const existing = await db.systemSetting.findFirst({ where: { key: s.key } });
      if (existing) {
        await db.systemSetting.update({ where: { id: existing.id }, data: { value: s.value } });
      } else {
        await db.systemSetting.create({ data: { key: s.key, value: s.value } });
      }
    }

    return NextResponse.json({ success: true, message: "Email settings saved" });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed to save settings" }, { status: 500 });
  }
}
