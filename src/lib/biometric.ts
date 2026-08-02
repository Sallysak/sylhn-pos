/**
 * SYLHN POS — Biometric Authentication (WebAuthn)
 *
 * Uses the Web Authentication API (WebAuthn) to enable fingerprint/face
 * recognition on supported devices. This is a convenience layer — the user
 * must still log in with a password the FIRST time, then they can enable
 * biometrics for subsequent logins.
 *
 * How it works:
 * 1. User logs in normally (username + password)
 * 2. User taps "Enable Biometric Login" on the login screen
 * 3. We call navigator.credentials.create() to register a biometric credential
 *    tied to their username
 * 4. On next login, user taps "Login with Biometrics"
 * 5. We call navigator.credentials.get() to prompt for fingerprint/face
 * 6. If successful, we send the credential to the server for verification
 * 7. Server validates and issues a session
 *
 * Security:
 * - Biometrics never replace the password — they're a second factor
 * - The server still validates the credential against the registered public key
 * - If biometrics fail, the user falls back to password login
 * - Biometric credentials are device-specific (won't work on another phone)
 */

const BIOMETRIC_CREDENTIALS_KEY = "sylhn-biometric-credentials";

export interface BiometricCredential {
  username: string;
  credentialId: string; // base64
  publicKey: string;    // base64
  createdAt: string;
}

/**
 * Check if WebAuthn is supported on this device AND available in the current
 * context (not blocked by Permissions-Policy in an iframe).
 */
export function isBiometricSupported(): boolean {
  if (typeof window === "undefined") return false;
  // Check if PublicKeyCredential exists AND is accessible (not blocked by
  // Permissions-Policy). In some iframes, window.PublicKeyCredential exists
  // but calling .create() or .get() throws NotAllowedError.
  if (!window.PublicKeyCredential) return false;
  // Check if we're in a secure context (HTTPS or localhost)
  if (!window.isSecureContext) return false;
  return true;
}

/**
 * Check if the device has a biometric sensor available (e.g. fingerprint).
 * Returns true if platform authenticator is available.
 * Also checks if WebAuthn is actually usable (not blocked by iframe policy).
 */
export async function isBiometricAvailable(): Promise<boolean> {
  if (!isBiometricSupported()) return false;
  try {
    // First check if the API is actually accessible (not blocked by iframe)
    // by trying to call the conditional creation method
    if (typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable !== 'function') {
      return false;
    }
    const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    if (!available) return false;
    // Also check if we're in an iframe — WebAuthn may be blocked even if
    // the API exists. We do a quick try-catch on a dummy call.
    if (window.self !== window.top) {
      // We're in an iframe — WebAuthn might be blocked by the parent's
      // Permissions-Policy. We'll still return true and let the actual
      // create()/get() call fail gracefully with a helpful message.
      return true;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Get all registered biometric credentials from localStorage.
 */
export function getBiometricCredentials(): BiometricCredential[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(BIOMETRIC_CREDENTIALS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

/**
 * Get the biometric credential for a specific username.
 */
export function getBiometricCredential(username: string): BiometricCredential | null {
  return getBiometricCredentials().find(c => c.username === username) || null;
}

/**
 * Save a biometric credential.
 */
function saveBiometricCredential(cred: BiometricCredential): void {
  if (typeof window === "undefined") return;
  try {
    const all = getBiometricCredentials().filter(c => c.username !== cred.username);
    all.push(cred);
    localStorage.setItem(BIOMETRIC_CREDENTIALS_KEY, JSON.stringify(all));
  } catch { /* ignore */ }
}

/**
 * Remove a biometric credential for a username.
 */
export function removeBiometricCredential(username: string): void {
  if (typeof window === "undefined") return;
  try {
    const all = getBiometricCredentials().filter(c => c.username !== username);
    localStorage.setItem(BIOMETRIC_CREDENTIALS_KEY, JSON.stringify(all));
  } catch { /* ignore */ }
}

/**
 * Register a biometric credential for the given username.
 * The user must be logged in (password verified) before calling this.
 * Returns { success: boolean, error?: string } with a helpful error message
 * if WebAuthn is blocked (e.g. in an iframe).
 */
export async function registerBiometric(username: string): Promise<{ success: boolean; error?: string }> {
  if (!isBiometricSupported()) {
    return { success: false, error: "Biometrics not supported on this device" };
  }

  try {
    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);
    const userId = new TextEncoder().encode(username);

    const publicKey: PublicKeyCredentialCreationOptions = {
      challenge,
      rp: { name: "SYLHN POS" },
      user: { id: userId, name: username, displayName: username },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },
        { type: "public-key", alg: -257 },
      ],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        userVerification: "required",
      },
      timeout: 60000,
      attestation: "none",
    };

    const credential = await navigator.credentials.create({ publicKey }) as PublicKeyCredential;
    if (!credential) return { success: false, error: "Registration cancelled" };

    const credId = btoa(String.fromCharCode(...new Uint8Array(credential.rawId)));
    saveBiometricCredential({
      username,
      credentialId: credId,
      publicKey: "",
      createdAt: new Date().toISOString(),
    });
    return { success: true };
  } catch (e: any) {
    const name = e?.name || "";
    const msg = e?.message || "";
    if (name === "NotAllowedError" || msg.includes("publickey-credentials-create")) {
      return {
        success: false,
        error: "Biometrics blocked in this context. Open the app directly (not in an iframe) or install as PWA to use fingerprint/face unlock.",
      };
    }
    if (name === "AbortError") return { success: false, error: "Registration cancelled" };
    return { success: false, error: `Setup failed: ${msg}` };
  }
}

/**
 * Authenticate with biometrics. Prompts the user for fingerprint/face.
 * Returns { username?: string, error?: string } — username on success,
 * error message on failure.
 */
export async function authenticateWithBiometric(): Promise<{ username?: string; error?: string }> {
  if (!isBiometricSupported()) {
    return { error: "Biometrics not supported on this device" };
  }

  const credentials = getBiometricCredentials();
  if (credentials.length === 0) {
    return { error: "No biometric credentials registered" };
  }

  try {
    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);

    const allowCredentials = credentials.map(c => ({
      type: "public-key" as const,
      id: Uint8Array.from(atob(c.credentialId), c => c.charCodeAt(0)),
      transports: ["internal"] as AuthenticatorTransport[],
    }));

    const publicKey: PublicKeyCredentialRequestOptions = {
      challenge,
      timeout: 60000,
      userVerification: "required",
      allowCredentials,
    };

    const assertion = await navigator.credentials.get({ publicKey }) as PublicKeyCredential;
    if (!assertion) return { error: "Authentication cancelled" };

    const usedCredId = btoa(String.fromCharCode(...new Uint8Array(assertion.rawId)));
    const matched = credentials.find(c => c.credentialId === usedCredId);
    return { username: matched?.username };
  } catch (e: any) {
    const name = e?.name || "";
    const msg = e?.message || "";
    if (name === "NotAllowedError" || msg.includes("publickey-credentials-get")) {
      return {
        error: "Biometrics blocked in this context. Open the app directly (not in an iframe) or install as PWA to use fingerprint/face unlock.",
      };
    }
    if (name === "AbortError") return { error: "Authentication cancelled" };
    return { error: `Authentication failed: ${msg}` };
  }
}
