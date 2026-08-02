"use client";

import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
  X, TrendingUp, TrendingDown, Minus, Loader2, Star, History, BarChart3,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { formatGHS } from "@/lib/pos-data";

interface PriceHistoryEntry {
  id: string;
  unitCost: number;
  previousCost: number;
  delta: number;
  deltaPct: number;
  isIncrease: boolean;
  isDecrease: boolean;
  changedAt: string;
  notes: string;
  product?: { sku: string; name: string; emoji: string };
  changedBy?: { fullName: string; username: string };
}

interface PriceHistoryStats {
  totalEntries: number;
  increases: number;
  decreases: number;
  firstCost: number;
  lastCost: number;
  totalChangePct: number;
  trend: "increasing" | "decreasing" | "stable";
}

interface Props {
  supplierId: string;
  supplierName: string;
  onClose: () => void;
}

export function SupplierPriceHistoryDialog({ supplierId, supplierName, onClose }: Props) {
  const { toast } = useToast();
  const [history, setHistory] = useState<PriceHistoryEntry[]>([]);
  const [stats, setStats] = useState<PriceHistoryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [productIdFilter, setProductIdFilter] = useState<string>("");

  useEffect(() => {
    setLoading(true);
    const url = productIdFilter
      ? `/api/suppliers/${supplierId}/price-history?productId=${productIdFilter}&limit=100`
      : `/api/suppliers/${supplierId}/price-history?limit=100`;
    fetch(url)
      .then(r => r.json())
      .then(data => {
        setHistory(data.history || []);
        setStats(data.stats || null);
      })
      .catch(e => {
        console.error(e);
        toast({ title: "Failed to load price history", variant: "destructive" });
      })
      .finally(() => setLoading(false));
  }, [supplierId, productIdFilter]);

  // Unique products for the filter dropdown
  const products = useMemo(() => {
    const map = new Map();
    history.forEach(h => {
      if (h.product && !map.has(h.product.sku)) {
        map.set(h.product.sku, h.product);
      }
    });
    return Array.from(map.values());
  }, [history]);

  // Build a simple SVG sparkline for the cost trend
  const sparklineData = useMemo(() => {
    // Reverse to chronological order (oldest → newest)
    const chronological = [...history].reverse();
    if (chronological.length < 2) return null;
    const costs = chronological.map(h => h.unitCost);
    const min = Math.min(...costs);
    const max = Math.max(...costs);
    const range = max - min || 1;
    const width = 280;
    const height = 60;
    const points = costs.map((c, i) => {
      const x = (i / (costs.length - 1)) * width;
      const y = height - ((c - min) / range) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");
    return { points, min, max, width, height };
  }, [history]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex-shrink-0 px-5 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            <div>
              <h3 className="font-bold text-sm">Price History — {supplierName}</h3>
              <p className="text-[10px] text-indigo-100">Track every cost change over time</p>
            </div>
          </div>
          <button onClick={onClose} className="h-7 w-7 rounded-lg bg-white/15 hover:bg-white/25 flex items-center justify-center">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {loading ? (
            <div className="text-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-500 mx-auto" />
              <p className="text-xs text-slate-500 mt-2">Loading price history…</p>
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <History className="h-12 w-12 mx-auto mb-2 opacity-40" />
              <p className="text-sm font-bold">No price changes recorded yet</p>
              <p className="text-xs mt-1">Price changes are recorded automatically when you update a supplier's catalog cost.</p>
            </div>
          ) : (
            <>
              {/* Trend stats banner */}
              {stats && (
                <div className={cn(
                  "rounded-xl p-3 ring-1",
                  stats.trend === "increasing" ? "bg-rose-50 ring-rose-200" :
                  stats.trend === "decreasing" ? "bg-emerald-50 ring-emerald-200" :
                  "bg-slate-50 ring-slate-200"
                )}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      {stats.trend === "increasing" ? <TrendingUp className="h-4 w-4 text-rose-600" /> :
                       stats.trend === "decreasing" ? <TrendingDown className="h-4 w-4 text-emerald-600" /> :
                       <Minus className="h-4 w-4 text-slate-500" />}
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                        Overall Trend: {stats.trend}
                      </span>
                    </div>
                    <span className={cn(
                      "text-sm font-bold font-mono",
                      stats.totalChangePct > 0 ? "text-rose-600" :
                      stats.totalChangePct < 0 ? "text-emerald-600" : "text-slate-600"
                    )}>
                      {stats.totalChangePct > 0 ? "+" : ""}{stats.totalChangePct}%
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div className="bg-white rounded px-2 py-1">
                      <div className="text-[9px] text-slate-500 uppercase">First</div>
                      <div className="text-xs font-mono font-bold text-slate-700">{formatGHS(stats.firstCost)}</div>
                    </div>
                    <div className="bg-white rounded px-2 py-1">
                      <div className="text-[9px] text-slate-500 uppercase">Latest</div>
                      <div className="text-xs font-mono font-bold text-slate-700">{formatGHS(stats.lastCost)}</div>
                    </div>
                    <div className="bg-white rounded px-2 py-1">
                      <div className="text-[9px] text-slate-500 uppercase">Increases</div>
                      <div className="text-xs font-mono font-bold text-rose-600">{stats.increases}</div>
                    </div>
                    <div className="bg-white rounded px-2 py-1">
                      <div className="text-[9px] text-slate-500 uppercase">Decreases</div>
                      <div className="text-xs font-mono font-bold text-emerald-600">{stats.decreases}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Sparkline chart */}
              {sparklineData && (
                <div className="bg-white rounded-xl ring-1 ring-slate-200 p-3">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Cost Trend</div>
                  <svg viewBox={`0 0 ${sparklineData.width} ${sparklineData.height}`} className="w-full h-16" preserveAspectRatio="none">
                    <polyline
                      points={sparklineData.points}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="text-indigo-500"
                    />
                  </svg>
                  <div className="flex justify-between text-[9px] text-slate-400 mt-1">
                    <span>Oldest: {formatGHS(sparklineData.min)}</span>
                    <span>Latest: {formatGHS(sparklineData.max)}</span>
                  </div>
                </div>
              )}

              {/* Filter */}
              {products.length > 0 && (
                <div className="flex items-center gap-2">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Filter by product:</label>
                  <select
                    value={productIdFilter}
                    onChange={(e) => setProductIdFilter(e.target.value)}
                    className="h-8 px-2 rounded-lg bg-slate-100 text-xs outline-none flex-1"
                  >
                    <option value="">All products ({history.length} entries)</option>
                    {products.map(p => (
                      <option key={p.sku} value={p.sku}>{p.emoji} {p.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* History table */}
              <div className="bg-white rounded-xl ring-1 ring-slate-200 overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="text-left px-3 py-2">Date</th>
                      <th className="text-left px-3 py-2">Product</th>
                      <th className="text-right px-3 py-2">Previous</th>
                      <th className="text-right px-3 py-2">New Cost</th>
                      <th className="text-right px-3 py-2">Δ</th>
                      <th className="text-left px-3 py-2">By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {history.map(h => (
                      <tr key={h.id} className="hover:bg-slate-50">
                        <td className="px-3 py-2 text-slate-500 whitespace-nowrap">
                          {new Date(h.changedAt).toLocaleDateString("en-GB")}
                        </td>
                        <td className="px-3 py-2 text-slate-700">
                          {h.product ? `${h.product.emoji} ${h.product.name}` : "—"}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-slate-500">{formatGHS(h.previousCost)}</td>
                        <td className="px-3 py-2 text-right font-mono font-bold text-slate-800">{formatGHS(h.unitCost)}</td>
                        <td className={cn(
                          "px-3 py-2 text-right font-mono font-bold",
                          h.isIncrease ? "text-rose-600" : h.isDecrease ? "text-emerald-600" : "text-slate-400"
                        )}>
                          {h.isIncrease ? "▲" : h.isDecrease ? "▼" : "—"}
                          {h.deltaPct > 0 ? "+" : ""}{h.deltaPct}%
                        </td>
                        <td className="px-3 py-2 text-slate-500 text-[10px]">{h.changedBy?.fullName || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {history.length > 0 && history[0].notes && (
                <div className="text-[10px] text-slate-500 bg-slate-50 rounded p-2">
                  <strong>Latest note:</strong> {history[0].notes}
                </div>
              )}
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
