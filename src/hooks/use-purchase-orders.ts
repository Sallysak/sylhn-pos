"use client";

import { useState, useEffect, useCallback } from "react";
import {
  loadReorderDraft,
  saveReorderDraft,
  clearReorderDraft,
  generateRefNo,
  createFromReorderDraft,
  type ReorderDraft,
} from "@/lib/purchase-orders-store";

export function usePurchaseOrders() {
  const [draft, setDraft] = useState<ReorderDraft | null>(null);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setDraft(loadReorderDraft());
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const saveDraft = useCallback((d: ReorderDraft) => {
    saveReorderDraft(d);
    setDraft(d);
  }, []);

  const discardDraft = useCallback(() => {
    clearReorderDraft();
    setDraft(null);
  }, []);

  const convertDraftToOrder = useCallback((createdBy: string) => {
    if (!draft) return null;
    const order = createFromReorderDraft(draft, createdBy);
    clearReorderDraft();
    setDraft(null);
    return order;
  }, [draft]);

  const nextRefNo = useCallback((type: "purchase" | "order" = "order") => {
    return generateRefNo(type);
  }, []);

  return {
    draft,
    hasDraft: draft !== null,
    saveDraft,
    discardDraft,
    convertDraftToOrder,
    nextRefNo,
  };
}
