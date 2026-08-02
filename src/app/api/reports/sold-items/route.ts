import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { rateLimitApiRead, rateLimitResponse, getClientIp } from "@/lib/rate-limit";

// GET /api/reports/sold-items?dateFrom=...&dateTo=...&groupBy=category|product|none
// Returns: line-by-line sold items within the date range, joined with sale +
// product info. Used by the Sold Items Report component.
export async function GET(req: NextRequest) {
  try { await requireAuth(); } catch (e) { return e as Response; }

  const ip = getClientIp(req);
  const rl = rateLimitApiRead(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  try {
    const { searchParams } = new URL(req.url);
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const groupBy = searchParams.get("groupBy") || "category"; // category | product | none

    const where: any = {};
    if (dateFrom || dateTo) {
      where.sale = {};
      if (dateFrom) where.sale.createdAt = { gte: new Date(dateFrom) };
      if (dateTo) {
        where.sale = {
          ...where.sale,
          createdAt: { ...where.sale.createdAt, lte: new Date(dateTo) },
        };
      }
    }
    // Only completed sales (no voided/held)
    where.sale = { ...where.sale, status: "completed" };

    const items = await db.saleItem.findMany({
      where,
      include: {
        sale: { select: { invoiceNumber: true, createdAt: true, cashierName: true, customerName: true } },
        product: { select: { id: true, sku: true, barcode: true, name: true, emoji: true, category: true, group: { select: { name: true } } } },
      },
      orderBy: { sale: { createdAt: "desc" } },
      take: 5000,
    });

    // Shape the response
    const rows = items.map((it, i) => {
      const category = it.product?.group?.name || it.product?.category || "Uncategorized";
      return {
        id: it.id,
        date: it.sale.createdAt.toISOString(),
        invoiceNumber: it.sale.invoiceNumber,
        partNo: it.product?.barcode || it.sku,
        details: it.name,
        qty: it.quantity,
        amount: it.total,
        unitPrice: it.price,
        category,
        emoji: it.emoji || it.product?.emoji || "📦",
        cashier: it.sale.cashierName,
        customer: it.sale.customerName || "Walk-in",
      };
    });

    // Summary by group
    const byCategory: Record<string, { qty: number; amount: number; count: number }> = {};
    for (const r of rows) {
      if (!byCategory[r.category]) byCategory[r.category] = { qty: 0, amount: 0, count: 0 };
      byCategory[r.category].qty += r.qty;
      byCategory[r.category].amount += r.amount;
      byCategory[r.category].count += 1;
    }

    // Summary by product
    const byProduct: Record<string, { name: string; sku: string; emoji: string; qty: number; amount: number; count: number }> = {};
    for (const r of rows) {
      const key = r.partNo || r.details;
      if (!byProduct[key]) byProduct[key] = { name: r.details, sku: r.partNo, emoji: r.emoji, qty: 0, amount: 0, count: 0 };
      byProduct[key].qty += r.qty;
      byProduct[key].amount += r.amount;
      byProduct[key].count += 1;
    }

    return NextResponse.json({
      rows,
      summary: {
        totalRows: rows.length,
        totalQty: rows.reduce((s, r) => s + r.qty, 0),
        totalAmount: rows.reduce((s, r) => s + r.amount, 0),
        uniqueProducts: Object.keys(byProduct).length,
        uniqueCategories: Object.keys(byCategory).length,
      },
      byCategory: Object.entries(byCategory)
        .map(([category, v]) => ({ category, ...v }))
        .sort((a, b) => b.amount - a.amount),
      byProduct: Object.entries(byProduct)
        .map(([key, v]) => ({ key, ...v }))
        .sort((a, b) => b.qty - a.qty),
    });
  } catch (e) {
    console.error("GET /api/reports/sold-items error:", e);
    return NextResponse.json({ error: "Failed to fetch sold items" }, { status: 500 });
  }
}
