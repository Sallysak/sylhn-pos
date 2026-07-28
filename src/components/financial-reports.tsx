"use client";

import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, TrendingUp, TrendingDown, DollarSign, Users, Loader2,
  Download, AlertTriangle, Clock, RotateCcw, X, Wallet, BarChart3,
  Target, Zap, Plus, Trash2, Calendar,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { COMPANY, formatGHS } from "@/lib/pos-data";

type ReportType = "employee-performance" | "cash-flow" | "procurement-budget" | "lead-time" | "reorder-effectiveness";

interface Props {
  onBack: () => void;
  initialReport?: ReportType;
}

export function FinancialReports({ onBack, initialReport = "employee-performance" }: Props) {
  const [report, setReport] = useState<ReportType>(initialReport);
  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-slate-50 to-amber-50/30">
      <header className="flex-shrink-0 bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 text-white shadow-lg">
        <div className="flex items-center justify-between px-4 sm:px-6 py-3">
          <div className="flex items-center gap-4 min-w-0">
            <button onClick={onBack} className="h-9 w-9 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition flex-shrink-0">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="h-9 w-9 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center ring-1 ring-white/20 flex-shrink-0">
                <BarChart3 className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="font-bold text-base leading-tight">Financial Reports</div>
                <div className="text-[10px] text-amber-100/90 truncate">{COMPANY.name}</div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Sub-nav */}
      <nav className="flex-shrink-0 bg-white border-b border-slate-200 shadow-sm">
        <div className="flex items-center gap-1.5 px-3 sm:px-6 py-2 overflow-x-auto scrollbar-hide">
          <button onClick={() => setReport("employee-performance")} className={cn("flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all whitespace-nowrap flex-shrink-0", report === "employee-performance" ? "bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-md" : "text-slate-600 hover:bg-slate-100")}>
            <Users className="h-4 w-4" /> Employee Perf
          </button>
          <button onClick={() => setReport("cash-flow")} className={cn("flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all whitespace-nowrap flex-shrink-0", report === "cash-flow" ? "bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-md" : "text-slate-600 hover:bg-slate-100")}>
            <Wallet className="h-4 w-4" /> Cash Flow
          </button>
          <button onClick={() => setReport("procurement-budget")} className={cn("flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all whitespace-nowrap flex-shrink-0", report === "procurement-budget" ? "bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-md" : "text-slate-600 hover:bg-slate-100")}>
            <Target className="h-4 w-4" /> Budget vs Spend
          </button>
          <button onClick={() => setReport("lead-time")} className={cn("flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all whitespace-nowrap flex-shrink-0", report === "lead-time" ? "bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-md" : "text-slate-600 hover:bg-slate-100")}>
            <Clock className="h-4 w-4" /> Lead-Time Accuracy
          </button>
          <button onClick={() => setReport("reorder-effectiveness")} className={cn("flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all whitespace-nowrap flex-shrink-0", report === "reorder-effectiveness" ? "bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-md" : "text-slate-600 hover:bg-slate-100")}>
            <Zap className="h-4 w-4" /> Reorder Effectiveness
          </button>
        </div>
      </nav>

      <main className="flex-1 overflow-hidden p-3 sm:p-6">
        {report === "employee-performance" && <EmployeePerformanceReport />}
        {report === "cash-flow" && <CashFlowReport />}
        {report === "procurement-budget" && <ProcurementBudgetReport />}
        {report === "lead-time" && <LeadTimeReport />}
        {report === "reorder-effectiveness" && <ReorderEffectivenessReport />}
      </main>
    </div>
  );
}

// ============================================================
// EMPLOYEE PERFORMANCE REPORT
// ============================================================
function EmployeePerformanceReport() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [days, setDays] = useState(30);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/reports/employee-performance?days=${days}`, { credentials: "include" })
      .then(r => r.json())
      .then(d => setData(d))
      .catch(() => toast({ title: "Failed to load", variant: "destructive" }))
      .finally(() => setLoading(false));
  }, [days]);

  const exportCSV = () => {
    if (!data?.cashiers) return;
    const headers = ["Cashier", "Sales", "Revenue", "Avg Sale", "Discounts", "Refunds", "Refund Rate", "Voids", "Void Rate", "Days Worked", "Sales/Hr", "Revenue/Hr"];
    const rows = data.cashiers.map((c: any) => [
      c.cashierName, c.totalSales, c.totalRevenue.toFixed(2), c.avgSale.toFixed(2),
      c.totalDiscount.toFixed(2), c.refundCount, c.refundRate + "%",
      c.voidCount, c.voidRate + "%", c.daysWorked, c.salesPerHour, c.revenuePerHour.toFixed(2),
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `employee-performance-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="h-full flex items-center justify-center"><Loader2 className="h-10 w-10 animate-spin text-amber-500" /></div>;

  return (
    <div className="h-full overflow-y-auto scroll-premium space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-amber-600" />
          <h2 className="text-base font-bold text-slate-800">Employee Performance</h2>
          {data?.summary && (
            <span className="text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
              {data.summary.totalCashiers} cashier{data.summary.totalCashiers === 1 ? "" : "s"} · {data.summary.totalSales} sale{data.summary.totalSales === 1 ? "" : "s"}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <select value={days} onChange={(e) => setDays(parseInt(e.target.value))} className="h-8 px-2 rounded-lg bg-slate-100 text-xs outline-none">
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
            <option value={365}>Last year</option>
          </select>
          <button onClick={exportCSV} className="h-8 px-3 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-700 text-xs font-bold flex items-center gap-1">
            <Download className="h-3.5 w-3.5" /> CSV
          </button>
        </div>
      </div>

      {/* Summary KPIs */}
      {data?.summary && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <KPI label="Total Revenue" value={formatGHS(data.summary.totalRevenue)} color="emerald" />
          <KPI label="Total Sales" value={String(data.summary.totalSales)} color="indigo" />
          <KPI label="Refunds" value={String(data.summary.totalRefunds)} color="rose" detail={`${data.summary.avgRefundRate}% avg rate`} />
          <KPI label="Voids" value={String(data.summary.totalVoids)} color="amber" detail={`${data.summary.avgVoidRate}% avg rate`} />
          <KPI label="Cashiers" value={String(data.summary.totalCashiers)} color="violet" />
        </div>
      )}

      {/* Cashiers table */}
      <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-800 text-white text-[10px] uppercase tracking-wide">
              <tr>
                <th className="text-left px-3 py-2.5">Cashier</th>
                <th className="text-center px-2 py-2.5">Sales</th>
                <th className="text-right px-2 py-2.5">Revenue</th>
                <th className="text-right px-2 py-2.5">Avg Sale</th>
                <th className="text-center px-2 py-2.5">Refunds</th>
                <th className="text-center px-2 py-2.5">Voids</th>
                <th className="text-center px-2 py-2.5">Days</th>
                <th className="text-right px-2 py-2.5">Sales/Hr</th>
                <th className="text-right px-2 py-2.5">Rev/Hr</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(!data?.cashiers || data.cashiers.length === 0) ? (
                <tr><td colSpan={9} className="px-4 py-12 text-center text-slate-400">No sales in this period</td></tr>
              ) : data.cashiers.map((c: any) => (
                <tr key={c.cashierId} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-semibold text-slate-800">{c.cashierName}</td>
                  <td className="px-2 py-2 text-center font-mono">{c.totalSales}</td>
                  <td className="px-2 py-2 text-right font-mono font-bold text-emerald-700">{formatGHS(c.totalRevenue)}</td>
                  <td className="px-2 py-2 text-right font-mono text-slate-600">{formatGHS(c.avgSale)}</td>
                  <td className={cn("px-2 py-2 text-center font-mono", c.refundRate > 5 ? "text-rose-600 font-bold" : "text-slate-500")}>
                    {c.refundCount} <span className="text-[9px]">({c.refundRate}%)</span>
                  </td>
                  <td className={cn("px-2 py-2 text-center font-mono", c.voidRate > 5 ? "text-amber-600 font-bold" : "text-slate-500")}>
                    {c.voidCount} <span className="text-[9px]">({c.voidRate}%)</span>
                  </td>
                  <td className="px-2 py-2 text-center font-mono text-slate-500">{c.daysWorked}</td>
                  <td className="px-2 py-2 text-right font-mono text-slate-600">{c.salesPerHour}</td>
                  <td className="px-2 py-2 text-right font-mono text-slate-600">{formatGHS(c.revenuePerHour)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Fraud alert */}
      {data?.cashiers?.some((c: any) => c.refundRate > 10 || c.voidRate > 10) && (
        <div className="bg-rose-50 ring-1 ring-rose-200 rounded-xl p-3 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-rose-600 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-rose-800">
            <strong>Fraud risk detected:</strong> One or more cashiers have refund/void rates above 10%. This may indicate training issues, quality problems, or potential theft. Review the highlighted rows above.
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// CASH FLOW REPORT
// ============================================================
function CashFlowReport() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [days, setDays] = useState(30);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/reports/cash-flow?days=${days}`, { credentials: "include" })
      .then(r => r.json())
      .then(d => setData(d))
      .catch(() => toast({ title: "Failed to load", variant: "destructive" }))
      .finally(() => setLoading(false));
  }, [days]);

  if (loading) return <div className="h-full flex items-center justify-center"><Loader2 className="h-10 w-10 animate-spin text-amber-500" /></div>;

  const daily = data?.daily || [];
  const maxNet = Math.max(...daily.map((d: any) => Math.abs(d.net)), 1);

  return (
    <div className="h-full overflow-y-auto scroll-premium space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Wallet className="h-5 w-5 text-amber-600" />
          <h2 className="text-base font-bold text-slate-800">Cash Flow</h2>
          <span className="text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
            Cash IN vs Cash OUT per day
          </span>
        </div>
        <select value={days} onChange={(e) => setDays(parseInt(e.target.value))} className="h-8 px-2 rounded-lg bg-slate-100 text-xs outline-none">
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
          <option value={365}>Last year</option>
        </select>
      </div>

      {/* Summary KPIs */}
      {data?.summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KPI label="Total Cash IN" value={formatGHS(data.summary.totalIn)} color="emerald" />
          <KPI label="Total Cash OUT" value={formatGHS(data.summary.totalOut)} color="rose" />
          <KPI label="Net Cash Flow" value={formatGHS(data.summary.netFlow)} color={data.summary.netFlow >= 0 ? "emerald" : "rose"} />
          <KPI label="Ending Balance" value={formatGHS(data.summary.endingBalance)} color={data.summary.endingBalance >= 0 ? "indigo" : "rose"} />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Cash IN breakdown */}
        <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 p-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-700 mb-3 flex items-center gap-1.5">
            <TrendingUp className="h-4 w-4" /> Cash IN (Sources)
          </h3>
          <div className="space-y-2">
            {Object.entries(data?.cashInBySource || {}).sort((a, b) => (b[1] as number) - (a[1] as number)).map(([method, amount]) => {
              const pct = data.summary.totalIn > 0 ? ((amount as number) / data.summary.totalIn) * 100 : 0;
              return (
                <div key={method}>
                  <div className="flex justify-between text-xs mb-0.5">
                    <span className="font-semibold text-slate-700 capitalize">{method}</span>
                    <span className="font-mono font-bold text-emerald-700">{formatGHS(amount as number)}</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-emerald-400 to-teal-500" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="text-[9px] text-slate-400 mt-0.5">{pct.toFixed(1)}% of total</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Cash OUT breakdown */}
        <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 p-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-rose-700 mb-3 flex items-center gap-1.5">
            <TrendingDown className="h-4 w-4" /> Cash OUT (Uses)
          </h3>
          <div className="space-y-2">
            {Object.entries(data?.cashOutByCategory || {}).sort((a, b) => (b[1] as number) - (a[1] as number)).map(([cat, amount]) => {
              const pct = data.summary.totalOut > 0 ? ((amount as number) / data.summary.totalOut) * 100 : 0;
              return (
                <div key={cat}>
                  <div className="flex justify-between text-xs mb-0.5">
                    <span className="font-semibold text-slate-700 capitalize">{cat}</span>
                    <span className="font-mono font-bold text-rose-700">{formatGHS(amount as number)}</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-rose-400 to-pink-500" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="text-[9px] text-slate-400 mt-0.5">{pct.toFixed(1)}% of total</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Daily bar chart */}
      <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 p-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-3">Daily Net Cash Flow</h3>
        <div className="flex items-end gap-px h-40 overflow-x-auto">
          {daily.map((d: any) => {
            const heightPct = (Math.abs(d.net) / maxNet) * 100;
            const isPositive = d.net >= 0;
            return (
              <div
                key={d.date}
                className="flex-1 min-w-[6px] group relative"
                title={`${d.date}\nIN: ${formatGHS(d.cashIn)}\nOUT: ${formatGHS(d.cashOut)}\nNet: ${formatGHS(d.net)}`}
              >
                <div
                  className={cn("w-full rounded-t transition hover:opacity-80", isPositive ? "bg-emerald-400" : "bg-rose-400")}
                  style={{ height: `${Math.max(heightPct, 2)}%`, marginTop: isPositive ? "auto" : "0" }}
                />
              </div>
            );
          })}
        </div>
        <div className="flex justify-between text-[9px] text-slate-400 mt-2">
          <span>{daily[0]?.date}</span>
          <span>{daily[daily.length - 1]?.date}</span>
        </div>
        <div className="flex items-center gap-4 mt-2 text-[10px]">
          <span className="flex items-center gap-1"><div className="h-2 w-2 rounded bg-emerald-400" /> Positive (more cash in)</span>
          <span className="flex items-center gap-1"><div className="h-2 w-2 rounded bg-rose-400" /> Negative (more cash out)</span>
        </div>
      </div>

      {/* Daily table */}
      <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 overflow-hidden">
        <div className="overflow-x-auto max-h-64 overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-slate-800 text-white text-[10px] uppercase tracking-wide">
              <tr>
                <th className="text-left px-3 py-2">Date</th>
                <th className="text-right px-2 py-2">Cash IN</th>
                <th className="text-right px-2 py-2">Cash OUT</th>
                <th className="text-right px-2 py-2">Net</th>
                <th className="text-right px-2 py-2">Running Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {daily.slice().reverse().map((d: any) => (
                <tr key={d.date} className="hover:bg-slate-50">
                  <td className="px-3 py-2 text-slate-600">{d.date}</td>
                  <td className="px-2 py-2 text-right font-mono text-emerald-700">{formatGHS(d.cashIn)}</td>
                  <td className="px-2 py-2 text-right font-mono text-rose-700">{formatGHS(d.cashOut)}</td>
                  <td className={cn("px-2 py-2 text-right font-mono font-bold", d.net >= 0 ? "text-emerald-700" : "text-rose-700")}>
                    {d.net >= 0 ? "+" : ""}{formatGHS(d.net)}
                  </td>
                  <td className={cn("px-2 py-2 text-right font-mono font-bold", d.runningBalance >= 0 ? "text-slate-700" : "text-rose-700")}>
                    {formatGHS(d.runningBalance)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function KPI({ label, value, color, detail }: { label: string; value: string; color: string; detail?: string }) {
  const colors: Record<string, string> = {
    emerald: "from-emerald-500 to-teal-600",
    rose: "from-rose-500 to-pink-600",
    amber: "from-amber-500 to-orange-600",
    indigo: "from-indigo-500 to-blue-600",
    violet: "from-violet-500 to-purple-600",
  };
  return (
    <div className="bg-white rounded-xl ring-1 ring-slate-200 p-3">
      <div className={cn("h-1 w-full rounded-full bg-gradient-to-r mb-2", colors[color])} />
      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</div>
      <div className="text-lg font-bold text-slate-800 mt-0.5 truncate">{value}</div>
      {detail && <div className="text-[10px] text-slate-400 mt-0.5">{detail}</div>}
    </div>
  );
}

// ============================================================
// PROCUREMENT BUDGET vs SPEND REPORT
// ============================================================
function ProcurementBudgetReport() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [showAddForm, setShowAddForm] = useState(false);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [newBudget, setNewBudget] = useState({ supplierId: "", category: "", budgetAmount: "", notes: "" });

  const fetchData = () => {
    setLoading(true);
    fetch(`/api/procurement-budget?month=${month}`, { credentials: "include" })
      .then(r => r.json())
      .then(d => setData(d))
      .catch(() => toast({ title: "Failed to load", variant: "destructive" }))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, [month]);

  useEffect(() => {
    fetch("/api/suppliers?active=true&limit=500", { credentials: "include" })
      .then(r => r.json())
      .then(d => setSuppliers(d.suppliers || []))
      .catch(() => {});
  }, []);

  const handleSave = async () => {
    if (!newBudget.budgetAmount || Number(newBudget.budgetAmount) <= 0) {
      toast({ title: "Enter a positive budget amount", variant: "destructive" });
      return;
    }
    try {
      const res = await fetch("/api/procurement-budget", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          month,
          supplierId: newBudget.supplierId || null,
          category: newBudget.category || null,
          budgetAmount: Number(newBudget.budgetAmount),
          notes: newBudget.notes,
        }),
      });
      if (res.ok) {
        toast({ title: "Budget saved" });
        setShowAddForm(false);
        setNewBudget({ supplierId: "", category: "", budgetAmount: "", notes: "" });
        fetchData();
      }
    } catch (e: any) {
      toast({ title: "Failed to save", description: e.message, variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this budget?")) return;
    try {
      await fetch(`/api/procurement-budget?id=${id}`, { method: "DELETE", credentials: "include" });
      toast({ title: "Budget deleted" });
      fetchData();
    } catch {}
  };

  if (loading) return <div className="h-full flex items-center justify-center"><Loader2 className="h-10 w-10 animate-spin text-amber-500" /></div>;

  const budgets = data?.budgets || [];
  const summary = data?.summary;

  return (
    <div className="h-full overflow-y-auto scroll-premium space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5 text-amber-600" />
          <h2 className="text-base font-bold text-slate-800">Procurement Budget vs Spend</h2>
        </div>
        <div className="flex items-center gap-2">
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="h-8 px-2 rounded-lg bg-slate-100 text-xs outline-none" />
          <button onClick={() => setShowAddForm(true)} className="h-8 px-3 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-700 text-xs font-bold flex items-center gap-1">
            <Plus className="h-3.5 w-3.5" /> Set Budget
          </button>
        </div>
      </div>

      {/* Summary */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KPI label="Total Budget" value={formatGHS(summary.totalBudget)} color="indigo" />
          <KPI label="Actual Spend" value={formatGHS(summary.totalActualSpend)} color="rose" />
          <KPI label="Variance" value={formatGHS(summary.totalVariance)} color={summary.totalVariance >= 0 ? "emerald" : "rose"} />
          <KPI label="Budgets Set" value={String(summary.budgetCount)} color="violet" />
        </div>
      )}

      {/* Budgets table */}
      <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-slate-800 text-white text-[10px] uppercase tracking-wide">
            <tr>
              <th className="text-left px-3 py-2.5">Scope</th>
              <th className="text-right px-2 py-2.5">Budget</th>
              <th className="text-right px-2 py-2.5">Actual Spend</th>
              <th className="text-right px-2 py-2.5">Variance</th>
              <th className="text-center px-2 py-2.5">Utilization</th>
              <th className="text-center px-2 py-2.5">Status</th>
              <th className="text-center px-2 py-2.5">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {budgets.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                <Target className="h-10 w-10 mx-auto mb-2 opacity-40" />
                No budgets set for {month}. Click "Set Budget" to create one.
              </td></tr>
            ) : budgets.map((b: any) => (
              <tr key={b.id} className="hover:bg-slate-50">
                <td className="px-3 py-2">
                  <div className="font-semibold text-slate-800">
                    {b.supplier ? b.supplier.name : b.category || "All Suppliers & Categories"}
                  </div>
                  {b.notes && <div className="text-[9px] text-slate-400">{b.notes}</div>}
                </td>
                <td className="px-2 py-2 text-right font-mono font-bold text-indigo-700">{formatGHS(b.budgetAmount)}</td>
                <td className="px-2 py-2 text-right font-mono text-rose-700">{formatGHS(b.actualSpend)}</td>
                <td className={cn("px-2 py-2 text-right font-mono font-bold", b.variance >= 0 ? "text-emerald-700" : "text-rose-700")}>
                  {b.variance >= 0 ? "+" : ""}{formatGHS(b.variance)}
                </td>
                <td className="px-2 py-2 text-center">
                  <div className="flex items-center gap-1.5">
                    <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden min-w-[60px]">
                      <div className={cn("h-full rounded-full", b.utilizationPct > 100 ? "bg-rose-500" : b.utilizationPct > 80 ? "bg-amber-500" : "bg-emerald-500")} style={{ width: `${Math.min(b.utilizationPct, 100)}%` }} />
                    </div>
                    <span className="text-[9px] font-mono font-bold text-slate-600 w-8 text-right">{b.utilizationPct}%</span>
                  </div>
                </td>
                <td className="px-2 py-2 text-center">
                  <span className={cn("px-2 py-1 rounded text-[9px] font-bold uppercase", b.status === "over" ? "bg-rose-100 text-rose-700" : b.status === "warning" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700")}>
                    {b.status === "over" ? "Over Budget" : b.status === "warning" ? "Near Limit" : "On Track"}
                  </span>
                </td>
                <td className="px-2 py-2 text-center">
                  <button onClick={() => handleDelete(b.id)} className="h-6 w-6 rounded bg-rose-100 hover:bg-rose-200 text-rose-600 flex items-center justify-center mx-auto">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add budget form */}
      {showAddForm && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowAddForm(false)}>
          <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-5 py-3 bg-gradient-to-r from-amber-600 to-orange-600 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm">Set Budget for {month}</h3>
              <button onClick={() => setShowAddForm(false)} className="h-7 w-7 rounded-lg bg-white/15 flex items-center justify-center"><X className="h-4 w-4" /></button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-500 mb-1 block">Supplier (optional — leave empty for all)</label>
                <select value={newBudget.supplierId} onChange={(e) => setNewBudget({ ...newBudget, supplierId: e.target.value })} className="w-full h-9 px-2 rounded-lg bg-slate-100 text-xs outline-none">
                  <option value="">All Suppliers</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-500 mb-1 block">Category (optional — leave empty for all)</label>
                <input value={newBudget.category} onChange={(e) => setNewBudget({ ...newBudget, category: e.target.value })} placeholder="e.g. beverages, groceries" className="w-full h-9 px-3 rounded-lg bg-slate-100 text-xs outline-none" />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-500 mb-1 block">Budget Amount (GHS) *</label>
                <input type="number" step="0.01" value={newBudget.budgetAmount} onChange={(e) => setNewBudget({ ...newBudget, budgetAmount: e.target.value })} placeholder="5000.00" className="w-full h-9 px-3 rounded-lg bg-slate-100 text-xs font-mono outline-none" />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-500 mb-1 block">Notes</label>
                <textarea value={newBudget.notes} onChange={(e) => setNewBudget({ ...newBudget, notes: e.target.value })} rows={2} className="w-full px-3 py-2 rounded-lg bg-slate-100 text-xs outline-none resize-none" />
              </div>
            </div>
            <div className="p-4 border-t border-slate-200 flex gap-2">
              <button onClick={() => setShowAddForm(false)} className="flex-1 h-10 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold">Cancel</button>
              <button onClick={handleSave} className="flex-1 h-10 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white text-xs font-bold">Save Budget</button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}

// ============================================================
// LEAD-TIME ACCURACY REPORT
// ============================================================
function LeadTimeReport() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [days, setDays] = useState(90);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/reports/lead-time-accuracy?days=${days}`, { credentials: "include" })
      .then(r => r.json())
      .then(d => setData(d))
      .catch(() => toast({ title: "Failed to load", variant: "destructive" }))
      .finally(() => setLoading(false));
  }, [days]);

  if (loading) return <div className="h-full flex items-center justify-center"><Loader2 className="h-10 w-10 animate-spin text-amber-500" /></div>;

  const suppliers = data?.suppliers || [];
  const summary = data?.summary;

  return (
    <div className="h-full overflow-y-auto scroll-premium space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-amber-600" />
          <h2 className="text-base font-bold text-slate-800">Lead-Time Accuracy</h2>
          <span className="text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">Promised vs Actual delivery time</span>
        </div>
        <select value={days} onChange={(e) => setDays(parseInt(e.target.value))} className="h-8 px-2 rounded-lg bg-slate-100 text-xs outline-none">
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
          <option value={180}>Last 180 days</option>
          <option value={365}>Last year</option>
        </select>
      </div>

      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KPI label="Total POs" value={String(summary.totalPOs)} color="indigo" />
          <KPI label="Suppliers" value={String(summary.totalSuppliers)} color="violet" />
          <KPI label="Avg On-Time %" value={`${summary.avgOnTimePct}%`} color={summary.avgOnTimePct >= 80 ? "emerald" : summary.avgOnTimePct >= 60 ? "amber" : "rose"} />
          {summary.worstSupplier && <KPI label="Worst Supplier" value={summary.worstSupplier.supplierName} color="rose" detail={`${summary.worstSupplier.avgDelayDays}d avg delay`} />}
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-slate-800 text-white text-[10px] uppercase tracking-wide">
            <tr>
              <th className="text-left px-3 py-2.5">Supplier</th>
              <th className="text-center px-2 py-2.5">POs</th>
              <th className="text-center px-2 py-2.5">On-Time</th>
              <th className="text-center px-2 py-2.5">Late</th>
              <th className="text-right px-2 py-2.5">Avg Promised</th>
              <th className="text-right px-2 py-2.5">Avg Actual</th>
              <th className="text-right px-2 py-2.5">Avg Delay</th>
              <th className="text-center px-2 py-2.5">On-Time %</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {suppliers.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-400">No received POs with expected dates in this period</td></tr>
            ) : suppliers.map((s: any) => (
              <tr key={s.supplierId} className="hover:bg-slate-50">
                <td className="px-3 py-2 font-semibold text-slate-800">{s.supplierName}</td>
                <td className="px-2 py-2 text-center font-mono">{s.poCount}</td>
                <td className="px-2 py-2 text-center font-mono text-emerald-600">{s.onTimeCount}</td>
                <td className="px-2 py-2 text-center font-mono text-rose-600">{s.lateCount}</td>
                <td className="px-2 py-2 text-right font-mono text-slate-600">{s.avgPromisedDays}d</td>
                <td className="px-2 py-2 text-right font-mono text-slate-600">{s.avgActualDays}d</td>
                <td className={cn("px-2 py-2 text-right font-mono font-bold", s.avgDelayDays > 0 ? "text-rose-600" : "text-emerald-600")}>
                  {s.avgDelayDays > 0 ? "+" : ""}{s.avgDelayDays}d
                </td>
                <td className="px-2 py-2 text-center">
                  <span className={cn("px-2 py-1 rounded text-[9px] font-bold", s.onTimePct >= 80 ? "bg-emerald-100 text-emerald-700" : s.onTimePct >= 60 ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700")}>
                    {s.onTimePct}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="text-[10px] text-slate-500 bg-amber-50 ring-1 ring-amber-200 rounded-lg p-2">
        💡 <strong>How to use:</strong> Suppliers with high avg delay should be pressured to improve, or replaced. Use this data when negotiating terms — "You're averaging 3 days late, can we adjust the promised lead time to match reality?"
      </div>
    </div>
  );
}

// ============================================================
// REORDER EFFECTIVENESS REPORT
// ============================================================
function ReorderEffectivenessReport() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [days, setDays] = useState(90);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/reports/reorder-effectiveness?days=${days}`, { credentials: "include" })
      .then(r => r.json())
      .then(d => setData(d))
      .catch(() => toast({ title: "Failed to load", variant: "destructive" }))
      .finally(() => setLoading(false));
  }, [days]);

  if (loading) return <div className="h-full flex items-center justify-center"><Loader2 className="h-10 w-10 animate-spin text-amber-500" /></div>;

  const rules = data?.rules || [];
  const summary = data?.summary;
  const statusColors: Record<string, string> = {
    ok: "bg-emerald-100 text-emerald-700",
    "needs-attention": "bg-amber-100 text-amber-700",
    stale: "bg-slate-100 text-slate-600",
    stockout: "bg-rose-100 text-rose-700",
  };

  return (
    <div className="h-full overflow-y-auto scroll-premium space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-amber-600" />
          <h2 className="text-base font-bold text-slate-800">Reorder Rule Effectiveness</h2>
          <span className="text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">Auto-replenish rule health check</span>
        </div>
        <select value={days} onChange={(e) => setDays(parseInt(e.target.value))} className="h-8 px-2 rounded-lg bg-slate-100 text-xs outline-none">
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
          <option value={180}>Last 180 days</option>
          <option value={365}>Last year</option>
        </select>
      </div>

      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <KPI label="Total Rules" value={String(summary.totalRules)} color="indigo" />
          <KPI label="Active Rules" value={String(summary.activeRules)} color="emerald" detail="triggered at least once" />
          <KPI label="Stale Rules" value={String(summary.staleRules)} color="amber" detail="never triggered" />
          <KPI label="Stockouts" value={String(summary.stockouts)} color="rose" detail="despite having a rule" />
          <KPI label="Total Triggers" value={String(summary.totalTriggers)} color="violet" />
        </div>
      )}

      {summary && summary.stockouts > 0 && (
        <div className="bg-rose-50 ring-1 ring-rose-200 rounded-xl p-3 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-rose-600 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-rose-800">
            <strong>{summary.stockouts} stockout(s)</strong> occurred despite having a reorder rule. The trigger level may be too low, or the reorder quantity too small. Consider raising the trigger level or increasing the reorder quantity.
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-slate-800 text-white text-[10px] uppercase tracking-wide">
            <tr>
              <th className="text-left px-3 py-2.5">Product</th>
              <th className="text-left px-2 py-2.5">Supplier</th>
              <th className="text-center px-2 py-2.5">Trigger</th>
              <th className="text-center px-2 py-2.5">Reorder Qty</th>
              <th className="text-center px-2 py-2.5">Current Stock</th>
              <th className="text-center px-2 py-2.5">Triggers</th>
              <th className="text-center px-2 py-2.5">Last Triggered</th>
              <th className="text-center px-2 py-2.5">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rules.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                <Zap className="h-10 w-10 mx-auto mb-2 opacity-40" />
                No auto-replenish rules configured. Set them up via Accounts → 🔄 Auto Replenish Rules.
              </td></tr>
            ) : rules.map((r: any) => (
              <tr key={r.ruleId} className={cn("hover:bg-slate-50", r.status === "stockout" && "bg-rose-50/40")}>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1.5">
                    <span>{r.productEmoji}</span>
                    <div>
                      <div className="font-semibold text-slate-800">{r.productName}</div>
                      <div className="text-[9px] text-slate-400 font-mono">{r.productSku}</div>
                    </div>
                  </div>
                </td>
                <td className="px-2 py-2 text-slate-600">{r.supplierName}</td>
                <td className="px-2 py-2 text-center font-mono text-amber-600 font-bold">{r.triggerLevel}</td>
                <td className="px-2 py-2 text-center font-mono text-slate-600">{r.reorderQty}</td>
                <td className={cn("px-2 py-2 text-center font-mono font-bold", r.currentStock <= 0 ? "text-rose-600" : r.currentStock <= r.triggerLevel ? "text-amber-600" : "text-emerald-600")}>
                  {r.currentStock}
                </td>
                <td className="px-2 py-2 text-center font-mono text-slate-600">{r.triggerCount}</td>
                <td className="px-2 py-2 text-center text-slate-500 text-[10px]">
                  {r.lastTriggeredDaysAgo !== null ? `${r.lastTriggeredDaysAgo}d ago` : "Never"}
                </td>
                <td className="px-2 py-2 text-center">
                  <span className={cn("px-2 py-1 rounded text-[9px] font-bold uppercase", statusColors[r.status])}>
                    {r.status.replace(/-/g, " ")}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
