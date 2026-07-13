import { NextRequest, NextResponse } from "next/server";

// POST /api/email — send email via SMTP (configured by client)
// Falls back to returning a mailto: link if SMTP is not configured.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { to, subject, body: textBody, html, smtp } = body;

    if (!to || !subject) {
      return NextResponse.json({ error: "Missing to or subject" }, { status: 400 });
    }

    if (!smtp || !smtp.host || !smtp.user) {
      return NextResponse.json({
        success: false,
        error: "SMTP not configured",
        mailto: `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(textBody || "")}`,
      });
    }

    // In a serverless/edge environment we cannot run a real SMTP client
    // without nodemailer. Try to dynamically import it.
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
        cc: body.cc,
        bcc: body.bcc,
        subject,
        text: textBody,
        html: html || textBody?.replace(/\n/g, "<br>"),
        attachments: (body.attachments || []).map((a: any) => ({
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
      });
    }
  } catch (e) {
    console.error("POST /api/email error:", e);
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
  }
}
