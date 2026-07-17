import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requirePermission } from "@/lib/auth";
import { rateLimitApiRead, rateLimitApiWrite, rateLimitResponse, getClientIp } from "@/lib/rate-limit";
import { auditLog } from "@/lib/audit";
import { db } from "@/lib/db";
import { getExchangeRates, clearRatesCache, SUPPORTED_CURRENCIES, DEFAULT_RATES } from "@/lib/currency";

// GET /api/currency — list supported currencies + current exchange rates
export async function GET(req: NextRequest) {
  try { await requireAuth(); } catch (e) { return e as Response; }

  const ip = getClientIp(req);
  const rl = rateLimitApiRead(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  const rates = await getExchangeRates();
  return NextResponse.json({
    supported: SUPPORTED_CURRENCIES,
    rates,
    base: rates.base,
  });
}

// PUT /api/currency — update exchange rates (admin only)
export async function PUT(req: NextRequest) {
  let user;
  try { user = await requireAuth(); requirePermission(user.role, "maintenance"); } catch (e) { return e as Response; }

  const ip = getClientIp(req);
  const rl = rateLimitApiWrite(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  if (!body.rates || typeof body.rates !== "object") {
    return NextResponse.json({ error: "Body must contain a 'rates' object" }, { status: 400 });
  }

  // Validate all currencies are supported
  for (const code of Object.keys(body.rates)) {
    if (!SUPPORTED_CURRENCIES.find(c => c.code === code)) {
      return NextResponse.json({ error: `Unsupported currency: ${code}` }, { status: 400 });
    }
  }

  const newRates = {
    base: body.base || DEFAULT_RATES.base,
    rates: { ...DEFAULT_RATES.rates, ...body.rates },
    updatedAt: new Date().toISOString(),
    updatedBy: user.uid,
  };

  try {
    await db.systemSetting.upsert({
      where: { key: "currency.rates" },
      update: { value: JSON.stringify(newRates), updatedAt: new Date() },
      create: { key: "currency.rates", value: JSON.stringify(newRates) },
    });

    clearRatesCache();

    await auditLog({
      userId: user.uid,
      user: user.username,
      action: "UPDATE",
      module: "maintenance",
      details: `Exchange rates updated: ${Object.entries(newRates.rates).map(([k, v]) => `${k}=${v}`).join(", ")}`,
      severity: "warning",
      ipAddress: ip,
      userAgent: req.headers.get("user-agent") || "",
    });

    return NextResponse.json({ success: true, rates: newRates });
  } catch (e) {
    console.error("PUT /api/currency error:", e);
    return NextResponse.json({ error: "Failed to update rates" }, { status: 500 });
  }
}
