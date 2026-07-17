"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShoppingCart, Home, BarChart3, Menu, X, LogOut, User, Package,
  Truck, Phone, Settings, FileText, Wrench, Shield, Bell, Download,
  Wallet, Receipt, TrendingUp, Clock, AlertTriangle, ChevronRight,
  RefreshCw, Wifi, WifiOff,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getQueueSize, getQueuedSales, flushQueue, isOnline, onQueueChange, type QueuedSale } from "@/lib/offline-queue";

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
  { id: "sync-settings", label: "Sync Settings", icon: RefreshCw, color: "text-blue-600", bg: "bg-blue-50" },
  { id: "admin-panel", label: "Admin Panel", icon: Shield, color: "text-purple-600", bg: "bg-purple-50" },
];

export function MobileNav({ active, onNavigate, cartCount, user, onLogout }: MobileNavProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [queueSize, setQueueSize] = useState(0);
  const [queuedSales, setQueuedSales] = useState<QueuedSale[]>([]);
  const [online, setOnline] = useState(isOnline());
  const [syncing, setSyncing] = useState(false);
  const { toast } = useToast();

  // Subscribe to queue changes
  useEffect(() => {
    const refresh = async () => {
      setQueueSize(await getQueueSize());
      setQueuedSales(await getQueuedSales());
      setOnline(isOnline());
    };
    refresh();
    const unsub = onQueueChange(refresh);
    // Poll every 5s as a fallback (in case the event misses)
    const interval = setInterval(refresh, 5000);
    return () => { unsub(); clearInterval(interval); };
  }, []);

  const handleSync = useCallback(async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      const result = await flushQueue();
      if (result.synced > 0) {
        toast({
          title: `${result.synced} sale(s) synced`,
          description: result.failed > 0 ? `${result.failed} failed — see queue` : "All queued sales uploaded",
          variant: result.failed > 0 ? "destructive" : "default",
        });
      } else if (result.failed > 0) {
        toast({
          title: "Sync failed",
          description: `${result.failed} sale(s) could not be synced`,
          variant: "destructive",
        });
      } else {
        toast({ title: "Queue is empty", description: "No pending sales to sync" });
      }
    } catch (e: any) {
      toast({ title: "Sync error", description: e?.message || "", variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  }, [syncing, toast]);

  // Top 5 destinations shown as bottom tabs
  const tabs: MobileNavTab[] = [
    { id: "pos", label: "POS", icon: Home },
    { id: "cart", label: "Cart", icon: ShoppingCart, badge: cartCount },
    { id: "dashboard", label: "Dashboard", icon: BarChart3 },
    { id: "reports", label: "Reports", icon: FileText },
    { id: "more", label: "More", icon: Menu, badge: queueSize > 0 ? queueSize : undefined },
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
      {/* Offline indicator banner */}
      <AnimatePresence>
        {!online && (
          <motion.div
            initial={{ y: -40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -40, opacity: 0 }}
            className="offline-indicator haptic-tap"
          >
            <WifiOff className="h-3 w-3 inline mr-1.5 -mt-0.5" />
            Offline mode — sales will be queued and synced when you reconnect
          </motion.div>
        )}
      </AnimatePresence>

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

      {/* Slide-in Drawer (More menu) */}
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
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="mobile-drawer"
            >
              {/* Drawer Header */}
              <div className="flex-shrink-0 px-5 py-4 bg-gradient-to-r from-emerald-700 to-teal-700 text-white">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-white/15 backdrop-blur flex items-center justify-center ring-1 ring-white/20 font-bold">
                      {user?.fullName?.charAt(0) || "S"}
                    </div>
                    <div>
                      <div className="font-bold text-sm">{user?.fullName || "User"}</div>
                      <div className="text-[10px] text-emerald-100/80 capitalize">{user?.role || "Cashier"}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => setDrawerOpen(false)}
                    className="h-8 w-8 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center transition haptic-tap"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Sync status */}
                <button
                  onClick={handleSync}
                  disabled={syncing || queueSize === 0}
                  className="w-full h-9 rounded-lg bg-white/15 hover:bg-white/25 disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-2 transition haptic-tap"
                >
                  {syncing ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  ) : online ? (
                    <Wifi className="h-3.5 w-3.5" />
                  ) : (
                    <WifiOff className="h-3.5 w-3.5" />
                  )}
                  {queueSize > 0
                    ? `${queueSize} sale(s) queued — tap to sync`
                    : online ? "All sales synced" : "Offline — will sync on reconnect"
                  }
                </button>
              </div>

              {/* Queue preview (if any) */}
              {queuedSales.length > 0 && (
                <div className="flex-shrink-0 px-3 py-2 bg-amber-50 border-b border-amber-100">
                  <div className="text-[10px] font-bold text-amber-700 uppercase mb-1.5 px-2">
                    Queued Sales ({queuedSales.length})
                  </div>
                  <div className="max-h-32 overflow-y-auto no-scrollbar space-y-1">
                    {queuedSales.slice(0, 5).map(q => (
                      <div key={q.id} className="bg-white rounded-lg px-2.5 py-1.5 ring-1 ring-amber-200 flex items-center justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="text-[10px] font-mono text-slate-700 truncate">{q.preview.invoiceNumber}</div>
                          <div className="text-[9px] text-slate-500">
                            {q.preview.itemCount} items · ₵{q.preview.total.toFixed(2)}
                          </div>
                        </div>
                        <div className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${
                          q.status === "failed" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"
                        }`}>
                          {q.status}
                        </div>
                      </div>
                    ))}
                    {queuedSales.length > 5 && (
                      <div className="text-[10px] text-amber-700 text-center py-1">
                        + {queuedSales.length - 5} more
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Destinations list */}
              <div className="flex-1 overflow-y-auto py-2">
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
                      className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition haptic-tap text-left ${isActive ? "bg-emerald-50" : ""}`}
                    >
                      <div className={`h-9 w-9 rounded-xl ${dest.bg} flex items-center justify-center`}>
                        <Icon className={`h-4 w-4 ${dest.color}`} />
                      </div>
                      <span className={`flex-1 text-sm font-semibold ${isActive ? "text-emerald-700" : "text-slate-700"}`}>
                        {dest.label}
                      </span>
                      <ChevronRight className="h-4 w-4 text-slate-300" />
                    </button>
                  );
                })}
              </div>

              {/* Logout */}
              <div className="flex-shrink-0 p-3 border-t border-slate-200">
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
