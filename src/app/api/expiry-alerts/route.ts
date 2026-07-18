import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { rateLimitApiRead, rateLimitResponse, getClientIp } from "@/lib/rate-limit";
import { auditLog } from "@/lib/audit";

// GET /api/expiry-alerts — products expiring within N days
export async function GET(req: NextRequest) {
  try { await requireAuth(); } catch (e) { return e as Response; }
  const ip = getClientIp(req);
  const rl = rateLimitApiRead(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  try {
    const { searchParams } = new URL(req.url);
    const days = parseInt(searchParams.get("days") || "14", 10);
    const now = new Date();
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() + days);

    const products = await db.product.findMany({
      where: { active: true, expiryDate: { not: null, lte: cutoff } },
      orderBy: { expiryDate: "asc" },
    });

    const alerts = products.map(p => {
      const daysUntilExpiry = Math.ceil((new Date(p.expiryDate!).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      let urgency: "expired" | "critical" | "warning" | "soon" = "soon";
      if (daysUntilExpiry < 0) urgency = "expired";
      else if (daysUntilExpiry <= 3) urgency = "critical";
      else if (daysUntilExpiry <= 7) urgency = "warning";
      const suggestedDiscount = urgency === "expired" ? 100 : urgency === "critical" ? 30 : urgency === "warning" ? 15 : 0;
      return {
        productId: p.id, sku: p.sku, name: p.name, emoji: p.emoji,
        quantity: p.quantity, unit: p.unit, costPrice: p.costPrice, price: p.price,
        expiryDate: p.expiryDate!.toISOString().split("T")[0],
        daysUntilExpiry, urgency, suggestedDiscount,
        stockValueAtRisk: p.quantity * p.costPrice,
      };
    });

    return NextResponse.json({
      alerts,
      summary: {
        total: alerts.length,
        expired: alerts.filter(a => a.urgency === "expired").length,
        critical: alerts.filter(a => a.urgency === "critical").length,
        warning: alerts.filter(a => a.urgency === "warning").length,
        soon: alerts.filter(a => a.urgency === "soon").length,
        totalValueAtRisk: alerts.reduce((s, a) => s + a.stockValueAtRisk, 0),
      },
    });
  } catch (e) {
    return NextResponse.json({ error: "Failed to fetch expiry alerts" }, { status: 500 });
  }
}
