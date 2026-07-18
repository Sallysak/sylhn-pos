"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, RefreshCw, CloudDownload,
  Check, AlertCircle, Loader2, Database, Users, Package,
  Clock, Info, Wifi, WifiOff, Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { COMPANY, formatGHS } from "@/lib/pos-data";
import { useToast } from "@/hooks/use-toast";
import { pullChanges, getSyncState, type SyncState } from "@/lib/sync";

interface SyncSettingsProps {
  onBack: () => void;
}

interface Stats {
  products: number;
  users: number;
  sales: number;
  stockValue: number;
}

const AUTO_PULL_KEY = "sylhn-auto-pull-enabled";

export function SyncSettings({ onBack }: SyncSettingsProps) {
  const { toast } = useToast();
  const [syncState, setSyncState] = useState<SyncState>({
    lastPulledAt: null,
    lastError: null,
    online: true,
    productsCount: 0,
  });
  const [autoPull, setAutoPull] = useState(true);
  const [pulling, setPulling] = useState(false);
  const [stats, setStats] = useState<Stats>({ products: 0, users: 0, sales: 0, stockValue: 0 });

  // Load sync state from the sync module
  useEffect(() => {
    setSyncState(getSyncState());
    try {
      const saved = localStorage.getItem(AUTO_PULL_KEY);
      setAutoPull(saved !== null ? saved === "true" : true);
    } catch { /* ignore */ }
  }, []);

  // Online/offline detection
  useEffect(() => {
    const updateOnline = () => setSyncState(prev => ({ ...prev, online: navigator.onLine }));
    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOnline);
    return () => {
      window.removeEventListener("online", updateOnline);
      window.removeEventListener("offline", updateOnline);
    };
  }, []);

  // Refresh sync state every 5 seconds (so the "last pulled" time updates)
  useEffect(() => {
    const interval = setInterval(() => setSyncState(getSyncState()), 5000);
    return () => clearInterval(interval);
  }, []);

  // Fetch stats from server
  const fetchStats = useCallback(async () => {
    try {
      const [prodRes, userRes, saleRes] = await Promise.all([
        fetch("/api/products", { credentials: "include" }).catch(() => null),
        fetch("/api/users", { credentials: "include" }).catch(() => null),
        fetch("/api/sales?limit=1", { credentials: "include" }).catch(() => null),
      ]);
      let productCount = 0;
      let userCount = 0;
      let saleCount = 0;
      let stockValue = 0;
      if (prodRes?.ok) {
        const data = await prodRes.json();
        productCount = data.products?.length || 0;
        stockValue = data.products?.reduce((s: number, p: any) => s + (p.quantity * p.costPrice), 0) || 0;
      }
      if (userRes?.ok) {
        const data = await userRes.json();
        userCount = data.users?.length || 0;
      }
      if (saleRes?.ok) {
        const data = await saleRes.json();
        saleCount = data.sales?.length || 0;
      }
      setStats({ products: productCount, users: userCount, sales: saleCount, stockValue });
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  // ===== Pull from server (the ONLY sync operation) =====
  const handlePull = useCallback(async () => {
    if (pulling) return;
    setPulling(true);
    try {
      const result = await pullChanges({ includeGroups: true, includeSuppliers: true });
      if (result.success) {
        setSyncState(getSyncState());
        toast({
          title: "Pull complete",
          description: `Loaded ${result.data?.products?.length || 0} products from server`,
        });
        fetchStats();
      } else {
        toast({ title: "Pull failed", description: result.message, variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Pull failed", description: e?.message, variant: "destructive" });
    } finally {
      setPulling(false);
    }
  }, [pulling, toast, fetchStats]);

  // ===== Auto-pull toggle =====
  const handleAutoPullToggle = (checked: boolean) => {
    setAutoPull(checked);
    try { localStorage.setItem(AUTO_PULL_KEY, String(checked)); } catch { /* ignore */ }
    toast({
      title: checked ? "Auto-pull enabled" : "Auto-pull disabled",
      description: checked
        ? "Products will refresh from server every 15 seconds"
        : "You'll need to pull manually — other cashiers' sales won't appear automatically",
    });
  };

  // ===== Format timestamp =====
  const formatTimestamp = (iso: string | null) => {
    if (!iso) return "Never";
    const d = new Date(iso);
    const secondsAgo = Math.floor((Date.now() - d.getTime()) / 1000);
    if (secondsAgo < 60) return `${secondsAgo}s ago`;
    if (secondsAgo < 3600) return `${Math.floor(secondsAgo / 60)}m ago`;
    if (secondsAgo < 86400) return `${Math.floor(secondsAgo / 3600)}h ago`;
    return d.toLocaleString("en-GB", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  };

  return (
    <div className="min-h-[100dvh] bg-slate-50 flex flex-col">
      {/* ===== Header ===== */}
      <header className="flex-shrink-0 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white shadow-lg sticky top-0 z-30">
        <div className="flex items-center justify-between px-3 sm:px-6 py-3">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="h-9 w-9 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition" title="Back">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-base sm:text-lg font-bold tracking-wider">SERVER SYNC</h1>
              <p className="text-[10px] sm:text-xs text-slate-400">{COMPANY.name} · Server is source of truth</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {syncState.online ? (
              <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[10px]">
                <Wifi className="h-3 w-3 mr-1" /> Online
              </Badge>
            ) : (
              <Badge className="bg-rose-500/20 text-rose-300 border-rose-500/30 text-[10px]">
                <WifiOff className="h-3 w-3 mr-1" /> Offline
              </Badge>
            )}
          </div>
        </div>
      </header>

      {/* ===== Main Content ===== */}
      <main className="flex-1 overflow-y-auto p-3 sm:p-6 max-w-2xl mx-auto w-full">
        {/* Sync Status Banner */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            "bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 p-4 sm:p-5 mb-4",
            pulling && "ring-2 ring-blue-300"
          )}
        >
          <div className="flex items-center gap-3">
            {pulling ? (
              <Loader2 className="h-6 w-6 text-blue-500 animate-spin flex-shrink-0" />
            ) : syncState.lastError ? (
              <AlertCircle className="h-6 w-6 text-rose-500 flex-shrink-0" />
            ) : (
              <Check className="h-6 w-6 text-emerald-500 flex-shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-slate-800">
                {pulling ? "Pulling from server..." : syncState.lastError ? "Sync Error" : "In sync with server"}
              </div>
              <div className="text-xs text-slate-500">
                {pulling
                  ? "Refreshing product list and stock counts..."
                  : syncState.lastError
                  ? syncState.lastError
                  : `Last pulled: ${formatTimestamp(syncState.lastPulledAt)}`}
              </div>
            </div>
            {autoPull && (
              <Badge className="bg-emerald-100 text-emerald-700 text-[10px]">
                <Zap className="h-3 w-3 mr-1" /> Auto
              </Badge>
            )}
          </div>
          {/* Server info */}
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <Database className="h-3.5 w-3.5" /> SQLite
            </span>
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" /> {stats.users} users
            </span>
            <span className="flex items-center gap-1">
              <Package className="h-3.5 w-3.5" /> {stats.products} products
            </span>
            <span className="flex items-center gap-1 ml-auto">
              <Clock className="h-3.5 w-3.5" /> {stats.sales} sales
            </span>
          </div>
        </motion.div>

        {/* Architecture notice — explain the new model */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 sm:p-5 mb-4"
        >
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
            <div className="space-y-2">
              <div className="text-xs font-bold text-emerald-800 uppercase">Server is the source of truth</div>
              <div className="text-xs text-emerald-700 space-y-1.5">
                <p>The server holds the authoritative product catalog, stock counts, and sales history.</p>
                <p>• <strong>Sales</strong> you make are sent to the server immediately (or queued if offline)</p>
                <p>• <strong>Stock counts</strong> refresh from the server every 15 seconds — so you'll see other cashiers' sales automatically</p>
                <p>• <strong>Manual pull</strong> below forces an immediate refresh (useful after another cashier restocks)</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Auto-Pull Toggle */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 p-4 sm:p-5 mb-4"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn(
                "h-10 w-10 rounded-xl flex items-center justify-center transition",
                autoPull ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-400"
              )}>
                <Zap className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm font-bold text-slate-800">Auto-Pull (every 15s)</div>
                <div className="text-xs text-slate-500">Refresh stock counts from server automatically</div>
              </div>
            </div>
            <Switch
              checked={autoPull}
              onCheckedChange={handleAutoPullToggle}
            />
          </div>
        </motion.div>

        {/* Pull from Server (manual) */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl shadow-lg shadow-emerald-500/20 p-4 sm:p-5 mb-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 flex-1">
              <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center text-white flex-shrink-0">
                <CloudDownload className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm font-bold text-white">Pull Now</div>
                <div className="text-xs text-emerald-50 mt-0.5">
                  Force-refresh products, stock groups, and suppliers from the server. Use this if another cashier restocked or made changes you can't see.
                </div>
              </div>
            </div>
            <Button
              onClick={handlePull}
              disabled={pulling || !syncState.online}
              size="sm"
              className="bg-white text-emerald-600 hover:bg-emerald-50 flex-shrink-0 font-bold"
            >
              {pulling ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Pull Now
            </Button>
          </div>
        </motion.div>

        {/* How it works */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-slate-100 rounded-2xl p-4 sm:p-5 mb-4"
        >
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-slate-400 flex-shrink-0 mt-0.5" />
            <div className="space-y-2">
              <div className="text-xs font-bold text-slate-700 uppercase">How multi-cashier sync works</div>
              <div className="text-xs text-slate-600 space-y-1.5">
                <p>• When you complete a sale, the server decrements stock <strong>transactionally</strong> (race-condition safe)</p>
                <p>• Your screen updates instantly (optimistic) and then re-syncs with the server 2 seconds later</p>
                <p>• Every 15 seconds, your screen pulls the latest stock counts — so you'll see other cashiers' sales within 15s</p>
                <p>• If you go offline, sales are queued in IndexedDB and auto-sync when you reconnect</p>
                <p>• <strong>Why no "Push" button?</strong> Because pushing your local product list would overwrite other cashiers' sales — the server must be the source of truth.</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Stock value summary */}
        <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 p-4 sm:p-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-[10px] font-semibold text-slate-400 uppercase">Stock Value (Cost)</div>
              <div className="text-lg font-bold text-slate-800 mt-0.5">{formatGHS(stats.stockValue)}</div>
            </div>
            <div>
              <div className="text-[10px] font-semibold text-slate-400 uppercase">Total Records</div>
              <div className="text-lg font-bold text-slate-800 mt-0.5">{stats.products + stats.users + stats.sales}</div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
