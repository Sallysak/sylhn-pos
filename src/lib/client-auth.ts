/**
 * SYLHN POS — Client-side auth helper
 *
 * Stores the session token in localStorage as a fallback for when cookies
 * don't work (cross-origin iframe in preview environment).
 *
 * All API calls should use the `authedFetch` function which automatically
 * attaches the Bearer token header.
 */

const TOKEN_KEY = "sylhn-session-token";

export function saveSessionToken(token: string): void {
  try { localStorage.setItem(TOKEN_KEY, token); } catch {}
}

export function getSessionToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}

export function clearSessionToken(): void {
  try { localStorage.removeItem(TOKEN_KEY); } catch {}
}

/**
 * Fetch wrapper that automatically attaches:
 * - credentials: "include" (for cookies)
 * - Authorization: Bearer <token> (fallback when cookies don't work)
 * - X-CSRF-Token (from cookie, for CSRF protection)
 */
export async function authedFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getSessionToken();
  const csrfMatch = typeof document !== "undefined" ? document.cookie.match(/sylhn-csrf=([^;]+)/) : null;
  const csrfToken = csrfMatch ? decodeURIComponent(csrfMatch[1]) : "";

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const method = (options.method || "GET").toUpperCase();
  if (["POST", "PUT", "PATCH", "DELETE"].includes(method) && csrfToken) {
    headers["X-CSRF-Token"] = csrfToken;
  }

  // Timeout: 15 seconds for all requests. Prevents infinite hangs
  // when the server is slow or unresponsive (especially on Vercel
  // cold starts). The AbortController cancels the fetch after 15s.
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15_000);

  try {
    return await fetch(url, {
      ...options,
      headers,
      credentials: "include",
      signal: options.signal || controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}
