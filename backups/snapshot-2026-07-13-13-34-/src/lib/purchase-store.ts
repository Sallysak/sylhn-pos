/**
 * SYLHN POS — Purchase store (localStorage-backed)
 *
 * Provides CRUD operations for purchase orders and invoices.
 * Mirrors the data shape that the server (Prisma) uses so the UI can
 * work offline and sync later.
 */

const PURCHASES_KEY = "sylhn-purchases-list-v2";

export interface PurchaseLine {
  id: string;
  partNo: string;
  details: string;
  emoji?: string;
  quantity: number;
  cost: number;
  tax: boolean;
  total: number;
  expiryDate?: string | null;
}

export interface PurchaseRecord {
  id: string;
  refNo: string;
  type: "purchase" | "order";
  supplierId?: string;
  supplierName: string;
  status: "draft" | "ordered" | "received" | "cancelled";
  lines: PurchaseLine[];
  subtotal: number;
  discount: number;
  taxAmount: number;
  total: number;
  amountPaid: number;
  notes: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  receivedAt?: string | null;
}

// ===== Read all =====
export function getAllPurchases(): PurchaseRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(PURCHASES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

// ===== Read by ID =====
export function getPurchaseById(id: string): PurchaseRecord | null {
  return getAllPurchases().find(p => p.id === id) || null;
}

// ===== Read by refNo =====
export function getPurchaseByRefNo(refNo: string): PurchaseRecord | null {
  return getAllPurchases().find(p => p.refNo === refNo) || null;
}

// ===== Create =====
export function createPurchase(data: Omit<PurchaseRecord, "id" | "createdAt" | "updatedAt">): PurchaseRecord {
  const now = new Date().toISOString();
  const record: PurchaseRecord = {
    ...data,
    id: `pur-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: now,
    updatedAt: now,
  };
  const all = getAllPurchases();
  all.unshift(record);
  saveAll(all);
  return record;
}

// ===== Update =====
export function updatePurchase(id: string, updates: Partial<PurchaseRecord>): PurchaseRecord | null {
  const all = getAllPurchases();
  const idx = all.findIndex(p => p.id === id);
  if (idx === -1) return null;
  all[idx] = { ...all[idx], ...updates, updatedAt: new Date().toISOString() };
  saveAll(all);
  return all[idx];
}

// ===== Delete =====
export function deletePurchase(id: string): boolean {
  const all = getAllPurchases();
  const filtered = all.filter(p => p.id !== id);
  if (filtered.length === all.length) return false;
  saveAll(filtered);
  return true;
}

// ===== Filter =====
export function filterPurchases(opts: {
  type?: "purchase" | "order";
  status?: "draft" | "ordered" | "received" | "cancelled";
  supplierId?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}): PurchaseRecord[] {
  let results = getAllPurchases();
  if (opts.type) results = results.filter(p => p.type === opts.type);
  if (opts.status) results = results.filter(p => p.status === opts.status);
  if (opts.supplierId) results = results.filter(p => p.supplierId === opts.supplierId);
  if (opts.dateFrom) results = results.filter(p => p.createdAt >= opts.dateFrom!);
  if (opts.dateTo) results = results.filter(p => p.createdAt <= opts.dateTo!);
  if (opts.search) {
    const q = opts.search.toLowerCase();
    results = results.filter(p =>
      p.refNo.toLowerCase().includes(q) ||
      p.supplierName.toLowerCase().includes(q) ||
      p.notes.toLowerCase().includes(q) ||
      p.lines.some(l => l.partNo.toLowerCase().includes(q) || l.details.toLowerCase().includes(q))
    );
  }
  return results;
}

// ===== Save all (with backup) =====
function saveAll(purchases: PurchaseRecord[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PURCHASES_KEY, JSON.stringify(purchases));
  } catch { /* ignore */ }
}

// ===== Stats =====
export function getPurchaseStats(opts: { dateFrom?: string; dateTo?: string } = {}): {
  totalPurchases: number;
  totalOrders: number;
  totalAmount: number;
  totalPaid: number;
  totalDue: number;
} {
  let records = getAllPurchases();
  if (opts.dateFrom) records = records.filter(p => p.createdAt >= opts.dateFrom!);
  if (opts.dateTo) records = records.filter(p => p.createdAt <= opts.dateTo!);

  const purchases = records.filter(p => p.type === "purchase" && p.status !== "cancelled");
  const orders = records.filter(p => p.type === "order" && p.status !== "cancelled");

  return {
    totalPurchases: purchases.length,
    totalOrders: orders.length,
    totalAmount: purchases.reduce((sum, p) => sum + p.total, 0),
    totalPaid: purchases.reduce((sum, p) => sum + p.amountPaid, 0),
    totalDue: purchases.reduce((sum, p) => sum + (p.total - p.amountPaid), 0),
  };
}
