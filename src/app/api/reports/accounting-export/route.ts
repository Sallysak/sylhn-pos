import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

// GET /api/reports/accounting-export?from=2026-01-01&to=2026-12-31&format=csv
//
// Generates a journal-entry CSV for accounting software import
// (QuickBooks, Xero, Sage). Each sale and expense is a separate journal entry
// with debit/credit lines.
//
// Sales: DR Cash/MoMo | CR Revenue + CR VAT Payable
// Expenses: DR Expense Category | CR Cash/Bank
export async function GET(req: NextRequest) {
  try { await requireAuth(); } catch (e) { return e as Response; }

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const format = searchParams.get("format") || "csv";

  if (!from || !to) {
    return NextResponse.json({ error: "from and to required (YYYY-MM-DD)" }, { status: 400 });
  }

  const dateFrom = new Date(from + "T00:00:00");
  const dateTo = new Date(to + "T23:59:59");

  try {
    // Fetch sales
    const sales = await db.sale.findMany({
      where: { createdAt: { gte: dateFrom, lte: dateTo }, status: "completed" },
      select: { id: true, invoiceNumber: true, createdAt: true, total: true, taxAmount: true, subtotal: true, paymentMethod: true, amountPaid: true },
      orderBy: { createdAt: "asc" },
    });

    // Fetch expenses
    const expenses = await db.expense.findMany({
      where: { date: { gte: dateFrom, lte: dateTo } },
      select: { id: true, date: true, category: true, description: true, amount: true, paymentMode: true },
      orderBy: { date: "asc" },
    });

    // Build journal entries
    const entries: string[] = [];
    entries.push("Date,Reference,Description,Account,Debit,Credit,Memo");

    // Sales entries
    for (const sale of sales) {
      const date = new Date(sale.createdAt).toLocaleDateString("en-GB");
      const ref = sale.invoiceNumber;
      const revenue = Number(sale.subtotal) || 0;
      const tax = Number(sale.taxAmount) || 0;
      const total = Number(sale.total) || 0;
      const paymentAccount = sale.paymentMethod === "cash" ? "1000-Cash" : sale.paymentMethod === "momo" ? "1010-Mobile Money" : "1020-Bank";

      // DR Payment Account (total)
      entries.push(`${date},${ref},Sale ${ref},${paymentAccount},${total.toFixed(2)},,Payment received`);
      // CR Revenue (subtotal)
      entries.push(`${date},${ref},Sale ${ref},4000-Revenue,,${revenue.toFixed(2)},Sales income`);
      // CR VAT Payable (tax)
      if (tax > 0) {
        entries.push(`${date},${ref},Sale ${ref},2200-VAT Payable,,${tax.toFixed(2)},VAT collected`);
      }
    }

    // Expense entries
    for (const exp of expenses) {
      const date = new Date(exp.date).toLocaleDateString("en-GB");
      const ref = `EXP-${exp.id.slice(-6)}`;
      const amount = Number(exp.amount) || 0;
      const categoryAccount = `5000-${exp.category.charAt(0).toUpperCase() + exp.category.slice(1)}`;
      const paymentAccount = exp.paymentMode === "cash" ? "1000-Cash" : exp.paymentMode === "mobile-money" ? "1010-Mobile Money" : "1020-Bank";

      // DR Expense Category
      entries.push(`${date},${ref},${exp.description},${categoryAccount},${amount.toFixed(2)},,${exp.description}`);
      // CR Payment Account
      entries.push(`${date},${ref},${exp.description},${paymentAccount},,${amount.toFixed(2)},Payment made`);
    }

    // Summary
    const totalSales = sales.reduce((s, sale) => s + (Number(sale.total) || 0), 0);
    const totalExpenses = expenses.reduce((s, exp) => s + (Number(exp.amount) || 0), 0);
    const netProfit = totalSales - totalExpenses;

    entries.push("");
    entries.push(`SUMMARY`);
    entries.push(`Total Sales,${totalSales.toFixed(2)}`);
    entries.push(`Total Expenses,${totalExpenses.toFixed(2)}`);
    entries.push(`Net Profit,${netProfit.toFixed(2)}`);
    entries.push(`Period,${from} to ${to}`);
    entries.push(`Entries,${sales.length + expenses.length}`);

    const csv = entries.join("\n");

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="accounting-export-${from}-to-${to}.csv"`,
      },
    });
  } catch (e: any) {
    console.error("Accounting export error:", e);
    return NextResponse.json({ error: "Failed to generate export", detail: e?.message }, { status: 500 });
  }
}
