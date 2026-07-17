import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requirePermission } from "@/lib/auth";
import { rateLimitApiRead, rateLimitApiWrite, rateLimitResponse, getClientIp } from "@/lib/rate-limit";
import { auditLog } from "@/lib/audit";

// GET /api/locations — list all locations
export async function GET(req: NextRequest) {
  try { await requireAuth(); } catch (e) { return e as Response; }

  const ip = getClientIp(req);
  const rl = rateLimitApiRead(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  try {
    const locations = await db.location.findMany({
      include: {
        _count: { select: { registers: true, stockLevels: true } },
      },
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ locations });
  } catch (e) {
    console.error("GET /api/locations error:", e);
    return NextResponse.json({ error: "Failed to fetch locations" }, { status: 500 });
  }
}

// POST /api/locations — create a new location
export async function POST(req: NextRequest) {
  let user;
  try { user = await requireAuth(); requirePermission(user.role, "maintenance"); } catch (e) { return e as Response; }

  const ip = getClientIp(req);
  const rl = rateLimitApiWrite(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  if (!body.name || !body.code) {
    return NextResponse.json({ error: "name and code are required" }, { status: 400 });
  }

  try {
    const location = await db.location.create({
      data: {
        name: String(body.name).slice(0, 200),
        code: String(body.code).slice(0, 32).toUpperCase(),
        type: String(body.type || "store").slice(0, 32),
        address: String(body.address || "").slice(0, 500),
        city: String(body.city || "").slice(0, 100),
        phone: String(body.phone || "").slice(0, 32),
        isActive: body.isActive !== false,
      },
    });

    await auditLog({
      userId: user.uid,
      user: user.username,
      action: "CREATE",
      module: "maintenance",
      details: `Location ${location.code} (${location.name}) created — type: ${location.type}`,
      severity: "info",
      ipAddress: ip,
      userAgent: req.headers.get("user-agent") || "",
    });

    return NextResponse.json({ success: true, location });
  } catch (e: any) {
    if (e?.code === "P2002") {
      return NextResponse.json({ error: "Location with this code already exists" }, { status: 409 });
    }
    console.error("POST /api/locations error:", e);
    return NextResponse.json({ error: "Failed to create location" }, { status: 500 });
  }
}
