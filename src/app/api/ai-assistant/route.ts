import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { rateLimitApiRead, rateLimitResponse, getClientIp } from "@/lib/rate-limit";
import { auditLog } from "@/lib/audit";
import ZAI from "z-ai-web-dev-sdk";

export const runtime = "nodejs";
export const maxDuration = 60;

// POST /api/ai-assistant
// Premium: AI Business Assistant — natural language queries about the store.
//
// The assistant gathers relevant business data (sales, products, suppliers,
// customers, inventory, expenses) and sends it as context to the LLM along
// with the user's question. The LLM responds with insights, recommendations,
// and actionable advice.
//
// Body: { question: string, conversationHistory?: [{role, content}] }
// Returns: { response: string, context: { ...dataUsed } }
export async function POST(req: NextRequest) {
  let user;
  try { user = await requireAuth(); } catch (e) { return e as Response; }

  const ip = getClientIp(req);
  const rl = rateLimitApiRead(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const question = String(body.question || "").slice(0, 2000);
  if (!question) {
    return NextResponse.json({ error: "Question is required" }, { status: 400 });
  }

  try {
    // ===== Gather business context =====
    const now = new Date();
    const startOfToday = new Date(now); startOfToday.setHours(0, 0, 0, 0);
    const startOfWeek = new Date(startOfToday); startOfWeek.setDate(startOfWeek.getDate() - 7);
    const startOfMonth = new Date(startOfToday); startOfMonth.setDate(1);
    const startOfLastMonth = new Date(startOfMonth); startOfLastMonth.setMonth(startOfLastMonth.getMonth() - 1);

    const [
      todaySales, weekSales, monthSales, lastMonthSales,
      products, lowStockProducts, topProducts, suppliers,
      customers, expenses, shifts, auditRecent,
    ] = await Promise.all([
      // Today's sales
      db.sale.findMany({
        where: { status: "completed", createdAt: { gte: startOfToday, lte: now } },
        select: { total: true, taxAmount: true, costOfGoods: true, grossProfit: true, paymentMethod: true, items: { select: { name: true, quantity: true, total: true } } },
      }),
      // This week's sales
      db.sale.findMany({
        where: { status: "completed", createdAt: { gte: startOfWeek, lte: now } },
        select: { total: true, grossProfit: true, createdAt: true, items: { select: { name: true, quantity: true, total: true, sku: true } } },
      }),
      // This month's sales
      db.sale.findMany({
        where: { status: "completed", createdAt: { gte: startOfMonth, lte: now } },
        select: { total: true, grossProfit: true, paymentMethod: true },
      }),
      // Last month's sales (for comparison)
      db.sale.findMany({
        where: { status: "completed", createdAt: { gte: startOfLastMonth, lt: startOfMonth } },
        select: { total: true, grossProfit: true },
      }),
      // Products
      db.product.findMany({
        where: { active: true },
        select: { id: true, sku: true, name: true, emoji: true, category: true, price: true, costPrice: true, quantity: true, reorderLevel: true, unit: true, expiryDate: true },
      }),
      // Low stock products
      db.product.findMany({
        where: { active: true, quantity: { lte: 5 } },
        select: { name: true, sku: true, quantity: true, reorderLevel: true, unit: true },
      }),
      // Top products (last 30 days)
      db.saleItem.findMany({
        where: { sale: { status: "completed", createdAt: { gte: startOfWeek } } },
        select: { name: true, sku: true, quantity: true, total: true, costPrice: true },
      }),
      // Suppliers
      db.supplier.findMany({
        where: { active: true },
        select: { id: true, code: true, name: true, balance: true, creditLimit: true, tradingTerms: true, phone: true, email: true },
      }),
      // Customers
      db.customer.findMany({
        where: { active: true },
        select: { id: true, name: true, tier: true, pointsBalance: true, totalSpent: true, visits: true, lastVisitAt: true, phone: true },
      }),
      // Expenses (this month)
      db.expense.findMany({
        where: { date: { gte: startOfMonth, lte: now } },
        select: { category: true, description: true, amount: true, date: true },
      }),
      // Open shifts
      db.cashierShift.findMany({
        where: { status: "open" },
        select: { cashierName: true, openingFloat: true, openedAt: true },
      }),
      // Recent audit log
      db.auditLog.findMany({
        take: 10,
        orderBy: { timestamp: "desc" },
        select: { action: true, module: true, details: true, severity: true, timestamp: true, user: true },
      }),
    ]);

    // ===== Compute summaries =====
    const todayRevenue = todaySales.reduce((s, x) => s + x.total, 0);
    const todayProfit = todaySales.reduce((s, x) => s + x.grossProfit, 0);
    const weekRevenue = weekSales.reduce((s, x) => s + x.total, 0);
    const weekProfit = weekSales.reduce((s, x) => s + x.grossProfit, 0);
    const monthRevenue = monthSales.reduce((s, x) => s + x.total, 0);
    const monthProfit = monthSales.reduce((s, x) => s + x.grossProfit, 0);
    const lastMonthRevenue = lastMonthSales.reduce((s, x) => s + x.total, 0);
    const lastMonthProfit = lastMonthSales.reduce((s, x) => s + x.grossProfit, 0);

    // Top products by revenue (last 7 days)
    const productAgg: Record<string, { name: string; sku: string; qty: number; revenue: number; profit: number }> = {};
    for (const item of topProducts) {
      const key = item.sku;
      if (!productAgg[key]) productAgg[key] = { name: item.name, sku: item.sku, qty: 0, revenue: 0, profit: 0 };
      productAgg[key].qty += item.quantity;
      productAgg[key].revenue += item.total;
      productAgg[key].profit += item.total - (item.costPrice * item.quantity);
    }
    const topProductsList = Object.values(productAgg).sort((a, b) => b.revenue - a.revenue).slice(0, 10);

    // Payment method breakdown (this month)
    const paymentBreakdown: Record<string, number> = {};
    for (const s of monthSales) {
      paymentBreakdown[s.paymentMethod] = (paymentBreakdown[s.paymentMethod] || 0) + s.total;
    }

    // Inventory value
    const inventoryValue = products.reduce((s, p) => s + (p.quantity * p.costPrice), 0);
    const inventoryRetail = products.reduce((s, p) => s + (p.quantity * p.price), 0);
    const expiringSoon = products.filter(p => p.expiryDate && new Date(p.expiryDate) < new Date(Date.now() + 7 * 86400000));

    // Supplier balances
    const totalSupplierDebt = suppliers.reduce((s, x) => s + x.balance, 0);
    const overdueSuppliers = suppliers.filter(s => s.balance > 0);

    // ===== Build the context string for the LLM =====
    const businessContext = {
      company: "SYLHN COMPANY LTD — Grocery Store in East Legon, Accra, Ghana",
      currency: "GHS (Ghana Cedi)",
      currentTime: now.toISOString(),
      salesSummary: {
        today: { revenue: todayRevenue.toFixed(2), profit: todayProfit.toFixed(2), transactions: todaySales.length },
        thisWeek: { revenue: weekRevenue.toFixed(2), profit: weekProfit.toFixed(2), transactions: weekSales.length },
        thisMonth: { revenue: monthRevenue.toFixed(2), profit: monthProfit.toFixed(2), transactions: monthSales.length },
        lastMonth: { revenue: lastMonthRevenue.toFixed(2), profit: lastMonthProfit.toFixed(2), transactions: lastMonthSales.length },
        monthOverMonthGrowth: lastMonthRevenue > 0 ? (((monthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100).toFixed(1) + "%" : "N/A",
      },
      paymentMethods: paymentBreakdown,
      topProducts: topProductsList.map(p => ({ name: p.name, sku: p.sku, qtySold: p.qty, revenue: p.revenue.toFixed(2), profit: p.profit.toFixed(2) })),
      inventory: {
        totalProducts: products.length,
        totalStockValue: inventoryValue.toFixed(2),
        totalRetailValue: inventoryRetail.toFixed(2),
        potentialProfit: (inventoryRetail - inventoryValue).toFixed(2),
        lowStockCount: lowStockProducts.length,
        lowStockItems: lowStockProducts.map(p => ({ name: p.name, qty: p.quantity, reorderLevel: p.reorderLevel, unit: p.unit })),
        expiringSoonCount: expiringSoon.length,
        expiringSoonItems: expiringSoon.map(p => ({ name: p.name, expiryDate: p.expiryDate?.toISOString().split("T")[0], qty: p.quantity })),
      },
      suppliers: {
        totalSuppliers: suppliers.length,
        totalOutstandingDebt: totalSupplierDebt.toFixed(2),
        overdueSuppliers: overdueSuppliers.map(s => ({ name: s.name, code: s.code, balance: s.balance.toFixed(2), tradingTerms: s.tradingTerms, phone: s.phone })),
      },
      customers: {
        totalCustomers: customers.length,
        topCustomers: customers.sort((a, b) => b.totalSpent - a.totalSpent).slice(0, 5).map(c => ({ name: c.name, tier: c.tier, totalSpent: c.totalSpent.toFixed(2), visits: c.visits, points: c.pointsBalance })),
        vipCustomers: customers.filter(c => c.tier !== "bronze").length,
      },
      expenses: {
        thisMonthTotal: expenses.reduce((s, e) => s + e.amount, 0).toFixed(2),
        byCategory: expenses.reduce((acc, e) => { acc[e.category] = (acc[e.category] || 0) + e.amount; return acc; }, {} as Record<string, number>),
      },
      shifts: {
        openCount: shifts.length,
        openShifts: shifts.map(s => ({ cashier: s.cashierName, float: s.openingFloat.toFixed(2), openedAt: s.openedAt.toISOString() })),
      },
      recentActivity: auditRecent.map(a => ({ action: a.action, module: a.module, details: a.details, severity: a.severity, time: a.timestamp.toISOString(), user: a.user })),
    };

    // ===== Build the LLM prompt =====
    const systemPrompt = `You are SYLHN AI, a business intelligence assistant for SYLHN COMPANY LTD, a grocery store in East Legon, Accra, Ghana.

Your role is to help the store owner (who may not be tech-savvy) understand their business data, make decisions, and grow their store.

Guidelines:
- Be concise, practical, and actionable. The owner is busy.
- Use Ghana Cedi (GHS / ₵) for all monetary amounts.
- When asked about specific products, suppliers, or customers, reference them by name.
- When giving recommendations, explain WHY (e.g. "Apples are your #2 seller but stock is at 5 units — reorder now to avoid stockout").
- If data is insufficient to answer, say so honestly and suggest what to track.
- For forecasting, use simple moving averages based on the data provided.
- Be friendly and encouraging — this is a small business owner working hard.
- Use bullet points and short paragraphs for readability.
- If the user asks about something unrelated to business, gently redirect to business topics.

Current business data (JSON):
${JSON.stringify(businessContext, null, 2)}`;

    const messages = [
      { role: "assistant", content: systemPrompt },
      ...(body.conversationHistory || []).slice(-6),  // keep last 6 messages for context
      { role: "user", content: question },
    ];

    // ===== Call the LLM =====
    const zai = await ZAI.create();
    const completion = await zai.chat.completions.create({
      messages,
      thinking: { type: "disabled" },
    });

    const response = completion.choices[0]?.message?.content || "I'm sorry, I couldn't generate a response. Please try rephrasing your question.";

    // Audit (don't log the full response — just that the user asked)
    await auditLog({
      userId: user.uid,
      user: user.username,
      action: "AI_QUERY",
      module: "dashboard",
      details: `AI assistant queried: "${question.slice(0, 100)}${question.length > 100 ? "..." : ""}"`,
      severity: "info",
      ipAddress: ip,
      userAgent: req.headers.get("user-agent") || "",
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      response,
      question,
      timestamp: now.toISOString(),
      contextUsed: {
        salesToday: todaySales.length,
        salesThisWeek: weekSales.length,
        salesThisMonth: monthSales.length,
        productsAnalyzed: products.length,
        suppliersAnalyzed: suppliers.length,
        customersAnalyzed: customers.length,
      },
    });
  } catch (e: any) {
    console.error("POST /api/ai-assistant error:", e);
    return NextResponse.json({
      error: "AI assistant encountered an error. Please try again.",
      details: e?.message || "",
    }, { status: 500 });
  }
}
