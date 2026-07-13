/**
 * SYLHN POS — Sync utilities
 *
 * Syncs localStorage data with the server (Prisma DB) when online.
 * - Push: send local changes to server
 * - Pull: fetch server data to local
 * - Conflict resolution: last-write-wins by timestamp
 */

const SYNC_STATE_KEY = "sylhn-sync-state";
const SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export interface SyncState {
  lastPushedAt: string | null;
  lastPulledAt: string | null;
  lastError: string | null;
  pendingChanges: number;
  online: boolean;
}

const DEFAULT_STATE: SyncState = {
  lastPushedAt: null,
  lastPulledAt: null,
  lastError: null,
  pendingChanges: 0,
  online: true,
};

// ===== State persistence =====
export function getSyncState(): SyncState {
  if (typeof window === "undefined") return DEFAULT_STATE;
  try {
    const raw = localStorage.getItem(SYNC_STATE_KEY);
    return raw ? { ...DEFAULT_STATE, ...JSON.parse(raw) } : DEFAULT_STATE;
  } catch { return DEFAULT_STATE; }
}

function setSyncState(state: Partial<SyncState>): void {
  if (typeof window === "undefined") return;
  try {
    const current = getSyncState();
    localStorage.setItem(SYNC_STATE_KEY, JSON.stringify({ ...current, ...state }));
  } catch { /* ignore */ }
}

// ===== Online detection =====
export function isOnline(): boolean {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

// ===== Push (local → server) =====
export async function pushChanges(): Promise<{ success: boolean; message: string }> {
  if (!isOnline()) {
    setSyncState({ online: false, lastError: "Offline" });
    return { success: false, message: "Offline" };
  }

  try {
    // Push products
    const productsRaw = localStorage.getItem("sylhn-products");
    if (productsRaw) {
      const products = JSON.parse(productsRaw);
      await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
        body: JSON.stringify({ groups }),
      });
    }

    // Push suppliers
    const suppliersRaw = localStorage.getItem("sylhn-suppliers");
    if (suppliersRaw) {
      const suppliers = JSON.parse(suppliersRaw);
      await fetch("/api/suppliers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suppliers }),
      });
    }

    setSyncState({
      lastPushedAt: new Date().toISOString(),
      lastError: null,
      online: true,
      pendingChanges: 0,
    });
    return { success: true, message: "Synced" };
  } catch (e) {
    setSyncState({ lastError: (e as Error).message, online: true });
    return { success: false, message: (e as Error).message };
  }
}

// ===== Pull (server → local) =====
export async function pullChanges(): Promise<{ success: boolean; message: string }> {
  if (!isOnline()) {
    setSyncState({ online: false, lastError: "Offline" });
    return { success: false, message: "Offline" };
  }

  try {
    // Pull products (only update local if server has newer)
    const res = await fetch("/api/products");
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.products) && data.products.length > 0) {
        // Merge: keep local if newer (use updatedAt), else take server
        const localRaw = localStorage.getItem("sylhn-products");
        const local = localRaw ? JSON.parse(localRaw) : [];
        const localMap = new Map(local.map((p: any) => [p.id, p]));
        for (const sp of data.products) {
          const lp: any = localMap.get(sp.id);
          if (!lp || new Date(sp.updatedAt) > new Date(lp.updatedAt || 0)) {
            localMap.set(sp.id, sp);
          }
        }
        localStorage.setItem("sylhn-products", JSON.stringify(Array.from(localMap.values())));
      }
    }

    setSyncState({
      lastPulledAt: new Date().toISOString(),
      lastError: null,
      online: true,
    });
    return { success: true, message: "Pulled" };
  } catch (e) {
    setSyncState({ lastError: (e as Error).message, online: true });
    return { success: false, message: (e as Error).message };
  }
}

// ===== Auto-sync (debounced) =====
let syncTimer: ReturnType<typeof setTimeout> | null = null;
let autoSyncInterval: ReturnType<typeof setInterval> | null = null;

export function scheduleSync(delay = 3000): void {
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    pushChanges().catch(() => { /* ignore */ });
    syncTimer = null;
  }, delay);
}

export function startAutoSync(onSync?: (state: SyncState) => void): () => void {
  if (typeof window === "undefined") return () => {};

  // Online/offline listeners
  const onOnline = () => {
    setSyncState({ online: true });
    pushChanges();
  };
  const onOffline = () => setSyncState({ online: false });
  window.addEventListener("online", onOnline);
  window.addEventListener("offline", onOffline);

  // Periodic sync
  autoSyncInterval = setInterval(async () => {
    if (!isOnline()) return;
    await pushChanges();
    onSync?.(getSyncState());
  }, SYNC_INTERVAL_MS);

  return () => {
    window.removeEventListener("online", onOnline);
    window.removeEventListener("offline", onOffline);
    if (autoSyncInterval) clearInterval(autoSyncInterval);
    if (syncTimer) clearTimeout(syncTimer);
    autoSyncInterval = null;
    syncTimer = null;
  };
}
