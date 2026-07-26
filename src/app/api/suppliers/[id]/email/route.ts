import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requirePermission } from "@/lib/auth";
import { rateLimitApiWrite, rateLimitResponse, getClientIp } from "@/lib/rate-limit";
import { auditLog } from "@/lib/audit";
import { sendEmail, openMailto, getSmtpConfig } from "@/lib/email";
import { COMPANY } from "@/lib/pos-data";

// POST /api/suppliers/[id]/email
// Body: { to?: string, cc?: string, subject?: string, message?: string }
//
// Sends an email to the supplier. Uses SMTP if configured, otherwise
// falls back to opening the user's email client via mailto:.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let user;
  try { user = await requireAuth(); requirePermission(user.role, "purchase"); } catch (e) { return e as Response; }
  const ip = getClientIp(req);
  const rl = rateLimitApiWrite(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  const { id } = await params;
  const supplier = await db.supplier.findUnique({ where: { id } });
  if (!supplier) return NextResponse.json({ error: "Supplier not found" }, { status: 404 });

  let body: any;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const to = String(body.to || supplier.email || "").trim();
  if (!to || !/.+@.+\..+/.test(to)) {
    return NextResponse.json(
      { error: "Supplier has no valid email address. Add one in the supplier master file, or provide one in the dialog." },
      { status: 400 }
    );
  }

  const cc = String(body.cc || "").trim();
  const subject = String(body.subject || `Message from ${COMPANY.name} — re: ${supplier.name}`).trim();
  const message = String(body.message || "").trim();

  const emailBody = message || `Dear ${supplier.contactName || supplier.name},\n\nPlease see below.\n\nBest regards,\n${COMPANY.name}`;

  // Try SMTP first; if not configured, fall back to mailto: link
  const smtpConfig = getSmtpConfig();
  let delivery: "smtp" | "mailto" = "smtp";
  let sendResult: { success: boolean; message: string } | null = null;

  if (smtpConfig) {
    try {
      sendResult = await sendEmail({
        to,
        cc: cc || undefined,
        subject,
        body: emailBody,
      });
      if (!sendResult.success) delivery = "mailto";
    } catch (e: any) {
      sendResult = { success: false, message: e?.message || "SMTP send failed" };
      delivery = "mailto";
    }
  } else {
    delivery = "mailto";
  }

  if (delivery === "mailto") {
    openMailto({
      to,
      cc: cc || undefined,
      subject,
      body: emailBody,
    });
  }

  await auditLog({
    userId: user.uid,
    user: user.username,
    action: "EMAIL",
    module: "supplier",
    details: `${delivery === "smtp" ? "Emailed" : "Opened mailto for"} supplier ${supplier.code} (${supplier.name}) to ${to}${cc ? ` (cc: ${cc})` : ""}`,
    severity: "info",
    ipAddress: ip,
    userAgent: req.headers.get("user-agent") || "",
  }).catch(() => {});

  return NextResponse.json({
    success: true,
    delivery,
    to,
    cc,
    subject,
    smtpConfigured: !!smtpConfig,
    smtpResult: sendResult,
  });
}
