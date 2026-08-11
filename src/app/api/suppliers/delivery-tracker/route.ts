import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'

// GET /api/suppliers/delivery-tracker
// Tracks expected delivery dates for open POs, flags late deliveries

export async function GET(req: NextRequest) {
  try { await requireAuth(); } catch (e) { return e as Response; }

  const now = new Date()
  const purchases = await db.purchase.findMany({
    where: { type: 'order', status: { in: ['draft', 'sent', 'partial'] } },
    include: { supplier: { select: { name: true, code: true, phone: true, email: true } }, _count: { select: { items: true } } },
    orderBy: { createdAt: 'desc' },
  })

  const tracked = purchases.map(p => {
    // Estimate delivery date based on order date + 7 days (default lead time)
    // If notes mention a date, use that instead
    const orderDate = new Date(p.createdAt)
    const expectedDelivery = new Date(orderDate.getTime() + 7 * 86400000)
    const daysLate = Math.floor((now.getTime() - expectedDelivery.getTime()) / 86400000)
    const daysUntilDelivery = Math.floor((expectedDelivery.getTime() - now.getTime()) / 86400000)

    const status = p.status === 'partial' ? 'partial_delivery' :
      daysLate > 0 ? 'late' : daysUntilDelivery <= 2 ? 'arriving_soon' : 'on_track'

    return {
      id: p.id, refNo: p.refNo, supplierName: p.supplier?.name || p.supplierName,
      supplierPhone: p.supplier?.phone, supplierEmail: p.supplier?.email,
      orderDate: p.createdAt.toISOString().split('T')[0],
      expectedDelivery: expectedDelivery.toISOString().split('T')[0],
      daysLate, daysUntilDelivery, status,
      total: p.total, itemCount: (p as any)._count?.items || 0,
    }
  })

  const late = tracked.filter(t => t.status === 'late').length
  const arrivingSoon = tracked.filter(t => t.status === 'arriving_soon').length

  return NextResponse.json({ success: true, deliveries: tracked, lateCount: late, arrivingSoonCount: arrivingSoon })
}
