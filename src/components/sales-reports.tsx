"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import {
  ArrowLeft, Calendar, Printer, FileText, Download, TrendingUp,
  History, Search, Loader2, RefreshCw, ChevronLeft, ChevronRight,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { COMPANY, CURRENCY, formatGHS } from "@/lib/pos-data";

// ============= Types =============
interface SaleRow {
  id: string;
  invoiceNumber: string;
  createdAt: string;
  customerName: string;
  cashierName: string;
  cashier?: { fullName?: string };
  subtotal: number;
  taxAmount: number;
  total: number;
  amountPaid: number;
  paymentMethod: string;
  status: string;
  items?: any[];
  itemCount?: number;
}

interface SalesResponse {
  sales: SaleRow[];
  total: number;
  page: number;
  pageSize: number;
}

// ============= Helpers =============
function pad2(n: number) { return n.toString().padStart(2, "0"); }
function todayISO() { return new Date().toISOString().split("T")[0]; }
function fmtDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${parseInt(m)}/${parseInt(d)}/${y}`;
}
function fmtTime(iso: string) {
  try { return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }
  catch { return ""; }
}
function fmtDateOnly(iso: string) {
  try { return new Date(iso).toISOString().split("T")[0]; }
  catch { return ""; }
}
function normalizeMethod(m: string): string {
  if (!m) return "Cash";
  const ml = m.toLowerCase();
  if (ml === "cash") return "Cash";
  if (ml === "card") return "Card";
  if (ml === "wallet" || ml === "momo" || ml.includes("mobile")) return "Mobile Money";
  if (ml === "points") return "Points";
  return m.charAt(0).toUpperCase() + m.slice(1);
}
function itemCountOf(t: SaleRow): number {
  if (typeof t.itemCount === "number") return t.itemCount;
  if (Array.isArray(t.items)) return t.items.length;
  return 0;
}
function cashierNameOf(t: SaleRow): string {
  return t.cashierName || t.cashier?.fullName || "—";
}

// ============= Custom hook: fetch sales =============
function useSales(fromDate: string, toDate: string) {
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSales = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Add end-of-day to toDate so the entire day is included
      const url = `/api/sales?dateFrom=${fromDate}T00:00:00.000Z&dateTo=${toDate}T23:59:59.999Z&limit=1000`;
      const res = await fetch(url, { credentials: "include" });
      const data = await res.json();
      if (res.ok) {
        setSales(data.sales || data || []);
      } else {
        setError(data.error || "Failed to fetch sales");
      }
    } catch (e) {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate]);

  useEffect(() => { fetchSales(); }, [fetchSales]);

  return { sales, loading, error, refresh: fetchSales };
}

// =====================================================================
// ============= Daily Sales Report =============
// =====================================================================
export function DailySalesReport({ onBack, dailyTotal, transactionCount }: { onBack: () => void; dailyTotal: number; transactionCount: number; }) {
  const { toast } = useToast();
  const today = todayISO();
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const { sales, loading, error, refresh } = useSales(fromDate, toDate);

  const filtered = useMemo(() => sales.filter(t => t.status === "completed"), [sales]);

  const totals = useMemo(() => ({
    count: filtered.length,
    items: filtered.reduce((s, t) => s + itemCountOf(t), 0),
    subtotal: filtered.reduce((s, t) => s + (t.subtotal || 0), 0),
    tax: filtered.reduce((s, t) => s + (t.taxAmount || 0), 0),
    total: filtered.reduce((s, t) => s + (t.total || 0), 0),
    cash: filtered.filter(t => normalizeMethod(t.paymentMethod) === "Cash").reduce((s, t) => s + (t.amountPaid || 0), 0),
    card: filtered.filter(t => normalizeMethod(t.paymentMethod) === "Card").reduce((s, t) => s + (t.amountPaid || 0), 0),
    momo: filtered.filter(t => normalizeMethod(t.paymentMethod) === "Mobile Money").reduce((s, t) => s + (t.amountPaid || 0), 0),
  }), [filtered]);

  const now = new Date();
  const dateStr = `${now.getMonth() + 1}/${now.getDate()}/${now.getFullYear()}`;
  const timeStr = `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;

  const handlePrint = () => {
    const printWin = window.open('', '_blank', 'width=800,height=600');
    if (!printWin) return;
    const rows = filtered.map((t, i) => `<tr style="background:${i % 2 === 1 ? '#F8F8F8' : '#FFF'}"><td style="border:1px solid #999;padding:3px 6px">${fmtTime(t.createdAt)}</td><td style="border:1px solid #999;padding:3px 6px">${t.invoiceNumber}</td><td style="border:1px solid #999;padding:3px 6px">${t.customerName || "Walk-in"}</td><td style="border:1px solid #999;padding:3px 6px;text-align:right">${itemCountOf(t)}</td><td style="border:1px solid #999;padding:3px 6px">${normalizeMethod(t.paymentMethod)}</td><td style="border:1px solid #999;padding:3px 6px;text-align:right">${(t.total || 0).toFixed(2)}</td></tr>`).join('');
    printWin.document.write(`<!DOCTYPE html><html><head><title>Daily Sales Report</title><style>body{font-family:Arial;margin:20px}h1{text-align:center;font-size:18px}h2{text-align:center;font-size:14px}table{width:100%;border-collapse:collapse;font-size:11px}th{background:#E6E6FA;border:1px solid #999;padding:4px 6px}.totals{margin-top:10px;font-size:11px}@media print{thead{display:table-header-group}tr{page-break-inside:avoid}}</style></head><body>
      <div style="text-align:center;border-bottom:2px solid #333;padding-bottom:10px"><h1>${COMPANY.name}</h1><div style="font-size:12px;color:#666">${COMPANY.address} · ${COMPANY.contact}</div></div>
      <h2>Daily Sales Report</h2><p style="text-align:center;font-size:11px">For The Period ${fmtDate(fromDate)} - ${fmtDate(toDate)}</p>
      <table><thead><tr><th>Time</th><th>Invoice</th><th>Customer</th><th style="text-align:right">Items</th><th>Method</th><th style="text-align:right">Total GHC</th></tr></thead><tbody>${rows}</tbody></table>
      <table class="totals"><tr style="font-weight:bold"><td>Transactions: ${totals.count}</td><td>Items: ${totals.items}</td><td>Total: ${totals.total.toFixed(2)}</td><td>Cash: ${totals.cash.toFixed(2)}</td><td>Card: ${totals.card.toFixed(2)}</td><td>MoMo: ${totals.momo.toFixed(2)}</td></tr></table>
      </body></html>`);
    printWin.document.close();
    setTimeout(() => { printWin.focus(); printWin.print(); }, 300);
    toast({ title: "Printing..." });
  };

  const handlePDF = () => {
    import("jspdf").then(({ default: jsPDF }) => {
      import("jspdf-autotable").then(({ default: autoTable }) => {
        const doc = new jsPDF();
        const pw = doc.internal.pageSize.getWidth();
        doc.setFontSize(16); doc.setFont("helvetica", "bold"); doc.text(COMPANY.name, pw / 2, 18, { align: "center" });
        doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.text(`${COMPANY.address} · ${COMPANY.contact}`, pw / 2, 24, { align: "center" });
        doc.setFontSize(13); doc.setFont("helvetica", "bold"); doc.text("Daily Sales Report", pw / 2, 34, { align: "center" });
        doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.text(`For The Period ${fmtDate(fromDate)} - ${fmtDate(toDate)}`, pw / 2, 39, { align: "center" });
        autoTable(doc, {
          head: [["Time", "Invoice", "Customer", "Items", "Method", "Total GHC"]],
          body: filtered.map(t => [fmtTime(t.createdAt), t.invoiceNumber, t.customerName || "Walk-in", String(itemCountOf(t)), normalizeMethod(t.paymentMethod), (t.total || 0).toFixed(2)]),
          startY: 44, styles: { fontSize: 8, cellPadding: 2, lineColor: [0, 0, 0], lineWidth: 0.3 },
          headStyles: { fillColor: [230, 230, 250], textColor: 0, fontStyle: "bold" },
          foot: [["", "", "", "", "TOTAL", totals.total.toFixed(2)]],
          footStyles: { fillColor: [230, 230, 250], textColor: 0, fontStyle: "bold" },
        });
        doc.save(`daily-sales-${todayISO()}.pdf`);
        toast({ title: "PDF exported" });
      });
    });
  };

  const handleExcel = () => {
    import("xlsx").then((XLSX) => {
      const data = [[COMPANY.name], ["Daily Sales Report"], [`For The Period ${fmtDate(fromDate)} - ${fmtDate(toDate)}`], [], ["Time", "Invoice", "Customer", "Items", "Method", "Total GHC"]];
      filtered.forEach(t => data.push([fmtTime(t.createdAt), t.invoiceNumber, t.customerName || "Walk-in", String(itemCountOf(t)), normalizeMethod(t.paymentMethod), (t.total || 0).toFixed(2)]));
      data.push(["", "", "", "", "TOTAL", totals.total.toFixed(2)]);
      const ws = XLSX.utils.aoa_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Daily Sales");
      XLSX.writeFile(wb, `daily-sales-${todayISO()}.xlsx`);
      toast({ title: "Excel exported" });
    });
  };

  return (
    <div className="h-screen flex flex-col bg-slate-100 dark:bg-slate-950">
      <header className="flex-shrink-0 bg-gradient-to-r from-emerald-700 to-teal-600 text-white shadow-lg px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="h-8 w-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center"><ArrowLeft className="h-4 w-4" /></button>
          <TrendingUp className="h-5 w-5" /><span className="text-sm font-bold">Daily Sales Report</span>
        </div>
        <div className="text-xs text-emerald-100/80">{COMPANY.name}</div>
      </header>
      <div className="flex-1 overflow-y-auto p-4">
        <div className="no-print max-w-3xl mx-auto mb-3 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-emerald-600" />
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">From:</span>
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="h-9 px-2 rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white text-xs outline-none focus:ring-2 focus:ring-emerald-400" />
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">To:</span>
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="h-9 px-2 rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white text-xs outline-none focus:ring-2 focus:ring-emerald-400" />
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} /> Refresh
            </Button>
            <button onClick={handlePrint} className="h-9 px-3 rounded-lg bg-slate-100 dark:bg-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 text-xs font-semibold flex items-center gap-1.5"><Printer className="h-3.5 w-3.5" /> Print</button>
            <button onClick={handlePDF} className="h-9 px-3 rounded-lg bg-rose-100 dark:bg-rose-900/30 dark:text-rose-300 hover:bg-rose-200 dark:hover:bg-rose-900/50 text-rose-700 text-xs font-semibold flex items-center gap-1.5"><FileText className="h-3.5 w-3.5" /> PDF</button>
            <button onClick={handleExcel} className="h-9 px-3 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-900/50 text-emerald-700 text-xs font-semibold flex items-center gap-1.5"><Download className="h-3.5 w-3.5" /> Excel</button>
          </div>
        </div>

        {error && (
          <div className="max-w-3xl mx-auto mb-3 p-3 rounded-lg bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-300 text-xs">
            {error} — <button onClick={refresh} className="underline">retry</button>
          </div>
        )}

        {loading ? (
          <div className="text-center py-12 text-slate-500 dark:text-slate-400">
            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" /> Loading sales…
          </div>
        ) : (
          <div className="printable-report max-w-3xl mx-auto bg-white dark:bg-slate-900 shadow-xl" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
            <div className="px-6 pt-5 pb-3 text-center border-b-2 border-slate-800 dark:border-slate-700"><div className="text-base font-bold text-slate-900 dark:text-white">{COMPANY.name}</div><div className="text-xs text-slate-600 dark:text-slate-400">Accra Warehouse · {COMPANY.address}</div></div>
            <div className="px-6 py-3 text-center"><h1 className="text-base font-bold text-slate-900 dark:text-white">Daily Sales Report</h1><p className="text-xs text-slate-600 dark:text-slate-400">For The Period {fmtDate(fromDate)} - {fmtDate(toDate)}</p></div>
            <div className="px-6 pb-4">
              <div className="grid grid-cols-4 gap-3 mb-4">
                <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-2 text-center ring-1 ring-emerald-200 dark:ring-emerald-800"><div className="text-[9px] text-slate-500 dark:text-slate-400 uppercase">Transactions</div><div className="text-lg font-bold text-emerald-700 dark:text-emerald-400">{totals.count}</div></div>
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-2 text-center ring-1 ring-blue-200 dark:ring-blue-800"><div className="text-[9px] text-slate-500 dark:text-slate-400 uppercase">Items Sold</div><div className="text-lg font-bold text-blue-700 dark:text-blue-400">{totals.items}</div></div>
                <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-2 text-center ring-1 ring-amber-200 dark:ring-amber-800"><div className="text-[9px] text-slate-500 dark:text-slate-400 uppercase">Total Sales</div><div className="text-lg font-bold text-amber-700 dark:text-amber-400 font-mono">{totals.total.toFixed(2)}</div></div>
                <div className="bg-rose-50 dark:bg-rose-900/20 rounded-lg p-2 text-center ring-1 ring-rose-200 dark:ring-rose-800"><div className="text-[9px] text-slate-500 dark:text-slate-400 uppercase">Tax Collected</div><div className="text-lg font-bold text-rose-700 dark:text-rose-400 font-mono">{totals.tax.toFixed(2)}</div></div>
              </div>
              <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-2 text-center"><div className="text-[9px] text-slate-500 dark:text-slate-400 uppercase">Cash</div><div className="text-sm font-bold text-slate-700 dark:text-slate-200 font-mono">{totals.cash.toFixed(2)}</div></div>
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-2 text-center"><div className="text-[9px] text-slate-500 dark:text-slate-400 uppercase">Card</div><div className="text-sm font-bold text-slate-700 dark:text-slate-200 font-mono">{totals.card.toFixed(2)}</div></div>
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-2 text-center"><div className="text-[9px] text-slate-500 dark:text-slate-400 uppercase">MoMo</div><div className="text-sm font-bold text-slate-700 dark:text-slate-200 font-mono">{totals.momo.toFixed(2)}</div></div>
              </div>
              <div className="mobile-scroll-x">
                <table className="w-full text-[10px]" style={{ borderCollapse: 'collapse' }}>
                  <thead><tr style={{ backgroundColor: '#E6E6FA' }}><th className="px-2 py-1.5 text-left font-bold border border-slate-400">Time</th><th className="px-2 py-1.5 text-left font-bold border border-slate-400">Invoice</th><th className="px-2 py-1.5 text-left font-bold border border-slate-400">Customer</th><th className="px-2 py-1.5 text-right font-bold border border-slate-400">Items</th><th className="px-2 py-1.5 text-center font-bold border border-slate-400">Method</th><th className="px-2 py-1.5 text-right font-bold border border-slate-400">Total GHC</th></tr></thead>
                  <tbody>
                    {filtered.length === 0 ? (
                      <tr><td colSpan={6} className="text-center py-8 text-slate-400">No completed sales in this period</td></tr>
                    ) : filtered.map((t, i) => (
                      <tr key={t.id} style={{ backgroundColor: i % 2 === 1 ? '#F8F8F8' : '#FFFFFF' }}>
                        <td className="px-2 py-1 border border-slate-400">{fmtTime(t.createdAt)}</td>
                        <td className="px-2 py-1 border border-slate-400 font-mono">{t.invoiceNumber}</td>
                        <td className="px-2 py-1 border border-slate-400">{t.customerName || "Walk-in"}</td>
                        <td className="px-2 py-1 text-right border border-slate-400">{itemCountOf(t)}</td>
                        <td className="px-2 py-1 text-center border border-slate-400">{normalizeMethod(t.paymentMethod)}</td>
                        <td className="px-2 py-1 text-right font-semibold border border-slate-400">{(t.total || 0).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot><tr style={{ backgroundColor: '#E6E6FA' }}><td colSpan={3} className="px-2 py-1.5 font-bold text-slate-900 border border-slate-400">TOTAL</td><td className="px-2 py-1.5 text-right font-bold text-slate-900 border border-slate-400">{totals.items}</td><td className="px-2 py-1.5 border border-slate-400"></td><td className="px-2 py-1.5 text-right font-bold text-slate-900 border border-slate-400">{totals.total.toFixed(2)}</td></tr></tfoot>
                </table>
              </div>
            </div>
            <div className="px-6 py-2 border-t border-slate-200 dark:border-slate-800 text-center text-[9px] text-slate-400">{COMPANY.name} · {COMPANY.address} · {COMPANY.contact} · Generated: {dateStr} {timeStr}</div>
          </div>
        )}
      </div>
    </div>
  );
}

// =====================================================================
// ============= Sales History =============
// =====================================================================
export function SalesHistory({ onBack }: { onBack: () => void }) {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const today = todayISO();
  const yearStart = `${new Date().getFullYear()}-01-01`;
  const [fromDate, setFromDate] = useState(yearStart);
  const [toDate, setToDate] = useState(today);
  const { sales, loading, error, refresh } = useSales(fromDate, toDate);

  const filtered = useMemo(() => {
    let list = sales;
    if (statusFilter !== "all") list = list.filter(t => t.status === statusFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(t =>
        (t.invoiceNumber || "").toLowerCase().includes(q) ||
        (t.customerName || "").toLowerCase().includes(q) ||
        (cashierNameOf(t) || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [sales, search, statusFilter]);

  const handlePrint = () => {
    const printWin = window.open('', '_blank', 'width=800,height=600');
    if (!printWin) return;
    const rows = filtered.map((t, i) => `<tr style="background:${i % 2 === 1 ? '#F8F8F8' : '#FFF'}"><td style="border:1px solid #999;padding:3px 6px">${fmtDateOnly(t.createdAt)}</td><td style="border:1px solid #999;padding:3px 6px">${fmtTime(t.createdAt)}</td><td style="border:1px solid #999;padding:3px 6px">${t.invoiceNumber}</td><td style="border:1px solid #999;padding:3px 6px">${t.customerName || "Walk-in"}</td><td style="border:1px solid #999;padding:3px 6px;text-align:right">${itemCountOf(t)}</td><td style="border:1px solid #999;padding:3px 6px;text-align:right">${(t.total || 0).toFixed(2)}</td><td style="border:1px solid #999;padding:3px 6px">${normalizeMethod(t.paymentMethod)}</td><td style="border:1px solid #999;padding:3px 6px">${cashierNameOf(t)}</td><td style="border:1px solid #999;padding:3px 6px">${t.status}</td></tr>`).join('');
    printWin.document.write(`<!DOCTYPE html><html><head><title>Sales History</title><style>body{font-family:Arial;margin:20px}h1{text-align:center;font-size:18px}table{width:100%;border-collapse:collapse;font-size:10px}th{background:#E6E6FA;border:1px solid #999;padding:4px 6px}@media print{thead{display:table-header-group}tr{page-break-inside:avoid}}</style></head><body><div style="text-align:center;border-bottom:2px solid #333;padding-bottom:10px"><h1>${COMPANY.name}</h1><div style="font-size:12px;color:#666">${COMPANY.address} · ${COMPANY.contact}</div></div><h1>Sales History</h1><table><thead><tr><th>Date</th><th>Time</th><th>Invoice</th><th>Customer</th><th>Items</th><th>Total</th><th>Method</th><th>Cashier</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></body></html>`);
    printWin.document.close();
    setTimeout(() => { printWin.focus(); printWin.print(); }, 300);
    toast({ title: "Printing..." });
  };

  const handlePDF = () => {
    import("jspdf").then(({ default: jsPDF }) => {
      import("jspdf-autotable").then(({ default: autoTable }) => {
        const doc = new jsPDF({ orientation: "landscape" });
        const pw = doc.internal.pageSize.getWidth();
        doc.setFontSize(16); doc.setFont("helvetica", "bold"); doc.text(COMPANY.name, pw / 2, 18, { align: "center" });
        doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.text(`${COMPANY.address} · ${COMPANY.contact}`, pw / 2, 24, { align: "center" });
        doc.setFontSize(13); doc.setFont("helvetica", "bold"); doc.text("Sales History", pw / 2, 34, { align: "center" });
        autoTable(doc, {
          head: [["Date", "Time", "Invoice", "Customer", "Items", "Total GHC", "Method", "Cashier", "Status"]],
          body: filtered.map(t => [fmtDateOnly(t.createdAt), fmtTime(t.createdAt), t.invoiceNumber, t.customerName || "Walk-in", String(itemCountOf(t)), (t.total || 0).toFixed(2), normalizeMethod(t.paymentMethod), cashierNameOf(t), t.status]),
          startY: 39, styles: { fontSize: 8, cellPadding: 2, lineColor: [0, 0, 0], lineWidth: 0.3 },
          headStyles: { fillColor: [230, 230, 250], textColor: 0, fontStyle: "bold" },
        });
        doc.save(`sales-history-${todayISO()}.pdf`);
        toast({ title: "PDF exported" });
      });
    });
  };

  const handleExcel = () => {
    import("xlsx").then((XLSX) => {
      const data = [[COMPANY.name], ["Sales History"], [], ["Date", "Time", "Invoice", "Customer", "Items", "Total GHC", "Method", "Cashier", "Status"]];
      filtered.forEach(t => data.push([fmtDateOnly(t.createdAt), fmtTime(t.createdAt), t.invoiceNumber, t.customerName || "Walk-in", String(itemCountOf(t)), (t.total || 0).toFixed(2), normalizeMethod(t.paymentMethod), cashierNameOf(t), t.status]));
      const ws = XLSX.utils.aoa_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Sales History");
      XLSX.writeFile(wb, `sales-history-${todayISO()}.xlsx`);
      toast({ title: "Excel exported" });
    });
  };

  const statusColors: Record<string, string> = {
    completed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
    voided: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
    held: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
    refunded: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  };

  return (
    <div className="h-screen flex flex-col bg-slate-100 dark:bg-slate-950">
      <header className="flex-shrink-0 bg-gradient-to-r from-blue-700 to-indigo-600 text-white shadow-lg px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={onBack} className="h-9 w-9 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition active:scale-90 flex-shrink-0"><ArrowLeft className="h-4 w-4" /></button>
          <History className="h-5 w-5 flex-shrink-0" />
          <div className="min-w-0">
            <div className="text-sm font-bold truncate">Sales History</div>
            <div className="text-[10px] text-blue-100/80 truncate">{COMPANY.name}</div>
          </div>
        </div>
      </header>

      <div className="no-print flex-shrink-0 px-4 py-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search invoice, customer, cashier..." className="h-10 sm:h-8 pl-9 pr-3 rounded-lg bg-slate-100 dark:bg-slate-800 dark:text-white text-xs outline-none focus:ring-2 focus:ring-blue-400 w-full" />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-10 sm:h-8 px-2 text-xs border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded-lg bg-white outline-none flex-shrink-0">
            <option value="all">All Status</option>
            <option value="completed">Completed</option>
            <option value="voided">Voided</option>
            <option value="held">Held</option>
            <option value="refunded">Refunded</option>
          </select>
          <Badge variant="outline" className="text-xs flex-shrink-0">{filtered.length}</Badge>
          <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <Calendar className="h-3.5 w-3.5 text-slate-400" />
          <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-300">From:</span>
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="h-9 sm:h-8 px-2 text-xs border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded-lg bg-white outline-none" />
          <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-300">To:</span>
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="h-9 sm:h-8 px-2 text-xs border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded-lg bg-white outline-none" />
          <div className="hidden sm:flex items-center gap-2 ml-auto">
            <button onClick={handlePrint} className="h-8 px-3 rounded-lg bg-slate-100 dark:bg-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 text-xs font-semibold flex items-center gap-1.5"><Printer className="h-3.5 w-3.5" /> Print</button>
            <button onClick={handlePDF} className="h-8 px-3 rounded-lg bg-rose-100 dark:bg-rose-900/30 dark:text-rose-300 hover:bg-rose-200 dark:hover:bg-rose-900/50 text-rose-700 text-xs font-semibold flex items-center gap-1.5"><FileText className="h-3.5 w-3.5" /> PDF</button>
            <button onClick={handleExcel} className="h-8 px-3 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-900/50 text-emerald-700 text-xs font-semibold flex items-center gap-1.5"><Download className="h-3.5 w-3.5" /> Excel</button>
          </div>
        </div>
        <div className="sm:hidden flex items-center gap-2">
          <button onClick={handlePrint} className="flex-1 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 dark:text-slate-200 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5"><Printer className="h-3.5 w-3.5" /> Print</button>
          <button onClick={handlePDF} className="flex-1 h-9 rounded-lg bg-rose-100 dark:bg-rose-900/30 dark:text-rose-300 hover:bg-rose-200 text-rose-700 text-xs font-semibold flex items-center justify-center gap-1.5"><FileText className="h-3.5 w-3.5" /> PDF</button>
          <button onClick={handleExcel} className="flex-1 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-300 hover:bg-emerald-200 text-emerald-700 text-xs font-semibold flex items-center justify-center gap-1.5"><Download className="h-3.5 w-3.5" /> Excel</button>
        </div>
      </div>

      {error && (
        <div className="m-4 p-3 rounded-lg bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-300 text-xs">
          {error} — <button onClick={refresh} className="underline">retry</button>
        </div>
      )}

      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          {loading ? (
            <div className="text-center py-16 text-slate-400 text-sm">
              <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" /> Loading sales history…
            </div>
          ) : (
            <>
              <div className="printable-report hidden md:block mobile-scroll-x">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-slate-800 dark:bg-slate-900 dark:border-b dark:border-slate-700 text-white text-[10px] uppercase z-10">
                    <tr>
                      <th className="text-left px-3 py-2 font-semibold">Date</th>
                      <th className="text-left px-3 py-2 font-semibold">Time</th>
                      <th className="text-left px-3 py-2 font-semibold">Invoice</th>
                      <th className="text-left px-3 py-2 font-semibold">Customer</th>
                      <th className="text-right px-3 py-2 font-semibold">Items</th>
                      <th className="text-right px-3 py-2 font-semibold">Total GHC</th>
                      <th className="text-center px-3 py-2 font-semibold">Method</th>
                      <th className="text-left px-3 py-2 font-semibold">Cashier</th>
                      <th className="text-center px-3 py-2 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 dark:bg-slate-950">
                    {filtered.map(t => (
                      <tr key={t.id} className="hover:bg-blue-50/50 dark:hover:bg-slate-800/50">
                        <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{fmtDateOnly(t.createdAt)}</td>
                        <td className="px-3 py-2 text-slate-500 dark:text-slate-400 font-mono">{fmtTime(t.createdAt)}</td>
                        <td className="px-3 py-2 font-mono font-semibold text-slate-800 dark:text-slate-100">{t.invoiceNumber}</td>
                        <td className="px-3 py-2 text-slate-700 dark:text-slate-200">{t.customerName || "Walk-in"}</td>
                        <td className="px-3 py-2 text-right font-mono text-slate-700 dark:text-slate-200">{itemCountOf(t)}</td>
                        <td className="px-3 py-2 text-right font-mono font-semibold text-slate-800 dark:text-slate-100">{(t.total || 0).toFixed(2)}</td>
                        <td className="px-3 py-2 text-center text-slate-600 dark:text-slate-300">{normalizeMethod(t.paymentMethod)}</td>
                        <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{cashierNameOf(t)}</td>
                        <td className="px-3 py-2 text-center"><span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${statusColors[t.status] || "bg-slate-100 text-slate-600"}`}>{t.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="md:hidden p-3 space-y-2">
                {filtered.map(t => (<MobileSaleCard key={t.id} t={t} statusColors={statusColors} />))}
              </div>

              {filtered.length === 0 && (
                <div className="text-center py-16 text-slate-400 text-sm">
                  <History className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  No transactions found
                </div>
              )}
            </>
          )}
        </ScrollArea>
      </div>
    </div>
  );
}

function MobileSaleCard({ t, statusColors }: { t: SaleRow; statusColors: Record<string, string> }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div
      onClick={() => setExpanded(!expanded)}
      className="bg-white dark:bg-slate-900 rounded-xl shadow-sm ring-1 ring-slate-200 dark:ring-slate-800 p-3 active:scale-[0.98] transition cursor-pointer"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-100 truncate">{t.invoiceNumber}</span>
            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase flex-shrink-0 ${statusColors[t.status] || "bg-slate-100 text-slate-600"}`}>{t.status}</span>
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{t.customerName || "Walk-in"}</div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="font-mono font-bold text-sm text-slate-800 dark:text-slate-100">{CURRENCY}{(t.total || 0).toFixed(2)}</div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400">{itemCountOf(t)} items · {normalizeMethod(t.paymentMethod)}</div>
        </div>
      </div>
      <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
        <span>{fmtDateOnly(t.createdAt)} · {fmtTime(t.createdAt)}</span>
        <span className="truncate ml-2">{cashierNameOf(t)}</span>
      </div>
      {expanded && (
        <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 gap-2 text-[10px]">
          <div><span className="text-slate-400 dark:text-slate-500">Date:</span> <span className="font-medium text-slate-700 dark:text-slate-200">{fmtDateOnly(t.createdAt)}</span></div>
          <div><span className="text-slate-400 dark:text-slate-500">Time:</span> <span className="font-mono text-slate-700 dark:text-slate-200">{fmtTime(t.createdAt)}</span></div>
          <div><span className="text-slate-400 dark:text-slate-500">Invoice:</span> <span className="font-mono text-slate-700 dark:text-slate-200">{t.invoiceNumber}</span></div>
          <div><span className="text-slate-400 dark:text-slate-500">Method:</span> <span className="text-slate-700 dark:text-slate-200">{normalizeMethod(t.paymentMethod)}</span></div>
          <div><span className="text-slate-400 dark:text-slate-500">Items:</span> <span className="font-mono text-slate-700 dark:text-slate-200">{itemCountOf(t)}</span></div>
          <div><span className="text-slate-400 dark:text-slate-500">Total:</span> <span className="font-mono font-bold text-slate-700 dark:text-slate-200">{CURRENCY}{(t.total || 0).toFixed(2)}</span></div>
          <div className="col-span-2"><span className="text-slate-400 dark:text-slate-500">Cashier:</span> <span className="text-slate-700 dark:text-slate-200">{cashierNameOf(t)}</span></div>
        </div>
      )}
    </div>
  );
}
