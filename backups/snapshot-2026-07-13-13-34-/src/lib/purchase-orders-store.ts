/**
 * SYLHN POS — Purchase Orders store
 *
 * Slightly higher-level wrapper around purchase-store for PO-specific
 * operations (drafts, reorder-driven POs, status transitions).
 */

import { createPurchase, updatePurchase, getAllPurchases, type PurchaseRecord } from "./purchase-store";

const DRAFT_KEY = "sylhn-po-draft-from-reorder";

// ===== Reorder draft =====
export interface ReorderDraft {
  refNo: string;
  supplierName: string;
  supplierId?: string;
  lines: {
    partNo: string;
    details: string;
    emoji: string;
    quantity: number;
    cost: number;
    tax: boolean;
    total: number;
  }[];
  notes: string;
  createdAt: string;
}

export function saveReorderDraft(draft: ReorderDraft): void {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch { /* ignore */ }
}

export function loadReorderDraft(): ReorderDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function clearReorderDraft(): void {
  if (typeof window === "undefined") return;
  try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
}

// ===== PO status transitions =====
export function markOrderAsReceived(id: string, receivedBy: string): PurchaseRecord | null {
  return updatePurchase(id, {
    status: "received",
    receivedAt: new Date().toISOString(),
    notes: `Received by ${receivedBy}`,
  });
}

export function cancelOrder(id: string, reason: string): PurchaseRecord | null {
  return updatePurchase(id, {
    status: "cancelled",
    notes: `Cancelled: ${reason}`,
  });
}

// ===== Generate next ref number =====
export function generateRefNo(type: "purchase" | "order" = "purchase"): string {
  const all = getAllPurchases();
  const prefix = type === "order" ? "PO" : "PUR";
  const year = new Date().getFullYear();
  const month = String(new Date().getMonth() + 1).padStart(2, "0");
  const count = all.filter(p => p.refNo.startsWith(`${prefix}-${year}${month}`)).length + 1;
  return `${prefix}-${year}${month}-${String(count).padStart(4, "0")}`;
}

// ===== Create from draft =====
export function createFromReorderDraft(draft: ReorderDraft, createdBy: string): PurchaseRecord | null {
  const subtotal = draft.lines.reduce((sum, l) => sum + l.total, 0);
  const taxAmount = draft.lines
    .filter(l => l.tax)
    .reduce((sum, l) => sum + l.total * 0.15, 0); // 15% VAT

  return createPurchase({
    refNo: draft.refNo || generateRefNo("order"),
    type: "order",
    supplierId: draft.supplierId,
    supplierName: draft.supplierName,
    status: "ordered",
    lines: draft.lines.map((l, i) => ({
      id: `line-${Date.now()}-${i}`,
      ...l,
    })),
    subtotal,
    discount: 0,
    taxAmount,
    total: subtotal + taxAmount,
    amountPaid: 0,
    notes: draft.notes,
    createdBy,
  });
}
