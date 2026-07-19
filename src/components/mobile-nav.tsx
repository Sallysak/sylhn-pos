"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShoppingCart, Home, BarChart3, Menu, X, LogOut, User, Package,
  Truck, Phone, Settings, FileText, Wrench, Shield, Bell, Download,
  Wallet, Receipt, TrendingUp, Clock, AlertTriangle, ChevronRight,
  RefreshCw, Sparkles, Calculator, Moon, Sun, Mail,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export interface MobileNavTab {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
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

// All available destinations in the "More" drawer
const MORE_DESTINATIONS = [
  { id: "stock", label: "Stock Management", icon: Package, color: "text-blue-600", bg: "bg-blue-50" },
  { id: "purchase", label: "Purchases", icon: Truck, color: "text-purple-600", bg: "bg-purple-50" },
  { id: "supplier-form", label: "Suppliers", icon: Truck, color: "text-indigo-600", bg: "bg-indigo-50" },
  { id: "telephone-directory", label: "Directory", icon: Phone, color: "text-cyan-600", bg: "bg-cyan-50" },
  { id: "sold-items", label: "Sold Items", icon: Receipt, color: "text-emerald-600", bg: "bg-emerald-50" },
  { id: "sales-history", label: "Sales History", icon: Clock, color: "text-teal-600", bg: "bg-teal-50" },
  { id: "finance-ops", label: "Finance Ops", icon: Wallet, color: "text-rose-600", bg: "bg-rose-50" },
  { id: "accounts-reports", label: "Accounts", icon: TrendingUp, color: "text-amber-600", bg: "bg-amber-50" },
  { id: "receipt-archive", label: "Receipts", icon: FileText, color: "text-slate-600", bg: "bg-slate-50" },
  { id: "maintenance", label: "Maintenance", icon: Wrench, color: "text-orange-600", bg: "bg-orange-50" },
  { id: "email-system", label: "Email System", icon: Mail, color: "text-blue-600", bg: "bg-blue-50" },
  { id: "admin-panel", label: "Admin Panel", icon: Shield, color: "text-purple-600", bg: "bg-purple-50" },
];

// Premium: AI-powered destinations + tools (linked to standalone pages/actions)
const AI_DESTINATIONS = [
  { id: "forecast-link", label: "AI Demand Forecast", icon: Sparkles, color: "text-violet-600", bg: "bg-violet-50", href: "/forecast" },
  { id: "ai-assistant", label: "AI Business Assistant", icon: Sparkles, color: "text-indigo-600", bg: "bg-indigo-50", href: "#ai-assistant" },
];

export function MobileNav({ active, onNavigate, cartCount, user, onLogout }: MobileNavProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { toast } = useToast();

  // Top 5 destinations shown as bottom tabs
  const tabs: MobileNavTab[] = [
    { id: "pos", label: "POS", icon: Home },
    { id: "cart", label: "Cart", icon: ShoppingCart, badge: cartCount },
    { id: "dashboard", label: "Dashboard", icon: BarChart3 },
    { id: "reports", label: "Reports", icon: FileText },
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
      {/* Bottom Tab Bar */}
      <nav className="mobile-bottom-nav mobile-only" role="navigation" aria-label="Primary">
        <div className="mobile-bottom-nav-inner">
          {tabs.map(tab => {
            const isActive = active === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab.id)}
                className={`mobile-tab haptic-tap ${isActive ? "active" : ""}`}
                aria-label={tab.label}
                aria-current={isActive ? "page" : undefined}
              >
                <span className="tab-icon">
                  <Icon className="h-5 w-5" />
                </span>
                <span>{tab.label}</span>
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className="tab-badge">{tab.badge > 99 ? "99+" : tab.badge}</span>
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Slide-in Drawer (More menu) — premium, sharp, no blur */}
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
              transition={{ type: "spring", damping: 28, stiffness: 320 }}
              className="mobile-drawer"
            >
              {/* Drawer Header — premium gradient with glow */}
              <div className="flex-shrink-0 px-5 py-4 gradient-premium-emerald text-white relative overflow-hidden">
                {/* Decorative ambient glow */}
                <div className="pointer-events-none absolute -top-12 -right-12 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
                <div className="pointer-events-none absolute -bottom-16 -left-8 h-40 w-40 rounded-full bg-emerald-300/15 blur-2xl" />

                <div className="flex items-center justify-between mb-3 relative z-10">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="absolute inset-0 rounded-full bg-white/20 blur-md scale-110" />
                      <div className="relative h-11 w-11 rounded-full bg-white/15 ring-2 ring-white/30 flex items-center justify-center font-bold text-lg backdrop-blur-sm">
                        {user?.fullName?.charAt(0) || "S"}
                      </div>
                    </div>
                    <div>
                      <div className="font-bold text-sm tracking-tight">{user?.fullName || "User"}</div>
                      <div className="text-[10px] text-emerald-50/90 capitalize font-medium">{user?.role || "Cashier"}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => setDrawerOpen(false)}
                    className="h-8 w-8 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center transition haptic-tap active:scale-90"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Destinations list */}
              <div className="flex-1 overflow-y-auto py-2">
                {/* Premium: AI-powered tools — high contrast, no blur */}
                {AI_DESTINATIONS.map(dest => {
                  const Icon = dest.icon;
                  if (dest.href === "#ai-assistant") {
                    return (
                      <button
                        key={dest.id}
                        onClick={() => {
                          window.dispatchEvent(new CustomEvent("sylhn:open-ai"));
                          setDrawerOpen(false);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-violet-50 active:bg-violet-100 transition haptic-tap text-left group"
                      >
                        <div className={`h-10 w-10 rounded-xl ${dest.bg} flex items-center justify-center ring-1 ring-slate-200`}>
                          <Icon className={`h-5 w-5 ${dest.color}`} />
                        </div>
                        <span className="flex-1 text-sm font-bold text-slate-800 group-hover:text-violet-700">
                          {dest.label}
                        </span>
                        <ChevronRight className="h-4 w-4 text-slate-400" />
                      </button>
                    );
                  }
                  return (
                    <a
                      key={dest.id}
                      href={dest.href}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-violet-50 active:bg-violet-100 transition haptic-tap text-left group"
                    >
                      <div className={`h-10 w-10 rounded-xl ${dest.bg} flex items-center justify-center ring-1 ring-slate-200`}>
                        <Icon className={`h-5 w-5 ${dest.color}`} />
                      </div>
                      <span className="flex-1 text-sm font-bold text-slate-800 group-hover:text-violet-700">
                        {dest.label}
                      </span>
                      <ChevronRight className="h-4 w-4 text-slate-400" />
                    </a>
                  );
                })}

                {/* Divider */}
                {AI_DESTINATIONS.length > 0 && (
                  <div className="h-px bg-slate-200 my-2 mx-4" />
                )}

                {MORE_DESTINATIONS.map(dest => {
                  const Icon = dest.icon;
                  const isActive = active === dest.id;
                  return (
                    <button
                      key={dest.id}
                      onClick={() => {
                        onNavigate(dest.id);
                        setDrawerOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 active:bg-slate-100 transition haptic-tap text-left ${isActive ? "bg-emerald-50" : ""}`}
                    >
                      <div className={`h-10 w-10 rounded-xl ${dest.bg} flex items-center justify-center ring-1 ring-slate-200`}>
                        <Icon className={`h-5 w-5 ${dest.color}`} />
                      </div>
                      <span className={`flex-1 text-sm font-bold ${isActive ? "text-emerald-700" : "text-slate-800"}`}>
                        {dest.label}
                      </span>
                      <ChevronRight className="h-4 w-4 text-slate-400" />
                    </button>
                  );
                })}
              </div>

              {/* Dark Mode + Logout */}
              <div className="flex-shrink-0 p-3 border-t border-slate-200 space-y-2">
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
                  className="w-full h-11 rounded-xl bg-violet-500/10 hover:bg-violet-500/20 text-violet-700 dark:text-violet-300 font-semibold text-sm flex items-center justify-center gap-2 transition haptic-tap ring-1 ring-violet-200 dark:ring-violet-800"
                >
                  <Moon className="h-4 w-4" />
                  Toggle Dark Mode
                </button>
                <button
                  onClick={() => {
                    if (onLogout) onLogout();
                    setDrawerOpen(false);
                  }}
                  className="w-full h-11 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold text-sm flex items-center justify-center gap-2 transition haptic-tap"
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
