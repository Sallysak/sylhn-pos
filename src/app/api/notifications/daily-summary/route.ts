import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import nodemailer from "nodemailer";

// POST /api/notifications/daily-summary
// Sends a daily business summary email at 8 AM to the configured recipient.
//
// Authentication: requires x-cron-secret header matching CRON_SECRET env var.
// Setup: create a cron job (cron-job.org, Vercel Cron, etc.) that POSTs to:
//   https://your-domain.com/api/notifications/daily-summary
//   Headers: { "x-cron-secret": "your-secret" }
//   Schedule: "0 8 * * *" (08:00 daily)
//
// The email contains:
//   - Yesterday's total revenue, transaction count, average sale
//   - Top 5 selling products
//   - Low stock alerts (items at or below reorder level)
//   - Expiry alerts (items expiring within 7 days)
//   - Payment method breakdown
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret") || new URL(req.url).searchParams.get("secret");
  const expectedSecret = process.env.CRON_SECRET;
  if (!expectedSecret) {
    return NextResponse.json({ error: "CRON_SECRET env var not set — cron endpoint disabled" }, { status: 503 });
  }
  if (secret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get yesterday's date range
  const now = new Date();
  const yesterdayStart = new Date(now);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  yesterdayStart.setHours(0, 0, 0, 0);
  const yesterdayEnd = new Date(yesterdayStart);
  yesterdayEnd.setHours(23, 59, 59, 999);

  try {
    // Fetch yesterday's sales
    const sales = await db.sale.findMany({
      where: {
        createdAt: { gte: yesterdayStart, lte: yesterdayEnd },
        status: "completed",
      },
      include: { items: true },
    });

    const totalRevenue = sales.reduce((s, x) => s + Number(x.total), 0);
    const totalTaxCollected = sales.reduce((s, x) => s + Number(x.taxAmount), 0);
    const totalDiscounts = sales.reduce((s, x) => s + Number(x.discount), 0);
    const txnCount = sales.length;
    const avgSale = txnCount > 0 ? totalRevenue / txnCount : 0;

    // Payment method breakdown
    const paymentBreakdown = sales.reduce((acc, s) => {
      const method = s.paymentMethod || "cash";
      acc[method] = (acc[method] || 0) + Number(s.total);
      return acc;
    }, {} as Record<string, number>);

    // Top 5 products by revenue
    const productRevenue: Record<string, { name: string; qty: number; revenue: number }> = {};
    for (const sale of sales) {
      for (const item of sale.items) {
        const key = item.sku || item.name;
        if (!productRevenue[key]) {
          productRevenue[key] = { name: item.name, qty: 0, revenue: 0 };
        }
        productRevenue[key].qty += item.quantity;
        productRevenue[key].revenue += Number(item.total);
      }
    }
    const topProducts = Object.values(productRevenue)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    // Low stock alerts
    const lowStock = await db.product.findMany({
      where: { quantity: { lte: db.product.fields.reorderLevel }, active: true },
      take: 10,
      orderBy: { quantity: "asc" },
    });

    // Expiry alerts (within 7 days)
    const expiryThreshold = new Date();
    expiryThreshold.setDate(expiryThreshold.getDate() + 7);
    const expiringSoon = await db.product.findMany({
      where: {
        expiryDate: { gte: now, lte: expiryThreshold },
        active: true,
      },
      take: 10,
    });

    // Load email settings
    const settings = await db.systemSetting.findMany({
      where: { key: { in: ["email.smtpHost", "email.smtpUser", "email.smtpPass", "email.smtpPort", "email.from", "email.dailySummaryTo"] } },
    });
    const cfg: Record<string, string> = {};
    settings.forEach(s => { cfg[s.key] = s.value; });

    if (!cfg["email.smtpHost"] || !cfg["email.dailySummaryTo"]) {
      return NextResponse.json({
        success: false,
        message: "Email SMTP not configured or no recipient set. Skipping daily summary.",
        stats: { totalRevenue, txnCount, avgSale },
      });
    }

    // Build HTML email
    const dateStr = yesterdayStart.toLocaleDateString("en-GB", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
    const html = buildEmailHtml({
      dateStr,
      totalRevenue,
      txnCount,
      avgSale,
      totalTaxCollected,
      totalDiscounts,
      paymentBreakdown,
      topProducts,
      lowStock,
      expiringSoon,
    });

    // Send email
    const transporter = nodemailer.createTransport({
      host: cfg["email.smtpHost"],
      port: parseInt(cfg["email.smtpPort"] || "587"),
      secure: cfg["email.smtpPort"] === "465",
      auth: cfg["email.smtpUser"] ? { user: cfg["email.smtpUser"], pass: cfg["email.smtpPass"] || "" } : undefined,
    });

    await transporter.sendMail({
      from: cfg["email.from"] || `"SYLHN POS" <${cfg["email.smtpUser"]}>`,
      to: cfg["email.dailySummaryTo"],
      subject: `📊 Daily Summary — ${dateStr} — GHS ${totalRevenue.toFixed(2)}`,
      html,
    });

    return NextResponse.json({
      success: true,
      message: "Daily summary email sent",
      sent: { totalRevenue, txnCount, lowStockCount: lowStock.length, expiryCount: expiringSoon.length },
    });
  } catch (e: any) {
    console.error("Daily summary error:", e);
    return NextResponse.json({ error: e?.message || "Failed to send daily summary" }, { status: 500 });
  }
}

function buildEmailHtml(data: any): string {
  const fmt = (n: number) => `GHS ${Number(n).toFixed(2)}`;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
  <div style="max-width:560px;margin:0 auto;padding:20px">
    <div style="background:linear-gradient(135deg,#059669,#0d9488);color:white;padding:24px;border-radius:16px 16px 0 0;text-align:center">
      <h1 style="margin:0;font-size:22px">📊 Daily Business Summary</h1>
      <p style="margin:6px 0 0;opacity:0.9;font-size:13px">${data.dateStr}</p>
    </div>
    <div style="background:white;padding:24px;border-radius:0 0 16px 16px;box-shadow:0 4px 12px rgba(15,23,42,0.06)">
      <div style="background:linear-gradient(135deg,#ecfdf5,#d1fae5);padding:20px;border-radius:12px;text-align:center;margin-bottom:20px">
        <div style="font-size:11px;color:#065f46;text-transform:uppercase;letter-spacing:0.05em;font-weight:600">Total Revenue</div>
        <div style="font-size:36px;font-weight:800;color:#059669;font-family:monospace;margin-top:4px">${fmt(data.totalRevenue)}</div>
        <div style="font-size:12px;color:#065f46;margin-top:6px">${data.txnCount} transactions · Avg ${fmt(data.avgSale)}</div>
      </div>
      <table style="width:100%;font-size:13px;color:#475569;margin-bottom:20px">
        <tr><td style="padding:6px 0">Tax Collected:</td><td style="text-align:right;font-weight:600">${fmt(data.totalTaxCollected)}</td></tr>
        <tr><td style="padding:6px 0">Discounts Given:</td><td style="text-align:right;font-weight:600">${fmt(data.totalDiscounts)}</td></tr>
      </table>
      ${data.topProducts.length > 0 ? `
      <h3 style="font-size:14px;color:#1e293b;margin:20px 0 10px">🏆 Top 5 Products</h3>
      <table style="width:100%;font-size:12px;border-collapse:collapse">
        <thead><tr style="background:#f1f5f9"><th style="text-align:left;padding:8px">Product</th><th style="text-align:right;padding:8px">Qty</th><th style="text-align:right;padding:8px">Revenue</th></tr></thead>
        <tbody>
          ${data.topProducts.map((p: any, i: number) => `<tr style="border-bottom:1px solid #e2e8f0"><td style="padding:8px">${i + 1}. ${p.name}</td><td style="text-align:right;padding:8px">${p.qty}</td><td style="text-align:right;padding:8px;font-weight:600">${fmt(p.revenue)}</td></tr>`).join("")}
        </tbody>
      </table>` : ""}
      ${data.lowStock.length > 0 ? `
      <h3 style="font-size:14px;color:#dc2626;margin:20px 0 10px">⚠️ Low Stock (${data.lowStock.length})</h3>
      <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px;font-size:12px;color:#991b1b">
        ${data.lowStock.map((p: any) => `• ${p.name} — ${p.quantity} left (reorder at ${p.reorderLevel})`).join("<br>")}
      </div>` : ""}
      ${data.expiringSoon.length > 0 ? `
      <h3 style="font-size:14px;color:#d97706;margin:20px 0 10px">⏰ Expiring Soon (${data.expiringSoon.length})</h3>
      <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:12px;font-size:12px;color:#92400e">
        ${data.expiringSoon.map((p: any) => `• ${p.name} — expires ${new Date(p.expiryDate).toLocaleDateString("en-GB")}`).join("<br>")}
      </div>` : ""}
      ${Object.keys(data.paymentBreakdown).length > 0 ? `
      <h3 style="font-size:14px;color:#1e293b;margin:20px 0 10px">💳 Payment Methods</h3>
      <table style="width:100%;font-size:12px">
        ${Object.entries(data.paymentBreakdown).map(([m, a]) => `<tr><td style="padding:4px 0;text-transform:capitalize">${m}</td><td style="text-align:right;font-weight:600">${fmt(a as number)}</td></tr>`).join("")}
      </table>` : ""}
    </div>
    <p style="text-align:center;font-size:11px;color:#94a3b8;margin-top:16px">SYLHN POS · Automated daily summary · ${new Date().toISOString()}</p>
  </div>
</body></html>`;
}
