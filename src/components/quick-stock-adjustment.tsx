"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Save, X, Search as SearchIcon, Package, Plus, Minus, RotateCcw,
  ArrowUp, ArrowDown, History, AlertTriangle, CheckCircle2, TrendingUp,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  COMPANY, formatGHS, type Product, type StockGroup, type StockHistoryEntry,
} from "@/lib/pos-data";
import { PopupWindow } from "@/components/popup-window";

// ===== Color palette =====
const HEADER_GREEN = '#059669';      // emerald-600
const BTN_GREEN = '#10B981';          // emerald-500
const BTN_GREEN_DARK = '#047857';     // emerald-700
const BTN_BLUE = '#3B82F6';
const BTN_AMBER = '#F59E0B';
const BTN_ROSE = '#F43F5E';
const FIELD_BORDER = '#CBD5E1';

// ===== Adjustment modes =====
type AdjustMode = 'add' | 'remove' | 'set';

// ===== Common reasons =====
const COMMON_REASONS = [
  'Damaged goods',
  'Expired stock',
  'Theft / Loss',
  'Found stock',
  'Received stock (no PO)',
  'Initial count correction',
  'Sample / Display',
  'Staff error',
  'Other (specify below)',
];

interface QuickStockAdjustmentProps {
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  setHistory: React.Dispatch<React.SetStateAction<StockHistoryEntry[]>>;
  history: StockHistoryEntry[];
  groups: StockGroup[];
  onClose: () => void;
  /** Optional pre-selected product ID (when launched from a product card) */
  initialProductId?: string;
}

export function QuickStockAdjustment({
  products,
  setProducts,
  setHistory,
  history,
  groups,
  onClose,
  initialProductId,
}: QuickStockAdjustmentProps) {
  const { toast } = useToast();

  // ===== State =====
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(
    initialProductId ? products.find(p => p.id === initialProductId) || null : null
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [showStockSearch, setShowStockSearch] = useState(false);
  const [adjustMode, setAdjustMode] = useState<AdjustMode>('add');
  const [amount, setAmount] = useState(1);
  const [reason, setReason] = useState(COMMON_REASONS[0]);
  const [customReason, setCustomReason] = useState('');
  const [reference, setReference] = useState(`ADJ-${Date.now().toString().slice(-6)}`);
  const [saved, setSaved] = useState(false);

  const searchRef = useRef<HTMLInputElement>(null);

  // Focus search on mount if no product pre-selected
  useEffect(() => {
    if (!initialProductId) {
      const t = setTimeout(() => searchRef.current?.focus(), 80);
      return () => clearTimeout(t);
    }
  }, [initialProductId]);

  // ===== Compute the new quantity based on mode + amount =====
  const newQuantity = useMemo(() => {
    if (!selectedProduct) return 0;
    if (adjustMode === 'add') return selectedProduct.stock + amount;
    if (adjustMode === 'remove') return Math.max(0, selectedProduct.stock - amount);
    return amount; // set
  }, [selectedProduct, adjustMode, amount]);

  const changeAmount = useMemo(() => {
    if (!selectedProduct) return 0;
    return newQuantity - selectedProduct.stock;
  }, [selectedProduct, newQuantity]);

  // ===== Recent adjustments for this product =====
  const recentAdjustments = useMemo(() => {
    if (!selectedProduct) return [];
    return history
      .filter(h => h.action === 'adjusted' && h.productId === selectedProduct.id)
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .slice(0, 5);
  }, [history, selectedProduct]);

  // ===== Handle product selection from search =====
  const handleSelectProduct = (product: Product) => {
    setSelectedProduct(product);
    setShowStockSearch(false);
    setSearchQuery('');
    setSaved(false);
    // Reset amount to a sensible default
    setAmount(adjustMode === 'set' ? product.stock : 1);
  };

  // ===== Quick amount buttons =====
  const quickAmounts = [1, 5, 10, 25, 50];
  const applyQuickAmount = (qty: number) => {
    if (adjustMode === 'add') setAmount(prev => prev + qty);
    else if (adjustMode === 'remove') setAmount(prev => prev + qty);
    else setAmount(qty); // set mode replaces
  };

  // ===== Save the adjustment =====
  const handleSave = () => {
    if (!selectedProduct) {
      toast({ title: 'Select a product first', variant: 'destructive' });
      return;
    }
    if (amount <= 0 && adjustMode !== 'set') {
      toast({ title: 'Amount must be greater than 0', variant: 'destructive' });
      return;
    }
    if (adjustMode === 'remove' && amount > selectedProduct.stock) {
      toast({ title: 'Cannot remove more than current stock', description: `Current stock: ${selectedProduct.stock}`, variant: 'destructive' });
      return;
    }

    const finalReason = reason === 'Other (specify below)' && customReason
      ? customReason
      : reason;
    const modeLabel = adjustMode === 'add' ? 'Added' : adjustMode === 'remove' ? 'Removed' : 'Set';

    // Update product stock
    setProducts(prev => prev.map(p =>
      p.id === selectedProduct.id ? { ...p, stock: newQuantity } : p
    ));

    // Log to history
    const historyEntry: StockHistoryEntry = {
      id: `h-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      productId: selectedProduct.id,
      productName: selectedProduct.name,
      sku: selectedProduct.sku,
      action: 'adjusted',
      quantityChange: changeAmount,
      newQuantity: newQuantity,
      timestamp: new Date().toISOString(),
      user: 'Sarah Johnson',
      reason: `${modeLabel} ${amount} unit(s) — ${finalReason}`,
      reference: reference,
    };
    setHistory(prev => [...prev, historyEntry]);

    setSaved(true);
    toast({
      title: 'Stock adjusted ✓',
      description: `${selectedProduct.emoji} ${selectedProduct.name}: ${selectedProduct.stock} → ${newQuantity} (${changeAmount > 0 ? '+' : ''}${changeAmount})`,
    });

    // Reset for next adjustment but keep the product selected
    setAmount(adjustMode === 'set' ? newQuantity : 1);
    setCustomReason('');
    // Generate a new reference for the next adjustment
    setReference(`ADJ-${Date.now().toString().slice(-6)}`);
  };

  // ===== Keyboard shortcuts (F2 Save, Esc Close) =====
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isTyping = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT');
      if (e.key === 'F2') { e.preventDefault(); handleSave(); }
      else if (e.key === 'Escape' && !isTyping && !showStockSearch) { e.preventDefault(); onClose(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProduct, adjustMode, amount, reason, customReason, reference, showStockSearch]);

  // ===== Mode configuration =====
  const modeConfig = {
    add: { label: 'Add Stock', icon: Plus, color: BTN_GREEN, bg: 'bg-emerald-500', text: 'text-white', desc: 'Increase quantity (received, found, corrected up)' },
    remove: { label: 'Remove Stock', icon: Minus, color: BTN_ROSE, bg: 'bg-rose-500', text: 'text-white', desc: 'Decrease quantity (damaged, lost, expired)' },
    set: { label: 'Set Quantity', icon: RotateCcw, color: BTN_BLUE, bg: 'bg-blue-500', text: 'text-white', desc: 'Set exact quantity (stocktake correction)' },
  };

  return (
    <PopupWindow
      title="Quick Stock Adjustment"
      titleBarColor={HEADER_GREEN}
      initialWidth={680}
      initialHeight={700}
      minWidth={560}
      minHeight={580}
      onClose={onClose}
    >
      <div className="h-full flex flex-col bg-white" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
        {/* ===== Product Search Bar (fixed at top) ===== */}
        <div className="flex-shrink-0 px-4 py-2.5 bg-slate-50 border-b border-slate-200">
          <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">Product</label>
          <div className="flex items-center gap-2">
            <input
              ref={searchRef}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (e.target.value.length > 0) setShowStockSearch(true);
                else setShowStockSearch(false);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  // Try direct match first
                  const direct = products.find(p =>
                    p.sku.toLowerCase() === searchQuery.toLowerCase() ||
                    p.barcode === searchQuery ||
                    p.name.toLowerCase().includes(searchQuery.toLowerCase())
                  );
                  if (direct) handleSelectProduct(direct);
                  else setShowStockSearch(true);
                }
                if (e.key === 'Escape') setShowStockSearch(false);
              }}
              placeholder="Type SKU, barcode, or product name…"
              className="flex-1 h-8 px-3 text-xs border rounded-md outline-none focus:ring-2 focus:ring-emerald-400 bg-white"
              style={{ borderColor: FIELD_BORDER }}
            />
            <button
              onClick={() => setShowStockSearch(true)}
              className="h-8 px-3 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 transition"
              title="Open Stock Search (browse all products)"
            >
              <SearchIcon className="h-3.5 w-3.5" /> Browse
            </button>
          </div>
        </div>

        {/* ===== Scrollable content area (holds all middle sections) ===== */}
        <div className="flex-1 overflow-y-auto min-h-0" style={{ scrollbarWidth: 'thin' }}>

        {/* ===== Product Info Card ===== */}
        {selectedProduct ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="px-4 py-3 bg-gradient-to-br from-emerald-50 to-teal-50 border-b border-emerald-100"
          >
            <div className="flex items-start gap-3">
              <div className="h-14 w-14 rounded-xl bg-white ring-1 ring-emerald-200 flex items-center justify-center text-3xl flex-shrink-0">
                {selectedProduct.emoji}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-slate-800 text-sm">{selectedProduct.name}</div>
                <div className="text-[10px] text-slate-500 font-mono">{selectedProduct.sku} · {selectedProduct.barcode}</div>
                <div className="text-[10px] text-slate-500">{selectedProduct.supplier}</div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-[9px] text-slate-500 uppercase font-semibold">Current Stock</div>
                <div className="text-2xl font-bold text-slate-800 font-mono leading-tight">{selectedProduct.stock}</div>
                <div className="text-[9px] text-slate-500">{selectedProduct.unit}</div>
              </div>
            </div>
            {/* Mini stats */}
            <div className="grid grid-cols-3 gap-2 mt-2.5">
              <div className="bg-white rounded-md p-1.5 ring-1 ring-slate-100 text-center">
                <div className="text-[8px] text-slate-500 uppercase font-semibold">Reorder Lvl</div>
                <div className="text-xs font-bold text-slate-700 font-mono">{selectedProduct.reorderLevel}</div>
              </div>
              <div className="bg-white rounded-md p-1.5 ring-1 ring-slate-100 text-center">
                <div className="text-[8px] text-slate-500 uppercase font-semibold">Cost</div>
                <div className="text-xs font-bold text-slate-700 font-mono">{formatGHS(selectedProduct.costPrice)}</div>
              </div>
              <div className={cn(
                "bg-white rounded-md p-1.5 ring-1 text-center",
                selectedProduct.stock <= selectedProduct.reorderLevel ? "ring-rose-200" : "ring-slate-100"
              )}>
                <div className="text-[8px] text-slate-500 uppercase font-semibold">Status</div>
                <div className={cn(
                  "text-xs font-bold",
                  selectedProduct.stock === 0 ? "text-rose-600" :
                  selectedProduct.stock <= selectedProduct.reorderLevel ? "text-amber-600" :
                  "text-emerald-600"
                )}>
                  {selectedProduct.stock === 0 ? 'Out' :
                   selectedProduct.stock <= selectedProduct.reorderLevel ? 'Low' :
                   'OK'}
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          <div className="px-4 py-8 flex flex-col items-center justify-center text-slate-400 border-b border-slate-100">
            <Package className="h-10 w-10 mb-2 opacity-30" />
            <div className="text-sm font-medium">No product selected</div>
            <div className="text-xs mt-1">Type a SKU/barcode above or click "Browse" to search</div>
          </div>
        )}

        {/* ===== Adjustment Mode + Amount ===== */}
        {selectedProduct && (
          <div className="px-4 py-3 border-b border-slate-100">
            {/* Mode buttons */}
            <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1.5">Adjustment Type</label>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {(['add', 'remove', 'set'] as AdjustMode[]).map(mode => {
                const config = modeConfig[mode];
                const Icon = config.icon;
                const isActive = adjustMode === mode;
                return (
                  <button
                    key={mode}
                    onClick={() => {
                      setAdjustMode(mode);
                      // Reset amount to sensible default
                      if (mode === 'set') setAmount(selectedProduct.stock);
                      else setAmount(1);
                      setSaved(false);
                    }}
                    className={cn(
                      "rounded-lg p-2.5 flex flex-col items-center gap-1 transition border-2",
                      isActive
                        ? "text-white shadow-md"
                        : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                    )}
                    style={isActive ? { backgroundColor: config.color, borderColor: config.color } : {}}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="text-[10px] font-bold">{config.label}</span>
                  </button>
                );
              })}
            </div>
            <div className="text-[10px] text-slate-500 mb-2 italic">{modeConfig[adjustMode].desc}</div>

            {/* Amount input + quick buttons */}
            <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">
              {adjustMode === 'set' ? 'New Quantity' : 'Amount'}
            </label>
            <div className="flex items-center gap-2 mb-2">
              <button
                onClick={() => setAmount(prev => Math.max(adjustMode === 'set' ? 0 : 1, prev - 1))}
                className="h-9 w-9 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition"
                title="−1"
              >
                <Minus className="h-4 w-4" />
              </button>
              <input
                type="number"
                min="0"
                value={amount}
                onChange={(e) => setAmount(Math.max(0, parseInt(e.target.value) || 0))}
                className="flex-1 h-9 px-3 text-center text-xl font-bold font-mono border rounded-md outline-none focus:ring-2 focus:ring-emerald-400"
                style={{ borderColor: FIELD_BORDER }}
              />
              <button
                onClick={() => setAmount(prev => prev + 1)}
                className="h-9 w-9 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition"
                title="+1"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            {/* Quick amount buttons */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[9px] text-slate-500 font-semibold">Quick:</span>
              {quickAmounts.map(qty => (
                <button
                  key={qty}
                  onClick={() => applyQuickAmount(qty)}
                  className="h-6 px-2 rounded bg-slate-100 hover:bg-emerald-100 text-slate-600 hover:text-emerald-700 text-[10px] font-bold transition"
                >
                  {adjustMode === 'set' ? `=${qty}` : `+${qty}`}
                </button>
              ))}
              <button
                onClick={() => setAmount(adjustMode === 'set' ? selectedProduct.stock : 1)}
                className="h-6 px-2 rounded bg-slate-100 hover:bg-slate-200 text-slate-500 text-[10px] font-semibold transition ml-auto"
                title="Reset"
              >
                Reset
              </button>
            </div>
          </div>
        )}

        {/* ===== Preview + Reason ===== */}
        {selectedProduct && (
          <div className="px-4 py-3 border-b border-slate-100">
            {/* Live preview */}
            <div className={cn(
              "rounded-lg p-3 mb-3 ring-1",
              changeAmount > 0 ? "bg-emerald-50 ring-emerald-200" :
              changeAmount < 0 ? "bg-rose-50 ring-rose-200" :
              "bg-slate-50 ring-slate-200"
            )}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {changeAmount > 0 ? <ArrowUp className="h-4 w-4 text-emerald-600" /> :
                   changeAmount < 0 ? <ArrowDown className="h-4 w-4 text-rose-600" /> :
                   <CheckCircle2 className="h-4 w-4 text-slate-500" />}
                  <span className="text-xs font-bold text-slate-700">Preview</span>
                </div>
                <div className="flex items-center gap-2 text-sm font-mono font-bold">
                  <span className="text-slate-500">{selectedProduct.stock}</span>
                  <span className="text-slate-400">→</span>
                  <span className={cn(
                    changeAmount > 0 ? "text-emerald-700" :
                    changeAmount < 0 ? "text-rose-700" :
                    "text-slate-700"
                  )}>{newQuantity}</span>
                  <span className={cn(
                    "text-xs px-1.5 py-0.5 rounded",
                    changeAmount > 0 ? "bg-emerald-200 text-emerald-800" :
                    changeAmount < 0 ? "bg-rose-200 text-rose-800" :
                    "bg-slate-200 text-slate-600"
                  )}>
                    {changeAmount > 0 ? '+' : ''}{changeAmount}
                  </span>
                </div>
              </div>
              {adjustMode === 'remove' && amount > selectedProduct.stock && (
                <div className="text-[10px] text-rose-600 mt-1.5 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> Warning: amount exceeds current stock — will be capped at 0
                </div>
              )}
            </div>

            {/* Reason */}
            <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">Reason</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full h-8 px-2 text-xs border rounded-md outline-none focus:ring-2 focus:ring-emerald-400 mb-2 bg-white"
              style={{ borderColor: FIELD_BORDER }}
            >
              {COMMON_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            {reason === 'Other (specify below)' && (
              <input
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="Enter custom reason…"
                className="w-full h-8 px-2 text-xs border rounded-md outline-none focus:ring-2 focus:ring-emerald-400 mb-2"
                style={{ borderColor: FIELD_BORDER }}
              />
            )}
            {/* Reference */}
            <div className="flex items-center gap-2">
              <label className="text-[10px] font-bold text-slate-600 uppercase">Ref:</label>
              <input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                className="flex-1 h-7 px-2 text-[11px] font-mono border rounded-md outline-none focus:ring-1 focus:ring-emerald-400 bg-white"
                style={{ borderColor: FIELD_BORDER }}
              />
            </div>
          </div>
        )}

        {/* ===== Recent Adjustments (for selected product) ===== */}
        {selectedProduct && recentAdjustments.length > 0 && (
          <div className="px-4 py-2">
            <div className="text-[10px] font-bold text-slate-600 uppercase mb-1.5 flex items-center gap-1">
              <History className="h-3 w-3" /> Recent Adjustments for this Product
            </div>
            <div className="space-y-1">
              {recentAdjustments.map(h => (
                <div key={h.id} className="flex items-center gap-2 p-1.5 rounded bg-slate-50 text-[10px]">
                  <div className={cn(
                    "h-6 w-6 rounded flex items-center justify-center font-bold font-mono",
                    h.quantityChange > 0 ? "bg-emerald-100 text-emerald-700" :
                    h.quantityChange < 0 ? "bg-rose-100 text-rose-700" :
                    "bg-slate-100 text-slate-600"
                  )}>
                    {h.quantityChange > 0 ? '+' : ''}{h.quantityChange}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-slate-700 truncate">{h.reason}</div>
                    <div className="text-[9px] text-slate-400 font-mono">{new Date(h.timestamp).toLocaleDateString('en-GB')} · {h.reference}</div>
                  </div>
                  <div className="text-right text-slate-500 font-mono">→ {h.newQuantity}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        </div>
        {/* ===== End scrollable content area ===== */}

        {/* ===== Action Buttons (fixed at bottom) ===== */}
        <div className="flex-shrink-0 px-4 py-2.5 flex items-center gap-2 border-t" style={{ borderColor: FIELD_BORDER, backgroundColor: '#F0FDF4' }}>
          <button
            onClick={handleSave}
            disabled={!selectedProduct || (adjustMode !== 'set' && amount <= 0)}
            className="h-9 px-5 rounded-md text-white text-xs font-bold flex items-center gap-1.5 transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: BTN_GREEN_DARK }}
          >
            <Save className="h-4 w-4" /> Save Adjustment <kbd className="text-[8px] bg-white/20 px-1 rounded">F2</kbd>
          </button>
          {saved && (
            <motion.span
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-xs font-bold text-emerald-700 flex items-center gap-1"
            >
              <CheckCircle2 className="h-4 w-4" /> Saved
            </motion.span>
          )}
          <div className="flex-1" />
          <button
            onClick={onClose}
            className="h-9 px-4 rounded-md bg-rose-100 hover:bg-rose-200 text-rose-700 text-xs font-bold flex items-center gap-1.5 transition"
          >
            <X className="h-4 w-4" /> Close <kbd className="text-[8px] bg-white/60 px-1 rounded">Esc</kbd>
          </button>
        </div>

        {/* ===== Status bar ===== */}
        <div className="flex-shrink-0 px-4 py-0.5 text-[9px] text-slate-500 flex items-center gap-3" style={{ backgroundColor: '#E0F2FE' }}>
          <span className="font-mono">{reference}</span>
          {selectedProduct && (
            <>
              <span>·</span>
              <span>{selectedProduct.emoji} {selectedProduct.name}</span>
              <span>·</span>
              <span className="font-mono">{selectedProduct.stock} → {newQuantity}</span>
            </>
          )}
          <div className="flex-1" />
          <span>{COMPANY.name}</span>
        </div>

        {/* ===== Stock Search Popup ===== */}
        <AnimatePresence>
          {showStockSearch && (
            <QuickAdjustStockSearch
              products={products}
              groups={groups}
              searchText={searchQuery}
              onSelect={handleSelectProduct}
              onClose={() => setShowStockSearch(false)}
            />
          )}
        </AnimatePresence>
      </div>
    </PopupWindow>
  );
}

// ===== Compact Stock Search for Quick Adjust =====
function QuickAdjustStockSearch({
  products, groups, searchText, onSelect, onClose,
}: {
  products: Product[];
  groups: StockGroup[];
  searchText: string;
  onSelect: (p: Product) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState(searchText);
  const [filterGroup, setFilterGroup] = useState('all');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, []);

  const filtered = useMemo(() => {
    return products.filter(p => {
      if (query.trim()) {
        const q = query.toLowerCase();
        if (!p.name.toLowerCase().includes(q) && !p.sku.toLowerCase().includes(q) && !p.barcode.includes(q)) return false;
      }
      if (filterGroup !== 'all' && p.groupId !== filterGroup) return false;
      return true;
    });
  }, [products, query, filterGroup]);

  useEffect(() => {
    if (selectedIndex >= filtered.length) setSelectedIndex(Math.max(0, filtered.length - 1));
  }, [filtered.length, selectedIndex]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 flex items-start justify-center pt-16 z-[60]"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: -20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: -20 }}
        onClick={(e) => e.stopPropagation()}
        className="rounded-lg shadow-2xl overflow-hidden flex flex-col"
        style={{ width: '680px', maxHeight: '480px', fontFamily: 'Arial, Helvetica, sans-serif' }}
      >
        {/* Title bar */}
        <div className="flex-shrink-0 flex items-center justify-between px-3 h-7 text-white" style={{ backgroundColor: '#059669' }}>
          <span className="text-xs font-bold">Select Product to Adjust</span>
          <button onClick={onClose} className="h-5 w-5 rounded bg-red-600 hover:bg-red-700 flex items-center justify-center transition"><X className="h-3 w-3 text-white" /></button>
        </div>
        {/* Search */}
        <div className="flex-shrink-0 px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0); }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && filtered[selectedIndex]) onSelect(filtered[selectedIndex]);
              if (e.key === 'Escape') onClose();
              if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex(i => Math.min(filtered.length - 1, i + 1)); }
              if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex(i => Math.max(0, i - 1)); }
            }}
            placeholder="Search by name, SKU, or barcode…"
            className="flex-1 h-7 px-2 text-xs border border-slate-400 rounded bg-white outline-none focus:ring-1 focus:ring-emerald-400"
          />
          <select
            value={filterGroup}
            onChange={(e) => { setFilterGroup(e.target.value); setSelectedIndex(0); }}
            className="h-7 px-1 text-[10px] border border-slate-400 rounded bg-white outline-none"
          >
            <option value="all">All Groups</option>
            {groups.map(g => <option key={g.id} value={g.id}>{g.icon} {g.name}</option>)}
          </select>
        </div>
        {/* Table header */}
        <div className="flex-shrink-0 grid grid-cols-[120px_1fr_50px_80px_80px] gap-0 px-2 py-1 text-[9px] font-bold text-white" style={{ backgroundColor: '#059669' }}>
          <div>Part No.</div>
          <div>Details</div>
          <div className="text-right">Qty</div>
          <div className="text-right">Retail</div>
          <div className="text-right">Cost</div>
        </div>
        {/* Table body */}
        <div className="flex-1 overflow-y-auto bg-white min-h-0" style={{ scrollbarWidth: 'thin' }}>
          {filtered.length === 0 ? (
            <div className="text-center py-6 text-slate-400 text-[11px]">No products found</div>
          ) : (
            filtered.map((p, idx) => (
              <div
                key={p.id}
                onClick={() => setSelectedIndex(idx)}
                onDoubleClick={() => onSelect(p)}
                className="grid grid-cols-[120px_1fr_50px_80px_80px] gap-0 px-2 py-1 text-[10px] cursor-pointer border-b border-slate-100"
                style={{ backgroundColor: idx === selectedIndex ? '#A7F3D0' : (idx % 2 === 1 ? '#F8FAFC' : '#FFFFFF') }}
              >
                <div className="font-mono truncate text-slate-700">{p.sku}</div>
                <div className="truncate text-slate-800">{p.emoji} {p.name}</div>
                <div className={cn("text-right font-mono font-bold", p.stock <= p.reorderLevel ? "text-rose-600" : "text-slate-700")}>{p.stock}</div>
                <div className="text-right font-mono text-slate-600">{p.price.toFixed(2)}</div>
                <div className="text-right font-mono text-slate-600">{p.costPrice.toFixed(2)}</div>
              </div>
            ))
          )}
        </div>
        {/* Action bar */}
        <div className="flex-shrink-0 px-3 py-1.5 flex items-center gap-2 border-t border-slate-200" style={{ backgroundColor: '#F0FDF4' }}>
          <button
            onClick={() => filtered[selectedIndex] && onSelect(filtered[selectedIndex])}
            disabled={!filtered[selectedIndex]}
            className="h-7 px-3 rounded text-white text-[10px] font-bold flex items-center gap-1 disabled:opacity-50"
            style={{ backgroundColor: '#059669' }}
          >
            <CheckCircle2 className="h-3 w-3" /> Select (Enter)
          </button>
          <span className="text-[10px] text-slate-500 font-mono">{filtered.length} products</span>
          <div className="flex-1" />
          <button onClick={onClose} className="h-7 px-3 rounded text-white text-[10px] font-bold flex items-center gap-1" style={{ backgroundColor: '#F43F5E' }}>
            <X className="h-3 w-3" /> Close (Esc)
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
