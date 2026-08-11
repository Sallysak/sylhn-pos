"use client";

import { authedFetch } from "@/lib/client-auth";
import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, TrendingUp, TrendingDown, Minus, Loader2, Download,
  AlertTriangle, CheckCircle2, X, Search, Filter,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { COMPANY, formatGHS } from "@/lib/pos-data";

interface ProductMargin {
  productId: string;
  sku: string;
  name: string;
  emoji: string;
  category: string;
  unitsSold: number;
  revenue: number;
  cost: number;
  profit: number;
  marginPct: number;
  markupPct: number;
  lastCost: number;
  lastLandedCost: number;
  landedCostRefNo: string;
  landedCostDate: string | null;
  currentStock: number;
  currentPrice: number;
  suggestedPrice: number;
  flag: "profit" | "loss" | "break-even";
  usingLandedCost: boolean;
}

interface Summary {
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
  avgMarginPct: number;
  totalProducts: number;
  profitableCount: number;
  lossCount: number;
  breakEvenCount: number;
  usingLandedCostCount: number;
  days: number;
  category: string;
}

interface Props {
  onBack: () => void;
}

export function ProfitMarginReport({ onBack }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<ProductMargin[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [days, setDays] = useState(30);
  const [category, setCategory] = useState("");
  const [sortBy, setSortBy] = useState<"profit" | "margin" | "revenue" | "units">("profit");
  const [minMargin, setMinMargin] = useState(0); // 0 = show all
  const [search, setSearch] = useState("");

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("days", String(days));
      if (category) params.set("category", category);
      params.set("sortBy", sortBy);
      if (minMargin > 0) params.set("minMargin", String(minMargin));
      const res = await authedFetch(`/api/reports/profit-margin?${params}`);
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setProducts(data.products || []);
      setSummary(data.summary || null);
    } catch (e) {
      toast({ title: "Failed to load report", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [days, category, sortBy, minMargin]);

  // Filter by search query (client-side)
  const filtered = useMemo(() => {
    if (!search) return products;
    const q = search.toLowerCase();
    return products.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q)
    );
  }, [products, search]);

  // CSV export
  const exportCSV = () => {
    const headers = ["SKU", "Name", "Category", "Units Sold", "Revenue", "Cost", "Profit", "Margin %", "Last Cost", "Landed Cost", "Current Price", "Suggested Price", "Stock", "Flag"];
    const rows = filtered.map(p => [
      p.sku, p.name, p.category, p.unitsSold,
      p.revenue.toFixed(2), p.cost.toFixed(2), p.profit.toFixed(2),
      p.marginPct.toFixed(1) + "%",
      p.lastCost.toFixed(2),
      p.lastLandedCost > 0 ? p.lastLandedCost.toFixed(2) : "—",
      p.currentPrice.toFixed(2),
      p.suggestedPrice.toFixed(2),
      p.currentStock,
      p.flag,
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `profit-margin-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "CSV exported", description: `${filtered.length} products` });
  };

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-slate-50 to-emerald-50/30">
      {/* Header */}
      <header className="flex-shrink-0 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white shadow-lg">
        <div className="flex items-center justify-between px-4 sm:px-6 py-3">
          <div className="flex items-center gap-4 min-w-0">
            <button onClick={onBack} className="h-9 w-9 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition flex-shrink-0">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="h-9 w-9 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center ring-1 ring-white/20 flex-shrink-0">
                <TrendingUp className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="font-bold text-base leading-tight">Profit Margin Report</div>
                <div className="text-[10px] text-emerald-100/90 truncate">{COMPANY.name} · Uses landed cost data for true margins</div>
              </div>
            </div>
          </div>
          <button onClick={exportCSV} disabled={loading || filtered.length === 0} className="h-9 px-3 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-50">
            <Download className="h-4 w-4" /> <span className="hidden sm:inline">Export CSV</span>
          </button>
        </div>
      </header>

      {/* Filters */}
      <div className="flex-shrink-0 bg-white border-b border-slate-200 shadow-sm px-4 sm:px-6 py-2 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5">
          <Filter className="h-3.5 w-3.5 text-slate-400" />
          <select value={days} onChange={(e) => setDays(parseInt(e.target.value))} className="h-8 px-2 rounded-lg bg-slate-100 text-xs outline-none">
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
            <option value={365}>Last year</option>
          </select>
        </div>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="h-8 px-2 rounded-lg bg-slate-100 text-xs outline-none min-w-[140px]">
          <option value="">All Categories</option>
          {/* Categories derived from current products */}
          {Array.from(new Set(products.map(p => p.category))).filter(Boolean).sort().map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)} className="h-8 px-2 rounded-lg bg-slate-100 text-xs outline-none">
          <option value="profit">Sort: Profit (high → low)</option>
          <option value="margin">Sort: Margin % (low → high)</option>
          <option value="revenue">Sort: Revenue (high → low)</option>
          <option value="units">Sort: Units Sold (high → low)</option>
        </select>
        <select value={minMargin} onChange={(e) => setMinMargin(parseFloat(e.target.value))} className="h-8 px-2 rounded-lg bg-slate-100 text-xs outline-none">
          <option value={0}>All margins</option>
          <option value={5}>Margin &lt; 5%</option>
          <option value={10}>Margin &lt; 10%</option>
          <option value={15}>Margin &lt; 15%</option>
          <option value={20}>Margin &lt; 20%</option>
        </select>
        <div className="relative flex-1 min-w-[160px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search product, SKU, category…"
            className="w-full h-8 pl-8 pr-3 rounded-lg bg-slate-100 text-xs outline-none focus:ring-2 focus:ring-emerald-400"
          />
        </div>
      </div>

      {/* Content */}
      <main className="flex-1 overflow-hidden p-3 sm:p-6">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <Loader2 className="h-10 w-10 animate-spin text-emerald-500" />
          </div>
        ) : (
          <div className="h-full bg-white rounded-2xl shadow-lg ring-1 ring-slate-200/60 overflow-hidden flex flex-col">
            {/* Summary KPIs */}
            {summary && (
              <div className="flex-shrink-0 grid grid-cols-2 lg:grid-cols-5 gap-3 p-4 bg-gradient-to-br from-slate-50 to-white border-b border-slate-200">
                <KPI label="Total Revenue" value={formatGHS(summary.totalRevenue)} color="emerald" />
                <KPI label="Total Cost" value={formatGHS(summary.totalCost)} color="rose" />
                <KPI label="Total Profit" value={formatGHS(summary.totalProfit)} color={summary.totalProfit >= 0 ? "emerald" : "rose"} />
                <KPI label="Avg Margin" value={`${summary.avgMarginPct}%`} color={summary.avgMarginPct >= 15 ? "emerald" : summary.avgMarginPct >= 5 ? "amber" : "rose"} />
                <KPI label="Products" value={`${summary.totalProducts}`} color="indigo" detail={`${summary.profitableCount} profit · ${summary.lossCount} loss`} />
              </div>
            )}

            {/* Loss-making alert */}
            {summary && summary.lossCount > 0 && (
              <div className="flex-shrink-0 px-4 py-2 bg-rose-50 border-b border-rose-200 flex items-center gap-2 text-xs text-rose-800">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                <span>
                  <strong>{summary.lossCount} product{summary.lossCount === 1 ? "" : "s"}</strong> are selling at a loss. Consider raising prices or switching suppliers. Click "Sort: Margin % (low → high)" to see them first.
                </span>
              </div>
            )}

            {/* Products table */}
            <div className="flex-1 overflow-auto scroll-premium">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-slate-800 text-white text-[10px] uppercase tracking-wide z-10">
                  <tr>
                    <th className="text-left px-3 py-2.5 font-semibold">Product</th>
                    <th className="text-left px-2 py-2.5 font-semibold">Category</th>
                    <th className="text-center px-2 py-2.5 font-semibold">Units</th>
                    <th className="text-right px-2 py-2.5 font-semibold">Revenue</th>
                    <th className="text-right px-2 py-2.5 font-semibold">Cost</th>
                    <th className="text-right px-2 py-2.5 font-semibold">Profit</th>
                    <th className="text-right px-2 py-2.5 font-semibold">Margin</th>
                    <th className="text-right px-2 py-2.5 font-semibold">Landed Cost</th>
                    <th className="text-right px-2 py-2.5 font-semibold">Suggested Price</th>
                    <th className="text-center px-2 py-2.5 font-semibold">Stock</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-4 py-12 text-center text-slate-400">
                        <TrendingUp className="h-10 w-10 mx-auto mb-2 opacity-40" />
                        <div className="text-sm font-bold">No products match your filters</div>
                        <div className="text-xs mt-1">Try a wider date range or different category</div>
                      </td>
                    </tr>
                  ) : filtered.map(p => (
                    <tr key={p.productId} className={cn(
                      "hover:bg-slate-50 transition",
                      p.flag === "loss" && "bg-rose-50/40"
                    )}>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5">
                          <span className="text-base">{p.emoji}</span>
                          <div className="min-w-0">
                            <div className="font-semibold text-slate-800 truncate max-w-[200px]">{p.name}</div>
                            <div className="text-[9px] text-slate-400 font-mono">{p.sku}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-2 py-2 text-slate-600">{p.category}</td>
                      <td className="px-2 py-2 text-center font-mono text-slate-700">{p.unitsSold}</td>
                      <td className="px-2 py-2 text-right font-mono font-semibold text-slate-800">{formatGHS(p.revenue)}</td>
                      <td className="px-2 py-2 text-right font-mono text-slate-600">{formatGHS(p.cost)}</td>
                      <td className={cn("px-2 py-2 text-right font-mono font-bold", p.flag === "profit" ? "text-emerald-700" : p.flag === "loss" ? "text-rose-700" : "text-slate-500")}>
                        {p.profit >= 0 ? "+" : ""}{formatGHS(p.profit)}
                      </td>
                      <td className={cn("px-2 py-2 text-right font-mono font-bold", p.flag === "profit" ? "text-emerald-700" : p.flag === "loss" ? "text-rose-700" : "text-slate-500")}>
                        {p.marginPct}%
                      </td>
                      <td className="px-2 py-2 text-right font-mono text-xs">
                        {p.lastLandedCost > 0 ? (
                          <div>
                            <div className="text-slate-700">{formatGHS(p.lastLandedCost)}</div>
                            <div className="text-[9px] text-slate-400" title={p.landedCostRefNo}>{p.landedCostRefNo}</div>
                          </div>
                        ) : (
                          <div className="text-slate-400">
                            <div>{formatGHS(p.lastCost)}</div>
                            <div className="text-[9px]">raw cost</div>
                          </div>
                        )}
                      </td>
                      <td className="px-2 py-2 text-right font-mono">
                        <div className={cn("font-semibold", p.suggestedPrice > p.currentPrice ? "text-amber-600" : "text-slate-500")}>
                          {formatGHS(p.suggestedPrice)}
                        </div>
                        {p.suggestedPrice > p.currentPrice && (
                          <div className="text-[9px] text-amber-600">raise ↑</div>
                        )}
                      </td>
                      <td className="px-2 py-2 text-center">
                        <span className={cn("font-mono text-xs", p.currentStock <= 5 ? "text-rose-600 font-bold" : "text-slate-600")}>
                          {p.currentStock}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            {summary && (
              <div className="flex-shrink-0 px-4 py-2 bg-slate-50 border-t border-slate-200 text-[10px] text-slate-500 flex items-center justify-between flex-wrap gap-2">
                <div>
                  Showing <strong>{filtered.length}</strong> of <strong>{summary.totalProducts}</strong> products ·
                  Window: <strong>{summary.days} days</strong> ·
                  Category: <strong>{summary.category}</strong>
                </div>
                <div>
                  <strong className="text-emerald-600">{summary.usingLandedCostCount}</strong> products use landed cost (true margin) ·
                  <strong className="text-amber-600"> {summary.totalProducts - summary.usingLandedCostCount}</strong> use raw cost
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function KPI({ label, value, color, detail }: { label: string; value: string; color: string; detail?: string }) {
  const colors: Record<string, string> = {
    emerald: "from-emerald-500 to-teal-600",
    rose: "from-rose-500 to-pink-600",
    amber: "from-amber-500 to-orange-600",
    indigo: "from-indigo-500 to-blue-600",
  };
  return (
    <div className="bg-white rounded-xl ring-1 ring-slate-200 p-3">
      <div className={cn("h-1 w-full rounded-full bg-gradient-to-r mb-2", colors[color])} />
      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</div>
      <div className="text-lg font-bold text-slate-800 mt-0.5 truncate">{value}</div>
      {detail && <div className="text-[10px] text-slate-400 mt-0.5">{detail}</div>}
    </div>
  );
}
