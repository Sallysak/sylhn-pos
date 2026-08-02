/**
 * SYLHN POS — Offline Sale Queue (IndexedDB)
 *
 * When the POS is offline (no internet), completed sales are stored
 * locally in IndexedDB. When connectivity is restored, the queue is
 * flushed to the server via POST /api/sales.
 *
 * Conflict resolution: if a sale's invoice number already exists on
 * the server (e.g. another cashier created a sale with the same number
 * while offline), the server returns 409 + a new invoice number. The
 * queue retries with the new number.
 *
 * Usage:
 *   import { OfflineSaleQueue } from "@/lib/offline-sale-queue";
 *   await OfflineSaleQueue.enqueue(saleData);
 *   await OfflineSaleQueue.flush();
 *   const pending = await OfflineSaleQueue.count();
 */

const DB_NAME = "sylhn-pos-offline";
const STORE = "sale-queue";
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "localId" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export interface QueuedSale {
  localId: string;           // UUID generated client-side
  saleData: any;             // The full sale payload (items, payments, etc.)
  createdAt: string;         // ISO timestamp
  attempts: number;          // Sync attempt count
  lastError?: string;        // Last sync error message
  status: "pending" | "syncing" | "failed";
}

export const OfflineSaleQueue = {
  /**
   * Add a sale to the offline queue.
   */
  async enqueue(saleData: any): Promise<string> {
    const db = await openDB();
    const localId = crypto.randomUUID();
    const entry: QueuedSale = {
      localId,
      saleData,
      createdAt: new Date().toISOString(),
      attempts: 0,
      status: "pending",
    };
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).add(entry);
      tx.oncomplete = () => resolve(localId);
      tx.onerror = () => reject(tx.error);
    });
  },

  /**
   * Get all pending sales in the queue (oldest first).
   */
  async getAll(): Promise<QueuedSale[]> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => {
        const items = (req.result as QueuedSale[]).sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        resolve(items);
      };
      req.onerror = () => reject(req.error);
    });
  },

  /**
   * Count pending sales.
   */
  async count(): Promise<number> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).count();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },

  /**
   * Remove a sale from the queue (after successful sync).
   */
  async remove(localId: string): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(localId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  /**
   * Update a sale's status + error info.
   */
  async update(localId: string, patch: Partial<QueuedSale>): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      const getReq = store.get(localId);
      getReq.onsuccess = () => {
        const entry = getReq.result as QueuedSale;
        if (!entry) return resolve();
        Object.assign(entry, patch);
        store.put(entry);
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  /**
   * Flush the queue — attempt to sync all pending sales to the server.
   * Returns { synced, failed, remaining }.
   */
  async flush(): Promise<{ synced: number; failed: number; remaining: number }> {
    const queue = await this.getAll();
    let synced = 0;
    let failed = 0;

    for (const entry of queue) {
      if (entry.status === "syncing") continue;

      await this.update(entry.localId, { status: "syncing", attempts: entry.attempts + 1 });

      try {
        const res = await fetch("/api/sales", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(entry.saleData),
        });

        if (res.ok) {
          await this.remove(entry.localId);
          synced++;
        } else if (res.status === 409) {
          // Conflict — invoice number already exists. Get a new one and retry.
          const data = await res.json();
          if (data.newInvoiceNumber) {
            const updatedSaleData = { ...entry.saleData, invoiceNumber: data.newInvoiceNumber };
            await this.update(entry.localId, { saleData: updatedSaleData, status: "pending", lastError: "Conflict — reassigned invoice number" });
          } else {
            await this.update(entry.localId, { status: "failed", lastError: data.error || "Conflict" });
            failed++;
          }
        } else {
          const data = await res.json().catch(() => ({}));
          await this.update(entry.localId, { status: "failed", lastError: data.error || `HTTP ${res.status}` });
          failed++;
        }
      } catch (e: any) {
        // Network error — leave as pending for next flush
        await this.update(entry.localId, { status: "pending", lastError: e?.message || "Network error" });
        failed++;
        break; // Stop flushing — network is probably still down
      }
    }

    const remaining = await this.count();
    return { synced, failed, remaining };
  },

  /**
   * Clear all sales from the queue (admin only — use with caution).
   */
  async clear(): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },
};
