/**
 * SYLHN POS — Offline Sale Queue (IndexedDB)
 *
 * Premium feature: when the network is unavailable, sales are queued in
 * IndexedDB (persistent across page reloads). When connectivity is restored,
 * the queue is flushed to /api/sales in FIFO order.
 *
 * Why IndexedDB (not localStorage):
 *   - Larger storage quota (50MB+ vs 5MB)
 *   - Asynchronous (doesn't block the UI thread)
 *   - Survives page reloads / app restarts
 *   - Can store full sale payloads including items array
 *
 * API:
 *   - queueSale(salePayload) — add a sale to the queue
 *   - flushQueue() — attempt to POST all queued sales; returns count synced
 *   - getQueuedSales() — list pending sales (for UI display)
 *   - removeFromQueue(id) — remove a successfully-synced sale
 *   - onQueueChange(cb) — subscribe to queue size changes
 *   - isOnline() — check current online status
 */

const DB_NAME = "sylhn-pos-offline";
const DB_VERSION = 1;
const STORE_NAME = "queued-sales";

// ===== IndexedDB setup =====
let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB not supported"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("createdAt", "createdAt", { unique: false });
        store.createIndex("status", "status", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

export interface QueuedSale {
  id: string;                // client-generated UUID
  payload: any;              // the sale body to POST to /api/sales
  createdAt: string;         // ISO timestamp
  attempts: number;          // sync attempt count
  lastAttemptAt?: string;    // ISO timestamp of last sync attempt
  status: "pending" | "syncing" | "failed";
  lastError?: string;
  // Snapshot of the sale for UI display (without re-parsing payload)
  preview: {
    invoiceNumber: string;
    total: number;
    itemCount: number;
    customerName?: string;
    cashierName: string;
  };
}

// ===== Queue operations =====

export async function queueSale(payload: any): Promise<QueuedSale> {
  const db = await openDB();
  const entry: QueuedSale = {
    id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    payload,
    createdAt: new Date().toISOString(),
    attempts: 0,
    status: "pending",
    preview: {
      invoiceNumber: payload.invoiceNumber || "(pending)",
      total: payload.total || 0,
      itemCount: payload.items?.length || 0,
      customerName: payload.customerName,
      cashierName: payload.cashierName || "",
    },
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).add(entry);
    tx.oncomplete = () => {
      notifyQueueChange();
      resolve(entry);
    };
    tx.onerror = () => reject(tx.error);
  });
}

export async function getQueuedSales(): Promise<QueuedSale[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => {
      const all = (req.result as QueuedSale[]) || [];
      // Sort by createdAt ascending (FIFO)
      all.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      resolve(all);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function removeFromQueue(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => { notifyQueueChange(); resolve(); };
    tx.onerror = () => reject(tx.error);
  });
}

export async function updateQueueEntry(id: string, updates: Partial<QueuedSale>): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const entry = getReq.result as QueuedSale | undefined;
      if (!entry) { resolve(); return; }
      Object.assign(entry, updates);
      store.put(entry);
    };
    tx.oncomplete = () => { notifyQueueChange(); resolve(); };
    tx.onerror = () => reject(tx.error);
  });
}

export async function clearQueue(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).clear();
    tx.oncomplete = () => { notifyQueueChange(); resolve(); };
    tx.onerror = () => reject(tx.error);
  });
}

// ===== Sync: flush queue to server =====

export async function flushQueue(): Promise<{ synced: number; failed: number; errors: string[] }> {
  const queued = await getQueuedSales();
  if (queued.length === 0) return { synced: 0, failed: 0, errors: [] };

  let synced = 0;
  let failed = 0;
  const errors: string[] = [];

  // Sync in FIFO order — each sale must succeed before the next is attempted
  // (so stock decrements happen in the right order)
  for (const entry of queued) {
    if (entry.status === "syncing") continue; // skip if another tab is syncing it

    await updateQueueEntry(entry.id, {
      status: "syncing",
      attempts: entry.attempts + 1,
      lastAttemptAt: new Date().toISOString(),
    });

    try {
      // Read the Bearer token from localStorage and CSRF from cookies
      const token = typeof localStorage !== "undefined" ? localStorage.getItem("sylhn-session-token") : null;
      const csrfMatch = typeof document !== "undefined" ? document.cookie.match(/sylhn-csrf=([^;]+)/) : null;
      const csrfToken = csrfMatch ? decodeURIComponent(csrfMatch[1]) : "";
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      if (csrfToken) headers["X-CSRF-Token"] = csrfToken;
      const res = await fetch("/api/sales", {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify(entry.payload),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          await removeFromQueue(entry.id);
          synced++;
          continue;
        }
        throw new Error(data.error || "Server rejected sale");
      } else if (res.status === 500) {
        // 500 usually means "Unique constraint failed" — the sale was
        // already saved. Remove it from the queue instead of failing.
        const errText = await res.text().catch(() => '');
        if (errText.includes("Unique constraint") || errText.includes("already")) {
          // Sale already exists in the DB — remove from queue, count as synced
          await removeFromQueue(entry.id);
          synced++;
          continue;
        }
        throw new Error(`Server error: ${errText.slice(0, 100)}`);
      } else if (res.status === 400) {
        // Validation error — sale is malformed, don't retry
        const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(`Validation: ${data.error || res.status}`);
      } else if (res.status === 401) {
        // Auth expired — stop syncing, user needs to log in again
        await updateQueueEntry(entry.id, {
          status: "failed",
          lastError: "Authentication expired — please log in again",
        });
        errors.push(`${entry.preview.invoiceNumber}: auth expired`);
        failed++;
        break;  // stop the whole flush — all subsequent sales will fail too
      } else {
        throw new Error(`HTTP ${res.status}`);
      }
    } catch (e: any) {
      const errorMsg = e?.message || "Network error";
      await updateQueueEntry(entry.id, {
        status: "failed",
        lastError: errorMsg,
      });
      errors.push(`${entry.preview.invoiceNumber}: ${errorMsg}`);
      failed++;
      // If it's a network error, stop syncing (likely still offline)
      if (errorMsg.includes("Network") || errorMsg.includes("Failed to fetch")) {
        break;
      }
      // Otherwise (validation errors), continue to next sale
    }
  }

  return { synced, failed, errors };
}

// ===== Online/offline detection =====

let online = typeof navigator !== "undefined" ? navigator.onLine : true;
const listeners = new Set<() => void>();

if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    online = true;
    notifyQueueChange();
    // Auto-flush when we come back online
    setTimeout(() => { flushQueue().catch(() => {}); }, 1000);
  });
  window.addEventListener("offline", () => {
    online = false;
    notifyQueueChange();
  });
}

export function isOnline(): boolean {
  return online;
}

// ===== Queue change subscription =====

function notifyQueueChange() {
  for (const cb of listeners) {
    try { cb(); } catch {}
  }
}

export function onQueueChange(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

// ===== Queue size (for badge display) =====

export async function getQueueSize(): Promise<number> {
  const queued = await getQueuedSales();
  return queued.length;
}
