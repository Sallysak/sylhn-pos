import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { rateLimitApiRead, rateLimitResponse, getClientIp } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const maxDuration = 30

const SYSTEM_PROMPT = `You are SYLHN AI, an intelligent assistant for the SYLHN POS retail system in Ghana.

Your role:
- Help the cashier/manager with daily operations
- Answer questions about sales, stock, customers, suppliers
- Provide business insights and recommendations
- Suggest reorders when stock is low
- Explain trends in simple, clear language

Context about the business:
- Location: Ghana (currency: GHS — Ghana Cedi)
- Type: Retail POS system
- Common products: groceries, beverages, household items
- Tax: VAT/NHIL/GETFL (Ghana standard)

When answering:
- Be concise and direct (cashiers are busy)
- Use bullet points for lists
- Include GHS amounts with proper formatting (e.g., GHS 1,234.50)
- If you don't know something, say so — don't make up data
- For numbers/dates, be precise

You have access to real-time business data when the user asks questions about:
- Sales (today, this week, this month)
- Stock levels and low-stock alerts
- Top-selling products
- Customer information
- Supplier information

Always be helpful, professional, and focused on helping the business succeed.`

export async function POST(req: NextRequest) {
  try { await requireAuth(); } catch (e) { return e as Response; }
  
  const ip = getClientIp(req);
  const rl = rateLimitApiRead(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  try {
    const { messages, context } = await req.json()

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: 'Messages array is required' },
        { status: 400 }
      )
    }

    let businessContext = ''
    if (context?.includeBusinessData) {
      businessContext = await gatherBusinessContext(context)
    }

    const fullMessages = [
      { role: 'system', content: SYSTEM_PROMPT + (businessContext ? `\n\n--- CURRENT BUSINESS DATA ---\n${businessContext}` : '') },
      ...messages,
    ]

    const response = await fetch(`${process.env.AI_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.AI_API_KEY}`,
      },
      body: JSON.stringify({
        model: process.env.AI_MODEL || 'llama-3.3-70b-versatile',
        messages: fullMessages,
        temperature: 0.7,
        max_tokens: 1024,
        stream: false,
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error('Groq API error:', errText)
      return NextResponse.json(
        { error: `AI service error: ${response.status}` },
        { status: 500 }
      )
    }

    const data = await response.json()
    const reply = data.choices?.[0]?.message?.content || 'Sorry, I could not generate a response.'

    return NextResponse.json({
      success: true,
      reply,
      usage: data.usage,
    })
  } catch (e: any) {
    console.error('AI chat error:', e)
    return NextResponse.json(
      { error: e.message || 'Failed to get AI response' },
      { status: 500 }
    )
  }
}

async function gatherBusinessContext(options: any): Promise<string> {
  const parts: string[] = []
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  try {
    if (options.includeSales !== false) {
      const todaySales = await db.sale.findMany({
        where: { createdAt: { gte: todayStart } },
        include: { items: true },
      })
      const todayTotal = todaySales.reduce((sum, s) => sum + (s.total || 0), 0)
      const todayCount = todaySales.length
      const itemsSold = todaySales.reduce((sum, s) => sum + s.items.length, 0)

      parts.push(`TODAY'S SALES (${now.toLocaleDateString('en-GB')}):
- Total Revenue: GHS ${todayTotal.toFixed(2)}
- Number of Sales: ${todayCount}
- Items Sold: ${itemsSold}`)
    }

    if (options.includeStock !== false) {
      const lowStock = await db.product.findMany({
        where: { quantity: { lte: 10 } },
        take: 10,
        orderBy: { quantity: 'asc' },
        select: { id: true, name: true, sku: true, emoji: true, quantity: true, reorderLevel: true, unit: true, price: true },
      })
      if (lowStock.length > 0) {
        parts.push(`LOW STOCK ALERT (${lowStock.length} items):
${lowStock.map(p => `- ${p.name}: ${p.quantity} ${p.unit || 'pcs'} remaining (reorder at ${p.reorderLevel || 10})`).join('\n')}`)
      }

      const allProducts = await db.product.findMany()
      const stockValue = allProducts.reduce((sum, p) => sum + (p.quantity || 0) * (p.costPrice || p.price || 0), 0)
      parts.push(`TOTAL STOCK VALUE: GHS ${stockValue.toFixed(2)} (${allProducts.length} products)`)
    }

    if (options.includeTopProducts !== false) {
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      const recentSales = await db.sale.findMany({
        where: { createdAt: { gte: thirtyDaysAgo } },
        include: { items: true },
      })
      const productSales: Record<string, { name: string; qty: number; revenue: number }> = {}
      recentSales.forEach(s => {
        s.items.forEach((item: any) => {
          const key = item.productId || item.name
          if (!productSales[key]) {
            productSales[key] = { name: item.name, qty: 0, revenue: 0 }
          }
          productSales[key].qty += item.quantity
          productSales[key].revenue += item.quantity * item.price
        })
      })
      const top5 = Object.values(productSales)
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5)
      if (top5.length > 0) {
        parts.push(`TOP 5 PRODUCTS (last 30 days):
${top5.map((p, i) => `${i + 1}. ${p.name} — ${p.qty} sold, GHS ${p.revenue.toFixed(2)} revenue`).join('\n')}`)
      }
    }
  } catch (e) {
    console.debug('Error gathering context:', e)
  }

  return parts.join('\n\n')
}
