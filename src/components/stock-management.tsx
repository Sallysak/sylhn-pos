"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Package, Plus, Edit2, Trash2, Search, Layers, Settings2, History,
  ArrowLeft, Save, X, TrendingUp, AlertTriangle, CheckCircle2, Boxes,
  Filter, ChevronRight, Calendar, User, Tag, DollarSign, Barcode,
  ArrowUpDown, ArrowUp, ArrowDown, RotateCcw,
  FileText, Copy, Image as ImageIcon, Tags, FileSearch, FolderTree, SlidersHorizontal,
  Monitor, Printer, Folder, FileBarChart,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  COMPANY, CURRENCY, formatGHS, stockGroups, products as ALL_PRODUCTS,
  initialStockHistory, type Product, type StockGroup, type StockHistoryEntry,
} from "@/lib/pos-data";
import { generateReport, exportReportToPDF, exportReportToExcel, exportReportToCSV, printReport } from "@/lib/report-utils";
import type { StockView, ReportData } from "@/lib/pos-types";
import { PopupWindow } from "@/components/popup-window";
import { StockQuantityAdjustment } from "@/components/stock-quantity-adjustment";

interface StockManagementProps {
  onBack: () => void;
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  groups: StockGroup[];
  setGroups: React.Dispatch<React.SetStateAction<StockGroup[]>>;
  history: StockHistoryEntry[];
  setHistory: React.Dispatch<React.SetStateAction<StockHistoryEntry[]>>;
  initialView?: StockView;
  openQtyReport?: boolean;
}

export function StockManagement({ onBack, products, setProducts, groups, setGroups, history, setHistory, initialView, openQtyReport }: StockManagementProps) {
  const [view, setView] = useState<StockView>(initialView === "stock-file" || initialView === "stock-search" || initialView === "quantity-adjustment" ? "add-modify" : (initialView || "add-modify"));
  const [showQtyReport, setShowQtyReport] = useState(false);
  const [showStockFilePopup, setShowStockFilePopup] = useState(initialView === "stock-file");
  const [showStockSearchPopup, setShowStockSearchPopup] = useState(initialView === "stock-search");
  const [showQtyAdjustmentPopup, setShowQtyAdjustmentPopup] = useState(initialView === "quantity-adjustment");
  const { toast } = useToast();

  // Open Qty Report modal on mount if requested via menu.
  // This is a legitimate use: the parent passes a prop to request the modal open.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (openQtyReport) setShowQtyReport(true);
  }, [openQtyReport]);
  /* eslint-enable react-hooks/set-state-in-effect */

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-slate-50 to-emerald-50/30">
      {/* Header */}
      <header className="flex-shrink-0 bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-600 text-white shadow-lg">
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="h-9 w-9 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center ring-1 ring-white/20">
                <Boxes className="h-5 w-5" />
              </div>
              <div>
                <div className="font-bold text-base leading-tight">Stock Management</div>
                <div className="text-[10px] text-emerald-100/90">{COMPANY.name}</div>
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-emerald-100/80">{COMPANY.address}</div>
            <div className="text-xs font-mono text-emerald-100">{COMPANY.contact}</div>
          </div>
        </div>
      </header>

      {/* Sub Navigation */}
      <nav className="flex-shrink-0 bg-white border-b border-slate-200 shadow-sm">
        <div className="flex items-center gap-1 px-6 py-2">
          {[
            { id: "stock-file-popup" as const, label: "Stock File", icon: FileText },
            { id: "stock-search-popup" as const, label: "Stock Search", icon: FileSearch },
            { id: "add-modify" as const, label: "Add / Modify Stock", icon: Plus },
            { id: "group-maintenance" as const, label: "Group Maintenance", icon: Layers },
            { id: "quantity-adjustment" as const, label: "Quantity Adjustment", icon: ArrowUpDown },
            { id: "history" as const, label: "Stock History", icon: History },
          ].map(tab => {
            const isPopupTab = tab.id === "stock-file-popup" || tab.id === "stock-search-popup" || tab.id === "quantity-adjustment";
            const isActivePopup = (tab.id === "stock-file-popup" && showStockFilePopup) || (tab.id === "stock-search-popup" && showStockSearchPopup) || (tab.id === "quantity-adjustment" && showQtyAdjustmentPopup);
            return (
              <button
                key={tab.id}
                onClick={() => {
                  if (tab.id === "stock-file-popup") setShowStockFilePopup(true);
                  else if (tab.id === "stock-search-popup") setShowStockSearchPopup(true);
                  else if (tab.id === "quantity-adjustment") setShowQtyAdjustmentPopup(true);
                  else setView(tab.id);
                }}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all",
                  (!isPopupTab && view === tab.id) || isActivePopup
                    ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md"
                    : "text-slate-600 hover:bg-slate-100"
                )}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
          <div className="flex-1" />
          <button
            onClick={() => setShowQtyReport(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md hover:from-blue-700 hover:to-indigo-700"
          >
            <FileBarChart className="h-4 w-4" />
            Stock Qty Report
          </button>
        </div>
      </nav>

      {/* Content */}
      <main className="flex-1 overflow-hidden p-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={view}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="h-full"
          >
            {view === "add-modify" && <AddModifyStock products={products} setProducts={setProducts} groups={groups} setHistory={setHistory} />}
            {view === "group-maintenance" && <GroupMaintenance groups={groups} setGroups={setGroups} products={products} />}
            {view === "history" && <StockHistoryView history={history} products={products} />}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Stock Qty Report Modal */}
      <AnimatePresence>
        {showQtyReport && (
          <StockQtyReportModal products={products} groups={groups} onClose={() => setShowQtyReport(false)} />
        )}
      </AnimatePresence>

      {/* Stock File Popup Window */}
      <AnimatePresence>
        {showStockFilePopup && (
          <PopupWindow
            title="Stock File"
            titleBarColor="#5B9BD5"
            initialWidth={900}
            initialHeight={620}
            minWidth={600}
            minHeight={400}
            onClose={() => setShowStockFilePopup(false)}
          >
            <StockFileView products={products} setProducts={setProducts} groups={groups} history={history} setHistory={setHistory} />
          </PopupWindow>
        )}
      </AnimatePresence>

      {/* Stock Search Popup Window */}
      <AnimatePresence>
        {showStockSearchPopup && (
          <PopupWindow
            title="Stock Search"
            titleBarColor="#5B9BD5"
            initialWidth={900}
            initialHeight={620}
            minWidth={600}
            minHeight={400}
            initialX={80}
            initialY={80}
            onClose={() => setShowStockSearchPopup(false)}
          >
            <StockSearchView products={products} groups={groups} history={history} />
          </PopupWindow>
        )}
      </AnimatePresence>

      {/* ===== Stock Quantity Adjustment Popup Window ===== */}
      <AnimatePresence>
        {showQtyAdjustmentPopup && (
          <StockQuantityAdjustment
            products={products}
            setProducts={setProducts}
            setHistory={setHistory}
            history={history}
            groups={groups}
            onClose={() => setShowQtyAdjustmentPopup(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ===== Add / Modify Stock =====
function AddModifyStock({ products, setProducts, groups, setHistory }: {
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  groups: StockGroup[];
  setHistory: React.Dispatch<React.SetStateAction<StockHistoryEntry[]>>;
}) {
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Product | null>(null);
  const [showForm, setShowForm] = useState(false);
  const { toast } = useToast();

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.sku.toLowerCase().includes(search.toLowerCase()) ||
    p.barcode.includes(search)
  );

  const handleSave = (product: Product) => {
    const isNew = !products.find(p => p.id === product.id);
    if (isNew) {
      setProducts(prev => [...prev, product]);
      setHistory(prev => [...prev, {
        id: `h-${Date.now()}`,
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        action: 'added',
        quantityChange: product.stock,
        newQuantity: product.stock,
        timestamp: new Date().toISOString(),
        user: "Sarah Johnson",
        reason: "New product added to inventory",
        reference: `ADD-${Date.now().toString().slice(-6)}`,
      }]);
      toast({ title: "Product added", description: `${product.emoji} ${product.name} created` });
    } else {
      setProducts(prev => prev.map(p => p.id === product.id ? product : p));
      setHistory(prev => [...prev, {
        id: `h-${Date.now()}`,
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        action: 'modified',
        quantityChange: 0,
        newQuantity: product.stock,
        timestamp: new Date().toISOString(),
        user: "Sarah Johnson",
        reason: "Product details updated",
        reference: `MOD-${Date.now().toString().slice(-6)}`,
      }]);
      toast({ title: "Product updated", description: `${product.emoji} ${product.name} modified` });
    }
    setShowForm(false);
    setEditing(null);
  };

  const handleDelete = (id: string) => {
    const product = products.find(p => p.id === id);
    setProducts(prev => prev.filter(p => p.id !== id));
    if (product) {
      setHistory(prev => [...prev, {
        id: `h-${Date.now()}`,
        productId: id,
        productName: product.name,
        sku: product.sku,
        action: 'removed',
        quantityChange: -product.stock,
        newQuantity: 0,
        timestamp: new Date().toISOString(),
        user: "Sarah Johnson",
        reason: "Product removed from inventory",
        reference: `DEL-${Date.now().toString().slice(-6)}`,
      }]);
    }
    toast({ title: "Product deleted", variant: "default" });
  };

  return (
    <div className="h-full bg-white rounded-2xl shadow-lg ring-1 ring-slate-200/60 overflow-hidden flex flex-col">
      {/* Toolbar */}
      <div className="flex-shrink-0 flex items-center justify-between px-5 py-3 bg-gradient-to-r from-slate-50 to-white border-b border-slate-200">
        <div className="flex items-center gap-3">
          <Package className="h-5 w-5 text-emerald-600" />
          <h2 className="text-base font-bold text-slate-800">Product Catalog</h2>
          <Badge variant="outline" className="font-mono text-xs">{products.length} items</Badge>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products..."
              className="h-9 pl-8 pr-3 rounded-lg bg-slate-100 text-sm outline-none ring-2 ring-transparent focus:ring-emerald-300 focus:bg-white transition w-64"
            />
          </div>
          <Button
            onClick={() => { setEditing(null); setShowForm(true); }}
            className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700"
          >
            <Plus className="h-4 w-4" />
            Add Product
          </Button>
        </div>
      </div>

      {/* Table */}
      <ScrollArea className="flex-1">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-slate-800 text-white text-xs uppercase tracking-wide z-10">
            <tr>
              <th className="text-left px-4 py-2.5 font-semibold">Product</th>
              <th className="text-left px-3 py-2.5 font-semibold">SKU</th>
              <th className="text-left px-3 py-2.5 font-semibold">Group</th>
              <th className="text-center px-3 py-2.5 font-semibold">Stock</th>
              <th className="text-right px-3 py-2.5 font-semibold">Cost</th>
              <th className="text-right px-3 py-2.5 font-semibold">Price</th>
              <th className="text-center px-3 py-2.5 font-semibold">Expiry</th>
              <th className="text-center px-3 py-2.5 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map(p => {
              const group = groups.find(g => g.id === p.groupId);
              const expDays = Math.ceil((new Date(p.expiryDate).getTime() - Date.now()) / 86400000);
              return (
                <tr key={p.id} className="hover:bg-emerald-50/50 transition">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{p.emoji}</span>
                      <div>
                        <div className="font-semibold text-slate-800">{p.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{p.barcode}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs text-slate-600">{p.sku}</td>
                  <td className="px-3 py-2.5">
                    <Badge variant="outline" className="text-[10px]">{group?.icon} {group?.name}</Badge>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <span className={cn("font-mono font-semibold", p.stock === 0 ? "text-rose-600" : p.stock <= p.reorderLevel ? "text-amber-600" : "text-slate-700")}>
                      {p.stock}
                    </span>
                    <span className="text-[10px] text-slate-400 ml-1">/{p.unit}</span>
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-slate-600">{formatGHS(p.costPrice)}</td>
                  <td className="px-3 py-2.5 text-right font-mono font-semibold text-emerald-600">{formatGHS(p.price)}</td>
                  <td className="px-3 py-2.5 text-center">
                    <span className={cn("text-[11px] font-medium", expDays < 0 ? "text-rose-600" : expDays <= 7 ? "text-amber-600" : "text-slate-500")}>
                      {p.expiryDate}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => { setEditing(p); setShowForm(true); }}
                        className="h-7 w-7 rounded-md bg-blue-100 text-blue-600 hover:bg-blue-200 flex items-center justify-center transition"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(p.id)}
                        className="h-7 w-7 rounded-md bg-rose-100 text-rose-600 hover:bg-rose-200 flex items-center justify-center transition"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </ScrollArea>

      {/* Form Modal */}
      <AnimatePresence>
        {showForm && (
          <ProductForm
            product={editing}
            groups={groups}
            onSave={handleSave}
            onClose={() => { setShowForm(false); setEditing(null); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function ProductForm({ product, groups, onSave, onClose }: {
  product: Product | null;
  groups: StockGroup[];
  onSave: (p: Product) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<Product>(product || {
    id: `p-${Date.now()}`,
    sku: `NEW-${Math.floor(1000 + Math.random() * 9000)}`,
    name: "",
    price: 0,
    costPrice: 0,
    category: "fruits",
    groupId: "g1",
    unit: "each",
    stock: 0,
    reorderLevel: 10,
    barcode: "",
    emoji: "📦",
    taxable: false,
    batchNumber: `B-NEW-${Date.now().toString().slice(-4)}`,
    receivedDate: new Date().toISOString().split('T')[0],
    expiryDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
    supplier: "",
  });

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
      >
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-emerald-600 to-teal-600 text-white">
          <div className="flex items-center gap-2">
            {product ? <Edit2 className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
            <h3 className="text-lg font-bold">{product ? "Edit Product" : "Add New Product"}</h3>
          </div>
          <button onClick={onClose} className="h-8 w-8 rounded-lg bg-white/15 hover:bg-white/25 flex items-center justify-center">
            <X className="h-4 w-4" />
          </button>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-6 grid grid-cols-2 gap-4">
            <FormField label="Product Name" icon={<Tag className="h-3.5 w-3.5" />} full>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="form-input" placeholder="e.g. Fresh Tomatoes" />
            </FormField>
            <FormField label="SKU" icon={<Barcode className="h-3.5 w-3.5" />}>
              <input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} className="form-input" />
            </FormField>
            <FormField label="Barcode">
              <input value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} className="form-input" placeholder="941563812092" />
            </FormField>
            <FormField label="Emoji">
              <input value={form.emoji} onChange={(e) => setForm({ ...form, emoji: e.target.value })} className="form-input text-center text-xl" maxLength={2} />
            </FormField>
            <FormField label="Stock Group" full>
              <select value={form.groupId} onChange={(e) => setForm({ ...form, groupId: e.target.value, category: e.target.value })} className="form-input">
                {groups.map(g => <option key={g.id} value={g.id}>{g.icon} {g.name}</option>)}
              </select>
            </FormField>
            <FormField label="Unit">
              <select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className="form-input">
                {["kg", "each", "box", "pack", "btl", "loaf", "can", "jar", "bag", "tub", "block", "head", "dz"].map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </FormField>
            <FormField label="Cost Price (GHS)" icon={<DollarSign className="h-3.5 w-3.5" />}>
              <input type="number" step="0.01" value={form.costPrice} onChange={(e) => setForm({ ...form, costPrice: parseFloat(e.target.value) || 0 })} className="form-input" />
            </FormField>
            <FormField label="Selling Price (GHS)" icon={<DollarSign className="h-3.5 w-3.5" />}>
              <input type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: parseFloat(e.target.value) || 0 })} className="form-input" />
            </FormField>
            <FormField label="Current Stock">
              <input type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: parseInt(e.target.value) || 0 })} className="form-input" />
            </FormField>
            <FormField label="Reorder Level">
              <input type="number" value={form.reorderLevel} onChange={(e) => setForm({ ...form, reorderLevel: parseInt(e.target.value) || 0 })} className="form-input" />
            </FormField>
            <FormField label="Batch Number">
              <input value={form.batchNumber} onChange={(e) => setForm({ ...form, batchNumber: e.target.value })} className="form-input" />
            </FormField>
            <FormField label="Supplier">
              <input value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} className="form-input" placeholder="Supplier name" />
            </FormField>
            <FormField label="Received Date" icon={<Calendar className="h-3.5 w-3.5" />}>
              <input type="date" value={form.receivedDate} onChange={(e) => setForm({ ...form, receivedDate: e.target.value })} className="form-input" />
            </FormField>
            <FormField label="Expiry Date" icon={<Calendar className="h-3.5 w-3.5" />}>
              <input type="date" value={form.expiryDate} onChange={(e) => setForm({ ...form, expiryDate: e.target.value })} className="form-input" />
            </FormField>
            <FormField label="Taxable" full>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.taxable} onChange={(e) => setForm({ ...form, taxable: e.target.checked })} className="h-4 w-4 rounded accent-emerald-600" />
                <span className="text-sm text-slate-700">Apply VAT (15%) on this product</span>
              </label>
            </FormField>
            {form.price > 0 && form.costPrice > 0 && (
              <div className="col-span-2 p-3 rounded-lg bg-emerald-50 ring-1 ring-emerald-200 flex items-center justify-between">
                <span className="text-sm font-semibold text-emerald-800">Profit Margin:</span>
                <span className="text-sm font-bold text-emerald-700">
                  {formatGHS(form.price - form.costPrice)} ({(((form.price - form.costPrice) / form.price) * 100).toFixed(1)}%)
                </span>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="flex-shrink-0 px-6 py-3 border-t border-slate-200 bg-slate-50 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => form.name && onSave(form)}
            disabled={!form.name}
            className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700"
          >
            <Save className="h-4 w-4" />
            {product ? "Update Product" : "Add Product"}
          </Button>
        </div>

        <style jsx>{`
          :global(.form-input) {
            width: 100%;
            height: 2.5rem;
            padding: 0 0.75rem;
            border-radius: 0.5rem;
            border: 1px solid rgb(226 232 240);
            background: white;
            font-size: 0.875rem;
            outline: none;
            transition: all 0.15s;
          }
          :global(.form-input:focus) {
            border-color: rgb(16 185 129);
            box-shadow: 0 0 0 3px rgb(16 185 129 / 0.1);
          }
        `}</style>
      </motion.div>
    </motion.div>
  );
}

function FormField({ label, icon, children, full }: { label: string; icon?: React.ReactNode; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? "col-span-2" : ""}>
      <label className="flex items-center gap-1 text-xs font-semibold text-slate-600 mb-1">
        {icon}
        {label}
      </label>
      {children}
    </div>
  );
}

// ===== Group Maintenance =====
function GroupMaintenance({ groups, setGroups, products }: {
  groups: StockGroup[];
  setGroups: React.Dispatch<React.SetStateAction<StockGroup[]>>;
  products: Product[];
}) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<StockGroup | null>(null);
  const { toast } = useToast();

  const handleDelete = (id: string) => {
    const count = products.filter(p => p.groupId === id).length;
    if (count > 0) {
      toast({ title: "Cannot delete", description: `${count} products use this group`, variant: "destructive" });
      return;
    }
    setGroups(prev => prev.filter(g => g.id !== id));
    toast({ title: "Group deleted" });
  };

  return (
    <div className="h-full bg-white rounded-2xl shadow-lg ring-1 ring-slate-200/60 overflow-hidden flex flex-col">
      <div className="flex-shrink-0 flex items-center justify-between px-5 py-3 bg-gradient-to-r from-slate-50 to-white border-b border-slate-200">
        <div className="flex items-center gap-3">
          <Layers className="h-5 w-5 text-emerald-600" />
          <h2 className="text-base font-bold text-slate-800">Stock Groups</h2>
          <Badge variant="outline" className="font-mono text-xs">{groups.length} groups</Badge>
        </div>
        <Button onClick={() => { setEditing(null); setShowForm(true); }} className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700">
          <Plus className="h-4 w-4" />
          Add Group
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-5">
          {groups.map(g => {
            const count = products.filter(p => p.groupId === g.id).length;
            const value = products.filter(p => p.groupId === g.id).reduce((s, p) => s + p.price * p.stock, 0);
            return (
              <motion.div
                key={g.id}
                layout
                whileHover={{ y: -3 }}
                className="bg-white rounded-xl ring-1 ring-slate-200 p-4 shadow-sm hover:shadow-md transition"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center text-2xl">
                    {g.icon}
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => { setEditing(g); setShowForm(true); }} className="h-7 w-7 rounded-md bg-blue-100 text-blue-600 hover:bg-blue-200 flex items-center justify-center">
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => handleDelete(g.id)} className="h-7 w-7 rounded-md bg-rose-100 text-rose-600 hover:bg-rose-200 flex items-center justify-center">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <div className="font-bold text-slate-800">{g.name}</div>
                <div className="text-xs text-slate-500 mb-3">{g.description}</div>
                <div className="flex items-center justify-between text-xs">
                  <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-700 font-semibold">
                    {count} products
                  </span>
                  <span className="font-mono font-semibold text-slate-700">{formatGHS(value)}</span>
                </div>
              </motion.div>
            );
          })}
        </div>
      </ScrollArea>

      <AnimatePresence>
        {showForm && (
          <GroupForm
            group={editing}
            onSave={(g) => {
              if (editing) {
                setGroups(prev => prev.map(x => x.id === g.id ? g : x));
                toast({ title: "Group updated" });
              } else {
                setGroups(prev => [...prev, { ...g, id: `g-${Date.now()}` }]);
                toast({ title: "Group added" });
              }
              setShowForm(false);
              setEditing(null);
            }}
            onClose={() => { setShowForm(false); setEditing(null); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function GroupForm({ group, onSave, onClose }: {
  group: StockGroup | null;
  onSave: (g: StockGroup) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<StockGroup>(group || { id: "", name: "", description: "", color: "emerald", icon: "📦" });
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-emerald-600 to-teal-600 text-white">
          <h3 className="text-lg font-bold">{group ? "Edit Group" : "Add Stock Group"}</h3>
          <button onClick={onClose} className="h-8 w-8 rounded-lg bg-white/15 hover:bg-white/25 flex items-center justify-center"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1 block">Group Name</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full h-10 px-3 rounded-lg border border-slate-200 focus:border-emerald-500 outline-none text-sm" placeholder="e.g. Fresh Produce" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1 block">Description</label>
            <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full h-10 px-3 rounded-lg border border-slate-200 focus:border-emerald-500 outline-none text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Icon (emoji)</label>
              <input value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} className="w-full h-10 px-3 rounded-lg border border-slate-200 focus:border-emerald-500 outline-none text-sm text-center text-xl" maxLength={2} />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Color</label>
              <select value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="w-full h-10 px-3 rounded-lg border border-slate-200 focus:border-emerald-500 outline-none text-sm">
                {["emerald", "blue", "red", "amber", "cyan", "purple", "sky", "orange", "teal", "pink"].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
        </div>
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => form.name && onSave(form)} disabled={!form.name} className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700"><Save className="h-4 w-4" />{group ? "Update" : "Add Group"}</Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ===== Quantity Adjustment =====
// NOTE: Quantity Adjustment now lives in src/components/stock-quantity-adjustment.tsx
// and is opened as a popup window via the showQtyAdjustmentPopup state.

// ===== Stock History =====
function StockHistoryView({ history, products }: { history: StockHistoryEntry[]; products: Product[] }) {
  const [filter, setFilter] = useState<string>("all");
  // ===== Reference filter: when set, only entries with this reference are shown =====
  // (e.g. all lines belonging to a single Stocktake event ADJ-123456)
  const [referenceFilter, setReferenceFilter] = useState<string>("all");

  // Build the list of unique references from history (most-recent first)
  // Each reference is grouped with its earliest timestamp + entry count + total variance
  const referenceGroups = useMemo(() => {
    const groups = new Map<string, { reference: string; count: number; totalVariance: number; firstTimestamp: string; actions: Set<string> }>();
    history.forEach(h => {
      if (!h.reference) return;
      const existing = groups.get(h.reference);
      if (existing) {
        existing.count += 1;
        existing.totalVariance += h.quantityChange;
        existing.actions.add(h.action);
        if (h.timestamp < existing.firstTimestamp) existing.firstTimestamp = h.timestamp;
      } else {
        groups.set(h.reference, {
          reference: h.reference,
          count: 1,
          totalVariance: h.quantityChange,
          firstTimestamp: h.timestamp,
          actions: new Set([h.action]),
        });
      }
    });
    return Array.from(groups.values()).sort((a, b) => b.firstTimestamp.localeCompare(a.firstTimestamp));
  }, [history]);

  // ===== Compute filtered list =====
  // Apply action filter first, then reference filter
  const filtered = useMemo(() => {
    let result = filter === "all" ? history : history.filter(h => h.action === filter);
    if (referenceFilter !== "all") {
      result = result.filter(h => h.reference === referenceFilter);
    }
    return result;
  }, [history, filter, referenceFilter]);

  const actionColors: Record<string, string> = {
    added: "bg-emerald-100 text-emerald-700",
    modified: "bg-blue-100 text-blue-700",
    adjusted: "bg-amber-100 text-amber-700",
    sold: "bg-purple-100 text-purple-700",
    received: "bg-cyan-100 text-cyan-700",
    removed: "bg-rose-100 text-rose-700",
    reordered: "bg-orange-100 text-orange-700",
  };

  return (
    <div className="h-full bg-white rounded-2xl shadow-lg ring-1 ring-slate-200/60 overflow-hidden flex flex-col">
      <div className="flex-shrink-0 flex items-center justify-between px-5 py-3 bg-gradient-to-r from-slate-50 to-white border-b border-slate-200">
        <div className="flex items-center gap-3">
          <History className="h-5 w-5 text-emerald-600" />
          <h2 className="text-base font-bold text-slate-800">Stock Movement History</h2>
          <Badge variant="outline" className="font-mono text-xs">{filtered.length} of {history.length} entries</Badge>
        </div>
        <div className="flex gap-1">
          {["all", "received", "added", "modified", "adjusted", "removed"].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn("px-2.5 py-1 rounded-md text-[11px] font-semibold capitalize transition",
                filter === f ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200")}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* ===== Reference filter bar (new) ===== */}
      {referenceGroups.length > 0 && (
        <div className="flex-shrink-0 px-5 py-2 bg-amber-50/60 border-b border-amber-100 flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
            <Filter className="h-3 w-3" /> Adjustment Reference:
          </span>
          <select
            value={referenceFilter}
            onChange={(e) => setReferenceFilter(e.target.value)}
            className="h-7 px-2 text-[11px] rounded-md border border-slate-300 bg-white text-slate-700 outline-none focus:ring-2 focus:ring-emerald-400 cursor-pointer"
          >
            <option value="all">All references ({history.length} entries)</option>
            {referenceGroups.map(g => (
              <option key={g.reference} value={g.reference}>
                {g.reference} — {g.count} entries · variance {g.totalVariance > 0 ? '+' : ''}{g.totalVariance} · {new Date(g.firstTimestamp).toLocaleDateString('en-GB')}
              </option>
            ))}
          </select>
          {referenceFilter !== "all" && (
            <button
              onClick={() => setReferenceFilter("all")}
              className="h-7 px-2 rounded-md bg-rose-100 hover:bg-rose-200 text-rose-700 text-[10px] font-semibold flex items-center gap-1 transition"
            >
              <X className="h-3 w-3" /> Clear reference filter
            </button>
          )}
          {referenceFilter !== "all" && (
            <Badge variant="secondary" className="bg-amber-100 text-amber-800 text-[10px]">
              Showing {filtered.length} entries for {referenceFilter}
            </Badge>
          )}
        </div>
      )}

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-2">
          {filtered.slice().reverse().map((h, i) => (
            <motion.div
              key={h.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: Math.min(i * 0.02, 0.3) }}
              className={cn(
                "flex items-center gap-3 p-3 rounded-xl transition cursor-pointer",
                referenceFilter === h.reference ? "bg-amber-100 ring-1 ring-amber-300 hover:bg-amber-200" : "bg-slate-50 hover:bg-slate-100"
              )}
              onClick={() => {
                // Click on a row whose reference matches the current filter clears it; otherwise sets it
                if (referenceFilter === h.reference) setReferenceFilter("all");
                else if (h.reference) setReferenceFilter(h.reference);
              }}
              title={h.reference ? `Click to filter by ${h.reference}` : undefined}
            >
              <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center text-xs font-bold uppercase", actionColors[h.action])}>
                {h.action.slice(0, 3)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-800 text-sm">{h.productName}</span>
                  <span className="text-[10px] font-mono text-slate-400">{h.sku}</span>
                </div>
                <div className="text-xs text-slate-500 truncate">{h.reason}</div>
              </div>
              <div className="text-right">
                <div className={cn("font-mono font-bold text-sm", h.quantityChange > 0 ? "text-emerald-600" : h.quantityChange < 0 ? "text-rose-600" : "text-slate-600")}>
                  {h.quantityChange > 0 ? "+" : ""}{h.quantityChange}
                </div>
                <div className="text-[10px] text-slate-400">→ {h.newQuantity}</div>
              </div>
              <div className="text-right text-[10px] text-slate-400">
                <div>{new Date(h.timestamp).toLocaleDateString('en-GB')}</div>
                <div>{new Date(h.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-slate-400">Ref</div>
                <div className={cn("text-[10px] font-mono", referenceFilter === h.reference ? "text-amber-700 font-bold" : "text-slate-600")}>{h.reference}</div>
              </div>
              <div className="flex items-center gap-1 text-[10px] text-slate-500">
                <User className="h-3 w-3" />
                {h.user.split(' ')[0]}
              </div>
            </motion.div>
          ))}
          {filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <History className="h-10 w-10 mb-2 opacity-40" />
              <div className="text-sm font-medium">No history entries match the current filters</div>
              {(filter !== "all" || referenceFilter !== "all") && (
                <button
                  onClick={() => { setFilter("all"); setReferenceFilter("all"); }}
                  className="mt-2 h-7 px-3 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
                >
                  Clear all filters
                </button>
              )}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// ===== Stock File View =====
function StockFileView({ products, setProducts, groups, history, setHistory }: {
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  groups: StockGroup[];
  history: StockHistoryEntry[];
  setHistory: React.Dispatch<React.SetStateAction<StockHistoryEntry[]>>;
}) {
  const [searchText, setSearchText] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterGroup, setFilterGroup] = useState("all");
  const [filterGroup1, setFilterGroup1] = useState("all");
  const [filterGroup2, setFilterGroup2] = useState("all");
  const [filterGroup3, setFilterGroup3] = useState("all");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showCloneConfirm, setShowCloneConfirm] = useState<Product | null>(null);
  const [showQtyAdjust, setShowQtyAdjust] = useState<Product | null>(null);
  const [showPicture, setShowPicture] = useState<Product | null>(null);
  const [showHistory, setShowHistory] = useState<Product | null>(null);
  const { toast } = useToast();

  const filtered = products.filter(p => {
    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      if (!p.name.toLowerCase().includes(q) && !p.sku.toLowerCase().includes(q) && !p.barcode.includes(q)) return false;
    }
    if (filterType !== "all") {
      if (filterType === "taxable" && !p.taxable) return false;
      if (filterType === "non-taxable" && p.taxable) return false;
      if (filterType === "low-stock" && p.stock > p.reorderLevel) return false;
      if (filterType === "out-of-stock" && p.stock > 0) return false;
      if (filterType === "expiring" && Math.ceil((new Date(p.expiryDate).getTime() - Date.now()) / 86400000) > 7) return false;
    }
    if (filterGroup !== "all" && p.groupId !== filterGroup) return false;
    return true;
  });

  const selected = filtered[selectedIndex];

  const handleModify = () => {
    if (!selected) { toast({ title: "No product selected", variant: "destructive" }); return; }
    setEditingProduct(selected);
    setShowForm(true);
  };

  const handleNew = () => {
    setEditingProduct(null);
    setShowForm(true);
  };

  const handleClone = () => {
    if (!selected) { toast({ title: "No product selected", variant: "destructive" }); return; }
    setShowCloneConfirm(selected);
  };

  const handleSave = (product: Product) => {
    const isNew = !products.find(p => p.id === product.id);
    if (isNew) {
      setProducts(prev => [...prev, product]);
      setHistory(prev => [...prev, {
        id: `h-${Date.now()}`,
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        action: 'added',
        quantityChange: product.stock,
        newQuantity: product.stock,
        timestamp: new Date().toISOString(),
        user: "Sarah Johnson",
        reason: "New product added via Stock File",
        reference: `ADD-${Date.now().toString().slice(-6)}`,
      }]);
      toast({ title: "Product added", description: `${product.emoji} ${product.name}` });
    } else {
      setProducts(prev => prev.map(p => p.id === product.id ? product : p));
      setHistory(prev => [...prev, {
        id: `h-${Date.now()}`,
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        action: 'modified',
        quantityChange: 0,
        newQuantity: product.stock,
        timestamp: new Date().toISOString(),
        user: "Sarah Johnson",
        reason: "Product modified via Stock File",
        reference: `MOD-${Date.now().toString().slice(-6)}`,
      }]);
      toast({ title: "Product updated", description: `${product.emoji} ${product.name}` });
    }
    setShowForm(false);
    setEditingProduct(null);
  };

  const confirmClone = () => {
    if (!showCloneConfirm) return;
    const cloned: Product = {
      ...showCloneConfirm,
      id: `p-${Date.now()}`,
      sku: `CLN-${Math.floor(1000 + Math.random() * 9000)}`,
      name: `${showCloneConfirm.name} (Copy)`,
      barcode: `${showCloneConfirm.barcode}${Math.floor(Math.random() * 10)}`,
      batchNumber: `B-CLN-${Date.now().toString().slice(-4)}`,
      stock: 0,
    };
    setProducts(prev => [...prev, cloned]);
    setHistory(prev => [...prev, {
      id: `h-${Date.now()}`,
      productId: cloned.id,
      productName: cloned.name,
      sku: cloned.sku,
      action: 'added',
      quantityChange: 0,
      newQuantity: 0,
      timestamp: new Date().toISOString(),
      user: "Sarah Johnson",
      reason: `Cloned from ${showCloneConfirm.name}`,
      reference: `CLN-${Date.now().toString().slice(-6)}`,
    }]);
    toast({ title: "Product cloned", description: `${cloned.name} created` });
    setShowCloneConfirm(null);
  };

  return (
    <div className="h-full overflow-hidden flex flex-col" style={{ backgroundColor: '#E8F5E9' }}>
      {/* Search & Filter Section */}
      <div className="flex-shrink-0 px-4 py-2 space-y-2" style={{ backgroundColor: '#E8F5E9' }}>
        {/* Search Row */}
        <div className="flex items-center gap-3">
          <label className="text-xs font-bold text-slate-700 whitespace-nowrap w-20">Search Text</label>
          <input
            value={searchText}
            onChange={(e) => { setSearchText(e.target.value); setSelectedIndex(0); }}
            placeholder="Part Number"
            className="flex-1 max-w-xs h-8 px-3 rounded border border-slate-400 bg-white text-sm outline-none focus:ring-2 focus:ring-blue-400"
          />
          <button
            onClick={() => setSelectedIndex(0)}
            className="h-8 px-4 rounded border border-slate-400 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold transition"
          >
            Search
          </button>
        </div>
        {/* Filter Row */}
        <div className="flex items-center gap-3 flex-wrap">
          <label className="text-xs font-bold text-slate-700 whitespace-nowrap w-20">Filter By</label>
          <FilterDropdown label="Type" value={filterType} onChange={(v) => { setFilterType(v); setSelectedIndex(0); }} options={[
            { value: "all", label: "All Types" },
            { value: "taxable", label: "Taxable (VAT)" },
            { value: "non-taxable", label: "Non-Taxable" },
            { value: "low-stock", label: "Low Stock" },
            { value: "out-of-stock", label: "Out of Stock" },
          ]} />
          <FilterDropdown label="Stock Group" value={filterGroup} onChange={(v) => { setFilterGroup(v); setSelectedIndex(0); }} options={[
            { value: "all", label: "All Groups" },
            ...groups.map(g => ({ value: g.id, label: `${g.icon} ${g.name}` })),
          ]} />
          <FilterDropdown label="Sub Group" value={filterGroup1} onChange={setFilterGroup1} options={[
            { value: "all", label: "All" },
            { value: "fresh", label: "Fresh Items" },
            { value: "packaged", label: "Packaged" },
            { value: "frozen", label: "Frozen" },
          ]} />
          <FilterDropdown label="Brand" value={filterGroup2} onChange={setFilterGroup2} options={[
            { value: "all", label: "All Brands" },
            { value: "local", label: "Local Brands" },
            { value: "imported", label: "Imported Brands" },
          ]} />
          <FilterDropdown label="Size" value={filterGroup3} onChange={setFilterGroup3} options={[
            { value: "all", label: "All Sizes" },
            { value: "small", label: "Small" },
            { value: "medium", label: "Medium" },
            { value: "large", label: "Large" },
          ]} />
        </div>
      </div>

      {/* Data Table */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0 bg-white border-t border-b border-slate-400">
        {/* Table Header */}
        <div className="flex-shrink-0 grid grid-cols-[160px_1fr_60px_100px_100px] gap-1 px-3 py-1.5 text-slate-700 text-[11px] font-bold border-b border-slate-400" style={{ backgroundColor: '#F5F5F5' }}>
          <div>Part no</div>
          <div>Details</div>
          <div className="text-right">Qty</div>
          <div className="text-right">Retail GHC</div>
          <div className="text-right">Trade GHC</div>
        </div>

        {/* Table Body */}
        <ScrollArea className="flex-1 min-h-0">
          <div>
            {filtered.map((p, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={p.id}
                  onClick={() => setSelectedIndex(idx)}
                  className={cn(
                    "grid grid-cols-[160px_1fr_60px_100px_100px] gap-1 px-3 py-1.5 text-xs cursor-pointer transition border-b border-slate-200",
                  )}
                  style={{
                    backgroundColor: isSelected ? '#E3F2FD' : (idx % 2 === 1 ? '#FAFAFA' : '#FFFFFF'),
                    color: isSelected ? '#1565C0' : '#424242',
                  }}
                >
                  <div className="font-mono truncate">{p.barcode}</div>
                  <div className="truncate">{p.emoji} {p.name}</div>
                  <div className="text-right font-mono">{p.stock}</div>
                  <div className="text-right font-mono">{p.price.toFixed(2)}</div>
                  <div className="text-right font-mono">{p.costPrice.toFixed(2)}</div>
                </div>
              );
            })}
          </div>
          {filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <Package className="h-10 w-10 mb-2 opacity-40" />
              <div className="text-sm font-medium">No products found</div>
              <div className="text-xs mt-1">Try adjusting your search or filters</div>
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Action Buttons */}
      <div className="flex-shrink-0 px-4 py-2 flex items-center gap-2 flex-wrap" style={{ backgroundColor: '#E8F5E9' }}>
        <button onClick={handleModify} className="h-9 px-4 rounded text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-sm" style={{ backgroundColor: '#4CAF50' }}>
          <Edit2 className="h-3.5 w-3.5" /> Modify
        </button>
        <button onClick={handleNew} className="h-9 px-4 rounded bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition border border-slate-400">
          <Plus className="h-3.5 w-3.5" /> New
        </button>
        <button onClick={handleClone} className="h-9 px-4 rounded bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition border border-slate-400">
          <Copy className="h-3.5 w-3.5" /> Clone
        </button>
        <button onClick={() => { if (!selected) { toast({ title: "Select a product first", variant: "destructive" }); return; } setShowPicture(selected); }} className="h-9 px-4 rounded bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition border border-slate-400">
          <ImageIcon className="h-3.5 w-3.5" /> Picture
        </button>
        <button onClick={() => { if (!selected) { toast({ title: "Select a product first", variant: "destructive" }); return; } setShowHistory(selected); }} className="h-9 px-4 rounded bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition border border-slate-400">
          <History className="h-3.5 w-3.5" /> History
        </button>
        <button onClick={() => toast({ title: "Print Labels", description: selected ? `Print labels for ${selected.name}` : "Select a product first" })} className="h-9 px-4 rounded bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition border border-slate-400">
          <Tags className="h-3.5 w-3.5" /> Labels
        </button>
        <div className="flex-1" />
        <button onClick={() => {}} className="h-9 px-4 rounded text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-sm" style={{ backgroundColor: '#F44336' }}>
          <X className="h-3.5 w-3.5" /> Close (Esc)
        </button>
      </div>

      {/* Status Bar */}
      <div className="flex-shrink-0 px-4 py-1 flex items-center gap-4 text-[10px] text-slate-600 border-t border-slate-300" style={{ backgroundColor: '#E8F5E9' }}>
        <span>&lt; &gt;</span>
        <span className="font-mono">{filtered.length} of {products.length} products</span>
        <div className="flex-1" />
        <span><kbd className="px-1 bg-white border border-slate-300 rounded mr-1">F9</kbd>Part No.</span>
        <span><kbd className="px-1 bg-white border border-slate-300 rounded mr-1">F10</kbd>Details</span>
        <span><kbd className="px-1 bg-white border border-slate-300 rounded mr-1">Shift+F12</kbd>Print Labels</span>
      </div>

      {/* Product Form Modal */}
      <AnimatePresence>
        {showForm && (
          <ProductForm
            product={editingProduct}
            groups={groups}
            onSave={handleSave}
            onClose={() => { setShowForm(false); setEditingProduct(null); }}
          />
        )}
      </AnimatePresence>

      {/* Clone Confirmation */}
      <AnimatePresence>
        {showCloneConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowCloneConfirm(null)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="h-12 w-12 rounded-full bg-cyan-100 flex items-center justify-center">
                  <Copy className="h-6 w-6 text-cyan-600" />
                </div>
                <div>
                  <div className="font-bold text-slate-800">Clone Product?</div>
                  <div className="text-xs text-slate-500">A copy of "{showCloneConfirm.name}" will be created with 0 stock.</div>
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <Button variant="outline" className="flex-1" onClick={() => setShowCloneConfirm(null)}>Cancel</Button>
                <button onClick={confirmClone} className="flex-1 h-10 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white font-semibold text-sm transition">Clone Product</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Qty Quick Adjust */}
      <AnimatePresence>
        {showQtyAdjust && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowQtyAdjust(null)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="px-5 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ArrowUpDown className="h-5 w-5" />
                  <h3 className="font-bold">Adjust Quantity</h3>
                </div>
                <button onClick={() => setShowQtyAdjust(null)} className="h-8 w-8 rounded-lg bg-white/15 hover:bg-white/25 flex items-center justify-center"><X className="h-4 w-4" /></button>
              </div>
              <div className="p-5">
                <div className="flex items-center gap-3 mb-4 p-3 rounded-lg bg-slate-50">
                  <span className="text-3xl">{showQtyAdjust.emoji}</span>
                  <div>
                    <div className="font-bold text-slate-800">{showQtyAdjust.name}</div>
                    <div className="text-xs text-slate-500 font-mono">{showQtyAdjust.sku} · Current: {showQtyAdjust.stock}</div>
                  </div>
                </div>
                <QuickQtyAdjust
                  product={showQtyAdjust}
                  onConfirm={(newQty, reason) => {
                    const change = newQty - showQtyAdjust.stock;
                    setProducts(prev => prev.map(p => p.id === showQtyAdjust.id ? { ...p, stock: newQty } : p));
                    setHistory(prev => [...prev, {
                      id: `h-${Date.now()}`,
                      productId: showQtyAdjust.id,
                      productName: showQtyAdjust.name,
                      sku: showQtyAdjust.sku,
                      action: 'adjusted',
                      quantityChange: change,
                      newQuantity: newQty,
                      timestamp: new Date().toISOString(),
                      user: "Sarah Johnson",
                      reason: reason || `Qty adjusted to ${newQty}`,
                      reference: `ADJ-${Date.now().toString().slice(-6)}`,
                    }]);
                    toast({ title: "Quantity adjusted", description: `${showQtyAdjust.name}: ${showQtyAdjust.stock} → ${newQty}` });
                    setShowQtyAdjust(null);
                  }}
                  onCancel={() => setShowQtyAdjust(null)}
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Picture Modal */}
      <AnimatePresence>
        {showPicture && (
          <PictureModal
            product={showPicture}
            onSave={(imageData) => {
              setProducts(prev => prev.map(p => p.id === showPicture.id ? { ...p, image: imageData } : p));
              setHistory(prev => [...prev, {
                id: `h-${Date.now()}`,
                productId: showPicture.id,
                productName: showPicture.name,
                sku: showPicture.sku,
                action: 'modified',
                quantityChange: 0,
                newQuantity: showPicture.stock,
                timestamp: new Date().toISOString(),
                user: "Sarah Johnson",
                reason: imageData ? "Product picture updated" : "Product picture removed",
                reference: `PIC-${Date.now().toString().slice(-6)}`,
              }]);
              toast({ title: imageData ? "Picture saved" : "Picture removed", description: showPicture.name });
              setShowPicture(null);
            }}
            onClose={() => setShowPicture(null)}
          />
        )}
      </AnimatePresence>

      {/* Product History Modal */}
      <AnimatePresence>
        {showHistory && (
          <ProductHistoryModal
            product={showHistory}
            history={history.filter(h => h.productId === showHistory.id)}
            onClose={() => setShowHistory(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ===== Stock Search View =====
function StockSearchView({ products, groups, history }: {
  products: Product[];
  groups: StockGroup[];
  history: StockHistoryEntry[];
}) {
  const [searchText, setSearchText] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterGroup, setFilterGroup] = useState("all");
  const [filterGroup1, setFilterGroup1] = useState("all");
  const [filterGroup2, setFilterGroup2] = useState("all");
  const [filterGroup3, setFilterGroup3] = useState("all");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showPicture, setShowPicture] = useState<Product | null>(null);
  const [showHistory, setShowHistory] = useState<Product | null>(null);
  const { toast } = useToast();

  const filtered = products.filter(p => {
    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      if (!p.name.toLowerCase().includes(q) && !p.sku.toLowerCase().includes(q) && !p.barcode.includes(q) && !p.supplier.toLowerCase().includes(q)) return false;
    }
    if (filterType !== "all") {
      if (filterType === "taxable" && !p.taxable) return false;
      if (filterType === "non-taxable" && p.taxable) return false;
      if (filterType === "low-stock" && p.stock > p.reorderLevel) return false;
      if (filterType === "out-of-stock" && p.stock > 0) return false;
    }
    if (filterGroup !== "all" && p.groupId !== filterGroup) return false;
    return true;
  });

  const handleSelect = () => {
    if (!filtered[selectedIndex]) { toast({ title: "No product selected", variant: "destructive" }); return; }
    setSelectedProduct(filtered[selectedIndex]);
  };

  return (
    <div className="h-full overflow-hidden flex flex-col" style={{ backgroundColor: '#E8F5E9' }}>
      {/* Search & Filter Section */}
      <div className="flex-shrink-0 px-4 py-2 space-y-2" style={{ backgroundColor: '#E8F5E9' }}>
        {/* Search Row */}
        <div className="flex items-center gap-3">
          <label className="text-xs font-bold text-slate-700 whitespace-nowrap w-20">Search Text</label>
          <input
            value={searchText}
            onChange={(e) => { setSearchText(e.target.value); setSelectedIndex(0); }}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSelect(); }}
            placeholder="Details"
            className="flex-1 max-w-xs h-8 px-3 rounded border border-slate-400 bg-white text-sm outline-none focus:ring-2 focus:ring-blue-400"
          />
          <button
            onClick={() => setSelectedIndex(0)}
            className="h-8 px-4 rounded border border-slate-400 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold transition"
          >
            Search
          </button>
        </div>
        {/* Filter Row */}
        <div className="flex items-center gap-3 flex-wrap">
          <label className="text-xs font-bold text-slate-700 whitespace-nowrap w-20">Filter By</label>
          <FilterDropdown label="Type" value={filterType} onChange={(v) => { setFilterType(v); setSelectedIndex(0); }} options={[
            { value: "all", label: "All Types" },
            { value: "taxable", label: "Taxable (VAT)" },
            { value: "non-taxable", label: "Non-Taxable" },
            { value: "low-stock", label: "Low Stock" },
            { value: "out-of-stock", label: "Out of Stock" },
          ]} />
          <FilterDropdown label="Stock Group" value={filterGroup} onChange={(v) => { setFilterGroup(v); setSelectedIndex(0); }} options={[
            { value: "all", label: "All Groups" },
            ...groups.map(g => ({ value: g.id, label: `${g.icon} ${g.name}` })),
          ]} />
          <FilterDropdown label="Sub Group" value={filterGroup1} onChange={setFilterGroup1} options={[
            { value: "all", label: "All" },
            { value: "fresh", label: "Fresh Items" },
            { value: "packaged", label: "Packaged" },
            { value: "frozen", label: "Frozen" },
          ]} />
          <FilterDropdown label="Brand" value={filterGroup2} onChange={setFilterGroup2} options={[
            { value: "all", label: "All Brands" },
            { value: "local", label: "Local Brands" },
            { value: "imported", label: "Imported Brands" },
          ]} />
          <FilterDropdown label="Size" value={filterGroup3} onChange={setFilterGroup3} options={[
            { value: "all", label: "All Sizes" },
            { value: "small", label: "Small" },
            { value: "medium", label: "Medium" },
            { value: "large", label: "Large" },
          ]} />
        </div>
      </div>

      {/* Results Table */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0 bg-white border-t border-b border-slate-400">
        <div className="flex-shrink-0 grid grid-cols-[160px_1fr_60px_100px_100px] gap-1 px-3 py-1.5 text-slate-700 text-[11px] font-bold border-b border-slate-400" style={{ backgroundColor: '#F5F5F5' }}>
          <div>Part no</div>
          <div>Details</div>
          <div className="text-right">Qty</div>
          <div className="text-right">Retail GHC</div>
          <div className="text-right">Trade GHC</div>
        </div>
        <ScrollArea className="flex-1 min-h-0">
          <div>
            {filtered.map((p, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={p.id}
                  onClick={() => setSelectedIndex(idx)}
                  onDoubleClick={handleSelect}
                  className="grid grid-cols-[160px_1fr_60px_100px_100px] gap-1 px-3 py-1.5 text-xs cursor-pointer transition border-b border-slate-200"
                  style={{
                    backgroundColor: isSelected ? '#E3F2FD' : (idx % 2 === 1 ? '#FAFAFA' : '#FFFFFF'),
                    color: isSelected ? '#1565C0' : '#424242',
                  }}
                >
                  <div className="font-mono truncate">{p.barcode}</div>
                  <div className="truncate">{p.emoji} {p.name}</div>
                  <div className="text-right font-mono">{p.stock}</div>
                  <div className="text-right font-mono">{p.price.toFixed(2)}</div>
                  <div className="text-right font-mono">{p.costPrice.toFixed(2)}</div>
                </div>
              );
            })}
          </div>
          {filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <Search className="h-10 w-10 mb-2 opacity-40" />
              <div className="text-sm font-medium">No products found</div>
              <div className="text-xs mt-1">Try a different search term or filter</div>
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Action Buttons */}
      <div className="flex-shrink-0 px-4 py-2 flex items-center gap-2 flex-wrap" style={{ backgroundColor: '#E8F5E9' }}>
        <button onClick={handleSelect} className="h-9 px-4 rounded text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-sm" style={{ backgroundColor: '#4CAF50' }}>
          <CheckCircle2 className="h-3.5 w-3.5" /> Select (Enter)
        </button>
        <button onClick={() => toast({ title: "New Product", description: "Use Stock File to add new products" })} className="h-9 px-4 rounded bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition border border-slate-400">
          <Plus className="h-3.5 w-3.5" /> New
        </button>
        <button onClick={() => { if (!filtered[selectedIndex]) { toast({ title: "Select a product first", variant: "destructive" }); return; } setShowPicture(filtered[selectedIndex]); }} className="h-9 px-4 rounded bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition border border-slate-400">
          <ImageIcon className="h-3.5 w-3.5" /> Picture
        </button>
        <button onClick={() => { if (!filtered[selectedIndex]) { toast({ title: "Select a product first", variant: "destructive" }); return; } setShowHistory(filtered[selectedIndex]); }} className="h-9 px-4 rounded bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition border border-slate-400">
          <History className="h-3.5 w-3.5" /> History
        </button>
        <button onClick={() => toast({ title: "Print Labels", description: filtered[selectedIndex] ? `Print labels for ${filtered[selectedIndex].name}` : "Select a product first" })} className="h-9 px-4 rounded bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition border border-slate-400">
          <Tags className="h-3.5 w-3.5" /> Labels
        </button>
        <div className="flex-1" />
        <button onClick={() => {}} className="h-9 px-4 rounded text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-sm" style={{ backgroundColor: '#F44336' }}>
          <X className="h-3.5 w-3.5" /> Close (Esc)
        </button>
      </div>

      {/* Status Bar */}
      <div className="flex-shrink-0 px-4 py-1 flex items-center gap-4 text-[10px] text-slate-600 border-t border-slate-300" style={{ backgroundColor: '#E8F5E9' }}>
        <span>&lt; &gt;</span>
        <span className="font-mono">{filtered.length} of {products.length} products</span>
        <div className="flex-1" />
        <span><kbd className="px-1 bg-white border border-slate-300 rounded mr-1">F9</kbd>Part No.</span>
        <span><kbd className="px-1 bg-white border border-slate-300 rounded mr-1">F10</kbd>Details</span>
        <span><kbd className="px-1 bg-white border border-slate-300 rounded mr-1">Shift+F12</kbd>Print Labels</span>
      </div>

      {/* Product Detail Modal (on Select) */}
      <AnimatePresence>
        {selectedProduct && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedProduct(null)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="px-5 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileSearch className="h-5 w-5" />
                  <h3 className="font-bold">Product Details</h3>
                </div>
                <button onClick={() => setSelectedProduct(null)} className="h-8 w-8 rounded-lg bg-white/15 hover:bg-white/25 flex items-center justify-center"><X className="h-4 w-4" /></button>
              </div>
              <div className="p-5">
                <div className="text-center mb-4">
                  <div className="h-24 w-24 mx-auto rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center text-6xl mb-3">
                    {selectedProduct.emoji}
                  </div>
                  <div className="font-bold text-slate-800 text-lg">{selectedProduct.name}</div>
                  <div className="text-xs text-slate-400 font-mono">{selectedProduct.sku}</div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <DetailRow label="Part No." value={selectedProduct.barcode} />
                  <DetailRow label="Group" value={groups.find(g => g.id === selectedProduct.groupId)?.name || '-'} />
                  <DetailRow label="Retail GHC" value={selectedProduct.price.toFixed(2)} highlight />
                  <DetailRow label="Cost GHC" value={selectedProduct.costPrice.toFixed(2)} />
                  <DetailRow label="Quantity" value={`${selectedProduct.stock} ${selectedProduct.unit}`} />
                  <DetailRow label="Reorder Level" value={String(selectedProduct.reorderLevel)} />
                  <DetailRow label="Supplier" value={selectedProduct.supplier} />
                  <DetailRow label="Batch" value={selectedProduct.batchNumber} />
                  <DetailRow label="Expiry" value={selectedProduct.expiryDate} />
                  <DetailRow label="Taxable" value={selectedProduct.taxable ? "Yes (VAT)" : "No"} />
                </div>
                <button
                  onClick={() => setSelectedProduct(null)}
                  className="w-full mt-4 h-10 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Picture Modal (read-only in Search) */}
      <AnimatePresence>
        {showPicture && (
          <PictureModal
            product={showPicture}
            onSave={() => { setShowPicture(null); }}
            onClose={() => setShowPicture(null)}
          />
        )}
      </AnimatePresence>

      {/* Product History Modal */}
      <AnimatePresence>
        {showHistory && (
          <ProductHistoryModal
            product={showHistory}
            history={history.filter(h => h.productId === showHistory.id)}
            onClose={() => setShowHistory(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ===== Helper: Filter Dropdown =====
function FilterDropdown({ label, value, onChange, options }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] font-bold text-slate-700 uppercase">{label}:</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 px-2 rounded-md bg-white border border-slate-300 text-xs font-medium text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer hover:border-slate-400 transition"
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

// ===== Helper: Stock Action Button =====
function StockActionButton({ icon, label, color, onClick }: {
  icon: React.ReactNode;
  label: string;
  color: "emerald" | "blue" | "cyan" | "slate" | "purple" | "amber" | "indigo" | "rose";
  onClick: () => void;
}) {
  const colors = {
    emerald: "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 ring-emerald-200",
    blue: "bg-blue-100 text-blue-700 hover:bg-blue-200 ring-blue-200",
    cyan: "bg-cyan-100 text-cyan-700 hover:bg-cyan-200 ring-cyan-200",
    slate: "bg-slate-100 text-slate-700 hover:bg-slate-200 ring-slate-200",
    purple: "bg-purple-100 text-purple-700 hover:bg-purple-200 ring-purple-200",
    amber: "bg-amber-100 text-amber-700 hover:bg-amber-200 ring-amber-200",
    indigo: "bg-indigo-100 text-indigo-700 hover:bg-indigo-200 ring-indigo-200",
    rose: "bg-rose-100 text-rose-700 hover:bg-rose-200 ring-rose-200",
  };
  return (
    <button
      onClick={onClick}
      className={cn("h-9 px-3 rounded-lg flex items-center gap-1.5 text-xs font-semibold ring-1 transition", colors[color])}
    >
      {icon}
      {label}
    </button>
  );
}

// ===== Helper: Detail Row =====
function DetailRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between items-center py-1 px-2 rounded bg-slate-50">
      <span className="text-slate-500">{label}</span>
      <span className={cn("font-mono font-semibold", highlight ? "text-blue-600" : "text-slate-800")}>{value}</span>
    </div>
  );
}

// ===== Helper: Quick Quantity Adjust =====
function QuickQtyAdjust({ product, onConfirm, onCancel }: {
  product: Product;
  onConfirm: (newQty: number, reason: string) => void;
  onCancel: () => void;
}) {
  const [mode, setMode] = useState<"add" | "remove" | "set">("add");
  const [amount, setAmount] = useState(0);
  const [reason, setReason] = useState("");

  const newQty = mode === "add" ? product.stock + amount : mode === "remove" ? Math.max(0, product.stock - amount) : amount;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        {[{ id: "add", label: "Add" }, { id: "remove", label: "Remove" }, { id: "set", label: "Set" }].map(m => (
          <button
            key={m.id}
            onClick={() => setMode(m.id as any)}
            className={cn("py-2 rounded-lg text-xs font-bold ring-2 transition",
              mode === m.id ? "ring-indigo-500 bg-indigo-50 text-indigo-700" : "ring-slate-200 text-slate-600 hover:bg-slate-50")}
          >
            {m.label}
          </button>
        ))}
      </div>
      <div>
        <label className="text-xs font-semibold text-slate-600 mb-1 block">Amount</label>
        <input
          type="number"
          value={amount || ""}
          onChange={(e) => setAmount(parseInt(e.target.value) || 0)}
          className="w-full h-10 px-3 rounded-lg border-2 border-slate-200 focus:border-indigo-500 outline-none text-lg font-mono font-bold text-center"
          placeholder="0"
        />
      </div>
      <div>
        <label className="text-xs font-semibold text-slate-600 mb-1 block">Reason (optional)</label>
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="w-full h-10 px-3 rounded-lg border border-slate-200 focus:border-indigo-500 outline-none text-sm"
          placeholder="e.g. Damaged, received, recount"
        />
      </div>
      <div className="p-3 rounded-lg bg-slate-800 text-white flex justify-between items-center">
        <span className="text-xs font-semibold uppercase opacity-80">New Quantity</span>
        <span className="text-2xl font-bold font-mono text-indigo-400">{newQty}</span>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" onClick={onCancel}>Cancel</Button>
        <button
          onClick={() => amount > 0 && onConfirm(newQty, reason)}
          disabled={amount <= 0 && mode !== "set"}
          className="flex-1 h-10 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Confirm
        </button>
      </div>
    </div>
  );
}

// ===== Picture Modal =====
function PictureModal({ product, onSave, onClose }: {
  product: Product;
  onSave: (imageData: string | undefined) => void;
  onClose: () => void;
}) {
  const [imageData, setImageData] = useState<string | undefined>(product.image);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      setImageData(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
      >
        <div className="px-5 py-3 bg-gradient-to-r from-slate-600 to-slate-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5" />
            <h3 className="font-bold">Product Picture</h3>
          </div>
          <button onClick={onClose} className="h-8 w-8 rounded-lg bg-white/15 hover:bg-white/25 flex items-center justify-center"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-5">
          <div className="flex items-center gap-3 mb-4 p-3 rounded-lg bg-slate-50">
            <span className="text-3xl">{product.emoji}</span>
            <div>
              <div className="font-bold text-slate-800">{product.name}</div>
              <div className="text-xs text-slate-500 font-mono">{product.sku}</div>
            </div>
          </div>

          {/* Image Preview / Upload Area */}
          {imageData ? (
            <div className="relative mb-4 group">
              <img src={imageData} alt={product.name} className="w-full h-48 object-contain rounded-xl bg-slate-50 ring-1 ring-slate-200" />
              <button
                onClick={() => setImageData(undefined)}
                className="absolute top-2 right-2 h-8 w-8 rounded-full bg-rose-500 text-white hover:bg-rose-600 flex items-center justify-center transition opacity-0 group-hover:opacity-100"
                title="Remove picture"
              >
                <Trash2 className="h-4 w-4" />
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-2 right-2 h-8 px-3 rounded-lg bg-white/90 text-slate-700 hover:bg-white text-xs font-semibold flex items-center gap-1 transition opacity-0 group-hover:opacity-100"
              >
                <ImageIcon className="h-3.5 w-3.5" />
                Change
              </button>
            </div>
          ) : (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "h-48 rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition mb-4",
                dragOver ? "border-emerald-500 bg-emerald-50" : "border-slate-300 bg-slate-50 hover:border-slate-400 hover:bg-slate-100"
              )}
            >
              <ImageIcon className={cn("h-10 w-10 mb-2 transition", dragOver ? "text-emerald-500" : "text-slate-400")} />
              <div className="text-sm font-semibold text-slate-600">
                {dragOver ? "Drop image here" : "Click to upload or drag & drop"}
              </div>
              <div className="text-xs text-slate-400 mt-1">PNG, JPG, GIF up to 2MB</div>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
            <button
              onClick={() => onSave(imageData)}
              className="flex-1 h-10 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm transition"
            >
              {imageData ? "Save Picture" : "Remove Picture"}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ===== Product History Modal =====
function ProductHistoryModal({ product, history, onClose }: {
  product: Product;
  history: StockHistoryEntry[];
  onClose: () => void;
}) {
  const sortedHistory = [...history].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const actionColors: Record<string, string> = {
    added: "bg-emerald-100 text-emerald-700",
    modified: "bg-blue-100 text-blue-700",
    adjusted: "bg-amber-100 text-amber-700",
    sold: "bg-purple-100 text-purple-700",
    received: "bg-cyan-100 text-cyan-700",
    removed: "bg-rose-100 text-rose-700",
    reordered: "bg-orange-100 text-orange-700",
  };

  const totalIn = history.filter(h => h.quantityChange > 0).reduce((s, h) => s + h.quantityChange, 0);
  const totalOut = history.filter(h => h.quantityChange < 0).reduce((s, h) => s + Math.abs(h.quantityChange), 0);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col"
      >
        <div className="px-5 py-3 bg-gradient-to-r from-purple-600 to-violet-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5" />
            <h3 className="font-bold">Product History</h3>
          </div>
          <button onClick={onClose} className="h-8 w-8 rounded-lg bg-white/15 hover:bg-white/25 flex items-center justify-center"><X className="h-4 w-4" /></button>
        </div>

        {/* Product Info */}
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-3">
          <span className="text-3xl">{product.emoji}</span>
          <div className="flex-1">
            <div className="font-bold text-slate-800">{product.name}</div>
            <div className="text-xs text-slate-500 font-mono">{product.sku} · {product.barcode}</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-slate-500 uppercase">Current Stock</div>
            <div className="text-lg font-bold text-slate-800">{product.stock} {product.unit}</div>
          </div>
        </div>

        {/* Stats */}
        <div className="px-5 py-2.5 bg-white border-b border-slate-200 grid grid-cols-3 gap-2">
          <div className="text-center p-2 rounded-lg bg-emerald-50">
            <div className="text-[10px] text-slate-500 uppercase">Total In</div>
            <div className="text-base font-bold text-emerald-600">+{totalIn}</div>
          </div>
          <div className="text-center p-2 rounded-lg bg-rose-50">
            <div className="text-[10px] text-slate-500 uppercase">Total Out</div>
            <div className="text-base font-bold text-rose-600">-{totalOut}</div>
          </div>
          <div className="text-center p-2 rounded-lg bg-blue-50">
            <div className="text-[10px] text-slate-500 uppercase">Transactions</div>
            <div className="text-base font-bold text-blue-600">{history.length}</div>
          </div>
        </div>

        {/* Timeline */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="p-4 space-y-2">
            {sortedHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                <History className="h-10 w-10 mb-2 opacity-40" />
                <div className="text-sm font-medium">No history yet</div>
                <div className="text-xs mt-1">This product has no recorded movements</div>
              </div>
            ) : (
              sortedHistory.map((h, i) => (
                <motion.div
                  key={h.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: Math.min(i * 0.03, 0.3) }}
                  className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition"
                >
                  <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center text-[10px] font-bold uppercase flex-shrink-0", actionColors[h.action] || "bg-slate-100 text-slate-700")}>
                    {h.action.slice(0, 3)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-slate-800">{h.reason}</div>
                    <div className="text-[11px] text-slate-500">
                      {new Date(h.timestamp).toLocaleString('en-GB')} · {h.user} · Ref: {h.reference}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className={cn("font-mono font-bold text-sm", h.quantityChange > 0 ? "text-emerald-600" : h.quantityChange < 0 ? "text-rose-600" : "text-slate-600")}>
                      {h.quantityChange > 0 ? "+" : ""}{h.quantityChange}
                    </div>
                    <div className="text-[10px] text-slate-400">→ {h.newQuantity}</div>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </ScrollArea>

        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex justify-end">
          <Button variant="outline" onClick={onClose}>Close</Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ===== Stock Quantity Report Modal =====
export function StockQtyReportModal({ products, groups, onClose }: {
  products: Product[];
  groups: StockGroup[];
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [location, setLocation] = useState("all");
  const [fromPartNo, setFromPartNo] = useState("");
  const [toPartNo, setToPartNo] = useState("");
  const [supplier, setSupplier] = useState("all");
  const [sortOrder, setSortOrder] = useState("part-number");
  const [stockGroup, setStockGroup] = useState("all");
  const [group1, setGroup1] = useState("all");
  const [group2, setGroup2] = useState("all");
  const [group3, setGroup3] = useState("all");
  const [reportType, setReportType] = useState("detailed");
  const [consignmentOut, setConsignmentOut] = useState(true);
  const [consignmentIn, setConsignmentIn] = useState(true);
  const [includeZeroQty, setIncludeZeroQty] = useState(false);
  const [includeNegativeQty, setIncludeNegativeQty] = useState(false);
  const [generatedReport, setGeneratedReport] = useState<ReportData | null>(null);

  // Get unique suppliers from products
  const suppliers = Array.from(new Set(products.map(p => p.supplier)));

  // Filter products based on form criteria
  const getFilteredProducts = (): Product[] => {
    let result = products;
    if (fromPartNo.trim()) {
      result = result.filter(p => p.barcode >= fromPartNo || p.sku.toLowerCase() >= fromPartNo.toLowerCase());
    }
    if (toPartNo.trim()) {
      result = result.filter(p => p.barcode <= toPartNo || p.sku.toLowerCase() <= toPartNo.toLowerCase());
    }
    if (supplier !== "all") {
      result = result.filter(p => p.supplier === supplier);
    }
    if (stockGroup !== "all") {
      result = result.filter(p => p.groupId === stockGroup);
    }
    if (!includeZeroQty) {
      result = result.filter(p => p.stock !== 0);
    }
    if (!includeNegativeQty) {
      result = result.filter(p => p.stock >= 0);
    }
    // Sort
    if (sortOrder === "part-number") {
      result = [...result].sort((a, b) => a.barcode.localeCompare(b.barcode));
    } else if (sortOrder === "details") {
      result = [...result].sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortOrder === "qty-ascending") {
      result = [...result].sort((a, b) => a.stock - b.stock);
    } else if (sortOrder === "qty-descending") {
      result = [...result].sort((a, b) => b.stock - a.stock);
    } else if (sortOrder === "retail-price") {
      result = [...result].sort((a, b) => a.price - b.price);
    } else if (sortOrder === "cost-price") {
      result = [...result].sort((a, b) => a.costPrice - b.costPrice);
    }
    return result;
  };

  // Generate the report data based on filters
  const buildReport = (): ReportData => {
    const filtered = getFilteredProducts();
    const isSummary = reportType === "summary";
    return {
      type: "stock-qty-report",
      title: "Stock Quantity Report",
      subtitle: `${reportType === "detailed" ? "Detailed" : "Summary"} report · ${filtered.length} products · ${new Date().toLocaleDateString('en-GB')}`,
      columns: isSummary ? [
        { key: "sku", label: "Part No." },
        { key: "name", label: "Details" },
        { key: "qty", label: "Qty", align: "right" as const },
      ] : [
        { key: "sku", label: "Part No." },
        { key: "name", label: "Details" },
        { key: "group", label: "Stock Group" },
        { key: "supplier", label: "Supplier" },
        { key: "unit", label: "Unit", align: "center" as const },
        { key: "qty", label: "Qty", align: "right" as const },
        { key: "reorderLevel", label: "Reorder Level", align: "right" as const },
        { key: "retail", label: "Retail GHC", align: "right" as const },
        { key: "cost", label: "Cost GHC", align: "right" as const },
        { key: "status", label: "Status", align: "center" as const },
      ],
      rows: filtered.map(p => isSummary ? {
        sku: p.barcode, name: `${p.emoji} ${p.name}`, qty: p.stock,
      } : {
        sku: p.barcode,
        name: `${p.emoji} ${p.name}`,
        group: groups.find(g => g.id === p.groupId)?.name || "-",
        supplier: p.supplier,
        unit: p.unit,
        qty: p.stock,
        reorderLevel: p.reorderLevel,
        retail: p.price.toFixed(2),
        cost: p.costPrice.toFixed(2),
        status: p.stock === 0 ? "OUT OF STOCK" : p.stock <= p.reorderLevel ? "LOW STOCK" : "OK",
      }),
      summary: [
        { label: "Total Products", value: String(filtered.length) },
        { label: "Total Quantity", value: String(filtered.reduce((s, p) => s + p.stock, 0)) },
        { label: "Total Retail Value", value: formatGHS(filtered.reduce((s, p) => s + p.price * p.stock, 0)) },
        { label: "Total Cost Value", value: formatGHS(filtered.reduce((s, p) => s + p.costPrice * p.stock, 0)) },
        { label: "Low Stock Items", value: String(filtered.filter(p => p.stock > 0 && p.stock <= p.reorderLevel).length) },
        { label: "Out of Stock", value: String(filtered.filter(p => p.stock === 0).length) },
      ],
    };
  };

  const handleScreen = () => {
    const report = buildReport();
    setGeneratedReport(report);
    toast({ title: "Report generated", description: `${report.rows.length} records on screen` });
  };

  const handlePrinter = () => {
    const report = buildReport();
    printReport(report);
    toast({ title: "Printing report (F3)", description: `${report.rows.length} records` });
  };

  const handleFile = () => {
    const report = buildReport();
    // Export to Excel by default
    exportReportToExcel(report);
    toast({ title: "Report exported", description: "Saved as Excel file" });
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.95, y: 20 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-hidden flex flex-col"
          style={{ backgroundColor: '#C8E6D0' }}
        >
          {/* Header - Windows-style title bar */}
          <div className="flex-shrink-0 flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-blue-600 to-blue-500 text-white">
            <div className="flex items-center gap-2">
              <FileBarChart className="h-5 w-5" />
              <h3 className="font-bold text-base">Stock Qty Report</h3>
            </div>
            <div className="flex items-center gap-1">
              <button className="h-6 w-6 rounded bg-white/15 hover:bg-white/25 flex items-center justify-center text-xs">─</button>
              <button className="h-6 w-6 rounded bg-white/15 hover:bg-white/25 flex items-center justify-center text-xs">□</button>
              <button onClick={onClose} className="h-6 w-6 rounded bg-white/15 hover:bg-rose-500 flex items-center justify-center transition">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Form Content */}
          <div className="flex-1 overflow-y-auto p-6" style={{ backgroundColor: '#C8E6D0' }}>
            <div className="bg-white/40 rounded-lg p-5 ring-1 ring-emerald-200/50 space-y-3">
              {/* Location */}
              <FormRow label="Location">
                <select value={location} onChange={(e) => setLocation(e.target.value)} className="qty-form-input">
                  <option value="all">All Locations</option>
                  <option value="main-store">Main Store</option>
                  <option value="warehouse">Warehouse</option>
                  <option value="shop-floor">Shop Floor</option>
                </select>
              </FormRow>

              {/* From / To Part No. */}
              <div className="grid grid-cols-2 gap-4">
                <FormRow label="From Part No.">
                  <input value={fromPartNo} onChange={(e) => setFromPartNo(e.target.value)} placeholder="e.g. 941563812092" className="qty-form-input" />
                </FormRow>
                <FormRow label="To Part No.">
                  <input value={toPartNo} onChange={(e) => setToPartNo(e.target.value)} placeholder="e.g. 941563812181" className="qty-form-input" />
                </FormRow>
              </div>

              {/* Supplier */}
              <FormRow label="Supplier">
                <select value={supplier} onChange={(e) => setSupplier(e.target.value)} className="qty-form-input">
                  <option value="all">All Suppliers</option>
                  {suppliers.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </FormRow>

              {/* Sort Order */}
              <FormRow label="Sort Order">
                <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} className="qty-form-input">
                  <option value="part-number">Part Number</option>
                  <option value="details">Details (Name)</option>
                  <option value="qty-ascending">Quantity (Ascending)</option>
                  <option value="qty-descending">Quantity (Descending)</option>
                  <option value="retail-price">Retail Price</option>
                  <option value="cost-price">Cost Price</option>
                </select>
              </FormRow>

              {/* Stock Group */}
              <FormRow label="Stock Group">
                <select value={stockGroup} onChange={(e) => setStockGroup(e.target.value)} className="qty-form-input">
                  <option value="all">All Groups</option>
                  {groups.map(g => <option key={g.id} value={g.id}>{g.icon} {g.name}</option>)}
                </select>
              </FormRow>

              {/* Group 1 / 2 / 3 */}
              <div className="grid grid-cols-3 gap-3">
                <FormRow label="Group1">
                  <select value={group1} onChange={(e) => setGroup1(e.target.value)} className="qty-form-input">
                    <option value="all">All</option>
                    <option value="fresh">Fresh Items</option>
                    <option value="packaged">Packaged</option>
                    <option value="frozen">Frozen</option>
                  </select>
                </FormRow>
                <FormRow label="Group2">
                  <select value={group2} onChange={(e) => setGroup2(e.target.value)} className="qty-form-input">
                    <option value="all">All</option>
                    <option value="fast-moving">Fast Moving</option>
                    <option value="slow-moving">Slow Moving</option>
                  </select>
                </FormRow>
                <FormRow label="Group3">
                  <select value={group3} onChange={(e) => setGroup3(e.target.value)} className="qty-form-input">
                    <option value="all">All</option>
                    <option value="high-value">High Value</option>
                    <option value="low-value">Low Value</option>
                  </select>
                </FormRow>
              </div>

              {/* Report Type */}
              <FormRow label="Report Type">
                <select value={reportType} onChange={(e) => setReportType(e.target.value)} className="qty-form-input">
                  <option value="detailed">Detailed</option>
                  <option value="summary">Summary</option>
                </select>
              </FormRow>

              {/* Checkboxes */}
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-emerald-200/50 mt-3">
                <CheckboxRow label="Consignment Out" checked={consignmentOut} onChange={setConsignmentOut} />
                <CheckboxRow label="Consignment In" checked={consignmentIn} onChange={setConsignmentIn} />
                <CheckboxRow label="Include Zero Qty" checked={includeZeroQty} onChange={setIncludeZeroQty} />
                <CheckboxRow label="Include -ve Qty" checked={includeNegativeQty} onChange={setIncludeNegativeQty} />
              </div>
            </div>
          </div>

          {/* Button Bar */}
          <div className="flex-shrink-0 px-6 py-3 flex items-center justify-center gap-3 border-t border-emerald-300/50" style={{ backgroundColor: '#B8DCC0' }}>
            <QtyActionButton icon={<Monitor className="h-5 w-5" />} label="Screen" color="blue" onClick={handleScreen} />
            <QtyActionButton icon={<Printer className="h-5 w-5" />} label="Printer" sub="F3" color="blue" onClick={handlePrinter} />
            <QtyActionButton icon={<Folder className="h-5 w-5" />} label="File" color="blue" onClick={handleFile} />
            <QtyActionButton icon={<X className="h-5 w-5" />} label="Close" sub="Esc" color="rose" onClick={onClose} />
          </div>
        </motion.div>
      </motion.div>

      {/* Generated Report Viewer */}
      <AnimatePresence>
        {generatedReport && (
          <QtyReportViewer report={generatedReport} onClose={() => setGeneratedReport(null)} />
        )}
      </AnimatePresence>

      <style jsx>{`
        :global(.qty-form-input) {
          width: 100%;
          height: 2.25rem;
          padding: 0 0.625rem;
          border-radius: 0.375rem;
          border: 1px solid rgb(148 163 184);
          background: white;
          font-size: 0.8125rem;
          color: rgb(30 41 59);
          outline: none;
          transition: all 0.15s;
        }
        :global(.qty-form-input:focus) {
          border-color: rgb(37 99 235);
          box-shadow: 0 0 0 2px rgb(37 99 235 / 0.2);
        }
      `}</style>
    </>
  );
}

// ===== Helper: Form Row =====
function FormRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <label className="text-xs font-semibold text-slate-700 w-28 flex-shrink-0 text-right">{label}:</label>
      <div className="flex-1">{children}</div>
    </div>
  );
}

// ===== Helper: Checkbox Row =====
function CheckboxRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-slate-400 accent-blue-600"
      />
      {label}
    </label>
  );
}

// ===== Helper: Qty Action Button =====
function QtyActionButton({ icon, label, sub, color, onClick }: {
  icon: React.ReactNode;
  label: string;
  sub?: string;
  color: "blue" | "rose";
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1 px-6 py-2.5 rounded-lg bg-white border-2 transition shadow-sm hover:shadow-md",
        color === "blue" ? "border-blue-300 text-blue-700 hover:bg-blue-50 hover:border-blue-500" : "border-rose-300 text-rose-700 hover:bg-rose-50 hover:border-rose-500"
      )}
    >
      {icon}
      <span className="text-xs font-bold flex items-center gap-1">
        {label}
        {sub && <kbd className="text-[9px] font-mono bg-slate-100 px-1 rounded">{sub}</kbd>}
      </span>
    </button>
  );
}

// ===== Qty Report Viewer (Screen output) =====
function QtyReportViewer({ report, onClose }: { report: ReportData; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] overflow-hidden flex flex-col"
      >
        {/* Company Header */}
        <div className="flex-shrink-0 px-6 py-3 bg-gradient-to-r from-emerald-700 to-emerald-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-white/15 flex items-center justify-center font-bold text-lg">S</div>
            <div>
              <div className="font-bold text-base">{COMPANY.name}</div>
              <div className="text-xs text-emerald-100/90">{COMPANY.address} · {COMPANY.contact}</div>
            </div>
          </div>
          <button onClick={onClose} className="h-8 w-8 rounded-lg bg-white/15 hover:bg-white/25 flex items-center justify-center">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Report Title */}
        <div className="flex-shrink-0 px-6 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div>
            <div className="font-bold text-slate-800">{report.title}</div>
            <div className="text-xs text-slate-500">{report.subtitle}</div>
          </div>
          <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">{report.rows.length} records</Badge>
        </div>

        {/* Table */}
        <ScrollArea className="flex-1 min-h-0">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-slate-700 text-white text-[10px] uppercase tracking-wide z-10">
              <tr>
                {report.columns.map(col => (
                  <th key={col.key} className={cn("px-3 py-2 font-bold", col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left")}>
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {report.rows.map((row, i) => (
                <tr key={i} className={cn("hover:bg-emerald-50/50", i % 2 === 1 && "bg-slate-50")}>
                  {report.columns.map(col => {
                    const val = row[col.key];
                    const display = col.format ? col.format(val, row) : (val ?? "");
                    return (
                      <td key={col.key} className={cn("px-3 py-1.5", col.align === "right" ? "text-right font-mono" : col.align === "center" ? "text-center" : "text-left")}>
                        {display}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollArea>

        {/* Summary */}
        <div className="flex-shrink-0 px-6 py-3 bg-gradient-to-r from-emerald-50 to-teal-50 border-t border-emerald-200">
          <div className="grid grid-cols-6 gap-2">
            {report.summary.map((s, i) => (
              <div key={i} className="bg-white rounded-lg px-2.5 py-1.5 ring-1 ring-emerald-100 text-center">
                <div className="text-[9px] text-slate-500 uppercase">{s.label}</div>
                <div className="text-xs font-bold text-emerald-700 font-mono">{s.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Export Buttons */}
        <div className="flex-shrink-0 px-6 py-2.5 bg-white border-t border-slate-200 flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500 uppercase mr-2">Export:</span>
          <button onClick={() => printReport(report)} className="h-8 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1.5">
            <Printer className="h-3.5 w-3.5" /> Print
          </button>
          <button onClick={() => exportReportToPDF(report)} className="h-8 px-3 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5" /> PDF
          </button>
          <button onClick={() => exportReportToExcel(report)} className="h-8 px-3 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-700 text-xs font-semibold flex items-center gap-1.5">
            <Folder className="h-3.5 w-3.5" /> Excel
          </button>
          <button onClick={() => exportReportToCSV(report)} className="h-8 px-3 rounded-lg bg-blue-100 hover:bg-blue-200 text-blue-700 text-xs font-semibold flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5" /> CSV
          </button>
          <div className="flex-1" />
          <button onClick={onClose} className="h-8 px-4 rounded-lg bg-slate-700 hover:bg-slate-800 text-white text-xs font-semibold">
            Close
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
