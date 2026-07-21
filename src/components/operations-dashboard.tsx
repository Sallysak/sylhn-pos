"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, TrendingUp, TrendingDown, DollarSign, ShoppingCart,
  Package, AlertTriangle, Clock, BarChart3, Activity, RefreshCw,
  Search, Printer, RotateCcw, X, Calendar, AlertCircle, CheckCircle2,
  Star, Boxes, Percent, FileText, ChevronRight, ArrowUpRight, ArrowDownRight,
  Plus, Download, FileBarChart, Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { COMPANY, formatGHS } from "@/lib/pos-data";
import { exportReportToPDF, exportReportToExcel, exportReportToCSV, printReport } from "@/lib/report-utils";
import type { ReportData } from "@/lib/pos-types";

// Premium fix: the original component used `p.quantity` and `p.active` from
// the Prisma Product shape, but received `Product` typed against pos-data.ts
// (which uses `p.stock`, no `active`). Now we accept either shape and
// normalize at the boundary.
interface DashboardProduct {
  id: string;
  sku: string;
  name: string;
  emoji: string;
  category: string;
  price: number;
  costPrice: number;
  unit: string;
  reorderLevel: number;
  barcode?: string;
  // Accept either `stock` (pos-data) or `quantity` (Prisma)
  stock?: number;
  quantity?: number;
  active?: boolean;
  expiryDate?: string | Date | null;
}

// Normalize to the Prisma shape so all downstream code can use p.quantity
function normalizeProduct(p: DashboardProduct): DashboardProduct & { quantity: number; active: boolean; expiryDate: string | null } {
  const qty = (p as any).quantity ?? (p as any).stock ?? 0;
  const expiry = p.expiryDate
    ? (p.expiryDate instanceof Date ? p.expiryDate.toISOString() : String(p.expiryDate))
    : null;
  return { ...p, quantity: qty, active: p.active !== false, expiryDate: expiry };
}
import { useToast } from "@/hooks/use-toast";

interface OperationsDashboardProps {
  products: DashboardProduct[];
  onBack: () => void;
  dailyTotal?: number;
  transactionCount?: number;
}

type Tab = "overview" | "sales-history" | "reorder" | "expiry" | "profit";

interface SaleRecord {
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
  items: Array<{
    id: string;
    sku: string;
    name: string;
    emoji?: string;
    price: number;
    quantity: number;
    discount: number;
    total: number;
  }>;
}

export function OperationsDashboard({ products: rawProducts, onBack, dailyTotal = 0, transactionCount = 0 }: OperationsDashboardProps) {
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>("overview");
  const [refreshKey, setRefreshKey] = useState(0);
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [loadingSales, setLoadingSales] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSale, setSelectedSale] = useState<SaleRecord | null>(null);

  // ===== Reorder tab: multi-filter + editable suggested qty + PO report =====
  const [reorderSearch, setReorderSearch] = useState("");
  const [reorderCategory, setReorderCategory] = useState("all");
  const [reorderSupplier, setReorderSupplier] = useState("all");
  // User-edited suggested quantities: { [productId]: number }
  // Falls back to the auto-computed suggestedQty if not edited.
  const [editedQtys, setEditedQtys] = useState<Record<string, number>>({});
  // PO report dialog: shows created POs with print/export options
  const [poReport, setPoReport] = useState<null | {
    pos: Array<{
      refNo: string;
      supplierName: string;
      supplierId: string | null;
      items: Array<{
        partNo: string;
        details: string;
        emoji: string;
        quantity: number;
        cost: number;
        total: number;
      }>;
      total: number;
      status: string;
      createdAt: string;
    }>;
    totalCount: number;
    totalCost: number;
  }>(null);

  // Premium fix: normalize all products so `p.quantity` and `p.active` always exist
  const products = useMemo(() => (rawProducts || []).map(normalizeProduct), [rawProducts]);

  // Premium: fetch the full dashboard payload from the new /api/dashboard endpoint
  // (sales KPIs + low stock + expiry + hourly + trend + inventory in one call)
  const [dashboard, setDashboard] = useState<any>(null);
  const [loadingDashboard, setLoadingDashboard] = useState(true);
  const fetchDashboard = useCallback(async () => {
    setLoadingDashboard(true);
    try {
      const res = await fetch("/api/dashboard", { credentials: "include" });
      if (res.ok) setDashboard(await res.json());
    } catch (e) {
      console.warn("Failed to fetch dashboard:", e);
    } finally {
      setLoadingDashboard(false);
    }
  }, []);
  useEffect(() => { fetchDashboard(); }, [fetchDashboard, refreshKey]);

  // ===== Fetch sales from API =====
  const fetchSales = useCallback(async () => {
    setLoadingSales(true);
    try {
      const res = await fetch("/api/sales?limit=200", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setSales(data.sales || []);
      }
    } catch (e) {
      console.warn("Failed to fetch sales:", e);
    } finally {
      setLoadingSales(false);
    }
  }, []);

  useEffect(() => {
    fetchSales();
  }, [fetchSales, refreshKey]);

  // ===== KPI calculations =====
  const kpis = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    const todaySales = sales.filter(s => s.createdAt?.startsWith(today) && s.status === "completed");
    const totalRevenue = todaySales.reduce((sum, s) => sum + (s.total || 0), 0);
    const totalItems = todaySales.reduce((sum, s) =>
      sum + (s.items?.reduce((s2, i) => s2 + (i.quantity || 0), 0) || 0), 0);
    const avgTransaction = todaySales.length > 0 ? totalRevenue / todaySales.length : 0;
    const stockValue = products.reduce((sum, p) => sum + (p.quantity * p.costPrice), 0);
    const potentialRevenue = products.reduce((sum, p) => sum + (p.quantity * p.price), 0);
    const potentialProfit = potentialRevenue - stockValue;

    return {
      totalRevenue,
      totalItems,
      avgTransaction,
      transactionCount: todaySales.length,
      stockValue,
      potentialRevenue,
      potentialProfit,
    };
  }, [sales, products]);

  // ===== Top products by revenue =====
  const topProducts = useMemo(() => {
    const productSales: Record<string, { name: string; emoji: string; qty: number; revenue: number }> = {};
    for (const sale of sales) {
      if (sale.status !== "completed") continue;
      for (const item of (sale.items || [])) {
        const key = item.sku || item.name;
        const product = products.find(p => p.sku === item.sku);
        if (!productSales[key]) {
          productSales[key] = { name: item.name, emoji: product?.emoji || "📦", qty: 0, revenue: 0 };
        }
        productSales[key].qty += item.quantity || 0;
        productSales[key].revenue += item.total || 0;
      }
    }
    return Object.values(productSales).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
  }, [sales, products]);

  // ===== Recent sales (for overview feed) =====
  const recentSales = useMemo(() => {
    return [...sales]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 6);
  }, [sales]);

  // ===== Filtered sales (for sales history tab) =====
  const filteredSales = useMemo(() => {
    if (!searchQuery) return sales;
    const q = searchQuery.toLowerCase();
    return sales.filter(s =>
      s.invoiceNumber?.toLowerCase().includes(q) ||
      s.customerName?.toLowerCase().includes(q) ||
      s.cashierName?.toLowerCase().includes(q) ||
      s.paymentMethod?.toLowerCase().includes(q)
    );
  }, [sales, searchQuery]);

  // ===== Reorder alerts =====
  // Compute the base reorder list (products at or below reorder level).
  // The list is STABLE — it only changes when product quantities change on
  // the server. Creating a PO now uses status='ordered' (not 'received'),
  // so stock is NOT auto-incremented and items stay in the reorder list
  // until you explicitly receive the PO in the Purchase module.
  const reorderProducts = useMemo(() => {
    return products
      .filter(p => p.quantity <= p.reorderLevel && p.active !== false)
      .map(p => {
        const autoSuggested = Math.max(0, (p.reorderLevel * 2) - p.quantity);
        // Use user-edited qty if set, otherwise the auto-computed suggestion
        const suggestedQty = editedQtys[p.id] !== undefined ? editedQtys[p.id] : autoSuggested;
        return {
          ...p,
          suggestedQty,
          autoSuggestedQty: autoSuggested,
          reorderCost: suggestedQty * p.costPrice,
        };
      })
      .sort((a, b) => a.quantity - b.quantity);
  }, [products, editedQtys]);

  // ===== Apply multi-filters to reorder list =====
  // Filters: product search (name/SKU/barcode), category, supplier.
  // These are applied AFTER the base reorder computation so the user
  // can narrow down without losing the full list.
  const filteredReorderProducts = useMemo(() => {
    return reorderProducts.filter(p => {
      // Search filter
      if (reorderSearch) {
        const q = reorderSearch.toLowerCase();
        const nameMatch = (p.name || "").toLowerCase().includes(q);
        const skuMatch = (p.sku || "").toLowerCase().includes(q);
        const barcodeMatch = (p.barcode || "").toLowerCase().includes(q);
        if (!nameMatch && !skuMatch && !barcodeMatch) return false;
      }
      // Category filter
      if (reorderCategory !== "all") {
        if ((p.category || "other") !== reorderCategory) return false;
      }
      // Supplier filter
      if (reorderSupplier !== "all") {
        if (reorderSupplier === "unassigned") {
          if ((p as any).preferredSupplierName) return false;
        } else if ((p as any).preferredSupplierName !== reorderSupplier) {
          return false;
        }
      }
      return true;
    });
  }, [reorderProducts, reorderSearch, reorderCategory, reorderSupplier]);

  // Unique categories and suppliers for the filter dropdowns
  const reorderCategories = useMemo(() => {
    const set = new Set<string>();
    reorderProducts.forEach(p => set.add(p.category || "other"));
    return Array.from(set).sort();
  }, [reorderProducts]);

  const reorderSuppliers = useMemo(() => {
    const set = new Set<string>();
    reorderProducts.forEach(p => {
      const name = (p as any).preferredSupplierName;
      if (name) set.add(name);
    });
    return Array.from(set).sort();
  }, [reorderProducts]);

  // Helper: get the effective suggested qty for a product (edited or auto)
  const getEffectiveQty = (productId: string, autoQty: number): number => {
    return editedQtys[productId] !== undefined ? editedQtys[productId] : autoQty;
  };

  // Helper: update the edited qty for a product
  const updateEditedQty = (productId: string, qty: number) => {
    setEditedQtys(prev => ({ ...prev, [productId]: Math.max(0, Math.floor(qty) || 0) }));
  };

  const totalReorderCost = filteredReorderProducts.reduce((sum, p) => sum + (p as any).reorderCost, 0);

  // ===== Expiry tracking =====
  const expiryProducts = useMemo(() => {
    const now = new Date();
    return products
      .filter(p => p.expiryDate && p.active !== false)
      .map(p => {
        const expiry = new Date(p.expiryDate as any);
        const daysUntilExpiry = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        let urgency: "expired" | "critical" | "warning" | "soon" | "ok" = "ok";
        if (daysUntilExpiry < 0) urgency = "expired";
        else if (daysUntilExpiry <= 7) urgency = "critical";
        else if (daysUntilExpiry <= 14) urgency = "warning";
        else if (daysUntilExpiry <= 30) urgency = "soon";
        return { ...p, daysUntilExpiry, urgency, stockValueAtRisk: p.quantity * p.costPrice };
      })
      .filter(p => p.urgency !== "ok")
      .sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);
  }, [products]);

  const expiryValueAtRisk = expiryProducts.reduce((sum, p) => sum + (p as any).stockValueAtRisk, 0);

  // ===== Profit analysis =====
  const profitData = useMemo(() => {
    return products
      .filter(p => p.active !== false)
      .map(p => {
        const margin = p.price - p.costPrice;
        const marginPct = p.price > 0 ? (margin / p.price) * 100 : 0;
        const stockValue = p.quantity * p.costPrice;
        const potentialProfit = p.quantity * margin;
        let health: "excellent" | "good" | "low" | "loss" = "good";
        if (marginPct >= 50) health = "excellent";
        else if (marginPct >= 25) health = "good";
        else if (marginPct >= 10) health = "low";
        else health = "loss";
        return { ...p, margin, marginPct, stockValue, potentialProfit, health };
      })
      .sort((a, b) => b.potentialProfit - a.potentialProfit);
  }, [products]);

  const profitSummary = useMemo(() => {
    const totalCost = profitData.reduce((s, p) => s + p.stockValue, 0);
    const totalRevenue = profitData.reduce((s, p) => s + (p.quantity * p.price), 0);
    const totalProfit = profitData.reduce((s, p) => s + p.potentialProfit, 0);
    return { totalCost, totalRevenue, totalProfit };
  }, [profitData]);

  // ===== Refund handler =====
  const handleRefund = async (sale: SaleRecord) => {
    if (!confirm(`Refund sale ${sale.invoiceNumber}? This will restore stock and mark the sale as refunded.`)) return;
    try {
      const res = await fetch(`/api/sales/${sale.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: "refunded" }),
      });
      if (res.ok) {
        toast({ title: "Sale refunded", description: `${sale.invoiceNumber} — stock restored`, variant: "destructive" });
        fetchSales();
        fetchDashboard();
        setSelectedSale(null);
      } else {
        const data = await res.json();
        toast({ title: "Refund failed", description: data.error || "Unknown error", variant: "destructive" });
      }
    } catch (e) {
      toast({ title: "Refund failed", description: "Network error", variant: "destructive" });
    }
  };

  // ===== Premium: Create Purchase Order for a single low-stock product =====
  // IMPORTANT: Uses status='ordered' (NOT 'received') so stock is NOT
  // auto-incremented. The product stays in the reorder list until you
  // explicitly receive the PO in the Purchase module. This prevents the
  // "data disappears without consent" issue.
  const handleCreatePO = async (product: any, suggestedQty: number, supplierId: string | null, supplierName: string | null, supplierCost: number | null) => {
    if (suggestedQty <= 0) {
      toast({ title: "Invalid quantity", description: "Suggested qty must be greater than 0", variant: "destructive" });
      return;
    }
    if (!confirm(`Create purchase order for ${suggestedQty} × ${product.name} @ GHS ${(supplierCost || product.costPrice).toFixed(2)}?`)) return;
    try {
      const cost = supplierCost || product.costPrice;
      const total = +(cost * suggestedQty).toFixed(2);
      const res = await fetch('/api/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          type: 'purchase',
          supplierId: supplierId || null,
          supplierName: supplierName || 'Unassigned',
          status: 'ordered',  // NOT 'received' — stock stays unchanged until PO is received
          subtotal: total,
          taxAmount: 0,
          total,
          amountPaid: 0,
          notes: `Reorder PO from Operations Dashboard — ${product.name} at ${product.quantity} units (reorder level: ${product.reorderLevel})`,
          createdBy: 'Operations Dashboard',
          items: [{
            productId: product.id,
            partNo: product.sku,
            details: product.name,
            emoji: product.emoji,
            quantity: suggestedQty,
            cost,
            tax: false,
            total,
          }],
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast({
          title: 'Purchase Order Created',
          description: `${data.purchase.refNo} — ${suggestedQty} × ${product.name} @ GHS ${cost.toFixed(2)} = GHS ${total.toFixed(2)}${supplierId ? ` (${supplierName})` : ''}`,
        });
        // Show the PO report dialog with print/export options
        setPoReport({
          pos: [{
            refNo: data.purchase.refNo,
            supplierName: supplierName || 'Unassigned',
            supplierId,
            items: [{
              partNo: product.sku,
              details: product.name,
              emoji: product.emoji,
              quantity: suggestedQty,
              cost,
              total,
            }],
            total,
            status: 'ordered',
            createdAt: new Date().toISOString(),
          }],
          totalCount: 1,
          totalCost: total,
        });
        fetchDashboard();
      } else {
        toast({ title: 'Failed to create PO', description: data.error || '', variant: 'destructive' });
      }
    } catch (e: any) {
      toast({ title: 'Network error', description: e?.message || '', variant: 'destructive' });
    }
  };

  // ===== Premium: Create PO for ALL low-stock items (one PO per supplier) =====
  // Uses the FILTERED reorder list (so filters are respected) and the
  // user-edited suggested quantities. Creates POs with status='ordered'
  // so stock is NOT auto-incremented — items stay in the reorder list.
  const handleCreateAllPOs = async () => {
    const itemsToOrder = filteredReorderProducts;
    if (itemsToOrder.length === 0) {
      toast({ title: "No items to order", description: "Adjust your filters to include items.", variant: "destructive" });
      return;
    }
    if (!confirm(`Create purchase orders for ${itemsToOrder.length} low-stock item(s)? Items will be grouped by their preferred supplier. Stock will NOT change until you receive the POs.`)) return;

    // Group by supplier
    const bySupplier: Record<string, { items: any[]; supplierId: string | null; supplierName: string }> = {};
    for (const p of itemsToOrder) {
      const supplierId = (p as any).preferredSupplierId || 'unassigned';
      if (!bySupplier[supplierId]) {
        bySupplier[supplierId] = {
          supplierId: (p as any).preferredSupplierId || null,
          supplierName: (p as any).preferredSupplierName || 'Unassigned',
          items: [],
        };
      }
      bySupplier[supplierId].items.push(p);
    }

    const createdPOs: any[] = [];
    let successCount = 0;
    let totalCost = 0;

    for (const group of Object.values(bySupplier)) {
      const items = group.items.map((p: any) => ({
        productId: p.id,
        partNo: p.sku,
        details: p.name,
        emoji: p.emoji,
        quantity: p.suggestedQty,  // uses edited qty if set, else auto-suggested
        cost: p.preferredSupplierCost || p.costPrice,
        tax: false,
        total: +((p.preferredSupplierCost || p.costPrice) * p.suggestedQty).toFixed(2),
      }));
      const groupTotal = items.reduce((s: number, i: any) => s + i.total, 0);
      totalCost += groupTotal;
      try {
        const res = await fetch('/api/purchases', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            type: 'purchase',
            supplierId: group.supplierId,
            supplierName: group.supplierName,
            status: 'ordered',  // NOT 'received' — stock stays unchanged
            subtotal: groupTotal,
            taxAmount: 0,
            total: groupTotal,
            amountPaid: 0,
            notes: `Bulk reorder from Operations Dashboard — ${items.length} items`,
            createdBy: 'Operations Dashboard',
            items,
          }),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          successCount++;
          createdPOs.push({
            refNo: data.purchase.refNo,
            supplierName: group.supplierName,
            supplierId: group.supplierId,
            items,
            total: groupTotal,
            status: 'ordered',
            createdAt: new Date().toISOString(),
          });
        }
      } catch (e) {
        console.error('PO creation failed:', e);
      }
    }

    toast({
      title: `${successCount} PO(s) created`,
      description: successCount > 0 ? `Total restock cost: GHS ${totalCost.toFixed(2)} — ${Object.keys(bySupplier).length} suppliers. Stock unchanged — receive POs in Purchase module.` : 'No POs created (check console)',
      variant: successCount > 0 ? 'default' : 'destructive',
    });

    // Show the PO report dialog with print/export options
    if (createdPOs.length > 0) {
      setPoReport({
        pos: createdPOs,
        totalCount: createdPOs.length,
        totalCost,
      });
    }

    fetchDashboard();
  };

  // ===== Print receipt =====
  const handlePrint = (sale: SaleRecord) => {
    const win = window.open("", "_blank", "width=400,height=600");
    if (!win) return;
    win.document.write(`
      <html><head><title>${sale.invoiceNumber}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; font-size: 12px; }
        h1 { text-align: center; font-size: 18px; margin: 0; }
        h2 { text-align: center; font-size: 12px; margin: 5px 0 20px; }
        table { width: 100%; border-collapse: collapse; margin: 10px 0; }
        th { text-align: left; border-bottom: 1px solid #333; padding: 4px; }
        td { padding: 4px; }
        .totals { margin-top: 15px; text-align: right; }
        .totals div { margin: 2px 0; }
        .header { text-align: center; margin-bottom: 15px; }
      </style></head><body>
      <div class="header">
        <h1>${COMPANY.name}</h1>
        <h2>${COMPANY.address} · ${COMPANY.contact}</h2>
      </div>
      <div>Invoice: <strong>${sale.invoiceNumber}</strong></div>
      <div>Date: ${sale.createdAt ? new Date(sale.createdAt).toLocaleString() : 'N/A'}</div>
      <div>Cashier: ${sale.cashierName}</div>
      <div>Customer: ${sale.customerName || "Walk-in"}</div>
      <div>Payment: ${sale.paymentMethod}</div>
      <div>Status: ${sale.status}</div>
      <table>
        <thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead>
        <tbody>
          ${sale.items.map(i => `<tr><td>${i.name}</td><td>${i.quantity}</td><td>${formatGHS(i.price)}</td><td>${formatGHS(i.total)}</td></tr>`).join("")}
        </tbody>
      </table>
      <div class="totals">
        <div>Subtotal: ${formatGHS(sale.subtotal)}</div>
        <div>Discount: -${formatGHS(sale.discount)}</div>
        <div>Tax: ${formatGHS(sale.taxAmount)}</div>
        <div><strong>TOTAL: ${formatGHS(sale.total)}</strong></div>
        <div>Paid: ${formatGHS(sale.amountPaid)}</div>
        <div>Change: ${formatGHS(sale.change)}</div>
      </div>
      <p style="text-align:center;margin-top:30px;">Thank you for shopping with us!</p>
      </body></html>
    `);
    win.document.close();
    win.print();
  };

  const tabs: Array<{ id: Tab; label: string; short: string; icon: any }> = [
    { id: "overview", label: "Overview", short: "Overview", icon: Activity },
    { id: "sales-history", label: "Sales History", short: "Sales", icon: ShoppingCart },
    { id: "reorder", label: "Reorder Alerts", short: "Reorder", icon: AlertTriangle },
    { id: "expiry", label: "Expiry Tracking", short: "Expiry", icon: Clock },
    { id: "profit", label: "Profit Analysis", short: "Profit", icon: Percent },
  ];

  return (
    <div className="min-h-[100dvh] bg-slate-50 flex flex-col">
      {/* ===== Header ===== */}
      <header className="flex-shrink-0 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white shadow-lg sticky top-0 z-30">
        <div className="flex items-center justify-between px-3 sm:px-6 py-3">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="h-9 w-9 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition" title="Back to POS">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-base sm:text-lg font-bold flex items-center gap-2">
                <Activity className="h-5 w-5 text-emerald-400" />
                Operations Dashboard
              </h1>
              <p className="text-[10px] sm:text-xs text-slate-400">{COMPANY.name} · Real-time overview</p>
            </div>
          </div>
          <Button onClick={() => { setRefreshKey(k => k + 1); fetchSales(); }} variant="outline" size="sm" className="bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white">
            <RefreshCw className="h-4 w-4" />
            <span className="hidden sm:inline ml-1">Refresh</span>
          </Button>
        </div>
        {/* Tabs — horizontally scrollable on mobile, full on desktop */}
        <div className="flex items-center gap-1 px-3 sm:px-6 pb-2 overflow-x-auto scrollbar-hide">
          {tabs.map(t => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap flex-shrink-0 active:scale-95",
                  tab === t.id ? "bg-emerald-500 text-white" : "bg-white/5 text-slate-300 hover:bg-white/10"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="sm:hidden">{t.short}</span>
                <span className="hidden sm:inline">{t.label}</span>
              </button>
            );
          })}
        </div>
      </header>

      {/* ===== Main Content ===== */}
      <main className="flex-1 overflow-y-auto p-3 sm:p-6 max-w-7xl mx-auto w-full">
        <AnimatePresence mode="wait">
          {/* ===== OVERVIEW TAB ===== */}
          {tab === "overview" && (
            <motion.div key="overview" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
              {/* ===== Mobile: Hero KPI card (single, prominent) + 2x2 grid ===== */}
              <div className="md:hidden space-y-3">
                {/* Hero KPI — today's revenue, most important metric */}
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 via-teal-500 to-emerald-600 text-white p-5 shadow-lg">
                  <div className="absolute -top-8 -right-8 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
                  <div className="absolute -bottom-6 -left-6 h-24 w-24 rounded-full bg-white/5 blur-xl" />
                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-1">
                      <div className="text-[11px] uppercase tracking-wider font-semibold opacity-80">Today's Revenue</div>
                      {kpis.totalRevenue > 0 && (
                        <div className="flex items-center gap-0.5 text-xs font-semibold bg-white/20 px-2 py-0.5 rounded-full">
                          <ArrowUpRight className="h-3 w-3" /> Live
                        </div>
                      )}
                    </div>
                    <div className="text-4xl font-bold font-mono tracking-tight leading-none">{formatGHS(kpis.totalRevenue)}</div>
                    <div className="flex items-center gap-3 mt-3 text-[11px] opacity-90">
                      <span className="flex items-center gap-1">
                        <ShoppingCart className="h-3 w-3" />
                        {kpis.transactionCount} txn{kpis.transactionCount !== 1 ? 's' : ''}
                      </span>
                      <span>·</span>
                      <span>Avg {formatGHS(kpis.avgTransaction)}</span>
                    </div>
                  </div>
                </div>

                {/* Secondary KPIs in 2x2 grid */}
                <div className="grid grid-cols-2 gap-2">
                  <MiniKpiCard label="Stock Value" value={formatGHS(kpis.stockValue)} icon={<Boxes className="h-4 w-4" />} gradient="from-purple-500 to-pink-600" />
                  <MiniKpiCard label="Potential Profit" value={formatGHS(kpis.potentialProfit)} icon={<TrendingUp className="h-4 w-4" />} gradient="from-amber-500 to-orange-600" />
                  <MiniKpiCard label="Low Stock Items" value={String(products.filter(p => p.quantity <= p.reorderLevel).length)} icon={<AlertTriangle className="h-4 w-4" />} gradient="from-rose-500 to-red-600" />
                  <MiniKpiCard label="Expiring Soon" value={String(products.filter(p => {
                    if (!p.expiryDate) return false;
                    const days = (new Date(p.expiryDate).getTime() - Date.now()) / 86400000;
                    return days >= 0 && days <= 7;
                  }).length)} icon={<Clock className="h-4 w-4" />} gradient="from-blue-500 to-indigo-600" />
                </div>

                {/* Action Needed section — only shows items that need attention */}
                {(products.filter(p => p.quantity <= p.reorderLevel).length > 0 ||
                  products.filter(p => {
                    if (!p.expiryDate) return false;
                    const days = (new Date(p.expiryDate).getTime() - Date.now()) / 86400000;
                    return days >= 0 && days <= 7;
                  }).length > 0) && (
                  <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 overflow-hidden">
                    <div className="bg-gradient-to-r from-amber-50 to-rose-50 px-4 py-3 border-b border-amber-200">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-lg bg-amber-100 flex items-center justify-center">
                          <AlertCircle className="h-4 w-4 text-amber-600" />
                        </div>
                        <h3 className="text-sm font-bold text-slate-800">Action Needed</h3>
                      </div>
                    </div>
                    <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
                      {/* Low stock items */}
                      {products.filter(p => p.quantity <= p.reorderLevel).slice(0, 5).map(p => (
                        <div key={p.id} className="p-3 flex items-center gap-3">
                          <div className="h-8 w-8 rounded-lg bg-rose-50 flex items-center justify-center text-base flex-shrink-0">{p.emoji}</div>
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-semibold text-slate-800 truncate">{p.name}</div>
                            <div className="text-[10px] text-rose-600">Only {p.quantity} left (reorder at {p.reorderLevel})</div>
                          </div>
                          <Badge className="text-[9px] bg-rose-100 text-rose-700 flex-shrink-0">LOW</Badge>
                        </div>
                      ))}
                      {/* Expiring soon items */}
                      {products.filter(p => {
                        if (!p.expiryDate) return false;
                        const days = (new Date(p.expiryDate).getTime() - Date.now()) / 86400000;
                        return days >= 0 && days <= 7;
                      }).slice(0, 5).map(p => (
                        <div key={p.id} className="p-3 flex items-center gap-3">
                          <div className="h-8 w-8 rounded-lg bg-amber-50 flex items-center justify-center text-base flex-shrink-0">{p.emoji}</div>
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-semibold text-slate-800 truncate">{p.name}</div>
                            <div className="text-[10px] text-amber-600">
                              Expires in {Math.ceil((new Date(p.expiryDate!).getTime() - Date.now()) / 86400000)} day(s)
                            </div>
                          </div>
                          <Badge className="text-[9px] bg-amber-100 text-amber-700 flex-shrink-0">EXPIRY</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* ===== Desktop: original 4-card grid (md+) ===== */}
              <div className="hidden md:grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <KpiCard label="Today's Sales" value={formatGHS(kpis.totalRevenue)} icon={<DollarSign className="h-5 w-5" />} gradient="from-emerald-500 to-teal-600" trend={kpis.totalRevenue > 0 ? "up" : undefined} />
                <KpiCard label="Avg. Sale" value={formatGHS(kpis.avgTransaction)} icon={<BarChart3 className="h-5 w-5" />} gradient="from-blue-500 to-indigo-600" />
                <KpiCard label="Stock Value" value={formatGHS(kpis.stockValue)} icon={<Boxes className="h-5 w-5" />} gradient="from-purple-500 to-pink-600" />
                <KpiCard label="Potential Profit" value={formatGHS(kpis.potentialProfit)} icon={<TrendingUp className="h-5 w-5" />} gradient="from-amber-500 to-orange-600" trend={kpis.potentialProfit > 0 ? "up" : undefined} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                {/* Top Products */}
                <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 p-4 sm:p-6">
                  <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-4">
                    <Star className="h-4 w-4 text-amber-500" /> Top 10 Products by Revenue
                  </h2>
                  {topProducts.length === 0 ? (
                    <div className="text-center py-8 text-slate-400 text-sm">
                      <Package className="h-8 w-8 mx-auto mb-2 opacity-40" /> No sales data yet
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {topProducts.map((p, i) => (
                        <div key={i} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 transition">
                          <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center text-base">{p.emoji}</div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-semibold text-slate-800 truncate">{p.name}</div>
                            <div className="text-[10px] text-slate-500">{p.qty} sold</div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs font-bold text-emerald-600">{formatGHS(p.revenue)}</div>
                          </div>
                          <Badge className={cn("text-[10px]", i === 0 ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600")}>#{i + 1}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Recent Transactions */}
                <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 p-4 sm:p-6">
                  <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-4">
                    <ShoppingCart className="h-4 w-4 text-blue-500" /> Recent Transactions
                  </h2>
                  {recentSales.length === 0 ? (
                    <div className="text-center py-8 text-slate-400 text-sm">
                      <ShoppingCart className="h-8 w-8 mx-auto mb-2 opacity-40" /> No transactions yet
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {recentSales.map(sale => (
                        <button
                          key={sale.id}
                          onClick={() => { setSelectedSale(sale); setTab("sales-history"); }}
                          className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 transition text-left"
                        >
                          <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                            <FileText className="h-4 w-4 text-blue-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-semibold text-slate-800 truncate">{sale.invoiceNumber}</div>
                            <div className="text-[10px] text-slate-500">{sale.customerName || "Walk-in"} · {sale.items?.length || 0} items · {sale.paymentMethod}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs font-bold text-emerald-600">{formatGHS(sale.total)}</div>
                            {sale.status !== "completed" && <Badge className={cn("text-[9px]", sale.status === "refunded" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700")}>{sale.status}</Badge>}
                          </div>
                          <ChevronRight className="h-4 w-4 text-slate-300" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Quick Alerts */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 p-4 sm:p-6">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-500" /> Low Stock
                    </h2>
                    <button onClick={() => setTab("reorder")} className="text-[10px] text-emerald-600 hover:underline">View all →</button>
                  </div>
                  <div className="text-2xl font-bold text-amber-600">{reorderProducts.length}</div>
                  <div className="text-[10px] text-slate-500">products need reordering</div>
                </div>
                <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 p-4 sm:p-6">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                      <Clock className="h-4 w-4 text-rose-500" /> Expiry Alerts
                    </h2>
                    <button onClick={() => setTab("expiry")} className="text-[10px] text-emerald-600 hover:underline">View all →</button>
                  </div>
                  <div className="text-2xl font-bold text-rose-600">{expiryProducts.length}</div>
                  <div className="text-[10px] text-slate-500">{formatGHS(expiryValueAtRisk)} value at risk</div>
                </div>
              </div>
            </motion.div>
          )}

          {/* ===== SALES HISTORY TAB ===== */}
          {tab === "sales-history" && (
            <motion.div key="sales-history" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
              <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 p-4 sm:p-6">
                <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
                  <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <ShoppingCart className="h-4 w-4 text-blue-500" /> Sales History
                    <Badge variant="outline" className="text-[10px]">{filteredSales.length} records</Badge>
                  </h2>
                  <div className="relative flex-1 max-w-xs">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search invoice, customer, cashier..."
                      className="pl-9 h-9 text-xs"
                    />
                  </div>
                </div>

                {loadingSales ? (
                  <div className="text-center py-12 text-slate-400 text-sm">
                    <RefreshCw className="h-8 w-8 mx-auto mb-2 animate-spin opacity-40" /> Loading sales...
                  </div>
                ) : filteredSales.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 text-sm">
                    <ShoppingCart className="h-8 w-8 mx-auto mb-2 opacity-40" /> No sales found
                  </div>
                ) : (
                  <div className="mobile-scroll-x">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-slate-200">
                          <th className="text-left py-2 px-2 font-semibold text-slate-600">Invoice</th>
                          <th className="text-left py-2 px-2 font-semibold text-slate-600">Date</th>
                          <th className="text-left py-2 px-2 font-semibold text-slate-600">Customer</th>
                          <th className="text-left py-2 px-2 font-semibold text-slate-600">Cashier</th>
                          <th className="text-right py-2 px-2 font-semibold text-slate-600">Items</th>
                          <th className="text-right py-2 px-2 font-semibold text-slate-600">Total</th>
                          <th className="text-center py-2 px-2 font-semibold text-slate-600">Status</th>
                          <th className="text-center py-2 px-2 font-semibold text-slate-600">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredSales.map(sale => (
                          <tr
                            key={sale.id}
                            onClick={() => setSelectedSale(sale)}
                            className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer"
                          >
                            <td className="py-2 px-2 font-mono font-semibold text-slate-800">{sale.invoiceNumber}</td>
                            <td className="py-2 px-2 text-slate-600">{sale.createdAt ? new Date(sale.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '—'} {sale.createdAt ? new Date(sale.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : ''}</td>
                            <td className="py-2 px-2 text-slate-600">{sale.customerName || "Walk-in"}</td>
                            <td className="py-2 px-2 text-slate-600">{sale.cashierName}</td>
                            <td className="py-2 px-2 text-right text-slate-600">{sale.items?.length || 0}</td>
                            <td className="py-2 px-2 text-right font-bold text-emerald-600">{formatGHS(sale.total)}</td>
                            <td className="py-2 px-2 text-center">
                              <Badge className={cn("text-[9px]",
                                sale.status === "completed" ? "bg-emerald-100 text-emerald-700" :
                                sale.status === "refunded" ? "bg-rose-100 text-rose-700" :
                                sale.status === "voided" ? "bg-amber-100 text-amber-700" :
                                "bg-slate-100 text-slate-600"
                              )}>{sale.status}</Badge>
                            </td>
                            <td className="py-2 px-2 text-center">
                              <ChevronRight className="h-4 w-4 text-slate-300 mx-auto" />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ===== REORDER TAB ===== */}
          {tab === "reorder" && (
            <motion.div key="reorder" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                <div className="bg-white rounded-xl shadow-sm ring-1 ring-slate-200 p-4">
                  <div className="text-[10px] font-semibold text-slate-500 uppercase">Products to Reorder</div>
                  <div className="text-2xl font-bold text-amber-600 mt-1">{filteredReorderProducts.length}{filteredReorderProducts.length !== reorderProducts.length && <span className="text-xs text-slate-400"> / {reorderProducts.length}</span>}</div>
                </div>
                <div className="bg-white rounded-xl shadow-sm ring-1 ring-slate-200 p-4">
                  <div className="text-[10px] font-semibold text-slate-500 uppercase">Total Reorder Qty</div>
                  <div className="text-2xl font-bold text-slate-800 mt-1">{filteredReorderProducts.reduce((s, p) => s + (p as any).suggestedQty, 0)}</div>
                </div>
                <div className="bg-white rounded-xl shadow-sm ring-1 ring-slate-200 p-4">
                  <div className="text-[10px] font-semibold text-slate-500 uppercase">Est. Reorder Cost</div>
                  <div className="text-2xl font-bold text-rose-600 mt-1">{formatGHS(totalReorderCost)}</div>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 p-4 sm:p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500" /> Reorder Suggestions
                  </h2>
                  <div className="flex items-center gap-2">
                    {reorderProducts.length > 0 && (
                      <Button
                        onClick={() => { setReorderSearch(""); setReorderCategory("all"); setReorderSupplier("all"); }}
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-[10px]"
                        title="Clear all filters"
                      >
                        <Filter className="h-3 w-3 mr-1" /> Clear Filters
                      </Button>
                    )}
                    {filteredReorderProducts.length > 0 && (
                      <Button
                        onClick={handleCreateAllPOs}
                        className="h-8 px-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-[11px] font-semibold"
                      >
                        <Plus className="h-3 w-3 mr-1" /> Create POs ({filteredReorderProducts.length} items)
                      </Button>
                    )}
                  </div>
                </div>

                {/* ===== Multi-Filter Bar ===== */}
                {reorderProducts.length > 0 && (
                  <div className="mb-4 p-3 rounded-xl bg-slate-50 ring-1 ring-slate-200 flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1 text-[10px] font-bold text-slate-500 uppercase">
                      <Filter className="h-3 w-3" /> Filters:
                    </div>
                    {/* Product search */}
                    <div className="relative flex-1 min-w-[180px]">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                      <input
                        type="text"
                        value={reorderSearch}
                        onChange={(e) => setReorderSearch(e.target.value)}
                        placeholder="Search by name, SKU, or barcode…"
                        className="w-full h-8 pl-8 pr-3 rounded-lg border border-slate-200 bg-white text-xs outline-none focus:ring-2 focus:ring-emerald-400"
                      />
                    </div>
                    {/* Category filter */}
                    <select
                      value={reorderCategory}
                      onChange={(e) => setReorderCategory(e.target.value)}
                      className="h-8 px-2 rounded-lg border border-slate-200 bg-white text-xs outline-none cursor-pointer"
                    >
                      <option value="all">All Categories</option>
                      {reorderCategories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    {/* Supplier filter */}
                    <select
                      value={reorderSupplier}
                      onChange={(e) => setReorderSupplier(e.target.value)}
                      className="h-8 px-2 rounded-lg border border-slate-200 bg-white text-xs outline-none cursor-pointer"
                    >
                      <option value="all">All Suppliers</option>
                      <option value="unassigned">Unassigned</option>
                      {reorderSuppliers.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                )}

                {reorderProducts.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 text-sm">
                    <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-emerald-400" /> All products well stocked
                  </div>
                ) : filteredReorderProducts.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 text-sm">
                    <Filter className="h-8 w-8 mx-auto mb-2 opacity-30" /> No products match your filters
                  </div>
                ) : (
                  <div className="mobile-scroll-x">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-slate-200">
                          <th className="text-left py-2 px-2 font-semibold text-slate-600">Product</th>
                          <th className="text-right py-2 px-2 font-semibold text-slate-600">Current Stock</th>
                          <th className="text-right py-2 px-2 font-semibold text-slate-600">Reorder Level</th>
                          <th className="text-right py-2 px-2 font-semibold text-slate-600">Suggested Qty <span className="text-[8px] text-emerald-600 normal-case">(editable)</span></th>
                          <th className="text-right py-2 px-2 font-semibold text-slate-600">Unit Cost</th>
                          <th className="text-right py-2 px-2 font-semibold text-slate-600">Reorder Cost</th>
                          <th className="text-right py-2 px-2 font-semibold text-slate-600">Supplier</th>
                          <th className="text-center py-2 px-2 font-semibold text-slate-600">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredReorderProducts.map(p => {
                          const isEdited = editedQtys[p.id] !== undefined;
                          return (
                            <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50">
                              <td className="py-2 px-2">
                                <div className="flex items-center gap-2">
                                  <span>{p.emoji}</span>
                                  <div>
                                    <div className="font-semibold text-slate-800">{p.name}</div>
                                    <div className="text-[9px] text-slate-400 font-mono">{p.sku}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="py-2 px-2 text-right font-mono font-bold text-rose-600">{p.quantity}</td>
                              <td className="py-2 px-2 text-right font-mono text-slate-500">{p.reorderLevel}</td>
                              <td className="py-2 px-2 text-right">
                                {/* ===== Editable Suggested Qty ===== */}
                                <input
                                  type="number"
                                  min="0"
                                  value={(p as any).suggestedQty}
                                  onChange={(e) => updateEditedQty(p.id, parseInt(e.target.value) || 0)}
                                  className={cn(
                                    "w-20 h-7 px-2 rounded-md border text-right font-mono text-xs outline-none transition",
                                    isEdited
                                      ? "border-emerald-400 bg-emerald-50 text-emerald-700 font-bold ring-1 ring-emerald-300"
                                      : "border-slate-200 bg-white text-amber-600 hover:border-slate-300"
                                  )}
                                  title={isEdited ? `Edited (auto-suggested: ${(p as any).autoSuggestedQty})` : `Auto-suggested — click to edit`}
                                />
                                {isEdited && (
                                  <button
                                    onClick={() => setEditedQtys(prev => { const next = { ...prev }; delete next[p.id]; return next; })}
                                    className="ml-1 text-[9px] text-slate-400 hover:text-rose-500"
                                    title="Reset to auto-suggested"
                                  >
                                    ↺
                                  </button>
                                )}
                              </td>
                              <td className="py-2 px-2 text-right font-mono text-slate-600">{formatGHS(p.costPrice)}</td>
                              <td className="py-2 px-2 text-right font-mono font-bold text-slate-800">{formatGHS((p as any).reorderCost)}</td>
                              <td className="py-2 px-2 text-[10px] text-slate-600">
                                {(p as any).preferredSupplierName ? (
                                  <div>
                                    <div className="font-semibold">{(p as any).preferredSupplierName}</div>
                                    {(p as any).preferredSupplierCost && (
                                      <div className="text-slate-400 font-mono">GHS {(p as any).preferredSupplierCost.toFixed(2)} · {(p as any).leadTimeDays || 0}d lead</div>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-slate-400 italic">Unassigned</span>
                                )}
                              </td>
                              <td className="py-2 px-2 text-center">
                                <button
                                  onClick={() => handleCreatePO(p, (p as any).suggestedQty, (p as any).preferredSupplierId || null, (p as any).preferredSupplierName || null, (p as any).preferredSupplierCost || null)}
                                  disabled={(p as any).suggestedQty <= 0}
                                  className="h-7 px-2 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-700 text-[10px] font-semibold flex items-center gap-1 mx-auto transition disabled:opacity-40 disabled:cursor-not-allowed"
                                  title={`Create PO: ${(p as any).suggestedQty} × ${p.name}`}
                                >
                                  <Plus className="h-3 w-3" /> Create PO
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-slate-300 bg-slate-50">
                          <td colSpan={5} className="py-3 px-2 text-right font-bold text-slate-700">Total Estimated Cost ({filteredReorderProducts.length} items):</td>
                          <td className="py-3 px-2 text-right font-mono font-bold text-rose-600">{formatGHS(totalReorderCost)}</td>
                          <td colSpan={2}></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}

                {/* Info note about PO status */}
                {reorderProducts.length > 0 && (
                  <div className="mt-3 p-2.5 rounded-lg bg-blue-50 text-[10px] text-blue-700 flex items-start gap-2">
                    <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                    <span>POs are created with status <strong>"Ordered"</strong> — stock does NOT change until you receive them in the Purchase module. Items stay in this list until received. Edit the <strong>Suggested Qty</strong> column to adjust order quantities before creating POs.</span>
                  </div>
                )}
              </div>

              {/* ===== PO Report Dialog ===== */}
              <AnimatePresence>
                {poReport && (
                  <POReportDialog
                    report={poReport}
                    onClose={() => setPoReport(null)}
                  />
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {/* ===== EXPIRY TAB ===== */}
          {tab === "expiry" && (
            <motion.div key="expiry" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <ExpiryStat label="Expired" count={expiryProducts.filter(p => (p as any).urgency === "expired").length} color="text-rose-600 bg-rose-50" />
                <ExpiryStat label="≤ 7 days" count={expiryProducts.filter(p => (p as any).urgency === "critical").length} color="text-rose-600 bg-rose-50" />
                <ExpiryStat label="≤ 14 days" count={expiryProducts.filter(p => (p as any).urgency === "warning").length} color="text-amber-600 bg-amber-50" />
                <ExpiryStat label="≤ 30 days" count={expiryProducts.filter(p => (p as any).urgency === "soon").length} color="text-yellow-600 bg-yellow-50" />
              </div>
              <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 p-4 sm:p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <Clock className="h-4 w-4 text-rose-500" /> Expiry Tracking
                  </h2>
                  <Badge variant="outline" className="text-[10px] bg-rose-50 text-rose-700">{formatGHS(expiryValueAtRisk)} at risk</Badge>
                </div>
                {expiryProducts.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 text-sm">
                    <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-emerald-400" /> No products expiring soon
                  </div>
                ) : (
                  <div className="mobile-scroll-x">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-slate-200">
                          <th className="text-left py-2 px-2 font-semibold text-slate-600">Product</th>
                          <th className="text-center py-2 px-2 font-semibold text-slate-600">Expiry Date</th>
                          <th className="text-center py-2 px-2 font-semibold text-slate-600">Days Left</th>
                          <th className="text-right py-2 px-2 font-semibold text-slate-600">Stock Qty</th>
                          <th className="text-right py-2 px-2 font-semibold text-slate-600">Value at Risk</th>
                          <th className="text-center py-2 px-2 font-semibold text-slate-600">Urgency</th>
                        </tr>
                      </thead>
                      <tbody>
                        {expiryProducts.map(p => (
                          <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50">
                            <td className="py-2 px-2">
                              <div className="flex items-center gap-2">
                                <span>{p.emoji}</span>
                                <div>
                                  <div className="font-semibold text-slate-800">{p.name}</div>
                                  <div className="text-[9px] text-slate-400 font-mono">{p.sku}</div>
                                </div>
                              </div>
                            </td>
                            <td className="py-2 px-2 text-center text-slate-600">
                              {p.expiryDate ? new Date(p.expiryDate as any).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                            </td>
                            <td className="py-2 px-2 text-center font-mono font-bold">
                              <span className={cn(
                                (p as any).urgency === "expired" ? "text-rose-600" :
                                (p as any).urgency === "critical" ? "text-rose-600" :
                                (p as any).urgency === "warning" ? "text-amber-600" : "text-yellow-600"
                              )}>
                                {(p as any).daysUntilExpiry < 0 ? `${Math.abs((p as any).daysUntilExpiry)}d ago` : `${(p as any).daysUntilExpiry}d`}
                              </span>
                            </td>
                            <td className="py-2 px-2 text-right font-mono text-slate-700">{p.quantity}</td>
                            <td className="py-2 px-2 text-right font-mono font-bold text-slate-800">{formatGHS((p as any).stockValueAtRisk)}</td>
                            <td className="py-2 px-2 text-center">
                              <Badge className={cn("text-[9px]",
                                (p as any).urgency === "expired" ? "bg-rose-100 text-rose-700" :
                                (p as any).urgency === "critical" ? "bg-rose-100 text-rose-700" :
                                (p as any).urgency === "warning" ? "bg-amber-100 text-amber-700" : "bg-yellow-100 text-yellow-700"
                              )}>
                                {(p as any).urgency === "expired" ? "EXPIRED" :
                                 (p as any).urgency === "critical" ? "CRITICAL" :
                                 (p as any).urgency === "warning" ? "WARNING" : "SOON"}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ===== PROFIT TAB ===== */}
          {tab === "profit" && (
            <motion.div key="profit" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                <div className="bg-white rounded-xl shadow-sm ring-1 ring-slate-200 p-4">
                  <div className="text-[10px] font-semibold text-slate-500 uppercase">Total Cost Value</div>
                  <div className="text-2xl font-bold text-slate-800 mt-1">{formatGHS(profitSummary.totalCost)}</div>
                </div>
                <div className="bg-white rounded-xl shadow-sm ring-1 ring-slate-200 p-4">
                  <div className="text-[10px] font-semibold text-slate-500 uppercase">Potential Revenue</div>
                  <div className="text-2xl font-bold text-blue-600 mt-1">{formatGHS(profitSummary.totalRevenue)}</div>
                </div>
                <div className="bg-white rounded-xl shadow-sm ring-1 ring-slate-200 p-4">
                  <div className="text-[10px] font-semibold text-slate-500 uppercase">Potential Profit</div>
                  <div className="text-2xl font-bold text-emerald-600 mt-1">{formatGHS(profitSummary.totalProfit)}</div>
                </div>
              </div>
              <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 p-4 sm:p-6">
                <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-4">
                  <Percent className="h-4 w-4 text-emerald-500" /> Profit Margin Analysis
                </h2>
                <div className="mobile-scroll-x">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="text-left py-2 px-2 font-semibold text-slate-600">Product</th>
                        <th className="text-right py-2 px-2 font-semibold text-slate-600">Cost</th>
                        <th className="text-right py-2 px-2 font-semibold text-slate-600">Price</th>
                        <th className="text-right py-2 px-2 font-semibold text-slate-600">Margin</th>
                        <th className="text-right py-2 px-2 font-semibold text-slate-600">Margin %</th>
                        <th className="text-right py-2 px-2 font-semibold text-slate-600">Stock Value</th>
                        <th className="text-right py-2 px-2 font-semibold text-slate-600">Potential Profit</th>
                        <th className="text-center py-2 px-2 font-semibold text-slate-600">Health</th>
                      </tr>
                    </thead>
                    <tbody>
                      {profitData.map(p => (
                        <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="py-2 px-2">
                            <div className="flex items-center gap-2">
                              <span>{p.emoji}</span>
                              <div>
                                <div className="font-semibold text-slate-800">{p.name}</div>
                                <div className="text-[9px] text-slate-400 font-mono">{p.sku}</div>
                              </div>
                            </div>
                          </td>
                          <td className="py-2 px-2 text-right font-mono text-slate-600">{formatGHS(p.costPrice)}</td>
                          <td className="py-2 px-2 text-right font-mono text-slate-700">{formatGHS(p.price)}</td>
                          <td className="py-2 px-2 text-right font-mono font-semibold text-emerald-600">{formatGHS((p as any).margin)}</td>
                          <td className="py-2 px-2 text-right font-mono font-bold">
                            <span className={cn(
                              (p as any).health === "excellent" ? "text-emerald-600" :
                              (p as any).health === "good" ? "text-blue-600" :
                              (p as any).health === "low" ? "text-amber-600" : "text-rose-600"
                            )}>
                              {(p as any).marginPct.toFixed(1)}%
                            </span>
                          </td>
                          <td className="py-2 px-2 text-right font-mono text-slate-600">{formatGHS((p as any).stockValue)}</td>
                          <td className="py-2 px-2 text-right font-mono font-bold text-emerald-600">{formatGHS((p as any).potentialProfit)}</td>
                          <td className="py-2 px-2 text-center">
                            <Badge className={cn("text-[9px]",
                              (p as any).health === "excellent" ? "bg-emerald-100 text-emerald-700" :
                              (p as any).health === "good" ? "bg-blue-100 text-blue-700" :
                              (p as any).health === "low" ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700"
                            )}>
                              {(p as any).health === "excellent" ? "★★★" :
                               (p as any).health === "good" ? "★★" :
                               (p as any).health === "low" ? "★" : "LOSS"}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* ===== Receipt Detail Modal ===== */}
      <AnimatePresence>
        {selectedSale && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-0 sm:p-4"
            onClick={() => setSelectedSale(null)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col"
            >
              {/* Header */}
              <div className="flex-shrink-0 px-5 py-4 bg-gradient-to-r from-slate-800 to-slate-900 text-white flex items-center justify-between">
                <div>
                  <div className="text-xs text-slate-400">Receipt</div>
                  <div className="font-bold font-mono">{selectedSale.invoiceNumber}</div>
                </div>
                <button onClick={() => setSelectedSale(null)} className="h-8 w-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <ScrollArea className="flex-1 overflow-y-auto">
                <div className="p-5 space-y-4">
                  {/* Sale info */}
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <div className="text-slate-400 font-semibold uppercase text-[9px]">Date</div>
                      <div className="text-slate-800">{selectedSale.createdAt ? new Date(selectedSale.createdAt).toLocaleString() : 'N/A'}</div>
                    </div>
                    <div>
                      <div className="text-slate-400 font-semibold uppercase text-[9px]">Cashier</div>
                      <div className="text-slate-800">{selectedSale.cashierName}</div>
                    </div>
                    <div>
                      <div className="text-slate-400 font-semibold uppercase text-[9px]">Customer</div>
                      <div className="text-slate-800">{selectedSale.customerName || "Walk-in"}</div>
                    </div>
                    <div>
                      <div className="text-slate-400 font-semibold uppercase text-[9px]">Payment</div>
                      <div className="text-slate-800 capitalize">{selectedSale.paymentMethod}</div>
                    </div>
                    <div>
                      <div className="text-slate-400 font-semibold uppercase text-[9px]">Status</div>
                      <Badge className={cn("text-[9px]",
                        selectedSale.status === "completed" ? "bg-emerald-100 text-emerald-700" :
                        selectedSale.status === "refunded" ? "bg-rose-100 text-rose-700" :
                        "bg-amber-100 text-amber-700"
                      )}>{selectedSale.status}</Badge>
                    </div>
                  </div>

                  {/* Items */}
                  <div className="border-t border-slate-200 pt-4">
                    <div className="text-xs font-bold text-slate-700 uppercase mb-2">Items ({selectedSale.items?.length || 0})</div>
                    <div className="space-y-2">
                      {selectedSale.items?.map((item, i) => (
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

                  {/* Totals */}
                  <div className="border-t border-slate-200 pt-4 space-y-1 text-xs">
                    <div className="flex justify-between"><span className="text-slate-500">Subtotal</span><span className="font-mono">{formatGHS(selectedSale.subtotal)}</span></div>
                    {selectedSale.discount > 0 && <div className="flex justify-between"><span className="text-slate-500">Discount</span><span className="font-mono text-rose-600">−{formatGHS(selectedSale.discount)}</span></div>}
                    {selectedSale.taxAmount > 0 && <div className="flex justify-between"><span className="text-slate-500">Tax</span><span className="font-mono">{formatGHS(selectedSale.taxAmount)}</span></div>}
                    <div className="flex justify-between text-sm font-bold pt-2 border-t border-slate-200"><span className="text-slate-800">Total</span><span className="font-mono text-emerald-600">{formatGHS(selectedSale.total)}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Paid</span><span className="font-mono">{formatGHS(selectedSale.amountPaid)}</span></div>
                    {selectedSale.change > 0 && <div className="flex justify-between"><span className="text-slate-500">Change</span><span className="font-mono">{formatGHS(selectedSale.change)}</span></div>}
                  </div>
                </div>
              </ScrollArea>

              {/* Actions */}
              <div className="flex-shrink-0 px-5 py-3 bg-slate-50 border-t border-slate-200 flex gap-2">
                <Button onClick={() => handlePrint(selectedSale)} variant="outline" size="sm" className="flex-1">
                  <Printer className="h-4 w-4" /> Print
                </Button>
                {selectedSale.status === "completed" && (
                  <Button onClick={() => handleRefund(selectedSale)} variant="destructive" size="sm" className="flex-1">
                    <RotateCcw className="h-4 w-4" /> Process Refund
                  </Button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ===== KPI Card =====
function KpiCard({ label, value, icon, gradient, trend }: {
  label: string; value: string; icon: React.ReactNode; gradient: string; trend?: "up" | "down";
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 p-3 sm:p-4 relative overflow-hidden">
      <div className={cn("absolute top-0 right-0 h-20 w-20 rounded-full blur-2xl opacity-20 bg-gradient-to-br", gradient)} />
      <div className="relative">
        <div className="flex items-center justify-between mb-2">
          <div className={cn("h-8 w-8 rounded-lg bg-gradient-to-br flex items-center justify-center text-white", gradient)}>{icon}</div>
          {trend === "up" && <ArrowUpRight className="h-4 w-4 text-emerald-500" />}
          {trend === "down" && <ArrowDownRight className="h-4 w-4 text-rose-500" />}
        </div>
        <div className="text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</div>
        <div className="text-base sm:text-xl font-bold text-slate-900 mt-1">{value}</div>
      </div>
    </motion.div>
  );
}

// ===== Mini KPI Card — compact tile for mobile 2x2 grid =====
function MiniKpiCard({ label, value, icon, gradient }: {
  label: string; value: string; icon: React.ReactNode; gradient: string;
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm ring-1 ring-slate-200 p-3 relative overflow-hidden">
      <div className={cn("absolute -top-4 -right-4 h-16 w-16 rounded-full blur-2xl opacity-20 bg-gradient-to-br", gradient)} />
      <div className="relative">
        <div className={cn("h-7 w-7 rounded-lg bg-gradient-to-br flex items-center justify-center text-white mb-2", gradient)}>
          {icon}
        </div>
        <div className="text-[9px] font-semibold text-slate-500 uppercase tracking-wide truncate">{label}</div>
        <div className="text-base font-bold text-slate-900 mt-0.5 font-mono truncate">{value}</div>
      </div>
    </div>
  );
}

// ===== Expiry Stat =====
function ExpiryStat({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className="bg-white rounded-xl shadow-sm ring-1 ring-slate-200 p-4">
      <div className={cn("inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold mb-2", color)}>{label}</div>
      <div className="text-2xl font-bold text-slate-800">{count}</div>
      <div className="text-[10px] text-slate-500">products</div>
    </div>
  );
}

// ===== PO Report Dialog — shown after creating POs from the reorder tab =====
// Displays all created POs with their items, supplier, and total cost.
// Includes Print, CSV, PDF, and Excel export buttons.
function POReportDialog({ report, onClose }: {
  report: {
    pos: Array<{
      refNo: string;
      supplierName: string;
      supplierId: string | null;
      items: Array<{ partNo: string; details: string; emoji: string; quantity: number; cost: number; total: number; }>;
      total: number;
      status: string;
      createdAt: string;
    }>;
    totalCount: number;
    totalCost: number;
  };
  onClose: () => void;
}) {
  const { toast } = useToast();

  // Build a flat row list for export (one row per PO item)
  const buildReportData = (): ReportData => {
    const rows: Record<string, any>[] = [];
    for (const po of report.pos) {
      for (const item of po.items) {
        rows.push({
          poRef: po.refNo,
          supplier: po.supplierName,
          status: po.status,
          createdAt: new Date(po.createdAt).toLocaleString(),
          partNo: item.partNo,
          details: item.details,
          quantity: item.quantity,
          unitCost: item.cost,
          total: item.total,
        });
      }
    }
    return {
      type: "po-report",
      title: "Purchase Order Report",
      subtitle: `${report.totalCount} PO(s) · Total GHS ${report.totalCost.toFixed(2)} · ${new Date().toLocaleString()}`,
      columns: [
        { key: "poRef", label: "PO Ref No" },
        { key: "supplier", label: "Supplier" },
        { key: "details", label: "Product" },
        { key: "quantity", label: "Qty", align: "right" },
        { key: "unitCost", label: "Unit Cost", align: "right", format: (v: any) => `GHS ${Number(v).toFixed(2)}` },
        { key: "total", label: "Total", align: "right", format: (v: any) => `GHS ${Number(v).toFixed(2)}` },
        { key: "status", label: "Status" },
      ],
      rows,
      summary: [
        { label: "Total POs", value: String(report.totalCount) },
        { label: "Total Items", value: String(rows.length) },
        { label: "Total Cost", value: `GHS ${report.totalCost.toFixed(2)}` },
        { label: "Generated", value: new Date().toLocaleString() },
      ],
    };
  };

  const handlePrint = () => {
    const rpt = buildReportData();
    printReport(rpt);
  };
  const handlePDF = () => {
    const rpt = buildReportData();
    exportReportToPDF(rpt);
    toast({ title: "PDF exported", description: `${rpt.rows.length} items across ${report.totalCount} PO(s)` });
  };
  const handleExcel = () => {
    const rpt = buildReportData();
    exportReportToExcel(rpt);
    toast({ title: "Excel exported", description: `${rpt.rows.length} items across ${report.totalCount} PO(s)` });
  };
  const handleCSV = () => {
    const rpt = buildReportData();
    exportReportToCSV(rpt);
    toast({ title: "CSV exported", description: `${rpt.rows.length} items across ${report.totalCount} PO(s)` });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex-shrink-0 px-5 py-4 bg-gradient-to-r from-emerald-700 to-teal-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center">
              <FileBarChart className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold">Purchase Order Report</h3>
              <p className="text-[10px] opacity-90">{report.totalCount} PO(s) created · Total GHS {report.totalCost.toFixed(2)}</p>
            </div>
          </div>
          <button onClick={onClose} className="h-8 w-8 rounded-lg bg-white/15 hover:bg-white/25 flex items-center justify-center transition">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Export buttons */}
        <div className="flex-shrink-0 px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-bold text-slate-500 uppercase mr-1">Export:</span>
          <button onClick={handlePrint} className="h-8 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition">
            <Printer className="h-3.5 w-3.5" /> Print
          </button>
          <button onClick={handlePDF} className="h-8 px-3 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-1.5 transition">
            <FileText className="h-3.5 w-3.5" /> PDF
          </button>
          <button onClick={handleExcel} className="h-8 px-3 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-700 text-xs font-semibold flex items-center gap-1.5 transition">
            <Download className="h-3.5 w-3.5" /> Excel
          </button>
          <button onClick={handleCSV} className="h-8 px-3 rounded-lg bg-blue-100 hover:bg-blue-200 text-blue-700 text-xs font-semibold flex items-center gap-1.5 transition">
            <Download className="h-3.5 w-3.5" /> CSV
          </button>
        </div>

        {/* PO details */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {report.pos.map((po, i) => (
            <div key={i} className="rounded-xl ring-1 ring-slate-200 overflow-hidden">
              {/* PO header */}
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-900 text-sm font-mono">{po.refNo}</div>
                  <div className="text-[10px] text-slate-500">{po.supplierName} · {new Date(po.createdAt).toLocaleString()}</div>
                </div>
                <div className="text-right">
                  <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] uppercase">{po.status}</Badge>
                  <div className="text-sm font-bold text-slate-900 mt-1 font-mono">GHS {po.total.toFixed(2)}</div>
                </div>
              </div>
              {/* PO items */}
              <table className="w-full text-xs">
                <thead className="bg-white">
                  <tr className="border-b border-slate-100">
                    <th className="text-left py-1.5 px-3 font-semibold text-slate-500 text-[10px] uppercase">Part No</th>
                    <th className="text-left py-1.5 px-3 font-semibold text-slate-500 text-[10px] uppercase">Product</th>
                    <th className="text-right py-1.5 px-3 font-semibold text-slate-500 text-[10px] uppercase">Qty</th>
                    <th className="text-right py-1.5 px-3 font-semibold text-slate-500 text-[10px] uppercase">Unit Cost</th>
                    <th className="text-right py-1.5 px-3 font-semibold text-slate-500 text-[10px] uppercase">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {po.items.map((item, j) => (
                    <tr key={j} className="border-b border-slate-50">
                      <td className="py-2 px-3 font-mono text-slate-500 text-[10px]">{item.partNo}</td>
                      <td className="py-2 px-3 text-slate-800">{item.emoji} {item.details}</td>
                      <td className="py-2 px-3 text-right font-mono text-slate-700">{item.quantity}</td>
                      <td className="py-2 px-3 text-right font-mono text-slate-600">GHS {item.cost.toFixed(2)}</td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-slate-800">GHS {item.total.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            <strong className="text-slate-700">{report.totalCount}</strong> PO(s) · <strong className="text-slate-700">{report.pos.reduce((s, p) => s + p.items.length, 0)}</strong> items · Total: <strong className="text-rose-600 font-mono">GHS {report.totalCost.toFixed(2)}</strong>
          </div>
          <Button onClick={onClose} size="sm" className="bg-slate-700 hover:bg-slate-800 text-white">
            Close
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}
