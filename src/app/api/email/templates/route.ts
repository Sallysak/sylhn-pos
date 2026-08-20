import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
// Default templates that ship with the system
const DEFAULT_TEMPLATES = [
  {
    id: 'welcome',
    name: 'Customer Welcome',
    subject: 'Welcome to SYLHN POS! 🎉',
    body: `<p>Dear Valued Customer,</p>
<p>Welcome to the SYLHN POS family! We're thrilled to have you with us.</p>
<p>At SYLHN POS, we offer:</p>
<ul>
<li>Quality products at fair prices</li>
<li>Friendly customer service</li>
<li>Fresh stock arriving weekly</li>
<li>Special offers for loyal customers</li>
</ul>
<p>Visit us anytime — we look forward to serving you!</p>
<p>Best regards,<br/>The SYLHN POS Team</p>`,
    category: 'customer',
  },
  {
    id: 'promotion',
    name: 'Promotional Offer',
    subject: '🔥 Special Offer Just for You!',
    body: `<p>Dear Customer,</p>
<p>We have an exciting offer for you!</p>
<p><strong>Special Discount:</strong> Get 10% off your next purchase this week.</p>
<p>Simply show this email at checkout to claim your discount.</p>
<p>Hurry — offer ends soon!</p>
<p>Best regards,<br/>SYLHN POS</p>`,
    category: 'customer',
  },
  {
    id: 'statement',
    name: 'Customer Statement',
    subject: 'Your Account Statement',
    body: `<p>Dear Customer,</p>
<p>Please find your account statement below:</p>
<p><strong>Statement Period:</strong> {{period}}</p>
<p><strong>Total Purchases:</strong> GHS {{total}}</p>
<p><strong>Outstanding Balance:</strong> GHS {{balance}}</p>
<p>If you have any questions, please don't hesitate to contact us.</p>
<p>Best regards,<br/>SYLHN POS Accounting</p>`,
    category: 'customer',
  },
  {
    id: 'overdue',
    name: 'Overdue Payment Reminder',
    subject: 'Payment Reminder - Action Required',
    body: `<p>Dear Customer,</p>
<p>This is a friendly reminder that your account has an overdue balance.</p>
<p><strong>Amount Due:</strong> GHS {{amount}}</p>
<p><strong>Due Date:</strong> {{dueDate}}</p>
<p>Please make payment at your earliest convenience to avoid service interruption.</p>
<p>If you've already paid, please disregard this message.</p>
<p>Best regards,<br/>SYLHN POS</p>`,
    category: 'customer',
  },
  {
    id: 'supplier-order',
    name: 'Supplier Purchase Order',
    subject: 'Purchase Order - {{poNumber}}',
    body: `<p>Dear Supplier,</p>
<p>We'd like to place the following order:</p>
<p><strong>PO Number:</strong> {{poNumber}}<br/>
<strong>Date:</strong> {{date}}</p>
<p><strong>Items:</strong></p>
<ul>{{items}}</ul>
<p>Please confirm receipt and expected delivery date.</p>
<p>Best regards,<br/>SYLHN POS Procurement</p>`,
    category: 'supplier',
  },
  {
    id: 'thank-you',
    name: 'Thank You Note',
    subject: 'Thank You for Your Purchase! 🙏',
    body: `<p>Dear Customer,</p>
<p>Thank you for shopping with us today!</p>
<p>Your support means everything to our small business. We hope to see you again soon.</p>
<p>If you have any feedback about your visit, we'd love to hear it!</p>
<p>Best regards,<br/>The SYLHN POS Team</p>`,
    category: 'customer',
  },
]

export async function GET() {
  try {
    // Get custom templates from database
    const customTemplates = await db.systemSetting.findMany({
      where: { key: { startsWith: 'email_template_' } }
    })

    const custom = customTemplates.map(t => {
      try { return JSON.parse(t.value) } catch { return null }
    }).filter(Boolean)

    // Combine default + custom
    const allTemplates = [...DEFAULT_TEMPLATES, ...custom]

    return NextResponse.json({ templates: allTemplates })
  } catch (e: any) {
    console.error('Get templates error:', e)
    return NextResponse.json(
      { error: e.message, templates: DEFAULT_TEMPLATES },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const { name, subject, body, category } = await req.json()

    if (!name || !subject || !body) {
      return NextResponse.json(
        { error: 'Name, subject, and body are required' },
        { status: 400 }
      )
    }

    const id = `custom_${Date.now()}`
    const template = { id, name, subject, body, category: category || 'custom' }

    await db.systemSetting.create({
      data: {
        key: `email_template_${id}`,
        value: JSON.stringify(template),
      }
    })

    return NextResponse.json({ success: true, template })
  } catch (e: any) {
    console.error('Create template error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
