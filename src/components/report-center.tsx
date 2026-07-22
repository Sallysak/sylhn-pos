"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Search, FileText, TrendingUp, BarChart3, Percent,
  DollarSign, Package, Download, Printer, FileBarChart, Calendar,
  Clock, History, RotateCcw, Layers, Boxes, FileBarChart2,
  ChevronRight, Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { COMPANY, formatGHS } from "@/lib/pos-data";

interface ReportCenterProps {
  onBack: () => void;
  onNavigate: (view: string, reportType?: string) => void;
}

interface ReportCategory {
  id: string;
  label: string;
  icon: any;
  color: string;
  reports: ReportItem[];
}

interface ReportItem {
  id: string;
  label: string;
  description: string;
  icon: any;
  view: string;
  reportType?: string;
  external?: boolean;
  url?: string;
}

export function ReportCenter({ onBack, onNavigate }: ReportCenterProps) {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const { toast } = useToast();

  const categories: ReportCategory[] = [
    {
      id: "sales",
      label: "Sales Reports",
      icon: TrendingUp,
      color: "from-emerald-500 to-teal-600",
      reports: [
        { id: "daily-sales", label: "Daily Sales Report", description: "Today's transactions with payment breakdown", icon: TrendingUp, view: "daily-sales" },
        { id: "sales-history", label: "Sales History", description: "Search and filter all past sales", icon: History, view: "sales-history" },
        { id: "sales-menu", label: "Sales Reports Center", description: "10 report types: invoice list, by client, by cashier, by product", icon: FileText, view: "sales-menu" },
        { id: "sold-items", label: "Sold Items Report", description: "Line-by-line sold items by category or product", icon: FileBarChart, view: "sold-items" },
      ],
    },
    {
      id: "accounts",
      label: "Accounts & Finance",
      icon: DollarSign,
      color: "from-blue-500 to-indigo-600",
      reports: [
        { id: "daily-summary", label: "Daily Sales Summary", description: "End-of-day reconciliation summary", icon: TrendingUp, view: "accounts-reports", reportType: "daily-sales" },
        { id: "monthly-summary", label: "Monthly Summary", description: "Monthly revenue, profit, and tax breakdown", icon: BarChart3, view: "accounts-reports", reportType: "monthly-summary" },
        { id: "profit-loss", label: "Profit & Loss", description: "Revenue minus cost of goods sold", icon: DollarSign, view: "accounts-reports", reportType: "profit-loss" },
        { id: "vat-tax", label: "VAT Tax Report", description: "VAT collected for GRA filing", icon: Percent, view: "accounts-reports", reportType: "vat-tax" },
        { id: "gra-json", label: "GRA e-VAT Filing (JSON)", description: "Export VAT return in GRA JSON format", icon: FileText, view: "", external: true, url: "/api/reports/vat-filing/e-file?format=json" },
        { id: "gra-xml", label: "GRA e-VAT Filing (XML)", description: "Export VAT return in GRA XML format", icon: FileText, view: "", external: true, url: "/api/reports/vat-filing/e-file?format=xml" },
      ],
    },
    {
      id: "inventory",
      label: "Inventory Reports",
      icon: Package,
      color: "from-amber-500 to-orange-600",
      reports: [
        { id: "stock-value", label: "Stock Value Report", description: "Current stock value at cost and retail", icon: DollarSign, view: "accounts-reports", reportType: "stock-value" },
        { id: "cost-price", label: "Cost Price Report", description: "Cost price analysis per product", icon: FileText, view: "accounts-reports", reportType: "cost-price" },
        { id: "stock-performance", label: "Stock Performance", description: "Top and slow movers by revenue", icon: TrendingUp, view: "accounts-reports", reportType: "stock-performance" },
        { id: "stock-group", label: "Stock Group Report", description: "Inventory breakdown by category group", icon: Layers, view: "accounts-reports", reportType: "stock-group" },
        { id: "reorder", label: "Reorder Report", description: "Products at or below reorder level", icon: RotateCcw, view: "reports" },
        { id: "expiry", label: "Expiry Date Report", description: "Products expiring soon or expired", icon: Calendar, view: "reports" },
        { id: "stock-qty", label: "Stock Quantities Report", description: "Current stock levels for all products", icon: Boxes, view: "reports" },
      ],
    },
    {
      id: "dashboard",
      label: "Operations Dashboard",
      icon: BarChart3,
      color: "from-violet-500 to-fuchsia-600",
      reports: [
        { id: "dashboard", label: "Operations Dashboard", description: "Real-time KPIs: revenue, profit, top products, low stock, expiry", icon: BarChart3, view: "dashboard" },
        { id: "stock-history-pro", label: "Stock History Pro", description: "Advanced stock movement analytics with charts", icon: TrendingUp, view: "stock-history-pro" },
      ],
    },
    {
      id: "accounting",
      label: "Accounting",
      icon: FileBarChart2,
      color: "from-slate-500 to-slate-700",
      reports: [
        { id: "general-ledger", label: "General Ledger", description: "Complete transaction ledger", icon: FileText, view: "accounts-reports", reportType: "general-ledger" },
        { id: "trial-balance", label: "Trial Balance", description: "Debit/credit balance summary", icon: BarChart3, view: "accounts-reports", reportType: "trial-balance" },
        { id: "accounts-reports", label: "Full Accounts Reports", description: "All accounting reports in one place", icon: FileBarChart2, view: "accounts-reports" },
      ],
    },
  ];

  const allReports = useMemo(() => {
    return categories.flatMap(c => c.reports.map(r => ({ ...r, category: c.label, categoryColor: c.color })));
  }, []);

  const filteredReports = useMemo(() => {
    if (!search) return null;
    const q = search.toLowerCase();
    return allReports.filter(r =>
      r.label.toLowerCase().includes(q) ||
      r.description.toLowerCase().includes(q) ||
      r.category.toLowerCase().includes(q)
    );
  }, [search, allReports]);

  const handleReportClick = (report: ReportItem) => {
    if (report.external && report.url) {
      window.open(report.url, "_blank");
    } else {
      onNavigate(report.view, report.reportType);
    }
    toast({ title: "Opening report", description: report.label });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      {/* Header */}
      <div className="sticky top-0 z-10 backdrop-blur-xl bg-white/80 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={onBack}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Back
            </Button>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <FileBarChart className="h-5 w-5 text-violet-600" />
                Report Center
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                All reports in one place — {allReports.length} reports across {categories.length} categories
              </p>
            </div>
          </div>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search reports…"
              className="pl-9 h-9 text-sm"
            />
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6">
        {/* Search results */}
        {filteredReports ? (
          <div className="space-y-2">
            <div className="text-xs font-bold text-slate-500 uppercase mb-2">
              {filteredReports.length} result(s) for "{search}"
            </div>
            {filteredReports.map(r => (
              <button
                key={r.id}
                onClick={() => handleReportClick(r)}
                className="w-full flex items-center gap-3 p-3 rounded-xl bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-800 hover:ring-violet-300 hover:bg-violet-50/30 dark:hover:bg-violet-900/10 transition text-left"
              >
                <div className={cn("h-9 w-9 rounded-lg bg-gradient-to-br flex items-center justify-center text-white flex-shrink-0", r.categoryColor)}>
                  <r.icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm text-slate-800 dark:text-slate-200">{r.label}</div>
                  <div className="text-xs text-slate-500 truncate">{r.description}</div>
                </div>
                <Badge variant="outline" className="text-[9px] flex-shrink-0">{r.category}</Badge>
                <ChevronRight className="h-4 w-4 text-slate-300 flex-shrink-0" />
              </button>
            ))}
            {filteredReports.length === 0 && (
              <div className="text-center py-12 text-slate-400 text-sm">
                <Search className="h-10 w-10 mx-auto mb-3 opacity-30" />
                No reports found matching "{search}"
              </div>
            )}
          </div>
        ) : (
          /* Category cards */
          <div className="space-y-4">
            {categories.map(cat => (
              <div key={cat.id} className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm ring-1 ring-slate-200 dark:ring-slate-800 overflow-hidden">
                <div className={cn("flex items-center gap-3 px-5 py-3 bg-gradient-to-r text-white", cat.color)}>
                  <cat.icon className="h-5 w-5" />
                  <h2 className="text-sm font-bold">{cat.label}</h2>
                  <Badge className="ml-auto bg-white/20 text-white text-[10px]">{cat.reports.length} reports</Badge>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {cat.reports.map(r => (
                    <button
                      key={r.id}
                      onClick={() => handleReportClick(r)}
                      className="w-full flex items-center gap-3 px-5 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition text-left group"
                    >
                      <r.icon className="h-4 w-4 text-slate-400 group-hover:text-violet-600 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm text-slate-800 dark:text-slate-200">{r.label}</div>
                        <div className="text-xs text-slate-500 truncate">{r.description}</div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-violet-500 flex-shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function cn(...args: any[]) { return args.filter(Boolean).join(" "); }
