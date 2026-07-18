import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { rateLimitApiRead, rateLimitResponse, getClientIp } from "@/lib/rate-limit";

// GET /api/quick-keys — top N most-sold products for quick-add buttons
export async function GET(req: NextRequest) {
  try { await requireAuth(); } catch (e) { return e as Response; }
  const ip = getClientIp(req);
  const rl = rateLimitApiRead(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 50);
    const days = parseInt(searchParams.get("days") || "30", 10);

    const since = new Date(); since.setDate(since.getDate() - days);

    // Aggregate sale items by product
    const items = await db.saleItem.findMany({
      where: { sale: { status: "completed", createdAt: { gte: since } } },
      select: { productId: true, name: true, emoji: true, sku: true, quantity: true, price: true },
    });

    const agg: Record<string, { productId: string; name: string; emoji: string; sku: string; price: number; qtySold: number; count: number }> = {};
    for (const item of items) {
      const key = item.productId || item.sku;
      if (!agg[key]) agg[key] = { productId: item.productId || "", name: item.name, emoji: item.emoji || "📦", sku: item.sku, price: item.price, qtySold: 0, count: 0 };
      agg[key].qtySold += item.quantity;
      agg[key].count += 1;
    }

    const topProducts = Object.values(agg).sort((a, b) => b.qtySold - a.qtySold).slice(0, limit);

    // If not enough sales data, fill with products that have stock
    if (topProducts.length < limit) {
      const products = await db.product.findMany({
        where: { active: true, quantity: { gt: 0 }, id: { notIn: topProducts.map(p => p.productId).filter(Boolean) } },
        select: { id: true, name: true, emoji: true, sku: true, price: true },
        take: limit - topProducts.length,
      });
      for (const p of products) {
        topProducts.push({ productId: p.id, name: p.name, emoji: p.emoji, sku: p.sku, price: p.price, qtySold: 0, count: 0 });
      }
    }

    return NextResponse.json({ quickKeys: topProducts });
  } catch (e) {
    return NextResponse.json({ error: "Failed to fetch quick keys" }, { status: 500 });
  }
}
