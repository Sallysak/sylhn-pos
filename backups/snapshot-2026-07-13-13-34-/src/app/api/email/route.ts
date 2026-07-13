import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { EmailSchema, validate, validationError } from "@/lib/validation";
import { rateLimitEmail, rateLimitResponse, getClientIp } from "@/lib/rate-limit";

// POST /api/email — send email via SMTP
export async function POST(req: NextRequest) {
  try { await requireAuth(); } catch (e) { return e as Response; }

  // Stricter rate limit for emails (anti-spam)
  const ip = getClientIp(req);
  const rl = rateLimitEmail(ip);
  if (!rl.allowed) return rateLimitResponse(rl, "Email rate limit exceeded. Try again later.");

  let body: unknown;
  try { body = await req.json(); } catch { return validationError("Invalid JSON body"); }

  const result = validate(EmailSchema, body);
  if (!result.success) return validationError(result.error);
  const { to, subject, body: textBody, html, smtp, cc, bcc, attachments } = result.data;

  if (!smtp || !smtp.host || !smtp.user) {
    return NextResponse.json({
      success: false,
      error: "SMTP not configured",
      mailto: `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(textBody || "")}`,
    });
  }

  try {
    const nodemailer = await import("nodemailer");
    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: Number(smtp.port) || 587,
      secure: smtp.secure === true,
      auth: { user: smtp.user, pass: smtp.password },
    });

    await transporter.sendMail({
      from: `"${smtp.fromName || "SYLHN POS"}" <${smtp.fromEmail || smtp.user}>`,
      to,
      cc,
      bcc,
      subject,
      text: textBody,
      html: html || textBody?.replace(/\n/g, "<br>"),
      attachments: (attachments || []).map((a) => ({
        filename: a.filename,
        content: Buffer.from(a.content, "base64"),
        contentType: a.contentType,
      })),
    });

    return NextResponse.json({ success: true });
  } catch (mailErr) {
    console.error("SMTP send error:", mailErr);
    return NextResponse.json({
      success: false,
      error: `SMTP error: ${(mailErr as Error).message}`,
      mailto: `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(textBody || "")}`,
    }, { status: 502 });
  }
}
