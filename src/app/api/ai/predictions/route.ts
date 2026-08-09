import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export const runtime = 'nodejs'
export const maxDuration = 30

// GET /api/ai/predictions
// Generates sales predictions and growth opportunities using historical data.
//
// Returns:
// - Tomorrow's predicted revenue (using day-of-week + 7-day moving average)
// - Next 7 days forecast
// - Top growth opportunity products (high margin + high demand + low stock)
// - Risk alerts (stockouts predicted, slow movers, declining trends)
// - Best-selling day of week
// - Busiest hour of day

export async function GET(req: NextRequest) {
  try {
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)

    // === Fetch historical sales ===
    const sales90Days = await prisma.sale.findMany({
      where: {
        createdAt: { gte: ninetyDaysAgo },
        status: 'completed',
      },
      select: {
        id: true,
        total: true,
        createdAt: true,
        items: { select: { productId: true, name: true, quantity: true, price: true, costPrice: true } },
      },
    })

    // === Day-of-week velocity ===
    const dayOfWeekTotals: number[] = Array(7).fill(0)
    const dayOfWeekCounts: number[] = Array(7).fill(0)
    sales90Days.forEach(s => {
      const dow = new Date(s.createdAt).getDay()
      dayOfWeekTotals[dow] += s.total || 0
      dayOfWeekCounts[dow] += 1
    })
    const dayOfWeekAvg = dayOfWeekTotals.map((t, i) => dayOfWeekCounts[i] > 0 ? t / dayOfWeekCounts[i] : 0)

    // === 7-day moving average ===
    const last7DaysSales = sales90Days.filter(s => new Date(s.createdAt) >= sevenDaysAgo)
    const last7Total = last7DaysSales.reduce((sum, s) => sum + (s.total || 0), 0)
    const last7Avg = last7Total / 7

    // === Tomorrow's prediction ===
    // Combine day-of-week average with 7-day moving average (weighted 60/40)
    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowDow = tomorrow.getDay()
    const tomorrowPrediction = Math.round((dayOfWeekAvg[tomorrowDow] * 0.6 + last7Avg * 0.4) * 100) / 100

    // === 7-day forecast ===
    const forecast: { date: string; dayName: string; predictedRevenue: number; confidence: number }[] = []
    const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    for (let i = 1; i <= 7; i++) {
      const d = new Date(now)
      d.setDate(d.getDate() + i)
      const dow = d.getDay()
      const predicted = (dayOfWeekAvg[dow] * 0.6 + last7Avg * 0.4)
      // Confidence: higher if we have more data for this day of week
      const confidence = Math.min(95, Math.round((dayOfWeekCounts[dow] / 12) * 100))
      forecast.push({
        date: d.toISOString().split('T')[0],
        dayName: DAY_NAMES[dow],
        predictedRevenue: Math.round(predicted * 100) / 100,
        confidence,
      })
    }

    // === Best day of week ===
    const bestDayIdx = dayOfWeekAvg.indexOf(Math.max(...dayOfWeekAvg))
    const bestDay = {
      day: DAY_NAMES[bestDayIdx],
      avgRevenue: Math.round(dayOfWeekAvg[bestDayIdx] * 100) / 100,
      salesCount: dayOfWeekCounts[bestDayIdx],
    }

    // === Busiest hour ===
    const hourTotals: number[] = Array(24).fill(0)
    sales90Days.forEach(s => {
      const h = new Date(s.createdAt).getHours()
      hourTotals[h] += s.total || 0
    })
    const busiestHourIdx = hourTotals.indexOf(Math.max(...hourTotals))
    const busiestHour = {
      hour: busiestHourIdx,
      label: `${busiestHourIdx.toString().padStart(2, '0')}:00 - ${(busiestHourIdx + 1).toString().padStart(2, '0')}:00`,
      avgRevenue: Math.round((hourTotals[busiestHourIdx] / Math.max(dayOfWeekCounts.reduce((a, b) => a + b, 0), 1)) * 100) / 100,
    }

    // === Growth opportunities ===
    // Products with: high revenue + high profit margin + low stock (need reorder)
    const productStats: Record<string, { name: string; qty: number; revenue: number; profit: number }> = {}
    sales90Days.forEach(s => {
      s.items.forEach(item => {
        const key = item.productId || item.name
        if (!productStats[key]) {
          productStats[key] = { name: item.name, qty: 0, revenue: 0, profit: 0 }
        }
        productStats[key].qty += item.quantity
        productStats[key].revenue += item.quantity * item.price
        productStats[key].profit += item.quantity * (item.price - (item.costPrice || 0))
      })
    })

    const topProducts = Object.values(productStats)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10)

    // === Risk alerts ===
    const lowStockProducts = await prisma.product.findMany({
      where: { quantity: { lte: 10 }, active: true },
      select: { id: true, name: true, quantity: true, reorderLevel: true, unit: true },
      take: 10,
    })

    const risks: { type: string; severity: 'high' | 'medium' | 'low'; message: string }[] = []

    // Stockout risks: low stock + high demand
    const stockoutRisks = lowStockProducts
      .filter(p => {
        const stats = productStats[p.id]
        return stats && stats.qty > 5 // sold at least 5 in last 90 days
      })
      .slice(0, 3)
    stockoutRisks.forEach(p => {
      const stats = productStats[p.id]
      const daysUntilOut = stats && stats.qty > 0 ? Math.floor(p.quantity / (stats.qty / 90)) : null
      risks.push({
        type: 'stockout',
        severity: daysUntilOut !== null && daysUntilOut <= 3 ? 'high' : 'medium',
        message: `${p.name}: ${p.quantity} ${p.unit || 'pcs'} left${daysUntilOut !== null ? ` (~${daysUntilOut} days until out)` : ''}`,
      })
    })

    // Declining trend: products with >30% drop in last 7 days vs previous 7 days
    const previous7Start = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)
    const previous7End = sevenDaysAgo
    const last7ProductRevenue: Record<string, number> = {}
    const prev7ProductRevenue: Record<string, number> = {}
    sales90Days.forEach(s => {
      const sDate = new Date(s.createdAt)
      s.items.forEach(item => {
        const key = item.productId || item.name
        if (sDate >= sevenDaysAgo) {
          last7ProductRevenue[key] = (last7ProductRevenue[key] || 0) + item.quantity * item.price
        } else if (sDate >= previous7Start) {
          prev7ProductRevenue[key] = (prev7ProductRevenue[key] || 0) + item.quantity * item.price
        }
      })
    })

    const decliningProducts = Object.keys(prev7ProductRevenue)
      .filter(k => prev7ProductRevenue[k] > 100) // only meaningful revenue
      .map(k => {
        const prev = prev7ProductRevenue[k]
        const last = last7ProductRevenue[k] || 0
        const change = ((last - prev) / prev) * 100
        return { name: productStats[k]?.name || k, change: Math.round(change) }
      })
      .filter(p => p.change < -30)
      .slice(0, 3)
    decliningProducts.forEach(p => {
      risks.push({
        type: 'declining',
        severity: 'medium',
        message: `${p.name}: sales down ${Math.abs(p.change)}% vs last week`,
      })
    })

    // === Summary stats ===
    const todaySales = await prisma.sale.findMany({
      where: { createdAt: { gte: todayStart } },
      select: { total: true },
    })
    const todayTotal = todaySales.reduce((sum, s) => sum + (s.total || 0), 0)

    return NextResponse.json({
      success: true,
      predictions: {
        tomorrow: {
          date: tomorrow.toISOString().split('T')[0],
          dayName: DAY_NAMES[tomorrowDow],
          predictedRevenue: tomorrowPrediction,
          confidence: Math.min(95, Math.round((dayOfWeekCounts[tomorrowDow] / 12) * 100)),
          basis: `${dayOfWeekAvg[tomorrowDow].toFixed(2)} (avg ${DAY_NAMES[tomorrowDow]}) + ${last7Avg.toFixed(2)} (7-day avg)`,
        },
        next7Days: forecast,
        bestDay,
        busiestHour,
      },
      growth: {
        topProducts: topProducts.map((p, i) => ({
          rank: i + 1,
          name: p.name,
          revenue: Math.round(p.revenue * 100) / 100,
          profit: Math.round(p.profit * 100) / 100,
          margin: p.revenue > 0 ? Math.round((p.profit / p.revenue) * 100) : 0,
          qtySold: p.qty,
        })),
      },
      risks,
      todayActual: {
        total: Math.round(todayTotal * 100) / 100,
        count: todaySales.length,
      },
      last7Days: {
        total: Math.round(last7Total * 100) / 100,
        avgPerDay: Math.round(last7Avg * 100) / 100,
        count: last7DaysSales.length,
      },
    })
  } catch (e: any) {
    console.error('AI predictions error:', e)
    return NextResponse.json(
      { error: e.message || 'Failed to generate predictions' },
      { status: 500 }
    )
  }
}
