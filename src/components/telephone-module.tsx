"use client";

import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Phone, Truck, Users, Clock, Plus, X, PhoneCall,
  MapPin, Search, CheckCircle2, Package, User, Calendar,
  ChevronRight, Edit2, Trash2, Eye, Filter, BookOpen, UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { COMPANY, formatGHS, type Product } from "@/lib/pos-data";
import { TelephoneDirectory, type PhoneDirectoryEntry } from "@/components/telephone-directory";

type TelephoneTab = "phone-orders" | "delivery" | "customers" | "call-log" | "directory";

interface PhoneOrder {
  id: string;
  orderNumber: string;
  customer: string;
  phone: string;
  address: string;
  items: { name: string; qty: number; price: number }[];
  total: number;
  status: "pending" | "preparing" | "out-for-delivery" | "delivered" | "cancelled";
  time: string;
  notes?: string;
}

interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  totalOrders: number;
  totalSpent: number;
  lastOrder?: string;
}

interface CallLogEntry {
  id: string;
  customer: string;
  phone: string;
  direction: "incoming" | "outgoing" | "missed";
  time: string;
  duration: string;
  notes?: string;
}

const initialCustomers: Customer[] = [
  { id: "c1", name: "Ama Osei", phone: "+233 24 111 2222", email: "ama.osei@email.com", address: "East Legon, Accra", totalOrders: 15, totalSpent: 1250.00, lastOrder: "2026-07-05" },
  { id: "c2", name: "Kwame Mensah", phone: "+233 24 333 4444", email: "kwame.m@email.com", address: "Osu, Accra", totalOrders: 8, totalSpent: 680.50, lastOrder: "2026-07-04" },
  { id: "c3", name: "Akosua Frimpong", phone: "+233 24 555 6666", email: "akosua.f@email.com", address: "Adenta, Accra", totalOrders: 22, totalSpent: 2100.00, lastOrder: "2026-07-06" },
  { id: "c4", name: "Yao Adjei", phone: "+233 24 777 8888", email: "yao.adjei@email.com", address: "Tema, Greater Accra", totalOrders: 5, totalSpent: 420.00, lastOrder: "2026-07-02" },
];

const initialPhoneOrders: PhoneOrder[] = [
  {
    id: "po1", orderNumber: "PH-001", customer: "Ama Osei", phone: "+233 24 111 2222", address: "East Legon, Accra",
    items: [{ name: "Whole Milk 1L", qty: 3, price: 18.00 }, { name: "White Bread", qty: 2, price: 20.00 }],
    total: 94.00, status: "preparing", time: "2026-07-07 09:30", notes: "Deliver before 12pm"
  },
  {
    id: "po2", orderNumber: "PH-002", customer: "Kwame Mensah", phone: "+233 24 333 4444", address: "Osu, Accra",
    items: [{ name: "Red Apples", qty: 2, price: 35.00 }, { name: "Bananas", qty: 1, price: 18.00 }],
    total: 88.00, status: "out-for-delivery", time: "2026-07-07 10:15"
  },
  {
    id: "po3", orderNumber: "PH-003", customer: "Akosua Frimpong", phone: "+233 24 555 6666", address: "Adenta, Accra",
    items: [{ name: "Eggs (Dozen)", qty: 2, price: 45.00 }, { name: "Cheddar Cheese", qty: 1, price: 65.00 }],
    total: 155.00, status: "pending", time: "2026-07-07 11:00", notes: "Customer prefers contactless delivery"
  },
];

const initialCallLog: CallLogEntry[] = [
  { id: "cl1", customer: "Ama Osei", phone: "+233 24 111 2222", direction: "incoming", time: "2026-07-07 09:25", duration: "3:42", notes: "Placed order PH-001" },
  { id: "cl2", customer: "Kwame Mensah", phone: "+233 24 333 4444", direction: "outgoing", time: "2026-07-07 09:50", duration: "2:15", notes: "Confirmed delivery address" },
  { id: "cl3", customer: "Unknown", phone: "+233 24 999 0000", direction: "missed", time: "2026-07-07 10:30", duration: "0:00" },
  { id: "cl4", customer: "Akosua Frimpong", phone: "+233 24 555 6666", direction: "incoming", time: "2026-07-07 10:55", duration: "5:20", notes: "Placed order PH-003" },
];

interface TelephoneProps {
  onBack: () => void;
  products: Product[];
}

export function TelephoneModule({ onBack }: TelephoneProps) {
  const { toast } = useToast();
  const [tab, setTab] = useState<TelephoneTab>("phone-orders");
  const [customers, setCustomers] = useState<Customer[]>(() => {
    try { const c = localStorage.getItem('sylhn-tel-customers'); if (c) return JSON.parse(c); } catch {}
    return initialCustomers;
  });
  const [phoneOrders, setPhoneOrders] = useState<PhoneOrder[]>(() => {
    try { const c = localStorage.getItem('sylhn-tel-phone-orders'); if (c) return JSON.parse(c); } catch {}
    return initialPhoneOrders;
  });
  const [callLog, setCallLog] = useState<CallLogEntry[]>(() => {
    try { const c = localStorage.getItem('sylhn-tel-call-log'); if (c) return JSON.parse(c); } catch {}
    return initialCallLog;
  });
  const [showDirectory, setShowDirectory] = useState(false);
  const [directoryEntries, setDirectoryEntries] = useState<PhoneDirectoryEntry[]>([]);

  // Persist telephone data
  useEffect(() => { try { localStorage.setItem('sylhn-tel-customers', JSON.stringify(customers)); } catch {} }, [customers]);
  useEffect(() => { try { localStorage.setItem('sylhn-tel-phone-orders', JSON.stringify(phoneOrders)); } catch {} }, [phoneOrders]);
  useEffect(() => { try { localStorage.setItem('sylhn-tel-call-log', JSON.stringify(callLog)); } catch {} }, [callLog]);

  const tabs = [
    { id: "phone-orders" as const, label: "Phone Orders", icon: PhoneCall },
    { id: "delivery" as const, label: "Delivery Tracking", icon: Truck },
    { id: "customers" as const, label: "Customers", icon: Users },
    { id: "call-log" as const, label: "Call Log", icon: Clock },
    { id: "directory" as const, label: "Phone Directory", icon: BookOpen },
  ];

  // ===== Sync: directory entries with group 'Customers' (or any group) flow back into the Customers tab =====
  // We merge the original customers with directory entries that aren't already present (by phone).
  // Directory entries appear as Customer cards so the two views stay in sync.
  const mergedCustomers = useMemo(() => {
    const existing = new Set(customers.map(c => c.phone.replace(/\s/g, '')));
    const fromDirectory: Customer[] = directoryEntries
      .filter(e => e.mobile && !existing.has(e.mobile.replace(/\s/g, '')))
      .map(e => ({
        id: `dir-${e.id}`,
        name: `${e.title} ${e.name}`.trim(),
        phone: e.mobile || e.homeTel || e.workTel || '',
        email: e.email || '',
        address: [e.address, e.city, e.state].filter(Boolean).join(', '),
        totalOrders: 0,
        totalSpent: 0,
        lastOrder: undefined,
      }));
    return [...customers, ...fromDirectory];
  }, [customers, directoryEntries]);

  // ===== Add a customer from the Customers tab to the Phone Directory =====
  const addCustomerToDirectory = (customer: Customer) => {
    setDirectoryEntries(prev => {
      // Avoid duplicates by phone (mobile)
      const normalizedPhone = customer.phone.replace(/\s/g, '');
      if (prev.some(e => e.mobile.replace(/\s/g, '') === normalizedPhone && normalizedPhone)) {
        toast({ title: 'Already in directory', description: customer.name });
        return prev;
      }
      const newEntry: PhoneDirectoryEntry = {
        id: `dir-${Date.now()}`,
        title: '',
        name: customer.name,
        address: customer.address,
        city: '',
        state: '',
        code: '',
        country: 'Ghana',
        homeTel: '',
        workTel: '',
        mobile: customer.phone,
        fax: '',
        website: '',
        email: customer.email,
        notes: `Added from Customers · ${customer.totalOrders} orders · ${formatGHS(customer.totalSpent)} spent`,
        group: 'Customers',
      };
      toast({ title: 'Added to Phone Directory', description: customer.name });
      return [...prev, newEntry];
    });
  };

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-slate-50 to-cyan-50/30">
      <header className="flex-shrink-0 bg-gradient-to-r from-cyan-600 via-blue-600 to-teal-600 text-white shadow-lg">
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="h-9 w-9 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center ring-1 ring-white/20">
                <Phone className="h-5 w-5" />
              </div>
              <div>
                <div className="font-bold text-base leading-tight">Telephone & Delivery</div>
                <div className="text-[10px] text-cyan-100/90">{COMPANY.name}</div>
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-cyan-100/80">{COMPANY.address}</div>
            <div className="text-xs font-mono text-cyan-100">{COMPANY.contact}</div>
          </div>
        </div>
      </header>

      <nav className="flex-shrink-0 bg-white border-b border-slate-200 shadow-sm">
        <div className="flex items-center gap-1.5 px-3 sm:px-6 py-2 overflow-x-auto scrollbar-hide">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => {
                if (t.id === "directory") {
                  setShowDirectory(true);
                } else {
                  setTab(t.id);
                }
              }}
              className={cn(
                "flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all whitespace-nowrap flex-shrink-0 active:scale-95",
                tab === t.id ? "bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md" : "text-slate-600 hover:bg-slate-100"
              )}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
            </button>
          ))}
        </div>
      </nav>

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
            {tab === "phone-orders" && <PhoneOrders orders={phoneOrders} setOrders={setPhoneOrders} />}
            {tab === "delivery" && <DeliveryTracking orders={phoneOrders} setOrders={setPhoneOrders} />}
            {tab === "customers" && (
              <Customers
                customers={mergedCustomers}
                setCustomers={setCustomers}
                onAddToDirectory={addCustomerToDirectory}
                onOpenDirectory={() => setShowDirectory(true)}
              />
            )}
            {tab === "call-log" && <CallLog log={callLog} setLog={setCallLog} />}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* ===== Telephone Directory Popup ===== */}
      <AnimatePresence>
        {showDirectory && (
          <TelephoneDirectory
            entries={directoryEntries.length > 0 ? directoryEntries : undefined}
            onEntriesChange={setDirectoryEntries}
            onClose={() => setShowDirectory(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ===== Phone Orders Tab =====
function PhoneOrders({ orders, setOrders }: {
  orders: PhoneOrder[];
  setOrders: React.Dispatch<React.SetStateAction<PhoneOrder[]>>;
}) {
  const { toast } = useToast();
  const statusColors: Record<string, string> = {
    pending: "bg-amber-100 text-amber-700",
    preparing: "bg-blue-100 text-blue-700",
    "out-for-delivery": "bg-purple-100 text-purple-700",
    delivered: "bg-emerald-100 text-emerald-700",
    cancelled: "bg-rose-100 text-rose-700",
  };

  const advanceStatus = (id: string) => {
    const flow = ["pending", "preparing", "out-for-delivery", "delivered"];
    setOrders(prev => prev.map(o => {
      if (o.id !== id) return o;
      const idx = flow.indexOf(o.status);
      if (idx < 0 || idx >= flow.length - 1) return o;
      return { ...o, status: flow[idx + 1] as PhoneOrder["status"] };
    }));
    toast({ title: "Status updated" });
  };

  return (
    <div className="h-full bg-white rounded-2xl shadow-lg ring-1 ring-slate-200/60 overflow-hidden flex flex-col">
      <div className="flex-shrink-0 flex items-center justify-between px-5 py-3 bg-gradient-to-r from-slate-50 to-white border-b border-slate-200">
        <div className="flex items-center gap-3">
          <PhoneCall className="h-5 w-5 text-cyan-600" />
          <h2 className="text-base font-bold text-slate-800">Phone Orders</h2>
          <Badge variant="outline" className="font-mono text-xs">{orders.length} orders</Badge>
        </div>
        <Button className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700">
          <Plus className="h-4 w-4" /> New Phone Order
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          {orders.map(o => (
            <div key={o.id} className="bg-slate-50 rounded-xl p-4 ring-1 ring-slate-200">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="font-bold text-slate-800">{o.orderNumber}</div>
                  <div className="text-xs text-slate-500">{o.time}</div>
                </div>
                <span className={cn("px-2 py-1 rounded-md text-[10px] font-bold uppercase", statusColors[o.status])}>{o.status.replace(/-/g, ' ')}</span>
              </div>
              <div className="space-y-1 mb-3">
                <div className="flex items-center gap-1.5 text-xs text-slate-700"><User className="h-3 w-3 text-slate-400" /> {o.customer}</div>
                <div className="flex items-center gap-1.5 text-xs text-slate-700"><Phone className="h-3 w-3 text-slate-400" /> {o.phone}</div>
                <div className="flex items-center gap-1.5 text-xs text-slate-700"><MapPin className="h-3 w-3 text-slate-400" /> {o.address}</div>
              </div>
              {o.notes && <div className="text-xs italic text-amber-700 bg-amber-50 p-2 rounded mb-2">📝 {o.notes}</div>}
              <div className="space-y-1 mb-3">
                {o.items.map((it, i) => (
                  <div key={i} className="flex justify-between text-xs text-slate-600">
                    <span>{it.qty}× {it.name}</span>
                    <span className="font-mono">{formatGHS(it.qty * it.price)}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                <span className="font-bold text-slate-800">Total: <span className="font-mono text-cyan-600">{formatGHS(o.total)}</span></span>
                {o.status !== "delivered" && o.status !== "cancelled" && (
                  <Button size="sm" onClick={() => advanceStatus(o.id)} className="bg-emerald-600 hover:bg-emerald-700 h-8 text-xs">
                    <ChevronRight className="h-3.5 w-3.5" /> Advance
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

// ===== Delivery Tracking Tab =====
function DeliveryTracking({ orders, setOrders }: {
  orders: PhoneOrder[];
  setOrders: React.Dispatch<React.SetStateAction<PhoneOrder[]>>;
}) {
  const { toast } = useToast();
  const activeDeliveries = orders.filter(o => o.status === "out-for-delivery" || o.status === "preparing");
  const delivered = orders.filter(o => o.status === "delivered");

  return (
    <div className="h-full grid grid-cols-2 gap-4">
      <div className="bg-white rounded-2xl shadow-lg ring-1 ring-slate-200/60 overflow-hidden flex flex-col">
        <div className="flex-shrink-0 flex items-center gap-3 px-5 py-3 bg-gradient-to-r from-purple-50 to-white border-b border-slate-200">
          <Truck className="h-5 w-5 text-purple-600" />
          <h2 className="text-base font-bold text-slate-800">Active Deliveries</h2>
          <Badge variant="secondary" className="bg-purple-100 text-purple-700 text-xs">{activeDeliveries.length}</Badge>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-2">
            {activeDeliveries.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                <Truck className="h-10 w-10 mb-2 opacity-40" />
                <div className="text-sm font-medium">No active deliveries</div>
              </div>
            ) : (
              activeDeliveries.map(o => (
                <div key={o.id} className="p-3 rounded-xl bg-purple-50 ring-1 ring-purple-100">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-bold text-slate-800 text-sm">{o.orderNumber}</div>
                    <Badge variant="secondary" className={cn("text-xs", o.status === "out-for-delivery" ? "bg-purple-200 text-purple-800" : "bg-blue-100 text-blue-700")}>
                      {o.status.replace(/-/g, ' ')}
                    </Badge>
                  </div>
                  <div className="text-xs text-slate-600 space-y-0.5">
                    <div className="flex items-center gap-1.5"><User className="h-3 w-3" /> {o.customer}</div>
                    <div className="flex items-center gap-1.5"><MapPin className="h-3 w-3" /> {o.address}</div>
                    <div className="flex items-center gap-1.5"><Phone className="h-3 w-3" /> {o.phone}</div>
                  </div>
                  <div className="mt-2 pt-2 border-t border-purple-100 flex justify-between items-center">
                    <span className="font-mono font-bold text-slate-800 text-sm">{formatGHS(o.total)}</span>
                    {o.status === "preparing" && (
                      <Button size="sm" onClick={() => {
                        setOrders(prev => prev.map(x => x.id === o.id ? { ...x, status: "out-for-delivery" } : x));
                        toast({ title: "Out for delivery", description: o.orderNumber });
                      }} className="bg-purple-600 hover:bg-purple-700 h-7 text-xs">
                        <Truck className="h-3 w-3" /> Dispatch
                      </Button>
                    )}
                    {o.status === "out-for-delivery" && (
                      <Button size="sm" onClick={() => {
                        setOrders(prev => prev.map(x => x.id === o.id ? { ...x, status: "delivered" } : x));
                        toast({ title: "Delivered!", description: o.orderNumber });
                      }} className="bg-emerald-600 hover:bg-emerald-700 h-7 text-xs">
                        <CheckCircle2 className="h-3 w-3" /> Mark Delivered
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      <div className="bg-white rounded-2xl shadow-lg ring-1 ring-slate-200/60 overflow-hidden flex flex-col">
        <div className="flex-shrink-0 flex items-center gap-3 px-5 py-3 bg-gradient-to-r from-emerald-50 to-white border-b border-slate-200">
          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          <h2 className="text-base font-bold text-slate-800">Completed Deliveries</h2>
          <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 text-xs">{delivered.length}</Badge>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-2">
            {delivered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                <CheckCircle2 className="h-10 w-10 mb-2 opacity-40" />
                <div className="text-sm font-medium">No completed deliveries yet</div>
              </div>
            ) : (
              delivered.map(o => (
                <div key={o.id} className="p-3 rounded-xl bg-emerald-50 ring-1 ring-emerald-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-800 text-sm">{o.orderNumber}</div>
                      <div className="text-xs text-slate-500">{o.customer} · {o.time}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-bold text-emerald-600 text-sm">{formatGHS(o.total)}</div>
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 ml-auto" />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

// ===== Customers Tab =====
function Customers({
  customers,
  setCustomers,
  onAddToDirectory,
  onOpenDirectory,
}: {
  customers: Customer[];
  setCustomers: React.Dispatch<React.SetStateAction<Customer[]>>;
  onAddToDirectory?: (customer: Customer) => void;
  onOpenDirectory?: () => void;
}) {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.phone.includes(search) ||
    c.email.toLowerCase().includes(search.toLowerCase())
  );

  // Customers that originated from the directory have id starting with 'dir-'
  const isFromDirectory = (id: string) => id.startsWith('dir-');

  return (
    <div className="h-full bg-white rounded-2xl shadow-lg ring-1 ring-slate-200/60 overflow-hidden flex flex-col">
      <div className="flex-shrink-0 flex items-center justify-between px-5 py-3 bg-gradient-to-r from-slate-50 to-white border-b border-slate-200">
        <div className="flex items-center gap-3">
          <Users className="h-5 w-5 text-cyan-600" />
          <h2 className="text-base font-bold text-slate-800">Customer Database</h2>
          <Badge variant="outline" className="font-mono text-xs">{customers.length} customers</Badge>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search customers..." className="h-9 pl-8 pr-3 rounded-lg bg-slate-100 text-sm outline-none focus:ring-2 focus:ring-cyan-400 w-48" />
          </div>
          {onOpenDirectory && (
            <Button
              variant="outline"
              onClick={onOpenDirectory}
              className="border-cyan-300 text-cyan-700 hover:bg-cyan-50"
              title="Open Phone Directory"
            >
              <BookOpen className="h-4 w-4" /> Directory
            </Button>
          )}
          <Button className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700">
            <Plus className="h-4 w-4" /> Add
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-5">
          {filtered.map(c => {
            const fromDir = isFromDirectory(c.id);
            return (
              <div
                key={c.id}
                className={cn(
                  "bg-white rounded-xl ring-1 p-4 shadow-sm hover:shadow-md transition",
                  fromDir ? "ring-amber-200 bg-amber-50/30" : "ring-slate-200"
                )}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-cyan-100 to-blue-100 flex items-center justify-center text-cyan-600 font-bold text-lg">
                    {c.name.charAt(0)}
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => toast({ title: "Edit Customer", description: c.name })} className="h-7 w-7 rounded-md bg-blue-100 text-blue-600 hover:bg-blue-200 flex items-center justify-center" title="Edit">
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    {!fromDir && onAddToDirectory && (
                      <button
                        onClick={() => onAddToDirectory(c)}
                        className="h-7 w-7 rounded-md bg-amber-100 text-amber-700 hover:bg-amber-200 flex items-center justify-center"
                        title="Add to Phone Directory"
                      >
                        <UserPlus className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => setCustomers(prev => prev.filter(x => x.id !== c.id))}
                      className="h-7 w-7 rounded-md bg-rose-100 text-rose-600 hover:bg-rose-200 flex items-center justify-center"
                      title="Remove"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <div className="font-bold text-slate-800 flex items-center gap-1.5">
                  {c.name}
                  {fromDir && (
                    <Badge variant="secondary" className="text-[9px] bg-amber-100 text-amber-700">from Directory</Badge>
                  )}
                </div>
                <div className="text-xs text-slate-500 space-y-1 mt-2">
                  <div className="flex items-center gap-1.5"><Phone className="h-3 w-3" /> {c.phone}</div>
                  <div className="flex items-center gap-1.5"><MapPin className="h-3 w-3" /> {c.address}</div>
                  {c.lastOrder && <div className="flex items-center gap-1.5"><Calendar className="h-3 w-3" /> Last: {c.lastOrder}</div>}
                </div>
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
                  <Badge variant="secondary" className="text-xs bg-cyan-100 text-cyan-700">{c.totalOrders} orders</Badge>
                  <div className="text-right">
                    <div className="text-[10px] text-slate-500">Total Spent</div>
                    <div className="text-sm font-bold font-mono text-cyan-600">{formatGHS(c.totalSpent)}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}

// ===== Call Log Tab =====
function CallLog({ log, setLog }: {
  log: CallLogEntry[];
  setLog: React.Dispatch<React.SetStateAction<CallLogEntry[]>>;
}) {
  const dirConfig = {
    incoming: { icon: PhoneCall, color: "text-emerald-600", bg: "bg-emerald-100", label: "Incoming" },
    outgoing: { icon: Phone, color: "text-blue-600", bg: "bg-blue-100", label: "Outgoing" },
    missed: { icon: Phone, color: "text-rose-600", bg: "bg-rose-100", label: "Missed" },
  };

  return (
    <div className="h-full bg-white rounded-2xl shadow-lg ring-1 ring-slate-200/60 overflow-hidden flex flex-col">
      <div className="flex-shrink-0 flex items-center justify-between px-5 py-3 bg-gradient-to-r from-slate-50 to-white border-b border-slate-200">
        <div className="flex items-center gap-3">
          <Clock className="h-5 w-5 text-cyan-600" />
          <h2 className="text-base font-bold text-slate-800">Call Log</h2>
          <Badge variant="outline" className="font-mono text-xs">{log.length} calls</Badge>
        </div>
        <Button className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700">
          <Plus className="h-4 w-4" /> Log Call
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-2">
          {log.map(entry => {
            const cfg = dirConfig[entry.direction];
            return (
              <div key={entry.id} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition">
                <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center", cfg.bg)}>
                  <cfg.icon className={cn("h-5 w-5", cfg.color)} />
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-slate-800 text-sm">{entry.customer}</div>
                  <div className="text-xs text-slate-500 font-mono">{entry.phone} · {entry.time}</div>
                  {entry.notes && <div className="text-xs text-slate-500 italic mt-0.5">📝 {entry.notes}</div>}
                </div>
                <div className="text-right">
                  <Badge variant="outline" className={cn("text-[10px]", cfg.color, cfg.bg, "border-transparent")}>{cfg.label}</Badge>
                  <div className="text-xs text-slate-400 font-mono mt-1">{entry.duration}</div>
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
