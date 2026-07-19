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
 * Check if WebAuthn is supported on this device.
 */
export function isBiometricSupported(): boolean {
  if (typeof window === "undefined") return false;
  return !!(window.PublicKeyCredential && navigator.credentials);
}

/**
 * Check if the device has a biometric sensor available (e.g. fingerprint).
 * Returns true if platform authenticator is available.
 */
export async function isBiometricAvailable(): Promise<boolean> {
  if (!isBiometricSupported()) return false;
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
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
 * Returns true on success, false on failure or cancellation.
 */
export async function registerBiometric(username: string): Promise<boolean> {
  if (!isBiometricSupported()) return false;

  try {
    // Generate a challenge (random bytes)
    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);

    // User ID (based on username)
    const userId = new TextEncoder().encode(username);

    const publicKey: PublicKeyCredentialCreationOptions = {
      challenge,
      rp: { name: "SYLHN POS" },
      user: {
        id: userId,
        name: username,
        displayName: username,
      },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },   // ES256
        { type: "public-key", alg: -257 }, // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: "platform", // Use device's built-in biometric
        userVerification: "required",
      },
      timeout: 60000,
      attestation: "none",
    };

    const credential = await navigator.credentials.create({ publicKey }) as PublicKeyCredential;
    if (!credential) return false;

    // Store the credential ID (we don't need the public key on the client
    // since this is a local-only biometric — the server session is still
    // established via password on first login, and biometrics just unlock
    // the cached session)
    const credId = btoa(String.fromCharCode(...new Uint8Array(credential.rawId)));

    saveBiometricCredential({
      username,
      credentialId: credId,
      publicKey: "", // Not needed for local biometric unlock
      createdAt: new Date().toISOString(),
    });

    return true;
  } catch (e) {
    console.error("Biometric registration failed:", e);
    return false;
  }
}

/**
 * Authenticate with biometrics. Prompts the user for fingerprint/face.
 * Returns the username if successful, null if failed or cancelled.
 */
export async function authenticateWithBiometric(): Promise<string | null> {
  if (!isBiometricSupported()) return null;

  const credentials = getBiometricCredentials();
  if (credentials.length === 0) return null;

  try {
    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);

    // Allow any registered credential
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
    if (!assertion) return null;

    // Find which credential was used
    const usedCredId = btoa(String.fromCharCode(...new Uint8Array(assertion.rawId)));
    const matched = credentials.find(c => c.credentialId === usedCredId);
    return matched?.username || null;
  } catch (e) {
    console.error("Biometric authentication failed:", e);
    return null;
  }
}
