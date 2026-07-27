"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Home, ShoppingCart, BarChart3, Package, Truck,
  FileText, Receipt, Clock, TrendingUp, Wallet, Phone, PhoneCall, Mail,
  Wrench, Shield, Settings, Sparkles, History, Users, Map as MapIcon,
  Smartphone, Printer, DollarSign, ScanLine, Calculator, Tags,
  CreditCard, Eye, Search, Plus, AlertCircle, Database, Lock,
  Brain, MessageCircle, AlertTriangle, ClipboardCheck, Upload,
  RefreshCw, Globe, BookOpen, FileBarChart, Clock3, Power, Sun, Moon,
  ChevronDown, ChevronRight, X, ArrowUpRight, Store, Zap, Layers,
  Key, Activity, Wifi, WifiOff, Bell, Calendar, BarChart2, PieChart,
  Filter, Star, Crown,
} from "lucide-react";
import { COMPANY } from "@/lib/pos-data";

interface FeaturesMapProps {
  onBack: () => void;
  onNavigate: (view: string) => void;
}

type FeaturePhase = "core" | "phase1" | "phase2" | "phase3" | "phase4" | "phase5";
type AccessLevel = "all" | "admin" | "manager";

interface FeatureEntry {
  name: string;
  description: string;
  icon: any;
  location: string;        // exact place to find it
  locationLabel: string;   // short label for the location pill
  action?: string;         // view to navigate to
  href?: string;           // external URL
  color: string;
  bg: string;
  phase?: FeaturePhase;
  access?: AccessLevel;
  shortcut?: string;
}

interface FeatureCategory {
  category: string;
  icon: any;
  color: string;
  features: FeatureEntry[];
}

const PHASE_LABELS: Record<FeaturePhase, string> = {
  core: "Core",
  phase1: "Phase 1",
  phase2: "Phase 2",
  phase3: "Phase 3",
  phase4: "Phase 4",
  phase5: "Phase 5",
};

const PHASE_COLORS: Record<FeaturePhase, string> = {
  core: "bg-slate-100 text-slate-600",
  phase1: "bg-emerald-100 text-emerald-700",
  phase2: "bg-blue-100 text-blue-700",
  phase3: "bg-violet-100 text-violet-700",
  phase4: "bg-amber-100 text-amber-700",
  phase5: "bg-rose-100 text-rose-700",
};

const CATEGORIES: FeatureCategory[] = [
  {
    category: "Sales & Checkout",
    icon: ShoppingCart,
    color: "text-emerald-600",
    features: [
      { name: "POS Screen", description: "Main checkout screen — scan barcodes, add items to cart, take payment", icon: Home, location: "Bottom Nav → POS tab  ·  or Ctrl+P", locationLabel: "Bottom Nav", action: "pos", color: "text-emerald-600", bg: "bg-emerald-50", phase: "core", access: "all", shortcut: "Ctrl+P" },
      { name: "View Cart", description: "See items in current sale, adjust quantities, apply discounts", icon: ShoppingCart, location: "Bottom Nav → Cart tab  ·  or click cart icon", locationLabel: "Bottom Nav", action: "pos", color: "text-emerald-600", bg: "bg-emerald-50", phase: "core", access: "all" },
      { name: "Pay Now", description: "Open payment modal — cash, card, or mobile money", icon: CreditCard, location: "POS Screen → green PAY NOW button", locationLabel: "POS button", action: "pos", color: "text-emerald-600", bg: "bg-emerald-50", phase: "core", access: "all", shortcut: "F5" },
      { name: "Hold / Save Order", description: "Park current sale to resume later — perfect for waiting customers", icon: Receipt, location: "Sale menu → Save / Hold Order", locationLabel: "Sale menu", action: "pos", color: "text-emerald-600", bg: "bg-emerald-50", phase: "core", access: "all", shortcut: "F2" },
      { name: "Sequential Invoice Numbers", description: "Auto-generated INV-YYYY-NNNNNN invoice numbers for GRA compliance — never reuse, never skip", icon: FileText, location: "Automatic — every receipt has one. Visible on receipts & Sales History.", locationLabel: "Automatic", color: "text-blue-600", bg: "bg-blue-50", phase: "phase2", access: "all" },
      { name: "Sales Menu", description: "All sales-related reports and history in one place", icon: FileText, location: "More → Sales → Sales Menu", locationLabel: "More drawer", action: "sales-menu", color: "text-blue-600", bg: "bg-blue-50", phase: "core", access: "all" },
      { name: "Sold Items Report", description: "Top-selling items grouped by category", icon: FileBarChart, location: "More → Sales → Sold Items Report", locationLabel: "More drawer", action: "sold-items", color: "text-emerald-600", bg: "bg-emerald-50", phase: "core", access: "all" },
      { name: "Sales History", description: "All past transactions with filter & export — date range filter included", icon: Clock, location: "More → Sales → Sales History", locationLabel: "More drawer", action: "sales-history", color: "text-teal-600", bg: "bg-teal-50", phase: "core", access: "all" },
      { name: "Daily Sales Report", description: "Today's sales summary with totals and breakdowns", icon: TrendingUp, location: "More → Sales → Daily Sales Report", locationLabel: "More drawer", action: "daily-sales", color: "text-cyan-600", bg: "bg-cyan-50", phase: "core", access: "all" },
      { name: "Receipt Archive", description: "Browse, reprint, or resend past receipts — search by invoice number or date", icon: FileText, location: "POS menu → 🧾 Receipt Archive  ·  or More → Sales", locationLabel: "POS menu", action: "receipt-archive", color: "text-slate-600", bg: "bg-slate-50", phase: "core", access: "all" },
      { name: "Customer Display Screen", description: "Dedicated customer-facing display — open on a second monitor or tablet", icon: Eye, location: "URL: /display  ·  open in browser on second screen", locationLabel: "Standalone URL", href: "/display", color: "text-violet-600", bg: "bg-violet-50", phase: "phase3", access: "all" },
    ],
  },
  {
    category: "Stock & Inventory",
    icon: Package,
    color: "text-blue-600",
    features: [
      { name: "Stock Management", description: "Add/modify products, group maintenance, quantity adjustments, stock history", icon: Package, location: "More → Stock → Stock Management", locationLabel: "More drawer", action: "stock", color: "text-blue-600", bg: "bg-blue-50", phase: "core", access: "all" },
      { name: "Stock Search", description: "Premium popup with 5-column grid, 7 action buttons — find any product fast", icon: Search, location: "POS Screen → FIND PRODUCT button", locationLabel: "POS button", action: "pos", color: "text-blue-600", bg: "bg-blue-50", phase: "core", access: "all" },
      { name: "Barcode Scanner (Camera)", description: "Camera-based barcode scanner for fast product lookup", icon: ScanLine, location: "POS Screen → Scan button next to search  ·  or SpeedDial", locationLabel: "POS toolbar", action: "pos", color: "text-emerald-600", bg: "bg-emerald-50", phase: "core", access: "all" },
      { name: "Stock History Pro", description: "Advanced stock movement analytics with charts and trends", icon: History, location: "More → Stock → Stock History Pro", locationLabel: "More drawer", action: "stock-history-pro", color: "text-indigo-600", bg: "bg-indigo-50", phase: "core", access: "all" },
      { name: "Expiry Management (FEFO)", description: "First-Expiry-First-Out management with 4 urgency levels and value-at-risk tracking", icon: AlertTriangle, location: "Top toolbar → Expiry button (orange)", locationLabel: "Top toolbar", action: "pos", color: "text-orange-600", bg: "bg-orange-50", phase: "phase3", access: "all" },
      { name: "Stocktake Wizard", description: "4-step physical count: Create → Count → Review variances → Post adjustments", icon: ClipboardCheck, location: "Top toolbar → Stocktake button (indigo, admin/manager only)", locationLabel: "Top toolbar", action: "pos", color: "text-indigo-600", bg: "bg-indigo-50", phase: "phase2", access: "manager" },
      { name: "Bulk Product CSV Import", description: "Import hundreds of products from a CSV file — map columns automatically", icon: Upload, location: "Top toolbar → Import button (blue, admin/manager only)", locationLabel: "Top toolbar", action: "pos", color: "text-blue-600", bg: "bg-blue-50", phase: "phase5", access: "manager" },
      { name: "Multi-Store Location Switcher", description: "Switch between multiple store locations from the header — per-location stock and reporting", icon: Store, location: "Header bar → location dropdown (next to logo, only shows if locations exist)", locationLabel: "Header bar", color: "text-purple-600", bg: "bg-purple-50", phase: "phase5", access: "all" },
      { name: "Group Maintenance", description: "Organize products into groups/categories for easier management", icon: Layers, location: "More → Stock → Group Maintenance", locationLabel: "More drawer", action: "stock", color: "text-blue-600", bg: "bg-blue-50", phase: "core", access: "all" },
      { name: "Quantity Adjustment", description: "Adjust stock quantities with reason codes (admin/canAdjustStock only)", icon: TrendingUp, location: "More → Stock → Quantity Adjustment", locationLabel: "More drawer", action: "stock", color: "text-amber-600", bg: "bg-amber-50", phase: "core", access: "admin" },
      { name: "Stock Reports", description: "Stock quantity report, stock value, reorder report, expiry date report", icon: FileBarChart, location: "More → Stock → Stock Reports", locationLabel: "More drawer", action: "reports", color: "text-slate-600", bg: "bg-slate-50", phase: "core", access: "all" },
    ],
  },
  {
    category: "Purchasing & Suppliers",
    icon: Truck,
    color: "text-purple-600",
    features: [
      { name: "New Purchase Order", description: "Create a purchase order — multi-currency, landed costs, batch numbers, expiry dates, line-level discounts and tax rates", icon: FileText, location: "More → Purchasing → New Purchase", locationLabel: "More drawer", action: "purchase-form", color: "text-purple-600", bg: "bg-purple-50", phase: "core", access: "all" },
      { name: "Purchase Orders", description: "View all purchase orders, receive stock (GRN), track payments, approval workflow", icon: Truck, location: "More → Purchasing → Purchase Orders", locationLabel: "More drawer", action: "purchase", color: "text-violet-600", bg: "bg-violet-50", phase: "core", access: "all" },
      { name: "Receive Stock (GRN)", description: "Goods Received Note workflow — verify quantities, inspect quality, update stock automatically", icon: Package, location: "More → Purchasing → Purchase Orders → Receive", locationLabel: "Purchase Orders", action: "purchase", color: "text-emerald-600", bg: "bg-emerald-50", phase: "core", access: "all" },
      { name: "Supplier Directory", description: "Manage supplier contacts, balances, order history, catalog, notes — admin/manager can edit & delete", icon: Users, location: "More → Purchasing → Suppliers", locationLabel: "More drawer", action: "supplier-form", color: "text-indigo-600", bg: "bg-indigo-50", phase: "core", access: "all" },
      { name: "Supplier Payments", description: "Record payments to suppliers, track outstanding balances", icon: DollarSign, location: "More → Purchasing → Supplier Payments", locationLabel: "More drawer", action: "purchase", color: "text-rose-600", bg: "bg-rose-50", phase: "core", access: "all" },
      { name: "Recurring Purchase Orders", description: "Auto-generate weekly or monthly purchase orders — never run out of stock on routine items", icon: RefreshCw, location: "Top toolbar → Recurring button (admin/manager only)", locationLabel: "Top toolbar", action: "pos", color: "text-cyan-600", bg: "bg-cyan-50", phase: "phase4", access: "manager" },
      { name: "Supplier Portal", description: "Suppliers can view pending POs and submit quotes — standalone URL", icon: Globe, location: "URL: /supplier-portal  ·  share with suppliers", locationLabel: "Standalone URL", href: "/supplier-portal", color: "text-blue-600", bg: "bg-blue-50", phase: "phase5", access: "all" },
    ],
  },
  {
    category: "Payments & Checkout Methods",
    icon: CreditCard,
    color: "text-emerald-600",
    features: [
      { name: "Cash Payment", description: "Standard cash payment with auto-calculated change", icon: DollarSign, location: "Payment modal → Cash tab", locationLabel: "Payment modal", action: "pos", color: "text-emerald-600", bg: "bg-emerald-50", phase: "core", access: "all" },
      { name: "Mobile Money (MTN / Telecel / AirtelTigo)", description: "Multi-network MoMo — auto-detects network from phone number, generates payment prompt", icon: Smartphone, location: "Payment modal → MoMo tab  ·  enter customer phone number", locationLabel: "Payment modal", action: "pos", color: "text-yellow-600", bg: "bg-yellow-50", phase: "phase2", access: "all" },
      { name: "Paystack Card Payment", description: "Visa / Mastercard / Verve card payments via Paystack — secure online checkout", icon: CreditCard, location: "Payment modal → Card tab  ·  requires Paystack keys in env", locationLabel: "Payment modal", action: "pos", color: "text-blue-600", bg: "bg-blue-50", phase: "phase2", access: "all" },
      { name: "Loyalty Points Redemption", description: "Customers redeem loyalty points at checkout — slider for partial or full redemption, real-time discount", icon: Star, location: "Payment modal → Loyalty slider (visible if customer has points)", locationLabel: "Payment modal", action: "pos", color: "text-amber-600", bg: "bg-amber-50", phase: "phase4", access: "all" },
      { name: "Credit Sales", description: "Sell on credit to trusted customers — track balances and payment history", icon: CreditCard, location: "Payment modal → Credit tab (requires customer)", locationLabel: "Payment modal", action: "pos", color: "text-rose-600", bg: "bg-rose-50", phase: "core", access: "all" },
      { name: "Cash Calculator", description: "Denomination counter for fast cash reconciliation — counts notes & coins", icon: Calculator, location: "Top toolbar → Cash Calc button  ·  or SpeedDial", locationLabel: "Top toolbar", action: "pos", color: "text-amber-600", bg: "bg-amber-50", phase: "core", access: "all" },
    ],
  },
  {
    category: "Finance & Accounts",
    icon: Wallet,
    color: "text-rose-600",
    features: [
      { name: "Finance Operations Hub", description: "Central hub for expenses, cash reconciliation, mobile money tracking", icon: Wallet, location: "More → Finance & Accounts → Finance Operations", locationLabel: "More drawer", action: "finance-ops", color: "text-rose-600", bg: "bg-rose-50", phase: "core", access: "all" },
      { name: "Expense Manager", description: "Record expenses across 8 categories (rent, utilities, salaries, etc.) — CSV export, approval warnings", icon: Wallet, location: "Top toolbar → Expenses button (rose)  ·  or Finance Operations → Expenses", locationLabel: "Top toolbar", action: "pos", color: "text-rose-600", bg: "bg-rose-50", phase: "phase2", access: "all" },
      { name: "Accounts Reports", description: "P&L, VAT, trial balance, stock valuation, general ledger — full accounting suite", icon: TrendingUp, location: "More → Finance & Accounts → Accounts Reports", locationLabel: "More drawer", action: "accounts-reports", color: "text-amber-600", bg: "bg-amber-50", phase: "core", access: "all" },
      { name: "Credit Management", description: "Track customer credit balances, record payments, view aging report", icon: CreditCard, location: "Accounts menu → 💳 Credit Management", locationLabel: "Accounts menu", action: "credit-management", color: "text-rose-600", bg: "bg-rose-50", phase: "core", access: "all" },
      { name: "Auto Replenish Rules", description: "Set min/max levels — system auto-suggests reorder quantities", icon: RefreshCw, location: "Accounts menu → 🔄 Auto Replenish Rules", locationLabel: "Accounts menu", action: "auto-replenish", color: "text-cyan-600", bg: "bg-cyan-50", phase: "core", access: "all" },
      { name: "Multi-Currency Support", description: "Auto-fetch exchange rates from open.er-api.com — set purchase currency per PO", icon: Globe, location: "Purchase Form → Currency dropdown  ·  auto-updates daily", locationLabel: "Purchase Form", action: "purchase-form", color: "text-blue-600", bg: "bg-blue-50", phase: "phase4", access: "all" },
      { name: "Accounting Export (Journal CSV)", description: "Export journal entries as CSV for import into QuickBooks, Xero, Sage, or any accounting software", icon: FileText, location: "Accounts Reports → General Ledger → Export CSV", locationLabel: "Accounts Reports", action: "accounts-reports", color: "text-slate-600", bg: "bg-slate-50", phase: "phase5", access: "all" },
      { name: "Cash Reconciliation", description: "End-of-shift cash count vs expected — variances flagged for review", icon: Calculator, location: "Finance Operations → Cash Reconciliation tab", locationLabel: "Finance Ops", action: "finance-ops", color: "text-amber-600", bg: "bg-amber-50", phase: "core", access: "all" },
    ],
  },
  {
    category: "GRA Tax Compliance",
    icon: Shield,
    color: "text-rose-700",
    features: [
      { name: "Sequential Invoice Numbers", description: "INV-YYYY-NNNNNN format — never reuse, never skip. Required by GRA.", icon: FileText, location: "Automatic on every receipt", locationLabel: "Automatic", color: "text-rose-600", bg: "bg-rose-50", phase: "phase2", access: "all" },
      { name: "VAT / NHIL / GETFL Breakdown", description: "Ghana tax breakdown on every receipt: VAT 15% + NHIL 2.5% + GETFL 2.5%", icon: Percent, location: "Automatic on every receipt & in Accounts Reports", locationLabel: "Automatic", color: "text-rose-600", bg: "bg-rose-50", phase: "phase2", access: "all" },
      { name: "GRA VAT Filing Report", description: "Generate the official GRA e-VAT filing report — view, print, or export", icon: FileText, location: "Accounts menu → 📊 GRA VAT Filing Report (View / Print)", locationLabel: "Accounts menu", action: "accounts-reports", color: "text-rose-700", bg: "bg-rose-50", phase: "phase2", access: "all" },
      { name: "GRA e-VAT Export (JSON / XML)", description: "Export e-VAT filing in JSON or XML format for direct upload to GRA portal", icon: FileText, location: "Accounts menu → GRA e-VAT Export (JSON / XML)", locationLabel: "Accounts menu", action: "accounts-reports", color: "text-rose-700", bg: "bg-rose-50", phase: "phase2", access: "all" },
      { name: "CSV Tax Export", description: "Export all VAT/NHIL/GETFL data as CSV for accounting or audit", icon: FileText, location: "Accounts Reports → VAT Tax Report → Export CSV", locationLabel: "Accounts Reports", action: "accounts-reports", color: "text-rose-600", bg: "bg-rose-50", phase: "phase2", access: "all" },
    ],
  },
  {
    category: "Communication",
    icon: Phone,
    color: "text-cyan-600",
    features: [
      { name: "Telephone Directory", description: "Customer and supplier phone directory — searchable", icon: Phone, location: "More → Communication → Telephone Directory", locationLabel: "More drawer", action: "telephone-directory", color: "text-cyan-600", bg: "bg-cyan-50", phase: "core", access: "all" },
      { name: "Telephone Module", description: "Make and log phone calls to customers/suppliers", icon: PhoneCall, location: "More → Communication → Telephone Module", locationLabel: "More drawer", action: "telephone", color: "text-blue-600", bg: "bg-blue-50", phase: "core", access: "all" },
      { name: "Email System", description: "Send invoices, reports, and statements via email — SMTP-integrated", icon: Mail, location: "Maintenance menu → 📧 Email System", locationLabel: "Maintenance menu", action: "email-system", color: "text-blue-600", bg: "bg-blue-50", phase: "core", access: "all" },
      { name: "WhatsApp Receipt Sender", description: "Send digital receipts via WhatsApp — auto-fills receipt text and link", icon: MessageCircle, location: "Receipt modal → WhatsApp button (green)", locationLabel: "Receipt modal", action: "pos", color: "text-green-600", bg: "bg-green-50", phase: "core", access: "all" },
      { name: "WhatsApp Broadcast Marketing", description: "Send bulk WhatsApp messages to customers — filter by tier, credit balance, or last visit", icon: MessageCircle, location: "Top toolbar → Broadcast button (green, admin/manager only)", locationLabel: "Top toolbar", action: "pos", color: "text-green-600", bg: "bg-green-50", phase: "phase3", access: "manager" },
    ],
  },
  {
    category: "Print & Labels",
    icon: Printer,
    color: "text-purple-600",
    features: [
      { name: "Thermal Printer (ESC/POS)", description: "Bluetooth thermal printer integration — auto-pair, browser fallback for regular printers", icon: Printer, location: "SpeedDial → Pair Printer  ·  receipts auto-print after sale", locationLabel: "SpeedDial", action: "pos", color: "text-blue-600", bg: "bg-blue-50", phase: "phase1", access: "all" },
      { name: "Label Printer (4 sizes, Code 128 barcode)", description: "Print product labels with scannable Code 128 barcodes — 4 label sizes, multi-select", icon: Tags, location: "Top toolbar → Labels button (purple)", locationLabel: "Top toolbar", action: "pos", color: "text-purple-600", bg: "bg-purple-50", phase: "phase1", access: "all" },
      { name: "Price Tags Printer", description: "Print simple shelf price tags for products", icon: Tags, location: "Top toolbar → Tags button", locationLabel: "Top toolbar", action: "pos", color: "text-purple-600", bg: "bg-purple-50", phase: "core", access: "all" },
      { name: "Receipt Print (PDF / Paper)", description: "Print receipt to any connected printer or save as PDF", icon: Printer, location: "Receipt modal → Print / PDF button", locationLabel: "Receipt modal", action: "pos", color: "text-slate-600", bg: "bg-slate-50", phase: "core", access: "all", shortcut: "F3" },
      { name: "Brand-able Purchase Order PDF", description: "Generate branded PDF purchase orders to send to suppliers", icon: FileText, location: "Purchase Orders → select PO → Download PDF", locationLabel: "Purchase Orders", action: "purchase", color: "text-violet-600", bg: "bg-violet-50", phase: "core", access: "all" },
    ],
  },
  {
    category: "AI Tools",
    icon: Sparkles,
    color: "text-violet-600",
    features: [
      { name: "AI Business Assistant", description: "Ask natural-language questions about your business — sales trends, stock advice, customer insights", icon: Sparkles, location: "Header bar → user avatar → AI Assistant  ·  or SpeedDial → AI", locationLabel: "User menu", action: "pos", color: "text-violet-600", bg: "bg-violet-50", phase: "core", access: "all" },
      { name: "AI Demand Forecast", description: "Predict future demand for products — 7/14/30/60/90-day forecasts with confidence scores and reorder suggestions", icon: Brain, location: "Top toolbar → AI Forecast button (violet, admin/manager only)", locationLabel: "Top toolbar", action: "pos", color: "text-violet-600", bg: "bg-violet-50", phase: "phase3", access: "manager" },
      { name: "Voice Search", description: "Search products by speaking — Web Speech API integration", icon: Mic, location: "POS Screen → microphone icon next to search bar", locationLabel: "POS toolbar", action: "pos", color: "text-cyan-600", bg: "bg-cyan-50", phase: "phase5", access: "all" },
    ],
  },
  {
    category: "Reports & Analytics",
    icon: BarChart3,
    color: "text-amber-600",
    features: [
      { name: "Operations Dashboard", description: "Real-time KPIs: today's revenue, transactions, top products, low stock, expiry alerts, hourly chart", icon: BarChart3, location: "Bottom Nav → Dashboard tab", locationLabel: "Bottom Nav", action: "dashboard", color: "text-emerald-600", bg: "bg-emerald-50", phase: "core", access: "all" },
      { name: "Advanced Reports Dashboard", description: "ABC analysis, profit margins, hourly traffic, employee performance — deep business analytics", icon: PieChart, location: "Top toolbar → Reports button (amber, admin/manager only)", locationLabel: "Top toolbar", action: "pos", color: "text-amber-600", bg: "bg-amber-50", phase: "phase4", access: "manager" },
      { name: "Reports Center", description: "Central hub for all reports — sales, stock, finance, tax", icon: FileBarChart, location: "POS menu → 📋 Reports Center", locationLabel: "POS menu", action: "reports-center", color: "text-blue-600", bg: "bg-blue-50", phase: "core", access: "all" },
      { name: "Receipt Archive", description: "Browse, reprint, or resend past receipts", icon: FileText, location: "POS menu → 🧾 Receipt Archive", locationLabel: "POS menu", action: "receipt-archive", color: "text-slate-600", bg: "bg-slate-50", phase: "core", access: "all" },
    ],
  },
  {
    category: "Operations & Admin",
    icon: Shield,
    color: "text-purple-600",
    features: [
      { name: "Maintenance & Settings", description: "System maintenance tools, backups, data integrity checks, system settings", icon: Wrench, location: "Top menu → Maintenance", locationLabel: "Top menu", action: "maintenance", color: "text-orange-600", bg: "bg-orange-50", phase: "core", access: "all" },
      { name: "Admin Panel", description: "User management, system settings, audit logs — admin only", icon: Shield, location: "Maintenance menu → Admin Panel  ·  requires admin credentials", locationLabel: "Maintenance menu", action: "admin-login", color: "text-purple-600", bg: "bg-purple-50", phase: "core", access: "admin" },
      { name: "User Management", description: "Add/edit users, assign roles (admin/manager/cashier), set granular permissions", icon: Users, location: "Maintenance → User Management  ·  or Admin Panel", locationLabel: "Admin Panel", action: "maintenance", color: "text-indigo-600", bg: "bg-indigo-50", phase: "core", access: "admin" },
      { name: "2FA (TOTP)", description: "Two-factor authentication using Google Authenticator / Authy — TOTP standard", icon: Lock, location: "Admin Panel → Security → 2FA Setup (admin only)", locationLabel: "Admin Panel", action: "admin-login", color: "text-rose-600", bg: "bg-rose-50", phase: "phase5", access: "admin" },
      { name: "Sync Settings", description: "Configure data sync, offline mode, and server connection", icon: Settings, location: "More → Admin → Sync Settings", locationLabel: "More drawer", action: "sync-settings", color: "text-slate-600", bg: "bg-slate-50", phase: "core", access: "admin" },
      { name: "Cashier Shift Management", description: "Open/close cashier shifts, track shift totals, end-of-day reconciliation", icon: Clock3, location: "Maintenance menu → Cashier Shift", locationLabel: "Maintenance menu", action: "maintenance", color: "text-cyan-600", bg: "bg-cyan-50", phase: "core", access: "all" },
      { name: "Email System Config", description: "Configure SMTP for sending emails (Gmail App Password or other provider)", icon: Mail, location: "Maintenance menu → 📧 Email System", locationLabel: "Maintenance menu", action: "email-system", color: "text-blue-600", bg: "bg-blue-50", phase: "core", access: "admin" },
    ],
  },
  {
    category: "Data, Backup & Performance",
    icon: Database,
    color: "text-slate-600",
    features: [
      { name: "Database Backup Automation", description: "Automatic daily backups via cron API — 30-day retention, restore from Admin Panel", icon: Database, location: "Automatic (daily)  ·  manage in Admin Panel → Backups", locationLabel: "Automatic", color: "text-slate-600", bg: "bg-slate-50", phase: "phase1", access: "admin" },
      { name: "Offline Mode (IndexedDB)", description: "Continue selling during internet outages — sales queue locally and auto-sync when online", icon: WifiOff, location: "Automatic  ·  status indicator in header (left of user menu)", locationLabel: "Header indicator", color: "text-amber-600", bg: "bg-amber-50", phase: "phase1", access: "all" },
      { name: "PWA Mobile App", description: "Install SYLHN POS as a Progressive Web App on any device — works offline, native-like experience", icon: Smartphone, location: "Header bar → Install button  ·  or browser → Install App", locationLabel: "Header button", color: "text-violet-600", bg: "bg-violet-50", phase: "phase5", access: "all" },
      { name: "Performance Optimizations", description: "7 database indexes + API caching + query optimization — fast on slow connections", icon: Zap, location: "Automatic  ·  applied via SQL script in /scripts/", locationLabel: "Automatic", color: "text-amber-600", bg: "bg-amber-50", phase: "phase5", access: "admin" },
      { name: "Data Integrity Protection", description: "3-layer protection: backup snapshots + SHA-256 manifest + auto-restore on startup", icon: Shield, location: "Automatic on dev server start  ·  scripts/protection-snapshot.js", locationLabel: "Automatic", color: "text-emerald-600", bg: "bg-emerald-50", phase: "phase5", access: "admin" },
    ],
  },
  {
    category: "Security",
    icon: Lock,
    color: "text-rose-600",
    features: [
      { name: "Strong Password Validation", description: "Enforces strong passwords: min 8 chars, mix of upper/lower/numbers", icon: Key, location: "Automatic  ·  enforced on user creation & password change", locationLabel: "Automatic", color: "text-rose-600", bg: "bg-rose-50", phase: "phase5", access: "admin" },
      { name: "Force Password Change on First Login", description: "New users must change their password on first login — prevents default-password attacks", icon: RefreshCw, location: "Automatic  ·  triggered for new users", locationLabel: "Automatic", color: "text-rose-600", bg: "bg-rose-50", phase: "phase5", access: "admin" },
      { name: "Account Lockout", description: "Auto-lock account after repeated failed login attempts — protects against brute force", icon: Lock, location: "Automatic  ·  unlocks via admin", locationLabel: "Automatic", color: "text-rose-600", bg: "bg-rose-50", phase: "phase5", access: "admin" },
      { name: "Manager Approval for Sensitive Actions", description: "Void transactions, returns, and stock adjustments require manager PIN", icon: Shield, location: "Automatic  ·  prompts when action requires approval", locationLabel: "Automatic", color: "text-purple-600", bg: "bg-purple-50", phase: "core", access: "manager" },
      { name: "Audit Log", description: "Every sensitive action is logged — who did what and when. View in Admin Panel.", icon: History, location: "Admin Panel → Audit Log", locationLabel: "Admin Panel", action: "admin-login", color: "text-slate-600", bg: "bg-slate-50", phase: "core", access: "admin" },
    ],
  },
  {
    category: "Quick Actions (SpeedDial)",
    icon: Plus,
    color: "text-emerald-600",
    features: [
      { name: "AI Assistant", description: "Open AI business assistant chat", icon: Sparkles, location: "Floating + button (bottom-left) → AI Assistant", locationLabel: "SpeedDial", action: "pos", color: "text-violet-600", bg: "bg-violet-50", phase: "core", access: "all" },
      { name: "Scan Barcode", description: "Camera barcode scanner", icon: ScanLine, location: "Floating + button → Scan Barcode", locationLabel: "SpeedDial", action: "pos", color: "text-emerald-600", bg: "bg-emerald-50", phase: "core", access: "all" },
      { name: "Pair Thermal Printer", description: "Pair a Bluetooth thermal printer for receipt printing", icon: Printer, location: "Floating + button → Pair Printer", locationLabel: "SpeedDial", action: "pos", color: "text-blue-600", bg: "bg-blue-50", phase: "phase1", access: "all" },
      { name: "Cash Calculator", description: "Quick denomination counter", icon: Calculator, location: "Floating + button → Cash Calculator", locationLabel: "SpeedDial", action: "pos", color: "text-amber-600", bg: "bg-amber-50", phase: "core", access: "all" },
    ],
  },
  {
    category: "Header Bar (top of screen)",
    icon: Store,
    color: "text-emerald-700",
    features: [
      { name: "User Menu (AI / Shortcuts / Logout)", description: "Click your avatar — opens menu with AI Assistant, Keyboard Shortcuts, Dark Mode, Features Map (admin), Logout", icon: Users, location: "Header bar → click your avatar (top-right)", locationLabel: "Header → Avatar", color: "text-emerald-600", bg: "bg-emerald-50", phase: "phase5", access: "all" },
      { name: "Dark Mode Toggle", description: "Switch between light and dark themes", icon: Moon, location: "Header bar → moon/sun icon  ·  or User Menu", locationLabel: "Header bar", color: "text-slate-600", bg: "bg-slate-50", phase: "core", access: "all" },
      { name: "Install as App (PWA)", description: "Install SYLHN POS as a Progressive Web App", icon: Smartphone, location: "Header bar → Install button", locationLabel: "Header bar", color: "text-violet-600", bg: "bg-violet-50", phase: "phase5", access: "all" },
      { name: "Offline Sync Indicator", description: "Shows online/offline status + count of queued sales waiting to sync", icon: Activity, location: "Header bar → left of user avatar", locationLabel: "Header bar", color: "text-amber-600", bg: "bg-amber-50", phase: "phase1", access: "all" },
      { name: "Multi-Store Switcher", description: "Switch between store locations", icon: Store, location: "Header bar → location dropdown (next to logo)", locationLabel: "Header bar", color: "text-purple-600", bg: "bg-purple-50", phase: "phase5", access: "all" },
      { name: "Keyboard Shortcuts (?)", description: "Press ? anywhere to toggle the shortcuts overlay — or open via User Menu", icon: Eye, location: "Press ? key  ·  or User Menu → Keyboard Shortcuts", locationLabel: "Press ? key", color: "text-emerald-600", bg: "bg-emerald-50", phase: "core", access: "all", shortcut: "?" },
    ],
  },
];

// Helper to render a missing icon — for items that reference icons not imported.
function Mic(props: any) {
  return <Smartphone {...props} />;
}
function Percent(props: any) {
  return <Tags {...props} />;
}

type FilterMode = "all" | "recent" | "admin" | "quick";

export function FeaturesMap({ onBack, onNavigate }: FeaturesMapProps) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterMode>("all");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const totalFeatures = useMemo(
    () => CATEGORIES.reduce((sum, c) => sum + c.features.length, 0),
    []
  );

  const recentCount = useMemo(
    () => CATEGORIES.reduce(
      (sum, c) => sum + c.features.filter(f => f.phase && f.phase !== "core").length,
      0
    ),
    []
  );

  const adminCount = useMemo(
    () => CATEGORIES.reduce(
      (sum, c) => sum + c.features.filter(f => f.access === "admin").length,
      0
    ),
    []
  );

  const filteredCategories = useMemo(() => {
    const q = search.toLowerCase().trim();
    return CATEGORIES.map(cat => ({
      ...cat,
      features: cat.features.filter(f => {
        if (filter === "recent" && (!f.phase || f.phase === "core")) return false;
        if (filter === "admin" && f.access !== "admin") return false;
        if (filter === "quick" && cat.category !== "Quick Actions (SpeedDial)") return false;
        if (!q) return true;
        return (
          f.name.toLowerCase().includes(q) ||
          f.description.toLowerCase().includes(q) ||
          f.location.toLowerCase().includes(q) ||
          cat.category.toLowerCase().includes(q)
        );
      }),
    })).filter(cat => cat.features.length > 0);
  }, [search, filter]);

  const toggleCollapse = (cat: string) => {
    setCollapsed(s => ({ ...s, [cat]: !s[cat] }));
  };

  return (
    <div className="min-h-[100dvh] bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="flex-shrink-0 bg-gradient-to-r from-violet-700 via-purple-700 to-indigo-700 text-white shadow-lg sticky top-0 z-30">
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={onBack} className="h-9 w-9 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition active:scale-90 flex-shrink-0" aria-label="Back to POS">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="h-9 w-9 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center ring-1 ring-white/20 flex-shrink-0">
                <MapIcon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h1 className="text-base sm:text-lg font-bold truncate flex items-center gap-2">
                  Features Map
                  <span className="px-1.5 py-0.5 rounded-full bg-white/15 text-[9px] font-bold uppercase tracking-wider hidden sm:inline">Admin Guide</span>
                </h1>
                <p className="text-[10px] sm:text-xs text-violet-100/90 truncate">Where to find every feature · {totalFeatures} features across {CATEGORIES.length} categories</p>
              </div>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-2">
            <div className="px-3 py-1.5 rounded-lg bg-white/10 ring-1 ring-white/20 text-xs font-bold">
              <span className="text-violet-200">Total:</span> {totalFeatures}
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-emerald-400/20 ring-1 ring-emerald-300/30 text-xs font-bold">
              <span className="text-emerald-100">Recent:</span> {recentCount}
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-rose-400/20 ring-1 ring-rose-300/30 text-xs font-bold">
              <span className="text-rose-100">Admin:</span> {adminCount}
            </div>
          </div>
        </div>

        {/* Search + filter pills */}
        <div className="px-4 sm:px-6 pb-3 flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/60" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search features, locations, descriptions..."
              className="w-full h-10 pl-10 pr-10 rounded-xl bg-white/15 backdrop-blur text-white placeholder:text-white/60 text-sm outline-none ring-1 ring-white/20 focus:ring-white/40 transition"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 rounded-md bg-white/15 hover:bg-white/25 flex items-center justify-center"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
            {([
              { id: "all", label: `All (${totalFeatures})` },
              { id: "recent", label: `Recent (${recentCount})` },
              { id: "admin", label: `Admin-only (${adminCount})` },
              { id: "quick", label: "Quick Access" },
            ] as { id: FilterMode; label: string }[]).map(opt => (
              <button
                key={opt.id}
                onClick={() => setFilter(opt.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition flex-shrink-0 ${
                  filter === opt.id
                    ? "bg-white text-violet-700 shadow"
                    : "bg-white/10 text-white hover:bg-white/20 ring-1 ring-white/15"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Intro banner */}
      <div className="flex-shrink-0 px-4 sm:px-6 py-3 bg-gradient-to-r from-violet-50 to-indigo-50 border-b border-violet-100">
        <div className="max-w-5xl mx-auto flex items-start gap-2.5">
          <AlertCircle className="h-4 w-4 text-violet-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs sm:text-sm text-violet-900">
            <strong>How to use:</strong> Tap any feature card to jump straight to it. The bottom nav has 5 tabs (POS, Cart, Dashboard, Reports, More). Most features live in the <strong>More</strong> drawer or the <strong>top toolbar</strong>. Phase 1–5 features are tagged with colored badges — these are the newest additions.
          </p>
        </div>
      </div>

      {/* Categorized feature list */}
      <main className="flex-1 overflow-y-auto p-3 sm:p-4 scroll-premium">
        <div className="max-w-5xl mx-auto space-y-5">
          {filteredCategories.length === 0 && (
            <div className="text-center py-16 text-slate-400">
              <Search className="h-12 w-12 mx-auto mb-3 opacity-40" />
              <p className="text-sm font-bold">No features match your search</p>
              <p className="text-xs mt-1">Try a different keyword or clear the filter</p>
            </div>
          )}
          {filteredCategories.map((section, si) => {
            const SectionIcon = section.icon;
            const isCollapsed = collapsed[section.category];
            return (
              <motion.div
                key={section.category}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: si * 0.04 }}
              >
                {/* Category header — clickable to collapse */}
                <button
                  onClick={() => toggleCollapse(section.category)}
                  className="w-full flex items-center gap-2 mb-2 px-1 group"
                >
                  <div className={`h-7 w-7 rounded-lg bg-white shadow-sm ring-1 ring-slate-200 flex items-center justify-center ${section.color} group-hover:ring-violet-300 transition`}>
                    <SectionIcon className="h-4 w-4" />
                  </div>
                  <h2 className="text-sm font-bold text-slate-800 group-hover:text-violet-700 transition">{section.category}</h2>
                  <span className="text-[10px] text-slate-400 ml-auto mr-1">{section.features.length} features</span>
                  <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${isCollapsed ? "" : "rotate-180"}`} />
                </button>

                <AnimatePresence initial={false}>
                  {!isCollapsed && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-1">
                        {section.features.map(feature => {
                          const Icon = feature.icon;
                          return (
                            <button
                              key={feature.name}
                              onClick={() => {
                                if (feature.href) {
                                  window.location.href = feature.href;
                                } else if (feature.action) {
                                  onNavigate(feature.action);
                                }
                              }}
                              className="bg-white rounded-xl shadow-sm ring-1 ring-slate-200 p-3 text-left hover:shadow-md hover:ring-violet-300 transition active:scale-[0.98] flex items-start gap-3 group"
                            >
                              {/* Icon */}
                              <div className={`h-10 w-10 rounded-lg ${feature.bg} flex items-center justify-center flex-shrink-0`}>
                                <Icon className={`h-5 w-5 ${feature.color}`} />
                              </div>
                              {/* Content */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                                  <span className="text-sm font-bold text-slate-800">{feature.name}</span>
                                  {feature.phase && feature.phase !== "core" && (
                                    <span className={`px-1.5 py-0 rounded-full text-[8px] font-bold uppercase tracking-wider ${PHASE_COLORS[feature.phase]}`}>
                                      {PHASE_LABELS[feature.phase]}
                                    </span>
                                  )}
                                  {feature.access === "admin" && (
                                    <span className="px-1.5 py-0 rounded-full bg-rose-100 text-rose-700 text-[8px] font-bold uppercase tracking-wider flex items-center gap-0.5">
                                      <Crown className="h-2.5 w-2.5" /> Admin
                                    </span>
                                  )}
                                  {feature.access === "manager" && (
                                    <span className="px-1.5 py-0 rounded-full bg-amber-100 text-amber-700 text-[8px] font-bold uppercase tracking-wider flex items-center gap-0.5">
                                      <Shield className="h-2.5 w-2.5" /> Mgr+
                                    </span>
                                  )}
                                  {feature.shortcut && (
                                    <span className="px-1.5 py-0 rounded-full bg-slate-100 text-slate-600 text-[8px] font-mono font-bold">
                                      {feature.shortcut}
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-slate-500 mb-2 leading-snug">{feature.description}</div>
                                {/* Location pill */}
                                <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 text-[10px] font-semibold">
                                  <MapIcon className="h-3 w-3" />
                                  {feature.locationLabel}
                                </div>
                                {/* Full location detail */}
                                <div className="text-[10px] text-slate-400 mt-1 leading-tight flex items-start gap-1">
                                  <ArrowUpRight className="h-3 w-3 flex-shrink-0 mt-0.5 text-slate-300 group-hover:text-violet-400 transition" />
                                  <span>{feature.location}</span>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}

          {/* Footer note */}
          <div className="text-center py-6 text-[10px] text-slate-400">
            <p className="font-bold text-slate-500">{COMPANY.name}</p>
            <p className="mt-1">{totalFeatures} features across {CATEGORIES.length} categories · {recentCount} recent additions (Phase 1–5)</p>
            <p className="mt-1">All features accessible from the mobile bottom nav, the More drawer, the top toolbar, or the user menu.</p>
            <p className="mt-2 text-violet-500 font-semibold">Tip: Press <kbd className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-mono text-[9px]">?</kbd> anywhere to see keyboard shortcuts.</p>
          </div>
        </div>
      </main>
    </div>
  );
}
