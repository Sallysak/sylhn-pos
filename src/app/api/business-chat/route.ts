import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
const SYSTEM_PROMPT = `You are SYLHN Business AI, an advanced analytics assistant for the SYLHN POS retail business in Ghana.

Your role is to help MANAGERS and OWNERS make data-driven decisions:
- Analyze sales trends, profit margins, and business performance
- Compare periods (this week vs last week, this month vs last month)
- Identify top customers, top products, slow-moving items
- Recommend reorders based on sales velocity and stock levels
- Flag anomalies (sudden drops, unusual patterns)
- Provide actionable business insights
- Help with supplier performance and outstanding payments

Context about the business:
- Location: Ghana (currency: GHS — Ghana Cedi)
- Type: Retail POS system
- Tax: VAT/NHIL/GETFL (Ghana standard)
- Common products: groceries, beverages, household items

When answering:
- Be analytical and data-driven
- Use bullet points and clear sections
- Include GHS amounts with proper formatting (e.g., GHS 1,234.50)
- Provide actionable recommendations
- Compare to previous periods when relevant
- Highlight trends and anomalies
- If data is insufficient, say what you'd need to give a better answer

You have access to REAL-TIME business data:
- Sales (today, this week, this month, last 30 days, last 90 days)
- Stock levels and valuations
- Top products and slow movers
- Customer data and top customers
- Supplier data and outstanding balances
- Profit margins (when cost price is available)

Always be professional, concise, and focused on helping the business grow.`

export async function POST(req: NextRequest) {
  try {
    const { messages, context } = await req.json()

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: 'Messages array is required' },
        { status: 400 }
      )
    }

    // Gather comprehensive business context
    const businessContext = await gatherBusinessContext(context || {})

    const fullMessages = [
      { role: 'system', content: SYSTEM_PROMPT + (businessContext ? `\n\n--- CURRENT BUSINESS DATA ---\n${businessContext}` : '') },
      ...messages,
    ]

    const reply = await getBusinessAiReply(fullMessages)

    return NextResponse.json({
      success: true,
      reply,
    })
  } catch (e: any) {
    console.error('Business AI chat error:', e)
    return NextResponse.json(
      { error: e.message || 'Failed to get AI response' },
      { status: 500 }
    )
  }
}

/**
 * Get an AI reply for business chat. Same fallback chain as /api/ai/chat:
 *   1. Z.AI SDK (zero-config on Railway)
 *   2. External OpenAI-compatible API (if AI_BASE_URL + AI_API_KEY set)
 *   3. Rule-based fallback message
 */
async function getBusinessAiReply(messages: Array<{ role: string; content: string }>): Promise<string> {
  // PRIMARY PATH: Z.AI SDK
  try {
    const { chat: zaiChat, isZaiConfigured } = await import('@/lib/zai');
    const configured = await isZaiConfigured();
    if (configured) {
      const text = await zaiChat({
        messages: messages as any,
        thinking: { type: 'disabled' },
        temperature: 0.4,  // Lower temp for analytical responses
        maxTokens: 1500,
      });
      if (text && text.trim()) return text.trim();
    }
  } catch (e: any) {
    console.warn('[business-chat] Z.AI SDK failed, trying external API:', e?.message);
  }

  // FALLBACK: External API
  const baseUrl = process.env.AI_BASE_URL;
  const apiKey = process.env.AI_API_KEY;
  if (baseUrl && apiKey) {
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.AI_MODEL || 'llama-3.3-70b-versatile',
        messages,
        temperature: 0.4,
        max_tokens: 1500,
        stream: false,
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error('External AI API error:', errText)
      throw new Error(`AI service error: ${response.status}`)
    }

    const data = await response.json()
    const reply = data.choices?.[0]?.message?.content
    if (reply && reply.trim()) return reply.trim()
  }

  // LAST RESORT
  return "I'm currently unable to connect to the AI service. " +
    "Please review the dashboard data directly or try again in a moment.";
}

async function gatherBusinessContext(options: any): Promise<string> {
  const parts: string[] = []
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  try {
    // === SALES SUMMARY ===
    if (options.includeSales !== false) {
      // Today
      const todaySales = await db.sale.findMany({
        where: { createdAt: { gte: todayStart } },
        include: { items: true },
      })
      const todayTotal = todaySales.reduce((sum, s) => sum + (s.total || 0), 0)

      // This week
      const weekSales = await db.sale.findMany({
        where: { createdAt: { gte: weekAgo } },
      })
      const weekTotal = weekSales.reduce((sum, s) => sum + (s.total || 0), 0)

      // This month
      const monthSales = await db.sale.findMany({
        where: { createdAt: { gte: thisMonthStart } },
      })
      const monthTotal = monthSales.reduce((sum, s) => sum + (s.total || 0), 0)

      // Last month (for comparison)
      const lastMonthSales = await db.sale.findMany({
        where: {
          createdAt: {
            gte: lastMonthStart,
            lt: thisMonthStart,
          },
        },
      })
      const lastMonthTotal = lastMonthSales.reduce((sum, s) => sum + (s.total || 0), 0)

      const monthChange = lastMonthTotal > 0
        ? ((monthTotal - lastMonthTotal) / lastMonthTotal * 100).toFixed(1)
        : 'N/A'

      parts.push(`SALES SUMMARY:
- Today: GHS ${todayTotal.toFixed(2)} (${todaySales.length} sales)
- This Week: GHS ${weekTotal.toFixed(2)} (${weekSales.length} sales)
- This Month: GHS ${monthTotal.toFixed(2)} (${monthSales.length} sales)
- Last Month: GHS ${lastMonthTotal.toFixed(2)} (${lastMonthSales.length} sales)
- Month-over-Month Change: ${monthChange}%`)
    }

    // === TOP PRODUCTS (30 days) ===
    if (options.includeTopProducts !== false) {
      const recentSales = await db.sale.findMany({
        where: { createdAt: { gte: monthAgo } },
        include: { items: true },
      })
      const productSales: Record<string, { name: string; qty: number; revenue: number; cost: number }> = {}
      recentSales.forEach(s => {
        s.items.forEach((item: any) => {
          const key = item.productId || item.name
          if (!productSales[key]) {
            productSales[key] = { name: item.name, qty: 0, revenue: 0, cost: 0 }
          }
          productSales[key].qty += item.quantity
          productSales[key].revenue += item.quantity * item.price
          productSales[key].cost += item.quantity * (item.costPrice || 0)
        })
      })
      const top10 = Object.values(productSales)
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10)
      if (top10.length > 0) {
        parts.push(`TOP 10 PRODUCTS (last 30 days):
 ${top10.map((p, i) => `${i + 1}. ${p.name} — ${p.qty} sold, Revenue: GHS ${p.revenue.toFixed(2)}, Profit: GHS ${(p.revenue - p.cost).toFixed(2)}`).join('\n')}`)
      }

      // Slow movers (products with no sales in 30 days)
      const allProducts = await db.product.findMany({ where: { active: true } })
      const soldProductIds = new Set(Object.keys(productSales))
      const slowMovers = allProducts.filter(p => !soldProductIds.has(p.id) && p.quantity > 0).slice(0, 10)
      if (slowMovers.length > 0) {
        parts.push(`SLOW-MOVING PRODUCTS (no sales in 30 days, still in stock):
 ${slowMovers.map(p => `- ${p.name}: ${p.quantity} ${p.unit || 'pcs'} in stock (value: GHS ${((p.quantity || 0) * (p.costPrice || 0)).toFixed(2)})`).join('\n')}`)
      }
    }

    // === STOCK STATUS ===
    if (options.includeStock !== false) {
      const lowStock = await db.product.findMany({
        where: { quantity: { lte: 10 } },
        take: 15,
        orderBy: { quantity: 'asc' },
      })
      if (lowStock.length > 0) {
        parts.push(`LOW STOCK ALERT (${lowStock.length} items):
 ${lowStock.map(p => `- ${p.name}: ${p.quantity} ${p.unit || 'pcs'} remaining (reorder at ${p.reorderLevel || 10})`).join('\n')}`)
      }

      const allProducts = await db.product.findMany()
      const stockValue = allProducts.reduce((sum, p) => sum + (p.quantity || 0) * (p.costPrice || p.price || 0), 0)
      const retailValue = allProducts.reduce((sum, p) => sum + (p.quantity || 0) * (p.price || 0), 0)
      parts.push(`STOCK VALUATION:
- Total Products: ${allProducts.length}
- Cost Value: GHS ${stockValue.toFixed(2)}
- Retail Value: GHS ${retailValue.toFixed(2)}
- Potential Profit: GHS ${(retailValue - stockValue).toFixed(2)}`)
    }

    // === SUPPLIER INFO ===
    if (options.includeSuppliers !== false) {
      try {
        const suppliers = await (prisma as any).supplier.findMany({
          take: 20,
          orderBy: { createdAt: 'desc' },
        })
        if (suppliers && suppliers.length > 0) {
          parts.push(`SUPPLIERS (${suppliers.length} total):
 ${suppliers.slice(0, 10).map(s => `- ${s.name || 'Unknown'}: ${s.email || 'no email'}, Balance: GHS ${(s.balance || 0).toFixed(2)}`).join('\n')}`)
        }
      } catch (e: any) {
        // Supplier model might not exist
      }
    }

  } catch (e: any) {
    console.error('Error gathering business context:', e)
  }

  return parts.join('\n\n')
}
