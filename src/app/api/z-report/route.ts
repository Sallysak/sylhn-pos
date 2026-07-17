import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requirePermission } from "@/lib/auth";
import { rateLimitApiRead, rateLimitResponse, getClientIp } from "@/lib/rate-limit";
import { auditLog } from "@/lib/audit";

// GET /api/z-report?date=2026-07-17
// Premium: Daily Z-Report — the end-of-day summary that closes out the register.
//
// A Z-Report is the standard POS end-of-day reconciliation that shows:
//   - Gross sales (total of all completed sales)
//   - Voids and refunds (deductions)
//   - Net sales
//   - Tax collected (VAT/NHIL/GETFL)
//   - Payment method breakdown (cash, card, momo, etc.)
//   - Cash expected (opening float + cash sales - change given)
//   - Discount summary
//   - Transaction count
//   - Per-cashier breakdown
//   - Top products sold
//
// The "Z" historically means "Zahlttag" (German: paying day) — the register
// is reset after this report is printed.
export async function GET(req: NextRequest) {
  let user;
  try {
    user = await requireAuth();
    requirePermission(user.role, "accounts");
  } catch (e) { return e as Response; }

  const ip = getClientIp(req);
  const rl = rateLimitApiRead(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  try {
    const { searchParams } = new URL(req.url);
    const dateStr = searchParams.get("date") || new Date().toISOString().split("T")[0];
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      return NextResponse.json({ error: "Invalid date (use YYYY-MM-DD)" }, { status: 400 });
    }

    // Build date range for the whole day (Africa/Accra timezone)
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    // Fetch all sales for the day (completed + voided + refunded)
    const [completedSales, voidedSales, refundedSales] = await Promise.all([
      db.sale.findMany({
        where: { status: "completed", createdAt: { gte: startOfDay, lte: endOfDay } },
        include: {
          items: true,
          payments: true,
          cashier: { select: { fullName: true, username: true } },
        },
      }),
      db.sale.findMany({
        where: { status: "voided", voidedAt: { gte: startOfDay, lte: endOfDay } },
        include: { items: true, cashier: { select: { fullName: true } } },
      }),
      db.sale.findMany({
        where: { status: "refunded", refundedAt: { gte: startOfDay, lte: endOfDay } },
        include: { items: true },
      }),
    ]);

    // ===== Compute totals =====
    const grossSales = completedSales.reduce((s, x) => s + x.total, 0);
    const totalVoids = voidedSales.reduce((s, x) => s + x.total, 0);
    const totalRefunds = refundedSales.reduce((s, x) => s + x.total, 0);
    const netSales = grossSales - totalVoids - totalRefunds;

    const totalTaxCollected = completedSales.reduce((s, x) => s + x.taxAmount, 0);
    const totalDiscounts = completedSales.reduce((s, x) => s + x.discount, 0);
    const totalChange = completedSales.reduce((s, x) => s + x.change, 0);
    const totalCostOfGoods = completedSales.reduce((s, x) => s + x.costOfGoods, 0);
    const grossProfit = completedSales.reduce((s, x) => s + x.grossProfit, 0);

    // Payment method breakdown (from completed sales' payments)
    const paymentBreakdown: Record<string, { count: number; amount: number }> = {};
    for (const sale of completedSales) {
      // Use the primary paymentMethod if no split payments
      if (sale.payments.length === 0) {
        const m = sale.paymentMethod;
        if (!paymentBreakdown[m]) paymentBreakdown[m] = { count: 0, amount: 0 };
        paymentBreakdown[m].count += 1;
        paymentBreakdown[m].amount += sale.amountPaid;
      } else {
        for (const p of sale.payments) {
          if (!paymentBreakdown[p.method]) paymentBreakdown[p.method] = { count: 0, amount: 0 };
          paymentBreakdown[p.method].count += 1;
          paymentBreakdown[p.method].amount += p.amount;
        }
      }
    }

    // Cash expected = opening floats of shifts opened today + cash sales - change given
    const shifts = await db.cashierShift.findMany({
      where: {
        OR: [
          { openedAt: { gte: startOfDay, lte: endOfDay } },
          { closedAt: { gte: startOfDay, lte: endOfDay } },
        ],
      },
    });
    const totalOpeningFloat = shifts.reduce((s, x) => s + x.openingFloat, 0);
    const cashSales = paymentBreakdown["cash"]?.amount || 0;
    const cashExpected = totalOpeningFloat + cashSales - totalChange;
    const cashActual = shifts.reduce((s, x) => s + (x.actualCash || 0), 0);
    const cashVariance = cashActual - cashExpected;

    // Per-cashier breakdown
    const byCashier: Record<string, {
      fullName: string;
      transactionCount: number;
      totalSales: number;
      voids: number;
      discounts: number;
    }> = {};
    for (const sale of completedSales) {
      const key = sale.cashier?.username || "unknown";
      if (!byCashier[key]) {
        byCashier[key] = {
          fullName: sale.cashier?.fullName || "Unknown",
          transactionCount: 0,
          totalSales: 0,
          voids: 0,
          discounts: 0,
        };
      }
      byCashier[key].transactionCount += 1;
      byCashier[key].totalSales += sale.total;
      byCashier[key].discounts += sale.discount;
    }

    // Top products sold
    const productSales: Record<string, { name: string; emoji: string; sku: string; qty: number; revenue: number }> = {};
    for (const sale of completedSales) {
      for (const item of sale.items) {
        const key = item.sku;
        if (!productSales[key]) {
          productSales[key] = { name: item.name, emoji: item.emoji, sku: item.sku, qty: 0, revenue: 0 };
        }
        productSales[key].qty += item.quantity;
        productSales[key].revenue += item.total;
      }
    }
    const topProducts = Object.values(productSales).sort((a, b) => b.revenue - a.revenue).slice(0, 10);

    // Expenses today
    const expenses = await db.expense.findMany({
      where: { date: { gte: startOfDay, lte: endOfDay } },
    });
    const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);

    // Audit
    await auditLog({
      userId: user.uid,
      user: user.username,
      action: "Z_REPORT",
      module: "accounts",
      details: `Z-Report generated for ${dateStr} — gross ${grossSales.toFixed(2)}, net ${netSales.toFixed(2)}, ${completedSales.length} transactions, ${voidedSales.length} voids, ${refundedSales.length} refunds`,
      severity: "warning",
      ipAddress: ip,
      userAgent: req.headers.get("user-agent") || "",
    }).catch(() => {});

    return NextResponse.json({
      reportDate: dateStr,
      period: { from: startOfDay.toISOString(), to: endOfDay.toISOString() },
      summary: {
        grossSales,
        totalVoids,
        totalRefunds,
        netSales,
        totalTaxCollected,
        totalDiscounts,
        totalCostOfGoods,
        grossProfit,
        transactionCount: completedSales.length,
        voidCount: voidedSales.length,
        refundCount: refundedSales.length,
        totalExpenses,
        netCashFlow: grossProfit - totalExpenses,
      },
      payments: Object.entries(paymentBreakdown).map(([method, data]) => ({
        method,
        count: data.count,
        amount: data.amount,
      })),
      cash: {
        openingFloat: totalOpeningFloat,
        cashSales,
        totalChange,
        cashExpected,
        cashActual,
        cashVariance,
        shiftCount: shifts.length,
      },
      byCashier: Object.entries(byCashier).map(([username, data]) => ({ username, ...data })),
      topProducts,
      shifts: shifts.map(s => ({
        id: s.id,
        cashierName: s.cashierName,
        openedAt: s.openedAt,
        closedAt: s.closedAt,
        openingFloat: s.openingFloat,
        closingFloat: s.closingFloat,
        expectedCash: s.expectedCash,
        actualCash: s.actualCash,
        variance: s.variance,
        status: s.status,
      })),
      generatedAt: new Date().toISOString(),
      generatedBy: user.username,
      company: {
        name: "SYLHN COMPANY LTD",
        address: "East Legon, Accra",
        contact: "+233592766044",
      },
    });
  } catch (e) {
    console.error("GET /api/z-report error:", e);
    return NextResponse.json({ error: "Failed to generate Z-Report" }, { status: 500 });
  }
}
