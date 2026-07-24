'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useTheme } from "next-themes";
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
  Smartphone, RefreshCw, Sparkles, Loader2, AlertTriangle, Calculator as CalcIcon, Mail, Send,
  ExternalLink, Moon, Sun,
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
import { MobileNav } from "@/components/mobile-nav";
import { BarcodeScanner } from "@/components/barcode-scanner";
import { ManagerApproval } from "@/components/manager-approval";
import { PrinterPairing } from "@/components/printer-pairing";
import { AiAssistant } from "@/components/ai-assistant";
import { SpeedDial } from "@/components/speed-dial";
import { saveCart, loadCart, clearCart as clearPersistedCart } from "@/lib/cart-persistence";
import { saveSessionToken, clearSessionToken, getSessionToken, authedFetch } from "@/lib/client-auth";
import { clearAuthState, saveUserSession, getCachedUser, hasUnsavedBusinessData } from "@/lib/session-data";

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
const StockHistoryView = dynamic(() => import("@/components/stock-history").then(m => ({ default: m.StockHistory })), { ssr: false, loading: loadingFallback });
const Reports = dynamic(() => import("@/components/reports").then(m => ({ default: m.Reports })), { ssr: false, loading: loadingFallback });
const PurchaseMenu = dynamic(() => import("@/components/purchase-menu").then(m => ({ default: m.PurchaseMenu })), { ssr: false, loading: loadingFallback });
const TelephoneModule = dynamic(() => import("@/components/telephone-module").then(m => ({ default: m.TelephoneModule })), { ssr: false, loading: loadingFallback });
const TelephoneDirectory = dynamic(() => import("@/components/telephone-directory").then(m => ({ default: m.TelephoneDirectory })), { ssr: false, loading: loadingFallback });
const MaintenanceModule = dynamic(() => import("@/components/maintenance-module").then(m => ({ default: m.MaintenanceModule })), { ssr: false, loading: loadingFallback });
const EmailSystem = dynamic(() => import("@/components/email-system").then(m => ({ default: m.EmailSystem })), { ssr: false, loading: loadingFallback });
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
const FeaturesMap = dynamic(() => import("@/components/features-map").then(m => ({ default: m.FeaturesMap })), { ssr: false, loading: loadingFallback });
const AdminHub = dynamic(() => import("@/components/admin-hub").then(m => ({ default: m.AdminHub })), { ssr: false, loading: loadingFallback });
const CreditManagement = dynamic(() => import("@/components/credit-management").then(m => ({ default: m.CreditManagement })), { ssr: false, loading: loadingFallback });
const AutoReplenishRules = dynamic(() => import("@/components/auto-replenish-rules").then(m => ({ default: m.AutoReplenishRules })), { ssr: false, loading: loadingFallback });
const ReportsCenter = dynamic(() => import("@/components/reports-center").then(m => ({ default: m.ReportsCenter })), { ssr: false, loading: loadingFallback });
const KeyboardShortcutsOverlay = dynamic(() => import("@/components/keyboard-shortcuts").then(m => ({ default: m.KeyboardShortcutsOverlay })), { ssr: false });

// ===== Server → Client product transformer =====
// The /api/products endpoint returns Prisma-shaped products (with `quantity`
// instead of `stock`, nested `group` object, ISO date strings, etc.).
// This function converts them to the legacy `Product` shape used by the UI.

/**
 * Fuzzy product lookup by barcode or SKU.
 * Used by: POS scanner, keypad barcode mode, Part No input.
 *
 * Matching strategy (tries each in order, returns first match):
 *   1. Exact barcode match (trimmed)
 *   2. Exact SKU match (case-insensitive, trimmed)
 *   3. Normalized barcode match (strip spaces/dashes/leading zeros)
 *   4. Barcode "contains" match (scanned code contains stored barcode or vice versa)
 *   5. SKU "contains" match (partial SKU)
 *
 * This handles common scan issues:
 *   - Extra whitespace from scanner
 *   - Case differences (COKE-500 vs coke-500)
 *   - Leading zero differences (EAN-13 vs UPC-A)
 *   - QR codes that embed the barcode with extra text
 */
function findProductByCode(products: Product[], code: string): Product | undefined {
  if (!code) return undefined;
  const trimmed = code.trim();
  if (!trimmed) return undefined;
  const lower = trimmed.toLowerCase();
  const normalized = trimmed.replace(/[\s-]/g, "").replace(/^0+/, "");

  // 1. Exact barcode match (trimmed)
  let product = products.find(p => p.barcode === trimmed);
  if (product) return product;

  // 2. Exact SKU match (case-insensitive)
  product = products.find(p => p.sku.toLowerCase() === lower);
  if (product) return product;

  // 3. Normalized barcode match (strip spaces/dashes/leading zeros)
  if (normalized) {
    product = products.find(p => {
      const pNorm = (p.barcode || "").replace(/[\s-]/g, "").replace(/^0+/, "");
      return pNorm && pNorm === normalized;
    });
    if (product) return product;
  }

  // 4. Barcode "contains" match — handles QR codes with extra text
  //    e.g. QR contains "Product: 6034000181036" — we match on "6034000181036"
  product = products.find(p => {
    if (!p.barcode) return false;
    return trimmed.includes(p.barcode) || p.barcode.includes(trimmed);
  });
  if (product) return product;

  // 5. SKU "contains" match (partial)
  product = products.find(p => {
    if (!p.sku) return false;
    return lower.includes(p.sku.toLowerCase()) || p.sku.toLowerCase().includes(lower);
  });
  return product;
}

function serverProductToClientProduct(sp: any): Product {
  return {
    id: sp.id,
    sku: sp.sku || "",
    name: sp.name || "",
    price: Number(sp.price) || 0,
    costPrice: Number(sp.costPrice) || 0,
    category: sp.category || "other",
    groupId: sp.groupId || "",
    unit: sp.unit || "each",
    stock: Number(sp.quantity) || 0,  // Prisma uses `quantity`, UI uses `stock`
    quantity: Number(sp.quantity) || 0,
    reorderLevel: Number(sp.reorderLevel) || 5,
    barcode: sp.barcode || "",
    emoji: sp.emoji || "📦",
    taxable: sp.taxable !== false,
    batchNumber: sp.batchNumber || "",
    receivedDate: sp.receivedDate || "",
    expiryDate: sp.expiryDate || "",
    supplier: sp.suppliers?.[0]?.supplier?.name || "",
    active: sp.active !== false,
  };
}

export default function POSPage() {
  // ===== Top-level View State =====
  const [view, setView] = useState<ViewMode>("login");
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  // ===== Shared Data State =====
  // Products are fetched from the server on login and refreshed every 30s.
  const [products, setProducts] = useState<Product[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('sylhn-products-cache');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed as Product[];
        }
      } catch {}
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
  // Premium: barcode scanner modal (mobile camera scanner)
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  // Premium: manager approval modal (for voids > GHS 100)
  const [approvalRequest, setApprovalRequest] = useState<{
    title: string;
    description: string;
    action: "void" | "refund" | "discount" | "delete";
    amount?: number;
    reason?: string;
    onApproved: () => void;
  } | null>(null);
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  // Premium: Bluetooth printer pairing modal
  const [showPrinterPairing, setShowPrinterPairing] = useState(false);
  // Premium: AI Business Assistant
  const [showAiAssistant, setShowAiAssistant] = useState(false);
  // Premium: Quick Keys bar
  const [quickKeys, setQuickKeys] = useState<any[]>([]);
  // Premium: Dark mode — synced with next-themes (persists, hydrates safely)
  const { theme, setTheme } = useTheme();
  const [darkMode, setDarkMode] = useState(false);

  // Keep local darkMode state in sync with next-themes (after mount)
  useEffect(() => {
    setDarkMode(document.documentElement.classList.contains("dark"));
  }, [theme]);
  // Premium: Cash denomination calculator
  const [showCashCalc, setShowCashCalc] = useState(false);
  const [showStdCalc, setShowStdCalc] = useState(false);
  // Premium: Price tags printer
  const [showPriceTags, setShowPriceTags] = useState(false);
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
  const [initialStockView, setInitialStockView] = useState<"stock-file" | "stock-search" | "add-modify" | "group-maintenance" | "quantity-adjustment" | "history">("add-modify");
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
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  // ===== Persist session-only state to localStorage =====
  // ROBUST DATA PERSISTENCE — survives logout/login, page refresh, browser restart.
  //
  // What we persist:
  //   - history:        local stock movement log
  //   - heldOrders:     parked carts (for recall)
  //   - dailyTotal:     today's gross sales (header display)
  //   - transactionCount: today's transaction count (header display)
  //   - products-cache: offline product list (so the POS grid isn't empty
  //                     after logout/login or refresh — the server refresh
  //                     will overwrite with fresh data within 30s)
  //   - groups:         stock groups (so Stock Management view isn't empty)
  //
  // The products-cache is written DEBOUNCED (500ms) because product arrays
  // can be large and we don't want to write on every keystroke during edits.
  useEffect(() => { try { localStorage.setItem('sylhn-history', JSON.stringify(history)); } catch {} }, [history]);
  useEffect(() => { try { localStorage.setItem('sylhn-held-orders', JSON.stringify(heldOrders)); } catch {} }, [heldOrders]);
  useEffect(() => { try { localStorage.setItem('sylhn-daily-total', String(dailyTotal)); } catch {} }, [dailyTotal]);
  useEffect(() => { try { localStorage.setItem('sylhn-txn-count', String(transactionCount)); } catch {} }, [transactionCount]);

  // Debounced persistence for products (large array — don't write on every change)
  const productsSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (productsSaveTimer.current) clearTimeout(productsSaveTimer.current);
    productsSaveTimer.current = setTimeout(() => {
      try {
        // Always cache — even an empty array — so that wiped data clears
        // the cache instead of leaving stale products in localStorage.
        // (Previous guard `products.length > 0` prevented cache clearing.)
        if (Array.isArray(products)) {
          localStorage.setItem('sylhn-products-cache', JSON.stringify(products));
        }
      } catch { /* localStorage may be full — silently ignore */ }
    }, 500);
    return () => { if (productsSaveTimer.current) clearTimeout(productsSaveTimer.current); };
  }, [products]);

  // Debounced persistence for groups
  const groupsSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (groupsSaveTimer.current) clearTimeout(groupsSaveTimer.current);
    groupsSaveTimer.current = setTimeout(() => {
      try {
        if (groups && groups.length > 0) {
          localStorage.setItem('sylhn-groups', JSON.stringify(groups));
        }
      } catch { /* ignore */ }
    }, 500);
    return () => { if (groupsSaveTimer.current) clearTimeout(groupsSaveTimer.current); };
  }, [groups]);

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

  // ===== Hardware back-button navigation (Android/PWA) =====
  // Intercepts the browser's back button (and Android hardware back key on
  // PWA) to navigate through app views instead of leaving the app immediately.
  // Navigation history: current view → previous view → POS → confirm exit.
  const viewHistory = useRef<string[]>(["pos"]);

  useEffect(() => {
    // Push current view to history whenever it changes
    viewHistory.current.push(view);
    if (viewHistory.current.length > 20) viewHistory.current.shift(); // cap at 20
  }, [view]);

  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      e.preventDefault();
      // Pop the current view
      viewHistory.current.pop();
      const previousView = viewHistory.current[viewHistory.current.length - 1] || "pos";
      // If we're already at POS (the root), push a new state so the next back
      // press shows the exit confirm
      if (view === "pos" || view === "login") {
        if (confirm("Exit SYLHN POS?")) {
          window.history.back();
          return;
        }
        // Re-push state so the user stays in the app
        window.history.pushState(null, "", window.location.href);
        return;
      }
      // Navigate to the previous view
      setView(previousView as ViewMode);
      // Re-push state so the back button works again
      window.history.pushState(null, "", window.location.href);
    };

    // Push initial state so there's always something to pop
    window.history.pushState(null, "", window.location.href);
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [view]);

  // ===== Session restore on page load =====
  // SECURITY: The app does NOT auto-login. Even if the server session cookie
  // is still valid, the user must re-enter their password (or use biometrics).
  //
  // This is by design for a POS system — every shift should start with an
  // explicit login. The only convenience we offer is biometric authentication
  // (fingerprint/face) which still requires the user to be physically present.
  //
  // The server session IS still validated (so we know if the user needs to
  // see the login screen), but we ALWAYS show the login screen on page load.
  useEffect(() => {
    // Always show the login screen on page load — no auto-login.
    // The server session may still be valid (cookie), but we require
    // explicit authentication every time the app is opened.
    setLoggedInUser(null);
    setView("login");
  }, []);

  useEffect(() => {
    if (!now) return;
    // Update clock every 5 seconds (not every 1 second) — reduces
    // unnecessary re-renders of the entire POS page by 80%.
    // The header shows HH:MM:SS but 5s granularity is visually identical.
    const interval = setInterval(() => setNow(new Date()), 5000);
    return () => clearInterval(interval);
  }, [now]);

  // Close menu on outside click (covers both desktop and mobile menu bars)
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      const insideDesktop = menuRef.current?.contains(target);
      const insideMobile = mobileMenuRef.current?.contains(target);
      if (!insideDesktop && !insideMobile) {
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
  // Debounced search query for performance — avoids re-filtering on every keystroke.
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 200); // 200ms debounce
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const filteredProducts = useMemo(() => {
    let result = products;
    if (activeCategory !== "all") {
      result = result.filter(p => p.category === activeCategory);
    }
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase();
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
        (p.supplier || '').toLowerCase().includes(q)
      );
    }
    // Performance: cap at 100 visible products to avoid rendering thousands of DOM nodes.
    // The user can scroll/search to see more. This keeps the UI fast even with
    // thousands of products in the catalog.
    return result.slice(0, 100);
  }, [activeCategory, debouncedSearch, productSearch, products]);

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

  // Premium: Cart Persistence — save to IndexedDB on every cart change.
  // Skip the clear when the user is logging out (skipCartClear flag) so
  // the IndexedDB cart survives the logout → login cycle for the SAME user.
  // (Different cashiers should clear it — but that's handled in handleLogout.)
  useEffect(() => {
    if (skipCartClear) {
      setSkipCartClear(false);
      return;
    }
    if (cart.length > 0 || customerName) {
      saveCart(cart, customerName, invoiceNumber || '');
    } else {
      clearPersistedCart();
    }
  }, [cart, customerName, invoiceNumber]);

  // Premium: Cart Persistence — restore on login (NOT on every mount)
  // Only restore if there's a logged-in user. This prevents the cart from
  // being restored during the session-restore phase (before login is confirmed)
  // and prevents the cart-clear useEffect from wiping IndexedDB when the user
  // logs out (setCart([]) triggers the save effect which sees empty cart and
  // clears IndexedDB — we skip that when logging out).
  const [skipCartClear, setSkipCartClear] = useState(false);
  useEffect(() => {
    if (!loggedInUser) return; // Don't restore cart before login
    let cancelled = false;
    (async () => {
      const saved = await loadCart();
      if (cancelled || !saved || !saved.cart || saved.cart.length === 0) return;
      setCart(saved.cart);
      if (saved.customerName) setCustomerName(saved.customerName);
      if (saved.invoiceNumber) setInvoiceNumber(saved.invoiceNumber);
      toast({ title: "Cart restored", description: `${saved.cart.length} items recovered from previous session` });
    })();
    return () => { cancelled = true; };
  }, [loggedInUser]);

  // Premium: Quick Keys — fetch top-selling products
  useEffect(() => {
    if (!loggedInUser) return;
    (async () => {
      try {
        const res = await fetch("/api/quick-keys?limit=20", { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          setQuickKeys(data.quickKeys || []);
        }
      } catch {}
    })();
  }, [loggedInUser]);

  // ===== Fetch products from server on login + refresh every 60s =====
  // Performance: increased from 30s to 60s to reduce network traffic.
  // The products are cached in localStorage so they're available instantly
  // on next page load. A manual refresh button is available in the header.
  // CRITICAL: We always update local state with whatever the server returns,
  // including an EMPTY array (e.g. after data wipe). The previous guard
  // `data.products.length > 0` prevented the cache from ever being cleared,
  // so wiped data kept showing up in the UI.
  useEffect(() => {
    if (!loggedInUser) return;
    const fetchProducts = async () => {
      try {
        const res = await authedFetch("/api/products");
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.products)) {
            setProducts(data.products.map(serverProductToClientProduct));
          }
        }
      } catch { /* ignore */ }
    };
    fetchProducts();
    const interval = setInterval(fetchProducts, 60000); // 60s (was 30s)
    return () => clearInterval(interval);
  }, [loggedInUser]);

  // Dark mode is now handled by next-themes (see ThemeProvider in layout.tsx).
  // The local `darkMode` state is kept in sync via the useEffect above.

  const toggleDarkMode = () => {
    // Use next-themes for proper persistence + hydration
    const isDark = document.documentElement.classList.contains("dark");
    setTheme(isDark ? "light" : "dark");
    // local state will sync via the useEffect above
  };

  // Premium: Listen for AI assistant open event (from MobileNav drawer)
  useEffect(() => {
    const handler = () => setShowAiAssistant(true);
    window.addEventListener("sylhn:open-ai", handler);
    return () => window.removeEventListener("sylhn:open-ai", handler);
  }, []);
  // Debounced — only updates 500ms after the last cart change to avoid spamming.
  // Lives AFTER subtotal/total/etc are defined (TDZ-safe).
  useEffect(() => {
    if (!loggedInUser) return;
    const timer = setTimeout(() => {
      fetch('/api/customer-display', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          registerId: 'register-1',
          items: cart.map(item => ({
            emoji: item.emoji,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            total: item.price * item.quantity * (1 - item.discount / 100),
          })),
          subtotal,
          discount: discountAmount,
          tax: taxAmount,
          total,
          customerName: customerName || undefined,
          message: cart.length === 0 ? 'Welcome to SYLHN POS — bring your items to the counter' : undefined,
        }),
      }).catch(() => {}); // Silent — don't pollute console if display is offline
    }, 500);
    return () => clearTimeout(timer);
  }, [cart, subtotal, discountAmount, taxAmount, total, customerName, loggedInUser]);

  // Premium: clear customer display when finishing a sale
  useEffect(() => {
    if (showReceipt && lastPayment) {
      fetch('/api/customer-display', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          registerId: 'register-1',
          items: [],
          subtotal: 0, discount: 0, tax: 0, total: 0,
          message: `Thank you! Your sale of ${formatGHS(lastPayment.total || 0)} was completed.`,
        }),
      }).catch(() => {});
    }
  }, [showReceipt, lastPayment]);

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
    const clamped = Math.min(100, Math.max(0, discount));
    // REINFORCED: ANY discount > 0 requires manager approval.
    // Every digit of discount input triggers the manager password dialog.
    // This prevents cashiers from giving unauthorized discounts.
    const DISCOUNT_THRESHOLD = 0; // 0% = every discount requires approval
    if (clamped > DISCOUNT_THRESHOLD) {
      const item = cart[index];
      if (item) {
        setApprovalRequest({
          title: `Apply ${clamped}% Discount`,
          description: `Discount on "${item.name}" — manager authorization required for ALL discounts.`,
          action: "discount",
          amount: clamped,
          reason: `Line discount ${clamped}% on ${item.name}`,
          onApproved: () => {
            setCart(prev => prev.map((it, i) =>
              i === index ? { ...it, discount: clamped } : it
            ));
            toast({ title: `${clamped}% discount applied`, description: "Manager approval granted" });
          },
        });
        return;
      }
    }
    // 0% discount = no approval needed (removing discount)
    setCart(prev => prev.map((item, i) =>
      i === index ? { ...item, discount: clamped } : item
    ));
  };

  // REINFORCED: global discount > 0 also requires manager approval
  const applyGlobalDiscount = (pct: number) => {
    const clamped = Math.min(100, Math.max(0, pct));
    const DISCOUNT_THRESHOLD = 0; // every discount requires approval
    if (clamped > DISCOUNT_THRESHOLD) {
      setApprovalRequest({
        title: `Apply ${clamped}% Global Discount`,
        description: `Global cart discount — manager authorization required for ALL discounts.`,
        action: "discount",
        amount: clamped,
        reason: `Global discount ${clamped}% on sale ${invoiceNumber}`,
        onApproved: () => {
          setGlobalDiscount(clamped);
          toast({ title: `${clamped}% global discount applied`, description: "Manager approval granted" });
        },
      });
      return;
    }
    // 0% = removing discount, no approval needed
    setGlobalDiscount(clamped);
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
      const product = findProductByCode(products, keypadInput);
      if (product) {
        addToCart(product);
      } else {
        toast({ title: "Product not found", description: `No item with code ${keypadInput}`, variant: "destructive" });
      }
    }
    setKeypadInput("");
  };

  // ===== Function Buttons =====
  // ===== Centralized Logout =====
  // Clears ONLY auth state. Business data (held orders, history, daily totals,
  // product cache, offline sale queue) is PRESERVED so the next login sees
  // the correct state. The cart is cleared (a new cashier shouldn't see the
  // previous cashier's in-progress cart).
  const handleLogout = async (silent = false) => {
    // Call server logout (invalidates the session cookie)
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } catch { /* server unreachable — local logout still works */ }
    // Clear ONLY auth-related localStorage keys (preserve business data)
    clearAuthState();
    clearSessionToken();
    // NOTE: We do NOT clear:
    //   - sylhn-held-orders (held carts for recall)
    //   - sylhn-history (local stock movement log)
    //   - sylhn-daily-total (today's gross sales)
    //   - sylhn-txn-count (today's transaction count)
    //   - sylhn-products-cache (offline product list)
    // These are business data that should survive logout/login.
    // On re-login, the onSuccess handler re-reads them from localStorage.
    //
    // We DO clear the in-progress cart (IndexedDB) — a new cashier starts fresh.
    // But set the skip flag so the cart-save useEffect doesn't re-clear after
    // we already cleared (which would be redundant but also prevents a race
    // where the restore effect re-loads a stale cart).
    setSkipCartClear(true);
    clearPersistedCart();
    // Reset cart React state (but NOT dailyTotal, transactionCount, history, heldOrders)
    setCart([]);
    setSelectedCartIndex(null);
    setGlobalDiscount(0);
    setCustomerName("");
    setInvoiceNumber(generateInvoice());
    // Go to login screen
    setLoggedInUser(null);
    setView("login");
    if (silent) {
      toast({ title: "Goodbye!", description: "Shift ended" });
    } else {
      toast({
        title: "Signed out",
        description: "Your held orders, history, and daily totals are saved.",
      });
    }
  };

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
    // Premium: if void amount > GHS 100, require manager approval
    const VOID_THRESHOLD = 100;
    if (total > VOID_THRESHOLD) {
      setApprovalRequest({
        title: `Void Sale — ${invoiceNumber}`,
        description: `You're voiding a sale of GHS ${total.toFixed(2)} which exceeds the GHS ${VOID_THRESHOLD} threshold. A manager must approve this action.`,
        action: "void",
        amount: total,
        reason: `Void of sale ${invoiceNumber}`,
        onApproved: () => {
          clearCart();
          toast({ title: "Transaction voided (F4)", description: "Manager approval granted", variant: "default" });
        },
      });
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
    // Reduce stock levels locally (optimistic — UI updates immediately).
    // The server has the authoritative count; the 30s refresh will sync.
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
    // stock atomically, and records StockHistory entries.
    // Uses authedFetch so the Bearer token is sent (needed in preview iframe).
    try {
      const res = await authedFetch('/api/sales', {
        method: 'POST',
        body: JSON.stringify({
          invoiceNumber: result.invoiceNumber,
          customerName: result.customer || '',
          cashierName: result.cashier,
          cashierId: loggedInUser?.id || '',
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
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.sale?.id) {
          setLastPayment(prev => prev ? { ...prev, saleId: data.sale.id } : prev);
        }
      } else if (res.status === 401) {
        toast({ title: 'Authentication expired', description: 'Please log in again to save sales', variant: 'destructive' });
      } else if (res.status === 500) {
        // 500 usually means "Unique constraint failed" — the sale was
        // already saved. Don't queue it. Just find the existing sale.
        const errText = await res.text().catch(() => '');
        if (errText.includes('Unique constraint') || errText.includes('already')) {
          // Sale already exists — try to find it
          try {
            const findRes = await authedFetch('/api/sales?limit=50');
            if (findRes.ok) {
              const findData = await findRes.json();
              const existing = (findData.sales || []).find((s: any) => s.invoiceNumber === result.invoiceNumber);
              if (existing) {
                setLastPayment(prev => prev ? { ...prev, saleId: existing.id } : prev);
              }
            }
          } catch { /* ignore */ }
        }
        // For other 500 errors, don't queue — just log
        console.warn('Sale recording server error:', errText.slice(0, 200));
      } else {
        // Other errors (400, 403, etc.) — don't queue, just log
        console.warn('Sale recording failed:', res.status);
      }
    } catch (e) {
      // Network error — the sale couldn't be saved. Don't queue it
      // (the offline queue caused more problems than it solved — duplicate
      // sales, "sync failed" errors, etc.). The sale is still in React
      // state and localStorage (history), so the cashier can see it.
      // The sale can be manually re-entered later if needed.
      console.warn('Sale recording network error:', e);
      toast({
        title: 'Sale completed locally',
        description: 'Could not save to server. Check your connection and try again.',
        variant: 'default',
      });
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
        { label: "📋 Reports Center", icon: FileBarChart, action: () => setView("reports-center" as ViewMode) },
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
        { header: "Browse" },
        { label: "Stock File", icon: FileText, action: () => { setInitialStockView("stock-file"); setView("stock"); } },
        { label: "Stock Search", icon: FileSearch, action: () => { setInitialStockView("stock-search"); setView("stock"); } },
        { header: "Manage" },
        { label: "Add / Modify Stock", icon: Package, action: () => { setInitialStockView("add-modify"); setView("stock"); } },
        { label: "Group Maintenance", icon: Layers, action: () => { setInitialStockView("group-maintenance"); setView("stock"); } },
        ...(hasPermission('canAdjustStock') ? [{ label: "Quantity Adjustment", icon: ArrowUpDown, action: () => { setInitialStockView("quantity-adjustment"); setView("stock"); } }] : []),
        { header: "History" },
        { label: "Stock History", icon: History, action: () => { setInitialStockView("history"); setView("stock"); } },
        { label: "📊 Stock History Pro", icon: TrendingUp, action: () => setView("stock-history-pro") },
        { header: "Reports" },
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
        { header: "Orders" },
        { label: "New Purchase", icon: FileText, action: () => setView("purchase-form") },
        { label: "Purchase Orders", icon: Archive, action: () => setView("purchase") },
        { label: "Receive Stock", icon: Package, action: () => setView("purchase") },
        { header: "Suppliers" },
        { label: "Supplier Directory", icon: Users, action: () => setView("supplier-form") },
        { label: "Supplier Payments", icon: DollarSign, action: () => setView("purchase") },
        { header: "History & Reports" },
        { label: "Purchase History", icon: History, action: () => setView("purchase") },
        { label: "Purchase Report", icon: FileBarChart2, action: () => setView("purchase") },
      ] : [],
    },
    {
      id: "accounts",
      label: "Accounts",
      items: hasPermission('accounts') ? [
        { header: "Sales Reports" },
        { label: "Daily Sales Summary", icon: TrendingUp, action: () => { setAccountsReport("daily-sales"); setView("accounts-reports"); } },
        { label: "Daily Sales Detail", icon: FileText, action: () => { setAccountsReport("daily-sales-detail"); setView("accounts-reports"); } },
        { label: "Monthly Summary", icon: BarChart3, action: () => { setAccountsReport("monthly-summary"); setView("accounts-reports"); } },
        { label: "Monthly Detail", icon: FileBarChart2, action: () => { setAccountsReport("monthly-detail"); setView("accounts-reports"); } },
        { header: "Profit & Tax" },
        { label: "Profit & Loss", icon: BarChart3, action: () => { setAccountsReport("profit-loss"); setView("accounts-reports"); } },
        { label: "VAT Tax Report", icon: Percent, action: () => { setAccountsReport("vat-tax"); setView("accounts-reports"); } },
        { label: "📊 GRA VAT Filing Report (View)", icon: FileText, action: () => { window.open("/api/reports/vat-filing/e-file?format=html&year=" + new Date().getFullYear() + "&month=" + (new Date().getMonth() + 1), "_blank"); } },
        { label: "🖨 GRA VAT Filing (Print)", icon: FileText, action: () => { window.open("/api/reports/vat-filing/e-file?format=print&year=" + new Date().getFullYear() + "&month=" + (new Date().getMonth() + 1), "_blank"); } },
        { separator: true },
        { label: "GRA e-VAT Export (JSON)", icon: FileText, action: () => { window.open("/api/reports/vat-filing/e-file?format=json&year=" + new Date().getFullYear() + "&month=" + (new Date().getMonth() + 1), "_blank"); } },
        { label: "GRA e-VAT Export (XML)", icon: FileText, action: () => { window.open("/api/reports/vat-filing/e-file?format=xml&year=" + new Date().getFullYear() + "&month=" + (new Date().getMonth() + 1), "_blank"); } },
        ...(hasPermission('financeOps') ? [
          { header: "Finance Operations" },
          { label: "Expense Management", icon: Wallet, action: () => { setFinanceTab("expenses"); setView("finance-ops"); } },
          { label: "Cash Reconciliation", icon: Wallet, action: () => { setFinanceTab("cash-recon"); setView("finance-ops"); } },
          { label: "Mobile Money", icon: Smartphone, action: () => { setFinanceTab("mobile-money"); setView("finance-ops"); } },
          { label: "💳 Credit Management", icon: CreditCard, action: () => setView("credit-management" as ViewMode) },
          { label: "🔄 Auto Replenish Rules", icon: RotateCcw, action: () => setView("auto-replenish" as ViewMode) },
        ] : []),
        { header: "Inventory Reports" },
        { label: "Stock Value Report", icon: DollarSign, action: () => { setAccountsReport("stock-value"); setView("accounts-reports"); } },
        { label: "Cost Price Report", icon: FileText, action: () => { setAccountsReport("cost-price"); setView("accounts-reports"); } },
        { label: "Stock Performance", icon: TrendingUp, action: () => { setAccountsReport("stock-performance"); setView("accounts-reports"); } },
        { label: "Stock Group Report", icon: Layers, action: () => { setAccountsReport("stock-group"); setView("accounts-reports"); } },
        { header: "Accounting" },
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
        { header: "System" },
        { label: "System Settings", icon: Settings2, action: () => setView("maintenance") },
        { label: "Backup Database", icon: Database, action: () => setView("maintenance") },
        { label: "📧 Email System", icon: Mail, action: () => setView("email-system" as any) },
        { header: "Security" },
        { label: "User Management", icon: Users, action: () => setView("maintenance") },
        { label: "Security & Permissions", icon: Lock, action: () => setView("maintenance") },
        { label: "Admin Panel", icon: Shield, action: () => setView("admin-login") },
        { header: "Operations" },
        { label: "Cashier Shift", icon: Clock, action: () => setView("maintenance") },
        { header: "About" },
        { label: "About SYLHN POS", icon: Store, action: () => setView("maintenance") },
        { label: "Exit", icon: Power, action: () => handleLogout(true) },
      ] : [
        { label: "Admin Panel", icon: Shield, action: () => setView("admin-login") },
        { separator: true },
        { label: "📧 Email System", icon: Mail, action: () => setView("email-system" as any) },
        { label: "About SYLHN POS", icon: Store, action: () => setView("maintenance") },
        { label: "Exit", icon: Power, action: () => handleLogout(true) },
      ],
    },
  ].filter(m => m.items.length > 0); // Hide empty menus

  // ===== Render Other Views (lazy-loaded for performance) =====
  if (view === "dashboard") {
    return (
      <>
        <OperationsDashboard products={products} onBack={() => setView("pos")} dailyTotal={dailyTotal} transactionCount={transactionCount} />
        <MobileNav
          active={view}
          onNavigate={(v) => { if (v === "cart") setMobileCartOpen(true); else if (v === "dashboard") setView("dashboard"); else if (v === "reports") setView("sales-menu"); else if (v === "pos") setView("pos"); else setView(v as ViewMode); }}
          cartCount={cart.reduce((s, i) => s + i.quantity, 0)}
          user={loggedInUser ? { fullName: loggedInUser.fullName, role: loggedInUser.role } : null}
          onLogout={() => handleLogout()}
        />
      </>
    );
  }
  if (view === "receipt-archive") {
    return (
      <>
        <ReceiptArchive onBack={() => setView("pos")} />
        <MobileNav
          active={view}
          onNavigate={(v) => { if (v === "cart") setMobileCartOpen(true); else if (v === "dashboard") setView("dashboard"); else if (v === "reports") setView("sales-menu"); else if (v === "pos") setView("pos"); else setView(v as ViewMode); }}
          cartCount={cart.reduce((s, i) => s + i.quantity, 0)}
          user={loggedInUser ? { fullName: loggedInUser.fullName, role: loggedInUser.role } : null}
          onLogout={() => handleLogout()}
        />
      </>
    );
  }
  if (view === "features-map") {
    return (
      <>
        <FeaturesMap onBack={() => setView("pos")} onNavigate={(v) => setView(v as ViewMode)} />
        <MobileNav
          active={view}
          onNavigate={(v) => { if (v === "cart") setMobileCartOpen(true); else if (v === "dashboard") setView("dashboard"); else if (v === "reports") setView("sales-menu"); else if (v === "pos") setView("pos"); else setView(v as ViewMode); }}
          cartCount={cart.reduce((s, i) => s + i.quantity, 0)}
          user={loggedInUser ? { fullName: loggedInUser.fullName, role: loggedInUser.role } : null}
          onLogout={() => handleLogout()}
        />
      </>
    );
  }
  if (view === "admin-hub") {
    return (
      <>
        <AdminHub onBack={() => setView("pos")} onNavigate={(v) => setView(v as ViewMode)} userRole={loggedInUser?.role || "cashier"} />
        <MobileNav
          active={view}
          onNavigate={(v) => { if (v === "cart") setMobileCartOpen(true); else if (v === "dashboard") setView("dashboard"); else if (v === "reports") setView("sales-menu"); else if (v === "pos") setView("pos"); else setView(v as ViewMode); }}
          cartCount={cart.reduce((s, i) => s + i.quantity, 0)}
          user={loggedInUser ? { fullName: loggedInUser.fullName, role: loggedInUser.role } : null}
          onLogout={() => handleLogout()}
        />
      </>
    );
  }
  if (view === "email-system") {
    return (
      <>
        <EmailSystem onBack={() => setView("pos")} />
        <MobileNav
          active={view}
          onNavigate={(v) => { if (v === "cart") setMobileCartOpen(true); else if (v === "dashboard") setView("dashboard"); else if (v === "reports") setView("sales-menu"); else if (v === "pos") setView("pos"); else setView(v as ViewMode); }}
          cartCount={cart.reduce((s, i) => s + i.quantity, 0)}
          user={loggedInUser ? { fullName: loggedInUser.fullName, role: loggedInUser.role } : null}
          onLogout={() => handleLogout()}
        />
      </>
    );
  }
  if (view === "stock") {
    return (
      <>
        <StockManagement onBack={() => { setView("pos"); setOpenStockQtyReport(false); }} products={products} setProducts={setProducts} groups={groups} setGroups={setGroups} history={history} setHistory={setHistory} initialView={initialStockView} openQtyReport={openStockQtyReport} onNavigateToPurchase={() => setView("purchase-form")} />
        <MobileNav
          active={view}
          onNavigate={(v) => { if (v === "cart") setMobileCartOpen(true); else if (v === "dashboard") setView("dashboard"); else if (v === "reports") setView("sales-menu"); else if (v === "pos") setView("pos"); else setView(v as ViewMode); }}
          cartCount={cart.reduce((s, i) => s + i.quantity, 0)}
          user={loggedInUser ? { fullName: loggedInUser.fullName, role: loggedInUser.role } : null}
          onLogout={() => handleLogout()}
        />
      </>
    );
  }
  if (view === "stock-history-pro") {
    return (
      <>
        <StockHistoryView onBack={() => setView("pos")} />
        <MobileNav
          active={view}
          onNavigate={(v) => { if (v === "cart") setMobileCartOpen(true); else if (v === "dashboard") setView("dashboard"); else if (v === "reports") setView("sales-menu"); else if (v === "pos") setView("pos"); else setView(v as ViewMode); }}
          cartCount={cart.reduce((s, i) => s + i.quantity, 0)}
          user={loggedInUser ? { fullName: loggedInUser.fullName, role: loggedInUser.role } : null}
          onLogout={() => handleLogout()}
        />
      </>
    );
  }
  if (view === "reports") {
    return (
      <>
        <Reports onBack={() => setView("pos")} products={products} groups={groups} history={history} />
        <MobileNav
          active={view}
          onNavigate={(v) => { if (v === "cart") setMobileCartOpen(true); else if (v === "dashboard") setView("dashboard"); else if (v === "reports") setView("sales-menu"); else if (v === "pos") setView("pos"); else setView(v as ViewMode); }}
          cartCount={cart.reduce((s, i) => s + i.quantity, 0)}
          user={loggedInUser ? { fullName: loggedInUser.fullName, role: loggedInUser.role } : null}
          onLogout={() => handleLogout()}
        />
      </>
    );
  }
  if (view === "purchase") {
    return (
      <>
        <PurchaseMenu
          onBack={() => setView("pos")} products={products}
          onOpenPurchasingForm={() => setView("purchase-form")}
          onOpenSupplierForm={() => setView("supplier-form")}
        />
        <MobileNav
          active={view}
          onNavigate={(v) => { if (v === "cart") setMobileCartOpen(true); else if (v === "dashboard") setView("dashboard"); else if (v === "reports") setView("sales-menu"); else if (v === "pos") setView("pos"); else setView(v as ViewMode); }}
          cartCount={cart.reduce((s, i) => s + i.quantity, 0)}
          user={loggedInUser ? { fullName: loggedInUser.fullName, role: loggedInUser.role } : null}
          onLogout={() => handleLogout()}
        />
      </>
    );
  }
  if (view === "purchase-form") {
    return (
      <>
        <PurchaseForm onBack={() => setView("pos")} products={products} groups={groups} suppliers={initialSuppliers} />
        <MobileNav
          active={view}
          onNavigate={(v) => { if (v === "cart") setMobileCartOpen(true); else if (v === "dashboard") setView("dashboard"); else if (v === "reports") setView("sales-menu"); else if (v === "pos") setView("pos"); else setView(v as ViewMode); }}
          cartCount={cart.reduce((s, i) => s + i.quantity, 0)}
          user={loggedInUser ? { fullName: loggedInUser.fullName, role: loggedInUser.role } : null}
          onLogout={() => handleLogout()}
        />
      </>
    );
  }
  if (view === "telephone") {
    return (
      <>
        <TelephoneModule onBack={() => setView("pos")} products={products} />
        <MobileNav
          active={view}
          onNavigate={(v) => { if (v === "cart") setMobileCartOpen(true); else if (v === "dashboard") setView("dashboard"); else if (v === "reports") setView("sales-menu"); else if (v === "pos") setView("pos"); else setView(v as ViewMode); }}
          cartCount={cart.reduce((s, i) => s + i.quantity, 0)}
          user={loggedInUser ? { fullName: loggedInUser.fullName, role: loggedInUser.role } : null}
          onLogout={() => handleLogout()}
        />
      </>
    );
  }
  if (view === "telephone-directory") {
    return (
      <>
        <div className="h-screen bg-slate-100">
          <TelephoneDirectory onClose={() => setView("pos")} />
        </div>
        <MobileNav
          active={view}
          onNavigate={(v) => { if (v === "cart") setMobileCartOpen(true); else if (v === "dashboard") setView("dashboard"); else if (v === "reports") setView("sales-menu"); else if (v === "pos") setView("pos"); else setView(v as ViewMode); }}
          cartCount={cart.reduce((s, i) => s + i.quantity, 0)}
          user={loggedInUser ? { fullName: loggedInUser.fullName, role: loggedInUser.role } : null}
          onLogout={() => handleLogout()}
        />
      </>
    );
  }
  if (view === "maintenance") {
    return (
      <>
        <MaintenanceModule onBack={() => setView("pos")} cashier={cashier} dailyTotal={dailyTotal} transactionCount={transactionCount} />
        <MobileNav
          active={view}
          onNavigate={(v) => { if (v === "cart") setMobileCartOpen(true); else if (v === "dashboard") setView("dashboard"); else if (v === "reports") setView("sales-menu"); else if (v === "pos") setView("pos"); else setView(v as ViewMode); }}
          cartCount={cart.reduce((s, i) => s + i.quantity, 0)}
          user={loggedInUser ? { fullName: loggedInUser.fullName, role: loggedInUser.role } : null}
          onLogout={() => handleLogout()}
        />
      </>
    );
  }
  if (view === "sold-items") {
    return (
      <>
        <SoldItemsReport onBack={() => setView("pos")} />
        <MobileNav
          active={view}
          onNavigate={(v) => { if (v === "cart") setMobileCartOpen(true); else if (v === "dashboard") setView("dashboard"); else if (v === "reports") setView("sales-menu"); else if (v === "pos") setView("pos"); else setView(v as ViewMode); }}
          cartCount={cart.reduce((s, i) => s + i.quantity, 0)}
          user={loggedInUser ? { fullName: loggedInUser.fullName, role: loggedInUser.role } : null}
          onLogout={() => handleLogout()}
        />
      </>
    );
  }
  if (view === "sales-menu") {
    return (
      <>
        <SalesMenu onBack={() => setView("pos")} />
        <MobileNav
          active={view}
          onNavigate={(v) => { if (v === "cart") setMobileCartOpen(true); else if (v === "dashboard") setView("dashboard"); else if (v === "reports") setView("sales-menu"); else if (v === "pos") setView("pos"); else setView(v as ViewMode); }}
          cartCount={cart.reduce((s, i) => s + i.quantity, 0)}
          user={loggedInUser ? { fullName: loggedInUser.fullName, role: loggedInUser.role } : null}
          onLogout={() => handleLogout()}
        />
      </>
    );
  }
  if (view === "daily-sales") {
    return (
      <>
        <DailySalesReport onBack={() => setView("pos")} dailyTotal={dailyTotal} transactionCount={transactionCount} />
        <MobileNav
          active={view}
          onNavigate={(v) => { if (v === "cart") setMobileCartOpen(true); else if (v === "dashboard") setView("dashboard"); else if (v === "reports") setView("sales-menu"); else if (v === "pos") setView("pos"); else setView(v as ViewMode); }}
          cartCount={cart.reduce((s, i) => s + i.quantity, 0)}
          user={loggedInUser ? { fullName: loggedInUser.fullName, role: loggedInUser.role } : null}
          onLogout={() => handleLogout()}
        />
      </>
    );
  }
  if (view === "sales-history") {
    return (
      <>
        <SalesHistory onBack={() => setView("pos")} />
        <MobileNav
          active={view}
          onNavigate={(v) => { if (v === "cart") setMobileCartOpen(true); else if (v === "dashboard") setView("dashboard"); else if (v === "reports") setView("sales-menu"); else if (v === "pos") setView("pos"); else setView(v as ViewMode); }}
          cartCount={cart.reduce((s, i) => s + i.quantity, 0)}
          user={loggedInUser ? { fullName: loggedInUser.fullName, role: loggedInUser.role } : null}
          onLogout={() => handleLogout()}
        />
      </>
    );
  }
  if (view === "supplier-form") {
    return (
      <>
        <SupplierForm onBack={() => setView("pos")} products={products} />
        <MobileNav
          active={view}
          onNavigate={(v) => { if (v === "cart") setMobileCartOpen(true); else if (v === "dashboard") setView("dashboard"); else if (v === "reports") setView("sales-menu"); else if (v === "pos") setView("pos"); else setView(v as ViewMode); }}
          cartCount={cart.reduce((s, i) => s + i.quantity, 0)}
          user={loggedInUser ? { fullName: loggedInUser.fullName, role: loggedInUser.role } : null}
          onLogout={() => handleLogout()}
        />
      </>
    );
  }
  if (view === "accounts-reports") {
    return (
      <>
        <AccountsReports onBack={() => setView("pos")} products={products} groups={groups} history={history} dailyTotal={dailyTotal} transactionCount={transactionCount} initialReport={accountsReport} />
        <MobileNav
          active={view}
          onNavigate={(v) => { if (v === "cart") setMobileCartOpen(true); else if (v === "dashboard") setView("dashboard"); else if (v === "reports") setView("sales-menu"); else if (v === "pos") setView("pos"); else setView(v as ViewMode); }}
          cartCount={cart.reduce((s, i) => s + i.quantity, 0)}
          user={loggedInUser ? { fullName: loggedInUser.fullName, role: loggedInUser.role } : null}
          onLogout={() => handleLogout()}
        />
      </>
    );
  }
  if (view === "credit-management") {
    return (
      <>
        <CreditManagement />
        <MobileNav
          active={view}
          onNavigate={(v) => { if (v === "cart") setMobileCartOpen(true); else if (v === "dashboard") setView("dashboard"); else if (v === "reports") setView("sales-menu"); else if (v === "pos") setView("pos"); else setView(v as ViewMode); }}
          cartCount={cart.reduce((s, i) => s + i.quantity, 0)}
          user={loggedInUser ? { fullName: loggedInUser.fullName, role: loggedInUser.role } : null}
          onLogout={() => handleLogout()}
        />
      </>
    );
  }
  if (view === "auto-replenish") {
    return (
      <>
        <AutoReplenishRules onBack={() => setView("pos")} />
        <MobileNav
          active={view}
          onNavigate={(v) => { if (v === "cart") setMobileCartOpen(true); else if (v === "dashboard") setView("dashboard"); else if (v === "reports") setView("sales-menu"); else if (v === "pos") setView("pos"); else setView(v as ViewMode); }}
          cartCount={cart.reduce((s, i) => s + i.quantity, 0)}
          user={loggedInUser ? { fullName: loggedInUser.fullName, role: loggedInUser.role } : null}
          onLogout={() => handleLogout()}
        />
      </>
    );
  }
  if (view === "reports-center") {
    return (
      <>
        <ReportsCenter
          onBack={() => setView("pos")}
          onNavigate={(v) => setView(v as ViewMode)}
          onSetAccountsReport={(r) => setAccountsReport(r as any)}
        />
        <MobileNav
          active={view}
          onNavigate={(v) => { if (v === "cart") setMobileCartOpen(true); else if (v === "dashboard") setView("dashboard"); else if (v === "reports") setView("reports-center"); else if (v === "pos") setView("pos"); else setView(v as ViewMode); }}
          cartCount={cart.reduce((s, i) => s + i.quantity, 0)}
          user={loggedInUser ? { fullName: loggedInUser.fullName, role: loggedInUser.role } : null}
          onLogout={() => handleLogout()}
        />
      </>
    );
  }
  if (view === "finance-ops") {
    return (
      <>
        <FinancialOperations onBack={() => setView("pos")} dailyTotal={dailyTotal} initialTab={financeTab} />
        <MobileNav
          active={view}
          onNavigate={(v) => { if (v === "cart") setMobileCartOpen(true); else if (v === "dashboard") setView("dashboard"); else if (v === "reports") setView("sales-menu"); else if (v === "pos") setView("pos"); else setView(v as ViewMode); }}
          cartCount={cart.reduce((s, i) => s + i.quantity, 0)}
          user={loggedInUser ? { fullName: loggedInUser.fullName, role: loggedInUser.role } : null}
          onLogout={() => handleLogout()}
        />
      </>
    );
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
    // If adminUser is null (user navigated here directly without going through
    // admin-login), use the loggedInUser instead, or redirect to admin-login
    const adminUserForPanel = adminUser || (loggedInUser ? {
      id: loggedInUser.id,
      username: loggedInUser.username,
      fullName: loggedInUser.fullName,
      role: loggedInUser.role,
      permissions: loggedInUser.permissions || {},
    } : null);
    if (!adminUserForPanel) {
      setView("admin-login");
      return null;
    }
    return (
      <>
        <AdminPanel currentUser={adminUserForPanel} onBack={() => setView("pos")} />
        <MobileNav
          active={view}
          onNavigate={(v) => { if (v === "cart") setMobileCartOpen(true); else if (v === "dashboard") setView("dashboard"); else if (v === "reports") setView("sales-menu"); else if (v === "pos") setView("pos"); else setView(v as ViewMode); }}
          cartCount={cart.reduce((s, i) => s + i.quantity, 0)}
          user={loggedInUser ? { fullName: loggedInUser.fullName, role: loggedInUser.role } : null}
          onLogout={() => handleLogout()}
        />
      </>
    );
  }

  // ===== Login Screen (required to open the software) =====
  if (view === "login") {
    return (
      <div className="h-screen relative gradient-premium-mesh">
        <AdminLogin
          onSuccess={(user) => {
            saveUserSession(user);
            setLoggedInUser(user);
            setView("pos");
            // Re-read business data from localStorage on login (not just on
            // initial mount). This fixes the issue where daily totals, held
            // orders, and history were lost after logout/login because
            // useState initializers only run once.
            try {
              const cachedDaily = localStorage.getItem('sylhn-daily-total');
              if (cachedDaily) setDailyTotal(parseFloat(cachedDaily) || 0);
              const cachedTxn = localStorage.getItem('sylhn-txn-count');
              if (cachedTxn) setTransactionCount(parseInt(cachedTxn) || 0);
              const cachedHistory = localStorage.getItem('sylhn-history');
              if (cachedHistory) setHistory(JSON.parse(cachedHistory));
              const cachedHeld = localStorage.getItem('sylhn-held-orders');
              if (cachedHeld) setHeldOrders(JSON.parse(cachedHeld));
              // Also reload products and groups from cache so the UI shows
              // the last-known state immediately (server refresh will arrive
              // within 30s and overwrite). This prevents the "data is missing"
              // flash after logout/login.
              const cachedProducts = localStorage.getItem('sylhn-products-cache');
              if (cachedProducts) {
                const parsed = JSON.parse(cachedProducts);
                if (Array.isArray(parsed) && parsed.length > 0) setProducts(parsed);
              }
              const cachedGroups = localStorage.getItem('sylhn-groups');
              if (cachedGroups) {
                const parsed = JSON.parse(cachedGroups);
                if (Array.isArray(parsed) && parsed.length > 0) setGroups(parsed);
              }
            } catch { /* ignore parse errors */ }
            toast({ title: `Welcome, ${user.fullName}`, description: `Logged in as ${user.role}` });
          }}
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
    <div className="min-h-screen w-full gradient-premium-mesh flex flex-col font-sans pb-[72px] lg:pb-0 lg:h-screen lg:overflow-hidden">
      {/* ===== Header Bar with Menu — Premium Glass (responsive) ===== */}
      <header className="header-premium flex-shrink-0 text-white z-30 relative">
        {/* Top row: Logo + Search + Stats (logo only on mobile, full on desktop) */}
        <div className="flex items-center px-3 sm:px-4 py-2 gap-3 sm:gap-4 relative">
          {/* Logo — always visible */}
          <div className="flex items-center gap-2 sm:gap-2.5 flex-shrink-0 min-w-0">
            <div className="relative flex-shrink-0">
              <div className="absolute inset-0 rounded-xl bg-white/20 blur-md" />
              <div className="relative h-9 w-9 sm:h-10 sm:w-10 rounded-xl gradient-premium-glass flex items-center justify-center ring-1 ring-white/30 font-bold text-base sm:text-lg backdrop-blur-md">
                S
              </div>
            </div>
            <div className="min-w-0 hidden min-[400px]:block">
              <div className="font-bold text-sm sm:text-base leading-tight tracking-tight truncate">{COMPANY.name}</div>
              <div className="text-[9px] sm:text-[10px] text-emerald-50/90 leading-tight font-medium truncate">{COMPANY.address} · {COMPANY.contact}</div>
            </div>
          </div>

          {/* Desktop Menu Bar — hidden on mobile (mobile uses the bar below) */}
          <div ref={menuRef} className="hidden lg:flex items-center gap-0.5 flex-shrink-0">
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
                      className="absolute top-full left-0 mt-1 w-64 bg-white rounded-xl shadow-2xl ring-1 ring-slate-200 overflow-hidden z-50 py-1 max-h-[70vh] overflow-y-auto"
                    >
                      {menu.items.map((item, i) => {
                        if ('separator' in item) {
                          return <div key={i} className="h-px bg-slate-100 my-1" />;
                        }
                        if ('header' in item) {
                          return <div key={i} className="px-3 py-1 text-[9px] font-bold uppercase tracking-wider text-slate-400 bg-slate-50/50">{item.header}</div>;
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

          {/* Search — desktop only (mobile has its own search in POS content) */}
          <div className="hidden lg:block flex-1 max-w-xl relative">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                ref={searchInputRef}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products, scan barcode, or enter SKU..."
                className="w-full h-10 pl-11 pr-24 rounded-xl bg-white text-slate-800 text-sm shadow-premium outline-none ring-2 ring-transparent focus:ring-emerald-400/70 transition"
              />
              <button
                onClick={() => setShowBarcodeScanner(true)}
                className={cn("absolute right-1.5 top-1/2 -translate-y-1/2 h-7 px-2.5 rounded-lg flex items-center gap-1 text-[11px] font-semibold transition",
                  "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 active:scale-95")}
                title="Open barcode scanner (camera)"
              >
                <ScanLine className="h-3.5 w-3.5" />
                Scan
              </button>
            </div>
          </div>

          {/* Right: Stats + Logout (compact on mobile, full on desktop) */}
          <div className="flex items-center gap-2 flex-shrink-0 ml-auto">
            <div className="hidden lg:flex items-center gap-2 text-right">
              <div className="px-2.5 py-1 rounded-lg gradient-premium-glass ring-1 ring-white/25 backdrop-blur-md">
                <div className="text-[9px] text-emerald-50/80 font-medium tracking-wide">{now ? now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '--'}</div>
                <div className="text-xs font-mono font-bold tabular">{now ? now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '--:--:--'}</div>
              </div>
              <div className="px-2.5 py-1 rounded-lg gradient-premium-glass ring-1 ring-white/25 backdrop-blur-md">
                <div className="text-[9px] text-emerald-50/80 font-medium tracking-wide">Daily Sales</div>
                <div className="text-xs font-mono font-bold tabular">{formatGHS(dailyTotal)}</div>
              </div>
              <div className="px-2.5 py-1 rounded-lg gradient-premium-glass ring-1 ring-white/25 backdrop-blur-md">
                <div className="text-[9px] text-emerald-50/80 font-medium tracking-wide">Txns</div>
                <div className="text-xs font-mono font-bold tabular">{transactionCount}</div>
              </div>
            </div>
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg gradient-premium-glass ring-1 ring-white/25 backdrop-blur-md">
              <div className="h-7 w-7 rounded-full bg-gradient-to-br from-emerald-300 to-teal-400 ring-1 ring-white/40 flex items-center justify-center text-[10px] font-bold">
                {loggedInUser ? loggedInUser.fullName.charAt(0) : 'S'}
              </div>
              <div className="hidden sm:block">
                <div className="text-[10px] font-bold leading-tight">{loggedInUser ? loggedInUser.fullName : cashier}</div>
                <div className="text-[9px] text-emerald-50/80 capitalize font-medium">{loggedInUser ? loggedInUser.role : 'Cashier'}</div>
              </div>
            </div>
            <InstallButton />
            {/* Premium: Dark Mode toggle — uses Lucide icons, hydrates safely */}
            <button
              onClick={toggleDarkMode}
              className="btn-premium h-9 w-9 rounded-lg gradient-premium-glass hover:bg-white/20 ring-1 ring-white/25 text-white flex items-center justify-center transition flex-shrink-0"
              title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
              {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            {/* Premium: Cash Calculator */}
            <button
              onClick={() => setShowCashCalc(true)}
              className="btn-premium h-9 px-2.5 rounded-lg gradient-premium-glass hover:bg-white/20 ring-1 ring-white/25 text-white text-xs font-bold flex items-center gap-1 transition flex-shrink-0"
              title="Cash Denomination Calculator"
            >
              <DollarSign className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Cash Calc</span>
            </button>
            {/* Premium: Price Tags */}
            <button
              onClick={() => setShowPriceTags(true)}
              className="btn-premium h-9 px-2.5 rounded-lg gradient-premium-glass hover:bg-white/20 ring-1 ring-white/25 text-white text-xs font-bold flex items-center gap-1 transition flex-shrink-0"
              title="Print Price Tags"
            >
              <Printer className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Tags</span>
            </button>
            {/* Premium: AI Assistant button — always visible (mobile + desktop) */}
            <button
              onClick={() => setShowAiAssistant(true)}
              className="btn-premium h-9 w-9 sm:px-3 rounded-lg bg-gradient-to-r from-violet-500/40 to-indigo-500/40 hover:from-violet-500/60 hover:to-indigo-500/60 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition ring-1 ring-white/30 flex-shrink-0"
              title="Ask AI Assistant"
            >
              <Sparkles className="h-4 w-4" /> <span className="hidden sm:inline">AI</span>
            </button>
            <button
              onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: '?' }))}
              className="btn-premium h-9 w-9 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition ring-1 ring-white/20 flex-shrink-0"
              title="Keyboard Shortcuts (?)"
            >
              <span className="text-xs font-bold">?</span>
            </button>
            <button onClick={() => handleLogout()} className="btn-premium h-9 px-3 rounded-lg bg-rose-500/30 hover:bg-rose-500/50 ring-1 ring-rose-300/30 text-white text-xs font-bold flex items-center gap-1.5 transition flex-shrink-0" title="Sign out">
              <LogOut className="h-4 w-4" /> <span>Logout</span>
            </button>
          </div>
        </div>

        {/* ===== Mobile Menu Bar — horizontally scrollable, all 7 menus visible =====
            Premium glass pills with active-state styling. Hidden on desktop
            (desktop uses the dropdown menus in the top row above). */}
        <div ref={mobileMenuRef} className="lg:hidden">
          <div className="border-t border-white/10 bg-black/10 backdrop-blur-md">
            <div className="flex items-center gap-1.5 px-3 py-2 overflow-x-auto scrollbar-hide">
              {menus.filter(m => m.items.length > 0).map(menu => {
                const isOpen = openMenu === menu.id;
                return (
                  <button
                    key={menu.id}
                    onClick={() => setOpenMenu(isOpen ? null : menu.id)}
                    className={cn(
                      "flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition active:scale-95 flex-shrink-0",
                      isOpen
                        ? "bg-white text-emerald-700 shadow-md"
                        : "bg-white/10 text-white hover:bg-white/20 ring-1 ring-white/15"
                    )}
                    style={{ WebkitTapHighlightColor: 'transparent' }}
                  >
                    {menu.label}
                    <ChevronDown className={cn("h-3 w-3 transition-transform", isOpen && "rotate-180")} />
                  </button>
                );
              })}
            </div>
          </div>

          {/* ===== Mobile Dropdown — expands inline below the menu bar ===== */}
          <AnimatePresence>
            {openMenu && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
                className="overflow-hidden bg-white border-t border-slate-200 shadow-xl"
              >
                <div className="py-2 max-h-[60vh] overflow-y-auto">
                  {menus.find(m => m.id === openMenu)?.items.map((item, i) => {
                    if ('separator' in item) {
                      return <div key={i} className="h-px bg-slate-100 my-1.5 mx-4" />;
                    }
                    if ('header' in item) {
                      return <div key={i} className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-50">{item.header}</div>;
                    }
                    return (
                      <button
                        key={i}
                        onClick={() => { item.action(); setOpenMenu(null); }}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-emerald-50 active:bg-emerald-100 text-slate-700 text-sm font-semibold transition text-left group"
                      >
                        <div className="h-8 w-8 rounded-lg bg-emerald-50 group-hover:bg-emerald-100 flex items-center justify-center transition flex-shrink-0">
                          <item.icon className="h-4 w-4 text-emerald-600" />
                        </div>
                        <span className="flex-1">{item.label}</span>
                        {'shortcut' in item && item.shortcut && (
                          <kbd className="text-[10px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{item.shortcut}</kbd>
                        )}
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </header>

      {/* ===== Category Navigation — Premium Pills ===== */}
      <nav className="flex-shrink-0 bg-white/70 backdrop-blur-xl border-b border-slate-200/80 z-20 sticky top-0">
        <div className="flex items-center gap-1.5 px-3 sm:px-4 py-2 overflow-x-auto scrollbar-hide">
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={cn(
                "cat-pill-premium flex-shrink-0 flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap",
                activeCategory === cat.id
                  ? `bg-gradient-to-r ${cat.gradient} text-white active shadow-premium`
                  : "bg-slate-100/80 text-slate-600 hover:bg-slate-200/80 hover:scale-105"
              )}
            >
              <span className="text-base">{cat.icon}</span>
              <span className="sm:hidden">{cat.id === 'confectionery' ? 'Confect.' : cat.id === 'soft-drinks' ? 'Drinks' : cat.id === 'hard-liquor' ? 'Liquor' : cat.id === 'households' ? 'Home' : cat.id === 'groceries' ? 'Grocery' : cat.name}</span>
              <span className="hidden sm:inline">{cat.name}</span>
              {activeCategory === cat.id && cat.id !== "all" && (
                <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px] bg-white/25 text-white border-0">
                  {products.filter(p => p.category === cat.id).length}
                </Badge>
              )}
            </button>
          ))}
        </div>
      </nav>

      {/* ===== Premium: Quick Keys Bar (top-selling products, one-tap add) ===== */}
      {view === "pos" && quickKeys.length > 0 && (
        <div className="quick-keys-bar flex-shrink-0">
          {quickKeys.map((qk, i) => (
            <button key={i} className="quick-key" onClick={() => {
              const product = products.find(p => p.id === qk.productId || p.sku === qk.sku);
              if (product) addToCart(product);
              else toast({ title: "Product not found", variant: "destructive" });
            }} title={`Add ${qk.name}`}>
              <span className="qk-emoji">{qk.emoji}</span>
              <span className="qk-name">{qk.name}</span>
              <span className="qk-price">{formatGHS(qk.price)}</span>
            </button>
          ))}
        </div>
      )}

      {/* ===== Main Content — product grid on LEFT, cart/invoice on RIGHT (desktop) =====
          On mobile: stacked vertically (product grid top, cart below).
          On desktop: side-by-side (product grid left, cart right). */}
      <main className="flex-1 flex flex-col lg:flex-row lg:overflow-hidden p-2 sm:p-3 gap-2 sm:gap-3">
        {/* ===== Product Grid — LEFT side on desktop, TOP on mobile ===== */}
        <section className="flex flex-col card-premium shadow-premium lg:overflow-hidden min-w-0 min-h-0 lg:flex-1">
          <div className="flex-shrink-0 flex items-center justify-between px-3 sm:px-5 py-3 bg-gradient-to-r from-slate-50 to-white border-b border-slate-200/80">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg gradient-premium-emerald flex items-center justify-center shadow-premium-sm">
                  <Package className="h-4 w-4 text-white" />
                </div>
                <h2 className="text-sm sm:text-base font-bold text-slate-800 truncate tracking-tight">
                  {categories.find(c => c.id === activeCategory)?.name || "All Products"}
                </h2>
              </div>
              <Badge variant="outline" className="font-mono text-[10px] sm:text-[11px] flex-shrink-0 bg-white">
                {filteredProducts.length} items
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-500">
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 pulse-ring" />
                Live Inventory
              </span>
              <span className="text-slate-300">·</span>
              <span>Prices in {CURRENCY_CODE}</span>
              <span className="text-slate-300">·</span>
              <span className="hidden sm:inline font-mono font-semibold text-slate-700">Today: {formatGHS(dailyTotal)}</span>
              <span className="text-slate-300 hidden sm:inline">·</span>
              <span className="hidden sm:inline">{transactionCount} txns</span>
              {products.filter(p => p.stock <= p.reorderLevel && p.active !== false).length > 0 && (
                <>
                  <span className="text-slate-300 hidden md:inline">·</span>
                  <span className="hidden md:inline text-amber-600 font-semibold">{products.filter(p => p.stock <= p.reorderLevel && p.active !== false).length} low stock</span>
                </>
              )}
            </div>
          </div>

          {/* Product Search Bar */}
          <div className="flex-shrink-0 px-4 py-2.5 bg-white border-b border-slate-200/80">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder="Search inventory by name, SKU, barcode, or supplier..."
                className="input-premium w-full h-9 pl-10 pr-9 text-sm"
              />
              {productSearch && (
                <button
                  onClick={() => setProductSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full bg-slate-200 hover:bg-slate-300 flex items-center justify-center transition active:scale-90"
                >
                  <X className="h-3.5 w-3.5 text-slate-600" />
                </button>
              )}
            </div>
          </div>

          {/* Product Grid — scrolls, fills remaining space */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 scroll-premium" style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}>
            <div className={cn(
              "grid gap-2.5 sm:gap-3 p-3 sm:p-4",
              showSidebar
                ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5"
                : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7"
            )}>
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
                    onDoubleClick={(e) => {
                      e.preventDefault();
                      // Double-click: add 5 units at once (bulk add)
                      for (let i = 0; i < 5; i++) addToCart(product);
                      toast({ title: `Added 5 × ${product.emoji} ${product.name}`, duration: 1200 });
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      // Right-click / long-press: show stock info
                      toast({
                        title: `${product.emoji} ${product.name}`,
                        description: `Stock: ${product.stock} ${product.unit} · Price: ${formatGHS(product.price)} · SKU: ${product.sku}`,
                      });
                    }}
                    className="product-card-premium flex flex-col items-center text-center"
                  >
                    {inCart && (
                      <div className="absolute top-1.5 right-1.5 z-10 h-6 w-6 rounded-full bg-emerald-500 text-white text-[11px] font-bold flex items-center justify-center shadow-glow-emerald ring-2 ring-white">
                        {inCart.quantity}
                      </div>
                    )}
                    {product.taxable && (
                      <div className="absolute top-1.5 left-1.5 z-10 px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-700 text-[9px] font-bold ring-1 ring-amber-200">
                        VAT
                      </div>
                    )}
                    {lowStock && (
                      <div className="absolute bottom-1.5 left-1.5 z-10 px-1.5 py-0.5 rounded-md bg-rose-100 text-rose-700 text-[9px] font-bold ring-1 ring-rose-200">
                        LOW
                      </div>
                    )}
                    <div className="h-16 w-16 rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center text-4xl mb-2 group-hover:scale-110 transition-transform duration-200 ring-1 ring-slate-100">
                      {product.emoji}
                    </div>
                    <div className="w-full">
                      <div className="text-xs font-semibold text-slate-800 leading-tight line-clamp-2 min-h-[2rem]">
                        {product.name}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5 tabular">
                        {product.sku}
                      </div>
                      <div className="flex items-center justify-between mt-1.5">
                        <div className="text-sm font-bold text-gradient-emerald">
                          {formatGHS(product.price)}
                        </div>
                        <div className="text-[10px] text-slate-400">/{product.unit}</div>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5 tabular">
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
          </div>
        </section>

        {/* ===== Cart/Invoice Panel — RIGHT side on desktop, BELOW on mobile =====
            Shows everything: cart header, client info, part no input, cart items,
            totals, function buttons, and numeric keypad (0-9). */}
        <section className={cn(
          "flex flex-col card-premium shadow-premium-lg transition-all duration-300",
          showSidebar ? "w-full lg:w-[42%] lg:min-w-[400px] lg:flex-none" : "w-0 min-w-0 max-h-0 overflow-hidden opacity-0 lg:w-0"
        )}>
          <AnimatePresence>
            {showSidebar && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col w-full lg:h-full lg:overflow-y-auto scroll-premium"
              >
                {/* Cart Header — Premium Gradient */}
                <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 gradient-premium-emerald text-white relative">
                  <div className="flex items-center gap-2 relative z-10">
                    <div className="h-7 w-7 rounded-lg bg-white/15 ring-1 ring-white/25 flex items-center justify-center backdrop-blur-sm">
                      <Cart className="h-3.5 w-3.5" />
                    </div>
                    <span className="text-xs font-bold tracking-tight">Invoice #{invoiceNumber || '------'}</span>
                  </div>
                  <button onClick={() => setShowSidebar(false)} className="h-7 w-7 rounded-lg hover:bg-white/20 flex items-center justify-center transition active:scale-90">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Invoice Info Bar — horizontal layout, wraps on mobile */}
                <div className="flex-shrink-0 px-3 py-1.5 bg-slate-100 border-b border-slate-300 flex items-center gap-3 text-[10px] flex-wrap">
                  <div className="flex items-center gap-1">
                    <span className="font-semibold text-slate-600">Client:</span>
                    <input
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Walk-in customer"
                      className="w-32 lg:w-48 h-6 px-1.5 border border-slate-300 rounded text-[10px] bg-white outline-none focus:ring-1 focus:ring-blue-400"
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

                {/* Part No. Input — full width */}
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
                        const product = findProductByCode(products, partNoInput);
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

                {/* ===== Cart layout: items on top, totals+buttons below (stacked) ===== */}
                <div className="flex flex-col">
                  {/* Cart Items Table */}
                  <div className="flex-1 flex flex-col min-h-0 max-h-[25vh] lg:max-h-[30vh]">
                    {/* Table Header — mobile: all columns visible, matching item grid */}
                    <div className="flex-shrink-0 grid grid-cols-[1fr_50px_45px_55px_20px] lg:grid-cols-[140px_1fr_60px_90px_50px_90px] gap-1 px-2 py-1.5 text-[9px] font-bold text-slate-600 border-b-2 border-slate-300 bg-slate-100 uppercase tracking-wide">
                      <div className="lg:hidden">Item</div>
                      <div className="hidden lg:block">Part No.</div>
                      <div className="hidden lg:block">Part Details</div>
                      <div className="text-center">Qty</div>
                      <div className="text-center hidden lg:block">Price</div>
                      <div className="text-center">Disc%</div>
                      <div className="text-right">Total</div>
                      <div className="lg:hidden"></div>
                    </div>

                    {/* Items List — scrolls */}
                    <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 no-scrollbar" style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}>
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
                                className={cn("cursor-pointer transition-colors px-2 py-1.5")}
                                style={{
                                  backgroundColor: isSelected ? '#E3F2FD' : (index % 2 === 1 ? '#FAFAFA' : '#FFFFFF'),
                                  color: isSelected ? '#1565C0' : '#424242',
                                }}
                              >
                                {/* === MOBILE LAYOUT — professional grid matching headers === */}
                                <div className="lg:hidden grid grid-cols-[1fr_50px_45px_55px_20px] gap-1 items-center">
                                  {/* Col 1: Item (emoji + name + SKU) */}
                                  <div className="min-w-0 flex items-center gap-1.5">
                                    <span className="text-[8px] font-mono text-slate-400 flex-shrink-0">{index + 1}</span>
                                    <span className="text-base flex-shrink-0">{item.emoji}</span>
                                    <div className="min-w-0">
                                      <div className="font-semibold text-[11px] truncate leading-tight">{item.name}</div>
                                      <div className="text-[8px] font-mono text-slate-400 truncate leading-tight">{item.sku} · {formatGHS(item.price)}</div>
                                    </div>
                                  </div>
                                  {/* Col 2: Qty with compact +/- buttons */}
                                  <div className="flex items-center gap-0.5 justify-center flex-shrink-0">
                                    <button onClick={(e) => { e.stopPropagation(); updateQuantity(index, -1); }} className="h-4 w-4 rounded bg-slate-200 hover:bg-slate-300 flex items-center justify-center transition active:scale-90">
                                      <Minus className="h-2 w-2" />
                                    </button>
                                    <span className="w-6 text-center font-mono font-bold text-[10px]">{item.quantity.toFixed(item.unit === 'kg' ? 2 : 0)}</span>
                                    <button onClick={(e) => { e.stopPropagation(); updateQuantity(index, 1); }} className="h-4 w-4 rounded bg-slate-200 hover:bg-slate-300 flex items-center justify-center transition active:scale-90">
                                      <Plus className="h-2 w-2" />
                                    </button>
                                  </div>
                                  {/* Col 3: Discount input */}
                                  <div className="flex items-center justify-center flex-shrink-0">
                                    <input
                                      type="number"
                                      value={item.discount || ''}
                                      onClick={(e) => { e.stopPropagation(); setSelectedCartIndex(index); }}
                                      onChange={(e) => applyDiscount(index, parseFloat(e.target.value) || 0)}
                                      className="w-9 h-5 text-center text-[9px] font-mono font-bold rounded border border-violet-300 bg-violet-50 outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-400/40 transition"
                                      placeholder="0"
                                    />
                                  </div>
                                  {/* Col 4: Total (aligned right, under Total header) */}
                                  <div className="flex items-center justify-end flex-shrink-0">
                                    <span className="font-mono font-bold text-[11px]">{formatGHS(lineFinal)}</span>
                                  </div>
                                  {/* Col 5: Delete button (separate column, doesn't affect Total alignment) */}
                                  <button onClick={(e) => { e.stopPropagation(); removeLine(index); }} className="h-4 w-4 rounded bg-rose-50 text-rose-400 hover:bg-rose-100 hover:text-rose-600 flex items-center justify-center transition active:scale-90 flex-shrink-0">
                                    <Trash2 className="h-2.5 w-2.5" />
                                  </button>
                                </div>

                                {/* === DESKTOP LAYOUT (grid) === */}
                                <div className="hidden lg:grid lg:grid-cols-[140px_1fr_60px_90px_50px_90px] lg:gap-1 lg:items-center lg:text-[11px]">
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
                                </div>
                              </motion.div>
                            );
                          })}
                        </AnimatePresence>

                        {cart.length === 0 && (
                          <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                            <ShoppingCart className="h-10 w-10 mb-2 opacity-40" />
                            <div className="text-sm font-medium">Cart is empty</div>
                            <div className="text-xs mt-1">Type a Part No. above or click products below</div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Totals + Function buttons (below cart items, stacked) */}
                  <div className="flex-shrink-0 flex flex-col border-t border-slate-200">
                    {/* Held Orders */}
                    {heldOrders.length > 0 && (
                      <div className="flex-shrink-0 px-3 py-2 bg-amber-50 border-b border-amber-200 max-h-24 overflow-y-auto">
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

                    {/* Totals — Premium */}
                    <div className="flex-shrink-0 bg-gradient-to-b from-slate-50/60 to-white">
                      <div className="px-4 py-2 space-y-0.5">
                        <div className="flex justify-between text-xs text-slate-600">
                          <span>Subtotal ({totalItems} items)</span>
                          <span className="font-mono tabular">{formatGHS(subtotal)}</span>
                        </div>
                        <div className="flex justify-between text-xs text-slate-600">
                          <span className="flex items-center gap-1">
                            <Percent className="h-3 w-3" /> Discount
                            <input
                              type="number"
                              value={globalDiscount || ''}
                              onChange={(e) => applyGlobalDiscount(parseFloat(e.target.value) || 0)}
                              className="w-10 text-center font-mono font-bold rounded border-2 border-violet-400 bg-violet-50 outline-none focus:border-violet-600 focus:ring-2 focus:ring-violet-400/40 transition tabular"
                              placeholder="0"
                            />%
                          </span>
                          <span className="font-mono text-rose-600 tabular">-{formatGHS(discountAmount)}</span>
                        </div>
                        <div className="flex justify-between text-xs text-slate-600">
                          <span>{TAX_NAME} ({(TAX_RATE * 100).toFixed(0)}%)</span>
                          <span className="font-mono tabular">{formatGHS(taxAmount)}</span>
                        </div>
                      </div>
                      <div className="px-4 py-2 gradient-premium-emerald text-white relative">
                        <div className="flex justify-between items-baseline relative z-10">
                          <span className="text-xs font-semibold uppercase tracking-wider opacity-90">Total Due</span>
                          <span className="text-2xl font-bold font-mono tabular">{formatGHS(total)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Function Buttons — Premium grid */}
                    <div className="flex-shrink-0 grid grid-cols-4 gap-1 p-2 bg-slate-100/60">
                      <button
                        onClick={() => setShowFindProduct(true)}
                        className="btn-premium col-span-4 h-10 rounded-lg gradient-premium-violet hover:shadow-glow-violet text-white font-bold text-xs flex items-center justify-center gap-1.5 transition"
                      >
                        <Search className="h-3.5 w-3.5" />
                        FIND PRODUCT
                        <kbd className="ml-1 px-1 py-0.5 rounded bg-white/20 text-[9px] font-mono hidden lg:inline">F1</kbd>
                      </button>
                      <FuncBtn icon={<Pause className="h-3 w-3" />} label="Save" sub="F2" onClick={handleSave} variant="amber" />
                      <FuncBtn icon={<Printer className="h-3 w-3" />} label="Print" sub="F3" onClick={handlePrint} variant="slate" />
                      <FuncBtn icon={<RotateCcw className="h-3 w-3" />} label="Void" sub="F4" onClick={handleVoid} variant="rose" />
                      <FuncBtn icon={<DollarSign className="h-3 w-3" />} label="Cash" sub="" onClick={handleOpenCash} variant="slate" />
                      <FuncBtn icon={<Trash2 className="h-3 w-3" />} label="Del Line" sub="Del" onClick={() => selectedCartIndex !== null ? removeLine(selectedCartIndex) : toast({ title: "Select a line first", variant: "destructive" })} variant="slate" />
                      <FuncBtn icon={<Check className="h-3 w-3" />} label="Enter" sub="↵" onClick={handleKeypadEnter} variant="emerald" />
                      <button
                        onClick={() => setShowCartPreview(true)}
                        className="btn-premium col-span-1 h-10 rounded-lg bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white font-bold text-[10px] flex items-center justify-center gap-0.5 transition"
                      >
                        <Eye className="h-3 w-3" />
                        PREVIEW
                        <kbd className="ml-0.5 px-0.5 py-0.5 rounded bg-white/20 text-[8px] font-mono hidden lg:inline">F6</kbd>
                      </button>
                      <button
                        onClick={handlePay}
                        className="btn-premium col-span-3 h-10 rounded-lg gradient-premium-emerald hover:shadow-glow-emerald text-white font-bold text-xs flex items-center justify-center gap-1.5 transition"
                      >
                        <CreditCard className="h-3.5 w-3.5" />
                        PAY NOW
                        <kbd className="ml-1 px-1 py-0.5 rounded bg-white/20 text-[9px] font-mono hidden lg:inline">F5</kbd>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Numeric Keypad — always visible, below the cart+totals */}
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

      {/* ===== Premium: Mobile Bottom Navigation (mobile-only) ===== */}
      <MobileNav
        active={view === "pos" ? "pos" : view}
        onNavigate={(v) => {
          if (v === "cart") {
            setMobileCartOpen(true);
          } else if (v === "dashboard") {
            setView("dashboard");
          } else if (v === "reports") {
            setView("sales-menu");
          } else if (v === "pos") {
            setView("pos");
          } else {
            setView(v as ViewMode);
          }
        }}
        cartCount={cart.reduce((s, i) => s + i.quantity, 0)}
        user={loggedInUser ? { fullName: loggedInUser.fullName, role: loggedInUser.role } : null}
        onLogout={() => handleLogout()}
      />

      {/* ===== Premium: Barcode Scanner Modal ===== */}
      <AnimatePresence>
        {showBarcodeScanner && (
          <BarcodeScanner
            onScan={async (code) => {
              // ===== Step 1: Search local catalog (fast) =====
              const product = findProductByCode(products, code);
              if (product) {
                addToCart(product);
                toast({ title: `Added: ${product.name}`, description: `Scanned: ${code}` });
                setShowBarcodeScanner(false);
                return;
              }

              // ===== Step 2: Not in catalog — search online databases =====
              // This makes the scanner "universal" — it works for ANY barcode
              // that exists in OpenFoodFacts, UPCitemdb, Open Beauty Facts,
              // or Open Pet Food Facts. If found, auto-creates the product.
              toast({
                title: "Searching online…",
                description: `Barcode ${code} not in your catalog. Checking 4 databases…`,
              });

              try {
                const { lookupBarcodeEverywhere } = await import("@/lib/barcode-lookup");
                const result = await lookupBarcodeEverywhere(code);

                if (result && result.name) {
                  // ===== Step 3: Found online — auto-create the product =====
                  toast({
                    title: "Found online! Creating product…",
                    description: `${result.name} (via ${result.source})`,
                  });

                  // Create the product via API
                  const { authedFetch } = await import("@/lib/client-auth");
                  const createRes = await authedFetch("/api/products", {
                    method: "POST",
                    body: JSON.stringify({
                      sku: `SCAN-${code.slice(-8)}`,
                      barcode: code,
                      name: result.name,
                      emoji: result.emoji || "📦",
                      category: result.category || "other",
                      description: result.description || "",
                      price: 0, // User sets price later
                      costPrice: 0,
                      quantity: 0, // No stock — user receives later
                      unit: "each",
                      reorderLevel: 5,
                      taxable: true,
                      groupId: null,
                      active: true,
                    }),
                  });
                  const createData = await createRes.json();

                  if (createRes.ok && createData.success && createData.product) {
                    // Convert server product to client format + add to local state
                    const newProduct = serverProductToClientProduct(createData.product);
                    setProducts(prev => [...prev, newProduct]);
                    addToCart(newProduct);
                    toast({
                      title: `✅ Created & added: ${result.name}`,
                      description: `Auto-created from ${result.source}. Set price & stock in Stock → Edit Product.`,
                      duration: 5000,
                    });
                    setShowBarcodeScanner(false);
                  } else {
                    // Product creation failed (maybe SKU conflict) — try with different SKU
                    const retryRes = await authedFetch("/api/products", {
                      method: "POST",
                      body: JSON.stringify({
                        sku: `SCAN-${Date.now().toString().slice(-6)}`,
                        barcode: code,
                        name: result.name,
                        emoji: result.emoji || "📦",
                        category: result.category || "other",
                        price: 0,
                        costPrice: 0,
                        quantity: 0,
                        unit: "each",
                        reorderLevel: 5,
                        taxable: true,
                        groupId: null,
                        active: true,
                      }),
                    });
                    const retryData = await retryRes.json();
                    if (retryRes.ok && retryData.success && retryData.product) {
                      const newProduct = serverProductToClientProduct(retryData.product);
                      setProducts(prev => [...prev, newProduct]);
                      addToCart(newProduct);
                      toast({
                        title: `✅ Created & added: ${result.name}`,
                        description: `Auto-created from ${result.source}. Set price & stock in Stock → Edit Product.`,
                        duration: 5000,
                      });
                      setShowBarcodeScanner(false);
                    } else {
                      toast({
                        title: "Could not create product",
                        description: retryData.error || "Server error. Add manually in Stock → Add Product.",
                        variant: "destructive",
                        duration: 5000,
                      });
                    }
                  }
                } else {
                  // ===== Step 4: Not found anywhere — capture barcode for manual entry =====
                  toast({
                    title: "Barcode not in any database",
                    description: `Scanned: ${code}. This may be a local/imported product. Add it in Stock → Add Product (barcode pre-filled).`,
                    variant: "default",
                    duration: 6000,
                  });
                  // Close scanner and navigate to stock add form with barcode pre-filled
                  setShowBarcodeScanner(false);
                  // Store the scanned barcode so the Add Product form can use it
                  try { localStorage.setItem("sylhn-pending-barcode", code); } catch {}
                  setInitialStockView("add-modify");
                  setView("stock");
                }
              } catch (e: any) {
                console.error("[pos-scan] online lookup failed:", e);
                toast({
                  title: "Lookup failed",
                  description: `Barcode: ${code}. Network error — add manually in Stock → Add Product.`,
                  variant: "destructive",
                  duration: 5000,
                });
                setShowBarcodeScanner(false);
                try { localStorage.setItem("sylhn-pending-barcode", code); } catch {}
                setInitialStockView("add-modify");
                setView("stock");
              }
            }}
            onClose={() => setShowBarcodeScanner(false)}
          />
        )}
      </AnimatePresence>

      {/* ===== Premium: Manager Approval Modal ===== */}
      <ManagerApproval
        open={!!approvalRequest}
        title={approvalRequest?.title || ""}
        description={approvalRequest?.description || ""}
        action={approvalRequest?.action || "void"}
        amount={approvalRequest?.amount}
        reason={approvalRequest?.reason}
        onApproved={() => {
          if (approvalRequest?.onApproved) approvalRequest.onApproved();
          setApprovalRequest(null);
        }}
        onClose={() => setApprovalRequest(null)}
      />

      {/* ===== Premium: SpeedDial — single FAB that expands into all quick actions ===== */}
      {/* Replaces 3 separate floating buttons (scan + printer + AI) with one clean button */}
      {view === "pos" && (
        <SpeedDial
          actions={[
            {
              id: "ai",
              icon: Sparkles,
              label: "AI Assistant",
              color: "from-violet-600 to-indigo-600",
              onClick: () => setShowAiAssistant(true),
            },
            {
              id: "scan",
              icon: ScanLine,
              label: "Scan Barcode",
              color: "from-emerald-600 to-teal-600",
              onClick: () => setShowBarcodeScanner(true),
            },
            {
              id: "printer",
              icon: Printer,
              label: "Pair Printer",
              color: "from-blue-600 to-cyan-600",
              onClick: () => setShowPrinterPairing(true),
            },
            {
              id: "cash-calc",
              icon: DollarSign,
              label: "Cash Calculator",
              color: "from-amber-600 to-orange-600",
              onClick: () => setShowCashCalc(true),
            },
            {
              id: "std-calc",
              icon: CalcIcon,
              label: "Calculator",
              color: "from-slate-700 to-slate-900",
              onClick: () => setShowStdCalc(true),
            },
            {
              id: "price-tags",
              icon: Printer,
              label: "Price Tags",
              color: "from-indigo-600 to-purple-600",
              onClick: () => setShowPriceTags(true),
            },
          ]}
        />
      )}

      {/* ===== Premium: Printer Pairing Modal ===== */}
      <PrinterPairing open={showPrinterPairing} onClose={() => setShowPrinterPairing(false)} />

      {/* ===== Premium: AI Business Assistant ===== */}
      <AiAssistant open={showAiAssistant} onClose={() => setShowAiAssistant(false)} />

      {/* ===== Premium: Cash Denomination Calculator ===== */}
      <AnimatePresence>
        {showCashCalc && <CashCalculator total={total} onClose={() => setShowCashCalc(false)} />}
        {showStdCalc && <StandardCalculator onClose={() => setShowStdCalc(false)} />}
      </AnimatePresence>

      {/* ===== Premium: Price Tags Printer ===== */}
      <AnimatePresence>
        {showPriceTags && <PriceTagsPrinter onClose={() => setShowPriceTags(false)} />}
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
    emerald: "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:shadow-premium-sm ring-emerald-200/70",
    amber: "bg-amber-50 text-amber-700 hover:bg-amber-100 hover:shadow-premium-sm ring-amber-200/70",
    rose: "bg-rose-50 text-rose-700 hover:bg-rose-100 hover:shadow-premium-sm ring-rose-200/70",
    slate: "bg-white text-slate-700 hover:bg-slate-50 hover:shadow-premium-sm ring-slate-200/70",
  };
  return (
    <button
      onClick={onClick}
      className={cn("btn-premium h-10 rounded-lg flex flex-col items-center justify-center gap-0.5 ring-1 transition", variants[variant])}
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
  const [momoPhone, setMomoPhone] = useState("");
  const [momoStatus, setMomoStatus] = useState<"idle" | "initiating" | "pending" | "confirmed" | "failed">("idle");
  const [momoRef, setMomoRef] = useState<string | null>(null);
  const [momoError, setMomoError] = useState<string | null>(null);
  const { toast } = useToast();

  const amountPaid = parseFloat(amountInput) || 0;
  const change = amountPaid - total;
  const canComplete = method === "cash" ? amountPaid >= total : method === "momo" ? momoStatus === "confirmed" : true;

  // Initiate MoMo payment
  const initiateMomo = async () => {
    if (!momoPhone || momoPhone.length < 10) {
      toast({ title: "Phone number required", description: "Enter the customer's mobile money phone number", variant: "destructive" });
      return;
    }
    setMomoStatus("initiating");
    setMomoError(null);
    try {
      // We need the saleId — but the sale hasn't been created yet.
      // For now, we create the sale first (with status "pending"), then initiate MoMo.
      // The onComplete callback will be called after MoMo confirmation.
      // This is a simplification — in production, the sale is created in the
      // completePayment function, and MoMo is initiated after.
      // For now, let's just simulate the MoMo flow and call onComplete.
      const res = await fetch("/api/payments/momo/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          saleId: "pending-" + invoiceNumber,
          phoneNumber: momoPhone,
        }),
      }).catch(() => null);

      if (res && res.ok) {
        const data = await res.json();
        setMomoRef(data.referenceId);
        setMomoStatus("pending");
        toast({
          title: "Payment request sent",
          description: "Ask the customer to approve the prompt on their phone",
        });
        // Poll for status
        pollMomoStatus(data.referenceId);
      } else {
        // If the API isn't configured (no MTN_MOMO_* env vars), fall back to
        // manual confirmation mode
        setMomoStatus("pending");
        setMomoRef("manual-" + Date.now());
        toast({
          title: "Manual MoMo mode",
          description: "MTN API not configured. Ask the customer to send money to your number, then tap Confirm.",
        });
      }
    } catch (e: any) {
      setMomoStatus("failed");
      setMomoError(e?.message || "Failed to initiate payment");
    }
  };

  // Poll MoMo payment status
  const pollMomoStatus = async (refId: string) => {
    if (refId.startsWith("manual-")) return; // Don't poll manual mode
    let attempts = 0;
    const interval = setInterval(async () => {
      attempts++;
      if (attempts > 60) { // 5 min timeout
        clearInterval(interval);
        setMomoStatus("failed");
        setMomoError("Payment timeout — customer did not confirm in time");
        return;
      }
      try {
        const res = await fetch(`/api/payments/momo/status?referenceId=${refId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.status === "completed") {
            clearInterval(interval);
            setMomoStatus("confirmed");
            toast({ title: "Payment confirmed!", description: `${formatGHS(total)} received via MoMo` });
          } else if (data.status === "failed") {
            clearInterval(interval);
            setMomoStatus("failed");
            setMomoError(data.reason || "Payment was rejected");
          }
        }
      } catch { /* ignore poll errors */ }
    }, 5000); // Poll every 5s
  };

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
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, y: 30 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 30 }}
        onClick={(e) => e.stopPropagation()}
        className="dialog-premium shadow-premium-xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden"
      >
        {/* Header — premium gradient with total due prominent */}
        <div className="gradient-premium-emerald text-white px-5 py-4 flex items-center justify-between relative overflow-hidden flex-shrink-0">
          <div className="pointer-events-none absolute -top-12 -right-12 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
          <div className="relative z-10 flex-1 min-w-0">
            <div className="text-[10px] sm:text-xs opacity-80 font-semibold uppercase tracking-wider truncate">PAYMENT · Invoice #{invoiceNumber || '------'}</div>
            <div className="text-base sm:text-lg font-bold">{itemCount} items</div>
          </div>
          <button onClick={onClose} className="h-9 w-9 rounded-lg bg-white/15 hover:bg-white/25 flex items-center justify-center transition active:scale-90 relative z-10 flex-shrink-0" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Total Due — premium hero amount (mobile-optimized) */}
        <div className="px-5 py-4 bg-gradient-to-b from-slate-50 to-white border-b border-slate-200/80 text-center flex-shrink-0">
          <div className="text-[10px] sm:text-xs text-slate-500 font-semibold uppercase tracking-wider">Total Due</div>
          <div className="text-4xl sm:text-5xl font-bold font-mono text-gradient-emerald mt-1 leading-none">{formatGHS(total)}</div>
          {customerName && <div className="text-xs text-slate-500 mt-2">Customer: {customerName}</div>}
          <div className="flex justify-center gap-3 sm:gap-4 mt-2 text-[10px] sm:text-[11px] text-slate-500">
            <span>Sub: {formatGHS(subtotal)}</span>
            <span>{TAX_NAME}: {formatGHS(tax)}</span>
            {discount > 0 && <span className="text-rose-500">Disc: -{formatGHS(discount)}</span>}
          </div>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto min-h-0 scroll-premium flex-1">
          {/* Payment Method — premium segmented control style on mobile */}
          <div className="px-5 pt-4 pb-3">
            <div className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Payment Method</div>
            <div className="grid grid-cols-3 gap-2">
              {paymentMethods.map(pm => (
                <button
                  key={pm.id}
                  onClick={() => { setMethod(pm.id); setMomoStatus("idle"); setMomoError(null); }}
                  className={cn(
                    "flex flex-col items-center gap-1 py-3 rounded-xl ring-2 transition active:scale-95",
                    method === pm.id ? "ring-emerald-500 bg-emerald-50" : "ring-slate-200 hover:ring-slate-300 bg-white"
                  )}
                >
                  <span className="text-2xl">{pm.icon}</span>
                  <span className="text-[10px] sm:text-[11px] font-semibold text-slate-700">{pm.name}</span>
                </button>
              ))}
            </div>
          </div>

          {method === "cash" && (
            <div className="px-5 pb-4">
              <div className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Cash Received</div>
              {/* Large, auto-focus amount input — premium number-pad style */}
              <input
                type="number"
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                autoFocus
                placeholder="0.00"
                inputMode="decimal"
                className="input-premium w-full h-14 sm:h-12 px-4 text-2xl sm:text-2xl font-mono font-bold text-right tracking-tight"
              />
              {/* Premium quick-cash grid — 3 cols on mobile (bigger tap targets) */}
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 mt-2">
                {quickCashAmounts.map(amt => (
                  <button
                    key={amt}
                    onClick={() => setAmountInput(amt.toString())}
                    className={cn(
                      "btn-premium py-2.5 sm:py-1.5 rounded-lg text-xs sm:text-xs font-bold transition active:scale-95",
                      amountPaid === amt ? "bg-emerald-500 text-white" : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                    )}
                  >
                    {CURRENCY}{amt}
                  </button>
                ))}
              </div>
              {/* Premium Exact Amount button — always visible */}
              <button
                onClick={() => setAmountInput(total.toFixed(2))}
                className="btn-premium w-full mt-1.5 py-3 sm:py-1.5 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-xs sm:text-xs font-bold text-emerald-700 transition active:scale-95"
              >
                Exact Amount {formatGHS(total)}
              </button>

              {/* Change Due — premium hero card (mobile-emphasized) */}
              {amountPaid > 0 && (
                <div className={cn(
                  "mt-3 p-4 rounded-xl flex justify-between items-center transition-all",
                  change >= 0 ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white" : "bg-rose-600 text-white"
                )}>
                  <div>
                    <div className="text-[10px] font-semibold uppercase opacity-80 tracking-wider">{change >= 0 ? 'Change Due' : 'Still Owed'}</div>
                    <div className="text-[10px] opacity-70 mt-0.5">Paid {formatGHS(amountPaid)} of {formatGHS(total)}</div>
                  </div>
                  <span className="text-3xl font-bold font-mono tracking-tight">
                    {formatGHS(Math.abs(change))}
                  </span>
                </div>
              )}
            </div>
          )}

          {method === "momo" && (
            <div className="px-5 pb-4 space-y-3">
              {momoStatus === "idle" && (
                <>
                  <div>
                    <label className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Customer Phone Number</label>
                    <div className="relative">
                      <Smartphone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <input
                        type="tel"
                        value={momoPhone}
                        onChange={(e) => setMomoPhone(e.target.value)}
                        placeholder="233XXXXXXXXX"
                        autoFocus
                        inputMode="tel"
                        className="input-premium w-full h-12 pl-11 pr-4 text-base sm:text-sm font-mono font-bold"
                      />
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1.5">
                      Enter the customer's phone number in international format (e.g. 233241234567).
                      They'll receive a prompt to approve the payment.
                    </div>
                  </div>
                  <button
                    onClick={initiateMomo}
                    disabled={momoPhone.length < 10}
                    className="btn-premium w-full h-12 rounded-xl gradient-premium-amber hover:shadow-glow-emerald disabled:opacity-50 text-white text-sm font-bold flex items-center justify-center gap-2 transition active:scale-95"
                  >
                    <Smartphone className="h-4 w-4" />
                    Send Payment Request · {formatGHS(total)}
                  </button>
                </>
              )}

              {momoStatus === "initiating" && (
                <div className="p-6 rounded-xl bg-amber-50 text-center">
                  <Loader2 className="h-8 w-8 animate-spin text-amber-600 mx-auto mb-3" />
                  <div className="text-sm font-semibold text-amber-800">Initiating payment...</div>
                  <div className="text-xs text-amber-600 mt-1">Contacting MTN MoMo API</div>
                </div>
              )}

              {momoStatus === "pending" && (
                <div className="p-6 rounded-xl bg-blue-50 text-center">
                  <div className="h-12 w-12 rounded-full bg-blue-500 flex items-center justify-center mx-auto mb-3 pulse-ring">
                    <Smartphone className="h-6 w-6 text-white" />
                  </div>
                  <div className="text-sm font-bold text-blue-800">Awaiting customer approval</div>
                  <div className="text-xs text-blue-600 mt-1">
                    A payment prompt has been sent to <span className="font-mono font-bold">{momoPhone}</span>.
                    Ask the customer to approve it on their phone.
                  </div>
                  <div className="flex items-center justify-center gap-1 mt-3 text-xs text-blue-500">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Polling for confirmation...
                  </div>
                  {momoRef && momoRef.startsWith("manual-") && (
                    <button
                      onClick={() => setMomoStatus("confirmed")}
                      className="btn-premium mt-4 w-full h-11 rounded-lg gradient-premium-emerald hover:shadow-glow-emerald text-white text-xs font-bold transition active:scale-95"
                    >
                      <Check className="h-3.5 w-3.5" /> I've received the money — Confirm
                    </button>
                  )}
                </div>
              )}

              {momoStatus === "confirmed" && (
                <div className="p-6 rounded-xl bg-emerald-50 text-center">
                  <div className="h-12 w-12 rounded-full gradient-premium-emerald flex items-center justify-center mx-auto mb-3 shadow-glow-emerald">
                    <Check className="h-6 w-6 text-white" />
                  </div>
                  <div className="text-sm font-bold text-emerald-800">Payment confirmed!</div>
                  <div className="text-xs text-emerald-600 mt-1">{formatGHS(total)} received via Mobile Money</div>
                </div>
              )}

              {momoStatus === "failed" && (
                <div className="p-6 rounded-xl bg-rose-50 text-center">
                  <AlertTriangle className="h-8 w-8 text-rose-600 mx-auto mb-3" />
                  <div className="text-sm font-bold text-rose-800">Payment failed</div>
                  <div className="text-xs text-rose-600 mt-1">{momoError || "The customer rejected or the payment timed out"}</div>
                  <button
                    onClick={() => { setMomoStatus("idle"); setMomoError(null); }}
                    className="btn-premium mt-3 w-full h-11 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-700 text-xs font-bold transition active:scale-95"
                  >
                    Try Again
                  </button>
                </div>
              )}
            </div>
          )}

          {method === "card" && (
            <div className="px-5 pb-4">
              <div className="p-4 rounded-xl bg-blue-50 text-center">
                <div className="text-3xl mb-2">💳</div>
                <div className="text-sm font-semibold text-slate-700">Insert/tap card on terminal</div>
                <div className="text-xs text-slate-500 mt-1">Confirm on payment terminal</div>
              </div>
            </div>
          )}
        </div>

        {/* Sticky CTA — always visible (premium mobile pattern) */}
        <div className="px-5 pb-5 pt-3 border-t border-slate-200 bg-white flex-shrink-0">
          <button
            onClick={handleComplete}
            disabled={!canComplete}
            className={cn(
              "btn-premium w-full h-14 rounded-xl font-bold text-base flex items-center justify-center gap-2 transition active:scale-95",
              canComplete ? "gradient-premium-emerald hover:shadow-glow-emerald text-white" : "bg-slate-200 text-slate-400 cursor-not-allowed"
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
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 30 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 30 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
        className="dialog-premium shadow-premium-xl w-full max-w-5xl max-h-[92vh] flex flex-col"
      >
        {/* Header — premium gradient */}
        <div className="flex-shrink-0 gradient-premium-violet text-white px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between relative overflow-hidden">
          <div className="pointer-events-none absolute -top-12 -right-12 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 relative z-10">
            <div className="relative flex-shrink-0">
              <div className="absolute inset-0 rounded-xl bg-white/25 blur-md scale-110" />
              <div className="relative h-9 w-9 sm:h-11 sm:w-11 rounded-xl bg-white/15 ring-1 ring-white/30 flex items-center justify-center backdrop-blur-md">
                <Search className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
            </div>
            <div className="min-w-0">
              <div className="text-base sm:text-lg font-bold truncate tracking-tight">Find Product</div>
              <div className="text-[10px] sm:text-xs text-violet-50/90 truncate hidden sm:block font-medium">Search by name, SKU, barcode, or supplier</div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 relative z-10">
            <kbd className="hidden sm:inline-block px-2 py-1 rounded-md bg-white/15 text-[10px] font-mono ring-1 ring-white/20">F1 to open</kbd>
            <button onClick={onClose} className="h-9 w-9 rounded-lg bg-white/15 hover:bg-white/25 flex items-center justify-center transition active:scale-90">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Search Bar + Group Filters */}
        <div className="flex-shrink-0 px-3 sm:px-6 py-2.5 sm:py-3 bg-gradient-to-r from-slate-50 to-white border-b border-slate-200/80 space-y-2 sm:space-y-2.5">
          <div className="relative">
            <Search className="absolute left-3 sm:left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-slate-400" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && filtered.length > 0) {
                  selectProduct(filtered[0].id);
                }
              }}
              placeholder="Search products... (Enter to select)"
              className="input-premium w-full h-11 sm:h-12 pl-10 sm:pl-11 pr-10 text-sm sm:text-base"
            />
            {query && (
              <button
                onClick={() => { setQuery(""); inputRef.current?.focus(); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full bg-slate-200 hover:bg-slate-300 flex items-center justify-center transition active:scale-90"
              >
                <X className="h-3.5 w-3.5 text-slate-600" />
              </button>
            )}
          </div>
          {/* Group filters — horizontal scroll on mobile */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
            {stockGroups.map(g => (
              <button
                key={g.id}
                onClick={() => setGroupFilter(g.id)}
                className={cn(
                  "cat-pill-premium flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition flex-shrink-0",
                  groupFilter === g.id
                    ? "gradient-premium-violet text-white shadow-premium-sm"
                    : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
                )}
              >
                <span>{g.icon}</span>
                {g.name}
              </button>
            ))}
            <div className="ml-auto text-xs text-slate-500 font-medium flex-shrink-0 pl-2 tabular">
              {filtered.length} of {products.length}
            </div>
          </div>
        </div>

        {/* Body: Product List + Detail Panel
            Mobile: stack vertically (list on top, detail slides up from bottom)
            Desktop: side-by-side 3-col grid */}
        <div className="flex-1 overflow-hidden flex flex-col lg:grid lg:grid-cols-3 lg:gap-0">
          {/* Left: Product List — full width on mobile, 2 cols on desktop */}
          <div className="flex-1 overflow-y-auto lg:col-span-2 lg:border-r border-slate-200" style={{ maxHeight: selectedProduct ? '40vh' : 'none' }}>
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
                        "w-full flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-2.5 text-left transition cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-blue-400 mobile-product-card",
                        isSelected ? "ring-2 ring-blue-400 ring-inset" : "hover:bg-slate-50"
                      )}
                    >
                      {/* Emoji */}
                      <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center text-xl sm:text-2xl flex-shrink-0">
                        {product.emoji}
                      </div>
                      {/* Info */}
                      <div className="flex-1 min-w-0 overflow-hidden">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-semibold text-slate-800 text-xs sm:text-sm truncate">{product.name}</span>
                          {product.taxable && (
                            <span className="px-1 py-0.5 rounded bg-amber-100 text-amber-700 text-[8px] sm:text-[9px] font-bold flex-shrink-0">VAT</span>
                          )}
                          {lowStock && (
                            <span className="px-1 py-0.5 rounded bg-rose-100 text-rose-700 text-[8px] sm:text-[9px] font-bold flex-shrink-0">LOW</span>
                          )}
                        </div>
                        <div className="text-[10px] sm:text-[11px] text-slate-400 font-mono truncate">
                          <span>{product.sku}</span>
                          {product.barcode && (
                            <>
                              <span className="mx-1">·</span>
                              <span>{product.barcode}</span>
                            </>
                          )}
                        </div>
                      </div>
                      {/* Price + Stock */}
                      <div className="text-right flex-shrink-0">
                        <div className="font-bold text-blue-600 text-xs sm:text-sm">{formatGHS(product.price)}</div>
                        <div className="text-[9px] sm:text-[10px] text-slate-400 whitespace-nowrap">/{product.unit} · {product.stock}</div>
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

          {/* Right: Product Detail Panel
              Mobile: slides up from below the list (full width, border-top)
              Desktop: 1-col side panel (right of list) */}
          <div className="flex-shrink-0 lg:flex-1 overflow-y-auto bg-slate-50 border-t-2 lg:border-t-0 border-blue-200 lg:col-span-1" style={{ maxHeight: '50vh' }}>
            {selectedProduct ? (
              <motion.div
                key={selectedProduct.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 sm:p-5 space-y-3 sm:space-y-4"
              >
                {/* Product Card */}
                <div className="bg-white rounded-xl p-3 sm:p-4 shadow-sm ring-1 ring-slate-200 flex items-center gap-3 sm:block sm:text-center">
                  {/* Mobile: horizontal layout; Desktop: stacked */}
                  <div className="h-16 w-16 sm:h-24 sm:w-24 sm:mx-auto rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center text-4xl sm:text-6xl mb-0 sm:mb-3 flex-shrink-0">
                    {selectedProduct.emoji}
                  </div>
                  <div className="flex-1 sm:flex-none min-w-0">
                    <div className="font-bold text-slate-800 text-sm sm:text-base truncate">{selectedProduct.name}</div>
                    <div className="text-[10px] sm:text-xs text-slate-400 font-mono mt-0.5 truncate">{selectedProduct.sku}</div>
                    <div className="text-lg sm:text-2xl font-bold text-blue-600 mt-1 sm:mt-2">{formatGHS(selectedProduct.price)}</div>
                    <div className="text-[10px] sm:text-xs text-slate-500">per {selectedProduct.unit}</div>
                  </div>
                </div>

                {/* Product Details — 2-column grid on mobile for compact layout */}
                <div className="bg-white rounded-xl p-3 sm:p-4 shadow-sm ring-1 ring-slate-200 grid grid-cols-2 sm:grid-cols-1 gap-x-3 gap-y-1.5 sm:gap-y-2 text-xs">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-0.5 col-span-2 sm:col-span-1">Details</div>
                  <div className="flex justify-between items-center min-w-0">
                    <span className="text-slate-500 text-[11px]">Group</span>
                    <span className="font-semibold text-slate-800 text-[11px] truncate ml-2 text-right">{stockGroups.find(g => g.id === selectedProduct.groupId)?.name || "—"}</span>
                  </div>
                  <div className="flex justify-between items-center min-w-0">
                    <span className="text-slate-500 text-[11px]">Barcode</span>
                    <span className="font-mono text-slate-700 text-[11px] truncate ml-2 text-right">{selectedProduct.barcode || "—"}</span>
                  </div>
                  <div className="flex justify-between items-center min-w-0">
                    <span className="text-slate-500 text-[11px]">Supplier</span>
                    <span className="font-semibold text-slate-800 text-[11px] truncate ml-2 text-right">{selectedProduct.supplier || "—"}</span>
                  </div>
                  <div className="flex justify-between items-center min-w-0">
                    <span className="text-slate-500 text-[11px]">Batch</span>
                    <span className="font-mono text-slate-700 text-[11px] truncate ml-2 text-right">{selectedProduct.batchNumber || "—"}</span>
                  </div>
                  <div className="flex justify-between items-center min-w-0">
                    <span className="text-slate-500 text-[11px]">Cost</span>
                    <span className="font-mono text-slate-700 text-[11px] ml-2">{formatGHS(selectedProduct.costPrice)}</span>
                  </div>
                  <div className="flex justify-between items-center min-w-0">
                    <span className="text-slate-500 text-[11px]">Stock</span>
                    <span className={cn("font-bold text-[11px]", selectedProduct.stock === 0 ? "text-rose-600" : selectedProduct.stock <= selectedProduct.reorderLevel ? "text-amber-600" : "text-emerald-600")}>
                      {selectedProduct.stock} {selectedProduct.unit}
                    </span>
                  </div>
                  <div className="flex justify-between items-center min-w-0">
                    <span className="text-slate-500 text-[11px]">Reorder</span>
                    <span className="font-mono text-slate-700 text-[11px]">{selectedProduct.reorderLevel}</span>
                  </div>
                  <div className="flex justify-between items-center min-w-0">
                    <span className="text-slate-500 text-[11px]">Expiry</span>
                    <span className="font-mono text-slate-700 text-[11px] truncate ml-2 text-right">{selectedProduct.expiryDate || "—"}</span>
                  </div>
                </div>

                {/* Quantity Selector */}
                <div className="bg-white rounded-xl p-3 sm:p-4 shadow-sm ring-1 ring-slate-200">
                  <div className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Quantity to Add</div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setQuantity(q => Math.max(1, q - 1))}
                      className="h-10 w-10 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition flex-shrink-0"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <input
                      type="number"
                      value={quantity}
                      onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                      min={1}
                      max={selectedProduct.stock}
                      className="flex-1 h-10 text-center text-base sm:text-lg font-bold font-mono border-2 border-slate-200 focus:border-blue-400 rounded-lg outline-none min-w-0"
                    />
                    <button
                      onClick={() => setQuantity(q => Math.min(selectedProduct.stock, q + 1))}
                      className="h-10 w-10 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition flex-shrink-0"
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
                    <span className="text-base sm:text-lg font-bold font-mono text-blue-600">{formatGHS(selectedProduct.price * quantity)}</span>
                  </div>
                </div>

                {/* Add to Cart Button */}
                <button
                  onClick={handleAddToCart}
                  disabled={selectedProduct.stock === 0}
                  className={cn(
                    "w-full h-11 sm:h-12 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition shadow-md",
                    selectedProduct.stock === 0
                      ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                      : "bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:shadow-lg"
                  )}
                >
                  <ShoppingCart className="h-4 w-4 sm:h-5 sm:w-5" />
                  ADD {quantity} TO CART
                  <span className="ml-1 px-2 py-0.5 rounded bg-white/20 text-xs font-mono">{formatGHS(selectedProduct.price * quantity)}</span>
                </button>
                <div className="text-center text-[10px] text-slate-400 hidden sm:block">
                  Tip: Double-click any product for quick add (1 unit)
                </div>
              </motion.div>
            ) : (
              <div className="hidden lg:flex flex-col items-center justify-center h-full text-slate-400 p-6 text-center">
                <Search className="h-12 w-12 mb-3 opacity-30" />
                <div className="text-sm font-medium">Select a product</div>
                <div className="text-xs mt-1">Click any product from the list to view details</div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-3 sm:px-6 py-2 sm:py-2.5 bg-white border-t border-slate-200 flex items-center justify-between">
          <div className="hidden sm:flex items-center gap-3 text-xs text-slate-500">
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
          <Button variant="outline" size="sm" onClick={onClose} className="ml-auto">
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
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 30 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 30 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] sm:max-h-[92vh] overflow-hidden flex flex-col"
      >
        {/* Header — compact on mobile */}
        <div className="flex-shrink-0 bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 text-white px-3 sm:px-6 py-2.5 sm:py-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <div className="h-8 w-8 sm:h-11 sm:w-11 rounded-lg sm:rounded-xl bg-white/15 backdrop-blur flex items-center justify-center ring-1 ring-white/20 flex-shrink-0">
              <Eye className="h-4 w-4 sm:h-6 sm:w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm sm:text-lg font-bold truncate">Cart Preview</div>
              <div className="text-[9px] sm:text-xs text-purple-100/90 truncate">
                Invoice #{invoiceNumber} · {totalItems} items
              </div>
            </div>
          </div>
          <button onClick={onClose} className="h-8 w-8 sm:h-9 sm:w-9 rounded-lg bg-white/15 hover:bg-white/25 flex items-center justify-center transition flex-shrink-0">
            <X className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>
        </div>

        {/* Order Meta — stacked on mobile, row on desktop */}
        <div className="flex-shrink-0 px-3 sm:px-6 py-2 sm:py-3 bg-slate-50 border-b border-slate-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-2">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] sm:text-xs text-slate-600">
              <span className="flex items-center gap-1">
                <User className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-slate-400 flex-shrink-0" />
                <span className="font-semibold text-slate-700">Cashier:</span>
                <span className="truncate max-w-[80px] sm:max-w-none">{cashier}</span>
              </span>
              <span className="hidden sm:inline text-slate-300">·</span>
              <span className="flex items-center gap-1">
                <User className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-slate-400 flex-shrink-0" />
                <span className="font-semibold text-slate-700">Customer:</span>
                <span className="truncate max-w-[100px] sm:max-w-none">{customerName || "Walk-in"}</span>
              </span>
              <span className="hidden sm:inline text-slate-300">·</span>
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-slate-400 flex-shrink-0" />
                {new Date().toLocaleDateString('en-GB')}
              </span>
            </div>
            <Badge variant="secondary" className="bg-violet-100 text-violet-700 text-[9px] sm:text-xs flex-shrink-0 w-fit">
              {totalItems} items · {cart.length} lines
            </Badge>
          </div>
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
              {/* Desktop Table Header (hidden on mobile) */}
              <div className="hidden sm:grid flex-shrink-0 grid-cols-[40px_1fr_80px_90px_70px_90px_40px] gap-2 px-5 py-2 bg-slate-800 text-white text-[10px] font-semibold uppercase tracking-wide">
                <div className="text-center">#</div>
                <div>Item</div>
                <div className="text-center">Qty</div>
                <div className="text-right">Price</div>
                <div className="text-center">Disc%</div>
                <div className="text-right">Total</div>
                <div></div>
              </div>

              {/* Mobile column header (visible only on mobile) */}
              <div className="sm:hidden flex-shrink-0 grid grid-cols-[1fr_auto_auto_auto] gap-1 px-3 py-1.5 bg-slate-100 border-b border-slate-200 text-[8px] font-bold text-slate-500 uppercase tracking-wide">
                <div>Item / Part #</div>
                <div className="text-center w-12">Qty</div>
                <div className="text-center w-12">Disc%</div>
                <div className="text-right w-14">Total</div>
              </div>

              {/* Items List — native scroll (not ScrollArea) for mobile compatibility */}
              <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 no-scrollbar" style={{ WebkitOverflowScrolling: 'touch' }}>
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
                          /* Desktop: 7-col grid | Mobile: card layout */
                          className="sm:grid sm:grid-cols-[40px_1fr_80px_90px_70px_90px_40px] sm:gap-2 sm:px-5 sm:py-2.5 sm:items-center sm:text-sm px-3 py-2 transition hover:bg-slate-50 mobile-product-card"
                        >
                          {/* === MOBILE LAYOUT (compact card) === */}
                          <div className="sm:hidden">
                            {/* Row 1: Emoji + Name + Line Total */}
                            <div className="flex items-center gap-1.5">
                              <span className="text-base flex-shrink-0">{item.emoji}</span>
                              <div className="flex-1 min-w-0">
                                <div className="font-semibold text-slate-800 text-[11px] truncate">{item.name}</div>
                                <div className="text-[8px] text-slate-400 font-mono truncate">
                                  {item.sku}
                                  {item.taxable && <span className="ml-1 px-0.5 py-0.5 rounded bg-amber-100 text-amber-700 text-[7px] font-bold">VAT</span>}
                                </div>
                              </div>
                              <div className="font-mono font-bold text-slate-900 text-[11px] flex-shrink-0">{formatGHS(lineFinal)}</div>
                            </div>
                            {/* Row 2: Price/unit + Qty controls + Disc input + Remove */}
                            <div className="flex items-center gap-2 mt-1 pl-7">
                              <span className="text-[8px] text-slate-400 font-mono flex-shrink-0">{formatGHS(item.price)}/{item.unit}</span>
                              <div className="flex items-center gap-0.5 flex-shrink-0">
                                <button onClick={() => onUpdateQuantity(index, item.quantity - 1)} className="h-5 w-5 rounded bg-slate-200 hover:bg-slate-300 flex items-center justify-center transition">
                                  <Minus className="h-2.5 w-2.5" />
                                </button>
                                <span className="w-6 text-center font-mono font-semibold text-slate-700 text-[10px]">{item.quantity.toFixed(item.unit === 'kg' ? 2 : 0)}</span>
                                <button onClick={() => onUpdateQuantity(index, item.quantity + 1)} className="h-5 w-5 rounded bg-slate-200 hover:bg-slate-300 flex items-center justify-center transition">
                                  <Plus className="h-2.5 w-2.5" />
                                </button>
                              </div>
                              {/* Glowing discount input */}
                              <input
                                type="number"
                                value={item.discount || ''}
                                onChange={(e) => onApplyDiscount(index, parseFloat(e.target.value) || 0)}
                                placeholder="0"
                                className="w-9 h-5 text-center text-[9px] font-mono font-bold rounded border-2 border-violet-300 bg-violet-50 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-300/50 transition"
                                title="Line discount %"
                              />
                              <span className="text-[8px] text-violet-500 font-bold flex-shrink-0">%</span>
                              <button onClick={() => onRemoveLine(index)} className="ml-auto h-5 w-5 rounded-md bg-rose-100 text-rose-600 hover:bg-rose-200 flex items-center justify-center transition flex-shrink-0">
                                <Trash2 className="h-2.5 w-2.5" />
                              </button>
                            </div>
                          </div>

                          {/* === DESKTOP LAYOUT (grid) === */}
                          {/* Line # */}
                          <div className="hidden sm:block text-center text-[11px] font-mono text-slate-400">{index + 1}</div>
                          {/* Item */}
                          <div className="hidden sm:flex items-center gap-2 min-w-0">
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
                          <div className="hidden sm:flex items-center justify-center gap-1">
                            <button onClick={() => onUpdateQuantity(index, item.quantity - 1)} className="h-6 w-6 rounded bg-slate-200 hover:bg-slate-300 flex items-center justify-center transition">
                              <Minus className="h-3 w-3" />
                            </button>
                            <span className="w-8 text-center font-mono font-semibold text-slate-700 text-xs">{item.quantity.toFixed(item.unit === 'kg' ? 2 : 0)}</span>
                            <button onClick={() => onUpdateQuantity(index, item.quantity + 1)} className="h-6 w-6 rounded bg-slate-200 hover:bg-slate-300 flex items-center justify-center transition">
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                          {/* Price */}
                          <div className="hidden sm:block text-right font-mono text-slate-700 text-xs">{formatGHS(item.price)}</div>
                          {/* Discount */}
                          <div className="hidden sm:flex justify-center">
                            <input type="number" value={item.discount || ''} onChange={(e) => onApplyDiscount(index, parseFloat(e.target.value) || 0)} placeholder="0" className="w-12 text-center text-[11px] bg-transparent border-b border-slate-200 focus:border-violet-400 outline-none font-mono" />
                          </div>
                          {/* Line Total */}
                          <div className="hidden sm:block text-right font-mono font-semibold text-slate-900">{formatGHS(lineFinal)}</div>
                          {/* Remove */}
                          <button onClick={() => onRemoveLine(index)} className="hidden sm:flex h-7 w-7 rounded-md bg-rose-100 text-rose-600 hover:bg-rose-200 items-center justify-center transition mx-auto" title="Remove line">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Totals + Actions */}
        {cart.length > 0 && (
          <div className="flex-shrink-0 border-t border-slate-200 bg-white">
            {/* Totals — stacked on mobile, 2-col on desktop */}
            <div className="flex flex-col sm:grid sm:grid-cols-2 gap-0">
              {/* Discount Controls */}
              <div className="p-3 sm:p-4 bg-slate-50 sm:border-r border-slate-200 border-b sm:border-b-0">
                <div className="text-[9px] sm:text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5 sm:mb-2">Global Discount</div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={globalDiscount || ''}
                    onChange={(e) => onSetGlobalDiscount(parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    className="w-16 sm:w-20 h-8 sm:h-9 px-2 text-center font-mono font-bold text-sm border-2 border-violet-400 bg-violet-50 rounded-lg outline-none focus:border-violet-600 focus:ring-2 focus:ring-violet-400/40 transition shadow-sm"
                  />
                  <span className="text-sm font-bold text-violet-600">%</span>
                  {globalDiscount > 0 && (
                    <button onClick={onClearDiscount} className="ml-auto px-2 py-1 rounded-md bg-rose-100 text-rose-600 hover:bg-rose-200 text-[9px] sm:text-[10px] font-semibold transition">Clear</button>
                  )}
                </div>
                <div className="mt-1.5 text-[9px] sm:text-[10px] text-slate-500">Applies to entire cart subtotal</div>
              </div>
              {/* Totals */}
              <div className="p-3 sm:p-4 space-y-1">
                <div className="flex justify-between text-[11px] sm:text-xs text-slate-600">
                  <span>Subtotal ({totalItems} items)</span>
                  <span className="font-mono">{formatGHS(subtotal)}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-[11px] sm:text-xs text-rose-600">
                    <span>Discount{globalDiscount > 0 ? ` (${globalDiscount}%)` : ''}</span>
                    <span className="font-mono">-{formatGHS(discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-[11px] sm:text-xs text-slate-600">
                  <span>{TAX_NAME} ({taxRatePercent.toFixed(0)}%)</span>
                  <span className="font-mono">{formatGHS(taxAmount)}</span>
                </div>
                <div className="flex justify-between items-baseline pt-1.5 border-t border-slate-200 mt-1">
                  <span className="text-xs sm:text-sm font-bold text-slate-800">Total Due</span>
                  <span className="text-lg sm:text-2xl font-bold font-mono text-violet-600">{formatGHS(total)}</span>
                </div>
              </div>
            </div>

            {/* Action Buttons — 2x2 grid on mobile, 4-col on desktop */}
            <div className="px-3 sm:px-4 py-2 sm:py-3 bg-white border-t border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-2">
              <button onClick={onContinueShopping} className="h-10 sm:h-12 rounded-lg sm:rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[11px] sm:text-sm flex items-center justify-center gap-1 sm:gap-2 transition">
                <ArrowLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Continue</span>
                <span className="sm:hidden">Shop</span>
              </button>
              <button onClick={() => setConfirmClear(true)} className="h-10 sm:h-12 rounded-lg sm:rounded-xl bg-rose-100 hover:bg-rose-200 text-rose-700 font-semibold text-[11px] sm:text-sm flex items-center justify-center gap-1 sm:gap-2 transition">
                <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Clear Cart</span>
                <span className="sm:hidden">Clear</span>
              </button>
              <button onClick={() => window.print()} className="h-10 sm:h-12 rounded-lg sm:rounded-xl bg-white ring-1 ring-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-[11px] sm:text-sm flex items-center justify-center gap-1 sm:gap-2 transition">
                <Printer className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Print Quote</span>
                <span className="sm:hidden">Print</span>
              </button>
              <button onClick={onProceedToPayment} className="h-10 sm:h-12 rounded-lg sm:rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-[11px] sm:text-sm flex items-center justify-center gap-1 sm:gap-2 transition shadow-md">
                <CreditCard className="h-4 w-4 sm:h-5 sm:w-5" />
                <span className="hidden sm:inline">PROCEED TO PAYMENT</span>
                <span className="sm:hidden">PAY</span>
                <kbd className="hidden sm:inline-block ml-1 px-1.5 py-0.5 rounded bg-white/20 text-[10px] font-mono">F5</kbd>
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

// ===== Helper: Build WhatsApp receipt text from payment data =====
// Defensive: cart items may not have `total` set (it's optional in CartItem),
// and any numeric field on the payment may be missing if the result object
// was assembled from an older code path. Compute everything from primitives.
const safeNum = (v: any): number =>
  typeof v === 'number' && isFinite(v) ? v : 0;
const itemTotalOf = (item: any): number =>
  typeof item.total === 'number' && isFinite(item.total)
    ? item.total
    : safeNum(item.price) * safeNum(item.quantity) * (1 - (safeNum(item.discount) / 100));

function buildWhatsAppReceiptText(payment: any, verifyUrl?: string): string {
  const ts = payment.timestamp instanceof Date
    ? payment.timestamp
    : new Date(payment.timestamp || Date.now());
  const lines: string[] = [
    `*SYLHN COMPANY LTD*`,
    `Grocery Store · East Legon, Accra`,
    `+233 59 276 6044`,
    ``,
    `*Invoice:* ${payment.invoiceNumber || 'N/A'}`,
    `*Date:* ${ts.toLocaleString('en-GB')}`,
    `*Cashier:* ${payment.cashier || 'N/A'}`,
    payment.customer ? `*Customer:* ${payment.customer}` : '',
    ``,
    `*Items:*`,
  ].filter(Boolean);

  for (const item of (payment.items || [])) {
    lines.push(`${item.emoji || '📦'} ${item.name || 'Item'}`);
    lines.push(`   ${safeNum(item.quantity)} × ${CURRENCY}${safeNum(item.price).toFixed(2)} = ${CURRENCY}${itemTotalOf(item).toFixed(2)}`);
  }

  lines.push(``);
  lines.push(`*Subtotal:* ${CURRENCY}${safeNum(payment.subtotal).toFixed(2)}`);
  if (safeNum(payment.discount) > 0) lines.push(`*Discount:* -${CURRENCY}${safeNum(payment.discount).toFixed(2)}`);
  lines.push(`*VAT:* ${CURRENCY}${safeNum(payment.tax).toFixed(2)}`);
  lines.push(`*TOTAL: ${CURRENCY}${safeNum(payment.total).toFixed(2)}*`);
  lines.push(``);
  lines.push(`*Paid:* ${CURRENCY}${safeNum(payment.amountPaid).toFixed(2)} (${payment.method || 'cash'})`);
  lines.push(`*Change:* ${CURRENCY}${safeNum(payment.change).toFixed(2)}`);
  lines.push(``);
  lines.push(`Thank you for shopping with us! 🙏`);
  lines.push(`Goods sold are not returnable.`);
  // Append a tappable online receipt link so customers can view the full
  // receipt in any browser (no WhatsApp needed) — works on the customer's
  // phone even if they don't have WhatsApp installed.
  if (verifyUrl) {
    lines.push(``);
    lines.push(`📄 *View / verify receipt online:*`);
    lines.push(verifyUrl);
  }

  return lines.join("\n");
}

// ===== Receipt Modal =====
// ALL actions work inside the preview iframe — no popups, no new windows.
// Print: opens a full-screen print overlay within the app
// CSV: shows CSV text in a copyable text area
// PDF: same as print (user selects "Save as PDF")
// WhatsApp: shows wa.me link in a copyable text area
function ReceiptModal({ payment, onClose }: { payment: PaymentResult; onClose: () => void }) {
  const [showQR, setShowQR] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [printMode, setPrintMode] = useState(false); // full-screen print overlay
  const [showCSV, setShowCSV] = useState(false);
  const [showWhatsApp, setShowWhatsApp] = useState(false);
  const [waPhone, setWaPhone] = useState("");
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  // Compute the public receipt-verify URL once (used by QR code, WhatsApp
  // message, and the "View Online" button). Prefers saleId when available
  // because it's more reliable than invoice number for lookup.
  const verifyUrl = useMemo(() => {
    if (typeof window === 'undefined') return '';
    const origin = window.location.origin;
    const params = new URLSearchParams();
    if (payment.saleId) params.set('saleId', payment.saleId);
    if (payment.invoiceNumber) params.set('invoice', payment.invoiceNumber);
    return `${origin}/api/receipt/verify?${params.toString()}`;
  }, [payment.saleId, payment.invoiceNumber]);

  // Generate QR code
  useEffect(() => {
    if (!showQR || qrDataUrl || !verifyUrl) return;
    setQrDataUrl(`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(verifyUrl)}`);
  }, [showQR, verifyUrl, qrDataUrl]);

  // Generate CSV string (defensive — item.total is optional in CartItem)
  const csvContent = useMemo(() => {
    const ts = payment.timestamp instanceof Date
      ? payment.timestamp
      : new Date(payment.timestamp || Date.now());
    const rows = [
      ["Field", "Value"],
      ["Invoice", payment.invoiceNumber || 'N/A'],
      ["Date", ts.toLocaleString('en-GB')],
      ["Cashier", payment.cashier || 'N/A'],
      ["Customer", payment.customer || 'Walk-in'],
      ["Subtotal", safeNum(payment.subtotal).toFixed(2)],
      ["Discount", safeNum(payment.discount).toFixed(2)],
      ["Tax", safeNum(payment.tax).toFixed(2)],
      ["Total", safeNum(payment.total).toFixed(2)],
      ["Amount Paid", safeNum(payment.amountPaid).toFixed(2)],
      ["Change", safeNum(payment.change).toFixed(2)],
      ["Payment Method", payment.method || 'cash'],
      ["", ""],
      ["Items", ""],
      ...(payment.items || []).map((item: any) =>
        [`${item.emoji || ''} ${item.name || 'Item'}`,
         `${safeNum(item.quantity)} x ${formatGHS(item.price)} = ${formatGHS(itemTotalOf(item))}`]),
    ];
    return rows.map(r => r.map(c => `"${c}"`).join(",")).join("\n");
  }, [payment]);

  // Generate WhatsApp receipt text (includes the verify URL so customers
  // can tap to view the receipt in any browser)
  const waText = useMemo(() => buildWhatsAppReceiptText(payment, verifyUrl), [payment, verifyUrl]);
  const waLink = useMemo(() => {
    const phone = waPhone.replace(/[\s+\-()]/g, "");
    return phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(waText)}`
      : `https://wa.me/?text=${encodeURIComponent(waText)}`;
  }, [waPhone, waText]);

  // Copy to clipboard (works in iframe using execCommand)
  const copyToClipboard = (text: string) => {
    // Method 1: execCommand (works in older browsers + iframes)
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: 'Copied to clipboard' });
    } catch {
      // Method 2: navigator.clipboard
      navigator.clipboard?.writeText(text).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        toast({ title: 'Copied to clipboard' });
      }).catch(() => {
        toast({ title: 'Copy failed', description: 'Select the text manually and copy', variant: 'destructive' });
      });
    }
    document.body.removeChild(textarea);
  };

  // Download file (works in iframe using Blob + anchor download)
  const downloadFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  };

  // Print receipt HTML (full-screen overlay within the app) — defensive
  const printReceiptHTML = useMemo(() => {
    const itemsHtml = (payment.items || []).map((item: any) => `
      <tr>
        <td style="padding:3px 8px;text-align:left;border-bottom:1px dotted #ccc">${item.emoji || ''} ${item.name || 'Item'}</td>
        <td style="padding:3px 8px;text-align:right;border-bottom:1px dotted #ccc">${safeNum(item.quantity)}</td>
        <td style="padding:3px 8px;text-align:right;border-bottom:1px dotted #ccc">${formatGHS(itemTotalOf(item))}</td>
      </tr>`).join("");
    return `<div style="font-family:monospace;max-width:320px;margin:0 auto;padding:20px;font-size:13px;color:#1e293b">
      <div style="text-align:center;margin-bottom:10px">
        <div style="font-size:16px;font-weight:bold">${COMPANY.name}</div>
        <div style="font-size:11px;color:#64748b">${COMPANY.address}</div>
        <div style="font-size:11px;color:#64748b">${COMPANY.contact}</div>
      </div>
      <hr style="border:none;border-top:1px dashed #94a3b8;margin:8px 0"/>
      <div>Invoice: <strong>${payment.invoiceNumber || 'N/A'}</strong></div>
      <div>Date: ${(payment.timestamp instanceof Date ? payment.timestamp : new Date(payment.timestamp || Date.now())).toLocaleString('en-GB')}</div>
      <div>Cashier: ${payment.cashier || 'N/A'}</div>
      ${payment.customer ? `<div>Customer: ${payment.customer}</div>` : ''}
      <hr style="border:none;border-top:1px dashed #94a3b8;margin:8px 0"/>
      <table style="width:100%;border-collapse:collapse">
        <thead><tr><th style="text-align:left;padding:3px 8px;font-size:11px;border-bottom:1px solid #475569">Item</th><th style="text-align:right;padding:3px 8px;font-size:11px;border-bottom:1px solid #475569">Qty</th><th style="text-align:right;padding:3px 8px;font-size:11px;border-bottom:1px solid #475569">Total</th></tr></thead>
        <tbody>${itemsHtml}</tbody>
      </table>
      <hr style="border:none;border-top:1px dashed #94a3b8;margin:8px 0"/>
      <div style="display:flex;justify-content:space-between"><span>Subtotal:</span><span>${formatGHS(payment.subtotal)}</span></div>
      ${payment.discount > 0 ? `<div style="display:flex;justify-content:space-between"><span>Discount:</span><span>-${formatGHS(payment.discount)}</span></div>` : ''}
      <div style="display:flex;justify-content:space-between"><span>Tax:</span><span>${formatGHS(payment.tax)}</span></div>
      <div style="display:flex;justify-content:space-between;font-size:16px;font-weight:bold;margin-top:5px"><span>TOTAL:</span><span>${formatGHS(payment.total)}</span></div>
      <div style="display:flex;justify-content:space-between;margin-top:5px"><span>Paid (${payment.method}):</span><span>${formatGHS(payment.amountPaid)}</span></div>
      <div style="display:flex;justify-content:space-between"><span>Change:</span><span>${formatGHS(payment.change)}</span></div>
      <hr style="border:none;border-top:1px dashed #94a3b8;margin:8px 0"/>
      <div style="text-align:center;font-size:11px;color:#64748b">
        Thank you for shopping!<br/>Have a fresh &amp; healthy day
        <br/><br/>
        <strong>Goods sold are not returnable.</strong>
      </div>
    </div>`;
  }, [payment]);

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-0 sm:p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, y: 30 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 30 }}
          onClick={(e) => e.stopPropagation()}
          className="dialog-premium shadow-premium-xl w-full max-w-sm max-h-[92vh] flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="flex-shrink-0 bg-gradient-to-r from-emerald-500 to-teal-500 text-white px-6 py-5 text-center">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.2, type: "spring" }}
              className="h-16 w-16 rounded-full bg-white/20 mx-auto flex items-center justify-center mb-2">
              <Check className="h-9 w-9" />
            </motion.div>
            <div className="text-lg font-bold">Payment Successful!</div>
            <div className="text-xs opacity-90 mt-0.5">{(payment.timestamp instanceof Date ? payment.timestamp : new Date(payment.timestamp || Date.now())).toLocaleString('en-GB')}</div>
          </div>

          {/* Receipt body — scrollable with max height */}
          <div className="overflow-y-auto min-h-0 scroll-premium" style={{ maxHeight: '45vh', WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}>
            <div className="px-6 py-4 font-mono text-xs">
              <div className="text-center mb-3">
                <div className="font-bold text-sm text-slate-800">{COMPANY.name}</div>
                <div className="text-slate-500">{COMPANY.address}</div>
                <div className="text-slate-500">{COMPANY.contact}</div>
              </div>
              <Separator className="my-2" />
              <div className="flex justify-between text-slate-600"><span>Invoice:</span><span>#{payment.invoiceNumber}</span></div>
              <div className="flex justify-between text-slate-600"><span>Cashier:</span><span>{payment.cashier}</span></div>
              {payment.customer && <div className="flex justify-between text-slate-600"><span>Customer:</span><span>{payment.customer}</span></div>}
              <Separator className="my-2" />
              {payment.items.map((item, i) => (
                <div key={i} className="mb-1">
                  <div className="flex justify-between text-slate-700">
                    <span className="truncate flex-1">{item.emoji} {item.name}</span>
                    <span className="font-mono ml-2">{formatGHS(item.price * item.quantity)}</span>
                  </div>
                  <div className="text-[10px] text-slate-400">{item.quantity} x {formatGHS(item.price)}</div>
                </div>
              ))}
              <Separator className="my-2" />
              <div className="flex justify-between text-slate-600"><span>Subtotal:</span><span>{formatGHS(payment.subtotal)}</span></div>
              {payment.discount > 0 && <div className="flex justify-between text-rose-600"><span>Discount:</span><span>-{formatGHS(payment.discount)}</span></div>}
              <div className="flex justify-between text-slate-600"><span>{TAX_NAME}:</span><span>{formatGHS(payment.tax)}</span></div>
              <div className="flex justify-between font-bold text-emerald-600 text-sm mt-1"><span>TOTAL:</span><span>{formatGHS(payment.total)}</span></div>
              <div className="flex justify-between text-slate-600 mt-1"><span>Paid ({payment.method}):</span><span>{formatGHS(payment.amountPaid)}</span></div>
              {payment.change > 0 && <div className="flex justify-between font-bold text-emerald-600"><span>Change:</span><span>{formatGHS(payment.change)}</span></div>}

              {showQR && (
                <div className="flex flex-col items-center my-3 p-3 bg-white rounded-lg ring-1 ring-slate-200">
                  {qrDataUrl ? (
                    <img src={qrDataUrl} alt="QR Code" className="h-32 w-32 rounded" onError={() => setQrDataUrl("")} />
                  ) : (
                    <div className="h-32 w-32 flex items-center justify-center bg-slate-50 rounded border-2 border-dashed border-slate-300">
                      <div className="text-center">
                        <div className="text-[10px] text-slate-400">QR Code</div>
                        <div className="text-xs font-mono font-bold text-slate-600 mt-1">{payment.invoiceNumber}</div>
                      </div>
                    </div>
                  )}
                  <div className="text-[10px] text-slate-500 mt-2 text-center">Scan to verify receipt<br/><span className="font-mono">{payment.invoiceNumber}</span></div>
                </div>
              )}

              <div className="text-center text-slate-500 text-[10px] mt-3">
                <div className="font-bold">Thank you for shopping!</div>
                <div>Have a fresh & healthy day 🌿</div>
                <div className="mt-2 text-rose-600 font-bold text-[10px]">Goods sold are not returnable.</div>
              </div>
            </div>
          </div>

          {/* Action buttons — ALWAYS visible */}
          <div className="flex-shrink-0 px-4 py-3 border-t border-slate-200 bg-slate-50 space-y-2">
            <div className="grid grid-cols-4 gap-2">
              <button onClick={() => setPrintMode(true)} className="h-10 rounded-xl bg-white ring-1 ring-slate-200 hover:bg-slate-100 text-slate-700 font-semibold text-xs flex items-center justify-center gap-1">
                <Printer className="h-4 w-4" /> Print
              </button>
              <button onClick={() => downloadFile(csvContent, `receipt-${payment.invoiceNumber}.csv`, 'text/csv')} className="h-10 rounded-xl bg-white ring-1 ring-slate-200 hover:bg-slate-100 text-slate-700 font-semibold text-xs flex items-center justify-center gap-1">
                <FileText className="h-4 w-4" /> CSV
              </button>
              <button onClick={() => { setPrintMode(true); toast({ title: "Select 'Save as PDF' in print dialog" }); }} className="h-10 rounded-xl bg-white ring-1 ring-slate-200 hover:bg-slate-100 text-slate-700 font-semibold text-xs flex items-center justify-center gap-1">
                <FileText className="h-4 w-4" /> PDF
              </button>
              <button onClick={() => setShowWhatsApp(true)} className="h-10 rounded-xl bg-[#25D366] hover:bg-[#1ebe57] text-white font-semibold text-xs flex items-center justify-center gap-1">
                <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/></svg>
                WhatsApp
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setShowQR(s => !s)} className={`h-10 rounded-xl ring-1 ring-slate-200 text-slate-700 font-semibold text-xs flex items-center justify-center gap-1 ${showQR ? 'bg-emerald-100 ring-emerald-300 text-emerald-700' : 'bg-white hover:bg-slate-100'}`}>
                {showQR ? 'Hide QR' : 'Show QR'}
              </button>
              <button onClick={onClose} className="h-10 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold text-xs flex items-center justify-center gap-1 hover:shadow-lg">
                <Check className="h-4 w-4" /> New Sale
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* PRINT OVERLAY — full-screen within the app */}
      {printMode && (
        <div className="fixed inset-0 z-[100] bg-white flex flex-col">
          <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 bg-slate-800 text-white print:hidden">
            <span className="text-sm font-bold">Receipt Preview — {payment.invoiceNumber}</span>
            <div className="flex gap-2">
              <button onClick={() => window.print()} className="h-9 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5">
                <Printer className="h-4 w-4" /> Print / Save as PDF
              </button>
              <button onClick={() => setPrintMode(false)} className="h-9 px-4 rounded-lg bg-slate-600 hover:bg-slate-700 text-white text-xs font-bold flex items-center gap-1.5">
                <X className="h-4 w-4" /> Close
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto" dangerouslySetInnerHTML={{ __html: printReceiptHTML }} />
        </div>
      )}

      {/* WHATSAPP MODAL — in-app, no popups */}
      {showWhatsApp && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-0 sm:p-4" onClick={() => setShowWhatsApp(false)}>
          <div className="dialog-premium shadow-premium-xl w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex-shrink-0 bg-[#25D366] text-white px-5 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/></svg>
                <span className="font-bold text-sm">Send via WhatsApp</span>
              </div>
              <button onClick={() => setShowWhatsApp(false)} className="h-7 w-7 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Customer Phone Number</label>
                <input
                  type="tel"
                  value={waPhone}
                  onChange={(e) => setWaPhone(e.target.value)}
                  placeholder="+233247075044"
                  className="input-premium w-full h-11 px-4 text-sm font-mono font-bold"
                />
                <div className="text-[10px] text-slate-400 mt-1">Enter the customer's phone number with country code</div>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">WhatsApp Link</label>
                <textarea
                  readOnly
                  value={waLink}
                  rows={3}
                  className="input-premium w-full px-3 py-2 text-[10px] font-mono resize-none"
                  onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Receipt Message</label>
                <textarea
                  readOnly
                  value={waText}
                  rows={8}
                  className="input-premium w-full px-3 py-2 text-[10px] font-mono resize-none"
                  onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                />
              </div>
            </div>
            <div className="flex-shrink-0 p-4 border-t border-slate-200 space-y-2">
              {/* Primary: open WhatsApp with prefilled receipt text */}
              <div className="flex gap-2">
                <button onClick={() => copyToClipboard(waLink)} className="btn-premium flex-1 h-10 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold flex items-center justify-center gap-1.5">
                  {copied ? <><Check className="h-3.5 w-3.5" /> Copied!</> : <><FileText className="h-3.5 w-3.5" /> Copy Link</>}
                </button>
                <button onClick={() => copyToClipboard(waText)} className="btn-premium flex-1 h-10 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold flex items-center justify-center gap-1.5">
                  <FileText className="h-3.5 w-3.5" /> Copy Message
                </button>
                <a href={waLink} target="_blank" rel="noopener noreferrer" className="btn-premium flex-1 h-10 rounded-xl bg-[#25D366] hover:bg-[#1ebe57] text-white text-xs font-bold flex items-center justify-center gap-1.5 no-underline">
                  <Send className="h-3.5 w-3.5" /> Open WhatsApp
                </a>
              </div>
              {/* Secondary: view the receipt online in any browser (no WhatsApp needed) */}
              <div className="flex gap-2">
                <button onClick={() => copyToClipboard(verifyUrl)} className="btn-premium flex-1 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold flex items-center justify-center gap-1.5 ring-1 ring-slate-200">
                  <FileText className="h-3.5 w-3.5" /> Copy Receipt URL
                </button>
                <a href={verifyUrl} target="_blank" rel="noopener noreferrer" className="btn-premium flex-1 h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 no-underline">
                  <ExternalLink className="h-3.5 w-3.5" /> View Receipt Online
                </a>
              </div>
              <div className="text-[10px] text-slate-400 text-center">
                💡 “View Receipt Online” opens the receipt in any browser — no WhatsApp required.
                Share this link via SMS, email, or any messenger.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== Premium: Keyboard Shortcuts Overlay (press ? to toggle) ===== */}
      <KeyboardShortcutsOverlay />
    </>
  );
}

// ===== Standard Calculator =====
// A premium calculator with a clean, modern interface.
// Supports: +, -, ×, ÷, %, +/-, decimal, backspace, clear.
function StandardCalculator({ onClose }: { onClose: () => void }) {
  const [display, setDisplay] = useState("0");
  const [previous, setPrevious] = useState<number | null>(null);
  const [operation, setOperation] = useState<string | null>(null);
  const [waitingForOperand, setWaitingForOperand] = useState(false);

  const inputDigit = (digit: string) => {
    if (waitingForOperand) {
      setDisplay(digit);
      setWaitingForOperand(false);
    } else {
      setDisplay(display === "0" ? digit : display + digit);
    }
  };

  const inputDecimal = () => {
    if (waitingForOperand) {
      setDisplay("0.");
      setWaitingForOperand(false);
    } else if (display.indexOf(".") === -1) {
      setDisplay(display + ".");
    }
  };

  const clear = () => {
    setDisplay("0");
    setPrevious(null);
    setOperation(null);
    setWaitingForOperand(false);
  };

  const toggleSign = () => {
    setDisplay(String(parseFloat(display) * -1));
  };

  const inputPercent = () => {
    setDisplay(String(parseFloat(display) / 100));
  };

  const performOperation = (nextOp: string) => {
    const inputValue = parseFloat(display);
    if (previous === null) {
      setPrevious(inputValue);
    } else if (operation) {
      const currentValue = previous;
      let result: number;
      switch (operation) {
        case "+": result = currentValue + inputValue; break;
        case "-": result = currentValue - inputValue; break;
        case "×": result = currentValue * inputValue; break;
        case "÷": result = currentValue / inputValue; break;
        default: result = inputValue;
      }
      result = Math.round(result * 1e10) / 1e10; // avoid floating point
      setDisplay(String(result));
      setPrevious(result);
    }
    setWaitingForOperand(true);
    setOperation(nextOp);
  };

  const handleEquals = () => {
    if (operation && previous !== null) {
      const inputValue = parseFloat(display);
      let result: number;
      switch (operation) {
        case "+": result = previous + inputValue; break;
        case "-": result = previous - inputValue; break;
        case "×": result = previous * inputValue; break;
        case "÷": result = previous / inputValue; break;
        default: result = inputValue;
      }
      result = Math.round(result * 1e10) / 1e10;
      setDisplay(String(result));
      setPrevious(null);
      setOperation(null);
      setWaitingForOperand(true);
    }
  };

  const backspace = () => {
    if (display.length > 1) {
      setDisplay(display.slice(0, -1));
    } else {
      setDisplay("0");
    }
  };

  const formatDisplay = (val: string) => {
    const num = parseFloat(val);
    if (isNaN(num)) return val;
    if (Math.abs(num) >= 1e9) return num.toExponential(4);
    return val.length > 12 ? num.toPrecision(10) : val;
  };

  const CalcButton = ({ label, onClick, variant = "default", wide = false }: {
    label: React.ReactNode; onClick: () => void; variant?: "default" | "accent" | "operator" | "equals"; wide?: boolean;
  }) => {
    const variants = {
      default: "bg-slate-100 hover:bg-slate-200 text-slate-800",
      accent: "bg-slate-200 hover:bg-slate-300 text-slate-800",
      operator: "gradient-premium-emerald text-white hover:brightness-110",
      equals: "gradient-premium-emerald text-white hover:brightness-110",
    };
    // Use onPointerDown for instant response (no 300ms tap delay).
    // This fires on both touch AND mouse immediately.
    const handlePress = (e: React.PointerEvent) => {
      e.preventDefault();
      onClick();
    };
    return (
      <button
        onPointerDown={handlePress}
        style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
        className={cn(
          "h-16 rounded-2xl font-bold text-xl flex items-center justify-center select-none active:brightness-90",
          variants[variant],
          wide && "col-span-2"
        )}
      >
        {label}
      </button>
    );
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <motion.div initial={{ scale: 0.9, y: 30 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 30 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-3xl shadow-premium-xl w-full max-w-xs overflow-hidden">
        {/* Header */}
        <div className="gradient-premium-slate text-white px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalcIcon className="h-4 w-4" />
            <span className="text-sm font-bold">Calculator</span>
          </div>
          <button onClick={onClose} className="h-7 w-7 rounded-lg bg-white/15 hover:bg-white/25 flex items-center justify-center transition">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Display */}
        <div className="px-5 py-6 bg-slate-50">
          <div className="text-right">
            {operation && previous !== null && (
              <div className="text-xs text-slate-400 font-mono mb-1">
                {previous} {operation}
              </div>
            )}
            <div className="text-4xl font-mono font-bold text-slate-800 truncate">
              {formatDisplay(display)}
            </div>
          </div>
        </div>

        {/* Keypad */}
        <div className="p-3 grid grid-cols-4 gap-2">
          <CalcButton label="AC" onClick={clear} variant="accent" />
          <CalcButton label="+/-" onClick={toggleSign} variant="accent" />
          <CalcButton label="%" onClick={inputPercent} variant="accent" />
          <CalcButton label="÷" onClick={() => performOperation("÷")} variant="operator" />

          <CalcButton label="7" onClick={() => inputDigit("7")} />
          <CalcButton label="8" onClick={() => inputDigit("8")} />
          <CalcButton label="9" onClick={() => inputDigit("9")} />
          <CalcButton label="×" onClick={() => performOperation("×")} variant="operator" />

          <CalcButton label="4" onClick={() => inputDigit("4")} />
          <CalcButton label="5" onClick={() => inputDigit("5")} />
          <CalcButton label="6" onClick={() => inputDigit("6")} />
          <CalcButton label="−" onClick={() => performOperation("-")} variant="operator" />

          <CalcButton label="1" onClick={() => inputDigit("1")} />
          <CalcButton label="2" onClick={() => inputDigit("2")} />
          <CalcButton label="3" onClick={() => inputDigit("3")} />
          <CalcButton label="+" onClick={() => performOperation("+")} variant="operator" />

          <CalcButton label="0" onClick={() => inputDigit("0")} wide />
          <CalcButton label="." onClick={inputDecimal} />
          <CalcButton label="=" onClick={handleEquals} variant="equals" />
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

// ===== Premium: Cash Denomination Calculator =====
function CashCalculator({ total, onClose }: { total: number; onClose: () => void }) {
  const DENOMINATIONS = [
    { label: "GHS 100", value: 100 },
    { label: "GHS 50", value: 50 },
    { label: "GHS 20", value: 20 },
    { label: "GHS 10", value: 10 },
    { label: "GHS 5", value: 5 },
    { label: "GHS 2", value: 2 },
    { label: "GHS 1", value: 1 },
    { label: "50p", value: 0.5 },
  ];
  const [counts, setCounts] = useState<Record<number, number>>({});
  const counted = DENOMINATIONS.reduce((s, d) => s + d.value * (counts[d.value] || 0), 0);
  const variance = counted - total;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <motion.div initial={{ scale: 0.95, y: 30 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 30 }}
        onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2"><DollarSign className="h-5 w-5" /><h2 className="text-base font-bold">Cash Calculator</h2></div>
            <button onClick={onClose} className="h-8 w-8 rounded-lg bg-white/15 hover:bg-white/25 flex items-center justify-center"><X className="h-4 w-4" /></button>
          </div>
        </div>
        <div className="p-6 space-y-3">
          <div className="bg-slate-50 rounded-xl p-3 flex justify-between items-center">
            <span className="text-xs font-bold text-slate-600">Expected (Total Due)</span>
            <span className="text-lg font-bold font-mono text-slate-800">{formatGHS(total)}</span>
          </div>
          {DENOMINATIONS.map(d => (
            <div key={d.value} className="flex items-center gap-3">
              <span className="w-16 text-xs font-bold text-slate-600">{d.label}</span>
              <span className="text-slate-400 text-xs">×</span>
              <input type="number" min="0" value={counts[d.value] || ""} onChange={(e) => setCounts(prev => ({ ...prev, [d.value]: parseInt(e.target.value) || 0 }))}
                className="w-16 h-8 px-2 text-center text-sm font-mono border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-400" placeholder="0" />
              <span className="text-slate-400 text-xs">=</span>
              <span className="text-sm font-mono text-slate-700 flex-1">{formatGHS(d.value * (counts[d.value] || 0))}</span>
            </div>
          ))}
          <div className={cn("rounded-xl p-3 flex justify-between items-center border-2", variance === 0 ? "bg-emerald-50 border-emerald-300" : variance > 0 ? "bg-amber-50 border-amber-300" : "bg-rose-50 border-rose-300")}>
            <div>
              <span className="text-xs font-bold text-slate-600">Counted Cash</span>
              <span className="block text-lg font-bold font-mono text-slate-800">{formatGHS(counted)}</span>
            </div>
            <div className="text-right">
              <span className="text-xs font-bold text-slate-600">Variance</span>
              <span className={cn("block text-lg font-bold font-mono", variance === 0 ? "text-emerald-600" : variance > 0 ? "text-amber-600" : "text-rose-600")}>
                {variance > 0 ? "+" : ""}{formatGHS(variance)}
              </span>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ===== Premium: Price Tags Printer =====
function PriceTagsPrinter({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      try {
        const res = await authedFetch("/api/price-tags?limit=200");
        if (res.ok) {
          const data = await res.json();
          setProducts(data.products || []);
        }
      } catch {}
      finally { setLoading(false); }
    })();
  }, []);

  const printTags = () => {
    const toPrint = products.filter(p => selected.has(p.id));
    if (toPrint.length === 0) { toast({ title: "Select at least one product", variant: "destructive" }); return; }
    const win = window.open("", "_blank", "width=800,height=600");
    if (!win) return;
    const tags = toPrint.map(p => `
      <div style="display:inline-block;width:200px;height:120px;margin:5mm;border:2px dashed #999;padding:8px;text-align:center;font-family:Arial">
        <div style="font-size:20px">${p.emoji}</div>
        <div style="font-size:11px;font-weight:bold;margin:2px 0">${p.name}</div>
        <div style="font-size:24px;font-weight:bold;color:#1e40af">${formatGHS(p.price)}</div>
        <div style="font-size:8px;color:#666">SKU: ${p.sku} · per ${p.unit}</div>
        ${p.barcode ? `<div style="font-size:8px;font-family:monospace;margin-top:4px">${p.barcode}</div>` : ""}
        ${p.expiryDate ? `<div style="font-size:8px;color:#dc2626">Exp: ${new Date(p.expiryDate).toLocaleDateString("en-GB")}</div>` : ""}
      </div>`).join("");
    win.document.write(`<!DOCTYPE html><html><head><title>Price Tags</title><style>@media print{body{margin:0}}</style></head><body>${tags}</body></html>`);
    win.document.close();
    setTimeout(() => { win.focus(); win.print(); }, 300);
    toast({ title: `Printing ${toPrint.length} price tags` });
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <motion.div initial={{ scale: 0.95, y: 30 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 30 }}
        onClick={(e) => e.stopPropagation()} className="dialog-premium shadow-premium-xl w-full max-w-2xl max-h-[92vh] sm:max-h-[85vh] flex flex-col">
        <div className="gradient-premium-violet text-white px-6 py-4 flex items-center justify-between relative overflow-hidden">
          <div className="pointer-events-none absolute -top-12 -right-12 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
          <div className="flex items-center gap-2 relative z-10">
            <div className="relative">
              <div className="absolute inset-0 rounded-xl bg-white/25 blur-md scale-110" />
              <div className="relative h-9 w-9 rounded-xl bg-white/15 ring-1 ring-white/30 flex items-center justify-center backdrop-blur-md">
                <Printer className="h-5 w-5" />
              </div>
            </div>
            <h2 className="text-base font-bold tracking-tight">Price Tags / Shelf Labels</h2>
          </div>
          <div className="flex items-center gap-2 relative z-10">
            <button onClick={printTags} disabled={selected.size === 0} className="btn-premium h-9 px-3 rounded-lg gradient-premium-emerald hover:shadow-glow-emerald disabled:opacity-40 text-white text-xs font-bold flex items-center gap-1.5 transition">
              <Printer className="h-3.5 w-3.5" /> Print ({selected.size})
            </button>
            <button onClick={onClose} className="h-9 w-9 rounded-lg bg-white/15 hover:bg-white/25 flex items-center justify-center transition active:scale-90">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 scroll-premium gradient-premium-mesh">
          {loading ? <div className="flex justify-center py-10"><Loader2 className="h-8 w-8 animate-spin text-violet-500" /></div> :
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {products.map(p => (
                <button key={p.id} onClick={() => { const next = new Set(selected); next.has(p.id) ? next.delete(p.id) : next.add(p.id); setSelected(next); }}
                  className={cn("product-card-premium !p-3 text-center transition", selected.has(p.id) ? "!border-emerald-400 !bg-emerald-50/40 ring-2 ring-emerald-400/30" : "")}>
                  <div className="text-2xl">{p.emoji}</div>
                  <div className="text-xs font-semibold text-slate-700 truncate mt-1">{p.name}</div>
                  <div className="text-sm font-bold text-gradient-emerald mt-0.5">{formatGHS(p.price)}</div>
                  <div className="text-[8px] text-slate-400 font-mono mt-0.5 tabular">{p.sku}</div>
                  {selected.has(p.id) && <Check className="h-4 w-4 text-emerald-500 mx-auto mt-1" />}
                </button>
              ))}
            </div>}
        </div>
      </motion.div>
    </motion.div>
  );
}
