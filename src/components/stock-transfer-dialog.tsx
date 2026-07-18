"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Truck, ArrowRight, Loader2, Check, AlertTriangle, Package,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { authedFetch } from "@/lib/client-auth";
import { formatGHS } from "@/lib/pos-data";

interface StockTransferDialogProps {
  open: boolean;
  onClose: () => void;
}

interface Location {
  id: string;
  name: string;
  code: string;
}

interface Product {
  id: string;
  sku: string;
  name: string;
  emoji: string;
  unit: string;
  quantity: number;
  price: number;
}

interface TransferItem {
  product: Product;
  quantity: number;
}

export function StockTransferDialog({ open, onClose }: StockTransferDialogProps) {
  const { toast } = useToast();
  const [locations, setLocations] = useState<Location[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [fromLocationId, setFromLocationId] = useState("");
  const [toLocationId, setToLocationId] = useState("");
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<TransferItem[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [locRes, prodRes] = await Promise.all([
        authedFetch("/api/locations"),
        authedFetch("/api/products"),
      ]);
      if (locRes.ok) {
        const data = await locRes.json();
        setLocations(data.locations || []);
      }
      if (prodRes.ok) {
        const data = await prodRes.json();
        setProducts(data.products || []);
      }
    } catch (e: any) {
      toast({ title: "Failed to load data", description: e?.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (open) {
      loadData();
      setItems([]);
      setSearch("");
      setFromLocationId("");
      setToLocationId("");
    }
  }, [open, loadData]);

  const filteredProducts = search
    ? products.filter(p =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.sku.toLowerCase().includes(search.toLowerCase())
      )
    : products;

  const addItem = (product: Product) => {
    if (items.find(i => i.product.id === product.id)) {
      // Increment quantity if already in list
      setItems(items.map(i =>
        i.product.id === product.id
          ? { ...i, quantity: Math.min(i.quantity + 1, product.quantity) }
          : i
      ));
    } else {
      setItems([...items, { product, quantity: 1 }]);
    }
  };

  const updateItemQty = (productId: string, qty: number) => {
    setItems(items.map(i =>
      i.product.id === productId
        ? { ...i, quantity: Math.max(0, Math.min(qty, i.product.quantity)) }
        : i
    ));
  };

  const removeItem = (productId: string) => {
    setItems(items.filter(i => i.product.id !== productId));
  };

  const handleSubmit = async () => {
    if (!fromLocationId || !toLocationId) {
      toast({ title: "Select source and destination", variant: "destructive" });
      return;
    }
    if (fromLocationId === toLocationId) {
      toast({ title: "Source and destination must be different", variant: "destructive" });
      return;
    }
    if (items.length === 0) {
      toast({ title: "Add at least one item to transfer", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await authedFetch("/api/stock-transfers", {
        method: "POST",
        body: JSON.stringify({
          fromLocationId,
          toLocationId,
          items: items.map(i => ({
            productId: i.product.id,
            quantity: i.quantity,
          })),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast({
          title: "Transfer initiated",
          description: `Transfer of ${items.length} item(s) created`,
        });
        onClose();
      } else {
        toast({ title: "Transfer failed", description: data.error, variant: "destructive" });
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
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, y: 30 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 30 }}
            onClick={(e) => e.stopPropagation()}
            className="dialog-premium shadow-premium-xl w-full max-w-3xl max-h-[90vh] flex flex-col"
          >
            {/* Header */}
            <div className="gradient-premium-emerald text-white px-6 py-4 flex items-center justify-between relative overflow-hidden flex-shrink-0">
              <div className="pointer-events-none absolute -top-12 -right-12 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
              <div className="flex items-center gap-2 relative z-10">
                <div className="relative">
                  <div className="absolute inset-0 rounded-xl bg-white/25 blur-md scale-110" />
                  <div className="relative h-9 w-9 rounded-xl bg-white/15 ring-1 ring-white/30 flex items-center justify-center backdrop-blur-md">
                    <Truck className="h-5 w-5" />
                  </div>
                </div>
                <h2 className="text-base font-bold tracking-tight">Stock Transfer</h2>
              </div>
              <button onClick={onClose} className="h-9 w-9 rounded-lg bg-white/15 hover:bg-white/25 flex items-center justify-center transition active:scale-90 relative z-10">
                <X className="h-4 w-4" />
              </button>
            </div>

            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto p-6 space-y-4 scroll-premium">
                {/* Location selectors */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">From Location</label>
                    <select
                      value={fromLocationId}
                      onChange={(e) => setFromLocationId(e.target.value)}
                      className="input-premium w-full h-11 px-3 text-sm"
                    >
                      <option value="">Select source...</option>
                      {locations.map(loc => (
                        <option key={loc.id} value={loc.id}>{loc.name} ({loc.code})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">To Location</label>
                    <select
                      value={toLocationId}
                      onChange={(e) => setToLocationId(e.target.value)}
                      className="input-premium w-full h-11 px-3 text-sm"
                    >
                      <option value="">Select destination...</option>
                      {locations.map(loc => (
                        <option key={loc.id} value={loc.id}>{loc.name} ({loc.code})</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Search products */}
                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Add Products to Transfer</label>
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by name or SKU..."
                    className="input-premium w-full h-11 px-4 text-sm"
                  />
                </div>

                {/* Product list (click to add) */}
                {search && (
                  <div className="bg-slate-50 rounded-xl ring-1 ring-slate-200 max-h-48 overflow-y-auto scroll-premium">
                    {filteredProducts.slice(0, 50).map(product => (
                      <button
                        key={product.id}
                        onClick={() => addItem(product)}
                        className="w-full flex items-center gap-3 px-3 py-2 hover:bg-emerald-50 transition text-left active:scale-[0.99]"
                      >
                        <span className="text-xl">{product.emoji}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold text-slate-800 truncate">{product.name}</div>
                          <div className="text-[10px] text-slate-500 font-mono">{product.sku} · Stock: {product.quantity} {product.unit}</div>
                        </div>
                        <ArrowRight className="h-4 w-4 text-emerald-500" />
                      </button>
                    ))}
                    {filteredProducts.length === 0 && (
                      <div className="text-center py-6 text-xs text-slate-400">No products found</div>
                    )}
                  </div>
                )}

                {/* Selected items */}
                {items.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      Transfer Items ({items.length})
                    </div>
                    {items.map(item => (
                      <div key={item.product.id} className="flex items-center gap-2 bg-white rounded-xl p-2 ring-1 ring-slate-200">
                        <span className="text-xl">{item.product.emoji}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold text-slate-800 truncate">{item.product.name}</div>
                          <div className="text-[10px] text-slate-500 font-mono">
                            {item.product.sku} · Available: {item.product.quantity} {item.product.unit}
                          </div>
                        </div>
                        <input
                          type="number"
                          min="0"
                          max={item.product.quantity}
                          value={item.quantity}
                          onChange={(e) => updateItemQty(item.product.id, parseFloat(e.target.value) || 0)}
                          className="input-premium w-20 h-9 text-center text-sm font-mono font-bold"
                        />
                        <button
                          onClick={() => removeItem(item.product.id)}
                          className="h-9 w-9 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 flex items-center justify-center transition active:scale-90"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Footer */}
            {!loading && (
              <div className="flex-shrink-0 px-6 py-3 bg-slate-50 border-t border-slate-200 flex gap-2 justify-end">
                <button
                  onClick={onClose}
                  className="h-10 px-4 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 text-sm font-bold transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting || items.length === 0 || !fromLocationId || !toLocationId}
                  className="btn-premium h-10 px-6 rounded-lg gradient-premium-emerald hover:shadow-glow-emerald disabled:opacity-50 text-white text-sm font-bold transition flex items-center gap-2"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Transferring...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" />
                      Initiate Transfer
                    </>
                  )}
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
