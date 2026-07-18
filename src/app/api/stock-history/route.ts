import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { rateLimitApiRead, rateLimitResponse, getClientIp } from "@/lib/rate-limit";
import { auditLog } from "@/lib/audit";

// GET /api/stock-history
// Premium: full stock movement history with filters + pagination + export
//
// Query params:
//   productId: filter by product
//   action: filter by action type (sold|received|adjusted|returned|transfer|damaged)
//   dateFrom / dateTo: date range
//   userId: filter by user who made the change
//   search: search product name/sku/reason
//   limit: max results (default 200, max 1000)
//   offset: pagination offset
//   export: if "csv", returns CSV instead of JSON
export async function GET(req: NextRequest) {
  try { await requireAuth(); } catch (e) { return e as Response; }

  const ip = getClientIp(req);
  const rl = rateLimitApiRead(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  try {
    const { searchParams } = new URL(req.url);
    const productId = searchParams.get("productId");
    const action = searchParams.get("action");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const userId = searchParams.get("userId");
    const search = searchParams.get("search");
    const limit = Math.min(parseInt(searchParams.get("limit") || "200", 10), 1000);
    const offset = parseInt(searchParams.get("offset") || "0", 10);
    const exportFormat = searchParams.get("export");

    const where: any = {};
    if (productId) where.productId = productId;
    if (action) where.action = action;
    if (userId) where.userId = userId;
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }
    if (search) {
      where.OR = [
        { reason: { contains: search } },
        { reference: { contains: search } },
        { product: { name: { contains: search } } },
        { product: { sku: { contains: search } } },
      ];
    }

    const [entries, total] = await Promise.all([
      db.stockHistory.findMany({
        where,
        include: {
          product: { select: { id: true, sku: true, name: true, emoji: true, unit: true, price: true, costPrice: true } },
          user: { select: { id: true, fullName: true, username: true } },
          sale: { select: { invoiceNumber: true } },
          purchase: { select: { refNo: true } },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      db.stockHistory.count({ where }),
    ]);

    // Summary stats
    const summary = {
      totalEntries: total,
      totalInflow: entries.filter(e => e.quantity > 0).reduce((s, e) => s + e.quantity, 0),
      totalOutflow: entries.filter(e => e.quantity < 0).reduce((s, e) => s + Math.abs(e.quantity), 0),
      netChange: entries.reduce((s, e) => s + e.quantity, 0),
      byAction: entries.reduce((acc, e) => {
        acc[e.action] = (acc[e.action] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    };

    // CSV export
    if (exportFormat === "csv") {
      const headers = ["Date", "Product", "SKU", "Action", "Quantity", "Reason", "Reference", "User", "Sale Invoice", "Purchase Ref"];
      const rows = entries.map(e => [
        new Date(e.createdAt).toLocaleString("en-GB"),
        e.product?.name || "Unknown",
        e.product?.sku || "",
        e.action,
        e.quantity,
        e.reason || "",
        e.reference || "",
        e.user?.fullName || "System",
        e.sale?.invoiceNumber || "",
        e.purchase?.refNo || "",
      ]);
      const csv = [headers.join(","), ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(","))].join("\n");
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="stock-history-${new Date().toISOString().split("T")[0]}.csv"`,
        },
      });
    }

    return NextResponse.json({
      entries,
      summary,
      pagination: { total, limit, offset, hasMore: offset + limit < total },
    });
  } catch (e) {
    console.error("GET /api/stock-history error:", e);
    return NextResponse.json({ error: "Failed to fetch stock history" }, { status: 500 });
  }
}
