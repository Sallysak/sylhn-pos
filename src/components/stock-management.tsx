"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Package, Plus, Edit2, Trash2, Search, Layers, Settings2, History,
  ArrowLeft, Save, X, TrendingUp, AlertTriangle, CheckCircle2, Boxes,
  Filter, ChevronRight, Calendar, User, Tag, DollarSign, Barcode,
  ArrowUpDown, ArrowUp, ArrowDown, RotateCcw,
  FileText, Copy, Image as ImageIcon, Tags, FileSearch, FolderTree, SlidersHorizontal,
  Monitor, Printer, Folder, FileBarChart, Download, Mail, MessageSquare, Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  COMPANY, CURRENCY, formatGHS, stockGroups, products as ALL_PRODUCTS,
  initialStockHistory, type Product, type StockGroup, type StockHistoryEntry,
} from "@/lib/pos-data";
import { generateReport, exportReportToPDF, exportReportToExcel, exportReportToCSV, printReport } from "@/lib/report-utils";
import type { StockView, ReportData } from "@/lib/pos-types";
import { PopupWindow } from "@/components/popup-window";
import { StockQuantityAdjustment } from "@/components/stock-quantity-adjustment";

interface StockManagementProps {
  onBack: () => void;
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  groups: StockGroup[];
  setGroups: React.Dispatch<React.SetStateAction<StockGroup[]>>;
  history: StockHistoryEntry[];
  setHistory: React.Dispatch<React.SetStateAction<StockHistoryEntry[]>>;
  initialView?: StockView;
  openQtyReport?: boolean;
  /** Called when the user wants to navigate to the Purchase menu (e.g. to create a PO from reorder suggestions) */
  onNavigateToPurchase?: () => void;
}

export function StockManagement({ onBack, products, setProducts, groups, setGroups, history, setHistory, initialView, openQtyReport, onNavigateToPurchase }: StockManagementProps) {
  const [view, setView] = useState<StockView>(initialView === "stock-file" || initialView === "stock-search" || initialView === "quantity-adjustment" ? "add-modify" : (initialView || "add-modify"));
  const [showQtyReport, setShowQtyReport] = useState(false);
  const [showStockFilePopup, setShowStockFilePopup] = useState(initialView === "stock-file");
  const [showStockSearchPopup, setShowStockSearchPopup] = useState(initialView === "stock-search");
  const [showQtyAdjustmentPopup, setShowQtyAdjustmentPopup] = useState(initialView === "quantity-adjustment");
  const [showDashboard, setShowDashboard] = useState(false);
  const { toast } = useToast();

  // ===== Stocktake schedule settings (persisted to localStorage) =====
  const SCHEDULE_KEY = 'sylhn-stocktake-schedule';
  type ScheduleFreq = 'weekly' | 'biweekly' | 'monthly' | 'quarterly';
  const [scheduleFreq, setScheduleFreq] = useState<ScheduleFreq>('weekly');
  const [scheduleDismissed, setScheduleDismissed] = useState<string>(''); // tracks which overdue date was dismissed

  // Load schedule settings from localStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const cached = window.localStorage.getItem(SCHEDULE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.freq) setScheduleFreq(parsed.freq);
        if (parsed.dismissed) setScheduleDismissed(parsed.dismissed);
      }
    } catch { /* ignore */ }
  }, []);

  // Persist schedule settings
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(SCHEDULE_KEY, JSON.stringify({ freq: scheduleFreq, dismissed: scheduleDismissed }));
    } catch { /* ignore */ }
  }, [scheduleFreq, scheduleDismissed]);

  // ===== Compute last stocktake date + overdue status =====
  const stocktakeStatus = useMemo(() => {
    // Find the most recent 'adjusted' history entry (which represents a stocktake/adjustment)
    const adjustedEntries = history.filter(h => h.action === 'adjusted');
    if (adjustedEntries.length === 0) {
      // No previous stocktake — check if the schedule says one is overdue
      const daysSinceEpoch = Math.floor((Date.now() - new Date('2026-01-01').getTime()) / (1000 * 60 * 60 * 24));
      return {
        lastDate: null,
        lastReference: null,
        isOverdue: true,
        daysOverdue: daysSinceEpoch,
        nextDueDate: new Date().toISOString().split('T')[0],
        message: 'No stocktake has been performed yet. Start your first stocktake now.',
      };
    }
    // Find the most recent timestamp
    const sorted = adjustedEntries.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    const lastEntry = sorted[0];
    const lastDate = new Date(lastEntry.timestamp);
    const now = new Date();
    const diffMs = now.getTime() - lastDate.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    // Determine the threshold based on schedule frequency
    const thresholdDays = scheduleFreq === 'weekly' ? 7 : scheduleFreq === 'biweekly' ? 14 : scheduleFreq === 'monthly' ? 30 : 90;
    const nextDueDate = new Date(lastDate.getTime() + thresholdDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const isOverdue = diffDays >= thresholdDays;
    const daysOverdue = diffDays - thresholdDays;

    return {
      lastDate: lastEntry.timestamp,
      lastReference: lastEntry.reference || null,
      isOverdue,
      daysOverdue: Math.max(0, daysOverdue),
      nextDueDate,
      message: isOverdue
        ? `Stocktake is ${daysOverdue} day(s) overdue. Last stocktake was on ${lastDate.toLocaleDateString('en-GB')}.`
        : `Next stocktake due by ${nextDueDate} (${thresholdDays - diffDays} day(s) remaining).`,
    };
  }, [history, scheduleFreq]);

  // ===== Check if the overdue banner should be shown (not dismissed for this specific due date) =====
  const showOverdueBanner = stocktakeStatus.isOverdue && scheduleDismissed !== stocktakeStatus.nextDueDate;

  // Open Qty Report modal on mount if requested via menu.
  // This is a legitimate use: the parent passes a prop to request the modal open.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (openQtyReport) setShowQtyReport(true);
  }, [openQtyReport]);
  /* eslint-enable react-hooks/set-state-in-effect */

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
                <Boxes className="h-5 w-5" />
              </div>
              <div>
                <div className="font-bold text-base leading-tight">Stock Management</div>
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

      {/* Sub Navigation — horizontally scrollable on mobile */}
      <nav className="flex-shrink-0 bg-white border-b border-slate-200 shadow-sm">
        <div className="flex items-center gap-1.5 px-3 sm:px-6 py-2 overflow-x-auto scrollbar-hide">
          {[
            { id: "stock-file-popup" as const, label: "Stock File", short: "File", icon: FileText },
            { id: "stock-search-popup" as const, label: "Stock Search", short: "Search", icon: FileSearch },
            { id: "add-modify" as const, label: "Add / Modify Stock", short: "Modify", icon: Plus },
            { id: "group-maintenance" as const, label: "Group Maintenance", short: "Groups", icon: Layers },
            { id: "quantity-adjustment" as const, label: "Quantity Adjustment", short: "Qty Adj", icon: ArrowUpDown },
            { id: "history" as const, label: "Stock History", short: "History", icon: History },
          ].map(tab => {
            const isPopupTab = tab.id === "stock-file-popup" || tab.id === "stock-search-popup" || tab.id === "quantity-adjustment";
            const isActivePopup = (tab.id === "stock-file-popup" && showStockFilePopup) || (tab.id === "stock-search-popup" && showStockSearchPopup) || (tab.id === "quantity-adjustment" && showQtyAdjustmentPopup);
            return (
              <button
                key={tab.id}
                onClick={() => {
                  if (tab.id === "stock-file-popup") setShowStockFilePopup(true);
                  else if (tab.id === "stock-search-popup") setShowStockSearchPopup(true);
                  else if (tab.id === "quantity-adjustment") setShowQtyAdjustmentPopup(true);
                  else setView(tab.id);
                }}
                className={cn(
                  "flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all whitespace-nowrap flex-shrink-0 active:scale-95",
                  (!isPopupTab && view === tab.id) || isActivePopup
                    ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md"
                    : "text-slate-600 hover:bg-slate-100 bg-slate-50"
                )}
              >
                <tab.icon className="h-4 w-4" />
                <span className="sm:hidden">{tab.short}</span>
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            );
          })}
          <div className="flex-1" />
          <button
            onClick={() => setShowQtyReport(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md hover:from-blue-700 hover:to-indigo-700"
          >
            <FileBarChart className="h-4 w-4" />
            Stock Qty Report
          </button>
          <button
            onClick={() => setShowDashboard(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md hover:from-purple-700 hover:to-pink-700"
            title="View stocktake dashboard with recent variances"
          >
            <TrendingUp className="h-4 w-4" />
            Stocktake Dashboard
          </button>
        </div>
      </nav>

      {/* ===== Stocktake Schedule Reminder Banner ===== */}
      <AnimatePresence>
        {showOverdueBanner && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="flex-shrink-0 overflow-hidden"
          >
            <div className={cn(
              "px-6 py-2.5 flex items-center gap-3 border-b",
              stocktakeStatus.isOverdue
                ? "bg-rose-50 border-rose-200"
                : "bg-amber-50 border-amber-200"
            )}>
              <div className={cn(
                "h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0",
                stocktakeStatus.isOverdue ? "bg-rose-100" : "bg-amber-100"
              )}>
                <AlertTriangle className={cn("h-4 w-4", stocktakeStatus.isOverdue ? "text-rose-600" : "text-amber-600")} />
              </div>
              <div className="flex-1 min-w-0">
                <div className={cn(
                  "text-sm font-bold",
                  stocktakeStatus.isOverdue ? "text-rose-800" : "text-amber-800"
                )}>
                  {stocktakeStatus.isOverdue ? 'Stocktake Overdue' : 'Stocktake Due Soon'}
                </div>
                <div className={cn(
                  "text-xs",
                  stocktakeStatus.isOverdue ? "text-rose-700" : "text-amber-700"
                )}>
                  {stocktakeStatus.message}
                  {stocktakeStatus.lastReference && (
                    <span className="font-mono ml-1">· Last: {stocktakeStatus.lastReference}</span>
                  )}
                </div>
              </div>
              {/* Schedule frequency selector */}
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <label className="text-[10px] font-bold text-slate-600 uppercase">Schedule:</label>
                <select
                  value={scheduleFreq}
                  onChange={(e) => {
                    setScheduleFreq(e.target.value as ScheduleFreq);
                    setScheduleDismissed(''); // reset dismissal when frequency changes
                    toast({ title: 'Schedule updated', description: `Stocktake frequency set to ${e.target.value}` });
                  }}
                  className="h-7 px-2 text-[11px] rounded-md border border-slate-300 bg-white text-slate-700 outline-none focus:ring-2 focus:ring-emerald-400 cursor-pointer"
                >
                  <option value="weekly">Weekly (7 days)</option>
                  <option value="biweekly">Bi-weekly (14 days)</option>
                  <option value="monthly">Monthly (30 days)</option>
                  <option value="quarterly">Quarterly (90 days)</option>
                </select>
              </div>
              <button
                onClick={() => setShowQtyAdjustmentPopup(true)}
                className={cn(
                  "h-7 px-3 rounded-md text-xs font-bold text-white transition flex items-center gap-1 flex-shrink-0",
                  stocktakeStatus.isOverdue ? "bg-rose-600 hover:bg-rose-700" : "bg-amber-600 hover:bg-amber-700"
                )}
              >
                <ArrowUpDown className="h-3 w-3" />
                Start Stocktake
              </button>
              <button
                onClick={() => {
                  setScheduleDismissed(stocktakeStatus.nextDueDate);
                  toast({ title: 'Reminder dismissed', description: 'Will reappear when the next stocktake becomes due' });
                }}
                className="h-7 w-7 rounded-md bg-white/60 hover:bg-white text-slate-500 hover:text-slate-700 flex items-center justify-center flex-shrink-0 transition"
                title="Dismiss until next due date"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===== Compact schedule status (always visible when banner is dismissed) ===== */}
      {!showOverdueBanner && (
        <div className="flex-shrink-0 px-6 py-1 bg-slate-50 border-b border-slate-200 flex items-center gap-3 text-[10px]">
          <span className="flex items-center gap-1 text-slate-500">
            <CheckCircle2 className="h-3 w-3 text-emerald-500" />
            Stocktake schedule:
          </span>
          <select
            value={scheduleFreq}
            onChange={(e) => {
              setScheduleFreq(e.target.value as ScheduleFreq);
              setScheduleDismissed('');
              toast({ title: 'Schedule updated', description: `Stocktake frequency set to ${e.target.value}` });
            }}
            className="h-5 px-1 text-[10px] rounded border border-slate-300 bg-white text-slate-600 outline-none cursor-pointer"
          >
            <option value="weekly">Weekly</option>
            <option value="biweekly">Bi-weekly</option>
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
          </select>
          <span className={cn("font-medium", stocktakeStatus.isOverdue ? "text-rose-600" : "text-slate-500")}>
            {stocktakeStatus.message}
          </span>
          <button
            onClick={() => setScheduleDismissed('')}
            className="ml-auto text-blue-600 hover:underline font-semibold"
          >
            Show reminder
          </button>
        </div>
      )}

      {/* Content */}
      <main className="flex-1 overflow-hidden p-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={view}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="h-full"
          >
            {view === "add-modify" && <AddModifyStock products={products} setProducts={setProducts} groups={groups} setHistory={setHistory} />}
            {view === "group-maintenance" && <GroupMaintenance groups={groups} setGroups={setGroups} products={products} />}
            {view === "history" && <StockHistoryView history={history} products={products} />}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Stock Qty Report Modal */}
      <AnimatePresence>
        {showQtyReport && (
          <StockQtyReportModal products={products} groups={groups} onClose={() => setShowQtyReport(false)} />
        )}
      </AnimatePresence>

      {/* Stock File Popup Window */}
      <AnimatePresence>
        {showStockFilePopup && (
          <PopupWindow
            title="Stock File"
            titleBarColor="#5B9BD5"
            initialWidth={900}
            initialHeight={620}
            minWidth={600}
            minHeight={400}
            onClose={() => setShowStockFilePopup(false)}
          >
            <StockFileView products={products} setProducts={setProducts} groups={groups} history={history} setHistory={setHistory} />
          </PopupWindow>
        )}
      </AnimatePresence>

      {/* Stock Search Popup Window */}
      <AnimatePresence>
        {showStockSearchPopup && (
          <PopupWindow
            title="Stock Search"
            titleBarColor="#5B9BD5"
            initialWidth={900}
            initialHeight={620}
            minWidth={600}
            minHeight={400}
            initialX={80}
            initialY={80}
            onClose={() => setShowStockSearchPopup(false)}
          >
            <StockSearchView products={products} groups={groups} history={history} />
          </PopupWindow>
        )}
      </AnimatePresence>

      {/* ===== Stock Quantity Adjustment Popup Window ===== */}
      <AnimatePresence>
        {showQtyAdjustmentPopup && (
          <StockQuantityAdjustment
            products={products}
            setProducts={setProducts}
            setHistory={setHistory}
            history={history}
            groups={groups}
            onClose={() => setShowQtyAdjustmentPopup(false)}
          />
        )}
      </AnimatePresence>

      {/* ===== Stocktake Dashboard Popup ===== */}
      <AnimatePresence>
        {showDashboard && (
          <StocktakeDashboard
            history={history}
            products={products}
            stocktakeStatus={stocktakeStatus}
            scheduleFreq={scheduleFreq}
            onClose={() => setShowDashboard(false)}
            onStartStocktake={() => {
              setShowDashboard(false);
              setShowQtyAdjustmentPopup(true);
            }}
            onNavigateToPurchase={onNavigateToPurchase}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ===== Add / Modify Stock =====
function AddModifyStock({ products, setProducts, groups, setHistory }: {
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  groups: StockGroup[];
  setHistory: React.Dispatch<React.SetStateAction<StockHistoryEntry[]>>;
}) {
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Product | null>(null);
  const [showForm, setShowForm] = useState(false);
  const { toast } = useToast();

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.sku.toLowerCase().includes(search.toLowerCase()) ||
    p.barcode.includes(search)
  );

  const handleSave = (product: Product) => {
    const isNew = !products.find(p => p.id === product.id);
    if (isNew) {
      setProducts(prev => [...prev, product]);
      setHistory(prev => [...prev, {
        id: `h-${Date.now()}`,
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        action: 'added',
        quantityChange: product.stock,
        newQuantity: product.stock,
        timestamp: new Date().toISOString(),
        user: "Sarah Johnson",
        reason: "New product added to inventory",
        reference: `ADD-${Date.now().toString().slice(-6)}`,
      }]);
      toast({ title: "Product added", description: `${product.emoji} ${product.name} created` });
    } else {
      setProducts(prev => prev.map(p => p.id === product.id ? product : p));
      setHistory(prev => [...prev, {
        id: `h-${Date.now()}`,
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        action: 'modified',
        quantityChange: 0,
        newQuantity: product.stock,
        timestamp: new Date().toISOString(),
        user: "Sarah Johnson",
        reason: "Product details updated",
        reference: `MOD-${Date.now().toString().slice(-6)}`,
      }]);
      toast({ title: "Product updated", description: `${product.emoji} ${product.name} modified` });
    }
    setShowForm(false);
    setEditing(null);
  };

  const handleDelete = (id: string) => {
    const product = products.find(p => p.id === id);
    setProducts(prev => prev.filter(p => p.id !== id));
    if (product) {
      setHistory(prev => [...prev, {
        id: `h-${Date.now()}`,
        productId: id,
        productName: product.name,
        sku: product.sku,
        action: 'removed',
        quantityChange: -product.stock,
        newQuantity: 0,
        timestamp: new Date().toISOString(),
        user: "Sarah Johnson",
        reason: "Product removed from inventory",
        reference: `DEL-${Date.now().toString().slice(-6)}`,
      }]);
    }
    toast({ title: "Product deleted", variant: "default" });
  };

  // Vibrant color scheme for group badges (matching Group Maintenance)
  const groupColors: Record<string, { bg: string; text: string; border: string }> = {
    emerald: { bg: '#D1FAE5', text: '#065F46', border: '#10B981' },
    purple: { bg: '#EDE9FE', text: '#5B21B6', border: '#8B5CF6' },
    cyan: { bg: '#CFFAFE', text: '#155E75', border: '#06B6D4' },
    red: { bg: '#FEE2E2', text: '#991B1B', border: '#EF4444' },
    teal: { bg: '#CCFBF1', text: '#115E59', border: '#14B8A6' },
    blue: { bg: '#DBEAFE', text: '#1E40AF', border: '#3B82F6' },
    amber: { bg: '#FEF3C7', text: '#92400E', border: '#F59E0B' },
    rose: { bg: '#FFE4E6', text: '#9F1239', border: '#F43F5E' },
    indigo: { bg: '#E0E7FF', text: '#3730A3', border: '#6366F1' },
  };
  const getGroupColor = (color: string) => groupColors[color] || groupColors.emerald;

  return (
    <div className="h-full bg-white rounded-2xl shadow-lg ring-1 ring-emerald-200/60 overflow-hidden flex flex-col">
      {/* Toolbar — emerald gradient header matching Group Maintenance */}
      <div className="flex-shrink-0 flex items-center justify-between px-5 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 border-b border-emerald-700">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-white/20 backdrop-blur flex items-center justify-center ring-1 ring-white/30 shadow-sm">
            <Package className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Product Catalog</h2>
            <div className="text-[10px] text-emerald-50/90">Add, modify, and adjust stock levels</div>
          </div>
          <Badge variant="outline" className="font-mono text-xs ml-1 bg-white/15 text-white border-white/30">{products.length} items</Badge>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products..."
              className="h-9 pl-8 pr-3 rounded-lg bg-white text-sm outline-none ring-2 ring-transparent focus:ring-emerald-300 focus:bg-white transition w-56 text-slate-700"
            />
          </div>
          <button
            onClick={() => { setEditing(null); setShowForm(true); }}
            className="h-9 px-4 rounded-lg bg-white text-emerald-700 text-sm font-bold flex items-center gap-1.5 transition hover:bg-emerald-50 shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Add Product
          </button>
        </div>
      </div>

      {/* Summary bar */}
      <div className="flex-shrink-0 px-5 py-2 bg-emerald-50 border-b border-emerald-100 flex items-center gap-4 text-[11px]">
        <span className="text-slate-600">Total inventory value:</span>
        <span className="font-bold font-mono text-emerald-700">
          {formatGHS(products.reduce((s, p) => s + p.price * p.stock, 0))}
        </span>
        <span className="text-slate-300">·</span>
        <span className="text-slate-600">{products.filter(p => p.stock <= p.reorderLevel).length} low-stock items</span>
        <span className="text-slate-300">·</span>
        <span className="text-slate-600">{products.filter(p => p.stock === 0).length} out of stock</span>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto min-h-0" style={{ scrollbarWidth: 'thin' }}>
        <div className="mobile-scroll-x">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-xs uppercase tracking-wide z-10 shadow-md">
            <tr>
              <th className="text-left px-4 py-2.5 font-semibold">Product</th>
              <th className="text-left px-3 py-2.5 font-semibold">SKU</th>
              <th className="text-left px-3 py-2.5 font-semibold">Group</th>
              <th className="text-center px-3 py-2.5 font-semibold">Stock</th>
              <th className="text-right px-3 py-2.5 font-semibold">Cost</th>
              <th className="text-right px-3 py-2.5 font-semibold">Price</th>
              <th className="text-center px-3 py-2.5 font-semibold">Expiry</th>
              <th className="text-center px-3 py-2.5 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-emerald-50">
            {filtered.map((p, idx) => {
              const group = groups.find(g => g.id === p.groupId);
              const expDays = Math.ceil((new Date(p.expiryDate).getTime() - Date.now()) / 86400000);
              const gc = group ? getGroupColor(group.color) : null;
              return (
                <tr key={p.id} className={cn("transition", idx % 2 === 0 ? "bg-white hover:bg-emerald-50/40" : "bg-emerald-50/20 hover:bg-emerald-50/50")}>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{p.emoji}</span>
                      <div>
                        <div className="font-semibold text-slate-800">{p.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{p.barcode}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs text-slate-600">{p.sku}</td>
                  <td className="px-3 py-2.5">
                    {group && gc && (
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border"
                        style={{ backgroundColor: gc.bg, color: gc.text, borderColor: gc.border }}
                      >
                        {group.icon} {group.name}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <span className={cn("font-mono font-bold", p.stock === 0 ? "text-rose-600" : p.stock <= p.reorderLevel ? "text-amber-600" : "text-emerald-700")}>
                      {p.stock}
                    </span>
                    <span className="text-[10px] text-slate-400 ml-1">/{p.unit}</span>
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-slate-600">{formatGHS(p.costPrice)}</td>
                  <td className="px-3 py-2.5 text-right font-mono font-semibold text-emerald-700">{formatGHS(p.price)}</td>
                  <td className="px-3 py-2.5 text-center">
                    <span className={cn("text-[11px] font-medium", expDays < 0 ? "text-rose-600" : expDays <= 7 ? "text-amber-600" : "text-slate-500")}>
                      {p.expiryDate}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => { setEditing(p); setShowForm(true); }}
                        className="h-7 w-7 rounded-md bg-blue-100 text-blue-600 hover:bg-blue-200 flex items-center justify-center transition shadow-sm"
                        title="Edit product details"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(p.id)}
                        className="h-7 w-7 rounded-md bg-rose-100 text-rose-600 hover:bg-rose-200 flex items-center justify-center transition shadow-sm"
                        title="Delete product"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>

      {/* Form Modal */}
      <AnimatePresence>
        {showForm && (
          <ProductForm
            product={editing}
            groups={groups}
            onSave={handleSave}
            onClose={() => { setShowForm(false); setEditing(null); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function ProductForm({ product, groups, onSave, onClose }: {
  product: Product | null;
  groups: StockGroup[];
  onSave: (p: Product) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<Product>(product || {
    id: `p-${Date.now()}`,
    sku: `NEW-${Math.floor(1000 + Math.random() * 9000)}`,
    name: "",
    price: 0,
    costPrice: 0,
    category: "fruits",
    groupId: "g1",
    unit: "each",
    stock: 0,
    reorderLevel: 10,
    barcode: "",
    emoji: "📦",
    taxable: false,
    batchNumber: `B-NEW-${Date.now().toString().slice(-4)}`,
    receivedDate: new Date().toISOString().split('T')[0],
    expiryDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
    supplier: "",
  });

  // Compute profit margin live (premium UX — instant feedback)
  const profitMargin = form.price > 0 && form.costPrice > 0
    ? { amount: form.price - form.costPrice, pct: (((form.price - form.costPrice) / form.price) * 100) }
    : null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="compact-modal-overlay fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className="compact-modal bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] sm:max-h-[85vh] overflow-hidden flex flex-col"
      >
        {/* Header — compact */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white flex-shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-8 w-8 rounded-lg bg-white/15 flex items-center justify-center text-lg flex-shrink-0">
              {form.emoji || (product ? <Edit2 className="h-4 w-4" /> : <Plus className="h-4 w-4" />)}
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold truncate">{product ? "Edit Product" : "Add New Product"}</h3>
              <p className="text-[10px] opacity-80 truncate">{form.name || "Untitled product"}</p>
            </div>
          </div>
          <button onClick={onClose} className="h-8 w-8 rounded-lg bg-white/15 hover:bg-white/25 flex items-center justify-center transition active:scale-90 flex-shrink-0" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <ScrollArea className="flex-1 min-h-0">
          <div className="p-4 sm:p-5 space-y-4">

            {/* ===== Section 1: Basic Info ===== */}
            <FormSection title="Basic Info" icon={<Tag className="h-3.5 w-3.5" />}>
              <div className="space-y-2.5">
                <FormField label="Product Name" icon={<Tag className="h-3.5 w-3.5" />}>
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="form-input" placeholder="e.g. Fresh Tomatoes" />
                </FormField>
                <div className="grid grid-cols-[1fr_60px] gap-2">
                  <FormField label="SKU" icon={<Barcode className="h-3.5 w-3.5" />}>
                    <input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} className="form-input" />
                  </FormField>
                  <FormField label="Icon">
                    <input value={form.emoji} onChange={(e) => setForm({ ...form, emoji: e.target.value })} className="form-input text-center text-lg" maxLength={2} />
                  </FormField>
                </div>
                <FormField label="Barcode (optional)">
                  <input value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} className="form-input" placeholder="941563812092" inputMode="numeric" />
                </FormField>
              </div>
            </FormSection>

            {/* ===== Section 2: Pricing ===== */}
            <FormSection title="Pricing" icon={<DollarSign className="h-3.5 w-3.5" />}>
              <div className="grid grid-cols-2 gap-2.5">
                <FormField label="Cost Price (GHS)">
                  <input type="number" step="0.01" value={form.costPrice} onChange={(e) => setForm({ ...form, costPrice: parseFloat(e.target.value) || 0 })} className="form-input" inputMode="decimal" />
                </FormField>
                <FormField label="Selling Price (GHS)">
                  <input type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: parseFloat(e.target.value) || 0 })} className="form-input" inputMode="decimal" />
                </FormField>
              </div>
              {profitMargin && (
                <div className="mt-2 p-2.5 rounded-lg bg-emerald-50 ring-1 ring-emerald-200 flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-emerald-700 uppercase">Margin</span>
                  <span className="text-sm font-bold text-emerald-700">{formatGHS(profitMargin.amount)} ({profitMargin.pct.toFixed(1)}%)</span>
                </div>
              )}
              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input type="checkbox" checked={form.taxable} onChange={(e) => setForm({ ...form, taxable: e.target.checked })} className="h-4 w-4 rounded accent-emerald-600" />
                <span className="text-xs text-slate-600">Apply VAT (15%)</span>
              </label>
            </FormSection>

            {/* ===== Section 3: Inventory ===== */}
            <FormSection title="Inventory" icon={<Package className="h-3.5 w-3.5" />}>
              <div className="grid grid-cols-2 gap-2.5">
                <FormField label="Stock Qty">
                  <input type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: parseInt(e.target.value) || 0 })} className="form-input" inputMode="numeric" />
                </FormField>
                <FormField label="Reorder Level">
                  <input type="number" value={form.reorderLevel} onChange={(e) => setForm({ ...form, reorderLevel: parseInt(e.target.value) || 0 })} className="form-input" inputMode="numeric" />
                </FormField>
                <FormField label="Unit">
                  <select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className="form-input">
                    {["kg", "each", "box", "pack", "btl", "loaf", "can", "jar", "bag", "tub", "block", "head", "dz"].map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </FormField>
                <FormField label="Batch No.">
                  <input value={form.batchNumber} onChange={(e) => setForm({ ...form, batchNumber: e.target.value })} className="form-input" />
                </FormField>
              </div>
            </FormSection>

            {/* ===== Section 4: Categorization ===== */}
            <FormSection title="Categorization" icon={<Layers className="h-3.5 w-3.5" />}>
              <div className="space-y-2.5">
                <FormField label="Stock Group">
                  <select value={form.groupId} onChange={(e) => setForm({ ...form, groupId: e.target.value, category: e.target.value })} className="form-input">
                    {groups.map(g => <option key={g.id} value={g.id}>{g.icon} {g.name}</option>)}
                  </select>
                </FormField>
                <FormField label="Supplier (optional)">
                  <input value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} className="form-input" placeholder="Supplier name" />
                </FormField>
                <div className="grid grid-cols-2 gap-2.5">
                  <FormField label="Received Date">
                    <input type="date" value={form.receivedDate} onChange={(e) => setForm({ ...form, receivedDate: e.target.value })} className="form-input" />
                  </FormField>
                  <FormField label="Expiry Date">
                    <input type="date" value={form.expiryDate} onChange={(e) => setForm({ ...form, expiryDate: e.target.value })} className="form-input" />
                  </FormField>
                </div>
              </div>
            </FormSection>

          </div>
        </ScrollArea>

        {/* Sticky CTA — always visible */}
        <div className="flex-shrink-0 px-4 sm:px-5 py-3 border-t border-slate-200 bg-white flex gap-2">
          <Button variant="outline" onClick={onClose} className="flex-shrink-0 h-11 px-4 text-sm">Cancel</Button>
          <Button
            onClick={() => form.name && onSave(form)}
            disabled={!form.name}
            className="flex-1 h-11 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-sm font-bold"
          >
            <Save className="h-4 w-4" />
            {product ? "Update Product" : "Add Product"}
          </Button>
        </div>

        <style jsx>{`
          :global(.form-input) {
            width: 100%;
            height: 2.5rem;
            padding: 0 0.625rem;
            border-radius: 0.5rem;
            border: 1px solid rgb(226 232 240);
            background: white;
            font-size: 14px;
            outline: none;
            transition: all 0.15s;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            box-sizing: border-box;
          }
          :global(.form-input:focus) {
            border-color: rgb(16 185 129);
            box-shadow: 0 0 0 3px rgb(16 185 129 / 0.1);
            overflow: visible;
          }
          @media (max-width: 639px) {
            :global(.form-input) {
              font-size: 16px;
              height: 2.5rem;
            }
          }
        `}</style>
      </motion.div>
    </motion.div>
  );
}

// Premium form section with sticky-ish header on mobile
function FormSection({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 pb-1 border-b border-slate-200">
        <div className="flex items-center justify-center h-6 w-6 rounded-md bg-emerald-50 text-emerald-600">
          {icon}
        </div>
        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">{title}</h4>
      </div>
      <div>{children}</div>
    </div>
  );
}

function FormField({ label, icon, children, full }: { label: string; icon?: React.ReactNode; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <label className="flex items-center gap-1.5 text-[11px] sm:text-xs font-semibold text-slate-600 mb-1.5">
        {icon}
        {label}
      </label>
      {children}
    </div>
  );
}

// ===== Group Maintenance =====
function GroupMaintenance({ groups, setGroups, products }: {
  groups: StockGroup[];
  setGroups: React.Dispatch<React.SetStateAction<StockGroup[]>>;
  products: Product[];
}) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<StockGroup | null>(null);
  const { toast } = useToast();

  const handleDelete = (id: string) => {
    const count = products.filter(p => p.groupId === id).length;
    if (count > 0) {
      toast({ title: "Cannot delete", description: `${count} products use this group`, variant: "destructive" });
      return;
    }
    setGroups(prev => prev.filter(g => g.id !== id));
    toast({ title: "Group deleted" });
  };

  // ===== Vibrant color scheme per group =====
  // Each group gets a unique vibrant border + matching accent colors
  // that make the cards stand out clearly and look professional.
  const groupColorScheme: Record<string, {
    border: string;       // vibrant border color (hex)
    borderHover: string;  // darker border on hover
    bgTint: string;       // very light background tint (rgba)
    iconBg: string;       // icon container gradient (from)
    iconBgTo: string;     // icon container gradient (to)
    iconBorder: string;   // icon container border
    badgeBg: string;      // product count badge background
    badgeText: string;    // product count badge text
    accent: string;       // accent color for value text
    shadow: string;       // box shadow color (rgba)
  }> = {
    emerald: {
      border: '#10B981',
      borderHover: '#059669',
      bgTint: 'rgba(16, 185, 129, 0.04)',
      iconBg: '#10B981',
      iconBgTo: '#059669',
      iconBorder: '#059669',
      badgeBg: '#D1FAE5',
      badgeText: '#065F46',
      accent: '#059669',
      shadow: 'rgba(16, 185, 129, 0.15)',
    },
    purple: {
      border: '#8B5CF6',
      borderHover: '#7C3AED',
      bgTint: 'rgba(139, 92, 246, 0.04)',
      iconBg: '#8B5CF6',
      iconBgTo: '#7C3AED',
      iconBorder: '#7C3AED',
      badgeBg: '#EDE9FE',
      badgeText: '#5B21B6',
      accent: '#7C3AED',
      shadow: 'rgba(139, 92, 246, 0.15)',
    },
    cyan: {
      border: '#06B6D4',
      borderHover: '#0891B2',
      bgTint: 'rgba(6, 182, 212, 0.04)',
      iconBg: '#06B6D4',
      iconBgTo: '#0891B2',
      iconBorder: '#0891B2',
      badgeBg: '#CFFAFE',
      badgeText: '#155E75',
      accent: '#0891B2',
      shadow: 'rgba(6, 182, 212, 0.15)',
    },
    red: {
      border: '#EF4444',
      borderHover: '#DC2626',
      bgTint: 'rgba(239, 68, 68, 0.04)',
      iconBg: '#EF4444',
      iconBgTo: '#DC2626',
      iconBorder: '#DC2626',
      badgeBg: '#FEE2E2',
      badgeText: '#991B1B',
      accent: '#DC2626',
      shadow: 'rgba(239, 68, 68, 0.15)',
    },
    teal: {
      border: '#14B8A6',
      borderHover: '#0D9488',
      bgTint: 'rgba(20, 184, 166, 0.04)',
      iconBg: '#14B8A6',
      iconBgTo: '#0D9488',
      iconBorder: '#0D9488',
      badgeBg: '#CCFBF1',
      badgeText: '#115E59',
      accent: '#0D9488',
      shadow: 'rgba(20, 184, 166, 0.15)',
    },
    blue: {
      border: '#3B82F6',
      borderHover: '#2563EB',
      bgTint: 'rgba(59, 130, 246, 0.04)',
      iconBg: '#3B82F6',
      iconBgTo: '#2563EB',
      iconBorder: '#2563EB',
      badgeBg: '#DBEAFE',
      badgeText: '#1E40AF',
      accent: '#2563EB',
      shadow: 'rgba(59, 130, 246, 0.15)',
    },
    amber: {
      border: '#F59E0B',
      borderHover: '#D97706',
      bgTint: 'rgba(245, 158, 11, 0.04)',
      iconBg: '#F59E0B',
      iconBgTo: '#D97706',
      iconBorder: '#D97706',
      badgeBg: '#FEF3C7',
      badgeText: '#92400E',
      accent: '#D97706',
      shadow: 'rgba(245, 158, 11, 0.15)',
    },
    rose: {
      border: '#F43F5E',
      borderHover: '#E11D48',
      bgTint: 'rgba(244, 63, 94, 0.04)',
      iconBg: '#F43F5E',
      iconBgTo: '#E11D48',
      iconBorder: '#E11D48',
      badgeBg: '#FFE4E6',
      badgeText: '#9F1239',
      accent: '#E11D48',
      shadow: 'rgba(244, 63, 94, 0.15)',
    },
    indigo: {
      border: '#6366F1',
      borderHover: '#4F46E5',
      bgTint: 'rgba(99, 102, 241, 0.04)',
      iconBg: '#6366F1',
      iconBgTo: '#4F46E5',
      iconBorder: '#4F46E5',
      badgeBg: '#E0E7FF',
      badgeText: '#3730A3',
      accent: '#4F46E5',
      shadow: 'rgba(99, 102, 241, 0.15)',
    },
  };

  // Fallback for unknown colors
  const getColorScheme = (color: string) => groupColorScheme[color] || groupColorScheme.emerald;

  return (
    <div className="h-full bg-white rounded-2xl shadow-lg ring-1 ring-slate-200/60 overflow-hidden flex flex-col">
      {/* Header with enhanced styling */}
      <div className="flex-shrink-0 flex items-center justify-between px-5 py-3 bg-gradient-to-r from-slate-50 to-white border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-sm">
            <Layers className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-800">Stock Groups</h2>
            <div className="text-[10px] text-slate-500">Organize products into categories</div>
          </div>
          <Badge variant="outline" className="font-mono text-xs ml-1">{groups.length} groups</Badge>
        </div>
        <Button onClick={() => { setEditing(null); setShowForm(true); }} className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700">
          <Plus className="h-4 w-4" />
          Add Group
        </Button>
      </div>

      {/* Summary bar showing total value across all groups */}
      <div className="flex-shrink-0 px-5 py-2 bg-slate-50 border-b border-slate-200 flex items-center gap-4 text-[11px]">
        <span className="text-slate-500">Total inventory value across all groups:</span>
        <span className="font-bold font-mono text-slate-800">
          {formatGHS(groups.reduce((s, g) => s + products.filter(p => p.groupId === g.id).reduce((s2, p) => s2 + p.price * p.stock, 0), 0))}
        </span>
        <span className="text-slate-300">·</span>
        <span className="text-slate-500">{products.length} total products</span>
      </div>

      <div className="flex-1 overflow-auto min-h-0" style={{ scrollbarWidth: 'thin' }}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-5">
          {groups.map(g => {
            const count = products.filter(p => p.groupId === g.id).length;
            const value = products.filter(p => p.groupId === g.id).reduce((s, p) => s + p.price * p.stock, 0);
            const scheme = getColorScheme(g.color);
            return (
              <motion.div
                key={g.id}
                layout
                whileHover={{ y: -4 }}
                className="relative rounded-xl p-4 transition-all"
                style={{
                  backgroundColor: scheme.bgTint,
                  border: `2px solid ${scheme.border}`,
                  boxShadow: `0 4px 12px ${scheme.shadow}, inset 0 1px 0 rgba(255,255,255,0.5)`,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = scheme.borderHover;
                  e.currentTarget.style.boxShadow = `0 8px 24px ${scheme.shadow}, inset 0 1px 0 rgba(255,255,255,0.5)`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = scheme.border;
                  e.currentTarget.style.boxShadow = `0 4px 12px ${scheme.shadow}, inset 0 1px 0 rgba(255,255,255,0.5)`;
                }}
              >
                {/* Top accent bar (vibrant color strip at the top of each card) */}
                <div
                  className="absolute top-0 left-0 right-0 h-1 rounded-t-xl"
                  style={{ background: `linear-gradient(to right, ${scheme.iconBg}, ${scheme.iconBgTo})` }}
                />

                <div className="flex items-start justify-between mb-3">
                  {/* Icon container with vibrant gradient + border */}
                  <div
                    className="h-12 w-12 rounded-xl flex items-center justify-center text-2xl shadow-sm"
                    style={{
                      background: `linear-gradient(135deg, ${scheme.iconBg}, ${scheme.iconBgTo})`,
                      border: `2px solid ${scheme.iconBorder}`,
                      boxShadow: `0 2px 8px ${scheme.shadow}`,
                    }}
                  >
                    {g.icon}
                  </div>
                  {/* Action buttons */}
                  <div className="flex gap-1">
                    <button
                      onClick={() => { setEditing(g); setShowForm(true); }}
                      className="h-7 w-7 rounded-md bg-blue-100 text-blue-600 hover:bg-blue-200 flex items-center justify-center transition shadow-sm"
                      title="Edit group"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(g.id)}
                      className="h-7 w-7 rounded-md bg-rose-100 text-rose-600 hover:bg-rose-200 flex items-center justify-center transition shadow-sm"
                      title="Delete group"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Group name with accent underline */}
                <div className="font-bold text-slate-800 text-sm">{g.name}</div>
                <div
                  className="h-0.5 w-12 rounded-full mb-2"
                  style={{ backgroundColor: scheme.accent }}
                />
                <div className="text-xs text-slate-500 mb-3 leading-relaxed">{g.description}</div>

                {/* Footer with product count badge + value */}
                <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-200/60">
                  <span
                    className="px-2 py-0.5 rounded-md font-semibold"
                    style={{ backgroundColor: scheme.badgeBg, color: scheme.badgeText }}
                  >
                    {count} product{count !== 1 ? 's' : ''}
                  </span>
                  <div className="text-right">
                    <div className="text-[8px] text-slate-400 uppercase font-semibold">Value</div>
                    <span className="font-mono font-bold" style={{ color: scheme.accent }}>
                      {formatGHS(value)}
                    </span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      <AnimatePresence>
        {showForm && (
          <GroupForm
            group={editing}
            onSave={(g) => {
              if (editing) {
                setGroups(prev => prev.map(x => x.id === g.id ? g : x));
                toast({ title: "Group updated" });
              } else {
                setGroups(prev => [...prev, { ...g, id: `g-${Date.now()}` }]);
                toast({ title: "Group added" });
              }
              setShowForm(false);
              setEditing(null);
            }}
            onClose={() => { setShowForm(false); setEditing(null); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}


function GroupForm({ group, onSave, onClose }: {
  group: StockGroup | null;
  onSave: (g: StockGroup) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<StockGroup>(group || { id: "", name: "", description: "", color: "emerald", icon: "📦" });

  // ===== Emoji icon library for stock groups =====
  // Icons grouped by the 5 stock group categories as requested:
  // Households, Groceries, Confectionery, Alcohol Beverages, Soft Drinks
  const ICON_CATEGORIES: { label: string; icons: string[] }[] = [
    {
      label: 'Groceries',
      icons: [
        '🛒', '🍎', '🍌', '🍊', '🍓', '🍇', '🥕', '🥬', '🍅', '🥔', '🧅', '🧄',
        '🌽', '🍞', '🥖', '🧀', '🥛', '🥚', '🍖', '🍗', '🐟', '🍤', '🍚', '🥘',
        '🍜', '🍝', '🥫', '🧈', '🧂', '🥜', '🌰', '🥥', '🍍', '🥭', '🍑', '🍒',
        '🍈', '🍉', '🥝', '🥑', '🫐', '🧆', '🥟', '🥠', '🫘', '🫛', '🫒', '🫚',
      ],
    },
    {
      label: 'Confectionery',
      icons: [
        '🍫', '🍬', '🍭', '🍩', '🍪', '🎂', '🍰', '🧁', '🍦', '🍧', '🍨', '🥧',
        '🥨', '🥐', '🧇', '🥞', '🍿', '🍯', '🥜', '🍮', '🧋', '🍡', '🍢', '🍘',
        '🍥', '🥮', '🧧', '🎴',
      ],
    },
    {
      label: 'Soft Drinks',
      icons: [
        '🥤', '🧃', '🥛', '☕', '🍵', '🧊', '💧', '🧋', '🥤', '🧃', '🍹', '🥛',
        '🫗', '🧉', '🥤', '🧋',
      ],
    },
    {
      label: 'Alcohol Beverages',
      icons: [
        '🍷', '🍺', '🍻', '🥃', '🍸', '🍾', '🧊', '🍶', '🥂', '🍹', '🍾', '🍸',
        '🥃', '🍺', '🍷', '🍾',
      ],
    },
    {
      label: 'Households',
      icons: [
        '🧴', '🧼', '🧽', '🧹', '🧺', '🪣', '🧻', '🪟', '🚿', '🛁', '🧷', '✂️',
        '🪒', '🧯', '🛒', '🛍️', '🏪', '📦', '🏷️', '💰', '🧾', '💳', '🔑', '🔒',
        '🛡️', '⚙️', '🔧', '🔨', '🛠️', '🧰', '💡', '🔋', '🔌', '📚', '✏️', '🖊️',
        '📎', '📌', '📋', '📁', '🗂️', '📐', '📏', '💊', '🪥', '🧖', '💆', '💄',
      ],
    },
  ];

  const [showIconPicker, setShowIconPicker] = useState(false);
  const [iconCategory, setIconCategory] = useState(0);
  const [iconSearch, setIconSearch] = useState('');

  // Filter icons by search
  const filteredIcons = useMemo(() => {
    if (!iconSearch.trim()) return ICON_CATEGORIES[iconCategory].icons;
    // If searching, search across all categories
    const allIcons = ICON_CATEGORIES.flatMap(c => c.icons);
    return allIcons.filter((icon, idx) => allIcons.indexOf(icon) === idx); // dedupe
  }, [iconSearch, iconCategory]);

  // ===== Color options with visual swatches =====
  const COLOR_OPTIONS: { value: string; hex: string; label: string }[] = [
    { value: 'emerald', hex: '#10B981', label: 'Emerald' },
    { value: 'blue', hex: '#3B82F6', label: 'Blue' },
    { value: 'red', hex: '#EF4444', label: 'Red' },
    { value: 'amber', hex: '#F59E0B', label: 'Amber' },
    { value: 'cyan', hex: '#06B6D4', label: 'Cyan' },
    { value: 'purple', hex: '#8B5CF6', label: 'Purple' },
    { value: 'sky', hex: '#0EA5E9', label: 'Sky' },
    { value: 'orange', hex: '#F97316', label: 'Orange' },
    { value: 'teal', hex: '#14B8A6', label: 'Teal' },
    { value: 'pink', hex: '#EC4899', label: 'Pink' },
    { value: 'indigo', hex: '#6366F1', label: 'Indigo' },
    { value: 'rose', hex: '#F43F5E', label: 'Rose' },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <motion.div
        initial={{ scale: 0.92, y: 20, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.92, y: 20, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col ring-1 ring-slate-200/60"
        style={{ maxHeight: '90vh' }}
      >
        {/* ===== Header with gradient + pattern ===== */}
        <div className="flex-shrink-0 relative overflow-hidden">
          {/* Gradient background */}
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700" />
          {/* Decorative pattern */}
          <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, rgba(255,255,255,0.3) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(255,255,255,0.2) 0%, transparent 40%)' }} />
          <div className="relative flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-3">
              {/* Preview circle showing the current icon + color */}
              <div
                className="h-11 w-11 rounded-2xl flex items-center justify-center text-2xl shadow-lg ring-2 ring-white/30"
                style={{ background: `linear-gradient(135deg, ${COLOR_OPTIONS.find(c => c.value === form.color)?.hex || '#10B981'}, ${COLOR_OPTIONS.find(c => c.value === form.color)?.hex || '#10B981'}dd)` }}
              >
                {form.icon}
              </div>
              <div>
                <h3 className="text-lg font-bold text-white leading-tight">{group ? "Edit Stock Group" : "Add Stock Group"}</h3>
                <p className="text-[11px] text-emerald-50/80">{form.name || 'Untitled group'}</p>
              </div>
            </div>
            <button onClick={onClose} className="h-8 w-8 rounded-xl bg-white/15 hover:bg-white/30 flex items-center justify-center transition backdrop-blur-sm"><X className="h-4 w-4 text-white" /></button>
          </div>
        </div>

        {/* ===== Body ===== */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5" style={{ scrollbarWidth: 'thin' }}>
          {/* Group Name */}
          <div>
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5 block flex items-center gap-1">
              <Layers className="h-3 w-3" /> Group Name
            </label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full h-11 px-4 rounded-xl border-2 border-slate-100 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none text-sm font-medium transition bg-slate-50/50"
              placeholder="e.g. Fresh Produce"
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5 block flex items-center gap-1">
              <FileText className="h-3 w-3" /> Description
            </label>
            <input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full h-11 px-4 rounded-xl border-2 border-slate-100 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none text-sm transition bg-slate-50/50"
              placeholder="Brief description of this group…"
            />
          </div>

          {/* Icon + Color side by side */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">Icon</label>
              <button
                onClick={() => setShowIconPicker(!showIconPicker)}
                className={cn(
                  "w-full h-11 px-3 rounded-xl border-2 outline-none text-sm flex items-center justify-center gap-2 transition",
                  showIconPicker
                    ? "border-emerald-500 ring-4 ring-emerald-500/10 bg-emerald-50"
                    : "border-slate-100 hover:border-emerald-300 bg-slate-50/50"
                )}
              >
                <span className="text-2xl">{form.icon}</span>
                <span className="text-[10px] text-slate-400 font-medium">Click to change</span>
              </button>
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">Color</label>
              <div className="relative">
                <select
                  value={form.color}
                  onChange={(e) => setForm({ ...form, color: e.target.value })}
                  className="w-full h-11 px-3 pr-8 rounded-xl border-2 border-slate-100 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none text-sm font-medium transition bg-slate-50/50 appearance-none cursor-pointer"
                >
                  {COLOR_OPTIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
                {/* Color swatch indicator */}
                <div
                  className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 rounded-full ring-2 ring-white shadow-sm pointer-events-none"
                  style={{ backgroundColor: COLOR_OPTIONS.find(c => c.value === form.color)?.hex || '#10B981' }}
                />
              </div>
            </div>
          </div>

          {/* ===== Color palette visual selector ===== */}
          <div>
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">Color Palette</label>
            <div className="flex items-center gap-2 flex-wrap">
              {COLOR_OPTIONS.map(c => (
                <button
                  key={c.value}
                  onClick={() => setForm({ ...form, color: c.value })}
                  className={cn(
                    "h-8 w-8 rounded-xl transition-all duration-200 shadow-sm",
                    form.color === c.value
                      ? "ring-2 ring-offset-2 ring-slate-700 scale-110"
                      : "hover:scale-110 hover:shadow-md"
                  )}
                  style={{ backgroundColor: c.hex }}
                  title={c.label}
                />
              ))}
            </div>
          </div>

          {/* ===== Icon Picker Grid ===== */}
          <AnimatePresence>
            {showIconPicker && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="rounded-2xl border-2 border-slate-100 overflow-hidden shadow-sm">
                  {/* Category tabs */}
                  <div className="flex items-center gap-1 px-2 py-2 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100 overflow-x-auto" style={{ scrollbarWidth: 'thin' }}>
                    {ICON_CATEGORIES.map((cat, idx) => (
                      <button
                        key={idx}
                        onClick={() => { setIconCategory(idx); setIconSearch(''); }}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all",
                          iconCategory === idx && !iconSearch
                            ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md"
                            : "bg-white text-slate-500 hover:bg-slate-100 ring-1 ring-slate-200"
                        )}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>

                  {/* Icon grid */}
                  <div className="p-3 max-h-44 overflow-y-auto bg-slate-50/30" style={{ scrollbarWidth: 'thin' }}>
                    <div className="grid grid-cols-8 gap-1.5">
                      {(iconSearch.trim() ? filteredIcons : ICON_CATEGORIES[iconCategory].icons).map((icon, idx) => (
                        <button
                          key={idx}
                          onClick={() => {
                            setForm({ ...form, icon });
                            setShowIconPicker(false);
                          }}
                          className={cn(
                            "h-10 w-10 rounded-xl flex items-center justify-center text-xl transition-all duration-150",
                            form.icon === icon
                              ? "bg-gradient-to-br from-emerald-400 to-teal-500 ring-2 ring-emerald-500 shadow-md scale-105"
                              : "hover:bg-white hover:shadow-md hover:scale-105"
                          )}
                          title={icon}
                        >
                          {icon}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Custom icon input */}
          <div className="flex items-center gap-2">
            <label className="text-[10px] font-semibold text-slate-400 whitespace-nowrap">Or custom:</label>
            <input
              value={form.icon}
              onChange={(e) => setForm({ ...form, icon: e.target.value })}
              className="flex-1 h-8 px-3 rounded-lg border border-slate-200 focus:border-emerald-500 outline-none text-sm text-center text-lg"
              maxLength={4}
              placeholder="Paste emoji…"
            />
          </div>

          {/* ===== Live preview card ===== */}
          <div className="rounded-2xl p-4 bg-gradient-to-br from-slate-50 to-slate-100 ring-1 ring-slate-200">
            <div className="text-[10px] font-bold text-slate-400 uppercase mb-2">Live Preview</div>
            <div className="flex items-center gap-3">
              <div
                className="h-12 w-12 rounded-2xl flex items-center justify-center text-2xl shadow-md"
                style={{
                  background: `linear-gradient(135deg, ${COLOR_OPTIONS.find(c => c.value === form.color)?.hex || '#10B981'}, ${COLOR_OPTIONS.find(c => c.value === form.color)?.hex || '#10B981'}cc)`,
                  border: `2px solid ${COLOR_OPTIONS.find(c => c.value === form.color)?.hex || '#10B981'}`,
                }}
              >
                {form.icon}
              </div>
              <div className="flex-1">
                <div className="font-bold text-slate-800 text-sm">{form.name || 'Group Name'}</div>
                <div className="text-[11px] text-slate-500">{form.description || 'Group description…'}</div>
              </div>
              <span
                className="px-2 py-0.5 rounded-lg text-[10px] font-bold"
                style={{
                  backgroundColor: (COLOR_OPTIONS.find(c => c.value === form.color)?.hex || '#10B981') + '20',
                  color: COLOR_OPTIONS.find(c => c.value === form.color)?.hex || '#10B981',
                }}
              >
                {form.color}
              </span>
            </div>
          </div>
        </div>

        {/* ===== Footer ===== */}
        <div className="flex-shrink-0 px-6 py-4 border-t border-slate-100 bg-gradient-to-r from-slate-50 to-white flex justify-end gap-3">
          <button
            onClick={onClose}
            className="h-10 px-5 rounded-xl bg-white hover:bg-slate-100 text-slate-600 text-sm font-bold transition ring-1 ring-slate-200"
          >
            Cancel
          </button>
          <button
            onClick={() => form.name && onSave(form)}
            disabled={!form.name}
            className="h-10 px-6 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-sm font-bold transition shadow-lg shadow-emerald-500/30 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none flex items-center gap-2"
          >
            <Save className="h-4 w-4" />
            {group ? 'Update Group' : 'Add Group'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ===== Quantity Adjustment =====
// NOTE: Quantity Adjustment now lives in src/components/stock-quantity-adjustment.tsx
// and is opened as a popup window via the showQtyAdjustmentPopup state.

// ===== Stock History =====
function StockHistoryView({ history, products }: { history: StockHistoryEntry[]; products: Product[] }) {
  const [filter, setFilter] = useState<string>("all");
  // ===== Reference filter: when set, only entries with this reference are shown =====
  // (e.g. all lines belonging to a single Stocktake event ADJ-123456)
  const [referenceFilter, setReferenceFilter] = useState<string>("all");

  // Build the list of unique references from history (most-recent first)
  // Each reference is grouped with its earliest timestamp + entry count + total variance
  const referenceGroups = useMemo(() => {
    const groups = new Map<string, { reference: string; count: number; totalVariance: number; firstTimestamp: string; actions: Set<string> }>();
    history.forEach(h => {
      if (!h.reference) return;
      const existing = groups.get(h.reference);
      if (existing) {
        existing.count += 1;
        existing.totalVariance += h.quantityChange;
        existing.actions.add(h.action);
        if (h.timestamp < existing.firstTimestamp) existing.firstTimestamp = h.timestamp;
      } else {
        groups.set(h.reference, {
          reference: h.reference,
          count: 1,
          totalVariance: h.quantityChange,
          firstTimestamp: h.timestamp,
          actions: new Set([h.action]),
        });
      }
    });
    return Array.from(groups.values()).sort((a, b) => b.firstTimestamp.localeCompare(a.firstTimestamp));
  }, [history]);

  // ===== Compute filtered list =====
  // Apply action filter first, then reference filter
  const filtered = useMemo(() => {
    let result = filter === "all" ? history : history.filter(h => h.action === filter);
    if (referenceFilter !== "all") {
      result = result.filter(h => h.reference === referenceFilter);
    }
    return result;
  }, [history, filter, referenceFilter]);

  const actionColors: Record<string, string> = {
    added: "bg-emerald-100 text-emerald-700",
    modified: "bg-blue-100 text-blue-700",
    adjusted: "bg-amber-100 text-amber-700",
    sold: "bg-purple-100 text-purple-700",
    received: "bg-cyan-100 text-cyan-700",
    removed: "bg-rose-100 text-rose-700",
    reordered: "bg-orange-100 text-orange-700",
  };

  return (
    <div className="h-full bg-white rounded-2xl shadow-lg ring-1 ring-slate-200/60 overflow-hidden flex flex-col">
      <div className="flex-shrink-0 flex items-center justify-between px-5 py-3 bg-gradient-to-r from-slate-50 to-white border-b border-slate-200">
        <div className="flex items-center gap-3">
          <History className="h-5 w-5 text-emerald-600" />
          <h2 className="text-base font-bold text-slate-800">Stock Movement History</h2>
          <Badge variant="outline" className="font-mono text-xs">{filtered.length} of {history.length} entries</Badge>
        </div>
        <div className="flex gap-1">
          {["all", "received", "added", "modified", "adjusted", "removed"].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn("px-2.5 py-1 rounded-md text-[11px] font-semibold capitalize transition",
                filter === f ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200")}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* ===== Reference filter bar (new) ===== */}
      {referenceGroups.length > 0 && (
        <div className="flex-shrink-0 px-5 py-2 bg-amber-50/60 border-b border-amber-100 flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
            <Filter className="h-3 w-3" /> Adjustment Reference:
          </span>
          <select
            value={referenceFilter}
            onChange={(e) => setReferenceFilter(e.target.value)}
            className="h-7 px-2 text-[11px] rounded-md border border-slate-300 bg-white text-slate-700 outline-none focus:ring-2 focus:ring-emerald-400 cursor-pointer"
          >
            <option value="all">All references ({history.length} entries)</option>
            {referenceGroups.map(g => (
              <option key={g.reference} value={g.reference}>
                {g.reference} — {g.count} entries · variance {g.totalVariance > 0 ? '+' : ''}{g.totalVariance} · {new Date(g.firstTimestamp).toLocaleDateString('en-GB')}
              </option>
            ))}
          </select>
          {referenceFilter !== "all" && (
            <button
              onClick={() => setReferenceFilter("all")}
              className="h-7 px-2 rounded-md bg-rose-100 hover:bg-rose-200 text-rose-700 text-[10px] font-semibold flex items-center gap-1 transition"
            >
              <X className="h-3 w-3" /> Clear reference filter
            </button>
          )}
          {referenceFilter !== "all" && (
            <Badge variant="secondary" className="bg-amber-100 text-amber-800 text-[10px]">
              Showing {filtered.length} entries for {referenceFilter}
            </Badge>
          )}
        </div>
      )}

      <div className="flex-1 overflow-auto min-h-0" style={{ scrollbarWidth: 'thin' }}>
        <div className="p-4 space-y-2">
          {filtered.slice().reverse().map((h, i) => (
            <motion.div
              key={h.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: Math.min(i * 0.02, 0.3) }}
              className={cn(
                "flex items-center gap-3 p-3 rounded-xl transition cursor-pointer",
                referenceFilter === h.reference ? "bg-amber-100 ring-1 ring-amber-300 hover:bg-amber-200" : "bg-slate-50 hover:bg-slate-100"
              )}
              onClick={() => {
                // Click on a row whose reference matches the current filter clears it; otherwise sets it
                if (referenceFilter === h.reference) setReferenceFilter("all");
                else if (h.reference) setReferenceFilter(h.reference);
              }}
              title={h.reference ? `Click to filter by ${h.reference}` : undefined}
            >
              <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center text-xs font-bold uppercase", actionColors[h.action])}>
                {h.action.slice(0, 3)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-800 text-sm">{h.productName}</span>
                  <span className="text-[10px] font-mono text-slate-400">{h.sku}</span>
                </div>
                <div className="text-xs text-slate-500 truncate">{h.reason}</div>
              </div>
              <div className="text-right">
                <div className={cn("font-mono font-bold text-sm", h.quantityChange > 0 ? "text-emerald-600" : h.quantityChange < 0 ? "text-rose-600" : "text-slate-600")}>
                  {h.quantityChange > 0 ? "+" : ""}{h.quantityChange}
                </div>
                <div className="text-[10px] text-slate-400">→ {h.newQuantity}</div>
              </div>
              <div className="text-right text-[10px] text-slate-400">
                <div>{new Date(h.timestamp).toLocaleDateString('en-GB')}</div>
                <div>{new Date(h.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-slate-400">Ref</div>
                <div className={cn("text-[10px] font-mono", referenceFilter === h.reference ? "text-amber-700 font-bold" : "text-slate-600")}>{h.reference}</div>
              </div>
              <div className="flex items-center gap-1 text-[10px] text-slate-500">
                <User className="h-3 w-3" />
                {h.user.split(' ')[0]}
              </div>
            </motion.div>
          ))}
          {filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <History className="h-10 w-10 mb-2 opacity-40" />
              <div className="text-sm font-medium">No history entries match the current filters</div>
              {(filter !== "all" || referenceFilter !== "all") && (
                <button
                  onClick={() => { setFilter("all"); setReferenceFilter("all"); }}
                  className="mt-2 h-7 px-3 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
                >
                  Clear all filters
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ===== Stock File View =====
function StockFileView({ products, setProducts, groups, history, setHistory }: {
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  groups: StockGroup[];
  history: StockHistoryEntry[];
  setHistory: React.Dispatch<React.SetStateAction<StockHistoryEntry[]>>;
}) {
  const [searchText, setSearchText] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterGroup, setFilterGroup] = useState("all");
  const [filterGroup1, setFilterGroup1] = useState("all");
  const [filterGroup2, setFilterGroup2] = useState("all");
  const [filterGroup3, setFilterGroup3] = useState("all");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showCloneConfirm, setShowCloneConfirm] = useState<Product | null>(null);
  const [showQtyAdjust, setShowQtyAdjust] = useState<Product | null>(null);
  const [showPicture, setShowPicture] = useState<Product | null>(null);
  const [showHistory, setShowHistory] = useState<Product | null>(null);
  const { toast } = useToast();

  const filtered = products.filter(p => {
    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      if (!p.name.toLowerCase().includes(q) && !p.sku.toLowerCase().includes(q) && !p.barcode.includes(q)) return false;
    }
    if (filterType !== "all") {
      if (filterType === "taxable" && !p.taxable) return false;
      if (filterType === "non-taxable" && p.taxable) return false;
      if (filterType === "low-stock" && p.stock > p.reorderLevel) return false;
      if (filterType === "out-of-stock" && p.stock > 0) return false;
      if (filterType === "expiring" && Math.ceil((new Date(p.expiryDate).getTime() - Date.now()) / 86400000) > 7) return false;
    }
    if (filterGroup !== "all" && p.groupId !== filterGroup) return false;
    return true;
  });

  const selected = filtered[selectedIndex];

  const handleModify = () => {
    if (!selected) { toast({ title: "No product selected", variant: "destructive" }); return; }
    setEditingProduct(selected);
    setShowForm(true);
  };

  const handleNew = () => {
    setEditingProduct(null);
    setShowForm(true);
  };

  const handleClone = () => {
    if (!selected) { toast({ title: "No product selected", variant: "destructive" }); return; }
    setShowCloneConfirm(selected);
  };

  const handleSave = (product: Product) => {
    const isNew = !products.find(p => p.id === product.id);
    if (isNew) {
      setProducts(prev => [...prev, product]);
      setHistory(prev => [...prev, {
        id: `h-${Date.now()}`,
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        action: 'added',
        quantityChange: product.stock,
        newQuantity: product.stock,
        timestamp: new Date().toISOString(),
        user: "Sarah Johnson",
        reason: "New product added via Stock File",
        reference: `ADD-${Date.now().toString().slice(-6)}`,
      }]);
      toast({ title: "Product added", description: `${product.emoji} ${product.name}` });
    } else {
      setProducts(prev => prev.map(p => p.id === product.id ? product : p));
      setHistory(prev => [...prev, {
        id: `h-${Date.now()}`,
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        action: 'modified',
        quantityChange: 0,
        newQuantity: product.stock,
        timestamp: new Date().toISOString(),
        user: "Sarah Johnson",
        reason: "Product modified via Stock File",
        reference: `MOD-${Date.now().toString().slice(-6)}`,
      }]);
      toast({ title: "Product updated", description: `${product.emoji} ${product.name}` });
    }
    setShowForm(false);
    setEditingProduct(null);
  };

  const confirmClone = () => {
    if (!showCloneConfirm) return;
    const cloned: Product = {
      ...showCloneConfirm,
      id: `p-${Date.now()}`,
      sku: `CLN-${Math.floor(1000 + Math.random() * 9000)}`,
      name: `${showCloneConfirm.name} (Copy)`,
      barcode: `${showCloneConfirm.barcode}${Math.floor(Math.random() * 10)}`,
      batchNumber: `B-CLN-${Date.now().toString().slice(-4)}`,
      stock: 0,
    };
    setProducts(prev => [...prev, cloned]);
    setHistory(prev => [...prev, {
      id: `h-${Date.now()}`,
      productId: cloned.id,
      productName: cloned.name,
      sku: cloned.sku,
      action: 'added',
      quantityChange: 0,
      newQuantity: 0,
      timestamp: new Date().toISOString(),
      user: "Sarah Johnson",
      reason: `Cloned from ${showCloneConfirm.name}`,
      reference: `CLN-${Date.now().toString().slice(-6)}`,
    }]);
    toast({ title: "Product cloned", description: `${cloned.name} created` });
    setShowCloneConfirm(null);
  };

  return (
    <div className="h-full overflow-hidden flex flex-col" style={{ backgroundColor: '#E8F5E9' }}>
      {/* Search & Filter Section */}
      <div className="flex-shrink-0 px-4 py-2 space-y-2" style={{ backgroundColor: '#E8F5E9' }}>
        {/* Search Row */}
        <div className="flex items-center gap-3">
          <label className="text-xs font-bold text-slate-700 whitespace-nowrap w-20">Search Text</label>
          <input
            value={searchText}
            onChange={(e) => { setSearchText(e.target.value); setSelectedIndex(0); }}
            placeholder="Part Number"
            className="flex-1 max-w-xs h-8 px-3 rounded border border-slate-400 bg-white text-sm outline-none focus:ring-2 focus:ring-blue-400"
          />
          <button
            onClick={() => setSelectedIndex(0)}
            className="h-8 px-4 rounded border border-slate-400 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold transition"
          >
            Search
          </button>
        </div>
        {/* Filter Row */}
        <div className="flex items-center gap-3 flex-wrap">
          <label className="text-xs font-bold text-slate-700 whitespace-nowrap w-20">Filter By</label>
          <FilterDropdown label="Type" value={filterType} onChange={(v) => { setFilterType(v); setSelectedIndex(0); }} options={[
            { value: "all", label: "All Types" },
            { value: "taxable", label: "Taxable (VAT)" },
            { value: "non-taxable", label: "Non-Taxable" },
            { value: "low-stock", label: "Low Stock" },
            { value: "out-of-stock", label: "Out of Stock" },
          ]} />
          <FilterDropdown label="Stock Group" value={filterGroup} onChange={(v) => { setFilterGroup(v); setSelectedIndex(0); }} options={[
            { value: "all", label: "All Groups" },
            ...groups.map(g => ({ value: g.id, label: `${g.icon} ${g.name}` })),
          ]} />
          <FilterDropdown label="Sub Group" value={filterGroup1} onChange={setFilterGroup1} options={[
            { value: "all", label: "All" },
            { value: "fresh", label: "Fresh Items" },
            { value: "packaged", label: "Packaged" },
            { value: "frozen", label: "Frozen" },
          ]} />
          <FilterDropdown label="Brand" value={filterGroup2} onChange={setFilterGroup2} options={[
            { value: "all", label: "All Brands" },
            { value: "local", label: "Local Brands" },
            { value: "imported", label: "Imported Brands" },
          ]} />
          <FilterDropdown label="Size" value={filterGroup3} onChange={setFilterGroup3} options={[
            { value: "all", label: "All Sizes" },
            { value: "small", label: "Small" },
            { value: "medium", label: "Medium" },
            { value: "large", label: "Large" },
          ]} />
        </div>
      </div>

      {/* Data Table */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0 bg-white border-t border-b border-slate-400">
        {/* Table Header */}
        <div className="flex-shrink-0 grid grid-cols-[160px_1fr_60px_100px_100px] gap-1 px-3 py-1.5 text-slate-700 text-[11px] font-bold border-b border-slate-400" style={{ backgroundColor: '#F5F5F5' }}>
          <div>Part no</div>
          <div>Details</div>
          <div className="text-right">Qty</div>
          <div className="text-right">Retail GHC</div>
          <div className="text-right">Trade GHC</div>
        </div>

        {/* Table Body */}
        <ScrollArea className="flex-1 min-h-0">
          <div>
            {filtered.map((p, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={p.id}
                  onClick={() => setSelectedIndex(idx)}
                  className={cn(
                    "grid grid-cols-[160px_1fr_60px_100px_100px] gap-1 px-3 py-1.5 text-xs cursor-pointer transition border-b border-slate-200",
                  )}
                  style={{
                    backgroundColor: isSelected ? '#E3F2FD' : (idx % 2 === 1 ? '#FAFAFA' : '#FFFFFF'),
                    color: isSelected ? '#1565C0' : '#424242',
                  }}
                >
                  <div className="font-mono truncate">{p.barcode}</div>
                  <div className="truncate">{p.emoji} {p.name}</div>
                  <div className="text-right font-mono">{p.stock}</div>
                  <div className="text-right font-mono">{p.price.toFixed(2)}</div>
                  <div className="text-right font-mono">{p.costPrice.toFixed(2)}</div>
                </div>
              );
            })}
          </div>
          {filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <Package className="h-10 w-10 mb-2 opacity-40" />
              <div className="text-sm font-medium">No products found</div>
              <div className="text-xs mt-1">Try adjusting your search or filters</div>
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Action Buttons */}
      <div className="flex-shrink-0 px-4 py-2 flex items-center gap-2 flex-wrap" style={{ backgroundColor: '#E8F5E9' }}>
        <button onClick={handleModify} className="h-9 px-4 rounded text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-sm" style={{ backgroundColor: '#4CAF50' }}>
          <Edit2 className="h-3.5 w-3.5" /> Modify
        </button>
        <button onClick={handleNew} className="h-9 px-4 rounded bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition border border-slate-400">
          <Plus className="h-3.5 w-3.5" /> New
        </button>
        <button onClick={handleClone} className="h-9 px-4 rounded bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition border border-slate-400">
          <Copy className="h-3.5 w-3.5" /> Clone
        </button>
        <button onClick={() => { if (!selected) { toast({ title: "Select a product first", variant: "destructive" }); return; } setShowPicture(selected); }} className="h-9 px-4 rounded bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition border border-slate-400">
          <ImageIcon className="h-3.5 w-3.5" /> Picture
        </button>
        <button onClick={() => { if (!selected) { toast({ title: "Select a product first", variant: "destructive" }); return; } setShowHistory(selected); }} className="h-9 px-4 rounded bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition border border-slate-400">
          <History className="h-3.5 w-3.5" /> History
        </button>
        <button onClick={() => toast({ title: "Print Labels", description: selected ? `Print labels for ${selected.name}` : "Select a product first" })} className="h-9 px-4 rounded bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition border border-slate-400">
          <Tags className="h-3.5 w-3.5" /> Labels
        </button>
        <div className="flex-1" />
        <button onClick={() => {}} className="h-9 px-4 rounded text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-sm" style={{ backgroundColor: '#F44336' }}>
          <X className="h-3.5 w-3.5" /> Close (Esc)
        </button>
      </div>

      {/* Status Bar */}
      <div className="flex-shrink-0 px-4 py-1 flex items-center gap-4 text-[10px] text-slate-600 border-t border-slate-300" style={{ backgroundColor: '#E8F5E9' }}>
        <span>&lt; &gt;</span>
        <span className="font-mono">{filtered.length} of {products.length} products</span>
        <div className="flex-1" />
        <span><kbd className="px-1 bg-white border border-slate-300 rounded mr-1">F9</kbd>Part No.</span>
        <span><kbd className="px-1 bg-white border border-slate-300 rounded mr-1">F10</kbd>Details</span>
        <span><kbd className="px-1 bg-white border border-slate-300 rounded mr-1">Shift+F12</kbd>Print Labels</span>
      </div>

      {/* Product Form Modal */}
      <AnimatePresence>
        {showForm && (
          <ProductForm
            product={editingProduct}
            groups={groups}
            onSave={handleSave}
            onClose={() => { setShowForm(false); setEditingProduct(null); }}
          />
        )}
      </AnimatePresence>

      {/* Clone Confirmation */}
      <AnimatePresence>
        {showCloneConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-0 sm:p-4"
            onClick={() => setShowCloneConfirm(null)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="h-12 w-12 rounded-full bg-cyan-100 flex items-center justify-center">
                  <Copy className="h-6 w-6 text-cyan-600" />
                </div>
                <div>
                  <div className="font-bold text-slate-800">Clone Product?</div>
                  <div className="text-xs text-slate-500">A copy of "{showCloneConfirm.name}" will be created with 0 stock.</div>
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <Button variant="outline" className="flex-1" onClick={() => setShowCloneConfirm(null)}>Cancel</Button>
                <button onClick={confirmClone} className="flex-1 h-10 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white font-semibold text-sm transition">Clone Product</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Qty Quick Adjust */}
      <AnimatePresence>
        {showQtyAdjust && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-0 sm:p-4"
            onClick={() => setShowQtyAdjust(null)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="px-5 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ArrowUpDown className="h-5 w-5" />
                  <h3 className="font-bold">Adjust Quantity</h3>
                </div>
                <button onClick={() => setShowQtyAdjust(null)} className="h-8 w-8 rounded-lg bg-white/15 hover:bg-white/25 flex items-center justify-center"><X className="h-4 w-4" /></button>
              </div>
              <div className="p-5">
                <div className="flex items-center gap-3 mb-4 p-3 rounded-lg bg-slate-50">
                  <span className="text-3xl">{showQtyAdjust.emoji}</span>
                  <div>
                    <div className="font-bold text-slate-800">{showQtyAdjust.name}</div>
                    <div className="text-xs text-slate-500 font-mono">{showQtyAdjust.sku} · Current: {showQtyAdjust.stock}</div>
                  </div>
                </div>
                <QuickQtyAdjust
                  product={showQtyAdjust}
                  onConfirm={(newQty, reason) => {
                    const change = newQty - showQtyAdjust.stock;
                    setProducts(prev => prev.map(p => p.id === showQtyAdjust.id ? { ...p, stock: newQty } : p));
                    setHistory(prev => [...prev, {
                      id: `h-${Date.now()}`,
                      productId: showQtyAdjust.id,
                      productName: showQtyAdjust.name,
                      sku: showQtyAdjust.sku,
                      action: 'adjusted',
                      quantityChange: change,
                      newQuantity: newQty,
                      timestamp: new Date().toISOString(),
                      user: "Sarah Johnson",
                      reason: reason || `Qty adjusted to ${newQty}`,
                      reference: `ADJ-${Date.now().toString().slice(-6)}`,
                    }]);
                    toast({ title: "Quantity adjusted", description: `${showQtyAdjust.name}: ${showQtyAdjust.stock} → ${newQty}` });
                    setShowQtyAdjust(null);
                  }}
                  onCancel={() => setShowQtyAdjust(null)}
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Picture Modal */}
      <AnimatePresence>
        {showPicture && (
          <PictureModal
            product={showPicture}
            onSave={(imageData) => {
              setProducts(prev => prev.map(p => p.id === showPicture.id ? { ...p, image: imageData } : p));
              setHistory(prev => [...prev, {
                id: `h-${Date.now()}`,
                productId: showPicture.id,
                productName: showPicture.name,
                sku: showPicture.sku,
                action: 'modified',
                quantityChange: 0,
                newQuantity: showPicture.stock,
                timestamp: new Date().toISOString(),
                user: "Sarah Johnson",
                reason: imageData ? "Product picture updated" : "Product picture removed",
                reference: `PIC-${Date.now().toString().slice(-6)}`,
              }]);
              toast({ title: imageData ? "Picture saved" : "Picture removed", description: showPicture.name });
              setShowPicture(null);
            }}
            onClose={() => setShowPicture(null)}
          />
        )}
      </AnimatePresence>

      {/* Product History Modal */}
      <AnimatePresence>
        {showHistory && (
          <ProductHistoryModal
            product={showHistory}
            history={history.filter(h => h.productId === showHistory.id)}
            onClose={() => setShowHistory(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ===== Stock Search View =====
function StockSearchView({ products, groups, history }: {
  products: Product[];
  groups: StockGroup[];
  history: StockHistoryEntry[];
}) {
  const [searchText, setSearchText] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterGroup, setFilterGroup] = useState("all");
  const [filterGroup1, setFilterGroup1] = useState("all");
  const [filterGroup2, setFilterGroup2] = useState("all");
  const [filterGroup3, setFilterGroup3] = useState("all");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showPicture, setShowPicture] = useState<Product | null>(null);
  const [showHistory, setShowHistory] = useState<Product | null>(null);
  const { toast } = useToast();

  const filtered = products.filter(p => {
    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      if (!p.name.toLowerCase().includes(q) && !p.sku.toLowerCase().includes(q) && !p.barcode.includes(q) && !p.supplier.toLowerCase().includes(q)) return false;
    }
    if (filterType !== "all") {
      if (filterType === "taxable" && !p.taxable) return false;
      if (filterType === "non-taxable" && p.taxable) return false;
      if (filterType === "low-stock" && p.stock > p.reorderLevel) return false;
      if (filterType === "out-of-stock" && p.stock > 0) return false;
    }
    if (filterGroup !== "all" && p.groupId !== filterGroup) return false;
    return true;
  });

  const handleSelect = () => {
    if (!filtered[selectedIndex]) { toast({ title: "No product selected", variant: "destructive" }); return; }
    setSelectedProduct(filtered[selectedIndex]);
  };

  return (
    <div className="h-full overflow-hidden flex flex-col" style={{ backgroundColor: '#E8F5E9' }}>
      {/* Search & Filter Section */}
      <div className="flex-shrink-0 px-4 py-2 space-y-2" style={{ backgroundColor: '#E8F5E9' }}>
        {/* Search Row */}
        <div className="flex items-center gap-3">
          <label className="text-xs font-bold text-slate-700 whitespace-nowrap w-20">Search Text</label>
          <input
            value={searchText}
            onChange={(e) => { setSearchText(e.target.value); setSelectedIndex(0); }}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSelect(); }}
            placeholder="Details"
            className="flex-1 max-w-xs h-8 px-3 rounded border border-slate-400 bg-white text-sm outline-none focus:ring-2 focus:ring-blue-400"
          />
          <button
            onClick={() => setSelectedIndex(0)}
            className="h-8 px-4 rounded border border-slate-400 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold transition"
          >
            Search
          </button>
        </div>
        {/* Filter Row */}
        <div className="flex items-center gap-3 flex-wrap">
          <label className="text-xs font-bold text-slate-700 whitespace-nowrap w-20">Filter By</label>
          <FilterDropdown label="Type" value={filterType} onChange={(v) => { setFilterType(v); setSelectedIndex(0); }} options={[
            { value: "all", label: "All Types" },
            { value: "taxable", label: "Taxable (VAT)" },
            { value: "non-taxable", label: "Non-Taxable" },
            { value: "low-stock", label: "Low Stock" },
            { value: "out-of-stock", label: "Out of Stock" },
          ]} />
          <FilterDropdown label="Stock Group" value={filterGroup} onChange={(v) => { setFilterGroup(v); setSelectedIndex(0); }} options={[
            { value: "all", label: "All Groups" },
            ...groups.map(g => ({ value: g.id, label: `${g.icon} ${g.name}` })),
          ]} />
          <FilterDropdown label="Sub Group" value={filterGroup1} onChange={setFilterGroup1} options={[
            { value: "all", label: "All" },
            { value: "fresh", label: "Fresh Items" },
            { value: "packaged", label: "Packaged" },
            { value: "frozen", label: "Frozen" },
          ]} />
          <FilterDropdown label="Brand" value={filterGroup2} onChange={setFilterGroup2} options={[
            { value: "all", label: "All Brands" },
            { value: "local", label: "Local Brands" },
            { value: "imported", label: "Imported Brands" },
          ]} />
          <FilterDropdown label="Size" value={filterGroup3} onChange={setFilterGroup3} options={[
            { value: "all", label: "All Sizes" },
            { value: "small", label: "Small" },
            { value: "medium", label: "Medium" },
            { value: "large", label: "Large" },
          ]} />
        </div>
      </div>

      {/* Results Table */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0 bg-white border-t border-b border-slate-400">
        <div className="flex-shrink-0 grid grid-cols-[160px_1fr_60px_100px_100px] gap-1 px-3 py-1.5 text-slate-700 text-[11px] font-bold border-b border-slate-400" style={{ backgroundColor: '#F5F5F5' }}>
          <div>Part no</div>
          <div>Details</div>
          <div className="text-right">Qty</div>
          <div className="text-right">Retail GHC</div>
          <div className="text-right">Trade GHC</div>
        </div>
        <ScrollArea className="flex-1 min-h-0">
          <div>
            {filtered.map((p, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={p.id}
                  onClick={() => setSelectedIndex(idx)}
                  onDoubleClick={handleSelect}
                  className="grid grid-cols-[160px_1fr_60px_100px_100px] gap-1 px-3 py-1.5 text-xs cursor-pointer transition border-b border-slate-200"
                  style={{
                    backgroundColor: isSelected ? '#E3F2FD' : (idx % 2 === 1 ? '#FAFAFA' : '#FFFFFF'),
                    color: isSelected ? '#1565C0' : '#424242',
                  }}
                >
                  <div className="font-mono truncate">{p.barcode}</div>
                  <div className="truncate">{p.emoji} {p.name}</div>
                  <div className="text-right font-mono">{p.stock}</div>
                  <div className="text-right font-mono">{p.price.toFixed(2)}</div>
                  <div className="text-right font-mono">{p.costPrice.toFixed(2)}</div>
                </div>
              );
            })}
          </div>
          {filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <Search className="h-10 w-10 mb-2 opacity-40" />
              <div className="text-sm font-medium">No products found</div>
              <div className="text-xs mt-1">Try a different search term or filter</div>
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Action Buttons */}
      <div className="flex-shrink-0 px-4 py-2 flex items-center gap-2 flex-wrap" style={{ backgroundColor: '#E8F5E9' }}>
        <button onClick={handleSelect} className="h-9 px-4 rounded text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-sm" style={{ backgroundColor: '#4CAF50' }}>
          <CheckCircle2 className="h-3.5 w-3.5" /> Select (Enter)
        </button>
        <button onClick={() => toast({ title: "New Product", description: "Use Stock File to add new products" })} className="h-9 px-4 rounded bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition border border-slate-400">
          <Plus className="h-3.5 w-3.5" /> New
        </button>
        <button onClick={() => { if (!filtered[selectedIndex]) { toast({ title: "Select a product first", variant: "destructive" }); return; } setShowPicture(filtered[selectedIndex]); }} className="h-9 px-4 rounded bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition border border-slate-400">
          <ImageIcon className="h-3.5 w-3.5" /> Picture
        </button>
        <button onClick={() => { if (!filtered[selectedIndex]) { toast({ title: "Select a product first", variant: "destructive" }); return; } setShowHistory(filtered[selectedIndex]); }} className="h-9 px-4 rounded bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition border border-slate-400">
          <History className="h-3.5 w-3.5" /> History
        </button>
        <button onClick={() => toast({ title: "Print Labels", description: filtered[selectedIndex] ? `Print labels for ${filtered[selectedIndex].name}` : "Select a product first" })} className="h-9 px-4 rounded bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition border border-slate-400">
          <Tags className="h-3.5 w-3.5" /> Labels
        </button>
        <div className="flex-1" />
        <button onClick={() => {}} className="h-9 px-4 rounded text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-sm" style={{ backgroundColor: '#F44336' }}>
          <X className="h-3.5 w-3.5" /> Close (Esc)
        </button>
      </div>

      {/* Status Bar */}
      <div className="flex-shrink-0 px-4 py-1 flex items-center gap-4 text-[10px] text-slate-600 border-t border-slate-300" style={{ backgroundColor: '#E8F5E9' }}>
        <span>&lt; &gt;</span>
        <span className="font-mono">{filtered.length} of {products.length} products</span>
        <div className="flex-1" />
        <span><kbd className="px-1 bg-white border border-slate-300 rounded mr-1">F9</kbd>Part No.</span>
        <span><kbd className="px-1 bg-white border border-slate-300 rounded mr-1">F10</kbd>Details</span>
        <span><kbd className="px-1 bg-white border border-slate-300 rounded mr-1">Shift+F12</kbd>Print Labels</span>
      </div>

      {/* Product Detail Modal (on Select) */}
      <AnimatePresence>
        {selectedProduct && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-0 sm:p-4"
            onClick={() => setSelectedProduct(null)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="px-5 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileSearch className="h-5 w-5" />
                  <h3 className="font-bold">Product Details</h3>
                </div>
                <button onClick={() => setSelectedProduct(null)} className="h-8 w-8 rounded-lg bg-white/15 hover:bg-white/25 flex items-center justify-center"><X className="h-4 w-4" /></button>
              </div>
              <div className="p-5">
                <div className="text-center mb-4">
                  <div className="h-24 w-24 mx-auto rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center text-6xl mb-3">
                    {selectedProduct.emoji}
                  </div>
                  <div className="font-bold text-slate-800 text-lg">{selectedProduct.name}</div>
                  <div className="text-xs text-slate-400 font-mono">{selectedProduct.sku}</div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <DetailRow label="Part No." value={selectedProduct.barcode} />
                  <DetailRow label="Group" value={groups.find(g => g.id === selectedProduct.groupId)?.name || '-'} />
                  <DetailRow label="Retail GHC" value={selectedProduct.price.toFixed(2)} highlight />
                  <DetailRow label="Cost GHC" value={selectedProduct.costPrice.toFixed(2)} />
                  <DetailRow label="Quantity" value={`${selectedProduct.stock} ${selectedProduct.unit}`} />
                  <DetailRow label="Reorder Level" value={String(selectedProduct.reorderLevel)} />
                  <DetailRow label="Supplier" value={selectedProduct.supplier} />
                  <DetailRow label="Batch" value={selectedProduct.batchNumber} />
                  <DetailRow label="Expiry" value={selectedProduct.expiryDate} />
                  <DetailRow label="Taxable" value={selectedProduct.taxable ? "Yes (VAT)" : "No"} />
                </div>
                <button
                  onClick={() => setSelectedProduct(null)}
                  className="w-full mt-4 h-10 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Picture Modal (read-only in Search) */}
      <AnimatePresence>
        {showPicture && (
          <PictureModal
            product={showPicture}
            onSave={() => { setShowPicture(null); }}
            onClose={() => setShowPicture(null)}
          />
        )}
      </AnimatePresence>

      {/* Product History Modal */}
      <AnimatePresence>
        {showHistory && (
          <ProductHistoryModal
            product={showHistory}
            history={history.filter(h => h.productId === showHistory.id)}
            onClose={() => setShowHistory(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ===== Helper: Filter Dropdown =====
function FilterDropdown({ label, value, onChange, options }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] font-bold text-slate-700 uppercase">{label}:</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 px-2 rounded-md bg-white border border-slate-300 text-xs font-medium text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer hover:border-slate-400 transition"
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

// ===== Helper: Stock Action Button =====
function StockActionButton({ icon, label, color, onClick }: {
  icon: React.ReactNode;
  label: string;
  color: "emerald" | "blue" | "cyan" | "slate" | "purple" | "amber" | "indigo" | "rose";
  onClick: () => void;
}) {
  const colors = {
    emerald: "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 ring-emerald-200",
    blue: "bg-blue-100 text-blue-700 hover:bg-blue-200 ring-blue-200",
    cyan: "bg-cyan-100 text-cyan-700 hover:bg-cyan-200 ring-cyan-200",
    slate: "bg-slate-100 text-slate-700 hover:bg-slate-200 ring-slate-200",
    purple: "bg-purple-100 text-purple-700 hover:bg-purple-200 ring-purple-200",
    amber: "bg-amber-100 text-amber-700 hover:bg-amber-200 ring-amber-200",
    indigo: "bg-indigo-100 text-indigo-700 hover:bg-indigo-200 ring-indigo-200",
    rose: "bg-rose-100 text-rose-700 hover:bg-rose-200 ring-rose-200",
  };
  return (
    <button
      onClick={onClick}
      className={cn("h-9 px-3 rounded-lg flex items-center gap-1.5 text-xs font-semibold ring-1 transition", colors[color])}
    >
      {icon}
      {label}
    </button>
  );
}

// ===== Helper: Detail Row =====
function DetailRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between items-center py-1 px-2 rounded bg-slate-50">
      <span className="text-slate-500">{label}</span>
      <span className={cn("font-mono font-semibold", highlight ? "text-blue-600" : "text-slate-800")}>{value}</span>
    </div>
  );
}

// ===== Helper: Quick Quantity Adjust =====
function QuickQtyAdjust({ product, onConfirm, onCancel }: {
  product: Product;
  onConfirm: (newQty: number, reason: string) => void;
  onCancel: () => void;
}) {
  const [mode, setMode] = useState<"add" | "remove" | "set">("add");
  const [amount, setAmount] = useState(0);
  const [reason, setReason] = useState("");

  const newQty = mode === "add" ? product.stock + amount : mode === "remove" ? Math.max(0, product.stock - amount) : amount;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        {[{ id: "add", label: "Add" }, { id: "remove", label: "Remove" }, { id: "set", label: "Set" }].map(m => (
          <button
            key={m.id}
            onClick={() => setMode(m.id as any)}
            className={cn("py-2 rounded-lg text-xs font-bold ring-2 transition",
              mode === m.id ? "ring-indigo-500 bg-indigo-50 text-indigo-700" : "ring-slate-200 text-slate-600 hover:bg-slate-50")}
          >
            {m.label}
          </button>
        ))}
      </div>
      <div>
        <label className="text-xs font-semibold text-slate-600 mb-1 block">Amount</label>
        <input
          type="number"
          value={amount || ""}
          onChange={(e) => setAmount(parseInt(e.target.value) || 0)}
          className="w-full h-10 px-3 rounded-lg border-2 border-slate-200 focus:border-indigo-500 outline-none text-lg font-mono font-bold text-center"
          placeholder="0"
        />
      </div>
      <div>
        <label className="text-xs font-semibold text-slate-600 mb-1 block">Reason (optional)</label>
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="w-full h-10 px-3 rounded-lg border border-slate-200 focus:border-indigo-500 outline-none text-sm"
          placeholder="e.g. Damaged, received, recount"
        />
      </div>
      <div className="p-3 rounded-lg bg-slate-800 text-white flex justify-between items-center">
        <span className="text-xs font-semibold uppercase opacity-80">New Quantity</span>
        <span className="text-2xl font-bold font-mono text-indigo-400">{newQty}</span>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" onClick={onCancel}>Cancel</Button>
        <button
          onClick={() => amount > 0 && onConfirm(newQty, reason)}
          disabled={amount <= 0 && mode !== "set"}
          className="flex-1 h-10 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Confirm
        </button>
      </div>
    </div>
  );
}

// ===== Picture Modal =====
function PictureModal({ product, onSave, onClose }: {
  product: Product;
  onSave: (imageData: string | undefined) => void;
  onClose: () => void;
}) {
  const [imageData, setImageData] = useState<string | undefined>(product.image);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      setImageData(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
      >
        <div className="px-5 py-3 bg-gradient-to-r from-slate-600 to-slate-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5" />
            <h3 className="font-bold">Product Picture</h3>
          </div>
          <button onClick={onClose} className="h-8 w-8 rounded-lg bg-white/15 hover:bg-white/25 flex items-center justify-center"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-5">
          <div className="flex items-center gap-3 mb-4 p-3 rounded-lg bg-slate-50">
            <span className="text-3xl">{product.emoji}</span>
            <div>
              <div className="font-bold text-slate-800">{product.name}</div>
              <div className="text-xs text-slate-500 font-mono">{product.sku}</div>
            </div>
          </div>

          {/* Image Preview / Upload Area */}
          {imageData ? (
            <div className="relative mb-4 group">
              <img src={imageData} alt={product.name} className="w-full h-48 object-contain rounded-xl bg-slate-50 ring-1 ring-slate-200" />
              <button
                onClick={() => setImageData(undefined)}
                className="absolute top-2 right-2 h-8 w-8 rounded-full bg-rose-500 text-white hover:bg-rose-600 flex items-center justify-center transition opacity-0 group-hover:opacity-100"
                title="Remove picture"
              >
                <Trash2 className="h-4 w-4" />
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-2 right-2 h-8 px-3 rounded-lg bg-white/90 text-slate-700 hover:bg-white text-xs font-semibold flex items-center gap-1 transition opacity-0 group-hover:opacity-100"
              >
                <ImageIcon className="h-3.5 w-3.5" />
                Change
              </button>
            </div>
          ) : (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "h-48 rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition mb-4",
                dragOver ? "border-emerald-500 bg-emerald-50" : "border-slate-300 bg-slate-50 hover:border-slate-400 hover:bg-slate-100"
              )}
            >
              <ImageIcon className={cn("h-10 w-10 mb-2 transition", dragOver ? "text-emerald-500" : "text-slate-400")} />
              <div className="text-sm font-semibold text-slate-600">
                {dragOver ? "Drop image here" : "Click to upload or drag & drop"}
              </div>
              <div className="text-xs text-slate-400 mt-1">PNG, JPG, GIF up to 2MB</div>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
            <button
              onClick={() => onSave(imageData)}
              className="flex-1 h-10 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm transition"
            >
              {imageData ? "Save Picture" : "Remove Picture"}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ===== Product History Modal =====
function ProductHistoryModal({ product, history, onClose }: {
  product: Product;
  history: StockHistoryEntry[];
  onClose: () => void;
}) {
  const sortedHistory = [...history].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const actionColors: Record<string, string> = {
    added: "bg-emerald-100 text-emerald-700",
    modified: "bg-blue-100 text-blue-700",
    adjusted: "bg-amber-100 text-amber-700",
    sold: "bg-purple-100 text-purple-700",
    received: "bg-cyan-100 text-cyan-700",
    removed: "bg-rose-100 text-rose-700",
    reordered: "bg-orange-100 text-orange-700",
  };

  const totalIn = history.filter(h => h.quantityChange > 0).reduce((s, h) => s + h.quantityChange, 0);
  const totalOut = history.filter(h => h.quantityChange < 0).reduce((s, h) => s + Math.abs(h.quantityChange), 0);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] sm:max-h-[85vh] overflow-hidden flex flex-col"
      >
        <div className="px-5 py-3 bg-gradient-to-r from-purple-600 to-violet-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5" />
            <h3 className="font-bold">Product History</h3>
          </div>
          <button onClick={onClose} className="h-8 w-8 rounded-lg bg-white/15 hover:bg-white/25 flex items-center justify-center"><X className="h-4 w-4" /></button>
        </div>

        {/* Product Info */}
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-3">
          <span className="text-3xl">{product.emoji}</span>
          <div className="flex-1">
            <div className="font-bold text-slate-800">{product.name}</div>
            <div className="text-xs text-slate-500 font-mono">{product.sku} · {product.barcode}</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-slate-500 uppercase">Current Stock</div>
            <div className="text-lg font-bold text-slate-800">{product.stock} {product.unit}</div>
          </div>
        </div>

        {/* Stats */}
        <div className="px-5 py-2.5 bg-white border-b border-slate-200 grid grid-cols-3 gap-2">
          <div className="text-center p-2 rounded-lg bg-emerald-50">
            <div className="text-[10px] text-slate-500 uppercase">Total In</div>
            <div className="text-base font-bold text-emerald-600">+{totalIn}</div>
          </div>
          <div className="text-center p-2 rounded-lg bg-rose-50">
            <div className="text-[10px] text-slate-500 uppercase">Total Out</div>
            <div className="text-base font-bold text-rose-600">-{totalOut}</div>
          </div>
          <div className="text-center p-2 rounded-lg bg-blue-50">
            <div className="text-[10px] text-slate-500 uppercase">Transactions</div>
            <div className="text-base font-bold text-blue-600">{history.length}</div>
          </div>
        </div>

        {/* Timeline */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="p-4 space-y-2">
            {sortedHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                <History className="h-10 w-10 mb-2 opacity-40" />
                <div className="text-sm font-medium">No history yet</div>
                <div className="text-xs mt-1">This product has no recorded movements</div>
              </div>
            ) : (
              sortedHistory.map((h, i) => (
                <motion.div
                  key={h.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: Math.min(i * 0.03, 0.3) }}
                  className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition"
                >
                  <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center text-[10px] font-bold uppercase flex-shrink-0", actionColors[h.action] || "bg-slate-100 text-slate-700")}>
                    {h.action.slice(0, 3)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-slate-800">{h.reason}</div>
                    <div className="text-[11px] text-slate-500">
                      {new Date(h.timestamp).toLocaleString('en-GB')} · {h.user} · Ref: {h.reference}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className={cn("font-mono font-bold text-sm", h.quantityChange > 0 ? "text-emerald-600" : h.quantityChange < 0 ? "text-rose-600" : "text-slate-600")}>
                      {h.quantityChange > 0 ? "+" : ""}{h.quantityChange}
                    </div>
                    <div className="text-[10px] text-slate-400">→ {h.newQuantity}</div>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </ScrollArea>

        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex justify-end">
          <Button variant="outline" onClick={onClose}>Close</Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ===== Stock Quantity Report Modal =====
export function StockQtyReportModal({ products, groups, onClose }: {
  products: Product[];
  groups: StockGroup[];
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [location, setLocation] = useState("all");
  const [fromPartNo, setFromPartNo] = useState("");
  const [toPartNo, setToPartNo] = useState("");
  const [supplier, setSupplier] = useState("all");
  const [sortOrder, setSortOrder] = useState("part-number");
  const [stockGroup, setStockGroup] = useState("all");
  const [group1, setGroup1] = useState("all");
  const [group2, setGroup2] = useState("all");
  const [group3, setGroup3] = useState("all");
  const [reportType, setReportType] = useState("detailed");
  const [consignmentOut, setConsignmentOut] = useState(true);
  const [consignmentIn, setConsignmentIn] = useState(true);
  const [includeZeroQty, setIncludeZeroQty] = useState(false);
  const [includeNegativeQty, setIncludeNegativeQty] = useState(false);
  const [generatedReport, setGeneratedReport] = useState<ReportData | null>(null);

  // Get unique suppliers from products
  const suppliers = Array.from(new Set(products.map(p => p.supplier)));

  // Filter products based on form criteria
  const getFilteredProducts = (): Product[] => {
    let result = products;
    if (fromPartNo.trim()) {
      result = result.filter(p => p.barcode >= fromPartNo || p.sku.toLowerCase() >= fromPartNo.toLowerCase());
    }
    if (toPartNo.trim()) {
      result = result.filter(p => p.barcode <= toPartNo || p.sku.toLowerCase() <= toPartNo.toLowerCase());
    }
    if (supplier !== "all") {
      result = result.filter(p => p.supplier === supplier);
    }
    if (stockGroup !== "all") {
      result = result.filter(p => p.groupId === stockGroup);
    }
    if (!includeZeroQty) {
      result = result.filter(p => p.stock !== 0);
    }
    if (!includeNegativeQty) {
      result = result.filter(p => p.stock >= 0);
    }
    // Sort
    if (sortOrder === "part-number") {
      result = [...result].sort((a, b) => a.barcode.localeCompare(b.barcode));
    } else if (sortOrder === "details") {
      result = [...result].sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortOrder === "qty-ascending") {
      result = [...result].sort((a, b) => a.stock - b.stock);
    } else if (sortOrder === "qty-descending") {
      result = [...result].sort((a, b) => b.stock - a.stock);
    } else if (sortOrder === "retail-price") {
      result = [...result].sort((a, b) => a.price - b.price);
    } else if (sortOrder === "cost-price") {
      result = [...result].sort((a, b) => a.costPrice - b.costPrice);
    }
    return result;
  };

  // Generate the report data based on filters
  const buildReport = (): ReportData => {
    const filtered = getFilteredProducts();
    const isSummary = reportType === "summary";
    return {
      type: "stock-qty-report",
      title: "Stock Quantity Report",
      subtitle: `${reportType === "detailed" ? "Detailed" : "Summary"} report · ${filtered.length} products · ${new Date().toLocaleDateString('en-GB')}`,
      columns: isSummary ? [
        { key: "sku", label: "Part No." },
        { key: "name", label: "Details" },
        { key: "qty", label: "Qty", align: "right" as const },
      ] : [
        { key: "sku", label: "Part No." },
        { key: "name", label: "Details" },
        { key: "group", label: "Stock Group" },
        { key: "supplier", label: "Supplier" },
        { key: "unit", label: "Unit", align: "center" as const },
        { key: "qty", label: "Qty", align: "right" as const },
        { key: "reorderLevel", label: "Reorder Level", align: "right" as const },
        { key: "retail", label: "Retail GHC", align: "right" as const },
        { key: "cost", label: "Cost GHC", align: "right" as const },
        { key: "status", label: "Status", align: "center" as const },
      ],
      rows: filtered.map(p => isSummary ? {
        sku: p.barcode, name: `${p.emoji} ${p.name}`, qty: p.stock,
      } : {
        sku: p.barcode,
        name: `${p.emoji} ${p.name}`,
        group: groups.find(g => g.id === p.groupId)?.name || "-",
        supplier: p.supplier,
        unit: p.unit,
        qty: p.stock,
        reorderLevel: p.reorderLevel,
        retail: p.price.toFixed(2),
        cost: p.costPrice.toFixed(2),
        status: p.stock === 0 ? "OUT OF STOCK" : p.stock <= p.reorderLevel ? "LOW STOCK" : "OK",
      }),
      summary: [
        { label: "Total Products", value: String(filtered.length) },
        { label: "Total Quantity", value: String(filtered.reduce((s, p) => s + p.stock, 0)) },
        { label: "Total Retail Value", value: formatGHS(filtered.reduce((s, p) => s + p.price * p.stock, 0)) },
        { label: "Total Cost Value", value: formatGHS(filtered.reduce((s, p) => s + p.costPrice * p.stock, 0)) },
        { label: "Low Stock Items", value: String(filtered.filter(p => p.stock > 0 && p.stock <= p.reorderLevel).length) },
        { label: "Out of Stock", value: String(filtered.filter(p => p.stock === 0).length) },
      ],
    };
  };

  const handleScreen = () => {
    const report = buildReport();
    setGeneratedReport(report);
    toast({ title: "Report generated", description: `${report.rows.length} records on screen` });
  };

  const handlePrinter = () => {
    const report = buildReport();
    printReport(report);
    toast({ title: "Printing report (F3)", description: `${report.rows.length} records` });
  };

  const handleFile = () => {
    const report = buildReport();
    // Export to Excel by default
    exportReportToExcel(report);
    toast({ title: "Report exported", description: "Saved as Excel file" });
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-0 sm:p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.95, y: 20 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-hidden flex flex-col"
          style={{ backgroundColor: '#C8E6D0' }}
        >
          {/* Header - Windows-style title bar */}
          <div className="flex-shrink-0 flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-blue-600 to-blue-500 text-white">
            <div className="flex items-center gap-2">
              <FileBarChart className="h-5 w-5" />
              <h3 className="font-bold text-base">Stock Qty Report</h3>
            </div>
            <div className="flex items-center gap-1">
              <button className="h-6 w-6 rounded bg-white/15 hover:bg-white/25 flex items-center justify-center text-xs">─</button>
              <button className="h-6 w-6 rounded bg-white/15 hover:bg-white/25 flex items-center justify-center text-xs">□</button>
              <button onClick={onClose} className="h-6 w-6 rounded bg-white/15 hover:bg-rose-500 flex items-center justify-center transition">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Form Content */}
          <div className="flex-1 overflow-y-auto p-6" style={{ backgroundColor: '#C8E6D0' }}>
            <div className="bg-white/40 rounded-lg p-5 ring-1 ring-emerald-200/50 space-y-3">
              {/* Location */}
              <FormRow label="Location">
                <select value={location} onChange={(e) => setLocation(e.target.value)} className="qty-form-input">
                  <option value="all">All Locations</option>
                  <option value="main-store">Main Store</option>
                  <option value="warehouse">Warehouse</option>
                  <option value="shop-floor">Shop Floor</option>
                </select>
              </FormRow>

              {/* From / To Part No. */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormRow label="From Part No.">
                  <input value={fromPartNo} onChange={(e) => setFromPartNo(e.target.value)} placeholder="e.g. 941563812092" className="qty-form-input" />
                </FormRow>
                <FormRow label="To Part No.">
                  <input value={toPartNo} onChange={(e) => setToPartNo(e.target.value)} placeholder="e.g. 941563812181" className="qty-form-input" />
                </FormRow>
              </div>

              {/* Supplier */}
              <FormRow label="Supplier">
                <select value={supplier} onChange={(e) => setSupplier(e.target.value)} className="qty-form-input">
                  <option value="all">All Suppliers</option>
                  {suppliers.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </FormRow>

              {/* Sort Order */}
              <FormRow label="Sort Order">
                <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} className="qty-form-input">
                  <option value="part-number">Part Number</option>
                  <option value="details">Details (Name)</option>
                  <option value="qty-ascending">Quantity (Ascending)</option>
                  <option value="qty-descending">Quantity (Descending)</option>
                  <option value="retail-price">Retail Price</option>
                  <option value="cost-price">Cost Price</option>
                </select>
              </FormRow>

              {/* Stock Group */}
              <FormRow label="Stock Group">
                <select value={stockGroup} onChange={(e) => setStockGroup(e.target.value)} className="qty-form-input">
                  <option value="all">All Groups</option>
                  {groups.map(g => <option key={g.id} value={g.id}>{g.icon} {g.name}</option>)}
                </select>
              </FormRow>

              {/* Group 1 / 2 / 3 */}
              <div className="grid grid-cols-3 gap-3">
                <FormRow label="Group1">
                  <select value={group1} onChange={(e) => setGroup1(e.target.value)} className="qty-form-input">
                    <option value="all">All</option>
                    <option value="fresh">Fresh Items</option>
                    <option value="packaged">Packaged</option>
                    <option value="frozen">Frozen</option>
                  </select>
                </FormRow>
                <FormRow label="Group2">
                  <select value={group2} onChange={(e) => setGroup2(e.target.value)} className="qty-form-input">
                    <option value="all">All</option>
                    <option value="fast-moving">Fast Moving</option>
                    <option value="slow-moving">Slow Moving</option>
                  </select>
                </FormRow>
                <FormRow label="Group3">
                  <select value={group3} onChange={(e) => setGroup3(e.target.value)} className="qty-form-input">
                    <option value="all">All</option>
                    <option value="high-value">High Value</option>
                    <option value="low-value">Low Value</option>
                  </select>
                </FormRow>
              </div>

              {/* Report Type */}
              <FormRow label="Report Type">
                <select value={reportType} onChange={(e) => setReportType(e.target.value)} className="qty-form-input">
                  <option value="detailed">Detailed</option>
                  <option value="summary">Summary</option>
                </select>
              </FormRow>

              {/* Checkboxes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-emerald-200/50 mt-3">
                <CheckboxRow label="Consignment Out" checked={consignmentOut} onChange={setConsignmentOut} />
                <CheckboxRow label="Consignment In" checked={consignmentIn} onChange={setConsignmentIn} />
                <CheckboxRow label="Include Zero Qty" checked={includeZeroQty} onChange={setIncludeZeroQty} />
                <CheckboxRow label="Include -ve Qty" checked={includeNegativeQty} onChange={setIncludeNegativeQty} />
              </div>
            </div>
          </div>

          {/* Button Bar */}
          <div className="flex-shrink-0 px-6 py-3 flex items-center justify-center gap-3 border-t border-emerald-300/50" style={{ backgroundColor: '#B8DCC0' }}>
            <QtyActionButton icon={<Monitor className="h-5 w-5" />} label="Screen" color="blue" onClick={handleScreen} />
            <QtyActionButton icon={<Printer className="h-5 w-5" />} label="Printer" sub="F3" color="blue" onClick={handlePrinter} />
            <QtyActionButton icon={<Folder className="h-5 w-5" />} label="File" color="blue" onClick={handleFile} />
            <QtyActionButton icon={<X className="h-5 w-5" />} label="Close" sub="Esc" color="rose" onClick={onClose} />
          </div>
        </motion.div>
      </motion.div>

      {/* Generated Report Viewer */}
      <AnimatePresence>
        {generatedReport && (
          <QtyReportViewer report={generatedReport} onClose={() => setGeneratedReport(null)} />
        )}
      </AnimatePresence>

      <style jsx>{`
        :global(.qty-form-input) {
          width: 100%;
          height: 2.25rem;
          padding: 0 0.625rem;
          border-radius: 0.375rem;
          border: 1px solid rgb(148 163 184);
          background: white;
          font-size: 0.8125rem;
          color: rgb(30 41 59);
          outline: none;
          transition: all 0.15s;
        }
        :global(.qty-form-input:focus) {
          border-color: rgb(37 99 235);
          box-shadow: 0 0 0 2px rgb(37 99 235 / 0.2);
        }
      `}</style>
    </>
  );
}

// ===== Helper: Form Row =====
function FormRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <label className="text-xs font-semibold text-slate-700 w-28 flex-shrink-0 text-right">{label}:</label>
      <div className="flex-1">{children}</div>
    </div>
  );
}

// ===== Helper: Checkbox Row =====
function CheckboxRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-slate-400 accent-blue-600"
      />
      {label}
    </label>
  );
}

// ===== Helper: Qty Action Button =====
function QtyActionButton({ icon, label, sub, color, onClick }: {
  icon: React.ReactNode;
  label: string;
  sub?: string;
  color: "blue" | "rose";
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1 px-6 py-2.5 rounded-lg bg-white border-2 transition shadow-sm hover:shadow-md",
        color === "blue" ? "border-blue-300 text-blue-700 hover:bg-blue-50 hover:border-blue-500" : "border-rose-300 text-rose-700 hover:bg-rose-50 hover:border-rose-500"
      )}
    >
      {icon}
      <span className="text-xs font-bold flex items-center gap-1">
        {label}
        {sub && <kbd className="text-[9px] font-mono bg-slate-100 px-1 rounded">{sub}</kbd>}
      </span>
    </button>
  );
}

// ===== Qty Report Viewer (Screen output) =====
function QtyReportViewer({ report, onClose }: { report: ReportData; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60] flex items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] overflow-hidden flex flex-col"
      >
        {/* Company Header */}
        <div className="flex-shrink-0 px-6 py-3 bg-gradient-to-r from-emerald-700 to-emerald-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-white/15 flex items-center justify-center font-bold text-lg">S</div>
            <div>
              <div className="font-bold text-base">{COMPANY.name}</div>
              <div className="text-xs text-emerald-100/90">{COMPANY.address} · {COMPANY.contact}</div>
            </div>
          </div>
          <button onClick={onClose} className="h-8 w-8 rounded-lg bg-white/15 hover:bg-white/25 flex items-center justify-center">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Report Title */}
        <div className="flex-shrink-0 px-6 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div>
            <div className="font-bold text-slate-800">{report.title}</div>
            <div className="text-xs text-slate-500">{report.subtitle}</div>
          </div>
          <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">{report.rows.length} records</Badge>
        </div>

        {/* Table */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="mobile-scroll-x">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-slate-700 text-white text-[10px] uppercase tracking-wide z-10">
              <tr>
                {report.columns.map(col => (
                  <th key={col.key} className={cn("px-3 py-2 font-bold", col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left")}>
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {report.rows.map((row, i) => (
                <tr key={i} className={cn("hover:bg-emerald-50/50", i % 2 === 1 && "bg-slate-50")}>
                  {report.columns.map(col => {
                    const val = row[col.key];
                    const display = col.format ? col.format(val, row) : (val ?? "");
                    return (
                      <td key={col.key} className={cn("px-3 py-1.5", col.align === "right" ? "text-right font-mono" : col.align === "center" ? "text-center" : "text-left")}>
                        {display}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </ScrollArea>

        {/* Summary */}
        <div className="flex-shrink-0 px-6 py-3 bg-gradient-to-r from-emerald-50 to-teal-50 border-t border-emerald-200">
          <div className="grid grid-cols-6 gap-2">
            {report.summary.map((s, i) => (
              <div key={i} className="bg-white rounded-lg px-2.5 py-1.5 ring-1 ring-emerald-100 text-center">
                <div className="text-[9px] text-slate-500 uppercase">{s.label}</div>
                <div className="text-xs font-bold text-emerald-700 font-mono">{s.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Export Buttons */}
        <div className="flex-shrink-0 px-6 py-2.5 bg-white border-t border-slate-200 flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500 uppercase mr-2">Export:</span>
          <button onClick={() => printReport(report)} className="h-8 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1.5">
            <Printer className="h-3.5 w-3.5" /> Print
          </button>
          <button onClick={() => exportReportToPDF(report)} className="h-8 px-3 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5" /> PDF
          </button>
          <button onClick={() => exportReportToExcel(report)} className="h-8 px-3 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-700 text-xs font-semibold flex items-center gap-1.5">
            <Folder className="h-3.5 w-3.5" /> Excel
          </button>
          <button onClick={() => exportReportToCSV(report)} className="h-8 px-3 rounded-lg bg-blue-100 hover:bg-blue-200 text-blue-700 text-xs font-semibold flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5" /> CSV
          </button>
          <div className="flex-1" />
          <button onClick={onClose} className="h-8 px-4 rounded-lg bg-slate-700 hover:bg-slate-800 text-white text-xs font-semibold">
            Close
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ===== Stocktake Dashboard Popup =====
// Shows the 5 most recent stocktake/adjustment events with their variances,
// providing management oversight at a glance.
function StocktakeDashboard({
  history,
  products,
  stocktakeStatus,
  scheduleFreq,
  onClose,
  onStartStocktake,
  onNavigateToPurchase,
}: {
  history: StockHistoryEntry[];
  products: Product[];
  stocktakeStatus: { lastDate: string | null; lastReference: string | null; isOverdue: boolean; daysOverdue: number; nextDueDate: string; message: string };
  scheduleFreq: 'weekly' | 'biweekly' | 'monthly' | 'quarterly';
  onClose: () => void;
  onStartStocktake: () => void;
  onNavigateToPurchase?: () => void;
}) {
  const { toast } = useToast();

  // ===== Notification settings (persisted to localStorage) =====
  const NOTIFY_KEY = 'sylhn-stocktake-notifications';
  const [notifyEmails, setNotifyEmails] = useState('');
  const [notifyPhones, setNotifyPhones] = useState('');
  const [notifyEmailEnabled, setNotifyEmailEnabled] = useState(true);
  const [notifySmsEnabled, setNotifySmsEnabled] = useState(false);
  const [showNotifySettings, setShowNotifySettings] = useState(false);

  // ===== Email digest settings (daily/weekly summary of stocktake activity) =====
  const [digestEnabled, setDigestEnabled] = useState(false);
  const [digestFreq, setDigestFreq] = useState<'daily' | 'weekly'>('daily');
  const [lastDigestSent, setLastDigestSent] = useState<string>(''); // ISO date of last sent digest

  // Load notification settings on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const cached = window.localStorage.getItem(NOTIFY_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        setNotifyEmails(parsed.emails || '');
        setNotifyPhones(parsed.phones || '');
        setNotifyEmailEnabled(parsed.emailEnabled !== false);
        setNotifySmsEnabled(parsed.smsEnabled === true);
        setDigestEnabled(parsed.digestEnabled === true);
        setDigestFreq(parsed.digestFreq === 'weekly' ? 'weekly' : 'daily');
        setLastDigestSent(parsed.lastDigestSent || '');
      }
    } catch { /* ignore */ }
  }, []);

  // Persist notification settings (including digest config)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(NOTIFY_KEY, JSON.stringify({
        emails: notifyEmails, phones: notifyPhones,
        emailEnabled: notifyEmailEnabled, smsEnabled: notifySmsEnabled,
        digestEnabled, digestFreq, lastDigestSent,
      }));
    } catch { /* ignore */ }
  }, [notifyEmails, notifyPhones, notifyEmailEnabled, notifySmsEnabled, digestEnabled, digestFreq, lastDigestSent]);

  // ===== Send email digest of stocktake activity =====
  const sendDigest = (mode: 'test' | 'real') => {
    const emails = notifyEmails.split(',').map(s => s.trim()).filter(Boolean);
    if (mode === 'real' && emails.length === 0) {
      toast({ title: 'No recipients', description: 'Add at least one email in the notification settings', variant: 'destructive' });
      return;
    }

    // Build digest summary from stocktake events
    const period = digestFreq === 'daily' ? '24 hours' : '7 days';
    const cutoff = new Date(Date.now() - (digestFreq === 'daily' ? 24 : 7 * 24) * 60 * 60 * 1000);
    const recentEvents = stocktakeEvents.filter(e => new Date(e.timestamp) >= cutoff);
    const totalVariance = recentEvents.reduce((s, e) => s + e.totalVariance, 0);
    const totalSurplus = recentEvents.reduce((s, e) => s + e.surplusItems, 0);
    const totalShortage = recentEvents.reduce((s, e) => s + e.shortageItems, 0);
    const totalItems = recentEvents.reduce((s, e) => s + e.itemCount, 0);

    const subject = encodeURIComponent(`[SYLHN POS] Stocktake Digest — ${digestFreq === 'daily' ? 'Daily' : 'Weekly'} Summary`);
    const body = encodeURIComponent(
      `STOCKTAKE ACTIVITY DIGEST (${digestFreq === 'daily' ? 'Daily' : 'Weekly'})\n` +
      `Period: last ${period}\n` +
      `Generated: ${new Date().toLocaleString('en-GB')}\n\n` +
      `SUMMARY\n` +
      `=======\n` +
      `Stocktake events performed: ${recentEvents.length}\n` +
      `Total items adjusted: ${totalItems}\n` +
      `Total surplus items: ${totalSurplus}\n` +
      `Total shortage items: ${totalShortage}\n` +
      `Net variance: ${totalVariance > 0 ? '+' : ''}${totalVariance}\n\n` +
      `RECENT EVENTS\n` +
      `=============\n` +
      (recentEvents.length === 0
        ? 'No stocktake events in this period.\n'
        : recentEvents.slice(0, 10).map((e, i) =>
            `${i + 1}. ${e.reference} — ${new Date(e.timestamp).toLocaleDateString('en-GB')}\n` +
            `   Items: ${e.itemCount} · Variance: ${e.totalVariance > 0 ? '+' : ''}${e.totalVariance} · Surplus: ${e.surplusItems} · Shortage: ${e.shortageItems}`
          ).join('\n')) +
      (recentEvents.length > 10 ? `\n... and ${recentEvents.length - 10} more event(s)` : '') +
      `\n\nSCHEDULE STATUS\n` +
      `===============\n` +
      `Schedule: ${scheduleFreq}\n` +
      `Currently overdue: ${stocktakeStatus.isOverdue ? `YES (${stocktakeStatus.daysOverdue} days)` : 'No'}\n` +
      `Next due: ${stocktakeStatus.nextDueDate}\n` +
      `Last stocktake: ${stocktakeStatus.lastDate ? new Date(stocktakeStatus.lastDate).toLocaleDateString('en-GB') : 'Never'}\n\n` +
      `— SYLHN COMPANY LTD POS System\n${COMPANY.address} · ${COMPANY.contact}`
    );

    if (mode === 'real' && emails.length > 0) {
      try {
        window.open(`mailto:${emails.join(',')}?subject=${subject}&body=${body}`, '_blank');
      } catch { /* ignore */ }
      setLastDigestSent(new Date().toISOString());
      toast({
        title: `${digestFreq === 'daily' ? 'Daily' : 'Weekly'} digest sent`,
        description: `${recentEvents.length} events · ${emails.length} recipient(s)`,
      });
    } else {
      // Test mode — just show the summary in a toast
      toast({
        title: `Test digest (${digestFreq === 'daily' ? 'Daily' : 'Weekly'})`,
        description: `${recentEvents.length} events · ${totalItems} items · Variance: ${totalVariance > 0 ? '+' : ''}${totalVariance}`,
      });
    }
  };

  // ===== Send overdue notification (email + SMS) =====
  const sendOverdueNotification = (mode: 'test' | 'real') => {
    if (!stocktakeStatus.isOverdue) {
      toast({ title: 'Not overdue', description: 'Stocktake is not currently overdue — no notification to send', variant: 'destructive' });
      return;
    }
    const emails = notifyEmails.split(',').map(s => s.trim()).filter(Boolean);
    const phones = notifyPhones.split(',').map(s => s.trim()).filter(Boolean);

    if (mode === 'real') {
      if (notifyEmailEnabled && emails.length === 0 && notifySmsEnabled && phones.length === 0) {
        toast({ title: 'No recipients', description: 'Add at least one email or phone number in notification settings', variant: 'destructive' });
        return;
      }
    }

    const subject = encodeURIComponent(`[SYLHN POS] Stocktake Overdue — ${stocktakeStatus.daysOverdue} day(s)`);
    const body = encodeURIComponent(
      `STOCKTAKE OVERDUE ALERT\n\n` +
      `Days overdue: ${stocktakeStatus.daysOverdue}\n` +
      `Last stocktake: ${stocktakeStatus.lastDate ? new Date(stocktakeStatus.lastDate).toLocaleDateString('en-GB') : 'Never'}\n` +
      `Last reference: ${stocktakeStatus.lastReference || '—'}\n` +
      `Schedule frequency: ${scheduleFreq}\n` +
      `Next due date: ${stocktakeStatus.nextDueDate}\n\n` +
      `Action required: Please perform a stocktake as soon as possible to maintain inventory accuracy.\n\n` +
      `— SYLHN COMPANY LTD POS System\n${COMPANY.address} · ${COMPANY.contact}`
    );

    let sentChannels: string[] = [];

    if (notifyEmailEnabled && emails.length > 0) {
      const to = mode === 'test' ? '' : emails.join(',');
      const bcc = mode === 'test' ? emails.join(',') : '';
      window.location.href = `mailto:${to}?bcc=${bcc}&subject=${subject}&body=${body}`;
      sentChannels.push(`Email to ${emails.length} recipient(s)`);
    }

    if (notifySmsEnabled && phones.length > 0) {
      // SMS via sms: URI (works on mobile devices; on desktop, just show a toast)
      const smsBody = encodeURIComponent(
        `[SYLHN POS] Stocktake OVERDUE by ${stocktakeStatus.daysOverdue} day(s). Last: ${stocktakeStatus.lastReference || 'Never'}. Please perform stocktake now.`
      );
      try {
        // Open SMS composer for the first phone (browsers limit multi-recipient SMS)
        if (mode === 'real' && phones.length > 0) {
          window.location.href = `sms:${phones[0]}?body=${smsBody}`;
        }
      } catch { /* sms: URI not supported */ }
      sentChannels.push(`SMS to ${phones.length} phone(s)`);
    }

    if (sentChannels.length === 0) {
      toast({ title: 'No channels enabled', description: 'Enable Email or SMS in notification settings', variant: 'destructive' });
      return;
    }

    toast({
      title: mode === 'test' ? 'Test notification sent' : 'Overdue notification sent',
      description: sentChannels.join(' · '),
    });
  };

  // ===== Group history entries by reference (only adjusted entries) =====
  const stocktakeEvents = useMemo(() => {
    const groups = new Map<string, {
      reference: string;
      timestamp: string;
      entries: StockHistoryEntry[];
      totalVariance: number;
      itemCount: number;
      surplusItems: number;
      shortageItems: number;
    }>();
    history.forEach(h => {
      if (h.action !== 'adjusted' || !h.reference) return;
      const existing = groups.get(h.reference);
      if (existing) {
        existing.entries.push(h);
        existing.totalVariance += h.quantityChange;
        existing.itemCount += 1;
        if (h.quantityChange > 0) existing.surplusItems += 1;
        else if (h.quantityChange < 0) existing.shortageItems += 1;
        if (h.timestamp > existing.timestamp) existing.timestamp = h.timestamp;
      } else {
        groups.set(h.reference, {
          reference: h.reference,
          timestamp: h.timestamp,
          entries: [h],
          totalVariance: h.quantityChange,
          itemCount: 1,
          surplusItems: h.quantityChange > 0 ? 1 : 0,
          shortageItems: h.quantityChange < 0 ? 1 : 0,
        });
      }
    });
    return Array.from(groups.values()).sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }, [history]);

  // Top 5 most recent
  const recentEvents = stocktakeEvents.slice(0, 5);

  // ===== Compute aggregate stats =====
  const aggregateStats = useMemo(() => {
    if (stocktakeEvents.length === 0) return { totalEvents: 0, avgVariance: 0, totalSurplus: 0, totalShortage: 0 };
    const totalVariance = stocktakeEvents.reduce((s, e) => s + e.totalVariance, 0);
    const totalSurplus = stocktakeEvents.reduce((s, e) => s + e.surplusItems, 0);
    const totalShortage = stocktakeEvents.reduce((s, e) => s + e.shortageItems, 0);
    return {
      totalEvents: stocktakeEvents.length,
      avgVariance: Math.round(totalVariance / stocktakeEvents.length),
      totalSurplus,
      totalShortage,
    };
  }, [stocktakeEvents]);

  // ===== Variance trend data (chronological, oldest first for the chart) =====
  // We use up to the last 20 stocktake events to show the trend over time.
  const trendData = useMemo(() => {
    // stocktakeEvents is sorted most-recent first; reverse for chronological order
    const chronological = [...stocktakeEvents].reverse();
    return chronological.slice(-20).map(e => ({
      reference: e.reference,
      timestamp: e.timestamp,
      variance: e.totalVariance,
      surplus: e.surplusItems,
      shortage: e.shortageItems,
      dateLabel: (() => {
        try {
          const d = new Date(e.timestamp);
          return `${d.getDate()}/${d.getMonth() + 1}`;
        } catch { return e.reference; }
      })(),
    }));
  }, [stocktakeEvents]);

  // ===== Trend analysis: is shrinkage improving or worsening? =====
  const trendAnalysis = useMemo(() => {
    if (trendData.length < 2) {
      return { direction: 'neutral', slope: 0, recentAvg: 0, olderAvg: 0, message: 'Need at least 2 stocktake events to analyze the trend' };
    }
    // Compare the average variance of the first half vs the second half
    const mid = Math.floor(trendData.length / 2);
    const olderHalf = trendData.slice(0, mid);
    const recentHalf = trendData.slice(mid);
    const olderAvg = olderHalf.reduce((s, d) => s + d.variance, 0) / olderHalf.length;
    const recentAvg = recentHalf.reduce((s, d) => s + d.variance, 0) / recentHalf.length;
    const slope = recentAvg - olderAvg;

    let direction: 'improving' | 'worsening' | 'stable';
    if (Math.abs(slope) < 1) direction = 'stable';
    else if (slope > 0) direction = 'improving'; // variance moving toward positive = less shrinkage
    else direction = 'worsening'; // variance moving toward negative = more shrinkage

    const message = direction === 'improving'
      ? `Shrinkage is improving — average variance moved from ${olderAvg.toFixed(1)} to ${recentAvg.toFixed(1)} (+${slope.toFixed(1)})`
      : direction === 'worsening'
      ? `Shrinkage is worsening — average variance moved from ${olderAvg.toFixed(1)} to ${recentAvg.toFixed(1)} (${slope.toFixed(1)})`
      : `Shrinkage is stable — average variance is ${recentAvg.toFixed(1)}`;

    return { direction, slope, recentAvg, olderAvg, message };
  }, [trendData]);

  // ===== Reorder suggestions based on persistent shortages =====
  // A product is flagged as a reorder suggestion if:
  //   1. It has appeared in >= 2 stocktake events with a shortage (negative variance)
  //   2. Its current stock is at or below its reorder level
  //   3. The total shortage across events exceeds a threshold (e.g. >= 3 units lost)
  const reorderSuggestions = useMemo(() => {
    // Build a map of productId -> { shortageEvents, totalShortage, productName, sku, currentStock, reorderLevel, costPrice, supplier, emoji }
    const productShortageStats = new Map<string, {
      productId: string;
      productName: string;
      sku: string;
      currentStock: number;
      reorderLevel: number;
      costPrice: number;
      supplier: string;
      emoji: string;
      shortageEvents: number;
      totalShortage: number;
      lastShortageDate: string;
    }>();

    // Iterate through all stocktake events, tracking shortage occurrences per product
    stocktakeEvents.forEach(event => {
      event.entries.forEach(entry => {
        if (entry.quantityChange >= 0) return; // only shortages
        const existing = productShortageStats.get(entry.productId);
        if (existing) {
          existing.shortageEvents += 1;
          existing.totalShortage += Math.abs(entry.quantityChange);
          if (entry.timestamp > existing.lastShortageDate) existing.lastShortageDate = entry.timestamp;
        } else {
          // Look up current product info
          const product = products.find(p => p.id === entry.productId);
          if (!product) return; // product was deleted
          productShortageStats.set(entry.productId, {
            productId: entry.productId,
            productName: entry.productName,
            sku: entry.sku,
            currentStock: product.stock,
            reorderLevel: product.reorderLevel,
            costPrice: product.costPrice,
            supplier: product.supplier,
            emoji: product.emoji,
            shortageEvents: 1,
            totalShortage: Math.abs(entry.quantityChange),
            lastShortageDate: entry.timestamp,
          });
        }
      });
    });

    // Filter: persistent shortages (>= 2 events) AND current stock at/below reorder level
    return Array.from(productShortageStats.values())
      .filter(s => s.shortageEvents >= 2 && s.currentStock <= s.reorderLevel)
      .sort((a, b) => b.totalShortage - a.totalShortage); // worst shrinkage first
  }, [stocktakeEvents, products]);

  const fmtDate = (ts: string) => {
    try {
      const d = new Date(ts);
      return d.toLocaleDateString('en-GB') + ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    } catch { return ts; }
  };

  // ===== Tab state for the dashboard =====
  const [dashboardTab, setDashboardTab] = useState<'overview' | 'trend' | 'reorder' | 'notify' | 'compliance' | 'alerts'>('overview');

  // ===== Variance trend chart geometry (pure SVG, no charting library needed) =====
  const chart = useMemo(() => {
    if (trendData.length === 0) return null;
    const W = 640;       // viewBox width
    const H = 180;       // viewBox height
    const padX = 40;     // left padding for axis labels
    const padY = 20;     // top/bottom padding
    const chartW = W - padX - 20;
    const chartH = H - padY * 2;

    // Find the value range
    const allValues = trendData.map(d => d.variance);
    const maxValue = Math.max(0, ...allValues);
    const minValue = Math.min(0, ...allValues);
    const range = Math.max(1, maxValue - minValue);

    // Compute points
    const points = trendData.map((d, i) => {
      const x = padX + (trendData.length === 1 ? chartW / 2 : (i / (trendData.length - 1)) * chartW);
      const y = padY + chartH - ((d.variance - minValue) / range) * chartH;
      return { x, y, value: d.variance, label: d.dateLabel, reference: d.reference };
    });

    // Zero line position (if zero is in range)
    const zeroY = padY + chartH - ((0 - minValue) / range) * chartH;
    const zeroVisible = 0 >= minValue && 0 <= maxValue;

    // Build line path
    const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
    // Build area path (for shading below the line)
    const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${zeroY.toFixed(1)} L ${points[0].x.toFixed(1)} ${zeroY.toFixed(1)} Z`;

    return { W, H, padX, padY, chartW, chartH, points, zeroY, zeroVisible, linePath, areaPath, maxValue, minValue };
  }, [trendData]);

  // ===== Export reorder suggestions to Excel =====
  const handleExportReorder = () => {
    if (reorderSuggestions.length === 0) { toast({ title: 'No suggestions to export', variant: 'destructive' }); return; }
    import('xlsx').then((XLSX) => {
      type Row = Record<string, string | number>;
      const data: Row[] = reorderSuggestions.map((s, i) => ({
        '#': i + 1,
        'Product': s.productName,
        'SKU': s.sku,
        'Current Stock': s.currentStock,
        'Reorder Level': s.reorderLevel,
        'Shortage Events': s.shortageEvents,
        'Total Units Lost': s.totalShortage,
        'Supplier': s.supplier,
        'Cost per Unit GHC': s.costPrice,
        'Suggested Reorder Qty': Math.max(s.reorderLevel * 3 - s.currentStock, s.reorderLevel),
        'Est. Reorder Cost GHC': Math.max(s.reorderLevel * 3 - s.currentStock, s.reorderLevel) * s.costPrice,
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      ws['!cols'] = [{ wch: 4 }, { wch: 28 }, { wch: 12 }, { wch: 13 }, { wch: 13 }, { wch: 14 }, { wch: 16 }, { wch: 20 }, { wch: 16 }, { wch: 20 }, { wch: 20 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Reorder Suggestions');
      XLSX.writeFile(wb, `reorder-suggestions-${new Date().toISOString().split('T')[0]}.xlsx`);
      toast({ title: 'Exported successfully', description: `${reorderSuggestions.length} suggestions` });
    });
  };

  // ===== Create Purchase Order from reorder suggestions =====
  // Saves a draft PO to localStorage under 'sylhn-po-draft-from-reorder' and navigates
  // to the Purchase menu. The PurchaseForm detects the draft on mount and offers to load it.
  const handleCreatePO = () => {
    if (reorderSuggestions.length === 0) {
      toast({ title: 'No suggestions to create PO from', variant: 'destructive' });
      return;
    }
    // Build the draft PO
    const draftLines = reorderSuggestions.map(s => {
      const suggestedQty = Math.max(s.reorderLevel * 3 - s.currentStock, s.reorderLevel);
      return {
        id: `po-line-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        partNo: s.sku,
        details: `${s.emoji} ${s.productName}`,
        emoji: s.emoji,
        quantity: suggestedQty,
        cost: s.costPrice,
        expiry: '',
        tax: true, // default to taxable; user can uncheck in the form
        total: suggestedQty * s.costPrice,
      };
    });
    const totalCost = draftLines.reduce((s, l) => s + l.total, 0);

    // Group by supplier to pick the most common one as default
    const supplierCounts = new Map<string, number>();
    reorderSuggestions.forEach(s => {
      supplierCounts.set(s.supplier, (supplierCounts.get(s.supplier) || 0) + 1);
    });
    const defaultSupplier = Array.from(supplierCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || '';

    const draft = {
      lines: draftLines,
      supplier: defaultSupplier,
      details: `Auto-generated from Reorder Suggestions — ${reorderSuggestions.length} items, ${draftLines.reduce((s, l) => s + l.quantity, 0)} total units`,
      refNo: `REORDER-${new Date().toISOString().split('T')[0]}`,
      source: 'reorder-suggestions',
      createdAt: Date.now(),
      totalCost,
    };

    try {
      window.localStorage.setItem('sylhn-po-draft-from-reorder', JSON.stringify(draft));
    } catch { /* ignore */ }

    toast({
      title: 'PO draft created',
      description: `${reorderSuggestions.length} items · ${formatGHS(totalCost)} · Opening Purchase form…`,
    });

    // Close the dashboard and navigate to the purchase form
    onClose();
    if (onNavigateToPurchase) {
      setTimeout(() => onNavigateToPurchase(), 300);
    }
  };

  // ===== Per-product variance drill-down state =====
  const [drillDownProduct, setDrillDownProduct] = useState<{
    productId: string;
    productName: string;
    sku: string;
    emoji: string;
  } | null>(null);

  // ===== Build per-product stocktake history for drill-down =====
  const productHistory = useMemo(() => {
    if (!drillDownProduct) return null;
    // Find all 'adjusted' history entries for this product, sorted most-recent first
    const entries = history
      .filter(h => h.action === 'adjusted' && h.productId === drillDownProduct.productId)
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    return entries;
  }, [history, drillDownProduct]);

  // ===== Compliance report: per-staff stocktake history =====
  // Groups all 'adjusted' history entries by user, computing:
  //   - total stocktake events performed
  //   - total items adjusted
  //   - total variance (sum of quantityChange)
  //   - on-time vs overdue rate (based on schedule frequency)
  //   - average variance per event
  const complianceData = useMemo(() => {
    const staffMap = new Map<string, {
      user: string;
      events: number;
      itemsAdjusted: number;
      totalVariance: number;
      surplusItems: number;
      shortageItems: number;
      firstEvent: string;
      lastEvent: string;
    }>();

    // Get all adjusted entries grouped by reference first (to count events properly)
    const eventMap = new Map<string, { user: string; timestamp: string; entries: StockHistoryEntry[] }>();
    history.forEach(h => {
      if (h.action !== 'adjusted' || !h.reference) return;
      const existing = eventMap.get(h.reference);
      if (existing) {
        existing.entries.push(h);
        if (h.timestamp > existing.timestamp) existing.timestamp = h.timestamp;
      } else {
        eventMap.set(h.reference, { user: h.user, timestamp: h.timestamp, entries: [h] });
      }
    });

    // Now aggregate per user
    eventMap.forEach(event => {
      const user = event.user || 'Unknown';
      const existing = staffMap.get(user);
      const eventVariance = event.entries.reduce((s, e) => s + e.quantityChange, 0);
      const eventSurplus = event.entries.filter(e => e.quantityChange > 0).length;
      const eventShortage = event.entries.filter(e => e.quantityChange < 0).length;
      if (existing) {
        existing.events += 1;
        existing.itemsAdjusted += event.entries.length;
        existing.totalVariance += eventVariance;
        existing.surplusItems += eventSurplus;
        existing.shortageItems += eventShortage;
        if (event.timestamp < existing.firstEvent) existing.firstEvent = event.timestamp;
        if (event.timestamp > existing.lastEvent) existing.lastEvent = event.timestamp;
      } else {
        staffMap.set(user, {
          user,
          events: 1,
          itemsAdjusted: event.entries.length,
          totalVariance: eventVariance,
          surplusItems: eventSurplus,
          shortageItems: eventShortage,
          firstEvent: event.timestamp,
          lastEvent: event.timestamp,
        });
      }
    });

    // Compute on-time vs overdue per staff (based on gaps between consecutive events)
    const sortedEvents = Array.from(eventMap.values()).sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    const thresholdDays = scheduleFreq === 'weekly' ? 7 : scheduleFreq === 'biweekly' ? 14 : scheduleFreq === 'monthly' ? 30 : 90;

    const staffCompliance = Array.from(staffMap.values()).map(staff => {
      // Get this staff's events sorted chronologically
      const staffEvents = sortedEvents.filter(e => (e.user || 'Unknown') === staff.user);
      let onTimeCount = 0;
      let overdueCount = 0;
      for (let i = 1; i < staffEvents.length; i++) {
        const gap = Math.floor((new Date(staffEvents[i].timestamp).getTime() - new Date(staffEvents[i - 1].timestamp).getTime()) / (1000 * 60 * 60 * 24));
        if (gap <= thresholdDays) onTimeCount++;
        else overdueCount++;
      }
      // Also check if the most recent event is overdue relative to now
      if (staffEvents.length > 0) {
        const lastGap = Math.floor((Date.now() - new Date(staffEvents[staffEvents.length - 1].timestamp).getTime()) / (1000 * 60 * 60 * 24));
        if (lastGap > thresholdDays) overdueCount++;
        else onTimeCount++;
      }
      const totalChecks = onTimeCount + overdueCount;
      const onTimeRate = totalChecks > 0 ? Math.round((onTimeCount / totalChecks) * 100) : 100;
      return {
        ...staff,
        avgVariancePerEvent: staff.events > 0 ? Math.round(staff.totalVariance / staff.events) : 0,
        onTimeCount,
        overdueCount,
        onTimeRate,
      };
    }).sort((a, b) => b.events - a.events);

    return staffCompliance;
  }, [history, scheduleFreq]);

  // ===== Per-product variance alert thresholds (persisted to localStorage) =====
  // Each product can have a custom threshold (% of current stock). When a stocktake
  // reveals shrinkage exceeding this threshold, the product is flagged in the Alerts tab.
  const THRESHOLD_KEY = 'sylhn-variance-thresholds';
  const [varianceThresholds, setVarianceThresholds] = useState<Record<string, number>>({});
  const [globalThreshold, setGlobalThreshold] = useState(5); // default 5%
  const [thresholdEditProduct, setThresholdEditProduct] = useState<string | null>(null);
  const [thresholdEditValue, setThresholdEditValue] = useState<number>(5);

  // Load thresholds on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const cached = window.localStorage.getItem(THRESHOLD_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.thresholds) setVarianceThresholds(parsed.thresholds);
        if (typeof parsed.global === 'number') setGlobalThreshold(parsed.global);
      }
    } catch { /* ignore */ }
  }, []);

  // Persist thresholds
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(THRESHOLD_KEY, JSON.stringify({
        thresholds: varianceThresholds,
        global: globalThreshold,
      }));
    } catch { /* ignore */ }
  }, [varianceThresholds, globalThreshold]);

  // ===== Build alert list: products whose latest stocktake variance exceeds their threshold =====
  const varianceAlerts = useMemo(() => {
    const alerts: Array<{
      productId: string;
      productName: string;
      sku: string;
      emoji: string;
      currentStock: number;
      lastVariance: number;
      threshold: number;
      thresholdPct: number;
      severity: 'critical' | 'warning' | 'ok';
      lastStocktakeDate: string;
      lastReference: string;
    }> = [];

    // For each product that has at least one 'adjusted' entry, check the most recent one
    const productLatest = new Map<string, StockHistoryEntry>();
    history.forEach(h => {
      if (h.action !== 'adjusted') return;
      const existing = productLatest.get(h.productId);
      if (!existing || h.timestamp > existing.timestamp) {
        productLatest.set(h.productId, h);
      }
    });

    productLatest.forEach(entry => {
      const product = products.find(p => p.id === entry.productId);
      if (!product) return;
      // Shrinkage = negative variance
      const shrinkage = Math.abs(Math.min(0, entry.quantityChange));
      if (shrinkage === 0) return; // no shrinkage, no alert
      // Threshold % — use product-specific if set, otherwise global
      const thresholdPct = varianceThresholds[entry.productId] ?? globalThreshold;
      // Compute threshold in units: threshold% of the new quantity (counted)
      const thresholdUnits = (thresholdPct / 100) * Math.max(1, entry.newQuantity);
      const threshold = thresholdUnits;
      // Severity
      let severity: 'critical' | 'warning' | 'ok';
      if (shrinkage >= threshold * 2) severity = 'critical';
      else if (shrinkage >= threshold) severity = 'warning';
      else severity = 'ok';
      // Only include if severity is warning or critical
      if (severity === 'ok') return;
      alerts.push({
        productId: entry.productId,
        productName: entry.productName,
        sku: entry.sku,
        emoji: product.emoji,
        currentStock: product.stock,
        lastVariance: entry.quantityChange,
        threshold,
        thresholdPct,
        severity,
        lastStocktakeDate: entry.timestamp,
        lastReference: entry.reference || '',
      });
    });

    // Sort: critical first, then by shrinkage amount descending
    return alerts.sort((a, b) => {
      if (a.severity === 'critical' && b.severity !== 'critical') return -1;
      if (a.severity !== 'critical' && b.severity === 'critical') return 1;
      return Math.abs(b.lastVariance) - Math.abs(a.lastVariance);
    });
  }, [history, products, varianceThresholds, globalThreshold]);

  const handleExport = () => {
    if (stocktakeEvents.length === 0) { toast({ title: 'No data to export', variant: 'destructive' }); return; }
    import('xlsx').then((XLSX) => {
      type Row = Record<string, string | number>;
      const data: Row[] = stocktakeEvents.map((e, i) => ({
        '#': i + 1,
        'Reference': e.reference,
        'Date': fmtDate(e.timestamp),
        'Items Adjusted': e.itemCount,
        'Surplus Items': e.surplusItems,
        'Shortage Items': e.shortageItems,
        'Total Variance': e.totalVariance,
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      ws['!cols'] = [{ wch: 5 }, { wch: 16 }, { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Stocktake History');
      XLSX.writeFile(wb, `stocktake-dashboard-${new Date().toISOString().split('T')[0]}.xlsx`);
      toast({ title: 'Exported successfully', description: `${stocktakeEvents.length} events` });
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-lg shadow-2xl overflow-hidden flex flex-col"
        style={{ width: '100%', maxWidth: '720px', maxHeight: '85vh', fontFamily: 'Arial, Helvetica, sans-serif' }}
      >
        {/* Title bar */}
        <div className="flex-shrink-0 flex items-center justify-between px-4 h-9 text-white" style={{ background: 'linear-gradient(to right, #7C3AED, #DB2777)' }}>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            <span className="text-sm font-bold">Stocktake Dashboard — Management Overview</span>
          </div>
          <button onClick={onClose} className="h-6 w-6 rounded bg-red-600 hover:bg-red-700 flex items-center justify-center transition"><X className="h-3.5 w-3.5 text-white" /></button>
        </div>

        {/* Aggregate stats */}
        <div className="flex-shrink-0 px-4 py-3 bg-slate-50 border-b border-slate-200 grid grid-cols-4 gap-3">
          <div className="bg-white rounded-lg p-2.5 ring-1 ring-slate-200">
            <div className="text-[9px] text-slate-500 uppercase font-semibold">Total Events</div>
            <div className="text-lg font-bold text-slate-800">{aggregateStats.totalEvents}</div>
          </div>
          <div className="bg-white rounded-lg p-2.5 ring-1 ring-slate-200">
            <div className="text-[9px] text-slate-500 uppercase font-semibold">Avg Variance</div>
            <div className={cn("text-lg font-bold font-mono", aggregateStats.avgVariance > 0 ? "text-emerald-600" : aggregateStats.avgVariance < 0 ? "text-rose-600" : "text-slate-600")}>
              {aggregateStats.avgVariance > 0 ? '+' : ''}{aggregateStats.avgVariance}
            </div>
          </div>
          <div className="bg-white rounded-lg p-2.5 ring-1 ring-slate-200">
            <div className="text-[9px] text-slate-500 uppercase font-semibold">Surplus Items</div>
            <div className="text-lg font-bold text-emerald-600">{aggregateStats.totalSurplus}</div>
          </div>
          <div className="bg-white rounded-lg p-2.5 ring-1 ring-slate-200">
            <div className="text-[9px] text-slate-500 uppercase font-semibold">Shortage Items</div>
            <div className="text-lg font-bold text-rose-600">{aggregateStats.totalShortage}</div>
          </div>
        </div>

        {/* ===== Overdue notification banner (only when overdue) ===== */}
        {stocktakeStatus.isOverdue && (
          <div className="flex-shrink-0 px-4 py-2 bg-rose-50 border-b border-rose-200 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-rose-600 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold text-rose-800">Stocktake {stocktakeStatus.daysOverdue} day(s) overdue</div>
              <div className="text-[10px] text-rose-700">{stocktakeStatus.message}</div>
            </div>
            <button
              onClick={() => sendOverdueNotification('real')}
              className="h-7 px-3 rounded-md bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold flex items-center gap-1.5 transition shadow-sm"
              title="Send overdue notification to configured recipients"
            >
              <Mail className="h-3.5 w-3.5" /> Notify
            </button>
            <button
              onClick={() => sendOverdueNotification('test')}
              className="h-7 px-3 rounded-md bg-white hover:bg-rose-50 text-rose-700 text-[11px] font-bold flex items-center gap-1.5 transition border border-rose-300"
              title="Send a test notification to verify your settings"
            >
              Test
            </button>
            <button
              onClick={() => setShowNotifySettings(true)}
              className="h-7 w-7 rounded-md bg-white hover:bg-rose-50 text-rose-700 flex items-center justify-center transition border border-rose-300"
              title="Notification settings"
            >
              <Settings2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* ===== Tab navigation ===== */}
        <div className="flex-shrink-0 flex border-b border-slate-200 bg-white">
          {([
            { id: 'overview' as const, label: 'Overview', icon: TrendingUp, badge: recentEvents.length },
            { id: 'trend' as const, label: 'Variance Trend', icon: TrendingUp, badge: trendData.length },
            { id: 'reorder' as const, label: 'Reorder', icon: Package, badge: reorderSuggestions.length },
            { id: 'alerts' as const, label: 'Alerts', icon: AlertTriangle, badge: varianceAlerts.length },
            { id: 'compliance' as const, label: 'Compliance', icon: User, badge: complianceData.length },
            { id: 'notify' as const, label: 'Notifications', icon: Mail, badge: null },
          ]).map(tab => (
            <button
              key={tab.id}
              onClick={() => setDashboardTab(tab.id)}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2 text-xs font-bold transition border-b-2",
                dashboardTab === tab.id
                  ? "border-purple-600 text-purple-700 bg-purple-50"
                  : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50"
              )}
            >
              <tab.icon className="h-3.5 w-3.5" />
              {tab.label}
              {tab.badge !== null && tab.badge > 0 && (
                <span className={cn(
                  "ml-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold",
                  dashboardTab === tab.id
                    ? tab.id === 'alerts' ? "bg-rose-600 text-white"
                    : "bg-purple-600 text-white"
                    : tab.id === 'alerts' ? "bg-rose-200 text-rose-700"
                    : "bg-slate-200 text-slate-600"
                )}>
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ===== Tab content ===== */}
        <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>

          {/* ===== Overview tab (existing 5 recent events list) ===== */}
          {dashboardTab === 'overview' && (
            <div className="p-3 space-y-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-slate-700">5 Most Recent Stocktake Events</span>
                <span className="text-[10px] text-slate-500">Click an event to see details</span>
              </div>
              {recentEvents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                  <TrendingUp className="h-10 w-10 mb-2 opacity-40" />
                  <div className="text-sm font-medium">No stocktake events yet</div>
                  <div className="text-xs mt-1">Perform your first stocktake to see variance trends here</div>
                </div>
              ) : (
                recentEvents.map((event, idx) => (
                  <motion.div
                    key={event.reference}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="bg-white rounded-lg ring-1 ring-slate-200 p-3 hover:ring-purple-300 hover:shadow-md transition cursor-pointer"
                    onClick={() => {
                      toast({
                        title: event.reference,
                        description: `${event.itemCount} items · Variance: ${event.totalVariance > 0 ? '+' : ''}${event.totalVariance} · ${fmtDate(event.timestamp)}`,
                      });
                    }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "h-8 w-8 rounded-lg flex items-center justify-center text-xs font-bold",
                          event.totalVariance > 0 ? "bg-emerald-100 text-emerald-700" :
                          event.totalVariance < 0 ? "bg-rose-100 text-rose-700" :
                          "bg-slate-100 text-slate-600"
                        )}>
                          {event.totalVariance > 0 ? '↑' : event.totalVariance < 0 ? '↓' : '='}
                        </div>
                        <div>
                          <div className="font-bold text-slate-800 text-sm font-mono">{event.reference}</div>
                          <div className="text-[10px] text-slate-500">{fmtDate(event.timestamp)}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={cn("text-base font-bold font-mono", event.totalVariance > 0 ? "text-emerald-600" : event.totalVariance < 0 ? "text-rose-600" : "text-slate-600")}>
                          {event.totalVariance > 0 ? '+' : ''}{event.totalVariance}
                        </div>
                        <div className="text-[10px] text-slate-500">net variance</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-[10px]">
                      <span className="flex items-center gap-1 text-slate-600">
                        <Package className="h-3 w-3" /> {event.itemCount} items
                      </span>
                      <span className="flex items-center gap-1 text-emerald-700">
                        <ArrowUp className="h-3 w-3" /> {event.surplusItems} surplus
                      </span>
                      <span className="flex items-center gap-1 text-rose-700">
                        <ArrowDown className="h-3 w-3" /> {event.shortageItems} shortage
                      </span>
                      {/* Mini variance bar */}
                      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden flex">
                        {event.surplusItems > 0 && (
                          <div className="bg-emerald-500 h-full" style={{ width: `${(event.surplusItems / event.itemCount) * 100}%` }} />
                        )}
                        {event.shortageItems > 0 && (
                          <div className="bg-rose-500 h-full" style={{ width: `${(event.shortageItems / event.itemCount) * 100}%` }} />
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          )}

          {/* ===== Variance Trend tab (SVG line chart) ===== */}
          {dashboardTab === 'trend' && (
            <div className="p-3 space-y-3">
              {/* Trend analysis banner */}
              <div className={cn(
                "rounded-lg p-3 ring-1",
                trendAnalysis.direction === 'improving' ? "bg-emerald-50 ring-emerald-200" :
                trendAnalysis.direction === 'worsening' ? "bg-rose-50 ring-rose-200" :
                "bg-slate-50 ring-slate-200"
              )}>
                <div className="flex items-center gap-2">
                  {trendAnalysis.direction === 'improving' ? (
                    <ArrowUp className="h-5 w-5 text-emerald-600" />
                  ) : trendAnalysis.direction === 'worsening' ? (
                    <ArrowDown className="h-5 w-5 text-rose-600" />
                  ) : (
                    <TrendingUp className="h-5 w-5 text-slate-500" />
                  )}
                  <div className="flex-1">
                    <div className={cn(
                      "text-sm font-bold",
                      trendAnalysis.direction === 'improving' ? "text-emerald-800" :
                      trendAnalysis.direction === 'worsening' ? "text-rose-800" :
                      "text-slate-700"
                    )}>
                      {trendAnalysis.direction === 'improving' ? 'Shrinkage Improving' :
                       trendAnalysis.direction === 'worsening' ? 'Shrinkage Worsening' :
                       'Insufficient Data'}
                    </div>
                    <div className={cn(
                      "text-[11px]",
                      trendAnalysis.direction === 'improving' ? "text-emerald-700" :
                      trendAnalysis.direction === 'worsening' ? "text-rose-700" :
                      "text-slate-500"
                    )}>
                      {trendAnalysis.message}
                    </div>
                  </div>
                </div>
              </div>

              {/* SVG line chart */}
              {chart ? (
                <div className="bg-white rounded-lg ring-1 ring-slate-200 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-700">Net Variance per Stocktake (Chronological)</span>
                    <div className="flex items-center gap-3 text-[10px]">
                      <span className="flex items-center gap-1">
                        <span className="inline-block w-3 h-0.5 bg-purple-500" /> Variance
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="inline-block w-3 h-0.5 border-t border-dashed border-slate-400" /> Zero baseline
                      </span>
                    </div>
                  </div>
                  <svg viewBox={`0 0 ${chart.W} ${chart.H}`} className="w-full" style={{ height: '180px' }}>
                    {/* Y-axis grid lines */}
                    {[0, 0.25, 0.5, 0.75, 1].map(t => {
                      const y = chart.padY + t * chart.chartH;
                      const value = chart.maxValue - t * (chart.maxValue - chart.minValue);
                      return (
                        <g key={t}>
                          <line x1={chart.padX} y1={y} x2={chart.W - 20} y2={y} stroke="#E2E8F0" strokeWidth={0.5} />
                          <text x={chart.padX - 4} y={y + 3} textAnchor="end" fontSize="9" fill="#64748B" fontFamily="monospace">
                            {value > 0 ? '+' : ''}{Math.round(value)}
                          </text>
                        </g>
                      );
                    })}
                    {/* Zero baseline (emphasized) */}
                    {chart.zeroVisible && (
                      <line x1={chart.padX} y1={chart.zeroY} x2={chart.W - 20} y2={chart.zeroY} stroke="#94A3B8" strokeWidth={1} strokeDasharray="4,3" />
                    )}
                    {/* Area fill (green for positive, red for negative) */}
                    <defs>
                      <linearGradient id="varianceAreaPos" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10B981" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="#10B981" stopOpacity="0" />
                      </linearGradient>
                      <linearGradient id="varianceAreaNeg" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#F43F5E" stopOpacity="0" />
                        <stop offset="100%" stopColor="#F43F5E" stopOpacity="0.3" />
                      </linearGradient>
                    </defs>
                    {/* Split area into positive (above zero) and negative (below zero) */}
                    {chart.zeroVisible && (
                      <>
                        <clipPath id="clipPos">
                          <rect x={chart.padX} y={chart.padY} width={chart.chartW} height={chart.zeroY - chart.padY} />
                        </clipPath>
                        <clipPath id="clipNeg">
                          <rect x={chart.padX} y={chart.zeroY} width={chart.chartW} height={chart.padY + chart.chartH - chart.zeroY} />
                        </clipPath>
                        <path d={chart.areaPath} fill="url(#varianceAreaPos)" clipPath="url(#clipPos)" />
                        <path d={chart.areaPath} fill="url(#varianceAreaNeg)" clipPath="url(#clipNeg)" />
                      </>
                    )}
                    {/* Line */}
                    <path d={chart.linePath} fill="none" stroke="#7C3AED" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                    {/* Points */}
                    {chart.points.map((p, i) => (
                      <g key={i}>
                        <circle
                          cx={p.x}
                          cy={p.y}
                          r={3}
                          fill={p.value > 0 ? '#10B981' : p.value < 0 ? '#F43F5E' : '#64748B'}
                          stroke="white"
                          strokeWidth={1.5}
                        />
                        {/* X-axis label (every other point to avoid crowding) */}
                        {i % 2 === 0 && (
                          <text x={p.x} y={chart.H - 4} textAnchor="middle" fontSize="8" fill="#64748B" fontFamily="monospace">
                            {p.label}
                          </text>
                        )}
                      </g>
                    ))}
                  </svg>
                  <div className="mt-2 text-[10px] text-slate-500 text-center">
                    Showing {trendData.length} stocktake event(s) in chronological order · Hover chart points to see exact values
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                  <TrendingUp className="h-10 w-10 mb-2 opacity-40" />
                  <div className="text-sm font-medium">No trend data yet</div>
                  <div className="text-xs mt-1">Perform at least 2 stocktakes to see the variance trend</div>
                </div>
              )}

              {/* Trend data table */}
              {trendData.length > 0 && (
                <div className="bg-white rounded-lg ring-1 ring-slate-200 overflow-hidden">
                  <div className="px-3 py-2 bg-slate-50 border-b border-slate-200">
                    <span className="text-xs font-bold text-slate-700">Trend Data (chronological)</span>
                  </div>
                  <div className="grid grid-cols-[1fr_80px_80px_80px_80px] gap-0 px-3 py-1 text-[9px] font-bold text-slate-600 border-b border-slate-100">
                    <div>Reference</div>
                    <div className="text-right">Date</div>
                    <div className="text-right">Variance</div>
                    <div className="text-right">Surplus</div>
                    <div className="text-right">Shortage</div>
                  </div>
                  <div className="max-h-40 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
                    {trendData.map((d, i) => (
                      <div key={i} className="grid grid-cols-[1fr_80px_80px_80px_80px] gap-0 px-3 py-1 text-[10px] border-b border-slate-50">
                        <div className="font-mono text-slate-700 truncate">{d.reference}</div>
                        <div className="text-right text-slate-600">{d.dateLabel}</div>
                        <div className={cn("text-right font-mono font-bold", d.variance > 0 ? "text-emerald-700" : d.variance < 0 ? "text-rose-700" : "text-slate-600")}>
                          {d.variance > 0 ? '+' : ''}{d.variance}
                        </div>
                        <div className="text-right text-emerald-700 font-mono">{d.surplus}</div>
                        <div className="text-right text-rose-700 font-mono">{d.shortage}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ===== Reorder Suggestions tab ===== */}
          {dashboardTab === 'reorder' && (
            <div className="p-3 space-y-3">
              <div className="bg-amber-50 ring-1 ring-amber-200 rounded-lg p-3 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-bold text-amber-800">Automatic Reorder Suggestions</div>
                  <div className="text-[10px] text-amber-700 mt-0.5">
                    Products appearing in <strong>≥2 stocktakes with shortages</strong> AND currently at/below reorder level.
                    These items show persistent shrinkage patterns and should be reordered to prevent stockouts.
                    Suggested reorder quantity = 3× reorder level − current stock (minimum: reorder level).
                  </div>
                </div>
              </div>

              {reorderSuggestions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                  <Package className="h-10 w-10 mb-2 opacity-40" />
                  <div className="text-sm font-medium">No reorder suggestions</div>
                  <div className="text-xs mt-1">Perform more stocktakes to identify persistent shortage patterns</div>
                </div>
              ) : (
                <>
                  {/* Summary card */}
                  <div className="bg-white rounded-lg ring-1 ring-slate-200 p-3 grid grid-cols-3 gap-3">
                    <div>
                      <div className="text-[9px] text-slate-500 uppercase font-semibold">Items to Reorder</div>
                      <div className="text-lg font-bold text-amber-600">{reorderSuggestions.length}</div>
                    </div>
                    <div>
                      <div className="text-[9px] text-slate-500 uppercase font-semibold">Total Units Lost</div>
                      <div className="text-lg font-bold text-rose-600 font-mono">
                        {reorderSuggestions.reduce((s, r) => s + r.totalShortage, 0)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[9px] text-slate-500 uppercase font-semibold">Est. Reorder Cost</div>
                      <div className="text-lg font-bold text-slate-800 font-mono">
                        {formatGHS(reorderSuggestions.reduce((s, r) => s + Math.max(r.reorderLevel * 3 - r.currentStock, r.reorderLevel) * r.costPrice, 0))}
                      </div>
                    </div>
                  </div>

                  {/* Suggestions list */}
                  <div className="bg-white rounded-lg ring-1 ring-slate-200 overflow-hidden">
                    <div className="grid grid-cols-[1fr_50px_60px_70px_70px_90px] gap-0 px-3 py-1.5 text-[9px] font-bold text-slate-600 border-b border-slate-200 bg-slate-50">
                      <div>Product</div>
                      <div className="text-right">Stock</div>
                      <div className="text-right">Reorder</div>
                      <div className="text-right">Lost</div>
                      <div className="text-right">Events</div>
                      <div className="text-right">Suggest Qty</div>
                    </div>
                    <div className="max-h-64 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
                      {reorderSuggestions.map((s, idx) => {
                        const suggestedQty = Math.max(s.reorderLevel * 3 - s.currentStock, s.reorderLevel);
                        return (
                          <motion.div
                            key={s.productId}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: Math.min(idx * 0.03, 0.3) }}
                            onClick={() => setDrillDownProduct({
                              productId: s.productId,
                              productName: s.productName,
                              sku: s.sku,
                              emoji: s.emoji,
                            })}
                            className="grid grid-cols-[1fr_50px_60px_70px_70px_90px] gap-0 px-3 py-2 text-[10px] border-b border-slate-50 hover:bg-amber-50/40 transition cursor-pointer"
                            title="Click to view full stocktake history for this product"
                          >
                            <div className="min-w-0">
                              <div className="font-semibold text-slate-800 truncate flex items-center gap-1">
                                {s.emoji} {s.productName}
                                <ChevronRight className="h-2.5 w-2.5 text-amber-500 flex-shrink-0" />
                              </div>
                              <div className="text-[9px] text-slate-500 truncate font-mono">{s.sku} · {s.supplier}</div>
                            </div>
                            <div className={cn("text-right font-mono font-bold", s.currentStock === 0 ? "text-rose-700" : "text-amber-700")}>
                              {s.currentStock}
                            </div>
                            <div className="text-right font-mono text-slate-600">{s.reorderLevel}</div>
                            <div className="text-right font-mono text-rose-700 font-bold">−{s.totalShortage}</div>
                            <div className="text-right font-mono text-slate-600">{s.shortageEvents}</div>
                            <div className="text-right font-mono font-bold text-blue-700">{suggestedQty}</div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleExportReorder}
                      className="h-8 px-4 rounded-md bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold flex items-center gap-1.5 transition shadow-sm"
                    >
                      <Download className="h-3.5 w-3.5" /> Export Reorder List (XLSX)
                    </button>
                    <button
                      onClick={handleCreatePO}
                      disabled={!onNavigateToPurchase}
                      className="h-8 px-4 rounded-md bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold flex items-center gap-1.5 transition shadow-sm disabled:opacity-50"
                      title="Create a Purchase Order draft from these suggestions and open the Purchase form"
                    >
                      <Package className="h-3.5 w-3.5" /> Create Purchase Order
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ===== Notifications tab ===== */}
          {dashboardTab === 'notify' && (
            <div className="p-4 space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-800 mb-1">Overdue Stocktake Notifications</h3>
                <p className="text-[11px] text-slate-500">
                  Configure email and SMS recipients to receive alerts when a stocktake becomes overdue.
                  Settings are persisted to this browser.
                </p>
              </div>

              {/* Email settings */}
              <div className="bg-white rounded-lg ring-1 ring-slate-200 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-blue-600" />
                    <span className="text-xs font-bold text-slate-800">Email Notifications</span>
                  </div>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notifyEmailEnabled}
                      onChange={(e) => setNotifyEmailEnabled(e.target.checked)}
                      className="h-3.5 w-3.5 accent-blue-600"
                    />
                    <span className="text-[10px] font-semibold text-slate-600">Enabled</span>
                  </label>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-600 block mb-1">Recipient emails (comma-separated)</label>
                  <input
                    type="text"
                    value={notifyEmails}
                    onChange={(e) => setNotifyEmails(e.target.value)}
                    placeholder="manager@sylhn.com, supervisor@sylhn.com"
                    disabled={!notifyEmailEnabled}
                    className="w-full h-8 px-2 text-[11px] border border-slate-300 rounded outline-none focus:ring-1 focus:ring-blue-400 disabled:bg-slate-100 disabled:text-slate-400"
                  />
                </div>
              </div>

              {/* SMS settings */}
              <div className="bg-white rounded-lg ring-1 ring-slate-200 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-emerald-600" />
                    <span className="text-xs font-bold text-slate-800">SMS Notifications</span>
                  </div>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notifySmsEnabled}
                      onChange={(e) => setNotifySmsEnabled(e.target.checked)}
                      className="h-3.5 w-3.5 accent-emerald-600"
                    />
                    <span className="text-[10px] font-semibold text-slate-600">Enabled</span>
                  </label>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-600 block mb-1">Recipient phone numbers (comma-separated, with country code)</label>
                  <input
                    type="text"
                    value={notifyPhones}
                    onChange={(e) => setNotifyPhones(e.target.value)}
                    placeholder="+233592766044, +233241112222"
                    disabled={!notifySmsEnabled}
                    className="w-full h-8 px-2 text-[11px] border border-slate-300 rounded outline-none focus:ring-1 focus:ring-emerald-400 disabled:bg-slate-100 disabled:text-slate-400"
                  />
                </div>
                <div className="text-[9px] text-slate-500 italic">
                  Note: SMS composer opens via your device's default messaging app (mobile only). On desktop, the SMS body is shown in a toast for manual sending.
                </div>
              </div>

              {/* Test/Send buttons */}
              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={() => sendOverdueNotification('test')}
                  disabled={!stocktakeStatus.isOverdue}
                  className="h-8 px-4 rounded-md bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition disabled:opacity-50"
                  title="Send a test notification to verify your settings"
                >
                  <Send className="h-3.5 w-3.5" /> Send Test
                </button>
                <button
                  onClick={() => sendOverdueNotification('real')}
                  disabled={!stocktakeStatus.isOverdue}
                  className="h-8 px-4 rounded-md bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center gap-1.5 transition shadow-sm disabled:opacity-50"
                >
                  <Mail className="h-3.5 w-3.5" /> Send Overdue Alert Now
                </button>
                <div className="flex-1" />
                <span className="text-[10px] text-slate-500">
                  {stocktakeStatus.isOverdue ? 'Currently overdue — alerts can be sent' : 'Not currently overdue'}
                </span>
              </div>

              {/* ===== Email Digest Settings (new) ===== */}
              <div className="bg-white rounded-lg ring-1 ring-slate-200 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-purple-600" />
                    <span className="text-xs font-bold text-slate-800">Scheduled Email Digest</span>
                  </div>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={digestEnabled}
                      onChange={(e) => setDigestEnabled(e.target.checked)}
                      className="h-3.5 w-3.5 accent-purple-600"
                    />
                    <span className="text-[10px] font-semibold text-slate-600">Enabled</span>
                  </label>
                </div>
                <div className="flex items-center gap-3">
                  <label className="text-[10px] font-bold text-slate-600">Frequency:</label>
                  <select
                    value={digestFreq}
                    onChange={(e) => setDigestFreq(e.target.value as 'daily' | 'weekly')}
                    disabled={!digestEnabled}
                    className="h-7 px-2 text-[11px] border border-slate-300 rounded outline-none focus:ring-1 focus:ring-purple-400 disabled:bg-slate-100"
                  >
                    <option value="daily">Daily (every 24 hours)</option>
                    <option value="weekly">Weekly (every 7 days)</option>
                  </select>
                  <div className="flex-1" />
                  {lastDigestSent && (
                    <span className="text-[9px] text-slate-500">
                      Last sent: {new Date(lastDigestSent).toLocaleDateString('en-GB')}
                    </span>
                  )}
                </div>
                <div className="text-[9px] text-slate-500 italic">
                  When enabled, the system automatically sends a summary email of all stocktake activity
                  (events, variances, surplus/shortage counts, schedule status) to the configured email recipients.
                  The background checker in the POS runs every 5 minutes and sends the digest when the period elapses.
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => sendDigest('test')}
                    className="h-7 px-3 rounded bg-slate-200 hover:bg-slate-300 text-slate-700 text-[10px] font-bold flex items-center gap-1 transition"
                  >
                    <Send className="h-3 w-3" /> Test Digest
                  </button>
                  <button
                    onClick={() => sendDigest('real')}
                    disabled={!digestEnabled}
                    className="h-7 px-3 rounded bg-purple-600 hover:bg-purple-700 text-white text-[10px] font-bold flex items-center gap-1 transition disabled:opacity-50"
                  >
                    <Mail className="h-3 w-3" /> Send Digest Now
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ===== Compliance tab (per-staff stocktake history) ===== */}
          {dashboardTab === 'compliance' && (
            <div className="p-3 space-y-3">
              <div className="bg-blue-50 ring-1 ring-blue-200 rounded-lg p-3 flex items-start gap-2">
                <User className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-bold text-blue-800">Stocktake Compliance Report</div>
                  <div className="text-[10px] text-blue-700 mt-0.5">
                    Per-staff stocktake performance: events performed, on-time vs overdue rate (based on {scheduleFreq} schedule),
                    average variance per event, and total items adjusted. Use this to identify staff who need reminders or training.
                  </div>
                </div>
              </div>

              {complianceData.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                  <User className="h-10 w-10 mb-2 opacity-40" />
                  <div className="text-sm font-medium">No staff stocktake data yet</div>
                  <div className="text-xs mt-1">Perform stocktakes to see per-staff compliance metrics</div>
                </div>
              ) : (
                <>
                  {/* Staff compliance cards */}
                  <div className="space-y-2">
                    {complianceData.map((staff, idx) => (
                      <motion.div
                        key={staff.user}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: Math.min(idx * 0.05, 0.3) }}
                        className="bg-white rounded-lg ring-1 ring-slate-200 p-3 hover:ring-blue-300 transition"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className={cn(
                              "h-9 w-9 rounded-lg flex items-center justify-center text-xs font-bold",
                              staff.onTimeRate >= 80 ? "bg-emerald-100 text-emerald-700" :
                              staff.onTimeRate >= 50 ? "bg-amber-100 text-amber-700" :
                              "bg-rose-100 text-rose-700"
                            )}>
                              {staff.user.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-bold text-slate-800 text-sm">{staff.user}</div>
                              <div className="text-[10px] text-slate-500">
                                {staff.events} event(s) · {staff.itemsAdjusted} items adjusted
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className={cn(
                              "text-lg font-bold font-mono",
                              staff.onTimeRate >= 80 ? "text-emerald-600" :
                              staff.onTimeRate >= 50 ? "text-amber-600" :
                              "text-rose-600"
                            )}>
                              {staff.onTimeRate}%
                            </div>
                            <div className="text-[10px] text-slate-500">on-time rate</div>
                          </div>
                        </div>
                        <div className="grid grid-cols-5 gap-2 text-[10px]">
                          <div className="text-center bg-slate-50 rounded p-1">
                            <div className="text-slate-500">On-time</div>
                            <div className="font-bold text-emerald-700 font-mono">{staff.onTimeCount}</div>
                          </div>
                          <div className="text-center bg-slate-50 rounded p-1">
                            <div className="text-slate-500">Overdue</div>
                            <div className="font-bold text-rose-700 font-mono">{staff.overdueCount}</div>
                          </div>
                          <div className="text-center bg-slate-50 rounded p-1">
                            <div className="text-slate-500">Avg Var</div>
                            <div className={cn("font-bold font-mono", staff.avgVariancePerEvent > 0 ? "text-emerald-700" : staff.avgVariancePerEvent < 0 ? "text-rose-700" : "text-slate-600")}>
                              {staff.avgVariancePerEvent > 0 ? '+' : ''}{staff.avgVariancePerEvent}
                            </div>
                          </div>
                          <div className="text-center bg-slate-50 rounded p-1">
                            <div className="text-slate-500">Surplus</div>
                            <div className="font-bold text-emerald-700 font-mono">{staff.surplusItems}</div>
                          </div>
                          <div className="text-center bg-slate-50 rounded p-1">
                            <div className="text-slate-500">Shortage</div>
                            <div className="font-bold text-rose-700 font-mono">{staff.shortageItems}</div>
                          </div>
                        </div>
                        <div className="mt-2 text-[9px] text-slate-400">
                          First: {new Date(staff.firstEvent).toLocaleDateString('en-GB')} · Last: {new Date(staff.lastEvent).toLocaleDateString('en-GB')}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ===== Alerts tab (per-product variance thresholds) ===== */}
          {dashboardTab === 'alerts' && (
            <div className="p-3 space-y-3">
              <div className="bg-rose-50 ring-1 ring-rose-200 rounded-lg p-3 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-rose-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="text-xs font-bold text-rose-800">Variance Alert Thresholds</div>
                  <div className="text-[10px] text-rose-700 mt-0.5">
                    Products are flagged when their latest stocktake shrinkage exceeds the threshold (as a % of counted stock).
                    <strong> Warning</strong> = shrinkage ≥ threshold · <strong>Critical</strong> = shrinkage ≥ 2× threshold.
                    Set a global default below, or click a product to set a custom threshold.
                  </div>
                </div>
              </div>

              {/* Global threshold control */}
              <div className="bg-white rounded-lg ring-1 ring-slate-200 p-3 flex items-center gap-3">
                <label className="text-xs font-bold text-slate-700">Global threshold:</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={globalThreshold}
                  onChange={(e) => setGlobalThreshold(Math.max(1, Math.min(100, parseInt(e.target.value) || 5)))}
                  className="w-16 h-7 px-2 text-xs font-mono border border-slate-300 rounded outline-none focus:ring-1 focus:ring-rose-400"
                />
                <span className="text-xs text-slate-600">% of counted stock</span>
                <div className="flex-1" />
                <span className="text-[10px] text-slate-500">
                  {varianceAlerts.length} product(s) currently flagged · {varianceAlerts.filter(a => a.severity === 'critical').length} critical
                </span>
              </div>

              {varianceAlerts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                  <CheckCircle2 className="h-10 w-10 mb-2 opacity-40 text-emerald-500" />
                  <div className="text-sm font-medium">No variance alerts</div>
                  <div className="text-xs mt-1">All products are within their threshold. Adjust the global threshold above to see more alerts.</div>
                </div>
              ) : (
                <>
                  {/* Alerts list */}
                  <div className="bg-white rounded-lg ring-1 ring-slate-200 overflow-hidden">
                    <div className="grid grid-cols-[1.5fr_60px_70px_70px_70px_60px_60px] gap-0 px-3 py-1.5 text-[9px] font-bold text-white" style={{ backgroundColor: '#BE123C' }}>
                      <div>Product</div>
                      <div className="text-right">Stock</div>
                      <div className="text-right">Shrinkage</div>
                      <div className="text-right">Threshold</div>
                      <div className="text-right">% of Stock</div>
                      <div className="text-center">Severity</div>
                      <div className="text-center">Set %</div>
                    </div>
                    <div className="max-h-64 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
                      {varianceAlerts.map((alert, idx) => {
                        const actualPct = alert.threshold > 0 ? (Math.abs(alert.lastVariance) / alert.threshold) * alert.thresholdPct : 0;
                        const isEditing = thresholdEditProduct === alert.productId;
                        return (
                          <motion.div
                            key={alert.productId}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: Math.min(idx * 0.03, 0.3) }}
                            className={cn(
                              "grid grid-cols-[1.5fr_60px_70px_70px_70px_60px_60px] gap-0 px-3 py-2 text-[10px] border-b border-slate-50 transition",
                              alert.severity === 'critical' ? "bg-rose-50/50 hover:bg-rose-100" : "bg-amber-50/30 hover:bg-amber-100"
                            )}
                          >
                            <div className="min-w-0">
                              <div className="font-semibold text-slate-800 truncate">{alert.emoji} {alert.productName}</div>
                              <div className="text-[9px] text-slate-500 truncate font-mono">{alert.sku} · {alert.lastReference}</div>
                            </div>
                            <div className="text-right font-mono text-slate-700">{alert.currentStock}</div>
                            <div className="text-right font-mono font-bold text-rose-700">−{Math.abs(alert.lastVariance)}</div>
                            <div className="text-right font-mono text-slate-600">{alert.threshold.toFixed(1)}</div>
                            <div className="text-right font-mono font-bold text-rose-700">{alert.thresholdPct}%</div>
                            <div className="text-center">
                              <span className={cn(
                                "px-1.5 py-0.5 rounded text-[8px] font-bold uppercase text-white",
                                alert.severity === 'critical' ? "bg-rose-600" : "bg-amber-500"
                              )}>
                                {alert.severity}
                              </span>
                            </div>
                            <div className="text-center">
                              {isEditing ? (
                                <div className="flex items-center gap-0.5 justify-center">
                                  <input
                                    type="number"
                                    min="1"
                                    max="100"
                                    value={thresholdEditValue}
                                    onChange={(e) => setThresholdEditValue(Math.max(1, Math.min(100, parseInt(e.target.value) || 5)))}
                                    className="w-10 h-5 px-1 text-[9px] font-mono border border-slate-300 rounded outline-none focus:ring-1 focus:ring-rose-400"
                                    autoFocus
                                  />
                                  <button
                                    onClick={() => {
                                      setVarianceThresholds(prev => ({ ...prev, [alert.productId]: thresholdEditValue }));
                                      setThresholdEditProduct(null);
                                      toast({ title: 'Threshold set', description: `${alert.productName}: ${thresholdEditValue}%` });
                                    }}
                                    className="h-5 w-5 rounded bg-emerald-600 text-white flex items-center justify-center"
                                  >
                                    <CheckCircle2 className="h-3 w-3" />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => {
                                    setThresholdEditProduct(alert.productId);
                                    setThresholdEditValue(alert.thresholdPct);
                                  }}
                                  className="h-5 px-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 text-[9px] font-semibold transition"
                                  title="Set custom threshold for this product"
                                >
                                  {alert.thresholdPct}%
                                </button>
                              )}
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex-shrink-0 px-4 py-2 flex items-center gap-2 border-t border-slate-200 bg-slate-50">
          <button
            onClick={onStartStocktake}
            className="h-8 px-4 rounded-md bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold flex items-center gap-1.5 transition shadow-sm"
          >
            <ArrowUpDown className="h-3.5 w-3.5" /> Start New Stocktake
          </button>
          <button
            onClick={handleExport}
            disabled={stocktakeEvents.length === 0}
            className="h-8 px-4 rounded-md bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" /> Export All Events
          </button>
          <div className="flex-1" />
          <span className="text-[10px] text-slate-500">{stocktakeEvents.length} total events on record</span>
          <button onClick={onClose} className="h-8 px-4 rounded-md bg-rose-100 hover:bg-rose-200 text-rose-700 text-xs font-bold flex items-center gap-1.5 transition">
            <X className="h-3.5 w-3.5" /> Close
          </button>
        </div>
      </motion.div>

      {/* ===== Per-Product Variance Drill-Down Popup ===== */}
      <AnimatePresence>
        {drillDownProduct && productHistory && (
          <ProductVarianceDrillDown
            product={drillDownProduct}
            entries={productHistory}
            onClose={() => setDrillDownProduct(null)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ===== Product Variance Drill-Down Popup =====
// Shows the full stocktake history for a single product — every stocktake event
// where this product appeared, with date, reference, on-hand, counted, variance.
function ProductVarianceDrillDown({
  product,
  entries,
  onClose,
}: {
  product: { productId: string; productName: string; sku: string; emoji: string };
  entries: StockHistoryEntry[];
  onClose: () => void;
}) {
  const { toast } = useToast();

  // Compute stats
  const stats = useMemo(() => {
    if (entries.length === 0) return { totalEvents: 0, totalShortage: 0, totalSurplus: 0, avgVariance: 0, worstVariance: 0, worstDate: '' };
    const totalVariance = entries.reduce((s, e) => s + e.quantityChange, 0);
    const totalShortage = entries.filter(e => e.quantityChange < 0).reduce((s, e) => s + Math.abs(e.quantityChange), 0);
    const totalSurplus = entries.filter(e => e.quantityChange > 0).reduce((s, e) => s + e.quantityChange, 0);
    const avgVariance = Math.round(totalVariance / entries.length);
    let worstVariance = 0;
    let worstDate = '';
    entries.forEach(e => {
      if (e.quantityChange < worstVariance) {
        worstVariance = e.quantityChange;
        worstDate = e.timestamp;
      }
    });
    return { totalEvents: entries.length, totalShortage, totalSurplus, avgVariance, worstVariance, worstDate };
  }, [entries]);

  const fmtDate = (ts: string) => {
    try {
      const d = new Date(ts);
      return d.toLocaleDateString('en-GB') + ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    } catch { return ts; }
  };

  const handleExport = () => {
    if (entries.length === 0) { toast({ title: 'No data to export', variant: 'destructive' }); return; }
    import('xlsx').then((XLSX) => {
      type Row = Record<string, string | number>;
      const data: Row[] = entries.map((e, i) => ({
        '#': i + 1,
        'Date': fmtDate(e.timestamp),
        'Reference': e.reference || '',
        'Variance': e.quantityChange,
        'New Quantity': e.newQuantity,
        'User': e.user,
        'Reason': e.reason,
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      ws['!cols'] = [{ wch: 4 }, { wch: 18 }, { wch: 16 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 40 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, product.productName.slice(0, 20));
      XLSX.writeFile(wb, `variance-history-${product.sku}-${new Date().toISOString().split('T')[0]}.xlsx`);
      toast({ title: 'Exported successfully', description: `${entries.length} entries` });
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[80] flex items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-lg shadow-2xl overflow-hidden flex flex-col"
        style={{ width: '100%', maxWidth: '680px', maxHeight: '85vh', fontFamily: 'Arial, Helvetica, sans-serif' }}
      >
        {/* Title bar */}
        <div className="flex-shrink-0 flex items-center justify-between px-4 h-9 text-white" style={{ background: 'linear-gradient(to right, #B45309, #D97706)' }}>
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            <span className="text-sm font-bold">Variance History — {product.emoji} {product.productName}</span>
          </div>
          <button onClick={onClose} className="h-6 w-6 rounded bg-red-600 hover:bg-red-700 flex items-center justify-center transition"><X className="h-3.5 w-3.5 text-white" /></button>
        </div>

        {/* Product info + stats */}
        <div className="flex-shrink-0 px-4 py-3 bg-amber-50 border-b border-amber-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-lg bg-amber-100 flex items-center justify-center text-2xl">{product.emoji}</div>
            <div>
              <div className="font-bold text-slate-800 text-sm">{product.productName}</div>
              <div className="text-[10px] text-slate-500 font-mono">SKU: {product.sku}</div>
            </div>
          </div>
          <div className="grid grid-cols-5 gap-2">
            <div className="bg-white rounded p-1.5 ring-1 ring-slate-200 text-center">
              <div className="text-[8px] text-slate-500 uppercase font-semibold">Events</div>
              <div className="text-sm font-bold text-slate-800">{stats.totalEvents}</div>
            </div>
            <div className="bg-white rounded p-1.5 ring-1 ring-slate-200 text-center">
              <div className="text-[8px] text-slate-500 uppercase font-semibold">Total Lost</div>
              <div className="text-sm font-bold text-rose-600 font-mono">−{stats.totalShortage}</div>
            </div>
            <div className="bg-white rounded p-1.5 ring-1 ring-slate-200 text-center">
              <div className="text-[8px] text-slate-500 uppercase font-semibold">Total Gain</div>
              <div className="text-sm font-bold text-emerald-600 font-mono">+{stats.totalSurplus}</div>
            </div>
            <div className="bg-white rounded p-1.5 ring-1 ring-slate-200 text-center">
              <div className="text-[8px] text-slate-500 uppercase font-semibold">Avg Var</div>
              <div className={cn("text-sm font-bold font-mono", stats.avgVariance > 0 ? "text-emerald-600" : stats.avgVariance < 0 ? "text-rose-600" : "text-slate-600")}>
                {stats.avgVariance > 0 ? '+' : ''}{stats.avgVariance}
              </div>
            </div>
            <div className="bg-white rounded p-1.5 ring-1 ring-slate-200 text-center">
              <div className="text-[8px] text-slate-500 uppercase font-semibold">Worst</div>
              <div className="text-sm font-bold text-rose-700 font-mono">{stats.worstVariance}</div>
            </div>
          </div>
        </div>

        {/* History table */}
        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          <div className="flex-shrink-0 grid grid-cols-[1fr_100px_1.2fr_70px_70px] gap-0 px-3 py-1.5 text-[9px] font-bold text-white" style={{ backgroundColor: '#B45309' }}>
            <div>Date</div>
            <div>Reference</div>
            <div>Reason</div>
            <div className="text-right">Variance</div>
            <div className="text-right">New Qty</div>
          </div>
          <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
            {entries.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-[11px]">No stocktake history for this product</div>
            ) : (
              entries.map((e, idx) => (
                <div
                  key={e.id}
                  className="grid grid-cols-[1fr_100px_1.2fr_70px_70px] gap-0 px-3 py-1.5 text-[10px] border-b border-slate-50"
                  style={{ backgroundColor: idx % 2 === 1 ? '#FAFAFA' : '#FFFFFF' }}
                >
                  <div className="text-slate-700">{fmtDate(e.timestamp)}</div>
                  <div className="font-mono text-slate-600 truncate">{e.reference || '—'}</div>
                  <div className="text-slate-600 truncate text-[9px]">{e.reason}</div>
                  <div className={cn("text-right font-mono font-bold", e.quantityChange > 0 ? "text-emerald-700" : e.quantityChange < 0 ? "text-rose-700" : "text-slate-500")}>
                    {e.quantityChange > 0 ? '+' : ''}{e.quantityChange}
                  </div>
                  <div className="text-right font-mono text-slate-700">{e.newQuantity}</div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex-shrink-0 px-4 py-2 flex items-center gap-2 border-t border-slate-200 bg-slate-50">
          <button
            onClick={handleExport}
            disabled={entries.length === 0}
            className="h-8 px-4 rounded-md bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold flex items-center gap-1.5 transition disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" /> Export History (XLSX)
          </button>
          <div className="flex-1" />
          <span className="text-[10px] text-slate-500">{entries.length} stocktake event(s) for this product</span>
          <button onClick={onClose} className="h-8 px-4 rounded-md bg-rose-100 hover:bg-rose-200 text-rose-700 text-xs font-bold flex items-center gap-1.5 transition">
            <X className="h-3.5 w-3.5" /> Close
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
