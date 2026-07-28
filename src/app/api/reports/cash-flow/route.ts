import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { rateLimitApiRead, rateLimitResponse, getClientIp } from "@/lib/rate-limit";
import { db } from "@/lib/db";

// GET /api/reports/cash-flow?days=30
// Daily cash flow report — cash IN vs cash OUT per day.
//
// Cash IN (sources):
//   - Sales (by payment method: cash, MoMo, card, wallet)
//   - Supplier payments are NOT cash in — they're outflows
//
// Cash OUT (uses):
//   - Supplier payments (by method)
//   - Expenses (all categories)
//
// Returns:
//   - daily: array of { date, cashIn, cashOut, net, runningBalance }
//   - summary: totalIn, totalOut, netFlow, startingBalance, endingBalance
//   - breakdown: cash in by source, cash out by category
//
// Useful for: cash flow management, predicting shortfalls, bank deposit
// planning, and answering "do we have enough cash to pay suppliers?"
export async function GET(req: NextRequest) {
  try { await requireAuth(); } catch (e) { return e as Response; }

  const ip = getClientIp(req);
  const rl = rateLimitApiRead(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  try {
    const { searchParams } = new URL(req.url);
    const days = Math.min(Math.max(parseInt(searchParams.get("days") || "30", 10), 1), 365);
    const since = new Date();
    since.setDate(since.getDate() - days);
    since.setHours(0, 0, 0, 0);

    // Fetch sales, supplier payments, and expenses in parallel
    const [sales, supplierPayments, expenses] = await Promise.all([
      db.sale.findMany({
        where: { status: "completed", createdAt: { gte: since } },
        select: { total: true, amountPaid: true, paymentMethod: true, createdAt: true },
      }),
      db.supplierPayment.findMany({
        where: { status: "completed", paymentDate: { gte: since } },
        select: { amount: true, whtAmount: true, paymentMode: true, paymentDate: true },
      }),
      db.expense.findMany({
        where: { createdAt: { gte: since } },
        select: { amount: true, category: true, createdAt: true },
      }),
    ]);

    // Build daily map
    const dailyMap = new Map<string, {
      date: string;
      cashIn: number;
      cashOut: number;
      cashInBreakdown: Record<string, number>; // by payment method
      cashOutBreakdown: Record<string, number>; // by category / supplier-payment
    }>();

    // Initialize all days in the range
    for (let i = 0; i < days; i++) {
      const d = new Date(since);
      d.setDate(d.getDate() + i);
      const key = d.toISOString().split("T")[0];
      dailyMap.set(key, {
        date: key,
        cashIn: 0, cashOut: 0,
        cashInBreakdown: {}, cashOutBreakdown: {},
      });
    }

    // Process sales (cash IN)
    for (const s of sales) {
      const key = s.createdAt.toISOString().split("T")[0];
      const entry = dailyMap.get(key);
      if (!entry) continue;
      const method = s.paymentMethod || "cash";
      entry.cashIn += s.amountPaid || s.total;
      entry.cashInBreakdown[method] = (entry.cashInBreakdown[method] || 0) + (s.amountPaid || s.total);
    }

    // Process supplier payments (cash OUT)
    for (const p of supplierPayments) {
      const key = p.paymentDate.toISOString().split("T")[0];
      const entry = dailyMap.get(key);
      if (!entry) continue;
      const effectiveOut = p.amount - (p.whtAmount || 0); // WHT goes to GRA, not the supplier
      entry.cashOut += effectiveOut;
      const cat = `supplier-payment (${p.paymentMode})`;
      entry.cashOutBreakdown[cat] = (entry.cashOutBreakdown[cat] || 0) + effectiveOut;
    }

    // Process expenses (cash OUT)
    for (const e of expenses) {
      const key = e.createdAt.toISOString().split("T")[0];
      const entry = dailyMap.get(key);
      if (!entry) continue;
      entry.cashOut += e.amount;
      const cat = e.category || "other";
      entry.cashOutBreakdown[cat] = (entry.cashOutBreakdown[cat] || 0) + e.amount;
    }

    // Build daily array with running balance
    const daily: any[] = [];
    let runningBalance = 0;
    for (const [key, entry] of Array.from(dailyMap.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
      const net = entry.cashIn - entry.cashOut;
      runningBalance += net;
      daily.push({
        ...entry,
        net: Math.round(net * 100) / 100,
        cashIn: Math.round(entry.cashIn * 100) / 100,
        cashOut: Math.round(entry.cashOut * 100) / 100,
        runningBalance: Math.round(runningBalance * 100) / 100,
      });
    }

    // Summary
    const totalIn = daily.reduce((s, d) => s + d.cashIn, 0);
    const totalOut = daily.reduce((s, d) => s + d.cashOut, 0);
    const netFlow = totalIn - totalOut;

    // Breakdown by source/category
    const cashInBySource: Record<string, number> = {};
    const cashOutByCategory: Record<string, number> = {};
    for (const d of daily) {
      for (const [k, v] of Object.entries(d.cashInBreakdown)) {
        cashInBySource[k] = (cashInBySource[k] || 0) + (v as number);
      }
      for (const [k, v] of Object.entries(d.cashOutBreakdown)) {
        cashOutByCategory[k] = (cashOutByCategory[k] || 0) + (v as number);
      }
    }

    return NextResponse.json({
      summary: {
        totalIn: Math.round(totalIn * 100) / 100,
        totalOut: Math.round(totalOut * 100) / 100,
        netFlow: Math.round(netFlow * 100) / 100,
        endingBalance: Math.round(runningBalance * 100) / 100,
        days,
        transactionCount: sales.length + supplierPayments.length + expenses.length,
      },
      daily,
      cashInBySource,
      cashOutByCategory,
    });
  } catch (e) {
    console.error("GET /api/reports/cash-flow error:", e);
    return NextResponse.json({ error: "Failed to generate cash flow report" }, { status: 500 });
  }
}
