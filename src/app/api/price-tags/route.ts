import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { rateLimitApiRead, rateLimitResponse, getClientIp } from "@/lib/rate-limit";

// GET /api/price-tags — generate printable price tags
export async function GET(req: NextRequest) {
  try { await requireAuth(); } catch (e) { return e as Response; }
  const ip = getClientIp(req);
  const rl = rateLimitApiRead(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  try {
    const { searchParams } = new URL(req.url);
    const groupId = searchParams.get("groupId");
    const limit = Math.min(parseInt(searchParams.get("limit") || "100", 10), 500);

    const where: any = { active: true };
    if (groupId) where.groupId = groupId;

    const products = await db.product.findMany({
      where,
      select: { id: true, sku: true, name: true, emoji: true, price: true, unit: true, barcode: true, expiryDate: true },
      orderBy: { name: "asc" },
      take: limit,
    });

    return NextResponse.json({ products, count: products.length });
  } catch (e) {
    return NextResponse.json({ error: "Failed to fetch price tags" }, { status: 500 });
  }
}
