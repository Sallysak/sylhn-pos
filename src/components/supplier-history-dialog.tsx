"use client";

import { useState, useEffect } from "react";
import { History, Loader2, Package, CreditCard } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { formatGHS } from "@/lib/pos-data";
import { cn } from "@/lib/utils";

interface SupplierHistoryDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  supplierId: string | null;
  supplierName: string;
}

interface HistoryEntry {
  id: string;
  refNo?: string;
  type: "purchase" | "payment";
  date: string;
  total?: number;
  amountPaid?: number;
  status?: string;
  amount?: number;
  paymentMode?: string;
  reference?: string;
}

/**
 * Supplier History viewer — fetches purchases + payments for the supplier
 * from GET /api/suppliers/[id] and shows them in a unified timeline.
 */
export function SupplierHistoryDialog({
  open, onOpenChange, supplierId, supplierName,
}: SupplierHistoryDialogProps) {
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [stats, setStats] = useState({ totalPurchases: 0, totalPaid: 0, outstanding: 0 });
  const { toast } = useToast();

  useEffect(() => {
    if (open && supplierId) {
      loadHistory();
    } else if (!open) {
      setHistory([]);
    }
  }, [open, supplierId]);

  const loadHistory = async () => {
    if (!supplierId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/suppliers/${supplierId}`, { credentials: "include" });
      const data = await res.json();
      if (res.ok && data.supplier) {
        const purchases: HistoryEntry[] = (data.supplier.purchases || []).map((p: any) => ({
          id: p.id,
          refNo: p.refNo,
          type: "purchase" as const,
          date: p.createdAt,
          total: Number(p.total) || 0,
          amountPaid: Number(p.amountPaid) || 0,
          status: p.status,
        }));
        const payments: HistoryEntry[] = (data.supplier.payments || []).map((p: any) => ({
          id: p.id,
          type: "payment" as const,
          date: p.paymentDate,
          amount: Number(p.amount) || 0,
          paymentMode: p.paymentMode,
          reference: p.reference,
        }));
        // Merge + sort by date desc
        const merged = [...purchases, ...payments].sort((a, b) =>
          new Date(b.date).getTime() - new Date(a.date).getTime()
        );
        setHistory(merged);
        setStats({
          totalPurchases: purchases.reduce((s, p) => s + (p.total || 0), 0),
          totalPaid: payments.reduce((s, p) => s + (p.amount || 0), 0),
          outstanding: purchases.reduce((s, p) => s + ((p.total || 0) - (p.amountPaid || 0)), 0),
        });
      }
    } catch (e: any) {
      toast({ title: "Failed to load history", description: e?.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl p-0 overflow-hidden">
        {/* Premium gradient header */}
        <div className="bg-gradient-to-br from-blue-600 via-cyan-600 to-teal-600 text-white px-6 py-5 relative overflow-hidden">
          <div className="pointer-events-none absolute -top-12 -right-12 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
          <div className="relative z-10 flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-white/20 ring-1 ring-white/30 flex items-center justify-center backdrop-blur-sm">
              <History className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight">Supplier History</h2>
              <p className="text-[11px] opacity-85">{supplierName}</p>
            </div>
          </div>
        </div>

        <div className="px-6 py-5 max-h-[65vh] overflow-y-auto">
          {/* Stats tiles */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total Purchases</div>
              <div className="text-base font-extrabold font-mono mt-0.5">{formatGHS(stats.totalPurchases)}</div>
            </div>
            <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/40 p-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Total Paid</div>
              <div className="text-base font-extrabold font-mono text-emerald-700 dark:text-emerald-300 mt-0.5">{formatGHS(stats.totalPaid)}</div>
            </div>
            <div className="rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/40 p-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-rose-600">Outstanding</div>
              <div className="text-base font-extrabold font-mono text-rose-700 dark:text-rose-300 mt-0.5">{formatGHS(stats.outstanding)}</div>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-8 text-slate-500">
              <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
              Loading history…
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <History className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm font-semibold">No transactions yet</p>
              <p className="text-xs mt-1">Purchases and payments for this supplier will appear here.</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {history.map((entry) => (
                <div
                  key={entry.id}
                  className={cn(
                    "flex items-center gap-3 p-2.5 rounded-lg border",
                    entry.type === "purchase"
                      ? "bg-blue-50 dark:bg-blue-950/30 border-blue-100 dark:border-blue-900/40"
                      : "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-100 dark:border-emerald-900/40"
                  )}
                >
                  <div className={cn(
                    "h-9 w-9 rounded-lg flex items-center justify-center shrink-0",
                    entry.type === "purchase" ? "bg-blue-100 dark:bg-blue-900/40" : "bg-emerald-100 dark:bg-emerald-900/40"
                  )}>
                    {entry.type === "purchase" ? <Package className="h-4 w-4 text-blue-600" /> : <CreditCard className="h-4 w-4 text-emerald-600" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate">
                      {entry.type === "purchase" ? `Purchase ${entry.refNo}` : `Payment`}
                      {entry.reference && <span className="text-xs text-slate-500 ml-1.5">· ref: {entry.reference}</span>}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {new Date(entry.date).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
                      {entry.paymentMode && ` · ${entry.paymentMode}`}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    {entry.type === "purchase" ? (
                      <>
                        <div className="font-mono font-bold text-sm">{formatGHS(entry.total || 0)}</div>
                        {entry.status && (
                          <Badge variant="outline" className="text-[9px] uppercase mt-0.5">{entry.status}</Badge>
                        )}
                      </>
                    ) : (
                      <div className="font-mono font-bold text-sm text-emerald-600">−{formatGHS(entry.amount || 0)}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
