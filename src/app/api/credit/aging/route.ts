import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'

// GET /api/credit/aging
// Credit aging report: 0-30, 31-60, 61-90, 90+ days outstanding
// Also calculates auto late fees based on configurable rate

export async function GET(req: NextRequest) {
  try { await requireAuth(); } catch (e: any) { return e as Response; }

  const now = new Date()
  const buckets = { current: 0, days30: 0, days60: 0, days90: 0, over90: 0 }
  const lateFeeRate = 0.02 // 2% per month late fee

  // Get all unsettled credit sales
  const creditSales = await db.sale.findMany({
    where: { isCreditSale: true, creditAmountDue: { gt: 0 } },
    include: { customer: { select: { id: true, name: true, phone: true, creditLimit: true } } },
    orderBy: { createdAt: 'desc' },
  })

  const customers: Record<string, {
    name: string; phone: string; creditLimit: number;
    total: number; current: number; d30: number; d60: number; d90: number; over90: number; lateFee: number;
    sales: any[]
  }> = {}

  for (const s of creditSales) {
    const daysOutstanding = Math.floor((now.getTime() - new Date(s.createdAt).getTime()) / (1000 * 60 * 60 * 24))
    const amount = s.creditAmountDue
    const custKey = s.customerId || 'walk-in'
    const custName = s.customer?.name || s.customerName || 'Walk-in'

    if (!customers[custKey]) {
      customers[custKey] = { name: custName, phone: s.customer?.phone || '', creditLimit: s.customer?.creditLimit || 0, total: 0, current: 0, d30: 0, d60: 0, d90: 0, over90: 0, lateFee: 0, sales: [] }
    }

    customers[custKey].total += amount
    customers[custKey].sales.push({ id: s.id, invoice: s.invoiceNumber, date: s.createdAt, amount, daysOutstanding })

    if (daysOutstanding <= 30) { customers[custKey].current += amount; buckets.current += amount }
    else if (daysOutstanding <= 60) { customers[custKey].d30 += amount; buckets.days30 += amount; customers[custKey].lateFee += amount * lateFeeRate }
    else if (daysOutstanding <= 90) { customers[custKey].d60 += amount; buckets.days60 += amount; customers[custKey].lateFee += amount * lateFeeRate * 2 }
    else if (daysOutstanding <= 120) { customers[custKey].d90 += amount; buckets.days90 += amount; customers[custKey].lateFee += amount * lateFeeRate * 3 }
    else { customers[custKey].over90 += amount; buckets.over90 += amount; customers[custKey].lateFee += amount * lateFeeRate * 4 }
  }

  const customerList = Object.values(customers).sort((a, b) => b.total - a.total)
  const totalOutstanding = customerList.reduce((s, c) => s + c.total, 0)
  const totalLateFees = customerList.reduce((s, c) => s + c.lateFee, 0)
  const overLimitCount = customerList.filter(c => c.creditLimit > 0 && c.total > c.creditLimit).length

  return NextResponse.json({
    success: true,
    summary: { totalOutstanding, totalLateFees, customerCount: customerList.length, overLimitCount, ...buckets },
    customers: customerList,
  })
}
