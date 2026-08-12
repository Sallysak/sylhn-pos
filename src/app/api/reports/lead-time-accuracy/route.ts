import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { rateLimitApiRead, rateLimitResponse, getClientIp } from "@/lib/rate-limit";
import { db } from "@/lib/db";

// GET /api/reports/lead-time-accuracy?days=90
// Compares promised lead time (expectedAt - createdAt) vs actual lead time
// (receivedAt - createdAt) per supplier. Shows which suppliers deliver on
// time vs late, and by how many days.
export async function GET(req: NextRequest) {
  try { await requireAuth(); } catch (e: any) { return e as Response; }
  const ip = getClientIp(req);
  const rl = rateLimitApiRead(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  try {
    const { searchParams } = new URL(req.url);
    const days = Math.min(Math.max(parseInt(searchParams.get("days") || "90", 10), 7), 365);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const purchases = await db.purchase.findMany({
      where: {
        status: "received",
        receivedAt: { gte: since },
        expectedAt: { not: null },
      },
      select: {
        id: true, refNo: true, createdAt: true, expectedAt: true, receivedAt: true,
        supplierId: true, supplier: { select: { id: true, name: true, code: true } },
      },
      orderBy: { receivedAt: "desc" },
    });

    // Group by supplier
    const supplierMap = new Map<string, {
      supplierId: string;
      supplierName: string;
      supplierCode: string;
      poCount: number;
      onTimeCount: number;
      lateCount: number;
      earlyCount: number;
      avgPromisedDays: number;
      avgActualDays: number;
      avgDelayDays: number;
      pos: any[];
    }>();

    for (const p of purchases) {
      const sid = p.supplierId || "unknown";
      const promised = (p.expectedAt!.getTime() - p.createdAt.getTime()) / (24 * 60 * 60 * 1000);
      const actual = (p.receivedAt!.getTime() - p.createdAt.getTime()) / (24 * 60 * 60 * 1000);
      const delay = actual - promised;

      if (!supplierMap.has(sid)) {
        supplierMap.set(sid, {
          supplierId: sid,
          supplierName: p.supplier?.name || "Unknown",
          supplierCode: p.supplier?.code || "",
          poCount: 0, onTimeCount: 0, lateCount: 0, earlyCount: 0,
          avgPromisedDays: 0, avgActualDays: 0, avgDelayDays: 0,
          pos: [],
        });
      }
      const s = supplierMap.get(sid)!;
      s.poCount++;
      if (delay <= 0) s.onTimeCount++;
      else s.lateCount++;
      if (delay < -1) s.earlyCount++;
      s.avgPromisedDays += promised;
      s.avgActualDays += actual;
      s.avgDelayDays += delay;
      s.pos.push({
        refNo: p.refNo,
        createdAt: p.createdAt.toISOString(),
        expectedAt: p.expectedAt!.toISOString(),
        receivedAt: p.receivedAt!.toISOString(),
        promisedDays: Math.round(promised * 10) / 10,
        actualDays: Math.round(actual * 10) / 10,
        delayDays: Math.round(delay * 10) / 10,
        onTime: delay <= 0,
      });
    }

    const suppliers = Array.from(supplierMap.values()).map(s => ({
      ...s,
      avgPromisedDays: s.poCount > 0 ? Math.round((s.avgPromisedDays / s.poCount) * 10) / 10 : 0,
      avgActualDays: s.poCount > 0 ? Math.round((s.avgActualDays / s.poCount) * 10) / 10 : 0,
      avgDelayDays: s.poCount > 0 ? Math.round((s.avgDelayDays / s.poCount) * 10) / 10 : 0,
      onTimePct: s.poCount > 0 ? Math.round((s.onTimeCount / s.poCount) * 1000) / 10 : 0,
      pos: s.pos.slice(0, 10), // top 10 recent POs
    })).sort((a, b) => b.avgDelayDays - a.avgDelayDays);

    const summary = {
      totalPOs: purchases.length,
      totalSuppliers: suppliers.length,
      avgOnTimePct: suppliers.length > 0 ? Math.round((suppliers.reduce((s, x) => s + x.onTimePct, 0) / suppliers.length) * 10) / 10 : 0,
      worstSupplier: suppliers[0] || null,
      bestSupplier: suppliers[suppliers.length - 1] || null,
      days,
    };

    return NextResponse.json({ summary, suppliers });
  } catch (e: any) {
    console.error("GET /api/reports/lead-time-accuracy error:", e);
    return NextResponse.json({ error: "Failed to generate lead-time report" }, { status: 500 });
  }
}
