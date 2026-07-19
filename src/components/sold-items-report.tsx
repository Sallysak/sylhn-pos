"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Calendar, Printer, FileText, Download, FileBarChart2, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { COMPANY, CURRENCY, formatGHS, type Product } from "@/lib/pos-data";

// Sample sold items transactions
interface SoldItem {
  id: string;
  date: string; // ISO date
  partNo: string; // barcode
  details: string;
  qty: number;
  amount: number;
  group: string;
}

// Generate sample sold items data spanning Jan-Jul 2026
const generateSoldItems = (): SoldItem[] => {
  const groups = ["Confectionery", "Groceries", "Hard Liquor", "Households", "Ice Cream", "Soft Drinks"];
  const items: SoldItem[] = [
    // Confectionery
    { id: "s1", date: "2026-07-06", partNo: "6034000552461", details: "MCBERRY BOURBON", qty: 1, amount: 4.50, group: "Confectionery" },
    { id: "s2", date: "2026-07-06", partNo: "6034000568455", details: "MUNCHEE CHOCO CHIPS", qty: 2, amount: 20.00, group: "Confectionery" },
    { id: "s3", date: "2026-07-06", partNo: "76533548", details: "SUPER 2", qty: 4, amount: 10.00, group: "Confectionery" },
    { id: "s4", date: "2026-07-06", partNo: "8000500223499", details: "TIC TAC", qty: 2, amount: 12.00, group: "Confectionery" },
    { id: "s5", date: "2026-07-06", partNo: "88888888675", details: "P.K GUM SINGLES", qty: 5, amount: 3.00, group: "Confectionery" },
    { id: "s6", date: "2026-07-06", partNo: "8935001705444", details: "MENTOS GUM ASSORTED", qty: 2, amount: 20.00, group: "Confectionery" },
    // Groceries
    { id: "s7", date: "2026-07-06", partNo: "6033000083159", details: "CERELAC SACHET", qty: 2, amount: 12.00, group: "Groceries" },
    { id: "s8", date: "2026-07-06", partNo: "6033000088116", details: "IDEAL MILK SACHET", qty: 1, amount: 7.00, group: "Groceries" },
    { id: "s9", date: "2026-07-06", partNo: "605832659435", details: "SPICY MEAT", qty: 1, amount: 36.50, group: "Groceries" },
    // Hard Liquor
    { id: "s10", date: "2026-07-06", partNo: "4840358008060", details: "ASCONI AGOR WINE", qty: 2, amount: 316.00, group: "Hard Liquor" },
    { id: "s11", date: "2026-07-06", partNo: "6034000106411", details: "ORIGIN BITTERS 20CL", qty: 2, amount: 60.00, group: "Hard Liquor" },
    // Household
    { id: "s12", date: "2026-07-06", partNo: "817644331811", details: "SURE DEO SPRAY 250ML", qty: 2, amount: 154.00, group: "Households" },
    // Ice Cream
    { id: "s13", date: "2026-07-06", partNo: "6034000130768", details: "FANYOGO SACHET", qty: 1, amount: 4.50, group: "Ice Cream" },
    // Soft Drinks
    { id: "s14", date: "2026-07-06", partNo: "070074671093", details: "ENSURE", qty: 1, amount: 45.00, group: "Soft Drinks" },
    { id: "s15", date: "2026-07-06", partNo: "075720481279", details: "POLAND WATER", qty: 1, amount: 10.00, group: "Soft Drinks" },
    { id: "s16", date: "2026-07-06", partNo: "076301590052", details: "APPLE & EVE PLASTIC", qty: 1, amount: 14.00, group: "Soft Drinks" },
    { id: "s17", date: "2026-07-06", partNo: "42105220", details: "COKE 450ML", qty: 1, amount: 12.00, group: "Soft Drinks" },
    { id: "s18", date: "2026-07-06", partNo: "6034000106893", details: "CAN MALT", qty: 2, amount: 28.00, group: "Soft Drinks" },
    { id: "s19", date: "2026-07-06", partNo: "6034000181036", details: "BEL AQUA WATER 500ML", qty: 17, amount: 51.00, group: "Soft Drinks" },
    { id: "s20", date: "2026-07-06", partNo: "6034000181043", details: "BEL AQUA 1.5 LITRES", qty: 3, amount: 21.00, group: "Soft Drinks" },
    { id: "s21", date: "2026-07-06", partNo: "6034000351170", details: "BEL ACTIVE", qty: 1, amount: 6.00, group: "Soft Drinks" },
    { id: "s22", date: "2026-07-06", partNo: "90162602", details: "RED BULL ENERGY DRINK", qty: 1, amount: 25.00, group: "Soft Drinks" },
    { id: "s23", date: "2026-07-06", partNo: "90418723", details: "PET COKE/ FANTA", qty: 1, amount: 7.00, group: "Soft Drinks" },
    { id: "s24", date: "2026-07-06", partNo: "9501053210466", details: "KALYPPO", qty: 1, amount: 6.00, group: "Soft Drinks" },
    // Additional dates for filtering
    { id: "s25", date: "2026-07-05", partNo: "6034000552461", details: "MCBERRY BOURBON", qty: 3, amount: 13.50, group: "Confectionery" },
    { id: "s26", date: "2026-07-05", partNo: "42105220", details: "COKE 450ML", qty: 5, amount: 60.00, group: "Soft Drinks" },
    { id: "s27", date: "2026-07-05", partNo: "6034000181036", details: "BEL AQUA WATER 500ML", qty: 10, amount: 30.00, group: "Soft Drinks" },
    { id: "s28", date: "2026-07-04", partNo: "4840358008060", details: "ASCONI AGOR WINE", qty: 1, amount: 158.00, group: "Hard Liquor" },
    { id: "s29", date: "2026-07-04", partNo: "6033000088116", details: "IDEAL MILK SACHET", qty: 4, amount: 28.00, group: "Groceries" },
    { id: "s30", date: "2026-07-03", partNo: "817644331811", details: "SURE DEO SPRAY 250ML", qty: 1, amount: 77.00, group: "Households" },
  ];
  return items;
};

const allSoldItems = generateSoldItems();

interface SoldItemsReportProps {
  onBack: () => void;
}

export function SoldItemsReport({ onBack }: SoldItemsReportProps) {
  const [fromDate, setFromDate] = useState("2026-07-01");
  const [toDate, setToDate] = useState("2026-12-31");
  const { toast } = useToast();

  // Filter by date range
  const filtered = allSoldItems.filter(t => t.date >= fromDate && t.date <= toDate);

  // Group by category
  const grouped = filtered.reduce((acc, item) => {
    if (!acc[item.group]) acc[item.group] = [];
    acc[item.group].push(item);
    return acc;
  }, {} as Record<string, SoldItem[]>);

  // Calculate totals
  const totals = filtered.reduce((acc, t) => ({
    qty: acc.qty + t.qty,
    amount: acc.amount + t.amount,
  }), { qty: 0, amount: 0 });

  const formatDate = (iso: string) => {
    const [y, m, d] = iso.split('-');
    return `${parseInt(m)}/${parseInt(d)}/${y}`;
  };

  const getDayName = (iso: string) => {
    const date = new Date(iso + 'T00:00:00');
    return date.toLocaleDateString('en-US', { weekday: 'long' });
  };

  const formatNum = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const now = new Date();
  const dateStr = `${now.getMonth() + 1}/${now.getDate()}/${now.getFullYear()}`;
  const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

  // PDF Export
  const handleExportPDF = () => {
    if (filtered.length === 0) { toast({ title: "No data to export", variant: "destructive" }); return; }
    import("jspdf").then(({ default: jsPDF }) => {
      import("jspdf-autotable").then(({ default: autoTable }) => {
        const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
        const pw = doc.internal.pageSize.getWidth();
        // Company Header (centered)
        doc.setFontSize(16); doc.setFont("helvetica", "bold"); doc.setTextColor(30, 41, 59);
        doc.text(COMPANY.name, pw / 2, 18, { align: "center" });
        doc.setFontSize(11); doc.setFont("helvetica", "normal"); doc.setTextColor(100, 100, 100);
        doc.text("Accra Warehouse", pw / 2, 25, { align: "center" });
        doc.text(COMPANY.address, pw / 2, 30, { align: "center" });
        // Date/time/page (right)
        doc.setFontSize(9);
        doc.text(`${dateStr}`, pw - 14, 18, { align: "right" });
        doc.text(`${timeStr}`, pw - 14, 23, { align: "right" });
        doc.text("Page 1", pw - 14, 28, { align: "right" });
        // Title (blue)
        doc.setFontSize(14); doc.setFont("helvetica", "bold"); doc.setTextColor(0, 102, 204);
        doc.text("Sold Items Report (Summary)", pw / 2, 42, { align: "center" });
        doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.setTextColor(80, 80, 80);
        doc.text(`For ${getDayName(fromDate)} ${formatDate(fromDate)} - ${getDayName(toDate)} ${formatDate(toDate)}`, pw / 2, 48, { align: "center" });

        // Build table data grouped by category
        const body: (string | number)[][] = [];
        Object.entries(grouped).forEach(([group, items]) => {
          // Category header row
          body.push([group, "", "", ""]);
          items.forEach(item => {
            body.push([item.partNo, item.details, String(item.qty), formatNum(item.amount)]);
          });
        });
        // Total row
        body.push(["TOTAL", "", String(totals.qty), formatNum(totals.amount)]);

        autoTable(doc, {
          head: [["Part no.", "Details", "Qty", "Amount GHC"]],
          body,
          startY: 54,
          styles: { fontSize: 9, cellPadding: 2, lineColor: [0, 0, 0], lineWidth: 0.3 },
          headStyles: { fillColor: [230, 242, 255], textColor: 0, fontStyle: "bold" },
          alternateRowStyles: { fillColor: [249, 249, 249] },
          columnStyles: {
            0: { cellWidth: 35 },
            1: { cellWidth: 80 },
            2: { cellWidth: 20, halign: "right" },
            3: { cellWidth: 35, halign: "right" },
          },
          margin: { left: 14, right: 14 },
          didParseCell: (data: any) => {
            // Style category header rows
            if (data.section === 'body' && data.row.raw[1] === "" && data.row.raw[2] === "" && data.row.raw[3] === "" && data.row.raw[0] !== "TOTAL") {
              data.cell.styles.fontStyle = 'bold';
              data.cell.styles.fillColor = [240, 240, 240];
              data.cell.styles.textColor = [30, 41, 59];
            }
            // Style TOTAL row
            if (data.row.raw[0] === "TOTAL") {
              data.cell.styles.fontStyle = 'bold';
              data.cell.styles.fillColor = [230, 242, 255];
            }
          },
        });

        const ph = doc.internal.pageSize.getHeight();
        doc.setFontSize(8); doc.setTextColor(150, 150, 150);
        doc.text(`${COMPANY.name} · ${COMPANY.address} · ${COMPANY.contact}`, pw / 2, ph - 8, { align: "center" });
        doc.save(`sold-items-report-${new Date().toISOString().split('T')[0]}.pdf`);
        toast({ title: "PDF exported successfully" });
      });
    });
  };

  // Excel Export
  const handleExportExcel = () => {
    if (filtered.length === 0) { toast({ title: "No data to export", variant: "destructive" }); return; }
    import("xlsx").then((XLSX) => {
      const data: (string | number)[][] = [];
      data.push([COMPANY.name]); data.push(["Accra Warehouse"]); data.push([COMPANY.address]); data.push([]);
      data.push(["Sold Items Report (Summary)"]);
      data.push([`For ${getDayName(fromDate)} ${formatDate(fromDate)} - ${getDayName(toDate)} ${formatDate(toDate)}`]);
      data.push([`Generated: ${dateStr} ${timeStr}`]); data.push([]);
      data.push(["Part no.", "Details", "Qty", "Amount GHC"]);
      Object.entries(grouped).forEach(([group, items]) => {
        data.push([group, "", "", ""]);
        items.forEach(item => data.push([item.partNo, item.details, item.qty, formatNum(item.amount)]));
      });
      data.push(["TOTAL", "", totals.qty, formatNum(totals.amount)]);
      const ws = XLSX.utils.aoa_to_sheet(data);
      ws['!cols'] = [{ wch: 18 }, { wch: 30 }, { wch: 8 }, { wch: 14 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Sold Items");
      XLSX.writeFile(wb, `sold-items-report-${new Date().toISOString().split('T')[0]}.xlsx`);
      toast({ title: "Excel exported successfully" });
    });
  };

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-slate-100 to-slate-200">
      {/* Header */}
      <header className="flex-shrink-0 bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-600 text-white shadow-lg">
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={onBack} className="h-9 w-9 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition active:scale-90 flex-shrink-0">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="h-9 w-9 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center ring-1 ring-white/20 flex-shrink-0">
                <FileBarChart2 className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="font-bold text-base leading-tight truncate">Sold Items Report</div>
                <div className="text-[10px] text-emerald-100/90 truncate">{COMPANY.name}</div>
              </div>
            </div>
          </div>
          <div className="text-right hidden sm:block flex-shrink-0">
            <div className="text-xs text-emerald-100/80">{COMPANY.address}</div>
            <div className="text-xs font-mono text-emerald-100">{COMPANY.contact}</div>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4">
        {/* Date Filter + Export Bar — premium mobile-friendly */}
        <div className="max-w-3xl mx-auto mb-3 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Calendar className="h-4 w-4 text-emerald-600 flex-shrink-0" />
            <span className="text-[10px] sm:text-xs font-semibold text-slate-600">From:</span>
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="h-9 sm:h-9 px-2 rounded-lg border border-slate-300 text-xs outline-none focus:ring-2 focus:ring-emerald-400" />
            <span className="text-[10px] sm:text-xs font-semibold text-slate-600">To:</span>
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="h-9 sm:h-9 px-2 rounded-lg border border-slate-300 text-xs outline-none focus:ring-2 focus:ring-emerald-400" />
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => window.print()} className="flex-1 sm:flex-none h-9 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition">
              <Printer className="h-3.5 w-3.5" /> Print
            </button>
            <button onClick={handleExportPDF} className="flex-1 sm:flex-none h-9 px-3 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition">
              <FileText className="h-3.5 w-3.5" /> PDF
            </button>
            <button onClick={handleExportExcel} className="flex-1 sm:flex-none h-9 px-3 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition">
              <Download className="h-3.5 w-3.5" /> Excel
            </button>
          </div>
        </div>

        {/* ===== Mobile: Premium KPI tiles + card list (below md) ===== */}
        <div className="md:hidden max-w-3xl mx-auto space-y-3">
          {/* KPI tiles */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white p-3 rounded-xl shadow-sm">
              <div className="text-[10px] uppercase tracking-wider opacity-80 font-semibold">Total Qty Sold</div>
              <div className="text-2xl font-bold mt-0.5">{totals.qty}</div>
            </div>
            <div className="bg-gradient-to-br from-indigo-500 to-blue-600 text-white p-3 rounded-xl shadow-sm">
              <div className="text-[10px] uppercase tracking-wider opacity-80 font-semibold">Total Revenue</div>
              <div className="text-2xl font-bold mt-0.5 font-mono">{CURRENCY}{formatNum(totals.amount)}</div>
            </div>
          </div>

          {/* Card list grouped by category */}
          {filtered.length === 0 ? (
            <div className="bg-white rounded-xl p-8 text-center text-slate-400 text-sm">
              <FileBarChart2 className="h-10 w-10 mx-auto mb-3 opacity-30" />
              No sold items found in the selected date range
            </div>
          ) : (
            Object.entries(grouped).map(([group, items]) => (
              <div key={group} className="bg-white rounded-xl shadow-sm ring-1 ring-slate-200 overflow-hidden">
                {/* Category header */}
                <div className="bg-slate-100 px-3 py-2 border-b border-slate-200 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">{group}</span>
                  <span className="text-[10px] text-slate-500">{items.length} items</span>
                </div>
                {/* Item rows */}
                <div className="divide-y divide-slate-100">
                  {items.map(item => (
                    <div key={item.id} className="p-3 flex items-center justify-between gap-2 active:bg-slate-50 transition">
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-medium text-slate-800 truncate">{item.details}</div>
                        <div className="text-[10px] text-slate-500 font-mono">{item.partNo}</div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-xs font-bold text-slate-800">{item.qty} sold</div>
                        <div className="text-[10px] text-emerald-600 font-mono font-semibold">{CURRENCY}{formatNum(item.amount)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* ===== Desktop: traditional report (md+) ===== */}
        <div className="hidden md:block max-w-3xl mx-auto bg-white shadow-xl" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
          {/* Company Header (centered) */}
          <div className="px-8 pt-6 pb-3 text-center border-b-2 border-slate-800 relative">
            <div className="text-lg font-bold text-slate-900 uppercase leading-tight">{COMPANY.name}</div>
            <div className="text-sm text-slate-600">Accra Warehouse</div>
            <div className="text-xs text-slate-600">{COMPANY.address}</div>
            {/* Date/time/page (right-aligned) */}
            <div className="absolute top-6 right-8 text-right text-xs text-slate-600">
              <div>{dateStr}</div>
              <div>{timeStr}</div>
              <div className="mt-1 font-semibold text-slate-700">Page 1</div>
            </div>
          </div>

          {/* Report Title (blue) */}
          <div className="px-8 py-4 text-center">
            <h1 className="text-lg font-bold" style={{ color: '#0066CC' }}>Sold Items Report (Summary)</h1>
            <p className="text-sm text-slate-600 mt-1">
              For {getDayName(fromDate)} {formatDate(fromDate)} - {getDayName(toDate)} {formatDate(toDate)}
            </p>
          </div>

          {/* Report Table — grouped by category */}
          <div className="px-8 pb-6">
            <div className="mobile-scroll-x">
            <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#E6F2FF' }}>
                  <th className="px-3 py-2 text-left font-bold text-slate-800 border border-slate-700">Part no.</th>
                  <th className="px-3 py-2 text-left font-bold text-slate-800 border border-slate-700">Details</th>
                  <th className="px-3 py-2 text-right font-bold text-slate-800 border border-slate-700">Qty</th>
                  <th className="px-3 py-2 text-right font-bold text-slate-800 border border-slate-700">Amount GHC</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={4} className="px-3 py-8 text-center text-slate-400 border border-slate-700">No sold items found in the selected date range</td></tr>
                ) : (
                  Object.entries(grouped).map(([group, items]) => (
                    <GroupRows key={group} group={group} items={items} formatNum={formatNum} />
                  ))
                )}
              </tbody>
              {filtered.length > 0 && (
                <tfoot>
                  <tr style={{ backgroundColor: '#E6F2FF' }}>
                    <td className="px-3 py-2 font-bold text-slate-900 border border-slate-700" colSpan={2}>TOTAL</td>
                    <td className="px-3 py-2 text-right font-bold text-slate-900 border border-slate-700">{totals.qty}</td>
                    <td className="px-3 py-2 text-right font-bold text-slate-900 border border-slate-700">{formatNum(totals.amount)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Group rows component - renders a category header row followed by item rows
function GroupRows({ group, items, formatNum }: { group: string; items: SoldItem[]; formatNum: (n: number) => string }) {
  let rowIdx = 0;
  return (
    <>
      {/* Category header row */}
      <tr style={{ backgroundColor: '#F0F0F0' }}>
        <td className="px-3 py-2 font-bold text-slate-800 border border-slate-700" colSpan={4}>{group}</td>
      </tr>
      {/* Item rows */}
      {items.map((item) => {
        const bg = rowIdx % 2 === 0 ? '#FFFFFF' : '#F9F9F9';
        rowIdx++;
        return (
          <tr key={item.id} style={{ backgroundColor: bg }}>
            <td className="px-3 py-1.5 text-slate-800 border border-slate-700 font-mono">{item.partNo}</td>
            <td className="px-3 py-1.5 text-slate-800 border border-slate-700">{item.details}</td>
            <td className="px-3 py-1.5 text-right text-slate-800 border border-slate-700">{item.qty}</td>
            <td className="px-3 py-1.5 text-right font-semibold text-slate-800 border border-slate-700">{formatNum(item.amount)}</td>
          </tr>
        );
      })}
    </>
  );
}
