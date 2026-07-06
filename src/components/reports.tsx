"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, FileText, Eye, Trash2, Printer, FileSpreadsheet,
  FileType2, Download, Search, X, Clock, User, CheckCircle2,
  FileBarChart, FileSearch, Calendar, TrendingUp
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { COMPANY, formatGHS, type Product, type StockGroup, type StockHistoryEntry } from "@/lib/pos-data";
import { reportTypes, generateReport, exportReportToPDF, exportReportToExcel, exportReportToCSV, printReport } from "@/lib/report-utils";
import type { SavedReport, ReportData } from "@/lib/pos-types";

interface ReportsProps {
  onBack: () => void;
  products: Product[];
  groups: StockGroup[];
  history: StockHistoryEntry[];
}

export function Reports({ onBack, products, groups, history }: ReportsProps) {
  const [search, setSearch] = useState("");
  const [savedReports, setSavedReports] = useState<SavedReport[]>([]);
  const [viewing, setViewing] = useState<ReportData | null>(null);
  const { toast } = useToast();

  const filteredTypes = reportTypes.filter(r =>
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    r.desc.toLowerCase().includes(search.toLowerCase())
  );

  const handleGenerate = (typeId: string) => {
    const report = generateReport(typeId, products, history, groups);
    const rt = reportTypes.find(r => r.id === typeId)!;
    const saved: SavedReport = {
      id: `r-${Date.now()}`,
      type: typeId,
      title: rt.name,
      generatedAt: new Date().toISOString(),
      generatedBy: "Sarah Johnson",
      recordCount: report.rows.length,
      summary: report.summary[0]?.value || "",
    };
    setSavedReports(prev => [saved, ...prev]);
    setViewing(report);
    toast({ title: "Report generated", description: `${rt.name} with ${report.rows.length} records` });
  };

  const handleDelete = (id: string) => {
    setSavedReports(prev => prev.filter(r => r.id !== id));
    toast({ title: "Report deleted", variant: "default" });
  };

  const handlePrint = (report: ReportData) => {
    printReport(report);
    toast({ title: "Printing report..." });
  };

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-slate-50 to-emerald-50/30">
      {/* Header */}
      <header className="flex-shrink-0 bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-600 text-white shadow-lg">
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="h-9 w-9 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center ring-1 ring-white/20">
                <FileBarChart className="h-5 w-5" />
              </div>
              <div>
                <div className="font-bold text-base leading-tight">Stock Reports</div>
                <div className="text-[10px] text-emerald-100/90">{COMPANY.name}</div>
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-emerald-100/80">{COMPANY.address}</div>
            <div className="text-xs font-mono text-emerald-100">{COMPANY.contact}</div>
          </div>
        </div>
      </header>

      {/* Company Banner */}
      <div className="flex-shrink-0 bg-white border-b border-slate-200 px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-emerald-600 to-teal-600 flex items-center justify-center text-white font-bold text-lg">
              S
            </div>
            <div>
              <div className="font-bold text-slate-800 text-base">{COMPANY.name}</div>
              <div className="text-xs text-slate-500">Contact: {COMPANY.contact} · {COMPANY.address}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">{reportTypes.length} Report Types</Badge>
            <Badge variant="secondary" className="text-xs bg-emerald-100 text-emerald-700">{savedReports.length} Generated</Badge>
          </div>
        </div>
      </div>

      <main className="flex-1 overflow-hidden p-6 grid grid-cols-3 gap-4">
        {/* Left: Report Types */}
        <div className="col-span-2 bg-white rounded-2xl shadow-lg ring-1 ring-slate-200/60 overflow-hidden flex flex-col">
          <div className="flex-shrink-0 flex items-center justify-between px-5 py-3 bg-gradient-to-r from-slate-50 to-white border-b border-slate-200">
            <div className="flex items-center gap-2">
              <FileSearch className="h-5 w-5 text-emerald-600" />
              <h2 className="text-base font-bold text-slate-800">Available Reports</h2>
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search reports..." className="h-9 pl-8 pr-3 rounded-lg bg-slate-100 text-sm outline-none focus:ring-2 focus:ring-emerald-300 w-56" />
            </div>
          </div>

          <ScrollArea className="flex-1">
            <div className="grid grid-cols-2 gap-3 p-4">
              {filteredTypes.map(rt => (
                <motion.button
                  key={rt.id}
                  whileHover={{ y: -2, scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => handleGenerate(rt.id)}
                  className="group flex items-start gap-3 p-4 bg-white rounded-xl ring-1 ring-slate-200 hover:ring-emerald-400 hover:shadow-md transition text-left"
                >
                  <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-100 flex items-center justify-center text-2xl group-hover:scale-110 transition">
                    {rt.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-slate-800 text-sm">{rt.name}</div>
                    <div className="text-xs text-slate-500 mt-0.5 line-clamp-2">{rt.desc}</div>
                    <div className="flex items-center gap-1 mt-2 text-[10px] text-emerald-600 font-semibold">
                      <Eye className="h-3 w-3" />
                      Click to view & export
                    </div>
                  </div>
                </motion.button>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Right: Saved Reports */}
        <div className="bg-white rounded-2xl shadow-lg ring-1 ring-slate-200/60 overflow-hidden flex flex-col">
          <div className="flex-shrink-0 flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-slate-50 to-white border-b border-slate-200">
            <Clock className="h-5 w-5 text-emerald-600" />
            <h2 className="text-base font-bold text-slate-800">Generated Reports</h2>
            <Badge variant="outline" className="ml-auto text-xs">{savedReports.length}</Badge>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-3 space-y-2">
              {savedReports.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                  <FileText className="h-10 w-10 mb-2 opacity-40" />
                  <div className="text-sm font-medium">No reports yet</div>
                  <div className="text-xs mt-1">Generate one to get started</div>
                </div>
              ) : (
                savedReports.map(r => (
                  <motion.div
                    key={r.id}
                    layout
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition group"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-slate-800 text-sm truncate">{r.title}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{r.id}</div>
                      </div>
                      <Badge variant="secondary" className="text-[10px] ml-2">{r.recordCount} rows</Badge>
                    </div>
                    <div className="text-[10px] text-slate-500 mb-2">
                      {new Date(r.generatedAt).toLocaleString('en-GB')} · {r.generatedBy}
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => setViewing(generateReport(r.type, products, history, groups))}
                        className="flex-1 h-7 rounded-md bg-blue-100 text-blue-600 hover:bg-blue-200 text-[10px] font-semibold flex items-center justify-center gap-1 transition"
                      >
                        <Eye className="h-3 w-3" /> View
                      </button>
                      <button
                        onClick={() => { printReport(generateReport(r.type, products, history, groups)); toast({ title: "Printing..." }); }}
                        className="flex-1 h-7 rounded-md bg-slate-200 text-slate-700 hover:bg-slate-300 text-[10px] font-semibold flex items-center justify-center gap-1 transition"
                      >
                        <Printer className="h-3 w-3" /> Print
                      </button>
                      <button
                        onClick={() => handleDelete(r.id)}
                        className="flex-1 h-7 rounded-md bg-rose-100 text-rose-600 hover:bg-rose-200 text-[10px] font-semibold flex items-center justify-center gap-1 transition"
                      >
                        <Trash2 className="h-3 w-3" /> Delete
                      </button>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      </main>

      {/* Report Viewer Modal */}
      <AnimatePresence>
        {viewing && (
          <ReportViewer
            report={viewing}
            onClose={() => setViewing(null)}
            onPrint={() => handlePrint(viewing)}
            onPDF={() => { exportReportToPDF(viewing); toast({ title: "PDF exported" }); }}
            onExcel={() => { exportReportToExcel(viewing); toast({ title: "Excel exported" }); }}
            onCSV={() => { exportReportToCSV(viewing); toast({ title: "CSV exported" }); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ===== Report Viewer =====
function ReportViewer({ report, onClose, onPrint, onPDF, onExcel, onCSV }: {
  report: ReportData;
  onClose: () => void;
  onPrint: () => void;
  onPDF: () => void;
  onExcel: () => void;
  onCSV: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[92vh] overflow-hidden flex flex-col"
      >
        {/* Company Header */}
        <div className="flex-shrink-0 px-6 py-4 bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-600 text-white">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center text-2xl font-bold ring-1 ring-white/20">
                S
              </div>
              <div>
                <div className="text-xl font-bold tracking-tight">{COMPANY.name}</div>
                <div className="text-xs text-emerald-100/90 mt-0.5">
                  Contact: {COMPANY.contact} &nbsp;·&nbsp; Address: {COMPANY.address}
                </div>
              </div>
            </div>
            <button onClick={onClose} className="h-9 w-9 rounded-lg bg-white/15 hover:bg-white/25 flex items-center justify-center transition">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Report Header */}
        <div className="flex-shrink-0 px-6 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div>
            <div className="text-lg font-bold text-slate-800">{report.title}</div>
            <div className="text-xs text-slate-500">{report.subtitle}</div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              <Calendar className="h-3 w-3 mr-1" />
              {new Date().toLocaleString('en-GB')}
            </Badge>
            <Badge variant="outline" className="text-xs">
              <User className="h-3 w-3 mr-1" />
              Sarah Johnson
            </Badge>
            <Badge variant="secondary" className="text-xs bg-emerald-100 text-emerald-700">
              {report.rows.length} records
            </Badge>
          </div>
        </div>

        {/* Export Toolbar */}
        <div className="flex-shrink-0 px-6 py-2.5 bg-white border-b border-slate-200 flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide mr-2">Export:</span>
          <button onClick={onPrint} className="h-8 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition">
            <Printer className="h-3.5 w-3.5" /> Print
          </button>
          <button onClick={onPDF} className="h-8 px-3 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-1.5 transition">
            <FileType2 className="h-3.5 w-3.5" /> PDF
          </button>
          <button onClick={onExcel} className="h-8 px-3 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-700 text-xs font-semibold flex items-center gap-1.5 transition">
            <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
          </button>
          <button onClick={onCSV} className="h-8 px-3 rounded-lg bg-blue-100 hover:bg-blue-200 text-blue-700 text-xs font-semibold flex items-center gap-1.5 transition">
            <Download className="h-3.5 w-3.5" /> CSV
          </button>
          <div className="ml-auto flex items-center gap-1 text-[10px] text-slate-400">
            <CheckCircle2 className="h-3 w-3 text-emerald-500" />
            All prices in Ghana Cedis (GHS)
          </div>
        </div>

        {/* Table */}
        <ScrollArea className="flex-1">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-slate-800 text-white text-[11px] uppercase tracking-wide z-10">
              <tr>
                {report.columns.map(col => (
                  <th key={col.key} className={cn("px-3 py-2.5 font-semibold", col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left")}>
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {report.rows.map((row, i) => (
                <tr key={i} className={cn("hover:bg-emerald-50/50 transition", i % 2 === 1 && "bg-slate-50/50")}>
                  {report.columns.map(col => {
                    const val = row[col.key];
                    const display = col.format ? col.format(val, row) : (val ?? "");
                    return (
                      <td key={col.key} className={cn("px-3 py-2", col.align === "right" ? "text-right font-mono" : col.align === "center" ? "text-center" : "text-left")}>
                        {display}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollArea>

        {/* Summary Footer */}
        <div className="flex-shrink-0 px-6 py-3 bg-gradient-to-r from-emerald-50 to-teal-50 border-t border-emerald-200">
          <div className="text-xs font-bold text-emerald-800 uppercase tracking-wide mb-2">Summary</div>
          <div className="grid grid-cols-4 gap-3">
            {report.summary.map((s, i) => (
              <div key={i} className="bg-white rounded-lg px-3 py-2 ring-1 ring-emerald-100">
                <div className="text-[10px] text-slate-500 uppercase">{s.label}</div>
                <div className="text-sm font-bold text-emerald-700 font-mono">{s.value}</div>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
