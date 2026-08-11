"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { PackageCheck, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
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

interface PurchaseLineItem {
  id: string;
  partNo: string;
  details: string;
  emoji?: string;
  quantity: number;
  cost: number;
  receivedQty?: number | null;
}

interface PurchaseReceiveDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  purchaseId: string | null;
  refNo: string;
  supplierName: string;
  items: PurchaseLineItem[];
  onReceived?: () => void;
}

/**
 * Premium Goods Receipt Note (GRN) dialog.
 *
 * Lets the cashier record partial or full receipt of goods. Each line shows
 * ordered vs already-received, with fields for received + rejected quantities.
 *
 * Calls the existing PUT /api/purchases/[id] with action="receive" endpoint.
 */
export function PurchaseReceiveDialog({
  open, onOpenChange, purchaseId, refNo, supplierName, items, onReceived,
}: PurchaseReceiveDialogProps) {
  const [received, setReceived] = useState<Record<string, { qty: number; rejected: number; reason: string }>>({});
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      const init: Record<string, { qty: number; rejected: number; reason: string }> = {};
      items.forEach(item => {
        const outstanding = Math.max(0, item.quantity - Number(item.receivedQty || 0));
        init[item.id] = { qty: outstanding, rejected: 0, reason: "" };
      });
      setReceived(init);
      setNotes("");
      setSubmitting(false);
    }
  }, [open, items]);

  const totalToReceive = items.reduce((sum, item) => {
    return sum + (received[item.id]?.qty || 0);
  }, 0);

  const totalReject = items.reduce((sum, item) => {
    return sum + (received[item.id]?.rejected || 0);
  }, 0);

  const handleReceive = async () => {
    if (!purchaseId) {
      toast({ title: "Save the purchase first", variant: "destructive" });
      return;
    }
    if (totalToReceive <= 0) {
      toast({ title: "Nothing to receive", description: "Enter a received quantity for at least one item.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      // Use the existing PUT /api/purchases/[id] with action="receive"
      const res = await authedFetch(`/api/purchases/${purchaseId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action: "receive",
          receivedItems: items.map(item => ({
            id: item.id,
            receivedQty: received[item.id]?.qty || 0,
            rejectedQty: received[item.id]?.rejected || 0,
            rejectionReason: received[item.id]?.reason || null,
          })),
          notes,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast({
          title: "Goods received ✓",
          description: `${refNo}: ${totalToReceive} item(s) received${totalReject > 0 ? `, ${totalReject} rejected` : ""}`,
        });
        onOpenChange(false);
        onReceived?.();
      } else {
        throw new Error(data.error || "Failed to receive");
      }
    } catch (e: any) {
      toast({ title: "Failed to receive", description: e?.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl p-0 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-br from-indigo-600 via-blue-600 to-cyan-600 text-white px-6 py-5 relative overflow-hidden">
          <div className="pointer-events-none absolute -top-12 -right-12 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
          <div className="relative z-10 flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-white/20 ring-1 ring-white/30 flex items-center justify-center backdrop-blur-sm">
              <PackageCheck className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-bold tracking-tight">Goods Receipt Note</h2>
              <p className="text-[11px] opacity-85">Receive goods for {refNo} from {supplierName}</p>
            </div>
            <Badge className="bg-white/20 text-white border-white/30 backdrop-blur-sm">
              {totalToReceive} to receive
            </Badge>
          </div>
        </div>

        <div className="px-6 py-5 space-y-3 max-h-[60vh] overflow-y-auto">
          {items.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <PackageCheck className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No items to receive.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-12 gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 px-2">
                <div className="col-span-4">Item</div>
                <div className="col-span-2 text-center">Ordered</div>
                <div className="col-span-2 text-center">Already Recv'd</div>
                <div className="col-span-2 text-center">Now Receiving</div>
                <div className="col-span-2 text-center">Rejected</div>
              </div>
              {items.map(item => {
                const outstanding = Math.max(0, item.quantity - Number(item.receivedQty || 0));
                const r = received[item.id] || { qty: 0, rejected: 0, reason: "" };
                const isFullyReceived = outstanding <= 0;
                return (
                  <div
                    key={item.id}
                    className={cn(
                      "grid grid-cols-12 gap-2 items-center p-2 rounded-lg",
                      isFullyReceived
                        ? "bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/40"
                        : "bg-slate-50 dark:bg-slate-800/50"
                    )}
                  >
                    <div className="col-span-4 flex items-center gap-2">
                      {item.emoji && <span className="text-base">{item.emoji}</span>}
                      <div className="min-w-0">
                        <div className="text-sm font-semibold truncate">{item.details || item.partNo}</div>
                        <div className="text-[10px] text-slate-500 font-mono">{item.partNo}</div>
                      </div>
                      {isFullyReceived && (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 ml-auto" />
                      )}
                    </div>
                    <div className="col-span-2 text-center font-mono text-sm">{item.quantity}</div>
                    <div className="col-span-2 text-center font-mono text-sm text-emerald-600">{Number(item.receivedQty || 0)}</div>
                    <div className="col-span-2">
                      <Input
                        type="number"
                        min="0"
                        max={outstanding}
                        value={r.qty}
                        onChange={(e) => setReceived({
                          ...received,
                          [item.id]: { ...r, qty: Math.min(outstanding, parseFloat(e.target.value) || 0) },
                        })}
                        className="h-9 text-center text-sm font-mono"
                        disabled={isFullyReceived}
                      />
                    </div>
                    <div className="col-span-2">
                      <Input
                        type="number"
                        min="0"
                        value={r.rejected}
                        onChange={(e) => setReceived({
                          ...received,
                          [item.id]: { ...r, rejected: parseFloat(e.target.value) || 0 },
                        })}
                        className="h-9 text-center text-sm font-mono"
                      />
                    </div>
                    {r.rejected > 0 && (
                      <div className="col-span-12">
                        <Input
                          value={r.reason}
                          onChange={(e) => setReceived({
                            ...received,
                            [item.id]: { ...r, reason: e.target.value },
                          })}
                          placeholder="Reason for rejection (e.g. damaged, expired, wrong item)"
                          className="h-9 text-xs"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
              <div>
                <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Notes (optional)</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Delivery notes, driver name, vehicle no…"
                  className="text-sm"
                />
              </div>
            </>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between gap-2">
          <div className="text-xs text-slate-500">
            {totalToReceive > 0 ? (
              <>Receiving <span className="font-bold text-slate-700 dark:text-slate-300">{totalToReceive}</span> item(s)
              {totalReject > 0 && <span className="text-rose-600 ml-2">· {totalReject} rejected</span>}
              </>
            ) : (
              "Enter received quantities above"
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="h-11" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button
              onClick={handleReceive}
              disabled={submitting || totalToReceive <= 0 || !purchaseId}
              className="h-11 bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-700 hover:to-cyan-700 text-white font-bold"
            >
              {submitting ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Receiving…</>
              ) : (
                <><CheckCircle2 className="h-4 w-4 mr-2" /> Receive Goods</>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
