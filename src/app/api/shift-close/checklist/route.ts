import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { rateLimitApiWrite, rateLimitResponse, getClientIp } from "@/lib/rate-limit";
import { auditLog } from "@/lib/audit";

// POST /api/shift-close/checklist
// Records a completed end-of-day checklist with all steps verified.
// Body: { steps: [{ id, label, completed, value? }], notes?: string, cashCounted?: number }
export async function POST(req: NextRequest) {
  let user;
  try { user = await requireAuth(); } catch (e) { return e as Response; }
  const ip = getClientIp(req);
  const rl = rateLimitApiWrite(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  try {
    const { steps, notes, cashCounted } = body;

    // Get today's sales for the checklist summary
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const todaySales = await db.sale.findMany({
      where: { createdAt: { gte: todayStart, lte: todayEnd }, status: "completed" },
      include: { items: true },
    });

    const totalRevenue = todaySales.reduce((s, x) => s + Number(x.total), 0);
    const totalTaxCollected = todaySales.reduce((s, x) => s + Number(x.taxAmount), 0);
    const txnCount = todaySales.length;

    // Calculate variance
    const variance = (cashCounted || 0) - totalRevenue;

    // Save checklist as a system setting
    const checklistRecord = {
      date: new Date().toISOString(),
      cashier: user.username,
      steps: steps || [],
      notes: notes || "",
      cashCounted: cashCounted || 0,
      systemTotal: totalRevenue,
      variance,
      txnCount,
      taxCollected: totalTaxCollected,
    };

    await db.systemSetting.upsert({
      where: { key: `shift-close-${new Date().toISOString().split('T')[0]}` },
      update: { value: JSON.stringify(checklistRecord), updatedBy: user.uid },
      create: { key: `shift-close-${new Date().toISOString().split('T')[0]}`, value: JSON.stringify(checklistRecord), updatedBy: user.uid },
    });

    await auditLog({
      userId: user.uid,
      user: user.username,
      action: "SHIFT_CLOSE_CHECKLIST",
      module: "operations",
      details: `End-of-day checklist completed. Cash counted: ${cashCounted}, System total: ${totalRevenue}, Variance: ${variance}`,
      severity: "info",
      ipAddress: ip,
      userAgent: req.headers.get("user-agent") || "",
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      summary: {
        totalRevenue,
        taxCollected: totalTaxCollected,
        txnCount,
        cashCounted: cashCounted || 0,
        variance,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed to save checklist" }, { status: 500 });
  }
}

// GET /api/shift-close/checklist — get today's checklist if it exists
export async function GET(req: NextRequest) {
  try { await requireAuth(); } catch (e) { return e as Response; }
  const ip = getClientIp(req);
  const rl = rateLimitApiWrite(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  try {
    const today = new Date().toISOString().split('T')[0];
    const record = await db.systemSetting.findUnique({ where: { key: `shift-close-${today}` } });

    // Get today's sales summary for the checklist
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const todaySales = await db.sale.findMany({
      where: { createdAt: { gte: todayStart, lte: todayEnd }, status: "completed" },
      include: { items: true },
    });

    const totalRevenue = todaySales.reduce((s, x) => s + Number(x.total), 0);
    const totalTaxCollected = todaySales.reduce((s, x) => s + Number(x.taxAmount), 0);
    const txnCount = todaySales.length;

    // Payment method breakdown
    const paymentBreakdown = todaySales.reduce((acc, s) => {
      const m = s.paymentMethod || "cash";
      acc[m] = (acc[m] || 0) + Number(s.total);
      return acc;
    }, {} as Record<string, number>);

    // Low stock count
    const lowStockCount = await db.product.count({
      where: { quantity: { lte: db.product.fields.reorderLevel }, active: true },
    });

    return NextResponse.json({
      checklist: record ? JSON.parse(record.value) : null,
      summary: {
        totalRevenue,
        taxCollected: totalTaxCollected,
        txnCount,
        paymentBreakdown,
        lowStockCount,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed to fetch checklist" }, { status: 500 });
  }
}
