"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, Printer, Loader2, Calendar, DollarSign, CreditCard,
  Smartphone, Wallet, Banknote, TrendingUp, FileText, Users,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { COMPANY, formatGHS } from "@/lib/pos-data";

interface ZReportData {
  date: string;
  summary: {
    grossSales: number;
    voids: number;
    refunds: number;
    netSales: number;
    taxCollected: number;
    discountTotal: number;
    transactionCount: number;
    cashExpected: number;
    openingFloat: number;
  };
  paymentBreakdown: Record<string, { count: number; total: number }>;
  cashierBreakdown: Array<{ cashierName: string; count: number; total: number }>;
  topProducts: Array<{ name: string; emoji: string; quantity: number; total: number }>;
}

export function ZReport({ onBack }: { onBack: () => void }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ZReportData | null>(null);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    setLoading(true);
    authedFetch(`/api/z-report?date=${date}`)
      .then(r => r.json())
      .then(d => { if (d.summary) setData(d); })
      .catch(() => toast({ title: "Failed to load Z-Report", variant: "destructive" }))
      .finally(() => setLoading(false));
  }, [date]);

  const handlePrint = () => window.print();

  if (loading) return (
    <div className="h-screen flex items-center justify-center">
      <Loader2 className="h-10 w-10 animate-spin text-emerald-500" />
    </div>
  );

  const s = data?.summary;
  const payments = data?.paymentBreakdown || {};
  const cashiers = data?.cashierBreakdown || [];
  const topProducts = data?.topProducts || [];

  const paymentIcons: Record<string, any> = {
    cash: Banknote, momo: Smartphone, card: CreditCard, wallet: Wallet, points: Star,
  };

  return (
    <div className="min-h-screen bg-slate-50 print:bg-white">
      {/* Header — hidden in print */}
      <header className="flex-shrink-0 bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg print:hidden">
        <div className="flex items-center justify-between px-4 sm:px-6 py-3">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="h-9 w-9 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div>
              <div className="font-bold text-base">Z-Report (End of Day)</div>
              <div className="text-[10px] text-emerald-100/90">{COMPANY.name}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="h-8 px-2 rounded-lg bg-white/15 text-white text-xs outline-none" />
            <button onClick={handlePrint} className="h-9 px-4 rounded-lg bg-white text-emerald-700 hover:bg-emerald-50 text-xs font-bold flex items-center gap-1.5">
              <Printer className="h-4 w-4" /> Print / PDF
            </button>
          </div>
        </div>
      </header>

      {/* Printable report */}
      <div className="max-w-2xl mx-auto p-6 print:p-4">
        {/* Company header (visible in print) */}
        <div className="text-center mb-6 print:block hidden">
          <h1 className="text-xl font-bold">{COMPANY.name}</h1>
          <p className="text-xs text-slate-500">{COMPANY.address} · {COMPANY.contact}</p>
          <h2 className="text-lg font-bold mt-4">Z-REPORT — End of Day</h2>
          <p className="text-sm">{new Date(date).toLocaleDateString("en-GB", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
        </div>

        {s ? (
          <>
            {/* Summary KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6 print:grid-cols-2">
              <ReportKPI label="Gross Sales" value={formatGHS(s.grossSales)} color="emerald" />
              <ReportKPI label="Net Sales" value={formatGHS(s.netSales)} color="blue" />
              <ReportKPI label="Tax Collected" value={formatGHS(s.taxCollected)} color="amber" />
              <ReportKPI label="Transactions" value={String(s.transactionCount)} color="violet" />
            </div>

            {/* Adjustments */}
            <div className="bg-white rounded-xl ring-1 ring-slate-200 p-4 mb-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Adjustments</h3>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between"><span className="text-slate-600">Opening Float</span><span className="font-mono font-bold">{formatGHS(s.openingFloat)}</span></div>
                <div className="flex justify-between"><span className="text-slate-600">Gross Sales</span><span className="font-mono">{formatGHS(s.grossSales)}</span></div>
                <div className="flex justify-between text-rose-600"><span>Voids</span><span className="font-mono">-{formatGHS(s.voids)}</span></div>
                <div className="flex justify-between text-rose-600"><span>Refunds</span><span className="font-mono">-{formatGHS(s.refunds)}</span></div>
                <div className="flex justify-between text-amber-600"><span>Discounts</span><span className="font-mono">-{formatGHS(s.discountTotal)}</span></div>
                <div className="border-t border-slate-200 pt-1.5 mt-1.5 flex justify-between font-bold"><span>Net Sales</span><span className="font-mono text-emerald-600">{formatGHS(s.netSales)}</span></div>
              </div>
            </div>

            {/* Payment breakdown */}
            <div className="bg-white rounded-xl ring-1 ring-slate-200 p-4 mb-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Payment Method Breakdown</h3>
              <div className="space-y-2">
                {Object.entries(payments).map(([method, info]) => {
                  const Icon = paymentIcons[method] || DollarSign;
                  return (
                    <div key={method} className="flex items-center justify-between p-2 rounded-lg bg-slate-50">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-slate-400" />
                        <span className="text-sm font-semibold capitalize">{method}</span>
                        <span className="text-xs text-slate-400">({info.count} txn)</span>
                      </div>
                      <span className="font-mono font-bold text-sm">{formatGHS(info.total)}</span>
                    </div>
                  );
                })}
                {Object.keys(payments).length === 0 && <p className="text-xs text-slate-400 text-center py-4">No sales on this date</p>}
              </div>
            </div>

            {/* Cash reconciliation */}
            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 ring-1 ring-emerald-200 rounded-xl p-4 mb-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-700 mb-2">Cash Reconciliation</h3>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-700">Expected Cash in Drawer</span>
                <span className="text-2xl font-bold font-mono text-emerald-700">{formatGHS(s.cashExpected)}</span>
              </div>
              <p className="text-[10px] text-slate-500 mt-1">Opening float + cash sales - change given</p>
            </div>

            {/* Cashier breakdown */}
            {cashiers.length > 0 && (
              <div className="bg-white rounded-xl ring-1 ring-slate-200 p-4 mb-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /> Per-Cashier Breakdown</h3>
                <table className="w-full text-xs">
                  <thead className="text-[10px] uppercase tracking-wider text-slate-400">
                    <tr><th className="text-left py-1">Cashier</th><th className="text-center">Txns</th><th className="text-right">Total</th></tr>
                  </thead>
                  <tbody>
                    {cashiers.map((c, i) => (
                      <tr key={i} className="border-t border-slate-100">
                        <td className="py-1.5 font-semibold">{c.cashierName || "Unknown"}</td>
                        <td className="text-center font-mono">{c.count}</td>
                        <td className="text-right font-mono font-bold text-emerald-600">{formatGHS(c.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Top products */}
            {topProducts.length > 0 && (
              <div className="bg-white rounded-xl ring-1 ring-slate-200 p-4 mb-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5"><TrendingUp className="h-3.5 w-3.5" /> Top Products</h3>
                <div className="space-y-1.5">
                  {topProducts.slice(0, 10).map((p, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-1.5"><span className="text-slate-400 font-mono text-xs w-4">{i + 1}.</span>{p.emoji} {p.name}</span>
                      <span className="flex items-center gap-2"><span className="text-xs text-slate-400">{p.quantity}×</span><span className="font-mono font-bold">{formatGHS(p.total)}</span></span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="text-center text-[10px] text-slate-400 mt-6 print:mt-4">
              <p>Generated: {new Date().toLocaleString("en-GB")}</p>
              <p>{COMPANY.name} · Z-Report for {date}</p>
              <p className="mt-1">This report closes the register for the day. Keep for your records.</p>
            </div>
          </>
        ) : (
          <div className="text-center py-16 text-slate-400">
            <FileText className="h-12 w-12 mx-auto mb-3 opacity-40" />
            <p className="text-sm font-bold">No data for {date}</p>
            <p className="text-xs mt-1">Try a different date</p>
          </div>
        )}
      </div>
    </div>
  );
}

function ReportKPI({ label, value, color }: { label: string; value: string; color: string }) {
  const colors: Record<string, string> = {
    emerald: "from-emerald-500 to-teal-600",
    blue: "from-blue-500 to-indigo-600",
    amber: "from-amber-500 to-orange-600",
    violet: "from-violet-500 to-purple-600",
  };
  return (
    <div className="bg-white rounded-xl ring-1 ring-slate-200 p-3">
      <div className={cn("h-1 w-full rounded-full bg-gradient-to-r mb-2", colors[color])} />
      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</div>
      <div className="text-lg font-bold text-slate-800 mt-0.5">{value}</div>
    </div>
  );
}

// Star icon fallback
function Star(props: any) { return <Wallet {...props} />; }
