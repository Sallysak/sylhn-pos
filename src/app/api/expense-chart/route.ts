import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { rateLimitApiRead, rateLimitResponse, getClientIp } from "@/lib/rate-limit";

// GET /api/expense-chart?from=&to=&period=month
// Returns expenses grouped by category with totals + percentages for pie chart
export async function GET(req: NextRequest) {
  try { await requireAuth(); } catch (e) { return e as Response; }
  const ip = getClientIp(req);
  const rl = rateLimitApiRead(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  try {
    const { searchParams } = new URL(req.url);
    const period = searchParams.get("period") || "month";

    let fromDate: Date;
    if (searchParams.get("from")) {
      fromDate = new Date(searchParams.get("from")!);
    } else {
      fromDate = new Date();
      if (period === "week") fromDate.setDate(fromDate.getDate() - 7);
      else if (period === "month") fromDate.setMonth(fromDate.getMonth() - 1);
      else if (period === "quarter") fromDate.setMonth(fromDate.getMonth() - 3);
      else if (period === "year") fromDate.setFullYear(fromDate.getFullYear() - 1);
      else fromDate.setMonth(fromDate.getMonth() - 1);
    }

    const expenses = await db.expense.findMany({
      where: { date: { gte: fromDate } },
      select: { category: true, amount: true, date: true, description: true },
      orderBy: { date: 'desc' },
    });

    // Group by category
    const categoryMap: Record<string, { total: number; count: number }> = {};
    let grandTotal = 0;

    for (const exp of expenses) {
      const cat = exp.category || "other";
      if (!categoryMap[cat]) categoryMap[cat] = { total: 0, count: 0 };
      categoryMap[cat].total += Number(exp.amount);
      categoryMap[cat].count++;
      grandTotal += Number(exp.amount);
    }

    // Define category colors + labels
    const categoryConfig: Record<string, { label: string; color: string }> = {
      rent: { label: "Rent", color: "#ef4444" },
      utilities: { label: "Utilities", color: "#f97316" },
      salaries: { label: "Salaries", color: "#eab308" },
      marketing: { label: "Marketing", color: "#22c55e" },
      supplies: { label: "Supplies", color: "#3b82f6" },
      transport: { label: "Transport", color: "#8b5cf6" },
      maintenance: { label: "Maintenance", color: "#ec4899" },
      other: { label: "Other", color: "#64748b" },
    };

    // Build chart data
    const chartData = Object.entries(categoryMap)
      .map(([cat, data]) => ({
        category: cat,
        label: categoryConfig[cat]?.label || cat,
        color: categoryConfig[cat]?.color || "#64748b",
        total: data.total,
        count: data.count,
        percentage: grandTotal > 0 ? (data.total / grandTotal) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total);

    // Daily trend (last 7 days)
    const dailyTrend: { date: string; total: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date();
      dayStart.setDate(dayStart.getDate() - i);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);

      const dayTotal = expenses
        .filter(e => {
          const ed = new Date(e.date);
          return ed >= dayStart && ed <= dayEnd;
        })
        .reduce((s, e) => s + Number(e.amount), 0);

      dailyTrend.push({
        date: dayStart.toISOString().split('T')[0],
        total: dayTotal,
      });
    }

    return NextResponse.json({
      chartData,
      grandTotal,
      expenseCount: expenses.length,
      dailyTrend,
      period,
      fromDate: fromDate.toISOString(),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed" }, { status: 500 });
  }
}
