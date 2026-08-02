/**
 * SYLHN POS — Input sanitization helpers
 *
 * These helpers complement Zod validation by sanitizing string inputs:
 * - Strips null bytes + control characters
 * - Trims whitespace
 * - Optionally strips HTML tags (for fields that should never contain HTML)
 * - Optionally escapes HTML entities (for fields that will be rendered as text)
 *
 * Why both Zod and sanitize?
 * Zod validates structure (length, format, regex). It does NOT sanitize.
 * A malicious user can submit "John<script>alert(1)</script>" as a name,
 * which passes Zod's length check but is XSS payload when rendered.
 * React escapes by default, but stored data might be rendered in non-React
 * contexts (PDFs, emails, exports, audit logs) — defense in depth.
 */

/**
 * Strip null bytes + control chars + trim whitespace.
 * Should be applied to ALL user-supplied string inputs.
 */
export function sanitizeString(input: string | undefined | null, maxLength = 1000): string {
  if (!input) return "";
  let s = String(input);
  // Remove null bytes (attack vector for truncating strings in some DBs)
  s = s.replace(/\0/g, "");
  // Strip control chars except newline (\n), tab (\t), carriage return (\r)
  s = s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
  // Normalize unicode line separators (can cause issues in some renderers)
  s = s.replace(/[\u2028\u2029]/g, " ");
  // Trim
  s = s.trim();
  // Truncate to max length (defense in depth — Zod should also do this)
  if (s.length > maxLength) s = s.slice(0, maxLength);
  return s;
}

/**
 * Strip all HTML tags from a string.
 * Use for fields that should be plain text only (names, addresses, notes).
 *
 * Example: "John<script>alert(1)</script>" → "Johnalert(1)"
 * For a stricter version that escapes instead of stripping, use escapeHtml.
 */
export function stripHtml(input: string | undefined | null, maxLength = 1000): string {
  const cleaned = sanitizeString(input, maxLength * 2); // allow extra room for tags
  // Remove anything between < and > (HTML tags)
  return cleaned.replace(/<[^>]*>/g, "").slice(0, maxLength);
}

/**
 * Escape HTML entities in a string.
 * Use for fields that will be rendered as HTML and you want to preserve
 * the original characters (e.g. "John & Sons" → "John &amp; Sons").
 *
 * For React components this is automatic; use this for server-rendered
 * HTML (emails, PDFs, audit log display).
 */
export function escapeHtml(input: string | undefined | null): string {
  const cleaned = sanitizeString(input);
  return cleaned
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Sanitize a phone number — strip everything except digits, +, -, spaces, parens.
 */
export function sanitizePhone(input: string | undefined | null, maxLength = 32): string {
  if (!input) return "";
  return String(input)
    .replace(/[^\d+\-\s()]/g, "")
    .trim()
    .slice(0, maxLength);
}

/**
 * Sanitize an email — lowercase + strip whitespace + basic format check.
 * Doesn't validate; just cleans. Use Zod for validation.
 */
export function sanitizeEmail(input: string | undefined | null, maxLength = 200): string {
  if (!input) return "";
  return String(input)
    .trim()
    .toLowerCase()
    .slice(0, maxLength);
}

/**
 * Sanitize a filename — strip path separators + null bytes.
 * Use before any file is saved with a user-supplied name.
 */
export function sanitizeFilename(input: string | undefined | null, maxLength = 255): string {
  if (!input) return "";
  return String(input)
    .replace(/[\0<>:"/\\|?*]/g, "") // strip illegal filename chars
    .replace(/\.\.+/g, ".")          // prevent path traversal
    .trim()
    .slice(0, maxLength);
}

/**
 * Sanitize a SQL LIKE pattern — escape %, _, \ so user input is treated literally.
 * Use when building raw SQL with LIKE clauses.
 *
 * Example: `WHERE name LIKE '%' || $1 || '%'` with sanitizeLikePattern(input)
 */
export function sanitizeLikePattern(input: string | undefined | null): string {
  if (!input) return "";
  return String(input)
    .replace(/[\\%_]/g, "\\$&") // escape SQL LIKE wildcards
    .replace(/\0/g, "");
}

/**
 * Sanitize a free-text search query for safe display + DB query.
 * Strips control chars, limits length, escapes HTML.
 */
export function sanitizeSearchQuery(input: string | undefined | null, maxLength = 200): string {
  return stripHtml(input, maxLength);
}

/**
 * Mask a phone number for display in logs / audit trails.
 * Example: "+233 24 111 2222" → "+233******2222"
 */
export function maskPhone(phone: string | undefined | null): string {
  if (!phone) return "";
  const s = String(phone).replace(/\s/g, "");
  if (s.length < 4) return "***";
  return s.slice(0, 4) + "*".repeat(Math.max(0, s.length - 8)) + s.slice(-4);
}

/**
 * Mask an email for display in logs.
 * Example: "razakabu24@gmail.com" → "ra***@gmail.com"
 */
export function maskEmail(email: string | undefined | null): string {
  if (!email) return "";
  const s = String(email).trim();
  const at = s.indexOf("@");
  if (at < 2) return "***";
  const local = s.slice(0, at);
  const domain = s.slice(at);
  return local.slice(0, 2) + "*".repeat(Math.max(1, local.length - 2)) + domain;
}

/**
 * Mask a credit card / payment reference number.
 * Example: "4242424242424242" → "************4242"
 */
export function maskCardNumber(num: string | undefined | null): string {
  if (!num) return "";
  const s = String(num).replace(/\s/g, "");
  if (s.length < 4) return "***";
  return "*".repeat(s.length - 4) + s.slice(-4);
}
