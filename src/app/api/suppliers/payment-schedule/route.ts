import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'

// GET /api/suppliers/payment-schedule
// Shows upcoming supplier payments based on trading terms (Net 15/30/60) and balance

export async function GET(req: NextRequest) {
  try { await requireAuth(); } catch (e) { return e as Response; }

  const suppliers = await db.supplier.findMany({
    where: { active: true, balance: { gt: 0 } },
    orderBy: { balance: 'desc' },
  })

  const now = new Date()
  const schedule = suppliers.map(s => {
    // Parse trading terms to get due days
    const terms = s.tradingTerms || 'Net 30'
    let dueDays = 30
    if (terms === 'COD') dueDays = 0
    else if (terms === 'Prepaid') dueDays = -1
    else if (terms.startsWith('Net ')) dueDays = parseInt(terms.split(' ')[1]) || 30

    // Estimate due date from last purchase
    const dueDate = dueDays > 0 ? new Date(now.getTime() + dueDays * 86400000) : null
    const urgency = dueDays === 0 ? 'urgent' : dueDays <= 15 ? 'soon' : 'normal'

    return {
      id: s.id, name: s.name, code: s.code, phone: s.phone,
      balance: s.balance, tradingTerms: terms, dueDays,
      dueDate: dueDate?.toISOString().split('T')[0] || null,
      urgency,
      email: s.email,
    }
  })

  const totalPayable = suppliers.reduce((sum, s) => sum + s.balance, 0)
  const urgent = schedule.filter(s => s.urgency === 'urgent').length
  const soon = schedule.filter(s => s.urgency === 'soon').length

  return NextResponse.json({ success: true, schedule, totalPayable, urgentCount: urgent, soonCount: soon })
}
