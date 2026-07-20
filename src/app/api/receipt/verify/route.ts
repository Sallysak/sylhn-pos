import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/receipt/verify?invoice=XXX&saleId=XXX
// Public endpoint (no auth required) — verifies a receipt by invoice number.
// Returns a self-contained HTML page showing the receipt details.
// This is the URL encoded in the QR code on receipts, embedded in the
// WhatsApp message, and opened by the "View Receipt Online" button.
//
// IMPORTANT: The page is fully self-contained (no external fonts, scripts,
// stylesheets, or images). It uses inline SVG for icons so they render
// correctly on every device, including those without emoji support.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const invoice = searchParams.get("invoice") || "";
  const saleId = searchParams.get("saleId") || "";

  try {
    // Find the sale by invoice number or sale ID
    const sale = saleId
      ? await db.sale.findUnique({ where: { id: saleId }, include: { items: true } })
      : await db.sale.findFirst({ where: { invoiceNumber: invoice }, include: { items: true } });

    if (!sale) {
      return new NextResponse(
        renderNotFoundHtml(invoice),
        { headers: { "Content-Type": "text/html; charset=utf-8" } }
      );
    }

    return new NextResponse(
      renderReceiptHtml(sale),
      { headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  } catch (e: any) {
    return new NextResponse(
      renderErrorHtml(e?.message || "Unknown error"),
      { status: 500, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }
}

// ===== Status badge configuration =====
// Avoid emojis entirely — they render inconsistently across devices/OSes.
// Use inline SVG icons instead, which render identically everywhere.
type StatusConfig = {
  label: string;        // e.g. "Valid Receipt"
  sublabel: string;     // e.g. "This receipt has been verified"
  color: string;        // hex color for the badge (green/red/amber)
  bgColor: string;      // light background tint
  borderColor: string;  // border color
  icon: "check" | "x" | "alert";  // which SVG icon to render
};

function getStatusConfig(status: string): StatusConfig {
  switch (status) {
    case "completed":
      return {
        label: "Valid Receipt",
        sublabel: "This receipt has been verified as authentic",
        color: "#15803d",
        bgColor: "#dcfce7",
        borderColor: "#86efac",
        icon: "check",
      };
    case "voided":
      return {
        label: "Voided Receipt",
        sublabel: "This receipt has been cancelled and is no longer valid",
        color: "#b91c1c",
        bgColor: "#fee2e2",
        borderColor: "#fca5a5",
        icon: "x",
      };
    case "pending":
      return {
        label: "Pending Payment",
        sublabel: "This sale has not yet been completed",
        color: "#a16207",
        bgColor: "#fef3c7",
        borderColor: "#fcd34d",
        icon: "alert",
      };
    case "refunded":
      return {
        label: "Refunded",
        sublabel: "This sale has been refunded",
        color: "#b91c1c",
        bgColor: "#fee2e2",
        borderColor: "#fca5a5",
        icon: "x",
      };
    default:
      return {
        label: status || "Unknown",
        sublabel: "This receipt has an unrecognized status",
        color: "#a16207",
        bgColor: "#fef3c7",
        borderColor: "#fcd34d",
        icon: "alert",
      };
  }
}

// ===== SVG icons (inline — no external deps, render identically everywhere) =====
function svgIcon(kind: "check" | "x" | "alert", color: string): string {
  const size = 22;
  const stroke = `stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"`;
  const common = `width="${size}" height="${size}" viewBox="0 0 24 24" ${stroke}`;
  switch (kind) {
    case "check":
      return `<svg ${common}><circle cx="12" cy="12" r="10" stroke="${color}" stroke-width="2" fill="${color}11"/><path d="M8 12.5l2.5 2.5 5.5-6" stroke="${color}" stroke-width="2.5"/></svg>`;
    case "x":
      return `<svg ${common}><circle cx="12" cy="12" r="10" stroke="${color}" stroke-width="2" fill="${color}11"/><path d="M9 9l6 6M15 9l-6 6" stroke="${color}" stroke-width="2.5"/></svg>`;
    case "alert":
      return `<svg ${common}><circle cx="12" cy="12" r="10" stroke="${color}" stroke-width="2" fill="${color}11"/><path d="M12 8v5M12 16.5v.5" stroke="${color}" stroke-width="2.5"/></svg>`;
  }
}

// ===== HTML templates =====
function renderReceiptHtml(sale: any): string {
  const status = getStatusConfig(sale.status);
  const itemsHtml = (sale.items || []).map((item: any) => `
      <tr>
        <td style="padding:6px 8px;text-align:left;border-bottom:1px solid #f1f5f9">${escapeHtml(item.name || 'Item')}</td>
        <td style="padding:6px 8px;text-align:right;border-bottom:1px solid #f1f5f9">${Number(item.quantity) || 0}</td>
        <td style="padding:6px 8px;text-align:right;border-bottom:1px solid #f1f5f9;font-family:monospace">GHS ${(Number(item.total) || 0).toFixed(2)}</td>
      </tr>`).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Receipt ${escapeHtml(sale.invoiceNumber)}</title>
<style>
  *{box-sizing:border-box}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;margin:0;padding:20px;background:#f1f5f9;color:#1e293b}
  .card{max-width:420px;margin:0 auto;background:white;border-radius:20px;padding:0;box-shadow:0 10px 40px rgba(15,23,42,0.08);overflow:hidden}
  .header{background:linear-gradient(135deg,#059669,#0d9488);color:white;padding:24px 24px 20px;text-align:center}
  .brand{font-size:18px;font-weight:700;letter-spacing:-0.01em;margin:0 0 4px}
  .tagline{font-size:11px;opacity:0.85;margin:0 0 12px}
  .header-meta{font-size:11px;opacity:0.9;line-height:1.5}
  .status-badge{
    display:flex;align-items:center;gap:10px;
    padding:12px 16px;margin:20px 20px 0;
    background:${status.bgColor};border:1.5px solid ${status.borderColor};
    border-radius:12px;
  }
  .status-icon{flex-shrink:0;display:flex;align-items:center;justify-content:center}
  .status-text{flex:1;min-width:0}
  .status-label{font-size:15px;font-weight:700;color:${status.color};line-height:1.2;margin:0 0 2px}
  .status-sublabel{font-size:11px;color:${status.color}cc;line-height:1.3;margin:0}
  .body{padding:20px}
  .info-row{display:flex;justify-content:space-between;font-size:13px;color:#475569;padding:4px 0}
  .info-row strong{color:#1e293b;font-weight:600}
  .divider{border:none;border-top:1px dashed #cbd5e1;margin:14px 0}
  table{width:100%;border-collapse:collapse;margin:6px 0 14px}
  thead th{font-size:10px;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;padding:8px;border-bottom:2px solid #059669}
  thead th:first-child{text-align:left}
  thead th:nth-child(2),thead th:nth-child(3){text-align:right}
  .totals-row{display:flex;justify-content:space-between;font-size:13px;color:#475569;padding:3px 0}
  .grand-total{
    display:flex;justify-content:space-between;align-items:baseline;
    background:linear-gradient(135deg,#ecfdf5,#d1fae5);
    border-radius:12px;padding:14px 16px;margin-top:12px;
    border:1.5px solid #6ee7b7;
  }
  .grand-total-label{font-size:13px;font-weight:700;color:#065f46;text-transform:uppercase;letter-spacing:0.05em}
  .grand-total-value{font-size:22px;font-weight:800;color:#059669;font-family:monospace}
  .footer{text-align:center;padding:18px 20px 22px;background:#f8fafc;border-top:1px solid #e2e8f0}
  .footer-verified{font-size:11px;color:#64748b;margin:0 0 4px}
  .footer-verified strong{color:#15803d}
  .footer-merchant{font-size:10px;color:#94a3b8;margin:0}
  .qr-hint{font-size:10px;color:#cbd5e1;margin-top:8px}
</style>
</head>
<body>
  <div class="card">
    <!-- Merchant header -->
    <div class="header">
      <p class="brand">SYLHN COMPANY LTD</p>
      <p class="tagline">Your Trusted Grocery Partner</p>
      <div class="header-meta">
        Grocery Store · East Legon, Accra, Ghana<br>
        +233 59 276 6044
      </div>
    </div>

    <!-- Status badge — clearly defined, no emoji -->
    <div class="status-badge" role="status">
      <div class="status-icon">${svgIcon(status.icon, status.color)}</div>
      <div class="status-text">
        <p class="status-label">${escapeHtml(status.label)}</p>
        <p class="status-sublabel">${escapeHtml(status.sublabel)}</p>
      </div>
    </div>

    <!-- Receipt body -->
    <div class="body">
      <div class="info-row"><span>Invoice #</span><strong>${escapeHtml(sale.invoiceNumber)}</strong></div>
      <div class="info-row"><span>Date</span><strong>${sale.createdAt.toLocaleString('en-GB')}</strong></div>
      <div class="info-row"><span>Cashier</span><strong>${escapeHtml(sale.cashierName || 'N/A')}</strong></div>
      ${sale.customerName ? `<div class="info-row"><span>Customer</span><strong>${escapeHtml(sale.customerName)}</strong></div>` : ''}

      <hr class="divider">

      <table>
        <thead>
          <tr><th>Item</th><th>Qty</th><th>Total</th></tr>
        </thead>
        <tbody>${itemsHtml}</tbody>
      </table>

      <div class="totals-row"><span>Subtotal</span><span style="font-family:monospace">GHS ${(Number(sale.subtotal) || 0).toFixed(2)}</span></div>
      ${Number(sale.discount) > 0 ? `<div class="totals-row"><span>Discount</span><span style="font-family:monospace;color:#dc2626">-GHS ${(Number(sale.discount) || 0).toFixed(2)}</span></div>` : ''}
      <div class="totals-row"><span>VAT</span><span style="font-family:monospace">GHS ${(Number(sale.taxAmount) || 0).toFixed(2)}</span></div>

      <div class="grand-total">
        <span class="grand-total-label">Total Paid</span>
        <span class="grand-total-value">GHS ${(Number(sale.total) || 0).toFixed(2)}</span>
      </div>
    </div>

    <!-- Footer -->
    <div class="footer">
      <p class="footer-merchant">SYLHN POS · East Legon, Accra, Ghana</p>
      <p class="qr-hint">This page was reached by scanning the QR code on the printed receipt.</p>
      <p style="font-size:11px;color:#dc2626;font-weight:bold;margin-top:8px">Goods sold are not returnable.</p>
    </div>
  </div>
</body>
</html>`;
}

function renderNotFoundHtml(invoice: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Receipt Not Found</title>
<style>
  *{box-sizing:border-box}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;margin:0;padding:20px;background:#f1f5f9;color:#1e293b;min-height:100vh;display:flex;align-items:center;justify-content:center}
  .card{max-width:420px;width:100%;background:white;border-radius:20px;padding:0;box-shadow:0 10px 40px rgba(15,23,42,0.08);overflow:hidden}
  .status-badge{display:flex;align-items:center;gap:12px;padding:16px 20px;margin:24px;background:#fef3c7;border:1.5px solid #fcd34d;border-radius:12px}
  .status-label{font-size:16px;font-weight:700;color:#b45309;margin:0 0 4px}
  .status-sublabel{font-size:12px;color:#92400e;margin:0;line-height:1.4}
  .body{padding:0 24px 24px}
  .body p{font-size:13px;color:#475569;line-height:1.6;margin:0 0 8px}
  .body strong{color:#1e293b;font-family:monospace}
  .hint{font-size:11px;color:#94a3b8;margin-top:16px;padding-top:14px;border-top:1px solid #e2e8f0}
</style>
</head>
<body>
  <div class="card">
    <div class="status-badge" role="status">
      <div>${svgIcon("alert", "#b45309")}</div>
      <div>
        <p class="status-label">Receipt Not Found</p>
        <p class="status-sublabel">We could not find a receipt matching this invoice in our system.</p>
      </div>
    </div>
    <div class="body">
      <p>Searched for invoice: <strong>${escapeHtml(invoice || '(empty)')}</strong></p>
      <p>This can happen if:</p>
      <p>• The invoice number was mistyped or partially scanned<br>
         • The receipt was voided before being saved<br>
         • The sale was completed very recently and is still being processed</p>
      <p class="hint">If you believe this is an error, please contact SYLHN COMPANY LTD at +233 59 276 6044 with the invoice number above.</p>
    </div>
  </div>
</body>
</html>`;
}

function renderErrorHtml(message: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Verification Error</title>
<style>
  *{box-sizing:border-box}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;margin:0;padding:20px;background:#f1f5f9;color:#1e293b;min-height:100vh;display:flex;align-items:center;justify-content:center}
  .card{max-width:420px;width:100%;background:white;border-radius:20px;padding:0;box-shadow:0 10px 40px rgba(15,23,42,0.08);overflow:hidden}
  .status-badge{display:flex;align-items:center;gap:12px;padding:16px 20px;margin:24px;background:#fee2e2;border:1.5px solid #fca5a5;border-radius:12px}
  .status-label{font-size:16px;font-weight:700;color:#b91c1c;margin:0 0 4px}
  .status-sublabel{font-size:12px;color:#991b1b;margin:0;line-height:1.4;font-family:monospace;word-break:break-word}
  .body{padding:0 24px 24px}
  .body p{font-size:13px;color:#475569;line-height:1.6;margin:0}
</style>
</head>
<body>
  <div class="card">
    <div class="status-badge" role="status">
      <div>${svgIcon("x", "#b91c1c")}</div>
      <div>
        <p class="status-label">Verification Error</p>
        <p class="status-sublabel">${escapeHtml(message)}</p>
      </div>
    </div>
    <div class="body">
      <p>The system encountered an error while trying to verify this receipt. Please try again in a few moments, or contact SYLHN COMPANY LTD at +233 59 276 6044 if the problem persists.</p>
    </div>
  </div>
</body>
</html>`;
}

// Escape user-controlled strings before inserting into HTML to prevent XSS.
function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
