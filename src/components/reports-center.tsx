"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Search, Filter, Download, FileText, Printer, TrendingUp,
  BarChart3, Percent, DollarSign, Package, Clock, Calendar, FileBarChart,
  FileBarChart2, BookOpen, Layers, FileSpreadsheet, ChevronRight, RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { COMPANY } from "@/lib/pos-data";
import { type ViewMode } from "@/lib/pos-types";

interface ReportsCenterProps {
  onBack: () => void;
  onNavigate: (view: ViewMode) => void;
  onSetAccountsReport?: (report: string) => void;
}

interface ReportItem {
  id: string;
  title: string;
  description: string;
  icon: any;
  color: string;
  category: string;
  view?: ViewMode;
  accountsReport?: string;
  action?: () => void;
}

const REPORT_CATEGORIES: { id: string; label: string; icon: any; color: string }[] = [
  { id: "sales", label: "Sales Reports", icon: TrendingUp, color: "text-emerald-600" },
  { id: "inventory", label: "Inventory Reports", icon: Package, color: "text-amber-600" },
  { id: "financial", label: "Financial Reports", icon: DollarSign, color: "text-blue-600" },
  { id: "tax", label: "Tax & Compliance", icon: Percent, color: "text-rose-600" },
  { id: "operations", label: "Operations", icon: Clock, color: "text-violet-600" },
];

export function ReportsCenter({ onBack, onNavigate, onSetAccountsReport }: ReportsCenterProps) {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");

  const allReports: ReportItem[] = [
    // Sales
    { id: "sales-menu", title: "Sales Reports Center", description: "Invoice list, payment methods, sales by cashier/client", icon: FileText, color: "text-emerald-600", category: "sales", view: "sales-menu" },
    { id: "sold-items", title: "Sold Items Report", description: "Line-by-line sold items grouped by category", icon: FileBarChart, color: "text-emerald-600", category: "sales", view: "sold-items" },
    { id: "sales-history", title: "Sales History", description: "Complete transaction history with filters", icon: TrendingUp, color: "text-emerald-600", category: "sales", view: "sales-history" },
    { id: "daily-sales", title: "Daily Sales Report", description: "Daily summary with print/PDF/Excel export", icon: BarChart3, color: "text-emerald-600", category: "sales", view: "daily-sales" },
    { id: "receipt-archive", title: "Receipt Archive", description: "Browse and reprint past receipts", icon: FileText, color: "text-emerald-600", category: "sales", view: "receipt-archive" },
    // Inventory
    { id: "reports", title: "Stock Reports", description: "Quantities, stock value, reorder, expiry reports", icon: FileBarChart2, color: "text-amber-600", category: "inventory", view: "reports" },
    { id: "stock-history-pro", title: "Stock History Pro", description: "Advanced stock movement analytics with charts", icon: TrendingUp, color: "text-amber-600", category: "inventory", view: "stock-history-pro" },
    { id: "stock-value", title: "Stock Value Report", description: "Current inventory valuation at cost and retail", icon: DollarSign, color: "text-amber-600", category: "inventory", accountsReport: "stock-value" },
    { id: "cost-price", title: "Cost Price Report", description: "Product cost analysis and price comparison", icon: FileText, color: "text-amber-600", category: "inventory", accountsReport: "cost-price" },
    { id: "stock-performance", title: "Stock Performance", description: "Product turnover and performance metrics", icon: TrendingUp, color: "text-amber-600", category: "inventory", accountsReport: "stock-performance" },
    { id: "stock-group", title: "Stock Group Report", description: "Inventory grouped by category", icon: Layers, color: "text-amber-600", category: "inventory", accountsReport: "stock-group" },
    // Financial
    { id: "daily-sales-summary", title: "Daily Sales Summary", description: "Summary of daily revenue and transactions", icon: TrendingUp, color: "text-blue-600", category: "financial", accountsReport: "daily-sales" },
    { id: "daily-sales-detail", title: "Daily Sales Detail", description: "Detailed breakdown of each day's sales", icon: FileText, color: "text-blue-600", category: "financial", accountsReport: "daily-sales-detail" },
    { id: "monthly-summary", title: "Monthly Summary", description: "Monthly revenue, profit, and transaction overview", icon: BarChart3, color: "text-blue-600", category: "financial", accountsReport: "monthly-summary" },
    { id: "monthly-detail", title: "Monthly Detail", description: "Day-by-day breakdown for each month", icon: FileBarChart2, color: "text-blue-600", category: "financial", accountsReport: "monthly-detail" },
    { id: "profit-loss", title: "Profit & Loss", description: "Revenue, costs, and net profit analysis", icon: BarChart3, color: "text-blue-600", category: "financial", accountsReport: "profit-loss" },
    { id: "general-ledger", title: "General Ledger", description: "Complete accounting ledger by date", icon: BookOpen, color: "text-blue-600", category: "financial", accountsReport: "general-ledger" },
    { id: "trial-balance", title: "Trial Balance", description: "Debit/credit balance verification", icon: FileBarChart2, color: "text-blue-600", category: "financial", accountsReport: "trial-balance" },
    // Tax
    { id: "vat-tax", title: "VAT Tax Report", description: "VAT collected and payable summary", icon: Percent, color: "text-rose-600", category: "tax", accountsReport: "vat-tax" },
    // Operations
    { id: "dashboard", title: "Operations Dashboard", description: "KPIs, reorder alerts, expiry tracking, profit analysis", icon: Clock, color: "text-violet-600", category: "operations", view: "dashboard" },
    { id: "accounts-reports", title: "Accounts Reports Hub", description: "Full accounts reporting suite with export", icon: FileSpreadsheet, color: "text-violet-600", category: "operations", view: "accounts-reports" },
  ];

  const filtered = allReports.filter(r => {
    if (activeCategory !== "all" && r.category !== activeCategory) return false;
    if (search) {
      const q = search.toLowerCase();
      return r.title.toLowerCase().includes(q) || r.description.toLowerCase().includes(q);
    }
    return true;
  });

  const handleReportClick = (report: ReportItem) => {
    if (report.accountsReport && onSetAccountsReport) {
      onSetAccountsReport(report.accountsReport);
      onNavigate("accounts-reports" as ViewMode);
    } else if (report.view) {
      onNavigate(report.view);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      {/* Header */}
      <div className="sticky top-0 z-10 backdrop-blur-xl bg-white/80 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={onBack}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Back
            </Button>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <FileBarChart className="h-5 w-5 text-blue-600" />
                Reports Center
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">All reports in one place — {allReports.length} reports available</p>
            </div>
          </div>
          <div className="relative w-48 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search reports…"
              className="pl-9 h-9 text-xs"
            />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Category tabs */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveCategory("all")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-semibold transition",
              activeCategory === "all"
                ? "bg-slate-800 text-white"
                : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
            )}
          >
            All Reports ({allReports.length})
          </button>
          {REPORT_CATEGORIES.map(cat => {
            const Icon = cat.icon;
            const count = allReports.filter(r => r.category === cat.id).length;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5",
                  activeCategory === cat.id
                    ? "bg-slate-800 text-white"
                    : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                )}
              >
                <Icon className={cn("h-3.5 w-3.5", activeCategory === cat.id ? "text-white" : cat.color)} />
                {cat.label} ({count})
              </button>
            );
          })}
        </div>

        {/* Report cards grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          <AnimatePresence mode="popLayout">
            {filtered.map(report => {
              const Icon = report.icon;
              return (
                <motion.button
                  key={report.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.15 }}
                  onClick={() => handleReportClick(report)}
                  className="group bg-white dark:bg-slate-900 rounded-2xl ring-1 ring-slate-200 dark:ring-slate-800 p-4 text-left hover:ring-2 hover:ring-blue-300 dark:hover:ring-blue-700 hover:shadow-lg transition-all"
                >
                  <div className="flex items-start gap-3 mb-2">
                    <div className={cn("h-10 w-10 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition")}>
                      <Icon className={cn("h-5 w-5", report.color)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm text-slate-800 dark:text-slate-200 leading-tight">{report.title}</div>
                      <div className="text-[10px] text-slate-400 uppercase tracking-wider mt-0.5">{report.category}</div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-blue-500 group-hover:translate-x-0.5 transition flex-shrink-0" />
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{report.description}</p>
                </motion.button>
              );
            })}
          </AnimatePresence>
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-16 text-slate-400">
            <Search className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No reports match your search</p>
          </div>
        )}
      </div>
    </div>
  );
}
