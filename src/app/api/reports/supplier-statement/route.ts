import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { rateLimitApiRead, rateLimitResponse, getClientIp } from "@/lib/rate-limit";
import { auditLog } from "@/lib/audit";

// GET /api/reports/supplier-statement?supplierId=xxx&dateFrom=...&dateTo=...
// Returns a full supplier statement: opening balance, all purchases + payments
// in the date range, and closing balance. Used for PDF generation.
export async function GET(req: NextRequest) {
  try { await requireAuth(); } catch (e) { return e as Response; }

  const ip = getClientIp(req);
  const rl = rateLimitApiRead(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  try {
    const { searchParams } = new URL(req.url);
    const supplierId = searchParams.get("supplierId");
    if (!supplierId) {
      return NextResponse.json({ error: "supplierId is required" }, { status: 400 });
    }

    const dateFrom = searchParams.get("dateFrom") ? new Date(searchParams.get("dateFrom")!) : null;
    const dateTo = searchParams.get("dateTo") ? new Date(searchParams.get("dateTo")!) : new Date();
    if (!dateTo) return NextResponse.json({ error: "Invalid dateTo" }, { status: 400 });

    const supplier = await db.supplier.findUnique({
      where: { id: supplierId },
      include: {
        purchases: {
          where: {
            ...(dateFrom || dateTo ? {
              createdAt: {
                ...(dateFrom ? { gte: dateFrom } : {}),
                ...(dateTo ? { lte: dateTo } : {}),
              },
            } : {}),
          },
          include: { items: true, payments: true },
          orderBy: { createdAt: "asc" },
        },
        payments: {
          where: {
            ...(dateFrom || dateTo ? {
              paymentDate: {
                ...(dateFrom ? { gte: dateFrom } : {}),
                ...(dateTo ? { lte: dateTo } : {}),
              },
            } : {}),
          },
          include: { user: { select: { fullName: true, username: true } } },
          orderBy: { paymentDate: "asc" },
        },
      },
    });

    if (!supplier) return NextResponse.json({ error: "Supplier not found" }, { status: 404 });

    // Compute opening balance: balance at the start of the period
    // = current balance - (purchases in period) + (payments in period)
    const purchasesInPeriod = supplier.purchases.reduce((s, p) => s + p.total, 0);
    const paymentsInPeriod = supplier.payments.reduce((s, p) => s + p.amount, 0);
    const openingBalance = supplier.balance - purchasesInPeriod + paymentsInPeriod;

    // Build a unified ledger of transactions (purchases + payments) sorted by date
    type LedgerEntry = {
      date: Date;
      type: "purchase" | "payment";
      ref: string;
      description: string;
      debit: number;   // increases what we owe (purchase)
      credit: number;  // decreases what we owe (payment)
      balance: number; // running balance
    };

    const ledger: LedgerEntry[] = [];
    for (const p of supplier.purchases) {
      ledger.push({
        date: p.createdAt,
        type: "purchase",
        ref: p.refNo,
        description: `Purchase — ${p.items.length} items (${p.status})`,
        debit: p.total,
        credit: 0,
        balance: 0,  // computed below
      });
    }
    for (const p of supplier.payments) {
      ledger.push({
        date: p.paymentDate,
        type: "payment",
        ref: p.reference || p.id.slice(-8),
        description: `Payment via ${p.paymentMode}${p.user ? ` — by ${p.user.fullName}` : ""}`,
        debit: 0,
        credit: p.amount,
        balance: 0,
      });
    }
    ledger.sort((a, b) => a.date.getTime() - b.date.getTime());

    // Compute running balance
    let running = openingBalance;
    for (const e of ledger) {
      running += e.debit - e.credit;
      e.balance = running;
    }

    const closingBalance = openingBalance + purchasesInPeriod - paymentsInPeriod;

    // Aging buckets (from closing balance → look at outstanding purchases)
    const now = Date.now();
    const DAY_MS = 1000 * 60 * 60 * 24;
    const cutoff30 = now - 30 * DAY_MS;
    const cutoff60 = now - 60 * DAY_MS;
    let agingCurrent = 0, aging30 = 0, aging60 = 0;
    for (const p of supplier.purchases) {
      const outstanding = Math.max(0, p.total - p.amountPaid);
      if (outstanding <= 0) continue;
      const ts = p.createdAt.getTime();
      if (ts >= cutoff30) agingCurrent += outstanding;
      else if (ts >= cutoff60) aging30 += outstanding;
      else aging60 += outstanding;
    }

    // Audit the report generation
    await auditLog({
      userId: "",
      user: "system",
      action: "REPORT",
      module: "accounts",
      details: `Supplier statement generated for ${supplier.code} (${supplier.name}) — ${ledger.length} entries, closing balance GHS ${closingBalance.toFixed(2)}`,
      severity: "info",
      ipAddress: ip,
    }).catch(() => {});

    return NextResponse.json({
      supplier: {
        id: supplier.id,
        code: supplier.code,
        name: supplier.name,
        contactName: supplier.contactName,
        phone: supplier.phone,
        mobile: supplier.mobile,
        email: supplier.email,
        address: supplier.address,
        city: supplier.city,
        country: supplier.country,
        tradingTerms: supplier.tradingTerms,
        creditLimit: supplier.creditLimit,
      },
      period: {
        from: dateFrom?.toISOString() || null,
        to: dateTo.toISOString(),
      },
      summary: {
        openingBalance,
        totalPurchases: purchasesInPeriod,
        totalPayments: paymentsInPeriod,
        closingBalance,
        purchaseCount: supplier.purchases.length,
        paymentCount: supplier.payments.length,
      },
      aging: {
        current: agingCurrent,
        days30to60: aging30,
        days60plus: aging60,
        totalOutstanding: agingCurrent + aging30 + aging60,
      },
      ledger,
      generatedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error("GET /api/reports/supplier-statement error:", e);
    return NextResponse.json({ error: "Failed to generate supplier statement" }, { status: 500 });
  }
}
