"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Package, Plus, Edit2, Trash2, Search, Layers, Settings2, History,
  ArrowLeft, Save, X, TrendingUp, AlertTriangle, CheckCircle2, Boxes,
  Filter, ChevronRight, Calendar, User, Tag, DollarSign, Barcode,
  ArrowUpDown, ArrowUp, ArrowDown, RotateCcw
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
import type { StockView } from "@/lib/pos-types";

interface StockManagementProps {
  onBack: () => void;
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  groups: StockGroup[];
  setGroups: React.Dispatch<React.SetStateAction<StockGroup[]>>;
  history: StockHistoryEntry[];
  setHistory: React.Dispatch<React.SetStateAction<StockHistoryEntry[]>>;
}

export function StockManagement({ onBack, products, setProducts, groups, setGroups, history, setHistory }: StockManagementProps) {
  const [view, setView] = useState<StockView>("add-modify");
  const { toast } = useToast();

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
            { id: "add-modify" as const, label: "Add / Modify Stock", icon: Plus },
            { id: "group-maintenance" as const, label: "Group Maintenance", icon: Layers },
            { id: "quantity-adjustment" as const, label: "Quantity Adjustment", icon: ArrowUpDown },
            { id: "history" as const, label: "Stock History", icon: History },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setView(tab.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all",
                view === tab.id
                  ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md"
                  : "text-slate-600 hover:bg-slate-100"
              )}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
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
            {view === "quantity-adjustment" && <QuantityAdjustment products={products} setProducts={setProducts} setHistory={setHistory} />}
            {view === "history" && <StockHistoryView history={history} products={products} />}
          </motion.div>
        </AnimatePresence>
      </main>
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
function QuantityAdjustment({ products, setProducts, setHistory }: {
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  setHistory: React.Dispatch<React.SetStateAction<StockHistoryEntry[]>>;
}) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Product | null>(null);
  const [adjustType, setAdjustType] = useState<"add" | "remove" | "set">("add");
  const [amount, setAmount] = useState(0);
  const [reason, setReason] = useState("");
  const { toast } = useToast();

  const filtered = products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase()));

  const handleAdjust = () => {
    if (!selected || amount <= 0) {
      toast({ title: "Select product and enter amount", variant: "destructive" });
      return;
    }
    let newQty = selected.stock;
    let change = 0;
    if (adjustType === "add") { newQty = selected.stock + amount; change = amount; }
    else if (adjustType === "remove") { newQty = Math.max(0, selected.stock - amount); change = -amount; }
    else { newQty = amount; change = amount - selected.stock; }

    setProducts(prev => prev.map(p => p.id === selected.id ? { ...p, stock: newQty } : p));
    setHistory(prev => [...prev, {
      id: `h-${Date.now()}`,
      productId: selected.id,
      productName: selected.name,
      sku: selected.sku,
      action: 'adjusted',
      quantityChange: change,
      newQuantity: newQty,
      timestamp: new Date().toISOString(),
      user: "Sarah Johnson",
      reason: reason || `Quantity ${adjustType === "set" ? "set to" : adjustType + "ed"} ${amount}`,
      reference: `ADJ-${Date.now().toString().slice(-6)}`,
    }]);
    toast({ title: "Quantity adjusted", description: `${selected.name}: ${selected.stock} → ${newQty}` });
    setSelected(null); setAmount(0); setReason("");
  };

  return (
    <div className="h-full grid grid-cols-2 gap-4">
      {/* Left: Product List */}
      <div className="bg-white rounded-2xl shadow-lg ring-1 ring-slate-200/60 overflow-hidden flex flex-col">
        <div className="flex-shrink-0 flex items-center justify-between px-5 py-3 bg-gradient-to-r from-slate-50 to-white border-b border-slate-200">
          <div className="flex items-center gap-3">
            <ArrowUpDown className="h-5 w-5 text-emerald-600" />
            <h2 className="text-base font-bold text-slate-800">Select Product</h2>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." className="h-9 pl-8 pr-3 rounded-lg bg-slate-100 text-sm outline-none focus:ring-2 focus:ring-emerald-300 w-48" />
          </div>
        </div>
        <ScrollArea className="flex-1">
          <div className="divide-y divide-slate-100">
            {filtered.map(p => (
              <button
                key={p.id}
                onClick={() => setSelected(p)}
                className={cn("w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-emerald-50/50 transition", selected?.id === p.id && "bg-emerald-50 ring-1 ring-emerald-300")}
              >
                <span className="text-2xl">{p.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-slate-800 text-sm truncate">{p.name}</div>
                  <div className="text-[10px] text-slate-400 font-mono">{p.sku} · Stock: {p.stock}</div>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-300" />
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Right: Adjustment Form */}
      <div className="bg-white rounded-2xl shadow-lg ring-1 ring-slate-200/60 overflow-hidden flex flex-col">
        <div className="flex-shrink-0 flex items-center gap-3 px-5 py-3 bg-gradient-to-r from-slate-50 to-white border-b border-slate-200">
          <Settings2 className="h-5 w-5 text-emerald-600" />
          <h2 className="text-base font-bold text-slate-800">Adjust Quantity</h2>
        </div>
        <div className="flex-1 p-6 overflow-y-auto">
          {selected ? (
            <div className="space-y-5">
              {/* Selected Product */}
              <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 ring-1 ring-emerald-200">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-4xl">{selected.emoji}</span>
                  <div>
                    <div className="font-bold text-slate-800 text-lg">{selected.name}</div>
                    <div className="text-xs text-slate-500 font-mono">{selected.sku} · {selected.barcode}</div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-3">
                  <div className="bg-white rounded-lg p-2 text-center">
                    <div className="text-[10px] text-slate-500 uppercase">Current Qty</div>
                    <div className="text-lg font-bold text-slate-800 font-mono">{selected.stock}</div>
                  </div>
                  <div className="bg-white rounded-lg p-2 text-center">
                    <div className="text-[10px] text-slate-500 uppercase">Reorder Lvl</div>
                    <div className="text-lg font-bold text-slate-800 font-mono">{selected.reorderLevel}</div>
                  </div>
                  <div className="bg-white rounded-lg p-2 text-center">
                    <div className="text-[10px] text-slate-500 uppercase">Unit</div>
                    <div className="text-lg font-bold text-slate-800">{selected.unit}</div>
                  </div>
                </div>
              </div>

              {/* Adjustment Type */}
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-2 block">Adjustment Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "add" as const, label: "Add Stock", icon: ArrowUp, color: "emerald" },
                    { id: "remove" as const, label: "Remove Stock", icon: ArrowDown, color: "rose" },
                    { id: "set" as const, label: "Set Quantity", icon: RotateCcw, color: "blue" },
                  ].map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => setAdjustType(opt.id)}
                      className={cn("flex flex-col items-center gap-1 py-3 rounded-lg ring-2 transition",
                        adjustType === opt.id ? `ring-${opt.color}-500 bg-${opt.color}-50` : "ring-slate-200 hover:ring-slate-300")}
                      style={adjustType === opt.id ? { background: opt.color === 'emerald' ? '#ecfdf5' : opt.color === 'rose' ? '#fff1f2' : '#eff6ff', borderColor: opt.color === 'emerald' ? '#10b981' : opt.color === 'rose' ? '#f43f5e' : '#3b82f6' } : {}}
                    >
                      <opt.icon className="h-5 w-5" style={{ color: adjustType === opt.id ? (opt.color === 'emerald' ? '#10b981' : opt.color === 'rose' ? '#f43f5e' : '#3b82f6') : '#64748b' }} />
                      <span className="text-[11px] font-semibold">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Amount */}
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">Amount</label>
                <input type="number" value={amount || ""} onChange={(e) => setAmount(parseInt(e.target.value) || 0)} className="w-full h-12 px-4 rounded-lg border-2 border-slate-200 focus:border-emerald-500 outline-none text-xl font-mono font-bold text-right" placeholder="0" />
              </div>

              {/* Reason */}
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">Reason (optional)</label>
                <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-emerald-500 outline-none text-sm" placeholder="e.g. Damaged goods, stock received, recount..." />
              </div>

              {/* Preview */}
              {amount > 0 && (
                <div className="p-3 rounded-lg bg-slate-800 text-white flex justify-between items-center">
                  <span className="text-xs font-semibold uppercase opacity-80">New Quantity</span>
                  <span className="text-2xl font-bold font-mono text-emerald-400">
                    {adjustType === "add" ? selected.stock + amount : adjustType === "remove" ? Math.max(0, selected.stock - amount) : amount}
                  </span>
                </div>
              )}

              <Button onClick={handleAdjust} className="w-full h-12 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-base font-bold">
                <CheckCircle2 className="h-5 w-5" />
                Confirm Adjustment
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-400">
              <ArrowUpDown className="h-12 w-12 mb-3 opacity-40" />
              <div className="text-sm font-medium">Select a product to adjust</div>
              <div className="text-xs mt-1">Choose from the list on the left</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ===== Stock History =====
function StockHistoryView({ history, products }: { history: StockHistoryEntry[]; products: Product[] }) {
  const [filter, setFilter] = useState<string>("all");
  const filtered = filter === "all" ? history : history.filter(h => h.action === filter);

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
          <Badge variant="outline" className="font-mono text-xs">{history.length} entries</Badge>
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

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-2">
          {filtered.slice().reverse().map((h, i) => (
            <motion.div
              key={h.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: Math.min(i * 0.02, 0.3) }}
              className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition"
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
                <div className="text-[10px] font-mono text-slate-600">{h.reference}</div>
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
              <div className="text-sm font-medium">No history entries</div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
