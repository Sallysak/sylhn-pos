import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requirePermission } from "@/lib/auth";
import { rateLimitApiRead, rateLimitResponse, getClientIp } from "@/lib/rate-limit";

// GET /api/data-integrity — checks stock quantities against history
export async function GET(req: NextRequest) {
  let user;
  try { user = await requireAuth(); requirePermission(user.role, "canAdjustStock"); } catch (e) { return e as Response; }
  const ip = getClientIp(req);
  const rl = rateLimitApiRead(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  try {
    const products = await db.product.findMany({
      include: { stockHistory: { select: { action: true, quantity: true }, orderBy: { createdAt: "asc" } } },
    });

    const discrepancies: Array<{
      productId: string; sku: string; name: string; emoji: string;
      actualQty: number; expectedQty: number; difference: number;
      unit: string; value: number;
    }> = [];
    let checked = 0, ok = 0;

    for (const p of products) {
      checked++;
      // Compute expected quantity from history
      const expected = p.stockHistory.reduce((sum, h) => sum + h.quantity, 0);
      const actual = p.quantity;
      const diff = actual - expected;

      if (Math.abs(diff) > 0) {
        discrepancies.push({
          productId: p.id, sku: p.sku, name: p.name, emoji: p.emoji,
          actualQty: actual, expectedQty: expected, difference: diff,
          unit: p.unit, value: Math.abs(diff) * p.costPrice,
        });
      } else {
        ok++;
      }
    }

    return NextResponse.json({
      summary: { totalChecked: checked, ok, discrepancies: discrepancies.length, totalValueAtStake: discrepancies.reduce((s, d) => s + d.value, 0) },
      discrepancies,
      checkedAt: new Date().toISOString(),
    });
  } catch (e) {
    return NextResponse.json({ error: "Integrity check failed" }, { status: 500 });
  }
}
