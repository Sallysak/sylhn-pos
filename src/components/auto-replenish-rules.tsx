"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  RotateCcw, Plus, Trash2, Play, Settings, AlertTriangle,
  Package, Truck, Clock, TrendingUp, RefreshCw, Loader2, X,
  CheckCircle2, Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft } from "lucide-react";

interface Rule {
  id: string;
  productId: string;
  product: { id: string; name: string; sku: string; emoji: string; quantity: number; reorderLevel: number };
  triggerLevel: number;
  reorderQty: number;
  supplierId: string | null;
  supplier: { id: string; name: string } | null;
  cooldownHours: number;
  lastTriggeredAt: string | null;
  triggerCount: number;
  isActive: boolean;
  shouldTrigger?: boolean;
}

interface Product { id: string; name: string; sku: string; emoji: string; quantity: number; }
interface Supplier { id: string; name: string; }

export function AutoReplenishRules({ onBack }: { onBack: () => void }) {
  const [rules, setRules] = useState<Rule[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<any>(null);
  const { toast } = useToast();

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [rulesRes, prodRes, supRes] = await Promise.all([
        fetch("/api/auto-replenish", { credentials: "include" }),
        fetch("/api/products?limit=500", { credentials: "include" }),
        fetch("/api/suppliers?limit=200", { credentials: "include" }),
      ]);
      const [rulesData, prodData, supData] = await Promise.all([rulesRes.json(), prodRes.json(), supRes.json()]);
      if (rulesRes.ok) {
        const rulesArr = rulesData.rules || rulesData.data || [];
        setRules(Array.isArray(rulesArr) ? rulesArr : []);
      }
      if (prodRes.ok) setProducts(prodData.products || []);
      if (supRes.ok) setSuppliers(supData.suppliers || []);
    } catch (e) {
      toast({ title: "Failed to load", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchAll(); }, []);

  const runScan = async () => {
    setScanning(true);
    setScanResult(null);
    try {
      const res = await fetch("/api/auto-replenish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "scan" }),
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok) {
        setScanResult(data);
        const poCount = data.triggeredPos?.length || 0;
        toast({
          title: "Scan complete",
          description: poCount > 0
            ? `Created ${poCount} purchase order(s).`
            : "No rules triggered.",
        });
        fetchAll();
      } else {
        toast({ title: "Scan failed", description: data.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setScanning(false);
    }
  };

  const toggleRule = async (rule: Rule) => {
    try {
      const res = await fetch("/api/auto-replenish", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: rule.id, isActive: !rule.isActive }),
        credentials: "include",
      });
      if (res.ok) {
        toast({ title: rule.isActive ? "Rule paused" : "Rule activated" });
        fetchAll();
      } else {
        toast({ title: "Update failed", variant: "destructive" });
      }
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    }
  };

  const deleteRule = async (rule: Rule) => {
    if (!confirm(`Delete rule for ${rule.product?.name}?`)) return;
    try {
      const res = await fetch(`/api/auto-replenish?id=${rule.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) {
        toast({ title: "Rule deleted" });
        fetchAll();
      } else {
        toast({ title: "Delete failed", variant: "destructive" });
      }
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    }
  };

  const summary = {
    total: rules.length,
    active: rules.filter(r => r.isActive).length,
    triggered: rules.filter(r => r.shouldTrigger).length,
    totalOrders: rules.reduce((s, r) => s + r.triggerCount, 0),
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      {/* Header */}
      <div className="sticky top-0 z-10 backdrop-blur-xl bg-white/80 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={onBack}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <RotateCcw className="h-6 w-6 text-emerald-600" />
                Auto Replenishment
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                Configure rules that auto-create purchase orders when stock runs low
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={runScan} disabled={scanning}>
              {scanning ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
              Run Scan Now
            </Button>
            <Button onClick={() => setShowAddDialog(true)} className="bg-emerald-600 hover:bg-emerald-700">
              <Plus className="h-4 w-4 mr-2" /> New Rule
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* KPI cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4 dark:bg-slate-900 dark:border-slate-800">
            <div className="flex items-center gap-2 text-slate-500 text-xs uppercase tracking-wider mb-1">
              <Settings className="h-4 w-4" /> Total Rules
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">{summary.total}</div>
          </Card>
          <Card className="p-4 dark:bg-slate-900 dark:border-slate-800">
            <div className="flex items-center gap-2 text-slate-500 text-xs uppercase tracking-wider mb-1">
              <CheckCircle2 className="h-4 w-4" /> Active
            </div>
            <div className="text-2xl font-bold text-emerald-600">{summary.active}</div>
          </Card>
          <Card className="p-4 dark:bg-slate-900 dark:border-slate-800">
            <div className="flex items-center gap-2 text-slate-500 text-xs uppercase tracking-wider mb-1">
              <Zap className="h-4 w-4" /> Should Trigger Now
            </div>
            <div className="text-2xl font-bold text-amber-600">{summary.triggered}</div>
          </Card>
          <Card className="p-4 dark:bg-slate-900 dark:border-slate-800">
            <div className="flex items-center gap-2 text-slate-500 text-xs uppercase tracking-wider mb-1">
              <Truck className="h-4 w-4" /> POs Created
            </div>
            <div className="text-2xl font-bold text-blue-600">{summary.totalOrders}</div>
          </Card>
        </div>

        {/* Scan result */}
        {scanResult && (
          <Card className="p-5 dark:bg-slate-900 dark:border-slate-800 border-emerald-200 dark:border-emerald-900/50">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                Scan Result
              </h3>
              <Button variant="ghost" size="sm" onClick={() => setScanResult(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="text-sm text-slate-600 dark:text-slate-300 space-y-1">
              <div>Rules scanned: <span className="font-semibold">{scanResult.scanned ?? "—"}</span></div>
              <div>Rules triggered: <span className="font-semibold text-amber-600">{scanResult.triggered ?? 0}</span></div>
              <div>Rules skipped: <span className="font-semibold">{scanResult.skippedCount ?? 0}</span></div>
              {scanResult.triggeredPos && scanResult.triggeredPos.length > 0 && (
                <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                  <div className="font-semibold text-emerald-700 dark:text-emerald-400 mb-1">POs Created:</div>
                  {scanResult.triggeredPos.map((po: any, i: number) => (
                    <div key={i} className="text-xs">
                      • <span className="font-mono">{po.refNo}</span> — {po.supplierName} — {po.itemCount} item(s) — GHS {po.total.toFixed(2)}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Rules table */}
        <Card className="dark:bg-slate-900 dark:border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 uppercase text-xs">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Product</th>
                  <th className="px-4 py-3 text-right font-semibold">Current Stock</th>
                  <th className="px-4 py-3 text-right font-semibold">Trigger At</th>
                  <th className="px-4 py-3 text-right font-semibold">Reorder Qty</th>
                  <th className="px-4 py-3 text-left font-semibold">Supplier</th>
                  <th className="px-4 py-3 text-right font-semibold">Cooldown</th>
                  <th className="px-4 py-3 text-center font-semibold">Last Triggered</th>
                  <th className="px-4 py-3 text-center font-semibold">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {loading ? (
                  <tr><td colSpan={9} className="text-center py-12 text-slate-500">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" /> Loading rules…
                  </td></tr>
                ) : rules.length === 0 ? (
                  <tr><td colSpan={9} className="text-center py-12 text-slate-500">
                    <Package className="h-10 w-10 mx-auto mb-2 opacity-30" />
                    No rules yet. Click "New Rule" to set up auto-replenishment for a product.
                  </td></tr>
                ) : rules.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{r.product?.emoji || "📦"}</span>
                        <div>
                          <div className="font-semibold text-slate-900 dark:text-white">{r.product?.name || "Unknown"}</div>
                          <div className="text-xs text-slate-500 font-mono">{r.product?.sku}</div>
                        </div>
                      </div>
                    </td>
                    <td className={`px-4 py-3 text-right font-mono font-semibold ${r.product?.quantity <= r.triggerLevel ? "text-rose-600" : "text-slate-700 dark:text-slate-200"}`}>
                      {r.product?.quantity ?? "—"}
                      {r.shouldTrigger && (
                        <Badge variant="destructive" className="ml-2 text-xs">Trigger</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-amber-700 dark:text-amber-400">{r.triggerLevel}</td>
                    <td className="px-4 py-3 text-right font-mono text-blue-700 dark:text-blue-400">{r.reorderQty}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{r.supplier?.name || "—"}</td>
                    <td className="px-4 py-3 text-right text-xs text-slate-500">{r.cooldownHours}h</td>
                    <td className="px-4 py-3 text-center text-xs text-slate-500">
                      {r.lastTriggeredAt ? new Date(r.lastTriggeredAt).toLocaleDateString() : "Never"}
                      <div className="text-xs">({r.triggerCount}× total)</div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {r.isActive ? (
                        <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">Active</Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400">Paused</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex gap-1 justify-end">
                        <Button size="sm" variant="ghost" onClick={() => toggleRule(r)}>
                          {r.isActive ? "Pause" : "Activate"}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => deleteRule(r)}>
                          <Trash2 className="h-4 w-4 text-rose-500" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <AddRuleDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        products={products}
        suppliers={suppliers}
        onCreated={fetchAll}
      />
    </div>
  );
}

function AddRuleDialog({
  open, onOpenChange, products, suppliers, onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  products: Product[];
  suppliers: Supplier[];
  onCreated: () => void;
}) {
  const [productId, setProductId] = useState("");
  const [triggerLevel, setTriggerLevel] = useState("5");
  const [reorderQty, setReorderQty] = useState("24");
  const [supplierId, setSupplierId] = useState("");
  const [cooldownHours, setCooldownHours] = useState("24");
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const selectedProduct = products.find(p => p.id === productId);

  const handleSubmit = async () => {
    if (!productId) {
      toast({ title: "Select a product", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/auto-replenish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          productId,
          triggerLevel: parseInt(triggerLevel) || 5,
          reorderQty: parseInt(reorderQty) || 24,
          supplierId: supplierId || undefined,
          cooldownHours: parseInt(cooldownHours) || 24,
        }),
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok) {
        toast({ title: "Rule created" });
        onOpenChange(false);
        setProductId(""); setTriggerLevel("5"); setReorderQty("24"); setSupplierId(""); setCooldownHours("24");
        onCreated();
      } else {
        toast({ title: "Failed", description: data.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Auto-Replenish Rule</DialogTitle>
          <DialogDescription>
            When the product's stock falls to or below the trigger level, a purchase order for the reorder quantity will be automatically created.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label>Product *</Label>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger><SelectValue placeholder="Select product…" /></SelectTrigger>
              <SelectContent className="max-h-60">
                {products.map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.emoji} {p.name} ({p.sku}) — Stock: {p.quantity}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Trigger Level</Label>
              <Input type="number" min="0" value={triggerLevel} onChange={(e) => setTriggerLevel(e.target.value)} />
              <p className="text-xs text-slate-500 mt-1">Reorder when stock ≤ this number</p>
            </div>
            <div>
              <Label>Reorder Quantity</Label>
              <Input type="number" min="1" value={reorderQty} onChange={(e) => setReorderQty(e.target.value)} />
              <p className="text-xs text-slate-500 mt-1">Quantity to order</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Supplier (optional)</Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger><SelectValue placeholder="Auto-select preferred" /></SelectTrigger>
                <SelectContent className="max-h-60">
                  {suppliers.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Cooldown (hours)</Label>
              <Input type="number" min="1" value={cooldownHours} onChange={(e) => setCooldownHours(e.target.value)} />
              <p className="text-xs text-slate-500 mt-1">Min hours between triggers</p>
            </div>
          </div>
          {selectedProduct && (
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3 text-xs space-y-1">
              <div className="text-slate-500">Selected product:</div>
              <div className="font-semibold text-slate-900 dark:text-white">{selectedProduct.emoji} {selectedProduct.name}</div>
              <div className="text-slate-500">Current stock: <span className="font-mono font-semibold">{selectedProduct.quantity}</span></div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
            Create Rule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
