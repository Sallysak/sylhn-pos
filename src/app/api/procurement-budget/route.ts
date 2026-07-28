import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requirePermission } from "@/lib/auth";
import { rateLimitApiRead, rateLimitApiWrite, rateLimitResponse, getClientIp } from "@/lib/rate-limit";
import { auditLog } from "@/lib/audit";

// GET /api/procurement-budget?month=2026-07
// List all budgets for a given month. Returns each budget with actual
// spend (from received POs in that month) + variance.
export async function GET(req: NextRequest) {
  try { await requireAuth(); } catch (e) { return e as Response; }
  const ip = getClientIp(req);
  const rl = rateLimitApiRead(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  try {
    const { searchParams } = new URL(req.url);
    const month = searchParams.get("month") || new Date().toISOString().slice(0, 7); // YYYY-MM

    const budgets = await db.procurementBudget.findMany({
      where: { month },
      include: {
        supplier: { select: { id: true, name: true, code: true } },
        createdBy: { select: { fullName: true, username: true } },
      },
      orderBy: [{ supplier: { name: "asc" } }, { category: "asc" }],
    });

    // Compute actual spend per supplier/category for this month
    const [year, mon] = month.split("-").map(Number);
    const monthStart = new Date(year, mon - 1, 1);
    const monthEnd = new Date(year, mon, 1);

    const purchases = await db.purchase.findMany({
      where: {
        status: "received",
        receivedAt: { gte: monthStart, lt: monthEnd },
      },
      select: {
        supplierId: true, total: true,
        supplier: { select: { name: true } },
        items: { select: { product: { select: { category: true } }, total: true } },
      },
    });

    // Build spend map: key = supplierId or "all", value = total spend
    const spendBySupplier = new Map<string, number>();
    const spendByCategory = new Map<string, number>();
    let totalSpend = 0;
    for (const p of purchases) {
      const sid = p.supplierId || "unknown";
      spendBySupplier.set(sid, (spendBySupplier.get(sid) || 0) + p.total);
      totalSpend += p.total;
      for (const item of p.items) {
        const cat = item.product?.category || "uncategorized";
        spendByCategory.set(cat, (spendByCategory.get(cat) || 0) + item.total);
      }
    }

    // Enrich budgets with actual spend + variance
    const enriched = budgets.map(b => {
      let actualSpend = 0;
      if (b.supplierId) {
        actualSpend = spendBySupplier.get(b.supplierId) || 0;
      } else if (b.category) {
        actualSpend = spendByCategory.get(b.category) || 0;
      } else {
        actualSpend = totalSpend;
      }
      const variance = b.budgetAmount - actualSpend;
      const variancePct = b.budgetAmount > 0 ? (variance / b.budgetAmount) * 100 : 0;
      return {
        ...b,
        actualSpend: Math.round(actualSpend * 100) / 100,
        variance: Math.round(variance * 100) / 100,
        variancePct: Math.round(variancePct * 100) / 100,
        utilizationPct: b.budgetAmount > 0 ? Math.round((actualSpend / b.budgetAmount) * 10000) / 100 : 0,
        status: actualSpend > b.budgetAmount ? "over" : actualSpend > b.budgetAmount * 0.8 ? "warning" : "ok",
      };
    });

    // Summary
    const totalBudget = budgets.reduce((s, b) => s + b.budgetAmount, 0);
    const summary = {
      month,
      totalBudget: Math.round(totalBudget * 100) / 100,
      totalActualSpend: Math.round(totalSpend * 100) / 100,
      totalVariance: Math.round((totalBudget - totalSpend) * 100) / 100,
      budgetCount: budgets.length,
    };

    return NextResponse.json({ budgets: enriched, summary });
  } catch (e) {
    console.error("GET /api/procurement-budget error:", e);
    return NextResponse.json({ error: "Failed to fetch budgets" }, { status: 500 });
  }
}

// POST /api/procurement-budget
// Create or update a budget. Body: { month, supplierId?, category?, budgetAmount, notes? }
// Uses upsert on the unique [month, supplierId, category] constraint.
export async function POST(req: NextRequest) {
  let user;
  try {
    user = await requireAuth();
    requirePermission(user.role, "financeOps");
  } catch (e) { return e as Response; }
  const ip = getClientIp(req);
  const rl = rateLimitApiWrite(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  if (!body.month || !body.budgetAmount === undefined) {
    return NextResponse.json({ error: "month and budgetAmount are required" }, { status: 400 });
  }

  try {
    // Use findFirst + update/create instead of upsert because the composite
    // unique constraint [month, supplierId, category] has nullable fields,
    // which Prisma's upsert `where` clause can't handle directly.
    const existing = await db.procurementBudget.findFirst({
      where: {
        month: String(body.month),
        supplierId: body.supplierId || null,
        category: body.category || null,
      },
    });

    const budget = existing
      ? await db.procurementBudget.update({
          where: { id: existing.id },
          data: {
            budgetAmount: Number(body.budgetAmount),
            notes: String(body.notes || ""),
          },
          include: { supplier: { select: { name: true } } },
        })
      : await db.procurementBudget.create({
          data: {
            month: String(body.month),
            supplierId: body.supplierId || null,
            category: body.category || null,
            budgetAmount: Number(body.budgetAmount),
            notes: String(body.notes || ""),
            createdById: user.uid,
          },
          include: { supplier: { select: { name: true } } },
        });

    await auditLog({
      userId: user.uid, user: user.username,
      action: "CREATE", module: "accounts",
      details: `Procurement budget set — ${body.month}: ${budget.supplier?.name || body.category || "All"} = ₵${Number(body.budgetAmount).toFixed(2)}`,
      severity: "info", ipAddress: ip,
      userAgent: req.headers.get("user-agent") || "",
    });

    return NextResponse.json({ success: true, budget });
  } catch (e: any) {
    console.error("POST /api/procurement-budget error:", e);
    return NextResponse.json({ error: e?.message || "Failed to save budget" }, { status: 500 });
  }
}

// DELETE — delete a budget by id
export async function DELETE(req: NextRequest) {
  let user;
  try {
    user = await requireAuth();
    requirePermission(user.role, "financeOps");
  } catch (e) { return e as Response; }
  const ip = getClientIp(req);
  const rl = rateLimitApiWrite(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  try {
    await db.procurementBudget.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed to delete" }, { status: 500 });
  }
}
