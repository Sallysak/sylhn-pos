/**
 * SYLHN POS — Paystack Card Payment Integration
 *
 * Paystack is the leading payment gateway in Ghana/Nigeria.
 * Supports Visa, Mastercard, Verve, and mobile money via a single API.
 *
 * Docs: https://paystack.com/docs/api/
 *
 * Environment variables:
 *   PAYSTACK_SECRET_KEY — your secret key (sk_test_... or sk_live_...)
 *   PAYSTACK_PUBLIC_KEY — your public key (pk_test_... or pk_live_...)
 *   PAYSTACK_ENVIRONMENT — "test" | "live"
 *
 * Flow:
 *   1. POS calls /api/payments/card/initiate → Paystack initializes a transaction
 *   2. Paystack returns an authorization URL
 *   3. Customer enters card details on Paystack's secure page
 *   4. Paystack redirects back to the POS with a reference
 *   5. POS calls /api/payments/card/verify → confirms payment
 */

const PAYSTACK_BASE = "https://api.paystack.co";

export interface PaystackInitParams {
  email: string;          // customer email (required by Paystack)
  amount: number;         // in GHS
  reference: string;      // our invoice number
  callbackUrl: string;    // where Paystack redirects after payment
  metadata?: Record<string, any>;
}

export interface PaystackInitResult {
  authorizationUrl: string;  // redirect customer here
  accessCode: string;
  reference: string;
}

export interface PaystackVerifyResult {
  status: boolean;
  reference: string;
  amount: number;          // in kobo (divide by 100 for GHS)
  currency: string;
  gatewayResponse: string;
  channel: string;         // "card" | "mobile_money" | "bank_transfer"
  customerEmail: string;
}

/**
 * Initialize a Paystack transaction.
 * Returns an authorization URL the customer must visit to enter card details.
 */
export async function initializePaystackTransaction(params: PaystackInitParams): Promise<PaystackInitResult> {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    throw new Error("Paystack not configured. Set PAYSTACK_SECRET_KEY in .env");
  }

  const res = await fetch(`${PAYSTACK_BASE}/transaction/initialize`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: params.email,
      amount: Math.round(params.amount * 100), // Paystack uses kobo (1 GHS = 100 kobo)
      currency: "GHS",
      reference: params.reference,
      callback_url: params.callbackUrl,
      metadata: params.metadata,
    }),
  });

  const data = await res.json();
  if (!data.status) {
    throw new Error(data.message || "Paystack initialization failed");
  }

  return {
    authorizationUrl: data.data.authorization_url,
    accessCode: data.data.access_code,
    reference: data.data.reference,
  };
}

/**
 * Verify a Paystack transaction after the customer returns from the payment page.
 */
export async function verifyPaystackTransaction(reference: string): Promise<PaystackVerifyResult> {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    throw new Error("Paystack not configured. Set PAYSTACK_SECRET_KEY in .env");
  }

  const res = await fetch(`${PAYSTACK_BASE}/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { "Authorization": `Bearer ${secretKey}` },
  });

  const data = await res.json();
  if (!data.status) {
    return {
      status: false,
      reference,
      amount: 0,
      currency: "GHS",
      gatewayResponse: data.message || "Verification failed",
      channel: "unknown",
      customerEmail: "",
    };
  }

  return {
    status: data.data.status === "success",
    reference: data.data.reference,
    amount: data.data.amount / 100, // convert kobo to GHS
    currency: data.data.currency,
    gatewayResponse: data.data.gateway_response,
    channel: data.data.channel,
    customerEmail: data.data.customer?.email || "",
  };
}

/**
 * Check if Paystack is configured.
 */
export function isPaystackConfigured(): boolean {
  return !!process.env.PAYSTACK_SECRET_KEY;
}
