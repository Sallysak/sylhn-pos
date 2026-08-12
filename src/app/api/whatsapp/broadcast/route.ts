import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requirePermission } from "@/lib/auth";
import { rateLimitApiWrite, rateLimitResponse, getClientIp } from "@/lib/rate-limit";
import { auditLog } from "@/lib/audit";

// POST /api/whatsapp/broadcast
// Body: { message: string, tier?: "all" | "bronze" | "silver" | "gold" | "platinum", customerIds?: string[] }
//
// Generates wa.me deep links for each customer. The cashier opens each link
// to send the broadcast message via WhatsApp.
//
// For automated bulk sending (WhatsApp Business API), integrate with:
//   - Twilio WhatsApp API
//   - Meta WhatsApp Business Cloud API
//   - 360dialog
//
// Returns an array of { customer, waLink } objects.
export async function POST(req: NextRequest) {
  let user;
  try { user = await requireAuth(); requirePermission(user.role, "financeOps"); } catch (e: any) { return e as Response; }
  const ip = getClientIp(req);
  const rl = rateLimitApiWrite(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const message = String(body.message || "").trim();
  if (!message) return NextResponse.json({ error: "Message is required" }, { status: 400 });

  try {
    // Build the where clause
    const where: any = { active: true, OR: [{ phone: { not: "" } }, { mobile: { not: "" } }] };
    if (body.tier && body.tier !== "all") where.tier = body.tier;
    if (Array.isArray(body.customerIds) && body.customerIds.length > 0) {
      where.id = { in: body.customerIds };
    }

    const customers = await db.customer.findMany({
      where,
      select: { id: true, name: true, phone: true, mobile: true, tier: true, pointsBalance: true },
      take: 500,
    });

    const links = customers.map(c => {
      const phone = (c.mobile || c.phone || "").replace(/[\s+()-]/g, "");
      const normalizedPhone = phone.startsWith("233") ? phone : phone.startsWith("0") ? "233" + phone.slice(1) : phone;
      const waLink = `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`;
      return { customer: { id: c.id, name: c.name, phone: c.mobile || c.phone, tier: c.tier, points: c.pointsBalance }, waLink };
    }).filter(l => l.customer.phone);

    await auditLog({
      userId: user.uid,
      user: user.username,
      action: "WHATSAPP_BROADCAST",
      module: "customer",
      details: `WhatsApp broadcast to ${links.length} customer(s) — message: "${message.slice(0, 80)}${message.length > 80 ? '...' : ''}"`,
      severity: "info",
      ipAddress: ip,
      userAgent: req.headers.get("user-agent") || "",
    }).catch(() => {});

    return NextResponse.json({ success: true, count: links.length, links });
  } catch (e: any) {
    return NextResponse.json({ error: "Failed to generate broadcast links", detail: e?.message }, { status: 500 });
  }
}
