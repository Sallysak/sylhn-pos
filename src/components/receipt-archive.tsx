"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Search, Printer, RefreshCw, X, FileText,
  Calendar, Filter, DollarSign, ShoppingCart, Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { COMPANY, formatGHS } from "@/lib/pos-data";
import { useToast } from "@/hooks/use-toast";

interface ReceiptItem {
  id: string;
  sku: string;
  name: string;
  price: number;
  quantity: number;
  discount: number;
  total: number;
}

interface Receipt {
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
  items: ReceiptItem[];
}

interface ReceiptArchiveProps {
  onBack: () => void;
}

export function ReceiptArchive({ onBack }: ReceiptArchiveProps) {
  const { toast } = useToast();
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchReceipts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "500" });
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      const res = await fetch(`/api/sales?${params}`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setReceipts(data.sales || []);
      }
    } catch (e) {
      console.warn("Failed to fetch receipts:", e);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    fetchReceipts();
  }, [fetchReceipts, refreshKey]);

  // ===== Filtered receipts =====
  const filtered = useMemo(() => {
    let result = receipts;
    if (statusFilter !== "all") {
      result = result.filter(r => r.status === statusFilter);
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(r =>
        r.invoiceNumber?.toLowerCase().includes(q) ||
        r.customerName?.toLowerCase().includes(q) ||
        r.cashierName?.toLowerCase().includes(q) ||
        r.paymentMethod?.toLowerCase().includes(q) ||
        r.items?.some(i => i.name?.toLowerCase().includes(q) || i.sku?.toLowerCase().includes(q))
      );
    }
    return result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [receipts, search, statusFilter]);

  // ===== Summary stats =====
  const stats = useMemo(() => {
    const completed = filtered.filter(r => r.status === "completed");
    const refunded = filtered.filter(r => r.status === "refunded");
    const totalRevenue = completed.reduce((s, r) => s + r.total, 0);
    const totalRefunded = refunded.reduce((s, r) => s + r.total, 0);
    return {
      count: filtered.length,
      completed: completed.length,
      refunded: refunded.length,
      totalRevenue,
      totalRefunded,
      netRevenue: totalRevenue - totalRefunded,
    };
  }, [filtered]);

  // ===== Print receipt =====
  const handlePrint = (receipt: Receipt) => {
    const win = window.open("", "_blank", "width=400,height=600");
    if (!win) {
      toast({ title: "Popup blocked", description: "Allow popups to print receipts", variant: "destructive" });
      return;
    }
    const date = new Date(receipt.createdAt);
    win.document.write(`
      <html><head><title>${receipt.invoiceNumber}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Courier New', monospace; padding: 15px; font-size: 11px; color: #000; }
        .header { text-align: center; margin-bottom: 10px; }
        .header h1 { font-size: 16px; font-weight: bold; }
        .header p { font-size: 10px; color: #555; }
        .divider { border-top: 1px dashed #000; margin: 8px 0; }
        .row { display: flex; justify-content: space-between; margin: 2px 0; }
        .items { margin: 8px 0; }
        .item-row { display: flex; justify-content: space-between; margin: 3px 0; font-size: 10px; }
        .item-name { flex: 1; }
        .item-qty { width: 40px; text-align: center; }
        .item-price { width: 50px; text-align: right; }
        .item-total { width: 60px; text-align: right; }
        .totals { margin-top: 8px; }
        .total-row { font-weight: bold; font-size: 13px; border-top: 2px solid #000; padding-top: 4px; margin-top: 4px; }
        .footer { text-align: center; margin-top: 15px; font-size: 10px; color: #555; }
        .status { display: inline-block; padding: 2px 8px; border-radius: 3px; font-size: 9px; font-weight: bold; }
        .status-completed { background: #d1fae5; color: #065f46; }
        .status-refunded { background: #fee2e2; color: #991b1b; }
        .status-voided { background: #fef3c7; color: #92400e; }
        @media print { body { padding: 0; } }
      </style></head><body>
      <div class="header">
        <h1>${COMPANY.name}</h1>
        <p>${COMPANY.address}</p>
        <p>Tel: ${COMPANY.contact}</p>
      </div>
      <div class="divider"></div>
      <div class="row"><span>Invoice:</span><strong>${receipt.invoiceNumber}</strong></div>
      <div class="row"><span>Date:</span><span>${date.toLocaleString('en-GB')}</span></div>
      <div class="row"><span>Cashier:</span><span>${receipt.cashierName}</span></div>
      <div class="row"><span>Customer:</span><span>${receipt.customerName || 'Walk-in'}</span></div>
      <div class="row"><span>Payment:</span><span>${receipt.paymentMethod.toUpperCase()}</span></div>
      <div class="row"><span>Status:</span><span class="status status-${receipt.status}">${receipt.status.toUpperCase()}</span></div>
      <div class="divider"></div>
      <div class="items">
        <div class="item-row" style="font-weight:bold;border-bottom:1px solid #000;padding-bottom:3px;">
          <span class="item-name">Item</span>
          <span class="item-qty">Qty</span>
          <span class="item-price">Price</span>
          <span class="item-total">Total</span>
        </div>
        ${receipt.items.map(i => `
          <div class="item-row">
            <span class="item-name">${i.name}</span>
            <span class="item-qty">${i.quantity}</span>
            <span class="item-price">${formatGHS(i.price)}</span>
            <span class="item-total">${formatGHS(i.total)}</span>
          </div>
        `).join("")}
      </div>
      <div class="divider"></div>
      <div class="totals">
        <div class="row"><span>Subtotal:</span><span>${formatGHS(receipt.subtotal)}</span></div>
        ${receipt.discount > 0 ? `<div class="row"><span>Discount:</span><span>-${formatGHS(receipt.discount)}</span></div>` : ""}
        ${receipt.taxAmount > 0 ? `<div class="row"><span>VAT:</span><span>${formatGHS(receipt.taxAmount)}</span></div>` : ""}
        <div class="row total-row"><span>TOTAL:</span><span>${formatGHS(receipt.total)}</span></div>
        <div class="row"><span>Paid:</span><span>${formatGHS(receipt.amountPaid)}</span></div>
        ${receipt.change > 0 ? `<div class="row"><span>Change:</span><span>${formatGHS(receipt.change)}</span></div>` : ""}
      </div>
      <div class="footer">
        <p>Thank you for shopping with us!</p>
        <p style="margin-top:5px;font-size:10px;color:#dc2626;font-weight:bold">Goods sold are not returnable.</p>
        <p style="margin-top:5px;font-size:9px;">This receipt was reprinted on ${new Date().toLocaleString('en-GB')}</p>
      </div>
      </body></html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 500);
  };

  // ===== Set quick date filters =====
  const setQuickFilter = (days: number) => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - days);
    setDateFrom(from.toISOString().split('T')[0]);
    setDateTo(to.toISOString().split('T')[0]);
  };

  return (
    <div className="min-h-[100dvh] bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="flex-shrink-0 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white shadow-lg sticky top-0 z-30">
        <div className="flex items-center justify-between px-3 sm:px-6 py-3">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="h-9 w-9 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-base sm:text-lg font-bold flex items-center gap-2">
                <FileText className="h-5 w-5 text-emerald-400" />
                Receipt Archive
              </h1>
              <p className="text-[10px] sm:text-xs text-slate-400">Saved receipts — filter by date and reprint anytime</p>
            </div>
          </div>
          <Button onClick={() => setRefreshKey(k => k + 1)} variant="outline" size="sm" className="bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white">
            <RefreshCw className="h-4 w-4" />
            <span className="hidden sm:inline ml-1">Refresh</span>
          </Button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-3 sm:p-6 max-w-7xl mx-auto w-full">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4">
          <div className="bg-white rounded-xl shadow-sm ring-1 ring-slate-200 p-3 sm:p-4">
            <div className="text-[10px] font-semibold text-slate-500 uppercase">Total Receipts</div>
            <div className="text-xl sm:text-2xl font-bold text-slate-800 mt-1">{stats.count}</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm ring-1 ring-slate-200 p-3 sm:p-4">
            <div className="text-[10px] font-semibold text-slate-500 uppercase">Revenue</div>
            <div className="text-xl sm:text-2xl font-bold text-emerald-600 mt-1">{formatGHS(stats.totalRevenue)}</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm ring-1 ring-slate-200 p-3 sm:p-4">
            <div className="text-[10px] font-semibold text-slate-500 uppercase">Refunded</div>
            <div className="text-xl sm:text-2xl font-bold text-rose-600 mt-1">{formatGHS(stats.totalRefunded)}</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm ring-1 ring-slate-200 p-3 sm:p-4">
            <div className="text-[10px] font-semibold text-slate-500 uppercase">Net Revenue</div>
            <div className="text-xl sm:text-2xl font-bold text-blue-600 mt-1">{formatGHS(stats.netRevenue)}</div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 p-4 mb-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4 text-slate-400" />
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="h-9 px-2 text-xs border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-400"
              />
              <span className="text-xs text-slate-400">to</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="h-9 px-2 text-xs border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-400"
              />
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setQuickFilter(0)} className="h-9 px-2 text-[10px] font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700">Today</button>
              <button onClick={() => setQuickFilter(7)} className="h-9 px-2 text-[10px] font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700">7d</button>
              <button onClick={() => setQuickFilter(30)} className="h-9 px-2 text-[10px] font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700">30d</button>
              <button onClick={() => { setDateFrom(""); setDateTo(""); }} className="h-9 px-2 text-[10px] font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700">All</button>
            </div>
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search invoice, customer, cashier, item..."
                className="pl-9 h-9 text-xs"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 px-2 text-xs border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-400"
            >
              <option value="all">All Status</option>
              <option value="completed">Completed</option>
              <option value="refunded">Refunded</option>
              <option value="voided">Voided</option>
            </select>
          </div>
        </div>

        {/* Receipts Table */}
        <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 overflow-hidden">
          {loading ? (
            <div className="text-center py-16 text-slate-400 text-sm">
              <RefreshCw className="h-8 w-8 mx-auto mb-2 animate-spin opacity-40" />
              Loading receipts...
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-slate-400 text-sm">
              <FileText className="h-8 w-8 mx-auto mb-2 opacity-40" />
              No receipts found. Try adjusting your filters.
            </div>
          ) : (
            <div className="mobile-scroll-x">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="text-left py-3 px-3 font-semibold text-slate-600">Invoice</th>
                    <th className="text-left py-3 px-3 font-semibold text-slate-600">Date & Time</th>
                    <th className="text-left py-3 px-3 font-semibold text-slate-600">Customer</th>
                    <th className="text-left py-3 px-3 font-semibold text-slate-600">Cashier</th>
                    <th className="text-center py-3 px-3 font-semibold text-slate-600">Items</th>
                    <th className="text-left py-3 px-3 font-semibold text-slate-600">Payment</th>
                    <th className="text-right py-3 px-3 font-semibold text-slate-600">Total</th>
                    <th className="text-center py-3 px-3 font-semibold text-slate-600">Status</th>
                    <th className="text-center py-3 px-3 font-semibold text-slate-600">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(r => (
                    <tr
                      key={r.id}
                      onClick={() => setSelectedReceipt(r)}
                      className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition"
                    >
                      <td className="py-2.5 px-3 font-mono font-semibold text-slate-800">{r.invoiceNumber}</td>
                      <td className="py-2.5 px-3 text-slate-600">
                        {new Date(r.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                        <span className="text-slate-400 ml-1">{new Date(r.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">{r.customerName || "Walk-in"}</td>
                      <td className="py-2.5 px-3 text-slate-600">{r.cashierName}</td>
                      <td className="py-2.5 px-3 text-center text-slate-600">{r.items?.length || 0}</td>
                      <td className="py-2.5 px-3 text-slate-600 capitalize">{r.paymentMethod}</td>
                      <td className="py-2.5 px-3 text-right font-bold text-emerald-600">{formatGHS(r.total)}</td>
                      <td className="py-2.5 px-3 text-center">
                        <Badge className={cn("text-[9px]",
                          r.status === "completed" ? "bg-emerald-100 text-emerald-700" :
                          r.status === "refunded" ? "bg-rose-100 text-rose-700" :
                          r.status === "voided" ? "bg-amber-100 text-amber-700" :
                          "bg-slate-100 text-slate-600"
                        )}>{r.status}</Badge>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <button
                          onClick={(e) => { e.stopPropagation(); handlePrint(r); }}
                          className="h-7 w-7 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 flex items-center justify-center mx-auto transition"
                          title="Print receipt"
                        >
                          <Printer className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Receipt Detail Modal */}
      <AnimatePresence>
        {selectedReceipt && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-0 sm:p-4"
            onClick={() => setSelectedReceipt(null)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col"
            >
              <div className="flex-shrink-0 px-5 py-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white flex items-center justify-between">
                <div>
                  <div className="text-xs text-white/80">Receipt</div>
                  <div className="font-bold font-mono">{selectedReceipt.invoiceNumber}</div>
                </div>
                <button onClick={() => setSelectedReceipt(null)} className="h-8 w-8 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <ScrollArea className="flex-1 overflow-y-auto">
                <div className="p-5 space-y-4">
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <div className="text-slate-400 font-semibold uppercase text-[9px]">Date</div>
                      <div className="text-slate-800">{new Date(selectedReceipt.createdAt).toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-slate-400 font-semibold uppercase text-[9px]">Cashier</div>
                      <div className="text-slate-800">{selectedReceipt.cashierName}</div>
                    </div>
                    <div>
                      <div className="text-slate-400 font-semibold uppercase text-[9px]">Customer</div>
                      <div className="text-slate-800">{selectedReceipt.customerName || "Walk-in"}</div>
                    </div>
                    <div>
                      <div className="text-slate-400 font-semibold uppercase text-[9px]">Payment</div>
                      <div className="text-slate-800 capitalize">{selectedReceipt.paymentMethod}</div>
                    </div>
                    <div>
                      <div className="text-slate-400 font-semibold uppercase text-[9px]">Status</div>
                      <Badge className={cn("text-[9px]",
                        selectedReceipt.status === "completed" ? "bg-emerald-100 text-emerald-700" :
                        selectedReceipt.status === "refunded" ? "bg-rose-100 text-rose-700" :
                        "bg-amber-100 text-amber-700"
                      )}>{selectedReceipt.status}</Badge>
                    </div>
                  </div>

                  <div className="border-t border-slate-200 pt-4">
                    <div className="text-xs font-bold text-slate-700 uppercase mb-2">Items ({selectedReceipt.items?.length || 0})</div>
                    <div className="space-y-2">
                      {selectedReceipt.items?.map((item, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs">
                          <div className="flex-1">
                            <div className="font-semibold text-slate-800">{item.name}</div>
                            <div className="text-[10px] text-slate-500">{item.quantity} × {formatGHS(item.price)}{item.discount > 0 ? ` (−${item.discount}%)` : ""}</div>
                          </div>
                          <div className="font-mono font-bold text-slate-800">{formatGHS(item.total)}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="border-t border-slate-200 pt-4 space-y-1 text-xs">
                    <div className="flex justify-between"><span className="text-slate-500">Subtotal</span><span className="font-mono">{formatGHS(selectedReceipt.subtotal)}</span></div>
                    {selectedReceipt.discount > 0 && <div className="flex justify-between"><span className="text-slate-500">Discount</span><span className="font-mono text-rose-600">−{formatGHS(selectedReceipt.discount)}</span></div>}
                    {selectedReceipt.taxAmount > 0 && <div className="flex justify-between"><span className="text-slate-500">VAT</span><span className="font-mono">{formatGHS(selectedReceipt.taxAmount)}</span></div>}
                    <div className="flex justify-between text-sm font-bold pt-2 border-t border-slate-200"><span className="text-slate-800">Total</span><span className="font-mono text-emerald-600">{formatGHS(selectedReceipt.total)}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Paid</span><span className="font-mono">{formatGHS(selectedReceipt.amountPaid)}</span></div>
                    {selectedReceipt.change > 0 && <div className="flex justify-between"><span className="text-slate-500">Change</span><span className="font-mono">{formatGHS(selectedReceipt.change)}</span></div>}
                  </div>
                </div>
              </ScrollArea>

              <div className="flex-shrink-0 px-5 py-3 bg-slate-50 border-t border-slate-200 flex gap-2">
                <Button onClick={() => handlePrint(selectedReceipt)} className="flex-1 bg-blue-600 hover:bg-blue-700">
                  <Printer className="h-4 w-4" /> Print Receipt
                </Button>
                <Button onClick={() => setSelectedReceipt(null)} variant="outline" className="flex-1">
                  Close
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
