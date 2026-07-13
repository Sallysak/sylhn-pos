/**
 * SYLHN POS — Security utilities
 *
 * Session management, audit logging, and password helpers.
 * All state is persisted to localStorage so it works offline (PWA).
 *
 * Keys:
 *   sylhn-session           — current session { user, createdAt, lastActivity }
 *   sylhn-audit-log         — append-only audit log (array of AuditLogEntry)
 *   sylhn-login-attempts    — failed login attempt counter
 */

const SESSION_KEY = "sylhn-session";
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const AUDIT_KEY = "sylhn-audit-log";
const ATTEMPTS_KEY = "sylhn-login-attempts";

export interface Session {
  user: any;
  createdAt: string;
  lastActivity: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  module: string;
  details: string;
  severity: "info" | "warning" | "critical";
}

// ===== Session =====
export function createSession(user: any): void {
  if (typeof window === "undefined") return;
  const now = new Date().toISOString();
  const session: Session = { user, createdAt: now, lastActivity: now };
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    // Also set a cookie so middleware/server can read it
    document.cookie = `sylhn-session=${encodeURIComponent(JSON.stringify({ username: user.username, role: user.role }))}; path=/; max-age=${SESSION_TIMEOUT_MS / 1000}; SameSite=Lax`;
  } catch { /* ignore */ }
}

export function getSession(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function touchSession(): void {
  if (typeof window === "undefined") return;
  const s = getSession();
  if (!s) return;
  s.lastActivity = new Date().toISOString();
  try { localStorage.setItem(SESSION_KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

export function isSessionValid(): boolean {
  const s = getSession();
  if (!s) return false;
  const lastActivity = new Date(s.lastActivity).getTime();
  if (Date.now() - lastActivity > SESSION_TIMEOUT_MS) {
    destroySession();
    return false;
  }
  return true;
}

export function destroySession(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(SESSION_KEY);
    document.cookie = "sylhn-session=; path=/; max-age=0";
  } catch { /* ignore */ }
}

// ===== Activity tracking — auto-touch on user interaction =====
let activityListenersBound = false;
export function startActivityTracking(): () => void {
  if (typeof window === "undefined" || activityListenersBound) return () => {};
  activityListenersBound = true;
  const events = ["mousedown", "keydown", "touchstart", "scroll"];
  let lastTouch = 0;
  const handler = () => {
    const now = Date.now();
    if (now - lastTouch > 5000) { // throttle to once per 5s
      lastTouch = now;
      touchSession();
    }
  };
  events.forEach(e => window.addEventListener(e, handler, { passive: true }));
  return () => {
    events.forEach(e => window.removeEventListener(e, handler));
    activityListenersBound = false;
  };
}

// ===== Audit log =====
export function logAudit(
  user: string,
  action: string,
  module: string,
  details: string,
  severity: "info" | "warning" | "critical" = "info"
): void {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(AUDIT_KEY);
    const log: AuditLogEntry[] = raw ? JSON.parse(raw) : [];
    log.unshift({
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      user,
      action,
      module,
      details,
      severity,
    });
    // Cap at 1000 entries
    const trimmed = log.slice(0, 1000);
    localStorage.setItem(AUDIT_KEY, JSON.stringify(trimmed));
  } catch { /* ignore */ }
}

export function getAuditLog(limit = 100): AuditLogEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(AUDIT_KEY);
    const log: AuditLogEntry[] = raw ? JSON.parse(raw) : [];
    return log.slice(0, limit);
  } catch { return []; }
}

export function clearAuditLog(): void {
  if (typeof window === "undefined") return;
  try { localStorage.removeItem(AUDIT_KEY); } catch { /* ignore */ }
}

// ===== Login attempts / lockout =====
export function getLoginAttempts(): number {
  if (typeof window === "undefined") return 0;
  try { return parseInt(localStorage.getItem(ATTEMPTS_KEY) || "0", 10); } catch { return 0; }
}

export function recordLoginFailure(): number {
  if (typeof window === "undefined") return 1;
  const attempts = getLoginAttempts() + 1;
  try { localStorage.setItem(ATTEMPTS_KEY, String(attempts)); } catch { /* ignore */ }
  return attempts;
}

export function resetLoginAttempts(): void {
  if (typeof window === "undefined") return;
  try { localStorage.removeItem(ATTEMPTS_KEY); } catch { /* ignore */ }
}

// ===== Password helpers (no real hashing — this is a local-only PWA) =====
export function validatePassword(password: string): { valid: boolean; message?: string } {
  if (password.length < 4) return { valid: false, message: "Password must be at least 4 characters" };
  if (password.length > 64) return { valid: false, message: "Password too long" };
  return { valid: true };
}

export function generatePassword(length = 8): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let pwd = "";
  for (let i = 0; i < length; i++) {
    pwd += chars[Math.floor(Math.random() * chars.length)];
  }
  return pwd;
}
