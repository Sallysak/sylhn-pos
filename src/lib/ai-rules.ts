/**
 * Rule-based business insights generator.
 *
 * When the AI (Z.AI) isn't configured (no API key on Vercel, etc.), this
 * module produces high-quality, data-driven responses to common business
 * questions. The responses are based on the actual business context passed
 * in — not canned strings — so they're always relevant.
 *
 * This guarantees the AI assistant ALWAYS responds with useful insights,
 * even without an LLM key.
 */

export interface BusinessContext {
  company: string;
  currency: string;
  currentTime: string;
  salesSummary: {
    today: { revenue: string; profit: string; transactions: number };
    thisWeek: { revenue: string; profit: string; transactions: number };
    thisMonth: { revenue: string; profit: string; transactions: number };
    lastMonth: { revenue: string; profit: string; transactions: number };
    monthOverMonthGrowth: string;
  };
  paymentMethods: Record<string, number>;
  topProducts: Array<{ name: string; sku: string; qtySold: number; revenue: string; profit: string }>;
  inventory: {
    totalProducts: number;
    totalStockValue: string;
    totalRetailValue: string;
    potentialProfit: string;
    lowStockCount: number;
    lowStockItems: Array<{ name: string; qty: number; reorderLevel: number; unit: string }>;
    expiringSoonCount: number;
    expiringSoonItems: Array<{ name: string; expiryDate: string; qty: number }>;
  };
  suppliers: {
    totalSuppliers: number;
    totalOutstandingDebt: string;
    overdueSuppliers: Array<{ name: string; code: string; balance: string; tradingTerms: string; phone: string }>;
  };
  customers: {
    totalCustomers: number;
    topCustomers: Array<{ name: string; tier: string; totalSpent: string; visits: number; points: number }>;
    vipCustomers: number;
  };
  expenses: {
    thisMonthTotal: string;
    byCategory: Record<string, number>;
  };
  shifts: {
    openCount: number;
    openShifts: Array<{ cashier: string; float: string; openedAt: string }>;
  };
  recentActivity: Array<{ action: string; module: string; details: string; severity: string; time: string; user: string }>;
}

/** Match a user's question against known patterns and return a relevant response. */
export function generateRuleBasedResponse(question: string, ctx: BusinessContext): string {
  const q = question.toLowerCase().trim();

  // ===== Business health / today =====
  if (/how.*(business|store|shop).*(doing|going|today)|how.*today|business today|today.*summary|overview|snapshot/.test(q)) {
    const mom = ctx.salesSummary.monthOverMonthGrowth;
    const momHint = mom === "N/A" ? "" : ` Month-over-month revenue change: **${mom}**.`;
    return [
      `**Business snapshot — ${new Date(ctx.currentTime).toLocaleDateString()}**`,
      ``,
      `**Today:** ${ctx.salesSummary.today.transactions} transactions · Revenue ${ctx.currency} ${ctx.salesSummary.today.revenue} · Profit ${ctx.currency} ${ctx.salesSummary.today.profit}.`,
      ``,
      `**This week so far:** Revenue ${ctx.currency} ${ctx.salesSummary.thisWeek.revenue} across ${ctx.salesSummary.thisWeek.transactions} transactions.`,
      ``,
      `**This month:** Revenue ${ctx.currency} ${ctx.salesSummary.thisMonth.revenue}, profit ${ctx.currency} ${ctx.salesSummary.thisMonth.profit}.${momHint}`,
      ``,
      ctx.inventory.lowStockCount > 0
        ? `⚠️ **${ctx.inventory.lowStockCount} products need restocking** — see "Which products should I reorder?" for the list.`
        : `✅ Stock levels are healthy — no products below reorder level.`,
      ctx.inventory.expiringSoonCount > 0
        ? `⚠️ **${ctx.inventory.expiringSoonCount} products expiring within 7 days** — discount or sell quickly.`
        : ``,
      ctx.suppliers.overdueSuppliers.length > 0
        ? `💸 You owe ${ctx.currency} ${ctx.suppliers.totalOutstandingDebt} to ${ctx.suppliers.overdueSuppliers.length} supplier(s).`
        : ``,
    ].filter(Boolean).join("\n");
  }

  // ===== Reorder / low stock =====
  if (/reorder|restock|low.?stock|stock.?out|out.?of.?stock|which.*product.*should.*i.*buy|replenish/.test(q)) {
    if (ctx.inventory.lowStockCount === 0) {
      return `✅ All ${ctx.inventory.totalProducts} active products are above their reorder level. No restocking needed right now.\n\nTip: Set up Auto-Replenish Rules (Accounts → Auto Replenish Rules) so the system creates POs automatically when stock runs low.`;
    }
    const lines = ctx.inventory.lowStockItems.slice(0, 15).map(p =>
      `  • **${p.name}** — ${p.qty} ${p.unit} left (reorder at ${p.reorderLevel})`
    );
    return [
      `⚠️ **${ctx.inventory.lowStockCount} products need restocking:**`,
      ``,
      ...lines,
      ctx.inventory.lowStockCount > 15 ? `\n... and ${ctx.inventory.lowStockCount - 15} more.` : ``,
      ``,
      `**Recommended action:** Go to **Accounts → Auto Replenish Rules** to set up automatic PO creation, or **Stock → Reorder Report** to create POs manually.`,
    ].filter(Boolean).join("\n");
  }

  // ===== Profit / margin =====
  if (/profit|margin|earning|making|revenue.*vs|vs.*last|month.*over.*month|mom|growth/.test(q)) {
    const thisMonth = parseFloat(ctx.salesSummary.thisMonth.revenue);
    const lastMonth = parseFloat(ctx.salesSummary.lastMonth.revenue);
    const thisProfit = parseFloat(ctx.salesSummary.thisMonth.profit);
    const lastProfit = parseFloat(ctx.salesSummary.lastMonth.profit);
    const revDelta = thisMonth - lastMonth;
    const profitDelta = thisProfit - lastProfit;
    const revPct = lastMonth > 0 ? ((revDelta / lastMonth) * 100).toFixed(1) : "N/A";
    const profitPct = lastProfit > 0 ? ((profitDelta / lastProfit) * 100).toFixed(1) : "N/A";
    return [
      `**Profit analysis (this month vs last month):**`,
      ``,
      `| Metric | This Month | Last Month | Change |`,
      `|---|---|---|---|`,
      `| Revenue | ${ctx.currency} ${ctx.salesSummary.thisMonth.revenue} | ${ctx.currency} ${ctx.salesSummary.lastMonth.revenue} | ${revDelta >= 0 ? "+" : ""}${revDelta.toFixed(2)} (${revPct}%) |`,
      `| Profit | ${ctx.currency} ${ctx.salesSummary.thisMonth.profit} | ${ctx.currency} ${ctx.salesSummary.lastMonth.profit} | ${profitDelta >= 0 ? "+" : ""}${profitDelta.toFixed(2)} (${profitPct}%) |`,
      ``,
      revDelta > 0 && profitDelta > 0
        ? `✅ Both revenue and profit are up — your store is growing.`
        : revDelta > 0 && profitDelta < 0
        ? `⚠️ Revenue grew but profit dropped — your costs are rising faster than prices. Consider supplier renegotiation or price increases.`
        : revDelta < 0 && profitDelta > 0
        ? `ℹ️ Revenue dropped but profit improved — you're selling less but more profitably.`
        : `⚠️ Both revenue and profit dropped — investigate immediately. Check top products, customer counts, and recent audit log for anomalies.`,
      ``,
      `**Inventory potential:** You have ${ctx.currency} ${ctx.inventory.totalRetailValue} in retail value (cost ${ctx.currency} ${ctx.inventory.totalStockValue}), giving **${ctx.currency} ${ctx.inventory.potentialProfit} potential profit** if everything sells.`,
    ].join("\n");
  }

  // ===== Top customers =====
  if (/top.*customer|best.*customer|who.*my.*customer|customer.*list|vip/.test(q)) {
    if (ctx.customers.totalCustomers === 0) {
      return `You have no customers registered yet. Add customers via **Credit Management** or via the POS cart's customer selector. Tracking customers lets you see who your best buyers are and offer loyalty rewards.`;
    }
    const lines = ctx.customers.topCustomers.map((c, i) =>
      `${i + 1}. **${c.name}** (${c.tier}) — ${ctx.currency} ${c.totalSpent} spent across ${c.visits} visits · ${c.points} loyalty points`
    );
    return [
      `**Your top ${ctx.customers.topCustomers.length} customers by total spend:**`,
      ``,
      ...lines,
      ``,
      `You have **${ctx.customers.totalCustomers} total customers**, of which **${ctx.customers.vipCustomers}** are VIP/Silver/Gold/Platinum tier.`,
      ``,
      `Tip: Send your top customers a thank-you note or exclusive discount via the Email System to boost retention.`,
    ].join("\n");
  }

  // ===== Suppliers / payables =====
  if (/supplier|owe|payable|debt|vendor|creditor/.test(q)) {
    if (ctx.suppliers.totalSuppliers === 0) {
      return `No suppliers registered yet. Add suppliers via **Purchase → Supplier** so you can track payables and reorders.`;
    }
    if (ctx.suppliers.overdueSuppliers.length === 0) {
      return `✅ You don't owe anything to any of your ${ctx.suppliers.totalSuppliers} suppliers. All accounts are settled.`;
    }
    const lines = ctx.suppliers.overdueSuppliers.map(s =>
      `  • **${s.name}** (${s.code}) — Owed ${ctx.currency} ${s.balance} · Terms: ${s.tradingTerms} · Phone: ${s.phone}`
    );
    return [
      `💸 **You owe ${ctx.currency} ${ctx.suppliers.totalOutstandingDebt} to ${ctx.suppliers.overdueSuppliers.length} supplier(s):**`,
      ``,
      ...lines,
      ``,
      `**Recommended action:** Review payment terms and prioritize settling high-balance suppliers first to maintain good relationships. Go to **Purchase → Supplier Payments** to record a payment.`,
    ].join("\n");
  }

  // ===== Expiry =====
  if (/expir|spoil|expire|near.?expire|shelf.?life|going bad|rotten/.test(q)) {
    if (ctx.inventory.expiringSoonCount === 0) {
      return `✅ No products expiring within the next 7 days. Your inventory freshness is good.`;
    }
    const lines = ctx.inventory.expiringSoonItems.slice(0, 15).map(p =>
      `  • **${p.name}** — expires ${p.expiryDate} · ${p.qty} units at risk`
    );
    return [
      `⚠️ **${ctx.inventory.expiringSoonCount} products expiring within 7 days:**`,
      ``,
      ...lines,
      ctx.inventory.expiringSoonCount > 15 ? `\n... and ${ctx.inventory.expiringSoonCount - 15} more.` : ``,
      ``,
      `**Recommended action:** Discount these products 15–30% to move them quickly, or donate to avoid total loss. Go to **Operations Dashboard → Expiry tab** for the full list with suggested discounts.`,
    ].filter(Boolean).join("\n");
  }

  // ===== Best sellers / top products =====
  if (/best.?sell|top.?sell|top.?product|popular|fast.?mov/.test(q)) {
    if (ctx.topProducts.length === 0) {
      return `No sales data for this week yet. Once you start making sales, your best-selling products will appear here. Check back after a few transactions.`;
    }
    const lines = ctx.topProducts.slice(0, 10).map((p, i) =>
      `${i + 1}. **${p.name}** (SKU ${p.sku}) — ${p.qtySold} units sold · Revenue ${ctx.currency} ${p.revenue} · Profit ${ctx.currency} ${p.profit}`
    );
    return [
      `**Top ${ctx.topProducts.length} products by revenue (last 7 days):**`,
      ``,
      ...lines,
      ``,
      `**Insight:** Focus your restocking and promotions on these high movers. They drive the majority of your revenue.`,
    ].join("\n");
  }

  // ===== Cash drawer / shift =====
  if (/cash.*drawer|cash.*register|how.*much.*cash|till|shift|float/.test(q)) {
    if (ctx.shifts.openCount === 0) {
      return `No cashier shifts are currently open. The cash drawer is closed.`;
    }
    const lines = ctx.shifts.openShifts.map(s => {
      const opened = new Date(s.openedAt);
      const hoursAgo = ((Date.now() - opened.getTime()) / 3600000).toFixed(1);
      return `  • **${s.cashier}** — opened ${hoursAgo}h ago · Opening float ${ctx.currency} ${s.float}`;
    });
    return [
      `**${ctx.shifts.openCount} open cashier shift(s):**`,
      ``,
      ...lines,
      ``,
      `To reconcile the drawer, go to **Maintenance → Cashier Shift** and run shift close. This will compare expected vs actual cash and record any variance.`,
    ].join("\n");
  }

  // ===== Expenses =====
  if (/expense|spend|cost|overhead|burn/.test(q)) {
    const total = ctx.expenses.thisMonthTotal;
    const categories = Object.entries(ctx.expenses.byCategory)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([cat, amt]) => `  • ${cat}: ${ctx.currency} ${amt.toFixed(2)}`);
    return [
      `**Expenses this month: ${ctx.currency} ${total}**`,
      ``,
      `Top categories:`,
      ...categories,
      ``,
      `Compare this to your profit of ${ctx.currency} ${ctx.salesSummary.thisMonth.profit} this month — if expenses exceed profit, you're running at a loss.`,
    ].join("\n");
  }

  // ===== Recommendations =====
  if (/recommend|suggest|advice|advis|tip|should i|what.*do|next step|action/.test(q)) {
    const recommendations: string[] = [];
    if (ctx.inventory.lowStockCount > 0) {
      recommendations.push(`1. **Restock ${ctx.inventory.lowStockCount} low-stock products** — go to Stock → Reorder Report. Lost sales from stockouts cost more than the inventory itself.`);
    }
    if (ctx.inventory.expiringSoonCount > 0) {
      recommendations.push(`2. **Discount ${ctx.inventory.expiringSoonCount} expiring products** — Operations Dashboard → Expiry tab. Suggested 15-30% off to move them before they spoil.`);
    }
    if (ctx.suppliers.overdueSuppliers.length > 0) {
      recommendations.push(`3. **Pay ${ctx.currency} ${ctx.suppliers.totalOutstandingDebt} to ${ctx.suppliers.overdueSuppliers.length} suppliers** — record payments in Purchase → Supplier Payments to maintain supply relationships.`);
    }
    if (ctx.customers.totalCustomers > 0 && ctx.customers.vipCustomers === 0) {
      recommendations.push(`4. **Promote your top customers to VIP tier** — they deserve loyalty perks and are your best word-of-mouth marketers.`);
    }
    if (recommendations.length === 0) {
      return `✅ Everything looks healthy! No urgent actions needed. Focus on:\n\n1. **Marketing** — run a promotion on your top sellers to boost this month's revenue.\n2. **Customer acquisition** — invite walk-ins to register for loyalty points.\n3. **Process review** — review recent activity below for any anomalies.`;
    }
    return `**Top recommendations for your store right now:**\n\n${recommendations.join("\n")}\n\nThese are sorted by urgency. Tackle them in order.`;
  }

  // ===== Default fallback =====
  return [
    `I can help you understand your business data. Here's a quick summary based on your current numbers:`,
    ``,
    `📊 **Today:** ${ctx.salesSummary.today.transactions} sales · ${ctx.currency} ${ctx.salesSummary.today.revenue} revenue`,
    `📈 **This month:** ${ctx.currency} ${ctx.salesSummary.thisMonth.revenue} revenue · ${ctx.currency} ${ctx.salesSummary.thisMonth.profit} profit`,
    `📦 **Inventory:** ${ctx.inventory.totalProducts} products worth ${ctx.currency} ${ctx.inventory.totalStockValue}`,
    `👥 **Customers:** ${ctx.customers.totalCustomers} registered`,
    `💸 **Supplier debt:** ${ctx.currency} ${ctx.suppliers.totalOutstandingDebt}`,
    ``,
    `**Try asking me:**`,
    `• "How is my business doing today?"`,
    `• "Which products should I reorder?"`,
    `• "What's my profit this month vs last month?"`,
    `• "Who are my top customers?"`,
    `• "Which suppliers do I owe money to?"`,
    `• "What products are expiring soon?"`,
    `• "Give me recommendations"`,
    ``,
    `_Note: AI-powered natural language is enabled when ZAI_API_KEY is set. Currently using rule-based insights._`,
  ].join("\n");
}
