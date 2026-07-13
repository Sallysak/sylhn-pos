/**
 * SYLHN POS — File integrity protection
 *
 * Background integrity checks + auto-backup for localStorage data.
 * Catches data corruption (missing fields, malformed JSON) and repairs
 * known issues automatically.
 */

const BACKUP_PREFIX = "sylhn-backup-";
const BACKUP_MAX = 10; // keep last 10 backups per key

const CRITICAL_KEYS = [
  "sylhn-products",
  "sylhn-groups",
  "sylhn-history",
  "sylhn-system-users",
  "sylhn-system-settings",
  "sylhn-held-orders",
  "sylhn-purchases-list-v2",
];

export interface IntegrityReport {
  healthy: boolean;
  issues: { severity: "info" | "warning" | "critical"; description: string; key?: string }[];
  restoredKeys: string[];
}

// ===== Backup management =====
export function backupKey(key: string, value: any): void {
  if (typeof window === "undefined") return;
  try {
    const backupKey = `${BACKUP_PREFIX}${key}`;
    const existing = JSON.parse(localStorage.getItem(backupKey) || "[]");
    existing.unshift({ ts: Date.now(), value });
    // Keep only the last N backups
    const trimmed = existing.slice(0, BACKUP_MAX);
    localStorage.setItem(backupKey, JSON.stringify(trimmed));
  } catch { /* ignore */ }
}

export function restoreFromBackup(key: string): any | null {
  if (typeof window === "undefined") return null;
  try {
    const backupKey = `${BACKUP_PREFIX}${key}`;
    const backups = JSON.parse(localStorage.getItem(backupKey) || "[]");
    if (backups.length === 0) return null;
    return backups[0].value;
  } catch { return null; }
}

// ===== Integrity check =====
export function runIntegrityCheck(): IntegrityReport {
  const report: IntegrityReport = {
    healthy: true,
    issues: [],
    restoredKeys: [],
  };

  if (typeof window === "undefined") return report;

  for (const key of CRITICAL_KEYS) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) {
        // Try to restore from backup
        const restored = restoreFromBackup(key);
        if (restored !== null) {
          localStorage.setItem(key, JSON.stringify(restored));
          report.restoredKeys.push(key);
          report.issues.push({
            severity: "warning",
            description: `${key} was missing — restored from backup`,
            key,
          });
        } else {
          report.issues.push({
            severity: "info",
            description: `${key} not yet initialized (will use defaults)`,
            key,
          });
        }
        continue;
      }

      // Try to parse
      const parsed = JSON.parse(raw);
      if (!parsed) {
        report.healthy = false;
        report.issues.push({
          severity: "critical",
          description: `${key} is empty or null`,
          key,
        });
      }

      // Validate it's an array or object
      if (!Array.isArray(parsed) && typeof parsed !== "object") {
        report.healthy = false;
        report.issues.push({
          severity: "critical",
          description: `${key} is not a valid array/object`,
          key,
        });
      }
    } catch (e) {
      report.healthy = false;
      report.issues.push({
        severity: "critical",
        description: `${key} contains malformed JSON: ${(e as Error).message}`,
        key,
      });
    }
  }

  return report;
}

// ===== Product repair =====
export function repairProducts(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = localStorage.getItem("sylhn-products");
    if (!raw) return 0;
    const products = JSON.parse(raw);
    if (!Array.isArray(products)) return 0;

    let repairedCount = 0;
    const repaired = products.map((p: any) => {
      let changed = false;
      const fixed = { ...p };

      // Required fields with defaults
      const defaults: Record<string, any> = {
        id: () => `prod-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        sku: () => `SKU-${Math.floor(Math.random() * 100000)}`,
        name: () => "Unnamed Product",
        emoji: () => "📦",
        category: () => "other",
        price: () => 0,
        costPrice: () => 0,
        quantity: () => 0,
        unit: () => "each",
        reorderLevel: () => 5,
        taxable: () => true,
        barcode: () => "",
        supplier: () => "",
        groupId: () => null,
        batchNumber: () => "",
        expiryDate: () => null,
        receivedDate: () => null,
        active: () => true,
      };

      for (const [field, defaultFn] of Object.entries(defaults)) {
        if (fixed[field] === undefined || fixed[field] === null) {
          fixed[field] = defaultFn();
          changed = true;
        }
      }

      // Type coercion
      if (typeof fixed.price !== "number") { fixed.price = parseFloat(fixed.price) || 0; changed = true; }
      if (typeof fixed.costPrice !== "number") { fixed.costPrice = parseFloat(fixed.costPrice) || 0; changed = true; }
      if (typeof fixed.quantity !== "number") { fixed.quantity = parseInt(fixed.quantity, 10) || 0; changed = true; }

      if (changed) repairedCount++;
      return fixed;
    });

    if (repairedCount > 0) {
      localStorage.setItem("sylhn-products", JSON.stringify(repaired));
    }

    return repairedCount;
  } catch { return 0; }
}

// ===== Session protection (auto-backup every 5 min) =====
let sessionInterval: ReturnType<typeof setInterval> | null = null;

export function startSessionProtection(
  onIssue?: (report: IntegrityReport) => void
): () => void {
  if (typeof window === "undefined") return () => {};

  // Backup critical keys immediately
  for (const key of CRITICAL_KEYS) {
    try {
      const raw = localStorage.getItem(key);
      if (raw) backupKey(key, JSON.parse(raw));
    } catch { /* ignore */ }
  }

  // Schedule periodic checks
  if (sessionInterval) clearInterval(sessionInterval);
  sessionInterval = setInterval(() => {
    const report = runIntegrityCheck();
    const repaired = repairProducts();
    if (repaired > 0) {
      onIssue?.({
        healthy: true,
        issues: [{
          severity: "warning",
          description: `${repaired} product(s) auto-repaired`,
        }],
        restoredKeys: [],
      });
    }
    if (!report.healthy || report.restoredKeys.length > 0) {
      onIssue?.(report);
    }

    // Auto-backup
    for (const key of CRITICAL_KEYS) {
      try {
        const raw = localStorage.getItem(key);
        if (raw) backupKey(key, JSON.parse(raw));
      } catch { /* ignore */ }
    }
  }, 5 * 60 * 1000); // 5 minutes

  return () => {
    if (sessionInterval) {
      clearInterval(sessionInterval);
      sessionInterval = null;
    }
  };
}

// ===== Full data export / import =====
export function exportAllData(): string {
  if (typeof window === "undefined") return "{}";
  const data: Record<string, any> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith("sylhn-")) {
      try {
        const raw = localStorage.getItem(key);
        data[key] = raw ? JSON.parse(raw) : null;
      } catch {
        data[key] = localStorage.getItem(key);
      }
    }
  }
  return JSON.stringify({ exportedAt: new Date().toISOString(), data }, null, 2);
}

export function importAllData(json: string): { success: boolean; message: string } {
  if (typeof window === "undefined") return { success: false, message: "Server-side" };
  try {
    const parsed = JSON.parse(json);
    if (!parsed.data || typeof parsed.data !== "object") {
      return { success: false, message: "Invalid backup format" };
    }
    for (const [key, value] of Object.entries(parsed.data)) {
      localStorage.setItem(key, typeof value === "string" ? value : JSON.stringify(value));
    }
    return { success: true, message: "Data imported successfully" };
  } catch (e) {
    return { success: false, message: `Import failed: ${(e as Error).message}` };
  }
}

// ===== Reset all data =====
export function resetAllData(): void {
  if (typeof window === "undefined") return;
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith("sylhn-")) keysToRemove.push(key);
  }
  keysToRemove.forEach(k => localStorage.removeItem(k));
}
