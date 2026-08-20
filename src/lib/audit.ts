/**
 * SYLHN POS — Audit log helper
 *
 * Centralizes audit-log creation so every write endpoint logs consistently
 * with the same shape (and includes IP / user-agent where available).
 */

import { db } from "./db";

export interface AuditParams {
  userId: string;
  user: string;       // username (denormalized)
  action: string;     // LOGIN | LOGOUT | CREATE | UPDATE | DELETE | VOID | REFUND | ADJUST | EXPORT | SEED | etc.
  module: string;     // auth | pos | sales | stock | purchase | supplier | accounts | telephone | maintenance | loyalty | dashboard
  details: string;
  severity?: "info" | "warning" | "critical";  // default "info"
  ipAddress?: string;
  userAgent?: string;
}

// ===== Fire-and-forget audit log (does NOT block the request) =====
// Use this for non-transactional audit logs (e.g. login, logout, exports).
//
// PERFORMANCE: Previously this was `async` and every caller `await`ed it —
// which blocked the response by 5-30ms per audit log DB write. On login,
// there are 1-2 audit log writes, so login was 10-60ms slower than needed.
//
// Now: truly fire-and-forget. The DB write happens in the background.
// Errors are logged via console.warn but never reject.
export function auditLog(params: AuditParams): void {
  // Fire-and-forget — do NOT await. The promise is intentionally unhandled
  // (errors are caught inside .catch()).
  try {
    void db.auditLog.create({
      data: {
        userId: params.userId,
        user: params.user,
        action: params.action,
        module: params.module,
        details: params.details,
        severity: params.severity || "info",
        ipAddress: params.ipAddress || "",
        userAgent: params.userAgent || "",
      },
    }).catch((e: any) => {
      // Audit log failure should NOT fail the user's request — just warn.
      console.warn("Audit log failed:", e?.message || e);
    });
  } catch (e: any) {
    // Synchronous error (e.g. db proxy getter failed) — log and move on
    console.warn("Audit log setup failed:", e?.message || e);
  }
}

// ===== Transactional audit log (use inside db.$transaction) =====
// Use this when the audit log MUST be part of the same transaction as the write.
export async function auditLogTx(tx: any, params: AuditParams): Promise<void> {
  await tx.auditLog.create({
    data: {
      userId: params.userId,
      user: params.user,
      action: params.action,
      module: params.module,
      details: params.details,
      severity: params.severity || "info",
      ipAddress: params.ipAddress || "",
      userAgent: params.userAgent || "",
    },
  });
}
