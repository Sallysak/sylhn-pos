/**
 * SYLHN POS — Client-side secure fetch wrapper
 *
 * - Automatically attaches the CSRF token header for write methods.
 * - Includes credentials (cookies) on every request.
 * - On 401, dispatches a global event so the UI can redirect to login.
 */

const CSRF_HEADER = "X-CSRF-Token";
const CSRF_COOKIE = "sylhn-csrf";

function getCsrfToken(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${CSRF_COOKIE}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function isWriteMethod(method: string): boolean {
  return ["POST", "PUT", "PATCH", "DELETE"].includes(method.toUpperCase());
}

export interface SecureFetchOptions extends RequestInit {
  /** Skip CSRF check (for /api/auth/login which is exempt) */
  skipCsrf?: boolean;
}

export async function secureFetch(url: string, opts: SecureFetchOptions = {}): Promise<Response> {
  const { skipCsrf = false, headers: customHeaders, ...rest } = opts;
  const headers = new Headers(customHeaders || {});

  // Attach CSRF token for write methods
  if (isWriteMethod(opts.method || "GET") && !skipCsrf) {
    const token = getCsrfToken();
    if (!token) {
      // Try to fetch a token first
      await fetch("/api/auth/csrf", { credentials: "include" });
      const retryToken = getCsrfToken();
      if (retryToken) headers.set(CSRF_HEADER, retryToken);
    } else {
      headers.set(CSRF_HEADER, token);
    }
  }

  const res = await fetch(url, {
    ...rest,
    headers,
    credentials: "include",
  });

  // Handle 401 globally
  if (res.status === 401 && typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("sylhn:unauthorized"));
  }

  return res;
}

/** Convenience JSON helper. */
export async function secureJson<T = any>(url: string, opts: SecureFetchOptions = {}): Promise<T> {
  const res = await secureFetch(url, opts);
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const data = await res.json();
      msg = data.error || msg;
    } catch { /* ignore */ }
    throw new Error(msg);
  }
  return res.json();
}
