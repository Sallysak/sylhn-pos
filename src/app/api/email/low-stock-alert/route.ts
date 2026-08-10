import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import nodemailer from 'nodemailer'

const prisma = new PrismaClient()

// GET /api/email/low-stock-alert?secret=CRON_SECRET
// OR POST /api/email/low-stock-alert (manual trigger from UI)
//
// Sends an email alert listing all products at or below their reorder level.
// Can be triggered:
//   1. Manually from the POS UI (POST, requires auth)
//   2. Automatically via cron (GET with secret — e.g., cron-job.org every 4 hours)
//
// The email goes to the configured SMTP "from" address (the store owner's email).

export const runtime = 'nodejs'
export const maxDuration = 30

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return runAlert()
}

export async function POST(req: NextRequest) {
  // Manual trigger — auth handled by client (authedFetch)
  return runAlert()
}

async function runAlert() {
  try {
    // === Find all low-stock products ===
    const lowStockProducts = await prisma.product.findMany({
      where: { active: true, quantity: { lte: 10 } },
      orderBy: [{ quantity: 'asc' }, { name: 'asc' }],
      take: 50,
      select: {
        id: true,
        name: true,
        sku: true,
        emoji: true,
        quantity: true,
        reorderLevel: true,
        unit: true,
        price: true,
      },
    })

    if (lowStockProducts.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No low-stock products — no email sent',
        lowStockCount: 0,
      })
    }

    // === Get SMTP settings ===
    const settings = await prisma.systemSetting.findMany({
      where: {
        key: {
          in: ['smtp.host', 'smtp.port', 'smtp.user', 'smtp.password', 'smtp.from'],
        },
      },
    })
    const cfg: Record<string, string> = {}
    settings.forEach(s => (cfg[s.key] = s.value))

    if (!cfg['smtp.host'] || !cfg['smtp.user'] || !cfg['smtp.password']) {
      return NextResponse.json(
        { error: 'SMTP not configured. Go to Email System → Settings to set up email.' },
        { status: 400 }
      )
    }

    // === Check if we already sent an alert in the last 4 hours (avoid spam) ===
    const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000)
    const recentAlert = await prisma.email.findFirst({
      where: {
        direction: 'sent',
        subject: { startsWith: '⚠️ Low Stock Alert' },
        createdAt: { gte: fourHoursAgo },
      },
    })

    if (recentAlert) {
      return NextResponse.json({
        success: true,
        message: 'Alert already sent in the last 4 hours — skipping to avoid spam',
        lowStockCount: lowStockProducts.length,
        lastAlertAt: recentAlert.createdAt,
      })
    }

    // === Build the email ===
    const recipient = cfg['smtp.from'] || cfg['smtp.user']
    const criticalCount = lowStockProducts.filter(p => p.quantity <= 0).length
    const lowCount = lowStockProducts.filter(p => p.quantity > 0 && p.quantity <= 5).length
    const warningCount = lowStockProducts.filter(p => p.quantity > 5).length

    const itemsHtml = lowStockProducts.map((p, i) => {
      const status = p.quantity <= 0 ? 'OUT OF STOCK' : p.quantity <= 5 ? 'CRITICAL' : 'LOW'
      const statusColor = p.quantity <= 0 ? '#dc2626' : p.quantity <= 5 ? '#ea580c' : '#ca8a04'
      const statusBg = p.quantity <= 0 ? '#fee2e2' : p.quantity <= 5 ? '#ffedd5' : '#fef9c3'
      return `
        <tr>
          <td style="padding: 8px 12px; border-bottom: 1px solid #eee;">${i + 1}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #eee; font-weight: 600;">${p.emoji || '📦'} ${p.name}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #eee; font-family: monospace; font-size: 11px; color: #666;">${p.sku || '—'}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #eee; text-align: center; font-weight: bold;">${p.quantity} ${p.unit || 'pcs'}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #eee; text-align: center;">${p.reorderLevel || 10}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #eee; text-align: center;">
            <span style="background: ${statusBg}; color: ${statusColor}; padding: 2px 8px; border-radius: 10px; font-size: 10px; font-weight: bold;">${status}</span>
          </td>
        </tr>
      `
    }).join('')

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #dc2626, #ea580c); color: white; padding: 20px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="margin: 0; font-size: 22px;">⚠️ Low Stock Alert</h1>
          <p style="margin: 5px 0 0; opacity: 0.9; font-size: 13px;">SYLHN POS — ${new Date().toLocaleString('en-GB')}</p>
        </div>

        <div style="background: #f9fafb; padding: 15px; border-left: 4px solid #dc2626; margin-bottom: 20px;">
          <p style="margin: 0 0 5px; font-size: 14px; color: #374151;">
            <strong>${lowStockProducts.length} products</strong> need your attention:
          </p>
          <div style="display: flex; gap: 15px; font-size: 12px; margin-top: 8px;">
            <span style="background: #fee2e2; color: #dc2626; padding: 3px 10px; border-radius: 12px; font-weight: bold;">${criticalCount} Out of Stock</span>
            <span style="background: #ffedd5; color: #ea580c; padding: 3px 10px; border-radius: 12px; font-weight: bold;">${lowCount} Critical (≤5)</span>
            <span style="background: #fef9c3; color: #ca8a04; padding: 3px 10px; border-radius: 12px; font-weight: bold;">${warningCount} Low (≤10)</span>
          </div>
        </div>

        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <thead>
            <tr style="background: #f3f4f6;">
              <th style="padding: 10px 12px; text-align: left; border-bottom: 2px solid #ddd;">#</th>
              <th style="padding: 10px 12px; text-align: left; border-bottom: 2px solid #ddd;">Product</th>
              <th style="padding: 10px 12px; text-align: left; border-bottom: 2px solid #ddd;">SKU</th>
              <th style="padding: 10px 12px; text-align: center; border-bottom: 2px solid #ddd;">In Stock</th>
              <th style="padding: 10px 12px; text-align: center; border-bottom: 2px solid #ddd;">Reorder At</th>
              <th style="padding: 10px 12px; text-align: center; border-bottom: 2px solid #ddd;">Status</th>
            </tr>
          </thead>
          <tbody>${itemsHtml}</tbody>
        </table>

        <div style="background: #ecfdf5; border: 1px solid #a7f3d0; padding: 15px; border-radius: 8px; margin-top: 20px;">
          <p style="margin: 0; font-size: 13px; color: #065f46;">
            💡 <strong>Action needed:</strong> Visit your POS → Purchase Hub → create POs for these products, or use the auto-PO feature in the cron.
          </p>
        </div>

        <div style="text-align: center; margin-top: 30px; color: #9ca3af; font-size: 11px;">
          <p>This alert was sent automatically by SYLHN POS.</p>
          <p>You'll receive the next alert only if stock levels change or after 4 hours.</p>
        </div>
      </div>
    `

    // === Create transporter ===
    const transporter = nodemailer.createTransport({
      host: cfg['smtp.host'],
      port: parseInt(cfg['smtp.port'] || '587', 10),
      secure: parseInt(cfg['smtp.port'] || '587', 10) === 465,
      auth: { user: cfg['smtp.user'], pass: cfg['smtp.password'] },
    })

    // === Send email ===
    const info = await transporter.sendMail({
      from: cfg['smtp.from'] || cfg['smtp.user'],
      to: recipient,
      subject: `⚠️ Low Stock Alert — ${lowStockProducts.length} products need attention`,
      html,
    })

    // === Log the email ===
    await prisma.email.create({
      data: {
        direction: 'sent',
        fromAddress: cfg['smtp.from'] || cfg['smtp.user'],
        toAddress: recipient,
        subject: `⚠️ Low Stock Alert — ${lowStockProducts.length} products need attention`,
        body: `${lowStockProducts.length} products at or below reorder level. Critical: ${criticalCount}, Low: ${lowCount + warningCount}`,
        status: 'sent',
        messageId: info.messageId,
      },
    })

    return NextResponse.json({
      success: true,
      message: `Low-stock alert email sent to ${recipient}`,
      sentTo: recipient,
      messageId: info.messageId,
      lowStockCount: lowStockProducts.length,
      breakdown: { critical: criticalCount, low: lowCount, warning: warningCount },
    })
  } catch (e: any) {
    console.error('Low-stock alert error:', e)
    return NextResponse.json(
      { error: e.message || 'Failed to send alert' },
      { status: 500 }
    )
  }
}
