/**
 * SYLHN POS — Report aggregation helpers
 *
 * Server-side aggregations used by /api/dashboard and /api/reports/* endpoints.
 * All functions are pure reads — safe to call without transactions.
 */

import { db } from "./db";

// ===== Today's sales summary =====
export interface SalesSummary {
  today: {
    revenue: number;
    costOfGoods: number;
    grossProfit: number;
    transactionCount: number;
    itemsSold: number;
    avgTransaction: number;
    refundedCount: number;
    refundedTotal: number;
  };
  yesterday: {
    revenue: number;
    transactionCount: number;
  };
  weekToDate: {
    revenue: number;
    transactionCount: number;
  };
  monthToDate: {
    revenue: number;
    transactionCount: number;
  };
}

export async function getSalesSummary(): Promise<SalesSummary> {
  const now = new Date();
  const startOfToday = new Date(now); startOfToday.setHours(0, 0, 0, 0);
  const startOfYesterday = new Date(startOfToday); startOfYesterday.setDate(startOfYesterday.getDate() - 1);
  const startOfWeek = new Date(startOfToday); startOfWeek.setDate(startOfWeek.getDate() - 7);
  const startOfMonth = new Date(startOfToday); startOfMonth.setDate(1);

  const [
    todayCompleted, todayRefunded, yesterdayCompleted, weekCompleted, monthCompleted,
  ] = await Promise.all([
    db.sale.findMany({
      where: { status: "completed", createdAt: { gte: startOfToday, lte: now } },
      select: { total: true, costOfGoods: true, grossProfit: true, amountPaid: true },
    }),
    db.sale.findMany({
      where: { status: "refunded", refundedAt: { gte: startOfToday, lte: now } },
      select: { total: true },
    }),
    db.sale.findMany({
      where: { status: "completed", createdAt: { gte: startOfYesterday, lt: startOfToday } },
      select: { total: true },
    }),
    db.sale.findMany({
      where: { status: "completed", createdAt: { gte: startOfWeek, lte: now } },
      select: { total: true },
    }),
    db.sale.findMany({
      where: { status: "completed", createdAt: { gte: startOfMonth, lte: now } },
      select: { total: true },
    }),
  ]);

  const todayRevenue = todayCompleted.reduce((s, x) => s + x.total, 0);
  const todayCOGS = todayCompleted.reduce((s, x) => s + (x.costOfGoods || 0), 0);
  const todayProfit = todayCompleted.reduce((s, x) => s + (x.grossProfit || 0), 0);

  // Items sold today (separate query because SaleItem total not in select above)
  const todayItems = await db.saleItem.findMany({
    where: { sale: { status: "completed", createdAt: { gte: startOfToday, lte: now } } },
    select: { quantity: true },
  });
  const itemsSold = todayItems.reduce((s, x) => s + x.quantity, 0);

  return {
    today: {
      revenue: todayRevenue,
      costOfGoods: todayCOGS,
      grossProfit: todayProfit,
      transactionCount: todayCompleted.length,
      itemsSold,
      avgTransaction: todayCompleted.length > 0 ? todayRevenue / todayCompleted.length : 0,
      refundedCount: todayRefunded.length,
      refundedTotal: todayRefunded.reduce((s, x) => s + x.total, 0),
    },
    yesterday: {
      revenue: yesterdayCompleted.reduce((s, x) => s + x.total, 0),
      transactionCount: yesterdayCompleted.length,
    },
    weekToDate: {
      revenue: weekCompleted.reduce((s, x) => s + x.total, 0),
      transactionCount: weekCompleted.length,
    },
    monthToDate: {
      revenue: monthCompleted.reduce((s, x) => s + x.total, 0),
      transactionCount: monthCompleted.length,
    },
  };
}

// ===== Top products by revenue (date range) =====
export interface TopProduct {
  productId: string;
  sku: string;
  name: string;
  emoji: string;
  qtySold: number;
  revenue: number;
  profit: number;
}

export async function getTopProducts(days = 30, limit = 10): Promise<TopProduct[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const items = await db.saleItem.findMany({
    where: { sale: { status: "completed", createdAt: { gte: since } } },
    select: {
      productId: true, sku: true, name: true, emoji: true,
      quantity: true, total: true, costPrice: true,
    },
  });

  const agg: Record<string, TopProduct & { _costPriceSum: number }> = {};
  for (const it of items) {
    const key = it.productId || it.sku;
    if (!agg[key]) {
      agg[key] = {
        productId: it.productId || "", sku: it.sku, name: it.name, emoji: it.emoji || "📦",
        qtySold: 0, revenue: 0, profit: 0, _costPriceSum: 0,
      };
    }
    agg[key].qtySold += it.quantity;
    agg[key].revenue += it.total;
    agg[key]._costPriceSum += (it.costPrice || 0) * it.quantity;
  }
  for (const k of Object.keys(agg)) {
    agg[k].profit = agg[k].revenue - agg[k]._costPriceSum;
    delete (agg[k] as any)._costPriceSum;
  }

  return Object.values(agg)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit);
}

// ===== Low-stock reorder list with preferred supplier =====
export interface ReorderItem {
  productId: string;
  sku: string;
  name: string;
  emoji: string;
  category: string;
  quantity: number;
  reorderLevel: number;
  unit: string;
  costPrice: number;
  suggestedQty: number;
  reorderCost: number;
  preferredSupplierId: string | null;
  preferredSupplierName: string | null;
  preferredSupplierCode: string | null;
  preferredSupplierCost: number | null;
  leadTimeDays: number | null;
}

export async function getLowStockReorder(): Promise<ReorderItem[]> {
  const products = await db.product.findMany({
    where: { active: true, quantity: { lte: db.product.fields.reorderLevel } },
    include: {
      suppliers: {
        where: { preferred: true },
        include: { supplier: { select: { id: true, name: true, code: true } } },
        take: 1,
      },
    },
    orderBy: { quantity: "asc" },
  });

  // SQLite doesn't support `lte: <column>` comparison, so we filter in JS.
  // (Prisma can't compare columns on SQLite.)
  return products
    .filter(p => p.quantity <= p.reorderLevel)
    .map(p => {
      const suggestedQty = Math.max(0, (p.reorderLevel * 2) - p.quantity);
      const sup = p.suppliers[0];
      return {
        productId: p.id, sku: p.sku, name: p.name, emoji: p.emoji,
        category: p.category, quantity: p.quantity, reorderLevel: p.reorderLevel,
        unit: p.unit, costPrice: p.costPrice,
        suggestedQty,
        reorderCost: suggestedQty * (sup?.supplierCost || p.costPrice),
        preferredSupplierId: sup?.supplierId || null,
        preferredSupplierName: sup?.supplier.name || null,
        preferredSupplierCode: sup?.supplier.code || null,
        preferredSupplierCost: sup?.supplierCost || null,
        leadTimeDays: sup?.leadTimeDays || null,
      };
    });
}

// ===== Expiry tracking =====
export interface ExpiryItem {
  productId: string;
  sku: string;
  name: string;
  emoji: string;
  quantity: number;
  unit: string;
  expiryDate: Date;
  daysUntilExpiry: number;
  urgency: "expired" | "critical" | "warning" | "soon";
  stockValueAtRisk: number;
}

export async function getExpiryTracking(): Promise<ExpiryItem[]> {
  const products = await db.product.findMany({
    where: { active: true, expiryDate: { not: null } },
    orderBy: { expiryDate: "asc" },
  });
  const now = Date.now();
  return products
    .map(p => {
      const expiry = p.expiryDate!;
      const daysUntilExpiry = Math.ceil((expiry.getTime() - now) / (1000 * 60 * 60 * 24));
      let urgency: ExpiryItem["urgency"] = "soon";
      if (daysUntilExpiry < 0) urgency = "expired";
      else if (daysUntilExpiry <= 7) urgency = "critical";
      else if (daysUntilExpiry <= 14) urgency = "warning";
      else if (daysUntilExpiry <= 30) urgency = "soon";
      else urgency = "ok" as any; // filter out below
      return {
        productId: p.id, sku: p.sku, name: p.name, emoji: p.emoji,
        quantity: p.quantity, unit: p.unit, expiryDate: expiry,
        daysUntilExpiry, urgency, stockValueAtRisk: p.quantity * p.costPrice,
      };
    })
    .filter(p => (p.urgency as string) !== "ok");
}

// ===== Supplier aging report =====
export interface SupplierAging {
  supplierId: string;
  supplierCode: string;
  supplierName: string;
  totalBalance: number;
  current: number;       // 0-30 days
  days30to60: number;    // 31-60 days
  days60plus: number;    // 60+ days
  creditLimit: number;
  tradingTerms: string;
}

export async function getSupplierAging(): Promise<SupplierAging[]> {
  const suppliers = await db.supplier.findMany({
    where: { active: true },
    include: {
      purchases: {
        where: { status: { in: ["received", "ordered"] } },
        select: { total: true, amountPaid: true, createdAt: true },
      },
    },
    orderBy: { name: "asc" },
  });

  const now = Date.now();
  const DAY_MS = 1000 * 60 * 60 * 24;
  const cutoff30 = now - 30 * DAY_MS;
  const cutoff60 = now - 60 * DAY_MS;

  return suppliers.map(s => {
    let current = 0, d30 = 0, d60 = 0;
    for (const p of s.purchases) {
      const outstanding = Math.max(0, p.total - p.amountPaid);
      if (outstanding <= 0) continue;
      const ts = p.createdAt.getTime();
      if (ts >= cutoff30) current += outstanding;
      else if (ts >= cutoff60) d30 += outstanding;
      else d60 += outstanding;
    }
    const totalBalance = current + d30 + d60;
    return {
      supplierId: s.id,
      supplierCode: s.code,
      supplierName: s.name,
      totalBalance,
      current,
      days30to60: d30,
      days60plus: d60,
      creditLimit: s.creditLimit,
      tradingTerms: s.tradingTerms,
    };
  }).filter(s => s.totalBalance > 0 || s.creditLimit > 0);
}

// ===== Hourly sales distribution (today) =====
export interface HourlyBucket {
  hour: number;        // 0-23
  revenue: number;
  transactionCount: number;
}

export async function getHourlySales(): Promise<HourlyBucket[]> {
  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
  const sales = await db.sale.findMany({
    where: { status: "completed", createdAt: { gte: startOfToday } },
    select: { total: true, createdAt: true },
  });
  const buckets: HourlyBucket[] = Array.from({ length: 24 }, (_, h) => ({ hour: h, revenue: 0, transactionCount: 0 }));
  for (const s of sales) {
    const h = s.createdAt.getHours();
    buckets[h].revenue += s.total;
    buckets[h].transactionCount += 1;
  }
  return buckets;
}

// ===== Daily sales trend (last N days) =====
export interface DailyBucket {
  date: string;        // YYYY-MM-DD
  revenue: number;
  transactionCount: number;
  profit: number;
}

export async function getDailyTrend(days = 14): Promise<DailyBucket[]> {
  const since = new Date();
  since.setDate(since.getDate() - (days - 1));
  since.setHours(0, 0, 0, 0);

  const sales = await db.sale.findMany({
    where: { status: "completed", createdAt: { gte: since } },
    select: { total: true, grossProfit: true, createdAt: true },
  });

  const buckets: Record<string, DailyBucket> = {};
  for (let i = 0; i < days; i++) {
    const d = new Date(since);
    d.setDate(d.getDate() + i);
    const key = d.toISOString().split("T")[0];
    buckets[key] = { date: key, revenue: 0, transactionCount: 0, profit: 0 };
  }
  for (const s of sales) {
    const key = s.createdAt.toISOString().split("T")[0];
    if (buckets[key]) {
      buckets[key].revenue += s.total;
      buckets[key].profit += s.grossProfit || 0;
      buckets[key].transactionCount += 1;
    }
  }
  return Object.values(buckets).sort((a, b) => a.date.localeCompare(b.date));
}

// ===== Inventory snapshot =====
export interface InventorySnapshot {
  totalProducts: number;
  activeProducts: number;
  totalStockValue: number;       // sum(qty * costPrice)
  potentialRevenue: number;      // sum(qty * price)
  potentialProfit: number;       // potentialRevenue - totalStockValue
  outOfStockCount: number;
  lowStockCount: number;
  expiredCount: number;
  nearExpiryCount: number;       // <= 7 days
}

export async function getInventorySnapshot(): Promise<InventorySnapshot> {
  const products = await db.product.findMany({
    where: { active: true },
    select: { quantity: true, costPrice: true, price: true, reorderLevel: true, expiryDate: true },
  });
  const now = Date.now();
  let totalStockValue = 0, potentialRevenue = 0;
  let outOfStock = 0, lowStock = 0, expired = 0, nearExpiry = 0;

  for (const p of products) {
    totalStockValue += p.quantity * p.costPrice;
    potentialRevenue += p.quantity * p.price;
    if (p.quantity === 0) outOfStock++;
    else if (p.quantity <= p.reorderLevel) lowStock++;
    if (p.expiryDate) {
      const days = Math.ceil((p.expiryDate.getTime() - now) / (1000 * 60 * 60 * 24));
      if (days < 0) expired++;
      else if (days <= 7) nearExpiry++;
    }
  }

  return {
    totalProducts: products.length,
    activeProducts: products.length,
    totalStockValue,
    potentialRevenue,
    potentialProfit: potentialRevenue - totalStockValue,
    outOfStockCount: outOfStock,
    lowStockCount: lowStock,
    expiredCount: expired,
    nearExpiryCount: nearExpiry,
  };
}
