"use client";

import { useState, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, TrendingUp, TrendingDown, DollarSign, ShoppingCart,
  Package, AlertTriangle, Clock, Users, BarChart3, Activity,
  Zap, Star, ArrowUpRight, ArrowDownRight, Calendar, RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { COMPANY, formatGHS, type Product } from "@/lib/pos-data";

interface OperationsDashboardProps {
  products: Product[];
  onBack: () => void;
  dailyTotal?: number;
  transactionCount?: number;
}

export function OperationsDashboard({ products, onBack, dailyTotal = 0, transactionCount = 0 }: OperationsDashboardProps) {
  const [refreshKey, setRefreshKey] = useState(0);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // ===== Load today's sales from localStorage =====
  /* eslint-disable react-hooks/preserve-manual-memoization */
  const todaySales = useMemo(() => {
    try {
      const raw = localStorage.getItem("sylhn-sales-history");
      if (!raw) return [];
      const all = JSON.parse(raw);
      const today = new Date().toISOString().split("T")[0];
      return all.filter((s: any) => s.timestamp?.startsWith?.(today) || s.date?.startsWith?.(today));
    } catch { return []; }
  }, [refreshKey]);
  /* eslint-enable react-hooks/preserve-manual-memoization */

  // ===== KPI calculations =====
  const kpis = useMemo(() => {
    const totalRevenue = todaySales.reduce((sum: number, s: any) => sum + (s.total || 0), 0);
    const totalItems = todaySales.reduce((sum: number, s: any) =>
      sum + (s.items?.reduce((s2: number, i: any) => s2 + (i.quantity || 0), 0) || 0), 0);
    const avgTransaction = todaySales.length > 0 ? totalRevenue / todaySales.length : 0;
    const lowStockCount = products.filter(p => p.quantity <= p.reorderLevel).length;
    const outOfStockCount = products.filter(p => p.quantity <= 0).length;
    const totalStockValue = products.reduce((sum, p) => sum + (p.quantity * p.costPrice), 0);
    const totalRetailValue = products.reduce((sum, p) => sum + (p.quantity * p.price), 0);

    return {
      totalRevenue,
      totalItems,
      avgTransaction,
      lowStockCount,
      outOfStockCount,
      totalStockValue,
      totalRetailValue,
      transactionCount: todaySales.length || transactionCount,
    };
  }, [todaySales, products, transactionCount]);

  // ===== Low stock products =====
  const lowStockProducts = useMemo(() => {
    return products
      .filter(p => p.quantity <= p.reorderLevel && p.active !== false)
      .sort((a, b) => a.quantity - b.quantity)
      .slice(0, 8);
  }, [products]);

  // ===== Top selling products (from today's sales) =====
  const topProducts = useMemo(() => {
    const productSales: Record<string, { product: Product; qty: number; revenue: number }> = {};
    for (const sale of todaySales) {
      for (const item of (sale.items || [])) {
        const key = item.sku || item.name;
        const product = products.find(p => p.sku === item.sku);
        if (!productSales[key]) {
          productSales[key] = { product: product || item, qty: 0, revenue: 0 };
        }
        productSales[key].qty += item.quantity || 0;
        productSales[key].revenue += item.total || (item.price * item.quantity);
      }
    }
    return Object.values(productSales)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [todaySales, products]);

  // ===== Hourly sales distribution (for chart) =====
  const hourlyData = useMemo(() => {
    const hours = Array.from({ length: 12 }, (_, i) => ({ hour: `${i + 8}:00`, revenue: 0, count: 0 })); // 8am - 7pm
    for (const sale of todaySales) {
      const ts = sale.timestamp || sale.date;
      if (!ts) continue;
      const date = new Date(ts);
      const hour = date.getHours();
      const idx = hour - 8;
      if (idx >= 0 && idx < 12) {
        hours[idx].revenue += sale.total || 0;
        hours[idx].count += 1;
      }
    }
    return hours;
  }, [todaySales]);

  const maxHourlyRevenue = Math.max(...hourlyData.map(h => h.revenue), 1);

  // ===== Recent sales =====
  const recentSales = useMemo(() => {
    return [...todaySales]
      .sort((a, b) => new Date(b.timestamp || b.date).getTime() - new Date(a.timestamp || a.date).getTime())
      .slice(0, 6);
  }, [todaySales]);

  // ===== Category distribution =====
  const categoryStats = useMemo(() => {
    const stats: Record<string, { count: number; value: number }> = {};
    for (const p of products) {
      const cat = p.category || "other";
      if (!stats[cat]) stats[cat] = { count: 0, value: 0 };
      stats[cat].count += 1;
      stats[cat].value += p.quantity * p.costPrice;
    }
    return Object.entries(stats)
      .sort((a, b) => b[1].value - a[1].value)
      .slice(0, 6);
  }, [products]);

  const maxCategoryValue = Math.max(...categoryStats.map(([, v]) => v.value), 1);

  return (
    <div className="min-h-[100dvh] bg-slate-50 flex flex-col">
      {/* ===== Header ===== */}
      <header className="flex-shrink-0 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white shadow-lg sticky top-0 z-30">
        <div className="flex items-center justify-between px-3 sm:px-6 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="h-9 w-9 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition"
              title="Back to POS"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-base sm:text-lg font-bold flex items-center gap-2">
                <Activity className="h-5 w-5 text-emerald-400" />
                Operations Dashboard
              </h1>
              <p className="text-[10px] sm:text-xs text-slate-400">{COMPANY.name} · Real-time overview</p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="hidden sm:flex flex-col items-end">
              <div className="text-[10px] text-slate-400">{now.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' })}</div>
              <div className="text-sm font-mono font-bold">{now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>
            </div>
            <Button
              onClick={() => setRefreshKey(k => k + 1)}
              variant="outline"
              size="sm"
              className="bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white"
            >
              <RefreshCw className="h-4 w-4" />
              <span className="hidden sm:inline ml-1">Refresh</span>
            </Button>
          </div>
        </div>
      </header>

      {/* ===== Main Content ===== */}
      <main className="flex-1 overflow-y-auto p-3 sm:p-6 max-w-7xl mx-auto w-full">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
          <KpiCard
            label="Today's Revenue"
            value={formatGHS(kpis.totalRevenue)}
            icon={<DollarSign className="h-5 w-5" />}
            gradient="from-emerald-500 to-teal-600"
            trend={kpis.totalRevenue > 0 ? "up" : undefined}
          />
          <KpiCard
            label="Transactions"
            value={String(kpis.transactionCount)}
            icon={<ShoppingCart className="h-5 w-5" />}
            gradient="from-blue-500 to-indigo-600"
            trend={kpis.transactionCount > 0 ? "up" : undefined}
          />
          <KpiCard
            label="Items Sold"
            value={String(kpis.totalItems)}
            icon={<Package className="h-5 w-5" />}
            gradient="from-purple-500 to-pink-600"
          />
          <KpiCard
            label="Avg. Sale"
            value={formatGHS(kpis.avgTransaction)}
            icon={<BarChart3 className="h-5 w-5" />}
            gradient="from-amber-500 to-orange-600"
          />
        </div>

        {/* Secondary KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
          <MiniStat
            label="Low Stock Items"
            value={kpis.lowStockCount}
            icon={<AlertTriangle className="h-4 w-4" />}
            color="text-amber-600 bg-amber-50"
            onClick={onBack}
          />
          <MiniStat
            label="Out of Stock"
            value={kpis.outOfStockCount}
            icon={<AlertTriangle className="h-4 w-4" />}
            color="text-rose-600 bg-rose-50"
            onClick={onBack}
          />
          <MiniStat
            label="Stock Value (Cost)"
            value={formatGHS(kpis.totalStockValue)}
            icon={<DollarSign className="h-4 w-4" />}
            color="text-emerald-600 bg-emerald-50"
          />
          <MiniStat
            label="Stock Value (Retail)"
            value={formatGHS(kpis.totalRetailValue)}
            icon={<DollarSign className="h-4 w-4" />}
            color="text-blue-600 bg-blue-50"
          />
        </div>

        {/* Charts + Lists */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6">
          {/* Hourly Sales Chart */}
          <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Clock className="h-4 w-4 text-emerald-600" />
                Hourly Sales Today
              </h2>
              <Badge variant="outline" className="text-[10px]">8 AM – 7 PM</Badge>
            </div>
            <div className="flex items-end gap-1 sm:gap-2 h-40">
              {hourlyData.map((h, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
                  <div className="text-[8px] sm:text-[10px] font-mono text-slate-500 opacity-0 group-hover:opacity-100 transition">
                    {h.revenue > 0 ? formatGHS(h.revenue) : ""}
                  </div>
                  <div
                    className="w-full bg-gradient-to-t from-emerald-500 to-teal-400 rounded-t transition-all hover:from-emerald-600 hover:to-teal-500 min-h-[2px]"
                    style={{ height: `${(h.revenue / maxHourlyRevenue) * 100}%` }}
                    title={`${h.hour}: ${formatGHS(h.revenue)} (${h.count} sales)`}
                  />
                  <div className="text-[7px] sm:text-[9px] text-slate-400 font-mono">{h.hour.replace(":00", "")}</div>
                </div>
              ))}
            </div>
            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-500">Peak hour</span>
              <span className="font-bold text-slate-800">
                {hourlyData.reduce((max, h) => h.revenue > max.revenue ? h : max, hourlyData[0]).hour}
              </span>
            </div>
          </div>

          {/* Top Products */}
          <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Star className="h-4 w-4 text-amber-500" />
                Top Selling Products
              </h2>
              <Badge variant="outline" className="text-[10px]">Today</Badge>
            </div>
            {topProducts.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-sm">
                <Package className="h-8 w-8 mx-auto mb-2 opacity-40" />
                No sales yet today
              </div>
            ) : (
              <div className="space-y-2">
                {topProducts.map((item, i) => (
                  <div key={i} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 transition">
                    <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center text-base flex-shrink-0">
                      {item.product.emoji || "📦"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-slate-800 truncate">{item.product.name}</div>
                      <div className="text-[10px] text-slate-500">{item.qty} sold · {formatGHS(item.revenue)}</div>
                    </div>
                    <Badge className={cn("text-[10px]", i === 0 ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600")}>
                      #{i + 1}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Low Stock + Recent Sales */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6">
          {/* Low Stock Alerts */}
          <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Low Stock Alerts
              </h2>
              <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700">
                {kpis.lowStockCount} items
              </Badge>
            </div>
            {lowStockProducts.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-sm">
                <Package className="h-8 w-8 mx-auto mb-2 opacity-40" />
                All products well stocked
              </div>
            ) : (
              <div className="mobile-scroll-x">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left py-2 px-2 font-semibold text-slate-600">Product</th>
                      <th className="text-right py-2 px-2 font-semibold text-slate-600">Stock</th>
                      <th className="text-right py-2 px-2 font-semibold text-slate-600">Reorder</th>
                      <th className="text-right py-2 px-2 font-semibold text-slate-600">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lowStockProducts.map(p => (
                      <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="py-2 px-2">
                          <div className="flex items-center gap-2">
                            <span>{p.emoji}</span>
                            <span className="font-medium text-slate-800 truncate">{p.name}</span>
                          </div>
                        </td>
                        <td className="py-2 px-2 text-right font-mono font-bold text-slate-800">{p.quantity}</td>
                        <td className="py-2 px-2 text-right font-mono text-slate-500">{p.reorderLevel}</td>
                        <td className="py-2 px-2 text-right">
                          {p.quantity <= 0 ? (
                            <Badge className="bg-rose-100 text-rose-700 text-[9px]">Out</Badge>
                          ) : (
                            <Badge className="bg-amber-100 text-amber-700 text-[9px]">Low</Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Recent Sales */}
          <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <ShoppingCart className="h-4 w-4 text-blue-500" />
                Recent Sales
              </h2>
              <Badge variant="outline" className="text-[10px]">Today</Badge>
            </div>
            {recentSales.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-sm">
                <ShoppingCart className="h-8 w-8 mx-auto mb-2 opacity-40" />
                No sales yet today
              </div>
            ) : (
              <div className="space-y-2">
                {recentSales.map((sale: any, i) => (
                  <div key={i} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 transition">
                    <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                      <Receipt className="h-4 w-4 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-slate-800 truncate">
                        {sale.invoiceNumber || `Sale ${i + 1}`}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {sale.customerName || "Walk-in"} · {sale.items?.length || 0} items
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-bold text-emerald-600">{formatGHS(sale.total || 0)}</div>
                      <div className="text-[9px] text-slate-400">
                        {sale.timestamp ? new Date(sale.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : ""}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Category Distribution */}
        <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-purple-500" />
              Stock Value by Category
            </h2>
            <Badge variant="outline" className="text-[10px]">Cost price</Badge>
          </div>
          <div className="space-y-2">
            {categoryStats.map(([cat, stats]) => (
              <div key={cat} className="flex items-center gap-3">
                <div className="w-20 sm:w-28 text-xs font-medium text-slate-600 capitalize truncate">{cat}</div>
                <div className="flex-1 h-6 bg-slate-100 rounded-lg overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(stats.value / maxCategoryValue) * 100}%` }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-end pr-2"
                  >
                    <span className="text-[10px] font-bold text-white">{stats.count} items</span>
                  </motion.div>
                </div>
                <div className="w-20 sm:w-24 text-right text-xs font-mono font-bold text-slate-700">
                  {formatGHS(stats.value)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center text-[10px] text-slate-400">
          {COMPANY.name} · {COMPANY.address} · {COMPANY.contact}
        </div>
      </main>
    </div>
  );
}

// ===== KPI Card =====
function KpiCard({ label, value, icon, gradient, trend }: {
  label: string;
  value: string;
  icon: React.ReactNode;
  gradient: string;
  trend?: "up" | "down";
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 p-3 sm:p-4 relative overflow-hidden"
    >
      <div className={cn("absolute top-0 right-0 h-20 w-20 rounded-full blur-2xl opacity-20 bg-gradient-to-br", gradient)} />
      <div className="relative">
        <div className="flex items-center justify-between mb-2">
          <div className={cn("h-8 w-8 rounded-lg bg-gradient-to-br flex items-center justify-center text-white", gradient)}>
            {icon}
          </div>
          {trend === "up" && <ArrowUpRight className="h-4 w-4 text-emerald-500" />}
          {trend === "down" && <ArrowDownRight className="h-4 w-4 text-rose-500" />}
        </div>
        <div className="text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</div>
        <div className="text-base sm:text-xl font-bold text-slate-900 mt-1">{value}</div>
      </div>
    </motion.div>
  );
}

// ===== Mini Stat =====
function MiniStat({ label, value, icon, color, onClick }: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        "bg-white rounded-xl shadow-sm ring-1 ring-slate-200 p-3 text-left transition",
        onClick && "hover:ring-2 hover:ring-emerald-300 cursor-pointer"
      )}
    >
      <div className="flex items-center gap-2 mb-1">
        <div className={cn("h-6 w-6 rounded-md flex items-center justify-center", color)}>
          {icon}
        </div>
        <span className="text-[10px] sm:text-xs font-semibold text-slate-500 truncate">{label}</span>
      </div>
      <div className="text-sm sm:text-lg font-bold text-slate-900">{value}</div>
    </button>
  );
}

// Receipt icon (local to avoid extra import)
function Receipt({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" />
      <path d="M8 7h8M8 11h8M8 15h5" />
    </svg>
  );
}
