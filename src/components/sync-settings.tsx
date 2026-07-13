"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, RefreshCw, Cloud, CloudDownload, CloudUpload,
  Check, AlertCircle, Loader2, Database, Users, Package,
  Clock, Zap, Info, Wifi, WifiOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { COMPANY, formatGHS } from "@/lib/pos-data";
import { useToast } from "@/hooks/use-toast";

interface SyncSettingsProps {
  onBack: () => void;
}

interface SyncState {
  autoSync: boolean;
  lastSyncedAt: string | null;
  syncing: boolean;
  online: boolean;
  pendingChanges: number;
  lastError: string | null;
}

const SYNC_STATE_KEY = "sylhn-sync-state";

export function SyncSettings({ onBack }: SyncSettingsProps) {
  const { toast } = useToast();
  const [state, setState] = useState<SyncState>({
    autoSync: true,
    lastSyncedAt: null,
    syncing: false,
    online: true,
    pendingChanges: 0,
    lastError: null,
  });
  const [stats, setStats] = useState({ products: 0, users: 0, sales: 0, stockValue: 0 });
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load sync state from localStorage
  useEffect(() => {
    try {
      const cached = localStorage.getItem(SYNC_STATE_KEY);
      if (cached) {
        setState(prev => ({ ...prev, ...JSON.parse(cached) }));
      }
    } catch { /* ignore */ }
  }, []);

  // Save sync state to localStorage
  useEffect(() => {
    try { localStorage.setItem(SYNC_STATE_KEY, JSON.stringify(state)); } catch { /* ignore */ }
  }, [state]);

  // Online/offline detection
  useEffect(() => {
    const updateOnline = () => setState(prev => ({ ...prev, online: navigator.onLine }));
    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOnline);
    setState(prev => ({ ...prev, online: navigator.onLine }));
    return () => {
      window.removeEventListener("online", updateOnline);
      window.removeEventListener("offline", updateOnline);
    };
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

  // ===== Push to server =====
  const pushToServer = useCallback(async () => {
    if (state.syncing) return;
    setState(prev => ({ ...prev, syncing: true, lastError: null }));
    try {
      // Push products
      const productsRaw = localStorage.getItem("sylhn-products");
      if (productsRaw) {
        const products = JSON.parse(productsRaw);
        await fetch("/api/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ products }),
        });
      }
      // Push stock groups
      const groupsRaw = localStorage.getItem("sylhn-groups");
      if (groupsRaw) {
        const groups = JSON.parse(groupsRaw);
        await fetch("/api/stock-groups", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ groups }),
        });
      }
      // Push users
      const usersRaw = localStorage.getItem("sylhn-system-users");
      if (usersRaw) {
        const users = JSON.parse(usersRaw);
        await fetch("/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ users }),
        });
      }
      setState(prev => ({
        ...prev,
        syncing: false,
        lastSyncedAt: new Date().toISOString(),
        pendingChanges: 0,
        lastError: null,
      }));
      toast({ title: "Push complete", description: "All local data uploaded to server" });
      fetchStats();
    } catch (e) {
      setState(prev => ({ ...prev, syncing: false, lastError: (e as Error).message }));
      toast({ title: "Push failed", description: (e as Error).message, variant: "destructive" });
    }
  }, [state.syncing, toast, fetchStats]);

  // ===== Pull from server =====
  const pullFromServer = useCallback(async () => {
    if (state.syncing) return;
    setState(prev => ({ ...prev, syncing: true, lastError: null }));
    try {
      // Pull products
      const prodRes = await fetch("/api/products", { credentials: "include" });
      if (prodRes.ok) {
        const data = await prodRes.json();
        if (data.products?.length > 0) {
          localStorage.setItem("sylhn-products", JSON.stringify(data.products));
        }
      }
      // Pull stock groups
      const groupRes = await fetch("/api/stock-groups", { credentials: "include" });
      if (groupRes.ok) {
        const data = await groupRes.json();
        if (data.groups?.length > 0) {
          localStorage.setItem("sylhn-groups", JSON.stringify(data.groups));
        }
      }
      // Pull users
      const userRes = await fetch("/api/users", { credentials: "include" });
      if (userRes.ok) {
        const data = await userRes.json();
        if (data.users?.length > 0) {
          localStorage.setItem("sylhn-system-users", JSON.stringify(data.users));
        }
      }
      setState(prev => ({
        ...prev,
        syncing: false,
        lastSyncedAt: new Date().toISOString(),
        lastError: null,
      }));
      toast({ title: "Pull complete", description: "Server data loaded locally" });
      fetchStats();
    } catch (e) {
      setState(prev => ({ ...prev, syncing: false, lastError: (e as Error).message }));
      toast({ title: "Pull failed", description: (e as Error).message, variant: "destructive" });
    }
  }, [state.syncing, toast, fetchStats]);

  // ===== Sync Now (push + pull) =====
  const syncNow = useCallback(async () => {
    if (state.syncing) return;
    setState(prev => ({ ...prev, syncing: true, lastError: null }));
    try {
      // Push first
      await pushToServer();
      // Then pull
      await pullFromServer();
      toast({ title: "Sync complete", description: "Data pushed and pulled successfully" });
    } catch (e) {
      setState(prev => ({ ...prev, syncing: false, lastError: (e as Error).message }));
      toast({ title: "Sync failed", description: (e as Error).message, variant: "destructive" });
    }
  }, [state.syncing, pushToServer, pullFromServer, toast]);

  // ===== Auto-sync: listen for localStorage changes =====
  useEffect(() => {
    if (!state.autoSync) return;
    const handleStorageChange = () => {
      setState(prev => ({ ...prev, pendingChanges: prev.pendingChanges + 1 }));
      // Debounce: wait 2s after the last change before pushing
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => {
        if (navigator.onLine) pushToServer();
      }, 2000);
    };
    window.addEventListener("storage", handleStorageChange);
    return () => {
      window.removeEventListener("storage", handleStorageChange);
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [state.autoSync, pushToServer]);

  // ===== Format timestamp =====
  const formatTimestamp = (iso: string | null) => {
    if (!iso) return "Never";
    const d = new Date(iso);
    return d.toLocaleString("en-GB", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
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
              <p className="text-[10px] sm:text-xs text-slate-400">{COMPANY.name} · Data synchronization</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {state.online ? (
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
            state.syncing && "ring-2 ring-blue-300"
          )}
        >
          <div className="flex items-center gap-3">
            {state.syncing ? (
              <Loader2 className="h-6 w-6 text-blue-500 animate-spin flex-shrink-0" />
            ) : state.lastError ? (
              <AlertCircle className="h-6 w-6 text-rose-500 flex-shrink-0" />
            ) : (
              <Check className="h-6 w-6 text-emerald-500 flex-shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-slate-800">
                {state.syncing ? "Syncing..." : state.lastError ? "Sync Error" : "All in sync"}
              </div>
              <div className="text-xs text-slate-500">
                {state.syncing
                  ? "Transferring data to/from server..."
                  : state.lastError
                  ? state.lastError
                  : `Last synced: ${formatTimestamp(state.lastSyncedAt)}`}
              </div>
            </div>
            {state.pendingChanges > 0 && (
              <Badge className="bg-amber-100 text-amber-700 text-[10px]">
                {state.pendingChanges} pending
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

        {/* Auto-Sync Toggle */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 p-4 sm:p-5 mb-4"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn(
                "h-10 w-10 rounded-xl flex items-center justify-center transition",
                state.autoSync ? "bg-blue-50 text-blue-600" : "bg-slate-100 text-slate-400"
              )}>
                <Zap className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm font-bold text-slate-800">Auto-Sync</div>
                <div className="text-xs text-slate-500">Automatically push changes to server (2s delay)</div>
              </div>
            </div>
            <Switch
              checked={state.autoSync}
              onCheckedChange={(checked) => {
                setState(prev => ({ ...prev, autoSync: checked }));
                toast({ title: checked ? "Auto-sync enabled" : "Auto-sync disabled" });
              }}
            />
          </div>
        </motion.div>

        {/* Pull from Server */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 p-4 sm:p-5 mb-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 flex-1">
              <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 flex-shrink-0">
                <CloudDownload className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm font-bold text-slate-800">Pull from Server</div>
                <div className="text-xs text-slate-500 mt-0.5">
                  Replace local data with the server's latest snapshot. Useful when working across multiple devices or after another user made changes.
                </div>
              </div>
            </div>
            <Button
              onClick={pullFromServer}
              disabled={state.syncing || !state.online}
              variant="outline"
              size="sm"
              className="flex-shrink-0"
            >
              {state.syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CloudDownload className="h-4 w-4" />}
              Pull
            </Button>
          </div>
        </motion.div>

        {/* Push to Server */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 p-4 sm:p-5 mb-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 flex-1">
              <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 flex-shrink-0">
                <CloudUpload className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm font-bold text-slate-800">Push to Server</div>
                <div className="text-xs text-slate-500 mt-0.5">
                  Upload current local data to the server. Overwrites server data with your local changes.
                </div>
              </div>
            </div>
            <Button
              onClick={pushToServer}
              disabled={state.syncing || !state.online}
              variant="outline"
              size="sm"
              className="flex-shrink-0"
            >
              {state.syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CloudUpload className="h-4 w-4" />}
              Push
            </Button>
          </div>
        </motion.div>

        {/* Sync Now */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl shadow-lg shadow-blue-500/20 p-4 sm:p-5 mb-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 flex-1">
              <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center text-white flex-shrink-0">
                <RefreshCw className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm font-bold text-white">Sync Now</div>
                <div className="text-xs text-blue-100 mt-0.5">
                  Push current local data to the server, then pull the latest server data back. Two-way sync.
                </div>
              </div>
            </div>
            <Button
              onClick={syncNow}
              disabled={state.syncing || !state.online}
              size="sm"
              className="bg-white text-blue-600 hover:bg-blue-50 flex-shrink-0 font-bold"
            >
              {state.syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Sync Now
            </Button>
          </div>
        </motion.div>

        {/* How it works */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="bg-slate-100 rounded-2xl p-4 sm:p-5 mb-4"
        >
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-slate-400 flex-shrink-0 mt-0.5" />
            <div className="space-y-2">
              <div className="text-xs font-bold text-slate-700 uppercase">How it works</div>
              <div className="text-xs text-slate-600 space-y-1.5">
                <p>• <strong>Auto-Sync</strong> automatically pushes changes 2 seconds after you make them (add products, complete sales, etc.)</p>
                <p>• <strong>Pull</strong> replaces your local data with the server's latest — use when switching devices</p>
                <p>• <strong>Push</strong> uploads your local data to the server — overwrites server data</p>
                <p>• <strong>Sync Now</strong> does both: push your changes, then pull any new server data</p>
                <p>• All data is saved locally first (instant), then synced to the server (durable)</p>
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
