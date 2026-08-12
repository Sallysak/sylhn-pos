import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { COMPANY } from "@/lib/pos-data";

// GET /api/purchases/[id]/pdf
// Returns a branded HTML page optimized for printing / saving as PDF.
// The browser's print dialog (Ctrl+P / Cmd+P) has a "Save as PDF" option.
//
// This avoids the need for a server-side PDF library like @react-pdf/renderer
// or puppeteer — the user's browser does the rendering.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { await requireAuth(); } catch (e: any) { return e as Response; }

  const { id } = await params;

  let purchase = await db.purchase.findUnique({
    where: { id },
    include: {
      items: { include: { product: { select: { name: true, sku: true } } } },
      supplier: true,
      payments: { orderBy: { paymentDate: "desc" } },
      createdBy: { select: { fullName: true, username: true } },
      receivedBy: { select: { fullName: true, username: true } },
    },
  });
  if (!purchase) {
    purchase = await db.purchase.findUnique({
      where: { refNo: id },
      include: {
        items: { include: { product: { select: { name: true, sku: true } } } },
        supplier: true,
        payments: { orderBy: { paymentDate: "desc" } },
        createdBy: { select: { fullName: true, username: true } },
        receivedBy: { select: { fullName: true, username: true } },
      },
    });
  }
  if (!purchase) {
    return NextResponse.json({ error: "Purchase not found" }, { status: 404 });
  }

  const subtotal = Number(purchase.subtotal) || 0;
  const discount = Number(purchase.discount) || 0;
  const taxAmount = Number(purchase.taxAmount) || 0;
  const freight = Number(purchase.freightCost) || 0;
  const insurance = Number(purchase.insuranceCost) || 0;
  const customs = Number(purchase.customsDuty) || 0;
  const other = Number(purchase.otherLandedCosts) || 0;
  const landedCosts = freight + insurance + customs + other;
  const total = Number(purchase.total) || 0;
  const paid = Number(purchase.amountPaid) || 0;
  const due = total - paid;

  // Ghana tax breakdown (VAT 15%, NHIL 2.5%, GETFL 2.5%)
  const taxableAmount = subtotal - discount;
  const vat = taxableAmount * 0.15;
  const nhil = taxableAmount * 0.025;
  const getfl = taxableAmount * 0.025;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Purchase Order ${purchase.refNo} — ${COMPANY.name}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Roboto, -apple-system, sans-serif; background: #f0f4f8; padding: 20px; color: #1e293b; }
  .container { max-width: 800px; margin: 0 auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
  .header { background: linear-gradient(135deg, #059669, #0d9488); color: #fff; padding: 24px 32px; display: flex; justify-content: space-between; align-items: center; }
  .header h1 { font-size: 22px; font-weight: 800; }
  .header .subtitle { font-size: 12px; opacity: 0.85; margin-top: 2px; }
  .header-right { text-align: right; font-size: 11px; opacity: 0.85; }
  .header-right .po-number { font-size: 18px; font-weight: 800; opacity: 1; }
  .status-badge { display: inline-block; padding: 3px 10px; border-radius: 4px; font-size: 10px; font-weight: 700; text-transform: uppercase; margin-top: 4px; background: rgba(255,255,255,0.2); }
  .body { padding: 24px 32px; }
  .actions { text-align: center; margin-bottom: 16px; }
  .btn { padding: 8px 20px; border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer; border: none; background: #1e293b; color: #fff; }
  .btn:hover { background: #334155; }
  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
  .section-title { font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 8px; padding-bottom: 4px; border-bottom: 2px solid #e2e8f0; }
  .info-item { display: flex; justify-content: space-between; padding: 3px 0; font-size: 11px; }
  .info-item .label { color: #64748b; }
  .info-item .value { font-weight: 600; }
  .meta-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 16px; padding: 12px; background: #f8fafc; border-radius: 8px; }
  .meta-item .meta-label { font-size: 8px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.04em; }
  .meta-item .meta-value { font-size: 11px; font-weight: 700; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; font-size: 10px; margin-bottom: 16px; }
  thead th { background: #1e293b; color: #fff; padding: 8px; font-size: 9px; text-transform: uppercase; letter-spacing: 0.04em; font-weight: 600; text-align: left; }
  thead th.right { text-align: right; }
  thead th.center { text-align: center; }
  tbody td { padding: 6px 8px; border-bottom: 1px solid #e2e8f0; }
  tbody tr:nth-child(even) { background: #f8fafc; }
  td.right { text-align: right; font-family: 'SF Mono', Consolas, monospace; }
  td.center { text-align: center; }
  .totals-block { margin-left: auto; width: 300px; font-size: 11px; }
  .totals-block .total-row { display: flex; justify-content: space-between; padding: 4px 0; }
  .totals-block .total-row.bold { font-weight: 800; font-size: 13px; border-top: 2px solid #1e293b; margin-top: 4px; padding-top: 8px; }
  .totals-block .total-row.due { color: #dc2626; }
  .tax-breakdown { font-size: 9px; color: #64748b; margin-top: 4px; padding-left: 8px; }
  .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; margin-top: 48px; }
  .sig-block { border-top: 1px solid #1e293b; padding-top: 6px; }
  .sig-label { font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase; }
  .sig-name { font-size: 11px; font-weight: 700; margin-top: 2px; }
  .footer { padding: 12px 32px; background: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center; font-size: 9px; color: #94a3b8; }
  @media print {
    body { background: #fff; padding: 0; font-size: 10px; }
    .container { box-shadow: none; border-radius: 0; max-width: 100%; }
    .actions { display: none; }
    .body { padding: 16px 24px; }
    .header { padding: 16px 24px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    thead th { background: #1e293b !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    tbody tr:nth-child(even) { background: #f8fafc !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    @page { margin: 12mm; }
  }
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <div>
      <h1>${COMPANY.name}</h1>
      <div class="subtitle">${COMPANY.address} · ${COMPANY.contact}</div>
    </div>
    <div class="header-right">
      <div class="po-number">${purchase.refNo}</div>
      <div>${new Date(purchase.createdAt).toLocaleDateString("en-GB")}</div>
      <div class="status-badge">${purchase.status.toUpperCase()}</div>
    </div>
  </div>
  <div class="body">
    <div class="actions">
      <button class="btn" onclick="window.print()">Print / Save as PDF</button>
    </div>

    <div class="two-col">
      <div>
        <div class="section-title">Supplier</div>
        <div style="font-size:12px;font-weight:700;margin-bottom:4px">${purchase.supplier?.name || purchase.supplierName}</div>
        ${purchase.supplier?.contactName ? `<div style="font-size:10px;color:#64748b">${purchase.supplier.contactName}</div>` : ''}
        ${purchase.supplier?.address ? `<div style="font-size:10px;color:#64748b">${purchase.supplier.address}</div>` : ''}
        ${purchase.supplier?.city ? `<div style="font-size:10px;color:#64748b">${purchase.supplier.city}</div>` : ''}
        ${purchase.supplier?.phone ? `<div style="font-size:10px;color:#64748b">${purchase.supplier.phone}</div>` : ''}
        ${purchase.supplier?.email ? `<div style="font-size:10px;color:#64748b">${purchase.supplier.email}</div>` : ''}
      </div>
      <div>
        <div class="section-title">Order Info</div>
        <div class="info-item"><span class="label">Reference:</span><span class="value">${purchase.refNo}</span></div>
        <div class="info-item"><span class="label">Order Date:</span><span class="value">${new Date(purchase.createdAt).toLocaleDateString("en-GB")}</span></div>
        <div class="info-item"><span class="label">Payment Terms:</span><span class="value">${purchase.supplier?.tradingTerms || "Net 30"}</span></div>
        <div class="info-item"><span class="label">Currency:</span><span class="value">${purchase.currency}</span></div>
        ${purchase.expectedAt ? `<div class="info-item"><span class="label">Expected:</span><span class="value">${new Date(purchase.expectedAt).toLocaleDateString("en-GB")}</span></div>` : ''}
        <div class="info-item"><span class="label">Created By:</span><span class="value">${purchase.createdBy?.fullName || "—"}</span></div>
      </div>
    </div>

    <div class="meta-row">
      <div class="meta-item"><div class="meta-label">Type</div><div class="meta-value">${purchase.type}</div></div>
      <div class="meta-item"><div class="meta-label">Status</div><div class="meta-value">${purchase.status}</div></div>
      <div class="meta-item"><div class="meta-label">Items</div><div class="meta-value">${purchase.items.length}</div></div>
      <div class="meta-item"><div class="meta-label">Total Qty</div><div class="meta-value">${purchase.items.reduce((s: number, i: any) => s + Number(i.quantity) + Number(i.freeQuantity || 0), 0)}</div></div>
    </div>

    <table>
      <thead><tr>
        <th style="width:30px">#</th>
        <th>Part No</th>
        <th>Description</th>
        <th class="right">Qty</th>
        <th class="right">Cost</th>
        <th class="right">Disc</th>
        <th class="right">Tax</th>
        <th class="right">Total</th>
      </tr></thead>
      <tbody>
        ${purchase.items.map((item: any, i: number) => {
          const gross = Number(item.quantity) * Number(item.cost);
          const disc = Number(item.discountAmount) || 0;
          const tax = Number(item.taxAmount) || 0;
          const lineTotal = Number(item.total) || (gross - disc + tax);
          return `<tr>
            <td class="center">${i + 1}</td>
            <td style="font-family:monospace">${item.partNo}</td>
            <td>${item.details}${item.batchNumber ? ` <span style="color:#64748b;font-size:8px">(batch: ${item.batchNumber})</span>` : ''}</td>
            <td class="right">${item.quantity}${item.freeQuantity ? ` +${item.freeQuantity}` : ''}</td>
            <td class="right">${Number(item.cost).toFixed(2)}</td>
            <td class="right">${disc > 0 ? `−${disc.toFixed(2)}` : '—'}</td>
            <td class="right">${tax > 0 ? tax.toFixed(2) : '—'}</td>
            <td class="right" style="font-weight:700">${lineTotal.toFixed(2)}</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>

    <div class="totals-block">
      <div class="total-row"><span>Subtotal</span><span>₵${subtotal.toFixed(2)}</span></div>
      ${discount > 0 ? `<div class="total-row"><span>Discount</span><span style="color:#059669">−₵${discount.toFixed(2)}</span></div>` : ''}
      <div class="total-row"><span>Tax</span><span>₵${taxAmount.toFixed(2)}</span></div>
      <div class="tax-breakdown">
        VAT 15%: ₵${vat.toFixed(2)} · NHIL 2.5%: ₵${nhil.toFixed(2)} · GETFL 2.5%: ₵${getfl.toFixed(2)}
      </div>
      ${landedCosts > 0 ? `<div class="total-row"><span>Landed Costs</span><span>₵${landedCosts.toFixed(2)}</span></div>` : ''}
      <div class="total-row bold"><span>Grand Total</span><span>₵${total.toFixed(2)}</span></div>
      ${paid > 0 ? `<div class="total-row"><span>Paid</span><span>₵${paid.toFixed(2)}</span></div>` : ''}
      ${due > 0 ? `<div class="total-row bold due"><span>Amount Due</span><span>₵${due.toFixed(2)}</span></div>` : ''}
    </div>

    <div class="signatures">
      <div class="sig-block">
        <div class="sig-label">Prepared By</div>
        <div class="sig-name">${purchase.createdBy?.fullName || "—"}</div>
      </div>
      <div class="sig-block">
        <div class="sig-label">Authorised By (Supplier)</div>
        <div class="sig-name">&nbsp;</div>
      </div>
    </div>
  </div>

  <div class="footer">
    ${COMPANY.name} · ${COMPANY.address} · ${COMPANY.contact} · Generated ${new Date().toLocaleString("en-GB")}
  </div>
</div>
<script>setTimeout(function(){window.print();},300);</script>
</body>
</html>`;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
