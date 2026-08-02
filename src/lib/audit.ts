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

// ===== Fire-and-forget audit log (does not block the request) =====
// Use this for non-transactional audit logs (e.g. login, logout, exports).
export async function auditLog(params: AuditParams): Promise<void> {
  try {
    await db.auditLog.create({
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
  } catch (e) {
    // Audit log failure should NOT fail the user's request — just warn.
    console.warn("Audit log failed:", e);
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
