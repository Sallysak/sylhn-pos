"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain, X, TrendingUp, TrendingDown, AlertTriangle, Target,
  Loader2, RefreshCw, Calendar, Clock, Package, Sparkles,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { authedFetch } from "@/lib/client-auth";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
}

interface PredictionData {
  predictions: {
    tomorrow: { date: string; dayName: string; predictedRevenue: number; confidence: number; basis: string };
    next7Days: { date: string; dayName: string; predictedRevenue: number; confidence: number }[];
    bestDay: { day: string; avgRevenue: number; salesCount: number };
    busiestHour: { hour: number; label: string; avgRevenue: number };
  };
  growth: {
    topProducts: { rank: number; name: string; revenue: number; profit: number; margin: number; qtySold: number }[];
  };
  risks: { type: string; severity: 'high' | 'medium' | 'low'; message: string }[];
  todayActual: { total: number; count: number };
  last7Days: { total: number; avgPerDay: number; count: number };
}

export function AiPredictionsDashboard({ open, onClose }: Props) {
  const { toast } = useToast();
  const [data, setData] = useState<PredictionData | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authedFetch("/api/ai/predictions");
      const json = await res.json();
      if (json.success) setData(json);
      else toast({ title: "Failed to load predictions", description: json.error, variant: "destructive" });
    } catch (e: any) {
      toast({ title: "Network error", description: e?.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (open && !data) load();
  }, [open, data, load]);

  const formatGHS = (n: number) => `GHS ${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[80]"
          />
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed top-0 right-0 bottom-0 w-full max-w-lg bg-slate-50 z-[81] flex flex-col shadow-2xl"
          >
            {/* Header */}
            <div className="flex-shrink-0 bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 text-white px-5 py-4 relative overflow-hidden">
              <div className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
              <div className="flex items-center justify-between relative z-10">
                <div className="flex items-center gap-2.5">
                  <div className="relative">
                    <div className="absolute inset-0 rounded-xl bg-white/30 blur-md scale-110" />
                    <div className="relative h-10 w-10 rounded-xl bg-white/20 ring-1 ring-white/30 flex items-center justify-center backdrop-blur-md">
                      <Brain className="h-5 w-5" />
                    </div>
                  </div>
                  <div>
                    <div className="font-bold text-base tracking-tight flex items-center gap-2">
                      AI Predictions
                      <span className="text-[9px] font-normal bg-white/20 px-1.5 py-0.5 rounded-full">Forecast</span>
                    </div>
                    <div className="text-[10px] text-purple-50/90">Tomorrow's revenue · 7-day forecast · Risks</div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={load} disabled={loading} className="h-8 w-8 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center transition" title="Refresh">
                    <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
                  </button>
                  <button onClick={onClose} className="h-8 w-8 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center transition">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {loading && !data ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <Loader2 className="h-10 w-10 animate-spin text-purple-500 mb-3" />
                  <p className="text-xs text-slate-500">Analyzing 90 days of sales data...</p>
                </div>
              ) : data ? (
                <>
                  {/* Tomorrow's prediction - hero card */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-gradient-to-br from-purple-600 to-indigo-700 rounded-2xl p-5 text-white shadow-lg relative overflow-hidden"
                  >
                    <div className="pointer-events-none absolute -top-8 -right-8 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
                    <div className="flex items-center gap-2 mb-2 relative z-10">
                      <Sparkles className="h-4 w-4" />
                      <span className="text-xs font-bold uppercase tracking-wider opacity-90">Tomorrow's Forecast</span>
                    </div>
                    <div className="text-3xl font-bold mb-1 relative z-10 tabular">
                      {formatGHS(data.predictions.tomorrow.predictedRevenue)}
                    </div>
                    <div className="text-[11px] opacity-90 relative z-10">
                      {data.predictions.tomorrow.dayName}, {data.predictions.tomorrow.date}
                    </div>
                    <div className="mt-3 flex items-center gap-2 relative z-10">
                      <div className="flex-1 h-1.5 bg-white/20 rounded-full overflow-hidden">
                        <div className="h-full bg-white rounded-full" style={{ width: `${data.predictions.tomorrow.confidence}%` }} />
                      </div>
                      <span className="text-[10px] font-bold">{data.predictions.tomorrow.confidence}% confidence</span>
                    </div>
                  </motion.div>

                  {/* 7-day forecast */}
                  <div className="bg-white rounded-2xl p-4 shadow-sm ring-1 ring-slate-100">
                    <div className="flex items-center gap-2 mb-3">
                      <Calendar className="h-4 w-4 text-indigo-600" />
                      <h3 className="text-sm font-bold text-slate-800">Next 7 Days</h3>
                    </div>
                    <div className="space-y-2">
                      {data.predictions.next7Days.map((d, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <div className="w-12 text-[11px] font-bold text-slate-600">{d.dayName.slice(0, 3)}</div>
                          <div className="flex-1 h-6 bg-slate-100 rounded-md overflow-hidden relative">
                            <div
                              className="h-full bg-gradient-to-r from-purple-400 to-indigo-500 rounded-md"
                              style={{ width: `${Math.min(100, (d.predictedRevenue / Math.max(...data.predictions.next7Days.map(x => x.predictedRevenue))) * 100)}%` }}
                            />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-700 tabular">
                              {formatGHS(d.predictedRevenue)}
                            </span>
                          </div>
                          <div className="w-10 text-right text-[9px] text-slate-500 font-bold">{d.confidence}%</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Two-column stats */}
                  <div className="grid grid-cols-2 gap-3">
                    {/* Best day */}
                    <div className="bg-white rounded-2xl p-4 shadow-sm ring-1 ring-slate-100">
                      <div className="flex items-center gap-1.5 mb-2">
                        <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Best Day</span>
                      </div>
                      <div className="text-lg font-bold text-slate-800">{data.predictions.bestDay.day}</div>
                      <div className="text-xs text-slate-500 tabular">{formatGHS(data.predictions.bestDay.avgRevenue)} avg</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{data.predictions.bestDay.salesCount} sales</div>
                    </div>
                    {/* Busiest hour */}
                    <div className="bg-white rounded-2xl p-4 shadow-sm ring-1 ring-slate-100">
                      <div className="flex items-center gap-1.5 mb-2">
                        <Clock className="h-3.5 w-3.5 text-blue-600" />
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Peak Hour</span>
                      </div>
                      <div className="text-lg font-bold text-slate-800">{data.predictions.busiestHour.label.split(' - ')[0]}</div>
                      <div className="text-xs text-slate-500 tabular">{formatGHS(data.predictions.busiestHour.avgRevenue)}/sale</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{data.predictions.busiestHour.label}</div>
                    </div>
                  </div>

                  {/* Risks */}
                  {data.risks.length > 0 && (
                    <div className="bg-white rounded-2xl p-4 shadow-sm ring-1 ring-slate-100">
                      <div className="flex items-center gap-2 mb-3">
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                        <h3 className="text-sm font-bold text-slate-800">Risk Alerts ({data.risks.length})</h3>
                      </div>
                      <div className="space-y-2">
                        {data.risks.map((r, i) => (
                          <div key={i} className={cn(
                            "flex items-start gap-2 p-2 rounded-lg text-xs",
                            r.severity === 'high' ? "bg-rose-50 text-rose-800 ring-1 ring-rose-200" :
                            r.severity === 'medium' ? "bg-amber-50 text-amber-800 ring-1 ring-amber-200" :
                            "bg-slate-50 text-slate-700 ring-1 ring-slate-200"
                          )}>
                            <div className={cn(
                              "h-1.5 w-1.5 rounded-full mt-1 flex-shrink-0",
                              r.severity === 'high' ? "bg-rose-500" :
                              r.severity === 'medium' ? "bg-amber-500" : "bg-slate-400"
                            )} />
                            <span className="flex-1">{r.message}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Top products */}
                  <div className="bg-white rounded-2xl p-4 shadow-sm ring-1 ring-slate-100">
                    <div className="flex items-center gap-2 mb-3">
                      <Target className="h-4 w-4 text-purple-600" />
                      <h3 className="text-sm font-bold text-slate-800">Top 10 Products (90 days)</h3>
                    </div>
                    <div className="space-y-1.5">
                      {data.growth.topProducts.map((p) => (
                        <div key={p.rank} className="flex items-center gap-2 text-xs">
                          <span className={cn(
                            "h-5 w-5 rounded-md flex items-center justify-center text-[9px] font-bold flex-shrink-0",
                            p.rank === 1 ? "bg-amber-100 text-amber-700" :
                            p.rank === 2 ? "bg-slate-200 text-slate-700" :
                            p.rank === 3 ? "bg-orange-100 text-orange-700" :
                            "bg-slate-50 text-slate-500"
                          )}>
                            {p.rank}
                          </span>
                          <span className="flex-1 truncate text-slate-700 font-medium">{p.name}</span>
                          <span className="text-slate-500 tabular text-[10px]">{p.qtySold} sold</span>
                          <span className="font-bold text-slate-800 tabular text-[10px]">{formatGHS(p.revenue)}</span>
                          <span className="text-emerald-600 font-bold text-[10px] tabular w-8 text-right">{p.margin}%</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Today vs 7-day avg */}
                  <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-4 text-white">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <div className="text-[10px] uppercase tracking-wider opacity-70 font-bold">Today's Actual</div>
                        <div className="text-xl font-bold tabular">{formatGHS(data.todayActual.total)}</div>
                        <div className="text-[10px] opacity-70">{data.todayActual.count} sales</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] uppercase tracking-wider opacity-70 font-bold">7-Day Average</div>
                        <div className="text-xl font-bold tabular">{formatGHS(data.last7Days.avgPerDay)}</div>
                        <div className="text-[10px] opacity-70">{data.last7Days.count} sales total</div>
                      </div>
                    </div>
                    {data.todayActual.total > data.last7Days.avgPerDay && (
                      <div className="flex items-center gap-1.5 text-[11px] text-emerald-300 font-medium">
                        <TrendingUp className="h-3 w-3" />
                        Today is {Math.round((data.todayActual.total / data.last7Days.avgPerDay - 1) * 100)}% above your weekly average!
                      </div>
                    )}
                  </div>
                </>
              ) : null}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
