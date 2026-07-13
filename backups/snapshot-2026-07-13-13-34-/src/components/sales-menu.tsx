"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, FileText, DollarSign, Users, X, Monitor, Printer, Folder,
  FileBarChart2, BarChart3, TrendingUp, CreditCard, User, Package,
  ShoppingCart, Calendar, Search, Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { COMPANY, CURRENCY, formatGHS } from "@/lib/pos-data";
import { PopupWindow } from "@/components/popup-window";

interface SalesMenuProps {
  onBack: () => void;
}

// Sample invoice data
interface Invoice {
  id: string;
  date: string;
  invoiceNo: string;
  client: string;
  qty: number;
  tax: number;
  amount: number;
  paid: number;
  due: number;
  status: "paid" | "outstanding";
}

const sampleInvoices: Invoice[] = [
  { id: "inv1", date: "2026-01-15", invoiceNo: "INV-001", client: "Ama Osei", qty: 1, tax: 0.25, amount: 2.50, paid: 2.75, due: -0.25, status: "paid" },
  { id: "inv2", date: "2026-01-17", invoiceNo: "INV-002", client: "Kwame Mensah", qty: 6, tax: 5.81, amount: 83.00, paid: 72.50, due: 10.50, status: "outstanding" },
  { id: "inv3", date: "2026-01-18", invoiceNo: "INV-003", client: "Akosua Frimpong", qty: 1, tax: 0.00, amount: 0.00, paid: 0.00, due: 0.00, status: "paid" },
  { id: "inv4", date: "2026-01-25", invoiceNo: "INV-004", client: "Yao Adjei", qty: 13, tax: 0.23, amount: 7.50, paid: 7.50, due: 0.00, status: "paid" },
  { id: "inv5", date: "2026-01-26", invoiceNo: "INV-005", client: "Ama Osei", qty: 4, tax: 0.00, amount: 0.00, paid: 0.00, due: 0.00, status: "paid" },
  { id: "inv6", date: "2026-02-03", invoiceNo: "INV-006", client: "Kwame Mensah", qty: 2, tax: 1.50, amount: 35.00, paid: 30.00, due: 5.00, status: "outstanding" },
  { id: "inv7", date: "2026-02-10", invoiceNo: "INV-007", client: "Akosua Frimpong", qty: 5, tax: 4.20, amount: 60.00, paid: 60.00, due: 0.00, status: "paid" },
  { id: "inv8", date: "2026-02-15", invoiceNo: "INV-008", client: "Yao Adjei", qty: 3, tax: 2.10, amount: 30.00, paid: 15.00, due: 15.00, status: "outstanding" },
  { id: "inv9", date: "2026-03-01", invoiceNo: "INV-009", client: "Ama Osei", qty: 8, tax: 6.40, amount: 90.00, paid: 90.00, due: 0.00, status: "paid" },
  { id: "inv10", date: "2026-03-05", invoiceNo: "INV-010", client: "Walk-in Customer", qty: 2, tax: 1.20, amount: 18.00, paid: 0.00, due: 18.00, status: "outstanding" },
];

export function SalesMenu({ onBack }: SalesMenuProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"menu" | "reports">("menu");
  const [showInvoiceListReport, setShowInvoiceListReport] = useState(false);

  // Sales Menu grid items
  const menuItems = [
    { id: "1", label: "List of Clients", icon: Users },
    { id: "2", label: "Invoices List Report", icon: FileText, action: () => setShowInvoiceListReport(true) },
    { id: "3", label: "Summary Sales Report", icon: BarChart3 },
    { id: "4", label: "Aged Clients Report", icon: TrendingUp },
    { id: "5", label: "Client's Statement", icon: FileText },
    { id: "6", label: "Sales Analysis Report", icon: BarChart3 },
    { id: "7", label: "Back Orders Report", icon: Package },
    { id: "8", label: "Sales Tax Report", icon: DollarSign },
    { id: "9", label: "Bank Deposit", icon: CreditCard },
    { id: "a", label: "Sale Payments Report", icon: DollarSign },
    { id: "b", label: "Sales by Client", icon: Users },
    { id: "c", label: "Sales by Product", icon: Package },
    { id: "d", label: "Client Sales/Product", icon: TrendingUp },
    { id: "e", label: "Product Sales/Client", icon: BarChart3 },
    { id: "f", label: "Staff Sales Report", icon: User },
    { id: "g", label: "Loyalty Points Report", icon: CreditCard },
    { id: "o", label: "Sales Sources Report", icon: BarChart3 },
    { id: "s", label: "Sold Items Report", icon: ShoppingCart },
    { id: "w", label: "Cashflow Report", icon: DollarSign },
    { id: "x", label: "Sales by Supplier", icon: Package },
  ];

  const sidebarItems = [
    { id: "invoicing", label: "Invoicing", icon: FileText, color: "blue" },
    { id: "payments", label: "Payments Received", icon: DollarSign, color: "green" },
    { id: "clients", label: "Add/Modify Clients", icon: Users, color: "blue" },
    { id: "close", label: "Close (Esc)", icon: X, color: "red", action: onBack },
  ];

  return (
    <div className="h-screen flex flex-col bg-slate-100">
      <PopupWindow title="Sales Menu" titleBarColor="#4A6FA5" initialWidth={800} initialHeight={560} minWidth={600} minHeight={400} onClose={onBack}>
        <div className="h-full flex flex-col" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
          {/* Tab Navigation */}
          <div className="flex-shrink-0 flex" style={{ backgroundColor: '#5D7EB8' }}>
            <button
              onClick={() => setActiveTab("menu")}
              className={cn("px-6 py-1.5 text-xs font-bold text-white transition", activeTab === "menu" ? "bg-white/20" : "hover:bg-white/10")}
            >
              Sales Menu
            </button>
            <button
              onClick={() => setActiveTab("reports")}
              className={cn("px-6 py-1.5 text-xs font-bold text-white transition border-l border-white/20", activeTab === "reports" ? "bg-white/20" : "hover:bg-white/10")}
            >
              Sales Reports
            </button>
          </div>

          {/* Main Content: Sidebar + Grid */}
          <div className="flex-1 flex overflow-hidden">
            {/* Left Sidebar */}
            <div className="flex-shrink-0 w-36 bg-slate-200 border-r border-slate-300 p-2 space-y-1">
              {sidebarItems.map(item => (
                <button
                  key={item.id}
                  onClick={() => item.action ? item.action() : toast({ title: item.label })}
                  className={cn("w-full flex items-center gap-1.5 px-2 py-1.5 rounded text-[10px] font-semibold transition",
                    item.color === "red" ? "text-red-600 hover:bg-red-100" : item.color === "green" ? "text-green-600 hover:bg-green-100" : "text-blue-600 hover:bg-blue-100"
                  )}
                >
                  <item.icon className="h-3.5 w-3.5" />
                  {item.label}
                </button>
              ))}
            </div>

            {/* Grid of Report Options */}
            <div className="flex-1 overflow-y-auto p-3 bg-white">
              <div className="grid grid-cols-4 gap-2">
                {menuItems.map(item => (
                  <button
                    key={item.id}
                    onClick={() => item.action ? item.action() : toast({ title: item.label, description: "Report generation" })}
                    className="flex flex-col items-center gap-1.5 p-3 rounded-lg border border-slate-200 bg-slate-50 hover:bg-blue-50 hover:border-blue-300 transition group"
                  >
                    <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center group-hover:bg-blue-200 transition">
                      <item.icon className="h-5 w-5 text-blue-600" />
                    </div>
                    <span className="text-[9px] font-semibold text-slate-700 text-center leading-tight">{item.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Status Bar */}
          <div className="flex-shrink-0 px-4 py-1 text-[9px] text-white text-center" style={{ backgroundColor: '#2C3E50' }}>
            {COMPANY.name} · {COMPANY.address} · {COMPANY.contact}
          </div>
        </div>

        {/* Invoice List Report Dialog */}
        <AnimatePresence>
          {showInvoiceListReport && (
            <InvoiceListReportDialog
              invoices={sampleInvoices}
              onClose={() => setShowInvoiceListReport(false)}
            />
          )}
        </AnimatePresence>
      </PopupWindow>
    </div>
  );
}

// ===== Invoice List Report Filter Dialog =====
function InvoiceListReportDialog({ invoices, onClose }: { invoices: Invoice[]; onClose: () => void }) {
  const { toast } = useToast();
  const [location, setLocation] = useState("all");
  const [type, setType] = useState("invoice");
  const [refNo, setRefNo] = useState("");
  const [clientName, setClientName] = useState("");
  const [reportType, setReportType] = useState("totals");
  const [status, setStatus] = useState("all");
  const [fromDate, setFromDate] = useState("2026-01-01");
  const [toDate, setToDate] = useState("2026-12-31");
  const [generatedReport, setGeneratedReport] = useState<Invoice[] | null>(null);

  const handleScreen = () => {
    const filtered = invoices.filter(inv => {
      if (fromDate && inv.date < fromDate) return false;
      if (toDate && inv.date > toDate) return false;
      if (status === "paid" && inv.status !== "paid") return false;
      if (status === "outstanding" && inv.status !== "outstanding") return false;
      if (clientName && !inv.client.toLowerCase().includes(clientName.toLowerCase())) return false;
      if (refNo && !inv.invoiceNo.toLowerCase().includes(refNo.toLowerCase())) return false;
      return true;
    });
    setGeneratedReport(filtered);
    toast({ title: "Report generated", description: `${filtered.length} invoices` });
  };

  const handlePrint = () => {
    const filtered = generatedReport || invoices;
    const printWin = window.open('', '_blank', 'width=800,height=600');
    if (!printWin) return;
    const fmtDate = (iso: string) => { const [y, m, d] = iso.split('-'); return `${parseInt(m)}/${parseInt(d)}/${y}`; };
    const rows = filtered.map((inv, i) => `
      <tr style="background:${i % 2 === 1 ? '#F8F8F8' : '#FFFFFF'}">
        <td style="border:1px solid #999;padding:3px 6px">${fmtDate(inv.date)}</td>
        <td style="border:1px solid #999;padding:3px 6px;text-align:right">${inv.qty.toFixed(2)}</td>
        <td style="border:1px solid #999;padding:3px 6px;text-align:right">${inv.tax.toFixed(2)}</td>
        <td style="border:1px solid #999;padding:3px 6px;text-align:right">${inv.amount.toFixed(2)}</td>
        <td style="border:1px solid #999;padding:3px 6px;text-align:right">${inv.paid.toFixed(2)}</td>
        <td style="border:1px solid #999;padding:3px 6px;text-align:right;color:${inv.due > 0 ? '#FF0000' : '#000'}">${inv.due.toFixed(2)}</td>
      </tr>`).join('');
    const totals = filtered.reduce((a, i) => ({ qty: a.qty + i.qty, tax: a.tax + i.tax, amount: a.amount + i.amount, paid: a.paid + i.paid, due: a.due + i.due }), { qty: 0, tax: 0, amount: 0, paid: 0, due: 0 });
    printWin.document.write(`<!DOCTYPE html><html><head><title>Invoice List Report</title>
      <style>body{font-family:Arial;margin:20px}.header{text-align:center;border-bottom:2px solid #333;padding-bottom:10px;margin-bottom:15px}h1{font-size:18px;margin:0}.info{font-size:12px;color:#666}h2{text-align:center;font-size:14px;margin:10px 0}table{width:100%;border-collapse:collapse;font-size:11px}th{background:#E6E6FA;border:1px solid #999;padding:4px 6px}.totals{margin-top:15px;font-size:11px}@media print{thead{display:table-header-group}tr{page-break-inside:avoid}}</style>
      </head><body>
      <div class="header"><h1>${COMPANY.name}</h1><div class="info">${COMPANY.address} · ${COMPANY.contact}</div></div>
      <h2>${reportType === 'totals' ? 'Totals' : reportType === 'summary' ? 'Summary' : 'Detailed'} Invoice Report</h2>
      <p style="text-align:center;font-size:11px">For The Period ${fmtDate(fromDate)} - ${fmtDate(toDate)}${status !== 'all' ? ` · Status: ${status}` : ''}</p>
      <table><thead><tr><th>Date</th><th style="text-align:right">Qty</th><th style="text-align:right">TAX GHC</th><th style="text-align:right">Amount GHC</th><th style="text-align:right">Paid GHC</th><th style="text-align:right">Due GHC</th></tr></thead>
      <tbody>${rows}</tbody></table>
      <table class="totals"><tr style="font-weight:bold;border-top:2px solid #333"><td>TOTAL</td><td style="text-align:right">${totals.qty.toFixed(2)}</td><td style="text-align:right">${totals.tax.toFixed(2)}</td><td style="text-align:right">${totals.amount.toFixed(2)}</td><td style="text-align:right">${totals.paid.toFixed(2)}</td><td style="text-align:right;color:${totals.due > 0 ? '#FF0000' : '#000'}">${totals.due.toFixed(2)}</td></tr></table>
      </body></html>`);
    printWin.document.close();
    setTimeout(() => { printWin.focus(); printWin.print(); }, 300);
    toast({ title: "Printing (F3)" });
  };

  const handleFile = () => {
    import("xlsx").then((XLSX) => {
      const filtered = generatedReport || invoices;
      const data: (string | number)[][] = [];
      data.push([COMPANY.name, "Accra Warehouse", COMPANY.address]);
      data.push([`${reportType === 'totals' ? 'Totals' : reportType === 'summary' ? 'Summary' : 'Detailed'} Invoice Report`]);
      data.push([`For The Period ${fromDate} - ${toDate}`]);
      data.push([]);
      data.push(["Date", "Qty", "TAX GHC", "Amount GHC", "Paid GHC", "Due GHC", "Status"]);
      filtered.forEach(inv => data.push([inv.date, inv.qty, inv.tax, inv.amount, inv.paid, inv.due, inv.status]));
      const totals = filtered.reduce((a, i) => ({ qty: a.qty + i.qty, tax: a.tax + i.tax, amount: a.amount + i.amount, paid: a.paid + i.paid, due: a.due + i.due }), { qty: 0, tax: 0, amount: 0, paid: 0, due: 0 });
      data.push(["TOTAL", totals.qty, totals.tax, totals.amount, totals.paid, totals.due, ""]);
      const ws = XLSX.utils.aoa_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Invoice Report");
      XLSX.writeFile(wb, `invoice-report-${new Date().toISOString().split('T')[0]}.xlsx`);
      toast({ title: "Excel exported" });
    });
  };

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]" onClick={onClose}>
        <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full rounded-lg shadow-2xl overflow-hidden flex flex-col" style={{ width: '100%', maxWidth: '480px', backgroundColor: '#0078D7', fontFamily: 'Arial, Helvetica, sans-serif' }}>
          {/* Title Bar */}
          <div className="flex items-center justify-between px-3 py-1.5">
            <span className="text-xs font-bold text-white">Invoice List Report</span>
            <button onClick={onClose} className="h-5 w-5 rounded bg-red-600 hover:bg-red-700 flex items-center justify-center"><X className="h-3 w-3 text-white" /></button>
          </div>

          {/* Filter Fields */}
          <div className="px-4 py-3 space-y-2">
            {[
              { label: "Location", type: "select", value: location, set: setLocation, options: ["All Locations", "Main Store", "Warehouse"] },
              { label: "Type", type: "select", value: type, set: setType, options: ["Invoice", "Quote", "Order"] },
            ].map(f => (
              <div key={f.label} className="flex items-center gap-3">
                <label className="text-[10px] text-white font-semibold w-24 text-right">{f.label}</label>
                <select value={f.value} onChange={(e) => f.set(e.target.value)} className="flex-1 h-6 text-[10px] border border-white/40 rounded px-1 bg-white text-slate-800 outline-none">
                  {f.options.map(o => <option key={o} value={o.toLowerCase().replace(/\s/g, '-')}>{o}</option>)}
                </select>
              </div>
            ))}
            <div className="flex items-center gap-3">
              <label className="text-[10px] text-white font-semibold w-24 text-right">Reference No.</label>
              <input value={refNo} onChange={(e) => setRefNo(e.target.value)} className="flex-1 h-6 text-[10px] border border-white/40 rounded px-1 bg-white text-slate-800 outline-none" />
            </div>
            <div className="flex items-center gap-3">
              <label className="text-[10px] text-white font-semibold w-24 text-right">Client Name</label>
              <input value={clientName} onChange={(e) => setClientName(e.target.value)} className="flex-1 h-6 text-[10px] border border-white/40 rounded px-1 bg-white text-slate-800 outline-none" />
            </div>
            <div className="flex items-center gap-3">
              <label className="text-[10px] text-white font-semibold w-24 text-right">Report Type</label>
              <select value={reportType} onChange={(e) => setReportType(e.target.value)} className="flex-1 h-6 text-[10px] border border-white/40 rounded px-1 bg-white text-slate-800 outline-none">
                <option value="totals">Totals</option>
                <option value="summary">Summary</option>
                <option value="detailed">Detailed</option>
              </select>
            </div>
            <div className="flex items-center gap-3">
              <label className="text-[10px] text-white font-semibold w-24 text-right">Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className="flex-1 h-6 text-[10px] border border-white/40 rounded px-1 bg-white text-slate-800 outline-none">
                <option value="all">All</option>
                <option value="outstanding">Outstanding</option>
                <option value="paid">Paid</option>
              </select>
            </div>
            <div className="flex items-center gap-3">
              <label className="text-[10px] text-white font-semibold w-24 text-right">From Date</label>
              <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="flex-1 h-6 text-[10px] border border-white/40 rounded px-1 bg-white text-slate-800 outline-none" />
            </div>
            <div className="flex items-center gap-3">
              <label className="text-[10px] text-white font-semibold w-24 text-right">To Date</label>
              <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="flex-1 h-6 text-[10px] border border-white/40 rounded px-1 bg-white text-slate-800 outline-none" />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-center gap-2 px-4 py-3 border-t border-white/20">
            <button onClick={handleScreen} className="h-8 px-4 rounded bg-white/20 hover:bg-white/30 text-white text-[10px] font-semibold flex items-center gap-1.5 transition"><Monitor className="h-3.5 w-3.5" /> Screen</button>
            <button onClick={handlePrint} className="h-8 px-4 rounded bg-white/20 hover:bg-white/30 text-white text-[10px] font-semibold flex items-center gap-1.5 transition"><Printer className="h-3.5 w-3.5" /> Printer <kbd className="text-[7px] bg-white/20 px-0.5 rounded">F3</kbd></button>
            <button onClick={handleFile} className="h-8 px-4 rounded bg-white/20 hover:bg-white/30 text-white text-[10px] font-semibold flex items-center gap-1.5 transition"><Folder className="h-3.5 w-3.5" /> File</button>
            <button onClick={onClose} className="h-8 px-4 rounded bg-red-600 hover:bg-red-700 text-white text-[10px] font-semibold flex items-center gap-1.5 transition"><X className="h-3.5 w-3.5" /> Close <kbd className="text-[7px] bg-white/20 px-0.5 rounded">Esc</kbd></button>
          </div>
        </motion.div>
      </motion.div>

      {/* Generated Report Viewer */}
      <AnimatePresence>
        {generatedReport && (
          <InvoiceReportViewer
            data={generatedReport}
            reportType={reportType}
            status={status}
            fromDate={fromDate}
            toDate={toDate}
            onClose={() => setGeneratedReport(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

// ===== Invoice Report Viewer (Screen output) =====
function InvoiceReportViewer({ data, reportType, status, fromDate, toDate, onClose }: {
  data: Invoice[]; reportType: string; status: string; fromDate: string; toDate: string; onClose: () => void;
}) {
  const fmtDate = (iso: string) => { const [y, m, d] = iso.split('-'); return `${parseInt(m)}/${parseInt(d)}/${y}`; };
  const fmtNum = (n: number) => n.toFixed(2);
  const now = new Date();
  const dateStr = `${now.getMonth() + 1}/${now.getDate()}/${now.getFullYear()}`;
  const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

  const totals = data.reduce((a, i) => ({ qty: a.qty + i.qty, tax: a.tax + i.tax, amount: a.amount + i.amount, paid: a.paid + i.paid, due: a.due + i.due }), { qty: 0, tax: 0, amount: 0, paid: 0, due: 0 });

  const title = reportType === "totals" ? "Totals" : reportType === "summary" ? "Summary" : "Detailed";
  const statusText = status === "paid" ? " · Status: Paid" : status === "outstanding" ? " · Status: Outstanding" : "";

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-[70]" onClick={onClose}>
      <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
        onClick={(e) => e.stopPropagation()} className="bg-white rounded-lg shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
        {/* Close button */}
        <div className="flex items-center justify-between px-4 py-1.5 bg-slate-100 border-b border-slate-300">
          <span className="text-xs font-bold text-slate-700">Invoice Report Preview</span>
          <button onClick={onClose} className="h-6 w-6 rounded bg-rose-100 hover:bg-rose-200 flex items-center justify-center"><X className="h-3.5 w-3.5 text-rose-600" /></button>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-6">
            {/* Company Header */}
            <div className="text-center border-b-2 border-slate-800 pb-2 mb-3">
              <div className="text-base font-bold text-slate-900">{COMPANY.name}</div>
              <div className="text-[11px] text-slate-600">Accra Warehouse</div>
              <div className="text-[10px] text-slate-500">{COMPANY.address} · {COMPANY.contact}</div>
            </div>
            <div className="flex justify-end text-[10px] text-slate-500 mb-2">
              <div className="text-right"><div>{dateStr}</div><div>{timeStr}</div><div className="font-semibold text-slate-700">Page 1</div></div>
            </div>

            {/* Title */}
            <div className="text-center mb-4">
              <h1 className="text-sm font-bold text-slate-900">{title} Invoice Report</h1>
              <p className="text-[11px] text-slate-600">For The Period {fmtDate(fromDate)} - {fmtDate(toDate)}{statusText}</p>
            </div>

            {/* Table */}
            <div className="mobile-scroll-x">
            <table className="w-full text-[10px]" style={{ borderCollapse: 'collapse' }}>
              <thead><tr style={{ backgroundColor: '#E6E6FA' }}>
                <th className="px-2 py-1.5 text-left font-bold text-slate-800 border border-slate-400">Date</th>
                <th className="px-2 py-1.5 text-right font-bold text-slate-800 border border-slate-400">Qty</th>
                <th className="px-2 py-1.5 text-right font-bold text-slate-800 border border-slate-400">TAX GHC</th>
                <th className="px-2 py-1.5 text-right font-bold text-slate-800 border border-slate-400">Amount GHC</th>
                <th className="px-2 py-1.5 text-right font-bold text-slate-800 border border-slate-400">Paid GHC</th>
                <th className="px-2 py-1.5 text-right font-bold text-slate-800 border border-slate-400">Due GHC</th>
              </tr></thead>
              <tbody>
                {data.map((inv, i) => (
                  <tr key={inv.id} style={{ backgroundColor: i % 2 === 1 ? '#F8F8F8' : '#FFFFFF' }}>
                    <td className="px-2 py-1 border border-slate-400">{fmtDate(inv.date)}</td>
                    <td className="px-2 py-1 text-right border border-slate-400">{inv.qty.toFixed(2)}</td>
                    <td className="px-2 py-1 text-right border border-slate-400">{fmtNum(inv.tax)}</td>
                    <td className="px-2 py-1 text-right border border-slate-400">{fmtNum(inv.amount)}</td>
                    <td className="px-2 py-1 text-right border border-slate-400">{fmtNum(inv.paid)}</td>
                    <td className="px-2 py-1 text-right font-semibold border border-slate-400" style={{ color: inv.due > 0 ? '#FF0000' : '#000' }}>{fmtNum(inv.due)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ backgroundColor: '#E6E6FA' }}>
                  <td className="px-2 py-1.5 font-bold text-slate-900 border border-slate-400">TOTAL</td>
                  <td className="px-2 py-1.5 text-right font-bold text-slate-900 border border-slate-400">{totals.qty.toFixed(2)}</td>
                  <td className="px-2 py-1.5 text-right font-bold text-slate-900 border border-slate-400">{fmtNum(totals.tax)}</td>
                  <td className="px-2 py-1.5 text-right font-bold text-slate-900 border border-slate-400">{fmtNum(totals.amount)}</td>
                  <td className="px-2 py-1.5 text-right font-bold text-slate-900 border border-slate-400">{fmtNum(totals.paid)}</td>
                  <td className="px-2 py-1.5 text-right font-bold border border-slate-400" style={{ color: totals.due > 0 ? '#FF0000' : '#000' }}>{fmtNum(totals.due)}</td>
                </tr>
              </tfoot>
            </table>
            </div>

            {/* Footer */}
            <div className="text-center text-[9px] text-slate-400 mt-4 pt-2 border-t border-slate-200">
              {COMPANY.name} · {COMPANY.address} · {COMPANY.contact}
            </div>
          </div>
        </ScrollArea>
      </motion.div>
    </motion.div>
  );
}
