import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { rateLimitApiWrite, rateLimitResponse, getClientIp } from "@/lib/rate-limit";
import { auditLog } from "@/lib/audit";

// POST /api/email/test
// Sends a test email to verify SMTP configuration.
// Body: { to: string } — recipient email address
export async function POST(req: NextRequest) {
  let user;
  try { user = await requireAuth(); } catch (e: any) { return e as Response; }

  const ip = getClientIp(req);
  const rl = rateLimitApiWrite(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const to = body.to;
  if (!to || typeof to !== "string") {
    return NextResponse.json({ error: "Recipient email (to) is required" }, { status: 400 });
  }

  try {
    // Get SMTP settings from database
    const settings = await db.systemSetting.findMany();
    const getSetting = (key: string) => settings.find(s => s.key === key)?.value || "";
    const smtpHost = getSetting("smtp.host");
    const smtpPort = getSetting("smtp.port") || "587";
    const smtpUser = getSetting("smtp.user");
    const smtpPass = getSetting("smtp.password");
    const smtpFrom = getSetting("smtp.from") || smtpUser;

    if (!smtpHost || !smtpUser || !smtpPass) {
      return NextResponse.json({
        success: false,
        error: "SMTP not configured. Save your SMTP settings first (host, user, password).",
        configured: { host: !!smtpHost, user: !!smtpUser, password: !!smtpPass },
      }, { status: 400 });
    }

    // Dynamically import nodemailer
    let nodemailer: any;
    try {
      nodemailer = await import("nodemailer");
    } catch {
      return NextResponse.json({
        success: false,
        error: "Email library (nodemailer) is not installed. Contact support.",
      }, { status: 500 });
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: parseInt(smtpPort, 10),
      secure: parseInt(smtpPort, 10) === 465,
      auth: { user: smtpUser, pass: smtpPass },
    });

    // Verify connection first
    try {
      await transporter.verify();
    } catch (verifyErr: any) {
      return NextResponse.json({
        success: false,
        error: `SMTP connection failed: ${verifyErr.message}`,
        hint: verifyErr.code === "EAUTH" ? "Wrong username or password (for Gmail, use an App Password, not your regular password)" : verifyErr.code === "ECONNECTION" ? "Cannot reach SMTP server — check host and port" : "Check your SMTP settings",
      }, { status: 500 });
    }

    // Send test email
    const info = await transporter.sendMail({
      from: smtpFrom,
      to,
      subject: "[SYLHN POS] Email System Test — Success!",
      text: `Hello,

This is a test email from SYLHN POS. If you received this, your email system is working correctly!

SMTP Configuration:
- Host: ${smtpHost}
- Port: ${smtpPort}
- User: ${smtpUser}
- From: ${smtpFrom}

Sent at: ${new Date().toISOString()}

— SYLHN POS Email System`,
      html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #059669;">✅ Email System Test — Success!</h2>
        <p>This is a test email from <strong>SYLHN POS</strong>. If you received this, your email system is working correctly!</p>
        <h3 style="color: #475569; margin-top: 20px;">SMTP Configuration:</h3>
        <ul style="color: #64748b; font-size: 14px;">
          <li><strong>Host:</strong> ${smtpHost}</li>
          <li><strong>Port:</strong> ${smtpPort}</li>
          <li><strong>User:</strong> ${smtpUser}</li>
          <li><strong>From:</strong> ${smtpFrom}</li>
        </ul>
        <p style="color: #94a3b8; font-size: 12px; margin-top: 20px;">Sent at: ${new Date().toISOString()}</p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
        <p style="color: #059669; font-weight: bold;">— SYLHN POS Email System</p>
      </div>`,
    });

    // Log the test email
    await db.emailLog.create({
      data: {
        to,
        cc: "",
        bcc: "",
        subject: "[SYLHN POS] Email System Test — Success!",
        body: "Test email from SYLHN POS",
        status: "sent",
        messageId: info.messageId,
        sentById: user.uid,
      },
    }).catch(() => {});

    auditLog({
      userId: user.uid,
      user: user.username,
      action: "TEST_EMAIL",
      module: "maintenance",
      details: `Test email sent to ${to} via ${smtpHost}:${smtpPort}`,
      severity: "info",
      ipAddress: ip,
      userAgent: req.headers.get("user-agent") || "",
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      message: "Test email sent successfully!",
      sentTo: to,
      messageId: info.messageId,
    });
  } catch (e: any) {
    console.error("POST /api/email/test error:", e);
    return NextResponse.json({
      success: false,
      error: e?.message || "Failed to send test email",
      code: e?.code,
    }, { status: 500 });
  }
}
