"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Save, Printer, Mail, Trash2, CreditCard, X, Search,
  Plus, Check, Package, Calendar, User, Hash,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { COMPANY, CURRENCY, formatGHS, type Product, type StockGroup } from "@/lib/pos-data";

interface PurchaseLine {
  id: string;
  partNo: string;
  details: string;
  emoji: string;
  quantity: number;
  cost: number;
  expiry: string;
  tax: boolean;
  total: number;
}

interface PurchaseFormProps {
  onBack: () => void;
  products: Product[];
  groups: StockGroup[];
  suppliers: { id: string; name: string }[];
}

export function PurchaseForm({ onBack, products, groups, suppliers }: PurchaseFormProps) {
  const { toast } = useToast();
  const [invoiceNo, setInvoiceNo] = useState(`PUR-${Date.now().toString().slice(-6)}`);
  const [supplier, setSupplier] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [refNo, setRefNo] = useState("");
  const [terms, setTerms] = useState("Net 30");
  const [salesperson, setSalesperson] = useState("Sarah Johnson");
  const [taxInclusive, setTaxInclusive] = useState(true);
  const [balance, setBalance] = useState(0);
  const [limit, setLimit] = useState(0);
  const [lines, setLines] = useState<PurchaseLine[]>([]);
  const [selectedLine, setSelectedLine] = useState<number | null>(null);
  const [findPartNo, setFindPartNo] = useState("");
  const [onHand, setOnHand] = useState(0);
  const [bin, setBin] = useState("");
  const [showStockList, setShowStockList] = useState(false);
  const [paidAmount, setPaidAmount] = useState(0);

  const findPartNoRef = useRef<HTMLInputElement>(null);

  // Calculate totals
  const totals = useMemo(() => {
    const totalQty = lines.reduce((s, l) => s + l.quantity, 0);
    const totalCost = lines.reduce((s, l) => s + l.total, 0);
    const taxAmount = lines.filter(l => l.tax).reduce((s, l) => s + l.total * 0.15, 0);
    const grandTotal = taxInclusive ? totalCost : totalCost + taxAmount;
    const due = grandTotal - paidAmount;
    return { totalQty, totalCost, taxAmount, grandTotal, due };
  }, [lines, taxInclusive, paidAmount]);

  // Handle typing in Find Part No field
  const handleFindPartNo = (value: string) => {
    setFindPartNo(value);
    if (value.length > 0) {
      // Find matching product
      const product = products.find(p =>
        p.barcode === value || p.sku.toLowerCase() === value.toLowerCase()
      );
      if (product) {
        setOnHand(product.stock);
        setBin(product.batchNumber);
      }
      setShowStockList(true);
    } else {
      setShowStockList(false);
      setOnHand(0);
      setBin("");
    }
  };

  // Add product to purchase lines
  const addProductToLine = (product: Product) => {
    const existingIdx = lines.findIndex(l => l.partNo === product.sku);
    if (existingIdx >= 0) {
      // Increment quantity
      setLines(prev => prev.map((l, i) =>
        i === existingIdx ? { ...l, quantity: l.quantity + 1, total: (l.quantity + 1) * l.cost } : l
      ));
      toast({ title: "Quantity updated", description: `${product.emoji} ${product.name} qty +1` });
    } else {
      const newLine: PurchaseLine = {
        id: `line-${Date.now()}`,
        partNo: product.sku,
        details: `${product.emoji} ${product.name}`,
        emoji: product.emoji,
        quantity: 1,
        cost: product.costPrice,
        expiry: product.expiryDate,
        tax: product.taxable,
        total: product.costPrice,
      };
      setLines(prev => [...prev, newLine]);
      toast({ title: "Product added", description: `${product.emoji} ${product.name}` });
    }
    setFindPartNo("");
    setShowStockList(false);
    setOnHand(0);
    setBin("");
  };

  // Update line
  const updateLine = (idx: number, field: keyof PurchaseLine, value: any) => {
    setLines(prev => prev.map((l, i) => {
      if (i !== idx) return l;
      const updated = { ...l, [field]: value };
      if (field === 'quantity' || field === 'cost') {
        updated.total = updated.quantity * updated.cost;
      }
      return updated;
    }));
  };

  // Remove line
  const removeLine = (idx: number) => {
    setLines(prev => prev.filter((_, i) => i !== idx));
    setSelectedLine(null);
    toast({ title: "Line removed" });
  };

  // Action handlers
  const handleSave = () => {
    if (lines.length === 0) { toast({ title: "No items to save", variant: "destructive" }); return; }
    if (!supplier) { toast({ title: "Select a supplier first", variant: "destructive" }); return; }
    toast({ title: "Purchase saved (F2)", description: `${invoiceNo} · ${lines.length} items · ${formatGHS(totals.grandTotal)}` });
  };

  const handlePrint = () => {
    if (lines.length === 0) { toast({ title: "Nothing to print", variant: "destructive" }); return; }
    window.print();
    toast({ title: "Printing (F3)" });
  };

  const handleEmail = () => {
    if (!supplier) { toast({ title: "Select a supplier first", variant: "destructive" }); return; }
    toast({ title: "Email sent", description: `Purchase order emailed to ${supplier}` });
  };

  const handleDelete = () => {
    setLines([]);
    setSelectedLine(null);
    setPaidAmount(0);
    toast({ title: "Purchase deleted (F4)" });
  };

  const handlePayment = () => {
    if (lines.length === 0) { toast({ title: "No items", variant: "destructive" }); return; }
    toast({ title: "Payment (F5)", description: `Total: ${formatGHS(totals.grandTotal)}` });
  };

  return (
    <div className="h-screen flex flex-col bg-white" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
      {/* Blue Header Bar */}
      <header className="flex-shrink-0 flex items-center justify-between px-4 py-2 text-white" style={{ backgroundColor: '#0078D7' }}>
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="h-7 w-7 rounded hover:bg-white/20 flex items-center justify-center transition">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-bold">Purchase</span>
          <Badge variant="secondary" className="bg-white/20 text-white text-[10px]">{invoiceNo}</Badge>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="bg-white/15 border border-white/20 rounded px-1.5 py-0.5 text-[10px] text-white outline-none" />
          </div>
          <div className="flex items-center gap-1">
            <span className="text-white/80">Ref:</span>
            <input value={refNo} onChange={(e) => setRefNo(e.target.value)} placeholder="Ref No." className="w-20 bg-white/15 border border-white/20 rounded px-1.5 py-0.5 text-[10px] text-white placeholder:text-white/60 outline-none" />
          </div>
          <div className="flex items-center gap-1">
            <span className="text-white/80">Terms:</span>
            <select value={terms} onChange={(e) => setTerms(e.target.value)} className="bg-white/15 border border-white/20 rounded px-1.5 py-0.5 text-[10px] text-white outline-none">
              <option value="Net 15">Net 15</option>
              <option value="Net 30">Net 30</option>
              <option value="Net 60">Net 60</option>
              <option value="COD">COD</option>
              <option value="Prepaid">Prepaid</option>
            </select>
          </div>
          <div className="flex items-center gap-1">
            <User className="h-3 w-3" />
            <input value={salesperson} onChange={(e) => setSalesperson(e.target.value)} className="w-24 bg-white/15 border border-white/20 rounded px-1.5 py-0.5 text-[10px] text-white outline-none" />
          </div>
        </div>
      </header>

      {/* Supplier + Details Bar */}
      <div className="flex-shrink-0 px-4 py-2 bg-slate-50 border-b border-slate-300 flex items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-[11px] font-bold text-slate-700">Supplier:</label>
          <select value={supplier} onChange={(e) => setSupplier(e.target.value)} className="h-7 px-2 text-[11px] border border-slate-400 rounded bg-white outline-none focus:ring-2 focus:ring-blue-400 min-w-[160px]">
            <option value="">Select supplier...</option>
            {suppliers.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold text-slate-700">Invoice:</span>
          <input value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} className="h-7 w-28 px-2 text-[11px] font-mono border border-slate-400 rounded bg-white outline-none" />
        </div>
      </div>

      {/* Order Details + Delivery Details Panels */}
      <div className="flex-shrink-0 px-4 py-2 flex items-start gap-4 border-b border-slate-200">
        {/* Order Details */}
        <div className="flex-1 border border-slate-300 rounded p-2">
          <div className="text-[10px] font-bold text-slate-700 mb-1">Order Details</div>
          <textarea
            placeholder="Enter order notes..."
            rows={2}
            className="w-full text-[10px] border border-slate-200 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-blue-400 resize-none"
          />
          <label className="flex items-center gap-1.5 mt-1 text-[10px] text-slate-700 cursor-pointer">
            <input type="checkbox" checked={taxInclusive} onChange={(e) => setTaxInclusive(e.target.checked)} className="h-3 w-3 accent-blue-600" />
            Tax Inclusive
          </label>
        </div>
        {/* Delivery Details */}
        <div className="flex-1 border border-slate-300 rounded p-2">
          <div className="text-[10px] font-bold text-slate-700 mb-1">Delivery Details</div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-[9px] text-slate-500 font-semibold">Balance GHC</label>
              <input type="number" value={balance.toFixed(2)} readOnly className="w-full h-6 px-1 text-[10px] font-mono border border-slate-200 rounded bg-slate-50 outline-none" />
            </div>
            <div>
              <label className="text-[9px] text-slate-500 font-semibold">Limit GHC</label>
              <input type="number" value={limit.toFixed(2)} readOnly className="w-full h-6 px-1 text-[10px] font-mono border border-slate-200 rounded bg-slate-50 outline-none" />
            </div>
            <div>
              <label className="text-[9px] text-slate-500 font-semibold">Available GHC</label>
              <input type="number" value={(limit - balance).toFixed(2)} readOnly className="w-full h-6 px-1 text-[10px] font-mono border border-slate-200 rounded bg-slate-50 outline-none" />
            </div>
          </div>
        </div>
      </div>

      {/* Data Grid */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        {/* Grid Header */}
        <div className="flex-shrink-0 grid grid-cols-[30px_120px_1fr_70px_80px_90px_40px_90px] gap-1 px-2 py-1 text-[10px] font-bold text-slate-700 border-b border-slate-400" style={{ backgroundColor: '#E0E0E0' }}>
          <div className="text-center">#</div>
          <div>Part Number</div>
          <div>Details</div>
          <div className="text-right">Quantity</div>
          <div className="text-right">Cost GHC</div>
          <div className="text-center">Expiry</div>
          <div className="text-center">TAX</div>
          <div className="text-right">Total GHC</div>
        </div>

        {/* Grid Body */}
        <ScrollArea className="flex-1 min-h-0">
          <div>
            {lines.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                <Package className="h-10 w-10 mb-2 opacity-40" />
                <div className="text-xs font-medium">No items added yet</div>
                <div className="text-[10px] mt-1">Type a Part No. below or use F10 to search</div>
              </div>
            ) : (
              lines.map((line, idx) => {
                const isSelected = selectedLine === idx;
                return (
                  <div
                    key={line.id}
                    onClick={() => setSelectedLine(idx)}
                    className="grid grid-cols-[30px_120px_1fr_70px_80px_90px_40px_90px] gap-1 px-2 py-1 text-[10px] cursor-pointer border-b border-slate-100"
                    style={{
                      backgroundColor: isSelected ? '#E6F0FF' : (idx % 2 === 1 ? '#F8F8F8' : '#FFFFFF'),
                    }}
                  >
                    <div className="text-center text-slate-500">{idx + 1}</div>
                    <div className="font-mono truncate">{line.partNo}</div>
                    <div className="truncate">{line.details}</div>
                    <div className="text-right">
                      <input
                        type="number"
                        value={line.quantity}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => updateLine(idx, 'quantity', parseFloat(e.target.value) || 0)}
                        className="w-full text-right font-mono bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-400 outline-none"
                      />
                    </div>
                    <div className="text-right">
                      <input
                        type="number"
                        step="0.01"
                        value={line.cost}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => updateLine(idx, 'cost', parseFloat(e.target.value) || 0)}
                        className="w-full text-right font-mono bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-400 outline-none"
                      />
                    </div>
                    <div className="text-center text-slate-600">{line.expiry}</div>
                    <div className="text-center">
                      <input
                        type="checkbox"
                        checked={line.tax}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => updateLine(idx, 'tax', e.target.checked)}
                        className="h-3 w-3 accent-blue-600"
                      />
                    </div>
                    <div className="text-right font-mono font-semibold">{line.total.toFixed(2)}</div>
                  </div>
                );
              })
            )}
            {/* Add empty row for visual */}
            {lines.length < 15 && (
              <div
                className="grid grid-cols-[30px_120px_1fr_70px_80px_90px_40px_90px] gap-1 px-2 py-1 text-[10px] border-b border-slate-100 text-slate-300"
                style={{ backgroundColor: '#FFFFFF' }}
              >
                <div className="text-center">{lines.length + 1}</div>
                <div></div><div></div><div></div><div></div><div></div><div></div><div></div>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Bottom Section: Find Part No + Totals */}
      <div className="flex-shrink-0 px-4 py-2 bg-slate-50 border-t border-slate-300 flex items-start gap-4">
        {/* Left: Find Part No */}
        <div className="flex items-center gap-2">
          <div>
            <label className="text-[9px] font-bold text-slate-600 block">Find Part no</label>
            <input
              ref={findPartNoRef}
              value={findPartNo}
              onChange={(e) => handleFindPartNo(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const product = products.find(p => p.barcode === findPartNo || p.sku.toLowerCase() === findPartNo.toLowerCase());
                  if (product) addProductToLine(product);
                }
                if (e.key === 'Escape') setShowStockList(false);
              }}
              onFocus={() => { if (findPartNo) setShowStockList(true); }}
              placeholder="Type part no..."
              className="w-32 h-7 px-2 text-[10px] font-mono border border-slate-400 rounded outline-none focus:ring-2 focus:ring-blue-400"
              style={{ backgroundColor: '#FFFFCC' }}
            />
          </div>
          <div>
            <label className="text-[9px] font-bold text-slate-600 block">On Hand</label>
            <input value={onHand} readOnly className="w-16 h-7 px-1 text-[10px] font-mono border border-slate-300 rounded bg-slate-100 outline-none text-center" />
          </div>
          <div>
            <label className="text-[9px] font-bold text-slate-600 block">Bin</label>
            <input value={bin} readOnly className="w-24 h-7 px-1 text-[10px] font-mono border border-slate-300 rounded bg-slate-100 outline-none" />
          </div>
        </div>

        {/* Right: Totals */}
        <div className="flex-1 flex items-start justify-end gap-3">
          <div className="text-right">
            <label className="text-[9px] font-bold text-slate-600 block">Total Qty</label>
            <input value={totals.totalQty} readOnly className="w-16 h-7 px-1 text-[10px] font-mono border border-slate-300 rounded bg-white outline-none text-center" />
          </div>
          <div className="text-right">
            <label className="text-[9px] font-bold text-slate-600 block">TAX GHC</label>
            <input value={totals.taxAmount.toFixed(2)} readOnly className="w-20 h-7 px-1 text-[10px] font-mono border border-slate-300 rounded bg-white outline-none text-right" />
          </div>
          <div className="text-right">
            <label className="text-[9px] font-bold text-slate-600 block">Total GHC</label>
            <input value={totals.grandTotal.toFixed(2)} readOnly className="w-24 h-7 px-1 text-[10px] font-mono font-bold border border-slate-400 rounded outline-none text-right" style={{ backgroundColor: '#E6F0FF' }} />
          </div>
          <div className="text-right">
            <label className="text-[9px] font-bold text-slate-600 block">Paid GHC</label>
            <input
              type="number"
              value={paidAmount || ''}
              onChange={(e) => setPaidAmount(parseFloat(e.target.value) || 0)}
              className="w-24 h-7 px-1 text-[10px] font-mono border border-slate-400 rounded bg-white outline-none text-right"
              placeholder="0.00"
            />
          </div>
          <div className="text-right">
            <label className="text-[9px] font-bold text-slate-600 block">Due GHC</label>
            <input value={totals.due.toFixed(2)} readOnly className={cn("w-24 h-7 px-1 text-[10px] font-mono font-bold border border-slate-400 rounded outline-none text-right", totals.due > 0 ? "text-rose-600" : "text-emerald-600")} style={{ backgroundColor: '#FFF8E1' }} />
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex-shrink-0 px-4 py-2 flex items-center gap-2 border-t border-slate-300" style={{ backgroundColor: '#F0F0F0' }}>
        <button onClick={handleSave} className="h-8 px-4 rounded text-white text-[10px] font-semibold flex items-center gap-1.5 transition shadow-sm" style={{ backgroundColor: '#0078D7' }}>
          <Save className="h-3.5 w-3.5" /> Save <kbd className="text-[8px] bg-white/20 px-1 rounded">F2</kbd>
        </button>
        <button onClick={handlePrint} className="h-8 px-4 rounded text-white text-[10px] font-semibold flex items-center gap-1.5 transition shadow-sm" style={{ backgroundColor: '#0078D7' }}>
          <Printer className="h-3.5 w-3.5" /> Print <kbd className="text-[8px] bg-white/20 px-1 rounded">F3</kbd>
        </button>
        <button onClick={handleEmail} className="h-8 px-4 rounded text-white text-[10px] font-semibold flex items-center gap-1.5 transition shadow-sm" style={{ backgroundColor: '#0078D7' }}>
          <Mail className="h-3.5 w-3.5" /> Email
        </button>
        <button onClick={handleDelete} className="h-8 px-4 rounded text-white text-[10px] font-semibold flex items-center gap-1.5 transition shadow-sm" style={{ backgroundColor: '#0078D7' }}>
          <Trash2 className="h-3.5 w-3.5" /> Delete <kbd className="text-[8px] bg-white/20 px-1 rounded">F4</kbd>
        </button>
        <button onClick={handlePayment} className="h-8 px-4 rounded text-white text-[10px] font-semibold flex items-center gap-1.5 transition shadow-sm" style={{ backgroundColor: '#0078D7' }}>
          <CreditCard className="h-3.5 w-3.5" /> Payment <kbd className="text-[8px] bg-white/20 px-1 rounded">F5</kbd>
        </button>
        <div className="flex-1" />
        {selectedLine !== null && (
          <button onClick={() => removeLine(selectedLine)} className="h-8 px-3 rounded bg-rose-100 hover:bg-rose-200 text-rose-700 text-[10px] font-semibold flex items-center gap-1.5 transition">
            <Trash2 className="h-3.5 w-3.5" /> Remove Line
          </button>
        )}
        <button onClick={onBack} className="h-8 px-4 rounded text-white text-[10px] font-semibold flex items-center gap-1.5 transition shadow-sm" style={{ backgroundColor: '#0078D7' }}>
          <X className="h-3.5 w-3.5" /> Close <kbd className="text-[8px] bg-white/20 px-1 rounded">Esc</kbd>
        </button>
      </div>

      {/* Status Bar */}
      <div className="flex-shrink-0 px-4 py-1 text-[9px] text-white flex items-center gap-4" style={{ backgroundColor: '#808080' }}>
        <span><kbd className="bg-white/20 px-1 rounded mr-0.5">F7</kbd>Purchases List</span>
        <span><kbd className="bg-white/20 px-1 rounded mr-0.5">F8</kbd>Serial No.</span>
        <span><kbd className="bg-white/20 px-1 rounded mr-0.5">F9</kbd>Part No.</span>
        <span><kbd className="bg-white/20 px-1 rounded mr-0.5">F10</kbd>Details</span>
        <span><kbd className="bg-white/20 px-1 rounded mr-0.5">Shift+F12</kbd>Print Labels</span>
        <div className="flex-1" />
        <span>{COMPANY.name} · {lines.length} items · {formatGHS(totals.grandTotal)}</span>
      </div>

      {/* Stock List Popup (triggered by Find Part No field) */}
      <AnimatePresence>
        {showStockList && (
          <StockListMiniPopup
            products={products}
            searchText={findPartNo}
            onSelect={addProductToLine}
            onClose={() => setShowStockList(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ===== Mini Stock List Popup (smaller window for Purchase form) =====
function StockListMiniPopup({ products, searchText, onSelect, onClose }: {
  products: Product[];
  searchText: string;
  onSelect: (product: Product) => void;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [query, setQuery] = useState(searchText);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, []);

  const filtered = useMemo(() => {
    const q = (query || searchText).toLowerCase().trim();
    if (!q) return products;
    return products.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      p.barcode.includes(q)
    );
  }, [products, query, searchText]);

  const handleSelect = () => {
    if (filtered[selectedIndex]) onSelect(filtered[selectedIndex]);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/40 flex items-start justify-center pt-20 z-50"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: -20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: -20 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-lg shadow-2xl overflow-hidden flex flex-col"
        style={{ width: '650px', maxHeight: '400px', fontFamily: 'Arial, Helvetica, sans-serif' }}
      >
        {/* Title Bar */}
        <div className="flex-shrink-0 flex items-center justify-between px-3 h-7 text-white" style={{ backgroundColor: '#5B9BD5' }}>
          <span className="text-xs font-bold">Stock List</span>
          <button onClick={onClose} className="h-5 w-5 rounded hover:bg-white/25 flex items-center justify-center transition">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Search Section */}
        <div className="flex-shrink-0 px-3 py-1.5 bg-white border-b border-slate-300 flex items-center gap-2">
          <label className="text-[10px] font-bold text-slate-700">Search:</label>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0); }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSelect();
              if (e.key === 'Escape') onClose();
              if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex(i => Math.min(filtered.length - 1, i + 1)); }
              if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex(i => Math.max(0, i - 1)); }
            }}
            placeholder="Type to search..."
            className="flex-1 h-7 px-2 text-xs border border-slate-400 rounded outline-none focus:ring-2 focus:ring-blue-400"
          />
          <button onClick={() => setSelectedIndex(0)} className="h-7 px-3 rounded border border-slate-400 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold">Search</button>
        </div>

        {/* Filter + Count */}
        <div className="flex-shrink-0 px-3 py-1 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
          <label className="text-[10px] font-bold text-slate-700">Filter By:</label>
          <select className="h-6 px-1 text-[10px] border border-slate-300 rounded bg-white outline-none">
            <option>All Groups</option>
            <option>Groceries</option>
            <option>Confectionery</option>
            <option>Soft Drinks</option>
            <option>Hard Liquor</option>
            <option>Households</option>
          </select>
          <span className="text-[10px] text-slate-500 ml-auto font-mono">{filtered.length} of {products.length}</span>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          <div className="flex-shrink-0 grid grid-cols-[120px_1fr_45px_80px_80px_80px] gap-1 px-2 py-1 text-[10px] font-bold text-white" style={{ backgroundColor: '#4A90E2' }}>
            <div>Part No</div>
            <div>Item Details</div>
            <div className="text-right">Qty</div>
            <div className="text-right">Retail GHC</div>
            <div className="text-right">Trade GHC</div>
            <div className="text-right">Cost GHC</div>
          </div>
          <ScrollArea className="flex-1 min-h-0">
            <div>
              {filtered.length === 0 ? (
                <div className="text-center py-6 text-slate-400 text-xs">No products found</div>
              ) : (
                filtered.map((p, idx) => {
                  const isSelected = idx === selectedIndex;
                  return (
                    <div
                      key={p.id}
                      onClick={() => setSelectedIndex(idx)}
                      onDoubleClick={() => onSelect(p)}
                      className="grid grid-cols-[120px_1fr_45px_80px_80px_80px] gap-1 px-2 py-1 text-[10px] cursor-pointer border-b border-slate-100"
                      style={{ backgroundColor: isSelected ? '#D6E8FF' : (idx % 2 === 1 ? '#F8F8F8' : '#FFFFFF') }}
                    >
                      <div className="font-mono truncate">{p.barcode}</div>
                      <div className="truncate">{p.emoji} {p.name}</div>
                      <div className="text-right font-mono">{p.stock}</div>
                      <div className="text-right font-mono">{p.price.toFixed(2)}</div>
                      <div className="text-right font-mono">{p.costPrice.toFixed(2)}</div>
                      <div className="text-right font-mono">{p.costPrice.toFixed(2)}</div>
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Action Buttons */}
        <div className="flex-shrink-0 px-3 py-1.5 flex items-center gap-1.5 border-t border-slate-300" style={{ backgroundColor: '#E0F0E8' }}>
          <button onClick={handleSelect} className="h-7 px-3 rounded text-white text-[10px] font-semibold flex items-center gap-1" style={{ backgroundColor: '#4CAF50' }}>
            <Check className="h-3 w-3" /> Select (Enter)
          </button>
          <button onClick={() => toast({ title: "New Product", description: "Use Stock File to add new products" })} className="h-7 px-3 rounded text-white text-[10px] font-semibold flex items-center gap-1" style={{ backgroundColor: '#2196F3' }}>
            <Plus className="h-3 w-3" /> New
          </button>
          <button onClick={() => { if (!filtered[selectedIndex]) { toast({ title: "Select a product first", variant: "destructive" }); return; } toast({ title: "Product Picture", description: `${filtered[selectedIndex].emoji} ${filtered[selectedIndex].name}` }); }} className="h-7 px-3 rounded text-white text-[10px] font-semibold flex items-center gap-1" style={{ backgroundColor: '#9E9E9E' }}>
            <Package className="h-3 w-3" /> Picture
          </button>
          <button onClick={() => { if (!filtered[selectedIndex]) { toast({ title: "Select a product first", variant: "destructive" }); return; } toast({ title: "Product History", description: `${filtered[selectedIndex].name} (${filtered[selectedIndex].sku})` }); }} className="h-7 px-3 rounded text-white text-[10px] font-semibold flex items-center gap-1" style={{ backgroundColor: '#FF9800' }}>
            <Search className="h-3 w-3" /> History
          </button>
          <button onClick={() => { if (!filtered[selectedIndex]) { toast({ title: "Select a product first", variant: "destructive" }); return; } toast({ title: "Printing (F3)", description: `Printing label for ${filtered[selectedIndex].name}` }); }} className="h-7 px-3 rounded text-white text-[10px] font-semibold flex items-center gap-1" style={{ backgroundColor: '#9C27B0' }}>
            <Printer className="h-3 w-3" /> Print (F3)
          </button>
          <div className="flex-1" />
          <button onClick={onClose} className="h-7 px-3 rounded text-white text-[10px] font-semibold flex items-center gap-1" style={{ backgroundColor: '#F44336' }}>
            <X className="h-3 w-3" /> Close (Esc)
          </button>
        </div>

        {/* Status Bar */}
        <div className="flex-shrink-0 px-3 py-0.5 text-[9px] text-slate-600 flex items-center gap-3" style={{ backgroundColor: '#E0E0E0' }}>
          <span className="font-mono">{filtered.length} of {products.length}</span>
          <span>Source: Main Store</span>
        </div>
      </motion.div>
    </motion.div>
  );
}
