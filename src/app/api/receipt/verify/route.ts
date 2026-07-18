import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/receipt/verify?invoice=XXX&saleId=XXX
// Public endpoint (no auth required) — verifies a receipt by invoice number.
// Returns a simple HTML page showing the receipt details.
// This is the URL encoded in the QR code on receipts.
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
        `<!DOCTYPE html><html><head><title>Receipt Not Found</title>
        <style>
          body{font-family:Arial,sans-serif;text-align:center;padding:40px;background:#f8fafc}
          .card{max-width:400px;margin:0 auto;background:white;border-radius:16px;padding:32px;box-shadow:0 4px 12px rgba(0,0,0,0.1)}
          h1{color:#dc2626;font-size:20px}
          p{color:#64748b;font-size:14px}
          .icon{font-size:48px;margin-bottom:16px}
        </style></head><body>
        <div class="card">
          <div class="icon">⚠️</div>
          <h1>Receipt Not Found</h1>
          <p>Invoice <strong>${invoice}</strong> was not found in the system.</p>
          <p>This receipt may have been voided or the invoice number is incorrect.</p>
        </div>
        </body></html>`,
        { headers: { "Content-Type": "text/html" } }
      );
    }

    const itemsHtml = sale.items.map(item => `
      <tr>
        <td style="padding:4px 8px;text-align:left">${item.name}</td>
        <td style="padding:4px 8px;text-align:right">${item.quantity}</td>
        <td style="padding:4px 8px;text-align:right">GHS ${item.total.toFixed(2)}</td>
      </tr>`).join("");

    const statusColor = sale.status === "completed" ? "#16a34a" : sale.status === "voided" ? "#dc2626" : "#ca8a04";
    const statusText = sale.status === "completed" ? "✅ Valid Receipt" : sale.status === "voided" ? "❌ Voided" : sale.status;

    return new NextResponse(
      `<!DOCTYPE html><html><head><title>Receipt ${sale.invoiceNumber}</title>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        body{font-family:Arial,sans-serif;margin:0;padding:20px;background:#f8fafc}
        .card{max-width:400px;margin:0 auto;background:white;border-radius:16px;padding:24px;box-shadow:0 4px 12px rgba(0,0,0,0.1)}
        h1{font-size:18px;color:#059669;text-align:center;margin:0 0 8px}
        .status{text-align:center;font-size:14px;font-weight:bold;color:${statusColor};margin-bottom:16px;padding:8px;border-radius:8px;background:${statusColor}11}
        .info{font-size:13px;color:#475569;margin:4px 0}
        table{width:100%;border-collapse:collapse;margin:12px 0}
        th{border-bottom:2px solid #059669;padding:4px 8px;text-align:left;font-size:12px;color:#059669}
        td{font-size:13px;color:#334155}
        .total{font-size:16px;font-weight:bold;text-align:right;color:#059669;margin-top:8px}
        .footer{text-align:center;font-size:11px;color:#94a3b8;margin-top:16px}
      </style></head><body>
      <div class="card">
        <h1>SYLHN COMPANY LTD</h1>
        <div class="status">${statusText}</div>
        <div class="info"><strong>Invoice:</strong> ${sale.invoiceNumber}</div>
        <div class="info"><strong>Date:</strong> ${sale.createdAt.toLocaleString('en-GB')}</div>
        <div class="info"><strong>Cashier:</strong> ${sale.cashierName || 'N/A'}</div>
        ${sale.customerName ? `<div class="info"><strong>Customer:</strong> ${sale.customerName}</div>` : ''}
        <table>
          <thead><tr><th>Item</th><th style="text-align:right">Qty</th><th style="text-align:right">Total</th></tr></thead>
          <tbody>${itemsHtml}</tbody>
        </table>
        <div class="info" style="text-align:right">Subtotal: GHS ${sale.subtotal.toFixed(2)}</div>
        ${sale.discount > 0 ? `<div class="info" style="text-align:right">Discount: -GHS ${sale.discount.toFixed(2)}</div>` : ''}
        <div class="info" style="text-align:right">Tax: GHS ${sale.taxAmount.toFixed(2)}</div>
        <div class="total">TOTAL: GHS ${sale.total.toFixed(2)}</div>
        <div class="footer">This receipt was verified on ${new Date().toLocaleString('en-GB')}<br/>SYLHN POS · East Legon, Accra, Ghana</div>
      </div>
      </body></html>`,
      { headers: { "Content-Type": "text/html" } }
    );
  } catch (e: any) {
    return new NextResponse(
      `<!DOCTYPE html><html><head><title>Error</title></head><body>
      <h1>Verification Error</h1>
      <p>${e?.message || "Unknown error"}</p>
      </body></html>`,
      { status: 500, headers: { "Content-Type": "text/html" } }
    );
  }
}
