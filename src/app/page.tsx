'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, ShoppingCart, Trash2, Plus, Minus, X, Printer, CreditCard,
  Banknote, Wallet, Check, Package, Percent, User, Clock, Calendar,
  ChevronRight, ScanLine, Pause, Play, RotateCcw, DollarSign, Receipt,
  ShoppingCart as Cart, Settings, Bell, LogOut, Menu as MenuIcon,
  TrendingUp, BarChart3, Tag, AlertCircle, CheckCircle2, ArrowLeft,
  Zap, Store, Hash, Boxes, FileBarChart, ChevronDown, FileText, Eye,
  Layers, ArrowUpDown, History, FileSpreadsheet, Home, Power,
  Phone, Truck, Users, Database, Wrench, Shield,
  FileBarChart2, BookOpen, PhoneCall, Archive, Settings2, Lock,
  FileSearch, Copy, Image as ImageIcon, Tags,
  Smartphone,
} from "lucide-react";
import {
  products as INITIAL_PRODUCTS, categories, paymentMethods, quickCashAmounts,
  TAX_RATE, TAX_NAME, COMPANY, CURRENCY, CURRENCY_CODE, formatGHS,
  stockGroups as INITIAL_GROUPS, initialStockHistory,
  type Product, type StockGroup, type StockHistoryEntry,
} from "@/lib/pos-data";
import type { CartItem, PaymentResult, ViewMode } from "@/lib/pos-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { initialSuppliers } from "@/components/supplier-form";
import { InstallButton } from "@/components/install-button";

// ===== Lazy-loaded components (code-split for faster initial load) =====
// Each form is loaded on-demand only when the user navigates to it.
// This keeps the initial POS page bundle small and fast.
const loadingFallback = () => (
  <div className="h-screen flex flex-col items-center justify-center bg-slate-50 gap-3">
    <div className="h-10 w-10 rounded-full border-4 border-slate-200 border-t-emerald-600 animate-spin" />
    <div className="text-sm font-semibold text-slate-500">Loading…</div>
  </div>
);

const StockManagement = dynamic(() => import("@/components/stock-management").then(m => ({ default: m.StockManagement })), { ssr: false, loading: loadingFallback });
const Reports = dynamic(() => import("@/components/reports").then(m => ({ default: m.Reports })), { ssr: false, loading: loadingFallback });
const PurchaseMenu = dynamic(() => import("@/components/purchase-menu").then(m => ({ default: m.PurchaseMenu })), { ssr: false, loading: loadingFallback });
const TelephoneModule = dynamic(() => import("@/components/telephone-module").then(m => ({ default: m.TelephoneModule })), { ssr: false, loading: loadingFallback });
const TelephoneDirectory = dynamic(() => import("@/components/telephone-directory").then(m => ({ default: m.TelephoneDirectory })), { ssr: false, loading: loadingFallback });
const MaintenanceModule = dynamic(() => import("@/components/maintenance-module").then(m => ({ default: m.MaintenanceModule })), { ssr: false, loading: loadingFallback });
const SoldItemsReport = dynamic(() => import("@/components/sold-items-report").then(m => ({ default: m.SoldItemsReport })), { ssr: false, loading: loadingFallback });
const PurchaseForm = dynamic(() => import("@/components/purchase-form").then(m => ({ default: m.PurchaseForm })), { ssr: false, loading: loadingFallback });
const SalesMenu = dynamic(() => import("@/components/sales-menu").then(m => ({ default: m.SalesMenu })), { ssr: false, loading: loadingFallback });
const DailySalesReport = dynamic(() => import("@/components/sales-reports").then(m => ({ default: m.DailySalesReport })), { ssr: false, loading: loadingFallback });
const SalesHistory = dynamic(() => import("@/components/sales-reports").then(m => ({ default: m.SalesHistory })), { ssr: false, loading: loadingFallback });
const SupplierForm = dynamic(() => import("@/components/supplier-form").then(m => ({ default: m.SupplierForm })), { ssr: false, loading: loadingFallback });
const AccountsReports = dynamic(() => import("@/components/accounts-reports").then(m => ({ default: m.AccountsReports })), { ssr: false, loading: loadingFallback });
const FinancialOperations = dynamic(() => import("@/components/financial-operations").then(m => ({ default: m.FinancialOperations })), { ssr: false, loading: loadingFallback });
const AdminLogin = dynamic(() => import("@/components/admin-panel").then(m => ({ default: m.AdminLogin })), { ssr: false, loading: loadingFallback });
const AdminPanel = dynamic(() => import("@/components/admin-panel").then(m => ({ default: m.AdminPanel })), { ssr: false, loading: loadingFallback });
const OperationsDashboard = dynamic(() => import("@/components/operations-dashboard").then(m => ({ default: m.OperationsDashboard })), { ssr: false, loading: loadingFallback });
const ReceiptArchive = dynamic(() => import("@/components/receipt-archive").then(m => ({ default: m.ReceiptArchive })), { ssr: false, loading: loadingFallback });
const SyncSettings = dynamic(() => import("@/components/sync-settings").then(m => ({ default: m.SyncSettings })), { ssr: false, loading: loadingFallback });

export default function POSPage() {
  // ===== Top-level View State =====
  const [view, setView] = useState<ViewMode>("login");
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  // ===== Shared Data State (persisted to localStorage) =====
  const [products, setProducts] = useState<Product[]>(() => {
    if (typeof window !== 'undefined') {
      try { const cached = localStorage.getItem('sylhn-products'); if (cached) return JSON.parse(cached); } catch {}
    }
    return INITIAL_PRODUCTS;
  });
  const [groups, setGroups] = useState<StockGroup[]>(() => {
    if (typeof window !== 'undefined') {
      try { const cached = localStorage.getItem('sylhn-groups'); if (cached) return JSON.parse(cached); } catch {}
    }
    return INITIAL_GROUPS;
  });
  const [history, setHistory] = useState<StockHistoryEntry[]>(() => {
    if (typeof window !== 'undefined') {
      try { const cached = localStorage.getItem('sylhn-history'); if (cached) return JSON.parse(cached); } catch {}
    }
    return initialStockHistory;
  });

  // ===== POS State =====
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCartIndex, setSelectedCartIndex] = useState<number | null>(null);
  const [keypadInput, setKeypadInput] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState<string | null>(null);
  const [cashier] = useState("Sarah Johnson");
  const [now, setNow] = useState<Date | null>(null);
  const [heldOrders, setHeldOrders] = useState<{ items: CartItem[]; customer: string; invoice: string }[]>(() => {
    if (typeof window !== 'undefined') { try { const c = localStorage.getItem('sylhn-held-orders'); if (c) return JSON.parse(c); } catch {} }
    return [];
  });
  const [showPayment, setShowPayment] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastPayment, setLastPayment] = useState<PaymentResult | null>(null);
  const [globalDiscount, setGlobalDiscount] = useState(0);
  const [showCashDrawer, setShowCashDrawer] = useState(false);
  const [lowStockNotified, setLowStockNotified] = useState<Set<string>>(new Set());
  const [scannerMode, setScannerMode] = useState(false);
  const [dailyTotal, setDailyTotal] = useState(() => {
    if (typeof window !== 'undefined') { try { return parseFloat(localStorage.getItem('sylhn-daily-total') || '0') || 0; } catch {} }
    return 0;
  });
  const [transactionCount, setTransactionCount] = useState(() => {
    if (typeof window !== 'undefined') { try { return parseInt(localStorage.getItem('sylhn-txn-count') || '0') || 0; } catch {} }
    return 0;
  });
  const [activeKeypadMode, setActiveKeypadMode] = useState<"qty" | "price" | "barcode">("qty");
  const [showSidebar, setShowSidebar] = useState(true);
  const [showFindProduct, setShowFindProduct] = useState(false);
  const [showCartPreview, setShowCartPreview] = useState(false);
  const [initialStockView, setInitialStockView] = useState<"stock-file" | "stock-search" | "add-modify" | "group-maintenance" | "quantity-adjustment" | "history">("stock-file");
  const [openStockQtyReport, setOpenStockQtyReport] = useState(false);
  const [showStockList, setShowStockList] = useState(false);
  const [partNoInput, setPartNoInput] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [accountsReport, setAccountsReport] = useState<"daily-sales" | "daily-sales-detail" | "monthly-summary" | "monthly-detail" | "profit-loss" | "vat-tax" | "stock-value" | "cost-price" | "stock-performance" | "stock-group" | "general-ledger" | "trial-balance">("daily-sales");
  const [financeTab, setFinanceTab] = useState<"expenses" | "cash-recon" | "mobile-money">("expenses");
  const [adminUser, setAdminUser] = useState<any>(null);
  const [loggedInUser, setLoggedInUser] = useState<any>(null);

  const { toast } = useToast();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // ===== Persist all critical state to localStorage =====
  useEffect(() => { try { localStorage.setItem('sylhn-products', JSON.stringify(products)); } catch {} }, [products]);
  useEffect(() => { try { localStorage.setItem('sylhn-groups', JSON.stringify(groups)); } catch {} }, [groups]);
  useEffect(() => { try { localStorage.setItem('sylhn-history', JSON.stringify(history)); } catch {} }, [history]);
  useEffect(() => { try { localStorage.setItem('sylhn-held-orders', JSON.stringify(heldOrders)); } catch {} }, [heldOrders]);
  useEffect(() => { try { localStorage.setItem('sylhn-daily-total', String(dailyTotal)); } catch {} }, [dailyTotal]);
  useEffect(() => { try { localStorage.setItem('sylhn-txn-count', String(transactionCount)); } catch {} }, [transactionCount]);

  // ===== Effects =====
  // Initialize client-only values to avoid hydration mismatch.
  // Math.random() and new Date() produce different values on server vs client,
  // so we must defer their initialization to the client side.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setInvoiceNumber(generateInvoice());
    setNow(new Date());
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  // ===== Cross-device session restore =====
  // On page load, check if there's a valid server session (httpOnly cookie)
  // OR a cached localStorage session. This makes login seamless across
  // mobile and PC — if you're logged in on one device and open the app on
  // another (with the same server), you stay logged in.
  useEffect(() => {
    let cancelled = false;
    const restoreSession = async () => {
      // First, try the server session (httpOnly cookie — most secure)
      try {
        const res = await fetch('/api/auth/me', { credentials: 'include' });
        if (!cancelled && res.ok) {
          const data = await res.json();
          if (data.user) {
            // Server session is valid — restore it
            setLoggedInUser(data.user);
            setView("pos");
            return;
          }
        }
      } catch { /* server unreachable — fall through to local */ }

      // Fallback: check localStorage for a cached session (offline mode)
      if (cancelled) return;
      try {
        const cached = localStorage.getItem('sylhn-current-user');
        if (cached) {
          const user = JSON.parse(cached);
          if (user && user.username) {
            setLoggedInUser(user);
            setView("pos");
            return;
          }
        }
      } catch { /* ignore */ }

      // No session found — stay on login screen
    };
    restoreSession();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!now) return;
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, [now]);

  // Close menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ===== Background Stocktake Overdue Check =====
  // Runs every 5 minutes while the app is open. Checks if a stocktake is overdue
  // based on the configured schedule. If newly overdue (not previously notified),
  // fires a browser notification + optional email/SMS via mailto:/sms:.
  useEffect(() => {
    const SCHEDULE_KEY = 'sylhn-stocktake-schedule';
    const NOTIFY_KEY = 'sylhn-stocktake-notifications';
    const NOTIFIED_KEY = 'sylhn-stocktake-last-notified';

    const checkOverdue = () => {
      if (typeof window === 'undefined') return;

      // Load schedule settings
      let scheduleFreq: 'weekly' | 'biweekly' | 'monthly' | 'quarterly' = 'weekly';
      try {
        const cached = window.localStorage.getItem(SCHEDULE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed.freq) scheduleFreq = parsed.freq;
        }
      } catch { /* ignore */ }

      // Find the most recent stocktake (action='adjusted')
      const adjustedEntries = history.filter(h => h.action === 'adjusted');
      let lastDate: Date | null = null;
      let lastReference: string | null = null;

      if (adjustedEntries.length > 0) {
        const sorted = [...adjustedEntries].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
        lastDate = new Date(sorted[0].timestamp);
        lastReference = sorted[0].reference || null;
      }

      const now = new Date();
      const thresholdDays = scheduleFreq === 'weekly' ? 7 : scheduleFreq === 'biweekly' ? 14 : scheduleFreq === 'monthly' ? 30 : 90;

      let isOverdue = false;
      let daysOverdue = 0;
      let nextDueDate = '';

      if (lastDate) {
        const diffDays = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
        isOverdue = diffDays >= thresholdDays;
        daysOverdue = diffDays - thresholdDays;
        nextDueDate = new Date(lastDate.getTime() + thresholdDays * 86400000).toISOString().split('T')[0];
      } else {
        // No previous stocktake — treat as overdue
        isOverdue = true;
        daysOverdue = Math.floor((now.getTime() - new Date('2026-01-01').getTime()) / (1000 * 60 * 60 * 24));
        nextDueDate = now.toISOString().split('T')[0];
      }

      if (!isOverdue) return;

      // Check if we've already notified for this specific due date
      let lastNotified = '';
      try {
        lastNotified = window.localStorage.getItem(NOTIFIED_KEY) || '';
      } catch { /* ignore */ }

      if (lastNotified === nextDueDate) return; // already notified for this cycle

      // ===== Fire notification =====
      // 1. Browser notification (if permission granted)
      if ('Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification('Stocktake Overdue', {
            body: `Stocktake is ${daysOverdue} day(s) overdue. Last: ${lastReference || 'Never'}. Click to open Stock Management.`,
            icon: '/favicon.ico',
            tag: 'stocktake-overdue',
          });
        } catch { /* ignore */ }
      }

      // 2. Email/SMS (if enabled and recipients configured)
      let notifyEmails = '';
      let notifyPhones = '';
      let emailEnabled = true;
      let smsEnabled = false;
      try {
        const notifyCached = window.localStorage.getItem(NOTIFY_KEY);
        if (notifyCached) {
          const parsed = JSON.parse(notifyCached);
          notifyEmails = parsed.emails || '';
          notifyPhones = parsed.phones || '';
          emailEnabled = parsed.emailEnabled !== false;
          smsEnabled = parsed.smsEnabled === true;
        }
      } catch { /* ignore */ }

      const emails = notifyEmails.split(',').map(s => s.trim()).filter(Boolean);
      const phones = notifyPhones.split(',').map(s => s.trim()).filter(Boolean);

      // Only auto-send email if it's been more than 1 hour since the last notification
      // (to avoid spamming on every 5-min check cycle if the user doesn't dismiss)
      // We use the notified timestamp appended to the NOTIFIED_KEY value
      const notifiedParts = lastNotified.split('|');
      const lastNotifiedTime = notifiedParts[1] ? parseInt(notifiedParts[1]) : 0;
      const oneHour = 60 * 60 * 1000;
      const shouldSendEmail = (now.getTime() - lastNotifiedTime) > oneHour;

      if (shouldSendEmail) {
        const subject = encodeURIComponent(`[SYLHN POS] Stocktake Overdue — ${daysOverdue} day(s)`);
        const body = encodeURIComponent(
          `STOCKTAKE OVERDUE ALERT\n\n` +
          `Days overdue: ${daysOverdue}\n` +
          `Last stocktake: ${lastDate ? lastDate.toLocaleDateString('en-GB') : 'Never'}\n` +
          `Last reference: ${lastReference || '—'}\n` +
          `Schedule: ${scheduleFreq}\n` +
          `Next due date: ${nextDueDate}\n\n` +
          `This is an automatic alert from SYLHN POS. Please perform a stocktake as soon as possible.\n\n` +
          `— SYLHN COMPANY LTD`
        );

        if (emailEnabled && emails.length > 0) {
          // Open mailto in a new tab to avoid navigating away from the POS
          try {
            window.open(`mailto:${emails.join(',')}?subject=${subject}&body=${body}`, '_blank');
          } catch { /* ignore */ }
        }

        if (smsEnabled && phones.length > 0) {
          const smsBody = encodeURIComponent(`[SYLHN POS] Stocktake OVERDUE by ${daysOverdue} day(s). Last: ${lastReference || 'Never'}. Perform stocktake now.`);
          try {
            window.location.href = `sms:${phones[0]}?body=${smsBody}`;
          } catch { /* ignore */ }
        }
      }

      // Mark as notified for this due date (with timestamp)
      try {
        window.localStorage.setItem(NOTIFIED_KEY, `${nextDueDate}|${now.getTime()}`);
      } catch { /* ignore */ }
    };

    // ===== Check for critical variance alerts and notify =====
    // Reads the variance thresholds from localStorage, finds products whose latest
    // stocktake shrinkage exceeds 2× the threshold (critical), and fires a browser
    // notification + email. Tracks last-notified state to avoid spamming.
    const checkCriticalAlerts = () => {
      if (typeof window === 'undefined') return;

      // Load thresholds
      let globalThreshold = 5;
      let varianceThresholds: Record<string, number> = {};
      try {
        const cached = window.localStorage.getItem('sylhn-variance-thresholds');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (typeof parsed.global === 'number') globalThreshold = parsed.global;
          if (parsed.thresholds) varianceThresholds = parsed.thresholds;
        }
      } catch { /* ignore */ }

      // Find the latest 'adjusted' entry per product
      const productLatest = new Map<string, typeof history[number]>();
      history.forEach(h => {
        if (h.action !== 'adjusted') return;
        const existing = productLatest.get(h.productId);
        if (!existing || h.timestamp > existing.timestamp) {
          productLatest.set(h.productId, h);
        }
      });

      // Find critical alerts (shrinkage ≥ 2× threshold)
      const criticalAlerts: Array<{ productName: string; shrinkage: number; threshold: number; reference: string }> = [];
      productLatest.forEach(entry => {
        const shrinkage = Math.abs(Math.min(0, entry.quantityChange));
        if (shrinkage === 0) return;
        const thresholdPct = varianceThresholds[entry.productId] ?? globalThreshold;
        const thresholdUnits = (thresholdPct / 100) * Math.max(1, entry.newQuantity);
        if (shrinkage >= thresholdUnits * 2) {
          criticalAlerts.push({
            productName: entry.productName,
            shrinkage,
            threshold: thresholdUnits,
            reference: entry.reference || '',
          });
        }
      });

      if (criticalAlerts.length === 0) return;

      // Check if we've already notified for these alerts today
      const ALERT_NOTIFIED_KEY = 'sylhn-critical-alerts-last-notified';
      const today = new Date().toISOString().split('T')[0];
      let lastAlertNotified = '';
      try {
        lastAlertNotified = window.localStorage.getItem(ALERT_NOTIFIED_KEY) || '';
      } catch { /* ignore */ }

      if (lastAlertNotified === today) return; // already notified today

      // Fire browser notification
      if ('Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification('Critical Variance Alert', {
            body: `${criticalAlerts.length} product(s) have critical shrinkage. Worst: ${criticalAlerts[0].productName} (−${criticalAlerts[0].shrinkage} units). Click to review in Stocktake Dashboard.`,
            icon: '/favicon.ico',
            tag: 'critical-variance-alert',
          });
        } catch { /* ignore */ }
      }

      // Auto-send email if enabled
      let notifyEmails = '';
      let emailEnabled = true;
      try {
        const notifyCached = window.localStorage.getItem(NOTIFY_KEY);
        if (notifyCached) {
          const parsed = JSON.parse(notifyCached);
          notifyEmails = parsed.emails || '';
          emailEnabled = parsed.emailEnabled !== false;
        }
      } catch { /* ignore */ }

      const emails = notifyEmails.split(',').map(s => s.trim()).filter(Boolean);
      if (emailEnabled && emails.length > 0) {
        const subject = encodeURIComponent(`[SYLHN POS] Critical Variance Alert — ${criticalAlerts.length} product(s)`);
        const body = encodeURIComponent(
          `CRITICAL VARIANCE ALERT\n\n` +
          `${criticalAlerts.length} product(s) have shrinkage exceeding 2× their threshold:\n\n` +
          criticalAlerts.slice(0, 10).map((a, i) =>
            `${i + 1}. ${a.productName} — shrinkage: ${a.shrinkage} units (threshold: ${a.threshold.toFixed(1)})`
          ).join('\n') +
          (criticalAlerts.length > 10 ? `\n... and ${criticalAlerts.length - 10} more` : '') +
          `\n\nAction required: Review these products in the Stocktake Dashboard → Alerts tab.\n\n— SYLHN COMPANY LTD POS System`
        );
        try {
          window.open(`mailto:${emails.join(',')}?subject=${subject}&body=${body}`, '_blank');
        } catch { /* ignore */ }
      }

      // Mark as notified for today
      try {
        window.localStorage.setItem(ALERT_NOTIFIED_KEY, today);
      } catch { /* ignore */ }
    };

    // ===== Check if a digest should be sent =====
    const checkDigest = () => {
      if (typeof window === 'undefined') return;

      let digestEnabled = false;
      let digestFreq: 'daily' | 'weekly' = 'daily';
      let lastDigestSent = '';
      let notifyEmails = '';
      let emailEnabled = true;
      try {
        const cached = window.localStorage.getItem(NOTIFY_KEY);
        if (cached) {
          const parsed = JSON.parse(cached);
          digestEnabled = parsed.digestEnabled === true;
          digestFreq = parsed.digestFreq === 'weekly' ? 'weekly' : 'daily';
          lastDigestSent = parsed.lastDigestSent || '';
          notifyEmails = parsed.emails || '';
          emailEnabled = parsed.emailEnabled !== false;
        }
      } catch { /* ignore */ }

      if (!digestEnabled) return;

      const emails = notifyEmails.split(',').map(s => s.trim()).filter(Boolean);
      if (!emailEnabled || emails.length === 0) return;

      // Check if enough time has elapsed since the last digest
      const periodMs = digestFreq === 'daily' ? 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
      const lastSentTime = lastDigestSent ? new Date(lastDigestSent).getTime() : 0;
      if (Date.now() - lastSentTime < periodMs) return;

      // Build and send the digest
      const periodLabel = digestFreq === 'daily' ? '24 hours' : '7 days';
      const cutoff = new Date(Date.now() - periodMs);
      const adjustedEntries = history.filter(h => h.action === 'adjusted' && new Date(h.timestamp) >= cutoff);

      // Group by reference for event count
      const eventRefs = new Set<string>();
      adjustedEntries.forEach(h => { if (h.reference) eventRefs.add(h.reference); });
      const eventCount = eventRefs.size;
      const totalItems = adjustedEntries.length;
      const totalVariance = adjustedEntries.reduce((s, e) => s + e.quantityChange, 0);
      const surplusCount = adjustedEntries.filter(e => e.quantityChange > 0).length;
      const shortageCount = adjustedEntries.filter(e => e.quantityChange < 0).length;

      const subject = encodeURIComponent(`[SYLHN POS] Stocktake Digest — ${digestFreq === 'daily' ? 'Daily' : 'Weekly'} Summary`);
      const body = encodeURIComponent(
        `STOCKTAKE ACTIVITY DIGEST (${digestFreq === 'daily' ? 'Daily' : 'Weekly'})\n` +
        `Period: last ${periodLabel}\n` +
        `Generated: ${new Date().toLocaleString('en-GB')}\n\n` +
        `SUMMARY\n=======\n` +
        `Stocktake events: ${eventCount}\n` +
        `Items adjusted: ${totalItems}\n` +
        `Surplus items: ${surplusCount}\n` +
        `Shortage items: ${shortageCount}\n` +
        `Net variance: ${totalVariance > 0 ? '+' : ''}${totalVariance}\n\n` +
        `— SYLHN COMPANY LTD POS System (automatic digest)`
      );

      try {
        window.open(`mailto:${emails.join(',')}?subject=${subject}&body=${body}`, '_blank');
      } catch { /* ignore */ }

      // Update lastDigestSent
      try {
        const cached = window.localStorage.getItem(NOTIFY_KEY);
        if (cached) {
          const parsed = JSON.parse(cached);
          parsed.lastDigestSent = new Date().toISOString();
          window.localStorage.setItem(NOTIFY_KEY, JSON.stringify(parsed));
        }
      } catch { /* ignore */ }
    };

    // Request notification permission on mount
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => { /* ignore */ });
    }

    // Run immediately on mount, then every 5 minutes
    checkOverdue();
    checkCriticalAlerts();
    checkDigest();
    const interval = setInterval(() => {
      checkOverdue();
      checkCriticalAlerts();
      checkDigest();
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [history]);

  // ===== Computed =====
  const filteredProducts = useMemo(() => {
    let result = products;
    if (activeCategory !== "all") {
      result = result.filter(p => p.category === activeCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.barcode.includes(q)
      );
    }
    if (productSearch.trim()) {
      const q = productSearch.toLowerCase();
      result = result.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.barcode.includes(q) ||
        p.supplier.toLowerCase().includes(q)
      );
    }
    return result;
  }, [activeCategory, searchQuery, productSearch, products]);

  const subtotal = useMemo(() =>
    cart.reduce((sum, item) => {
      const lineTotal = item.price * item.quantity;
      const lineDiscount = lineTotal * (item.discount / 100);
      return sum + (lineTotal - lineDiscount);
    }, 0), [cart]);

  const discountAmount = useMemo(() =>
    cart.reduce((sum, item) => sum + (item.price * item.quantity * (item.discount / 100)), 0) +
    (subtotal * (globalDiscount / 100)), [cart, subtotal, globalDiscount]);

  const taxableAmount = useMemo(() =>
    cart.reduce((sum, item) => {
      if (!item.taxable) return sum;
      const lineTotal = item.price * item.quantity;
      const lineDiscount = lineTotal * (item.discount / 100);
      return sum + (lineTotal - lineDiscount);
    }, 0) - (subtotal * (globalDiscount / 100)), [cart, subtotal, globalDiscount]);

  const taxAmount = taxableAmount * TAX_RATE;
  const totalAfterDiscount = subtotal - (subtotal * (globalDiscount / 100));
  const total = totalAfterDiscount + taxAmount;
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

  // ===== Cart Actions =====
  const addToCart = useCallback((product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.productId === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) {
          toast({ title: "Stock limit reached", description: `Only ${product.stock} ${product.unit} of ${product.name} available`, variant: "destructive" });
          return prev;
        }
        return prev.map(item =>
          item.productId === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      if (product.stock <= 0) {
        toast({ title: "Out of stock", description: `${product.name} is unavailable`, variant: "destructive" });
        return prev;
      }
      if (product.stock <= product.reorderLevel && !lowStockNotified.has(product.id)) {
        toast({ title: "Low stock alert", description: `${product.name} has only ${product.stock} units left`, variant: "default" });
        setLowStockNotified(prev => new Set(prev).add(product.id));
      }
      return [...prev, {
        id: `${product.id}-${Date.now()}`,
        productId: product.id,
        sku: product.sku,
        name: product.name,
        price: product.price,
        quantity: 1,
        unit: product.unit,
        emoji: product.emoji,
        discount: 0,
        taxable: product.taxable,
        stock: product.stock,
      }];
    });
    toast({ title: "Added to cart", description: `${product.emoji} ${product.name}`, duration: 1500 });
  }, [lowStockNotified, toast]);

  const updateQuantity = (index: number, delta: number) => {
    setCart(prev => prev.map((item, i) => {
      if (i !== index) return item;
      const newQty = item.quantity + delta;
      if (newQty <= 0) return item;
      if (newQty > item.stock) {
        toast({ title: "Stock limit reached", variant: "destructive" });
        return item;
      }
      return { ...item, quantity: newQty };
    }));
  };

  const setQuantity = (index: number, qty: number) => {
    setCart(prev => prev.map((item, i) => {
      if (i !== index) return item;
      if (qty <= 0) return item;
      if (qty > item.stock) {
        toast({ title: "Stock limit reached", variant: "destructive" });
        return item;
      }
      return { ...item, quantity: qty };
    }));
  };

  const removeLine = (index: number) => {
    setCart(prev => prev.filter((_, i) => i !== index));
    setSelectedCartIndex(null);
    toast({ title: "Line removed", variant: "default" });
  };

  const applyDiscount = (index: number, discount: number) => {
    setCart(prev => prev.map((item, i) =>
      i === index ? { ...item, discount: Math.min(100, Math.max(0, discount)) } : item
    ));
  };

  const clearCart = () => {
    setCart([]);
    setSelectedCartIndex(null);
    setGlobalDiscount(0);
    setCustomerName("");
    setInvoiceNumber(generateInvoice());
  };

  // ===== Keypad =====
  const handleKeypadPress = (key: string) => {
    if (key === "C") { setKeypadInput(""); return; }
    if (key === "⌫") { setKeypadInput(prev => prev.slice(0, -1)); return; }
    if (key === "Enter") { handleKeypadEnter(); return; }
    if (key === "." && keypadInput.includes(".")) return;
    setKeypadInput(prev => prev + key);
  };

  const handleKeypadEnter = () => {
    const value = parseFloat(keypadInput);
    if (isNaN(value) && activeKeypadMode !== "barcode") {
      toast({ title: "Invalid input", variant: "destructive" });
      return;
    }
    if (activeKeypadMode === "qty" && selectedCartIndex !== null) {
      setQuantity(selectedCartIndex, value);
      toast({ title: `Quantity updated to ${value}` });
    } else if (activeKeypadMode === "price" && selectedCartIndex !== null) {
      setCart(prev => prev.map((item, i) =>
        i === selectedCartIndex ? { ...item, price: value } : item
      ));
      toast({ title: `Price updated to ${formatGHS(value)}` });
    } else if (activeKeypadMode === "barcode") {
      const product = products.find(p => p.barcode === keypadInput || p.sku === keypadInput);
      if (product) {
        addToCart(product);
      } else {
        toast({ title: "Product not found", description: `No item with code ${keypadInput}`, variant: "destructive" });
      }
    }
    setKeypadInput("");
  };

  // ===== Function Buttons =====
  const handleSave = () => {
    if (cart.length === 0) {
      toast({ title: "Cart is empty", variant: "destructive" });
      return;
    }
    setHeldOrders(prev => [...prev, { items: cart, customer: customerName, invoice: invoiceNumber || '' }]);
    clearCart();
    toast({ title: "Order saved (F2)", description: `${heldOrders.length + 1} order(s) on hold` });
  };

  const handlePrint = () => {
    if (cart.length === 0) {
      toast({ title: "Nothing to print", variant: "destructive" });
      return;
    }
    toast({ title: "Printing receipt (F3)", description: `Invoice ${invoiceNumber}` });
  };

  const handleVoid = () => {
    if (cart.length === 0) {
      toast({ title: "Cart already empty", variant: "destructive" });
      return;
    }
    clearCart();
    toast({ title: "Transaction voided (F4)", variant: "default" });
  };

  const handlePay = () => {
    if (cart.length === 0) {
      toast({ title: "Cart is empty", variant: "destructive" });
      return;
    }
    setShowPayment(true);
  };

  const handleOpenCash = () => {
    setShowCashDrawer(true);
    setTimeout(() => setShowCashDrawer(false), 2000);
    toast({ title: "Cash drawer opened", description: "Register #1 - Drawer 01" });
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return;
      if (e.key === 'F1') { e.preventDefault(); setShowFindProduct(true); }
      if (e.key === 'F2') { e.preventDefault(); handleSave(); }
      if (e.key === 'F3') { e.preventDefault(); handlePrint(); }
      if (e.key === 'F4') { e.preventDefault(); handleVoid(); }
      if (e.key === 'F5') { e.preventDefault(); handlePay(); }
      if (e.key === 'F6') { e.preventDefault(); setShowCartPreview(true); }
      if (e.key === 'F10') { e.preventDefault(); setShowStockList(true); }
      if (e.key === 'Escape') {
        if (showPayment) setShowPayment(false);
        else if (showReceipt) setShowReceipt(false);
        else if (showFindProduct) setShowFindProduct(false);
        else if (showStockList) setShowStockList(false);
        else if (showCartPreview) setShowCartPreview(false);
        else setSelectedCartIndex(null);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  const completePayment = async (method: string, amountPaid: number) => {
    const change = amountPaid - total;
    const result: PaymentResult = {
      method,
      amountPaid,
      change: Math.max(0, change),
      total,
      subtotal,
      tax: taxAmount,
      discount: discountAmount,
      timestamp: new Date(),
      invoiceNumber: invoiceNumber || '',
      items: [...cart],
      cashier,
      customer: customerName || undefined,
    };
    // Reduce stock levels locally (optimistic)
    setProducts(prev => prev.map(p => {
      const cartItem = cart.find(c => c.productId === p.id);
      if (!cartItem) return p;
      return { ...p, stock: Math.max(0, p.stock - cartItem.quantity) };
    }));
    // Add history entries locally
    const newHistory = cart.map(item => ({
      id: `h-${Date.now()}-${item.productId}`,
      productId: item.productId,
      productName: item.name,
      sku: item.sku,
      action: 'sold' as const,
      quantityChange: -item.quantity,
      newQuantity: (products.find(p => p.id === item.productId)?.stock || 0) - item.quantity,
      timestamp: new Date().toISOString(),
      user: cashier,
      reason: `Sold via ${method} - Invoice ${invoiceNumber}`,
      reference: invoiceNumber || undefined,
    }));
    setHistory(prev => [...prev, ...newHistory]);
    setLastPayment(result);
    setDailyTotal(prev => prev + total);
    setTransactionCount(prev => prev + 1);
    setShowPayment(false);
    setShowReceipt(true);

    // ===== Record sale to database (permanent persistence) =====
    // POST to /api/sales which creates Sale + SaleItem records, decrements
    // stock atomically, and records StockHistory entries. The sale is
    // permanently recorded even if the user clears localStorage.
    try {
      const res = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          invoiceNumber: result.invoiceNumber,
          customerName: result.customer || '',
          cashierName: result.cashier,
          subtotal: result.subtotal,
          discount: result.discount,
          taxRate: TAX_RATE,
          taxAmount: result.tax,
          total: result.total,
          amountPaid: result.amountPaid,
          change: result.change,
          paymentMethod: result.method,
          status: 'completed',
          items: result.items.map(item => ({
            productId: item.productId,
            sku: item.sku,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            unit: item.unit,
            discount: item.discount,
            taxable: item.taxable,
            total: item.price * item.quantity * (1 - item.discount / 100),
          })),
        }),
      });
      if (!res.ok) {
        console.warn('Sale recording failed:', await res.text());
        toast({ title: 'Warning', description: 'Sale completed locally but could not be saved to server', variant: 'destructive' });
      }
    } catch (e) {
      console.warn('Sale recording error (offline?):', e);
    }
  };

  const finishReceipt = () => {
    setShowReceipt(false);
    clearCart();
    setLastPayment(null);
  };

  const recallOrder = (index: number) => {
    const order = heldOrders[index];
    setCart(order.items);
    setCustomerName(order.customer);
    setInvoiceNumber(order.invoice);
    setHeldOrders(prev => prev.filter((_, i) => i !== index));
    toast({ title: "Order recalled", description: `${order.items.length} items restored` });
  };

  // ===== Permission helper =====
  const hasPermission = (perm: string): boolean => {
    if (!loggedInUser) return false;
    if (loggedInUser.role === 'admin') return true; // Admin always has full access
    return loggedInUser.permissions?.[perm as keyof typeof loggedInUser.permissions] === true;
  };

  // ===== Menu Items (filtered by logged-in user permissions) =====
  const menus = [
    {
      id: "pos",
      label: "POS",
      items: hasPermission('pos') ? [
        { label: "Go to POS Screen", icon: Home, action: () => { setView("pos"); }, shortcut: "Ctrl+P" },
        { label: "New Sale", icon: Plus, action: () => { clearCart(); setView("pos"); }, shortcut: "Ctrl+N" },
        { separator: true },
        { label: "📊 Operations Dashboard", icon: TrendingUp, action: () => setView("dashboard") },
        { label: "🧾 Receipt Archive", icon: FileText, action: () => setView("receipt-archive") },
        { separator: true },
        { label: "Open Cash Drawer", icon: DollarSign, action: handleOpenCash },
        { label: "Switch Register", icon: Store, action: () => toast({ title: "Switch Register", description: "Select another register to switch to" }) },
      ] : [],
    },
    {
      id: "sale",
      label: "Sale",
      items: hasPermission('sales') ? [
        { label: "New Sale", icon: Plus, action: () => { clearCart(); setView("pos"); }, shortcut: "Ctrl+N" },
        { label: "Save / Hold Order", icon: Pause, action: handleSave, shortcut: "F2" },
        { label: "Print Receipt", icon: Printer, action: handlePrint, shortcut: "F3" },
        ...(hasPermission('canVoid') ? [{ label: "Void Transaction", icon: RotateCcw, action: () => { if (cart.length === 0) { toast({ title: "Cart is already empty", variant: "destructive" }); return; } clearCart(); toast({ title: "Transaction voided (F4)" }); }, shortcut: "F4" }] : []),
        { label: "Pay Now", icon: CreditCard, action: () => { if (cart.length === 0) { toast({ title: "Cart is empty", variant: "destructive" }); return; } setShowPayment(true); }, shortcut: "F5" },
        { separator: true },
        { label: "Sales Menu", icon: FileText, action: () => setView("sales-menu") },
        { label: "Sold Items Report", icon: FileBarChart, action: () => setView("sold-items") },
        { label: "Sales History", icon: History, action: () => setView("sales-history") },
        { label: "Daily Sales Report", icon: TrendingUp, action: () => setView("daily-sales") },
        { separator: true },
        { label: "🧾 Receipt Archive", icon: FileText, action: () => setView("receipt-archive") },
      ] : [],
    },
    {
      id: "stock",
      label: "Stock",
      items: hasPermission('stock') ? [
        { label: "Stock File", icon: FileText, action: () => { setInitialStockView("stock-file"); setView("stock"); } },
        { label: "Stock Search", icon: FileSearch, action: () => { setInitialStockView("stock-search"); setView("stock"); } },
        { label: "Add / Modify Stock", icon: Package, action: () => { setInitialStockView("add-modify"); setView("stock"); } },
        { label: "Group Maintenance", icon: Layers, action: () => { setInitialStockView("group-maintenance"); setView("stock"); } },
        ...(hasPermission('canAdjustStock') ? [{ label: "Quantity Adjustment", icon: ArrowUpDown, action: () => { setInitialStockView("quantity-adjustment"); setView("stock"); } }] : []),
        { label: "Stock History", icon: History, action: () => { setInitialStockView("history"); setView("stock"); } },
        { separator: true },
        { label: "Stock Qty Report", icon: FileBarChart, action: () => { setOpenStockQtyReport(true); setInitialStockView("add-modify"); setView("stock"); } },
        ...(hasPermission('canExport') ? [
          { label: "Stock Reports", icon: FileBarChart, action: () => setView("reports") },
          { label: "Quantities Report", icon: FileText, action: () => setView("reports") },
          { label: "Stock Value Report", icon: BarChart3, action: () => setView("reports") },
          { label: "Reorder Report", icon: RotateCcw, action: () => setView("reports") },
          { label: "Expiry Date Report", icon: Calendar, action: () => setView("reports") },
        ] : []),
      ] : [],
    },
    {
      id: "purchase",
      label: "Purchase",
      items: hasPermission('purchase') ? [
        { label: "Purchase", icon: FileText, action: () => setView("purchase-form") },
        { label: "Supplier", icon: Users, action: () => setView("supplier-form") },
        { label: "Purchase Orders", icon: Archive, action: () => setView("purchase") },
        { label: "Receive Stock", icon: Package, action: () => setView("purchase") },
        { separator: true },
        { label: "Purchase History", icon: History, action: () => setView("purchase") },
        { label: "Supplier Payments", icon: DollarSign, action: () => setView("purchase") },
        { separator: true },
        { label: "Purchase Report", icon: FileBarChart2, action: () => setView("purchase") },
      ] : [],
    },
    {
      id: "accounts",
      label: "Accounts",
      items: hasPermission('accounts') ? [
        { label: "Daily Sales Summary", icon: TrendingUp, action: () => { setAccountsReport("daily-sales"); setView("accounts-reports"); } },
        { label: "Daily Sales Detail", icon: FileText, action: () => { setAccountsReport("daily-sales-detail"); setView("accounts-reports"); } },
        { label: "Monthly Summary", icon: BarChart3, action: () => { setAccountsReport("monthly-summary"); setView("accounts-reports"); } },
        { label: "Monthly Detail", icon: FileBarChart2, action: () => { setAccountsReport("monthly-detail"); setView("accounts-reports"); } },
        { separator: true },
        { label: "Profit & Loss", icon: BarChart3, action: () => { setAccountsReport("profit-loss"); setView("accounts-reports"); } },
        { label: "VAT Tax Report", icon: Percent, action: () => { setAccountsReport("vat-tax"); setView("accounts-reports"); } },
        { separator: true },
        ...(hasPermission('financeOps') ? [
          { label: "Expense Management", icon: Wallet, action: () => { setFinanceTab("expenses"); setView("finance-ops"); } },
          { label: "Cash Reconciliation", icon: Wallet, action: () => { setFinanceTab("cash-recon"); setView("finance-ops"); } },
          { label: "Mobile Money", icon: Smartphone, action: () => { setFinanceTab("mobile-money"); setView("finance-ops"); } },
          { separator: true },
        ] : []),
        { label: "Stock Value Report", icon: DollarSign, action: () => { setAccountsReport("stock-value"); setView("accounts-reports"); } },
        { label: "Cost Price Report", icon: FileText, action: () => { setAccountsReport("cost-price"); setView("accounts-reports"); } },
        { label: "Stock Performance", icon: TrendingUp, action: () => { setAccountsReport("stock-performance"); setView("accounts-reports"); } },
        { label: "Stock Group Report", icon: Layers, action: () => { setAccountsReport("stock-group"); setView("accounts-reports"); } },
        { separator: true },
        { label: "General Ledger", icon: BookOpen, action: () => { setAccountsReport("general-ledger"); setView("accounts-reports"); } },
        { label: "Trial Balance", icon: FileBarChart2, action: () => { setAccountsReport("trial-balance"); setView("accounts-reports"); } },
      ] : [],
    },
    {
      id: "telephone",
      label: "Telephone",
      items: hasPermission('telephone') ? [
        { label: "Phone Orders", icon: PhoneCall, action: () => setView("telephone") },
        { label: "Delivery Tracking", icon: Truck, action: () => setView("telephone") },
        { label: "Customer Database", icon: Users, action: () => setView("telephone") },
        { separator: true },
        { label: "Phone Directory", icon: BookOpen, action: () => setView("telephone-directory") },
        { separator: true },
        { label: "Call Log", icon: Phone, action: () => setView("telephone") },
      ] : [],
    },
    {
      id: "maintenance",
      label: "Maintenance",
      items: hasPermission('maintenance') ? [
        { label: "System Settings", icon: Settings2, action: () => setView("maintenance") },
        { label: "User Management", icon: Users, action: () => setView("maintenance") },
        { label: "Backup Database", icon: Database, action: () => setView("maintenance") },
        { separator: true },
        { label: "☁️ Server Sync", icon: RefreshCw, action: () => setView("sync-settings") },
        { separator: true },
        { label: "Cashier Shift", icon: Clock, action: () => setView("maintenance") },
        { label: "Security & Permissions", icon: Lock, action: () => setView("maintenance") },
        { separator: true },
        { label: "Admin Panel", icon: Shield, action: () => setView("admin-login") },
        { separator: true },
        { label: "About SYLHN POS", icon: Store, action: () => setView("maintenance") },
        { label: "Exit", icon: Power, action: () => { fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {}); try { localStorage.removeItem('sylhn-current-user'); } catch {} setLoggedInUser(null); setView("login"); toast({ title: "Goodbye!", description: "Shift ended" }) } },
      ] : [
        { label: "Admin Panel", icon: Shield, action: () => setView("admin-login") },
        { separator: true },
        { label: "About SYLHN POS", icon: Store, action: () => setView("maintenance") },
        { label: "Exit", icon: Power, action: () => { fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {}); try { localStorage.removeItem('sylhn-current-user'); } catch {} setLoggedInUser(null); setView("login"); toast({ title: "Goodbye!", description: "Shift ended" }) } },
      ],
    },
  ].filter(m => m.items.length > 0); // Hide empty menus

  // ===== Render Other Views (lazy-loaded for performance) =====
  if (view === "dashboard") {
    return <OperationsDashboard products={products} onBack={() => setView("pos")} dailyTotal={dailyTotal} transactionCount={transactionCount} />;
  }
  if (view === "receipt-archive") {
    return <ReceiptArchive onBack={() => setView("pos")} />;
  }
  if (view === "sync-settings") {
    return <SyncSettings onBack={() => setView("pos")} />;
  }
  if (view === "stock") {
    return <StockManagement onBack={() => { setView("pos"); setOpenStockQtyReport(false); }} products={products} setProducts={setProducts} groups={groups} setGroups={setGroups} history={history} setHistory={setHistory} initialView={initialStockView} openQtyReport={openStockQtyReport} onNavigateToPurchase={() => setView("purchase-form")} />;
  }
  if (view === "reports") {
    return <Reports onBack={() => setView("pos")} products={products} groups={groups} history={history} />;
  }
  if (view === "purchase") {
    return (
      <PurchaseMenu
        onBack={() => setView("pos")} products={products}
        onOpenPurchasingForm={() => setView("purchase-form")}
        onOpenSupplierForm={() => setView("supplier-form")}
      />
    );
  }
  if (view === "purchase-form") {
    return <PurchaseForm onBack={() => setView("pos")} products={products} groups={groups} suppliers={initialSuppliers} />;
  }
  if (view === "telephone") {
    return <TelephoneModule onBack={() => setView("pos")} products={products} />;
  }
  if (view === "telephone-directory") {
    return (
      <div className="h-screen bg-slate-100">
        <TelephoneDirectory onClose={() => setView("pos")} />
      </div>
    );
  }
  if (view === "maintenance") {
    return <MaintenanceModule onBack={() => setView("pos")} cashier={cashier} dailyTotal={dailyTotal} transactionCount={transactionCount} />;
  }
  if (view === "sold-items") {
    return <SoldItemsReport onBack={() => setView("pos")} />;
  }
  if (view === "sales-menu") {
    return <SalesMenu onBack={() => setView("pos")} />;
  }
  if (view === "daily-sales") {
    return <DailySalesReport onBack={() => setView("pos")} dailyTotal={dailyTotal} transactionCount={transactionCount} />;
  }
  if (view === "sales-history") {
    return <SalesHistory onBack={() => setView("pos")} />;
  }
  if (view === "supplier-form") {
    return <SupplierForm onBack={() => setView("pos")} products={products} />;
  }
  if (view === "accounts-reports") {
    return <AccountsReports onBack={() => setView("pos")} products={products} groups={groups} history={history} dailyTotal={dailyTotal} transactionCount={transactionCount} initialReport={accountsReport} />;
  }
  if (view === "finance-ops") {
    return <FinancialOperations onBack={() => setView("pos")} dailyTotal={dailyTotal} initialTab={financeTab} />;
  }
  if (view === "admin-login") {
    return (
      <div className="h-screen bg-slate-900">
        <AdminLogin
          adminOnly={true}
          onSuccess={(user) => { setAdminUser(user); setView("admin-panel"); }}
          onCancel={() => setView("pos")}
        />
      </div>
    );
  }
  if (view === "admin-panel") {
    return <AdminPanel currentUser={adminUser} onBack={() => setView("pos")} />;
  }

  // ===== Login Screen (required to open the software) =====
  if (view === "login") {
    return (
      <div className="h-screen bg-slate-900 relative">
        <AdminLogin
          onSuccess={(user) => { setLoggedInUser(user); setView("pos"); toast({ title: `Welcome, ${user.fullName}`, description: `Logged in as ${user.role}` }); }}
          onCancel={() => toast({ title: "Login required", description: "You must log in to use the system" })}
        />
        {/* Install App button — visible on login screen */}
        <div className="fixed top-4 right-4 z-[200]">
          <InstallButton />
        </div>
      </div>
    );
  }

  // ===== Render POS =====
  return (
    <div className="h-screen w-screen overflow-hidden bg-gradient-to-br from-slate-100 via-emerald-50 to-slate-100 flex flex-col font-sans">
      {/* ===== Header Bar with Menu ===== */}
      <header className="flex-shrink-0 bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-600 text-white shadow-lg z-30">
        <div className="flex items-center px-4 py-2 gap-4">
          {/* Logo */}
          <div className="flex items-center gap-2.5 flex-shrink-0">
            <div className="h-10 w-10 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center ring-1 ring-white/20 font-bold text-lg">
              S
            </div>
            <div>
              <div className="font-bold text-base leading-tight tracking-tight">{COMPANY.name}</div>
              <div className="text-[10px] text-emerald-100/90 leading-tight">{COMPANY.address} · {COMPANY.contact}</div>
            </div>
          </div>

          {/* Menu Bar */}
          <div ref={menuRef} className="flex items-center gap-0.5 flex-shrink-0">
            {menus.map(menu => (
              <div key={menu.id} className="relative">
                <button
                  onClick={() => setOpenMenu(openMenu === menu.id ? null : menu.id)}
                  onMouseEnter={() => setOpenMenu(menu.id)}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-xs font-semibold transition flex items-center gap-1",
                    openMenu === menu.id ? "bg-white/20" : "hover:bg-white/10"
                  )}
                >
                  {menu.label}
                  <ChevronDown className="h-3 w-3 opacity-70" />
                </button>
                <AnimatePresence>
                  {openMenu === menu.id && (
                    <motion.div
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      transition={{ duration: 0.15 }}
                      className="absolute top-full left-0 mt-1 w-60 bg-white rounded-xl shadow-2xl ring-1 ring-slate-200 overflow-hidden z-50 py-1"
                    >
                      {menu.items.map((item, i) => {
                        if ('separator' in item) {
                          return <div key={i} className="h-px bg-slate-100 my-1" />;
                        }
                        return (
                          <button
                            key={i}
                            onClick={() => { item.action(); setOpenMenu(null); }}
                            className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 text-xs font-medium transition text-left group"
                          >
                            <item.icon className="h-3.5 w-3.5 text-slate-400 group-hover:text-emerald-600" />
                            <span className="flex-1">{item.label}</span>
                            {'shortcut' in item && item.shortcut && (
                              <kbd className="text-[9px] font-mono text-slate-400 bg-slate-100 px-1 py-0.5 rounded">{item.shortcut}</kbd>
                            )}
                          </button>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>

          {/* Search */}
          <div className="flex-1 max-w-xl relative">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                ref={searchInputRef}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products, scan barcode, or enter SKU..."
                className="w-full h-9 pl-10 pr-20 rounded-xl bg-white text-slate-800 text-sm shadow-md outline-none ring-2 ring-transparent focus:ring-emerald-300 transition"
              />
              <button
                onClick={() => setScannerMode(!scannerMode)}
                className={cn("absolute right-2 top-1/2 -translate-y-1/2 h-6 px-2 rounded-lg flex items-center gap-1 text-[11px] font-medium transition",
                  scannerMode ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500 hover:bg-slate-200")}
              >
                <ScanLine className="h-3.5 w-3.5" />
                Scan
              </button>
            </div>
          </div>

          {/* Right: Date, Stats, Cashier */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="hidden lg:flex items-center gap-2 text-right">
              <div className="px-2.5 py-1 rounded-lg bg-white/10 backdrop-blur ring-1 ring-white/15">
                <div className="text-[9px] text-emerald-100/80 font-medium">{now ? now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '--'}</div>
                <div className="text-xs font-mono font-bold">{now ? now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '--:--:--'}</div>
              </div>
              <div className="px-2.5 py-1 rounded-lg bg-white/10 backdrop-blur ring-1 ring-white/15">
                <div className="text-[9px] text-emerald-100/80 font-medium">Daily Sales</div>
                <div className="text-xs font-mono font-bold">{formatGHS(dailyTotal)}</div>
              </div>
              <div className="px-2.5 py-1 rounded-lg bg-white/10 backdrop-blur ring-1 ring-white/15">
                <div className="text-[9px] text-emerald-100/80 font-medium">Txns</div>
                <div className="text-xs font-mono font-bold">{transactionCount}</div>
              </div>
            </div>
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-white/10 backdrop-blur ring-1 ring-white/15">
              <div className="h-7 w-7 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 ring-1 ring-white/30 flex items-center justify-center text-[10px] font-bold">
                {loggedInUser ? loggedInUser.fullName.charAt(0) : 'S'}
              </div>
              <div className="hidden sm:block">
                <div className="text-[10px] font-bold leading-tight">{loggedInUser ? loggedInUser.fullName : cashier}</div>
                <div className="text-[9px] text-emerald-100/70 capitalize">{loggedInUser ? loggedInUser.role : 'Cashier'}</div>
              </div>
            </div>
            <InstallButton />
            <button onClick={() => { fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {}); try { localStorage.removeItem('sylhn-current-user'); } catch {} setLoggedInUser(null); setView("login"); toast({ title: "Logged out", description: "You have been signed out" }); }} className="h-8 px-3 rounded-lg bg-rose-500/20 hover:bg-rose-500/40 text-white text-xs font-bold flex items-center gap-1.5 transition" title="Sign out">
              <LogOut className="h-4 w-4" /> <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* ===== Category Navigation ===== */}
      <nav className="flex-shrink-0 bg-white border-b border-slate-200 shadow-sm z-20">
        <div className="flex items-center gap-1.5 px-4 py-2 overflow-x-auto scrollbar-hide">
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={cn(
                "flex-shrink-0 flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200",
                activeCategory === cat.id
                  ? `bg-gradient-to-r ${cat.gradient} text-white shadow-md scale-105`
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:scale-105"
              )}
            >
              <span className="text-base">{cat.icon}</span>
              {cat.name}
              {activeCategory === cat.id && cat.id !== "all" && (
                <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px] bg-white/25 text-white">
                  {products.filter(p => p.category === cat.id).length}
                </Badge>
              )}
            </button>
          ))}
        </div>
      </nav>

      {/* ===== Main Content ===== */}
      <main className="flex-1 flex overflow-hidden p-3 gap-3">
        {/* ===== Left Panel: Product Grid (60%) ===== */}
        <section className="flex-1 flex flex-col bg-white rounded-2xl shadow-lg ring-1 ring-slate-200/60 overflow-hidden min-w-0">
          <div className="flex-shrink-0 flex items-center justify-between px-5 py-2 bg-gradient-to-r from-slate-50 to-white border-b border-slate-200">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5 text-emerald-600" />
                <h2 className="text-base font-bold text-slate-800">
                  {categories.find(c => c.id === activeCategory)?.name || "All Products"}
                </h2>
              </div>
              <Badge variant="outline" className="font-mono text-[11px]">
                {filteredProducts.length} items
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-500">
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live Inventory
              </span>
              <span className="text-slate-300">·</span>
              <span>Prices in {CURRENCY_CODE}</span>
            </div>
          </div>

          {/* Product Search Bar */}
          <div className="flex-shrink-0 px-4 py-2 bg-white border-b border-slate-200">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder="Search inventory by name, SKU, barcode, or supplier..."
                className="w-full h-9 pl-9 pr-9 rounded-lg bg-slate-50 border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-emerald-400 focus:bg-white transition"
              />
              {productSearch && (
                <button
                  onClick={() => setProductSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full bg-slate-200 hover:bg-slate-300 flex items-center justify-center transition"
                >
                  <X className="h-3.5 w-3.5 text-slate-600" />
                </button>
              )}
            </div>
          </div>

          <ScrollArea className="flex-1">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 p-4">
              {filteredProducts.map((product, idx) => {
                const inCart = cart.find(item => item.productId === product.id);
                const lowStock = product.stock <= product.reorderLevel;
                return (
                  <motion.button
                    key={product.id}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.2, delay: Math.min(idx * 0.015, 0.3) }}
                    whileHover={{ y: -3, scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => addToCart(product)}
                    className="group relative flex flex-col items-center text-center bg-white rounded-xl p-3 ring-1 ring-slate-200 hover:ring-emerald-400 hover:shadow-lg transition-all duration-200"
                  >
                    {inCart && (
                      <div className="absolute top-1.5 right-1.5 z-10 h-6 w-6 rounded-full bg-emerald-500 text-white text-[11px] font-bold flex items-center justify-center shadow-md">
                        {inCart.quantity}
                      </div>
                    )}
                    {product.taxable && (
                      <div className="absolute top-1.5 left-1.5 z-10 px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-700 text-[9px] font-bold">
                        VAT
                      </div>
                    )}
                    {lowStock && (
                      <div className="absolute bottom-1.5 left-1.5 z-10 px-1.5 py-0.5 rounded-md bg-rose-100 text-rose-700 text-[9px] font-bold">
                        LOW
                      </div>
                    )}
                    <div className="h-16 w-16 rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center text-4xl mb-2 group-hover:scale-110 transition-transform duration-200">
                      {product.emoji}
                    </div>
                    <div className="w-full">
                      <div className="text-xs font-semibold text-slate-800 leading-tight line-clamp-2 min-h-[2rem]">
                        {product.name}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                        {product.sku}
                      </div>
                      <div className="flex items-center justify-between mt-1.5">
                        <div className="text-sm font-bold text-emerald-600">
                          {formatGHS(product.price)}
                        </div>
                        <div className="text-[10px] text-slate-400">/{product.unit}</div>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        Stock: {product.stock}
                      </div>
                    </div>
                  </motion.button>
                );
              })}
            </div>
            {filteredProducts.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                <Package className="h-12 w-12 mb-3 opacity-40" />
                <div className="text-sm font-medium">No products found</div>
                <div className="text-xs mt-1">Try a different category or search term</div>
              </div>
            )}
          </ScrollArea>
        </section>

        {/* ===== Right Panel: Cart + Keypad + Functions (40%) ===== */}
        <section className={cn(
          "flex flex-col bg-white rounded-2xl shadow-lg ring-1 ring-slate-200/60 overflow-hidden transition-all duration-300",
          showSidebar ? "w-[38%] min-w-[380px]" : "w-0 min-w-0"
        )}>
          <AnimatePresence>
            {showSidebar && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col h-full w-full"
              >
                {/* Cart Header */}
                <div className="flex-shrink-0 flex items-center justify-between px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-500 text-white">
                  <div className="flex items-center gap-2">
                    <Cart className="h-4 w-4" />
                    <span className="text-xs font-bold">Invoice #{invoiceNumber || '------'}</span>
                  </div>
                  <button onClick={() => setShowSidebar(false)} className="h-6 w-6 rounded hover:bg-white/20 flex items-center justify-center transition">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Invoice Info Bar */}
                <div className="flex-shrink-0 px-3 py-1.5 bg-slate-100 border-b border-slate-300 flex items-center gap-3 text-[10px]">
                  <div className="flex items-center gap-1">
                    <span className="font-semibold text-slate-600">Client:</span>
                    <input
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Walk-in customer"
                      className="w-32 h-6 px-1.5 border border-slate-300 rounded text-[10px] bg-white outline-none focus:ring-1 focus:ring-blue-400"
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="font-semibold text-slate-600">Balance:</span>
                    <span className="font-mono font-bold text-slate-800">{formatGHS(0)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="font-semibold text-slate-600">Points:</span>
                    <span className="font-mono text-slate-700">0</span>
                  </div>
                  {heldOrders.length > 0 && (
                    <button className="ml-auto px-2 py-0.5 rounded bg-amber-100 text-amber-700 text-[10px] font-semibold flex items-center gap-1 hover:bg-amber-200 transition">
                      <Pause className="h-2.5 w-2.5" />
                      {heldOrders.length} Held
                    </button>
                  )}
                </div>

                {/* Part No. Input — typing here opens Stock List popup */}
                <div className="flex-shrink-0 px-3 py-1.5 bg-white border-b border-slate-200 flex items-center gap-2">
                  <label className="text-[10px] font-bold text-slate-600 whitespace-nowrap">Part No.:</label>
                  <input
                    value={partNoInput}
                    onChange={(e) => {
                      setPartNoInput(e.target.value);
                      if (e.target.value.length > 0) {
                        setShowStockList(true);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const product = products.find(p => p.barcode === partNoInput || p.sku.toLowerCase() === partNoInput.toLowerCase());
                        if (product) {
                          addToCart(product);
                          setPartNoInput("");
                          setShowStockList(false);
                        } else {
                          setShowStockList(true);
                        }
                      }
                      if (e.key === 'Escape') setShowStockList(false);
                    }}
                    onFocus={() => { if (partNoInput) setShowStockList(true); }}
                    placeholder="Type part number or scan barcode..."
                    className="flex-1 h-7 px-2 text-xs font-mono border border-slate-400 rounded outline-none focus:ring-2 focus:ring-blue-400 bg-white"
                  />
                  <button
                    onClick={() => setShowStockList(true)}
                    className="h-7 px-2 rounded bg-blue-100 hover:bg-blue-200 text-blue-700 text-[10px] font-semibold flex items-center gap-1"
                  >
                    <Search className="h-3 w-3" /> F10
                  </button>
                </div>

                {/* Cart Items Table */}
                <div className="flex-1 overflow-hidden flex flex-col min-h-0">
                  {/* Table Header — light blue matching reference */}
                  <div className="flex-shrink-0 grid grid-cols-[120px_1fr_50px_80px_45px_80px] gap-1 px-2 py-1 text-[10px] font-bold text-slate-700 border-b border-slate-400" style={{ backgroundColor: '#ADD8E6' }}>
                    <div>Part No.</div>
                    <div>Part Details</div>
                    <div className="text-right">Qty</div>
                    <div className="text-right">Amount GHC</div>
                    <div className="text-center">Disc%</div>
                    <div className="text-right">Total GHC</div>
                  </div>

                  <ScrollArea className="flex-1 min-h-0">
                    <div className="divide-y divide-slate-100">
                      <AnimatePresence mode="popLayout">
                        {cart.map((item, index) => {
                          const lineTotal = item.price * item.quantity;
                          const lineDiscount = lineTotal * (item.discount / 100);
                          const lineFinal = lineTotal - lineDiscount;
                          const isSelected = selectedCartIndex === index;
                          return (
                            <motion.div
                              key={item.id}
                              layout
                              initial={{ opacity: 0, x: 20 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: -20 }}
                              transition={{ duration: 0.2 }}
                              onClick={() => setSelectedCartIndex(index)}
                              className={cn(
                                "grid grid-cols-[120px_1fr_50px_80px_45px_80px] gap-1 px-2 py-1.5 cursor-pointer transition-colors text-[11px]",
                              )}
                              style={{
                                backgroundColor: isSelected ? '#E3F2FD' : (index % 2 === 1 ? '#FAFAFA' : '#FFFFFF'),
                                color: isSelected ? '#1565C0' : '#424242',
                              }}
                            >
                              <div className="font-mono truncate">{item.sku}</div>
                              <div className="truncate">{item.emoji} {item.name}</div>
                              <div className="text-right font-mono">{item.quantity.toFixed(item.unit === 'kg' ? 2 : 0)}</div>
                              <div className="text-right font-mono">{formatGHS(item.price)}</div>
                              <div className="text-center">
                                <input
                                  type="number"
                                  value={item.discount || ''}
                                  onClick={(e) => { e.stopPropagation(); setSelectedCartIndex(index); }}
                                  onChange={(e) => applyDiscount(index, parseFloat(e.target.value) || 0)}
                                  className="w-9 text-center text-[10px] bg-transparent border-b border-slate-200 focus:border-blue-400 outline-none font-mono"
                                  placeholder="0"
                                />
                              </div>
                              <div className="text-right font-mono font-semibold">{formatGHS(lineFinal)}</div>
                            </motion.div>
                          );
                        })}
                      </AnimatePresence>

                      {cart.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                          <ShoppingCart className="h-10 w-10 mb-2 opacity-40" />
                          <div className="text-sm font-medium">Cart is empty</div>
                          <div className="text-xs mt-1">Type a Part No. above or click products</div>
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </div>

                {/* Held Orders */}
                {heldOrders.length > 0 && (
                  <div className="flex-shrink-0 px-3 py-2 bg-amber-50 border-t border-amber-200 max-h-24 overflow-y-auto">
                    <div className="text-[10px] font-bold text-amber-800 mb-1">HELD ORDERS (click to recall)</div>
                    <div className="flex flex-wrap gap-1">
                      {heldOrders.map((order, i) => (
                        <button key={i} onClick={() => recallOrder(i)} className="px-2 py-1 rounded-md bg-white ring-1 ring-amber-300 text-[10px] text-amber-700 hover:bg-amber-100 transition">
                          #{order.invoice} · {order.items.length} items
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Totals */}
                <div className="flex-shrink-0 border-t border-slate-200 bg-gradient-to-b from-slate-50 to-white">
                  <div className="px-4 py-1 space-y-0.5">
                    <div className="flex justify-between text-xs text-slate-600">
                      <span>Subtotal ({totalItems} items)</span>
                      <span className="font-mono">{formatGHS(subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-600">
                      <span className="flex items-center gap-1">
                        <Percent className="h-3 w-3" /> Discount
                        <input
                          type="number"
                          value={globalDiscount || ''}
                          onChange={(e) => setGlobalDiscount(Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
                          className="w-10 text-center bg-transparent border-b border-slate-200 focus:border-emerald-400 outline-none font-mono"
                          placeholder="0"
                        />%
                      </span>
                      <span className="font-mono text-rose-600">-{formatGHS(discountAmount)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-600">
                      <span>{TAX_NAME} ({(TAX_RATE * 100).toFixed(0)}%)</span>
                      <span className="font-mono">{formatGHS(taxAmount)}</span>
                    </div>
                  </div>
                  <div className="px-4 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white">
                    <div className="flex justify-between items-baseline">
                      <span className="text-xs font-semibold uppercase tracking-wider opacity-90">Total Due</span>
                      <span className="text-2xl font-bold font-mono">{formatGHS(total)}</span>
                    </div>
                  </div>
                </div>

                {/* Function Buttons */}
                <div className="flex-shrink-0 grid grid-cols-4 gap-1 p-1.5 bg-slate-100">
                  <button
                    onClick={() => setShowFindProduct(true)}
                    className="col-span-4 h-9 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 hover:from-blue-700 hover:to-indigo-700 transition shadow-sm"
                  >
                    <Search className="h-3.5 w-3.5" />
                    FIND PRODUCT
                    <kbd className="ml-1 px-1 py-0.5 rounded bg-white/20 text-[9px] font-mono">F1</kbd>
                  </button>
                  <FuncBtn icon={<Pause className="h-3 w-3" />} label="Save" sub="F2" onClick={handleSave} variant="amber" />
                  <FuncBtn icon={<Printer className="h-3 w-3" />} label="Print" sub="F3" onClick={handlePrint} variant="slate" />
                  <FuncBtn icon={<RotateCcw className="h-3 w-3" />} label="Void" sub="F4" onClick={handleVoid} variant="rose" />
                  <FuncBtn icon={<DollarSign className="h-3 w-3" />} label="Cash" sub="" onClick={handleOpenCash} variant="slate" />
                  <FuncBtn icon={<Trash2 className="h-3 w-3" />} label="Del Line" sub="Del" onClick={() => selectedCartIndex !== null ? removeLine(selectedCartIndex) : toast({ title: "Select a line first", variant: "destructive" })} variant="slate" />
                  <FuncBtn icon={<Check className="h-3 w-3" />} label="Enter" sub="↵" onClick={handleKeypadEnter} variant="emerald" />
                  <button
                    onClick={() => setShowCartPreview(true)}
                    className="col-span-1 h-9 rounded-lg bg-gradient-to-r from-violet-600 to-purple-600 text-white font-bold text-[10px] flex items-center justify-center gap-0.5 hover:from-violet-700 hover:to-purple-700 transition shadow-sm"
                  >
                    <Eye className="h-3 w-3" />
                    PREVIEW
                    <kbd className="ml-0.5 px-0.5 py-0.5 rounded bg-white/20 text-[8px] font-mono">F6</kbd>
                  </button>
                  <button
                    onClick={handlePay}
                    className="col-span-3 h-9 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 hover:from-emerald-700 hover:to-teal-700 transition shadow-sm"
                  >
                    <CreditCard className="h-3.5 w-3.5" />
                    PAY NOW
                    <kbd className="ml-1 px-1 py-0.5 rounded bg-white/20 text-[9px] font-mono">F5</kbd>
                  </button>
                </div>

                {/* Numeric Keypad */}
                <div className="flex-shrink-0 p-1.5 bg-slate-800">
                  <div className="flex gap-1 mb-1">
                    {(["qty", "price", "barcode"] as const).map(mode => (
                      <button
                        key={mode}
                        onClick={() => setActiveKeypadMode(mode)}
                        className={cn(
                          "flex-1 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wide transition",
                          activeKeypadMode === mode ? "bg-emerald-500 text-white" : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                        )}
                      >
                        {mode === "qty" ? "Qty" : mode === "price" ? "Price" : "Barcode"}
                      </button>
                    ))}
                  </div>
                  <div className="mb-1 px-2 py-1 bg-slate-900 rounded-lg flex items-center justify-between">
                    <span className="text-[9px] text-slate-400 uppercase font-semibold">
                      {activeKeypadMode === "qty" ? "Quantity" : activeKeypadMode === "price" ? `Price (${CURRENCY_CODE})` : "Scan Code"}
                    </span>
                    <span className="font-mono text-sm font-bold text-emerald-400">
                      {keypadInput || (activeKeypadMode === "price" ? `${CURRENCY}0.00` : "—")}
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-1">
                    <KeypadBtn label="7" onClick={() => handleKeypadPress("7")} />
                    <KeypadBtn label="8" onClick={() => handleKeypadPress("8")} />
                    <KeypadBtn label="9" onClick={() => handleKeypadPress("9")} />
                    <KeypadBtn label="C" onClick={() => handleKeypadPress("C")} variant="rose" />
                    <KeypadBtn label="4" onClick={() => handleKeypadPress("4")} />
                    <KeypadBtn label="5" onClick={() => handleKeypadPress("5")} />
                    <KeypadBtn label="6" onClick={() => handleKeypadPress("6")} />
                    <KeypadBtn label="⌫" onClick={() => handleKeypadPress("⌫")} variant="amber" />
                    <KeypadBtn label="1" onClick={() => handleKeypadPress("1")} />
                    <KeypadBtn label="2" onClick={() => handleKeypadPress("2")} />
                    <KeypadBtn label="3" onClick={() => handleKeypadPress("3")} />
                    <KeypadBtn label="Enter" onClick={() => handleKeypadPress("Enter")} variant="emerald" rowSpan />
                    <KeypadBtn label="0" onClick={() => handleKeypadPress("0")} wide />
                    <KeypadBtn label="." onClick={() => handleKeypadPress(".")} />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {!showSidebar && (
          <button
            onClick={() => setShowSidebar(true)}
            className="absolute right-3 top-32 z-20 h-12 w-12 rounded-full bg-emerald-600 text-white shadow-lg flex items-center justify-center hover:bg-emerald-700 transition"
          >
            <Cart className="h-5 w-5" />
            {cart.length > 0 && (
              <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
                {totalItems}
              </span>
            )}
          </button>
        )}
      </main>

      {/* ===== Payment Modal ===== */}
      <AnimatePresence>
        {showPayment && (
          <PaymentModal
            total={total}
            subtotal={subtotal}
            tax={taxAmount}
            discount={discountAmount}
            itemCount={totalItems}
            invoiceNumber={invoiceNumber || '------'}
            customerName={customerName}
            onClose={() => setShowPayment(false)}
            onComplete={completePayment}
          />
        )}
      </AnimatePresence>

      {/* ===== Find Product Modal ===== */}
      <AnimatePresence>
        {showFindProduct && (
          <FindProductModal
            products={products}
            onAdd={(product) => { addToCart(product); }}
            onClose={() => setShowFindProduct(false)}
          />
        )}
      </AnimatePresence>

      {/* ===== Stock List Popup (triggered by Part No. input) ===== */}
      <AnimatePresence>
        {showStockList && (
          <StockListPopup
            products={products}
            searchText={partNoInput}
            onSelect={(product) => {
              addToCart(product);
              setPartNoInput("");
              setShowStockList(false);
            }}
            onClose={() => setShowStockList(false)}
            onNew={() => { setShowStockList(false); setShowFindProduct(true); }}
          />
        )}
      </AnimatePresence>

      {/* ===== Cart Preview Modal ===== */}
      <AnimatePresence>
        {showCartPreview && (
          <CartPreviewModal
            cart={cart}
            subtotal={subtotal}
            discountAmount={discountAmount}
            globalDiscount={globalDiscount}
            taxAmount={taxAmount}
            total={total}
            totalItems={totalItems}
            invoiceNumber={invoiceNumber || '------'}
            customerName={customerName}
            cashier={cashier}
            onUpdateQuantity={setQuantity}
            onRemoveLine={removeLine}
            onApplyDiscount={applyDiscount}
            onSetGlobalDiscount={(v) => setGlobalDiscount(Math.min(100, Math.max(0, v)))}
            onClearDiscount={() => setGlobalDiscount(0)}
            onClose={() => setShowCartPreview(false)}
            onProceedToPayment={() => {
              setShowCartPreview(false);
              setShowPayment(true);
            }}
            onContinueShopping={() => setShowCartPreview(false)}
            onClearCart={() => {
              clearCart();
              setShowCartPreview(false);
            }}
          />
        )}
      </AnimatePresence>

      {/* ===== Receipt Modal ===== */}
      <AnimatePresence>
        {showReceipt && lastPayment && (
          <ReceiptModal payment={lastPayment} onClose={finishReceipt} />
        )}
      </AnimatePresence>

      {/* ===== Cash Drawer Animation ===== */}
      <AnimatePresence>
        {showCashDrawer && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center"
          >
            <motion.div
              initial={{ scale: 0.8, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.8, y: 20 }}
              className="bg-white rounded-2xl p-8 shadow-2xl flex flex-col items-center"
            >
              <div className="h-16 w-16 rounded-full bg-emerald-100 flex items-center justify-center mb-3">
                <DollarSign className="h-8 w-8 text-emerald-600" />
              </div>
              <div className="text-lg font-bold text-slate-800">Cash Drawer Opening</div>
              <div className="text-sm text-slate-500 mt-1">Register #1 · Drawer 01</div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ===== Helper Components =====

function FuncBtn({ icon, label, sub, onClick, variant }: {
  icon: React.ReactNode;
  label: string;
  sub: string;
  onClick: () => void;
  variant: "emerald" | "amber" | "rose" | "slate";
}) {
  const variants = {
    emerald: "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 ring-emerald-200",
    amber: "bg-amber-100 text-amber-700 hover:bg-amber-200 ring-amber-200",
    rose: "bg-rose-100 text-rose-700 hover:bg-rose-200 ring-rose-200",
    slate: "bg-white text-slate-700 hover:bg-slate-100 ring-slate-200",
  };
  return (
    <button
      onClick={onClick}
      className={cn("h-9 rounded-lg flex flex-col items-center justify-center gap-0.5 ring-1 transition", variants[variant])}
    >
      {icon}
      <span className="text-[10px] font-bold leading-none">{label}</span>
      {sub && <span className="text-[8px] opacity-60 leading-none font-mono">{sub}</span>}
    </button>
  );
}

function KeypadBtn({ label, onClick, variant, wide, rowSpan }: {
  label: string;
  onClick: () => void;
  variant?: "emerald" | "amber" | "rose";
  wide?: boolean;
  rowSpan?: boolean;
}) {
  const variants = {
    emerald: "bg-emerald-600 text-white hover:bg-emerald-500",
    amber: "bg-amber-600 text-white hover:bg-amber-500",
    rose: "bg-rose-600 text-white hover:bg-rose-500",
  };
  const defaultClass = "bg-slate-700 text-white hover:bg-slate-600";
  return (
    <button
      onClick={onClick}
      className={cn(
        "h-8 rounded-lg font-bold text-sm flex items-center justify-center transition active:scale-95",
        variant ? variants[variant] : defaultClass,
        wide && "col-span-2",
        rowSpan && "row-span-2 h-[4.25rem]"
      )}
    >
      {label}
    </button>
  );
}

// ===== Payment Modal =====
function PaymentModal({ total, subtotal, tax, discount, itemCount, invoiceNumber, customerName, onClose, onComplete }: {
  total: number;
  subtotal: number;
  tax: number;
  discount: number;
  itemCount: number;
  invoiceNumber: string;
  customerName: string;
  onClose: () => void;
  onComplete: (method: string, amountPaid: number) => void;
}) {
  const [method, setMethod] = useState("cash");
  const [amountInput, setAmountInput] = useState("");
  const { toast } = useToast();

  const amountPaid = parseFloat(amountInput) || 0;
  const change = amountPaid - total;
  const canComplete = method === "cash" ? amountPaid >= total : true;

  const handleComplete = () => {
    const paid = method === "cash" ? amountPaid : total;
    if (method === "cash" && amountPaid < total) {
      toast({ title: "Insufficient cash", description: `Need ${formatGHS(total - amountPaid)} more`, variant: "destructive" });
      return;
    }
    onComplete(method, paid);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, y: 30 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 30 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
      >
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-6 py-4 flex items-center justify-between">
          <div>
            <div className="text-xs opacity-80 font-semibold">PAYMENT · Invoice #{invoiceNumber || '------'}</div>
            <div className="text-lg font-bold">{itemCount} items</div>
          </div>
          <button onClick={onClose} className="h-8 w-8 rounded-lg bg-white/15 hover:bg-white/25 flex items-center justify-center">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-6 py-5 bg-slate-50 border-b border-slate-200 text-center">
          <div className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Total Due</div>
          <div className="text-5xl font-bold font-mono text-emerald-600 mt-1">{formatGHS(total)}</div>
          {customerName && <div className="text-xs text-slate-500 mt-1">Customer: {customerName}</div>}
          <div className="flex justify-center gap-4 mt-2 text-[11px] text-slate-500">
            <span>Sub: {formatGHS(subtotal)}</span>
            <span>{TAX_NAME}: {formatGHS(tax)}</span>
            {discount > 0 && <span className="text-rose-500">Disc: -{formatGHS(discount)}</span>}
          </div>
        </div>

        <div className="px-6 py-4">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Payment Method</div>
          <div className="grid grid-cols-3 gap-2">
            {paymentMethods.map(pm => (
              <button
                key={pm.id}
                onClick={() => setMethod(pm.id)}
                className={cn(
                  "flex flex-col items-center gap-1 py-3 rounded-xl ring-2 transition",
                  method === pm.id ? "ring-emerald-500 bg-emerald-50" : "ring-slate-200 hover:ring-slate-300 bg-white"
                )}
              >
                <span className="text-2xl">{pm.icon}</span>
                <span className="text-[11px] font-semibold text-slate-700">{pm.name}</span>
              </button>
            ))}
          </div>
        </div>

        {method === "cash" && (
          <div className="px-6 pb-4">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Cash Received</div>
            <input
              type="number"
              value={amountInput}
              onChange={(e) => setAmountInput(e.target.value)}
              autoFocus
              placeholder="0.00"
              className="w-full h-12 px-4 rounded-xl border-2 border-slate-200 focus:border-emerald-500 outline-none text-2xl font-mono font-bold text-right text-slate-800"
            />
            <div className="grid grid-cols-6 gap-1.5 mt-2">
              {quickCashAmounts.map(amt => (
                <button
                  key={amt}
                  onClick={() => setAmountInput(amt.toString())}
                  className="py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 transition"
                >
                  {CURRENCY}{amt}
                </button>
              ))}
            </div>
            <button
              onClick={() => setAmountInput(total.toFixed(2))}
              className="w-full mt-1.5 py-1.5 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-xs font-bold text-emerald-700 transition"
            >
              Exact Amount {formatGHS(total)}
            </button>

            {amountPaid > 0 && (
              <div className="mt-3 p-3 rounded-xl bg-slate-800 text-white flex justify-between items-center">
                <span className="text-xs font-semibold uppercase opacity-80">Change Due</span>
                <span className={cn("text-2xl font-bold font-mono", change >= 0 ? "text-emerald-400" : "text-rose-400")}>
                  {formatGHS(Math.abs(change))}
                </span>
              </div>
            )}
          </div>
        )}

        {method !== "cash" && (
          <div className="px-6 pb-4">
            <div className="p-4 rounded-xl bg-blue-50 text-center">
              <div className="text-3xl mb-2">{paymentMethods.find(p => p.id === method)?.icon}</div>
              <div className="text-sm font-semibold text-slate-700">
                {method === "card" ? "Insert/tap card on terminal" : "Awaiting Mobile Money confirmation..."}
              </div>
              <div className="text-xs text-slate-500 mt-1">Confirm on payment terminal</div>
            </div>
          </div>
        )}

        <div className="px-6 pb-6">
          <button
            onClick={handleComplete}
            disabled={!canComplete}
            className={cn(
              "w-full h-14 rounded-xl font-bold text-base flex items-center justify-center gap-2 transition shadow-md",
              canComplete ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:shadow-lg" : "bg-slate-200 text-slate-400 cursor-not-allowed"
            )}
          >
            <Check className="h-5 w-5" />
            COMPLETE PAYMENT · {formatGHS(total)}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ===== Find Product Modal =====
function FindProductModal({ products, onAdd, onClose }: {
  products: Product[];
  onAdd: (product: Product) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [groupFilter, setGroupFilter] = useState<string>("all");
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [recentlyAdded, setRecentlyAdded] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Autofocus on input when modal opens
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 100);
    return () => clearTimeout(t);
  }, []);

  const selectProduct = (id: string | null) => {
    setSelectedProductId(id);
    setQuantity(1);
  };

  const stockGroups = [
    { id: "all", name: "All Groups", icon: "🛒" },
    { id: "groceries", name: "Groceries", icon: "🛒" },
    { id: "confectionery", name: "Confectionery", icon: "🍫" },
    { id: "soft-drinks", name: "Soft Drinks", icon: "🥤" },
    { id: "hard-liquor", name: "Hard Liquor", icon: "🍷" },
    { id: "households", name: "Households", icon: "🧴" },
  ];

  const filtered = useMemo(() => {
    let result = products;
    if (groupFilter !== "all") {
      result = result.filter(p => p.groupId === groupFilter);
    }
    if (query.trim()) {
      const q = query.toLowerCase();
      result = result.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.barcode.includes(q) ||
        p.supplier.toLowerCase().includes(q)
      );
    }
    return result;
  }, [products, query, groupFilter]);

  const selectedProduct = selectedProductId
    ? products.find(p => p.id === selectedProductId) || null
    : null;

  const handleAddToCart = () => {
    if (!selectedProduct) return;
    for (let i = 0; i < quantity; i++) {
      onAdd(selectedProduct);
    }
    setRecentlyAdded(selectedProduct.id);
    setTimeout(() => setRecentlyAdded(null), 1200);
    // Keep modal open for adding more products, but clear selection
    selectProduct(null);
    inputRef.current?.focus();
  };

  const handleQuickAdd = (product: Product) => {
    onAdd(product);
    setRecentlyAdded(product.id);
    setTimeout(() => setRecentlyAdded(null), 1200);
    inputRef.current?.focus();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 30 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 30 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex-shrink-0 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center ring-1 ring-white/20">
              <Search className="h-6 w-6" />
            </div>
            <div>
              <div className="text-lg font-bold">Find Product</div>
              <div className="text-xs text-blue-100/90">Search by name, SKU, barcode, or supplier</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <kbd className="px-2 py-1 rounded-md bg-white/15 text-[10px] font-mono">F1 to open</kbd>
            <button onClick={onClose} className="h-9 w-9 rounded-lg bg-white/15 hover:bg-white/25 flex items-center justify-center transition">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Search Bar + Group Filters */}
        <div className="flex-shrink-0 px-6 py-3 bg-slate-50 border-b border-slate-200 space-y-2.5">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && filtered.length > 0) {
                  selectProduct(filtered[0].id);
                }
              }}
              placeholder="Type to search products... (Enter to select first result)"
              className="w-full h-12 pl-11 pr-4 rounded-xl bg-white text-slate-800 text-base shadow-sm outline-none ring-2 ring-transparent focus:ring-blue-400 border border-slate-200 transition"
            />
            {query && (
              <button
                onClick={() => { setQuery(""); inputRef.current?.focus(); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full bg-slate-200 hover:bg-slate-300 flex items-center justify-center"
              >
                <X className="h-3.5 w-3.5 text-slate-600" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {stockGroups.map(g => (
              <button
                key={g.id}
                onClick={() => setGroupFilter(g.id)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition",
                  groupFilter === g.id
                    ? "bg-blue-600 text-white shadow-sm"
                    : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100"
                )}
              >
                <span>{g.icon}</span>
                {g.name}
              </button>
            ))}
            <div className="ml-auto text-xs text-slate-500 font-medium">
              {filtered.length} of {products.length} products
            </div>
          </div>
        </div>

        {/* Body: Product List + Detail Panel */}
        <div className="flex-1 overflow-hidden grid grid-cols-3 gap-0">
          {/* Left: Product List (2 cols) */}
          <div className="col-span-2 overflow-y-auto border-r border-slate-200">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                <Search className="h-12 w-12 mb-3 opacity-40" />
                <div className="text-sm font-medium">No products found</div>
                <div className="text-xs mt-1">Try a different search term or group filter</div>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {filtered.map((product, idx) => {
                  const isSelected = selectedProductId === product.id;
                  const justAdded = recentlyAdded === product.id;
                  const lowStock = product.stock <= product.reorderLevel;
                  return (
                    <motion.div
                      key={product.id}
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1, backgroundColor: justAdded ? "#ecfdf5" : isSelected ? "#eff6ff" : "#ffffff" }}
                      transition={{ duration: 0.15, delay: Math.min(idx * 0.01, 0.2) }}
                      onClick={() => selectProduct(product.id)}
                      onDoubleClick={() => handleQuickAdd(product)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          selectProduct(product.id);
                        }
                      }}
                      className={cn(
                        "w-full flex items-center gap-3 px-4 py-2.5 text-left transition cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-blue-400",
                        isSelected ? "ring-2 ring-blue-400 ring-inset" : "hover:bg-slate-50"
                      )}
                    >
                      {/* Emoji */}
                      <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center text-2xl flex-shrink-0">
                        {product.emoji}
                      </div>
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-800 text-sm truncate">{product.name}</span>
                          {product.taxable && (
                            <span className="px-1 py-0.5 rounded bg-amber-100 text-amber-700 text-[9px] font-bold">VAT</span>
                          )}
                          {lowStock && (
                            <span className="px-1 py-0.5 rounded bg-rose-100 text-rose-700 text-[9px] font-bold">LOW</span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono flex items-center gap-2">
                          <span>{product.sku}</span>
                          <span>·</span>
                          <span>{product.barcode}</span>
                        </div>
                      </div>
                      {/* Price + Stock */}
                      <div className="text-right flex-shrink-0">
                        <div className="font-bold text-blue-600 text-sm">{formatGHS(product.price)}</div>
                        <div className="text-[10px] text-slate-400">/{product.unit} · Stock: {product.stock}</div>
                      </div>
                      {/* Quick Add Button */}
                      <button
                        onClick={(e) => { e.stopPropagation(); handleQuickAdd(product); }}
                        className="h-8 w-8 rounded-lg bg-emerald-100 text-emerald-600 hover:bg-emerald-200 flex items-center justify-center transition flex-shrink-0"
                        title="Quick add (1 unit)"
                      >
                        {justAdded ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                      </button>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right: Product Detail Panel (1 col) */}
          <div className="overflow-y-auto bg-slate-50">
            {selectedProduct ? (
              <motion.div
                key={selectedProduct.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="p-5 space-y-4"
              >
                {/* Product Card */}
                <div className="bg-white rounded-xl p-4 shadow-sm ring-1 ring-slate-200 text-center">
                  <div className="h-24 w-24 mx-auto rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center text-6xl mb-3">
                    {selectedProduct.emoji}
                  </div>
                  <div className="font-bold text-slate-800 text-base">{selectedProduct.name}</div>
                  <div className="text-xs text-slate-400 font-mono mt-0.5">{selectedProduct.sku}</div>
                  <div className="text-2xl font-bold text-blue-600 mt-2">{formatGHS(selectedProduct.price)}</div>
                  <div className="text-xs text-slate-500">per {selectedProduct.unit}</div>
                </div>

                {/* Product Details */}
                <div className="bg-white rounded-xl p-4 shadow-sm ring-1 ring-slate-200 space-y-2 text-xs">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Product Details</div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Group</span>
                    <span className="font-semibold text-slate-800">{stockGroups.find(g => g.id === selectedProduct.groupId)?.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Barcode</span>
                    <span className="font-mono text-slate-700">{selectedProduct.barcode}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Supplier</span>
                    <span className="font-semibold text-slate-800">{selectedProduct.supplier}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Batch</span>
                    <span className="font-mono text-slate-700">{selectedProduct.batchNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Cost Price</span>
                    <span className="font-mono text-slate-700">{formatGHS(selectedProduct.costPrice)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">In Stock</span>
                    <span className={cn("font-bold", selectedProduct.stock === 0 ? "text-rose-600" : selectedProduct.stock <= selectedProduct.reorderLevel ? "text-amber-600" : "text-emerald-600")}>
                      {selectedProduct.stock} {selectedProduct.unit}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Reorder Level</span>
                    <span className="font-mono text-slate-700">{selectedProduct.reorderLevel}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Expiry Date</span>
                    <span className="font-mono text-slate-700">{selectedProduct.expiryDate}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Taxable (VAT)</span>
                    <span className="font-semibold text-slate-800">{selectedProduct.taxable ? "Yes" : "No"}</span>
                  </div>
                </div>

                {/* Quantity Selector */}
                <div className="bg-white rounded-xl p-4 shadow-sm ring-1 ring-slate-200">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Quantity to Add</div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setQuantity(q => Math.max(1, q - 1))}
                      className="h-10 w-10 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <input
                      type="number"
                      value={quantity}
                      onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                      min={1}
                      max={selectedProduct.stock}
                      className="flex-1 h-10 text-center text-lg font-bold font-mono border-2 border-slate-200 focus:border-blue-400 rounded-lg outline-none"
                    />
                    <button
                      onClick={() => setQuantity(q => Math.min(selectedProduct.stock, q + 1))}
                      className="h-10 w-10 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-4 gap-1 mt-2">
                    {[1, 5, 10, 20].map(n => (
                      <button
                        key={n}
                        onClick={() => setQuantity(n)}
                        className="py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 transition"
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                  <div className="mt-2 p-2 rounded-lg bg-blue-50 flex justify-between items-center">
                    <span className="text-xs font-semibold text-slate-600">Subtotal</span>
                    <span className="text-lg font-bold font-mono text-blue-600">{formatGHS(selectedProduct.price * quantity)}</span>
                  </div>
                </div>

                {/* Add to Cart Button */}
                <button
                  onClick={handleAddToCart}
                  disabled={selectedProduct.stock === 0}
                  className={cn(
                    "w-full h-12 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition shadow-md",
                    selectedProduct.stock === 0
                      ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                      : "bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:shadow-lg"
                  )}
                >
                  <ShoppingCart className="h-5 w-5" />
                  ADD {quantity} TO CART
                  <span className="ml-1 px-2 py-0.5 rounded bg-white/20 text-xs font-mono">{formatGHS(selectedProduct.price * quantity)}</span>
                </button>
                <div className="text-center text-[10px] text-slate-400">
                  Tip: Double-click any product for quick add (1 unit)
                </div>
              </motion.div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 p-6 text-center">
                <Search className="h-12 w-12 mb-3 opacity-30" />
                <div className="text-sm font-medium">Select a product</div>
                <div className="text-xs mt-1">Click any product from the list to view details and add a custom quantity to the cart</div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-6 py-2.5 bg-white border-t border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 font-mono text-[10px]">↑↓</kbd>
              Navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 font-mono text-[10px]">Enter</kbd>
              Select first
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 font-mono text-[10px]">Esc</kbd>
              Close
            </span>
          </div>
          <Button variant="outline" size="sm" onClick={onClose}>
            Close (Esc)
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ===== Stock List Popup (smaller window, triggered by Part No. input) =====
function StockListPopup({ products, searchText, onSelect, onClose, onNew }: {
  products: Product[];
  searchText: string;
  onSelect: (product: Product) => void;
  onClose: () => void;
  onNew: () => void;
}) {
  const { toast } = useToast();
  const [query, setQuery] = useState(searchText);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, []);

  // Filter products based on query
  const filtered = useMemo(() => {
    const q = (query || searchText).toLowerCase().trim();
    if (!q) return products;
    return products.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      p.barcode.includes(q)
    );
  }, [products, query, searchText]);

  const handleSelect = () => {
    if (filtered[selectedIndex]) {
      onSelect(filtered[selectedIndex]);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/40 flex items-start justify-center pt-16 z-50"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: -20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: -20 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-lg shadow-2xl overflow-hidden flex flex-col"
        style={{ width: '100%', maxWidth: '700px', maxHeight: '85vh', fontFamily: 'Arial, Helvetica, sans-serif' }}
      >
        {/* Title Bar */}
        <div className="flex-shrink-0 flex items-center justify-between px-3 h-7 text-white" style={{ backgroundColor: '#5B9BD5' }}>
          <span className="text-xs font-bold">Stock List</span>
          <button onClick={onClose} className="h-5 w-5 rounded hover:bg-white/25 flex items-center justify-center transition">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Search Section */}
        <div className="flex-shrink-0 px-3 py-1.5 bg-white border-b border-slate-300 flex items-center gap-2">
          <label className="text-[10px] font-bold text-slate-700">Search:</label>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0); }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSelect();
              if (e.key === 'Escape') onClose();
              if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex(i => Math.min(filtered.length - 1, i + 1)); }
              if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex(i => Math.max(0, i - 1)); }
            }}
            placeholder="Type to search..."
            className="flex-1 h-7 px-2 text-xs border border-slate-400 rounded outline-none focus:ring-2 focus:ring-blue-400"
          />
          <button
            onClick={() => setSelectedIndex(0)}
            className="h-7 px-3 rounded border border-slate-400 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
          >
            Search
          </button>
        </div>

        {/* Filter Section */}
        <div className="flex-shrink-0 px-3 py-1 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
          <label className="text-[10px] font-bold text-slate-700">Filter By:</label>
          <select className="h-6 px-1 text-[10px] border border-slate-300 rounded bg-white outline-none">
            <option>All Groups</option>
            <option>Groceries</option>
            <option>Confectionery</option>
            <option>Soft Drinks</option>
            <option>Hard Liquor</option>
            <option>Households</option>
          </select>
          <span className="text-[10px] text-slate-500 ml-auto font-mono">{filtered.length} of {products.length} products</span>
        </div>

        {/* Data Table */}
        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          {/* Table Header — blue */}
          <div className="flex-shrink-0 grid grid-cols-[130px_1fr_45px_80px_80px_80px] gap-1 px-2 py-1 text-[10px] font-bold text-white" style={{ backgroundColor: '#4A90E2' }}>
            <div>Part No</div>
            <div>Item Details</div>
            <div className="text-right">Qty</div>
            <div className="text-right">Retail GHC</div>
            <div className="text-right">Trade GHC</div>
            <div className="text-right">Cost GHC</div>
          </div>

          {/* Table Body */}
          <ScrollArea className="flex-1 min-h-0">
            <div>
              {filtered.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">No products found</div>
              ) : (
                filtered.map((p, idx) => {
                  const isSelected = idx === selectedIndex;
                  return (
                    <div
                      key={p.id}
                      onClick={() => setSelectedIndex(idx)}
                      onDoubleClick={() => onSelect(p)}
                      className="grid grid-cols-[130px_1fr_45px_80px_80px_80px] gap-1 px-2 py-1 text-[10px] cursor-pointer border-b border-slate-100"
                      style={{
                        backgroundColor: isSelected ? '#D6E8FF' : (idx % 2 === 1 ? '#F8F8F8' : '#FFFFFF'),
                        color: '#000000',
                      }}
                    >
                      <div className="font-mono truncate">{p.barcode}</div>
                      <div className="truncate">{p.emoji} {p.name}</div>
                      <div className="text-right font-mono">{p.stock}</div>
                      <div className="text-right font-mono">{p.price.toFixed(2)}</div>
                      <div className="text-right font-mono">{p.costPrice.toFixed(2)}</div>
                      <div className="text-right font-mono">{p.costPrice.toFixed(2)}</div>
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Action Buttons */}
        <div className="flex-shrink-0 px-3 py-1.5 flex items-center gap-1.5 border-t border-slate-300" style={{ backgroundColor: '#E0F0E8' }}>
          <button onClick={handleSelect} className="h-7 px-3 rounded text-white text-[10px] font-semibold flex items-center gap-1" style={{ backgroundColor: '#4CAF50' }}>
            <Check className="h-3 w-3" /> Select (Enter)
          </button>
          <button onClick={onNew} className="h-7 px-3 rounded text-white text-[10px] font-semibold flex items-center gap-1" style={{ backgroundColor: '#2196F3' }}>
            <Plus className="h-3 w-3" /> New
          </button>
          <button onClick={() => { if (!filtered[selectedIndex]) { toast({ title: "Select a product first", variant: "destructive" }); return; } toast({ title: "Product Picture", description: `${filtered[selectedIndex].emoji} ${filtered[selectedIndex].name}` }); }} className="h-7 px-3 rounded text-white text-[10px] font-semibold flex items-center gap-1" style={{ backgroundColor: '#9E9E9E' }}>
            <ImageIcon className="h-3 w-3" /> Picture
          </button>
          <button onClick={() => { if (!filtered[selectedIndex]) { toast({ title: "Select a product first", variant: "destructive" }); return; } toast({ title: "Product History", description: `${filtered[selectedIndex].name} (${filtered[selectedIndex].sku})` }); }} className="h-7 px-3 rounded text-white text-[10px] font-semibold flex items-center gap-1" style={{ backgroundColor: '#FF9800' }}>
            <History className="h-3 w-3" /> History
          </button>
          <button onClick={() => { if (!filtered[selectedIndex]) { toast({ title: "Select a product first", variant: "destructive" }); return; } toast({ title: "Printing (F3)", description: `Printing label for ${filtered[selectedIndex].name}` }); }} className="h-7 px-3 rounded text-white text-[10px] font-semibold flex items-center gap-1" style={{ backgroundColor: '#9C27B0' }}>
            <Printer className="h-3 w-3" /> Print (F3)
          </button>
          <div className="flex-1" />
          <button onClick={onClose} className="h-7 px-3 rounded text-white text-[10px] font-semibold flex items-center gap-1" style={{ backgroundColor: '#F44336' }}>
            <X className="h-3 w-3" /> Close (Esc)
          </button>
        </div>

        {/* Status Bar */}
        <div className="flex-shrink-0 px-3 py-0.5 text-[9px] text-slate-600 flex items-center gap-3" style={{ backgroundColor: '#E0E0E0' }}>
          <span className="font-mono">{filtered.length} of {products.length}</span>
          <span>Source: Main Store</span>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ===== Cart Preview Modal =====
function CartPreviewModal({
  cart, subtotal, discountAmount, globalDiscount, taxAmount, total, totalItems,
  invoiceNumber, customerName, cashier,
  onUpdateQuantity, onRemoveLine, onApplyDiscount, onSetGlobalDiscount, onClearDiscount,
  onClose, onProceedToPayment, onContinueShopping, onClearCart,
}: {
  cart: CartItem[];
  subtotal: number;
  discountAmount: number;
  globalDiscount: number;
  taxAmount: number;
  total: number;
  totalItems: number;
  invoiceNumber: string;
  customerName: string;
  cashier: string;
  onUpdateQuantity: (index: number, qty: number) => void;
  onRemoveLine: (index: number) => void;
  onApplyDiscount: (index: number, discount: number) => void;
  onSetGlobalDiscount: (value: number) => void;
  onClearDiscount: () => void;
  onClose: () => void;
  onProceedToPayment: () => void;
  onContinueShopping: () => void;
  onClearCart: () => void;
}) {
  const [confirmClear, setConfirmClear] = useState(false);
  const taxRatePercent = TAX_RATE * 100;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 30 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 30 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex-shrink-0 bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center ring-1 ring-white/20">
              <Eye className="h-6 w-6" />
            </div>
            <div>
              <div className="text-lg font-bold">Cart Preview</div>
              <div className="text-xs text-purple-100/90">Review items before payment · Invoice #{invoiceNumber}</div>
            </div>
          </div>
          <button onClick={onClose} className="h-9 w-9 rounded-lg bg-white/15 hover:bg-white/25 flex items-center justify-center transition">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Order Meta */}
        <div className="flex-shrink-0 px-6 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-4 text-xs text-slate-600">
            <span className="flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 text-slate-400" />
              <span className="font-semibold text-slate-700">Cashier:</span> {cashier}
            </span>
            <span className="flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 text-slate-400" />
              <span className="font-semibold text-slate-700">Customer:</span> {customerName || "Walk-in customer"}
            </span>
            <span className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-slate-400" />
              <span className="font-semibold text-slate-700">Date:</span> {new Date().toLocaleDateString('en-GB')}
            </span>
          </div>
          <Badge variant="secondary" className="bg-violet-100 text-violet-700">
            {totalItems} items · {cart.length} lines
          </Badge>
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          {cart.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-20 text-slate-400">
              <ShoppingCart className="h-12 w-12 mb-3 opacity-40" />
              <div className="text-sm font-medium">Cart is empty</div>
              <div className="text-xs mt-1">Add products to the cart first</div>
            </div>
          ) : (
            <>
              {/* Table Header */}
              <div className="flex-shrink-0 grid grid-cols-[40px_1fr_80px_90px_70px_90px_40px] gap-2 px-5 py-2 bg-slate-800 text-white text-[10px] font-semibold uppercase tracking-wide">
                <div className="text-center">#</div>
                <div>Item</div>
                <div className="text-center">Qty</div>
                <div className="text-right">Price</div>
                <div className="text-center">Disc%</div>
                <div className="text-right">Total</div>
                <div></div>
              </div>

              {/* Items List */}
              <ScrollArea className="flex-1 min-h-0">
                <div className="divide-y divide-slate-100">
                  <AnimatePresence mode="popLayout">
                    {cart.map((item, index) => {
                      const lineTotal = item.price * item.quantity;
                      const lineDiscount = lineTotal * (item.discount / 100);
                      const lineFinal = lineTotal - lineDiscount;
                      return (
                        <motion.div
                          key={item.id}
                          layout
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0, height: 0 }}
                          className="grid grid-cols-[40px_1fr_80px_90px_70px_90px_40px] gap-2 px-5 py-2.5 items-center text-sm transition hover:bg-slate-50"
                        >
                          {/* Line # */}
                          <div className="text-center text-[11px] font-mono text-slate-400">{index + 1}</div>
                          {/* Item */}
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-2xl flex-shrink-0">{item.emoji}</span>
                            <div className="min-w-0">
                              <div className="font-semibold text-slate-800 truncate">{item.name}</div>
                              <div className="text-[10px] text-slate-400 font-mono">
                                {item.sku} · {item.unit}
                                {item.taxable && <span className="ml-1 px-1 py-0.5 rounded bg-amber-100 text-amber-700 text-[9px] font-bold">VAT</span>}
                              </div>
                            </div>
                          </div>
                          {/* Qty */}
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => onUpdateQuantity(index, item.quantity - 1)}
                              className="h-6 w-6 rounded bg-slate-200 hover:bg-slate-300 flex items-center justify-center transition"
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <span className="w-8 text-center font-mono font-semibold text-slate-700 text-xs">
                              {item.quantity.toFixed(item.unit === 'kg' ? 2 : 0)}
                            </span>
                            <button
                              onClick={() => onUpdateQuantity(index, item.quantity + 1)}
                              className="h-6 w-6 rounded bg-slate-200 hover:bg-slate-300 flex items-center justify-center transition"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                          {/* Price */}
                          <div className="text-right font-mono text-slate-700 text-xs">{formatGHS(item.price)}</div>
                          {/* Discount */}
                          <div className="text-center">
                            <input
                              type="number"
                              value={item.discount || ''}
                              onChange={(e) => onApplyDiscount(index, parseFloat(e.target.value) || 0)}
                              placeholder="0"
                              className="w-12 text-center text-[11px] bg-transparent border-b border-slate-200 focus:border-violet-400 outline-none font-mono"
                            />
                          </div>
                          {/* Line Total */}
                          <div className="text-right font-mono font-semibold text-slate-900">{formatGHS(lineFinal)}</div>
                          {/* Remove */}
                          <button
                            onClick={() => onRemoveLine(index)}
                            className="h-7 w-7 rounded-md bg-rose-100 text-rose-600 hover:bg-rose-200 flex items-center justify-center transition mx-auto"
                            title="Remove line"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              </ScrollArea>
            </>
          )}
        </div>

        {/* Totals + Actions */}
        {cart.length > 0 && (
          <div className="flex-shrink-0 border-t border-slate-200 bg-white">
            {/* Totals Row */}
            <div className="grid grid-cols-2 gap-0">
              {/* Left: Discount Controls */}
              <div className="p-4 bg-slate-50 border-r border-slate-200">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2">Global Discount</div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={globalDiscount || ''}
                    onChange={(e) => onSetGlobalDiscount(parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    className="w-20 h-9 px-2 text-center font-mono font-bold border-2 border-slate-200 focus:border-violet-400 rounded-lg outline-none"
                  />
                  <span className="text-sm font-semibold text-slate-600">%</span>
                  {globalDiscount > 0 && (
                    <button
                      onClick={onClearDiscount}
                      className="ml-auto px-2 py-1 rounded-md bg-rose-100 text-rose-600 hover:bg-rose-200 text-[10px] font-semibold transition"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <div className="mt-2 text-[10px] text-slate-500">
                  Applies to entire cart subtotal
                </div>
              </div>
              {/* Right: Totals */}
              <div className="p-4 space-y-1">
                <div className="flex justify-between text-xs text-slate-600">
                  <span>Subtotal ({totalItems} items)</span>
                  <span className="font-mono">{formatGHS(subtotal)}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-xs text-rose-600">
                    <span>Discount{globalDiscount > 0 ? ` (${globalDiscount}%)` : ''}</span>
                    <span className="font-mono">-{formatGHS(discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-xs text-slate-600">
                  <span>{TAX_NAME} ({taxRatePercent.toFixed(0)}%)</span>
                  <span className="font-mono">{formatGHS(taxAmount)}</span>
                </div>
                <div className="flex justify-between items-baseline pt-1 border-t border-slate-200 mt-1">
                  <span className="text-sm font-bold text-slate-800">Total Due</span>
                  <span className="text-2xl font-bold font-mono text-violet-600">{formatGHS(total)}</span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="px-4 py-3 bg-white border-t border-slate-200 grid grid-cols-4 gap-2">
              <button
                onClick={onContinueShopping}
                className="h-12 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm flex items-center justify-center gap-2 transition"
              >
                <ArrowLeft className="h-4 w-4" />
                Continue Shopping
              </button>
              <button
                onClick={() => setConfirmClear(true)}
                className="h-12 rounded-xl bg-rose-100 hover:bg-rose-200 text-rose-700 font-semibold text-sm flex items-center justify-center gap-2 transition"
              >
                <Trash2 className="h-4 w-4" />
                Clear Cart
              </button>
              <button
                onClick={() => window.print()}
                className="h-12 rounded-xl bg-white ring-1 ring-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-sm flex items-center justify-center gap-2 transition"
              >
                <Printer className="h-4 w-4" />
                Print Quote
              </button>
              <button
                onClick={onProceedToPayment}
                className="h-12 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-sm flex items-center justify-center gap-2 transition shadow-md hover:shadow-lg"
              >
                <CreditCard className="h-5 w-5" />
                PROCEED TO PAYMENT
                <kbd className="ml-1 px-1.5 py-0.5 rounded bg-white/20 text-[10px] font-mono">F5</kbd>
              </button>
            </div>
          </div>
        )}

        {/* Empty cart action */}
        {cart.length === 0 && (
          <div className="flex-shrink-0 px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end">
            <Button variant="outline" onClick={onClose}>Close</Button>
          </div>
        )}

        {/* Confirm Clear Dialog */}
        <AnimatePresence>
          {confirmClear && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-10"
              onClick={() => setConfirmClear(false)}
            >
              <motion.div
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.9 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-12 w-12 rounded-full bg-rose-100 flex items-center justify-center">
                    <AlertCircle className="h-6 w-6 text-rose-600" />
                  </div>
                  <div>
                    <div className="font-bold text-slate-800">Clear Cart?</div>
                    <div className="text-xs text-slate-500">This will remove all {cart.length} items from the cart.</div>
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <Button variant="outline" className="flex-1" onClick={() => setConfirmClear(false)}>Cancel</Button>
                  <button
                    onClick={() => { onClearCart(); setConfirmClear(false); }}
                    className="flex-1 h-10 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold text-sm transition"
                  >
                    Yes, Clear Cart
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}

// ===== Receipt Modal =====
function ReceiptModal({ payment, onClose }: { payment: PaymentResult; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, y: 30 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 30 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden max-h-[90vh] flex flex-col"
      >
        <div className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white px-6 py-5 text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring" }}
            className="h-16 w-16 rounded-full bg-white/20 mx-auto flex items-center justify-center mb-2"
          >
            <Check className="h-9 w-9" />
          </motion.div>
          <div className="text-lg font-bold">Payment Successful!</div>
          <div className="text-xs opacity-90 mt-0.5">
            {new Date(payment.timestamp).toLocaleString('en-GB')}
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="px-6 py-4 font-mono text-xs">
            <div className="text-center mb-3">
              <div className="font-bold text-sm text-slate-800">{COMPANY.name}</div>
              <div className="text-slate-500">{COMPANY.address}</div>
              <div className="text-slate-500">{COMPANY.contact}</div>
            </div>
            <Separator className="my-2" />
            <div className="flex justify-between text-slate-600">
              <span>Invoice:</span>
              <span>#{payment.invoiceNumber}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Cashier:</span>
              <span>{payment.cashier}</span>
            </div>
            {payment.customer && (
              <div className="flex justify-between text-slate-600">
                <span>Customer:</span>
                <span>{payment.customer}</span>
              </div>
            )}
            <div className="flex justify-between text-slate-600">
              <span>Method:</span>
              <span className="capitalize">{payment.method}</span>
            </div>
            <Separator className="my-2" />
            <div className="space-y-1">
              {payment.items.map(item => {
                const lineTotal = item.price * item.quantity;
                const lineDiscount = lineTotal * (item.discount / 100);
                return (
                  <div key={item.id}>
                    <div className="flex justify-between text-slate-700">
                      <span className="truncate flex-1">{item.emoji} {item.name}</span>
                      <span>{formatGHS(lineTotal - lineDiscount)}</span>
                    </div>
                    <div className="text-slate-400 text-[10px] pl-5">
                      {item.quantity} × {formatGHS(item.price)}
                      {item.discount > 0 && ` (-${item.discount}%)`}
                    </div>
                  </div>
                );
              })}
            </div>
            <Separator className="my-2" />
            <div className="space-y-0.5">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal:</span>
                <span>{formatGHS(payment.subtotal)}</span>
              </div>
              {payment.discount > 0 && (
                <div className="flex justify-between text-rose-600">
                  <span>Discount:</span>
                  <span>-{formatGHS(payment.discount)}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-600">
                <span>{TAX_NAME}:</span>
                <span>{formatGHS(payment.tax)}</span>
              </div>
              <div className="flex justify-between font-bold text-slate-800 text-sm pt-1">
                <span>TOTAL:</span>
                <span>{formatGHS(payment.total)}</span>
              </div>
              <Separator className="my-1.5" />
              <div className="flex justify-between text-slate-600">
                <span>Paid ({payment.method}):</span>
                <span>{formatGHS(payment.amountPaid)}</span>
              </div>
              {payment.change > 0 && (
                <div className="flex justify-between font-bold text-emerald-600">
                  <span>Change:</span>
                  <span>{formatGHS(payment.change)}</span>
                </div>
              )}
            </div>
            <Separator className="my-2" />
            <div className="text-center text-slate-500 text-[10px] mt-3">
              <div className="font-bold">Thank you for shopping!</div>
              <div>Have a fresh &amp; healthy day 🌿</div>
              <div className="mt-1">Returns within 7 days with receipt</div>
            </div>
          </div>
        </ScrollArea>

        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex gap-2">
          <button
            onClick={() => window.print()}
            className="flex-1 h-11 rounded-xl bg-white ring-1 ring-slate-200 hover:bg-slate-100 text-slate-700 font-semibold text-sm flex items-center justify-center gap-2 transition"
          >
            <Printer className="h-4 w-4" />
            Print
          </button>
          <button
            onClick={onClose}
            className="flex-1 h-11 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold text-sm flex items-center justify-center gap-2 hover:shadow-lg transition"
          >
            <Check className="h-4 w-4" />
            New Sale
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ===== Utilities =====
function generateInvoice(): string {
  const num = Math.floor(100000 + Math.random() * 900000);
  const check = Math.floor(Math.random() * 90 + 10);
  return `${num} F${check}`;
}
