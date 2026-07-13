import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requirePermission } from "@/lib/auth";
import { StockGroupSchema, validate, validationError } from "@/lib/validation";
import { rateLimitApiRead, rateLimitApiWrite, rateLimitResponse, getClientIp } from "@/lib/rate-limit";

export async function GET(req: NextRequest) {
  try { await requireAuth(); } catch (e) { return e as Response; }

  const ip = getClientIp(req);
  const rl = rateLimitApiRead(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  try {
    const groups = await db.stockGroup.findMany({
      include: {
        products: { where: { active: true } },
        _count: { select: { products: true } },
      },
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ groups });
  } catch (e) {
    console.error("GET /api/stock-groups error:", e);
    return NextResponse.json({ error: "Failed to fetch stock groups" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let user;
  try {
    user = await requireAuth();
    requirePermission(user.role, "stock");
  } catch (e) { return e as Response; }

  const ip = getClientIp(req);
  const rl = rateLimitApiWrite(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  let body: unknown;
  try { body = await req.json(); } catch { return validationError("Invalid JSON body"); }

  try {
    if (Array.isArray((body as any)?.groups)) {
      const arr = (body as any).groups;
      const results: any[] = [];
      for (const g of arr.slice(0, 200)) {
        const r = validate(StockGroupSchema, g);
        if (!r.success) continue;
        const data = {
          name: r.data.name,
          icon: r.data.icon || "📦",
          color: r.data.color || "#10b981",
          description: r.data.description || "",
        };
        const existing = await db.stockGroup.findFirst({ where: { name: r.data.name } });
        if (existing) {
          results.push(await db.stockGroup.update({ where: { id: existing.id }, data }));
        } else {
          results.push(await db.stockGroup.create({ data }));
        }
      }
      return NextResponse.json({ success: true, count: results.length });
    }

    const result = validate(StockGroupSchema, body);
    if (!result.success) return validationError(result.error);
    const g = result.data;

    const group = await db.stockGroup.create({
      data: {
        name: g.name,
        icon: g.icon || "📦",
        color: g.color || "#10b981",
        description: g.description || "",
      },
      include: { _count: { select: { products: true } } },
    });

    await db.auditLog.create({
      data: {
        userId: user.uid,
        user: user.username,
        action: "CREATE",
        module: "stock",
        details: `Stock group ${group.name} created`,
        severity: "info",
      },
    });

    return NextResponse.json({ success: true, group });
  } catch (e) {
    console.error("POST /api/stock-groups error:", e);
    return NextResponse.json({ error: "Failed to create stock group" }, { status: 500 });
  }
}
