import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import nodemailer from 'nodemailer'

export async function POST(req: NextRequest) {
  try {
    const { saleId, customerEmail } = await req.json()

    if (!saleId || !customerEmail) {
      return NextResponse.json(
        { error: 'Sale ID and customer email are required' },
        { status: 400 }
      )
    }

    // Fetch the sale with items
    const sale = await db.sale.findUnique({
      where: { id: saleId },
      include: { items: true },
    })

    if (!sale) {
      return NextResponse.json({ error: 'Sale not found' }, { status: 404 })
    }

    // Get SMTP settings
    const settings = await db.systemSetting.findMany({
      where: {
        key: {
          in: ['smtp.host', 'smtp.port', 'smtp.user', 'smtp.password', 'smtp.from']
        }
      }
    })
    const cfg: Record<string, string> = {}
    settings.forEach(s => (cfg[s.key] = s.value))

    if (!cfg['smtp.host'] || !cfg['smtp.user'] || !cfg['smtp.password']) {
      return NextResponse.json(
        { error: 'SMTP not configured. Go to Email System → Settings.' },
        { status: 400 }
      )
    }

    // Create transporter
    const transporter = nodemailer.createTransport({
      host: cfg['smtp.host'],
      port: parseInt(cfg['smtp.port'] || '587', 10),
      secure: parseInt(cfg['smtp.port'] || '587', 10) === 465,
      auth: { user: cfg['smtp.user'], pass: cfg['smtp.password'] },
    })

    // Helper function for safe number formatting
    const safeNum = (n: any) => typeof n === 'number' ? n : parseFloat(n || '0') || 0
    const receiptNum = (sale as any).receiptNumber || (sale as any).invoiceNumber || (sale as any).receiptNo || sale.id.slice(-8).toUpperCase()

    // Build HTML receipt
    const itemsHtml = sale.items.map((item: any) => `
      <tr>
        <td style="padding: 6px 0; border-bottom: 1px solid #eee;">${item.name || 'Item'}</td>
        <td style="padding: 6px 12px; border-bottom: 1px solid #eee; text-align: center;">${safeNum(item.quantity)}</td>
        <td style="padding: 6px 12px; border-bottom: 1px solid #eee; text-align: right;">GHS ${safeNum(item.price).toFixed(2)}</td>
        <td style="padding: 6px 0; border-bottom: 1px solid #eee; text-align: right;">GHS ${(safeNum(item.quantity) * safeNum(item.price)).toFixed(2)}</td>
      </tr>
    `).join('')

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #10b981; margin: 0;">SYLHN POS</h1>
          <p style="color: #666; margin: 5px 0;">Official Receipt</p>
        </div>

        <div style="background: #f9fafb; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
          <p style="margin: 2px 0;"><strong>Receipt #:</strong> ${receiptNum}</p>
          <p style="margin: 2px 0;"><strong>Date:</strong> ${new Date(sale.createdAt).toLocaleString('en-GB')}</p>
          <p style="margin: 2px 0;"><strong>Customer:</strong> ${customerEmail}</p>
        </div>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <thead>
            <tr style="background: #f3f4f6;">
              <th style="padding: 8px 0; text-align: left;">Item</th>
              <th style="padding: 8px 12px; text-align: center;">Qty</th>
              <th style="padding: 8px 12px; text-align: right;">Price</th>
              <th style="padding: 8px 0; text-align: right;">Total</th>
            </tr>
          </thead>
          <tbody>${itemsHtml}</tbody>
        </table>

        <div style="text-align: right; padding: 15px 0; border-top: 2px solid #10b981;">
          <p style="margin: 5px 0; font-size: 18px;"><strong>Total: GHS ${safeNum(sale.total).toFixed(2)}</strong></p>
          <p style="margin: 5px 0; color: #666;">Paid via: ${(sale as any).paymentMethod || 'Cash'}</p>
        </div>

        <div style="text-align: center; margin-top: 40px; color: #999; font-size: 12px;">
          <p>Thank you for shopping with us!</p>
          <p>SYLHN POS — Your trusted retail partner</p>
        </div>
      </div>
    `

    // Send email
    const info = await transporter.sendMail({
      from: cfg['smtp.from'] || cfg['smtp.user'],
      to: customerEmail,
      subject: `Receipt ${receiptNum} - SYLHN POS`,
      html,
    })

    // Log the sent email
    await db.email.create({
      data: {
        direction: 'sent',
        fromAddress: cfg['smtp.from'] || cfg['smtp.user'],
        toAddress: customerEmail,
        subject: `Receipt ${receiptNum}`,
        body: `Receipt for sale ${saleId}`,
        status: 'sent',
        messageId: info.messageId,
      }
    })

    return NextResponse.json({
      success: true,
      messageId: info.messageId,
      sentTo: customerEmail,
    })
  } catch (e: any) {
    console.error('Email receipt error:', e)
    return NextResponse.json(
      { error: e.message || 'Failed to send receipt' },
      { status: 500 }
    )
  }
}
