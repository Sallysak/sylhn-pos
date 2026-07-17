import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requirePermission } from "@/lib/auth";
import { rateLimitApiWrite, rateLimitResponse, getClientIp } from "@/lib/rate-limit";
import { auditLog } from "@/lib/audit";
import nodemailer from "nodemailer";

// POST /api/z-report/email
// Premium: emails the Z-Report to all manager/admin users + a configurable
// recipient list (stored in SystemSetting "zReport.recipients").
//
// For automated midnight emails, set up an external cron job (e.g. cron-job.org,
// Vercel Cron, or a self-hosted cron) that calls /api/z-report/cron at 23:59.
//
// Body (optional): { date?: "YYYY-MM-DD", recipients?: ["email1", ...] }
export async function POST(req: NextRequest) {
  let user;
  try { user = await requireAuth(); requirePermission(user.role, "accounts"); } catch (e) { return e as Response; }

  const ip = getClientIp(req);
  const rl = rateLimitApiWrite(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  let body: any = {};
  try { body = await req.json(); } catch { /* allow empty body */ }

  const dateStr = body.date || new Date().toISOString().split("T")[0];

  try {
    // Fetch the Z-Report data (reuse the GET endpoint logic)
    const date = new Date(dateStr);
    const startOfDay = new Date(date); startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date); endOfDay.setHours(23, 59, 59, 999);

    const [completedSales, voidedSales, refundedSales, shifts, expenses] = await Promise.all([
      db.sale.findMany({
        where: { status: "completed", createdAt: { gte: startOfDay, lte: endOfDay } },
        include: { items: true, payments: true, cashier: { select: { fullName: true } } },
      }),
      db.sale.findMany({ where: { status: "voided", voidedAt: { gte: startOfDay, lte: endOfDay } } }),
      db.sale.findMany({ where: { status: "refunded", refundedAt: { gte: startOfDay, lte: endOfDay } } }),
      db.cashierShift.findMany({
        where: { OR: [{ openedAt: { gte: startOfDay, lte: endOfDay } }, { closedAt: { gte: startOfDay, lte: endOfDay } }] },
      }),
      db.expense.findMany({ where: { date: { gte: startOfDay, lte: endOfDay } } }),
    ]);

    const grossSales = completedSales.reduce((s, x) => s + x.total, 0);
    const totalVoids = voidedSales.reduce((s, x) => s + x.total, 0);
    const totalRefunds = refundedSales.reduce((s, x) => s + x.total, 0);
    const netSales = grossSales - totalVoids - totalRefunds;
    const totalTaxCollected = completedSales.reduce((s, x) => s + x.taxAmount, 0);
    const totalDiscounts = completedSales.reduce((s, x) => s + x.discount, 0);
    const grossProfit = completedSales.reduce((s, x) => s + x.grossProfit, 0);
    const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
    const totalOpeningFloat = shifts.reduce((s, x) => s + x.openingFloat, 0);
    const cashSales = completedSales
      .filter(s => s.paymentMethod === "cash")
      .reduce((s, x) => s + x.amountPaid, 0);
    const totalChange = completedSales.reduce((s, x) => s + x.change, 0);
    const cashExpected = totalOpeningFloat + cashSales - totalChange;

    // Build the email HTML
    const html = `
<!DOCTYPE html><html><head><style>
body{font-family:Arial,Helvetica,sans-serif;margin:0;padding:20px;background:#f8fafc;color:#0f172a}
.container{max-width:600px;margin:0 auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.05)}
.header{background:linear-gradient(135deg,#047857,#0d9488);color:white;padding:24px;text-align:center}
.header h1{margin:0;font-size:22px;font-weight:700}
.header .subtitle{margin-top:4px;font-size:13px;opacity:0.9}
.content{padding:24px}
.section{margin-bottom:24px}
.section h2{font-size:14px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 12px 0;border-bottom:1px solid #e2e8f0;padding-bottom:8px}
.metric{display:flex;justify-content:space-between;padding:6px 0;font-size:13px}
.metric .label{color:#64748b}
.metric .value{font-weight:600;font-family:monospace}
.metric.total{border-top:2px solid #0f172a;margin-top:8px;padding-top:12px;font-size:16px;font-weight:700}
.positive{color:#059669}
.negative{color:#dc2626}
.footer{padding:16px 24px;background:#f1f5f9;font-size:11px;color:#64748b;text-align:center}
</style></head><body>
<div class="container">
  <div class="header">
    <h1>📊 Daily Z-Report</h1>
    <div class="subtitle">SYLHN COMPANY LTD · ${new Date(dateStr).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</div>
  </div>
  <div class="content">
    <div class="section">
      <h2>Sales Summary</h2>
      <div class="metric"><span class="label">Gross Sales</span><span class="value">₵${grossSales.toFixed(2)}</span></div>
      <div class="metric"><span class="label">Voids</span><span class="value negative">-₵${totalVoids.toFixed(2)} (${voidedSales.length})</span></div>
      <div class="metric"><span class="label">Refunds</span><span class="value negative">-₵${totalRefunds.toFixed(2)} (${refundedSales.length})</span></div>
      <div class="metric total"><span>NET SALES</span><span>₵${netSales.toFixed(2)}</span></div>
    </div>
    <div class="section">
      <h2>Tax & Profit</h2>
      <div class="metric"><span class="label">VAT Collected</span><span class="value">₵${totalTaxCollected.toFixed(2)}</span></div>
      <div class="metric"><span class="label">Discounts Given</span><span class="value">₵${totalDiscounts.toFixed(2)}</span></div>
      <div class="metric"><span class="label">Gross Profit</span><span class="value positive">₵${grossProfit.toFixed(2)}</span></div>
      <div class="metric"><span class="label">Expenses</span><span class="value negative">-₵${totalExpenses.toFixed(2)}</span></div>
      <div class="metric total"><span>Net Cash Flow</span><span class="positive">₵${(grossProfit - totalExpenses).toFixed(2)}</span></div>
    </div>
    <div class="section">
      <h2>Cash Reconciliation</h2>
      <div class="metric"><span class="label">Opening Float (${shifts.length} shifts)</span><span class="value">₵${totalOpeningFloat.toFixed(2)}</span></div>
      <div class="metric"><span class="label">Cash Sales</span><span class="value">₵${cashSales.toFixed(2)}</span></div>
      <div class="metric"><span class="label">Change Given</span><span class="value">-₵${totalChange.toFixed(2)}</span></div>
      <div class="metric total"><span>Expected Cash in Drawer</span><span>₵${cashExpected.toFixed(2)}</span></div>
    </div>
    <div class="section">
      <h2>Transactions</h2>
      <div class="metric"><span class="label">Completed Sales</span><span class="value">${completedSales.length}</span></div>
      <div class="metric"><span class="label">Average Transaction</span><span class="value">₵${completedSales.length > 0 ? (grossSales / completedSales.length).toFixed(2) : "0.00"}</span></div>
    </div>
  </div>
  <div class="footer">
    Generated ${new Date().toLocaleString("en-GB")} by ${user.username}<br/>
    SYLHN POS · East Legon, Accra · +233592766044
  </div>
</div>
</body></html>`;

    const text = `SYLHN POS — Daily Z-Report for ${dateStr}
Gross Sales: GHS ${grossSales.toFixed(2)}
Voids: GHS ${totalVoids.toFixed(2)} (${voidedSales.length})
Refunds: GHS ${totalRefunds.toFixed(2)} (${refundedSales.length})
NET SALES: GHS ${netSales.toFixed(2)}
VAT Collected: GHS ${totalTaxCollected.toFixed(2)}
Gross Profit: GHS ${grossProfit.toFixed(2)}
Expenses: GHS ${totalExpenses.toFixed(2)}
Net Cash Flow: GHS ${(grossProfit - totalExpenses).toFixed(2)}
Transactions: ${completedSales.length}
Expected Cash: GHS ${cashExpected.toFixed(2)}`;

    // Determine recipients: body.recipients > SystemSetting "zReport.recipients" > all managers/admins
    let recipients: string[] = [];
    if (Array.isArray(body.recipients) && body.recipients.length > 0) {
      recipients = body.recipients;
    } else {
      // Check SystemSetting
      const setting = await db.systemSetting.findUnique({ where: { key: "zReport.recipients" } });
      if (setting) {
        try { recipients = JSON.parse(setting.value); } catch {}
      }
      // Fall back to all manager/admin emails
      if (recipients.length === 0) {
        const managers = await db.systemUser.findMany({
          where: { role: { in: ["manager", "admin"] }, active: true, email: { not: "" } },
          select: { email: true },
        });
        recipients = managers.map(m => m.email).filter(Boolean);
      }
    }

    if (recipients.length === 0) {
      return NextResponse.json({ error: "No recipients configured. Set SystemSetting 'zReport.recipients' or pass recipients in body." }, { status: 400 });
    }

    // Try SMTP from SystemSetting, then env, then fail gracefully
    const smtpSetting = await db.systemSetting.findUnique({ where: { key: "smtp.config" } });
    let transporter: nodemailer.Transporter | null = null;
    if (smtpSetting) {
      try {
        const config = JSON.parse(smtpSetting.value);
        transporter = nodemailer.createTransport({
          host: config.host,
          port: config.port || 587,
          secure: config.secure || false,
          auth: config.user ? { user: config.user, pass: config.password } : undefined,
        });
      } catch {}
    }
    if (!transporter && process.env.SMTP_HOST) {
      transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || "587", 10),
        secure: process.env.SMTP_SECURE === "true",
        auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD || "" } : undefined,
      });
    }

    if (!transporter) {
      // No SMTP configured — log a warning and return the report content
      await auditLog({
        userId: user.uid,
        user: user.username,
        action: "Z_REPORT_EMAIL_FAILED",
        module: "accounts",
        details: `Z-Report email for ${dateStr} could not be sent — no SMTP configured. Recipients: ${recipients.join(", ")}`,
        severity: "warning",
        ipAddress: ip,
        userAgent: req.headers.get("user-agent") || "",
      });
      return NextResponse.json({
        success: false,
        warning: "No SMTP configured. Set SystemSetting 'smtp.config' or env SMTP_HOST.",
        recipients,
        subject: `Z-Report — ${dateStr}`,
        textPreview: text.slice(0, 500),
      });
    }

    const info = await transporter.sendMail({
      from: `"SYLHN POS" <no-reply@sylhn.com>`,
      to: recipients.join(", "),
      subject: `📊 Z-Report — ${new Date(dateStr).toLocaleDateString("en-GB")}`,
      text,
      html,
    });

    await auditLog({
      userId: user.uid,
      user: user.username,
      action: "Z_REPORT_EMAILED",
      module: "accounts",
      details: `Z-Report for ${dateStr} emailed to ${recipients.length} recipient(s): ${recipients.join(", ")}`,
      severity: "warning",
      ipAddress: ip,
      userAgent: req.headers.get("user-agent") || "",
    });

    return NextResponse.json({
      success: true,
      messageId: info.messageId,
      recipients,
      date: dateStr,
    });
  } catch (e: any) {
    console.error("POST /api/z-report/email error:", e);
    return NextResponse.json({ error: e?.message || "Failed to send Z-Report email" }, { status: 500 });
  }
}
