"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Package, Truck, Users, History, DollarSign, Plus, X, Save,
  Archive, ShoppingCart, CheckCircle2, Clock, Phone, MapPin, Search,
  TrendingUp, Filter, ChevronRight, Edit2, Trash2, Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { COMPANY, CURRENCY, formatGHS, type Product } from "@/lib/pos-data";

type PurchaseTab = "orders" | "receive" | "suppliers" | "history" | "payments";

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
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [showNewSupplier, setShowNewSupplier] = useState(false);
  const [viewOrder, setViewOrder] = useState<PurchaseOrder | null>(null);

  const tabs = [
    { id: "orders" as const, label: "Purchase Orders", icon: Archive },
    { id: "receive" as const, label: "Receive Stock", icon: Package },
    { id: "suppliers" as const, label: "Suppliers", icon: Users },
    { id: "history" as const, label: "Purchase History", icon: History },
    { id: "payments" as const, label: "Supplier Payments", icon: DollarSign },
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
            {tab === "orders" && <PurchaseOrders orders={orders} onView={setViewOrder} onNew={() => setShowNewOrder(true)} />}
            {tab === "receive" && <ReceiveStock orders={orders} setOrders={setOrders} products={products} />}
            {tab === "suppliers" && <Suppliers suppliers={suppliers} onNew={() => setShowNewSupplier(true)} onDelete={(id) => setSuppliers(prev => prev.filter(s => s.id !== id))} />}
            {tab === "history" && <PurchaseHistory orders={orders} onView={setViewOrder} />}
            {tab === "payments" && <SupplierPayments suppliers={suppliers} onPay={(id, amount) => {
              setSuppliers(prev => prev.map(s => s.id === id ? { ...s, balance: Math.max(0, s.balance - amount) } : s));
            }} />}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Modals would go here - simplified for now */}
    </div>
  );
}

// ===== Purchase Orders Tab =====
function PurchaseOrders({ orders, onView, onNew }: {
  orders: PurchaseOrder[];
  onView: (order: PurchaseOrder) => void;
  onNew: () => void;
}) {
  const { toast } = useToast();
  const statusColors: Record<string, string> = {
    draft: "bg-slate-100 text-slate-700",
    sent: "bg-blue-100 text-blue-700",
    partial: "bg-amber-100 text-amber-700",
    received: "bg-emerald-100 text-emerald-700",
    cancelled: "bg-rose-100 text-rose-700",
  };

  return (
    <div className="h-full bg-white rounded-2xl shadow-lg ring-1 ring-slate-200/60 overflow-hidden flex flex-col">
      <div className="flex-shrink-0 flex items-center justify-between px-5 py-3 bg-gradient-to-r from-slate-50 to-white border-b border-slate-200">
        <div className="flex items-center gap-3">
          <Archive className="h-5 w-5 text-amber-600" />
          <h2 className="text-base font-bold text-slate-800">Purchase Orders</h2>
          <Badge variant="outline" className="font-mono text-xs">{orders.length} orders</Badge>
        </div>
        <Button onClick={onNew} className="bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700">
          <Plus className="h-4 w-4" /> New PO
        </Button>
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
            {orders.map(o => (
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
                    <button onClick={() => onView(o)} className="h-7 w-7 rounded-md bg-blue-100 text-blue-600 hover:bg-blue-200 flex items-center justify-center transition">
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => toast({ title: "Edit PO", description: o.poNumber })} className="h-7 w-7 rounded-md bg-amber-100 text-amber-600 hover:bg-amber-200 flex items-center justify-center transition">
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollArea>
    </div>
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
function Suppliers({ suppliers, onNew, onDelete }: {
  suppliers: Supplier[];
  onNew: () => void;
  onDelete: (id: string) => void;
}) {
  const { toast } = useToast();
  return (
    <div className="h-full bg-white rounded-2xl shadow-lg ring-1 ring-slate-200/60 overflow-hidden flex flex-col">
      <div className="flex-shrink-0 flex items-center justify-between px-5 py-3 bg-gradient-to-r from-slate-50 to-white border-b border-slate-200">
        <div className="flex items-center gap-3">
          <Users className="h-5 w-5 text-amber-600" />
          <h2 className="text-base font-bold text-slate-800">Suppliers</h2>
          <Badge variant="outline" className="font-mono text-xs">{suppliers.length} suppliers</Badge>
        </div>
        <Button onClick={onNew} className="bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700">
          <Plus className="h-4 w-4" /> Add Supplier
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-5">
          {suppliers.map(s => (
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
                  <button onClick={() => toast({ title: "Edit Supplier", description: s.name })} className="h-7 w-7 rounded-md bg-blue-100 text-blue-600 hover:bg-blue-200 flex items-center justify-center">
                    <Edit2 className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => onDelete(s.id)} className="h-7 w-7 rounded-md bg-rose-100 text-rose-600 hover:bg-rose-200 flex items-center justify-center">
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
          ))}
        </div>
      </ScrollArea>
    </div>
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
