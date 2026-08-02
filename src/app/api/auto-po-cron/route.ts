import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generatePurchaseRefNo } from "@/lib/identifiers";

// GET /api/auto-po-cron?secret=CRON_SECRET
// Cron-triggered endpoint that checks all products at or below their reorder level
// and auto-creates draft POs for them (grouped by preferred supplier).
// Called daily by Vercel Cron.
export async function GET(req: NextRequest) {
  // Verify cron secret
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Find all active products at or below reorder level
    const lowStockProducts = await db.product.findMany({
      where: { active: true, quantity: { lte: db.product.fields.reorderLevel } },
      include: {
        suppliers: {
          where: { preferred: true },
          take: 1,
          include: { supplier: { select: { id: true, name: true, code: true, active: true } } },
        },
      },
    });

    if (lowStockProducts.length === 0) {
      return NextResponse.json({ success: true, message: "No products at reorder level", posCreated: 0 });
    }

    // Group by preferred supplier
    const bySupplier = new Map<string, { supplier: any; items: any[] }>();
    const unassigned: any[] = [];

    for (const p of lowStockProducts) {
      const preferred = p.suppliers[0];
      if (preferred?.supplier?.active) {
        const sid = preferred.supplier.id;
        if (!bySupplier.has(sid)) {
          bySupplier.set(sid, { supplier: preferred.supplier, items: [] });
        }
        bySupplier.get(sid)!.items.push({
          product: p,
          supplierCost: preferred.supplierCost || p.costPrice,
          reorderQty: Math.max((p.reorderLevel || 5) * 2 - p.quantity, 1),
        });
      } else {
        unassigned.push(p);
      }
    }

    // Create one draft PO per supplier
    const createdPOs: string[] = [];
    for (const [sid, { supplier, items }] of bySupplier) {
      const refNo = generatePurchaseRefNo();
      const subtotal = items.reduce((s, i) => s + i.reorderQty * i.supplierCost, 0);

      const po = await db.purchase.create({
        data: {
          refNo,
          type: "order",
          supplierId: sid,
          supplierName: supplier.name,
          status: "draft",
          subtotal,
          total: subtotal,
          notes: `Auto-generated PO — ${items.length} items at reorder level`,
          items: {
            create: items.map(i => ({
              productId: i.product.id,
              partNo: i.product.sku,
              details: i.product.name,
              emoji: i.product.emoji || "📦",
              quantity: i.reorderQty,
              cost: i.supplierCost,
              tax: false,
              total: i.reorderQty * i.supplierCost,
              taxRate: 0,
              taxAmount: 0,
              discountAmount: 0,
              freeQuantity: 0,
              retailPrice: 0,
              tradePrice: 0,
              wholesalePrice: 0,
              landedCostPerUnit: 0,
              totalLandedCost: 0,
            })),
          },
        },
      });
      createdPOs.push(po.refNo);
    }

    return NextResponse.json({
      success: true,
      message: `Created ${createdPOs.length} draft PO(s) for ${bySupplier.size} supplier(s)`,
      posCreated: createdPOs.length,
      poRefs: createdPOs,
      unassignedCount: unassigned.length,
      totalItemsProcessed: lowStockProducts.length,
    });
  } catch (e: any) {
    console.error("GET /api/auto-po-cron error:", e);
    return NextResponse.json({ error: e?.message || "Failed to run auto-PO cron" }, { status: 500 });
  }
}
