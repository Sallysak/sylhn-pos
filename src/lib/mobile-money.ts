/**
 * SYLHN POS — Unified Mobile Money Integration
 *
 * Supports all 3 Ghana mobile money networks via a single interface:
 *   - MTN MoMo (momodeveloper.mtn.com)
 *   - Telecel Cash (formerly Vodafone Cash)
 *   - AirtelTigo Money
 *
 * Each network has its own API credentials + base URL. The MTN integration
 * is fully implemented in src/lib/mtn-momo.ts. Telecel + AirtelTigo follow
 * the same Open API pattern (request-to-pay) but with different endpoints.
 *
 * Environment variables (set in .env):
 *   MTN_MOMO_API_USER, MTN_MOMO_API_KEY, MTN_MOMO_SUBSCRIPTION_KEY, MTN_MOMO_ENVIRONMENT
 *   TELECEL_API_USER, TELECEL_API_KEY, TELECEL_SUBSCRIPTION_KEY, TELECEL_ENVIRONMENT
 *   AIRTELTIGO_API_USER, AIRTELTIGO_API_KEY, AIRTELTIGO_SUBSCRIPTION_KEY, AIRTELTIGO_ENVIRONMENT
 */

export type MoMoNetwork = "mtn" | "telecel" | "airteltigo";

export interface MoMoPaymentParams {
  network: MoMoNetwork;
  phoneNumber: string;    // 233XXXXXXXXX
  amount: number;
  externalId: string;     // invoice number
  payerMessage: string;
  payeeNote: string;
  callbackUrl: string;
}

export interface MoMoPaymentResult {
  referenceId: string;
  status: "pending" | "approved" | "rejected" | "failed" | "ongoing";
  network: MoMoNetwork;
}

export interface MoMoStatusResult {
  status: "pending" | "approved" | "rejected" | "failed" | "ongoing";
  amount?: number;
  financialTransactionId?: string;
  reason?: string;
}

/**
 * Initiate a mobile money payment across any network.
 * Delegates to the network-specific implementation.
 */
export async function initiateMoMoPayment(params: MoMoPaymentParams): Promise<MoMoPaymentResult> {
  switch (params.network) {
    case "mtn":
      return initiateMTN(params);
    case "telecel":
      return initiateTelecel(params);
    case "airteltigo":
      return initiateAirtelTigo(params);
    default:
      throw new Error(`Unsupported network: ${params.network}`);
  }
}

/**
 * Check the status of a mobile money payment.
 */
export async function getMoMoStatus(network: MoMoNetwork, referenceId: string): Promise<MoMoStatusResult> {
  switch (network) {
    case "mtn": {
      const { getMomoPaymentStatus } = await import("./mtn-momo");
      const result = await getMomoPaymentStatus(referenceId);
      return result;
    }
    case "telecel":
      return getTelecelStatus(referenceId);
    case "airteltigo":
      return getAirtelTigoStatus(referenceId);
    default:
      throw new Error(`Unsupported network: ${network}`);
  }
}

// ===== MTN MoMo (delegates to existing mtn-momo.ts) =====
async function initiateMTN(params: MoMoPaymentParams): Promise<MoMoPaymentResult> {
  const { initiateMomoPayment } = await import("./mtn-momo");
  const result = await initiateMomoPayment({
    phoneNumber: params.phoneNumber,
    amount: params.amount,
    externalId: params.externalId,
    payerMessage: params.payerMessage,
    payeeNote: params.payeeNote,
    callbackUrl: params.callbackUrl,
  });
  return { ...result, network: "mtn" as const };
}

// ===== Telecel Cash =====
// Telecel Cash (formerly Vodafone Cash) uses a similar Open API to MTN.
// Docs: https://developers.telecel.com (or via hubtel/expressPay intermediaries)
const TELECEL_BASE = {
  sandbox: "https://sandbox.api.telecel.com",
  production: "https://api.telecel.com",
};

async function initiateTelecel(params: MoMoPaymentParams): Promise<MoMoPaymentResult> {
  const apiUser = process.env.TELECEL_API_USER;
  const apiKey = process.env.TELECEL_API_KEY;
  const subscriptionKey = process.env.TELECEL_SUBSCRIPTION_KEY;

  if (!apiUser || !apiKey || !subscriptionKey) {
    throw new Error("Telecel Cash credentials not configured. Set TELECEL_API_USER, TELECEL_API_KEY, TELECEL_SUBSCRIPTION_KEY in .env");
  }

  const env = process.env.TELECEL_ENVIRONMENT === "production" ? "production" : "sandbox";
  const base = TELECEL_BASE[env];
  const referenceId = crypto.randomUUID();
  const auth = Buffer.from(`${apiUser}:${apiKey}`).toString("base64");

  // Get access token
  const tokenRes = await fetch(`${base}/collection/token/`, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${auth}`,
      "Ocp-Apim-Subscription-Key": subscriptionKey,
    },
  });
  if (!tokenRes.ok) throw new Error(`Telecel token failed: ${tokenRes.status}`);
  const tokenData = await tokenRes.json() as { access_token: string };

  // Request to pay
  const res = await fetch(`${base}/collection/v1_0/requesttopay`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${tokenData.access_token}`,
      "X-Reference-Id": referenceId,
      "X-Target-Environment": env,
      "Ocp-Apim-Subscription-Key": subscriptionKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: Math.round(params.amount * 100) / 100,
      currency: "GHS",
      externalId: params.externalId,
      payer: { partyIdType: "MSISDN", partyId: params.phoneNumber },
      payerMessage: params.payerMessage,
      payeeNote: params.payeeNote,
    }),
  });

  if (res.status !== 202) {
    const body = await res.text();
    throw new Error(`Telecel request-to-pay failed: ${res.status} ${body}`);
  }

  return { referenceId, status: "pending", network: "telecel" };
}

async function getTelecelStatus(referenceId: string): Promise<MoMoStatusResult> {
  const subscriptionKey = process.env.TELECEL_SUBSCRIPTION_KEY;
  const apiUser = process.env.TELECEL_API_USER;
  const apiKey = process.env.TELECEL_API_KEY;
  if (!subscriptionKey || !apiUser || !apiKey) {
    return { status: "failed", reason: "Telecel not configured" };
  }

  const env = process.env.TELECEL_ENVIRONMENT === "production" ? "production" : "sandbox";
  const base = TELECEL_BASE[env];
  const auth = Buffer.from(`${apiUser}:${apiKey}`).toString("base64");

  const tokenRes = await fetch(`${base}/collection/token/`, {
    method: "POST",
    headers: { "Authorization": `Basic ${auth}`, "Ocp-Apim-Subscription-Key": subscriptionKey },
  });
  if (!tokenRes.ok) return { status: "failed", reason: "Token failed" };
  const { access_token } = await tokenRes.json() as { access_token: string };

  const res = await fetch(`${base}/collection/v1_0/requesttopay/${referenceId}`, {
    headers: {
      "Authorization": `Bearer ${access_token}`,
      "X-Target-Environment": env,
      "Ocp-Apim-Subscription-Key": subscriptionKey,
    },
  });

  if (!res.ok) return { status: "failed", reason: `HTTP ${res.status}` };
  return await res.json() as MoMoStatusResult;
}

// ===== AirtelTigo Money =====
// AirtelTigo Money uses a similar API. Docs via hubtel or direct API.
const AIRTELTIGO_BASE = {
  sandbox: "https://sandbox.api.airteltigo.com",
  production: "https://api.airteltigo.com",
};

async function initiateAirtelTigo(params: MoMoPaymentParams): Promise<MoMoPaymentResult> {
  const apiUser = process.env.AIRTELTIGO_API_USER;
  const apiKey = process.env.AIRTELTIGO_API_KEY;
  const subscriptionKey = process.env.AIRTELTIGO_SUBSCRIPTION_KEY;

  if (!apiUser || !apiKey || !subscriptionKey) {
    throw new Error("AirtelTigo credentials not configured. Set AIRTELTIGO_API_USER, AIRTELTIGO_API_KEY, AIRTELTIGO_SUBSCRIPTION_KEY in .env");
  }

  const env = process.env.AIRTELTIGO_ENVIRONMENT === "production" ? "production" : "sandbox";
  const base = AIRTELTIGO_BASE[env];
  const referenceId = crypto.randomUUID();
  const auth = Buffer.from(`${apiUser}:${apiKey}`).toString("base64");

  const tokenRes = await fetch(`${base}/collection/token/`, {
    method: "POST",
    headers: { "Authorization": `Basic ${auth}`, "Ocp-Apim-Subscription-Key": subscriptionKey },
  });
  if (!tokenRes.ok) throw new Error(`AirtelTigo token failed: ${tokenRes.status}`);
  const tokenData = await tokenRes.json() as { access_token: string };

  const res = await fetch(`${base}/collection/v1_0/requesttopay`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${tokenData.access_token}`,
      "X-Reference-Id": referenceId,
      "X-Target-Environment": env,
      "Ocp-Apim-Subscription-Key": subscriptionKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: Math.round(params.amount * 100) / 100,
      currency: "GHS",
      externalId: params.externalId,
      payer: { partyIdType: "MSISDN", partyId: params.phoneNumber },
      payerMessage: params.payerMessage,
      payeeNote: params.payeeNote,
    }),
  });

  if (res.status !== 202) {
    const body = await res.text();
    throw new Error(`AirtelTigo request-to-pay failed: ${res.status} ${body}`);
  }

  return { referenceId, status: "pending", network: "airteltigo" };
}

async function getAirtelTigoStatus(referenceId: string): Promise<MoMoStatusResult> {
  const subscriptionKey = process.env.AIRTELTIGO_SUBSCRIPTION_KEY;
  const apiUser = process.env.AIRTELTIGO_API_USER;
  const apiKey = process.env.AIRTELTIGO_API_KEY;
  if (!subscriptionKey || !apiUser || !apiKey) {
    return { status: "failed", reason: "AirtelTigo not configured" };
  }

  const env = process.env.AIRTELTIGO_ENVIRONMENT === "production" ? "production" : "sandbox";
  const base = AIRTELTIGO_BASE[env];
  const auth = Buffer.from(`${apiUser}:${apiKey}`).toString("base64");

  const tokenRes = await fetch(`${base}/collection/token/`, {
    method: "POST",
    headers: { "Authorization": `Basic ${auth}`, "Ocp-Apim-Subscription-Key": subscriptionKey },
  });
  if (!tokenRes.ok) return { status: "failed", reason: "Token failed" };
  const { access_token } = await tokenRes.json() as { access_token: string };

  const res = await fetch(`${base}/collection/v1_0/requesttopay/${referenceId}`, {
    headers: {
      "Authorization": `Bearer ${access_token}`,
      "X-Target-Environment": env,
      "Ocp-Apim-Subscription-Key": subscriptionKey,
    },
  });

  if (!res.ok) return { status: "failed", reason: `HTTP ${res.status}` };
  return await res.json() as MoMoStatusResult;
}

/**
 * Detect the mobile money network from a Ghana phone number.
 * MTN: 024, 054, 055, 059, 053
 * Telecel: 020, 050
 * AirtelTigo: 026, 027, 056, 057
 */
export function detectNetwork(phoneNumber: string): MoMoNetwork {
  const phone = phoneNumber.replace(/[\s+()-]/g, "");
  // Convert 0XXXXXXXXX to 233XXXXXXXXX
  const normalized = phone.startsWith("233") ? phone.slice(3) : phone.startsWith("0") ? phone.slice(1) : phone;

  if (/^(24|54|55|59|53)/.test(normalized)) return "mtn";
  if (/^(20|50)/.test(normalized)) return "telecel";
  if (/^(26|27|56|57)/.test(normalized)) return "airteltigo";

  // Default to MTN (most common in Ghana)
  return "mtn";
}

/**
 * Check which networks are configured (have env vars set).
 */
export function getConfiguredNetworks(): MoMoNetwork[] {
  const networks: MoMoNetwork[] = [];
  if (process.env.MTN_MOMO_API_USER && process.env.MTN_MOMO_API_KEY) networks.push("mtn");
  if (process.env.TELECEL_API_USER && process.env.TELECEL_API_KEY) networks.push("telecel");
  if (process.env.AIRTELTIGO_API_USER && process.env.AIRTELTIGO_API_KEY) networks.push("airteltigo");
  return networks;
}
