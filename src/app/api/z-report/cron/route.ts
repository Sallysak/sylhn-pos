import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auditLog } from "@/lib/audit";
import nodemailer from "nodemailer";

// POST /api/z-report/cron
// Premium: called by an external cron job at 23:59 daily to auto-email the Z-Report.
//
// Authentication: requires a CRON_SECRET env var OR ?secret=... query param
// matching process.env.CRON_SECRET. This prevents unauthorized triggering.
//
// Setup: create a cron job (cron-job.org, Vercel Cron, etc.) that POSTs to:
//   https://your-domain.com/api/z-report/cron
//   Headers: { "x-cron-secret": "your-secret" }
//   Schedule: "59 23 * * *" (23:59 daily)
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret") || new URL(req.url).searchParams.get("secret");
  const expectedSecret = process.env.CRON_SECRET;
  if (!expectedSecret) {
    return NextResponse.json({ error: "CRON_SECRET env var not set — cron endpoint disabled" }, { status: 503 });
  }
  if (secret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized — invalid secret" }, { status: 401 });
  }

  try {
    const dateStr = new Date().toISOString().split("T")[0];
    const date = new Date(dateStr);
    const startOfDay = new Date(date); startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date); endOfDay.setHours(23, 59, 59, 999);

    const [completedSales, voidedSales, refundedSales, shifts, expenses] = await Promise.all([
      db.sale.findMany({ where: { status: "completed", createdAt: { gte: startOfDay, lte: endOfDay } }, include: { items: true, payments: true } }),
      db.sale.findMany({ where: { status: "voided", voidedAt: { gte: startOfDay, lte: endOfDay } } }),
      db.sale.findMany({ where: { status: "refunded", refundedAt: { gte: startOfDay, lte: endOfDay } } }),
      db.cashierShift.findMany({ where: { OR: [{ openedAt: { gte: startOfDay, lte: endOfDay } }, { closedAt: { gte: startOfDay, lte: endOfDay } }] } }),
      db.expense.findMany({ where: { date: { gte: startOfDay, lte: endOfDay } } }),
    ]);

    const grossSales = completedSales.reduce((s, x) => s + x.total, 0);
    const totalVoids = voidedSales.reduce((s, x) => s + x.total, 0);
    const totalRefunds = refundedSales.reduce((s, x) => s + x.total, 0);
    const netSales = grossSales - totalVoids - totalRefunds;
    const totalTaxCollected = completedSales.reduce((s, x) => s + x.taxAmount, 0);
    const grossProfit = completedSales.reduce((s, x) => s + x.grossProfit, 0);
    const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
    const totalOpeningFloat = shifts.reduce((s, x) => s + x.openingFloat, 0);
    const cashSales = completedSales.filter(s => s.paymentMethod === "cash").reduce((s, x) => s + x.amountPaid, 0);
    const totalChange = completedSales.reduce((s, x) => s + x.change, 0);
    const cashExpected = totalOpeningFloat + cashSales - totalChange;

    const text = `SYLHN POS — Daily Z-Report (AUTO) for ${dateStr}
Gross Sales: GHS ${grossSales.toFixed(2)}
NET SALES: GHS ${netSales.toFixed(2)}
VAT: GHS ${totalTaxCollected.toFixed(2)}
Gross Profit: GHS ${grossProfit.toFixed(2)}
Expenses: GHS ${totalExpenses.toFixed(2)}
Net Cash Flow: GHS ${(grossProfit - totalExpenses).toFixed(2)}
Transactions: ${completedSales.length}
Expected Cash: GHS ${cashExpected.toFixed(2)}`;

    // Get recipients
    const setting = await db.systemSetting.findUnique({ where: { key: "zReport.recipients" } });
    let recipients: string[] = [];
    if (setting) { try { recipients = JSON.parse(setting.value); } catch {} }
    if (recipients.length === 0) {
      const managers = await db.systemUser.findMany({
        where: { role: { in: ["manager", "admin"] }, active: true, email: { not: "" } },
        select: { email: true },
      });
      recipients = managers.map(m => m.email).filter(Boolean);
    }

    await auditLog({
      userId: "",
      user: "cron",
      action: "Z_REPORT_CRON",
      module: "accounts",
      details: `Cron-triggered Z-Report for ${dateStr} — ${recipients.length} recipients, gross GHS ${grossSales.toFixed(2)}`,
      severity: "warning",
    });

    if (recipients.length === 0) {
      return NextResponse.json({ success: true, warning: "No recipients configured", date: dateStr, summary: text });
    }

    // Try to send email
    const smtpSetting = await db.systemSetting.findUnique({ where: { key: "smtp.config" } });
    if (!smtpSetting && !process.env.SMTP_HOST) {
      return NextResponse.json({ success: true, warning: "No SMTP configured — report logged but not emailed", date: dateStr, summary: text });
    }

    let transporter: nodemailer.Transporter;
    if (smtpSetting) {
      const config = JSON.parse(smtpSetting.value);
      transporter = nodemailer.createTransport({
        host: config.host, port: config.port || 587, secure: config.secure || false,
        auth: config.user ? { user: config.user, pass: config.password } : undefined,
      });
    } else {
      transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST!,
        port: parseInt(process.env.SMTP_PORT || "587", 10),
        secure: process.env.SMTP_SECURE === "true",
        auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD || "" } : undefined,
      });
    }

    const info = await transporter.sendMail({
      from: `"SYLHN POS (Auto)" <no-reply@sylhn.com>`,
      to: recipients.join(", "),
      subject: `📊 Daily Z-Report — ${new Date(dateStr).toLocaleDateString("en-GB")} (AUTO)`,
      text,
    });

    return NextResponse.json({ success: true, messageId: info.messageId, recipients, date: dateStr });
  } catch (e: any) {
    console.error("POST /api/z-report/cron error:", e);
    return NextResponse.json({ error: e?.message || "Cron failed" }, { status: 500 });
  }
}
