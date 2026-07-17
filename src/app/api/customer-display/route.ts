import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { rateLimitApiWrite, rateLimitResponse, getClientIp } from "@/lib/rate-limit";

// In-memory store of active customer displays (one per register/terminal).
// Keyed by registerId (defaults to "register-1" for single-terminal setups).
// In a multi-instance deployment, move this to Redis.
interface DisplayState {
  registerId: string;
  items: Array<{
    emoji: string;
    name: string;
    price: number;
    quantity: number;
    total: number;
  }>;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  customerName?: string;
  loyaltyPoints?: number;
  message?: string;
  lastUpdated: string;
  lastUpdatedBy: string;
}

const displays = new Map<string, DisplayState>();

// GET /api/customer-display?registerId=register-1
// PUBLIC endpoint (no auth) — the customer-facing device polls this.
// We add this path to the public list in src/middleware.ts.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const registerId = searchParams.get("registerId") || "register-1";
  const state = displays.get(registerId);
  if (!state) {
    return NextResponse.json({
      registerId,
      items: [],
      subtotal: 0,
      discount: 0,
      tax: 0,
      total: 0,
      message: "Welcome to SYLHN POS",
      lastUpdated: null,
    });
  }
  return NextResponse.json(state);
}

// POST /api/customer-display — update the display state (cashier side, auth required)
export async function POST(req: NextRequest) {
  let user;
  try { user = await requireAuth(); } catch (e) { return e as Response; }

  const ip = getClientIp(req);
  const rl = rateLimitApiWrite(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const registerId = body.registerId || "register-1";

  const state: DisplayState = {
    registerId,
    items: (body.items || []).slice(0, 50).map((i: any) => ({
      emoji: String(i.emoji || "📦").slice(0, 8),
      name: String(i.name || "").slice(0, 80),
      price: Number(i.price) || 0,
      quantity: Number(i.quantity) || 1,
      total: Number(i.total) || 0,
    })),
    subtotal: Number(body.subtotal) || 0,
    discount: Number(body.discount) || 0,
    tax: Number(body.tax) || 0,
    total: Number(body.total) || 0,
    customerName: body.customerName ? String(body.customerName).slice(0, 100) : undefined,
    loyaltyPoints: body.loyaltyPoints !== undefined ? Number(body.loyaltyPoints) : undefined,
    message: body.message ? String(body.message).slice(0, 200) : undefined,
    lastUpdated: new Date().toISOString(),
    lastUpdatedBy: user.username,
  };

  displays.set(registerId, state);

  return NextResponse.json({ success: true, state });
}

// DELETE /api/customer-display?registerId=register-1 — clear the display
export async function DELETE(req: NextRequest) {
  try { await requireAuth(); } catch (e) { return e as Response; }
  const { searchParams } = new URL(req.url);
  const registerId = searchParams.get("registerId") || "register-1";
  displays.delete(registerId);
  return NextResponse.json({ success: true });
}
