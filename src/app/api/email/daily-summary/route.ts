import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import nodemailer from 'nodemailer'

const prisma = new PrismaClient()

// GET /api/email/daily-summary?secret=CRON_SECRET
// OR POST /api/email/daily-summary (manual trigger from UI)
//
// Sends the store owner a beautiful end-of-day sales summary email:
// - Today's total revenue + transaction count
// - Top 5 selling products
// - Payment method breakdown (cash vs mobile money)
// - Low-stock alerts
// - Comparison vs yesterday and vs 7-day average
//
// Recommended cron: daily at 9 PM Ghana time (21:00)

export const runtime = 'nodejs'
export const maxDuration = 30

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return runSummary()
}

export async function POST(req: NextRequest) {
  return runSummary()
}

async function runSummary() {
  try {
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000)
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    // === Get SMTP settings ===
    const settings = await prisma.systemSetting.findMany({
      where: { key: { in: ['smtp.host', 'smtp.port', 'smtp.user', 'smtp.password', 'smtp.from', 'companyName'] } },
    })
    const cfg: Record<string, string> = {}
    settings.forEach(s => (cfg[s.key] = s.value))

    if (!cfg['smtp.host'] || !cfg['smtp.user'] || !cfg['smtp.password']) {
      return NextResponse.json(
        { error: 'SMTP not configured. Go to Email System → Settings.' },
        { status: 400 }
      )
    }

    // === Today's sales ===
    const todaySales = await prisma.sale.findMany({
      where: { createdAt: { gte: todayStart }, status: 'completed' },
      include: { items: true },
    })
    const todayTotal = todaySales.reduce((s, x) => s + (x.total || 0), 0)
    const todayItems = todaySales.reduce((s, x) => s + x.items.length, 0)

    // === Yesterday's sales (for comparison) ===
    const yesterdaySales = await prisma.sale.findMany({
      where: { createdAt: { gte: yesterdayStart, lt: todayStart }, status: 'completed' },
    })
    const yesterdayTotal = yesterdaySales.reduce((s, x) => s + (x.total || 0), 0)
    const dayOverDay = yesterdayTotal > 0 ? ((todayTotal - yesterdayTotal) / yesterdayTotal * 100) : 0

    // === 7-day average ===
    const last7Sales = await prisma.sale.findMany({
      where: { createdAt: { gte: sevenDaysAgo }, status: 'completed' },
    })
    const last7Total = last7Sales.reduce((s, x) => s + (x.total || 0), 0)
    const avg7 = last7Total / 7
    const vs7Avg = avg7 > 0 ? ((todayTotal - avg7) / avg7 * 100) : 0

    // === Payment method breakdown ===
    const paymentBreakdown: Record<string, { count: number; total: number }> = {}
    todaySales.forEach(s => {
      const m = s.paymentMethod || 'cash'
      if (!paymentBreakdown[m]) paymentBreakdown[m] = { count: 0, total: 0 }
      paymentBreakdown[m].count++
      paymentBreakdown[m].total += s.total || 0
    })

    // === Top 5 products today ===
    const productStats: Record<string, { name: string; qty: number; revenue: number }> = {}
    todaySales.forEach(s => {
      s.items.forEach((item: any) => {
        const key = item.productId || item.name
        if (!productStats[key]) productStats[key] = { name: item.name, qty: 0, revenue: 0 }
        productStats[key].qty += item.quantity
        productStats[key].revenue += item.quantity * item.price
      })
    })
    const top5 = Object.values(productStats).sort((a, b) => b.revenue - a.revenue).slice(0, 5)

    // === Low stock ===
    const lowStock = await prisma.product.findMany({
      where: { active: true, quantity: { lte: 10 } },
      orderBy: { quantity: 'asc' },
      take: 5,
    })

    // === Build HTML email ===
    const companyName = cfg['companyName'] || 'SYLHN POS'
    const recipient = cfg['smtp.from'] || cfg['smtp.user']

    const dayColor = dayOverDay >= 0 ? '#059669' : '#dc2626'
    const dayArrow = dayOverDay >= 0 ? '↑' : '↓'
    const avgColor = vs7Avg >= 0 ? '#059669' : '#dc2626'
    const avgArrow = vs7Avg >= 0 ? '↑' : '↓'

    const top5Html = top5.length > 0
      ? top5.map((p, i) => `<tr><td style="padding:6px 12px;border-bottom:1px solid #eee;">${i + 1}</td><td style="padding:6px 12px;border-bottom:1px solid #eee;font-weight:600;">${p.name}</td><td style="padding:6px 12px;border-bottom:1px solid #eee;text-align:center;">${p.qty}</td><td style="padding:6px 12px;border-bottom:1px solid #eee;text-align:right;font-weight:bold;">GHS ${p.revenue.toFixed(2)}</td></tr>`).join('')
      : '<tr><td colspan="4" style="padding:20px;text-align:center;color:#999;">No sales today</td></tr>'

    const paymentHtml = Object.entries(paymentBreakdown).map(([m, d]) => {
      const label = m.charAt(0).toUpperCase() + m.slice(1)
      return `<tr><td style="padding:6px 12px;border-bottom:1px solid #eee;">${label}</td><td style="padding:6px 12px;border-bottom:1px solid #eee;text-align:center;">${d.count}</td><td style="padding:6px 12px;border-bottom:1px solid #eee;text-align:right;font-weight:bold;">GHS ${d.total.toFixed(2)}</td></tr>`
    }).join('') || '<tr><td colspan="3" style="padding:20px;text-align:center;color:#999;">No payments</td></tr>'

    const lowStockHtml = lowStock.length > 0
      ? lowStock.map(p => `<span style="display:inline-block;background:#fef9c3;color:#ca8a04;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:bold;margin:2px;">${p.name}: ${p.quantity}</span>`).join('')
      : '<span style="color:#059669;font-size:12px;">✓ All products well-stocked</span>'

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:700px;margin:0 auto;padding:20px;">
        <div style="background:linear-gradient(135deg,#059669,#0d9488);color:white;padding:20px;border-radius:12px 12px 0 0;">
          <h1 style="margin:0;font-size:22px;">📊 Daily Sales Summary</h1>
          <p style="margin:5px 0 0;opacity:0.9;font-size:13px;">${companyName} — ${now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>

        <div style="background:#f9fafb;padding:20px;border-left:4px solid #059669;border-right:1px solid #eee;border-bottom:1px solid #eee;">
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#6b7280;font-weight:bold;">Today's Revenue</div>
          <div style="font-size:36px;font-weight:bold;color:#059669;margin:5px 0;">GHS ${todayTotal.toFixed(2)}</div>
          <div style="font-size:12px;color:#6b7280;">${todaySales.length} sales · ${todayItems} items sold</div>
        </div>

        <div style="display:flex;gap:10px;padding:15px 0;background:white;border-bottom:1px solid #eee;">
          <div style="flex:1;background:#f9fafb;padding:12px;border-radius:8px;text-align:center;">
            <div style="font-size:10px;text-transform:uppercase;color:#6b7280;font-weight:bold;">vs Yesterday</div>
            <div style="font-size:18px;font-weight:bold;color:${dayColor};margin-top:3px;">${dayArrow} ${Math.abs(dayOverDay).toFixed(1)}%</div>
            <div style="font-size:10px;color:#9ca3af;">GHS ${yesterdayTotal.toFixed(2)}</div>
          </div>
          <div style="flex:1;background:#f9fafb;padding:12px;border-radius:8px;text-align:center;">
            <div style="font-size:10px;text-transform:uppercase;color:#6b7280;font-weight:bold;">vs 7-Day Avg</div>
            <div style="font-size:18px;font-weight:bold;color:${avgColor};margin-top:3px;">${avgArrow} ${Math.abs(vs7Avg).toFixed(1)}%</div>
            <div style="font-size:10px;color:#9ca3af;">GHS ${avg7.toFixed(2)}</div>
          </div>
        </div>

        <div style="padding:15px 0;background:white;">
          <h2 style="font-size:14px;color:#374151;margin:0 0 10px;padding:0 5px;">🏆 Top 5 Products</h2>
          <table style="width:100%;border-collapse:collapse;font-size:13px;">
            <thead><tr style="background:#f3f4f6;"><th style="padding:8px 12px;text-align:left;">#</th><th style="padding:8px 12px;text-align:left;">Product</th><th style="padding:8px 12px;text-align:center;">Qty</th><th style="padding:8px 12px;text-align:right;">Revenue</th></tr></thead>
            <tbody>${top5Html}</tbody>
          </table>
        </div>

        <div style="padding:15px 0;background:white;border-top:1px solid #eee;">
          <h2 style="font-size:14px;color:#374151;margin:0 0 10px;padding:0 5px;">💳 Payment Methods</h2>
          <table style="width:100%;border-collapse:collapse;font-size:13px;">
            <thead><tr style="background:#f3f4f6;"><th style="padding:8px 12px;text-align:left;">Method</th><th style="padding:8px 12px;text-align:center;">Count</th><th style="padding:8px 12px;text-align:right;">Total</th></tr></thead>
            <tbody>${paymentHtml}</tbody>
          </table>
        </div>

        ${lowStock.length > 0 ? `
        <div style="padding:15px;background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;margin:15px 0;">
          <h2 style="font-size:13px;color:#92400e;margin:0 0 8px;">⚠️ Low Stock (${lowStock.length})</h2>
          ${lowStockHtml}
        </div>` : ''}

        <div style="text-align:center;margin-top:20px;color:#9ca3af;font-size:11px;">
          <p>Auto-generated by ${companyName} POS</p>
          <p>Configure email alerts in: Email System → Settings</p>
        </div>
      </div>
    `

    // === Send email ===
    const transporter = nodemailer.createTransport({
      host: cfg['smtp.host'],
      port: parseInt(cfg['smtp.port'] || '587', 10),
      secure: parseInt(cfg['smtp.port'] || '587', 10) === 465,
      auth: { user: cfg['smtp.user'], pass: cfg['smtp.password'] },
    })

    const info = await transporter.sendMail({
      from: cfg['smtp.from'] || cfg['smtp.user'],
      to: recipient,
      subject: `📊 Daily Summary — GHS ${todayTotal.toFixed(2)} (${todaySales.length} sales) — ${now.toLocaleDateString('en-GB')}`,
      html,
    })

    await prisma.email.create({
      data: {
        direction: 'sent',
        fromAddress: cfg['smtp.from'] || cfg['smtp.user'],
        toAddress: recipient,
        subject: `Daily Summary — ${now.toLocaleDateString('en-GB')}`,
        body: `Today: GHS ${todayTotal.toFixed(2)} (${todaySales.length} sales, ${todayItems} items). vs Yesterday: ${dayOverDay.toFixed(1)}%. vs 7-day avg: ${vs7Avg.toFixed(1)}%.`,
        status: 'sent',
        messageId: info.messageId,
      },
    })

    return NextResponse.json({
      success: true,
      message: `Daily summary sent to ${recipient}`,
      sentTo: recipient,
      today: { total: todayTotal, count: todaySales.length, items: todayItems },
      comparisons: { dayOverDay, vs7Avg, yesterdayTotal, avg7 },
      topProducts: top5.length,
      lowStockCount: lowStock.length,
    })
  } catch (e: any) {
    console.error('Daily summary error:', e)
    return NextResponse.json({ error: e.message || 'Failed to send summary' }, { status: 500 })
  }
}
