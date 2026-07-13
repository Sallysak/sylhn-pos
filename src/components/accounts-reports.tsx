"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, TrendingUp, BarChart3, Percent, DollarSign, FileText,
  BookOpen, FileBarChart2, Calendar, Printer, Download, X,
  Package, ShoppingCart, Receipt,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { COMPANY, CURRENCY, formatGHS, type Product, type StockGroup, type StockHistoryEntry } from "@/lib/pos-data";

type ReportType = "daily-sales" | "daily-sales-detail" | "monthly-summary" | "monthly-detail" | "profit-loss" | "vat-tax" | "stock-value" | "cost-price" | "stock-performance" | "stock-group" | "general-ledger" | "trial-balance";

interface AccountsReportsProps {
  onBack: () => void;
  products: Product[];
  groups: StockGroup[];
  history: StockHistoryEntry[];
  dailyTotal: number;
  transactionCount: number;
  initialReport?: ReportType;
}

export function AccountsReports({ onBack, products, groups, history, dailyTotal, transactionCount, initialReport = "daily-sales" }: AccountsReportsProps) {
  const { toast } = useToast();
  const [activeReport, setActiveReport] = useState<ReportType>(initialReport);
  const [fromDate, setFromDate] = useState(new Date().toISOString().split('T')[0]);
  const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);

  const reports: { id: ReportType; label: string; icon: any; color: string }[] = [
    { id: "daily-sales", label: "Daily Sales Summary", icon: TrendingUp, color: "emerald" },
    { id: "daily-sales-detail", label: "Daily Sales Detail", icon: FileText, color: "emerald" },
    { id: "monthly-summary", label: "Monthly Summary", icon: BarChart3, color: "blue" },
    { id: "monthly-detail", label: "Monthly Detail", icon: FileBarChart2, color: "blue" },
    { id: "profit-loss", label: "Profit & Loss", icon: BarChart3, color: "indigo" },
    { id: "vat-tax", label: "VAT Tax Report", icon: Percent, color: "amber" },
    { id: "stock-value", label: "Stock Value", icon: DollarSign, color: "cyan" },
    { id: "cost-price", label: "Cost Price", icon: FileText, color: "purple" },
    { id: "stock-performance", label: "Stock Performance", icon: TrendingUp, color: "rose" },
    { id: "stock-group", label: "Stock Group", icon: Package, color: "indigo" },
    { id: "general-ledger", label: "General Ledger", icon: BookOpen, color: "indigo" },
    { id: "trial-balance", label: "Trial Balance", icon: FileBarChart2, color: "teal" },
  ];

  // ===== Computed data for each report =====
  const soldItems = history.filter(h => h.action === 'sold');
  const receivedItems = history.filter(h => h.action === 'received' || h.action === 'added');
  const adjustedItems = history.filter(h => h.action === 'adjusted');

  const stockValue = products.reduce((s, p) => s + p.price * p.stock, 0);
  const stockCost = products.reduce((s, p) => s + p.costPrice * p.stock, 0);
  const potentialProfit = stockValue - stockCost;
  const lowStockItems = products.filter(p => p.stock <= p.reorderLevel);

  // ===== Filter history by date range =====
  const filteredSoldItems = useMemo(() => {
    return soldItems.filter(h => {
      const d = h.timestamp.split('T')[0];
      return d >= fromDate && d <= toDate;
    });
  }, [soldItems, fromDate, toDate]);

  const filteredReceivedItems = useMemo(() => {
    return receivedItems.filter(h => {
      const d = h.timestamp.split('T')[0];
      return d >= fromDate && d <= toDate;
    });
  }, [receivedItems, fromDate, toDate]);

  const filteredAdjustedItems = useMemo(() => {
    return adjustedItems.filter(h => {
      const d = h.timestamp.split('T')[0];
      return d >= fromDate && d <= toDate;
    });
  }, [adjustedItems, fromDate, toDate]);

  // ===== Daily Sales data =====
  const dailySalesData = useMemo(() => {
    const totalRevenue = filteredSoldItems.reduce((s, h) => {
      const p = products.find(p => p.id === h.productId);
      return s + (p ? p.price * Math.abs(h.quantityChange) : 0);
    }, 0);
    const totalCost = filteredSoldItems.reduce((s, h) => {
      const product = products.find(p => p.id === h.productId);
      return s + (product ? product.costPrice * Math.abs(h.quantityChange) : 0);
    }, 0);
    const grossProfit = totalRevenue - totalCost;
    const vatCollected = totalRevenue * 0.15;
    return { totalRevenue, totalCost, grossProfit, vatCollected, transactionCount: filteredSoldItems.length };
  }, [filteredSoldItems, products]);

  // ===== P&L data =====
  const pnlData = useMemo(() => {
    const revenue = filteredSoldItems.reduce((s, h) => {
      const p = products.find(p => p.id === h.productId);
      return s + (p ? p.price * Math.abs(h.quantityChange) : 0);
    }, 0);
    const cogs = filteredSoldItems.reduce((s, h) => {
      const product = products.find(p => p.id === h.productId);
      return s + (product ? product.costPrice * Math.abs(h.quantityChange) : 0);
    }, 0);
    const grossProfit = revenue - cogs;
    const operatingExpenses = stockCost * 0.02;
    const netProfit = grossProfit - operatingExpenses;
    const vatOutput = revenue * 0.15;
    return { revenue, cogs, grossProfit, operatingExpenses, netProfit, vatOutput, margin: revenue > 0 ? (netProfit / revenue) * 100 : 0 };
  }, [filteredSoldItems, products, stockCost]);

  // ===== VAT data =====
  const vatData = useMemo(() => {
    const taxableItems = filteredSoldItems.filter(h => {
      const p = products.find(p => p.id === h.productId);
      return p?.taxable;
    });
    const nonTaxableItems = filteredSoldItems.filter(h => {
      const p = products.find(p => p.id === h.productId);
      return !p?.taxable;
    });
    const taxableRevenue = taxableItems.reduce((s, h) => {
      const p = products.find(p => p.id === h.productId);
      return s + (p ? p.price * Math.abs(h.quantityChange) : 0);
    }, 0);
    const nonTaxableRevenue = nonTaxableItems.reduce((s, h) => {
      const p = products.find(p => p.id === h.productId);
      return s + (p ? p.price * Math.abs(h.quantityChange) : 0);
    }, 0);
    const vatRate = 0.15;
    const vatCollected = taxableRevenue * vatRate;
    return { taxableRevenue, nonTaxableRevenue, vatCollected, vatRate, taxableCount: taxableItems.length, nonTaxableCount: nonTaxableItems.length };
  }, [filteredSoldItems, products]);

  // ===== Stock Performance data =====
  const stockPerfData = useMemo(() => {
    return products.map(p => {
      const sold = filteredSoldItems.filter(h => h.productId === p.id).reduce((s, h) => s + Math.abs(h.quantityChange), 0);
      const revenue = sold * p.price;
      const cost = sold * p.costPrice;
      const profit = revenue - cost;
      const turnover = p.stock > 0 ? sold / p.stock : 0;
      return { product: p, sold, revenue, cost, profit, turnover };
    }).sort((a, b) => b.revenue - a.revenue).slice(0, 20);
  }, [products, filteredSoldItems]);

  // ===== General Ledger entries =====
  const ledgerEntries = useMemo(() => {
    const entries: { date: string; account: string; debit: number; credit: number; description: string; ref: string }[] = [];
    filteredSoldItems.forEach(h => {
      const p = products.find(p => p.id === h.productId);
      const amount = p ? p.price * Math.abs(h.quantityChange) : 0;
      entries.push({ date: h.timestamp, account: 'Cash', debit: amount, credit: 0, description: `Sale: ${h.productName}`, ref: h.reference || '' });
      entries.push({ date: h.timestamp, account: 'Sales Revenue', debit: 0, credit: amount, description: `Sale: ${h.productName}`, ref: h.reference || '' });
      entries.push({ date: h.timestamp, account: 'COGS', debit: p ? p.costPrice * Math.abs(h.quantityChange) : 0, credit: 0, description: `Cost: ${h.productName}`, ref: h.reference || '' });
      entries.push({ date: h.timestamp, account: 'Inventory', debit: 0, credit: p ? p.costPrice * Math.abs(h.quantityChange) : 0, description: `Stock out: ${h.productName}`, ref: h.reference || '' });
    });
    filteredReceivedItems.forEach(h => {
      const p = products.find(p => p.id === h.productId);
      const amount = p ? p.costPrice * h.quantityChange : 0;
      entries.push({ date: h.timestamp, account: 'Inventory', debit: amount, credit: 0, description: `Received: ${h.productName}`, ref: h.reference || '' });
      entries.push({ date: h.timestamp, account: 'Accounts Payable', debit: 0, credit: amount, description: `Received: ${h.productName}`, ref: h.reference || '' });
    });
    filteredAdjustedItems.forEach(h => {
      const p = products.find(p => p.id === h.productId);
      const amount = p ? p.costPrice * Math.abs(h.quantityChange) : 0;
      entries.push({ date: h.timestamp, account: 'Inventory Adjustment', debit: h.quantityChange < 0 ? amount : 0, credit: h.quantityChange > 0 ? amount : 0, description: `${h.reason}`, ref: h.reference || '' });
    });
    return entries.sort((a, b) => b.date.localeCompare(a.date));
  }, [filteredSoldItems, filteredReceivedItems, filteredAdjustedItems, products]);

  // ===== Trial Balance =====
  const trialBalance = useMemo(() => {
    const accounts = new Map<string, number>();
    ledgerEntries.forEach(e => {
      accounts.set(e.account, (accounts.get(e.account) || 0) + e.debit - e.credit);
    });
    const rows = Array.from(accounts.entries()).map(([account, balance]) => ({
      account, debit: balance > 0 ? balance : 0, credit: balance < 0 ? Math.abs(balance) : 0,
    })).sort((a, b) => a.account.localeCompare(b.account));
    const totalDebit = rows.reduce((s, r) => s + r.debit, 0);
    const totalCredit = rows.reduce((s, r) => s + r.credit, 0);
    return { rows, totalDebit, totalCredit };
  }, [ledgerEntries]);

  // ===== Stock Group Report data =====
  const stockGroupData = useMemo(() => {
    return groups.map(g => {
      const groupProducts = products.filter(p => p.groupId === g.id);
      const itemCount = groupProducts.length;
      const totalStock = groupProducts.reduce((s, p) => s + p.stock, 0);
      const stockValue = groupProducts.reduce((s, p) => s + p.price * p.stock, 0);
      const stockCost = groupProducts.reduce((s, p) => s + p.costPrice * p.stock, 0);
      const potentialProfit = stockValue - stockCost;
      const lowStock = groupProducts.filter(p => p.stock <= p.reorderLevel).length;
      const outOfStock = groupProducts.filter(p => p.stock === 0).length;
      return { group: g, itemCount, totalStock, stockValue, stockCost, potentialProfit, lowStock, outOfStock };
    }).sort((a, b) => b.stockValue - a.stockValue);
  }, [groups, products]);

  // ===== Daily Sales Detail (line-by-line: date, part no, description, qty, price, amount) =====
  const dailySalesDetail = useMemo(() => {
    return filteredSoldItems.map(h => {
      const p = products.find(p => p.id === h.productId);
      const qty = Math.abs(h.quantityChange);
      const price = p?.price || 0;
      return {
        date: h.timestamp.split('T')[0],
        time: new Date(h.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
        partNo: h.sku,
        description: h.productName,
        qty,
        price,
        amount: qty * price,
        reference: h.reference || '',
        user: h.user,
      };
    }).sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time));
  }, [filteredSoldItems, products]);

  const dailyDetailStats = useMemo(() => {
    const totalQty = dailySalesDetail.reduce((s, d) => s + d.qty, 0);
    const totalAmount = dailySalesDetail.reduce((s, d) => s + d.amount, 0);
    const totalCost = dailySalesDetail.reduce((s, d) => {
      const p = products.find(p => p.sku === d.partNo);
      return s + (p ? p.costPrice * d.qty : 0);
    }, 0);
    const transactions = new Set(dailySalesDetail.map(d => d.reference)).size;
    const avgBasket = transactions > 0 ? totalAmount / transactions : 0;
    return { totalQty, totalAmount, totalCost, transactions, avgBasket, grossProfit: totalAmount - totalCost };
  }, [dailySalesDetail, products]);

  // ===== Monthly Summary (grouped by month) =====
  const monthlySummary = useMemo(() => {
    const monthMap = new Map<string, { month: string; label: string; transactions: Set<string>; items: number; revenue: number; cost: number; profit: number; vat: number }>();
    filteredSoldItems.forEach(h => {
      const monthKey = h.timestamp.substring(0, 7); // YYYY-MM
      const date = new Date(h.timestamp + 'T00:00:00');
      const label = date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
      const existing = monthMap.get(monthKey) || { month: monthKey, label, transactions: new Set(), items: 0, revenue: 0, cost: 0, profit: 0, vat: 0 };
      const p = products.find(p => p.id === h.productId);
      const qty = Math.abs(h.quantityChange);
      const revenue = (p?.price || 0) * qty;
      const cost = (p?.costPrice || 0) * qty;
      existing.items += qty;
      existing.revenue += revenue;
      existing.cost += cost;
      existing.profit += revenue - cost;
      existing.vat += (p?.taxable ? revenue * 0.15 : 0);
      if (h.reference) existing.transactions.add(h.reference);
      monthMap.set(monthKey, existing);
    });
    return Array.from(monthMap.values()).map(m => ({ ...m, transactions: m.transactions.size })).sort((a, b) => b.month.localeCompare(a.month));
  }, [filteredSoldItems, products]);

  const monthlySummaryTotals = useMemo(() => {
    return monthlySummary.reduce((acc, m) => ({
      transactions: acc.transactions + m.transactions,
      items: acc.items + m.items,
      revenue: acc.revenue + m.revenue,
      cost: acc.cost + m.cost,
      profit: acc.profit + m.profit,
      vat: acc.vat + m.vat,
    }), { transactions: 0, items: 0, revenue: 0, cost: 0, profit: 0, vat: 0 });
  }, [monthlySummary]);

  // ===== Monthly Detail (line-by-line grouped by month) =====
  const monthlyDetail = useMemo(() => {
    const monthMap = new Map<string, { month: string; label: string; rows: typeof dailySalesDetail; totals: { qty: number; amount: number } }>();
    dailySalesDetail.forEach(d => {
      const monthKey = d.date.substring(0, 7);
      const date = new Date(monthKey + '-01T00:00:00');
      const label = date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
      const existing = monthMap.get(monthKey) || { month: monthKey, label, rows: [], totals: { qty: 0, amount: 0 } };
      existing.rows.push(d);
      existing.totals.qty += d.qty;
      existing.totals.amount += d.amount;
      monthMap.set(monthKey, existing);
    });
    return Array.from(monthMap.values()).sort((a, b) => b.month.localeCompare(a.month));
  }, [dailySalesDetail]);

  // ===== Print handler =====
  const handlePrint = () => {
    const printWin = window.open('', '_blank', 'width=900,height=600');
    if (!printWin) { toast({ title: 'Popup blocked', variant: 'destructive' }); return; }
    const reportLabel = reports.find(r => r.id === activeReport)?.label || 'Report';

    // Build the report body HTML based on active report
    let bodyHtml = '';
    const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    if (activeReport === 'daily-sales') {
      bodyHtml = `<table><thead><tr><th>Metric</th><th style="text-align:right">Amount (GHC)</th></tr></thead><tbody>
        <tr><td>Gross Revenue</td><td style="text-align:right;color:#16a34a">${fmt(dailySalesData.totalRevenue)}</td></tr>
        <tr><td>Cost of Goods Sold</td><td style="text-align:right;color:#dc2626">${fmt(dailySalesData.totalCost)}</td></tr>
        <tr><td>VAT Collected (15%)</td><td style="text-align:right;color:#d97706">${fmt(dailySalesData.vatCollected)}</td></tr>
        <tr class="total"><td>Net Profit</td><td style="text-align:right;color:#2563eb">${fmt(dailySalesData.grossProfit)}</td></tr>
        <tr><td>Transactions</td><td style="text-align:right">${dailySalesData.transactionCount}</td></tr>
        </tbody></table>`;
    } else if (activeReport === 'daily-sales-detail') {
      bodyHtml = `<table><thead><tr><th>Date</th><th>Time</th><th>Part No</th><th>Description</th><th style="text-align:center">Qty</th><th style="text-align:right">Price</th><th style="text-align:right">Amount</th><th>Ref</th></tr></thead><tbody>`;
      dailySalesDetail.slice(0, 200).forEach(d => { bodyHtml += `<tr><td style="font-size:10px">${d.date}</td><td style="font-size:10px">${d.time}</td><td style="font-family:monospace;font-size:10px">${d.partNo}</td><td>${d.description}</td><td style="text-align:center">${d.qty}</td><td style="text-align:right">${fmt(d.price)}</td><td style="text-align:right;font-weight:bold">${fmt(d.amount)}</td><td style="font-size:9px;font-family:monospace;color:#999">${d.reference}</td></tr>`; });
      bodyHtml += `<tr class="total"><td colspan="4">TOTALS</td><td style="text-align:center">${dailyDetailStats.totalQty}</td><td></td><td style="text-align:right">${fmt(dailyDetailStats.totalAmount)}</td><td></td></tr></tbody></table>`;
    } else if (activeReport === 'monthly-summary') {
      bodyHtml = `<table><thead><tr><th>Month</th><th style="text-align:center">Transactions</th><th style="text-align:center">Items Sold</th><th style="text-align:right">Revenue</th><th style="text-align:right">Cost</th><th style="text-align:right">Profit</th><th style="text-align:right">VAT</th><th style="text-align:right">Margin %</th></tr></thead><tbody>`;
      monthlySummary.forEach(m => { const margin = m.revenue > 0 ? (m.profit / m.revenue * 100) : 0; bodyHtml += `<tr><td style="font-weight:600">${m.label}</td><td style="text-align:center">${m.transactions}</td><td style="text-align:center">${m.items}</td><td style="text-align:right;color:#16a34a">${fmt(m.revenue)}</td><td style="text-align:right;color:#dc2626">${fmt(m.cost)}</td><td style="text-align:right;color:#2563eb;font-weight:bold">${fmt(m.profit)}</td><td style="text-align:right;color:#d97706">${fmt(m.vat)}</td><td style="text-align:right">${margin.toFixed(1)}%</td></tr>`; });
      const t = monthlySummaryTotals; const tm = t.revenue > 0 ? (t.profit / t.revenue * 100) : 0;
      bodyHtml += `<tr class="total"><td>TOTAL</td><td style="text-align:center">${t.transactions}</td><td style="text-align:center">${t.items}</td><td style="text-align:right">${fmt(t.revenue)}</td><td style="text-align:right">${fmt(t.cost)}</td><td style="text-align:right">${fmt(t.profit)}</td><td style="text-align:right">${fmt(t.vat)}</td><td style="text-align:right">${tm.toFixed(1)}%</td></tr></tbody></table>`;
    } else if (activeReport === 'monthly-detail') {
      monthlyDetail.forEach(m => {
        bodyHtml += `<h3 style="margin:15px 0 5px;color:#1E5A8E;border-bottom:1px solid #ccc;padding-bottom:3px">${m.label} — ${m.rows.length} items · ${fmt(m.totals.amount)}</h3>`;
        bodyHtml += `<table><thead><tr><th>Date</th><th>Part No</th><th>Description</th><th style="text-align:center">Qty</th><th style="text-align:right">Price</th><th style="text-align:right">Amount</th></tr></thead><tbody>`;
        m.rows.slice(0, 100).forEach(d => { bodyHtml += `<tr><td style="font-size:10px">${d.date}</td><td style="font-family:monospace;font-size:10px">${d.partNo}</td><td>${d.description}</td><td style="text-align:center">${d.qty}</td><td style="text-align:right">${fmt(d.price)}</td><td style="text-align:right;font-weight:bold">${fmt(d.amount)}</td></tr>`; });
        bodyHtml += `<tr class="total"><td colspan="3">Month Total</td><td style="text-align:center">${m.totals.qty}</td><td></td><td style="text-align:right">${fmt(m.totals.amount)}</td></tr></tbody></table>`;
      });
    } else if (activeReport === 'profit-loss') {
      bodyHtml = `<table><tbody>
        <tr class="total"><td colspan="2">Revenue</td></tr>
        <tr><td style="padding-left:20px">Sales Revenue</td><td style="text-align:right;color:#16a34a">${fmt(pnlData.revenue)}</td></tr>
        <tr class="total"><td colspan="2">Cost of Goods Sold</td></tr>
        <tr><td style="padding-left:20px">COGS</td><td style="text-align:right;color:#dc2626">(${fmt(pnlData.cogs)})</td></tr>
        <tr class="total" style="background:#dbeafe"><td>Gross Profit</td><td style="text-align:right;color:#2563eb">${fmt(pnlData.grossProfit)}</td></tr>
        <tr class="total"><td colspan="2">Operating Expenses</td></tr>
        <tr><td style="padding-left:20px">Estimated Overhead</td><td style="text-align:right;color:#dc2626">(${fmt(pnlData.operatingExpenses)})</td></tr>
        <tr class="total" style="background:#d1fae5"><td>Net Profit</td><td style="text-align:right;color:#059669">${fmt(pnlData.netProfit)}</td></tr>
        <tr><td style="font-style:italic;color:#999">Profit Margin</td><td style="text-align:right;color:#999">${pnlData.margin.toFixed(1)}%</td></tr>
        </tbody></table>`;
    } else if (activeReport === 'vat-tax') {
      bodyHtml = `<table><thead><tr><th>Category</th><th>Items</th><th style="text-align:right">Revenue</th><th style="text-align:right">VAT Rate</th><th style="text-align:right">VAT Amount</th></tr></thead><tbody>
        <tr><td>Taxable Items</td><td style="text-align:center">${vatData.taxableCount}</td><td style="text-align:right;color:#16a34a">${fmt(vatData.taxableRevenue)}</td><td style="text-align:right">15%</td><td style="text-align:right;color:#d97706;font-weight:bold">${fmt(vatData.vatCollected)}</td></tr>
        <tr><td>Non-Taxable Items</td><td style="text-align:center">${vatData.nonTaxableCount}</td><td style="text-align:right;color:#999">${fmt(vatData.nonTaxableRevenue)}</td><td style="text-align:right">0%</td><td style="text-align:right;color:#ccc">—</td></tr>
        <tr class="total"><td>Total</td><td style="text-align:center">${vatData.taxableCount + vatData.nonTaxableCount}</td><td style="text-align:right">${fmt(vatData.taxableRevenue + vatData.nonTaxableRevenue)}</td><td></td><td style="text-align:right;color:#d97706">${fmt(vatData.vatCollected)}</td></tr>
        </tbody></table>`;
    } else if (activeReport === 'stock-value') {
      bodyHtml = `<table><thead><tr><th>Product</th><th style="text-align:center">Stock</th><th style="text-align:right">Cost</th><th style="text-align:right">Price</th><th style="text-align:right">Stock Value</th></tr></thead><tbody>`;
      products.forEach(p => { bodyHtml += `<tr><td>${p.emoji} ${p.name}</td><td style="text-align:center">${p.stock}</td><td style="text-align:right">${fmt(p.costPrice)}</td><td style="text-align:right;color:#16a34a">${fmt(p.price)}</td><td style="text-align:right;font-weight:bold">${fmt(p.price * p.stock)}</td></tr>`; });
      bodyHtml += `<tr class="total"><td colspan="4">Total Stock Value</td><td style="text-align:right;color:#0891b2;font-size:13px">${fmt(stockValue)}</td></tr></tbody></table>`;
    } else if (activeReport === 'cost-price') {
      bodyHtml = `<table><thead><tr><th>Product</th><th style="text-align:right">Cost</th><th style="text-align:right">Price</th><th style="text-align:right">Markup</th><th style="text-align:right">Margin %</th><th style="text-align:right">Profit/Unit</th></tr></thead><tbody>`;
      products.forEach(p => { const mk = p.costPrice > 0 ? ((p.price - p.costPrice) / p.costPrice) * 100 : 0; const mg = p.price > 0 ? ((p.price - p.costPrice) / p.price) * 100 : 0; bodyHtml += `<tr><td>${p.emoji} ${p.name}</td><td style="text-align:right;color:#dc2626">${fmt(p.costPrice)}</td><td style="text-align:right;color:#16a34a">${fmt(p.price)}</td><td style="text-align:right">${mk.toFixed(1)}%</td><td style="text-align:right">${mg.toFixed(1)}%</td><td style="text-align:right;color:#2563eb">${fmt(p.price - p.costPrice)}</td></tr>`; });
      bodyHtml += `</tbody></table>`;
    } else if (activeReport === 'stock-performance') {
      bodyHtml = `<table><thead><tr><th>#</th><th>Product</th><th style="text-align:center">Sold</th><th style="text-align:right">Revenue</th><th style="text-align:right">Cost</th><th style="text-align:right">Profit</th><th style="text-align:center">Turnover</th></tr></thead><tbody>`;
      stockPerfData.forEach((d, i) => { bodyHtml += `<tr><td style="text-align:center;color:#999">${i + 1}</td><td>${d.product.emoji} ${d.product.name}</td><td style="text-align:center">${d.sold}</td><td style="text-align:right;color:#16a34a">${fmt(d.revenue)}</td><td style="text-align:right;color:#dc2626">${fmt(d.cost)}</td><td style="text-align:right;color:#2563eb;font-weight:bold">${fmt(d.profit)}</td><td style="text-align:center;color:#999">${d.turnover.toFixed(2)}x</td></tr>`; });
      bodyHtml += `</tbody></table>`;
    } else if (activeReport === 'general-ledger') {
      bodyHtml = `<table><thead><tr><th>Date</th><th>Account</th><th>Description</th><th>Ref</th><th style="text-align:right">Debit</th><th style="text-align:right">Credit</th></tr></thead><tbody>`;
      ledgerEntries.slice(0, 100).forEach(e => { bodyHtml += `<tr><td style="font-size:10px;color:#999">${new Date(e.date).toLocaleDateString('en-GB')}</td><td style="font-weight:600">${e.account}</td><td style="font-size:10px">${e.description}</td><td style="font-size:10px;font-family:monospace;color:#ccc">${e.ref}</td><td style="text-align:right">${e.debit > 0 ? fmt(e.debit) : '—'}</td><td style="text-align:right">${e.credit > 0 ? fmt(e.credit) : '—'}</td></tr>`; });
      bodyHtml += `</tbody></table>`;
    } else if (activeReport === 'stock-group') {
      bodyHtml = `<table><thead><tr><th>Group</th><th style="text-align:center">Items</th><th style="text-align:center">Total Stock</th><th style="text-align:center">Low Stock</th><th style="text-align:center">Out of Stock</th><th style="text-align:right">Stock Cost</th><th style="text-align:right">Stock Value</th><th style="text-align:right">Potential Profit</th></tr></thead><tbody>`;
      stockGroupData.forEach(d => { bodyHtml += `<tr><td style="font-weight:600">${d.group.icon} ${d.group.name}</td><td style="text-align:center">${d.itemCount}</td><td style="text-align:center">${d.totalStock}</td><td style="text-align:center;color:#d97706">${d.lowStock}</td><td style="text-align:center;color:#dc2626">${d.outOfStock}</td><td style="text-align:right;color:#dc2626">${fmt(d.stockCost)}</td><td style="text-align:right;color:#16a34a">${fmt(d.stockValue)}</td><td style="text-align:right;color:#2563eb;font-weight:bold">${fmt(d.potentialProfit)}</td></tr>`; });
      const totals = stockGroupData.reduce((a, d) => ({ items: a.items + d.itemCount, stock: a.stock + d.totalStock, low: a.low + d.lowStock, out: a.out + d.outOfStock, cost: a.cost + d.stockCost, value: a.value + d.stockValue, profit: a.profit + d.potentialProfit }), { items: 0, stock: 0, low: 0, out: 0, cost: 0, value: 0, profit: 0 });
      bodyHtml += `<tr class="total"><td>Total</td><td style="text-align:center">${totals.items}</td><td style="text-align:center">${totals.stock}</td><td style="text-align:center">${totals.low}</td><td style="text-align:center">${totals.out}</td><td style="text-align:right">${fmt(totals.cost)}</td><td style="text-align:right">${fmt(totals.value)}</td><td style="text-align:right">${fmt(totals.profit)}</td></tr></tbody></table>`;
    } else if (activeReport === 'trial-balance') {
      bodyHtml = `<table><thead><tr><th>Account</th><th style="text-align:right">Debit (GHC)</th><th style="text-align:right">Credit (GHC)</th></tr></thead><tbody>`;
      trialBalance.rows.forEach(r => { bodyHtml += `<tr><td style="font-weight:600">${r.account}</td><td style="text-align:right">${r.debit > 0 ? fmt(r.debit) : '—'}</td><td style="text-align:right">${r.credit > 0 ? fmt(r.credit) : '—'}</td></tr>`; });
      bodyHtml += `<tr class="total"><td>Total</td><td style="text-align:right;color:#0d9488;font-size:13px">${fmt(trialBalance.totalDebit)}</td><td style="text-align:right;color:#0d9488;font-size:13px">${fmt(trialBalance.totalCredit)}</td></tr>`;
      bodyHtml += `<tr><td colspan="3" style="font-size:10px;font-style:italic;color:${trialBalance.totalDebit === trialBalance.totalCredit ? '#16a34a' : '#dc2626'}">${trialBalance.totalDebit === trialBalance.totalCredit ? '✓ Balanced' : '⚠ Not balanced'}</td></tr>`;
      bodyHtml += `</tbody></table>`;
    }

    printWin.document.write(`<!DOCTYPE html><html><head><title>${reportLabel}</title><style>
      body{font-family:Arial,sans-serif;margin:20px;color:#1e293b}
      .header{text-align:center;border-bottom:2px solid #1E5A8E;padding-bottom:10px;margin-bottom:15px}
      .header h1{margin:0;font-size:18px;color:#1E5A8E}
      .header div{font-size:12px;color:#666;margin-top:3px}
      h2{text-align:center;font-size:14px;margin:10px 0}
      .date-range{text-align:center;font-size:11px;color:#666;margin-bottom:15px}
      table{width:100%;border-collapse:collapse;font-size:11px}
      th{background:#1E5A8E;color:white;border:1px solid #1E5A8E;padding:6px 8px;font-weight:bold}
      td{border:1px solid #cbd5e1;padding:4px 8px}
      .total{font-weight:bold;background:#f0f4f8}
      tbody tr:nth-child(even){background:#f8fafc}
      @media print{body{margin:10px}}
    </style></head><body>
      <div class="header"><h1>${COMPANY.name}</h1><div>${COMPANY.address} · ${COMPANY.contact}</div></div>
      <h2>${reportLabel}</h2>
      <div class="date-range">Period: ${fromDate} to ${toDate} · Generated: ${new Date().toLocaleString('en-GB')}</div>
      ${bodyHtml}
    </body></html>`);
    printWin.document.close();
    setTimeout(() => { printWin.focus(); printWin.print(); }, 300);
    toast({ title: 'Printing report' });
  };

  const handleExport = () => {
    import('xlsx').then((XLSX) => {
      const data: any[] = [];
      if (activeReport === 'daily-sales') {
        data.push({ Metric: 'Total Revenue', Value: dailySalesData.totalRevenue });
        data.push({ Metric: 'Total Cost', Value: dailySalesData.totalCost });
        data.push({ Metric: 'Gross Profit', Value: dailySalesData.grossProfit });
        data.push({ Metric: 'VAT Collected', Value: dailySalesData.vatCollected });
        data.push({ Metric: 'Transactions', Value: dailySalesData.transactionCount });
      } else if (activeReport === 'daily-sales-detail') {
        dailySalesDetail.forEach(d => data.push({ Date: d.date, Time: d.time, PartNo: d.partNo, Description: d.description, Qty: d.qty, Price: d.price, Amount: d.amount, Reference: d.reference }));
      } else if (activeReport === 'monthly-summary') {
        monthlySummary.forEach(m => data.push({ Month: m.label, Transactions: m.transactions, ItemsSold: m.items, Revenue: m.revenue, Cost: m.cost, Profit: m.profit, VAT: m.vat }));
      } else if (activeReport === 'monthly-detail') {
        monthlyDetail.forEach(m => m.rows.forEach(d => data.push({ Month: m.label, Date: d.date, PartNo: d.partNo, Description: d.description, Qty: d.qty, Price: d.price, Amount: d.amount })));
      } else if (activeReport === 'stock-value') {
        products.forEach(p => data.push({ SKU: p.sku, Product: p.name, Stock: p.stock, Cost: p.costPrice, Price: p.price, StockValue: p.price * p.stock }));
      } else if (activeReport === 'stock-group') {
        stockGroupData.forEach(d => data.push({ Group: d.group.name, Items: d.itemCount, TotalStock: d.totalStock, LowStock: d.lowStock, OutOfStock: d.outOfStock, StockCost: d.stockCost, StockValue: d.stockValue, PotentialProfit: d.potentialProfit }));
      } else if (activeReport === 'trial-balance') {
        trialBalance.rows.forEach(r => data.push({ Account: r.account, Debit: r.debit, Credit: r.credit }));
        data.push({ Account: 'TOTAL', Debit: trialBalance.totalDebit, Credit: trialBalance.totalCredit });
      }
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, reports.find(r => r.id === activeReport)?.label || 'Report');
      XLSX.writeFile(wb, `${activeReport}-${new Date().toISOString().split('T')[0]}.xlsx`);
      toast({ title: 'Exported successfully' });
    });
  };

  const colorClasses: Record<string, { bg: string; text: string; border: string; gradient: string }> = {
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-300', gradient: 'from-emerald-500 to-teal-500' },
    blue: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-300', gradient: 'from-blue-500 to-indigo-500' },
    amber: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-300', gradient: 'from-amber-500 to-orange-500' },
    cyan: { bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-300', gradient: 'from-cyan-500 to-blue-500' },
    purple: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-300', gradient: 'from-purple-500 to-pink-500' },
    rose: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-300', gradient: 'from-rose-500 to-red-500' },
    indigo: { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-300', gradient: 'from-indigo-500 to-blue-500' },
    teal: { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-300', gradient: 'from-teal-500 to-cyan-500' },
  };

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50">
      {/* Header */}
      <header className="flex-shrink-0 bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 text-white shadow-lg">
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="h-9 w-9 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center ring-1 ring-white/20">
                <BarChart3 className="h-5 w-5" />
              </div>
              <div>
                <div className="font-bold text-base leading-tight">Accounts & Financial Reports</div>
                <div className="text-[10px] text-slate-300">{COMPANY.name}</div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 text-xs">
              <Calendar className="h-3.5 w-3.5 text-slate-400" />
              <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="h-7 px-2 rounded-md bg-white/10 text-white text-xs border border-white/20 outline-none" />
              <span className="text-slate-400">to</span>
              <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="h-7 px-2 rounded-md bg-white/10 text-white text-xs border border-white/20 outline-none" />
            </div>
            <button onClick={handlePrint} className="h-8 px-3 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center gap-1.5 transition"><Printer className="h-3.5 w-3.5" /> Print</button>
            <button onClick={handleExport} className="h-8 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 transition"><Download className="h-3.5 w-3.5" /> Export</button>
          </div>
        </div>
      </header>

      {/* Report tabs */}
      <nav className="flex-shrink-0 bg-white border-b border-slate-200 shadow-sm">
        <div className="flex items-center gap-1 px-6 py-2 overflow-x-auto" style={{ scrollbarWidth: 'thin' }}>
          {reports.map(r => {
            const cc = colorClasses[r.color];
            const isActive = activeReport === r.id;
            return (
              <button key={r.id} onClick={() => setActiveReport(r.id)} className={cn("flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap", isActive ? cn("bg-gradient-to-r text-white shadow-md", cc.gradient) : "text-slate-600 hover:bg-slate-100")}>
                <r.icon className="h-4 w-4" /> {r.label}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Content */}
      <main className="flex-1 overflow-auto p-6" style={{ scrollbarWidth: 'thin' }}>
        <AnimatePresence mode="wait">
          <motion.div key={activeReport} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} className="max-w-5xl mx-auto">

            {/* ===== Daily Sales ===== */}
            {activeReport === "daily-sales" && (
              <div className="space-y-4">
                <div className="grid grid-cols-4 gap-4">
                  {[
                    { label: 'Total Revenue', value: formatGHS(dailySalesData.totalRevenue), icon: DollarSign, color: 'emerald' },
                    { label: 'Total Cost', value: formatGHS(dailySalesData.totalCost), icon: ShoppingCart, color: 'rose' },
                    { label: 'Gross Profit', value: formatGHS(dailySalesData.grossProfit), icon: TrendingUp, color: 'blue' },
                    { label: 'Transactions', value: String(dailySalesData.transactionCount), icon: Receipt, color: 'amber' },
                  ].map((stat, i) => {
                    const cc = colorClasses[stat.color];
                    const ringClass = cc.border.replace('border-', 'ring-');
                    return (
                      <div key={i} className={cn("rounded-2xl p-4 ring-1", cc.bg, ringClass)}>
                        <div className="flex items-center gap-2 mb-2"><stat.icon className={cn("h-5 w-5", cc.text)} /><span className="text-xs font-bold text-slate-600 uppercase">{stat.label}</span></div>
                        <div className="text-2xl font-bold text-slate-800 font-mono">{stat.value}</div>
                      </div>
                    );
                  })}
                </div>
                <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 overflow-hidden">
                  <div className="px-5 py-3 bg-slate-50 border-b border-slate-200"><span className="text-sm font-bold text-slate-700">Sales Summary</span></div>
                  <div className="mobile-scroll-x">
                  <table className="w-full text-sm">
                    <thead><tr className="bg-slate-100 text-xs uppercase text-slate-600"><th className="text-left px-4 py-2 font-semibold">Metric</th><th className="text-right px-4 py-2 font-semibold">Amount (GHC)</th></tr></thead>
                    <tbody className="divide-y divide-slate-100">
                      <tr><td className="px-4 py-2.5 font-medium text-slate-700">Gross Revenue</td><td className="px-4 py-2.5 text-right font-mono text-emerald-600 font-semibold">{formatGHS(dailySalesData.totalRevenue)}</td></tr>
                      <tr><td className="px-4 py-2.5 font-medium text-slate-700">Cost of Goods Sold</td><td className="px-4 py-2.5 text-right font-mono text-rose-600">{formatGHS(dailySalesData.totalCost)}</td></tr>
                      <tr><td className="px-4 py-2.5 font-medium text-slate-700">VAT Collected (15%)</td><td className="px-4 py-2.5 text-right font-mono text-amber-600">{formatGHS(dailySalesData.vatCollected)}</td></tr>
                      <tr className="bg-slate-50"><td className="px-4 py-3 font-bold text-slate-800">Net Profit</td><td className="px-4 py-3 text-right font-mono font-bold text-blue-700 text-base">{formatGHS(dailySalesData.grossProfit)}</td></tr>
                    </tbody>
                  </table>
                  </div>
                </div>
              </div>
            )}

            {/* ===== Daily Sales Detail ===== */}
            {activeReport === "daily-sales-detail" && (
              <div className="space-y-4">
                <div className="grid grid-cols-5 gap-3">
                  <div className="rounded-2xl p-3 bg-emerald-50 ring-1 ring-emerald-200"><div className="text-[10px] font-bold text-emerald-700 uppercase">Items Sold</div><div className="text-lg font-bold font-mono text-slate-800">{dailyDetailStats.totalQty}</div></div>
                  <div className="rounded-2xl p-3 bg-blue-50 ring-1 ring-blue-200"><div className="text-[10px] font-bold text-blue-700 uppercase">Revenue</div><div className="text-lg font-bold font-mono text-slate-800">{formatGHS(dailyDetailStats.totalAmount)}</div></div>
                  <div className="rounded-2xl p-3 bg-rose-50 ring-1 ring-rose-200"><div className="text-[10px] font-bold text-rose-700 uppercase">Cost</div><div className="text-lg font-bold font-mono text-slate-800">{formatGHS(dailyDetailStats.totalCost)}</div></div>
                  <div className="rounded-2xl p-3 bg-indigo-50 ring-1 ring-indigo-200"><div className="text-[10px] font-bold text-indigo-700 uppercase">Gross Profit</div><div className="text-lg font-bold font-mono text-indigo-700">{formatGHS(dailyDetailStats.grossProfit)}</div></div>
                  <div className="rounded-2xl p-3 bg-amber-50 ring-1 ring-amber-200"><div className="text-[10px] font-bold text-amber-700 uppercase">Avg Basket</div><div className="text-lg font-bold font-mono text-slate-800">{formatGHS(dailyDetailStats.avgBasket)}</div></div>
                </div>
                <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 overflow-hidden">
                  <div className="px-5 py-3 bg-emerald-50 border-b border-emerald-100"><span className="text-sm font-bold text-slate-700">Daily Sales Detail ({dailySalesDetail.length} line items)</span></div>
                  <div className="max-h-96 overflow-auto" style={{ scrollbarWidth: 'thin' }}>
                    <div className="mobile-scroll-x">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0"><tr className="bg-slate-800 text-white text-xs uppercase"><th className="text-left px-3 py-2">Date</th><th className="text-left px-2 py-2">Time</th><th className="text-left px-2 py-2">Part No</th><th className="text-left px-3 py-2">Description</th><th className="text-center px-2 py-2">Qty</th><th className="text-right px-3 py-2">Price</th><th className="text-right px-3 py-2">Amount</th><th className="text-left px-3 py-2">Ref</th></tr></thead>
                      <tbody className="divide-y divide-slate-100">
                        {dailySalesDetail.length === 0 ? <tr><td colSpan={8} className="text-center py-8 text-slate-400">No sales data for the selected period</td></tr> : dailySalesDetail.slice(0, 200).map((d, i) => (
                          <tr key={i} className={i % 2 === 1 ? 'bg-slate-50/50' : 'bg-white'}>
                            <td className="px-3 py-2 text-xs text-slate-500">{d.date}</td>
                            <td className="px-2 py-2 text-xs text-slate-400 font-mono">{d.time}</td>
                            <td className="px-2 py-2 text-xs font-mono text-slate-600">{d.partNo}</td>
                            <td className="px-3 py-2 text-slate-700">{d.description}</td>
                            <td className="px-2 py-2 text-center font-mono font-semibold text-slate-700">{d.qty}</td>
                            <td className="px-3 py-2 text-right font-mono text-slate-500">{formatGHS(d.price)}</td>
                            <td className="px-3 py-2 text-right font-mono font-bold text-emerald-600">{formatGHS(d.amount)}</td>
                            <td className="px-3 py-2 text-[10px] font-mono text-slate-400">{d.reference}</td>
                          </tr>
                        ))}
                      </tbody>
                      {dailySalesDetail.length > 0 && (
                        <tfoot><tr className="bg-slate-100 font-bold"><td colSpan={4} className="px-3 py-3 text-slate-800">TOTALS</td><td className="px-2 py-3 text-center font-mono">{dailyDetailStats.totalQty}</td><td></td><td className="px-3 py-3 text-right font-mono text-emerald-700 text-base">{formatGHS(dailyDetailStats.totalAmount)}</td><td></td></tr></tfoot>
                      )}
                    </table>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ===== Monthly Summary ===== */}
            {activeReport === "monthly-summary" && (
              <div className="space-y-4">
                <div className="grid grid-cols-4 gap-4">
                  <div className="rounded-2xl p-4 bg-blue-50 ring-1 ring-blue-200"><div className="text-xs font-bold text-blue-700 uppercase mb-1">Total Revenue</div><div className="text-xl font-bold font-mono text-slate-800">{formatGHS(monthlySummaryTotals.revenue)}</div></div>
                  <div className="rounded-2xl p-4 bg-rose-50 ring-1 ring-rose-200"><div className="text-xs font-bold text-rose-700 uppercase mb-1">Total Cost</div><div className="text-xl font-bold font-mono text-slate-800">{formatGHS(monthlySummaryTotals.cost)}</div></div>
                  <div className="rounded-2xl p-4 bg-emerald-50 ring-1 ring-emerald-200"><div className="text-xs font-bold text-emerald-700 uppercase mb-1">Total Profit</div><div className="text-xl font-bold font-mono text-emerald-700">{formatGHS(monthlySummaryTotals.profit)}</div></div>
                  <div className="rounded-2xl p-4 bg-amber-50 ring-1 ring-amber-200"><div className="text-xs font-bold text-amber-700 uppercase mb-1">VAT Collected</div><div className="text-xl font-bold font-mono text-amber-600">{formatGHS(monthlySummaryTotals.vat)}</div></div>
                </div>
                <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 overflow-hidden">
                  <div className="px-5 py-3 bg-blue-50 border-b border-blue-100"><span className="text-sm font-bold text-slate-700">Monthly Sales Summary ({monthlySummary.length} months)</span></div>
                  <div className="mobile-scroll-x">
                  <table className="w-full text-sm">
                    <thead><tr className="bg-slate-800 text-white text-xs uppercase"><th className="text-left px-4 py-2">Month</th><th className="text-center px-3 py-2">Transactions</th><th className="text-center px-3 py-2">Items Sold</th><th className="text-right px-3 py-2">Revenue</th><th className="text-right px-3 py-2">Cost</th><th className="text-right px-3 py-2">Profit</th><th className="text-right px-3 py-2">VAT</th><th className="text-right px-4 py-2">Margin %</th></tr></thead>
                    <tbody className="divide-y divide-slate-100">
                      {monthlySummary.length === 0 ? <tr><td colSpan={8} className="text-center py-8 text-slate-400">No sales data available</td></tr> : monthlySummary.map((m, i) => {
                        const margin = m.revenue > 0 ? (m.profit / m.revenue * 100) : 0;
                        return (
                          <tr key={m.month} className={i % 2 === 1 ? 'bg-slate-50/50' : 'bg-white'}>
                            <td className="px-4 py-2.5 font-semibold text-slate-700">{m.label}</td>
                            <td className="px-3 py-2.5 text-center font-mono">{m.transactions}</td>
                            <td className="px-3 py-2.5 text-center font-mono">{m.items}</td>
                            <td className="px-3 py-2.5 text-right font-mono text-emerald-600">{formatGHS(m.revenue)}</td>
                            <td className="px-3 py-2.5 text-right font-mono text-rose-500">{formatGHS(m.cost)}</td>
                            <td className="px-3 py-2.5 text-right font-mono font-bold text-blue-600">{formatGHS(m.profit)}</td>
                            <td className="px-3 py-2.5 text-right font-mono text-amber-600">{formatGHS(m.vat)}</td>
                            <td className="px-4 py-2.5 text-right font-mono text-slate-500">{margin.toFixed(1)}%</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    {monthlySummary.length > 0 && (
                      <tfoot><tr className="bg-slate-100 font-bold">
                        <td className="px-4 py-3 text-slate-800">TOTAL</td>
                        <td className="px-3 py-3 text-center font-mono">{monthlySummaryTotals.transactions}</td>
                        <td className="px-3 py-3 text-center font-mono">{monthlySummaryTotals.items}</td>
                        <td className="px-3 py-3 text-right font-mono text-emerald-700">{formatGHS(monthlySummaryTotals.revenue)}</td>
                        <td className="px-3 py-3 text-right font-mono text-rose-700">{formatGHS(monthlySummaryTotals.cost)}</td>
                        <td className="px-3 py-3 text-right font-mono text-blue-700">{formatGHS(monthlySummaryTotals.profit)}</td>
                        <td className="px-3 py-3 text-right font-mono text-amber-700">{formatGHS(monthlySummaryTotals.vat)}</td>
                        <td className="px-4 py-3 text-right font-mono text-slate-600">{monthlySummaryTotals.revenue > 0 ? (monthlySummaryTotals.profit / monthlySummaryTotals.revenue * 100).toFixed(1) : '0.0'}%</td>
                      </tr></tfoot>
                    )}
                  </table>
                  </div>
                </div>
              </div>
            )}

            {/* ===== Monthly Detail ===== */}
            {activeReport === "monthly-detail" && (
              <div className="space-y-4">
                <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 overflow-hidden">
                  <div className="px-5 py-3 bg-blue-50 border-b border-blue-100"><span className="text-sm font-bold text-slate-700">Monthly Sales Detail ({monthlyDetail.length} months)</span></div>
                  <div className="max-h-96 overflow-auto p-4 space-y-4" style={{ scrollbarWidth: 'thin' }}>
                    {monthlyDetail.length === 0 ? <div className="text-center py-8 text-slate-400">No sales data available</div> : monthlyDetail.map(m => (
                      <div key={m.month} className="border border-slate-200 rounded-xl overflow-hidden">
                        <div className="px-4 py-2 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-slate-200 flex items-center justify-between">
                          <span className="text-sm font-bold text-slate-700">{m.label}</span>
                          <span className="text-xs text-slate-500">{m.rows.length} items · <span className="font-mono font-bold text-emerald-600">{formatGHS(m.totals.amount)}</span></span>
                        </div>
                        <div className="mobile-scroll-x">
                        <table className="w-full text-xs">
                          <thead><tr className="bg-slate-50 text-slate-500 text-[10px] uppercase"><th className="text-left px-3 py-1.5">Date</th><th className="text-left px-2 py-1.5">Part No</th><th className="text-left px-3 py-1.5">Description</th><th className="text-center px-2 py-1.5">Qty</th><th className="text-right px-3 py-1.5">Price</th><th className="text-right px-3 py-1.5">Amount</th></tr></thead>
                          <tbody className="divide-y divide-slate-50">
                            {m.rows.slice(0, 50).map((d, i) => (
                              <tr key={i} className={i % 2 === 1 ? 'bg-slate-50/30' : 'bg-white'}>
                                <td className="px-3 py-1.5 text-slate-500">{d.date}</td>
                                <td className="px-2 py-1.5 font-mono text-slate-600">{d.partNo}</td>
                                <td className="px-3 py-1.5 text-slate-700">{d.description}</td>
                                <td className="px-2 py-1.5 text-center font-mono">{d.qty}</td>
                                <td className="px-3 py-1.5 text-right font-mono text-slate-500">{formatGHS(d.price)}</td>
                                <td className="px-3 py-1.5 text-right font-mono font-semibold text-emerald-600">{formatGHS(d.amount)}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot><tr className="bg-slate-100 font-bold"><td colSpan={3} className="px-3 py-2 text-slate-700">Month Total</td><td className="px-2 py-2 text-center font-mono">{m.totals.qty}</td><td></td><td className="px-3 py-2 text-right font-mono text-emerald-700">{formatGHS(m.totals.amount)}</td></tr></tfoot>
                        </table>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ===== Profit & Loss ===== */}
            {activeReport === "profit-loss" && (
              <div className="space-y-4">
                <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 overflow-hidden">
                  <div className="px-5 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-slate-200"><span className="text-sm font-bold text-slate-700">Profit & Loss Statement</span></div>
                  <div className="mobile-scroll-x">
                  <table className="w-full text-sm">
                    <tbody className="divide-y divide-slate-100">
                      <tr><td className="px-5 py-3 font-bold text-slate-700 bg-slate-50" colSpan={2}>Revenue</td></tr>
                      <tr><td className="px-5 py-2.5 pl-8 text-slate-600">Sales Revenue</td><td className="px-5 py-2.5 text-right font-mono text-emerald-600">{formatGHS(pnlData.revenue)}</td></tr>
                      <tr><td className="px-5 py-3 font-bold text-slate-700 bg-slate-50" colSpan={2}>Cost of Goods Sold</td></tr>
                      <tr><td className="px-5 py-2.5 pl-8 text-slate-600">COGS</td><td className="px-5 py-2.5 text-right font-mono text-rose-600">({formatGHS(pnlData.cogs)})</td></tr>
                      <tr className="bg-blue-50"><td className="px-5 py-3 font-bold text-slate-800">Gross Profit</td><td className="px-5 py-3 text-right font-mono font-bold text-blue-700">{formatGHS(pnlData.grossProfit)}</td></tr>
                      <tr><td className="px-5 py-3 font-bold text-slate-700 bg-slate-50" colSpan={2}>Operating Expenses</td></tr>
                      <tr><td className="px-5 py-2.5 pl-8 text-slate-600">Estimated Overhead (2% of inventory)</td><td className="px-5 py-2.5 text-right font-mono text-rose-600">({formatGHS(pnlData.operatingExpenses)})</td></tr>
                      <tr className="bg-emerald-50"><td className="px-5 py-3 font-bold text-slate-800">Net Profit</td><td className="px-5 py-3 text-right font-mono font-bold text-emerald-700 text-base">{formatGHS(pnlData.netProfit)}</td></tr>
                      <tr><td className="px-5 py-2.5 text-slate-500 italic">Profit Margin</td><td className="px-5 py-2.5 text-right font-mono text-slate-500">{pnlData.margin.toFixed(1)}%</td></tr>
                    </tbody>
                  </table>
                  </div>
                </div>
              </div>
            )}

            {/* ===== VAT Tax Report ===== */}
            {activeReport === "vat-tax" && (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="rounded-2xl p-4 bg-amber-50 ring-1 ring-amber-200"><div className="text-xs font-bold text-amber-700 uppercase mb-1">Taxable Revenue</div><div className="text-xl font-bold font-mono text-slate-800">{formatGHS(vatData.taxableRevenue)}</div></div>
                  <div className="rounded-2xl p-4 bg-slate-50 ring-1 ring-slate-200"><div className="text-xs font-bold text-slate-500 uppercase mb-1">Non-Taxable</div><div className="text-xl font-bold font-mono text-slate-600">{formatGHS(vatData.nonTaxableRevenue)}</div></div>
                  <div className="rounded-2xl p-4 bg-emerald-50 ring-1 ring-emerald-200"><div className="text-xs font-bold text-emerald-700 uppercase mb-1">VAT Collected (15%)</div><div className="text-xl font-bold font-mono text-emerald-700">{formatGHS(vatData.vatCollected)}</div></div>
                </div>
                <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 overflow-hidden">
                  <div className="px-5 py-3 bg-amber-50 border-b border-amber-100"><span className="text-sm font-bold text-slate-700">VAT Breakdown</span></div>
                  <div className="mobile-scroll-x">
                  <table className="w-full text-sm">
                    <thead><tr className="bg-slate-100 text-xs uppercase text-slate-600"><th className="text-left px-4 py-2">Category</th><th className="text-center px-4 py-2">Items</th><th className="text-right px-4 py-2">Revenue</th><th className="text-right px-4 py-2">VAT Rate</th><th className="text-right px-4 py-2">VAT Amount</th></tr></thead>
                    <tbody className="divide-y divide-slate-100">
                      <tr><td className="px-4 py-2.5 font-medium text-slate-700">Taxable Items</td><td className="px-4 py-2.5 text-center font-mono">{vatData.taxableCount}</td><td className="px-4 py-2.5 text-right font-mono text-emerald-600">{formatGHS(vatData.taxableRevenue)}</td><td className="px-4 py-2.5 text-right font-mono">15%</td><td className="px-4 py-2.5 text-right font-mono font-bold text-amber-600">{formatGHS(vatData.vatCollected)}</td></tr>
                      <tr><td className="px-4 py-2.5 font-medium text-slate-700">Non-Taxable Items</td><td className="px-4 py-2.5 text-center font-mono">{vatData.nonTaxableCount}</td><td className="px-4 py-2.5 text-right font-mono text-slate-500">{formatGHS(vatData.nonTaxableRevenue)}</td><td className="px-4 py-2.5 text-right font-mono">0%</td><td className="px-4 py-2.5 text-right font-mono text-slate-400">—</td></tr>
                      <tr className="bg-slate-50 font-bold"><td className="px-4 py-3 text-slate-800">Total</td><td className="px-4 py-3 text-center font-mono">{vatData.taxableCount + vatData.nonTaxableCount}</td><td className="px-4 py-3 text-right font-mono text-slate-800">{formatGHS(vatData.taxableRevenue + vatData.nonTaxableRevenue)}</td><td className="px-4 py-3"></td><td className="px-4 py-3 text-right font-mono text-amber-700">{formatGHS(vatData.vatCollected)}</td></tr>
                    </tbody>
                  </table>
                  </div>
                </div>
              </div>
            )}

            {/* ===== Stock Value Report ===== */}
            {activeReport === "stock-value" && (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="rounded-2xl p-4 bg-cyan-50 ring-1 ring-cyan-200"><div className="text-xs font-bold text-cyan-700 uppercase mb-1">Total Stock Value (Retail)</div><div className="text-xl font-bold font-mono text-slate-800">{formatGHS(stockValue)}</div></div>
                  <div className="rounded-2xl p-4 bg-rose-50 ring-1 ring-rose-200"><div className="text-xs font-bold text-rose-700 uppercase mb-1">Total Stock Cost</div><div className="text-xl font-bold font-mono text-slate-800">{formatGHS(stockCost)}</div></div>
                  <div className="rounded-2xl p-4 bg-emerald-50 ring-1 ring-emerald-200"><div className="text-xs font-bold text-emerald-700 uppercase mb-1">Potential Profit</div><div className="text-xl font-bold font-mono text-emerald-700">{formatGHS(potentialProfit)}</div></div>
                </div>
                <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 overflow-hidden">
                  <div className="px-5 py-3 bg-cyan-50 border-b border-cyan-100"><span className="text-sm font-bold text-slate-700">Stock Value by Product ({products.length} items)</span></div>
                  <div className="max-h-96 overflow-auto" style={{ scrollbarWidth: 'thin' }}>
                    <div className="mobile-scroll-x">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0"><tr className="bg-slate-800 text-white text-xs uppercase"><th className="text-left px-4 py-2">Product</th><th className="text-center px-3 py-2">Stock</th><th className="text-right px-3 py-2">Cost</th><th className="text-right px-3 py-2">Price</th><th className="text-right px-4 py-2">Stock Value</th></tr></thead>
                      <tbody className="divide-y divide-slate-100">
                        {products.map((p, i) => (
                          <tr key={p.id} className={i % 2 === 1 ? 'bg-slate-50/50' : 'bg-white'}><td className="px-4 py-2"><span className="text-lg mr-1">{p.emoji}</span><span className="font-medium text-slate-700">{p.name}</span></td><td className="px-3 py-2 text-center font-mono">{p.stock}</td><td className="px-3 py-2 text-right font-mono text-slate-500">{formatGHS(p.costPrice)}</td><td className="px-3 py-2 text-right font-mono text-emerald-600">{formatGHS(p.price)}</td><td className="px-4 py-2 text-right font-mono font-semibold text-slate-800">{formatGHS(p.price * p.stock)}</td></tr>
                        ))}
                      </tbody>
                      <tfoot><tr className="bg-slate-100 font-bold"><td className="px-4 py-3 text-slate-800" colSpan={4}>Total Stock Value</td><td className="px-4 py-3 text-right font-mono text-cyan-700 text-base">{formatGHS(stockValue)}</td></tr></tfoot>
                    </table>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ===== Cost Price Report ===== */}
            {activeReport === "cost-price" && (
              <div className="space-y-4">
                <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 overflow-hidden">
                  <div className="px-5 py-3 bg-purple-50 border-b border-purple-100"><span className="text-sm font-bold text-slate-700">Cost Price Analysis ({products.length} products)</span></div>
                  <div className="max-h-96 overflow-auto" style={{ scrollbarWidth: 'thin' }}>
                    <div className="mobile-scroll-x">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0"><tr className="bg-slate-800 text-white text-xs uppercase"><th className="text-left px-4 py-2">Product</th><th className="text-right px-3 py-2">Cost</th><th className="text-right px-3 py-2">Price</th><th className="text-right px-3 py-2">Markup</th><th className="text-right px-3 py-2">Margin %</th><th className="text-right px-4 py-2">Profit/Unit</th></tr></thead>
                      <tbody className="divide-y divide-slate-100">
                        {products.map((p, i) => {
                          const markup = p.costPrice > 0 ? ((p.price - p.costPrice) / p.costPrice) * 100 : 0;
                          const margin = p.price > 0 ? ((p.price - p.costPrice) / p.price) * 100 : 0;
                          return (
                            <tr key={p.id} className={i % 2 === 1 ? 'bg-slate-50/50' : 'bg-white'}><td className="px-4 py-2"><span className="text-lg mr-1">{p.emoji}</span><span className="font-medium text-slate-700">{p.name}</span></td><td className="px-3 py-2 text-right font-mono text-rose-600">{formatGHS(p.costPrice)}</td><td className="px-3 py-2 text-right font-mono text-emerald-600">{formatGHS(p.price)}</td><td className="px-3 py-2 text-right font-mono text-slate-600">{markup.toFixed(1)}%</td><td className="px-3 py-2 text-right font-mono"><span className={cn("font-semibold", margin > 30 ? "text-emerald-600" : margin > 15 ? "text-amber-600" : "text-rose-600")}>{margin.toFixed(1)}%</span></td><td className="px-4 py-2 text-right font-mono font-semibold text-blue-600">{formatGHS(p.price - p.costPrice)}</td></tr>
                          );
                        })}
                      </tbody>
                    </table>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ===== Stock Performance ===== */}
            {activeReport === "stock-performance" && (
              <div className="space-y-4">
                <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 overflow-hidden">
                  <div className="px-5 py-3 bg-rose-50 border-b border-rose-100"><span className="text-sm font-bold text-slate-700">Top 20 Products by Revenue</span></div>
                  <div className="max-h-96 overflow-auto" style={{ scrollbarWidth: 'thin' }}>
                    <div className="mobile-scroll-x">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0"><tr className="bg-slate-800 text-white text-xs uppercase"><th className="text-left px-4 py-2">#</th><th className="text-left px-3 py-2">Product</th><th className="text-center px-3 py-2">Sold</th><th className="text-right px-3 py-2">Revenue</th><th className="text-right px-3 py-2">Cost</th><th className="text-right px-3 py-2">Profit</th><th className="text-center px-4 py-2">Turnover</th></tr></thead>
                      <tbody className="divide-y divide-slate-100">
                        {stockPerfData.map((d, i) => (
                          <tr key={d.product.id} className={i % 2 === 1 ? 'bg-slate-50/50' : 'bg-white'}><td className="px-4 py-2 text-center font-bold text-slate-400">{i + 1}</td><td className="px-3 py-2"><span className="text-lg mr-1">{d.product.emoji}</span><span className="font-medium text-slate-700">{d.product.name}</span></td><td className="px-3 py-2 text-center font-mono">{d.sold}</td><td className="px-3 py-2 text-right font-mono text-emerald-600">{formatGHS(d.revenue)}</td><td className="px-3 py-2 text-right font-mono text-rose-500">{formatGHS(d.cost)}</td><td className="px-3 py-2 text-right font-mono font-semibold text-blue-600">{formatGHS(d.profit)}</td><td className="px-4 py-2 text-center font-mono text-slate-500">{d.turnover.toFixed(2)}x</td></tr>
                        ))}
                      </tbody>
                    </table>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ===== Stock Group Report ===== */}
            {activeReport === "stock-group" && (
              <div className="space-y-4">
                {/* Summary stat cards */}
                <div className="grid grid-cols-4 gap-4">
                  <div className="rounded-2xl p-4 bg-indigo-50 ring-1 ring-indigo-200"><div className="text-xs font-bold text-indigo-700 uppercase mb-1">Total Groups</div><div className="text-xl font-bold font-mono text-slate-800">{stockGroupData.length}</div></div>
                  <div className="rounded-2xl p-4 bg-cyan-50 ring-1 ring-cyan-200"><div className="text-xs font-bold text-cyan-700 uppercase mb-1">Total Stock Value</div><div className="text-xl font-bold font-mono text-slate-800">{formatGHS(stockGroupData.reduce((s, d) => s + d.stockValue, 0))}</div></div>
                  <div className="rounded-2xl p-4 bg-rose-50 ring-1 ring-rose-200"><div className="text-xs font-bold text-rose-700 uppercase mb-1">Low Stock Items</div><div className="text-xl font-bold font-mono text-rose-600">{stockGroupData.reduce((s, d) => s + d.lowStock, 0)}</div></div>
                  <div className="rounded-2xl p-4 bg-emerald-50 ring-1 ring-emerald-200"><div className="text-xs font-bold text-emerald-700 uppercase mb-1">Potential Profit</div><div className="text-xl font-bold font-mono text-emerald-700">{formatGHS(stockGroupData.reduce((s, d) => s + d.potentialProfit, 0))}</div></div>
                </div>
                {/* Group table */}
                <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 overflow-hidden">
                  <div className="px-5 py-3 bg-indigo-50 border-b border-indigo-100"><span className="text-sm font-bold text-slate-700">Stock Group Analysis ({stockGroupData.length} groups)</span></div>
                  <div className="mobile-scroll-x">
                  <table className="w-full text-sm">
                    <thead><tr className="bg-slate-800 text-white text-xs uppercase"><th className="text-left px-4 py-2">Group</th><th className="text-center px-3 py-2">Items</th><th className="text-center px-3 py-2">Stock</th><th className="text-center px-3 py-2">Low</th><th className="text-center px-3 py-2">Out</th><th className="text-right px-3 py-2">Stock Cost</th><th className="text-right px-3 py-2">Stock Value</th><th className="text-right px-4 py-2">Profit</th></tr></thead>
                    <tbody className="divide-y divide-slate-100">
                      {stockGroupData.map((d, i) => (
                        <tr key={d.group.id} className={i % 2 === 1 ? 'bg-slate-50/50' : 'bg-white'}>
                          <td className="px-4 py-2.5"><span className="text-lg mr-1">{d.group.icon}</span><span className="font-medium text-slate-700">{d.group.name}</span></td>
                          <td className="px-3 py-2.5 text-center font-mono">{d.itemCount}</td>
                          <td className="px-3 py-2.5 text-center font-mono">{d.totalStock}</td>
                          <td className="px-3 py-2.5 text-center font-mono text-amber-600">{d.lowStock}</td>
                          <td className="px-3 py-2.5 text-center font-mono text-rose-600">{d.outOfStock}</td>
                          <td className="px-3 py-2.5 text-right font-mono text-rose-500">{formatGHS(d.stockCost)}</td>
                          <td className="px-3 py-2.5 text-right font-mono text-emerald-600">{formatGHS(d.stockValue)}</td>
                          <td className="px-4 py-2.5 text-right font-mono font-semibold text-blue-600">{formatGHS(d.potentialProfit)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-100 font-bold">
                        <td className="px-4 py-3 text-slate-800">Total</td>
                        <td className="px-3 py-3 text-center font-mono">{stockGroupData.reduce((s, d) => s + d.itemCount, 0)}</td>
                        <td className="px-3 py-3 text-center font-mono">{stockGroupData.reduce((s, d) => s + d.totalStock, 0)}</td>
                        <td className="px-3 py-3 text-center font-mono text-amber-600">{stockGroupData.reduce((s, d) => s + d.lowStock, 0)}</td>
                        <td className="px-3 py-3 text-center font-mono text-rose-600">{stockGroupData.reduce((s, d) => s + d.outOfStock, 0)}</td>
                        <td className="px-3 py-3 text-right font-mono text-rose-600">{formatGHS(stockGroupData.reduce((s, d) => s + d.stockCost, 0))}</td>
                        <td className="px-3 py-3 text-right font-mono text-emerald-600">{formatGHS(stockGroupData.reduce((s, d) => s + d.stockValue, 0))}</td>
                        <td className="px-4 py-3 text-right font-mono text-blue-700">{formatGHS(stockGroupData.reduce((s, d) => s + d.potentialProfit, 0))}</td>
                      </tr>
                    </tfoot>
                  </table>
                  </div>
                </div>
              </div>
            )}

            {/* ===== General Ledger ===== */}
            {activeReport === "general-ledger" && (
              <div className="space-y-4">
                <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 overflow-hidden">
                  <div className="px-5 py-3 bg-indigo-50 border-b border-indigo-100 flex items-center justify-between"><span className="text-sm font-bold text-slate-700">General Ledger ({ledgerEntries.length} entries)</span></div>
                  <div className="max-h-96 overflow-auto" style={{ scrollbarWidth: 'thin' }}>
                    <div className="mobile-scroll-x">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0"><tr className="bg-slate-800 text-white text-xs uppercase"><th className="text-left px-4 py-2">Date</th><th className="text-left px-3 py-2">Account</th><th className="text-left px-3 py-2">Description</th><th className="text-left px-3 py-2">Ref</th><th className="text-right px-3 py-2">Debit</th><th className="text-right px-4 py-2">Credit</th></tr></thead>
                      <tbody className="divide-y divide-slate-100">
                        {ledgerEntries.slice(0, 100).map((e, i) => (
                          <tr key={i} className={i % 2 === 1 ? 'bg-slate-50/50' : 'bg-white'}><td className="px-4 py-2 text-xs text-slate-500">{new Date(e.date).toLocaleDateString('en-GB')}</td><td className="px-3 py-2 font-medium text-slate-700">{e.account}</td><td className="px-3 py-2 text-slate-600 text-xs truncate max-w-xs">{e.description}</td><td className="px-3 py-2 text-xs font-mono text-slate-400">{e.ref}</td><td className="px-3 py-2 text-right font-mono text-slate-600">{e.debit > 0 ? formatGHS(e.debit) : '—'}</td><td className="px-4 py-2 text-right font-mono text-slate-600">{e.credit > 0 ? formatGHS(e.credit) : '—'}</td></tr>
                        ))}
                      </tbody>
                    </table>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ===== Trial Balance ===== */}
            {activeReport === "trial-balance" && (
              <div className="space-y-4">
                <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 overflow-hidden">
                  <div className="px-5 py-3 bg-teal-50 border-b border-teal-100"><span className="text-sm font-bold text-slate-700">Trial Balance</span></div>
                  <div className="mobile-scroll-x">
                  <table className="w-full text-sm">
                    <thead><tr className="bg-slate-800 text-white text-xs uppercase"><th className="text-left px-4 py-2">Account</th><th className="text-right px-4 py-2">Debit (GHC)</th><th className="text-right px-4 py-2">Credit (GHC)</th></tr></thead>
                    <tbody className="divide-y divide-slate-100">
                      {trialBalance.rows.map((r, i) => (
                        <tr key={i} className={i % 2 === 1 ? 'bg-slate-50/50' : 'bg-white'}><td className="px-4 py-2.5 font-medium text-slate-700">{r.account}</td><td className="px-4 py-2.5 text-right font-mono text-slate-600">{r.debit > 0 ? formatGHS(r.debit) : '—'}</td><td className="px-4 py-2.5 text-right font-mono text-slate-600">{r.credit > 0 ? formatGHS(r.credit) : '—'}</td></tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-100 font-bold"><td className="px-4 py-3 text-slate-800">Total</td><td className="px-4 py-3 text-right font-mono text-teal-700 text-base">{formatGHS(trialBalance.totalDebit)}</td><td className="px-4 py-3 text-right font-mono text-teal-700 text-base">{formatGHS(trialBalance.totalCredit)}</td></tr>
                      <tr><td className="px-4 py-2 text-xs text-slate-400 italic" colSpan={3}>{trialBalance.totalDebit === trialBalance.totalCredit ? '✓ Balanced' : '⚠ Not balanced — check entries'}</td></tr>
                    </tfoot>
                  </table>
                  </div>
                </div>
              </div>
            )}

          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
