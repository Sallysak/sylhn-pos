import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requirePermission } from "@/lib/auth";
import { rateLimitApiRead, rateLimitApiWrite, rateLimitResponse, getClientIp } from "@/lib/rate-limit";

// GET /api/stocktakes — list stocktakes
export async function GET(req: NextRequest) {
  try { await requireAuth(); } catch (e) { return e as Response; }

  const ip = getClientIp(req);
  const rl = rateLimitApiRead(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    const where: any = {};
    if (status) where.status = status;

    const stocktakes = await db.stocktake.findMany({
      where,
      include: {
        conductedBy: { select: { id: true, fullName: true, username: true } },
        _count: { select: { items: true } },
      },
      orderBy: { scheduledFor: "desc" },
    });
    return NextResponse.json({ stocktakes });
  } catch (e) {
    console.error("GET /api/stocktakes error:", e);
    return NextResponse.json({ error: "Failed to fetch stocktakes" }, { status: 500 });
  }
}

// POST /api/stocktakes — create a new stocktake
export async function POST(req: NextRequest) {
  let user;
  try {
    user = await requireAuth();
    requirePermission(user.role, "canAdjustStock");
  } catch (e) { return e as Response; }

  const ip = getClientIp(req);
  const rl = rateLimitApiWrite(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  try {
    const refNo = body.refNo || `ST-${Date.now()}`;
    const stocktake = await db.stocktake.create({
      data: {
        refNo,
        scheduledFor: body.scheduledFor ? new Date(body.scheduledFor) : new Date(),
        status: body.status || "scheduled",
        countMethod: body.countMethod || "full",
        scope: body.scope || "all",
        notes: String(body.notes || "").slice(0, 2000),
        conductedById: user.uid,
        startedAt: body.startedAt ? new Date(body.startedAt) : null,
        completedAt: body.completedAt ? new Date(body.completedAt) : null,
      },
      include: { conductedBy: { select: { fullName: true } } },
    });

    // If items are provided, create them
    if (Array.isArray(body.items)) {
      for (const item of body.items.slice(0, 1000)) {
        await db.stocktakeItem.create({
          data: {
            stocktakeId: stocktake.id,
            productId: item.productId,
            expectedQty: Number(item.expectedQty) || 0,
            countedQty: item.countedQty != null ? Number(item.countedQty) : null,
            variance: item.variance != null ? Number(item.variance) : null,
            reason: String(item.reason || "").slice(0, 500),
          },
        });
      }
    }

    await db.auditLog.create({
      data: {
        userId: user.uid,
        user: user.username,
        action: "CREATE",
        module: "maintenance",
        details: `Stocktake ${refNo} created`,
        severity: "info",
      },
    });

    return NextResponse.json({ success: true, stocktake });
  } catch (e) {
    console.error("POST /api/stocktakes error:", e);
    return NextResponse.json({ error: "Failed to create stocktake" }, { status: 500 });
  }
}
