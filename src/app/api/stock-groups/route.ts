import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requirePermission } from "@/lib/auth";
import { StockGroupSchema, validate, validationError } from "@/lib/validation";
import { rateLimitApiRead, rateLimitApiWrite, rateLimitResponse, getClientIp } from "@/lib/rate-limit";

// Simple in-memory cache for stock groups (they rarely change during a shift)
// Cache expires after 60 seconds
let groupsCache: { data: any; expiry: number } | null = null;
const CACHE_TTL = 60 * 1000; // 60 seconds

export async function GET(req: NextRequest) {
  try { await requireAuth(); } catch (e: any) { return e as Response; }

  const ip = getClientIp(req);
  const rl = rateLimitApiRead(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  // Return cached response if still fresh
  if (groupsCache && Date.now() < groupsCache.expiry) {
    return NextResponse.json({ groups: groupsCache.data, cached: true });
  }

  try {
    const groups = await db.stockGroup.findMany({
      include: {
        products: { where: { active: true }, select: { id: true, name: true, emoji: true, price: true, quantity: true, sku: true } },
        _count: { select: { products: true } },
      },
      orderBy: { name: "asc" },
    });
    // Update cache
    groupsCache = { data: groups, expiry: Date.now() + CACHE_TTL };
    return NextResponse.json({ groups });
  } catch (e: any) {
    console.error("GET /api/stock-groups error:", e);
    return NextResponse.json({ error: "Failed to fetch stock groups" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let user;
  try {
    user = await requireAuth();
    requirePermission(user.role, "stock");
  } catch (e: any) { return e as Response; }

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
        const r = validate(StockGroupSchema, g) as any;
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
    const g = result.data as any;

    const group = await db.stockGroup.create({
      data: {
        name: g.name,
        icon: g.icon || "📦",
        color: g.color || "#10b981",
        description: g.description || "",
      },
      include: { _count: { select: { products: true } } },
    });

    // Invalidate cache
    groupsCache = null;

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
  } catch (e: any) {
    console.error("POST /api/stock-groups error:", e);
    return NextResponse.json({ error: "Failed to create stock group" }, { status: 500 });
  }
}
