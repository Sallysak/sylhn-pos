"use client";

import { useState, useEffect, useMemo } from "react";
import { BarChart3, Loader2, TrendingUp, Package, DollarSign, Clock, Star, Award } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { formatGHS } from "@/lib/pos-data";
import { cn } from "@/lib/utils";

interface AdvancedReportsDashboardProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function AdvancedReportsDashboard({ open, onOpenChange }: AdvancedReportsDashboardProps) {
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"abc" | "profit" | "hourly" | "staff">("abc");
  const [profitData, setProfitData] = useState<any>(null);
  const [soldItems, setSoldItems] = useState<any[]>([]);
  const [salesData, setSalesData] = useState<any>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (open) loadAll();
  }, [open]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [profitRes, soldRes, salesRes] = await Promise.all([
        authedFetch("/api/reports/profit?days=30").then(r => r.json()).catch(() => null),
        authedFetch("/api/reports/sold-items?days=30&limit=100").then(r => r.json()).catch(() => null),
        authedFetch("/api/reports/sales?days=30").then(r => r.json()).catch(() => null),
      ]);
      if (profitRes) setProfitData(profitRes);
      if (soldRes?.items) setSoldItems(soldRes.items);
      if (salesRes) setSalesData(salesRes);
    } catch {
      toast({ title: "Failed to load reports", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // ABC Analysis: A = top 20% revenue, B = next 30%, C = bottom 50%
  const abcAnalysis = useMemo(() => {
    if (!soldItems.length) return { a: [], b: [], c: [] };
    const sorted = [...soldItems].sort((a, b) => (b.totalRevenue || 0) - (a.totalRevenue || 0));
    const totalRevenue = sorted.reduce((s, i) => s + (i.totalRevenue || 0), 0);
    let cumRevenue = 0;
    const categorized = sorted.map(item => {
      cumRevenue += item.totalRevenue || 0;
      const cumPct = totalRevenue > 0 ? (cumRevenue / totalRevenue) * 100 : 0;
      return { ...item, cumPct, category: cumPct <= 20 ? "A" : cumPct <= 50 ? "B" : "C" };
    });
    return {
      a: categorized.filter(i => i.category === "A"),
      b: categorized.filter(i => i.category === "B"),
      c: categorized.filter(i => i.category === "C"),
    };
  }, [soldItems]);

  // Hourly traffic (from sales data)
  const hourlyTraffic = useMemo(() => {
    if (!salesData?.sales) return [];
    const hours = new Array(24).fill(0);
    salesData.sales.forEach((s: any) => {
      const hour = new Date(s.createdAt).getHours();
      hours[hour]++;
    });
    return hours.map((count, hour) => ({ hour, count })).filter(h => h.count > 0);
  }, [salesData]);

  const totalProfit = profitData?.totalProfit || 0;
  const totalRevenue = profitData?.totalRevenue || 0;
  const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl p-0 overflow-hidden">
        <div className="bg-gradient-to-br from-blue-600 via-cyan-600 to-teal-600 text-white px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-white/20 ring-1 ring-white/30 flex items-center justify-center backdrop-blur-sm">
              <BarChart3 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight">Advanced Reports</h2>
              <p className="text-[11px] opacity-85">ABC analysis · Profit margins · Hourly traffic · Staff performance</p>
            </div>
          </div>
        </div>

        {/* Tab selector */}
        <div className="flex border-b border-slate-200 dark:border-slate-700">
          {[
            { id: "abc", label: "ABC Analysis", icon: Star },
            { id: "profit", label: "Profit Margins", icon: DollarSign },
            { id: "hourly", label: "Hourly Traffic", icon: Clock },
            { id: "staff", label: "Staff", icon: Award },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id as any)}
              className={cn("flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold transition border-b-2",
                tab === t.id ? "border-blue-500 text-blue-600 dark:text-blue-400" : "border-transparent text-slate-500 hover:text-slate-700")}>
              <t.icon className="h-3.5 w-3.5" /> {t.label}
            </button>
          ))}
        </div>

        <div className="px-6 py-5 max-h-[60vh] overflow-y-auto">
          {loading ? (
            <div className="text-center py-8"><Loader2 className="h-8 w-8 animate-spin mx-auto mb-3 text-blue-600" /><p className="text-sm text-slate-500">Loading reports...</p></div>
          ) : (
            <>
              {/* ABC Analysis */}
              {tab === "abc" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/40 p-3">
                      <div className="text-[10px] font-bold uppercase text-emerald-600">A-Items (Top 20%)</div>
                      <div className="text-lg font-bold text-emerald-700">{abcAnalysis.a.length}</div>
                      <div className="text-[9px] text-slate-500">80% of revenue</div>
                    </div>
                    <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/40 p-3">
                      <div className="text-[10px] font-bold uppercase text-amber-600">B-Items (Next 30%)</div>
                      <div className="text-lg font-bold text-amber-700">{abcAnalysis.b.length}</div>
                      <div className="text-[9px] text-slate-500">15% of revenue</div>
                    </div>
                    <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-3">
                      <div className="text-[10px] font-bold uppercase text-slate-600">C-Items (Bottom 50%)</div>
                      <div className="text-lg font-bold text-slate-700">{abcAnalysis.c.length}</div>
                      <div className="text-[9px] text-slate-500">5% of revenue</div>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-bold uppercase text-slate-500">A-Items — Focus Here</div>
                    {abcAnalysis.a.slice(0, 15).map((item: any) => (
                      <div key={item.productId} className="flex items-center gap-3 p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40">
                        <Badge className="bg-emerald-500 text-white shrink-0">A</Badge>
                        <span className="text-base shrink-0">{item.emoji || "📦"}</span>
                        <div className="flex-1 min-w-0"><div className="text-sm font-semibold truncate">{item.productName || item.name}</div><div className="text-[10px] text-slate-500">{item.totalQty} sold · {item.cumPct?.toFixed(1)}% cumulative</div></div>
                        <div className="font-mono text-sm font-bold shrink-0">{formatGHS(item.totalRevenue)}</div>
                      </div>
                    ))}
                    {abcAnalysis.a.length === 0 && <div className="text-center py-4 text-slate-400 text-xs">No sales data yet.</div>}
                  </div>
                </div>
              )}

              {/* Profit Margins */}
              {tab === "profit" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40 p-3 text-center">
                      <div className="text-[10px] font-bold uppercase text-blue-600">Revenue (30d)</div>
                      <div className="text-lg font-bold text-blue-700 font-mono">{formatGHS(totalRevenue)}</div>
                    </div>
                    <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/40 p-3 text-center">
                      <div className="text-[10px] font-bold uppercase text-emerald-600">Profit (30d)</div>
                      <div className="text-lg font-bold text-emerald-700 font-mono">{formatGHS(totalProfit)}</div>
                    </div>
                    <div className="rounded-xl bg-violet-50 dark:bg-violet-950/30 border border-violet-100 dark:border-violet-900/40 p-3 text-center">
                      <div className="text-[10px] font-bold uppercase text-violet-600">Margin</div>
                      <div className="text-lg font-bold text-violet-700 font-mono">{profitMargin.toFixed(1)}%</div>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-bold uppercase text-slate-500">Top Products by Profit</div>
                    {(profitData?.items || []).slice(0, 15).map((item: any, i: number) => (
                      <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700">
                        <span className="text-base shrink-0">{item.emoji || "📦"}</span>
                        <div className="flex-1 min-w-0"><div className="text-sm font-semibold truncate">{item.name}</div><div className="text-[10px] text-slate-500">Cost: {formatGHS(item.costPrice)} → Sell: {formatGHS(item.sellingPrice)}</div></div>
                        <div className="text-right shrink-0"><div className="font-mono text-sm font-bold text-emerald-600">{formatGHS(item.profit)}</div><div className="text-[9px] text-slate-400">{item.margin?.toFixed(1)}% margin</div></div>
                      </div>
                    ))}
                    {!profitData?.items?.length && <div className="text-center py-4 text-slate-400 text-xs">No profit data yet.</div>}
                  </div>
                </div>
              )}

              {/* Hourly Traffic */}
              {tab === "hourly" && (
                <div className="space-y-4">
                  <div className="text-[11px] font-bold uppercase text-slate-500">Sales by Hour of Day (last 30 days)</div>
                  {hourlyTraffic.length === 0 ? (
                    <div className="text-center py-8 text-slate-400 text-xs">No sales data yet.</div>
                  ) : (
                    <div className="space-y-1">
                      {hourlyTraffic.map(h => {
                        const maxCount = Math.max(...hourlyTraffic.map(x => x.count));
                        const barWidth = maxCount > 0 ? (h.count / maxCount) * 100 : 0;
                        const isPeak = h.count === maxCount;
                        return (
                          <div key={h.hour} className="flex items-center gap-2">
                            <span className="text-[10px] font-mono text-slate-500 w-12 shrink-0">{h.hour.toString().padStart(2, "0")}:00</span>
                            <div className="flex-1 h-5 bg-slate-100 dark:bg-slate-800 rounded overflow-hidden">
                              <div className={cn("h-full rounded transition-all", isPeak ? "bg-gradient-to-r from-orange-500 to-rose-500" : "bg-gradient-to-r from-blue-400 to-cyan-400")} style={{ width: `${barWidth}%` }} />
                            </div>
                            <span className={cn("text-xs font-bold w-8 text-right shrink-0", isPeak && "text-rose-600")}>{h.count}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <div className="text-[10px] text-slate-500 bg-blue-50 dark:bg-blue-950/30 rounded-lg p-2.5">
                    💡 <strong>Peak hours</strong> show when your store is busiest. Schedule more staff during peak times for faster service.
                  </div>
                </div>
              )}

              {/* Staff Performance */}
              {tab === "staff" && (
                <div className="space-y-4">
                  <div className="text-[11px] font-bold uppercase text-slate-500">Sales by Cashier (last 30 days)</div>
                  {(salesData?.sales || []).length === 0 ? (
                    <div className="text-center py-8 text-slate-400 text-xs">No sales data yet.</div>
                  ) : (
                    (() => {
                      const byCashier: Record<string, { count: number; total: number }> = {};
                      salesData.sales.forEach((s: any) => {
                        const name = s.cashierName || s.cashier?.fullName || "Unknown";
                        if (!byCashier[name]) byCashier[name] = { count: 0, total: 0 };
                        byCashier[name].count++;
                        byCashier[name].total += Number(s.total) || 0;
                      });
                      const sorted = Object.entries(byCashier).sort((a, b) => b[1].total - a[1].total);
                      return (
                        <div className="space-y-1.5">
                          {sorted.map(([name, data], i) => (
                            <div key={name} className="flex items-center gap-3 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700">
                              <div className={cn("h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0", i === 0 ? "bg-amber-100 text-amber-700" : "bg-slate-200 dark:bg-slate-700 text-slate-600")}>
                                {i === 0 ? "🏆" : i + 1}
                              </div>
                              <div className="flex-1 min-w-0"><div className="text-sm font-semibold truncate">{name}</div><div className="text-[10px] text-slate-500">{data.count} transactions · avg {formatGHS(data.count > 0 ? data.total / data.count : 0)}</div></div>
                              <div className="font-mono text-sm font-bold shrink-0">{formatGHS(data.total)}</div>
                            </div>
                          ))}
                        </div>
                      );
                    })()
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
