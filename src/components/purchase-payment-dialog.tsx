"use client";

import { authedFetch } from "@/lib/client-auth";
import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { CreditCard, Loader2, CheckCircle2, AlertTriangle, Calendar } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { formatGHS } from "@/lib/pos-data";

interface PurchasePaymentDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  purchaseId: string | null;
  refNo: string;
  supplierId?: string;
  supplierName: string;
  totalAmount: number;
  paidAmount: number;
  onPaid?: () => void;
}

const METHOD_OPTIONS = [
  { value: "cash", label: "Cash", icon: "💵" },
  { value: "momo", label: "MoMo", icon: "📱" },
  { value: "bank_transfer", label: "Bank", icon: "🏦" },
  { value: "cheque", label: "Cheque", icon: "🧾" },
] as const;

/**
 * Premium Record Supplier Payment dialog — mirrors the Settle Credit Payment design.
 * Calls the existing POST /api/supplier-payments endpoint.
 */
export function PurchasePaymentDialog({
  open, onOpenChange, purchaseId, refNo, supplierId, supplierName, totalAmount, paidAmount, onPaid,
}: PurchasePaymentDialogProps) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<typeof METHOD_OPTIONS[number]["value"]>("cash");
  const [reference, setReference] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const dueAmount = Math.max(0, totalAmount - paidAmount);

  useEffect(() => {
    if (open) {
      setAmount("");
      setMethod("cash");
      setReference("");
      setPaymentDate(new Date().toISOString().slice(0, 10));
      setNotes("");
      setSubmitting(false);
    }
  }, [open]);

  const parsedAmount = parseFloat(amount) || 0;
  const exceedsDue = parsedAmount > dueAmount;
  const remainingAfter = Math.max(0, dueAmount - parsedAmount);
  const appliedPct = dueAmount > 0 ? (parsedAmount / dueAmount) * 100 : 0;

  const quickAmounts = [
    { label: "25%", value: dueAmount * 0.25 },
    { label: "Half", value: dueAmount * 0.5 },
    { label: "75%", value: dueAmount * 0.75 },
    { label: "Full", value: dueAmount },
  ];

  const handlePay = async () => {
    if (!purchaseId || !supplierId) {
      toast({ title: "Save the purchase first", description: "You can only record a payment on a saved purchase.", variant: "destructive" });
      return;
    }
    if (parsedAmount <= 0 || exceedsDue) {
      toast({ title: "Enter a valid amount", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await authedFetch("/api/supplier-payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          supplierId,
          purchaseId,
          amount: parsedAmount,
          paymentMode: method,
          reference,
          notes,
          paymentDate,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast({
          title: "Payment recorded ✓",
          description: `${formatGHS(parsedAmount)} paid to ${supplierName}`,
        });
        onOpenChange(false);
        onPaid?.();
      } else {
        toast({ title: "Failed", description: data.error, variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Network error", description: e?.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg p-0 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-600 text-white px-6 py-5 relative overflow-hidden">
          <div className="pointer-events-none absolute -top-12 -right-12 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
          <div className="relative z-10 flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-white/20 ring-1 ring-white/30 flex items-center justify-center backdrop-blur-sm">
              <CreditCard className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold tracking-tight">Record Supplier Payment</h2>
              <p className="text-[11px] opacity-85 truncate">Paying {supplierName} for {refNo}</p>
            </div>
            <Badge className="bg-white/20 text-white border-white/30 backdrop-blur-sm uppercase">
              {method}
            </Badge>
          </div>
        </div>

        <div className="px-6 py-5 space-y-5 max-h-[65vh] overflow-y-auto">
          {/* KPI tiles */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 p-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total</div>
              <div className="text-base font-extrabold font-mono mt-0.5">{formatGHS(totalAmount)}</div>
            </div>
            <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/40 p-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Paid</div>
              <div className="text-base font-extrabold font-mono text-emerald-700 dark:text-emerald-300 mt-0.5">{formatGHS(paidAmount)}</div>
            </div>
            <div className="rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/40 p-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-rose-600">Due</div>
              <div className="text-base font-extrabold font-mono text-rose-700 dark:text-rose-300 mt-0.5">{formatGHS(dueAmount)}</div>
            </div>
          </div>

          {/* Method picker */}
          <div>
            <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Payment Method</Label>
            <div className="grid grid-cols-4 gap-2">
              {METHOD_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setMethod(opt.value)}
                  className={cn(
                    "flex flex-col items-center gap-1 py-2.5 rounded-xl ring-2 transition",
                    method === opt.value
                      ? "ring-emerald-500 bg-emerald-50 dark:bg-emerald-950/40"
                      : "ring-slate-200 dark:ring-slate-700 hover:ring-slate-300 dark:hover:ring-slate-600"
                  )}
                >
                  <span className="text-base leading-none">{opt.icon}</span>
                  <span className="text-[10px] font-bold uppercase tracking-wide">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Amount */}
          <div>
            <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Amount (GHS)</Label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-sm font-bold">₵</span>
              <Input
                type="number"
                step="0.01"
                min="0"
                max={dueAmount}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className={cn(
                  "h-12 pl-8 pr-4 text-lg font-bold font-mono",
                  exceedsDue && "border-rose-400 focus-visible:ring-rose-400"
                )}
                autoFocus
              />
            </div>
            <div className="grid grid-cols-4 gap-2 mt-2">
              {quickAmounts.map(qa => (
                <button
                  key={qa.label}
                  type="button"
                  onClick={() => setAmount(qa.value.toFixed(2))}
                  disabled={dueAmount <= 0}
                  className="h-8 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-700 dark:hover:text-emerald-300 text-slate-600 dark:text-slate-300 transition disabled:opacity-40"
                >
                  {qa.label}
                </button>
              ))}
            </div>
            {parsedAmount > 0 && !exceedsDue && (
              <div className="mt-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 p-3">
                <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
                  <span className="text-slate-500">Remaining after payment</span>
                  <span className="font-mono text-rose-600 dark:text-rose-400">{formatGHS(remainingAfter)}</span>
                </div>
                <div className="h-2 bg-rose-100 dark:bg-rose-950/40 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${appliedPct}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              </div>
            )}
            {exceedsDue && (
              <div className="mt-2 flex items-center gap-1.5 text-xs text-rose-600 dark:text-rose-400 font-medium">
                <AlertTriangle className="h-3.5 w-3.5" />
                Amount exceeds due balance of {formatGHS(dueAmount)}
              </div>
            )}
          </div>

          {/* Reference + date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Reference</Label>
              <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Cheque no, MoMo ref" className="h-10 text-sm" />
            </div>
            <div>
              <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Date</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} className="h-10 pl-9 text-sm" />
              </div>
            </div>
          </div>

          <div>
            <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Notes (optional)</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="text-sm" />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center justify-between mb-3 text-xs">
            <span className="text-slate-500">Payment</span>
            <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400 text-base">
              {parsedAmount > 0 ? formatGHS(parsedAmount) : "—"}
            </span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1 h-11" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button
              onClick={handlePay}
              disabled={submitting || dueAmount <= 0 || parsedAmount <= 0 || exceedsDue || !purchaseId || !supplierId}
              className="flex-1 h-11 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold"
            >
              {submitting ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Recording…</>
              ) : (
                <><CheckCircle2 className="h-4 w-4 mr-2" /> Record Payment</>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
