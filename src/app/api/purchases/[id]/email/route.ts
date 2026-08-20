import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requirePermission } from "@/lib/auth";
import { rateLimitApiWrite, rateLimitResponse, getClientIp } from "@/lib/rate-limit";
import { auditLog } from "@/lib/audit";
import { sendEmail, generatePurchaseOrderEmail, openMailto, getSmtpConfig } from "@/lib/email";
import { COMPANY } from "@/lib/pos-data";

// POST /api/purchases/[id]/email
// Body: { to?: string, cc?: string, subject?: string, message?: string }
//
// Sends the purchase order to the supplier via SMTP (if configured) or
// returns a mailto: link the client can open. Always returns 200 with the
// chosen delivery method so the UI can show the right toast.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let user;
  try { user = await requireAuth(); requirePermission(user.role, "purchase"); } catch (e: any) { return e as Response; }

  const ip = getClientIp(req);
  const rl = rateLimitApiWrite(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  const { id } = await params;

  // Look up the purchase (allow lookup by id OR refNo)
  let purchase = await db.purchase.findUnique({
    where: { id },
    include: { items: true, supplier: true },
  });
  if (!purchase) {
    purchase = await db.purchase.findUnique({
      where: { refNo: id },
      include: { items: true, supplier: true },
    });
  }
  if (!purchase) {
    return NextResponse.json({ error: "Purchase not found" }, { status: 404 });
  }

  let body: any;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const supplierEmail = body.to || purchase.supplier?.email || "";
  if (!supplierEmail || !/.+@.+\..+/.test(supplierEmail)) {
    return NextResponse.json(
      { error: "Supplier has no valid email address. Add one in the supplier master file, or provide one in the dialog." },
      { status: 400 }
    );
  }

  // Build the email message using the existing helper
  const emailMessage = generatePurchaseOrderEmail({
    refNo: purchase.refNo,
    supplierName: purchase.supplier?.name || purchase.supplierName,
    supplierEmail,
    items: purchase.items.map(i => ({
      partNo: i.partNo || "",
      details: i.details || "",
      quantity: Number(i.quantity),
      cost: Number(i.cost),
      total: Number(i.total),
    })),
    subtotal: Number(purchase.subtotal),
    taxAmount: Number(purchase.taxAmount),
    total: Number(purchase.total),
    expectedDate: purchase.expectedAt ? new Date(purchase.expectedAt).toLocaleDateString("en-GB") : undefined,
    notes: purchase.notes || body.message || "",
    company: {
      name: COMPANY.name,
      address: COMPANY.address,
      contact: COMPANY.contact,
    },
  });

  // Override subject/message if user provided custom ones
  if (body.subject) emailMessage.subject = String(body.subject);
  if (body.cc) emailMessage.cc = String(body.cc);
  if (body.message) {
    emailMessage.body = `${body.message}\n\n${emailMessage.body}`;
    if (emailMessage.html) {
      emailMessage.html = `<p>${String(body.message).replace(/\n/g, "<br>")}</p>${emailMessage.html}`;
    }
  }

  // Try SMTP send first; if not configured, fall back to mailto: link
  const smtpConfig = getSmtpConfig();
  let delivery: "smtp" | "mailto" = "smtp";
  let sendResult: { success: boolean; message: string } | null = null;

  if (smtpConfig) {
    try {
      sendResult = await sendEmail(emailMessage);
      if (!sendResult.success) {
        // SMTP failed — fall back to mailto
        delivery = "mailto";
      }
    } catch (e: any) {
      sendResult = { success: false, message: e?.message || "SMTP send failed" };
      delivery = "mailto";
    }
  } else {
    // No SMTP configured — use mailto
    delivery = "mailto";
  }

  if (delivery === "mailto") {
    openMailto(emailMessage);
  }

  auditLog({
    userId: user.uid,
    user: user.username,
    action: "EMAIL",
    module: "purchase",
    details: `${delivery === "smtp" ? "Emailed" : "Opened mailto for"} PO ${purchase.refNo} to ${supplierEmail}${body.cc ? ` (cc: ${body.cc})` : ""}`,
    severity: "info",
    ipAddress: ip,
    userAgent: req.headers.get("user-agent") || "",
  }).catch(() => {});

  return NextResponse.json({
    success: true,
    delivery,
    to: supplierEmail,
    cc: body.cc || "",
    subject: emailMessage.subject,
    smtpConfigured: !!smtpConfig,
    smtpResult: sendResult,
    mailtoUrl: delivery === "mailto" ? `mailto:${encodeURIComponent(supplierEmail)}?subject=${encodeURIComponent(emailMessage.subject)}` : undefined,
  });
}
