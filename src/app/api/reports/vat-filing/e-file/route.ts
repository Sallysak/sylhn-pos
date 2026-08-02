import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requirePermission } from "@/lib/auth";
import { rateLimitApiRead, rateLimitResponse, getClientIp } from "@/lib/rate-limit";
import { auditLog } from "@/lib/audit";

// GET /api/reports/vat-filing/e-file?year=2026&month=7&format=html|json|xml|print
//
// Generates a GRA e-VAT filing document.
//   - html:  Styled, self-contained HTML report (viewable in browser, print-ready)
//   - print:  Same as html but auto-triggers window.print()
//   - json:  Machine-readable JSON (for API integration)
//   - xml:    GRA-compatible XML (for portal upload)
export async function GET(req: NextRequest) {
  let user;
  try {
    user = await requireAuth();
    requirePermission(user.role, "accounts");
  } catch (e) { return e as Response; }

  const ip = getClientIp(req);
  const rl = rateLimitApiRead(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  try {
    const { searchParams } = new URL(req.url);
    const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()), 10);
    const month = parseInt(searchParams.get("month") || String(new Date().getMonth() + 1), 10);
    const format = (searchParams.get("format") || "html").toLowerCase();

    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
      return NextResponse.json({ error: "Invalid year/month" }, { status: 400 });
    }

    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);
    const monthName = startOfMonth.toLocaleString("en", { month: "long" });

    // Fetch settings
    const settings = await db.systemSetting.findMany();
    const getSetting = (key: string) => settings.find(s => s.key === key)?.value || "";
    const taxpayerTin = getSetting("tax.tin") || "PENDING-REGISTRATION";
    const taxpayerName = getSetting("companyName") || "SYLHN COMPANY LTD";
    const taxpayerAddress = getSetting("company.address") || "East Legon, Accra, Ghana";
    const taxpayerPhone = getSetting("company.phone") || "+233 59 276 6044";

    // Output VAT (sales)
    const sales = await db.sale.findMany({
      where: { status: "completed", createdAt: { gte: startOfMonth, lte: endOfMonth } },
      select: { subtotal: true, taxAmount: true, total: true, paymentMethod: true, invoiceNumber: true, createdAt: true, cashierName: true },
    });
    const outputVat = sales.reduce((s, x) => s + (x.taxAmount || 0), 0);
    const taxableSales = sales.reduce((s, x) => s + (x.subtotal || 0), 0);
    const totalSales = sales.reduce((s, x) => s + (x.total || 0), 0);

    // Input VAT (purchases)
    const purchases = await db.purchase.findMany({
      where: { status: "received", createdAt: { gte: startOfMonth, lte: endOfMonth } },
      select: { subtotal: true, taxAmount: true, total: true, refNo: true, supplierName: true, createdAt: true },
    });
    const inputVat = purchases.reduce((s, x) => s + (x.taxAmount || 0), 0);
    const taxablePurchases = purchases.reduce((s, x) => s + (x.subtotal || 0), 0);

    // NHIL 2.5% + GETFL 1% + VAT 12.5% = 15% total
    const nhilRate = 0.025, getflRate = 0.01, vatRate = 0.125;
    const nhilOutput = Math.round(taxableSales * nhilRate * 100) / 100;
    const getflOutput = Math.round(taxableSales * getflRate * 100) / 100;
    const vatOutput = Math.round((taxableSales + nhilOutput + getflOutput) * vatRate * 100) / 100;
    const nhilInput = taxablePurchases * nhilRate;
    const getflInput = taxablePurchases * getflRate;
    const vatInput = taxablePurchases * vatRate;
    const netVatPayable = outputVat - inputVat;

    // Audit
    await auditLog({
      userId: user.uid, user: user.username, action: "VAT_EFILE_EXPORT", module: "accounts",
      details: `Exported GRA e-VAT ${format.toUpperCase()} for ${year}-${String(month).padStart(2, "0")}`,
      severity: "warning", ipAddress: ip, userAgent: req.headers.get("user-agent") || "",
    }).catch(() => {});

    // ===== JSON format =====
    if (format === "json") {
      const doc = {
        filing: {
          taxpayer: { tin: taxpayerTin, name: taxpayerName, address: taxpayerAddress, phone: taxpayerPhone },
          period: { year, month, startDate: startOfMonth.toISOString().split("T")[0], endDate: endOfMonth.toISOString().split("T")[0] },
          currency: "GHS",
          summary: { taxableSales: taxableSales.toFixed(2), outputVat: outputVat.toFixed(2), taxablePurchases: taxablePurchases.toFixed(2), inputVat: inputVat.toFixed(2), netVatPayable: netVatPayable.toFixed(2) },
          breakdown: { nhil: { rate: "2.5%", output: nhilOutput.toFixed(2), input: nhilInput.toFixed(2) }, getfl: { rate: "1.0%", output: getflOutput.toFixed(2), input: getflInput.toFixed(2) }, vat: { rate: "12.5%", output: vatOutput.toFixed(2), input: vatInput.toFixed(2) } },
          transactionCounts: { sales: sales.length, purchases: purchases.length },
          sales: sales.map(s => ({ invoice: s.invoiceNumber, date: s.createdAt.toISOString().split("T")[0], subtotal: s.subtotal.toFixed(2), vat: (s.taxAmount || 0).toFixed(2), total: s.total.toFixed(2) })),
          purchases: purchases.map(p => ({ ref: p.refNo, date: p.createdAt.toISOString().split("T")[0], supplier: p.supplierName, subtotal: p.subtotal.toFixed(2), vat: (p.taxAmount || 0).toFixed(2), total: p.total.toFixed(2) })),
          generatedAt: new Date().toISOString(), generatedBy: user.username,
        },
      };
      return new NextResponse(JSON.stringify(doc, null, 2), {
        headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="gra-vat-${year}-${String(month).padStart(2, "0")}.json"` },
      });
    }

    // ===== XML format (with XSLT for styled browser view) =====
    if (format === "xml") {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet type="text/xsl" href="/api/reports/vat-filing/e-file?format=xslt"?>
<GRA_VAT_Filing xmlns="https://gra.gov.gh/vat-filing/v1">
  <Taxpayer><TIN>${esc(taxpayerTin)}</TIN><Name>${esc(taxpayerName)}</Name><Address>${esc(taxpayerAddress)}</Address><Phone>${esc(taxpayerPhone)}</Phone></Taxpayer>
  <Period><Year>${year}</Year><Month>${month}</Month><StartDate>${startOfMonth.toISOString().split("T")[0]}</StartDate><EndDate>${endOfMonth.toISOString().split("T")[0]}</EndDate></Period>
  <Currency>GHS</Currency>
  <Summary><TaxableSales>${taxableSales.toFixed(2)}</TaxableSales><OutputVAT>${outputVat.toFixed(2)}</OutputVAT><TaxablePurchases>${taxablePurchases.toFixed(2)}</TaxablePurchases><InputVAT>${inputVat.toFixed(2)}</InputVAT><NetVATPayable>${netVatPayable.toFixed(2)}</NetVATPayable></Summary>
  <Breakdown><NHIL><Rate>2.5%</Rate><Output>${nhilOutput.toFixed(2)}</Output><Input>${nhilInput.toFixed(2)}</Input></NHIL><GETFL><Rate>1.0%</Rate><Output>${getflOutput.toFixed(2)}</Output><Input>${getflInput.toFixed(2)}</Input></GETFL><VAT><Rate>12.5%</Rate><Output>${vatOutput.toFixed(2)}</Output><Input>${vatInput.toFixed(2)}</Input></VAT></Breakdown>
  <TransactionCounts><Sales>${sales.length}</Sales><Purchases>${purchases.length}</Purchases></TransactionCounts>
  <GeneratedAt>${new Date().toISOString()}</GeneratedAt><GeneratedBy>${esc(user.username)}</GeneratedBy>
</GRA_VAT_Filing>`;
      return new NextResponse(xml, {
        headers: { "Content-Type": "application/xml; charset=utf-8", "Content-Disposition": `attachment; filename="gra-vat-${year}-${String(month).padStart(2, "0")}.xml"` },
      });
    }

    // ===== HTML format (default — clean, styled, print-ready) =====
    const html = renderHtmlReport({
      taxpayerTin, taxpayerName, taxpayerAddress, taxpayerPhone,
      year, month, monthName,
      startDate: startOfMonth.toISOString().split("T")[0],
      endDate: endOfMonth.toISOString().split("T")[0],
      taxableSales, outputVat, taxablePurchases, inputVat, netVatPayable,
      totalSales, nhilOutput, getflOutput, vatOutput, nhilInput, getflInput, vatInput,
      salesCount: sales.length, purchasesCount: purchases.length,
      salesData: sales, purchasesData: purchases,
      generatedBy: user.username,
      autoPrint: format === "print",
    });

    return new NextResponse(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function fmt(n: number): string {
  return n.toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function renderHtmlReport(d: {
  taxpayerTin: string; taxpayerName: string; taxpayerAddress: string; taxpayerPhone: string;
  year: number; month: number; monthName: string; startDate: string; endDate: string;
  taxableSales: number; outputVat: number; taxablePurchases: number; inputVat: number; netVatPayable: number;
  totalSales: number; nhilOutput: number; getflOutput: number; vatOutput: number;
  nhilInput: number; getflInput: number; vatInput: number;
  salesCount: number; purchasesCount: number;
  salesData: any[]; purchasesData: any[];
  generatedBy: string; autoPrint: boolean;
}): string {
  const salesRows = d.salesData.map((s, i) => `
    <tr class="${i % 2 ? 'alt' : ''}">
      <td>${s.invoiceNumber || '—'}</td>
      <td>${s.createdAt.toISOString().split('T')[0]}</td>
      <td style="text-align:right">${fmt(s.subtotal)}</td>
      <td style="text-align:right">${fmt(s.taxAmount || 0)}</td>
      <td style="text-align:right;font-weight:600">${fmt(s.total)}</td>
    </tr>`).join('');

  const purchaseRows = d.purchasesData.map((p, i) => `
    <tr class="${i % 2 ? 'alt' : ''}">
      <td>${p.refNo || '—'}</td>
      <td>${p.createdAt.toISOString().split('T')[0]}</td>
      <td>${esc(p.supplierName || '—')}</td>
      <td style="text-align:right">${fmt(p.subtotal)}</td>
      <td style="text-align:right">${fmt(p.taxAmount || 0)}</td>
      <td style="text-align:right;font-weight:600">${fmt(p.total)}</td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>GRA VAT Filing — ${d.monthName} ${d.year}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Segoe UI',Roboto,-apple-system,BlinkMacSystemFont,sans-serif; background:#f0f4f8; color:#1e293b; padding:24px; line-height:1.5; }
  .container { max-width:900px; margin:0 auto; background:#fff; border-radius:16px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,0.08); }
  .header { background:linear-gradient(135deg,#0f766e,#059669); color:#fff; padding:32px; text-align:center; }
  .header h1 { font-size:24px; font-weight:800; letter-spacing:-0.02em; }
  .header .subtitle { font-size:13px; opacity:0.85; margin-top:6px; }
  .header .badge { display:inline-block; background:rgba(255,255,255,0.2); padding:4px 14px; border-radius:20px; font-size:11px; font-weight:600; margin-top:10px; letter-spacing:0.05em; text-transform:uppercase; }
  .body { padding:32px; }
  .section { margin-bottom:28px; }
  .section-title { font-size:12px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:0.08em; margin-bottom:12px; padding-bottom:6px; border-bottom:2px solid #e2e8f0; }
  .info-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px 24px; }
  .info-item { display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px solid #f1f5f9; }
  .info-item .label { color:#64748b; font-size:13px; }
  .info-item .value { font-weight:600; font-size:13px; }
  .summary-cards { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; margin-bottom:20px; }
  .card { padding:16px; border-radius:10px; text-align:center; }
  .card .label { font-size:10px; font-weight:600; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:6px; opacity:0.8; }
  .card .value { font-size:20px; font-weight:800; font-family:'SF Mono',Consolas,monospace; }
  .card.green { background:#ecfdf5; color:#065f46; }
  .card.blue { background:#eff6ff; color:#1e40af; }
  .card.red { background:#fef2f2; color:#991b1b; }
  table { width:100%; border-collapse:collapse; margin-bottom:16px; font-size:12px; }
  thead th { background:#1e293b; color:#fff; padding:8px 10px; text-align:left; font-size:10px; text-transform:uppercase; letter-spacing:0.05em; }
  tbody td { padding:7px 10px; border-bottom:1px solid #e2e8f0; }
  tbody tr.alt { background:#f8fafc; }
  tfoot td { padding:8px 10px; border-top:2px solid #1e293b; font-weight:700; }
  .breakdown-table td { padding:8px 10px; }
  .net-payable { background:linear-gradient(135deg,#fef2f2,#fee2e2); border:2px solid #f87171; border-radius:10px; padding:16px; display:flex; justify-content:space-between; align-items:center; margin-top:12px; }
  .net-payable .label { font-size:14px; font-weight:700; color:#991b1b; text-transform:uppercase; letter-spacing:0.05em; }
  .net-payable .value { font-size:28px; font-weight:900; color:#dc2626; font-family:'SF Mono',Consolas,monospace; }
  .footer { padding:20px 32px; background:#f8fafc; border-top:1px solid #e2e8f0; text-align:center; font-size:11px; color:#94a3b8; }
  .footer a { color:#059669; text-decoration:none; font-weight:600; }
  .actions { display:flex; gap:8px; justify-content:center; margin-bottom:20px; }
  .btn { padding:8px 18px; border-radius:8px; font-size:12px; font-weight:600; cursor:pointer; border:none; text-decoration:none; display:inline-flex; align-items:center; gap:6px; }
  .btn-print { background:#1e293b; color:#fff; }
  .btn-json { background:#eff6ff; color:#1e40af; }
  .btn-xml { background:#fef2f2; color:#991b1b; }
  .note { background:#fffbeb; border:1px solid #fcd34d; border-radius:8px; padding:12px; font-size:11px; color:#92400e; margin-bottom:16px; }
  @media print { body { background:#fff; padding:0; } .container { box-shadow:none; border-radius:0; } .actions, .note { display:none; } }
  ${d.autoPrint ? 'window.onload=function(){window.print();}' : ''}
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <h1>GRA VAT Filing Report</h1>
    <div class="subtitle">Ghana Revenue Authority — Electronic VAT Return</div>
    <div class="badge">${d.monthName} ${d.year}</div>
  </div>
  <div class="body">
    <div class="actions">
      <button class="btn btn-print" onclick="window.print()">🖨 Print / Save as PDF</button>
      <a class="btn btn-json" href="/api/reports/vat-filing/e-file?year=${d.year}&month=${d.month}&format=json">⬇ JSON</a>
      <a class="btn btn-xml" href="/api/reports/vat-filing/e-file?year=${d.year}&month=${d.month}&format=xml">⬇ XML</a>
    </div>

    <div class="note">
      <strong>📋 Filing Instructions:</strong> This report summarizes VAT collected and paid for the period ${d.startDate} to ${d.endDate}. File your return at <strong>https://etaxes.gra.gov.gh</strong> by the 15th of the following month. Use the JSON/XML exports for portal upload if available.
    </div>

    <div class="section">
      <div class="section-title">Taxpayer Information</div>
      <div class="info-grid">
        <div class="info-item"><span class="label">Taxpayer Name</span><span class="value">${esc(d.taxpayerName)}</span></div>
        <div class="info-item"><span class="label">TIN</span><span class="value">${esc(d.taxpayerTin)}</span></div>
        <div class="info-item"><span class="label">Address</span><span class="value">${esc(d.taxpayerAddress)}</span></div>
        <div class="info-item"><span class="label">Phone</span><span class="value">${esc(d.taxpayerPhone)}</span></div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Filing Period</div>
      <div class="info-grid">
        <div class="info-item"><span class="label">Period</span><span class="value">${d.monthName} ${d.year}</span></div>
        <div class="info-item"><span class="label">Start Date</span><span class="value">${d.startDate}</span></div>
        <div class="info-item"><span class="label">End Date</span><span class="value">${d.endDate}</span></div>
        <div class="info-item"><span class="label">Currency</span><span class="value">GHS (Ghana Cedi)</span></div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">VAT Summary</div>
      <div class="summary-cards">
        <div class="card green"><div class="label">Taxable Sales</div><div class="value">₵${fmt(d.taxableSales)}</div></div>
        <div class="card green"><div class="label">Output VAT</div><div class="value">₵${fmt(d.outputVat)}</div></div>
        <div class="card blue"><div class="label">Input VAT</div><div class="value">₵${fmt(d.inputVat)}</div></div>
      </div>
      <div class="summary-cards">
        <div class="card blue"><div class="label">Taxable Purchases</div><div class="value">₵${fmt(d.taxablePurchases)}</div></div>
        <div class="card green"><div class="label">Total Sales</div><div class="value">₵${fmt(d.totalSales)}</div></div>
        <div class="card red"><div class="label">Transactions</div><div class="value">${d.salesCount + d.purchasesCount}</div></div>
      </div>
      <div class="net-payable">
        <span class="label">Net VAT Payable to GRA</span>
        <span class="value">₵${fmt(d.netVatPayable)}</span>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Tax Breakdown (NHIL / GETFL / VAT)</div>
      <table>
        <thead><tr><th>Component</th><th style="text-align:right">Rate</th><th style="text-align:right">Output (Sales)</th><th style="text-align:right">Input (Purchases)</th><th style="text-align:right">Net</th></tr></thead>
        <tbody>
          <tr><td>NHIL</td><td style="text-align:right">2.5%</td><td style="text-align:right">${fmt(d.nhilOutput)}</td><td style="text-align:right">${fmt(d.nhilInput)}</td><td style="text-align:right;font-weight:600">${fmt(d.nhilOutput - d.nhilInput)}</td></tr>
          <tr class="alt"><td>GETFL</td><td style="text-align:right">1.0%</td><td style="text-align:right">${fmt(d.getflOutput)}</td><td style="text-align:right">${fmt(d.getflInput)}</td><td style="text-align:right;font-weight:600">${fmt(d.getflOutput - d.getflInput)}</td></tr>
          <tr><td>VAT</td><td style="text-align:right">12.5%</td><td style="text-align:right">${fmt(d.vatOutput)}</td><td style="text-align:right">${fmt(d.vatInput)}</td><td style="text-align:right;font-weight:600">${fmt(d.vatOutput - d.vatInput)}</td></tr>
        </tbody>
        <tfoot><tr><td colspan="2">Total</td><td style="text-align:right">${fmt(d.outputVat)}</td><td style="text-align:right">${fmt(d.inputVat)}</td><td style="text-align:right">₵${fmt(d.netVatPayable)}</td></tr></tfoot>
      </table>
    </div>

    ${d.salesData.length > 0 ? `
    <div class="section">
      <div class="section-title">Sales Transactions (${d.salesCount})</div>
      <table>
        <thead><tr><th>Invoice</th><th>Date</th><th style="text-align:right">Subtotal</th><th style="text-align:right">VAT</th><th style="text-align:right">Total</th></tr></thead>
        <tbody>${salesRows}</tbody>
        <tfoot><tr><td colspan="2">Total</td><td style="text-align:right">${fmt(d.taxableSales)}</td><td style="text-align:right">${fmt(d.outputVat)}</td><td style="text-align:right">${fmt(d.totalSales)}</td></tr></tfoot>
      </table>
    </div>` : ''}

    ${d.purchasesData.length > 0 ? `
    <div class="section">
      <div class="section-title">Purchase Transactions (${d.purchasesCount})</div>
      <table>
        <thead><tr><th>Ref No</th><th>Date</th><th>Supplier</th><th style="text-align:right">Subtotal</th><th style="text-align:right">VAT</th><th style="text-align:right">Total</th></tr></thead>
        <tbody>${purchaseRows}</tbody>
        <tfoot><tr><td colspan="3">Total</td><td style="text-align:right">${fmt(d.taxablePurchases)}</td><td style="text-align:right">${fmt(d.inputVat)}</td><td style="text-align:right">${fmt(d.taxablePurchases + d.inputVat)}</td></tr></tfoot>
      </table>
    </div>` : ''}
  </div>

  <div class="footer">
    Generated on ${new Date().toLocaleString('en-GB')} by <strong>${esc(d.generatedBy)}</strong> · SYLHN POS v2.0<br>
    This report is for filing reference only. Official submission must be made via the GRA e-Tax portal at <a href="https://etaxes.gra.gov.gh" target="_blank">etaxes.gra.gov.gh</a>
  </div>
</div>
${d.autoPrint ? '<script>window.onload=function(){setTimeout(function(){window.print();},300);}</script>' : ''}
</body>
</html>`;
}
