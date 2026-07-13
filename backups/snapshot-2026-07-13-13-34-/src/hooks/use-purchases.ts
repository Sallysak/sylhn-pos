"use client";

import { useState, useEffect, useCallback } from "react";
import { getAllPurchases, createPurchase, updatePurchase, deletePurchase, filterPurchases, type PurchaseRecord } from "@/lib/purchase-store";

export interface UsePurchasesOptions {
  type?: "purchase" | "order";
  status?: "draft" | "ordered" | "received" | "cancelled";
  search?: string;
}

export function usePurchases(opts: UsePurchasesOptions = {}) {
  const [purchases, setPurchases] = useState<PurchaseRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    setPurchases(filterPurchases(opts));
    setLoading(false);
  }, [opts]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    refresh();
    // Listen for storage changes (multi-tab sync)
    const handler = (e: StorageEvent) => {
      if (e.key === "sylhn-purchases-list-v2") refresh();
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, [refresh]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const add = useCallback((data: Omit<PurchaseRecord, "id" | "createdAt" | "updatedAt">) => {
    const rec = createPurchase(data);
    refresh();
    return rec;
  }, [refresh]);

  const update = useCallback((id: string, updates: Partial<PurchaseRecord>) => {
    const rec = updatePurchase(id, updates);
    refresh();
    return rec;
  }, [refresh]);

  const remove = useCallback((id: string) => {
    const ok = deletePurchase(id);
    refresh();
    return ok;
  }, [refresh]);

  return { purchases, loading, refresh, add, update, remove };
}
