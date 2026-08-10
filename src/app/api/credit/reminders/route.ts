import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import nodemailer from 'nodemailer'

// POST /api/credit/reminders
// Send payment reminders to customers with outstanding credit balances
// Can be triggered manually or via cron

export const runtime = 'nodejs'
export const maxDuration = 30

export async function POST(req: NextRequest) {
  try { await requireAuth(); } catch (e) { return e as Response; }

  const now = new Date()
  const creditSales = await db.sale.findMany({
    where: { isCreditSale: true, creditAmountDue: { gt: 0 } },
    include: { customer: true },
  })

  // Group by customer
  const byCustomer: Record<string, { name: string; phone: string; email: string; total: number; count: number; oldestDays: number }> = {}
  for (const s of creditSales) {
    const key = s.customerId || 'walk-in'
    const days = Math.floor((now.getTime() - new Date(s.createdAt).getTime()) / (1000 * 60 * 60 * 24))
    if (!byCustomer[key]) {
      byCustomer[key] = { name: s.customer?.name || 'Walk-in', phone: s.customer?.phone || '', email: s.customer?.email || '', total: 0, count: 0, oldestDays: 0 }
    }
    byCustomer[key].total += s.creditAmountDue
    byCustomer[key].count++
    if (days > byCustomer[key].oldestDays) byCustomer[key].oldestDays = days
  }

  // Only send to customers with >7 days outstanding
  const overdue = Object.values(byCustomer).filter(c => c.oldestDays > 7 && c.email)
  if (overdue.length === 0) {
    return NextResponse.json({ success: true, message: 'No overdue customers with email', sent: 0 })
  }

  // Get SMTP settings
  const settings = await db.systemSetting.findMany({ where: { key: { startsWith: 'smtp.' } } })
  const cfg: Record<string, string> = {}
  settings.forEach(s => cfg[s.key] = s.value)
  if (!cfg['smtp.host']) return NextResponse.json({ error: 'SMTP not configured' }, { status: 400 })

  const transporter = nodemailer.createTransport({
    host: cfg['smtp.host'],
    port: parseInt(cfg['smtp.port'] || '587'),
    secure: parseInt(cfg['smtp.port'] || '587') === 465,
    auth: { user: cfg['smtp.user'], pass: cfg['smtp.password'] },
  })

  let sent = 0
  for (const c of overdue) {
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
        <div style="background:linear-gradient(135deg,#f59e0b,#ef4444);color:white;padding:20px;border-radius:12px 12px 0 0;">
          <h1 style="margin:0;font-size:20px;">Payment Reminder</h1>
        </div>
        <div style="padding:20px;border:1px solid #eee;">
          <p>Dear ${c.name},</p>
          <p>You have an outstanding credit balance of <strong style="color:#dc2626;font-size:18px;">GHS ${c.total.toFixed(2)}</strong> from ${c.count} purchase(s).</p>
          <p>Your oldest unpaid purchase is ${c.oldestDays} days old. Please settle your account at your earliest convenience.</p>
          <p>If you have already paid, please disregard this message.</p>
          <p>Best regards,<br/>SYLHN POS</p>
        </div>
      </div>`
    try {
      await transporter.sendMail({ from: cfg['smtp.from'] || cfg['smtp.user'], to: c.email, subject: `Payment Reminder — GHS ${c.total.toFixed(2)} Outstanding`, html })
      sent++
    } catch (e) { /* skip failed */ }
  }

  return NextResponse.json({ success: true, sent, totalOverdue: overdue.length })
}
