import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { rateLimitApiRead, rateLimitResponse, getClientIp } from "@/lib/rate-limit";
import { getSupplierAging } from "@/lib/reports";

// GET /api/reports/supplier-aging — supplier balance aging report (0-30, 31-60, 60+ days)
export async function GET(req: NextRequest) {
  try { await requireAuth(); } catch (e) { return e as Response; }

  const ip = getClientIp(req);
  const rl = rateLimitApiRead(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  try {
    const suppliers = await getSupplierAging();
    const totals = suppliers.reduce((acc, s) => ({
      totalBalance: acc.totalBalance + s.totalBalance,
      current: acc.current + s.current,
      days30to60: acc.days30to60 + s.days30to60,
      days60plus: acc.days60plus + s.days60plus,
    }), { totalBalance: 0, current: 0, days30to60: 0, days60plus: 0 });

    const overCreditLimit = suppliers.filter(s => s.creditLimit > 0 && s.totalBalance > s.creditLimit);

    return NextResponse.json({
      suppliers,
      summary: {
        supplierCount: suppliers.length,
        ...totals,
        overCreditLimitCount: overCreditLimit.length,
        overCreditLimitSuppliers: overCreditLimit.map(s => ({ code: s.supplierCode, name: s.supplierName, balance: s.totalBalance, creditLimit: s.creditLimit })),
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error("GET /api/reports/supplier-aging error:", e);
    return NextResponse.json({ error: "Failed to generate supplier aging report" }, { status: 500 });
  }
}
