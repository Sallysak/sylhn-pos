import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requirePermission } from "@/lib/auth";
import { rateLimitApiRead, rateLimitResponse, getClientIp } from "@/lib/rate-limit";
import { auditLog } from "@/lib/audit";

// GET /api/reports/supplier-payments-schedule
// Premium: lists all scheduled/upcoming/overdue supplier payments.
//
// Auto-categorizes:
//   - overdue: scheduledFor < now AND status != completed
//   - due-soon: scheduledFor within 7 days
//   - upcoming: scheduledFor within 30 days
//   - scheduled: scheduledFor > 30 days
//
// Also generates "implied" scheduled payments from unpaid purchases
// based on the supplier's trading terms (Net 15/30/60).
export async function GET(req: NextRequest) {
  let user;
  try {
    user = await requireAuth();
    requirePermission(user.role, "financeOps");
  } catch (e) { return e as Response; }

  const ip = getClientIp(req);
  const rl = rateLimitApiRead(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  try {
    const now = new Date();
    const dayMs = 1000 * 60 * 60 * 24;
    const in7Days = new Date(now.getTime() + 7 * dayMs);
    const in30Days = new Date(now.getTime() + 30 * dayMs);

    // ===== Explicit scheduled payments (created via supplier-payments endpoint) =====
    const scheduledPayments = await db.supplierPayment.findMany({
      where: {
        scheduledFor: { not: null },
        status: { in: ["scheduled", "overdue"] },
      },
      include: {
        supplier: { select: { id: true, code: true, name: true, mobile: true, email: true, tradingTerms: true } },
        purchase: { select: { id: true, refNo: true, total: true, amountPaid: true } },
      },
      orderBy: { scheduledFor: "asc" },
    });

    // ===== Implied payments: unpaid purchases with Net 15/30/60 terms =====
    // For each supplier with tradingTerms = "Net N", the implied due date is
    // purchase.createdAt + N days.
    const unpaidPurchases = await db.purchase.findMany({
      where: {
        status: "received",
        supplier: { isNot: null },
      },
      include: {
        supplier: { select: { id: true, code: true, name: true, mobile: true, email: true, tradingTerms: true } },
      },
    });

    // Filter to only those with outstanding balance
    const impliedPayments = unpaidPurchases
      .filter(p => {
        const outstanding = p.total - p.amountPaid;
        return outstanding > 0.01 && p.supplierId;
      })
      .map(p => {
        const terms = p.supplier?.tradingTerms || "Net 30";
        const netDays = parseInt(terms.match(/\d+/)?.[0] || "30", 10);
        const dueDate = new Date(p.createdAt.getTime() + netDays * dayMs);
        const outstanding = p.total - p.amountPaid;
        let category: "overdue" | "due-soon" | "upcoming" | "scheduled";
        if (dueDate < now) category = "overdue";
        else if (dueDate < in7Days) category = "due-soon";
        else if (dueDate < in30Days) category = "upcoming";
        else category = "scheduled";

        return {
          type: "implied" as const,
          purchaseId: p.id,
          refNo: p.refNo,
          supplierId: p.supplierId!,
          supplier: p.supplier!,
          amount: outstanding,
          dueDate: dueDate.toISOString(),
          tradingTerms: terms,
          category,
          daysUntilDue: Math.ceil((dueDate.getTime() - now.getTime()) / dayMs),
        };
      });

    // Categorize explicit scheduled payments
    const explicitPayments = scheduledPayments.map(p => {
      const dueDate = p.scheduledFor!;
      let category: "overdue" | "due-soon" | "upcoming" | "scheduled";
      if (dueDate < now) category = "overdue";
      else if (dueDate < in7Days) category = "due-soon";
      else if (dueDate < in30Days) category = "upcoming";
      else category = "scheduled";

      return {
        type: "explicit" as const,
        paymentId: p.id,
        purchaseId: p.purchaseId,
        refNo: p.purchase?.refNo,
        supplierId: p.supplierId,
        supplier: {
          id: p.supplier.id,
          code: p.supplier.code,
          name: p.supplier.name,
          mobile: p.supplier.mobile,
          email: p.supplier.email,
          tradingTerms: p.supplier.tradingTerms,
        },
        amount: p.amount,
        dueDate: dueDate.toISOString(),
        paymentMode: p.paymentMode,
        reference: p.reference,
        notes: p.notes,
        category,
        daysUntilDue: Math.ceil((dueDate.getTime() - now.getTime()) / dayMs),
      };
    });

    // Merge + sort by due date
    const all = [...explicitPayments, ...impliedPayments].sort((a, b) =>
      new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
    );

    const summary = {
      total: all.reduce((s, p) => s + p.amount, 0),
      overdue: all.filter(p => p.category === "overdue").reduce((s, p) => s + p.amount, 0),
      dueSoon: all.filter(p => p.category === "due-soon").reduce((s, p) => s + p.amount, 0),
      upcoming: all.filter(p => p.category === "upcoming").reduce((s, p) => s + p.amount, 0),
      scheduled: all.filter(p => p.category === "scheduled").reduce((s, p) => s + p.amount, 0),
      count: all.length,
      overdueCount: all.filter(p => p.category === "overdue").length,
    };

    // Audit
    await auditLog({
      userId: user.uid,
      user: user.username,
      action: "REPORT",
      module: "accounts",
      details: `Supplier payment schedule generated — ${all.length} payments due, total GHS ${summary.total.toFixed(2)} (${summary.overdueCount} overdue)`,
      severity: "info",
      ipAddress: ip,
      userAgent: req.headers.get("user-agent") || "",
    }).catch(() => {});

    return NextResponse.json({
      generatedAt: now.toISOString(),
      summary,
      payments: all,
    });
  } catch (e) {
    console.error("GET /api/reports/supplier-payments-schedule error:", e);
    return NextResponse.json({ error: "Failed to generate payment schedule" }, { status: 500 });
  }
}
