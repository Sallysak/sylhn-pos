import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requirePermission } from "@/lib/auth";
import { rateLimitApiRead, rateLimitApiWrite, rateLimitResponse, getClientIp } from "@/lib/rate-limit";

// GET /api/sales-target — get today's target and progress
export async function GET(req: NextRequest) {
  try { await requireAuth(); } catch (e) { return e as Response; }
  const ip = getClientIp(req);
  const rl = rateLimitApiRead(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  try {
    // Get target from settings
    const targetSetting = await db.systemSetting.findUnique({ where: { key: "sales.dailyTarget" } });
    const monthlyTargetSetting = await db.systemSetting.findUnique({ where: { key: "sales.monthlyTarget" } });

    const dailyTarget = parseFloat(targetSetting?.value || "0");
    const monthlyTarget = parseFloat(monthlyTargetSetting?.value || "0");

    // Get today's sales
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const todaySales = await db.sale.findMany({
      where: { createdAt: { gte: todayStart, lte: todayEnd }, status: "completed" },
    });
    const todayRevenue = todaySales.reduce((s, x) => s + Number(x.total), 0);
    const todayTxnCount = todaySales.length;

    // Get this month's sales
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const monthSales = await db.sale.findMany({
      where: { createdAt: { gte: monthStart }, status: "completed" },
    });
    const monthRevenue = monthSales.reduce((s, x) => s + Number(x.total), 0);

    // Get yesterday's revenue for comparison
    const yesterdayStart = new Date();
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    yesterdayStart.setHours(0, 0, 0, 0);
    const yesterdayEnd = new Date(yesterdayStart);
    yesterdayEnd.setHours(23, 59, 59, 999);

    const yesterdaySales = await db.sale.findMany({
      where: { createdAt: { gte: yesterdayStart, lte: yesterdayEnd }, status: "completed" },
    });
    const yesterdayRevenue = yesterdaySales.reduce((s, x) => s + Number(x.total), 0);

    const dailyProgress = dailyTarget > 0 ? (todayRevenue / dailyTarget) * 100 : 0;
    const monthlyProgress = monthlyTarget > 0 ? (monthRevenue / monthlyTarget) * 100 : 0;
    const trendVsYesterday = yesterdayRevenue > 0 ? ((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100 : 0;

    return NextResponse.json({
      dailyTarget,
      monthlyTarget,
      todayRevenue,
      todayTxnCount,
      monthRevenue,
      yesterdayRevenue,
      dailyProgress: Math.min(dailyProgress, 100),
      monthlyProgress: Math.min(monthlyProgress, 100),
      trendVsYesterday,
      remaining: Math.max(0, dailyTarget - todayRevenue),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed" }, { status: 500 });
  }
}

// POST /api/sales-target — set targets (admin/manager only)
export async function POST(req: NextRequest) {
  let user;
  try { user = await requireAuth(); requirePermission(user.role, "maintenance"); } catch (e) { return e as Response; }
  const ip = getClientIp(req);
  const rl = rateLimitApiWrite(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  try {
    const { dailyTarget, monthlyTarget } = body;

    if (dailyTarget !== undefined) {
      await db.systemSetting.upsert({
        where: { key: "sales.dailyTarget" },
        update: { value: String(dailyTarget), updatedBy: user.uid },
        create: { key: "sales.dailyTarget", value: String(dailyTarget), updatedBy: user.uid },
      });
    }
    if (monthlyTarget !== undefined) {
      await db.systemSetting.upsert({
        where: { key: "sales.monthlyTarget" },
        update: { value: String(monthlyTarget), updatedBy: user.uid },
        create: { key: "sales.monthlyTarget", value: String(monthlyTarget), updatedBy: user.uid },
      });
    }

    return NextResponse.json({ success: true, message: "Sales targets updated" });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed" }, { status: 500 });
  }
}
