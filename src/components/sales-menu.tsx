"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, FileText, DollarSign, Users, X, Printer, Folder,
  BarChart3, TrendingUp, CreditCard, User, Package,
  ShoppingCart, Calendar, Search, Check, Download, Filter,
  FileSpreadsheet, FileBarChart, Loader2, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { COMPANY, CURRENCY, formatGHS } from "@/lib/pos-data";
import { PopupWindow } from "@/components/popup-window";

interface SalesMenuProps {
  onBack: () => void;
}

interface SaleRecord {
  id: string;
  invoiceNumber: string;
  customerName: string;
  cashierName: string;
  subtotal: number;
  discount: number;
  taxAmount: number;
  total: number;
  amountPaid: number;
  change: number;
  paymentMethod: string;
  status: string;
  createdAt: string;
  items: Array<{
    sku: string;
    name: string;
    emoji: string;
    quantity: number;
    price: number;
    total: number;
  }>;
  pointsEarned: number;
  pointsRedeemed: number;
  grossProfit: number;
  costOfGoods: number;
}

type ReportType =
  | "invoice-list" | "sales-summary" | "sold-items" | "sales-by-client"
  | "sales-by-product" | "sales-by-cashier" | "sales-tax" | "payment-methods"
  | "profit-analysis" | "loyalty-points";

const REPORT_CONFIG: Record<ReportType, { label: string; icon: any; color: string; bg: string }> = {
  "invoice-list":      { label: "Invoice List Report",      icon: FileText,    color: "text-blue-600",    bg: "bg-blue-50" },
  "sales-summary":     { label: "Summary Sales Report",     icon: BarChart3,   color: "text-emerald-600", bg: "bg-emerald-50" },
  "sold-items":        { label: "Sold Items Report",        icon: ShoppingCart,color: "text-purple-600",  bg: "bg-purple-50" },
  "sales-by-client":   { label: "Sales by Client",          icon: Users,       color: "text-cyan-600",    bg: "bg-cyan-50" },
  "sales-by-product":  { label: "Sales by Product",         icon: Package,     color: "text-amber-600",   bg: "bg-amber-50" },
  "sales-by-cashier":  { label: "Staff Sales Report",       icon: User,        color: "text-rose-600",    bg: "bg-rose-50" },
  "sales-tax":         { label: "Sales Tax Report",         icon: DollarSign,  color: "text-indigo-600",  bg: "bg-indigo-50" },
  "payment-methods":   { label: "Payment Methods Report",   icon: CreditCard,  color: "text-teal-600",    bg: "bg-teal-50" },
  "profit-analysis":   { label: "Profit Analysis Report",   icon: TrendingUp,  color: "text-green-600",   bg: "bg-green-50" },
  "loyalty-points":    { label: "Loyalty Points Report",    icon: CreditCard,  color: "text-violet-600",  bg: "bg-violet-50" },
};

export function SalesMenu({ onBack }: SalesMenuProps) {
  const { toast } = useToast();
  const [activeReport, setActiveReport] = useState<ReportType | null>(null);

  const menuItems: { type: ReportType }[] = (Object.keys(REPORT_CONFIG) as ReportType[]).map(type => ({ type }));

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="flex-shrink-0 bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-700 text-white shadow-lg sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="h-9 w-9 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center transition">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div>
              <h1 className="text-lg font-bold flex items-center gap-2">
                <FileBarChart className="h-5 w-5" />
                Sales Reports Center
              </h1>
              <div className="text-[10px] text-blue-100/80">{COMPANY.name} · Advanced Reporting & Analytics</div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Report Cards Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {menuItems.map(({ type }) => {
            const config = REPORT_CONFIG[type];
            const Icon = config.icon;
            return (
              <motion.button
                key={type}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setActiveReport(type)}
                className="bg-white rounded-2xl shadow-lg ring-1 ring-slate-200 p-4 flex flex-col items-center gap-2 hover:shadow-xl transition group"
              >
                <div className={cn("h-12 w-12 rounded-xl flex items-center justify-center transition group-hover:scale-110", config.bg)}>
                  <Icon className={cn("h-6 w-6", config.color)} />
                </div>
                <span className="text-xs font-bold text-slate-700 text-center leading-tight">{config.label}</span>
              </motion.button>
            );
          })}
        </div>

        {/* Quick Stats Banner */}
        <QuickStatsBanner />
      </main>

      {/* Report Viewer Modal */}
      <AnimatePresence>
        {activeReport && (
          <ReportViewer
            reportType={activeReport}
            onClose={() => setActiveReport(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ===== Quick Stats Banner =====
function QuickStatsBanner() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/dashboard", { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          setStats(data.salesSummary);
        }
      } catch { /* ignore */ }
      finally { setLoading(false); }
    })();
  }, []);

  if (loading || !stats) {
    return <div className="mt-6 h-24 rounded-2xl bg-white/5 animate-pulse" />;
  }

  const cards = [
    { label: "Today's Revenue", value: stats.today.revenue, sub: `${stats.today.transactionCount} sales`, color: "from-emerald-500 to-teal-600" },
    { label: "Today's Profit", value: stats.today.grossProfit, sub: `COGS: ${formatGHS(stats.today.costOfGoods)}`, color: "from-blue-500 to-indigo-600" },
    { label: "This Week", value: stats.weekToDate.revenue, sub: `${stats.weekToDate.transactionCount} sales`, color: "from-purple-500 to-violet-600" },
    { label: "This Month", value: stats.monthToDate.revenue, sub: `${stats.monthToDate.transactionCount} sales`, color: "from-amber-500 to-orange-600" },
  ];

  return (
    <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((card, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.1 }}
          className={cn("rounded-2xl p-4 bg-gradient-to-br text-white shadow-lg", card.color)}
        >
          <div className="text-[10px] uppercase font-bold tracking-wider opacity-80">{card.label}</div>
          <div className="text-xl font-bold font-mono mt-1">{formatGHS(card.value)}</div>
          <div className="text-[10px] opacity-80 mt-0.5">{card.sub}</div>
        </motion.div>
      ))}
    </div>
  );
}

// ===== Report Viewer (the main report modal) =====
function ReportViewer({ reportType, onClose }: { reportType: ReportType; onClose: () => void }) {
  const { toast } = useToast();
  const config = REPORT_CONFIG[reportType];
  const Icon = config.icon;

  // Filters
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [cashierFilter, setCashierFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Data
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(true);

  const fetchSales = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      params.set("limit", "1000");
      const res = await fetch(`/api/sales?${params}`, { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      setSales(data.sales || []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [dateFrom, dateTo]);

  useEffect(() => { fetchSales(); }, [fetchSales]);

  // Apply filters
  const filteredSales = useMemo(() => {
    let result = sales;
    if (statusFilter !== "all") result = result.filter(s => s.status === statusFilter);
    if (paymentFilter !== "all") result = result.filter(s => s.paymentMethod === paymentFilter);
    if (cashierFilter !== "all") result = result.filter(s => s.cashierName === cashierFilter);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(s =>
        s.invoiceNumber?.toLowerCase().includes(q) ||
        s.customerName?.toLowerCase().includes(q) ||
        s.cashierName?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [sales, statusFilter, paymentFilter, cashierFilter, searchQuery]);

  // Unique cashiers for filter dropdown
  const cashiers = useMemo(() => [...new Set(sales.map(s => s.cashierName))].filter(Boolean), [sales]);

  // Compute report data based on type
  const reportData = useMemo(() => {
    switch (reportType) {
      case "invoice-list":
        return filteredSales.map(s => ({
          "Invoice #": s.invoiceNumber,
          "Date": new Date(s.createdAt).toLocaleDateString("en-GB"),
          "Customer": s.customerName || "Walk-in",
          "Cashier": s.cashierName,
          "Subtotal": s.subtotal,
          "Discount": s.discount,
          "Tax": s.taxAmount,
          "Total": s.total,
          "Paid": s.amountPaid,
          "Method": s.paymentMethod,
          "Status": s.status,
        }));

      case "sales-summary": {
        const totalRev = filteredSales.reduce((s, x) => s + x.total, 0);
        const totalTax = filteredSales.reduce((s, x) => s + x.taxAmount, 0);
        const totalDisc = filteredSales.reduce((s, x) => s + x.discount, 0);
        const totalProfit = filteredSales.reduce((s, x) => s + (x.grossProfit || 0), 0);
        return [{
          "Period": `${dateFrom || "All"} to ${dateTo || "Today"}`,
          "Transactions": filteredSales.length,
          "Gross Sales": filteredSales.reduce((s, x) => s + x.subtotal, 0),
          "Discounts Given": totalDisc,
          "Tax Collected": totalTax,
          "Net Revenue": totalRev,
          "Cost of Goods": filteredSales.reduce((s, x) => s + (x.costOfGoods || 0), 0),
          "Gross Profit": totalProfit,
          "Avg Transaction": filteredSales.length > 0 ? totalRev / filteredSales.length : 0,
          "Profit Margin %": totalRev > 0 ? (totalProfit / totalRev) * 100 : 0,
        }];
      }

      case "sold-items": {
        const itemAgg: Record<string, any> = {};
        for (const sale of filteredSales) {
          for (const item of sale.items || []) {
            const key = item.sku;
            if (!itemAgg[key]) {
              itemAgg[key] = { "SKU": item.sku, "Product": item.name, "Qty Sold": 0, "Revenue": 0, "Emoji": item.emoji };
            }
            itemAgg[key]["Qty Sold"] += item.quantity;
            itemAgg[key]["Revenue"] += item.total;
          }
        }
        return Object.values(itemAgg).sort((a, b) => b["Revenue"] - a["Revenue"]);
      }

      case "sales-by-client": {
        const clientAgg: Record<string, any> = {};
        for (const sale of filteredSales) {
          const key = sale.customerName || "Walk-in";
          if (!clientAgg[key]) {
            clientAgg[key] = { "Customer": key, "Transactions": 0, "Total Spent": 0, "Items": 0, "Tax Paid": 0 };
          }
          clientAgg[key]["Transactions"] += 1;
          clientAgg[key]["Total Spent"] += sale.total;
          clientAgg[key]["Items"] += (sale.items?.length || 0);
          clientAgg[key]["Tax Paid"] += sale.taxAmount;
        }
        return Object.values(clientAgg).sort((a, b) => b["Total Spent"] - a["Total Spent"]);
      }

      case "sales-by-product": {
        const prodAgg: Record<string, any> = {};
        for (const sale of filteredSales) {
          for (const item of sale.items || []) {
            const key = item.sku;
            if (!prodAgg[key]) {
              prodAgg[key] = { "SKU": item.sku, "Product": item.name, "Qty": 0, "Revenue": 0, "Avg Price": 0, "Sales Count": 0 };
            }
            prodAgg[key]["Qty"] += item.quantity;
            prodAgg[key]["Revenue"] += item.total;
            prodAgg[key]["Sales Count"] += 1;
          }
        }
        Object.values(prodAgg).forEach((p: any) => { p["Avg Price"] = p["Qty"] > 0 ? p["Revenue"] / p["Qty"] : 0; });
        return Object.values(prodAgg).sort((a, b) => b["Revenue"] - a["Revenue"]);
      }

      case "sales-by-cashier": {
        const cashierAgg: Record<string, any> = {};
        for (const sale of filteredSales) {
          const key = sale.cashierName || "Unknown";
          if (!cashierAgg[key]) {
            cashierAgg[key] = { "Cashier": key, "Transactions": 0, "Total Sales": 0, "Items Sold": 0, "Tax Collected": 0, "Profit": 0 };
          }
          cashierAgg[key]["Transactions"] += 1;
          cashierAgg[key]["Total Sales"] += sale.total;
          cashierAgg[key]["Items Sold"] += (sale.items?.length || 0);
          cashierAgg[key]["Tax Collected"] += sale.taxAmount;
          cashierAgg[key]["Profit"] += (sale.grossProfit || 0);
        }
        return Object.values(cashierAgg).sort((a, b) => b["Total Sales"] - a["Total Sales"]);
      }

      case "sales-tax": {
        const taxAgg: Record<string, any> = {};
        for (const sale of filteredSales) {
          const key = sale.paymentMethod;
          if (!taxAgg[key]) taxAgg[key] = { "Payment Method": key, "Transactions": 0, "Subtotal": 0, "Tax": 0, "Total": 0 };
          taxAgg[key]["Transactions"] += 1;
          taxAgg[key]["Subtotal"] += sale.subtotal;
          taxAgg[key]["Tax"] += sale.taxAmount;
          taxAgg[key]["Total"] += sale.total;
        }
        return Object.values(taxAgg);
      }

      case "payment-methods": {
        const payAgg: Record<string, any> = {};
        for (const sale of filteredSales) {
          const key = sale.paymentMethod;
          if (!payAgg[key]) payAgg[key] = { "Method": key, "Count": 0, "Amount": 0, "% of Total": 0 };
          payAgg[key]["Count"] += 1;
          payAgg[key]["Amount"] += sale.amountPaid;
        }
        const total = Object.values(payAgg).reduce((s: number, x: any) => s + x["Amount"], 0);
        Object.values(payAgg).forEach((p: any) => { p["% of Total"] = total > 0 ? (p["Amount"] / total) * 100 : 0; });
        return Object.values(payAgg).sort((a, b) => b["Amount"] - a["Amount"]);
      }

      case "profit-analysis": {
        return filteredSales.map(s => ({
          "Invoice": s.invoiceNumber,
          "Date": new Date(s.createdAt).toLocaleDateString("en-GB"),
          "Revenue": s.subtotal,
          "COGS": s.costOfGoods || 0,
          "Gross Profit": s.grossProfit || 0,
          "Margin %": s.subtotal > 0 ? ((s.grossProfit || 0) / s.subtotal) * 100 : 0,
          "Items": s.items?.length || 0,
        })).sort((a, b) => b["Gross Profit"] - a["Gross Profit"]);
      }

      case "loyalty-points": {
        return filteredSales.filter(s => s.pointsEarned > 0 || s.pointsRedeemed > 0).map(s => ({
          "Invoice": s.invoiceNumber,
          "Date": new Date(s.createdAt).toLocaleDateString("en-GB"),
          "Customer": s.customerName || "Walk-in",
          "Points Earned": s.pointsEarned,
          "Points Redeemed": s.pointsRedeemed,
          "Net Points": s.pointsEarned - s.pointsRedeemed,
          "Sale Total": s.total,
        }));
      }

      default:
        return [];
    }
  }, [filteredSales, reportType, dateFrom, dateTo]);

  // Summary stats for the report
  const summary = useMemo(() => {
    if (reportData.length === 0) return null;
    const numericCols = Object.keys(reportData[0]).filter(k => typeof reportData[0][k] === "number");
    const sums: Record<string, number> = {};
    for (const col of numericCols) {
      sums[col] = reportData.reduce((s, row) => s + (typeof row[col] === "number" ? row[col] : 0), 0);
    }
    return { count: reportData.length, sums };
  }, [reportData]);

  // Export functions
  const exportCSV = () => {
    if (reportData.length === 0) return;
    const headers = Object.keys(reportData[0]);
    const csv = [
      headers.join(","),
      ...reportData.map(row => headers.map(h => {
        const val = row[h];
        if (typeof val === "number") return val.toFixed(2);
        return `"${String(val).replace(/"/g, '""')}"`;
      }).join(","))
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${reportType}-report-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "CSV Exported", description: `${reportData.length} rows` });
  };

  const exportExcel = () => {
    if (reportData.length === 0) return;
    // Use the xlsx library (already in dependencies)
    import("xlsx").then((XLSX) => {
      const ws = XLSX.utils.json_to_sheet(reportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Report");
      XLSX.writeFile(wb, `${reportType}-report-${new Date().toISOString().split("T")[0]}.xlsx`);
      toast({ title: "Excel Exported", description: `${reportData.length} rows` });
    });
  };

  const exportPDF = () => {
    if (reportData.length === 0) return;
    const printWin = window.open("", "_blank", "width=900,height=700");
    if (!printWin) { toast({ title: "Popup blocked", variant: "destructive" }); return; }

    const headers = Object.keys(reportData[0]);
    const rows = reportData.map(row =>
      `<tr>${headers.map(h => {
        const val = row[h];
        const formatted = typeof val === "number" ? val.toFixed(2) : val;
        const align = typeof val === "number" ? "right" : "left";
        return `<td style="text-align:${align};padding:4px 8px;border:1px solid #ddd">${formatted}</td>`;
      }).join("")}</tr>`
    ).join("");

    const summaryHtml = summary ? `
      <div style="margin-bottom:20px;padding:12px;background:#f0f4f8;border-radius:8px">
        <strong>Summary:</strong> ${summary.count} records |
        ${Object.entries(summary.sums).map(([k, v]) => `${k}: <strong>${typeof v === "number" && v % 1 !== 0 ? v.toFixed(2) : v}</strong>`).join(" | ")}
      </div>` : "";

    printWin.document.write(`<!DOCTYPE html><html><head><title>${config.label}</title>
      <style>
        body{font-family:Arial,sans-serif;margin:20px;color:#1e293b}
        h1{font-size:18px;color:#1e40af;margin-bottom:4px}
        .meta{font-size:11px;color:#64748b;margin-bottom:16px}
        table{width:100%;border-collapse:collapse;font-size:11px}
        th{background:#1e40af;color:white;padding:6px 8px;text-align:left;font-weight:bold}
        tr:nth-child(even){background:#f8fafc}
        .footer{margin-top:20px;font-size:10px;color:#94a3b8;text-align:center}
      </style></head><body>
      <h1>${config.label}</h1>
      <div class="meta">${COMPANY.name} · ${COMPANY.address} · ${COMPANY.contact}<br>
      Generated: ${new Date().toLocaleString("en-GB")} | Period: ${dateFrom || "All"} to ${dateTo || "Today"} | Records: ${reportData.length}</div>
      ${summaryHtml}
      <table><thead><tr>${headers.map(h => `<th>${h}</th>`).join("")}</tr></thead>
      <tbody>${rows}</tbody></table>
      <div class="footer">SYLHN POS · Advanced Reports · Generated by ${COMPANY.name}</div>
      </body></html>`);
    printWin.document.close();
    setTimeout(() => { printWin.focus(); printWin.print(); }, 300);
    toast({ title: "PDF Print Ready", description: "Check the print dialog" });
  };

  const columns = reportData.length > 0 ? Object.keys(reportData[0]) : [];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 30 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 30 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[95vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex-shrink-0 bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-700 text-white px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0">
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="text-sm sm:text-base font-bold truncate">{config.label}</div>
              <div className="text-[10px] text-blue-100/80 truncate">{reportData.length} records | {dateFrom || "All"} → {dateTo || "Today"}</div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Export buttons */}
            <button onClick={exportCSV} disabled={reportData.length === 0} className="h-8 px-2.5 rounded-lg bg-white/15 hover:bg-white/25 disabled:opacity-40 text-white text-[10px] font-bold flex items-center gap-1 transition" title="Export to CSV">
              <Download className="h-3.5 w-3.5" /> CSV
            </button>
            <button onClick={exportExcel} disabled={reportData.length === 0} className="h-8 px-2.5 rounded-lg bg-white/15 hover:bg-white/25 disabled:opacity-40 text-white text-[10px] font-bold flex items-center gap-1 transition" title="Export to Excel">
              <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
            </button>
            <button onClick={exportPDF} disabled={reportData.length === 0} className="h-8 px-2.5 rounded-lg bg-white/15 hover:bg-white/25 disabled:opacity-40 text-white text-[10px] font-bold flex items-center gap-1 transition" title="Print / Export to PDF">
              <Printer className="h-3.5 w-3.5" /> PDF
            </button>
            <button onClick={() => setShowFilters(!showFilters)} className="h-8 px-2.5 rounded-lg bg-white/15 hover:bg-white/25 text-white text-[10px] font-bold flex items-center gap-1 transition" title="Toggle filters">
              <Filter className="h-3.5 w-3.5" /> Filters
            </button>
            <button onClick={onClose} className="h-8 w-8 rounded-lg bg-white/15 hover:bg-white/25 flex items-center justify-center transition">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="flex-shrink-0 overflow-hidden"
            >
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-slate-400" />
                  <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-8 px-2 text-xs rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-blue-400" />
                  <span className="text-xs text-slate-400">to</span>
                  <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-8 px-2 text-xs rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-blue-400" />
                </div>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-8 px-2 text-xs rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-blue-400 bg-white">
                  <option value="all">All Status</option>
                  <option value="completed">Completed</option>
                  <option value="voided">Voided</option>
                  <option value="refunded">Refunded</option>
                </select>
                <select value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)} className="h-8 px-2 text-xs rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-blue-400 bg-white">
                  <option value="all">All Methods</option>
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                  <option value="momo">MoMo</option>
                  <option value="wallet">Wallet</option>
                </select>
                {cashiers.length > 0 && (
                  <select value={cashierFilter} onChange={(e) => setCashierFilter(e.target.value)} className="h-8 px-2 text-xs rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-blue-400 bg-white">
                    <option value="all">All Cashiers</option>
                    {cashiers.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                )}
                <div className="relative flex-1 min-w-[150px]">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search invoice, customer..." className="w-full h-8 pl-8 pr-3 text-xs rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-blue-400" />
                </div>
                <Button size="sm" variant="outline" onClick={fetchSales} className="h-8 text-xs">
                  <Loader2 className={cn("h-3.5 w-3.5", loading && "animate-spin")} /> Refresh
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Summary Bar */}
        {summary && (
          <div className="flex-shrink-0 px-4 py-2 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-slate-200 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
            <Badge variant="secondary" className="bg-blue-100 text-blue-700">{summary.count} records</Badge>
            {Object.entries(summary.sums).slice(0, 5).map(([k, v]) => (
              <span key={k} className="text-slate-600">
                <strong className="text-slate-800">{k}:</strong> {typeof v === "number" && v % 1 !== 0 ? formatGHS(v) : v}
              </span>
            ))}
          </div>
        )}

        {/* Data Table */}
        <div className="flex-1 overflow-auto min-h-0">
          {loading ? (
            <div className="flex items-center justify-center h-full py-20">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
              <span className="ml-3 text-sm text-slate-500">Loading report data...</span>
            </div>
          ) : reportData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-20 text-slate-400">
              <FileBarChart className="h-12 w-12 mb-3 opacity-30" />
              <div className="text-sm font-medium">No data for this report</div>
              <div className="text-xs mt-1">Try adjusting the date range or filters</div>
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-800 text-white">
                  {columns.map(col => (
                    <th key={col} className="px-3 py-2 text-left font-bold whitespace-nowrap">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reportData.map((row, i) => (
                  <tr key={i} className={cn("border-b border-slate-100 hover:bg-blue-50 transition", i % 2 === 1 && "bg-slate-50")}>
                    {columns.map(col => {
                      const val = row[col];
                      const isNum = typeof val === "number";
                      return (
                        <td key={col} className={cn("px-3 py-1.5 whitespace-nowrap", isNum ? "text-right font-mono" : "text-left")}>
                          {isNum ? (val % 1 !== 0 ? formatGHS(val) : val) : val}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
              {/* Summary row */}
              {summary && (
                <tfoot className="sticky bottom-0">
                  <tr className="bg-slate-200 font-bold">
                    {columns.map(col => {
                      const val = summary.sums[col];
                      return (
                        <td key={col} className={cn("px-3 py-2 whitespace-nowrap", typeof val === "number" ? "text-right font-mono" : "text-left")}>
                          {typeof val === "number" ? (val % 1 !== 0 ? formatGHS(val) : val) : (col === columns[0] ? "TOTAL" : "")}
                        </td>
                      );
                    })}
                  </tr>
                </tfoot>
              )}
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-4 py-2 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-500">
          <span>{COMPANY.name} · Generated {new Date().toLocaleString("en-GB")}</span>
          <span>{reportData.length} records | {columns.length} columns</span>
        </div>
      </motion.div>
    </motion.div>
  );
}
