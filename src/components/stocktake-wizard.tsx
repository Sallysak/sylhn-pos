"use client";

import { authedFetch } from "@/lib/client-auth";
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ClipboardCheck, Loader2, Plus, CheckCircle2, AlertTriangle,
  ChevronRight, ChevronLeft, ScanLine, Package,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { formatGHS, type Product } from "@/lib/pos-data";

interface StocktakeWizardProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  products: Product[];
}

interface StocktakeItem {
  productId: string;
  productName: string;
  emoji: string;
  sku: string;
  expectedQty: number;
  countedQty: number | null;
  variance: number | null;
  reason: string;
}

type Step = "create" | "count" | "review" | "complete";

export function StocktakeWizard({ open, onOpenChange, products }: StocktakeWizardProps) {
  const [step, setStep] = useState<Step>("create");
  const [stocktakeId, setStocktakeId] = useState<string | null>(null);
  const [countMethod, setCountMethod] = useState<"full" | "cycle" | "spot">("full");
  const [scope, setScope] = useState("all");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<StocktakeItem[]>([]);
  const [scanInput, setScanInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [varianceSummary, setVarianceSummary] = useState({ total: 0, positive: 0, negative: 0, zero: 0 });
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      setStep("create");
      setStocktakeId(null);
      setItems([]);
      setNotes("");
      setScanInput("");
    }
  }, [open]);

  // Step 1: Create the stocktake
  const handleCreate = async () => {
    setSubmitting(true);
    try {
      // Initialize items from all products (full count) or a subset (cycle/spot)
      const initialItems: StocktakeItem[] = products.map(p => ({
        productId: p.id,
        productName: p.name,
        emoji: p.emoji,
        sku: p.sku,
        expectedQty: p.stock || p.quantity || 0,
        countedQty: null,
        variance: null,
        reason: "",
      }));

      const res = await authedFetch("/api/stocktakes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          countMethod,
          scope,
          notes,
          status: "in-progress",
          startedAt: new Date().toISOString(),
          items: initialItems.map(i => ({
            productId: i.productId,
            expectedQty: i.expectedQty,
          })),
        }),
      });
      const data = await res.json();
      if (res.ok && data.stocktake) {
        setStocktakeId(data.stocktake.id);
        setItems(initialItems);
        setStep("count");
        toast({ title: "Stocktake started ✓", description: `${initialItems.length} items to count` });
      } else {
        throw new Error(data.error || "Failed");
      }
    } catch (e: any) {
      toast({ title: "Failed to start stocktake", description: e?.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  // Step 2: Scan a barcode to increment count
  const handleScan = useCallback(async () => {
    if (!scanInput.trim() || !stocktakeId) return;
    const barcode = scanInput.trim();
    setScanInput("");

    try {
      const res = await authedFetch("/api/stocktakes/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ stocktakeId, barcode }),
      });
      const data = await res.json();
      if (res.ok && data.product) {
        // Update local state
        setItems(prev => prev.map(item =>
          item.productId === data.product.id
            ? { ...item, countedQty: (item.countedQty || 0) + 1, variance: (item.countedQty || 0) + 1 - item.expectedQty }
            : item
        ));
        toast({ title: `Counted: ${data.product.emoji} ${data.product.name}`, description: `Count: ${(items.find(i => i.productId === data.product.id)?.countedQty || 0) + 1}` });
      } else {
        // Product not found — try local match
        const localProduct = products.find(p => p.sku === barcode || p.barcode === barcode);
        if (localProduct) {
          setItems(prev => prev.map(item =>
            item.productId === localProduct.id
              ? { ...item, countedQty: (item.countedQty || 0) + 1, variance: (item.countedQty || 0) + 1 - item.expectedQty }
              : item
          ));
        } else {
          toast({ title: "Product not found", description: `Barcode: ${barcode}`, variant: "destructive" });
        }
      }
    } catch {
      // Fallback: local match
      const localProduct = products.find(p => p.sku === scanInput || p.barcode === scanInput);
      if (localProduct) {
        setItems(prev => prev.map(item =>
          item.productId === localProduct.id
            ? { ...item, countedQty: (item.countedQty || 0) + 1, variance: (item.countedQty || 0) + 1 - item.expectedQty }
            : item
        ));
      }
    }
  }, [scanInput, stocktakeId, items, products, toast]);

  // Manual count entry
  const handleManualCount = (productId: string, count: number) => {
    setItems(prev => prev.map(item =>
      item.productId === productId
        ? { ...item, countedQty: count, variance: count - item.expectedQty }
        : item
    ));
  };

  // Quick increment (+1)
  const handleQuickIncrement = (productId: string, delta: number) => {
    setItems(prev => prev.map(item => {
      if (item.productId !== productId) return item;
      const newCount = (item.countedQty ?? 0) + delta;
      return { ...item, countedQty: newCount, variance: newCount - item.expectedQty };
    }));
  };

  // Filter: show only uncounted, or all
  const [showUncountedOnly, setShowUncountedOnly] = useState(false);
  const displayItems = showUncountedOnly ? items.filter(i => i.countedQty === null) : items;

  // Step 3: Review variances
  const handleReview = () => {
    const counted = items.filter(i => i.countedQty !== null);
    const positive = counted.filter(i => (i.variance || 0) > 0).length;
    const negative = counted.filter(i => (i.variance || 0) < 0).length;
    const zero = counted.filter(i => (i.variance || 0) === 0).length;
    setVarianceSummary({ total: counted.length, positive, negative, zero });
    setStep("review");
  };

  // Step 4: Complete the stocktake
  const handleComplete = async () => {
    if (!stocktakeId) return;
    setCompleting(true);
    try {
      const res = await authedFetch(`/api/stocktakes/${stocktakeId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ items: items.filter(i => i.countedQty !== null).map(i => ({ productId: i.productId, countedQty: i.countedQty, reason: i.reason })) }),
      });
      const data = await res.json();
      if (res.ok) {
        setStep("complete");
        toast({ title: "Stocktake completed ✓", description: "Stock levels updated with counted quantities" });
      } else {
        throw new Error(data.error || "Failed");
      }
    } catch (e: any) {
      toast({ title: "Failed to complete", description: e?.message, variant: "destructive" });
    } finally {
      setCompleting(false);
    }
  };

  const countedCount = items.filter(i => i.countedQty !== null).length;
  const uncountedCount = items.length - countedCount;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl p-0 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-br from-indigo-600 via-blue-600 to-cyan-600 text-white px-6 py-5 relative overflow-hidden">
          <div className="pointer-events-none absolute -top-12 -right-12 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
          <div className="relative z-10 flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-white/20 ring-1 ring-white/30 flex items-center justify-center backdrop-blur-sm">
              <ClipboardCheck className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-bold tracking-tight">Stocktake Wizard</h2>
              <p className="text-[11px] opacity-85">
                {step === "create" && "Step 1 of 4 — Setup"}
                {step === "count" && `Step 2 of 4 — Counting (${countedCount}/${items.length})`}
                {step === "review" && "Step 3 of 4 — Review Variances"}
                {step === "complete" && "Step 4 of 4 — Complete"}
              </p>
            </div>
          </div>
          {/* Progress bar */}
          <div className="relative z-10 mt-3 h-1.5 bg-white/20 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-white rounded-full"
              initial={{ width: "0%" }}
              animate={{ width: step === "create" ? "25%" : step === "count" ? "50%" : step === "review" ? "75%" : "100%" }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>

        <div className="px-6 py-5 max-h-[65vh] overflow-y-auto">
          <AnimatePresence mode="wait">
            {/* Step 1: Create */}
            {step === "create" && (
              <motion.div key="create" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                <div>
                  <Label className="text-[11px] font-bold uppercase text-slate-500 mb-1.5 block">Count Method</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { value: "full", label: "Full Count", desc: "All products", icon: "📦" },
                      { value: "cycle", label: "Cycle Count", desc: "Subset (e.g. one group)", icon: "🔄" },
                      { value: "spot", label: "Spot Check", desc: "Random items", icon: "🎯" },
                    ].map(m => (
                      <button key={m.value} onClick={() => setCountMethod(m.value as any)}
                        className={cn("flex flex-col items-center gap-1 py-3 rounded-xl ring-2 transition",
                          countMethod === m.value ? "ring-indigo-500 bg-indigo-50 dark:bg-indigo-950/30" : "ring-slate-200 dark:ring-slate-700 hover:ring-slate-300")}>
                        <span className="text-xl">{m.icon}</span>
                        <span className="text-xs font-bold">{m.label}</span>
                        <span className="text-[9px] text-slate-500">{m.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label className="text-[11px] font-bold uppercase text-slate-500 mb-1.5 block">Scope</Label>
                  <Input value={scope} onChange={(e) => setScope(e.target.value)} placeholder="all" className="h-9 text-sm" />
                </div>
                <div>
                  <Label className="text-[11px] font-bold uppercase text-slate-500 mb-1.5 block">Notes</Label>
                  <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="text-sm" placeholder="Optional notes for this stocktake..." />
                </div>
                <div className="bg-indigo-50 dark:bg-indigo-950/30 rounded-lg px-3 py-2 text-[11px] text-indigo-700 dark:text-indigo-300">
                  {products.length} products will be included in this stocktake.
                </div>
              </motion.div>
            )}

            {/* Step 2: Count */}
            {step === "count" && (
              <motion.div key="count" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
                {/* Scan input */}
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      value={scanInput}
                      onChange={(e) => setScanInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleScan(); } }}
                      placeholder="Scan barcode or type SKU + Enter..."
                      className="h-10 pl-9 text-sm font-mono"
                      autoFocus
                    />
                  </div>
                  <Button onClick={handleScan} className="bg-indigo-600 hover:bg-indigo-700">
                    <ScanLine className="h-4 w-4 mr-1" /> Count
                  </Button>
                </div>

                {/* Progress + filter */}
                <div className="flex items-center gap-2 text-xs">
                  <Badge className="bg-emerald-100 text-emerald-700">{countedCount} counted</Badge>
                  <Badge className="bg-amber-100 text-amber-700">{uncountedCount} remaining</Badge>
                  <Button size="sm" variant="outline" onClick={() => setShowUncountedOnly(!showUncountedOnly)} className="h-6 text-[10px]">
                    {showUncountedOnly ? "Show All" : "Show Uncounted Only"}
                  </Button>
                </div>

                {/* Items list */}
                <div className="max-h-72 overflow-y-auto space-y-1 border border-slate-200 dark:border-slate-700 rounded-lg p-1.5">
                  {displayItems.map(item => (
                    <div key={item.productId} className={cn(
                      "flex items-center gap-2 p-2 rounded-md transition",
                      item.countedQty !== null ? "bg-emerald-50 dark:bg-emerald-950/20" : "bg-white dark:bg-slate-800/50"
                    )}>
                      <span className="text-base shrink-0">{item.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold truncate">{item.productName}</div>
                        <div className="text-[9px] text-slate-500 font-mono">{item.sku} · expected: {item.expectedQty}</div>
                      </div>
                      {/* Quick increment buttons */}
                      <button onClick={() => handleQuickIncrement(item.productId, -1)} className="h-6 w-6 rounded bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-bold transition shrink-0">−</button>
                      <Input
                        type="number"
                        value={item.countedQty ?? ""}
                        onChange={(e) => handleManualCount(item.productId, parseInt(e.target.value) || 0)}
                        placeholder="—"
                        className="h-6 w-14 text-xs text-center font-mono"
                      />
                      <button onClick={() => handleQuickIncrement(item.productId, 1)} className="h-6 w-6 rounded bg-emerald-200 dark:bg-emerald-800 hover:bg-emerald-300 dark:hover:bg-emerald-700 text-emerald-700 dark:text-emerald-200 text-xs font-bold transition shrink-0">+</button>
                      {item.variance !== null && item.variance !== 0 && (
                        <Badge className={cn("text-[9px] shrink-0", item.variance > 0 ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700")}>
                          {item.variance > 0 ? "+" : ""}{item.variance}
                        </Badge>
                      )}
                    </div>
                  ))}
                  {displayItems.length === 0 && (
                    <div className="text-center py-4 text-slate-400 text-xs">
                      <CheckCircle2 className="h-6 w-6 mx-auto mb-1 text-emerald-500" />
                      All items counted!
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* Step 3: Review */}
            {step === "review" && (
              <motion.div key="review" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
                {/* Variance summary */}
                <div className="grid grid-cols-4 gap-2">
                  <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-2.5 text-center">
                    <div className="text-[10px] font-bold uppercase text-slate-500">Counted</div>
                    <div className="text-lg font-bold">{varianceSummary.total}</div>
                  </div>
                  <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/40 p-2.5 text-center">
                    <div className="text-[10px] font-bold uppercase text-emerald-600">Surplus</div>
                    <div className="text-lg font-bold text-emerald-700">+{varianceSummary.positive}</div>
                  </div>
                  <div className="rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/40 p-2.5 text-center">
                    <div className="text-[10px] font-bold uppercase text-rose-600">Short</div>
                    <div className="text-lg font-bold text-rose-700">−{varianceSummary.negative}</div>
                  </div>
                  <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40 p-2.5 text-center">
                    <div className="text-[10px] font-bold uppercase text-blue-600">Exact</div>
                    <div className="text-lg font-bold text-blue-700">{varianceSummary.zero}</div>
                  </div>
                </div>

                {/* Variance details */}
                <div className="max-h-60 overflow-y-auto space-y-1">
                  {items.filter(i => i.countedQty !== null && i.variance !== 0).map(item => (
                    <div key={item.productId} className="flex items-center gap-2 p-2 rounded-md bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/40">
                      <span className="text-base">{item.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold truncate">{item.productName}</div>
                        <div className="text-[9px] text-slate-500">Expected: {item.expectedQty} → Counted: {item.countedQty}</div>
                      </div>
                      <Badge className={cn("text-[9px]", (item.variance || 0) > 0 ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700")}>
                        {item.variance! > 0 ? "+" : ""}{item.variance}
                      </Badge>
                      <Input
                        value={item.reason}
                        onChange={(e) => setItems(prev => prev.map(i => i.productId === item.productId ? { ...i, reason: e.target.value } : i))}
                        placeholder="Reason..."
                        className="h-6 w-24 text-[10px]"
                      />
                    </div>
                  ))}
                  {items.filter(i => i.countedQty !== null && i.variance !== 0).length === 0 && (
                    <div className="text-center py-4 text-slate-400 text-xs">
                      <CheckCircle2 className="h-6 w-6 mx-auto mb-1 text-emerald-500" />
                      No variances — all counts match expected quantities!
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* Step 4: Complete */}
            {step === "complete" && (
              <motion.div key="complete" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center py-8">
                <div className="h-16 w-16 rounded-full bg-emerald-100 dark:bg-emerald-950/40 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                </div>
                <h3 className="text-lg font-bold mb-2">Stocktake Complete ✓</h3>
                <p className="text-sm text-slate-500 mb-4">
                  Counted {varianceSummary.total} items. Stock levels have been updated with the counted quantities.
                </p>
                <div className="inline-flex items-center gap-4 text-xs bg-slate-50 dark:bg-slate-800/50 rounded-lg px-4 py-2">
                  <span className="text-emerald-600">+{varianceSummary.positive} surplus</span>
                  <span className="text-rose-600">−{varianceSummary.negative} short</span>
                  <span className="text-blue-600">{varianceSummary.zero} exact</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer with step navigation */}
        {step !== "complete" && (
          <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex gap-2">
            {step === "create" && (
              <Button className="flex-1 h-11 bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-700 hover:to-cyan-700 text-white font-bold" onClick={handleCreate} disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ClipboardCheck className="h-4 w-4 mr-2" />}
                Start Counting
              </Button>
            )}
            {step === "count" && (
              <>
                <Button variant="outline" className="h-11" onClick={() => setStep("create")}>
                  <ChevronLeft className="h-4 w-4 mr-1" /> Back
                </Button>
                <Button className="flex-1 h-11 bg-gradient-to-r from-indigo-600 to-cyan-600 text-white font-bold" onClick={handleReview}>
                  Review Variances <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </>
            )}
            {step === "review" && (
              <>
                <Button variant="outline" className="h-11" onClick={() => setStep("count")}>
                  <ChevronLeft className="h-4 w-4 mr-1" /> Back
                </Button>
                <Button className="flex-1 h-11 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold" onClick={handleComplete} disabled={completing}>
                  {completing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                  Complete & Update Stock
                </Button>
              </>
            )}
          </div>
        )}
        {step === "complete" && (
          <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
            <Button className="w-full h-11" variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
