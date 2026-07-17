import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { rateLimitApiRead, rateLimitResponse, getClientIp } from "@/lib/rate-limit";
import { getLowStockReorder } from "@/lib/reports";

// GET /api/reports/low-stock — low-stock reorder report with preferred supplier
export async function GET(req: NextRequest) {
  try { await requireAuth(); } catch (e) { return e as Response; }

  const ip = getClientIp(req);
  const rl = rateLimitApiRead(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  try {
    const items = await getLowStockReorder();
    const totalReorderCost = items.reduce((sum, i) => sum + i.reorderCost, 0);
    const bySupplier: Record<string, { supplierName: string; supplierCode: string; count: number; totalCost: number; items: any[] }> = {};

    for (const item of items) {
      const key = item.preferredSupplierId || "unassigned";
      if (!bySupplier[key]) {
        bySupplier[key] = {
          supplierName: item.preferredSupplierName || "Unassigned",
          supplierCode: item.preferredSupplierCode || "",
          count: 0,
          totalCost: 0,
          items: [],
        };
      }
      bySupplier[key].count += 1;
      bySupplier[key].totalCost += item.reorderCost;
      bySupplier[key].items.push(item);
    }

    return NextResponse.json({
      items,
      summary: {
        count: items.length,
        totalReorderCost,
        outOfStockCount: items.filter(i => i.quantity === 0).length,
        suppliersNeeded: Object.keys(bySupplier).length,
      },
      bySupplier: Object.values(bySupplier),
      generatedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error("GET /api/reports/low-stock error:", e);
    return NextResponse.json({ error: "Failed to generate low-stock report" }, { status: 500 });
  }
}
