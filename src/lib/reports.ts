/**
 * SYLHN POS — Report aggregation helpers
 *
 * Server-side aggregations used by /api/dashboard and /api/reports/* endpoints.
 * All functions are pure reads — safe to call without transactions.
 */

import { db } from "./db";
import { cached, cacheDeletePrefix } from "./cache";

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
  // CACHE: SalesSummary is read on every dashboard load (every 30s by SWR).
  // Cache for 15s to deduplicate concurrent requests and reduce Postgres load.
  // After a sale POST, /api/sales should call `cacheDeletePrefix("salesSummary")`.
  return cached("salesSummary:all", () => computeSalesSummary(), 15_000);
}

async function computeSalesSummary(): Promise<SalesSummary> {
  const now = new Date();
  const startOfToday = new Date(now); startOfToday.setHours(0, 0, 0, 0);
  const startOfYesterday = new Date(startOfToday); startOfYesterday.setDate(startOfYesterday.getDate() - 1);
  const startOfWeek = new Date(startOfToday); startOfWeek.setDate(startOfWeek.getDate() - 7);
  const startOfMonth = new Date(startOfToday); startOfMonth.setDate(1);

  // PERFORMANCE FIX: Use `aggregate` instead of `findMany` + JS reduce.
  // Before: 5 queries × N rows transferred over the wire, then JS-reduced.
  // After:  5 queries × 1 aggregate row returned. ~100× faster on large DBs.
  // Each aggregate returns `{ _sum: { total, costOfGoods, grossProfit }, _count: true }`.
  const [
    todayCompletedAgg, todayRefundedAgg, yesterdayAgg, weekAgg, monthAgg,
    todayItemsAgg,
  ] = await Promise.all([
    db.sale.aggregate({
      where: { status: "completed", createdAt: { gte: startOfToday, lte: now } },
      _sum: { total: true, costOfGoods: true, grossProfit: true },
      _count: true,
    }),
    db.sale.aggregate({
      where: { status: "refunded", refundedAt: { gte: startOfToday, lte: now } },
      _sum: { total: true },
      _count: true,
    }),
    db.sale.aggregate({
      where: { status: "completed", createdAt: { gte: startOfYesterday, lt: startOfToday } },
      _sum: { total: true },
      _count: true,
    }),
    db.sale.aggregate({
      where: { status: "completed", createdAt: { gte: startOfWeek, lte: now } },
      _sum: { total: true },
      _count: true,
    }),
    db.sale.aggregate({
      where: { status: "completed", createdAt: { gte: startOfMonth, lte: now } },
      _sum: { total: true },
      _count: true,
    }),
    // Items sold today — single aggregate, not findMany
    db.saleItem.aggregate({
      where: { sale: { status: "completed", createdAt: { gte: startOfToday, lte: now } } },
      _sum: { quantity: true },
    }),
  ]);

  const todayRevenue = todayCompletedAgg._sum.total ?? 0;
  const todayCOGS = todayCompletedAgg._sum.costOfGoods ?? 0;
  const todayProfit = todayCompletedAgg._sum.grossProfit ?? 0;
  const todayTransactionCount = todayCompletedAgg._count ?? 0;
  const itemsSold = todayItemsAgg._sum.quantity ?? 0;

  return {
    today: {
      revenue: todayRevenue,
      costOfGoods: todayCOGS,
      grossProfit: todayProfit,
      transactionCount: todayTransactionCount,
      itemsSold,
      avgTransaction: todayTransactionCount > 0 ? todayRevenue / todayTransactionCount : 0,
      refundedCount: todayRefundedAgg._count ?? 0,
      refundedTotal: todayRefundedAgg._sum.total ?? 0,
    },
    yesterday: {
      revenue: yesterdayAgg._sum.total ?? 0,
      transactionCount: yesterdayAgg._count ?? 0,
    },
    weekToDate: {
      revenue: weekAgg._sum.total ?? 0,
      transactionCount: weekAgg._count ?? 0,
    },
    monthToDate: {
      revenue: monthAgg._sum.total ?? 0,
      transactionCount: monthAgg._count ?? 0,
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

  // PERFORMANCE FIX: Use Prisma `groupBy` to push the aggregation into SQL.
  // Before: fetches ALL saleItems for the period (potentially thousands),
  // then JS-reduces them. After: SQL-side GROUP BY + SUM, returning only
  // the top N rows. ~10-100× faster on large datasets.
  const grouped = await db.saleItem.groupBy({
    by: ["productId", "sku", "name", "emoji"],
    where: { sale: { status: "completed", createdAt: { gte: since } } },
    _sum: {
      quantity: true,
      total: true,
    },
    orderBy: {
      _sum: { total: "desc" },
    },
    take: limit,
  });

  // We still need costPrice to compute profit. Fetch it for the top N products
  // in ONE query — much cheaper than computing profit for every saleItem.
  const productIds = grouped.map(g => g.productId).filter(Boolean) as string[];
  const products = await db.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, costPrice: true },
  });
  const costByPid = new Map(products.map(p => [p.id, p.costPrice]));

  return grouped.map(g => {
    const costPrice = costByPid.get(g.productId || "") ?? 0;
    const qty = g._sum.quantity ?? 0;
    const revenue = g._sum.total ?? 0;
    return {
      productId: g.productId || "",
      sku: g.sku,
      name: g.name,
      emoji: g.emoji || "📦",
      qtySold: qty,
      revenue,
      profit: revenue - (costPrice * qty),
    };
  });
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
  // CACHE: InventorySnapshot is read on every dashboard load.
  // Cache for 30s — stock changes between sales are reflected within 30s.
  // After a sale/adjustment POST, callers should `cacheDeletePrefix("inventorySnapshot")`.
  return cached("inventorySnapshot:all", () => computeInventorySnapshot(), 30_000);
}

async function computeInventorySnapshot(): Promise<InventorySnapshot> {
  // PERFORMANCE FIX: Use `count` + tight `findMany` select instead of loading
  // full rows. Before: loaded every column of every active product just to
  // sum quantity * costPrice. After: count queries return 1 row each, and
  // the findMany only fetches the 4 numbers we actually need.
  const now = Date.now();
  const sevenDaysFromNow = new Date(now + 7 * 24 * 60 * 60 * 1000);

  const [
    totalActiveCount,
    outOfStockCount,
    expiredCount,
    nearExpiryCount,
    products,
  ] = await Promise.all([
    db.product.count({ where: { active: true } }),
    db.product.count({ where: { active: true, quantity: 0 } }),
    db.product.count({
      where: { active: true, expiryDate: { lt: new Date(now) } },
    }),
    db.product.count({
      where: { active: true, expiryDate: { gte: new Date(now), lte: sevenDaysFromNow } },
    }),
    // Tight select — only the 4 fields we use in the loop
    db.product.findMany({
      where: { active: true, quantity: { gt: 0 } },
      select: { quantity: true, costPrice: true, price: true, reorderLevel: true },
    }),
  ]);

  let totalStockValue = 0, potentialRevenue = 0, lowStockCount = 0;
  for (const p of products) {
    totalStockValue += p.quantity * p.costPrice;
    potentialRevenue += p.quantity * p.price;
    if (p.quantity <= p.reorderLevel) lowStockCount++;
  }

  return {
    totalProducts: totalActiveCount,
    activeProducts: totalActiveCount,
    totalStockValue,
    potentialRevenue,
    potentialProfit: potentialRevenue - totalStockValue,
    outOfStockCount,
    lowStockCount,
    expiredCount,
    nearExpiryCount,
  };
}
