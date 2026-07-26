"use client";

import { useState, useEffect, useMemo } from "react";
import { Package, Loader2, Plus, Search, Trash2, Star, X } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { formatGHS, type Product } from "@/lib/pos-data";

interface CatalogEntry {
  id: string;
  productId: string;
  supplierSku: string;
  supplierCost: number;
  leadTimeDays: number;
  preferred: boolean;
  product: {
    id: string;
    sku: string;
    name: string;
    emoji?: string;
    costPrice: number;
    retailPrice: number;
    quantity: number;
    barcode?: string;
  };
}

interface SupplierCatalogDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  supplierId: string | null;
  supplierName: string;
  /** All products in the system — for the "add to catalog" search */
  allProducts: Product[];
  onChanged?: () => void;
}

export function SupplierCatalogDialog({
  open, onOpenChange, supplierId, supplierName, allProducts, onChanged,
}: SupplierCatalogDialogProps) {
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddMode, setShowAddMode] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [newSku, setNewSku] = useState("");
  const [newCost, setNewCost] = useState("");
  const [newLeadTime, setNewLeadTime] = useState("");
  const [newPreferred, setNewPreferred] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (open && supplierId) {
      loadCatalog();
      setShowAddMode(false);
      setSearchTerm("");
      setNewSku(""); setNewCost(""); setNewLeadTime(""); setNewPreferred(false);
    } else if (!open) {
      setCatalog([]);
    }
  }, [open, supplierId]);

  const loadCatalog = async () => {
    if (!supplierId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/suppliers/${supplierId}/products`, { credentials: "include" });
      const data = await res.json();
      if (res.ok) {
        setCatalog(data.catalog || []);
      }
    } catch {
      // swallow
    } finally {
      setLoading(false);
    }
  };

  // Products not yet in this supplier's catalog (for the "add" search)
  const availableProducts = useMemo(() => {
    const inCatalogIds = new Set(catalog.map(c => c.productId));
    let available = allProducts.filter(p => !inCatalogIds.has(p.id));
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      available = available.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.barcode || "").toLowerCase().includes(q)
      );
    }
    return available.slice(0, 20); // cap for performance
  }, [allProducts, catalog, searchTerm]);

  const handleAddProduct = async (product: Product) => {
    if (!supplierId) return;
    setAdding(product.id);
    try {
      const res = await fetch(`/api/suppliers/${supplierId}/products`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          productId: product.id,
          supplierSku: product.sku,
          supplierCost: product.costPrice,
          leadTimeDays: 0,
          preferred: false,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast({ title: "Added to catalog ✓", description: `${product.name} (${product.sku})` });
        loadCatalog();
        onChanged?.();
      } else {
        throw new Error(data.error || "Failed to add");
      }
    } catch (e: any) {
      toast({ title: "Failed to add", description: e?.message, variant: "destructive" });
    } finally {
      setAdding(null);
    }
  };

  const handleUpdateEntry = async (entry: CatalogEntry, patch: Partial<CatalogEntry>) => {
    if (!supplierId) return;
    try {
      const res = await fetch(`/api/suppliers/${supplierId}/products`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          productId: entry.productId,
          supplierSku: patch.supplierSku ?? entry.supplierSku,
          supplierCost: patch.supplierCost ?? entry.supplierCost,
          leadTimeDays: patch.leadTimeDays ?? entry.leadTimeDays,
          preferred: patch.preferred ?? entry.preferred,
        }),
      });
      if (res.ok) {
        // Update locally without full reload
        setCatalog(prev => prev.map(c => c.id === entry.id ? { ...c, ...patch } : c));
      }
    } catch {}
  };

  const handleRemoveProduct = async (entry: CatalogEntry) => {
    if (!supplierId) return;
    if (!window.confirm(`Remove "${entry.product.name}" from ${supplierName}'s catalog?`)) return;
    setDeleting(entry.id);
    try {
      const res = await fetch(`/api/suppliers/${supplierId}/products?productId=${entry.productId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) {
        toast({ title: "Removed", description: entry.product.name });
        setCatalog(prev => prev.filter(c => c.id !== entry.id));
        onChanged?.();
      } else {
        throw new Error("Failed to remove");
      }
    } catch (e: any) {
      toast({ title: "Failed", description: e?.message, variant: "destructive" });
    } finally {
      setDeleting(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl p-0 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-br from-violet-600 via-purple-600 to-fuchsia-600 text-white px-6 py-5 relative overflow-hidden">
          <div className="pointer-events-none absolute -top-12 -right-12 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
          <div className="relative z-10 flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-white/20 ring-1 ring-white/30 flex items-center justify-center backdrop-blur-sm">
              <Package className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-bold tracking-tight">Supplier Catalog</h2>
              <p className="text-[11px] opacity-85">Products that {supplierName} supplies</p>
            </div>
            <Badge className="bg-white/20 text-white border-white/30 backdrop-blur-sm">
              {catalog.length} item{catalog.length !== 1 ? "s" : ""}
            </Badge>
          </div>
        </div>

        <div className="px-6 py-5 space-y-4 max-h-[65vh] overflow-y-auto">
          {loading ? (
            <div className="text-center py-8 text-slate-500">
              <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
              Loading catalog…
            </div>
          ) : (
            <>
              {/* Catalog list */}
              {catalog.length === 0 ? (
                <div className="text-center py-6 text-slate-400">
                  <Package className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="font-semibold text-sm">Catalog is empty</p>
                  <p className="text-xs mt-1">Click "Add Product" below to link a stock item to this supplier.</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                    Current Catalog
                  </div>
                  {catalog.map(entry => (
                    <div
                      key={entry.id}
                      className={cn(
                        "flex items-center gap-3 p-2 rounded-lg border transition",
                        entry.preferred
                          ? "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/50"
                          : "bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700"
                      )}
                    >
                      <div className="h-9 w-9 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-lg shrink-0">
                        {entry.product.emoji || "📦"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold truncate flex items-center gap-1.5">
                          {entry.product.name}
                          {entry.preferred && (
                            <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
                          )}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          SKU: {entry.product.sku} · On hand: {entry.product.quantity}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="flex flex-col">
                          <Label className="text-[8px] text-slate-400 uppercase">Supplier SKU</Label>
                          <Input
                            value={entry.supplierSku}
                            onChange={(e) => {
                              const value = e.target.value;
                              setCatalog(prev => prev.map(c => c.id === entry.id ? { ...c, supplierSku: value } : c));
                            }}
                            onBlur={(e) => handleUpdateEntry(entry, { supplierSku: e.target.value })}
                            className="h-7 w-20 text-[10px] font-mono"
                          />
                        </div>
                        <div className="flex flex-col">
                          <Label className="text-[8px] text-slate-400 uppercase">Cost ₵</Label>
                          <Input
                            type="number" step="0.01" value={entry.supplierCost}
                            onChange={(e) => {
                              const value = parseFloat(e.target.value) || 0;
                              setCatalog(prev => prev.map(c => c.id === entry.id ? { ...c, supplierCost: value } : c));
                            }}
                            onBlur={(e) => handleUpdateEntry(entry, { supplierCost: parseFloat(e.target.value) || 0 })}
                            className="h-7 w-16 text-[10px] font-mono"
                          />
                        </div>
                        <button
                          onClick={() => handleUpdateEntry(entry, { preferred: !entry.preferred })}
                          title={entry.preferred ? "Unmark as preferred" : "Mark as preferred supplier for this product"}
                          className={cn(
                            "h-7 w-7 rounded-md flex items-center justify-center transition",
                            entry.preferred
                              ? "bg-amber-100 dark:bg-amber-950/40 text-amber-600"
                              : "hover:bg-amber-50 dark:hover:bg-amber-950/30 text-slate-400"
                          )}
                        >
                          <Star className={cn("h-3.5 w-3.5", entry.preferred && "fill-amber-500 text-amber-500")} />
                        </button>
                        <button
                          onClick={() => handleRemoveProduct(entry)}
                          disabled={deleting === entry.id}
                          title="Remove from catalog"
                          className="h-7 w-7 rounded-md hover:bg-rose-100 dark:hover:bg-rose-900/30 flex items-center justify-center text-rose-600 transition"
                        >
                          {deleting === entry.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add product section */}
              <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
                <Button
                  type="button"
                  variant={showAddMode ? "outline" : "default"}
                  className="w-full h-10"
                  onClick={() => setShowAddMode(!showAddMode)}
                >
                  {showAddMode ? (
                    <><X className="h-4 w-4 mr-2" /> Cancel</>
                  ) : (
                    <><Plus className="h-4 w-4 mr-2" /> Add Product to Catalog</>
                  )}
                </Button>

                {showAddMode && (
                  <div className="mt-3 space-y-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                      <Input
                        autoFocus
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search stock items by name, SKU, or barcode…"
                        className="h-9 pl-8 text-sm"
                      />
                    </div>
                    <div className="max-h-44 overflow-y-auto space-y-1 border border-slate-200 dark:border-slate-700 rounded-lg p-1.5">
                      {availableProducts.length === 0 ? (
                        <div className="text-center py-4 text-xs text-slate-400">
                          {searchTerm ? "No matching products found" : "All products already in catalog"}
                        </div>
                      ) : (
                        availableProducts.map(product => (
                          <button
                            key={product.id}
                            onClick={() => handleAddProduct(product)}
                            disabled={adding === product.id}
                            className="w-full text-left p-2 rounded-md hover:bg-violet-50 dark:hover:bg-violet-950/30 transition flex items-center gap-2 disabled:opacity-50"
                          >
                            {product.emoji && <span className="text-base">{product.emoji}</span>}
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-semibold truncate">{product.name}</div>
                              <div className="text-[10px] text-slate-500 font-mono">{product.sku} · on hand: {product.quantity}</div>
                            </div>
                            <span className="text-[10px] font-mono text-slate-500">{formatGHS(product.costPrice)}</span>
                            {adding === product.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-600" />
                            ) : (
                              <Plus className="h-3.5 w-3.5 text-violet-600" />
                            )}
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <Button variant="outline" className="w-full h-11" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
