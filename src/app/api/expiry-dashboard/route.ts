import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { rateLimitApiRead, rateLimitResponse, getClientIp } from "@/lib/rate-limit";

// GET /api/expiry-dashboard — products grouped by expiry urgency
export async function GET(req: NextRequest) {
  try { await requireAuth(); } catch (e) { return e as Response; }
  const ip = getClientIp(req);
  const rl = rateLimitApiRead(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  try {
    const now = new Date();
    const threeDays = new Date(now.getTime() + 3 * 86400000);
    const sevenDays = new Date(now.getTime() + 7 * 86400000);
    const thirtyDays = new Date(now.getTime() + 30 * 86400000);

    const [expired, expiring3, expiring7, expiring30, fresh, noExpiry] = await Promise.all([
      // 🔴 Already expired
      db.product.findMany({
        where: { expiryDate: { lt: now }, active: true },
        select: { id: true, name: true, emoji: true, sku: true, quantity: true, expiryDate: true, price: true, batchNumber: true },
        orderBy: { expiryDate: 'asc' },
      }),
      // 🟠 Expiring in 3 days
      db.product.findMany({
        where: { expiryDate: { gte: now, lte: threeDays }, active: true },
        select: { id: true, name: true, emoji: true, sku: true, quantity: true, expiryDate: true, price: true, batchNumber: true },
        orderBy: { expiryDate: 'asc' },
      }),
      // 🟡 Expiring in 7 days
      db.product.findMany({
        where: { expiryDate: { gt: threeDays, lte: sevenDays }, active: true },
        select: { id: true, name: true, emoji: true, sku: true, quantity: true, expiryDate: true, price: true, batchNumber: true },
        orderBy: { expiryDate: 'asc' },
      }),
      // 🟢 Expiring in 30 days
      db.product.findMany({
        where: { expiryDate: { gt: sevenDays, lte: thirtyDays }, active: true },
        select: { id: true, name: true, emoji: true, sku: true, quantity: true, expiryDate: true, price: true, batchNumber: true },
        orderBy: { expiryDate: 'asc' },
      }),
      // Fresh (more than 30 days)
      db.product.count({
        where: { expiryDate: { gt: thirtyDays }, active: true },
      }),
      // No expiry date
      db.product.count({
        where: { expiryDate: null, active: true },
      }),
    ]);

    // Calculate potential loss from expired products
    const expiredLoss = expired.reduce((s, p) => s + p.price * p.quantity, 0);
    const expiring3Loss = expiring3.reduce((s, p) => s + p.price * p.quantity, 0);

    return NextResponse.json({
      expired: { products: expired, count: expired.length, potentialLoss: expiredLoss, color: '#dc2626', label: 'Expired' },
      expiring3: { products: expiring3, count: expiring3.length, potentialLoss: expiring3Loss, color: '#ea580c', label: 'Expiring in 3 days' },
      expiring7: { products: expiring7, count: expiring7.length, color: '#ca8a04', label: 'Expiring in 7 days' },
      expiring30: { products: expiring30, count: expiring30.length, color: '#16a34a', label: 'Expiring in 30 days' },
      fresh: { count: fresh, color: '#22c55e', label: 'Fresh (>30 days)' },
      noExpiry: { count: noExpiry, color: '#94a3b8', label: 'No expiry date' },
      summary: {
        totalAtRisk: expired.length + expiring3.length + expiring7.length,
        totalLoss: expiredLoss + expiring3Loss,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed" }, { status: 500 });
  }
}
