import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requirePermission } from "@/lib/auth";
import { rateLimitApiRead, rateLimitApiWrite, rateLimitResponse, getClientIp } from "@/lib/rate-limit";
import { auditLog } from "@/lib/audit";

// GET /api/registers — list all registers with current cashier + shift
export async function GET(req: NextRequest) {
  try { await requireAuth(); } catch (e) { return e as Response; }

  const ip = getClientIp(req);
  const rl = rateLimitApiRead(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  try {
    const registers = await db.register.findMany({
      include: {
        location: { select: { id: true, name: true, code: true } },
        cashier: { select: { id: true, fullName: true, username: true } },
        _count: { select: { shifts: true } },
      },
      orderBy: { code: "asc" },
    });
    return NextResponse.json({ registers });
  } catch (e) {
    console.error("GET /api/registers error:", e);
    return NextResponse.json({ error: "Failed to fetch registers" }, { status: 500 });
  }
}

// POST /api/registers — create a new register
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
    const register = await db.register.create({
      data: {
        name: String(body.name).slice(0, 100),
        code: String(body.code).slice(0, 32).toUpperCase(),
        locationId: body.locationId || null,
        isActive: body.isActive !== false,
      },
      include: { location: true },
    });

    await auditLog({
      userId: user.uid,
      user: user.username,
      action: "CREATE",
      module: "maintenance",
      details: `Register ${register.code} (${register.name}) created${body.locationId ? ` at location ${body.locationId}` : ""}`,
      severity: "info",
      ipAddress: ip,
      userAgent: req.headers.get("user-agent") || "",
    });

    return NextResponse.json({ success: true, register });
  } catch (e: any) {
    if (e?.code === "P2002") {
      return NextResponse.json({ error: "Register with this name or code already exists" }, { status: 409 });
    }
    console.error("POST /api/registers error:", e);
    return NextResponse.json({ error: "Failed to create register" }, { status: 500 });
  }
}

// PUT /api/registers — claim/release a register (cashier login)
// Body: { action: "claim" | "release", registerId }
export async function PUT(req: NextRequest) {
  let user;
  try { user = await requireAuth(); } catch (e) { return e as Response; }

  const ip = getClientIp(req);
  const rl = rateLimitApiWrite(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { action, registerId } = body;
  if (!action || !registerId) {
    return NextResponse.json({ error: "action and registerId are required" }, { status: 400 });
  }

  try {
    const register = await db.register.findUnique({ where: { id: String(registerId) } });
    if (!register) return NextResponse.json({ error: "Register not found" }, { status: 404 });
    if (!register.isActive) return NextResponse.json({ error: "Register is deactivated" }, { status: 400 });

    if (action === "claim") {
      if (register.currentCashierId && register.currentCashierId !== user.uid) {
        return NextResponse.json({ error: "Register is already claimed by another cashier" }, { status: 409 });
      }
      // Release any other register this cashier was on
      await db.register.updateMany({
        where: { currentCashierId: user.uid, id: { not: register.id } },
        data: { currentCashierId: null, currentShiftId: null },
      });
      const updated = await db.register.update({
        where: { id: register.id },
        data: { currentCashierId: user.uid, lastActivityAt: new Date() },
        include: { location: true, cashier: { select: { fullName: true, username: true } } },
      });
      await auditLog({
        userId: user.uid,
        user: user.username,
        action: "REGISTER_CLAIM",
        module: "maintenance",
        details: `${user.username} claimed register ${register.code} (${register.name})`,
        severity: "info",
        ipAddress: ip,
        userAgent: req.headers.get("user-agent") || "",
      });
      return NextResponse.json({ success: true, register: updated });
    }

    if (action === "release") {
      if (register.currentCashierId !== user.uid && user.role !== "admin" && user.role !== "manager") {
        return NextResponse.json({ error: "You can only release your own register" }, { status: 403 });
      }
      const updated = await db.register.update({
        where: { id: register.id },
        data: { currentCashierId: null, currentShiftId: null, lastActivityAt: new Date() },
      });
      await auditLog({
        userId: user.uid,
        user: user.username,
        action: "REGISTER_RELEASE",
        module: "maintenance",
        details: `${user.username} released register ${register.code}`,
        severity: "info",
        ipAddress: ip,
        userAgent: req.headers.get("user-agent") || "",
      });
      return NextResponse.json({ success: true, register: updated });
    }

    return NextResponse.json({ error: "Invalid action (use 'claim' or 'release')" }, { status: 400 });
  } catch (e) {
    console.error("PUT /api/registers error:", e);
    return NextResponse.json({ error: "Failed to update register" }, { status: 500 });
  }
}
