import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { rateLimitApiRead, rateLimitResponse, getClientIp } from "@/lib/rate-limit";
import { db } from "@/lib/db";

// GET /api/reports/customer-statement?customerId=xxx&from=2026-01-01&to=2026-12-31
//
// Generates a customer account statement showing:
//   - Opening balance (as of 'from' date)
//   - All transactions in the date range (credit sales + payments)
//   - Closing balance (as of 'to' date)
//   - Aging breakdown (current, 1-30, 31-60, 60+ days overdue)
//
// Used for monthly credit-customer statements that can be printed or
// emailed. Helps with collections — customers can see exactly what they
// owe and from which invoices.
export async function GET(req: NextRequest) {
  try { await requireAuth(); } catch (e) { return e as Response; }

  const ip = getClientIp(req);
  const rl = rateLimitApiRead(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  try {
    const { searchParams } = new URL(req.url);
    const customerId = searchParams.get("customerId");
    if (!customerId) {
      return NextResponse.json({ error: "customerId is required" }, { status: 400 });
    }

    // Default: last 30 days
    const to = searchParams.get("to") ? new Date(searchParams.get("to") as string) : new Date();
    const from = searchParams.get("from") ? new Date(searchParams.get("from") as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Fetch customer
    const customer = await db.customer.findUnique({
      where: { id: customerId },
      select: {
        id: true, name: true, phone: true, mobile: true, email: true,
        address: true, city: true, group: true, balance: true,
        creditLimit: true, active: true,
      },
    });
    if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 });

    // All credit sales for this customer BEFORE the 'from' date → opening balance
    const priorSales = await db.sale.findMany({
      where: {
        customerId,
        isCreditSale: true,
        createdAt: { lt: from },
      },
      select: { creditAmountDue: true, creditSettledAt: true },
    });
    // All payments (SalePayment) for this customer BEFORE the 'from' date
    const priorPayments = await db.salePayment.findMany({
      where: {
        sale: { customerId },
        createdAt: { lt: from },
      },
      select: { amount: true },
    });
    const openingBalance = priorSales.reduce((s, x) => s + (x.creditAmountDue || 0), 0)
      - priorPayments.reduce((s, x) => s + x.amount, 0);

    // Transactions in the window
    const [sales, payments] = await Promise.all([
      db.sale.findMany({
        where: {
          customerId,
          isCreditSale: true,
          createdAt: { gte: from, lte: to },
        },
        select: {
          id: true, invoiceNumber: true, createdAt: true,
          total: true, creditAmountDue: true, creditDueDate: true,
          creditSettledAt: true, status: true, notes: true,
        },
        orderBy: { createdAt: "asc" },
      }),
      db.salePayment.findMany({
        where: {
          sale: { customerId },
          createdAt: { gte: from, lte: to },
        },
        select: {
          id: true, amount: true, method: true, reference: true,
          createdAt: true, sale: { select: { invoiceNumber: true } },
        },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    // Merge into a single timeline
    type Txn = {
      date: Date;
      type: "sale" | "payment";
      ref: string;
      description: string;
      debit: number;   // increases what they owe
      credit: number;  // decreases what they owe (payment)
      balance: number; // running balance
      dueDate: Date | null;
      notes: string;
    };
    const txns: Txn[] = [];
    for (const s of sales) {
      txns.push({
        date: s.createdAt,
        type: "sale",
        ref: s.invoiceNumber,
        description: `Credit sale ${s.invoiceNumber}`,
        debit: s.creditAmountDue || s.total,
        credit: 0,
        balance: 0, // filled below
        dueDate: s.creditDueDate,
        notes: s.notes || "",
      });
    }
    for (const p of payments) {
      txns.push({
        date: p.createdAt,
        type: "payment",
        ref: p.sale?.invoiceNumber || p.reference || "—",
        description: `Payment received${p.method ? ` (${p.method})` : ""}${p.reference ? ` · ref ${p.reference}` : ""}`,
        debit: 0,
        credit: p.amount,
        balance: 0,
        dueDate: null,
        notes: "",
      });
    }
    txns.sort((a, b) => a.date.getTime() - b.date.getTime());

    // Compute running balance
    let running = openingBalance;
    for (const t of txns) {
      running += t.debit - t.credit;
      t.balance = running;
    }
    const closingBalance = running;

    // Aging breakdown — for each outstanding credit sale, compute days overdue
    const now = new Date();
    const aging = { current: 0, days1to30: 0, days31to60: 0, days60plus: 0 };
    for (const s of sales) {
      // Skip fully settled sales
      const settled = s.creditSettledAt !== null;
      if (settled) continue;
      const paymentsForSale = payments.filter(p => p.sale?.invoiceNumber === s.invoiceNumber).reduce((sum, p) => sum + p.amount, 0);
      const outstanding = (s.creditAmountDue || s.total) - paymentsForSale;
      if (outstanding <= 0.01) continue;
      if (!s.creditDueDate) {
        aging.current += outstanding;
        continue;
      }
      const daysOverdue = Math.floor((now.getTime() - s.creditDueDate.getTime()) / (24 * 60 * 60 * 1000));
      if (daysOverdue <= 0) aging.current += outstanding;
      else if (daysOverdue <= 30) aging.days1to30 += outstanding;
      else if (daysOverdue <= 60) aging.days31to60 += outstanding;
      else aging.days60plus += outstanding;
    }

    return NextResponse.json({
      customer,
      period: { from: from.toISOString(), to: to.toISOString() },
      openingBalance: Math.round(openingBalance * 100) / 100,
      closingBalance: Math.round(closingBalance * 100) / 100,
      totalDebits: Math.round(txns.reduce((s, t) => s + t.debit, 0) * 100) / 100,
      totalCredits: Math.round(txns.reduce((s, t) => s + t.credit, 0) * 100) / 100,
      transactionCount: txns.length,
      transactions: txns.map(t => ({
        ...t,
        date: t.date.toISOString(),
        dueDate: t.dueDate?.toISOString() || null,
      })),
      aging: {
        current: Math.round(aging.current * 100) / 100,
        days1to30: Math.round(aging.days1to30 * 100) / 100,
        days31to60: Math.round(aging.days31to60 * 100) / 100,
        days60plus: Math.round(aging.days60plus * 100) / 100,
      },
    });
  } catch (e) {
    console.error("GET /api/reports/customer-statement error:", e);
    return NextResponse.json({ error: "Failed to generate customer statement" }, { status: 500 });
  }
}
