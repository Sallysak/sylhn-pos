"use client";

import { motion } from "framer-motion";
import {
  ArrowLeft, Home, ShoppingCart, BarChart3, Menu, Package, Truck,
  FileText, Receipt, Clock, TrendingUp, Wallet, Phone, PhoneCall, Mail,
  Wrench, Shield, Settings, Sparkles, History, Users, Map as MapIcon,
  Smartphone, Printer, DollarSign, ScanLine, Calculator, Tags,
  CreditCard, Eye, Search, Plus, AlertCircle,
} from "lucide-react";
import { COMPANY } from "@/lib/pos-data";

interface FeaturesMapProps {
  onBack: () => void;
  onNavigate: (view: string) => void;
}

interface FeatureEntry {
  name: string;
  description: string;
  icon: any;
  location: string;        // where to find it
  locationLabel: string;   // short label for the location pill
  action?: string;         // view to navigate to
  href?: string;           // external URL
  color: string;
  bg: string;
}

interface FeatureCategory {
  category: string;
  icon: any;
  color: string;
  features: FeatureEntry[];
}

const CATEGORIES: FeatureCategory[] = [
  {
    category: "Sales & Checkout",
    icon: ShoppingCart,
    color: "text-emerald-600",
    features: [
      { name: "POS Screen", description: "Main checkout screen — scan, add to cart, take payment", icon: Home, location: "Bottom Nav → POS tab", locationLabel: "POS tab", action: "pos", color: "text-emerald-600", bg: "bg-emerald-50" },
      { name: "View Cart", description: "See items in current sale, adjust quantities, apply discounts", icon: ShoppingCart, location: "Bottom Nav → Cart tab", locationLabel: "Cart tab", action: "cart", color: "text-emerald-600", bg: "bg-emerald-50" },
      { name: "Pay Now", description: "Open payment modal (cash, card, MoMo)", icon: CreditCard, location: "POS Screen → green PAY NOW button", locationLabel: "PAY NOW button", action: "pos", color: "text-emerald-600", bg: "bg-emerald-50" },
      { name: "Hold Order", description: "Park current sale to resume later (F2)", icon: Receipt, location: "Sale menu → Save / Hold Order", locationLabel: "Sale menu", action: "pos", color: "text-emerald-600", bg: "bg-emerald-50" },
      { name: "Sales Menu", description: "All sales-related reports and history in one place", icon: FileText, location: "More → Sales → Sales Menu", locationLabel: "More drawer", action: "sales-menu", color: "text-blue-600", bg: "bg-blue-50" },
      { name: "Sold Items Report", description: "Top-selling items grouped by category", icon: Receipt, location: "More → Sales → Sold Items Report", locationLabel: "More drawer", action: "sold-items", color: "text-emerald-600", bg: "bg-emerald-50" },
      { name: "Sales History", description: "All past transactions with filter & export", icon: Clock, location: "More → Sales → Sales History", locationLabel: "More drawer", action: "sales-history", color: "text-teal-600", bg: "bg-teal-50" },
      { name: "Daily Sales Report", description: "Today's sales summary with totals", icon: TrendingUp, location: "More → Sales → Daily Sales Report", locationLabel: "More drawer", action: "daily-sales", color: "text-cyan-600", bg: "bg-cyan-50" },
      { name: "Receipt Archive", description: "Browse, reprint, or resend past receipts", icon: FileText, location: "More → Sales → Receipt Archive", locationLabel: "More drawer", action: "receipt-archive", color: "text-slate-600", bg: "bg-slate-50" },
    ],
  },
  {
    category: "Stock & Inventory",
    icon: Package,
    color: "text-blue-600",
    features: [
      { name: "Stock Management", description: "Add/modify products, group maintenance, quantity adjustments, stock history", icon: Package, location: "More → Stock → Stock Management", locationLabel: "More drawer", action: "stock", color: "text-blue-600", bg: "bg-blue-50" },
      { name: "Stock History Pro", description: "Advanced stock movement analytics with charts", icon: History, location: "More → Stock → Stock History Pro", locationLabel: "More drawer", action: "stock-history-pro", color: "text-indigo-600", bg: "bg-indigo-50" },
      { name: "Find Product", description: "Search product by name, SKU, barcode, or supplier", icon: Search, location: "POS Screen → FIND PRODUCT button", locationLabel: "POS button", action: "pos", color: "text-blue-600", bg: "bg-blue-50" },
      { name: "Barcode Scanner", description: "Camera-based barcode scanner for fast product lookup", icon: ScanLine, location: "Floating + button (bottom-left) → Scan Barcode", locationLabel: "SpeedDial", action: "pos", color: "text-emerald-600", bg: "bg-emerald-50" },
    ],
  },
  {
    category: "Purchasing & Suppliers",
    icon: Truck,
    color: "text-purple-600",
    features: [
      { name: "New Purchase Order", description: "Create a purchase order to send to a supplier", icon: FileText, location: "More → Purchasing → New Purchase Order", locationLabel: "More drawer", action: "purchase-form", color: "text-purple-600", bg: "bg-purple-50" },
      { name: "Purchase Orders", description: "View all purchase orders, receive stock, track payments", icon: Truck, location: "More → Purchasing → Purchase Orders", locationLabel: "More drawer", action: "purchase", color: "text-violet-600", bg: "bg-violet-50" },
      { name: "Suppliers", description: "Manage supplier contacts, balances, and order history", icon: Users, location: "More → Purchasing → Suppliers", locationLabel: "More drawer", action: "supplier-form", color: "text-indigo-600", bg: "bg-indigo-50" },
    ],
  },
  {
    category: "Finance & Accounts",
    icon: Wallet,
    color: "text-rose-600",
    features: [
      { name: "Finance Operations", description: "Expenses, cash reconciliation, mobile money tracking", icon: Wallet, location: "More → Finance & Accounts → Finance Operations", locationLabel: "More drawer", action: "finance-ops", color: "text-rose-600", bg: "bg-rose-50" },
      { name: "Accounts Reports", description: "P&L, VAT, trial balance, stock valuation, general ledger", icon: TrendingUp, location: "More → Finance & Accounts → Accounts Reports", locationLabel: "More drawer", action: "accounts-reports", color: "text-amber-600", bg: "bg-amber-50" },
      { name: "Cash Calculator", description: "Denomination counter for end-of-shift cash reconciliation", icon: Calculator, location: "Top toolbar → Cash Calc button", locationLabel: "Top toolbar", action: "pos", color: "text-amber-600", bg: "bg-amber-50" },
    ],
  },
  {
    category: "Communication",
    icon: Phone,
    color: "text-cyan-600",
    features: [
      { name: "Telephone Directory", description: "Customer and supplier phone directory", icon: Phone, location: "More → Communication → Telephone Directory", locationLabel: "More drawer", action: "telephone-directory", color: "text-cyan-600", bg: "bg-cyan-50" },
      { name: "Telephone Module", description: "Make and log phone calls to customers/suppliers", icon: PhoneCall, location: "More → Communication → Telephone Module", locationLabel: "More drawer", action: "telephone", color: "text-blue-600", bg: "bg-blue-50" },
      { name: "Email System", description: "Send invoices, reports, and statements via email", icon: Mail, location: "More → Communication → Email System", locationLabel: "More drawer", action: "email-system", color: "text-blue-600", bg: "bg-blue-50" },
    ],
  },
  {
    category: "Operations & Admin",
    icon: Shield,
    color: "text-purple-600",
    features: [
      { name: "Operations Dashboard", description: "Real-time KPIs: today's revenue, top products, low stock, expiry alerts", icon: BarChart3, location: "Bottom Nav → Dashboard tab", locationLabel: "Dashboard tab", action: "dashboard", color: "text-emerald-600", bg: "bg-emerald-50" },
      { name: "Maintenance", description: "System maintenance tools, backups, and data integrity checks", icon: Wrench, location: "More → Admin → Maintenance", locationLabel: "More drawer", action: "maintenance", color: "text-orange-600", bg: "bg-orange-50" },
      { name: "Admin Panel", description: "User management, system settings, audit logs (admin only)", icon: Shield, location: "More → Admin → Admin Panel", locationLabel: "More drawer", action: "admin-panel", color: "text-purple-600", bg: "bg-purple-50" },
      { name: "Sync Settings", description: "Configure data sync, offline mode, and server connection", icon: Settings, location: "More → Admin → Sync Settings", locationLabel: "More drawer", action: "sync-settings", color: "text-slate-600", bg: "bg-slate-50" },
    ],
  },
  {
    category: "AI Tools",
    icon: Sparkles,
    color: "text-violet-600",
    features: [
      { name: "AI Demand Forecast", description: "Predict future demand for products using AI", icon: Sparkles, location: "More drawer (top) → AI Demand Forecast", locationLabel: "More drawer", href: "/forecast", color: "text-violet-600", bg: "bg-violet-50" },
      { name: "AI Business Assistant", description: "Ask natural-language questions about your business", icon: Sparkles, location: "Floating + button → AI Assistant OR More drawer (top)", locationLabel: "SpeedDial", color: "text-indigo-600", bg: "bg-indigo-50" },
    ],
  },
  {
    category: "Quick Actions (SpeedDial)",
    icon: Plus,
    color: "text-emerald-600",
    features: [
      { name: "AI Assistant", description: "Open AI business assistant chat", icon: Sparkles, location: "Floating + button (bottom-left) → AI Assistant", locationLabel: "SpeedDial", action: "pos", color: "text-violet-600", bg: "bg-violet-50" },
      { name: "Scan Barcode", description: "Camera barcode scanner", icon: ScanLine, location: "Floating + button → Scan Barcode", locationLabel: "SpeedDial", action: "pos", color: "text-emerald-600", bg: "bg-emerald-50" },
      { name: "Pair Printer", description: "Pair a Bluetooth thermal printer", icon: Printer, location: "Floating + button → Pair Printer", locationLabel: "SpeedDial", action: "pos", color: "text-blue-600", bg: "bg-blue-50" },
      { name: "Cash Calculator", description: "Quick denomination counter", icon: DollarSign, location: "Floating + button → Cash Calculator", locationLabel: "SpeedDial", action: "pos", color: "text-amber-600", bg: "bg-amber-50" },
      { name: "Print Price Tags", description: "Print shelf price tags for products", icon: Tags, location: "Top toolbar → Tags button", locationLabel: "Top toolbar", action: "pos", color: "text-purple-600", bg: "bg-purple-50" },
    ],
  },
];

export function FeaturesMap({ onBack, onNavigate }: FeaturesMapProps) {
  return (
    <div className="min-h-[100dvh] bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="flex-shrink-0 bg-gradient-to-r from-violet-700 via-purple-700 to-indigo-700 text-white shadow-lg sticky top-0 z-30">
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={onBack} className="h-9 w-9 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition active:scale-90 flex-shrink-0" aria-label="Back">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="h-9 w-9 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center ring-1 ring-white/20 flex-shrink-0">
                <MapIcon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h1 className="text-base sm:text-lg font-bold truncate">Features Map</h1>
                <p className="text-[10px] sm:text-xs text-violet-100/90 truncate">Where to find every feature</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Intro banner */}
      <div className="flex-shrink-0 px-4 sm:px-6 py-3 bg-gradient-to-r from-violet-50 to-indigo-50 border-b border-violet-100">
        <div className="max-w-4xl mx-auto flex items-start gap-2.5">
          <AlertCircle className="h-4 w-4 text-violet-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs sm:text-sm text-violet-900">
            <strong>Tip:</strong> Tap any feature card to jump straight to it. The bottom nav has 5 tabs (POS, Cart, Dashboard, Reports, More). All other features live in the <strong>More</strong> drawer — tap the <strong>More</strong> tab to open it.
          </p>
        </div>
      </div>

      {/* Categorized feature list */}
      <main className="flex-1 overflow-y-auto p-3 sm:p-4">
        <div className="max-w-4xl mx-auto space-y-5">
          {CATEGORIES.map((section, si) => {
            const SectionIcon = section.icon;
            return (
              <motion.div
                key={section.category}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: si * 0.05 }}
              >
                {/* Category header */}
                <div className="flex items-center gap-2 mb-2 px-1">
                  <div className={`h-7 w-7 rounded-lg bg-white shadow-sm ring-1 ring-slate-200 flex items-center justify-center ${section.color}`}>
                    <SectionIcon className="h-4 w-4" />
                  </div>
                  <h2 className="text-sm font-bold text-slate-800">{section.category}</h2>
                  <span className="text-[10px] text-slate-400 ml-auto">{section.features.length} features</span>
                </div>

                {/* Feature cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
                        className="bg-white rounded-xl shadow-sm ring-1 ring-slate-200 p-3 text-left hover:shadow-md hover:ring-violet-300 transition active:scale-[0.98] flex items-start gap-3"
                      >
                        {/* Icon */}
                        <div className={`h-10 w-10 rounded-lg ${feature.bg} flex items-center justify-center flex-shrink-0`}>
                          <Icon className={`h-5 w-5 ${feature.color}`} />
                        </div>
                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-bold text-slate-800 mb-0.5">{feature.name}</div>
                          <div className="text-[11px] text-slate-500 mb-2 leading-snug">{feature.description}</div>
                          {/* Location pill */}
                          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 text-[10px] font-semibold">
                            <MapIcon className="h-3 w-3" />
                            {feature.locationLabel}
                          </div>
                          {/* Full location detail */}
                          <div className="text-[10px] text-slate-400 mt-1 leading-tight">{feature.location}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            );
          })}

          {/* Footer note */}
          <div className="text-center py-6 text-[10px] text-slate-400">
            <p>{COMPANY.name} · {CATEGORIES.reduce((sum, c) => sum + c.features.length, 0)} features across {CATEGORIES.length} categories</p>
            <p className="mt-1">All features accessible from the mobile bottom nav or the More drawer.</p>
          </div>
        </div>
      </main>
    </div>
  );
}
