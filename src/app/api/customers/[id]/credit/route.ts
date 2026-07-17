import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requirePermission } from "@/lib/auth";
import { rateLimitApiRead, rateLimitApiWrite, rateLimitResponse, getClientIp } from "@/lib/rate-limit";
import { auditLogTx } from "@/lib/audit";

// GET /api/customers/[id]/credit — full credit account statement
// Shows: credit limit, current balance, all credit sales (unpaid), payment history
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { await requireAuth(); } catch (e) { return e as Response; }

  const ip = getClientIp(req);
  const rl = rateLimitApiRead(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  try {
    const { id } = await params;
    const customer = await db.customer.findUnique({
      where: { id },
      include: {
        sales: {
          where: { isCreditSale: true },
          include: { items: true, cashier: { select: { fullName: true } } },
          orderBy: { createdAt: "desc" },
        },
      },
    });
    if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 });

    // Compute outstanding credit = sum of creditAmountDue for non-settled sales
    const outstandingSales = customer.sales.filter(s => !s.creditSettledAt && s.creditAmountDue > 0);
    const totalOutstanding = outstandingSales.reduce((s, x) => s + x.creditAmountDue, 0);
    const totalCreditLimit = customer.creditLimit;
    const availableCredit = Math.max(0, totalCreditLimit - totalOutstanding);
    const overLimit = totalOutstanding > totalCreditLimit && totalCreditLimit > 0;

    return NextResponse.json({
      customer: {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        mobile: customer.mobile,
        tier: customer.tier,
        creditLimit: customer.creditLimit,
        currentBalance: customer.balance,
        totalOutstanding,
        availableCredit,
        overLimit,
        outstandingCount: outstandingSales.length,
      },
      sales: customer.sales.map(s => ({
        id: s.id,
        invoiceNumber: s.invoiceNumber,
        createdAt: s.createdAt.toISOString(),
        cashierName: s.cashier?.fullName || s.cashierName,
        total: s.total,
        creditAmountDue: s.creditAmountDue,
        creditDueDate: s.creditDueDate?.toISOString() || null,
        creditSettledAt: s.creditSettledAt?.toISOString() || null,
        isOverdue: s.creditDueDate ? new Date(s.creditDueDate) < new Date() && !s.creditSettledAt : false,
        itemCount: s.items.length,
      })),
      summary: {
        totalCreditSales: customer.sales.length,
        totalCreditIssued: customer.sales.reduce((s, x) => s + x.creditAmountDue, 0),
        totalOutstanding,
        totalSettled: customer.sales.reduce((s, x) => s + (x.creditSettledAt ? x.creditAmountDue : 0), 0),
        overdueCount: outstandingSales.filter(s => s.creditDueDate && new Date(s.creditDueDate) < new Date()).length,
      },
    });
  } catch (e) {
    console.error("GET /api/customers/[id]/credit error:", e);
    return NextResponse.json({ error: "Failed to fetch credit account" }, { status: 500 });
  }
}

// POST /api/customers/[id]/credit — settle a credit sale (pay down balance)
// Body: { saleId, amountPaid } or { saleIds: [...], amountPaid } (split across multiple)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let user;
  try { user = await requireAuth(); requirePermission(user.role, "financeOps"); } catch (e) { return e as Response; }

  const ip = getClientIp(req);
  const rl = rateLimitApiWrite(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  try {
    const { id } = await params;
    const amountPaid = Number(body.amountPaid);
    if (!amountPaid || amountPaid <= 0) {
      return NextResponse.json({ error: "amountPaid must be a positive number" }, { status: 400 });
    }

    const result = await db.$transaction(async (tx) => {
      const customer = await tx.customer.findUnique({ where: { id } });
      if (!customer) throw new Error("Customer not found");

      // Determine which sales to settle
      let saleIds: string[] = [];
      if (body.saleId) {
        saleIds = [String(body.saleId)];
      } else if (Array.isArray(body.saleIds)) {
        saleIds = body.saleIds.map(String);
      } else {
        // Auto-allocate to oldest unsettled credit sales (FIFO)
        const unsettled = await tx.sale.findMany({
          where: { customerId: id, isCreditSale: true, creditSettledAt: null, creditAmountDue: { gt: 0 } },
          orderBy: { createdAt: "asc" },
        });
        saleIds = unsettled.map(s => s.id);
      }

      if (saleIds.length === 0) throw new Error("No outstanding credit sales to settle");

      let remaining = amountPaid;
      const settledSales: any[] = [];

      for (const saleId of saleIds) {
        if (remaining <= 0) break;
        const sale = await tx.sale.findUnique({ where: { id: saleId } });
        if (!sale || !sale.isCreditSale) continue;
        if (sale.creditSettledAt) continue;  // already settled
        if (sale.creditAmountDue <= 0) continue;

        const payment = Math.min(remaining, sale.creditAmountDue);
        const newDue = sale.creditAmountDue - payment;
        const settledAt = newDue <= 0.01 ? new Date() : null;

        const updated = await tx.sale.update({
          where: { id: saleId },
          data: {
            creditAmountDue: newDue,
            creditSettledAt: settledAt,
            amountPaid: { increment: payment },
          },
        });

        settledSales.push({
          saleId,
          invoiceNumber: sale.invoiceNumber,
          payment,
          remainingDue: newDue,
          settled: settledAt !== null,
        });

        remaining -= payment;
      }

      // Update customer balance (reduce what they owe)
      const totalApplied = amountPaid - remaining;
      if (totalApplied > 0) {
        await tx.customer.update({
          where: { id },
          data: { balance: { decrement: totalApplied } },
        });
      }

      await auditLogTx(tx, {
        userId: user.uid,
        user: user.username,
        action: "CREDIT_SETTLE",
        module: "accounts",
        details: `Credit settlement: GHS ${totalApplied.toFixed(2)} applied to ${settledSales.length} sale(s) for ${customer.name} — ${settledSales.filter(s => s.settled).length} fully settled`,
        severity: "info",
        ipAddress: ip,
        userAgent: req.headers.get("user-agent") || "",
      });

      return { totalApplied, remaining, settledSales };
    });

    return NextResponse.json({ success: true, ...result });
  } catch (e: any) {
    console.error("POST /api/customers/[id]/credit error:", e);
    return NextResponse.json({ error: e?.message || "Failed to settle credit" }, { status: 400 });
  }
}
