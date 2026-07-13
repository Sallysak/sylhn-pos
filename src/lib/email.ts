/**
 * SYLHN POS — Email utilities
 *
 * Helpers for composing receipt/order emails and sending them via the
 * /api/email server route (SMTP) or via mailto: as a fallback.
 */

export interface EmailAttachment {
  filename: string;
  content: string; // base64
  contentType: string;
}

export interface EmailMessage {
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  body: string;
  html?: string;
  attachments?: EmailAttachment[];
}

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  fromName: string;
  fromEmail: string;
}

const SMTP_KEY = "sylhn-smtp-config";
const EMAIL_HISTORY_KEY = "sylhn-email-history";

// ===== SMTP config persistence =====
export function getSmtpConfig(): SmtpConfig | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SMTP_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function setSmtpConfig(config: SmtpConfig): void {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(SMTP_KEY, JSON.stringify(config)); } catch { /* ignore */ }
}

export function clearSmtpConfig(): void {
  if (typeof window === "undefined") return;
  try { localStorage.removeItem(SMTP_KEY); } catch { /* ignore */ }
}

// ===== Email history =====
export interface EmailHistoryEntry {
  id: string;
  timestamp: string;
  to: string;
  subject: string;
  body: string;
  status: "sent" | "failed" | "draft";
  error?: string;
}

export function getEmailHistory(): EmailHistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(EMAIL_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function addEmailHistory(entry: Omit<EmailHistoryEntry, "id" | "timestamp">): void {
  if (typeof window === "undefined") return;
  try {
    const history = getEmailHistory();
    history.unshift({
      ...entry,
      id: `email-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
    });
    localStorage.setItem(EMAIL_HISTORY_KEY, JSON.stringify(history.slice(0, 200)));
  } catch { /* ignore */ }
}

export function clearEmailHistory(): void {
  if (typeof window === "undefined") return;
  try { localStorage.removeItem(EMAIL_HISTORY_KEY); } catch { /* ignore */ }
}

// ===== Send via server API =====
export async function sendEmail(message: EmailMessage): Promise<{ success: boolean; message: string }> {
  try {
    const config = getSmtpConfig();
    if (!config) {
      // Fallback: open mailto:
      openMailto(message);
      addEmailHistory({ ...message, status: "draft" });
      return { success: true, message: "Opened in email client (SMTP not configured)" };
    }
    const res = await fetch("/api/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...message, smtp: config }),
    });
    const data = await res.json();
    if (data.success) {
      addEmailHistory({ ...message, status: "sent" });
      return { success: true, message: "Email sent" };
    } else {
      addEmailHistory({ ...message, status: "failed", error: data.error });
      return { success: false, message: data.error || "Failed to send email" };
    }
  } catch (e) {
    addEmailHistory({ ...message, status: "failed", error: (e as Error).message });
    return { success: false, message: `Email error: ${(e as Error).message}` };
  }
}

// ===== mailto: fallback =====
export function openMailto(message: EmailMessage): void {
  if (typeof window === "undefined") return;
  const subject = encodeURIComponent(message.subject);
  const body = encodeURIComponent(message.body);
  const params = `?subject=${subject}&body=${body}${message.cc ? `&cc=${encodeURIComponent(message.cc)}` : ""}`;
  window.location.href = `mailto:${message.to}${params}`;
}

// ===== Receipt email composer =====
export function generateReceiptEmail(opts: {
  invoiceNumber: string;
  customerName: string;
  cashierName: string;
  items: { sku: string; name: string; quantity: number; price: number; total: number }[];
  subtotal: number;
  discount: number;
  taxAmount: number;
  total: number;
  amountPaid: number;
  change: number;
  paymentMethod: string;
  date: string;
  company: { name: string; address: string; contact: string };
}): EmailMessage {
  const { company, items, ...rest } = opts;
  const itemRows = items
    .map(i => `  ${i.quantity} × ${i.name} @ ${i.price.toFixed(2)} = ${i.total.toFixed(2)}`)
    .join("\n");

  const body = [
    `${company.name}`,
    `${company.address}`,
    `Tel: ${company.contact}`,
    "",
    `Receipt: ${rest.invoiceNumber}`,
    `Date: ${rest.date}`,
    `Cashier: ${rest.cashierName}`,
    `Customer: ${rest.customerName || "Walk-in"}`,
    "",
    "----------------------------------------",
    itemRows,
    "----------------------------------------",
    `Subtotal:    ${rest.subtotal.toFixed(2)}`,
    `Discount:   -${rest.discount.toFixed(2)}`,
    `Tax:         ${rest.taxAmount.toFixed(2)}`,
    `TOTAL:       ${rest.total.toFixed(2)}`,
    "",
    `Paid (${rest.paymentMethod}): ${rest.amountPaid.toFixed(2)}`,
    `Change:      ${rest.change.toFixed(2)}`,
    "",
    "Thank you for shopping with us!",
  ].join("\n");

  return {
    to: "", // caller fills in
    subject: `Receipt ${rest.invoiceNumber} — ${company.name}`,
    body,
  };
}

// ===== Supplier order email composer =====
export function generatePurchaseOrderEmail(opts: {
  refNo: string;
  supplierName: string;
  supplierEmail: string;
  items: { partNo: string; details: string; quantity: number; cost: number; total: number }[];
  subtotal: number;
  taxAmount: number;
  total: number;
  expectedDate?: string;
  notes?: string;
  company: { name: string; address: string; contact: string };
}): EmailMessage {
  const { company, items, ...rest } = opts;
  const itemRows = items
    .map(i => `  ${i.quantity} × ${i.partNo} ${i.details} @ ${i.cost.toFixed(2)} = ${i.total.toFixed(2)}`)
    .join("\n");

  const body = [
    `Dear ${rest.supplierName},`,
    "",
    `Please find below our purchase order ${rest.refNo}.`,
    "",
    `${company.name}`,
    `${company.address}`,
    `Tel: ${company.contact}`,
    "",
    "----------------------------------------",
    `PO Number: ${rest.refNo}`,
    rest.expectedDate ? `Expected Delivery: ${rest.expectedDate}` : "",
    "----------------------------------------",
    itemRows,
    "----------------------------------------",
    `Subtotal: ${rest.subtotal.toFixed(2)}`,
    `Tax:      ${rest.taxAmount.toFixed(2)}`,
    `TOTAL:    ${rest.total.toFixed(2)}`,
    "",
    rest.notes ? `Notes: ${rest.notes}` : "",
    "",
    "Please confirm receipt of this order.",
    "",
    `Best regards,`,
    company.name,
  ].filter(Boolean).join("\n");

  return {
    to: rest.supplierEmail,
    subject: `Purchase Order ${rest.refNo} — ${company.name}`,
    body,
  };
}
