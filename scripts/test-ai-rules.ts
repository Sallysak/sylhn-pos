// Test the rule-based AI fallback
import { generateRuleBasedResponse, type BusinessContext } from '../src/lib/ai-rules';

const ctx: BusinessContext = {
  company: "SYLHN COMPANY LTD",
  currency: "GHS",
  currentTime: new Date().toISOString(),
  salesSummary: {
    today: { revenue: "245.50", profit: "78.20", transactions: 12 },
    thisWeek: { revenue: "1842.75", profit: "552.10", transactions: 87 },
    thisMonth: { revenue: "7321.40", profit: "2198.65", transactions: 342 },
    lastMonth: { revenue: "6890.20", profit: "1950.30", transactions: 318 },
    monthOverMonthGrowth: "6.3%",
  },
  paymentMethods: { cash: 4321.40, momo: 1850.00, card: 1150.00 },
  topProducts: [
    { name: "Coca-Cola 500ml", sku: "COKE-500", qtySold: 124, revenue: "372.00", profit: "186.00" },
    { name: "Bread Loaf", sku: "BREAD-001", qtySold: 89, revenue: "267.00", profit: "89.00" },
  ],
  inventory: {
    totalProducts: 247,
    totalStockValue: "15420.50",
    totalRetailValue: "22890.75",
    potentialProfit: "7470.25",
    lowStockCount: 8,
    lowStockItems: [
      { name: "Coca-Cola 500ml", qty: 4, reorderLevel: 12, unit: "each" },
      { name: "Sugar 1kg", qty: 2, reorderLevel: 10, unit: "pack" },
    ],
    expiringSoonCount: 3,
    expiringSoonItems: [
      { name: "Milk Sachet", expiryDate: "2026-07-25", qty: 18 },
    ],
  },
  suppliers: {
    totalSuppliers: 14,
    totalOutstandingDebt: "3240.00",
    overdueSuppliers: [
      { name: "Achimota Wholesale", code: "SUP-001", balance: "1840.00", tradingTerms: "Net 30", phone: "+233 24 111 2222" },
    ],
  },
  customers: {
    totalCustomers: 156,
    topCustomers: [
      { name: "Ama Osei", tier: "gold", totalSpent: "4250.00", visits: 42, points: 425 },
    ],
    vipCustomers: 12,
  },
  expenses: {
    thisMonthTotal: "1850.00",
    byCategory: { rent: 800, utilities: 250, salaries: 600, marketing: 200 },
  },
  shifts: {
    openCount: 1,
    openShifts: [
      { cashier: "Sarah Johnson", float: "200.00", openedAt: new Date(Date.now() - 3 * 3600000).toISOString() },
    ],
  },
  recentActivity: [],
};

console.log("===== Test 1: 'How is my business doing today?' =====");
console.log(generateRuleBasedResponse("How is my business doing today?", ctx));

console.log("\n\n===== Test 2: 'Which products should I reorder?' =====");
console.log(generateRuleBasedResponse("Which products should I reorder?", ctx));

console.log("\n\n===== Test 3: 'What's my profit this month vs last month?' =====");
console.log(generateRuleBasedResponse("What's my profit this month vs last month?", ctx));

console.log("\n\n===== Test 4: 'Who are my top customers?' =====");
console.log(generateRuleBasedResponse("Who are my top customers?", ctx));

console.log("\n\n===== Test 5: 'Give me recommendations' =====");
console.log(generateRuleBasedResponse("Give me recommendations", ctx));
