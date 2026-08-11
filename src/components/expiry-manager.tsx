"use client";

import { useState, useEffect } from "react";
import { AlertTriangle, Calendar, Clock, Trash2, Loader2, Package } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { formatGHS } from "@/lib/pos-data";
import { cn } from "@/lib/utils";

interface ExpiryItem {
  id: string;
  sku: string;
  name: string;
  emoji: string;
  quantity: number;
  expiryDate: string | null;
  costPrice: number;
  batchNumber: string;
  daysUntilExpiry: number | null;
  urgency: "expired" | "critical" | "warning" | "ok";
}

interface ExpiryManagerProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function ExpiryManager({ open, onOpenChange }: ExpiryManagerProps) {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<ExpiryItem[]>([]);
  const [filter, setFilter] = useState<"all" | "expired" | "critical" | "warning">("all");
  const { toast } = useToast();

  useEffect(() => {
    if (open) loadExpiry();
  }, [open]);

  const loadExpiry = async () => {
    setLoading(true);
    try {
      const res = await authedFetch("/api/expiry-dashboard");
      const data = await res.json();
      if (res.ok && data.products) {
        // Flatten the grouped structure into a single list
        const flat: ExpiryItem[] = [];
        for (const group of data.products) {
          for (const p of group.products || []) {
            flat.push({
              id: p.id,
              sku: p.sku,
              name: p.name,
              emoji: p.emoji || "📦",
              quantity: p.quantity,
              expiryDate: p.expiryDate,
              costPrice: p.costPrice || 0,
              batchNumber: p.batchNumber || "",
              daysUntilExpiry: p.daysUntilExpiry,
              urgency: group.urgency || "ok",
            });
          }
        }
        setItems(flat.sort((a, b) => (a.daysUntilExpiry || 9999) - (b.daysUntilExpiry || 9999)));
      }
    } catch {
      toast({ title: "Failed to load expiry data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const filtered = items.filter(i => filter === "all" || i.urgency === filter);
  const expired = items.filter(i => i.urgency === "expired");
  const critical = items.filter(i => i.urgency === "critical");
  const warning = items.filter(i => i.urgency === "warning");
  const totalValue = expired.reduce((s, i) => s + i.quantity * i.costPrice, 0);

  const urgencyColor: Record<string, string> = {
    expired: "bg-rose-100 text-rose-700 border-rose-200",
    critical: "bg-amber-100 text-amber-700 border-amber-200",
    warning: "bg-yellow-100 text-yellow-700 border-yellow-200",
    ok: "bg-emerald-100 text-emerald-700 border-emerald-200",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl p-0 overflow-hidden">
        <div className="bg-gradient-to-br from-orange-600 via-red-600 to-rose-600 text-white px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-white/20 ring-1 ring-white/30 flex items-center justify-center backdrop-blur-sm">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight">Expiry Management (FEFO)</h2>
              <p className="text-[11px] opacity-85">First-Expire-First-Out tracking + alerts for perishables</p>
            </div>
          </div>
        </div>

        <div className="px-6 py-5 max-h-[65vh] overflow-y-auto">
          {loading ? (
            <div className="text-center py-8">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3 text-orange-600" />
              <p className="text-sm text-slate-500">Loading expiry data...</p>
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <Package className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm font-semibold">No expiry data</p>
              <p className="text-xs mt-1">Products with expiry dates will appear here.</p>
            </div>
          ) : (
            <>
              {/* Summary tiles */}
              <div className="grid grid-cols-4 gap-2 mb-4">
                <button onClick={() => setFilter("expired")} className={cn("rounded-xl border p-3 text-center transition", filter === "expired" ? "ring-2 ring-rose-400" : "")} style={{ backgroundColor: "#fff0f0" }}>
                  <div className="text-[10px] font-bold uppercase text-rose-600">Expired</div>
                  <div className="text-lg font-bold text-rose-700">{expired.length}</div>
                  <div className="text-[9px] text-slate-500">{formatGHS(totalValue)} loss</div>
                </button>
                <button onClick={() => setFilter("critical")} className={cn("rounded-xl border p-3 text-center transition", filter === "critical" ? "ring-2 ring-amber-400" : "")} style={{ backgroundColor: "#fff8f0" }}>
                  <div className="text-[10px] font-bold uppercase text-amber-600">≤7 days</div>
                  <div className="text-lg font-bold text-amber-700">{critical.length}</div>
                  <div className="text-[9px] text-slate-500">urgent</div>
                </button>
                <button onClick={() => setFilter("warning")} className={cn("rounded-xl border p-3 text-center transition", filter === "warning" ? "ring-2 ring-yellow-400" : "")} style={{ backgroundColor: "#fffef0" }}>
                  <div className="text-[10px] font-bold uppercase text-yellow-600">≤30 days</div>
                  <div className="text-lg font-bold text-yellow-700">{warning.length}</div>
                  <div className="text-[9px] text-slate-500">soon</div>
                </button>
                <button onClick={() => setFilter("all")} className={cn("rounded-xl border p-3 text-center transition", filter === "all" ? "ring-2 ring-emerald-400" : "")} style={{ backgroundColor: "#f0fff0" }}>
                  <div className="text-[10px] font-bold uppercase text-emerald-600">All</div>
                  <div className="text-lg font-bold text-emerald-700">{items.length}</div>
                  <div className="text-[9px] text-slate-500">total</div>
                </button>
              </div>

              {/* Items list */}
              <div className="space-y-1.5">
                {filtered.map(item => (
                  <div key={item.id} className={cn("flex items-center gap-3 p-2.5 rounded-lg border", urgencyColor[item.urgency])}>
                    <span className="text-lg shrink-0">{item.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold truncate">{item.name}</div>
                      <div className="text-[10px] text-slate-500 flex items-center gap-2">
                        <span>Qty: {item.quantity}</span>
                        <span>· {formatGHS(item.costPrice)} each</span>
                        {item.batchNumber && <span>· Batch: {item.batchNumber}</span>}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      {item.expiryDate ? (
                        <>
                          <div className="text-xs font-bold">{new Date(item.expiryDate).toLocaleDateString("en-GB")}</div>
                          <div className={cn("text-[9px] font-bold",
                            item.urgency === "expired" ? "text-rose-700" : item.urgency === "critical" ? "text-amber-700" : "text-yellow-700")}>
                            {item.daysUntilExpiry !== null && (
                              item.daysUntilExpiry < 0 ? `${Math.abs(item.daysUntilExpiry)}d ago` : `${item.daysUntilExpiry}d left`
                            )}
                          </div>
                        </>
                      ) : (
                        <span className="text-[10px] text-slate-400">No expiry</span>
                      )}
                    </div>
                    <Badge variant="outline" className={cn("text-[9px] uppercase shrink-0", urgencyColor[item.urgency])}>
                      {item.urgency}
                    </Badge>
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
