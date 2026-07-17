"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, TrendingUp, TrendingDown, Package, AlertTriangle,
  DollarSign, BarChart3, Sparkles, Loader2, RefreshCw, Plus,
  CheckCircle2, Calendar, Target, Zap, ShoppingCart,
} from "lucide-react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, Area, AreaChart,
} from "recharts";
import { useToast } from "@/hooks/use-toast";

const URGENCY_COLORS: Record<string, string> = {
  critical: "#dc2626",
  high: "#ea580c",
  medium: "#ca8a04",
  low: "#16a34a",
};

const URGENCY_BG: Record<string, string> = {
  critical: "bg-rose-50 text-rose-700 ring-rose-200",
  high: "bg-orange-50 text-orange-700 ring-orange-200",
  medium: "bg-amber-50 text-amber-700 ring-amber-200",
  low: "bg-emerald-50 text-emerald-700 ring-emerald-200",
};

interface ForecastData {
  success: boolean;
  forecastDays: number;
  summary: any;
  aiSummary: string;
  forecasts: any[];
  accuracy: any;
  generatedAt: string;
}

export default function ForecastPage() {
  const { toast } = useToast();
  const [data, setData] = useState<ForecastData | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [creatingPOs, setCreatingPOs] = useState(false);

  const fetchForecast = useCallback(async (forecastDays: number, save = false) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/ai-forecast?days=${forecastDays}${save ? "&save=true" : ""}`, { credentials: "include" });
      if (!res.ok) {
        toast({ title: "Failed to load forecast", variant: "destructive" });
        return;
      }
      const json = await res.json();
      setData(json);
    } catch (e: any) {
      toast({ title: "Network error", description: e?.message || "", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchForecast(days); }, [days, fetchForecast]);

  // Create POs for all critical + high urgency items
  const handleCreatePOs = async () => {
    if (!data) return;
    const urgent = data.forecasts.filter(f => f.urgency === "critical" || f.urgency === "high");
    if (urgent.length === 0) {
      toast({ title: "No urgent items to reorder" });
      return;
    }
    if (!confirm(`Create purchase orders for ${urgent.length} product(s) that need immediate reordering? Total cost: GHS ${urgent.reduce((s, f) => s + f.reorderCost, 0).toFixed(2)}`)) return;

    setCreatingPOs(true);
    // Group by supplier
    const bySupplier: Record<string, any[]> = {};
    for (const f of urgent) {
      const key = f.preferredSupplierId || "unassigned";
      if (!bySupplier[key]) bySupplier[key] = [];
      bySupplier[key].push(f);
    }

    let successCount = 0;
    let totalCost = 0;
    for (const [suppKey, items] of Object.entries(bySupplier)) {
      const poItems = items.map(f => ({
        productId: f.productId,
        partNo: f.sku,
        details: f.name,
        emoji: f.emoji,
        quantity: f.recommendedReorderQty,
        cost: f.costPrice,
        tax: false,
        total: +(f.costPrice * f.recommendedReorderQty).toFixed(2),
      }));
      const poTotal = poItems.reduce((s, i) => s + i.total, 0);
      totalCost += poTotal;
      try {
        const res = await fetch("/api/purchases", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            type: "purchase",
            supplierId: items[0].preferredSupplierId || null,
            supplierName: items[0].preferredSupplierName || "Unassigned",
            status: "ordered",
            subtotal: poTotal,
            taxAmount: 0,
            total: poTotal,
            amountPaid: 0,
            notes: `Auto-generated from AI forecast — ${items.length} items below reorder threshold`,
            createdBy: "AI Forecast Dashboard",
            items: poItems,
          }),
        });
        if (res.ok) successCount++;
      } catch (e) {
        console.error("PO creation failed:", e);
      }
    }
    toast({
      title: `${successCount} PO(s) created`,
      description: `Total reorder cost: GHS ${totalCost.toFixed(2)} — ${Object.keys(bySupplier).length} suppliers`,
      variant: successCount > 0 ? "default" : "destructive",
    });
    setCreatingPOs(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-violet-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-violet-600 mx-auto mb-4" />
          <div className="text-sm font-semibold text-slate-700">Generating AI Demand Forecast...</div>
          <div className="text-xs text-slate-500 mt-1">Analyzing 90 days of sales history with day-of-week seasonality</div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { summary, aiSummary, forecasts, accuracy } = data;

  // Chart data for aggregate seasonality (average across all products)
  const seasonalityChart = forecasts[0]?.seasonality?.chart || [];
  const aggregateSeasonality = DAY_ABBR.map((day, i) => {
    const totalVelocity = forecasts.reduce((s, f) => s + (f.seasonality?.dowVelocity?.[i] || 0), 0);
    return {
      day,
      velocity: Math.round(totalVelocity * 100) / 100,
      multiplier: forecasts[0]?.seasonality?.multipliers?.[i] || 1,
    };
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-violet-50 to-indigo-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-violet-700 via-purple-700 to-indigo-700 text-white shadow-lg sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="/" className="h-9 w-9 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center transition">
              <ArrowLeft className="h-4 w-4" />
            </a>
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                <h1 className="text-lg font-bold">AI Demand Forecast</h1>
              </div>
              <div className="text-[10px] text-violet-100/80">Predicting stock needs based on {summary.dataPointsAnalyzed} data points from 90 days of sales</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {[7, 14, 30, 60, 90].map(d => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`h-8 px-3 rounded-lg text-xs font-bold transition ${
                  days === d ? "bg-white text-violet-700" : "bg-white/15 hover:bg-white/25 text-white"
                }`}
              >
                {d}d
              </button>
            ))}
            <button
              onClick={() => fetchForecast(days, true)}
              className="h-8 w-8 rounded-lg bg-white/15 hover:bg-white/25 flex items-center justify-center transition"
              title="Refresh + save snapshot"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <SummaryCard
            icon={AlertTriangle}
            label="Critical"
            value={summary.criticalCount}
            sublabel={`+ ${summary.highCount} high`}
            color="text-rose-600"
            bg="bg-rose-50"
            ring="ring-rose-200"
          />
          <SummaryCard
            icon={DollarSign}
            label="Reorder Cost"
            value={`₵${summary.totalReorderCost.toFixed(0)}`}
            sublabel={`${summary.totalRecommendedReorderQty} units`}
            color="text-orange-600"
            bg="bg-orange-50"
            ring="ring-orange-200"
          />
          <SummaryCard
            icon={TrendingUp}
            label="Projected Revenue"
            value={`₵${summary.totalProjectedRevenue.toFixed(0)}`}
            sublabel={`Profit: ₵${summary.totalProjectedProfit.toFixed(0)}`}
            color="text-emerald-600"
            bg="bg-emerald-50"
            ring="ring-emerald-200"
          />
          <SummaryCard
            icon={Target}
            label="Avg Confidence"
            value={`${(summary.avgConfidence * 100).toFixed(0)}%`}
            sublabel={accuracy.avgAccuracyPct ? `Past accuracy: ${accuracy.avgAccuracyPct}%` : "First forecast"}
            color="text-violet-600"
            bg="bg-violet-50"
            ring="ring-violet-200"
          />
          <SummaryCard
            icon={Package}
            label="Products Analyzed"
            value={summary.totalProducts}
            sublabel={`${summary.dataPointsAnalyzed} data points`}
            color="text-blue-600"
            bg="bg-blue-50"
            ring="ring-blue-200"
          />
        </div>

        {/* AI Summary + Create PO */}
        <div className="grid lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <h2 className="text-sm font-bold text-slate-800">AI Analysis & Recommendations</h2>
            </div>
            <div className="prose prose-sm max-w-none text-slate-700 whitespace-pre-wrap text-xs leading-relaxed">
              {aiSummary}
            </div>
          </div>

          <div className="bg-gradient-to-br from-violet-600 to-indigo-700 rounded-2xl shadow-sm p-5 text-white flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Zap className="h-5 w-5" />
                <h2 className="text-sm font-bold">Auto-Replenish</h2>
              </div>
              <div className="text-xs text-violet-100/90 mb-4">
                Create purchase orders for all {summary.criticalCount + summary.highCount} critical + high urgency items in one click.
                Grouped by preferred supplier.
              </div>
              <div className="bg-white/10 rounded-xl p-3 mb-4">
                <div className="text-[10px] text-violet-100/70 uppercase font-semibold">Total Cost</div>
                <div className="text-2xl font-bold font-mono">₵{summary.totalReorderCost.toFixed(2)}</div>
                <div className="text-[10px] text-violet-100/70">{summary.totalRecommendedReorderQty} units to order</div>
              </div>
            </div>
            <button
              onClick={handleCreatePOs}
              disabled={creatingPOs || (summary.criticalCount + summary.highCount) === 0}
              className="w-full h-11 rounded-xl bg-white text-violet-700 font-bold text-sm flex items-center justify-center gap-2 hover:bg-violet-50 disabled:opacity-50 transition"
            >
              {creatingPOs ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Creating POs...</>
              ) : (
                <><Plus className="h-4 w-4" /> Create {summary.criticalCount + summary.highCount} POs</>
              )}
            </button>
          </div>
        </div>

        {/* Charts row */}
        <div className="grid lg:grid-cols-2 gap-4">
          {/* Seasonality chart */}
          <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="h-4 w-4 text-violet-600" />
              <h2 className="text-sm font-bold text-slate-800">Weekly Seasonality Pattern</h2>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={aggregateSeasonality}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }}
                  formatter={(value: any, name: string) => [
                    name === "velocity" ? `${value} units/day` : `${value}x`,
                    name === "velocity" ? "Avg Velocity" : "Multiplier"
                  ]}
                />
                <Bar dataKey="velocity" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <div className="text-xs text-slate-500 mt-2 text-center">
              Peak day: <strong className="text-violet-600">{forecasts[0]?.seasonality?.peakDay || "N/A"}</strong>
              {forecasts[0]?.seasonality?.peakMultiplier > 1 && (
                <span> ({forecasts[0].seasonality.peakMultiplier}x average)</span>
              )}
            </div>
          </div>

          {/* Accuracy chart */}
          <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Target className="h-4 w-4 text-emerald-600" />
              <h2 className="text-sm font-bold text-slate-800">Forecast Accuracy</h2>
            </div>
            {accuracy.avgAccuracyPct !== null ? (
              <>
                <div className="flex items-center justify-center mb-4">
                  <div className="relative h-32 w-32">
                    <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="40" fill="none" stroke="#e2e8f0" strokeWidth="10" />
                      <circle
                        cx="50" cy="50" r="40" fill="none" stroke="#10b981" strokeWidth="10"
                        strokeDasharray={`${(accuracy.avgAccuracyPct / 100) * 251.2} 251.2`}
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <div className="text-2xl font-bold text-emerald-600">{accuracy.avgAccuracyPct}%</div>
                      <div className="text-[10px] text-slate-500">avg accuracy</div>
                    </div>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="text-[10px] font-bold text-slate-500 uppercase">Recent Evaluations</div>
                  {accuracy.recentEvaluations.slice(0, 5).map((ev: any, i: number) => (
                    <div key={i} className="flex items-center justify-between text-xs bg-slate-50 rounded-lg px-3 py-1.5">
                      <span className="font-medium text-slate-700 truncate flex-1">{ev.productName}</span>
                      <span className="text-slate-500 font-mono ml-2">{ev.predicted}→{ev.actual}</span>
                      <span className={`font-bold ml-2 ${ev.accuracyPct > 70 ? "text-emerald-600" : ev.accuracyPct > 50 ? "text-amber-600" : "text-rose-600"}`}>
                        {ev.accuracyPct}%
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-[220px] text-center">
                <Target className="h-12 w-12 text-slate-300 mb-3" />
                <div className="text-sm font-semibold text-slate-500">No accuracy data yet</div>
                <div className="text-xs text-slate-400 mt-1 max-w-xs">
                  Save a forecast snapshot now, and after 30 days we'll compare predictions to actuals.
                  The model improves over time as it learns your store's patterns.
                </div>
                <button
                  onClick={() => fetchForecast(days, true)}
                  className="mt-4 h-9 px-4 rounded-lg bg-violet-100 hover:bg-violet-200 text-violet-700 text-xs font-semibold flex items-center gap-2"
                >
                  <RefreshCw className="h-3.5 w-3.5" /> Save Snapshot Now
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Product forecast table */}
        <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Package className="h-4 w-4 text-violet-600" />
              Product Forecasts ({forecasts.length})
            </h2>
            <div className="text-xs text-slate-500">Sorted by urgency</div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Product</th>
                  <th className="text-right px-3 py-3 font-semibold text-slate-600">Stock</th>
                  <th className="text-right px-3 py-3 font-semibold text-slate-600">Velocity/day</th>
                  <th className="text-center px-3 py-3 font-semibold text-slate-600">Trend</th>
                  <th className="text-center px-3 py-3 font-semibold text-slate-600">Peak Day</th>
                  <th className="text-right px-3 py-3 font-semibold text-slate-600">Projected Demand</th>
                  <th className="text-center px-3 py-3 font-semibold text-slate-600">Stockout</th>
                  <th className="text-right px-3 py-3 font-semibold text-slate-600">Reorder Qty</th>
                  <th className="text-center px-3 py-3 font-semibold text-slate-600">Confidence</th>
                  <th className="text-center px-3 py-3 font-semibold text-slate-600">Urgency</th>
                </tr>
              </thead>
              <tbody>
                {forecasts.map((f, i) => (
                  <tr
                    key={f.productId}
                    className={`border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition ${selectedProduct?.productId === f.productId ? "bg-violet-50" : ""}`}
                    onClick={() => setSelectedProduct(selectedProduct?.productId === f.productId ? null : f)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{f.emoji}</span>
                        <div>
                          <div className="font-semibold text-slate-800">{f.name}</div>
                          <div className="text-[9px] text-slate-400 font-mono">{f.sku} · {f.category}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right font-mono font-bold text-slate-700">{f.currentStock} {f.unit}</td>
                    <td className="px-3 py-3 text-right font-mono text-slate-600">{f.avgDailyVelocity}</td>
                    <td className="px-3 py-3 text-center">
                      {f.trend === "increasing" && <TrendingUp className="h-4 w-4 text-emerald-500 mx-auto" />}
                      {f.trend === "decreasing" && <TrendingDown className="h-4 w-4 text-rose-500 mx-auto" />}
                      {f.trend === "stable" && <span className="text-slate-400 text-[10px]">stable</span>}
                      {f.trend === "new" && <span className="text-blue-400 text-[10px]">new</span>}
                    </td>
                    <td className="px-3 py-3 text-center text-[10px] text-slate-600">{f.seasonality.peakDay}</td>
                    <td className="px-3 py-3 text-right font-mono font-semibold text-slate-700">{f.projectedDemand} {f.unit}</td>
                    <td className="px-3 py-3 text-center">
                      {f.projectedStockoutDate ? (
                        <div>
                          <div className="font-mono font-bold text-rose-600">{f.projectedStockoutDays}d</div>
                          <div className="text-[9px] text-slate-400">{f.projectedStockoutDate}</div>
                        </div>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right font-mono font-bold text-violet-700">
                      {f.recommendedReorderQty > 0 ? `${f.recommendedReorderQty} ${f.unit}` : "—"}
                      {f.reorderCost > 0 && (
                        <div className="text-[9px] text-slate-400 font-normal">₵{f.reorderCost.toFixed(2)}</div>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1.5">
                        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden min-w-[40px]">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${f.confidenceScore * 100}%`,
                              background: f.confidenceScore > 0.7 ? "#10b981" : f.confidenceScore > 0.4 ? "#f59e0b" : "#ef4444",
                            }}
                          />
                        </div>
                        <span className="text-[10px] font-mono text-slate-500 w-8">{Math.round(f.confidenceScore * 100)}%</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-[10px] font-bold ring-1 ${URGENCY_BG[f.urgency]}`}>
                        {f.urgency}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Selected product detail */}
        <AnimatePresence>
          {selectedProduct && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-white rounded-2xl shadow-sm ring-1 ring-violet-200 p-5"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <span className="text-xl">{selectedProduct.emoji}</span>
                  {selectedProduct.name}
                  <span className="text-[10px] font-mono text-slate-400">{selectedProduct.sku}</span>
                </h3>
                <button onClick={() => setSelectedProduct(null)} className="text-slate-400 hover:text-slate-600">
                  ✕
                </button>
              </div>

              <div className="grid lg:grid-cols-2 gap-4">
                {/* 14-day stock projection */}
                <div>
                  <div className="text-xs font-semibold text-slate-600 mb-2">14-Day Stock Projection</div>
                  <ResponsiveContainer width="100%" height={180}>
                    <AreaChart data={selectedProduct.dailyProjections}>
                      <defs>
                        <linearGradient id="stockGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 11 }} />
                      <Area type="monotone" dataKey="stockAfter" stroke="#8b5cf6" fill="url(#stockGrad)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                {/* Day-of-week velocity */}
                <div>
                  <div className="text-xs font-semibold text-slate-600 mb-2">Day-of-Week Sales Pattern</div>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={selectedProduct.seasonality.chart}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 11 }} />
                      <Bar dataKey="velocity" radius={[4, 4, 0, 0]}>
                        {selectedProduct.seasonality.chart.map((entry: any, i: number) => (
                          <Cell key={i} fill={entry.multiplier > 1.2 ? "#8b5cf6" : "#c4b5fd"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Recommendation box */}
              <div className="mt-4 bg-gradient-to-r from-violet-50 to-indigo-50 rounded-xl p-4 ring-1 ring-violet-100">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                  <div>
                    <div className="text-[10px] text-slate-500 uppercase font-semibold">Current Stock</div>
                    <div className="text-lg font-bold text-slate-800">{selectedProduct.currentStock} {selectedProduct.unit}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-500 uppercase font-semibold">Projected Demand ({data.forecastDays}d)</div>
                    <div className="text-lg font-bold text-violet-700">{selectedProduct.projectedDemand} {selectedProduct.unit}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-500 uppercase font-semibold">Recommended Reorder</div>
                    <div className="text-lg font-bold text-emerald-600">{selectedProduct.recommendedReorderQty} {selectedProduct.unit}</div>
                    <div className="text-[10px] text-slate-500">Cost: ₵{selectedProduct.reorderCost.toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-500 uppercase font-semibold">Projected Revenue</div>
                    <div className="text-lg font-bold text-blue-600">₵{selectedProduct.projectedRevenue.toFixed(2)}</div>
                    <div className="text-[10px] text-slate-500">Profit: ₵{selectedProduct.projectedProfit.toFixed(2)}</div>
                  </div>
                </div>
                {selectedProduct.preferredSupplierName && (
                  <div className="mt-3 pt-3 border-t border-violet-100 text-xs text-slate-600">
                    <strong>Preferred supplier:</strong> {selectedProduct.preferredSupplierName} ({selectedProduct.preferredSupplierCode})
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

const DAY_ABBR = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function SummaryCard({ icon: Icon, label, value, sublabel, color, bg, ring }: any) {
  return (
    <div className={`rounded-2xl p-4 ring-1 ${bg} ${ring}`}>
      <div className="flex items-center gap-2 mb-1.5">
        <div className={`h-7 w-7 rounded-lg bg-white flex items-center justify-center ${color}`}>
          <Icon className="h-3.5 w-3.5" />
        </div>
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">{label}</span>
      </div>
      <div className={`text-xl font-bold font-mono ${color}`}>{value}</div>
      {sublabel && <div className="text-[10px] text-slate-500 mt-0.5">{sublabel}</div>}
    </div>
  );
}
