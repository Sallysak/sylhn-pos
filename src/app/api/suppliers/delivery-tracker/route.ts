import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { rateLimitApiRead, rateLimitResponse, getClientIp } from '@/lib/rate-limit'

// GET /api/suppliers/delivery-tracker
// Tracks expected delivery dates for open POs, flags late deliveries.
//
// FIX (v3.2.0):
//   - Was filtering by statuses ['draft', 'sent', 'partial'] which DON'T EXIST
//     in the Purchase model. The actual statuses are: draft | pending_approval |
//     approved | ordered | received | cancelled. So the query always returned
//     zero rows.
//   - Was ignoring Purchase.expectedAt (the committed delivery date) and
//     instead using orderDate + 7 days. Now uses expectedAt if set, falls
//     back to orderDate + 7 days.
//   - Was missing rate limiting (other supplier routes have it).
//   - Was missing rateLimitApiRead check.

export async function GET(req: NextRequest) {
  try { await requireAuth(); } catch (e: any) { return e as Response; }

  const ip = getClientIp(req);
  const rl = rateLimitApiRead(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  const now = new Date()

  // ===== FIX: Use ACTUAL purchase statuses =====
  // Open POs = anything that's not yet received or cancelled.
  // Includes: draft, pending_approval, approved, ordered
  const purchases = await db.purchase.findMany({
    where: {
      type: 'order',
      status: { in: ['draft', 'pending_approval', 'approved', 'ordered'] },
    },
    include: {
      supplier: { select: { name: true, code: true, phone: true, email: true } },
      _count: { select: { items: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  const tracked = purchases.map(p => {
    const orderDate = new Date(p.createdAt)

    // ===== FIX: Use expectedAt if set, otherwise estimate from order date + 7 days =====
    const expectedDelivery = p.expectedAt ? new Date(p.expectedAt) : new Date(orderDate.getTime() + 7 * 86400000)
    const daysLate = Math.floor((now.getTime() - expectedDelivery.getTime()) / 86400000)
    const daysUntilDelivery = Math.floor((expectedDelivery.getTime() - now.getTime()) / 86400000)

    const status = daysLate > 0 ? 'late' : daysUntilDelivery <= 2 ? 'arriving_soon' : 'on_track'

    return {
      id: p.id,
      refNo: p.refNo,
      supplierName: p.supplier?.name || p.supplierName,
      supplierPhone: p.supplier?.phone,
      supplierEmail: p.supplier?.email,
      orderDate: p.createdAt.toISOString().split('T')[0],
      expectedDelivery: expectedDelivery.toISOString().split('T')[0],
      daysLate,
      daysUntilDelivery,
      status,
      total: p.total,
      itemCount: (p as any)._count?.items || 0,
      purchaseStatus: p.status, // expose the actual DB status
    }
  })

  const late = tracked.filter(t => t.status === 'late').length
  const arrivingSoon = tracked.filter(t => t.status === 'arriving_soon').length

  return NextResponse.json({ success: true, deliveries: tracked, lateCount: late, arrivingSoonCount: arrivingSoon })
}
