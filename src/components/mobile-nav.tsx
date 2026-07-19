"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShoppingCart, Home, BarChart3, Menu, X, LogOut, User, Package,
  Truck, Phone, PhoneCall, Settings, FileText, Wrench, Shield, Bell, Download,
  Wallet, Receipt, TrendingUp, Clock, History, AlertTriangle, ChevronRight,
  RefreshCw, Sparkles, Calculator, Moon, Sun, Mail, Users, Map as MapIcon,
  LayoutGrid, Store,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { COMPANY } from "@/lib/pos-data";

export interface MobileNavTab {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  badge?: number;
  onClick?: () => void;
}

interface MobileNavProps {
  active: string;
  onNavigate: (view: string) => void;
  cartCount: number;
  user?: { fullName: string; role: string } | null;
  onLogout?: () => void;
}

// All available destinations in the "More" drawer, organized by category.
// Every ViewMode from src/lib/pos-types.ts is represented here so no feature
// is hidden from mobile users.
const MORE_DESTINATIONS: { category: string; items: { id: string; label: string; icon: any; color: string; bg: string }[] }[] = [
  {
    category: "Sales",
    items: [
      { id: "sales-menu", label: "Sales Menu", icon: FileText, color: "text-blue-600", bg: "bg-blue-50" },
      { id: "sold-items", label: "Sold Items Report", icon: Receipt, color: "text-emerald-600", bg: "bg-emerald-50" },
      { id: "sales-history", label: "Sales History", icon: Clock, color: "text-teal-600", bg: "bg-teal-50" },
      { id: "daily-sales", label: "Daily Sales Report", icon: TrendingUp, color: "text-cyan-600", bg: "bg-cyan-50" },
      { id: "receipt-archive", label: "Receipt Archive", icon: FileText, color: "text-slate-600", bg: "bg-slate-50" },
    ],
  },
  {
    category: "Stock",
    items: [
      { id: "stock", label: "Stock Management", icon: Package, color: "text-blue-600", bg: "bg-blue-50" },
      { id: "stock-history-pro", label: "Stock History Pro", icon: History, color: "text-indigo-600", bg: "bg-indigo-50" },
    ],
  },
  {
    category: "Purchasing",
    items: [
      { id: "purchase-form", label: "New Purchase Order", icon: FileText, color: "text-purple-600", bg: "bg-purple-50" },
      { id: "purchase", label: "Purchase Orders", icon: Truck, color: "text-violet-600", bg: "bg-violet-50" },
      { id: "supplier-form", label: "Suppliers", icon: Users, color: "text-indigo-600", bg: "bg-indigo-50" },
    ],
  },
  {
    category: "Finance & Accounts",
    items: [
      { id: "finance-ops", label: "Finance Operations", icon: Wallet, color: "text-rose-600", bg: "bg-rose-50" },
      { id: "accounts-reports", label: "Accounts Reports", icon: TrendingUp, color: "text-amber-600", bg: "bg-amber-50" },
    ],
  },
  {
    category: "Communication",
    items: [
      { id: "telephone-directory", label: "Telephone Directory", icon: Phone, color: "text-cyan-600", bg: "bg-cyan-50" },
      { id: "telephone", label: "Telephone Module", icon: PhoneCall, color: "text-blue-600", bg: "bg-blue-50" },
      { id: "email-system", label: "Email System", icon: Mail, color: "text-blue-600", bg: "bg-blue-50" },
    ],
  },
  {
    category: "Admin",
    items: [
      { id: "dashboard", label: "Operations Dashboard", icon: BarChart3, color: "text-emerald-600", bg: "bg-emerald-50" },
      { id: "maintenance", label: "Maintenance", icon: Wrench, color: "text-orange-600", bg: "bg-orange-50" },
      { id: "admin-panel", label: "Admin Panel", icon: Shield, color: "text-purple-600", bg: "bg-purple-50" },
      { id: "sync-settings", label: "Sync Settings", icon: Settings, color: "text-slate-600", bg: "bg-slate-50" },
    ],
  },
];

// Quick link to the Features Map (always shown at the top of the More drawer)
const FEATURES_MAP_LINK: { id: string; label: string; icon: any; color: string; bg: string; href?: string } = {
  id: "features-map",
  label: "Features Map — Where to find everything",
  icon: MapIcon,
  color: "text-violet-600",
  bg: "bg-violet-50",
};

// Premium: AI-powered destinations + tools (linked to standalone pages/actions)
const AI_DESTINATIONS: { id: string; label: string; icon: any; color: string; bg: string; href?: string }[] = [
  FEATURES_MAP_LINK,
  { id: "forecast-link", label: "AI Demand Forecast", icon: Sparkles, color: "text-violet-600", bg: "bg-violet-50", href: "/forecast" },
  { id: "ai-assistant", label: "AI Business Assistant", icon: Sparkles, color: "text-indigo-600", bg: "bg-indigo-50", href: "#ai-assistant" },
];

export function MobileNav({ active, onNavigate, cartCount, user, onLogout }: MobileNavProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { toast } = useToast();

  // Top 5 destinations shown as bottom tabs — premium icon set
  const tabs: MobileNavTab[] = [
    { id: "pos", label: "POS", icon: Store },
    { id: "cart", label: "Cart", icon: ShoppingCart, badge: cartCount },
    { id: "dashboard", label: "Dashboard", icon: LayoutGrid },
    { id: "reports", label: "Reports", icon: BarChart3 },
    { id: "more", label: "More", icon: Menu },
  ];

  const handleTabClick = (tabId: string) => {
    if (tabId === "more") {
      setDrawerOpen(true);
    } else if (tabId === "cart") {
      // Cart is shown as a bottom sheet, handled by parent
      onNavigate("cart");
    } else {
      onNavigate(tabId);
    }
  };

  return (
    <>
      {/* ===== Bottom Tab Bar — premium floating glass ===== */}
      <nav className="mobile-bottom-nav mobile-only" role="navigation" aria-label="Primary">
        <div className="mobile-bottom-nav-inner">
          {tabs.map((tab, i) => {
            const isActive = active === tab.id;
            const Icon = tab.icon;
            return (
              <motion.button
                key={tab.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04, type: "spring", stiffness: 300, damping: 24 }}
                onClick={() => handleTabClick(tab.id)}
                className={`mobile-tab haptic-tap ${isActive ? "active" : ""}`}
                aria-label={tab.label}
                aria-current={isActive ? "page" : undefined}
              >
                <span className="tab-icon">
                  <Icon className="h-5 w-5" strokeWidth={isActive ? 2.5 : 2} />
                </span>
                <span>{tab.label}</span>
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className="tab-badge">{tab.badge > 99 ? "99+" : tab.badge}</span>
                )}
              </motion.button>
            );
          })}
        </div>
      </nav>

      {/* ===== Slide-in Drawer (More menu) — premium redesigned ===== */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDrawerOpen(false)}
              className="mobile-drawer-overlay"
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 340 }}
              className="mobile-drawer"
            >
              {/* ===== Drawer Header — premium gradient with company branding ===== */}
              <div className="flex-shrink-0 relative overflow-hidden text-white"
                style={{
                  background: "linear-gradient(135deg, #059669 0%, #0d9488 50%, #0891b2 100%)",
                  padding: "calc(env(safe-area-inset-top, 0px) + 20px) 20px 20px",
                }}
              >
                {/* Decorative ambient glow */}
                <div className="pointer-events-none absolute -top-16 -right-12 h-48 w-48 rounded-full bg-white/15 blur-3xl" />
                <div className="pointer-events-none absolute -bottom-20 -left-12 h-44 w-44 rounded-full bg-emerald-300/20 blur-3xl" />
                <div className="pointer-events-none absolute top-1/2 left-1/3 h-32 w-32 rounded-full bg-cyan-300/10 blur-2xl" />

                {/* Top row: close button */}
                <div className="flex items-center justify-between mb-4 relative z-10">
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-lg bg-white/15 ring-1 ring-white/30 flex items-center justify-center backdrop-blur-sm">
                      <Menu className="h-4 w-4" />
                    </div>
                    <span className="text-xs font-semibold uppercase tracking-wider opacity-80">Menu</span>
                  </div>
                  <button
                    onClick={() => setDrawerOpen(false)}
                    className="h-9 w-9 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center transition haptic-tap active:scale-90 ring-1 ring-white/20 backdrop-blur-sm"
                    aria-label="Close menu"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* User profile + company branding */}
                <div className="flex items-center gap-3 relative z-10">
                  <div className="relative">
                    <div className="absolute inset-0 rounded-2xl bg-white/30 blur-md scale-110" />
                    <div className="relative h-14 w-14 rounded-2xl bg-white/15 ring-2 ring-white/40 flex items-center justify-center font-bold text-xl backdrop-blur-sm">
                      {user?.fullName?.charAt(0).toUpperCase() || "S"}
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-base tracking-tight truncate">{user?.fullName || "User"}</div>
                    <div className="text-[11px] text-emerald-50/90 capitalize font-medium flex items-center gap-1.5">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-200 animate-pulse" />
                      {user?.role || "Cashier"} · {COMPANY.name}
                    </div>
                  </div>
                </div>
              </div>

              {/* Destinations list — premium redesigned with refined cards */}
              <div className="flex-1 overflow-y-auto py-3">
                {/* Premium: AI-powered tools + Features Map — highlighted at top */}
                {AI_DESTINATIONS.map(dest => {
                  const Icon = dest.icon;
                  // Features Map → navigate via onNavigate (no href)
                  if (!dest.href) {
                    return (
                      <button
                        key={dest.id}
                        onClick={() => {
                          onNavigate(dest.id);
                          setDrawerOpen(false);
                        }}
                        className="w-full flex items-center gap-3 mx-3 px-3 py-3 rounded-xl hover:bg-violet-50 active:bg-violet-100 transition haptic-tap text-left group ring-1 ring-transparent hover:ring-violet-200"
                        style={{ width: "calc(100% - 24px)" }}
                      >
                        <div className={`h-11 w-11 rounded-xl ${dest.bg} flex items-center justify-center ring-1 ring-violet-200/50 shadow-sm`}>
                          <Icon className={`h-5 w-5 ${dest.color}`} strokeWidth={2.2} />
                        </div>
                        <span className="flex-1 text-sm font-bold text-slate-800 group-hover:text-violet-700">
                          {dest.label}
                        </span>
                        <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-violet-500 transition" />
                      </button>
                    );
                  }
                  if (dest.href === "#ai-assistant") {
                    return (
                      <button
                        key={dest.id}
                        onClick={() => {
                          window.dispatchEvent(new CustomEvent("sylhn:open-ai"));
                          setDrawerOpen(false);
                        }}
                        className="w-full flex items-center gap-3 mx-3 px-3 py-3 rounded-xl hover:bg-violet-50 active:bg-violet-100 transition haptic-tap text-left group ring-1 ring-transparent hover:ring-violet-200"
                        style={{ width: "calc(100% - 24px)" }}
                      >
                        <div className={`h-11 w-11 rounded-xl ${dest.bg} flex items-center justify-center ring-1 ring-violet-200/50 shadow-sm`}>
                          <Icon className={`h-5 w-5 ${dest.color}`} strokeWidth={2.2} />
                        </div>
                        <span className="flex-1 text-sm font-bold text-slate-800 group-hover:text-violet-700">
                          {dest.label}
                        </span>
                        <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-violet-500 transition" />
                      </button>
                    );
                  }
                  return (
                    <a
                      key={dest.id}
                      href={dest.href}
                      className="w-full flex items-center gap-3 mx-3 px-3 py-3 rounded-xl hover:bg-violet-50 active:bg-violet-100 transition haptic-tap text-left group ring-1 ring-transparent hover:ring-violet-200"
                      style={{ width: "calc(100% - 24px)" }}
                    >
                      <div className={`h-11 w-11 rounded-xl ${dest.bg} flex items-center justify-center ring-1 ring-violet-200/50 shadow-sm`}>
                        <Icon className={`h-5 w-5 ${dest.color}`} strokeWidth={2.2} />
                      </div>
                      <span className="flex-1 text-sm font-bold text-slate-800 group-hover:text-violet-700">
                        {dest.label}
                      </span>
                      <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-violet-500 transition" />
                    </a>
                  );
                })}

                {/* Divider — premium gradient fade */}
                {AI_DESTINATIONS.length > 0 && (
                  <div className="h-px mx-6 my-3 bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
                )}

                {/* Categorized destinations — every ViewMode is reachable */}
                {MORE_DESTINATIONS.map((section, si) => (
                  <div key={section.category}>
                    {/* Category header — premium sticky header with subtle background */}
                    <div className="sticky top-0 z-10 px-5 pt-3 pb-2 bg-white/95 backdrop-blur-sm">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        {section.category}
                      </span>
                    </div>
                    {section.items.map(dest => {
                      const Icon = dest.icon;
                      const isActive = active === dest.id;
                      return (
                        <button
                          key={dest.id}
                          onClick={() => {
                            onNavigate(dest.id);
                            setDrawerOpen(false);
                          }}
                          className={`w-full flex items-center gap-3 mx-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 active:bg-slate-100 transition haptic-tap text-left ring-1 ring-transparent hover:ring-slate-200 ${isActive ? "bg-emerald-50 ring-emerald-200" : ""}`}
                          style={{ width: "calc(100% - 24px)" }}
                        >
                          <div className={`h-10 w-10 rounded-xl ${dest.bg} flex items-center justify-center ring-1 ring-slate-200/70 shadow-sm flex-shrink-0`}>
                            <Icon className={`h-5 w-5 ${dest.color}`} strokeWidth={2.2} />
                          </div>
                          <span className={`flex-1 text-sm font-semibold ${isActive ? "text-emerald-700" : "text-slate-700"}`}>
                            {dest.label}
                          </span>
                          <ChevronRight className={`h-4 w-4 transition ${isActive ? "text-emerald-500" : "text-slate-300"}`} />
                        </button>
                      );
                    })}
                    {/* Divider between categories (except after the last) */}
                    {si < MORE_DESTINATIONS.length - 1 && (
                      <div className="h-px mx-6 my-2 bg-gradient-to-r from-transparent via-slate-100 to-transparent" />
                    )}
                  </div>
                ))}
              </div>

              {/* Dark Mode + Sign Out — premium footer with refined buttons */}
              <div className="flex-shrink-0 px-3 py-3 border-t border-slate-200 bg-gradient-to-b from-white to-slate-50/50 space-y-2">
                <button
                  onClick={() => {
                    // Toggle dark mode
                    const isDark = document.documentElement.classList.contains("dark");
                    if (isDark) {
                      document.documentElement.classList.remove("dark");
                      localStorage.setItem("sylhn-dark-mode", "false");
                    } else {
                      document.documentElement.classList.add("dark");
                      localStorage.setItem("sylhn-dark-mode", "true");
                    }
                  }}
                  className="w-full h-11 rounded-xl bg-gradient-to-r from-violet-50 to-indigo-50 hover:from-violet-100 hover:to-indigo-100 text-violet-700 dark:text-violet-300 font-semibold text-sm flex items-center justify-center gap-2 transition haptic-tap ring-1 ring-violet-200 dark:ring-violet-800 active:scale-95"
                >
                  <Moon className="h-4 w-4" />
                  Toggle Dark Mode
                </button>
                <button
                  onClick={() => {
                    if (onLogout) onLogout();
                    setDrawerOpen(false);
                  }}
                  className="w-full h-11 rounded-xl bg-gradient-to-r from-rose-500 to-red-500 hover:from-rose-600 hover:to-red-600 text-white font-bold text-sm flex items-center justify-center gap-2 transition haptic-tap active:scale-95 shadow-md shadow-rose-500/30"
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
