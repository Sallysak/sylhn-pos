"use client";

import { useState, useEffect, useCallback, useMemo, type ReactNode } from "react";
import {
  ArrowLeft, Calendar, Printer, FileText, Download, FileBarChart2,
  Loader2, RefreshCw, TrendingUp, Package,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { COMPANY, CURRENCY } from "@/lib/pos-data";

interface SoldItemRow {
  id: string;
  date: string;
  invoiceNumber: string;
  partNo: string;
  details: string;
  qty: number;
  amount: number;
  unitPrice: number;
  category: string;
  emoji: string;
  cashier: string;
  customer: string;
}

interface SoldItemsResponse {
  rows: SoldItemRow[];
  summary: {
    totalRows: number;
    totalQty: number;
    totalAmount: number;
    uniqueProducts: number;
    uniqueCategories: number;
  };
  byCategory: Array<{ category: string; qty: number; amount: number; count: number }>;
  byProduct: Array<{ key: string; name: string; sku: string; emoji: string; qty: number; amount: number; count: number }>;
}

function todayISO() { return new Date().toISOString().split("T")[0]; }
function fmtDate(iso: string) { const [y, m, d] = iso.split("-"); return `${parseInt(m)}/${parseInt(d)}/${y}`; }
function fmtDateOnly(iso: string) { try { return new Date(iso).toISOString().split("T")[0]; } catch { return ""; } }

interface SoldItemsReportProps {
  onBack: () => void;
}

export function SoldItemsReport({ onBack }: SoldItemsReportProps) {
  const today = todayISO();
  const monthAgo = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0];
  })();
  const [fromDate, setFromDate] = useState(monthAgo);
  const [toDate, setToDate] = useState(today);
  const [data, setData] = useState<SoldItemsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"detail" | "byCategory" | "byProduct">("detail");
  const { toast } = useToast();

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = `/api/reports/sold-items?dateFrom=${fromDate}T00:00:00.000Z&dateTo=${toDate}T23:59:59.999Z`;
      const res = await fetch(url, { credentials: "include" });
      const d = await res.json();
      if (res.ok) setData(d);
      else setError(d.error || "Failed to fetch");
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  const rows = useMemo(() => data?.rows || [], [data]);

  const totals = useMemo(() => ({
    qty: rows.reduce((s, r) => s + r.qty, 0),
    amount: rows.reduce((s, r) => s + r.amount, 0),
    count: rows.length,
  }), [rows]);

  const handlePrint = () => {
    const printWin = window.open('', '_blank', 'width=900,height=600');
    if (!printWin) return;
    const rowsHtml = rows.map((t, i) => `<tr style="background:${i % 2 === 1 ? '#F8F8F8' : '#FFF'}"><td style="border:1px solid #999;padding:3px 6px">${fmtDateOnly(t.date)}</td><td style="border:1px solid #999;padding:3px 6px">${t.invoiceNumber}</td><td style="border:1px solid #999;padding:3px 6px">${t.partNo}</td><td style="border:1px solid #999;padding:3px 6px">${t.details}</td><td style="border:1px solid #999;padding:3px 6px">${t.category}</td><td style="border:1px solid #999;padding:3px 6px;text-align:right">${t.qty}</td><td style="border:1px solid #999;padding:3px 6px;text-align:right">${t.unitPrice.toFixed(2)}</td><td style="border:1px solid #999;padding:3px 6px;text-align:right">${t.amount.toFixed(2)}</td></tr>`).join('');
    printWin.document.write(`<!DOCTYPE html><html><head><title>Sold Items Report</title><style>body{font-family:Arial;margin:20px}h1{text-align:center;font-size:18px}table{width:100%;border-collapse:collapse;font-size:10px}th{background:#E6E6FA;border:1px solid #999;padding:4px 6px}@media print{thead{display:table-header-group}tr{page-break-inside:avoid}}</style></head><body><div style="text-align:center;border-bottom:2px solid #333;padding-bottom:10px"><h1>${COMPANY.name}</h1><div style="font-size:12px;color:#666">${COMPANY.address} · ${COMPANY.contact}</div></div><h1>Sold Items Report</h1><p style="text-align:center;font-size:11px">For The Period ${fmtDate(fromDate)} - ${fmtDate(toDate)}</p><table><thead><tr><th>Date</th><th>Invoice</th><th>Part No</th><th>Details</th><th>Category</th><th style="text-align:right">Qty</th><th style="text-align:right">Unit</th><th style="text-align:right">Total GHC</th></tr></thead><tbody>${rowsHtml}</tbody></table><p style="text-align:right;font-weight:bold;margin-top:10px">Total Qty: ${totals.qty} · Total Amount: GHC ${totals.amount.toFixed(2)}</p></body></html>`);
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
        doc.setFontSize(13); doc.setFont("helvetica", "bold"); doc.text("Sold Items Report", pw / 2, 34, { align: "center" });
        doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.text(`For The Period ${fmtDate(fromDate)} - ${fmtDate(toDate)}`, pw / 2, 39, { align: "center" });
        autoTable(doc, {
          head: [["Date", "Invoice", "Part No", "Details", "Category", "Qty", "Unit GHC", "Total GHC"]],
          body: rows.map(t => [fmtDateOnly(t.date), t.invoiceNumber, t.partNo, t.details, t.category, String(t.qty), t.unitPrice.toFixed(2), t.amount.toFixed(2)]),
          startY: 44, styles: { fontSize: 7, cellPadding: 1.5, lineColor: [0, 0, 0], lineWidth: 0.3 },
          headStyles: { fillColor: [230, 230, 250], textColor: 0, fontStyle: "bold" },
          foot: [["", "", "", "", "TOTAL", String(totals.qty), "", totals.amount.toFixed(2)]],
          footStyles: { fillColor: [230, 230, 250], textColor: 0, fontStyle: "bold" },
        });
        doc.save(`sold-items-${todayISO()}.pdf`);
        toast({ title: "PDF exported" });
      });
    });
  };

  const handleExcel = () => {
    import("xlsx").then((XLSX) => {
      const data = [[COMPANY.name], ["Sold Items Report"], [`For The Period ${fmtDate(fromDate)} - ${fmtDate(toDate)}`], [], ["Date", "Invoice", "Part No", "Details", "Category", "Qty", "Unit GHC", "Total GHC"]];
      rows.forEach(t => data.push([fmtDateOnly(t.date), t.invoiceNumber, t.partNo, t.details, t.category, String(t.qty), t.unitPrice.toFixed(2), t.amount.toFixed(2)]));
      data.push(["", "", "", "", "TOTAL", String(totals.qty), "", totals.amount.toFixed(2)]);
      const ws = XLSX.utils.aoa_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Sold Items");
      XLSX.writeFile(wb, `sold-items-${todayISO()}.xlsx`);
      toast({ title: "Excel exported" });
    });
  };

  return (
    <div className="h-screen flex flex-col bg-slate-100 dark:bg-slate-950">
      <header className="flex-shrink-0 bg-gradient-to-r from-violet-700 to-fuchsia-600 text-white shadow-lg px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={onBack} className="h-9 w-9 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition active:scale-90"><ArrowLeft className="h-4 w-4" /></button>
          <FileBarChart2 className="h-5 w-5 flex-shrink-0" />
          <div className="min-w-0">
            <div className="text-sm font-bold truncate">Sold Items Report</div>
            <div className="text-[10px] text-violet-100/80 truncate">{COMPANY.name}</div>
          </div>
        </div>
      </header>

      {/* Filter + actions bar */}
      <div className="no-print flex-shrink-0 px-4 py-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 space-y-2">
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <Calendar className="h-3.5 w-3.5 text-slate-400" />
          <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-300">From:</span>
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="h-8 px-2 text-xs border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded-lg bg-white outline-none" />
          <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-300">To:</span>
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="h-8 px-2 text-xs border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded-lg bg-white outline-none" />
          <div className="flex items-center gap-2 ml-auto">
            <Button variant="outline" size="sm" onClick={fetchReport} disabled={loading}>
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} /> Refresh
            </Button>
            <button onClick={handlePrint} className="h-8 px-3 rounded-lg bg-slate-100 dark:bg-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 text-xs font-semibold flex items-center gap-1.5"><Printer className="h-3.5 w-3.5" /> Print</button>
            <button onClick={handlePDF} className="h-8 px-3 rounded-lg bg-rose-100 dark:bg-rose-900/30 dark:text-rose-300 hover:bg-rose-200 dark:hover:bg-rose-900/50 text-rose-700 text-xs font-semibold flex items-center gap-1.5"><FileText className="h-3.5 w-3.5" /> PDF</button>
            <button onClick={handleExcel} className="h-8 px-3 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-900/50 text-emerald-700 text-xs font-semibold flex items-center gap-1.5"><Download className="h-3.5 w-3.5" /> Excel</button>
          </div>
        </div>
        {/* View toggle */}
        <div className="flex items-center gap-1 text-xs">
          {(["detail", "byCategory", "byProduct"] as const).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn(
                "px-3 py-1.5 rounded-lg font-semibold transition",
                view === v
                  ? "bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300"
                  : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              )}
            >
              {v === "detail" ? "Detail" : v === "byCategory" ? "By Category" : "By Product"}
            </button>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      <div className="no-print flex-shrink-0 px-4 py-3 grid grid-cols-2 md:grid-cols-4 gap-2">
        <SummaryCard label="Total Items Sold" value={totals.qty.toString()} icon={<Package className="h-4 w-4" />} accent="emerald" />
        <SummaryCard label="Total Revenue" value={`${CURRENCY}${totals.amount.toFixed(2)}`} icon={<TrendingUp className="h-4 w-4" />} accent="blue" />
        <SummaryCard label="Unique Products" value={(data?.summary.uniqueProducts ?? 0).toString()} icon={<FileBarChart2 className="h-4 w-4" />} accent="amber" />
        <SummaryCard label="Categories" value={(data?.summary.uniqueCategories ?? 0).toString()} icon={<FileBarChart2 className="h-4 w-4" />} accent="violet" />
      </div>

      {error && (
        <div className="m-4 p-3 rounded-lg bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-300 text-xs">
          {error} — <button onClick={fetchReport} className="underline">retry</button>
        </div>
      )}

      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          {loading ? (
            <div className="text-center py-16 text-slate-400 text-sm">
              <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" /> Loading sold items…
            </div>
          ) : rows.length === 0 ? (
            <div className="text-center py-16 text-slate-400 text-sm">
              <FileBarChart2 className="h-10 w-10 mx-auto mb-3 opacity-30" />
              No sold items in this period
            </div>
          ) : view === "detail" ? (
            <div className="mobile-scroll-x">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-slate-800 dark:bg-slate-900 dark:border-b dark:border-slate-700 text-white text-[10px] uppercase z-10">
                  <tr>
                    <th className="text-left px-3 py-2 font-semibold">Date</th>
                    <th className="text-left px-3 py-2 font-semibold">Invoice</th>
                    <th className="text-left px-3 py-2 font-semibold">Part No</th>
                    <th className="text-left px-3 py-2 font-semibold">Details</th>
                    <th className="text-left px-3 py-2 font-semibold">Category</th>
                    <th className="text-right px-3 py-2 font-semibold">Qty</th>
                    <th className="text-right px-3 py-2 font-semibold">Unit GHC</th>
                    <th className="text-right px-3 py-2 font-semibold">Total GHC</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 dark:bg-slate-950">
                  {rows.map(t => (
                    <tr key={t.id} className="hover:bg-violet-50/50 dark:hover:bg-slate-800/50">
                      <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{fmtDateOnly(t.date)}</td>
                      <td className="px-3 py-2 font-mono text-slate-700 dark:text-slate-200">{t.invoiceNumber}</td>
                      <td className="px-3 py-2 font-mono text-slate-500 dark:text-slate-400">{t.partNo}</td>
                      <td className="px-3 py-2 text-slate-800 dark:text-slate-100">
                        <span className="mr-1">{t.emoji}</span>{t.details}
                      </td>
                      <td className="px-3 py-2"><Badge variant="outline" className="text-[9px]">{t.category}</Badge></td>
                      <td className="px-3 py-2 text-right font-mono text-slate-700 dark:text-slate-200">{t.qty}</td>
                      <td className="px-3 py-2 text-right font-mono text-slate-500 dark:text-slate-400">{t.unitPrice.toFixed(2)}</td>
                      <td className="px-3 py-2 text-right font-mono font-semibold text-slate-800 dark:text-slate-100">{t.amount.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-100 dark:bg-slate-800 sticky bottom-0">
                  <tr>
                    <td colSpan={5} className="px-3 py-2 font-bold text-slate-900 dark:text-white">TOTAL</td>
                    <td className="px-3 py-2 text-right font-mono font-bold text-slate-900 dark:text-white">{totals.qty}</td>
                    <td></td>
                    <td className="px-3 py-2 text-right font-mono font-bold text-slate-900 dark:text-white">{totals.amount.toFixed(2)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : view === "byCategory" ? (
            <div className="p-4 space-y-3">
              {data?.byCategory.map(cat => (
                <div key={cat.category} className="bg-white dark:bg-slate-900 rounded-xl ring-1 ring-slate-200 dark:ring-slate-800 overflow-hidden">
                  <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white">{cat.category}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">{cat.count} line items · {cat.qty} units</div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-emerald-700 dark:text-emerald-400 font-mono">{CURRENCY}{cat.amount.toFixed(2)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 space-y-2">
              {data?.byProduct.map(prod => (
                <div key={prod.key} className="bg-white dark:bg-slate-900 rounded-xl ring-1 ring-slate-200 dark:ring-slate-800 p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{prod.emoji}</span>
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white">{prod.name}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">{prod.sku}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-6 text-sm">
                    <div className="text-center">
                      <div className="text-xs text-slate-500">Qty</div>
                      <div className="font-mono font-bold text-slate-900 dark:text-white">{prod.qty}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-slate-500">Sales</div>
                      <div className="font-mono text-slate-700 dark:text-slate-300">{prod.count}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-slate-500">Revenue</div>
                      <div className="font-mono font-bold text-emerald-700 dark:text-emerald-400">{CURRENCY}{prod.amount.toFixed(2)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, icon, accent }: { label: string; value: string; icon: ReactNode; accent: "emerald" | "blue" | "amber" | "violet" }) {
  const colors = {
    emerald: "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 ring-emerald-200 dark:ring-emerald-800",
    blue: "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 ring-blue-200 dark:ring-blue-800",
    amber: "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 ring-amber-200 dark:ring-amber-800",
    violet: "bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-400 ring-violet-200 dark:ring-violet-800",
  };
  return (
    <div className={cn("rounded-xl p-3 ring-1 flex items-center gap-3", colors[accent])}>
      <div className="opacity-80">{icon}</div>
      <div>
        <div className="text-[9px] uppercase tracking-wider opacity-90">{label}</div>
        <div className="text-lg font-bold">{value}</div>
      </div>
    </div>
  );
}
