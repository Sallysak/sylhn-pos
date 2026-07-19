"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Clock, DollarSign, AlertTriangle, Check, Loader2,
  TrendingUp, Receipt, Wallet, ArrowLeft,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { authedFetch } from "@/lib/client-auth";
import { formatGHS } from "@/lib/pos-data";

interface ShiftCloseProps {
  open: boolean;
  onClose: () => void;
  onShiftClosed?: () => void;
}

interface Shift {
  id: string;
  cashierName: string;
  openedAt: string;
  openingFloat: number;
  status: "open" | "closed";
  sales?: Array<{
    id: string;
    total: number;
    paymentMethod: string;
  }>;
}

export function ShiftCloseDialog({ open, onClose, onShiftClosed }: ShiftCloseProps) {
  const { toast } = useToast();
  const [shift, setShift] = useState<Shift | null>(null);
  const [loading, setLoading] = useState(true);
  const [actualCash, setActualCash] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [closed, setClosed] = useState(false);

  const loadOpenShift = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authedFetch("/api/shifts?status=open&limit=1");
      if (res.ok) {
        const data = await res.json();
        if (data.shifts && data.shifts.length > 0) {
          setShift(data.shifts[0]);
        } else {
          setShift(null);
        }
      }
    } catch (e: any) {
      toast({ title: "Failed to load shift", description: e?.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (open) {
      loadOpenShift();
      setClosed(false);
      setActualCash("");
    }
  }, [open, loadOpenShift]);

  // Compute expected cash from sales
  const cashSales = shift?.sales?.filter(s => s.paymentMethod === "cash").reduce((sum, s) => sum + s.total, 0) || 0;
  const nonCashSales = shift?.sales?.filter(s => s.paymentMethod !== "cash").reduce((sum, s) => sum + s.total, 0) || 0;
  const totalSales = cashSales + nonCashSales;
  const expectedCash = (shift?.openingFloat || 0) + cashSales;
  const countedCash = parseFloat(actualCash) || 0;
  const variance = countedCash - expectedCash;

  const handleClose = async () => {
    if (!shift) return;
    if (!actualCash) {
      toast({ title: "Enter counted cash", description: "Count the cash in the drawer and enter the amount", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await authedFetch("/api/shifts", {
        method: "POST",
        body: JSON.stringify({
          action: "close",
          shiftId: shift.id,
          actualCash: countedCash,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success !== false) {
        toast({
          title: "Shift closed",
          description: `Variance: ${variance >= 0 ? "+" : ""}${formatGHS(variance)}`,
          variant: variance === 0 ? "default" : variance > 0 ? "default" : "destructive",
        });
        setClosed(true);
        onShiftClosed?.();
      } else {
        toast({ title: "Failed to close shift", description: data.error, variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Network error", description: e?.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-0 sm:p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, y: 30 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 30 }}
            onClick={(e) => e.stopPropagation()}
            className="dialog-premium shadow-premium-xl w-full max-w-md max-h-[90vh] overflow-y-auto scroll-premium"
          >
            {/* Header */}
            <div className="gradient-premium-emerald text-white px-6 py-4 flex items-center justify-between relative overflow-hidden">
              <div className="pointer-events-none absolute -top-12 -right-12 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
              <div className="flex items-center gap-2 relative z-10">
                <div className="relative">
                  <div className="absolute inset-0 rounded-xl bg-white/25 blur-md scale-110" />
                  <div className="relative h-9 w-9 rounded-xl bg-white/15 ring-1 ring-white/30 flex items-center justify-center backdrop-blur-md">
                    <Clock className="h-5 w-5" />
                  </div>
                </div>
                <h2 className="text-base font-bold tracking-tight">Close Cashier Shift</h2>
              </div>
              <button onClick={onClose} className="h-9 w-9 rounded-lg bg-white/15 hover:bg-white/25 flex items-center justify-center transition active:scale-90 relative z-10">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
                </div>
              ) : !shift ? (
                <div className="text-center py-12">
                  <Clock className="h-12 w-12 mx-auto text-slate-300 mb-3" />
                  <div className="text-sm font-semibold text-slate-700">No open shift</div>
                  <div className="text-xs text-slate-500 mt-1">You don't have an open shift to close.</div>
                </div>
              ) : closed ? (
                <div className="text-center py-8 space-y-4">
                  <div className="h-16 w-16 rounded-full gradient-premium-emerald mx-auto flex items-center justify-center shadow-glow-emerald">
                    <Check className="h-8 w-8 text-white" />
                  </div>
                  <div>
                    <div className="text-base font-bold text-slate-800">Shift Closed Successfully</div>
                    <div className="text-xs text-slate-500 mt-1">
                      Variance: <span className={variance === 0 ? "text-emerald-600 font-bold" : variance > 0 ? "text-blue-600 font-bold" : "text-rose-600 font-bold"}>
                        {variance >= 0 ? "+" : ""}{formatGHS(variance)}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={onClose}
                    className="btn-premium h-10 px-6 rounded-lg gradient-premium-emerald hover:shadow-glow-emerald text-white text-sm font-bold transition"
                  >
                    Done
                  </button>
                </div>
              ) : (
                <>
                  {/* Shift info */}
                  <div className="bg-slate-50 rounded-xl p-3 ring-1 ring-slate-200 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 font-medium">Cashier</span>
                      <span className="font-bold text-slate-800">{shift.cashierName}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 font-medium">Opened at</span>
                      <span className="font-mono text-slate-700">
                        {new Date(shift.openedAt).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 font-medium">Opening float</span>
                      <span className="font-mono font-bold text-slate-800">{formatGHS(shift.openingFloat)}</span>
                    </div>
                  </div>

                  {/* Sales summary */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-emerald-50 rounded-xl p-3 text-center ring-1 ring-emerald-200">
                      <Wallet className="h-4 w-4 text-emerald-600 mx-auto mb-1" />
                      <div className="text-[9px] text-emerald-700 font-bold uppercase">Cash Sales</div>
                      <div className="text-xs font-mono font-bold text-emerald-700">{formatGHS(cashSales)}</div>
                    </div>
                    <div className="bg-blue-50 rounded-xl p-3 text-center ring-1 ring-blue-200">
                      <Receipt className="h-4 w-4 text-blue-600 mx-auto mb-1" />
                      <div className="text-[9px] text-blue-700 font-bold uppercase">Other</div>
                      <div className="text-xs font-mono font-bold text-blue-700">{formatGHS(nonCashSales)}</div>
                    </div>
                    <div className="bg-violet-50 rounded-xl p-3 text-center ring-1 ring-violet-200">
                      <TrendingUp className="h-4 w-4 text-violet-600 mx-auto mb-1" />
                      <div className="text-[9px] text-violet-700 font-bold uppercase">Total</div>
                      <div className="text-xs font-mono font-bold text-violet-700">{formatGHS(totalSales)}</div>
                    </div>
                  </div>

                  {/* Expected cash */}
                  <div className="bg-amber-50 rounded-xl p-3 ring-1 ring-amber-200 flex items-center justify-between">
                    <div>
                      <div className="text-[10px] text-amber-700 font-bold uppercase">Expected Cash in Drawer</div>
                      <div className="text-[9px] text-amber-600">Opening float + cash sales</div>
                    </div>
                    <div className="text-lg font-mono font-bold text-amber-700">{formatGHS(expectedCash)}</div>
                  </div>

                  {/* Counted cash input */}
                  <div>
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">
                      Counted Cash in Drawer
                    </label>
                    <div className="relative">
                      <DollarSign className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <input
                        type="number"
                        step="0.01"
                        value={actualCash}
                        onChange={(e) => setActualCash(e.target.value)}
                        placeholder="0.00"
                        className="input-premium w-full h-12 pl-11 pr-4 text-sm font-mono font-bold text-lg"
                        autoFocus
                      />
                    </div>
                  </div>

                  {/* Variance indicator */}
                  {actualCash && (
                    <div className={`rounded-xl p-3 ring-1 flex items-center justify-between ${
                      variance === 0
                        ? "bg-emerald-50 ring-emerald-200"
                        : variance > 0
                        ? "bg-blue-50 ring-blue-200"
                        : "bg-rose-50 ring-rose-200"
                    }`}>
                      <div className="flex items-center gap-2">
                        {variance === 0 ? (
                          <Check className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <AlertTriangle className={`h-4 w-4 ${variance > 0 ? "text-blue-600" : "text-rose-600"}`} />
                        )}
                        <span className={`text-xs font-bold ${
                          variance === 0 ? "text-emerald-700" : variance > 0 ? "text-blue-700" : "text-rose-700"
                        }`}>
                          {variance === 0 ? "Perfect — no variance" : variance > 0 ? "Cash over" : "Cash short"}
                        </span>
                      </div>
                      <div className={`text-sm font-mono font-bold ${
                        variance === 0 ? "text-emerald-700" : variance > 0 ? "text-blue-700" : "text-rose-700"
                      }`}>
                        {variance >= 0 ? "+" : ""}{formatGHS(variance)}
                      </div>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={onClose}
                      className="h-11 px-4 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold transition flex items-center gap-1.5"
                    >
                      <ArrowLeft className="h-4 w-4" /> Cancel
                    </button>
                    <button
                      onClick={handleClose}
                      disabled={submitting || !actualCash}
                      className="btn-premium flex-1 h-11 rounded-lg gradient-premium-emerald hover:shadow-glow-emerald disabled:opacity-50 text-white text-sm font-bold transition flex items-center justify-center gap-2"
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Closing...
                        </>
                      ) : (
                        <>
                          <Check className="h-4 w-4" />
                          Close Shift
                        </>
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
