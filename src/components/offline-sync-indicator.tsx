"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Wifi, WifiOff, RefreshCw, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { OfflineSaleQueue } from "@/lib/offline-sale-queue";
import { cn } from "@/lib/utils";

/**
 * Offline Sync Indicator
 *
 * Shows a small badge in the header that displays:
 * - 🟢 "Online" when connected (green wifi icon)
 * - 🔴 "Offline — N sales queued" when disconnected (red wifi-off icon)
 * - 🔄 "Syncing..." when flushing the queue (spinner)
 * - ✅ "Synced N sales" after successful flush (green check, auto-dismiss)
 *
 * Automatically detects online/offline via navigator.onLine + window
 * online/offline events. Auto-flushes the queue when connectivity is
 * restored.
 */
export function OfflineSyncIndicator() {
  const [online, setOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<number | null>(null);
  const { toast } = useToast();

  // Update pending count
  const refreshCount = useCallback(async () => {
    try {
      const count = await OfflineSaleQueue.count();
      setPendingCount(count);
    } catch {
      // IndexedDB might not be available (SSR) — ignore
    }
  }, []);

  // Flush the queue
  const flush = useCallback(async () => {
    if (syncing || !navigator.onLine) return;
    setSyncing(true);
    try {
      const result = await OfflineSaleQueue.flush();
      setPendingCount(result.remaining);
      if (result.synced > 0) {
        setLastSynced(result.synced);
        toast({
          title: "Synced ✓",
          description: `${result.synced} sale(s) synced to server${result.failed > 0 ? `, ${result.failed} failed` : ""}`,
        });
        setTimeout(() => setLastSynced(null), 5000);
      }
    } catch {
      // swallow — will retry on next online event
    } finally {
      setSyncing(false);
    }
  }, [syncing, toast]);

  // Listen for online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setOnline(true);
      toast({ title: "Back online", description: "Syncing offline sales..." });
      // Auto-flush after a short delay
      setTimeout(() => flush(), 1000);
    };
    const handleOffline = () => {
      setOnline(false);
      toast({ title: "Offline", description: "Sales will be queued locally", variant: "destructive" });
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Initial count
    refreshCount();
    // Refresh count every 10 seconds
    const interval = setInterval(refreshCount, 10000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(interval);
    };
  }, [flush, refreshCount, toast]);

  // Don't render during SSR
  if (typeof navigator === "undefined") return null;

  return (
    <div className="flex items-center gap-1.5">
      <AnimatePresence mode="wait">
        {online ? (
          <motion.div
            key="online"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="flex items-center gap-1.5"
          >
            {syncing ? (
              <Badge className="bg-blue-100 text-blue-700 border-blue-200">
                <Loader2 className="h-3 w-3 mr-1 animate-spin" /> Syncing...
              </Badge>
            ) : lastSynced ? (
              <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
                <CheckCircle2 className="h-3 w-3 mr-1" /> Synced {lastSynced}
              </Badge>
            ) : pendingCount > 0 ? (
              <Button
                size="sm"
                variant="outline"
                onClick={flush}
                className="h-6 px-2 text-[10px] border-amber-300 text-amber-700 hover:bg-amber-50"
              >
                <AlertTriangle className="h-3 w-3 mr-1" /> {pendingCount} queued — Sync now
              </Button>
            ) : (
              <Badge className="bg-emerald-50 text-emerald-600 border-emerald-100">
                <Wifi className="h-3 w-3 mr-0.5" /> Online
              </Badge>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="offline"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
          >
            <Badge className="bg-rose-100 text-rose-700 border-rose-200 animate-pulse">
              <WifiOff className="h-3 w-3 mr-1" /> Offline
              {pendingCount > 0 && <span className="ml-1 font-bold">· {pendingCount} queued</span>}
            </Badge>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
