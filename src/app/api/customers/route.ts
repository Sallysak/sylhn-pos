import { NextRequest, NextResponse } from "next/server";
import { db, waitForDb } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { rateLimitApiRead, rateLimitApiWrite, rateLimitResponse, getClientIp } from "@/lib/rate-limit";
import { auditLog } from "@/lib/audit";

// GET /api/customers — list customers
export async function GET(req: NextRequest) {
  try { await requireAuth(); } catch (e) { return e as Response; }
  await waitForDb();

  const ip = getClientIp(req);
  const rl = rateLimitApiRead(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search");
    const group = searchParams.get("group");
    const tier = searchParams.get("tier");
    const limit = Math.min(parseInt(searchParams.get("limit") || "200", 10), 1000);

    const where: any = {};
    if (group) where.group = group;
    if (tier) where.tier = tier;
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
      include: {
        _count: { select: { sales: true, loyaltyTransactions: true } },
        createdBy: { select: { fullName: true } },
      },
      orderBy: { name: "asc" },
      take: limit,
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
  await waitForDb();

  const ip = getClientIp(req);
  const rl = rateLimitApiWrite(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  if (!body.name) {
    return NextResponse.json({ error: "Customer name is required" }, { status: 400 });
  }

  try {
    const customer = await db.customer.create({
      data: {
        name: String(body.name).slice(0, 200),
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

    await auditLog({
      userId: user.uid,
      user: user.username,
      action: "CREATE",
      module: "customers",
      details: `Customer ${customer.name} (tier: ${customer.tier}) created`,
      severity: "info",
      ipAddress: ip,
      userAgent: req.headers.get("user-agent") || "",
    });

    return NextResponse.json({ success: true, customer });
  } catch (e) {
    console.error("POST /api/customers error:", e);
    return NextResponse.json({ error: "Failed to create customer" }, { status: 500 });
  }
}
