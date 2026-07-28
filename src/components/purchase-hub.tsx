"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Truck, Package, Users, History, DollarSign, Plus, X,
  Archive, Search, TrendingUp, Filter, Eye, Star, AlertTriangle,
  FileBarChart2, FileText, Send, CreditCard, Wallet, Shield, Ban,
  CheckCircle2, Clock, MessageCircle, Brain, Tag, Loader2,
  ChevronDown, ChevronRight, ArrowUpRight, AlertCircle, Banknote,
  Receipt, RotateCcw, Scale,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { COMPANY, formatGHS } from "@/lib/pos-data";

interface PurchaseHubProps {
  onBack: () => void;
  onNewPO?: () => void;
  onOpenSuppliers?: () => void;
}

type Tab = "overview" | "orders" | "invoices" | "returns" | "performance" | "payments";

interface Purchase {
  id: string;
  refNo: string;
  supplierName: string;
  supplier?: { id: string; name: string; code: string; phone: string; mobile: string; blacklist?: boolean };
  status: string;
  total: number;
  amountPaid: number;
  createdAt: string;
  receivedAt: string | null;
  expectedAt: string | null;
  currency: string;
  items: any[];
  _count?: { items: number };
}

interface SupplierInvoice {
  id: string;
  invoiceNo: string;
  invoiceDate: string;
  invoiceTotal: number;
  matchStatus: string; // pending | matched | variance | rejected
  varianceAmount: number;
  variancePct: number;
  notes: string;
  supplier?: { id: string; name: string; code: string; tin: string };
  purchase?: { id: string; refNo: string; total: number } | null;
  matchedBy?: { fullName: string } | null;
  matchedAt: string | null;
}

interface SupplierReturn {
  id: string;
  returnNo: string;
  returnType: string;
  status: string;
  totalValue: number;
  notes: string;
  createdAt: string;
  supplier?: { id: string; name: string; code: string };
  purchase?: { id: string; refNo: string } | null;
  items: any[];
}

interface Payment {
  id: string;
  amount: number;
  paymentDate: string;
  paymentMode: string;
  reference: string;
  notes: string;
  whtRate: number;
  whtAmount: number;
  whtCertificateNo: string;
  earlyPayDiscountApplied: number;
  earlyPayDiscountPctUsed: number;
  status: string;
  supplier?: { id: string; name: string; code: string };
  purchase?: { id: string; refNo: string } | null;
  user?: { fullName: string } | null;
}

export function PurchaseHub({ onBack, onNewPO, onOpenSuppliers }: PurchaseHubProps) {
  const [tab, setTab] = useState<Tab>("overview");
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [invoices, setInvoices] = useState<SupplierInvoice[]>([]);
  const [returns, setReturns] = useState<SupplierReturn[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const { toast } = useToast();

  // ===== Data fetching =====
  const fetchPurchases = useCallback(async () => {
    try {
      const res = await fetch("/api/purchases?limit=200");
      if (!res.ok) throw new Error("Failed to fetch purchases");
      const data = await res.json();
      setPurchases(data.purchases || []);
    } catch (e) {
      console.error(e);
      toast({ title: "Failed to load purchases", variant: "destructive" });
    }
  }, [toast]);

  const fetchInvoices = useCallback(async () => {
    try {
      const res = await fetch("/api/supplier-invoices?limit=200");
      if (!res.ok) throw new Error("Failed to fetch invoices");
      const data = await res.json();
      setInvoices(data.invoices || []);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const fetchReturns = useCallback(async () => {
    try {
      const res = await fetch("/api/supplier-returns?limit=200");
      if (!res.ok) throw new Error("Failed to fetch returns");
      const data = await res.json();
      setReturns(data.returns || []);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const fetchPayments = useCallback(async () => {
    try {
      const res = await fetch("/api/supplier-payments?limit=200");
      if (!res.ok) throw new Error("Failed to fetch payments");
      const data = await res.json();
      setPayments(data.payments || []);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      await Promise.all([fetchPurchases(), fetchInvoices(), fetchReturns(), fetchPayments()]);
      if (mounted) setLoading(false);
    })();
    return () => { mounted = false; };
  }, []);

  // ===== Derived stats =====
  const stats = {
    totalPOs: purchases.length,
    pendingPOs: purchases.filter(p => p.status === "ordered").length,
    receivedPOs: purchases.filter(p => p.status === "received").length,
    draftPOs: purchases.filter(p => p.status === "draft").length,
    totalSpend: purchases.filter(p => p.status === "received").reduce((s, p) => s + p.total, 0),
    outstandingPayables: purchases
      .filter(p => p.status === "received")
      .reduce((s, p) => s + Math.max(0, p.total - p.amountPaid), 0),
    pendingInvoices: invoices.filter(i => i.matchStatus === "pending" || i.matchStatus === "variance").length,
    pendingReturns: returns.filter(r => r.status === "pending" || r.status === "shipped").length,
    blacklistedSuppliers: purchases.filter(p => p.supplier?.blacklist).length,
  };

  // ===== Filters =====
  const filteredPurchases = purchases.filter(p => {
    if (statusFilter && p.status !== statusFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      p.refNo.toLowerCase().includes(q) ||
      (p.supplierName || "").toLowerCase().includes(q) ||
      (p.supplier?.name || "").toLowerCase().includes(q)
    );
  });

  const tabs: { id: Tab; label: string; icon: any; badge?: number }[] = [
    { id: "overview", label: "Overview", icon: TrendingUp },
    { id: "orders", label: "Purchase Orders", icon: Archive, badge: purchases.length },
    { id: "invoices", label: "Invoice Matching", icon: Receipt, badge: stats.pendingInvoices || undefined },
    { id: "returns", label: "Returns", icon: RotateCcw, badge: stats.pendingReturns || undefined },
    { id: "performance", label: "Performance", icon: Star },
    { id: "payments", label: "Payments", icon: DollarSign },
  ];

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-slate-50 to-amber-50/30">
      {/* Header */}
      <header className="flex-shrink-0 bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 text-white shadow-lg">
        <div className="flex items-center justify-between px-4 sm:px-6 py-3">
          <div className="flex items-center gap-4 min-w-0">
            <button onClick={onBack} className="h-9 w-9 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition flex-shrink-0">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="h-9 w-9 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center ring-1 ring-white/20 flex-shrink-0">
                <Truck className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="font-bold text-base leading-tight">Purchase Hub</div>
                <div className="text-[10px] text-amber-100/90 truncate">{COMPANY.name} · Real-time procurement</div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {onOpenSuppliers && (
              <Button onClick={() => {
                // Open suppliers in the same tab but remember to return to hub
                if (typeof window !== "undefined") {
                  try { sessionStorage.setItem("sylhn-return-to", "purchase-hub"); } catch {}
                }
                onOpenSuppliers();
              }} variant="secondary" size="sm" className="bg-white/15 hover:bg-white/25 text-white border-0">
                <Users className="h-4 w-4" /> <span className="hidden sm:inline">Suppliers</span>
              </Button>
            )}
            {onNewPO && (
              <Button onClick={() => {
                // Open PO form in the same tab but remember to return to hub
                if (typeof window !== "undefined") {
                  try { sessionStorage.setItem("sylhn-return-to", "purchase-hub"); } catch {}
                }
                onNewPO();
              }} size="sm" className="bg-white text-amber-700 hover:bg-amber-50 font-bold">
                <Plus className="h-4 w-4" /> New PO
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Sub-navigation */}
      <nav className="flex-shrink-0 bg-white border-b border-slate-200 shadow-sm">
        <div className="flex items-center gap-1.5 px-3 sm:px-6 py-2 overflow-x-auto scrollbar-hide">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all whitespace-nowrap flex-shrink-0 active:scale-95",
                tab === t.id ? "bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-md" : "text-slate-600 hover:bg-slate-100"
              )}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
              {t.badge !== undefined && t.badge > 0 && (
                <span className={cn(
                  "px-1.5 py-0 rounded-full text-[9px] font-bold",
                  tab === t.id ? "bg-white/25 text-white" : "bg-amber-100 text-amber-700"
                )}>
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </nav>

      {/* Content */}
      <main className="flex-1 overflow-hidden p-3 sm:p-6">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <Loader2 className="h-10 w-10 animate-spin text-amber-500 mx-auto mb-3" />
              <p className="text-sm text-slate-500">Loading purchase data…</p>
            </div>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="h-full"
            >
              {tab === "overview" && <OverviewTab stats={stats} purchases={purchases} invoices={invoices} returns={returns} payments={payments} onTab={setTab} />}
              {tab === "orders" && <OrdersTab purchases={filteredPurchases} search={search} setSearch={setSearch} statusFilter={statusFilter} setStatusFilter={setStatusFilter} onRefresh={fetchPurchases} />}
              {tab === "invoices" && <InvoicesTab invoices={invoices} onRefresh={fetchInvoices} />}
              {tab === "returns" && <ReturnsTab returns={returns} onRefresh={fetchReturns} />}
              {tab === "performance" && <PerformanceTab purchases={purchases} />}
              {tab === "payments" && <PaymentsTab payments={payments} onRefresh={fetchPayments} />}
            </motion.div>
          </AnimatePresence>
        )}
      </main>
    </div>
  );
}

// ============================================================
// OVERVIEW TAB
// ============================================================
function OverviewTab({ stats, purchases, invoices, returns, payments, onTab }: {
  stats: any;
  purchases: Purchase[];
  invoices: SupplierInvoice[];
  returns: SupplierReturn[];
  payments: Payment[];
  onTab: (t: Tab) => void;
}) {
  const kpis = [
    { label: "Total POs", value: stats.totalPOs, icon: Archive, color: "from-blue-500 to-indigo-600", detail: `${stats.receivedPOs} received · ${stats.pendingPOs} pending` },
    { label: "Total Spend", value: formatGHS(stats.totalSpend), icon: DollarSign, color: "from-emerald-500 to-teal-600", detail: "Received POs" },
    { label: "Outstanding Payables", value: formatGHS(stats.outstandingPayables), icon: Wallet, color: "from-rose-500 to-pink-600", detail: "Owed to suppliers" },
    { label: "Pending Invoices", value: stats.pendingInvoices, icon: Receipt, color: "from-amber-500 to-orange-600", detail: "Need matching", onClick: () => onTab("invoices") },
  ];

  const recentPOs = purchases.slice(0, 5);
  const recentPayments = payments.slice(0, 5);
  const alerts: { type: string; msg: string; severity: "warning" | "info"; action?: () => void }[] = [];
  if (stats.pendingInvoices > 0) alerts.push({ type: "Invoices", msg: `${stats.pendingInvoices} supplier invoice(s) need matching`, severity: "warning", action: () => onTab("invoices") });
  if (stats.pendingReturns > 0) alerts.push({ type: "Returns", msg: `${stats.pendingReturns} return(s) awaiting supplier credit`, severity: "warning", action: () => onTab("returns") });
  if (stats.blacklistedSuppliers > 0) alerts.push({ type: "Blacklist", msg: `${stats.blacklistedSuppliers} PO(s) with blacklisted supplier — review`, severity: "warning" });

  return (
    <div className="h-full overflow-y-auto scroll-premium space-y-4">
      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map(k => (
          <button
            key={k.label}
            onClick={k.onClick}
            className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 p-4 text-left hover:shadow-md transition"
          >
            <div className={cn("h-9 w-9 rounded-lg bg-gradient-to-br flex items-center justify-center mb-2", k.color)}>
              <k.icon className="h-4 w-4 text-white" />
            </div>
            <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">{k.label}</div>
            <div className="text-lg font-bold text-slate-800 mt-0.5 truncate">{k.value}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">{k.detail}</div>
          </button>
        ))}
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((a, i) => (
            <button
              key={i}
              onClick={a.action}
              className={cn(
                "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl ring-1 text-left transition",
                a.severity === "warning"
                  ? "bg-amber-50 ring-amber-200 hover:bg-amber-100"
                  : "bg-blue-50 ring-blue-200 hover:bg-blue-100"
              )}
            >
              <AlertTriangle className={cn("h-4 w-4 flex-shrink-0", a.severity === "warning" ? "text-amber-600" : "text-blue-600")} />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-slate-800">{a.type}</div>
                <div className="text-[11px] text-slate-600">{a.msg}</div>
              </div>
              {a.action && <ChevronRight className="h-4 w-4 text-slate-400" />}
            </button>
          ))}
        </div>
      )}

      {/* Recent POs + Recent Payments */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Archive className="h-4 w-4 text-amber-600" /> Recent POs
            </h3>
            <button onClick={() => onTab("orders")} className="text-[10px] font-bold text-amber-600 hover:text-amber-700">View all →</button>
          </div>
          <div className="divide-y divide-slate-100">
            {recentPOs.length === 0 ? (
              <div className="px-4 py-6 text-center text-xs text-slate-400">No purchase orders yet</div>
            ) : recentPOs.map(p => (
              <div key={p.id} className="px-4 py-2.5 flex items-center gap-3 hover:bg-slate-50">
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-slate-800 font-mono truncate">{p.refNo}</div>
                  <div className="text-[10px] text-slate-500 truncate">{p.supplier?.name || p.supplierName}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-bold text-slate-800">{formatGHS(p.total)}</div>
                  <StatusBadge status={p.status} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-emerald-600" /> Recent Payments
            </h3>
            <button onClick={() => onTab("payments")} className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700">View all →</button>
          </div>
          <div className="divide-y divide-slate-100">
            {recentPayments.length === 0 ? (
              <div className="px-4 py-6 text-center text-xs text-slate-400">No payments recorded yet</div>
            ) : recentPayments.map(p => (
              <div key={p.id} className="px-4 py-2.5 flex items-center gap-3 hover:bg-slate-50">
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-slate-800 truncate">{p.supplier?.name || "—"}</div>
                  <div className="text-[10px] text-slate-500">
                    {new Date(p.paymentDate).toLocaleDateString("en-GB")} · {p.paymentMode}
                    {p.whtAmount > 0 && <span className="text-rose-600 font-semibold"> · WHT {formatGHS(p.whtAmount)}</span>}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-bold text-emerald-700">{formatGHS(p.amount)}</div>
                  {p.earlyPayDiscountApplied > 0 && <div className="text-[9px] text-amber-600 font-semibold">saved {formatGHS(p.earlyPayDiscountApplied)}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// ORDERS TAB
// ============================================================
function OrdersTab({ purchases, search, setSearch, statusFilter, setStatusFilter, onRefresh }: {
  purchases: Purchase[];
  search: string;
  setSearch: (s: string) => void;
  statusFilter: string;
  setStatusFilter: (s: string) => void;
  onRefresh: () => Promise<void>;
}) {
  const { toast } = useToast();
  const [viewPO, setViewPO] = useState<Purchase | null>(null);
  const [waPhone, setWaPhone] = useState("");
  const [waLink, setWaLink] = useState("");
  const [waText, setWaText] = useState("");
  const [showWhatsApp, setShowWhatsApp] = useState<Purchase | null>(null);

  const statusColors: Record<string, string> = {
    draft: "bg-slate-100 text-slate-700",
    ordered: "bg-blue-100 text-blue-700",
    received: "bg-emerald-100 text-emerald-700",
    cancelled: "bg-rose-100 text-rose-700",
  };

  const sendWhatsApp = async (purchase: Purchase) => {
    try {
      const phone = purchase.supplier?.mobile || purchase.supplier?.phone || "";
      setWaPhone(phone);
      setShowWhatsApp(purchase);
      const res = await fetch(`/api/purchases/${purchase.id}/whatsapp?phone=${encodeURIComponent(phone)}`);
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setWaLink(data.waLink);
      setWaText(data.text);
    } catch (e) {
      toast({ title: "Failed to generate WhatsApp link", variant: "destructive" });
    }
  };

  return (
    <div className="h-full bg-white rounded-2xl shadow-lg ring-1 ring-slate-200/60 overflow-hidden flex flex-col">
      <div className="flex-shrink-0 flex flex-wrap items-center justify-between gap-2 px-4 py-3 bg-gradient-to-r from-slate-50 to-white border-b border-slate-200">
        <div className="flex items-center gap-3">
          <Archive className="h-5 w-5 text-amber-600" />
          <h2 className="text-base font-bold text-slate-800">Purchase Orders</h2>
          <Badge variant="outline" className="font-mono text-xs">{purchases.length} shown</Badge>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search PO # or supplier…"
              className="h-9 pl-8 pr-3 rounded-lg bg-slate-100 text-sm outline-none focus:ring-2 focus:ring-amber-400 w-48"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 px-2 rounded-lg bg-slate-100 text-sm outline-none border-0"
          >
            <option value="">All Status</option>
            <option value="draft">Draft</option>
            <option value="ordered">Ordered</option>
            <option value="received">Received</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-slate-800 text-white text-[11px] uppercase tracking-wide z-10">
            <tr>
              <th className="text-left px-4 py-2.5 font-semibold">PO Ref</th>
              <th className="text-left px-3 py-2.5 font-semibold">Supplier</th>
              <th className="text-left px-3 py-2.5 font-semibold">Date</th>
              <th className="text-right px-3 py-2.5 font-semibold">Total</th>
              <th className="text-right px-3 py-2.5 font-semibold">Paid</th>
              <th className="text-center px-3 py-2.5 font-semibold">Status</th>
              <th className="text-center px-3 py-2.5 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {purchases.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                  <Archive className="h-10 w-10 mx-auto mb-2 opacity-40" />
                  <div className="text-sm font-bold">No purchase orders</div>
                  <div className="text-xs mt-1">Create one from the Purchase Form</div>
                </td>
              </tr>
            ) : purchases.map(p => (
              <tr key={p.id} className="hover:bg-amber-50/50 transition">
                <td className="px-4 py-2.5">
                  <div className="font-mono font-semibold text-slate-800 text-xs">{p.refNo}</div>
                  {p.supplier?.blacklist && (
                    <span className="inline-flex items-center gap-0.5 px-1 py-0 rounded bg-rose-100 text-rose-700 text-[9px] font-bold mt-0.5">
                      <Ban className="h-2.5 w-2.5" /> BLACKLISTED
                    </span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-slate-700 text-xs">{p.supplier?.name || p.supplierName || "—"}</td>
                <td className="px-3 py-2.5 text-slate-500 text-xs">{new Date(p.createdAt).toLocaleDateString("en-GB")}</td>
                <td className="px-3 py-2.5 text-right font-mono font-semibold text-slate-800 text-xs">{formatGHS(p.total)}</td>
                <td className="px-3 py-2.5 text-right font-mono text-xs text-emerald-700">{formatGHS(p.amountPaid)}</td>
                <td className="px-3 py-2.5 text-center">
                  <span className={cn("px-2 py-1 rounded-md text-[10px] font-bold uppercase", statusColors[p.status])}>{p.status}</span>
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center justify-center gap-1">
                    <button onClick={() => setViewPO(p)} className="h-7 w-7 rounded-md bg-blue-100 text-blue-600 hover:bg-blue-200 flex items-center justify-center transition" title="View">
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => sendWhatsApp(p)} className="h-7 w-7 rounded-md bg-green-100 text-green-600 hover:bg-green-200 flex items-center justify-center transition" title="Send via WhatsApp">
                      <MessageCircle className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollArea>

      {/* View PO modal */}
      <AnimatePresence>
        {viewPO && (
          <POViewModal purchase={viewPO} onClose={() => setViewPO(null)} onWhatsApp={() => { sendWhatsApp(viewPO); setViewPO(null); }} />
        )}
      </AnimatePresence>

      {/* WhatsApp modal */}
      <AnimatePresence>
        {showWhatsApp && (
          <WhatsAppModal
            purchase={showWhatsApp}
            phone={waPhone}
            setPhone={setWaPhone}
            waLink={waLink}
            waText={waText}
            onClose={() => setShowWhatsApp(null)}
            onRegenerate={async (phone) => {
              const res = await fetch(`/api/purchases/${showWhatsApp.id}/whatsapp?phone=${encodeURIComponent(phone)}`);
              const data = await res.json();
              setWaLink(data.waLink);
              setWaText(data.text);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================
// INVOICE MATCHING TAB (T1.3)
// ============================================================
function InvoicesTab({ invoices, onRefresh }: { invoices: SupplierInvoice[]; onRefresh: () => Promise<void> }) {
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [filter, setFilter] = useState<string>("");

  const filtered = filter ? invoices.filter(i => i.matchStatus === filter) : invoices;

  const resolveInvoice = async (id: string, action: "match" | "reject", notes?: string) => {
    try {
      const res = await fetch(`/api/supplier-invoices/${id}/match`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, notes }),
      });
      if (!res.ok) throw new Error("Failed");
      toast({ title: `Invoice ${action === "match" ? "matched" : "rejected"}`, variant: action === "match" ? "default" : "destructive" });
      await onRefresh();
    } catch (e) {
      toast({ title: "Failed to resolve invoice", variant: "destructive" });
    }
  };

  const statusColors: Record<string, string> = {
    pending: "bg-slate-100 text-slate-700",
    matched: "bg-emerald-100 text-emerald-700",
    variance: "bg-amber-100 text-amber-700",
    rejected: "bg-rose-100 text-rose-700",
  };

  return (
    <div className="h-full bg-white rounded-2xl shadow-lg ring-1 ring-slate-200/60 overflow-hidden flex flex-col">
      <div className="flex-shrink-0 flex flex-wrap items-center justify-between gap-2 px-4 py-3 bg-gradient-to-r from-slate-50 to-white border-b border-slate-200">
        <div className="flex items-center gap-3">
          <Receipt className="h-5 w-5 text-amber-600" />
          <h2 className="text-base font-bold text-slate-800">Supplier Invoice Matching</h2>
          <Badge variant="outline" className="font-mono text-xs">{filtered.length} shown</Badge>
        </div>
        <div className="flex items-center gap-2">
          <select value={filter} onChange={(e) => setFilter(e.target.value)} className="h-9 px-2 rounded-lg bg-slate-100 text-sm outline-none border-0">
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="matched">Matched</option>
            <option value="variance">Variance</option>
            <option value="rejected">Rejected</option>
          </select>
          <Button onClick={() => setShowCreate(true)} size="sm" className="bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700">
            <Plus className="h-4 w-4" /> New Invoice
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-slate-800 text-white text-[11px] uppercase tracking-wide z-10">
            <tr>
              <th className="text-left px-4 py-2.5 font-semibold">Invoice #</th>
              <th className="text-left px-3 py-2.5 font-semibold">Supplier</th>
              <th className="text-left px-3 py-2.5 font-semibold">Linked PO</th>
              <th className="text-right px-3 py-2.5 font-semibold">Invoice Total</th>
              <th className="text-right px-3 py-2.5 font-semibold">Variance</th>
              <th className="text-center px-3 py-2.5 font-semibold">Status</th>
              <th className="text-center px-3 py-2.5 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                  <Receipt className="h-10 w-10 mx-auto mb-2 opacity-40" />
                  <div className="text-sm font-bold">No supplier invoices</div>
                  <div className="text-xs mt-1">Record an invoice from a supplier to start three-way matching</div>
                </td>
              </tr>
            ) : filtered.map(inv => (
              <tr key={inv.id} className="hover:bg-amber-50/50 transition">
                <td className="px-4 py-2.5 font-mono font-semibold text-slate-800 text-xs">{inv.invoiceNo}</td>
                <td className="px-3 py-2.5 text-slate-700 text-xs">
                  <div>{inv.supplier?.name || "—"}</div>
                  {inv.supplier?.tin && <div className="text-[9px] text-slate-400 font-mono">TIN: {inv.supplier.tin}</div>}
                </td>
                <td className="px-3 py-2.5 text-slate-600 text-xs font-mono">{inv.purchase?.refNo || "—"}</td>
                <td className="px-3 py-2.5 text-right font-mono font-semibold text-slate-800 text-xs">{formatGHS(inv.invoiceTotal)}</td>
                <td className={cn("px-3 py-2.5 text-right font-mono text-xs font-bold", Math.abs(inv.variancePct) > 5 ? "text-rose-600" : Math.abs(inv.variancePct) > 1 ? "text-amber-600" : "text-emerald-600")}>
                  {inv.varianceAmount !== 0 ? `${inv.varianceAmount > 0 ? "+" : ""}${formatGHS(inv.varianceAmount)} (${inv.variancePct.toFixed(1)}%)` : "—"}
                </td>
                <td className="px-3 py-2.5 text-center">
                  <span className={cn("px-2 py-1 rounded-md text-[10px] font-bold uppercase", statusColors[inv.matchStatus])}>{inv.matchStatus}</span>
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center justify-center gap-1">
                    {(inv.matchStatus === "pending" || inv.matchStatus === "variance") && (
                      <>
                        <button onClick={() => resolveInvoice(inv.id, "match")} className="h-7 px-2 rounded-md bg-emerald-100 text-emerald-700 hover:bg-emerald-200 flex items-center gap-1 text-[10px] font-bold transition" title="Accept as matched">
                          <CheckCircle2 className="h-3 w-3" /> Match
                        </button>
                        <button onClick={() => resolveInvoice(inv.id, "reject")} className="h-7 px-2 rounded-md bg-rose-100 text-rose-700 hover:bg-rose-200 flex items-center gap-1 text-[10px] font-bold transition" title="Reject invoice">
                          <X className="h-3 w-3" /> Reject
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollArea>

      <AnimatePresence>
        {showCreate && <CreateInvoiceModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); onRefresh(); }} />}
      </AnimatePresence>
    </div>
  );
}

// ============================================================
// RETURNS TAB (T1.4)
// ============================================================
function ReturnsTab({ returns, onRefresh }: { returns: SupplierReturn[]; onRefresh: () => Promise<void> }) {
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);

  const statusColors: Record<string, string> = {
    pending: "bg-amber-100 text-amber-700",
    shipped: "bg-blue-100 text-blue-700",
    received_by_supplier: "bg-indigo-100 text-indigo-700",
    credit_issued: "bg-emerald-100 text-emerald-700",
    cancelled: "bg-rose-100 text-rose-700",
  };

  return (
    <div className="h-full bg-white rounded-2xl shadow-lg ring-1 ring-slate-200/60 overflow-hidden flex flex-col">
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 bg-gradient-to-r from-slate-50 to-white border-b border-slate-200">
        <div className="flex items-center gap-3">
          <RotateCcw className="h-5 w-5 text-amber-600" />
          <h2 className="text-base font-bold text-slate-800">Returns to Suppliers</h2>
          <Badge variant="outline" className="font-mono text-xs">{returns.length} total</Badge>
        </div>
        <Button onClick={() => setShowCreate(true)} size="sm" className="bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700">
          <Plus className="h-4 w-4" /> New Return
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-slate-800 text-white text-[11px] uppercase tracking-wide z-10">
            <tr>
              <th className="text-left px-4 py-2.5 font-semibold">Return #</th>
              <th className="text-left px-3 py-2.5 font-semibold">Supplier</th>
              <th className="text-left px-3 py-2.5 font-semibold">Type</th>
              <th className="text-center px-3 py-2.5 font-semibold">Items</th>
              <th className="text-right px-3 py-2.5 font-semibold">Value</th>
              <th className="text-center px-3 py-2.5 font-semibold">Status</th>
              <th className="text-left px-3 py-2.5 font-semibold">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {returns.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                  <RotateCcw className="h-10 w-10 mx-auto mb-2 opacity-40" />
                  <div className="text-sm font-bold">No returns recorded</div>
                  <div className="text-xs mt-1">Record a return when goods are damaged, expired, or wrong</div>
                </td>
              </tr>
            ) : returns.map(r => (
              <tr key={r.id} className="hover:bg-amber-50/50 transition">
                <td className="px-4 py-2.5 font-mono font-semibold text-slate-800 text-xs">{r.returnNo}</td>
                <td className="px-3 py-2.5 text-slate-700 text-xs">{r.supplier?.name || "—"}</td>
                <td className="px-3 py-2.5 text-slate-600 text-xs capitalize">{r.returnType.replace(/_/g, " ")}</td>
                <td className="px-3 py-2.5 text-center text-slate-700 text-xs">{r.items?.length || 0}</td>
                <td className="px-3 py-2.5 text-right font-mono font-semibold text-rose-600 text-xs">{formatGHS(r.totalValue)}</td>
                <td className="px-3 py-2.5 text-center">
                  <span className={cn("px-2 py-1 rounded-md text-[10px] font-bold uppercase", statusColors[r.status])}>{r.status.replace(/_/g, " ")}</span>
                </td>
                <td className="px-3 py-2.5 text-slate-500 text-xs">{new Date(r.createdAt).toLocaleDateString("en-GB")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollArea>

      <AnimatePresence>
        {showCreate && <CreateReturnModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); onRefresh(); }} />}
      </AnimatePresence>
    </div>
  );
}

// ============================================================
// PERFORMANCE TAB (T1.5)
// ============================================================
function PerformanceTab({ purchases }: { purchases: Purchase[] }) {
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("");
  const [perf, setPerf] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [days, setDays] = useState(90);

  // Get unique suppliers from purchases
  const suppliers = Array.from(new Map(purchases.map(p => [p.supplier?.id || "", p.supplier] as [string, any]).values()).values()).filter(s => s && s.id) as any[];

  useEffect(() => {
    if (!selectedSupplierId) return;
    setLoading(true);
    setPerf(null);
    fetch(`/api/suppliers/${selectedSupplierId}/performance?days=${days}`)
      .then(r => r.json())
      .then(d => setPerf(d))
      .catch(e => console.error(e))
      .finally(() => setLoading(false));
  }, [selectedSupplierId, days]);

  return (
    <div className="h-full overflow-y-auto scroll-premium">
      <div className="bg-white rounded-2xl shadow-lg ring-1 ring-slate-200/60 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 bg-gradient-to-r from-slate-50 to-white border-b border-slate-200">
          <div className="flex items-center gap-3">
            <Star className="h-5 w-5 text-amber-600" />
            <h2 className="text-base font-bold text-slate-800">Supplier Performance Scorecard</h2>
          </div>
          <div className="flex items-center gap-2">
            <select value={selectedSupplierId} onChange={(e) => setSelectedSupplierId(e.target.value)} className="h-9 px-2 rounded-lg bg-slate-100 text-sm outline-none border-0 min-w-[200px]">
              <option value="">Select supplier…</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <select value={days} onChange={(e) => setDays(parseInt(e.target.value))} className="h-9 px-2 rounded-lg bg-slate-100 text-sm outline-none border-0">
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
              <option value={180}>Last 180 days</option>
              <option value={365}>Last year</option>
            </select>
          </div>
        </div>

        {!selectedSupplierId ? (
          <div className="px-4 py-16 text-center text-slate-400">
            <Star className="h-10 w-10 mx-auto mb-2 opacity-40" />
            <div className="text-sm font-bold">Select a supplier to view performance</div>
            <div className="text-xs mt-1">On-time %, fill-rate %, rejection %, avg lead time, total spend</div>
          </div>
        ) : loading ? (
          <div className="px-4 py-16 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-amber-500 mx-auto" />
          </div>
        ) : perf ? (
          <div className="p-4 space-y-4">
            {/* Star rating banner */}
            <div className="bg-gradient-to-br from-amber-50 to-yellow-50 rounded-xl p-4 ring-1 ring-amber-200 flex items-center gap-4">
              <div className="flex-shrink-0">
                <div className="flex items-center gap-0.5">
                  {[1, 2, 3, 4, 5].map(i => (
                    <Star key={i} className={cn("h-6 w-6", i <= perf.starRating ? "text-amber-500 fill-amber-400" : "text-slate-300")} />
                  ))}
                </div>
                <div className="text-center text-[10px] font-bold text-amber-700 mt-1">{perf.starRating}/5</div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-slate-800">{perf.supplierName}</div>
                <div className="text-xs text-slate-500">{perf.supplierCode} · {perf.totalOrders} PO{perf.totalOrders === 1 ? "" : "s"} in last {perf.days} days</div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  {perf.message && <span className="text-amber-700">{perf.message}</span>}
                </div>
              </div>
            </div>

            {/* KPI grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <PerfCard label="On-Time %" value={`${perf.onTimePct.toFixed(1)}%`} icon={Clock} color={perf.onTimePct >= 80 ? "emerald" : perf.onTimePct >= 60 ? "amber" : "rose"} detail={`${perf.totalOrders} POs`} />
              <PerfCard label="Fill Rate" value={`${perf.fillRatePct.toFixed(1)}%`} icon={Package} color={perf.fillRatePct >= 95 ? "emerald" : perf.fillRatePct >= 80 ? "amber" : "rose"} detail={`${perf.totalUnitsReceived}/${perf.totalUnitsOrdered} units`} />
              <PerfCard label="Rejection %" value={`${perf.rejectionPct.toFixed(1)}%`} icon={AlertTriangle} color={perf.rejectionPct <= 2 ? "emerald" : perf.rejectionPct <= 10 ? "amber" : "rose"} detail="Items short-shipped" />
              <PerfCard label="Avg Lead Time" value={`${perf.avgLeadTimeDays.toFixed(1)} days`} icon={TrendingUp} color="indigo" detail="Creation → receipt" />
            </div>

            {/* Total spend */}
            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl p-4 ring-1 ring-emerald-200">
              <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Total Spend (Last {perf.days} days)</div>
              <div className="text-2xl font-bold text-emerald-800 mt-1">{formatGHS(perf.totalSpend)}</div>
              <div className="text-xs text-emerald-700 mt-0.5">{perf.totalOrders} received PO{perf.totalOrders === 1 ? "" : "s"} · avg {formatGHS(perf.totalOrders > 0 ? perf.totalSpend / perf.totalOrders : 0)} per PO</div>
            </div>

            {/* Recent POs table */}
            {perf.recentPurchases && perf.recentPurchases.length > 0 && (
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Recent POs</h3>
                <div className="bg-white rounded-xl ring-1 ring-slate-200 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="text-left px-3 py-2">PO Ref</th>
                        <th className="text-left px-3 py-2">Created</th>
                        <th className="text-left px-3 py-2">Received</th>
                        <th className="text-right px-3 py-2">Total</th>
                        <th className="text-center px-3 py-2">On-time?</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {perf.recentPurchases.map((p: any) => (
                        <tr key={p.id}>
                          <td className="px-3 py-2 font-mono text-xs">{p.refNo}</td>
                          <td className="px-3 py-2 text-xs">{new Date(p.createdAt).toLocaleDateString("en-GB")}</td>
                          <td className="px-3 py-2 text-xs">{p.receivedAt ? new Date(p.receivedAt).toLocaleDateString("en-GB") : "—"}</td>
                          <td className="px-3 py-2 text-right font-mono text-xs">{formatGHS(p.total)}</td>
                          <td className="px-3 py-2 text-center">
                            {p.onTime === null ? <span className="text-slate-400 text-xs">—</span> :
                             p.onTime ? <CheckCircle2 className="h-4 w-4 text-emerald-500 mx-auto" /> :
                             <X className="h-4 w-4 text-rose-500 mx-auto" />}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ============================================================
// PAYMENTS TAB
// ============================================================
function PaymentsTab({ payments, onRefresh }: { payments: Payment[]; onRefresh: () => Promise<void> }) {
  const { toast } = useToast();
  const [showRecord, setShowRecord] = useState(false);

  return (
    <div className="h-full bg-white rounded-2xl shadow-lg ring-1 ring-slate-200/60 overflow-hidden flex flex-col">
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 bg-gradient-to-r from-slate-50 to-white border-b border-slate-200">
        <div className="flex items-center gap-3">
          <DollarSign className="h-5 w-5 text-emerald-600" />
          <h2 className="text-base font-bold text-slate-800">Supplier Payments</h2>
          <Badge variant="outline" className="font-mono text-xs">{payments.length} total</Badge>
        </div>
        <Button onClick={() => setShowRecord(true)} size="sm" className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700">
          <Plus className="h-4 w-4" /> Record Payment
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-slate-800 text-white text-[11px] uppercase tracking-wide z-10">
            <tr>
              <th className="text-left px-4 py-2.5 font-semibold">Date</th>
              <th className="text-left px-3 py-2.5 font-semibold">Supplier</th>
              <th className="text-left px-3 py-2.5 font-semibold">Method</th>
              <th className="text-right px-3 py-2.5 font-semibold">Amount</th>
              <th className="text-right px-3 py-2.5 font-semibold">WHT</th>
              <th className="text-right px-3 py-2.5 font-semibold">Early-Pay Saved</th>
              <th className="text-left px-3 py-2.5 font-semibold">Reference</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {payments.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                  <DollarSign className="h-10 w-10 mx-auto mb-2 opacity-40" />
                  <div className="text-sm font-bold">No payments recorded</div>
                  <div className="text-xs mt-1">Record a payment to a supplier — supports WHT + early-pay discounts</div>
                </td>
              </tr>
            ) : payments.map(p => (
              <tr key={p.id} className="hover:bg-emerald-50/30 transition">
                <td className="px-4 py-2.5 text-slate-500 text-xs">{new Date(p.paymentDate).toLocaleDateString("en-GB")}</td>
                <td className="px-3 py-2.5 text-slate-700 text-xs">{p.supplier?.name || "—"}</td>
                <td className="px-3 py-2.5 text-slate-600 text-xs capitalize">{p.paymentMode}</td>
                <td className="px-3 py-2.5 text-right font-mono font-semibold text-emerald-700 text-xs">{formatGHS(p.amount)}</td>
                <td className="px-3 py-2.5 text-right font-mono text-xs">
                  {p.whtAmount > 0 ? (
                    <span className="text-rose-600 font-semibold" title={`WHT ${p.whtRate * 100}% · cert: ${p.whtCertificateNo || "—"}`}>
                      {formatGHS(p.whtAmount)}
                    </span>
                  ) : <span className="text-slate-300">—</span>}
                </td>
                <td className="px-3 py-2.5 text-right font-mono text-xs">
                  {p.earlyPayDiscountApplied > 0 ? (
                    <span className="text-amber-600 font-semibold" title={`${p.earlyPayDiscountPctUsed}% early-pay discount`}>
                      {formatGHS(p.earlyPayDiscountApplied)}
                    </span>
                  ) : <span className="text-slate-300">—</span>}
                </td>
                <td className="px-3 py-2.5 text-slate-500 text-xs font-mono truncate max-w-[150px]">{p.reference || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollArea>

      <AnimatePresence>
        {showRecord && <RecordPaymentModal onClose={() => setShowRecord(false)} onRecorded={() => { setShowRecord(false); onRefresh(); }} />}
      </AnimatePresence>
    </div>
  );
}

// ============================================================
// SHARED COMPONENTS
// ============================================================
function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    draft: "bg-slate-100 text-slate-700",
    ordered: "bg-blue-100 text-blue-700",
    received: "bg-emerald-100 text-emerald-700",
    cancelled: "bg-rose-100 text-rose-700",
  };
  return <span className={cn("inline-block px-1.5 py-0.5 rounded text-[9px] font-bold uppercase", colors[status] || "bg-slate-100 text-slate-600")}>{status}</span>;
}

function PerfCard({ label, value, icon: Icon, color, detail }: { label: string; value: string; icon: any; color: string; detail?: string }) {
  const colors: Record<string, string> = {
    emerald: "from-emerald-500 to-teal-600",
    amber: "from-amber-500 to-orange-600",
    rose: "from-rose-500 to-pink-600",
    indigo: "from-indigo-500 to-blue-600",
  };
  return (
    <div className="bg-white rounded-xl ring-1 ring-slate-200 p-3">
      <div className={cn("h-8 w-8 rounded-lg bg-gradient-to-br flex items-center justify-center mb-2", colors[color])}>
        <Icon className="h-4 w-4 text-white" />
      </div>
      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</div>
      <div className="text-lg font-bold text-slate-800 mt-0.5">{value}</div>
      {detail && <div className="text-[10px] text-slate-400 mt-0.5">{detail}</div>}
    </div>
  );
}

function POViewModal({ purchase, onClose, onWhatsApp }: { purchase: Purchase; onClose: () => void; onWhatsApp: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] sm:max-h-[85vh] overflow-hidden flex flex-col"
      >
        <div className="flex-shrink-0 px-5 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            <h3 className="font-bold">PO {purchase.refNo}</h3>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onWhatsApp} className="h-8 px-3 rounded-lg bg-green-500/30 hover:bg-green-500/50 text-white text-xs font-bold flex items-center gap-1.5">
              <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
            </button>
            <button onClick={onClose} className="h-8 w-8 rounded-lg bg-white/15 hover:bg-white/25 flex items-center justify-center"><X className="h-4 w-4" /></button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-50 rounded-lg p-3">
              <div className="text-[10px] text-slate-500 uppercase font-semibold">Supplier</div>
              <div className="text-sm font-bold text-slate-800">{purchase.supplier?.name || purchase.supplierName || "—"}</div>
              {purchase.supplier?.phone && <div className="text-[10px] text-slate-500 mt-0.5">{purchase.supplier.phone}</div>}
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <div className="text-[10px] text-slate-500 uppercase font-semibold">Status</div>
              <StatusBadge status={purchase.status} />
              <div className="text-[10px] text-slate-500 mt-1">{new Date(purchase.createdAt).toLocaleDateString("en-GB")}</div>
            </div>
            {purchase.expectedAt && (
              <div className="bg-slate-50 rounded-lg p-3">
                <div className="text-[10px] text-slate-500 uppercase font-semibold">Expected Delivery</div>
                <div className="text-sm font-bold text-slate-800">{new Date(purchase.expectedAt).toLocaleDateString("en-GB")}</div>
              </div>
            )}
            {purchase.receivedAt && (
              <div className="bg-slate-50 rounded-lg p-3">
                <div className="text-[10px] text-slate-500 uppercase font-semibold">Received</div>
                <div className="text-sm font-bold text-slate-800">{new Date(purchase.receivedAt).toLocaleDateString("en-GB")}</div>
              </div>
            )}
          </div>

          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Items ({purchase.items?.length || 0})</h4>
            <div className="bg-white rounded-xl ring-1 ring-slate-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="text-left px-3 py-2">Item</th>
                    <th className="text-center px-3 py-2">Qty</th>
                    <th className="text-right px-3 py-2">Cost</th>
                    <th className="text-right px-3 py-2">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {purchase.items?.map((it: any) => (
                    <tr key={it.id}>
                      <td className="px-3 py-2 text-xs">{it.emoji} {it.details}</td>
                      <td className="px-3 py-2 text-center text-xs">{it.quantity}{it.freeQuantity > 0 && <span className="text-emerald-600"> +{it.freeQuantity} free</span>}</td>
                      <td className="px-3 py-2 text-right font-mono text-xs">{formatGHS(it.cost)}</td>
                      <td className="px-3 py-2 text-right font-mono text-xs font-semibold">{formatGHS(it.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl p-3 ring-1 ring-emerald-200">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-slate-700">Total</span>
              <span className="text-xl font-bold text-emerald-700">{formatGHS(purchase.total)}</span>
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs text-slate-500">Paid</span>
              <span className="text-sm font-mono text-emerald-700">{formatGHS(purchase.amountPaid)}</span>
            </div>
            {purchase.amountPaid < purchase.total && (
              <div className="flex items-center justify-between mt-0.5">
                <span className="text-xs text-rose-600 font-semibold">Outstanding</span>
                <span className="text-sm font-mono font-bold text-rose-700">{formatGHS(purchase.total - purchase.amountPaid)}</span>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function WhatsAppModal({ purchase, phone, setPhone, waLink, waText, onClose, onRegenerate }: {
  purchase: Purchase;
  phone: string;
  setPhone: (s: string) => void;
  waLink: string;
  waText: string;
  onClose: () => void;
  onRegenerate: (phone: string) => Promise<void>;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] overflow-hidden flex flex-col"
      >
        <div className="flex-shrink-0 px-5 py-3 bg-[#25D366] text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            <h3 className="font-bold text-sm">Send PO via WhatsApp</h3>
          </div>
          <button onClick={onClose} className="h-7 w-7 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 block">Supplier Phone</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+233247075044"
              className="w-full h-10 px-3 rounded-lg bg-slate-100 text-sm font-mono outline-none focus:ring-2 focus:ring-emerald-400"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 block">PO Message Preview</label>
            <textarea
              readOnly
              value={waText}
              rows={10}
              className="w-full px-3 py-2 rounded-lg bg-slate-100 text-[10px] font-mono resize-none outline-none"
            />
          </div>
          <div className="text-[10px] text-slate-500">
            Tap "Open WhatsApp" to launch WhatsApp with this message pre-filled. The supplier receives it instantly.
          </div>
        </div>
        <div className="flex-shrink-0 p-4 border-t border-slate-200 space-y-2">
          <button onClick={() => onRegenerate(phone)} className="w-full h-10 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold flex items-center justify-center gap-1.5">
            Regenerate Link
          </button>
          <a href={waLink} target="_blank" rel="noopener noreferrer" className="w-full h-10 rounded-xl bg-[#25D366] hover:bg-[#1ebe57] text-white text-xs font-bold flex items-center justify-center gap-1.5 no-underline">
            <Send className="h-3.5 w-3.5" /> Open WhatsApp
          </a>
        </div>
      </motion.div>
    </motion.div>
  );
}

function CreateInvoiceModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { toast } = useToast();
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [form, setForm] = useState({ supplierId: "", purchaseId: "", invoiceNo: "", invoiceDate: new Date().toISOString().slice(0, 10), invoiceTotal: "", notes: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/suppliers?active=true&limit=500").then(r => r.json()).then(d => setSuppliers(d.suppliers || []));
    fetch("/api/purchases?status=received&limit=100").then(r => r.json()).then(d => setPurchases(d.purchases || []));
  }, []);

  const handleSubmit = async () => {
    if (!form.supplierId || !form.invoiceNo || !form.invoiceDate || !form.invoiceTotal) {
      toast({ title: "Fill in supplier, invoice #, date, and total", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/supplier-invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierId: form.supplierId,
          purchaseId: form.purchaseId || undefined,
          invoiceNo: form.invoiceNo,
          invoiceDate: form.invoiceDate,
          invoiceTotal: Number(form.invoiceTotal),
          notes: form.notes,
        }),
      });
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.error || "Failed");
      }
      const data = await res.json();
      toast({
        title: "Invoice recorded",
        description: `Status: ${data.invoice.matchStatus}${data.invoice.variancePct !== 0 ? ` · variance ${data.invoice.variancePct.toFixed(1)}%` : ""}`,
      });
      onCreated();
    } catch (e: any) {
      toast({ title: "Failed to record invoice", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] overflow-hidden flex flex-col"
      >
        <div className="flex-shrink-0 px-5 py-3 bg-gradient-to-r from-amber-600 to-orange-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            <h3 className="font-bold text-sm">Record Supplier Invoice</h3>
          </div>
          <button onClick={onClose} className="h-7 w-7 rounded-lg bg-white/15 hover:bg-white/25 flex items-center justify-center"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 block">Supplier *</label>
            <select value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value, purchaseId: "" })} className="w-full h-10 px-2 rounded-lg bg-slate-100 text-sm outline-none">
              <option value="">Select supplier…</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 block">Linked PO (optional — enables auto-matching)</label>
            <select value={form.purchaseId} onChange={(e) => setForm({ ...form, purchaseId: e.target.value })} className="w-full h-10 px-2 rounded-lg bg-slate-100 text-sm outline-none" disabled={!form.supplierId}>
              <option value="">No linked PO</option>
              {purchases.filter(p => !form.supplierId || p.supplierId === form.supplierId).map(p => <option key={p.id} value={p.id}>{p.refNo} · {formatGHS(p.total)}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 block">Invoice # *</label>
            <input value={form.invoiceNo} onChange={(e) => setForm({ ...form, invoiceNo: e.target.value })} className="w-full h-10 px-3 rounded-lg bg-slate-100 text-sm outline-none" placeholder="INV-2026-001" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 block">Invoice Date *</label>
              <input type="date" value={form.invoiceDate} onChange={(e) => setForm({ ...form, invoiceDate: e.target.value })} className="w-full h-10 px-2 rounded-lg bg-slate-100 text-sm outline-none" />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 block">Invoice Total (GHS) *</label>
              <input type="number" step="0.01" value={form.invoiceTotal} onChange={(e) => setForm({ ...form, invoiceTotal: e.target.value })} className="w-full h-10 px-3 rounded-lg bg-slate-100 text-sm outline-none" />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 block">Notes</label>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className="w-full px-3 py-2 rounded-lg bg-slate-100 text-sm outline-none resize-none" />
          </div>
          <div className="text-[10px] text-slate-500 bg-amber-50 ring-1 ring-amber-200 rounded-lg p-2">
            <strong>Auto-match:</strong> If linked to a PO, the system will compute variance vs PO total. Variance ≤1% auto-matches; 1–5% flags for review; &gt;5% requires manual resolution.
          </div>
        </div>
        <div className="flex-shrink-0 p-4 border-t border-slate-200 flex gap-2">
          <button onClick={onClose} className="flex-1 h-10 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold">Cancel</button>
          <button onClick={handleSubmit} disabled={saving} className="flex-1 h-10 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white text-xs font-bold disabled:opacity-50">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "Record Invoice"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function CreateReturnModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { toast } = useToast();
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [form, setForm] = useState({
    supplierId: "",
    purchaseId: "",
    returnType: "damaged",
    notes: "",
    items: [{ productId: "", partNo: "", details: "", quantity: 1, cost: 0, reason: "damaged" }],
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/suppliers?active=true&limit=500").then(r => r.json()).then(d => setSuppliers(d.suppliers || []));
  }, []);

  const handleSubmit = async () => {
    if (!form.supplierId || form.items.length === 0) {
      toast({ title: "Supplier and at least one item required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/supplier-returns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierId: form.supplierId,
          purchaseId: form.purchaseId || undefined,
          returnType: form.returnType,
          notes: form.notes,
          items: form.items.filter(it => it.details && it.quantity > 0),
        }),
      });
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.error || "Failed");
      }
      const data = await res.json();
      toast({ title: "Return created", description: `${data.return.returnNo} · ${formatGHS(data.return.totalValue)}` });
      onCreated();
    } catch (e: any) {
      toast({ title: "Failed to create return", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const updateItem = (i: number, field: string, value: any) => {
    setForm(f => ({
      ...f,
      items: f.items.map((it, idx) => idx === i ? { ...it, [field]: value } : it),
    }));
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
      >
        <div className="flex-shrink-0 px-5 py-3 bg-gradient-to-r from-rose-600 to-pink-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5" />
            <h3 className="font-bold text-sm">Return Goods to Supplier</h3>
          </div>
          <button onClick={onClose} className="h-7 w-7 rounded-lg bg-white/15 hover:bg-white/25 flex items-center justify-center"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 block">Supplier *</label>
              <select value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })} className="w-full h-10 px-2 rounded-lg bg-slate-100 text-sm outline-none">
                <option value="">Select…</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 block">Return Type</label>
              <select value={form.returnType} onChange={(e) => setForm({ ...form, returnType: e.target.value })} className="w-full h-10 px-2 rounded-lg bg-slate-100 text-sm outline-none">
                <option value="damaged">Damaged</option>
                <option value="expired">Expired</option>
                <option value="wrong_item">Wrong Item</option>
                <option value="quality">Quality Issue</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Items to Return</label>
              <button onClick={() => setForm(f => ({ ...f, items: [...f.items, { productId: "", partNo: "", details: "", quantity: 1, cost: 0, reason: f.returnType }] }))} className="text-[10px] font-bold text-amber-600 hover:text-amber-700">+ Add item</button>
            </div>
            <div className="space-y-2">
              {form.items.map((it, i) => (
                <div key={i} className="bg-slate-50 rounded-lg p-2 ring-1 ring-slate-200 grid grid-cols-12 gap-2 items-center">
                  <input value={it.details} onChange={(e) => updateItem(i, "details", e.target.value)} placeholder="Item name" className="col-span-5 h-8 px-2 rounded bg-white text-xs outline-none" />
                  <input type="number" value={it.quantity} onChange={(e) => updateItem(i, "quantity", parseInt(e.target.value) || 0)} placeholder="Qty" className="col-span-2 h-8 px-2 rounded bg-white text-xs outline-none" />
                  <input type="number" step="0.01" value={it.cost} onChange={(e) => updateItem(i, "cost", Number(e.target.value) || 0)} placeholder="Cost" className="col-span-3 h-8 px-2 rounded bg-white text-xs outline-none" />
                  <div className="col-span-2 text-right font-mono text-xs font-bold text-rose-600">{formatGHS(it.quantity * it.cost)}</div>
                  {form.items.length > 1 && (
                    <button onClick={() => setForm(f => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }))} className="col-span-12 text-[10px] text-rose-600 hover:text-rose-700 text-left">Remove</button>
                  )}
                </div>
              ))}
            </div>
            <div className="text-[10px] text-slate-500 mt-1 bg-amber-50 ring-1 ring-amber-200 rounded p-2">
              <strong>Stock will be decremented</strong> when the return is created. The supplier's balance is NOT changed until a credit note is issued.
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 block">Notes</label>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className="w-full px-3 py-2 rounded-lg bg-slate-100 text-sm outline-none resize-none" />
          </div>
        </div>
        <div className="flex-shrink-0 p-4 border-t border-slate-200 flex gap-2">
          <button onClick={onClose} className="flex-1 h-10 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold">Cancel</button>
          <button onClick={handleSubmit} disabled={saving} className="flex-1 h-10 rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700 text-white text-xs font-bold disabled:opacity-50">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "Create Return"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function RecordPaymentModal({ onClose, onRecorded }: { onClose: () => void; onRecorded: () => void }) {
  const { toast } = useToast();
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [form, setForm] = useState({
    supplierId: "",
    amount: "",
    paymentMode: "cash",
    paymentDate: new Date().toISOString().slice(0, 10),
    reference: "",
    notes: "",
    whtRate: "0",
    whtCertificateNo: "",
    earlyPayDiscountApplied: "",
  });
  const [earlyPayPreview, setEarlyPayPreview] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/suppliers?active=true&limit=500").then(r => r.json()).then(d => setSuppliers(d.suppliers || []));
  }, []);

  // Fetch early-pay discount preview when supplier + amount change
  useEffect(() => {
    if (!form.supplierId || !form.amount || Number(form.amount) <= 0) {
      setEarlyPayPreview(null);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/suppliers/${form.supplierId}/early-pay-discount?amount=${form.amount}`);
        if (res.ok) {
          const data = await res.json();
          setEarlyPayPreview(data);
        }
      } catch {}
    }, 300);
    return () => clearTimeout(t);
  }, [form.supplierId, form.amount]);

  const handleSubmit = async () => {
    if (!form.supplierId || !form.amount || Number(form.amount) <= 0) {
      toast({ title: "Supplier and positive amount required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/supplier-payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierId: form.supplierId,
          amount: Number(form.amount),
          paymentMode: form.paymentMode,
          paymentDate: form.paymentDate,
          reference: form.reference,
          notes: form.notes,
          whtRate: Number(form.whtRate) / 100, // convert percent to decimal
          whtCertificateNo: form.whtCertificateNo,
          earlyPayDiscountApplied: form.earlyPayDiscountApplied ? Number(form.earlyPayDiscountApplied) : 0,
          earlyPayDiscountPctUsed: earlyPayPreview?.earlyPayDiscountPct || 0,
        }),
      });
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.error || "Failed");
      }
      toast({ title: "Payment recorded", description: `${formatGHS(Number(form.amount))} to supplier` });
      onRecorded();
    } catch (e: any) {
      toast({ title: "Failed to record payment", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col"
      >
        <div className="flex-shrink-0 px-5 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            <h3 className="font-bold text-sm">Record Supplier Payment</h3>
          </div>
          <button onClick={onClose} className="h-7 w-7 rounded-lg bg-white/15 hover:bg-white/25 flex items-center justify-center"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 block">Supplier *</label>
            <select value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })} className="w-full h-10 px-2 rounded-lg bg-slate-100 text-sm outline-none">
              <option value="">Select supplier…</option>
              {suppliers.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name}{s.balance > 0 ? ` · owes GHS ${s.balance.toFixed(2)}` : ""}{s.tin ? ` · TIN ${s.tin}` : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 block">Amount (GHS) *</label>
              <input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="w-full h-10 px-3 rounded-lg bg-slate-100 text-sm outline-none" />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 block">Date</label>
              <input type="date" value={form.paymentDate} onChange={(e) => setForm({ ...form, paymentDate: e.target.value })} className="w-full h-10 px-2 rounded-lg bg-slate-100 text-sm outline-none" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 block">Method</label>
              <select value={form.paymentMode} onChange={(e) => setForm({ ...form, paymentMode: e.target.value })} className="w-full h-10 px-2 rounded-lg bg-slate-100 text-sm outline-none">
                <option value="cash">Cash</option>
                <option value="bank">Bank Transfer</option>
                <option value="cheque">Cheque</option>
                <option value="mobile-money">Mobile Money</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 block">Reference (cheque #, txn ref)</label>
              <input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} className="w-full h-10 px-3 rounded-lg bg-slate-100 text-sm outline-none" />
            </div>
          </div>

          {/* Early-pay discount preview */}
          {earlyPayPreview?.eligible && (
            <div className="bg-gradient-to-br from-amber-50 to-yellow-50 ring-1 ring-amber-200 rounded-lg p-2.5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-amber-700 flex items-center gap-1">
                <Wallet className="h-3 w-3" /> Early-Pay Discount Available
              </div>
              <div className="text-xs text-amber-900 mt-1">{earlyPayPreview.message}</div>
              <div className="grid grid-cols-2 gap-2 mt-1.5 text-[10px]">
                <div className="bg-white rounded px-2 py-1">
                  <div className="text-slate-500">Pay today</div>
                  <div className="font-bold text-emerald-700">{formatGHS(earlyPayPreview.netPayable)}</div>
                </div>
                <div className="bg-white rounded px-2 py-1">
                  <div className="text-slate-500">You save</div>
                  <div className="font-bold text-amber-700">{formatGHS(earlyPayPreview.discountAmount)}</div>
                </div>
              </div>
              <input type="number" step="0.01" value={form.earlyPayDiscountApplied} onChange={(e) => setForm({ ...form, earlyPayDiscountApplied: e.target.value })} placeholder={`Discount captured (default ${earlyPayPreview.discountAmount})`} className="w-full h-8 px-2 mt-2 rounded bg-white text-xs outline-none" />
            </div>
          )}

          {/* WHT section */}
          <div className="bg-rose-50 ring-1 ring-rose-200 rounded-lg p-2.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-rose-700 flex items-center gap-1">
              <Shield className="h-3 w-3" /> Withholding Tax (WHT) — GRA
            </div>
            <div className="text-[10px] text-rose-700 mt-0.5">Ghana requires 5-15% WHT on most supplier payments. The withheld amount goes to GRA, not the supplier.</div>
            <div className="grid grid-cols-2 gap-2 mt-1.5">
              <div>
                <label className="text-[9px] text-slate-600 font-bold">WHT Rate %</label>
                <input type="number" step="0.1" value={form.whtRate} onChange={(e) => setForm({ ...form, whtRate: e.target.value })} className="w-full h-8 px-2 rounded bg-white text-xs outline-none" placeholder="0" />
              </div>
              <div>
                <label className="text-[9px] text-slate-600 font-bold">WHT Cert. #</label>
                <input value={form.whtCertificateNo} onChange={(e) => setForm({ ...form, whtCertificateNo: e.target.value })} className="w-full h-8 px-2 rounded bg-white text-xs outline-none" placeholder="WHT-2026-001" />
              </div>
            </div>
            {Number(form.whtRate) > 0 && form.amount && (
              <div className="text-[10px] text-rose-700 mt-1">
                WHT amount: <strong>{formatGHS(Number(form.amount) * Number(form.whtRate) / 100)}</strong> · Supplier receives: <strong>{formatGHS(Number(form.amount) * (1 - Number(form.whtRate) / 100))}</strong>
              </div>
            )}
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 block">Notes</label>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className="w-full px-3 py-2 rounded-lg bg-slate-100 text-sm outline-none resize-none" />
          </div>
        </div>
        <div className="flex-shrink-0 p-4 border-t border-slate-200 flex gap-2">
          <button onClick={onClose} className="flex-1 h-10 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold">Cancel</button>
          <button onClick={handleSubmit} disabled={saving} className="flex-1 h-10 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold disabled:opacity-50">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "Record Payment"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
