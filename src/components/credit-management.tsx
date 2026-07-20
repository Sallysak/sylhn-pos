"use client";

import { useState, useEffect, useMemo, useCallback, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Plus, CreditCard, Wallet, AlertTriangle, TrendingUp,
  ArrowUpRight, ArrowDownRight, Phone, Mail, MapPin, X,
  CheckCircle2, Clock, FileText, Download, Filter, Loader2,
  User, DollarSign, Calendar, ChevronRight, Printer, RefreshCw,
  Sparkles, ShieldCheck, Ban, Award,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from "@/components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { formatGHS } from "@/lib/pos-data";

// ============= Types =============
interface Customer {
  id: string;
  name: string;
  phone: string;
  mobile: string;
  email: string;
  address: string;
  city: string;
  group: "regular" | "vip" | "wholesale";
  tier: "bronze" | "silver" | "gold" | "platinum";
  creditLimit: number;
  balance: number; // outstanding owed
  notes: string;
  active: boolean;
  pointsBalance: number;
  totalSpent: number;
  visits: number;
  lastVisitAt: string | null;
  createdAt: string;
  _count?: { sales: number };
}

interface CreditSale {
  id: string;
  invoiceNumber: string;
  createdAt: string;
  cashierName: string;
  total: number;
  creditAmountDue: number;
  creditDueDate: string | null;
  creditSettledAt: string | null;
  isOverdue: boolean;
  itemCount: number;
}

interface CreditAccount {
  customer: {
    id: string; name: string; phone: string; mobile: string; tier: string;
    creditLimit: number; currentBalance: number;
    totalOutstanding: number; availableCredit: number; overLimit: boolean;
    outstandingCount: number;
  };
  sales: CreditSale[];
  summary: {
    totalCreditSales: number;
    totalCreditIssued: number;
    totalOutstanding: number;
    totalSettled: number;
    overdueCount: number;
  };
}

type View = "list" | "detail";

// ============= Main Component =============
export function CreditManagement() {
  const [view, setView] = useState<View>("list");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState<string>("all");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [creditAccount, setCreditAccount] = useState<CreditAccount | null>(null);
  const [accountLoading, setAccountLoading] = useState(false);
  const [showSettleDialog, setShowSettleDialog] = useState(false);
  const { toast } = useToast();

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (groupFilter !== "all") params.set("group", groupFilter);
      params.set("limit", "500");
      const res = await fetch(`/api/customers?${params}`, { credentials: "include" });
      const data = await res.json();
      if (res.ok) {
        setCustomers(data.customers || []);
      } else {
        toast({ title: "Failed to load customers", description: data.error, variant: "destructive" });
      }
    } catch (e) {
      toast({ title: "Network error", description: "Could not reach server", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [search, groupFilter, toast]);

  useEffect(() => { fetchCustomers(); }, []); // initial load

  const debouncedSearch = useMemo(
    () => debounce((v: string) => { setSearch(v); }, 350),
    []
  );

  // Summary metrics
  const summary = useMemo(() => {
    const totalCustomers = customers.length;
    const withCredit = customers.filter(c => c.balance > 0);
    const totalOutstanding = withCredit.reduce((s, c) => s + c.balance, 0);
    const totalCreditLimit = customers.reduce((s, c) => s + c.creditLimit, 0);
    const overLimit = customers.filter(c => c.creditLimit > 0 && c.balance > c.creditLimit);
    return { totalCustomers, withCredit: withCredit.length, totalOutstanding, totalCreditLimit, overLimit: overLimit.length };
  }, [customers]);

  const openCustomer = async (c: Customer) => {
    setSelectedCustomer(c);
    setView("detail");
    setAccountLoading(true);
    try {
      const res = await fetch(`/api/customers/${c.id}/credit`, { credentials: "include" });
      const data = await res.json();
      if (res.ok) setCreditAccount(data);
      else toast({ title: "Failed to load credit account", description: data.error, variant: "destructive" });
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setAccountLoading(false);
    }
  };

  const refreshAccount = async () => {
    if (!selectedCustomer) return;
    setAccountLoading(true);
    try {
      const res = await fetch(`/api/customers/${selectedCustomer.id}/credit`, { credentials: "include" });
      const data = await res.json();
      if (res.ok) setCreditAccount(data);
    } catch {}
    setAccountLoading(false);
  };

  // ============= Render: List View =============
  if (view === "list") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
        {/* Header */}
        <div className="sticky top-0 z-10 backdrop-blur-xl bg-white/80 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800">
          <div className="max-w-7xl mx-auto px-6 py-5">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <CreditCard className="h-6 w-6 text-emerald-600" />
                  Credit Management
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                  Customer credit accounts, balances, and settlements
                </p>
              </div>
              <Button onClick={() => setShowAddDialog(true)} className="bg-emerald-600 hover:bg-emerald-700">
                <Plus className="h-4 w-4 mr-2" /> New Customer
              </Button>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
          {/* Summary KPI cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <KpiCard
              icon={<User className="h-5 w-5" />}
              label="Total Customers"
              value={summary.totalCustomers.toString()}
              accent="emerald"
            />
            <KpiCard
              icon={<Wallet className="h-5 w-5" />}
              label="Outstanding Credit"
              value={formatGHS(summary.totalOutstanding)}
              accent="rose"
              sub={`${summary.withCredit} customers`}
            />
            <KpiCard
              icon={<TrendingUp className="h-5 w-5" />}
              label="Credit Limit Pool"
              value={formatGHS(summary.totalCreditLimit)}
              accent="blue"
            />
            <KpiCard
              icon={<AlertTriangle className="h-5 w-5" />}
              label="Over Limit"
              value={summary.overLimit.toString()}
              accent="amber"
              sub="needs attention"
            />
          </div>

          {/* Search + filters */}
          <Card className="p-4 dark:bg-slate-900 dark:border-slate-800">
            <div className="flex flex-wrap gap-3 items-center">
              <div className="relative flex-1 min-w-[240px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search by name, phone, email…"
                  className="pl-10"
                  onChange={(e) => debouncedSearch(e.target.value)}
                />
              </div>
              <Select value={groupFilter} onValueChange={setGroupFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="All groups" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Groups</SelectItem>
                  <SelectItem value="regular">Regular</SelectItem>
                  <SelectItem value="vip">VIP</SelectItem>
                  <SelectItem value="wholesale">Wholesale</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={fetchCustomers} disabled={loading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Refresh
              </Button>
            </div>
          </Card>

          {/* Customer table */}
          <Card className="dark:bg-slate-900 dark:border-slate-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 uppercase text-xs">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Customer</th>
                    <th className="px-4 py-3 text-left font-semibold">Contact</th>
                    <th className="px-4 py-3 text-left font-semibold">Tier / Group</th>
                    <th className="px-4 py-3 text-right font-semibold">Credit Limit</th>
                    <th className="px-4 py-3 text-right font-semibold">Outstanding</th>
                    <th className="px-4 py-3 text-right font-semibold">Available</th>
                    <th className="px-4 py-3 text-center font-semibold">Status</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="text-center py-12 text-slate-500">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                        Loading customers…
                      </td>
                    </tr>
                  ) : customers.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-12 text-slate-500">
                        <User className="h-10 w-10 mx-auto mb-2 opacity-30" />
                        No customers found. Click "New Customer" to add one.
                      </td>
                    </tr>
                  ) : (
                    customers.map((c) => {
                      const available = Math.max(0, c.creditLimit - c.balance);
                      const overLimit = c.creditLimit > 0 && c.balance > c.creditLimit;
                      return (
                        <tr
                          key={c.id}
                          className="hover:bg-slate-50 dark:hover:bg-slate-800/30 cursor-pointer transition"
                          onClick={() => openCustomer(c)}
                        >
                          <td className="px-4 py-3">
                            <div className="font-semibold text-slate-900 dark:text-white">{c.name}</div>
                            {c._count?.sales !== undefined && (
                              <div className="text-xs text-slate-500">{c._count.sales} sales</div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                            <div>{c.phone || c.mobile || "—"}</div>
                            <div className="text-xs">{c.email || ""}</div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-col gap-1">
                              <Badge variant="outline" className={tierBadge(c.tier)}>
                                <Award className="h-3 w-3 mr-1" /> {c.tier}
                              </Badge>
                              <span className="text-xs text-slate-500 uppercase">{c.group}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-slate-700 dark:text-slate-200">
                            {c.creditLimit > 0 ? formatGHS(c.creditLimit) : "—"}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-semibold text-rose-600 dark:text-rose-400">
                            {c.balance > 0 ? formatGHS(c.balance) : "—"}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-emerald-700 dark:text-emerald-400">
                            {c.creditLimit > 0 ? formatGHS(available) : "—"}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {overLimit ? (
                              <Badge variant="destructive">Over Limit</Badge>
                            ) : c.balance > 0 ? (
                              <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                                Outstanding
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                                Settled
                              </Badge>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <ChevronRight className="h-4 w-4 text-slate-400" />
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        <AddCustomerDialog
          open={showAddDialog}
          onOpenChange={setShowAddDialog}
          onCreated={(c) => {
            fetchCustomers();
            openCustomer(c);
          }}
        />
      </div>
    );
  }

  // ============= Render: Detail View =============
  if (!selectedCustomer) return null;
  return (
    <CustomerCreditDetail
      customer={selectedCustomer}
      account={creditAccount}
      loading={accountLoading}
      onBack={() => { setView("list"); setSelectedCustomer(null); setCreditAccount(null); }}
      onRefresh={refreshAccount}
      onSettle={() => setShowSettleDialog(true)}
      showSettleDialog={showSettleDialog}
      onSettleDialogChange={setShowSettleDialog}
      onSettled={refreshAccount}
    />
  );
}

// ============= Customer Detail View =============
function CustomerCreditDetail({
  customer, account, loading, onBack, onRefresh, onSettle,
  showSettleDialog, onSettleDialogChange, onSettled,
}: {
  customer: Customer;
  account: CreditAccount | null;
  loading: boolean;
  onBack: () => void;
  onRefresh: () => void;
  onSettle: () => void;
  showSettleDialog: boolean;
  onSettleDialogChange: (v: boolean) => void;
  onSettled: () => void;
}) {
  const utilizationPct = account && customer.creditLimit > 0
    ? Math.min(100, (account.customer.totalOutstanding / customer.creditLimit) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      {/* Header */}
      <div className="sticky top-0 z-10 backdrop-blur-xl bg-white/80 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={onBack}>
              <ArrowUpRight className="h-4 w-4 rotate-180" /> Back
            </Button>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                {customer.name}
                <Badge variant="outline" className={tierBadge(customer.tier)}>
                  <Award className="h-3 w-3 mr-1" /> {customer.tier}
                </Badge>
              </h1>
              <p className="text-xs text-slate-500">{customer.group} customer · since {new Date(customer.createdAt).toLocaleDateString()}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Refresh
            </Button>
            <Button onClick={onSettle} disabled={!account || account.customer.totalOutstanding <= 0}>
              <DollarSign className="h-4 w-4 mr-2" /> Record Payment
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {loading && !account ? (
          <div className="text-center py-20 text-slate-500">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3" /> Loading credit account…
          </div>
        ) : !account ? (
          <div className="text-center py-20 text-slate-500">
            <AlertTriangle className="h-10 w-10 mx-auto mb-3 opacity-50" />
            Could not load credit account.
          </div>
        ) : (
          <>
            {/* Top: Profile + Credit Summary */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Customer profile */}
              <Card className="p-5 dark:bg-slate-900 dark:border-slate-800">
                <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Customer</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
                    <Phone className="h-4 w-4 text-slate-400" /> {customer.phone || customer.mobile || "—"}
                  </div>
                  {customer.email && (
                    <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
                      <Mail className="h-4 w-4 text-slate-400" /> {customer.email}
                    </div>
                  )}
                  {(customer.address || customer.city) && (
                    <div className="flex items-start gap-2 text-slate-700 dark:text-slate-200">
                      <MapPin className="h-4 w-4 text-slate-400 mt-0.5" />
                      <span>{[customer.address, customer.city].filter(Boolean).join(", ")}</span>
                    </div>
                  )}
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 mt-2 text-xs text-slate-500 space-y-1">
                    <div>Total spent: <span className="font-semibold text-slate-700 dark:text-slate-200">{formatGHS(customer.totalSpent)}</span></div>
                    <div>Visits: <span className="font-semibold text-slate-700 dark:text-slate-200">{customer.visits}</span></div>
                    <div>Loyalty points: <span className="font-semibold text-emerald-700 dark:text-emerald-400">{customer.pointsBalance}</span></div>
                  </div>
                </div>
              </Card>

              {/* Credit utilization */}
              <Card className="p-5 dark:bg-slate-900 dark:border-slate-800 lg:col-span-2">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Credit Utilization</h3>
                  {account.customer.overLimit && (
                    <Badge variant="destructive">
                      <AlertTriangle className="h-3 w-3 mr-1" /> Over Limit
                    </Badge>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div>
                    <div className="text-xs text-slate-500">Limit</div>
                    <div className="text-lg font-bold text-slate-900 dark:text-white">{formatGHS(customer.creditLimit)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Outstanding</div>
                    <div className="text-lg font-bold text-rose-600 dark:text-rose-400">{formatGHS(account.customer.totalOutstanding)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Available</div>
                    <div className="text-lg font-bold text-emerald-700 dark:text-emerald-400">{formatGHS(account.customer.availableCredit)}</div>
                  </div>
                </div>
                {/* Progress bar */}
                <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <motion.div
                    className={`h-full ${utilizationPct > 90 ? "bg-rose-500" : utilizationPct > 70 ? "bg-amber-500" : "bg-emerald-500"}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${utilizationPct}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
                <div className="flex justify-between text-xs text-slate-500 mt-1">
                  <span>0%</span>
                  <span>{utilizationPct.toFixed(1)}% used</span>
                  <span>100%</span>
                </div>
              </Card>
            </div>

            {/* Summary KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <MiniStat label="Total Credit Sales" value={account.summary.totalCreditSales.toString()} />
              <MiniStat label="Total Issued" value={formatGHS(account.summary.totalCreditIssued)} />
              <MiniStat label="Total Settled" value={formatGHS(account.summary.totalSettled)} accent="emerald" />
              <MiniStat label="Overdue" value={account.summary.overdueCount.toString()} accent={account.summary.overdueCount > 0 ? "rose" : "default"} />
            </div>

            {/* Outstanding credit sales */}
            <Card className="dark:bg-slate-900 dark:border-slate-800 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white">Credit Sales History</h3>
                  <p className="text-xs text-slate-500">All credit sales for this customer, newest first</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => window.print()}>
                  <Printer className="h-4 w-4 mr-2" /> Print
                </Button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 uppercase text-xs">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold">Invoice</th>
                      <th className="px-4 py-3 text-left font-semibold">Date</th>
                      <th className="px-4 py-3 text-left font-semibold">Cashier</th>
                      <th className="px-4 py-3 text-right font-semibold">Total</th>
                      <th className="px-4 py-3 text-right font-semibold">Due</th>
                      <th className="px-4 py-3 text-left font-semibold">Due Date</th>
                      <th className="px-4 py-3 text-center font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {account.sales.length === 0 ? (
                      <tr><td colSpan={7} className="text-center py-8 text-slate-500">No credit sales yet.</td></tr>
                    ) : account.sales.map(s => (
                      <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                        <td className="px-4 py-3 font-mono text-slate-900 dark:text-white">{s.invoiceNumber}</td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                          {new Date(s.createdAt).toLocaleDateString()}
                          <div className="text-xs text-slate-400">{new Date(s.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{s.cashierName}</td>
                        <td className="px-4 py-3 text-right font-mono text-slate-700 dark:text-slate-200">{formatGHS(s.total)}</td>
                        <td className="px-4 py-3 text-right font-mono font-semibold text-rose-600 dark:text-rose-400">
                          {formatGHS(s.creditAmountDue)}
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                          {s.creditDueDate ? (
                            <>
                              {new Date(s.creditDueDate).toLocaleDateString()}
                              {s.isOverdue && <Badge variant="destructive" className="ml-2 text-xs">Overdue</Badge>}
                            </>
                          ) : <span className="text-slate-400">—</span>}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {s.creditSettledAt ? (
                            <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                              <CheckCircle2 className="h-3 w-3 mr-1" /> Settled
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                              <Clock className="h-3 w-3 mr-1" /> Pending
                            </Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        )}
      </div>

      <SettleCreditDialog
        open={showSettleDialog}
        onOpenChange={onSettleDialogChange}
        customer={customer}
        account={account}
        onSettled={onSettled}
      />
    </div>
  );
}

// ============= Settle Credit Dialog =============
function SettleCreditDialog({
  open, onOpenChange, customer, account, onSettled,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  customer: Customer;
  account: CreditAccount | null;
  onSettled: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [selectedSaleIds, setSelectedSaleIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const unsettled = useMemo(
    () => account?.sales.filter(s => !s.creditSettledAt && s.creditAmountDue > 0) || [],
    [account]
  );
  const totalOutstanding = unsettled.reduce((s, x) => s + x.creditAmountDue, 0);

  const handleSubmit = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) {
      toast({ title: "Enter a valid amount", variant: "destructive" });
      return;
    }
    if (amt > totalOutstanding) {
      toast({ title: "Amount exceeds outstanding", description: `Outstanding is ${formatGHS(totalOutstanding)}`, variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const body: any = { amountPaid: amt };
      if (selectedSaleIds.length > 0) body.saleIds = selectedSaleIds;
      const res = await fetch(`/api/customers/${customer.id}/credit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast({
          title: "Payment recorded",
          description: `${formatGHS(data.totalApplied)} applied to ${data.settledSales.length} sale(s)`,
        });
        setAmount("");
        setSelectedSaleIds([]);
        onOpenChange(false);
        onSettled();
      } else {
        toast({ title: "Failed", description: data.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record Credit Payment</DialogTitle>
          <DialogDescription>
            Apply a payment to {customer.name}'s outstanding credit. Leave sale selection empty for automatic FIFO allocation.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-500">Outstanding:</span>
              <span className="font-semibold text-rose-600">{formatGHS(totalOutstanding)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Unsettled sales:</span>
              <span className="font-semibold">{unsettled.length}</span>
            </div>
          </div>
          <div>
            <Label htmlFor="amount">Payment Amount (GHS)</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="0"
              max={totalOutstanding}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="mt-1"
            />
            <div className="flex gap-2 mt-2">
              <Button size="sm" variant="outline" onClick={() => setAmount(totalOutstanding.toFixed(2))}>
                Full Settlement
              </Button>
              <Button size="sm" variant="outline" onClick={() => setAmount((totalOutstanding / 2).toFixed(2))}>
                Half
              </Button>
            </div>
          </div>
          {unsettled.length > 0 && (
            <div>
              <Label>Allocate to specific sales (optional)</Label>
              <div className="max-h-40 overflow-y-auto mt-1 space-y-1 border rounded-md p-2 bg-white dark:bg-slate-950">
                {unsettled.map(s => (
                  <label key={s.id} className="flex items-center gap-2 p-1.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedSaleIds.includes(s.id)}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedSaleIds([...selectedSaleIds, s.id]);
                        else setSelectedSaleIds(selectedSaleIds.filter(id => id !== s.id));
                      }}
                      className="rounded"
                    />
                    <span className="font-mono text-xs flex-1">{s.invoiceNumber}</span>
                    <span className="text-xs text-slate-500">{new Date(s.createdAt).toLocaleDateString()}</span>
                    <span className="font-mono text-sm font-semibold text-rose-600">{formatGHS(s.creditAmountDue)}</span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-slate-500 mt-1">If none selected, payment is auto-allocated to oldest first (FIFO).</p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting || totalOutstanding <= 0}>
            {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
            Record Payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============= Add Customer Dialog =============
function AddCustomerDialog({
  open, onOpenChange, onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: (c: Customer) => void;
}) {
  const [form, setForm] = useState({
    name: "", phone: "", mobile: "", email: "", address: "", city: "",
    group: "regular", creditLimit: "", notes: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          creditLimit: Number(form.creditLimit) || 0,
        }),
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast({ title: "Customer created", description: data.customer.name });
        onOpenChange(false);
        onCreated(data.customer);
        setForm({ name: "", phone: "", mobile: "", email: "", address: "", city: "", group: "regular", creditLimit: "", notes: "" });
      } else {
        toast({ title: "Failed", description: data.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New Customer</DialogTitle>
          <DialogDescription>
            Add a customer for credit tracking, loyalty, and sales history.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 py-2">
          <div className="col-span-2">
            <Label>Name *</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <Label>Phone</Label>
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div>
            <Label>Mobile</Label>
            <Input value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} />
          </div>
          <div className="col-span-2">
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="col-span-2">
            <Label>Address</Label>
            <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
          <div>
            <Label>City</Label>
            <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          </div>
          <div>
            <Label>Group</Label>
            <Select value={form.group} onValueChange={(v) => setForm({ ...form, group: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="regular">Regular</SelectItem>
                <SelectItem value="vip">VIP</SelectItem>
                <SelectItem value="wholesale">Wholesale</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2">
            <Label>Credit Limit (GHS)</Label>
            <Input
              type="number"
              step="0.01"
              value={form.creditLimit}
              onChange={(e) => setForm({ ...form, creditLimit: e.target.value })}
              placeholder="0.00 — leave blank for no credit"
            />
          </div>
          <div className="col-span-2">
            <Label>Notes</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Optional notes about this customer"
              rows={2}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
            Create Customer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============= Helpers =============
function KpiCard({
  icon, label, value, sub, accent,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  sub?: string;
  accent: "emerald" | "rose" | "blue" | "amber";
}) {
  const colors = {
    emerald: "from-emerald-500 to-emerald-600 text-white",
    rose: "from-rose-500 to-rose-600 text-white",
    blue: "from-blue-500 to-blue-600 text-white",
    amber: "from-amber-500 to-amber-600 text-white",
  };
  return (
    <Card className={`p-5 bg-gradient-to-br ${colors[accent]} border-0 shadow-lg`}>
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs uppercase tracking-wider opacity-90">{label}</div>
          <div className="text-2xl font-bold mt-1">{value}</div>
          {sub && <div className="text-xs opacity-90 mt-1">{sub}</div>}
        </div>
        <div className="opacity-80">{icon}</div>
      </div>
    </Card>
  );
}

function MiniStat({ label, value, accent = "default" }: { label: string; value: string; accent?: "default" | "emerald" | "rose" }) {
  const color = {
    default: "text-slate-900 dark:text-white",
    emerald: "text-emerald-700 dark:text-emerald-400",
    rose: "text-rose-600 dark:text-rose-400",
  };
  return (
    <Card className="p-4 dark:bg-slate-900 dark:border-slate-800">
      <div className="text-xs uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`text-lg font-bold mt-1 ${color[accent]}`}>{value}</div>
    </Card>
  );
}

function tierBadge(tier: string): string {
  switch (tier) {
    case "platinum": return "bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-100 border-slate-300 dark:border-slate-600";
    case "gold": return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border-amber-300 dark:border-amber-700";
    case "silver": return "bg-slate-100 text-slate-700 dark:bg-slate-800/50 dark:text-slate-200 border-slate-300 dark:border-slate-700";
    case "bronze": return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300 border-orange-300 dark:border-orange-700";
    default: return "";
  }
}

function debounce<T extends (...args: any[]) => void>(fn: T, delay: number): (...args: Parameters<T>) => void {
  let t: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), delay);
  };
}
