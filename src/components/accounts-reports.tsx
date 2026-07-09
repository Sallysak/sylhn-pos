"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, TrendingUp, BarChart3, Percent, DollarSign, FileText,
  BookOpen, FileBarChart2, Calendar, Printer, Download, X,
  Package, ShoppingCart, Receipt,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { COMPANY, CURRENCY, formatGHS, type Product, type StockHistoryEntry } from "@/lib/pos-data";

type ReportType = "daily-sales" | "profit-loss" | "vat-tax" | "stock-value" | "cost-price" | "stock-performance" | "general-ledger" | "trial-balance";

interface AccountsReportsProps {
  onBack: () => void;
  products: Product[];
  history: StockHistoryEntry[];
  dailyTotal: number;
  transactionCount: number;
  initialReport?: ReportType;
}

export function AccountsReports({ onBack, products, history, dailyTotal, transactionCount, initialReport = "daily-sales" }: AccountsReportsProps) {
  const { toast } = useToast();
  const [activeReport, setActiveReport] = useState<ReportType>(initialReport);
  const [fromDate, setFromDate] = useState(new Date().toISOString().split('T')[0]);
  const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);

  const reports: { id: ReportType; label: string; icon: any; color: string }[] = [
    { id: "daily-sales", label: "Daily Sales", icon: TrendingUp, color: "emerald" },
    { id: "profit-loss", label: "Profit & Loss", icon: BarChart3, color: "blue" },
    { id: "vat-tax", label: "VAT Tax Report", icon: Percent, color: "amber" },
    { id: "stock-value", label: "Stock Value", icon: DollarSign, color: "cyan" },
    { id: "cost-price", label: "Cost Price", icon: FileText, color: "purple" },
    { id: "stock-performance", label: "Stock Performance", icon: TrendingUp, color: "rose" },
    { id: "general-ledger", label: "General Ledger", icon: BookOpen, color: "indigo" },
    { id: "trial-balance", label: "Trial Balance", icon: FileBarChart2, color: "teal" },
  ];

  // ===== Computed data for each report =====
  const soldItems = history.filter(h => h.action === 'sold');
  const receivedItems = history.filter(h => h.action === 'received' || h.action === 'added');
  const adjustedItems = history.filter(h => h.action === 'adjusted');

  const stockValue = products.reduce((s, p) => s + p.price * p.stock, 0);
  const stockCost = products.reduce((s, p) => s + p.costPrice * p.stock, 0);
  const potentialProfit = stockValue - stockCost;
  const lowStockItems = products.filter(p => p.stock <= p.reorderLevel);

  // ===== Daily Sales data =====
  const dailySalesData = useMemo(() => {
    const totalRevenue = dailyTotal;
    const totalCost = soldItems.reduce((s, h) => {
      const product = products.find(p => p.id === h.productId);
      return s + (product ? product.costPrice * Math.abs(h.quantityChange) : 0);
    }, 0);
    const grossProfit = totalRevenue - totalCost;
    const vatCollected = totalRevenue * 0.15;
    return { totalRevenue, totalCost, grossProfit, vatCollected, transactionCount };
  }, [dailyTotal, soldItems, products, transactionCount]);

  // ===== P&L data =====
  const pnlData = useMemo(() => {
    const revenue = dailyTotal;
    const cogs = soldItems.reduce((s, h) => {
      const product = products.find(p => p.id === h.productId);
      return s + (product ? product.costPrice * Math.abs(h.quantityChange) : 0);
    }, 0);
    const grossProfit = revenue - cogs;
    const operatingExpenses = stockCost * 0.02; // estimated 2% of inventory as overhead
    const netProfit = grossProfit - operatingExpenses;
    const vatOutput = revenue * 0.15;
    return { revenue, cogs, grossProfit, operatingExpenses, netProfit, vatOutput, margin: revenue > 0 ? (netProfit / revenue) * 100 : 0 };
  }, [dailyTotal, soldItems, products, stockCost]);

  // ===== VAT data =====
  const vatData = useMemo(() => {
    const taxableItems = soldItems.filter(h => {
      const p = products.find(p => p.id === h.productId);
      return p?.taxable;
    });
    const nonTaxableItems = soldItems.filter(h => {
      const p = products.find(p => p.id === h.productId);
      return !p?.taxable;
    });
    const taxableRevenue = taxableItems.reduce((s, h) => {
      const p = products.find(p => p.id === h.productId);
      return s + (p ? p.price * Math.abs(h.quantityChange) : 0);
    }, 0);
    const nonTaxableRevenue = nonTaxableItems.reduce((s, h) => {
      const p = products.find(p => p.id === h.productId);
      return s + (p ? p.price * Math.abs(h.quantityChange) : 0);
    }, 0);
    const vatRate = 0.15;
    const vatCollected = taxableRevenue * vatRate;
    return { taxableRevenue, nonTaxableRevenue, vatCollected, vatRate, taxableCount: taxableItems.length, nonTaxableCount: nonTaxableItems.length };
  }, [soldItems, products]);

  // ===== Stock Performance data =====
  const stockPerfData = useMemo(() => {
    return products.map(p => {
      const sold = soldItems.filter(h => h.productId === p.id).reduce((s, h) => s + Math.abs(h.quantityChange), 0);
      const revenue = sold * p.price;
      const cost = sold * p.costPrice;
      const profit = revenue - cost;
      const turnover = p.stock > 0 ? sold / p.stock : 0;
      return { product: p, sold, revenue, cost, profit, turnover };
    }).sort((a, b) => b.revenue - a.revenue).slice(0, 20);
  }, [products, soldItems]);

  // ===== General Ledger entries =====
  const ledgerEntries = useMemo(() => {
    const entries: { date: string; account: string; debit: number; credit: number; description: string; ref: string }[] = [];
    soldItems.forEach(h => {
      const p = products.find(p => p.id === h.productId);
      const amount = p ? p.price * Math.abs(h.quantityChange) : 0;
      entries.push({ date: h.timestamp, account: 'Cash', debit: amount, credit: 0, description: `Sale: ${h.productName}`, ref: h.reference || '' });
      entries.push({ date: h.timestamp, account: 'Sales Revenue', debit: 0, credit: amount, description: `Sale: ${h.productName}`, ref: h.reference || '' });
      entries.push({ date: h.timestamp, account: 'COGS', debit: p ? p.costPrice * Math.abs(h.quantityChange) : 0, credit: 0, description: `Cost: ${h.productName}`, ref: h.reference || '' });
      entries.push({ date: h.timestamp, account: 'Inventory', debit: 0, credit: p ? p.costPrice * Math.abs(h.quantityChange) : 0, description: `Stock out: ${h.productName}`, ref: h.reference || '' });
    });
    receivedItems.forEach(h => {
      const p = products.find(p => p.id === h.productId);
      const amount = p ? p.costPrice * h.quantityChange : 0;
      entries.push({ date: h.timestamp, account: 'Inventory', debit: amount, credit: 0, description: `Received: ${h.productName}`, ref: h.reference || '' });
      entries.push({ date: h.timestamp, account: 'Accounts Payable', debit: 0, credit: amount, description: `Received: ${h.productName}`, ref: h.reference || '' });
    });
    adjustedItems.forEach(h => {
      const p = products.find(p => p.id === h.productId);
      const amount = p ? p.costPrice * Math.abs(h.quantityChange) : 0;
      entries.push({ date: h.timestamp, account: 'Inventory Adjustment', debit: h.quantityChange < 0 ? amount : 0, credit: h.quantityChange > 0 ? amount : 0, description: `${h.reason}`, ref: h.reference || '' });
    });
    return entries.sort((a, b) => b.date.localeCompare(a.date));
  }, [soldItems, receivedItems, adjustedItems, products]);

  // ===== Trial Balance =====
  const trialBalance = useMemo(() => {
    const accounts = new Map<string, number>();
    ledgerEntries.forEach(e => {
      accounts.set(e.account, (accounts.get(e.account) || 0) + e.debit - e.credit);
    });
    const rows = Array.from(accounts.entries()).map(([account, balance]) => ({
      account, debit: balance > 0 ? balance : 0, credit: balance < 0 ? Math.abs(balance) : 0,
    })).sort((a, b) => a.account.localeCompare(b.account));
    const totalDebit = rows.reduce((s, r) => s + r.debit, 0);
    const totalCredit = rows.reduce((s, r) => s + r.credit, 0);
    return { rows, totalDebit, totalCredit };
  }, [ledgerEntries]);

  // ===== Print handler =====
  const handlePrint = () => {
    const printWin = window.open('', '_blank', 'width=900,height=600');
    if (!printWin) { toast({ title: 'Popup blocked', variant: 'destructive' }); return; }
    const reportLabel = reports.find(r => r.id === activeReport)?.label || 'Report';
    printWin.document.write(`<!DOCTYPE html><html><head><title>${reportLabel}</title><style>body{font-family:Arial,sans-serif;margin:20px}.header{text-align:center;border-bottom:2px solid #333;padding-bottom:10px;margin-bottom:15px}.header h1{margin:0;font-size:18px}.header div{font-size:12px;color:#666}table{width:100%;border-collapse:collapse;font-size:11px}th{background:#1E5A8E;color:white;border:1px solid #999;padding:5px}td{border:1px solid #ccc;padding:4px}.total{font-weight:bold;background:#f0f0f0}</style></head><body><div class="header"><h1>${COMPANY.name}</h1><div>${COMPANY.address} · ${COMPANY.contact}</div></div><h2 style="text-align:center">${reportLabel}</h2><p>Date: ${fromDate} to ${toDate}</p></body></html>`);
    printWin.document.close();
    setTimeout(() => { printWin.focus(); printWin.print(); }, 300);
    toast({ title: 'Printing report' });
  };

  const handleExport = () => {
    import('xlsx').then((XLSX) => {
      const data: any[] = [];
      if (activeReport === 'daily-sales') {
        data.push({ Metric: 'Total Revenue', Value: dailySalesData.totalRevenue });
        data.push({ Metric: 'Total Cost', Value: dailySalesData.totalCost });
        data.push({ Metric: 'Gross Profit', Value: dailySalesData.grossProfit });
        data.push({ Metric: 'VAT Collected', Value: dailySalesData.vatCollected });
        data.push({ Metric: 'Transactions', Value: dailySalesData.transactionCount });
      } else if (activeReport === 'stock-value') {
        products.forEach(p => data.push({ SKU: p.sku, Product: p.name, Stock: p.stock, Cost: p.costPrice, Price: p.price, StockValue: p.price * p.stock }));
      } else if (activeReport === 'trial-balance') {
        trialBalance.rows.forEach(r => data.push({ Account: r.account, Debit: r.debit, Credit: r.credit }));
        data.push({ Account: 'TOTAL', Debit: trialBalance.totalDebit, Credit: trialBalance.totalCredit });
      }
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, reports.find(r => r.id === activeReport)?.label || 'Report');
      XLSX.writeFile(wb, `${activeReport}-${new Date().toISOString().split('T')[0]}.xlsx`);
      toast({ title: 'Exported successfully' });
    });
  };

  const colorClasses: Record<string, { bg: string; text: string; border: string; gradient: string }> = {
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-300', gradient: 'from-emerald-500 to-teal-500' },
    blue: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-300', gradient: 'from-blue-500 to-indigo-500' },
    amber: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-300', gradient: 'from-amber-500 to-orange-500' },
    cyan: { bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-300', gradient: 'from-cyan-500 to-blue-500' },
    purple: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-300', gradient: 'from-purple-500 to-pink-500' },
    rose: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-300', gradient: 'from-rose-500 to-red-500' },
    indigo: { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-300', gradient: 'from-indigo-500 to-blue-500' },
    teal: { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-300', gradient: 'from-teal-500 to-cyan-500' },
  };

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50">
      {/* Header */}
      <header className="flex-shrink-0 bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 text-white shadow-lg">
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="h-9 w-9 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center ring-1 ring-white/20">
                <BarChart3 className="h-5 w-5" />
              </div>
              <div>
                <div className="font-bold text-base leading-tight">Accounts & Financial Reports</div>
                <div className="text-[10px] text-slate-300">{COMPANY.name}</div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 text-xs">
              <Calendar className="h-3.5 w-3.5 text-slate-400" />
              <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="h-7 px-2 rounded-md bg-white/10 text-white text-xs border border-white/20 outline-none" />
              <span className="text-slate-400">to</span>
              <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="h-7 px-2 rounded-md bg-white/10 text-white text-xs border border-white/20 outline-none" />
            </div>
            <button onClick={handlePrint} className="h-8 px-3 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center gap-1.5 transition"><Printer className="h-3.5 w-3.5" /> Print</button>
            <button onClick={handleExport} className="h-8 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 transition"><Download className="h-3.5 w-3.5" /> Export</button>
          </div>
        </div>
      </header>

      {/* Report tabs */}
      <nav className="flex-shrink-0 bg-white border-b border-slate-200 shadow-sm">
        <div className="flex items-center gap-1 px-6 py-2 overflow-x-auto" style={{ scrollbarWidth: 'thin' }}>
          {reports.map(r => {
            const cc = colorClasses[r.color];
            const isActive = activeReport === r.id;
            return (
              <button key={r.id} onClick={() => setActiveReport(r.id)} className={cn("flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap", isActive ? cn("bg-gradient-to-r text-white shadow-md", cc.gradient) : "text-slate-600 hover:bg-slate-100")}>
                <r.icon className="h-4 w-4" /> {r.label}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Content */}
      <main className="flex-1 overflow-auto p-6" style={{ scrollbarWidth: 'thin' }}>
        <AnimatePresence mode="wait">
          <motion.div key={activeReport} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} className="max-w-5xl mx-auto">

            {/* ===== Daily Sales ===== */}
            {activeReport === "daily-sales" && (
              <div className="space-y-4">
                <div className="grid grid-cols-4 gap-4">
                  {[
                    { label: 'Total Revenue', value: formatGHS(dailySalesData.totalRevenue), icon: DollarSign, color: 'emerald' },
                    { label: 'Total Cost', value: formatGHS(dailySalesData.totalCost), icon: ShoppingCart, color: 'rose' },
                    { label: 'Gross Profit', value: formatGHS(dailySalesData.grossProfit), icon: TrendingUp, color: 'blue' },
                    { label: 'Transactions', value: String(dailySalesData.transactionCount), icon: Receipt, color: 'amber' },
                  ].map((stat, i) => {
                    const cc = colorClasses[stat.color];
                    const ringClass = cc.border.replace('border-', 'ring-');
                    return (
                      <div key={i} className={cn("rounded-2xl p-4 ring-1", cc.bg, ringClass)}>
                        <div className="flex items-center gap-2 mb-2"><stat.icon className={cn("h-5 w-5", cc.text)} /><span className="text-xs font-bold text-slate-600 uppercase">{stat.label}</span></div>
                        <div className="text-2xl font-bold text-slate-800 font-mono">{stat.value}</div>
                      </div>
                    );
                  })}
                </div>
                <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 overflow-hidden">
                  <div className="px-5 py-3 bg-slate-50 border-b border-slate-200"><span className="text-sm font-bold text-slate-700">Sales Summary</span></div>
                  <table className="w-full text-sm">
                    <thead><tr className="bg-slate-100 text-xs uppercase text-slate-600"><th className="text-left px-4 py-2 font-semibold">Metric</th><th className="text-right px-4 py-2 font-semibold">Amount (GHC)</th></tr></thead>
                    <tbody className="divide-y divide-slate-100">
                      <tr><td className="px-4 py-2.5 font-medium text-slate-700">Gross Revenue</td><td className="px-4 py-2.5 text-right font-mono text-emerald-600 font-semibold">{formatGHS(dailySalesData.totalRevenue)}</td></tr>
                      <tr><td className="px-4 py-2.5 font-medium text-slate-700">Cost of Goods Sold</td><td className="px-4 py-2.5 text-right font-mono text-rose-600">{formatGHS(dailySalesData.totalCost)}</td></tr>
                      <tr><td className="px-4 py-2.5 font-medium text-slate-700">VAT Collected (15%)</td><td className="px-4 py-2.5 text-right font-mono text-amber-600">{formatGHS(dailySalesData.vatCollected)}</td></tr>
                      <tr className="bg-slate-50"><td className="px-4 py-3 font-bold text-slate-800">Net Profit</td><td className="px-4 py-3 text-right font-mono font-bold text-blue-700 text-base">{formatGHS(dailySalesData.grossProfit)}</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ===== Profit & Loss ===== */}
            {activeReport === "profit-loss" && (
              <div className="space-y-4">
                <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 overflow-hidden">
                  <div className="px-5 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-slate-200"><span className="text-sm font-bold text-slate-700">Profit & Loss Statement</span></div>
                  <table className="w-full text-sm">
                    <tbody className="divide-y divide-slate-100">
                      <tr><td className="px-5 py-3 font-bold text-slate-700 bg-slate-50" colSpan={2}>Revenue</td></tr>
                      <tr><td className="px-5 py-2.5 pl-8 text-slate-600">Sales Revenue</td><td className="px-5 py-2.5 text-right font-mono text-emerald-600">{formatGHS(pnlData.revenue)}</td></tr>
                      <tr><td className="px-5 py-3 font-bold text-slate-700 bg-slate-50" colSpan={2}>Cost of Goods Sold</td></tr>
                      <tr><td className="px-5 py-2.5 pl-8 text-slate-600">COGS</td><td className="px-5 py-2.5 text-right font-mono text-rose-600">({formatGHS(pnlData.cogs)})</td></tr>
                      <tr className="bg-blue-50"><td className="px-5 py-3 font-bold text-slate-800">Gross Profit</td><td className="px-5 py-3 text-right font-mono font-bold text-blue-700">{formatGHS(pnlData.grossProfit)}</td></tr>
                      <tr><td className="px-5 py-3 font-bold text-slate-700 bg-slate-50" colSpan={2}>Operating Expenses</td></tr>
                      <tr><td className="px-5 py-2.5 pl-8 text-slate-600">Estimated Overhead (2% of inventory)</td><td className="px-5 py-2.5 text-right font-mono text-rose-600">({formatGHS(pnlData.operatingExpenses)})</td></tr>
                      <tr className="bg-emerald-50"><td className="px-5 py-3 font-bold text-slate-800">Net Profit</td><td className="px-5 py-3 text-right font-mono font-bold text-emerald-700 text-base">{formatGHS(pnlData.netProfit)}</td></tr>
                      <tr><td className="px-5 py-2.5 text-slate-500 italic">Profit Margin</td><td className="px-5 py-2.5 text-right font-mono text-slate-500">{pnlData.margin.toFixed(1)}%</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ===== VAT Tax Report ===== */}
            {activeReport === "vat-tax" && (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="rounded-2xl p-4 bg-amber-50 ring-1 ring-amber-200"><div className="text-xs font-bold text-amber-700 uppercase mb-1">Taxable Revenue</div><div className="text-xl font-bold font-mono text-slate-800">{formatGHS(vatData.taxableRevenue)}</div></div>
                  <div className="rounded-2xl p-4 bg-slate-50 ring-1 ring-slate-200"><div className="text-xs font-bold text-slate-500 uppercase mb-1">Non-Taxable</div><div className="text-xl font-bold font-mono text-slate-600">{formatGHS(vatData.nonTaxableRevenue)}</div></div>
                  <div className="rounded-2xl p-4 bg-emerald-50 ring-1 ring-emerald-200"><div className="text-xs font-bold text-emerald-700 uppercase mb-1">VAT Collected (15%)</div><div className="text-xl font-bold font-mono text-emerald-700">{formatGHS(vatData.vatCollected)}</div></div>
                </div>
                <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 overflow-hidden">
                  <div className="px-5 py-3 bg-amber-50 border-b border-amber-100"><span className="text-sm font-bold text-slate-700">VAT Breakdown</span></div>
                  <table className="w-full text-sm">
                    <thead><tr className="bg-slate-100 text-xs uppercase text-slate-600"><th className="text-left px-4 py-2">Category</th><th className="text-center px-4 py-2">Items</th><th className="text-right px-4 py-2">Revenue</th><th className="text-right px-4 py-2">VAT Rate</th><th className="text-right px-4 py-2">VAT Amount</th></tr></thead>
                    <tbody className="divide-y divide-slate-100">
                      <tr><td className="px-4 py-2.5 font-medium text-slate-700">Taxable Items</td><td className="px-4 py-2.5 text-center font-mono">{vatData.taxableCount}</td><td className="px-4 py-2.5 text-right font-mono text-emerald-600">{formatGHS(vatData.taxableRevenue)}</td><td className="px-4 py-2.5 text-right font-mono">15%</td><td className="px-4 py-2.5 text-right font-mono font-bold text-amber-600">{formatGHS(vatData.vatCollected)}</td></tr>
                      <tr><td className="px-4 py-2.5 font-medium text-slate-700">Non-Taxable Items</td><td className="px-4 py-2.5 text-center font-mono">{vatData.nonTaxableCount}</td><td className="px-4 py-2.5 text-right font-mono text-slate-500">{formatGHS(vatData.nonTaxableRevenue)}</td><td className="px-4 py-2.5 text-right font-mono">0%</td><td className="px-4 py-2.5 text-right font-mono text-slate-400">—</td></tr>
                      <tr className="bg-slate-50 font-bold"><td className="px-4 py-3 text-slate-800">Total</td><td className="px-4 py-3 text-center font-mono">{vatData.taxableCount + vatData.nonTaxableCount}</td><td className="px-4 py-3 text-right font-mono text-slate-800">{formatGHS(vatData.taxableRevenue + vatData.nonTaxableRevenue)}</td><td className="px-4 py-3"></td><td className="px-4 py-3 text-right font-mono text-amber-700">{formatGHS(vatData.vatCollected)}</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ===== Stock Value Report ===== */}
            {activeReport === "stock-value" && (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="rounded-2xl p-4 bg-cyan-50 ring-1 ring-cyan-200"><div className="text-xs font-bold text-cyan-700 uppercase mb-1">Total Stock Value (Retail)</div><div className="text-xl font-bold font-mono text-slate-800">{formatGHS(stockValue)}</div></div>
                  <div className="rounded-2xl p-4 bg-rose-50 ring-1 ring-rose-200"><div className="text-xs font-bold text-rose-700 uppercase mb-1">Total Stock Cost</div><div className="text-xl font-bold font-mono text-slate-800">{formatGHS(stockCost)}</div></div>
                  <div className="rounded-2xl p-4 bg-emerald-50 ring-1 ring-emerald-200"><div className="text-xs font-bold text-emerald-700 uppercase mb-1">Potential Profit</div><div className="text-xl font-bold font-mono text-emerald-700">{formatGHS(potentialProfit)}</div></div>
                </div>
                <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 overflow-hidden">
                  <div className="px-5 py-3 bg-cyan-50 border-b border-cyan-100"><span className="text-sm font-bold text-slate-700">Stock Value by Product ({products.length} items)</span></div>
                  <div className="max-h-96 overflow-auto" style={{ scrollbarWidth: 'thin' }}>
                    <table className="w-full text-sm">
                      <thead className="sticky top-0"><tr className="bg-slate-800 text-white text-xs uppercase"><th className="text-left px-4 py-2">Product</th><th className="text-center px-3 py-2">Stock</th><th className="text-right px-3 py-2">Cost</th><th className="text-right px-3 py-2">Price</th><th className="text-right px-4 py-2">Stock Value</th></tr></thead>
                      <tbody className="divide-y divide-slate-100">
                        {products.map((p, i) => (
                          <tr key={p.id} className={i % 2 === 1 ? 'bg-slate-50/50' : 'bg-white'}><td className="px-4 py-2"><span className="text-lg mr-1">{p.emoji}</span><span className="font-medium text-slate-700">{p.name}</span></td><td className="px-3 py-2 text-center font-mono">{p.stock}</td><td className="px-3 py-2 text-right font-mono text-slate-500">{formatGHS(p.costPrice)}</td><td className="px-3 py-2 text-right font-mono text-emerald-600">{formatGHS(p.price)}</td><td className="px-4 py-2 text-right font-mono font-semibold text-slate-800">{formatGHS(p.price * p.stock)}</td></tr>
                        ))}
                      </tbody>
                      <tfoot><tr className="bg-slate-100 font-bold"><td className="px-4 py-3 text-slate-800" colSpan={4}>Total Stock Value</td><td className="px-4 py-3 text-right font-mono text-cyan-700 text-base">{formatGHS(stockValue)}</td></tr></tfoot>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ===== Cost Price Report ===== */}
            {activeReport === "cost-price" && (
              <div className="space-y-4">
                <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 overflow-hidden">
                  <div className="px-5 py-3 bg-purple-50 border-b border-purple-100"><span className="text-sm font-bold text-slate-700">Cost Price Analysis ({products.length} products)</span></div>
                  <div className="max-h-96 overflow-auto" style={{ scrollbarWidth: 'thin' }}>
                    <table className="w-full text-sm">
                      <thead className="sticky top-0"><tr className="bg-slate-800 text-white text-xs uppercase"><th className="text-left px-4 py-2">Product</th><th className="text-right px-3 py-2">Cost</th><th className="text-right px-3 py-2">Price</th><th className="text-right px-3 py-2">Markup</th><th className="text-right px-3 py-2">Margin %</th><th className="text-right px-4 py-2">Profit/Unit</th></tr></thead>
                      <tbody className="divide-y divide-slate-100">
                        {products.map((p, i) => {
                          const markup = p.costPrice > 0 ? ((p.price - p.costPrice) / p.costPrice) * 100 : 0;
                          const margin = p.price > 0 ? ((p.price - p.costPrice) / p.price) * 100 : 0;
                          return (
                            <tr key={p.id} className={i % 2 === 1 ? 'bg-slate-50/50' : 'bg-white'}><td className="px-4 py-2"><span className="text-lg mr-1">{p.emoji}</span><span className="font-medium text-slate-700">{p.name}</span></td><td className="px-3 py-2 text-right font-mono text-rose-600">{formatGHS(p.costPrice)}</td><td className="px-3 py-2 text-right font-mono text-emerald-600">{formatGHS(p.price)}</td><td className="px-3 py-2 text-right font-mono text-slate-600">{markup.toFixed(1)}%</td><td className="px-3 py-2 text-right font-mono"><span className={cn("font-semibold", margin > 30 ? "text-emerald-600" : margin > 15 ? "text-amber-600" : "text-rose-600")}>{margin.toFixed(1)}%</span></td><td className="px-4 py-2 text-right font-mono font-semibold text-blue-600">{formatGHS(p.price - p.costPrice)}</td></tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ===== Stock Performance ===== */}
            {activeReport === "stock-performance" && (
              <div className="space-y-4">
                <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 overflow-hidden">
                  <div className="px-5 py-3 bg-rose-50 border-b border-rose-100"><span className="text-sm font-bold text-slate-700">Top 20 Products by Revenue</span></div>
                  <div className="max-h-96 overflow-auto" style={{ scrollbarWidth: 'thin' }}>
                    <table className="w-full text-sm">
                      <thead className="sticky top-0"><tr className="bg-slate-800 text-white text-xs uppercase"><th className="text-left px-4 py-2">#</th><th className="text-left px-3 py-2">Product</th><th className="text-center px-3 py-2">Sold</th><th className="text-right px-3 py-2">Revenue</th><th className="text-right px-3 py-2">Cost</th><th className="text-right px-3 py-2">Profit</th><th className="text-center px-4 py-2">Turnover</th></tr></thead>
                      <tbody className="divide-y divide-slate-100">
                        {stockPerfData.map((d, i) => (
                          <tr key={d.product.id} className={i % 2 === 1 ? 'bg-slate-50/50' : 'bg-white'}><td className="px-4 py-2 text-center font-bold text-slate-400">{i + 1}</td><td className="px-3 py-2"><span className="text-lg mr-1">{d.product.emoji}</span><span className="font-medium text-slate-700">{d.product.name}</span></td><td className="px-3 py-2 text-center font-mono">{d.sold}</td><td className="px-3 py-2 text-right font-mono text-emerald-600">{formatGHS(d.revenue)}</td><td className="px-3 py-2 text-right font-mono text-rose-500">{formatGHS(d.cost)}</td><td className="px-3 py-2 text-right font-mono font-semibold text-blue-600">{formatGHS(d.profit)}</td><td className="px-4 py-2 text-center font-mono text-slate-500">{d.turnover.toFixed(2)}x</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ===== General Ledger ===== */}
            {activeReport === "general-ledger" && (
              <div className="space-y-4">
                <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 overflow-hidden">
                  <div className="px-5 py-3 bg-indigo-50 border-b border-indigo-100 flex items-center justify-between"><span className="text-sm font-bold text-slate-700">General Ledger ({ledgerEntries.length} entries)</span></div>
                  <div className="max-h-96 overflow-auto" style={{ scrollbarWidth: 'thin' }}>
                    <table className="w-full text-sm">
                      <thead className="sticky top-0"><tr className="bg-slate-800 text-white text-xs uppercase"><th className="text-left px-4 py-2">Date</th><th className="text-left px-3 py-2">Account</th><th className="text-left px-3 py-2">Description</th><th className="text-left px-3 py-2">Ref</th><th className="text-right px-3 py-2">Debit</th><th className="text-right px-4 py-2">Credit</th></tr></thead>
                      <tbody className="divide-y divide-slate-100">
                        {ledgerEntries.slice(0, 100).map((e, i) => (
                          <tr key={i} className={i % 2 === 1 ? 'bg-slate-50/50' : 'bg-white'}><td className="px-4 py-2 text-xs text-slate-500">{new Date(e.date).toLocaleDateString('en-GB')}</td><td className="px-3 py-2 font-medium text-slate-700">{e.account}</td><td className="px-3 py-2 text-slate-600 text-xs truncate max-w-xs">{e.description}</td><td className="px-3 py-2 text-xs font-mono text-slate-400">{e.ref}</td><td className="px-3 py-2 text-right font-mono text-slate-600">{e.debit > 0 ? formatGHS(e.debit) : '—'}</td><td className="px-4 py-2 text-right font-mono text-slate-600">{e.credit > 0 ? formatGHS(e.credit) : '—'}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ===== Trial Balance ===== */}
            {activeReport === "trial-balance" && (
              <div className="space-y-4">
                <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 overflow-hidden">
                  <div className="px-5 py-3 bg-teal-50 border-b border-teal-100"><span className="text-sm font-bold text-slate-700">Trial Balance</span></div>
                  <table className="w-full text-sm">
                    <thead><tr className="bg-slate-800 text-white text-xs uppercase"><th className="text-left px-4 py-2">Account</th><th className="text-right px-4 py-2">Debit (GHC)</th><th className="text-right px-4 py-2">Credit (GHC)</th></tr></thead>
                    <tbody className="divide-y divide-slate-100">
                      {trialBalance.rows.map((r, i) => (
                        <tr key={i} className={i % 2 === 1 ? 'bg-slate-50/50' : 'bg-white'}><td className="px-4 py-2.5 font-medium text-slate-700">{r.account}</td><td className="px-4 py-2.5 text-right font-mono text-slate-600">{r.debit > 0 ? formatGHS(r.debit) : '—'}</td><td className="px-4 py-2.5 text-right font-mono text-slate-600">{r.credit > 0 ? formatGHS(r.credit) : '—'}</td></tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-100 font-bold"><td className="px-4 py-3 text-slate-800">Total</td><td className="px-4 py-3 text-right font-mono text-teal-700 text-base">{formatGHS(trialBalance.totalDebit)}</td><td className="px-4 py-3 text-right font-mono text-teal-700 text-base">{formatGHS(trialBalance.totalCredit)}</td></tr>
                      <tr><td className="px-4 py-2 text-xs text-slate-400 italic" colSpan={3}>{trialBalance.totalDebit === trialBalance.totalCredit ? '✓ Balanced' : '⚠ Not balanced — check entries'}</td></tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
