/**
 * SYLHN POS — MTN MoMo (Mobile Money) integration
 *
 * Supports the MTN MoMo Open API (Collection / Disbursement).
 * Docs: https://momodeveloper.mtn.com/
 *
 * Environment variables (set in .env):
 *   MTN_MOMO_API_USER         — API user UUID (created via /v1_0/apiuser)
 *   MTN_MOMO_API_KEY          — API key for the API user
 *   MTN_MOMO_SUBSCRIPTION_KEY — Ocp-Apim-Subscription-Key (primary key from MTN portal)
 *   MTN_MOMO_ENVIRONMENT      — "sandbox" | "production"
 *
 * Flow:
 *   1. Customer selects "MoMo" at checkout, enters phone number
 *   2. POS calls /api/payments/momo/initiate → MTN requests payment from customer
 *   3. Customer approves on their phone
 *   4. MTN calls our /api/payments/momo/callback webhook
 *   5. We mark the sale as paid
 *
 * To go live:
 *   1. Register at https://momodeveloper.mtn.com/
 *   2. Subscribe to the "Collection" product
 *   3. Create an API user in the sandbox
 *   4. Set the env vars above
 *   5. Test in sandbox, then request production access
 */

const SANDBOX_BASE = "https://sandbox.momodeveloper.mtn.com";
const PROD_BASE = "https://momodeveloper.mtn.com";

function getBaseUrl(): string {
  return process.env.MTN_MOMO_ENVIRONMENT === "production" ? PROD_BASE : SANDBOX_BASE;
}

function getCredentials() {
  const apiUser = process.env.MTN_MOMO_API_USER;
  const apiKey = process.env.MTN_MOMO_API_KEY;
  const subscriptionKey = process.env.MTN_MOMO_SUBSCRIPTION_KEY;
  if (!apiUser || !apiKey || !subscriptionKey) {
    throw new Error("MTN MoMo credentials not configured. Set MTN_MOMO_API_USER, MTN_MOMO_API_KEY, MTN_MOMO_SUBSCRIPTION_KEY in .env");
  }
  return { apiUser, apiKey, subscriptionKey };
}

// Cache the access token (it's valid for 1 hour)
let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  // Refresh 5 minutes before expiry
  if (cachedToken && cachedToken.expiresAt > Date.now() + 5 * 60 * 1000) {
    return cachedToken.value;
  }

  const { apiUser, apiKey, subscriptionKey } = getCredentials();
  const base = getBaseUrl();
  const auth = Buffer.from(`${apiUser}:${apiKey}`).toString("base64");

  const res = await fetch(`${base}/collection/token/`, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${auth}`,
      "Ocp-Apim-Subscription-Key": subscriptionKey,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`MTN MoMo token request failed: ${res.status} ${body}`);
  }

  const data = await res.json() as { access_token: string; expires_in: number };
  cachedToken = {
    value: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return data.access_token;
}

export interface InitiateMomoPaymentParams {
  /** Customer phone number in format 233XXXXXXXXX (no leading +) */
  phoneNumber: string;
  /** Amount in GHS (float) */
  amount: number;
  /** External ID — usually the sale invoice number */
  externalId: string;
  /** Reference shown to the customer on their phone */
  payerMessage: string;
  /** Reference shown to the merchant */
  payeeNote: string;
  /** Callback URL for MTN to notify us of payment status */
  callbackUrl: string;
}

export interface InitiateMomoPaymentResult {
  /** MTN's reference ID for this payment request */
  referenceId: string;
  status: "pending" | "approved" | "rejected" | "failed" | "ongoing";
}

/**
 * Initiate a mobile money payment request.
 * The customer will receive a prompt on their phone to approve the payment.
 */
export async function initiateMomoPayment(params: InitiateMomoPaymentParams): Promise<InitiateMomoPaymentResult> {
  const token = await getAccessToken();
  const { subscriptionKey } = getCredentials();
  const base = getBaseUrl();

  // Generate a UUID for the reference ID (used to poll status later)
  const referenceId = crypto.randomUUID();

  // Validate phone number format
  const phone = params.phoneNumber.replace(/[\s+()-]/g, "");
  if (!/^233\d{9}$/.test(phone)) {
    throw new Error("Invalid phone number. Use format 233XXXXXXXXX (e.g. 233241234567)");
  }

  // Validate amount
  if (params.amount <= 0 || params.amount > 100_000) {
    throw new Error("Amount must be between 0.01 and 100,000 GHS");
  }

  const res = await fetch(`${base}/collection/v1_0/requesttopay`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "X-Reference-Id": referenceId,
      "X-Target-Environment": process.env.MTN_MOMO_ENVIRONMENT === "production" ? "production" : "sandbox",
      "Ocp-Apim-Subscription-Key": subscriptionKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: Math.round(params.amount * 100) / 100,  // 2 decimal places
      currency: "GHS",
      externalId: params.externalId,
      payer: {
        partyIdType: "MSISDN",
        partyId: phone,
      },
      payerMessage: params.payerMessage,
      payeeNote: params.payeeNote,
    }),
  });

  // 202 = request accepted, payment is pending customer approval
  if (res.status !== 202) {
    const body = await res.text();
    throw new Error(`MTN MoMo request-to-pay failed: ${res.status} ${body}`);
  }

  return {
    referenceId,
    status: "pending",
  };
}

export interface MomoPaymentStatus {
  status: "pending" | "approved" | "rejected" | "failed" | "ongoing";
  amount?: number;
  currency?: string;
  financialTransactionId?: string;
  reason?: string;
}

/**
 * Check the status of a mobile money payment request.
 * Used for polling when the webhook hasn't fired yet.
 */
export async function getMomoPaymentStatus(referenceId: string): Promise<MomoPaymentStatus> {
  const token = await getAccessToken();
  const { subscriptionKey } = getCredentials();
  const base = getBaseUrl();

  const res = await fetch(`${base}/collection/v1_0/requesttopay/${referenceId}`, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${token}`,
      "X-Target-Environment": process.env.MTN_MOMO_ENVIRONMENT === "production" ? "production" : "sandbox",
      "Ocp-Apim-Subscription-Key": subscriptionKey,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`MTN MoMo status check failed: ${res.status} ${body}`);
  }

  const data = await res.json() as MomoPaymentStatus;
  return data;
}

/**
 * Verify webhook callback signature (defensive — MTN doesn't sign callbacks,
 * but we should at least validate the source IP in production).
 *
 * In production, configure your reverse proxy to only allow MTN's IPs to reach
 * /api/payments/momo/callback.
 */
export function verifyMomoCallback(req: Request): boolean {
  // TODO: in production, check that the request comes from MTN's IP range.
  // For now, we trust the callback URL is only reachable by MTN (network-level).
  return true;
}
