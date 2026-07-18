import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { rateLimitApiWrite, rateLimitApiRead, rateLimitResponse, getClientIp } from "@/lib/rate-limit";
import { auditLog } from "@/lib/audit";
import { logger } from "@/lib/logger";

// GET /api/email — list sent emails
export async function GET(req: NextRequest) {
  try { await requireAuth(); } catch (e) { return e as Response; }
  const ip = getClientIp(req);
  const rl = rateLimitApiRead(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 200);
    const emails = await db.emailLog.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return NextResponse.json({ emails, count: emails.length });
  } catch (e) {
    return NextResponse.json({ error: "Failed to fetch emails" }, { status: 500 });
  }
}

// POST /api/email — send an email
// Body: { to, cc?, bcc?, subject, body, html?, attachments? }
export async function POST(req: NextRequest) {
  let user;
  try { user = await requireAuth(); } catch (e) { return e as Response; }
  const ip = getClientIp(req);
  const rl = rateLimitApiWrite(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { to, cc, bcc, subject, body: textBody, html } = body;
  if (!to || !subject || !textBody) {
    return NextResponse.json({ error: "to, subject, and body are required" }, { status: 400 });
  }

  try {
    // Get SMTP settings from system settings
    const settings = await db.systemSetting.findMany();
    const getSetting = (key: string) => settings.find(s => s.key === key)?.value || "";
    const smtpHost = getSetting("smtp.host");
    const smtpPort = getSetting("smtp.port") || "587";
    const smtpUser = getSetting("smtp.user");
    const smtpPass = getSetting("smtp.password");
    const smtpFrom = getSetting("smtp.from") || smtpUser || "noreply@sylhn.com";

    // If SMTP is not configured, return a mailto: link as fallback
    if (!smtpHost || !smtpUser) {
      const mailtoLink = `mailto:${to}?subject=${encodeURIComponent(subject)}&cc=${encodeURIComponent(cc || "")}&body=${encodeURIComponent(textBody)}`;
      // Log the email attempt
      await db.emailLog.create({
        data: {
          to, cc: cc || "", bcc: bcc || "", subject,
          body: textBody, status: "fallback", errorMessage: "SMTP not configured",
          sentById: user.uid,
        },
      }).catch(() => {});
      return NextResponse.json({
        success: false,
        error: "SMTP not configured. Open mailto link instead.",
        mailto: mailtoLink,
      });
    }

    // Send via SMTP using nodemailer (dynamically imported to avoid loading if not needed)
    let nodemailer: any;
    try {
      nodemailer = await import("nodemailer");
    } catch {
      // nodemailer not installed — use mailto fallback
      const mailtoLink = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(textBody)}`;
      await db.emailLog.create({
        data: {
          to, cc: cc || "", bcc: bcc || "", subject,
          body: textBody, status: "fallback", errorMessage: "nodemailer not installed",
          sentById: user.uid,
        },
      }).catch(() => {});
      return NextResponse.json({ success: false, error: "Email library not installed", mailto: mailtoLink });
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: parseInt(smtpPort, 10),
      secure: parseInt(smtpPort, 10) === 465,
      auth: { user: smtpUser, pass: smtpPass },
    });

    const info = await transporter.sendMail({
      from: smtpFrom,
      to,
      cc: cc || undefined,
      bcc: bcc || undefined,
      subject,
      text: textBody,
      html: html || undefined,
      attachments: body.attachments?.map((a: any) => ({
        filename: a.filename,
        content: Buffer.from(a.content, "base64"),
        contentType: a.contentType,
      })) || undefined,
    });

    // Log the successful email
    await db.emailLog.create({
      data: {
        to, cc: cc || "", bcc: bcc || "", subject,
        body: textBody, status: "sent", messageId: info.messageId,
        sentById: user.uid,
      },
    });

    await auditLog({
      userId: user.uid,
      user: user.username,
      action: "EMAIL_SENT",
      module: "email",
      details: `Email sent to ${to}: "${subject}" (messageId: ${info.messageId})`,
      severity: "info",
      ipAddress: ip,
      userAgent: req.headers.get("user-agent") || "",
    }).catch(() => {});

    logger.info("Email sent", { to, subject, messageId: info.messageId });

    return NextResponse.json({ success: true, messageId: info.messageId });
  } catch (e: any) {
    logger.error("Email send failed", { error: e?.message, to, subject });

    // Log the failed email
    await db.emailLog.create({
      data: {
        to, cc: cc || "", bcc: bcc || "", subject,
        body: textBody, status: "failed", errorMessage: e?.message || "Unknown error",
        sentById: user.uid,
      },
    }).catch(() => {});

    return NextResponse.json({ error: e?.message || "Failed to send email" }, { status: 500 });
  }
}
