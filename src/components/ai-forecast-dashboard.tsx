"use client";

import { useState, useEffect } from "react";
import { Brain, Loader2, TrendingUp, TrendingDown, Package, Sparkles, ShoppingCart } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { formatGHS } from "@/lib/pos-data";
import { cn } from "@/lib/utils";

interface ForecastItem {
  productId: string;
  productName: string;
  emoji: string;
  currentStock: number;
  predictedDemand: number;
  recommendedOrder: number;
  confidence: number;
  trend: "up" | "down" | "stable";
  daysUntilStockout: number | null;
}

interface AIForecastDashboardProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function AIForecastDashboard({ open, onOpenChange }: AIForecastDashboardProps) {
  const [loading, setLoading] = useState(false);
  const [forecasts, setForecasts] = useState<ForecastItem[]>([]);
  const [days, setDays] = useState(30);
  const { toast } = useToast();

  useEffect(() => {
    if (open) loadForecast();
  }, [open]);

  const loadForecast = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/ai-forecast?days=${days}`, { credentials: "include" });
      const data = await res.json();
      if (res.ok && data.forecasts) {
        setForecasts(data.forecasts);
      }
    } catch {
      toast({ title: "Failed to load forecast", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const topPicks = forecasts.slice(0, 20);
  const urgentRestock = forecasts.filter(f => f.daysUntilStockout !== null && f.daysUntilStockout <= 7);
  const surplus = forecasts.filter(f => f.currentStock > f.predictedDemand * 2 && f.predictedDemand > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl p-0 overflow-hidden">
        <div className="bg-gradient-to-br from-violet-600 via-purple-600 to-fuchsia-600 text-white px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-white/20 ring-1 ring-white/30 flex items-center justify-center backdrop-blur-sm">
              <Brain className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-bold tracking-tight">AI Demand Forecast</h2>
              <p className="text-[11px] opacity-85">Next {days} days — based on sales history, seasonality & day-of-week patterns</p>
            </div>
            <select value={days} onChange={(e) => { setDays(parseInt(e.target.value)); }} className="h-8 px-2 text-xs rounded bg-white/20 text-white border-white/30 outline-none">
              <option value={7}>7 days</option>
              <option value={14}>14 days</option>
              <option value={30}>30 days</option>
              <option value={60}>60 days</option>
              <option value={90}>90 days</option>
            </select>
          </div>
        </div>

        <div className="px-6 py-5 max-h-[65vh] overflow-y-auto">
          {loading ? (
            <div className="text-center py-8">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3 text-violet-600" />
              <p className="text-sm text-slate-500">AI analyzing sales history...</p>
            </div>
          ) : forecasts.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <Brain className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm font-semibold">No forecast data yet</p>
              <p className="text-xs mt-1">You need at least 2 weeks of sales history for accurate forecasting.</p>
            </div>
          ) : (
            <>
              {/* Summary tiles */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/40 p-3">
                  <div className="text-[10px] font-bold uppercase text-rose-600">Urgent Restock</div>
                  <div className="text-lg font-bold text-rose-700">{urgentRestock.length}</div>
                  <div className="text-[9px] text-slate-500">≤7 days to stockout</div>
                </div>
                <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/40 p-3">
                  <div className="text-[10px] font-bold uppercase text-amber-600">Surplus Stock</div>
                  <div className="text-lg font-bold text-amber-700">{surplus.length}</div>
                  <div className="text-[9px] text-slate-500">2x predicted demand</div>
                </div>
                <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/40 p-3">
                  <div className="text-[10px] font-bold uppercase text-emerald-600">Healthy</div>
                  <div className="text-lg font-bold text-emerald-700">{forecasts.length - urgentRestock.length - surplus.length}</div>
                  <div className="text-[9px] text-slate-500">stock OK</div>
                </div>
              </div>

              {/* Forecast list */}
              <div className="space-y-1.5">
                <div className="text-[11px] font-bold uppercase text-slate-500 mb-2">Top 20 — Recommended Reorder</div>
                {topPicks.map(f => (
                  <div key={f.productId} className={cn(
                    "flex items-center gap-3 p-2.5 rounded-lg border transition",
                    f.daysUntilStockout !== null && f.daysUntilStockout <= 7
                      ? "bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/40"
                      : f.currentStock > f.predictedDemand * 2
                      ? "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/40"
                      : "bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-700"
                  )}>
                    <span className="text-lg shrink-0">{f.emoji || "📦"}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold truncate">{f.productName}</div>
                      <div className="text-[10px] text-slate-500 flex items-center gap-2">
                        <span>Stock: {f.currentStock}</span>
                        <span>· Predicted: {f.predictedDemand}</span>
                        {f.daysUntilStockout !== null && <span className={cn("font-bold", f.daysUntilStockout <= 7 && "text-rose-600")}>· Stockout in {f.daysUntilStockout}d</span>}
                      </div>
                    </div>
                    {f.trend === "up" ? <TrendingUp className="h-4 w-4 text-emerald-500 shrink-0" />
                     : f.trend === "down" ? <TrendingDown className="h-4 w-4 text-rose-500 shrink-0" />
                     : null}
                    {f.recommendedOrder > 0 && (
                      <Badge className="bg-violet-100 text-violet-700 text-[10px] shrink-0">
                        <ShoppingCart className="h-2.5 w-2.5 mr-0.5" /> Order {f.recommendedOrder}
                      </Badge>
                    )}
                    <div className="text-[9px] text-slate-400 shrink-0">{Math.round(f.confidence * 100)}% conf</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
