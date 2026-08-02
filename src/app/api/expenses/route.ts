import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requirePermission } from "@/lib/auth";
import { ExpenseSchema, validate, validationError } from "@/lib/validation";
import { rateLimitApiRead, rateLimitApiWrite, rateLimitResponse, getClientIp } from "@/lib/rate-limit";
import { auditLog } from "@/lib/audit";

// GET /api/expenses — list expenses (with optional date filter)
export async function GET(req: NextRequest) {
  try { await requireAuth(); } catch (e) { return e as Response; }

  const ip = getClientIp(req);
  const rl = rateLimitApiRead(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  try {
    const { searchParams } = new URL(req.url);
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const category = searchParams.get("category");
    const limit = Math.min(parseInt(searchParams.get("limit") || "200", 10), 1000);

    const where: any = {};
    if (dateFrom || dateTo) {
      where.date = {};
      if (dateFrom) where.date.gte = new Date(dateFrom);
      if (dateTo) where.date.lte = new Date(dateTo);
    }
    if (category) where.category = category;

    const expenses = await db.expense.findMany({
      where,
      include: {
        user: { select: { id: true, fullName: true, username: true } },
      },
      orderBy: { date: "desc" },
      take: limit,
    });

    // Aggregate by category
    const byCategory: Record<string, number> = {};
    let total = 0;
    for (const e of expenses) {
      byCategory[e.category] = (byCategory[e.category] || 0) + e.amount;
      total += e.amount;
    }

    return NextResponse.json({ expenses, summary: { total, byCategory, count: expenses.length } });
  } catch (e) {
    console.error("GET /api/expenses error:", e);
    return NextResponse.json({ error: "Failed to fetch expenses" }, { status: 500 });
  }
}

// POST /api/expenses — create a new expense
export async function POST(req: NextRequest) {
  let user;
  try {
    user = await requireAuth();
    requirePermission(user.role, "financeOps");
  } catch (e) { return e as Response; }

  const ip = getClientIp(req);
  const rl = rateLimitApiWrite(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  let body: unknown;
  try { body = await req.json(); } catch { return validationError("Invalid JSON body"); }

  const result = validate(ExpenseSchema, body);
  if (!result.success) return validationError(result.error);
  const e = result.data;

  try {
    const expense = await db.expense.create({
      data: {
        date: e.date ? new Date(e.date as string) : new Date(),
        category: e.category || "other",
        description: e.description,
        amount: Number(e.amount) || 0,
        paymentMode: e.paymentMode || "cash",
        reference: e.reference || "",
        notes: e.notes || "",
        createdById: user.uid,
      },
      include: { user: { select: { fullName: true, username: true } } },
    });

    await auditLog({
      userId: user.uid,
      user: user.username,
      action: "CREATE",
      module: "accounts",
      details: `Expense recorded: ${expense.description} — GHS ${expense.amount.toFixed(2)} (${expense.category})`,
      severity: "info",
      ipAddress: ip,
      userAgent: req.headers.get("user-agent") || "",
    });

    return NextResponse.json({ success: true, expense });
  } catch (err) {
    console.error("POST /api/expenses error:", err);
    return NextResponse.json({ error: "Failed to create expense" }, { status: 500 });
  }
}
