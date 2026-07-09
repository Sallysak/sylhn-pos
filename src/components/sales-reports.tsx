"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, Calendar, Printer, FileText, Download, TrendingUp,
  History, CheckCircle2, X, DollarSign, ShoppingCart,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { COMPANY, CURRENCY, formatGHS } from "@/lib/pos-data";

// Sample sales transactions for history
interface SalesTransaction {
  id: string;
  invoiceNo: string;
  date: string;
  time: string;
  customer: string;
  items: number;
  subtotal: number;
  tax: number;
  total: number;
  paid: number;
  method: string;
  cashier: string;
  status: "completed" | "voided" | "held";
}

const sampleTransactions: SalesTransaction[] = [
  { id: "t1", invoiceNo: "INV-001", date: "2026-07-07", time: "08:30", customer: "Ama Osei", items: 3, subtotal: 88.00, tax: 0, total: 88.00, paid: 88.00, method: "Cash", cashier: "Sarah Johnson", status: "completed" },
  { id: "t2", invoiceNo: "INV-002", date: "2026-07-07", time: "09:15", customer: "Walk-in", items: 1, subtotal: 35.00, tax: 0, total: 35.00, paid: 35.00, method: "Cash", cashier: "Sarah Johnson", status: "completed" },
  { id: "t3", invoiceNo: "INV-003", date: "2026-07-07", time: "10:00", customer: "Kwame Mensah", items: 5, subtotal: 155.00, tax: 23.25, total: 178.25, paid: 178.25, method: "Card", cashier: "Sarah Johnson", status: "completed" },
  { id: "t4", invoiceNo: "INV-004", date: "2026-07-07", time: "10:45", customer: "Walk-in", items: 2, subtotal: 42.00, tax: 0, total: 42.00, paid: 42.00, method: "Cash", cashier: "Sarah Johnson", status: "completed" },
  { id: "t5", invoiceNo: "INV-005", date: "2026-07-07", time: "11:20", customer: "Akosua Frimpong", items: 4, subtotal: 120.00, tax: 18.00, total: 138.00, paid: 138.00, method: "Mobile Money", cashier: "Sarah Johnson", status: "completed" },
  { id: "t6", invoiceNo: "INV-006", date: "2026-07-07", time: "12:00", customer: "Walk-in", items: 1, subtotal: 18.00, tax: 2.70, total: 20.70, paid: 20.70, method: "Cash", cashier: "Sarah Johnson", status: "completed" },
  { id: "t7", invoiceNo: "INV-007", date: "2026-07-07", time: "13:30", customer: "Yao Adjei", items: 8, subtotal: 210.00, tax: 31.50, total: 241.50, paid: 241.50, method: "Card", cashier: "Sarah Johnson", status: "completed" },
  { id: "t8", invoiceNo: "INV-008", date: "2026-07-07", time: "14:15", customer: "Walk-in", items: 2, subtotal: 55.00, tax: 0, total: 55.00, paid: 55.00, method: "Cash", cashier: "Sarah Johnson", status: "completed" },
  { id: "t9", invoiceNo: "INV-009", date: "2026-07-06", time: "09:00", customer: "Ama Osei", items: 3, subtotal: 75.00, tax: 0, total: 75.00, paid: 75.00, method: "Cash", cashier: "Mike Mensah", status: "completed" },
  { id: "t10", invoiceNo: "INV-010", date: "2026-07-06", time: "10:30", customer: "Walk-in", items: 1, subtotal: 22.00, tax: 3.30, total: 25.30, paid: 25.30, method: "Cash", cashier: "Mike Mensah", status: "completed" },
  { id: "t11", invoiceNo: "INV-011", date: "2026-07-06", time: "11:45", customer: "Kwame Mensah", items: 6, subtotal: 180.00, tax: 27.00, total: 207.00, paid: 200.00, method: "Card", cashier: "Mike Mensah", status: "completed" },
  { id: "t12", invoiceNo: "INV-012", date: "2026-07-06", time: "13:00", customer: "Walk-in", items: 2, subtotal: 48.00, tax: 0, total: 48.00, paid: 48.00, method: "Mobile Money", cashier: "Mike Mensah", status: "completed" },
  { id: "t13", invoiceNo: "INV-013", date: "2026-07-05", time: "08:45", customer: "Akosua Frimpong", items: 4, subtotal: 112.00, tax: 16.80, total: 128.80, paid: 128.80, method: "Cash", cashier: "Sarah Johnson", status: "completed" },
  { id: "t14", invoiceNo: "INV-014", date: "2026-07-05", time: "10:00", customer: "Walk-in", items: 1, subtotal: 12.00, tax: 1.80, total: 13.80, paid: 13.80, method: "Cash", cashier: "Sarah Johnson", status: "completed" },
  { id: "t15", invoiceNo: "INV-015", date: "2026-07-05", time: "14:30", customer: "Walk-in", items: 3, subtotal: 65.00, tax: 0, total: 65.00, paid: 0, method: "Cash", cashier: "Sarah Johnson", status: "voided" },
];

// ===== Daily Sales Report =====
export function DailySalesReport({ onBack, dailyTotal, transactionCount }: { onBack: () => void; dailyTotal: number; transactionCount: number; }) {
  const { toast } = useToast();
  const [fromDate, setFromDate] = useState("2026-07-07");
  const [toDate, setToDate] = useState("2026-07-07");

  const filtered = useMemo(() => sampleTransactions.filter(t => t.date >= fromDate && t.date <= toDate && t.status === "completed"), [fromDate, toDate]);

  const totals = useMemo(() => ({
    count: filtered.length,
    items: filtered.reduce((s, t) => s + t.items, 0),
    subtotal: filtered.reduce((s, t) => s + t.subtotal, 0),
    tax: filtered.reduce((s, t) => s + t.tax, 0),
    total: filtered.reduce((s, t) => s + t.total, 0),
    cash: filtered.filter(t => t.method === "Cash").reduce((s, t) => s + t.paid, 0),
    card: filtered.filter(t => t.method === "Card").reduce((s, t) => s + t.paid, 0),
    momo: filtered.filter(t => t.method === "Mobile Money").reduce((s, t) => s + t.paid, 0),
  }), [filtered]);

  const now = new Date();
  const dateStr = `${now.getMonth() + 1}/${now.getDate()}/${now.getFullYear()}`;
  const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  const fmtDate = (iso: string) => { const [y, m, d] = iso.split('-'); return `${parseInt(m)}/${parseInt(d)}/${y}`; };

  const handlePrint = () => {
    const printWin = window.open('', '_blank', 'width=800,height=600');
    if (!printWin) return;
    const rows = filtered.map((t, i) => `<tr style="background:${i % 2 === 1 ? '#F8F8F8' : '#FFF'}"><td style="border:1px solid #999;padding:3px 6px">${t.time}</td><td style="border:1px solid #999;padding:3px 6px">${t.invoiceNo}</td><td style="border:1px solid #999;padding:3px 6px">${t.customer}</td><td style="border:1px solid #999;padding:3px 6px;text-align:right">${t.items}</td><td style="border:1px solid #999;padding:3px 6px">${t.method}</td><td style="border:1px solid #999;padding:3px 6px;text-align:right">${t.total.toFixed(2)}</td></tr>`).join('');
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
          body: filtered.map(t => [t.time, t.invoiceNo, t.customer, String(t.items), t.method, t.total.toFixed(2)]),
          startY: 44, styles: { fontSize: 8, cellPadding: 2, lineColor: [0, 0, 0], lineWidth: 0.3 },
          headStyles: { fillColor: [230, 230, 250], textColor: 0, fontStyle: "bold" },
          foot: [["", "", "", "", "TOTAL", totals.total.toFixed(2)]],
          footStyles: { fillColor: [230, 230, 250], textColor: 0, fontStyle: "bold" },
        });
        doc.save(`daily-sales-${new Date().toISOString().split('T')[0]}.pdf`);
        toast({ title: "PDF exported" });
      });
    });
  };

  const handleExcel = () => {
    import("xlsx").then((XLSX) => {
      const data = [[COMPANY.name], ["Daily Sales Report"], [`For The Period ${fmtDate(fromDate)} - ${fmtDate(toDate)}`], [], ["Time", "Invoice", "Customer", "Items", "Method", "Total GHC"]];
      filtered.forEach(t => data.push([t.time, t.invoiceNo, t.customer, String(t.items), t.method, t.total.toFixed(2)]));
      data.push(["", "", "", "", "TOTAL", totals.total.toFixed(2)]);
      const ws = XLSX.utils.aoa_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Daily Sales");
      XLSX.writeFile(wb, `daily-sales-${new Date().toISOString().split('T')[0]}.xlsx`);
      toast({ title: "Excel exported" });
    });
  };

  return (
    <div className="h-screen flex flex-col bg-slate-100">
      <header className="flex-shrink-0 bg-gradient-to-r from-emerald-700 to-teal-600 text-white shadow-lg px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="h-8 w-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center"><ArrowLeft className="h-4 w-4" /></button>
          <TrendingUp className="h-5 w-5" /><span className="text-sm font-bold">Daily Sales Report</span>
        </div>
        <div className="text-xs text-emerald-100/80">{COMPANY.name}</div>
      </header>
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-3xl mx-auto mb-3 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2"><Calendar className="h-4 w-4 text-emerald-600" /><span className="text-xs font-semibold text-slate-600">From:</span><input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="h-9 px-2 rounded-lg border border-slate-300 text-xs outline-none focus:ring-2 focus:ring-emerald-400" /><span className="text-xs font-semibold text-slate-600">To:</span><input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="h-9 px-2 rounded-lg border border-slate-300 text-xs outline-none focus:ring-2 focus:ring-emerald-400" /></div>
          <div className="flex items-center gap-2"><button onClick={handlePrint} className="h-9 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1.5"><Printer className="h-3.5 w-3.5" /> Print</button><button onClick={handlePDF} className="h-9 px-3 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-1.5"><FileText className="h-3.5 w-3.5" /> PDF</button><button onClick={handleExcel} className="h-9 px-3 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-700 text-xs font-semibold flex items-center gap-1.5"><Download className="h-3.5 w-3.5" /> Excel</button></div>
        </div>
        <div className="max-w-3xl mx-auto bg-white shadow-xl" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
          <div className="px-6 pt-5 pb-3 text-center border-b-2 border-slate-800"><div className="text-base font-bold text-slate-900">{COMPANY.name}</div><div className="text-xs text-slate-600">Accra Warehouse · {COMPANY.address}</div></div>
          <div className="px-6 py-3 text-center"><h1 className="text-base font-bold text-slate-900">Daily Sales Report</h1><p className="text-xs text-slate-600">For The Period {fmtDate(fromDate)} - {fmtDate(toDate)}</p></div>
          <div className="px-6 pb-4">
            <div className="grid grid-cols-4 gap-3 mb-4">
              <div className="bg-emerald-50 rounded-lg p-2 text-center ring-1 ring-emerald-200"><div className="text-[9px] text-slate-500 uppercase">Transactions</div><div className="text-lg font-bold text-emerald-700">{totals.count}</div></div>
              <div className="bg-blue-50 rounded-lg p-2 text-center ring-1 ring-blue-200"><div className="text-[9px] text-slate-500 uppercase">Items Sold</div><div className="text-lg font-bold text-blue-700">{totals.items}</div></div>
              <div className="bg-amber-50 rounded-lg p-2 text-center ring-1 ring-amber-200"><div className="text-[9px] text-slate-500 uppercase">Total Sales</div><div className="text-lg font-bold text-amber-700 font-mono">{totals.total.toFixed(2)}</div></div>
              <div className="bg-rose-50 rounded-lg p-2 text-center ring-1 ring-rose-200"><div className="text-[9px] text-slate-500 uppercase">Tax Collected</div><div className="text-lg font-bold text-rose-700 font-mono">{totals.tax.toFixed(2)}</div></div>
            </div>
            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="bg-slate-50 rounded-lg p-2 text-center"><div className="text-[9px] text-slate-500 uppercase">Cash</div><div className="text-sm font-bold text-slate-700 font-mono">{totals.cash.toFixed(2)}</div></div>
              <div className="bg-slate-50 rounded-lg p-2 text-center"><div className="text-[9px] text-slate-500 uppercase">Card</div><div className="text-sm font-bold text-slate-700 font-mono">{totals.card.toFixed(2)}</div></div>
              <div className="bg-slate-50 rounded-lg p-2 text-center"><div className="text-[9px] text-slate-500 uppercase">MoMo</div><div className="text-sm font-bold text-slate-700 font-mono">{totals.momo.toFixed(2)}</div></div>
            </div>
            <table className="w-full text-[10px]" style={{ borderCollapse: 'collapse' }}>
              <thead><tr style={{ backgroundColor: '#E6E6FA' }}><th className="px-2 py-1.5 text-left font-bold border border-slate-400">Time</th><th className="px-2 py-1.5 text-left font-bold border border-slate-400">Invoice</th><th className="px-2 py-1.5 text-left font-bold border border-slate-400">Customer</th><th className="px-2 py-1.5 text-right font-bold border border-slate-400">Items</th><th className="px-2 py-1.5 text-center font-bold border border-slate-400">Method</th><th className="px-2 py-1.5 text-right font-bold border border-slate-400">Total GHC</th></tr></thead>
              <tbody>{filtered.map((t, i) => (<tr key={t.id} style={{ backgroundColor: i % 2 === 1 ? '#F8F8F8' : '#FFFFFF' }}><td className="px-2 py-1 border border-slate-400">{t.time}</td><td className="px-2 py-1 border border-slate-400 font-mono">{t.invoiceNo}</td><td className="px-2 py-1 border border-slate-400">{t.customer}</td><td className="px-2 py-1 text-right border border-slate-400">{t.items}</td><td className="px-2 py-1 text-center border border-slate-400">{t.method}</td><td className="px-2 py-1 text-right font-semibold border border-slate-400">{t.total.toFixed(2)}</td></tr>))}</tbody>
              <tfoot><tr style={{ backgroundColor: '#E6E6FA' }}><td colSpan={3} className="px-2 py-1.5 font-bold text-slate-900 border border-slate-400">TOTAL</td><td className="px-2 py-1.5 text-right font-bold text-slate-900 border border-slate-400">{totals.items}</td><td className="px-2 py-1.5 border border-slate-400"></td><td className="px-2 py-1.5 text-right font-bold text-slate-900 border border-slate-400">{totals.total.toFixed(2)}</td></tr></tfoot>
            </table>
          </div>
          <div className="px-6 py-2 border-t border-slate-200 text-center text-[9px] text-slate-400">{COMPANY.name} · {COMPANY.address} · {COMPANY.contact} · Generated: {dateStr} {timeStr}</div>
        </div>
      </div>
    </div>
  );
}

// ===== Sales History =====
export function SalesHistory({ onBack }: { onBack: () => void }) {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [fromDate, setFromDate] = useState("2026-01-01");
  const [toDate, setToDate] = useState("2026-12-31");

  const filtered = useMemo(() => sampleTransactions.filter(t => {
    if (t.date < fromDate || t.date > toDate) return false;
    if (statusFilter !== "all" && t.status !== statusFilter) return false;
    if (search) { const q = search.toLowerCase(); return t.invoiceNo.toLowerCase().includes(q) || t.customer.toLowerCase().includes(q) || t.cashier.toLowerCase().includes(q); }
    return true;
  }), [search, statusFilter, fromDate, toDate]);

  const handlePrint = () => {
    const printWin = window.open('', '_blank', 'width=800,height=600');
    if (!printWin) return;
    const rows = filtered.map((t, i) => `<tr style="background:${i % 2 === 1 ? '#F8F8F8' : '#FFF'}"><td style="border:1px solid #999;padding:3px 6px">${t.date}</td><td style="border:1px solid #999;padding:3px 6px">${t.time}</td><td style="border:1px solid #999;padding:3px 6px">${t.invoiceNo}</td><td style="border:1px solid #999;padding:3px 6px">${t.customer}</td><td style="border:1px solid #999;padding:3px 6px;text-align:right">${t.items}</td><td style="border:1px solid #999;padding:3px 6px;text-align:right">${t.total.toFixed(2)}</td><td style="border:1px solid #999;padding:3px 6px">${t.method}</td><td style="border:1px solid #999;padding:3px 6px">${t.cashier}</td><td style="border:1px solid #999;padding:3px 6px">${t.status}</td></tr>`).join('');
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
          body: filtered.map(t => [t.date, t.time, t.invoiceNo, t.customer, String(t.items), t.total.toFixed(2), t.method, t.cashier, t.status]),
          startY: 39, styles: { fontSize: 8, cellPadding: 2, lineColor: [0, 0, 0], lineWidth: 0.3 },
          headStyles: { fillColor: [230, 230, 250], textColor: 0, fontStyle: "bold" },
        });
        doc.save(`sales-history-${new Date().toISOString().split('T')[0]}.pdf`);
        toast({ title: "PDF exported" });
      });
    });
  };

  const handleExcel = () => {
    import("xlsx").then((XLSX) => {
      const data = [[COMPANY.name], ["Sales History"], [], ["Date", "Time", "Invoice", "Customer", "Items", "Total GHC", "Method", "Cashier", "Status"]];
      filtered.forEach(t => data.push([t.date, t.time, t.invoiceNo, t.customer, String(t.items), t.total.toFixed(2), t.method, t.cashier, t.status]));
      const ws = XLSX.utils.aoa_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Sales History");
      XLSX.writeFile(wb, `sales-history-${new Date().toISOString().split('T')[0]}.xlsx`);
      toast({ title: "Excel exported" });
    });
  };

  const statusColors: Record<string, string> = { completed: "bg-emerald-100 text-emerald-700", voided: "bg-rose-100 text-rose-700", held: "bg-amber-100 text-amber-700" };

  return (
    <div className="h-screen flex flex-col bg-slate-100">
      <header className="flex-shrink-0 bg-gradient-to-r from-blue-700 to-indigo-600 text-white shadow-lg px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="h-8 w-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center"><ArrowLeft className="h-4 w-4" /></button>
          <History className="h-5 w-5" /><span className="text-sm font-bold">Sales History</span>
        </div>
        <div className="text-xs text-blue-100/80">{COMPANY.name}</div>
      </header>
      <div className="flex-shrink-0 px-4 py-2 bg-white border-b border-slate-200 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search invoice, customer, cashier..." className="h-8 px-3 rounded-lg bg-slate-100 text-xs outline-none focus:ring-2 focus:ring-blue-400 w-48" />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-8 px-2 text-xs border border-slate-300 rounded-lg bg-white outline-none"><option value="all">All Status</option><option value="completed">Completed</option><option value="voided">Voided</option><option value="held">Held</option></select>
          <div className="flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5 text-slate-400" />
            <span className="text-[10px] font-semibold text-slate-600">From:</span>
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="h-8 px-1.5 text-xs border border-slate-300 rounded-lg bg-white outline-none" />
            <span className="text-[10px] font-semibold text-slate-600">To:</span>
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="h-8 px-1.5 text-xs border border-slate-300 rounded-lg bg-white outline-none" />
          </div>
          <Badge variant="outline" className="text-xs">{filtered.length} transactions</Badge>
        </div>
        <div className="flex items-center gap-2"><button onClick={handlePrint} className="h-8 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1.5"><Printer className="h-3.5 w-3.5" /> Print</button><button onClick={handlePDF} className="h-8 px-3 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-1.5"><FileText className="h-3.5 w-3.5" /> PDF</button><button onClick={handleExcel} className="h-8 px-3 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-700 text-xs font-semibold flex items-center gap-1.5"><Download className="h-3.5 w-3.5" /> Excel</button></div>
      </div>
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-slate-800 text-white text-[10px] uppercase z-10"><tr><th className="text-left px-3 py-2 font-semibold">Date</th><th className="text-left px-3 py-2 font-semibold">Time</th><th className="text-left px-3 py-2 font-semibold">Invoice</th><th className="text-left px-3 py-2 font-semibold">Customer</th><th className="text-right px-3 py-2 font-semibold">Items</th><th className="text-right px-3 py-2 font-semibold">Total GHC</th><th className="text-center px-3 py-2 font-semibold">Method</th><th className="text-left px-3 py-2 font-semibold">Cashier</th><th className="text-center px-3 py-2 font-semibold">Status</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(t => (<tr key={t.id} className="hover:bg-blue-50/50"><td className="px-3 py-2 text-slate-600">{t.date}</td><td className="px-3 py-2 text-slate-500 font-mono">{t.time}</td><td className="px-3 py-2 font-mono font-semibold text-slate-800">{t.invoiceNo}</td><td className="px-3 py-2 text-slate-700">{t.customer}</td><td className="px-3 py-2 text-right font-mono text-slate-700">{t.items}</td><td className="px-3 py-2 text-right font-mono font-semibold text-slate-800">{t.total.toFixed(2)}</td><td className="px-3 py-2 text-center text-slate-600">{t.method}</td><td className="px-3 py-2 text-slate-600">{t.cashier}</td><td className="px-3 py-2 text-center"><span className={cn("px-2 py-0.5 rounded text-[9px] font-bold uppercase", statusColors[t.status])}>{t.status}</span></td></tr>))}
            </tbody>
          </table>
          {filtered.length === 0 && <div className="text-center py-16 text-slate-400 text-sm">No transactions found</div>}
        </ScrollArea>
      </div>
    </div>
  );
}

function cn(...args: any[]) { return args.filter(Boolean).join(' '); }
