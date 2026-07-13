import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { rateLimitApiRead, rateLimitApiWrite, rateLimitResponse, getClientIp } from "@/lib/rate-limit";

// GET /api/customers — list customers
export async function GET(req: NextRequest) {
  try { await requireAuth(); } catch (e) { return e as Response; }

  const ip = getClientIp(req);
  const rl = rateLimitApiRead(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search");
    const group = searchParams.get("group");

    const where: any = {};
    if (group) where.group = group;
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { phone: { contains: search } },
        { mobile: { contains: search } },
        { email: { contains: search } },
      ];
    }

    const customers = await db.customer.findMany({
      where,
      include: { _count: { select: { sales: true } } },
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ customers });
  } catch (e) {
    console.error("GET /api/customers error:", e);
    return NextResponse.json({ error: "Failed to fetch customers" }, { status: 500 });
  }
}

// POST /api/customers — create a new customer
export async function POST(req: NextRequest) {
  let user;
  try { user = await requireAuth(); } catch (e) { return e as Response; }

  const ip = getClientIp(req);
  const rl = rateLimitApiWrite(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  try {
    const customer = await db.customer.create({
      data: {
        name: String(body.name || "").slice(0, 200),
        phone: String(body.phone || "").slice(0, 32),
        mobile: String(body.mobile || "").slice(0, 32),
        email: String(body.email || "").slice(0, 200),
        address: String(body.address || "").slice(0, 500),
        city: String(body.city || "").slice(0, 100),
        group: String(body.group || "regular").slice(0, 50),
        creditLimit: Number(body.creditLimit) || 0,
        notes: String(body.notes || "").slice(0, 2000),
        createdById: user.uid,
      },
    });

    await db.auditLog.create({
      data: {
        userId: user.uid,
        user: user.username,
        action: "CREATE",
        module: "telephone",
        details: `Customer ${customer.name} created`,
        severity: "info",
      },
    });

    return NextResponse.json({ success: true, customer });
  } catch (e) {
    console.error("POST /api/customers error:", e);
    return NextResponse.json({ error: "Failed to create customer" }, { status: 500 });
  }
}
