import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { rateLimitApiRead, rateLimitResponse, getClientIp } from "@/lib/rate-limit";

// GET /api/suppliers/[id]/performance?days=90
// Computes the supplier performance scorecard for the rolling window.
// Returns: onTimePct, fillRatePct, rejectionPct, avgLeadTimeDays,
// totalSpend, totalOrders, totalUnitsReceived, and a derived 1-5 star rating.
//
// Methodology:
//   onTimePct   = (# POs received on or before expectedAt) / (# POs received)
//   fillRatePct = (Σ receivedQty across items) / (Σ quantity across items)
//   rejectionPct = (# items with receivedQty < quantity) / (# items total)
//   avgLeadTime = AVG(receivedAt - createdAt) for received POs
//   totalSpend  = Σ purchase.total for received POs in the window
//   star rating = weighted score (40% on-time + 30% fill + 30% quality)
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { await requireAuth(); } catch (e) { return e as Response; }

  const ip = getClientIp(req);
  const rl = rateLimitApiRead(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const days = Math.min(Math.max(parseInt(searchParams.get("days") || "90", 10), 7), 365);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const supplier = await db.supplier.findUnique({
      where: { id },
      select: { id: true, name: true, code: true, rating: true },
    });
    if (!supplier) return NextResponse.json({ error: "Supplier not found" }, { status: 404 });

    // Pull all received POs in the window (only received POs have actuals)
    const purchases = await db.purchase.findMany({
      where: {
        supplierId: id,
        status: "received",
        receivedAt: { gte: since },
      },
      include: { items: true },
      orderBy: { receivedAt: "desc" },
    });

    if (purchases.length === 0) {
      return NextResponse.json({
        supplierId: id,
        supplierName: supplier.name,
        supplierCode: supplier.code,
        days,
        onTimePct: 0,
        fillRatePct: 0,
        rejectionPct: 0,
        avgLeadTimeDays: 0,
        totalSpend: 0,
        totalOrders: 0,
        totalUnitsOrdered: 0,
        totalUnitsReceived: 0,
        starRating: supplier.rating || 0,
        recentPurchases: [],
        message: `No received POs in the last ${days} days`,
      });
    }

    let onTimeCount = 0;
    let totalUnitsOrdered = 0;
    let totalUnitsReceived = 0;
    let rejectionCount = 0;
    let totalItems = 0;
    let totalSpend = 0;
    let leadTimeSum = 0;
    let leadTimeCount = 0;

    for (const p of purchases) {
      // On-time check
      if (p.expectedAt && p.receivedAt) {
        if (p.receivedAt <= p.expectedAt) onTimeCount++;
      } else {
        // No expectedAt set → assume on-time (neutral)
        onTimeCount++;
      }

      // Fill rate + rejection rate
      for (const item of p.items) {
        totalItems++;
        const ordered = item.quantity;
        const received = item.receivedQty ?? item.quantity; // null = full receipt
        totalUnitsOrdered += ordered;
        totalUnitsReceived += Math.min(received, ordered);
        if (received < ordered) rejectionCount++;
      }

      totalSpend += p.total;

      // Lead time (receivedAt - createdAt) in days
      if (p.receivedAt && p.createdAt) {
        const leadMs = p.receivedAt.getTime() - p.createdAt.getTime();
        leadTimeSum += leadMs / (24 * 60 * 60 * 1000);
        leadTimeCount++;
      }
    }

    const onTimePct = (onTimeCount / purchases.length) * 100;
    const fillRatePct = totalUnitsOrdered > 0 ? (totalUnitsReceived / totalUnitsOrdered) * 100 : 100;
    const rejectionPct = totalItems > 0 ? (rejectionCount / totalItems) * 100 : 0;
    const avgLeadTimeDays = leadTimeCount > 0 ? leadTimeSum / leadTimeCount : 0;

    // Star rating: weighted score (40% on-time + 30% fill + 30% quality)
    // Quality = 100 - rejectionPct
    const qualityPct = 100 - rejectionPct;
    const score = onTimePct * 0.4 + fillRatePct * 0.3 + qualityPct * 0.3;
    const computedStarRating = Math.max(1, Math.min(5, Math.round(score / 20))); // 0-100 → 1-5 stars

    // Top 5 recent purchases for the dashboard
    const recentPurchases = purchases.slice(0, 5).map(p => ({
      id: p.id,
      refNo: p.refNo,
      createdAt: p.createdAt,
      receivedAt: p.receivedAt,
      expectedAt: p.expectedAt,
      total: p.total,
      onTime: p.expectedAt && p.receivedAt ? p.receivedAt <= p.expectedAt : null,
      itemCount: p.items.length,
    }));

    return NextResponse.json({
      supplierId: id,
      supplierName: supplier.name,
      supplierCode: supplier.code,
      days,
      onTimePct: Math.round(onTimePct * 10) / 10,
      fillRatePct: Math.round(fillRatePct * 10) / 10,
      rejectionPct: Math.round(rejectionPct * 10) / 10,
      avgLeadTimeDays: Math.round(avgLeadTimeDays * 10) / 10,
      totalSpend: Math.round(totalSpend * 100) / 100,
      totalOrders: purchases.length,
      totalUnitsOrdered,
      totalUnitsReceived,
      starRating: supplier.rating > 0 ? supplier.rating : computedStarRating,
      computedStarRating,
      recentPurchases,
    });
  } catch (e) {
    console.error("GET /api/suppliers/[id]/performance error:", e);
    return NextResponse.json({ error: "Failed to compute performance" }, { status: 500 });
  }
}
