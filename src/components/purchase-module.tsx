"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Package, Truck, Users, History, DollarSign, Plus, X, Save,
  Archive, ShoppingCart, CheckCircle2, Clock, Phone, MapPin, Search,
  TrendingUp, Filter, ChevronRight, Edit2, Trash2, Eye,
  FileBarChart2, Calendar, Printer, Download, FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { COMPANY, CURRENCY, formatGHS, type Product } from "@/lib/pos-data";

type PurchaseTab = "orders" | "receive" | "suppliers" | "history" | "payments" | "report";

interface PurchaseTransaction {
  id: string;
  date: string; // ISO date (YYYY-MM-DD)
  qty: number;
  tax: number;
  amount: number;
  paid: number;
  due: number;
  supplier: string;
  invoiceNo: string;
}

// Sample purchase transactions spanning Jan-Mar 2026
const initialTransactions: PurchaseTransaction[] = [
  { id: "t1", date: "2026-01-02", qty: 1, tax: 0, amount: 540.00, paid: 540.00, due: 0, supplier: "AgriCorp Ghana", invoiceNo: "INV-001" },
  { id: "t2", date: "2026-01-06", qty: 1, tax: 0, amount: 2436.00, paid: 2436.00, due: 0, supplier: "Global Foods GH", invoiceNo: "INV-002" },
  { id: "t3", date: "2026-01-08", qty: 3, tax: 0, amount: 17415.00, paid: 16965.00, due: 450.00, supplier: "Fan Milk Ghana", invoiceNo: "INV-003" },
  { id: "t4", date: "2026-01-09", qty: 1, tax: 0, amount: 210.00, paid: 0, due: 210.00, supplier: "Darko Farms", invoiceNo: "INV-004" },
  { id: "t5", date: "2026-01-12", qty: 2, tax: 0, amount: 1988.60, paid: 420.00, due: 1568.60, supplier: "Global Foods GH", invoiceNo: "INV-005" },
  { id: "t6", date: "2026-01-13", qty: 1, tax: 0, amount: 100.00, paid: 0, due: 100.00, supplier: "AgriCorp Ghana", invoiceNo: "INV-006" },
  { id: "t7", date: "2026-01-14", qty: 1, tax: 0, amount: 24500.00, paid: 24500.00, due: 0, supplier: "Unilever Ghana", invoiceNo: "INV-007" },
  { id: "t8", date: "2026-01-19", qty: 1, tax: 0, amount: 2300.00, paid: 0, due: 2300.00, supplier: "Global Foods GH", invoiceNo: "INV-008" },
  { id: "t9", date: "2026-01-20", qty: 3, tax: 0, amount: 642.40, paid: 0, due: 642.40, supplier: "Darko Farms", invoiceNo: "INV-009" },
  { id: "t10", date: "2026-01-22", qty: 2, tax: 0, amount: 3295.80, paid: 0, due: 3295.80, supplier: "AgriCorp Ghana", invoiceNo: "INV-010" },
  { id: "t11", date: "2026-01-27", qty: 5, tax: 0, amount: 12519.10, paid: 11723.10, due: 796.00, supplier: "Fan Milk Ghana", invoiceNo: "INV-011" },
  { id: "t12", date: "2026-01-28", qty: 2, tax: 275.68, amount: 1654.08, paid: 1555.20, due: 98.88, supplier: "Global Foods GH", invoiceNo: "INV-012" },
  { id: "t13", date: "2026-01-29", qty: 1, tax: 340.32, amount: 2041.92, paid: 0, due: 2041.92, supplier: "Unilever Ghana", invoiceNo: "INV-013" },
  { id: "t14", date: "2026-01-30", qty: 2, tax: 0, amount: 2598.00, paid: 1128.00, due: 1470.00, supplier: "AgriCorp Ghana", invoiceNo: "INV-014" },
  { id: "t15", date: "2026-02-02", qty: 1, tax: 0, amount: 100.00, paid: 0, due: 100.00, supplier: "Darko Farms", invoiceNo: "INV-015" },
  { id: "t16", date: "2026-02-03", qty: 2, tax: 0, amount: 1710.00, paid: 0, due: 1710.00, supplier: "Global Foods GH", invoiceNo: "INV-016" },
  { id: "t17", date: "2026-02-09", qty: 2, tax: 773.15, amount: 4638.90, paid: 240.00, due: 4398.90, supplier: "Fan Milk Ghana", invoiceNo: "INV-017" },
  { id: "t18", date: "2026-02-10", qty: 1, tax: 0, amount: 2268.00, paid: 0, due: 2268.00, supplier: "Unilever Ghana", invoiceNo: "INV-018" },
  { id: "t19", date: "2026-02-11", qty: 1, tax: 0, amount: 3470.00, paid: 3470.00, due: 0, supplier: "Global Foods GH", invoiceNo: "INV-019" },
  { id: "t20", date: "2026-02-16", qty: 3, tax: 29.00, amount: 531.00, paid: 0, due: 531.00, supplier: "AgriCorp Ghana", invoiceNo: "INV-020" },
  { id: "t21", date: "2026-02-23", qty: 2, tax: 654.81, amount: 4028.86, paid: 3928.86, due: 100.00, supplier: "Darko Farms", invoiceNo: "INV-021" },
  { id: "t22", date: "2026-02-24", qty: 1, tax: 0, amount: 11520.00, paid: 0, due: 11520.00, supplier: "Unilever Ghana", invoiceNo: "INV-022" },
  { id: "t23", date: "2026-02-25", qty: 3, tax: 555.83, amount: 4015.00, paid: 0, due: 4015.00, supplier: "Global Foods GH", invoiceNo: "INV-023" },
  { id: "t24", date: "2026-02-26", qty: 1, tax: 32.00, amount: 192.00, paid: 0, due: 192.00, supplier: "Fan Milk Ghana", invoiceNo: "INV-024" },
  { id: "t25", date: "2026-02-27", qty: 3, tax: 139.17, amount: 1075.00, paid: 0, due: 1075.00, supplier: "AgriCorp Ghana", invoiceNo: "INV-025" },
  { id: "t26", date: "2026-02-28", qty: 2, tax: 92.43, amount: 654.58, paid: 0, due: 654.58, supplier: "Darko Farms", invoiceNo: "INV-026" },
  { id: "t27", date: "2026-03-02", qty: 1, tax: 382.10, amount: 2292.60, paid: 0, due: 2292.60, supplier: "Global Foods GH", invoiceNo: "INV-027" },
  { id: "t28", date: "2026-03-04", qty: 3, tax: 0, amount: 17956.84, paid: 15736.84, due: 2220.00, supplier: "Unilever Ghana", invoiceNo: "INV-028" },
  { id: "t29", date: "2026-03-05", qty: 1, tax: 86.80, amount: 520.80, paid: 0, due: 520.80, supplier: "Fan Milk Ghana", invoiceNo: "INV-029" },
  { id: "t30", date: "2026-03-07", qty: 1, tax: 0, amount: 240.00, paid: 0, due: 240.00, supplier: "AgriCorp Ghana", invoiceNo: "INV-030" },
  { id: "t31", date: "2026-03-10", qty: 1, tax: 0, amount: 100.00, paid: 0, due: 100.00, supplier: "Global Foods GH", invoiceNo: "INV-031" },
];

interface PurchaseOrder {
  id: string;
  poNumber: string;
  supplier: string;
  date: string;
  expectedDate: string;
  status: "draft" | "sent" | "partial" | "received" | "cancelled";
  items: { productId: string; name: string; qty: number; cost: number; received: number }[];
  total: number;
}

interface Supplier {
  id: string;
  name: string;
  contact: string;
  email: string;
  address: string;
  balance: number;
  productsSupplied: number;
}

const initialSuppliers: Supplier[] = [
  { id: "s1", name: "AgriCorp Ghana", contact: "+233 24 111 2222", email: "sales@agricorp.gh", address: "Kumasi, Ashanti Region", balance: 1250.00, productsSupplied: 8 },
  { id: "s2", name: "Fan Milk Ghana", contact: "+233 24 333 4444", email: "orders@fanmilk.gh", address: "Tema, Greater Accra", balance: 850.50, productsSupplied: 4 },
  { id: "s3", name: "Darko Farms", contact: "+233 24 555 6666", email: "info@darkofarms.gh", address: "Dodowa, Eastern Region", balance: 0, productsSupplied: 3 },
  { id: "s4", name: "Global Foods GH", contact: "+233 24 777 8888", email: "sales@globalfoods.gh", address: "Tema Industrial Area, Accra", balance: 3200.00, productsSupplied: 15 },
  { id: "s5", name: "Unilever Ghana", contact: "+233 24 999 0000", email: "orders@unilever.gh", address: "Spintex Road, Accra", balance: 1800.75, productsSupplied: 6 },
];

const initialOrders: PurchaseOrder[] = [
  {
    id: "po1", poNumber: "PO-2026-001", supplier: "AgriCorp Ghana", date: "2026-07-01", expectedDate: "2026-07-08",
    status: "received", total: 1250.00,
    items: [
      { productId: "p1", name: "Red Apples", qty: 50, cost: 24.00, received: 50 },
      { productId: "p2", name: "Bananas", qty: 30, cost: 11.00, received: 30 },
    ],
  },
  {
    id: "po2", poNumber: "PO-2026-002", supplier: "Global Foods GH", date: "2026-07-03", expectedDate: "2026-07-10",
    status: "partial", total: 3200.00,
    items: [
      { productId: "p73", name: "Rice 5kg", qty: 40, cost: 72.00, received: 40 },
      { productId: "p74", name: "Pasta 500g", qty: 100, cost: 11.00, received: 50 },
    ],
  },
  {
    id: "po3", poNumber: "PO-2026-003", supplier: "Fan Milk Ghana", date: "2026-07-05", expectedDate: "2026-07-07",
    status: "sent", total: 850.50,
    items: [
      { productId: "p25", name: "Whole Milk 1L", qty: 100, cost: 13.00, received: 0 },
    ],
  },
];

interface PurchaseProps {
  onBack: () => void;
  products: Product[];
}

export function PurchaseModule({ onBack, products }: PurchaseProps) {
  const [tab, setTab] = useState<PurchaseTab>("orders");
  const [suppliers, setSuppliers] = useState<Supplier[]>(initialSuppliers);
  const [orders, setOrders] = useState<PurchaseOrder[]>(initialOrders);
  const [transactions] = useState<PurchaseTransaction[]>(initialTransactions);
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [showNewSupplier, setShowNewSupplier] = useState(false);
  const [viewOrder, setViewOrder] = useState<PurchaseOrder | null>(null);

  const tabs = [
    { id: "orders" as const, label: "Purchase Orders", icon: Archive },
    { id: "receive" as const, label: "Receive Stock", icon: Package },
    { id: "suppliers" as const, label: "Suppliers", icon: Users },
    { id: "history" as const, label: "Purchase History", icon: History },
    { id: "payments" as const, label: "Supplier Payments", icon: DollarSign },
    { id: "report" as const, label: "Purchase Report", icon: FileBarChart2 },
  ];

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-slate-50 to-amber-50/30">
      {/* Header */}
      <header className="flex-shrink-0 bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 text-white shadow-lg">
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="h-9 w-9 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center ring-1 ring-white/20">
                <Truck className="h-5 w-5" />
              </div>
              <div>
                <div className="font-bold text-base leading-tight">Purchase Management</div>
                <div className="text-[10px] text-amber-100/90">{COMPANY.name}</div>
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-amber-100/80">{COMPANY.address}</div>
            <div className="text-xs font-mono text-amber-100">{COMPANY.contact}</div>
          </div>
        </div>
      </header>

      {/* Sub Navigation */}
      <nav className="flex-shrink-0 bg-white border-b border-slate-200 shadow-sm">
        <div className="flex items-center gap-1 px-6 py-2">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all",
                tab === t.id ? "bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-md" : "text-slate-600 hover:bg-slate-100"
              )}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Content */}
      <main className="flex-1 overflow-hidden p-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="h-full"
          >
            {tab === "orders" && <PurchaseOrders orders={orders} setOrders={setOrders} suppliers={suppliers} />}
            {tab === "receive" && <ReceiveStock orders={orders} setOrders={setOrders} products={products} />}
            {tab === "suppliers" && <Suppliers suppliers={suppliers} setSuppliers={setSuppliers} products={products} />}
            {tab === "history" && <PurchaseHistory orders={orders} onView={setViewOrder} />}
            {tab === "payments" && <SupplierPayments suppliers={suppliers} onPay={(id, amount) => {
              setSuppliers(prev => prev.map(s => s.id === id ? { ...s, balance: Math.max(0, s.balance - amount) } : s));
            }} />}
            {tab === "report" && <PurchaseReport transactions={transactions} />}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Modals would go here - simplified for now */}
    </div>
  );
}

// ===== Purchase Orders Tab =====
function PurchaseOrders({ orders, setOrders, suppliers }: {
  orders: PurchaseOrder[];
  setOrders: React.Dispatch<React.SetStateAction<PurchaseOrder[]>>;
  suppliers: Supplier[];
}) {
  const [searchSupplier, setSearchSupplier] = useState("");
  const [viewOrder, setViewOrder] = useState<PurchaseOrder | null>(null);
  const [editOrder, setEditOrder] = useState<PurchaseOrder | null>(null);
  const [showNewPOForm, setShowNewPOForm] = useState(false);
  const { toast } = useToast();
  const statusColors: Record<string, string> = {
    draft: "bg-slate-100 text-slate-700",
    sent: "bg-blue-100 text-blue-700",
    partial: "bg-amber-100 text-amber-700",
    received: "bg-emerald-100 text-emerald-700",
    cancelled: "bg-rose-100 text-rose-700",
  };

  const filtered = orders.filter(o =>
    o.supplier.toLowerCase().includes(searchSupplier.toLowerCase()) ||
    o.poNumber.toLowerCase().includes(searchSupplier.toLowerCase())
  );

  return (
    <div className="h-full bg-white rounded-2xl shadow-lg ring-1 ring-slate-200/60 overflow-hidden flex flex-col">
      <div className="flex-shrink-0 flex items-center justify-between px-5 py-3 bg-gradient-to-r from-slate-50 to-white border-b border-slate-200">
        <div className="flex items-center gap-3">
          <Archive className="h-5 w-5 text-amber-600" />
          <h2 className="text-base font-bold text-slate-800">Purchase Orders</h2>
          <Badge variant="outline" className="font-mono text-xs">{filtered.length} of {orders.length} orders</Badge>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              value={searchSupplier}
              onChange={(e) => setSearchSupplier(e.target.value)}
              placeholder="Search supplier or PO..."
              className="h-9 pl-8 pr-3 rounded-lg bg-slate-100 text-sm outline-none focus:ring-2 focus:ring-amber-400 w-56"
            />
          </div>
          <Button onClick={() => setShowNewPOForm(true)} className="bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700">
            <Plus className="h-4 w-4" /> New PO
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-slate-800 text-white text-[11px] uppercase tracking-wide z-10">
            <tr>
              <th className="text-left px-4 py-2.5 font-semibold">PO Number</th>
              <th className="text-left px-3 py-2.5 font-semibold">Supplier</th>
              <th className="text-left px-3 py-2.5 font-semibold">Date</th>
              <th className="text-left px-3 py-2.5 font-semibold">Expected</th>
              <th className="text-center px-3 py-2.5 font-semibold">Items</th>
              <th className="text-right px-3 py-2.5 font-semibold">Total</th>
              <th className="text-center px-3 py-2.5 font-semibold">Status</th>
              <th className="text-center px-3 py-2.5 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                  {searchSupplier ? `No orders found matching "${searchSupplier}"` : "No purchase orders"}
                </td>
              </tr>
            ) : (
              filtered.map(o => (
                <tr key={o.id} className="hover:bg-amber-50/50 transition">
                  <td className="px-4 py-2.5 font-mono font-semibold text-slate-800">{o.poNumber}</td>
                  <td className="px-3 py-2.5 text-slate-700">{o.supplier}</td>
                  <td className="px-3 py-2.5 text-slate-500 text-xs">{o.date}</td>
                  <td className="px-3 py-2.5 text-slate-500 text-xs">{o.expectedDate}</td>
                  <td className="px-3 py-2.5 text-center font-mono text-slate-700">{o.items.length}</td>
                  <td className="px-3 py-2.5 text-right font-mono font-semibold text-slate-800">{formatGHS(o.total)}</td>
                  <td className="px-3 py-2.5 text-center">
                    <span className={cn("px-2 py-1 rounded-md text-[10px] font-bold uppercase", statusColors[o.status])}>{o.status}</span>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => setViewOrder(o)} className="h-7 w-7 rounded-md bg-blue-100 text-blue-600 hover:bg-blue-200 flex items-center justify-center transition" title="View">
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => setEditOrder(o)} className="h-7 w-7 rounded-md bg-amber-100 text-amber-600 hover:bg-amber-200 flex items-center justify-center transition" title="Edit">
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </ScrollArea>

      {/* View PO Modal */}
      <AnimatePresence>
        {viewOrder && (
          <POViewModal order={viewOrder} onClose={() => setViewOrder(null)} />
        )}
      </AnimatePresence>

      {/* Edit PO Modal */}
      <AnimatePresence>
        {editOrder && (
          <POEditModal order={editOrder} suppliers={suppliers} onClose={() => setEditOrder(null)} onSave={(updated) => {
            setOrders(prev => prev.map(o => o.id === updated.id ? updated : o));
            toast({ title: "PO updated", description: updated.poNumber });
            setEditOrder(null);
          }} />
        )}
      </AnimatePresence>

      {/* New PO Form Modal */}
      <AnimatePresence>
        {showNewPOForm && (
          <POEditModal order={null} suppliers={suppliers} onClose={() => setShowNewPOForm(false)} onSave={(newOrder) => {
            setOrders(prev => [...prev, newOrder]);
            toast({ title: "Purchase Order created", description: newOrder.poNumber });
            setShowNewPOForm(false);
          }} />
        )}
      </AnimatePresence>
    </div>
  );
}

// ===== PO View Modal =====
function POViewModal({ order, onClose }: { order: PurchaseOrder; onClose: () => void }) {
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
        <div className="flex-shrink-0 px-5 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            <h3 className="font-bold">Purchase Order Details</h3>
          </div>
          <button onClick={onClose} className="h-8 w-8 rounded-lg bg-white/15 hover:bg-white/25 flex items-center justify-center"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-50 rounded-lg p-3">
              <div className="text-[10px] text-slate-500 uppercase font-semibold">PO Number</div>
              <div className="text-sm font-bold text-slate-800 font-mono">{order.poNumber}</div>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <div className="text-[10px] text-slate-500 uppercase font-semibold">Supplier</div>
              <div className="text-sm font-bold text-slate-800">{order.supplier}</div>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <div className="text-[10px] text-slate-500 uppercase font-semibold">Order Date</div>
              <div className="text-sm font-bold text-slate-800">{order.date}</div>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <div className="text-[10px] text-slate-500 uppercase font-semibold">Expected Date</div>
              <div className="text-sm font-bold text-slate-800">{order.expectedDate}</div>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <div className="text-[10px] text-slate-500 uppercase font-semibold">Status</div>
              <div className="text-sm font-bold text-slate-800 capitalize">{order.status}</div>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <div className="text-[10px] text-slate-500 uppercase font-semibold">Total Amount</div>
              <div className="text-sm font-bold text-blue-600 font-mono">{formatGHS(order.total)}</div>
            </div>
          </div>
          <div>
            <div className="text-xs font-bold text-slate-600 uppercase mb-2">Order Items ({order.items.length})</div>
            <table className="w-full text-xs">
              <thead className="bg-slate-100">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold text-slate-700">Product</th>
                  <th className="text-right px-3 py-2 font-semibold text-slate-700">Qty Ordered</th>
                  <th className="text-right px-3 py-2 font-semibold text-slate-700">Cost</th>
                  <th className="text-right px-3 py-2 font-semibold text-slate-700">Received</th>
                  <th className="text-right px-3 py-2 font-semibold text-slate-700">Line Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {order.items.map((it, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="px-3 py-2 text-slate-800">{it.name}</td>
                    <td className="px-3 py-2 text-right font-mono text-slate-700">{it.qty}</td>
                    <td className="px-3 py-2 text-right font-mono text-slate-700">{formatGHS(it.cost)}</td>
                    <td className="px-3 py-2 text-right font-mono text-slate-700">{it.received}</td>
                    <td className="px-3 py-2 text-right font-mono font-semibold text-slate-800">{formatGHS(it.qty * it.cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="flex-shrink-0 px-5 py-3 border-t border-slate-200 bg-slate-50 flex justify-end">
          <Button variant="outline" onClick={onClose}>Close</Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ===== PO Edit/New Modal =====
function POEditModal({ order, suppliers, onClose, onSave }: {
  order: PurchaseOrder | null;
  suppliers: Supplier[];
  onClose: () => void;
  onSave: (order: PurchaseOrder) => void;
}) {
  const isNew = !order;
  const [form, setForm] = useState<PurchaseOrder>(order || {
    id: `po-${Date.now()}`,
    poNumber: `PO-2026-${String(Math.floor(Math.random() * 9000) + 1000)}`,
    supplier: "",
    date: new Date().toISOString().split('T')[0],
    expectedDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
    status: "draft",
    items: [],
    total: 0,
  });
  const [newItemName, setNewItemName] = useState("");
  const [newItemQty, setNewItemQty] = useState(1);
  const [newItemCost, setNewItemCost] = useState(0);

  const addItem = () => {
    if (!newItemName || newItemQty <= 0) return;
    setForm({
      ...form,
      items: [...form.items, { productId: `p-${Date.now()}`, name: newItemName, qty: newItemQty, cost: newItemCost, received: 0 }],
      total: form.total + newItemQty * newItemCost,
    });
    setNewItemName(""); setNewItemQty(1); setNewItemCost(0);
  };

  const removeItem = (i: number) => {
    const item = form.items[i];
    setForm({
      ...form,
      items: form.items.filter((_, idx) => idx !== i),
      total: form.total - item.qty * item.cost,
    });
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
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
      >
        <div className="flex-shrink-0 px-5 py-3 bg-gradient-to-r from-amber-600 to-orange-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isNew ? <Plus className="h-5 w-5" /> : <Edit2 className="h-5 w-5" />}
            <h3 className="font-bold">{isNew ? "New Purchase Order" : "Edit Purchase Order"}</h3>
          </div>
          <button onClick={onClose} className="h-8 w-8 rounded-lg bg-white/15 hover:bg-white/25 flex items-center justify-center"><X className="h-4 w-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">PO Number</label>
              <input value={form.poNumber} onChange={(e) => setForm({ ...form, poNumber: e.target.value })} className="w-full h-10 px-3 rounded-lg border border-slate-200 focus:border-amber-500 outline-none text-sm font-mono" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Supplier</label>
              <select value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} className="w-full h-10 px-3 rounded-lg border border-slate-200 focus:border-amber-500 outline-none text-sm">
                <option value="">Select supplier...</option>
                {suppliers.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Order Date</label>
              <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="w-full h-10 px-3 rounded-lg border border-slate-200 focus:border-amber-500 outline-none text-sm" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Expected Date</label>
              <input type="date" value={form.expectedDate} onChange={(e) => setForm({ ...form, expectedDate: e.target.value })} className="w-full h-10 px-3 rounded-lg border border-slate-200 focus:border-amber-500 outline-none text-sm" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Status</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as PurchaseOrder["status"] })} className="w-full h-10 px-3 rounded-lg border border-slate-200 focus:border-amber-500 outline-none text-sm">
                <option value="draft">Draft</option>
                <option value="sent">Sent</option>
                <option value="partial">Partial</option>
                <option value="received">Received</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Total Amount (GHC)</label>
              <input value={form.total.toFixed(2)} readOnly className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-slate-50 outline-none text-sm font-mono font-bold text-amber-700" />
            </div>
          </div>

          {/* Items section */}
          <div>
            <label className="text-xs font-bold text-slate-600 uppercase mb-2 block">Order Items</label>
            <div className="flex items-center gap-2 mb-2 p-2 bg-slate-50 rounded-lg">
              <input value={newItemName} onChange={(e) => setNewItemName(e.target.value)} placeholder="Product name" className="flex-1 h-9 px-3 rounded-lg border border-slate-200 outline-none text-sm" />
              <input type="number" value={newItemQty || ""} onChange={(e) => setNewItemQty(parseInt(e.target.value) || 0)} placeholder="Qty" className="w-16 h-9 px-2 rounded-lg border border-slate-200 outline-none text-sm text-center" />
              <input type="number" value={newItemCost || ""} onChange={(e) => setNewItemCost(parseFloat(e.target.value) || 0)} placeholder="Cost" className="w-24 h-9 px-2 rounded-lg border border-slate-200 outline-none text-sm text-right" />
              <button onClick={addItem} className="h-9 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1">
                <Plus className="h-3.5 w-3.5" /> Add
              </button>
            </div>
            <table className="w-full text-xs">
              <thead className="bg-slate-100">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold text-slate-700">Product</th>
                  <th className="text-right px-3 py-2 font-semibold text-slate-700">Qty</th>
                  <th className="text-right px-3 py-2 font-semibold text-slate-700">Cost</th>
                  <th className="text-right px-3 py-2 font-semibold text-slate-700">Total</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {form.items.length === 0 ? (
                  <tr><td colSpan={5} className="px-3 py-4 text-center text-slate-400">No items added yet</td></tr>
                ) : (
                  form.items.map((it, i) => (
                    <tr key={i}>
                      <td className="px-3 py-2 text-slate-800">{it.name}</td>
                      <td className="px-3 py-2 text-right font-mono text-slate-700">{it.qty}</td>
                      <td className="px-3 py-2 text-right font-mono text-slate-700">{formatGHS(it.cost)}</td>
                      <td className="px-3 py-2 text-right font-mono font-semibold text-slate-800">{formatGHS(it.qty * it.cost)}</td>
                      <td className="px-3 py-2 text-center">
                        <button onClick={() => removeItem(i)} className="h-6 w-6 rounded bg-rose-100 text-rose-600 hover:bg-rose-200 flex items-center justify-center mx-auto">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex-shrink-0 px-5 py-3 border-t border-slate-200 bg-slate-50 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <button
            onClick={() => onSave(form)}
            disabled={!form.supplier}
            className="h-10 px-5 rounded-lg bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white font-semibold text-sm transition disabled:opacity-50"
          >
            <Save className="h-4 w-4 inline mr-1" />
            {isNew ? "Create PO" : "Save Changes"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ===== Receive Stock Tab =====
function ReceiveStock({ orders, setOrders, products }: {
  orders: PurchaseOrder[];
  setOrders: React.Dispatch<React.SetStateAction<PurchaseOrder[]>>;
  products: Product[];
}) {
  const { toast } = useToast();
  const pendingOrders = orders.filter(o => o.status === "sent" || o.status === "partial");

  const handleReceive = (orderId: string, itemIndex: number, qty: number) => {
    setOrders(prev => prev.map(o => {
      if (o.id !== orderId) return o;
      const newItems = o.items.map((it, i) => i === itemIndex ? { ...it, received: Math.min(it.qty, it.received + qty) } : it);
      const allReceived = newItems.every(it => it.received >= it.qty);
      return { ...o, items: newItems, status: allReceived ? "received" : "partial" };
    }));
    toast({ title: "Stock received", description: `${qty} units added to inventory` });
  };

  return (
    <div className="h-full bg-white rounded-2xl shadow-lg ring-1 ring-slate-200/60 overflow-hidden flex flex-col">
      <div className="flex-shrink-0 flex items-center gap-3 px-5 py-3 bg-gradient-to-r from-slate-50 to-white border-b border-slate-200">
        <Package className="h-5 w-5 text-amber-600" />
        <h2 className="text-base font-bold text-slate-800">Receive Stock</h2>
        <Badge variant="outline" className="font-mono text-xs">{pendingOrders.length} pending</Badge>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3">
          {pendingOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <Package className="h-10 w-10 mb-2 opacity-40" />
              <div className="text-sm font-medium">No pending deliveries</div>
              <div className="text-xs mt-1">All purchase orders have been fully received</div>
            </div>
          ) : (
            pendingOrders.map(o => (
              <div key={o.id} className="bg-slate-50 rounded-xl p-4 ring-1 ring-slate-200">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="font-bold text-slate-800">{o.poNumber}</div>
                    <div className="text-xs text-slate-500">{o.supplier} · Expected: {o.expectedDate}</div>
                  </div>
                  <Badge variant="secondary" className={cn("text-xs", o.status === "partial" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700")}>
                    {o.status}
                  </Badge>
                </div>
                <div className="space-y-2">
                  {o.items.map((item, i) => (
                    <div key={i} className="flex items-center gap-3 bg-white rounded-lg p-2.5 ring-1 ring-slate-100">
                      <div className="flex-1">
                        <div className="text-sm font-semibold text-slate-800">{item.name}</div>
                        <div className="text-xs text-slate-500">
                          Ordered: {item.qty} · Received: {item.received} · Pending: {item.qty - item.received}
                        </div>
                      </div>
                      <div className="w-32 bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all"
                          style={{ width: `${(item.received / item.qty) * 100}%` }}
                        />
                      </div>
                      {item.received < item.qty && (
                        <Button
                          size="sm"
                          onClick={() => handleReceive(o.id, i, item.qty - item.received)}
                          className="bg-emerald-600 hover:bg-emerald-700 h-8 text-xs"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" /> Receive All
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// ===== Suppliers Tab =====
function Suppliers({ suppliers, setSuppliers, products }: {
  suppliers: Supplier[];
  setSuppliers: React.Dispatch<React.SetStateAction<Supplier[]>>;
  products: Product[];
}) {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [editSupplier, setEditSupplier] = useState<Supplier | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [viewSupplier, setViewSupplier] = useState<Supplier | null>(null);

  const handleDelete = (id: string) => {
    setSuppliers(prev => prev.filter(s => s.id !== id));
    toast({ title: "Supplier deleted" });
  };

  const filtered = suppliers.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.contact.includes(search) ||
    s.email.toLowerCase().includes(search.toLowerCase()) ||
    s.address.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="h-full bg-white rounded-2xl shadow-lg ring-1 ring-slate-200/60 overflow-hidden flex flex-col">
      <div className="flex-shrink-0 flex items-center justify-between px-5 py-3 bg-gradient-to-r from-slate-50 to-white border-b border-slate-200">
        <div className="flex items-center gap-3">
          <Users className="h-5 w-5 text-amber-600" />
          <h2 className="text-base font-bold text-slate-800">Suppliers</h2>
          <Badge variant="outline" className="font-mono text-xs">{filtered.length} of {suppliers.length} suppliers</Badge>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search suppliers..."
              className="h-9 pl-8 pr-3 rounded-lg bg-slate-100 text-sm outline-none focus:ring-2 focus:ring-amber-400 w-56"
            />
          </div>
          <Button onClick={() => setShowAddForm(true)} className="bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700">
            <Plus className="h-4 w-4" /> Add Supplier
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-5">
          {filtered.length === 0 ? (
            <div className="col-span-full flex flex-col items-center justify-center py-16 text-slate-400">
              <Users className="h-10 w-10 mb-2 opacity-40" />
              <div className="text-sm font-medium">No suppliers found</div>
              <div className="text-xs mt-1">{search ? `No match for "${search}"` : "Add a supplier to get started"}</div>
            </div>
          ) : (
            filtered.map(s => (
              <motion.div
                key={s.id}
                whileHover={{ y: -3 }}
                className="bg-white rounded-xl ring-1 ring-slate-200 p-4 shadow-sm hover:shadow-md transition"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center">
                    <Truck className="h-6 w-6 text-amber-600" />
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => setViewSupplier(s)} className="h-7 w-7 rounded-md bg-emerald-100 text-emerald-600 hover:bg-emerald-200 flex items-center justify-center" title="View Products">
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => setEditSupplier(s)} className="h-7 w-7 rounded-md bg-blue-100 text-blue-600 hover:bg-blue-200 flex items-center justify-center" title="Edit">
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => handleDelete(s.id)} className="h-7 w-7 rounded-md bg-rose-100 text-rose-600 hover:bg-rose-200 flex items-center justify-center" title="Delete">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <div className="font-bold text-slate-800">{s.name}</div>
                <div className="text-xs text-slate-500 space-y-1 mt-2">
                  <div className="flex items-center gap-1.5"><Phone className="h-3 w-3" /> {s.contact}</div>
                  <div className="flex items-center gap-1.5"><MapPin className="h-3 w-3" /> {s.address}</div>
                </div>
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
                  <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-700">{s.productsSupplied} products</Badge>
                  <div className="text-right">
                    <div className="text-[10px] text-slate-500">Balance</div>
                    <div className={cn("text-sm font-bold font-mono", s.balance > 0 ? "text-rose-600" : "text-emerald-600")}>{formatGHS(s.balance)}</div>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </ScrollArea>

      {/* View Supplier Products Modal */}
      <AnimatePresence>
        {viewSupplier && (
          <SupplierViewModal supplier={viewSupplier} products={products} onClose={() => setViewSupplier(null)} />
        )}
      </AnimatePresence>

      {/* Edit Supplier Modal */}
      <AnimatePresence>
        {editSupplier && (
          <SupplierFormModal supplier={editSupplier} onClose={() => setEditSupplier(null)} onSave={(updated) => {
            setSuppliers(prev => prev.map(s => s.id === updated.id ? updated : s));
            toast({ title: "Supplier updated", description: updated.name });
            setEditSupplier(null);
          }} />
        )}
      </AnimatePresence>

      {/* Add Supplier Modal */}
      <AnimatePresence>
        {showAddForm && (
          <SupplierFormModal supplier={null} onClose={() => setShowAddForm(false)} onSave={(newSupplier) => {
            setSuppliers(prev => [...prev, newSupplier]);
            toast({ title: "Supplier added", description: newSupplier.name });
            setShowAddForm(false);
          }} />
        )}
      </AnimatePresence>
    </div>
  );
}

// ===== Supplier View Modal (shows actual products supplied) =====
function SupplierViewModal({ supplier, products, onClose }: { supplier: Supplier; products: Product[]; onClose: () => void }) {
  // Filter actual products from this supplier
  const supplierProducts = products.filter(p => p.supplier === supplier.name);

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
        <div className="flex-shrink-0 px-5 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            <h3 className="font-bold">Products Supplied</h3>
          </div>
          <button onClick={onClose} className="h-8 w-8 rounded-lg bg-white/15 hover:bg-white/25 flex items-center justify-center"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex-shrink-0 p-4 bg-slate-50 border-b border-slate-200 flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center">
            <Truck className="h-6 w-6 text-amber-600" />
          </div>
          <div>
            <div className="font-bold text-slate-800">{supplier.name}</div>
            <div className="text-xs text-slate-500">{supplier.contact} · {supplier.address}</div>
          </div>
          <Badge variant="secondary" className="ml-auto bg-emerald-100 text-emerald-700">{supplierProducts.length} products</Badge>
        </div>
        <div className="flex-1 overflow-y-auto">
          {supplierProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <Package className="h-10 w-10 mb-2 opacity-40" />
              <div className="text-sm font-medium">No products found</div>
              <div className="text-xs mt-1">No products in inventory are supplied by {supplier.name}</div>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-800 text-white text-[11px] uppercase tracking-wide z-10">
                <tr>
                  <th className="text-left px-4 py-2.5 font-semibold">Product Name</th>
                  <th className="text-left px-3 py-2.5 font-semibold">SKU</th>
                  <th className="text-center px-3 py-2.5 font-semibold">Stock</th>
                  <th className="text-right px-3 py-2.5 font-semibold">Price (GHC)</th>
                  <th className="text-right px-3 py-2.5 font-semibold">Cost (GHC)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {supplierProducts.map((p) => (
                  <tr key={p.id} className="hover:bg-emerald-50/50">
                    <td className="px-4 py-2.5 text-slate-800">{p.emoji} {p.name}</td>
                    <td className="px-3 py-2.5 font-mono text-xs text-slate-600">{p.sku}</td>
                    <td className="px-3 py-2.5 text-center font-mono text-slate-700">{p.stock}</td>
                    <td className="px-3 py-2.5 text-right font-mono font-semibold text-emerald-600">{formatGHS(p.price)}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-slate-600">{formatGHS(p.costPrice)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="flex-shrink-0 px-5 py-3 border-t border-slate-200 bg-slate-50 flex justify-end">
          <Button variant="outline" onClick={onClose}>Close</Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ===== Supplier Form Modal (Edit/Add) =====
function SupplierFormModal({ supplier, onClose, onSave }: {
  supplier: Supplier | null;
  onClose: () => void;
  onSave: (supplier: Supplier) => void;
}) {
  const isNew = !supplier;
  const [form, setForm] = useState<Supplier>(supplier || {
    id: `s-${Date.now()}`,
    name: "",
    contact: "",
    email: "",
    address: "",
    balance: 0,
    productsSupplied: 0,
  });

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
        <div className="flex-shrink-0 px-5 py-3 bg-gradient-to-r from-amber-600 to-orange-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isNew ? <Plus className="h-5 w-5" /> : <Edit2 className="h-5 w-5" />}
            <h3 className="font-bold">{isNew ? "Add Supplier" : "Edit Supplier"}</h3>
          </div>
          <button onClick={onClose} className="h-8 w-8 rounded-lg bg-white/15 hover:bg-white/25 flex items-center justify-center"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1 block">Supplier Name</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. AgriCorp Ghana" className="w-full h-10 px-3 rounded-lg border border-slate-200 focus:border-amber-500 outline-none text-sm" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1 block">Contact Phone</label>
            <input value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} placeholder="+233 24 111 2222" className="w-full h-10 px-3 rounded-lg border border-slate-200 focus:border-amber-500 outline-none text-sm" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1 block">Email</label>
            <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="supplier@email.com" className="w-full h-10 px-3 rounded-lg border border-slate-200 focus:border-amber-500 outline-none text-sm" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1 block">Address</label>
            <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Location, City" className="w-full h-10 px-3 rounded-lg border border-slate-200 focus:border-amber-500 outline-none text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Balance (GHC)</label>
              <input type="number" step="0.01" value={form.balance || ""} onChange={(e) => setForm({ ...form, balance: parseFloat(e.target.value) || 0 })} className="w-full h-10 px-3 rounded-lg border border-slate-200 focus:border-amber-500 outline-none text-sm font-mono" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Products Supplied</label>
              <input type="number" value={form.productsSupplied || ""} onChange={(e) => setForm({ ...form, productsSupplied: parseInt(e.target.value) || 0 })} className="w-full h-10 px-3 rounded-lg border border-slate-200 focus:border-amber-500 outline-none text-sm" />
            </div>
          </div>
        </div>
        <div className="flex-shrink-0 px-5 py-3 border-t border-slate-200 bg-slate-50 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <button
            onClick={() => form.name && onSave(form)}
            disabled={!form.name}
            className="h-10 px-5 rounded-lg bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white font-semibold text-sm transition disabled:opacity-50"
          >
            <Save className="h-4 w-4 inline mr-1" />
            {isNew ? "Add Supplier" : "Save Changes"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ===== Purchase History Tab =====
function PurchaseHistory({ orders, onView }: {
  orders: PurchaseOrder[];
  onView: (order: PurchaseOrder) => void;
}) {
  const totalSpent = orders.reduce((s, o) => s + o.total, 0);
  const received = orders.filter(o => o.status === "received").length;

  return (
    <div className="h-full bg-white rounded-2xl shadow-lg ring-1 ring-slate-200/60 overflow-hidden flex flex-col">
      <div className="flex-shrink-0 flex items-center gap-3 px-5 py-3 bg-gradient-to-r from-slate-50 to-white border-b border-slate-200">
        <History className="h-5 w-5 text-amber-600" />
        <h2 className="text-base font-bold text-slate-800">Purchase History</h2>
      </div>

      {/* Stats */}
      <div className="flex-shrink-0 px-5 py-3 bg-amber-50/50 border-b border-amber-100 grid grid-cols-3 gap-3">
        <div className="bg-white rounded-lg p-3 ring-1 ring-amber-100">
          <div className="text-[10px] text-slate-500 uppercase">Total Orders</div>
          <div className="text-xl font-bold text-slate-800">{orders.length}</div>
        </div>
        <div className="bg-white rounded-lg p-3 ring-1 ring-amber-100">
          <div className="text-[10px] text-slate-500 uppercase">Total Spent</div>
          <div className="text-xl font-bold text-amber-600 font-mono">{formatGHS(totalSpent)}</div>
        </div>
        <div className="bg-white rounded-lg p-3 ring-1 ring-amber-100">
          <div className="text-[10px] text-slate-500 uppercase">Received</div>
          <div className="text-xl font-bold text-emerald-600">{received}/{orders.length}</div>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-2">
          {orders.map(o => (
            <div key={o.id} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition cursor-pointer" onClick={() => onView(o)}>
              <div className="h-10 w-10 rounded-lg bg-amber-100 flex items-center justify-center">
                <Archive className="h-5 w-5 text-amber-600" />
              </div>
              <div className="flex-1">
                <div className="font-semibold text-slate-800 text-sm">{o.poNumber} · {o.supplier}</div>
                <div className="text-xs text-slate-500">{o.date} · {o.items.length} items</div>
              </div>
              <div className="text-right">
                <div className="font-mono font-bold text-slate-800">{formatGHS(o.total)}</div>
                <div className="text-[10px] text-slate-400 uppercase">{o.status}</div>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-300" />
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

// ===== Supplier Payments Tab =====
function SupplierPayments({ suppliers, onPay }: {
  suppliers: Supplier[];
  onPay: (id: string, amount: number) => void;
}) {
  const { toast } = useToast();
  const debtors = suppliers.filter(s => s.balance > 0);
  const totalDue = debtors.reduce((s, sup) => s + sup.balance, 0);

  return (
    <div className="h-full bg-white rounded-2xl shadow-lg ring-1 ring-slate-200/60 overflow-hidden flex flex-col">
      <div className="flex-shrink-0 flex items-center gap-3 px-5 py-3 bg-gradient-to-r from-slate-50 to-white border-b border-slate-200">
        <DollarSign className="h-5 w-5 text-amber-600" />
        <h2 className="text-base font-bold text-slate-800">Supplier Payments</h2>
      </div>

      <div className="flex-shrink-0 px-5 py-3 bg-rose-50/50 border-b border-rose-100">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-500 uppercase font-semibold">Total Outstanding</div>
            <div className="text-2xl font-bold text-rose-600 font-mono">{formatGHS(totalDue)}</div>
          </div>
          <Badge variant="secondary" className="bg-rose-100 text-rose-700">{debtors.length} suppliers with balance</Badge>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-2">
          {debtors.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <CheckCircle2 className="h-10 w-10 mb-2 opacity-40 text-emerald-500" />
              <div className="text-sm font-medium">All suppliers paid up</div>
              <div className="text-xs mt-1">No outstanding balances</div>
            </div>
          ) : (
            debtors.map(s => (
              <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition">
                <div className="h-10 w-10 rounded-lg bg-amber-100 flex items-center justify-center">
                  <Truck className="h-5 w-5 text-amber-600" />
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-slate-800 text-sm">{s.name}</div>
                  <div className="text-xs text-slate-500">{s.contact}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-slate-500 uppercase">Balance</div>
                  <div className="font-mono font-bold text-rose-600">{formatGHS(s.balance)}</div>
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    onPay(s.id, s.balance);
                    toast({ title: "Payment recorded", description: `${formatGHS(s.balance)} paid to ${s.name}` });
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 h-8 text-xs"
                >
                  <DollarSign className="h-3.5 w-3.5" /> Pay Full
                </Button>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// ===== Purchase Report Tab =====
function PurchaseReport({ transactions }: { transactions: PurchaseTransaction[] }) {
  const [fromDate, setFromDate] = useState("2026-01-01");
  const [toDate, setToDate] = useState("2026-12-31");
  const { toast } = useToast();

  // Filter transactions by date range
  const filtered = transactions.filter(t => t.date >= fromDate && t.date <= toDate);

  // Calculate totals
  const totals = filtered.reduce((acc, t) => ({
    qty: acc.qty + t.qty, tax: acc.tax + t.tax, amount: acc.amount + t.amount,
    paid: acc.paid + t.paid, due: acc.due + t.due,
  }), { qty: 0, tax: 0, amount: 0, paid: 0, due: 0 });

  const formatDate = (iso: string) => {
    const [y, m, d] = iso.split('-');
    return `${parseInt(m)}/${parseInt(d)}/${y}`;
  };
  const formatNum = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const now = new Date();
  const dateStr = `${now.getMonth() + 1}/${now.getDate()}/${now.getFullYear()}`;
  const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

  // PDF Export
  const handleExportPDF = () => {
    if (filtered.length === 0) { toast({ title: "No data to export", variant: "destructive" }); return; }
    import("jspdf").then(({ default: jsPDF }) => {
      import("jspdf-autotable").then(({ default: autoTable }) => {
        const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
        const pw = doc.internal.pageSize.getWidth();
        doc.setFontSize(16); doc.setFont("helvetica", "bold"); doc.setTextColor(30, 41, 59);
        doc.text(COMPANY.name, 14, 18);
        doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.setTextColor(100, 100, 100);
        doc.text("Accra Warehouse", 14, 24); doc.text(COMPANY.address, 14, 29);
        doc.setFontSize(9); doc.text(`${dateStr}`, pw - 14, 18, { align: "right" });
        doc.text(`${timeStr}`, pw - 14, 23, { align: "right" }); doc.text("Page 1", pw - 14, 28, { align: "right" });
        doc.setFontSize(14); doc.setFont("helvetica", "bold"); doc.setTextColor(0, 0, 0);
        doc.text("Totals Purchase Report", pw / 2, 42, { align: "center" });
        doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.setTextColor(80, 80, 80);
        doc.text(`For The Period ${formatDate(fromDate)} - ${formatDate(toDate)}`, pw / 2, 48, { align: "center" });
        const head = [["Date", "Qty", "TAX GHC", "Amount", "Paid GHC", "Due GHC"]];
        const body = filtered.map(t => [formatDate(t.date), String(t.qty), formatNum(t.tax), formatNum(t.amount), formatNum(t.paid), formatNum(t.due)]);
        body.push(["TOTAL", String(totals.qty), formatNum(totals.tax), formatNum(totals.amount), formatNum(totals.paid), formatNum(totals.due)]);
        autoTable(doc, { head, body, startY: 54, styles: { fontSize: 9, cellPadding: 2, lineColor: [0, 0, 0], lineWidth: 0.3 },
          headStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: "bold" },
          alternateRowStyles: { fillColor: [250, 250, 250] },
          columnStyles: { 0: { cellWidth: 30 }, 1: { cellWidth: 20, halign: "right" }, 2: { cellWidth: 30, halign: "right" }, 3: { cellWidth: 35, halign: "right" }, 4: { cellWidth: 35, halign: "right" }, 5: { cellWidth: 35, halign: "right" } },
          margin: { left: 14, right: 14 } });
        const ph = doc.internal.pageSize.getHeight();
        doc.setFontSize(8); doc.setTextColor(150, 150, 150);
        doc.text(`${COMPANY.name} · ${COMPANY.address} · ${COMPANY.contact}`, pw / 2, ph - 8, { align: "center" });
        doc.save(`purchase-report-${new Date().toISOString().split('T')[0]}.pdf`);
        toast({ title: "PDF exported successfully" });
      });
    });
  };

  // Excel Export
  const handleExportExcel = () => {
    if (filtered.length === 0) { toast({ title: "No data to export", variant: "destructive" }); return; }
    import("xlsx").then((XLSX) => {
      const data: (string | number)[][] = [];
      data.push([COMPANY.name]); data.push(["Accra Warehouse"]); data.push([COMPANY.address]); data.push([]);
      data.push(["Totals Purchase Report"]); data.push([`For The Period ${formatDate(fromDate)} - ${formatDate(toDate)}`]);
      data.push([`Generated: ${dateStr} ${timeStr}`]); data.push([]);
      data.push(["Date", "Qty", "TAX GHC", "Amount", "Paid GHC", "Due GHC"]);
      filtered.forEach(t => data.push([formatDate(t.date), t.qty, formatNum(t.tax), formatNum(t.amount), formatNum(t.paid), formatNum(t.due)]));
      data.push(["TOTAL", totals.qty, formatNum(totals.tax), formatNum(totals.amount), formatNum(totals.paid), formatNum(totals.due)]);
      const ws = XLSX.utils.aoa_to_sheet(data);
      ws['!cols'] = [{ wch: 14 }, { wch: 8 }, { wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 14 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Purchase Report");
      XLSX.writeFile(wb, `purchase-report-${new Date().toISOString().split('T')[0]}.xlsx`);
      toast({ title: "Excel exported successfully" });
    });
  };

  return (
    <div className="h-full overflow-y-auto bg-slate-200/50 p-4">
      {/* Minimal Date Filter + Export Bar */}
      <div className="max-w-3xl mx-auto mb-3 flex items-center justify-between gap-2 flex-wrap print:hidden">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-amber-600" />
          <span className="text-xs font-semibold text-slate-600">From:</span>
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="h-9 px-2 rounded-lg border border-slate-300 text-xs outline-none focus:ring-2 focus:ring-amber-400" />
          <span className="text-xs font-semibold text-slate-600">To:</span>
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="h-9 px-2 rounded-lg border border-slate-300 text-xs outline-none focus:ring-2 focus:ring-amber-400" />
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => window.print()} className="h-9 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition">
            <Printer className="h-3.5 w-3.5" /> Print
          </button>
          <button onClick={handleExportPDF} className="h-9 px-3 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-1.5 transition">
            <FileText className="h-3.5 w-3.5" /> PDF
          </button>
          <button onClick={handleExportExcel} className="h-9 px-3 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-700 text-xs font-semibold flex items-center gap-1.5 transition">
            <Download className="h-3.5 w-3.5" /> Excel
          </button>
        </div>
      </div>

      {/* The Report — ONLY company header + title + table */}
      <div className="max-w-3xl mx-auto bg-white shadow-xl" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
        {/* Company Header */}
        <div className="px-8 pt-6 pb-3 flex items-start justify-between border-b-2 border-slate-800">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-slate-100 ring-1 ring-slate-300 flex items-center justify-center text-slate-700 font-bold text-lg">S</div>
            <div>
              <div className="text-base font-bold text-slate-900 uppercase leading-tight">{COMPANY.name}</div>
              <div className="text-xs text-slate-600">Accra Warehouse</div>
              <div className="text-xs text-slate-600">{COMPANY.address}</div>
            </div>
          </div>
          <div className="text-right text-xs text-slate-600">
            <div>{dateStr}</div>
            <div>{timeStr}</div>
            <div className="mt-1 font-semibold text-slate-700">Page 1</div>
          </div>
        </div>

        {/* Report Title */}
        <div className="px-8 py-4 text-center">
          <h1 className="text-lg font-bold text-slate-900">Totals Purchase Report</h1>
          <p className="text-sm text-slate-600 mt-1">For The Period {formatDate(fromDate)} - {formatDate(toDate)}</p>
        </div>

        {/* Report Table */}
        <div className="px-8 pb-6">
          <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#F0F0F0' }}>
                <th className="px-3 py-2 text-left font-bold text-slate-800 border border-slate-700">Date</th>
                <th className="px-3 py-2 text-right font-bold text-slate-800 border border-slate-700">Qty</th>
                <th className="px-3 py-2 text-right font-bold text-slate-800 border border-slate-700">TAX GHC</th>
                <th className="px-3 py-2 text-right font-bold text-slate-800 border border-slate-700">Amount</th>
                <th className="px-3 py-2 text-right font-bold text-slate-800 border border-slate-700">Paid GHC</th>
                <th className="px-3 py-2 text-right font-bold text-slate-800 border border-slate-700">Due GHC</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="px-3 py-8 text-center text-slate-400 border border-slate-700">No transactions found in the selected date range</td></tr>
              ) : (
                filtered.map((t, i) => (
                  <tr key={t.id} style={{ backgroundColor: i % 2 === 0 ? '#FFFFFF' : '#FAFAFA' }}>
                    <td className="px-3 py-1.5 text-slate-800 border border-slate-700">{formatDate(t.date)}</td>
                    <td className="px-3 py-1.5 text-right text-slate-800 border border-slate-700">{t.qty}</td>
                    <td className="px-3 py-1.5 text-right text-slate-800 border border-slate-700">{formatNum(t.tax)}</td>
                    <td className="px-3 py-1.5 text-right text-slate-800 border border-slate-700">{formatNum(t.amount)}</td>
                    <td className="px-3 py-1.5 text-right text-slate-800 border border-slate-700">{formatNum(t.paid)}</td>
                    <td className="px-3 py-1.5 text-right font-semibold border border-slate-700" style={{ color: t.due > 0 ? '#DC2626' : '#16A34A' }}>{formatNum(t.due)}</td>
                  </tr>
                ))
              )}
            </tbody>
            {filtered.length > 0 && (
              <tfoot>
                <tr style={{ backgroundColor: '#F0F0F0' }}>
                  <td className="px-3 py-2 font-bold text-slate-900 border border-slate-700">TOTAL</td>
                  <td className="px-3 py-2 text-right font-bold text-slate-900 border border-slate-700">{totals.qty}</td>
                  <td className="px-3 py-2 text-right font-bold text-slate-900 border border-slate-700">{formatNum(totals.tax)}</td>
                  <td className="px-3 py-2 text-right font-bold text-slate-900 border border-slate-700">{formatNum(totals.amount)}</td>
                  <td className="px-3 py-2 text-right font-bold text-slate-900 border border-slate-700">{formatNum(totals.paid)}</td>
                  <td className="px-3 py-2 text-right font-bold border border-slate-700" style={{ color: totals.due > 0 ? '#DC2626' : '#16A34A' }}>{formatNum(totals.due)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
