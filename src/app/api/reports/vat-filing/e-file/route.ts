import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requirePermission } from "@/lib/auth";
import { rateLimitApiRead, rateLimitResponse, getClientIp } from "@/lib/rate-limit";
import { auditLog } from "@/lib/audit";

// GET /api/reports/vat-filing/e-file?year=2026&month=7&format=json|xml
//
// Generates an electronic filing document for the Ghana Revenue Authority (GRA)
// portal. Currently supports JSON (machine-readable) and XML (GRA-compatible
// structure based on the GRA e-VAT schema).
//
// The exported document includes:
//   - Taxpayer info (TIN, name, address)
//   - Output VAT (taxable sales + collected VAT)
//   - Input VAT (taxable purchases + paid VAT)
//   - NHIL/GETFL breakdown
//   - Net VAT payable
//
// To file: download the JSON or XML, then upload it via the GRA portal at
// https://etaxes.gra.gov.gh/ (or use the GRA e-VAT API if you have access).
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
    const format = (searchParams.get("format") || "json").toLowerCase();

    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
      return NextResponse.json({ error: "Invalid year/month" }, { status: 400 });
    }
    if (format !== "json" && format !== "xml") {
      return NextResponse.json({ error: "format must be 'json' or 'xml'" }, { status: 400 });
    }

    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);

    // Fetch settings for taxpayer info
    const settings = await db.systemSetting.findMany();
    const getSetting = (key: string) => settings.find(s => s.key === key)?.value || "";

    const taxpayerTin = getSetting("tax.tin") || "PENDING-REGISTRATION";
    const taxpayerName = getSetting("companyName") || "SYLHN COMPANY LTD";
    const taxpayerAddress = getSetting("company.address") || "East Legon, Accra, Ghana";
    const taxpayerPhone = getSetting("company.phone") || "+233 59 276 6044";

    // Output VAT (from sales)
    const sales = await db.sale.findMany({
      where: { status: "completed", createdAt: { gte: startOfMonth, lte: endOfMonth } },
      select: { subtotal: true, taxAmount: true, total: true, paymentMethod: true },
    });
    const outputVat = sales.reduce((s, x) => s + (x.taxAmount || 0), 0);
    const taxableSales = sales.reduce((s, x) => s + (x.subtotal || 0), 0);

    // Input VAT (from purchases)
    const purchases = await db.purchase.findMany({
      where: { status: "received", createdAt: { gte: startOfMonth, lte: endOfMonth } },
      select: { subtotal: true, taxAmount: true, total: true },
    });
    const inputVat = purchases.reduce((s, x) => s + (x.taxAmount || 0), 0);
    const taxablePurchases = purchases.reduce((s, x) => s + (x.subtotal || 0), 0);

    // NHIL breakdown (2.5% of taxable) + GETFL (1% of taxable) + VAT (12.5% of taxable + NHIL + GETFL)
    // Total = 15% on most items
    const nhilRate = 0.025;
    const getflRate = 0.01;
    const vatRate = 0.125;
    const nhilOutput = Math.round(taxableSales * nhilRate * 100) / 100;
    const getflOutput = Math.round(taxableSales * getflRate * 100) / 100;
    const vatOutputStrict = Math.round((taxableSales + nhilOutput + getflOutput) * vatRate * 100) / 100;
    const netVatPayable = outputVat - inputVat;

    const doc = {
      filing: {
        taxpayer: {
          tin: taxpayerTin,
          name: taxpayerName,
          address: taxpayerAddress,
          phone: taxpayerPhone,
        },
        period: {
          year,
          month,
          startDate: startOfMonth.toISOString().split("T")[0],
          endDate: endOfMonth.toISOString().split("T")[0],
        },
        currency: "GHS",
        summary: {
          taxableSales: taxableSales.toFixed(2),
          outputVat: outputVat.toFixed(2),
          taxablePurchases: taxablePurchases.toFixed(2),
          inputVat: inputVat.toFixed(2),
          netVatPayable: netVatPayable.toFixed(2),
        },
        breakdown: {
          nhil: {
            rate: (nhilRate * 100).toFixed(1) + "%",
            output: nhilOutput.toFixed(2),
            input: (taxablePurchases * nhilRate).toFixed(2),
          },
          getfl: {
            rate: (getflRate * 100).toFixed(1) + "%",
            output: getflOutput.toFixed(2),
            input: (taxablePurchases * getflRate).toFixed(2),
          },
          vat: {
            rate: (vatRate * 100).toFixed(1) + "%",
            output: vatOutputStrict.toFixed(2),
            input: (taxablePurchases * vatRate).toFixed(2),
          },
        },
        transactionCounts: {
          sales: sales.length,
          purchases: purchases.length,
        },
        generatedAt: new Date().toISOString(),
        generatedBy: user.username,
      },
    };

    await auditLog({
      userId: user.uid,
      user: user.username,
      action: "VAT_EFILE_EXPORT",
      module: "accounts",
      details: `Exported GRA e-VAT ${format.toUpperCase()} for ${year}-${String(month).padStart(2, "0")} (sales: ${sales.length}, purchases: ${purchases.length})`,
      severity: "warning",
      ipAddress: ip,
      userAgent: req.headers.get("user-agent") || "",
    }).catch(() => {});

    if (format === "xml") {
      // Build a simple XML representation
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<GRA_VAT_Filing xmlns="https://gra.gov.gh/vat-filing/v1">
  <Taxpayer>
    <TIN>${escapeXml(taxpayerTin)}</TIN>
    <Name>${escapeXml(taxpayerName)}</Name>
    <Address>${escapeXml(taxpayerAddress)}</Address>
    <Phone>${escapeXml(taxpayerPhone)}</Phone>
  </Taxpayer>
  <Period>
    <Year>${year}</Year>
    <Month>${month}</Month>
    <StartDate>${doc.filing.period.startDate}</StartDate>
    <EndDate>${doc.filing.period.endDate}</EndDate>
  </Period>
  <Currency>GHS</Currency>
  <Summary>
    <TaxableSales>${doc.filing.summary.taxableSales}</TaxableSales>
    <OutputVAT>${doc.filing.summary.outputVat}</OutputVAT>
    <TaxablePurchases>${doc.filing.summary.taxablePurchases}</TaxablePurchases>
    <InputVAT>${doc.filing.summary.inputVat}</InputVAT>
    <NetVATPayable>${doc.filing.summary.netVatPayable}</NetVATPayable>
  </Summary>
  <Breakdown>
    <NHIL>
      <Rate>${doc.filing.breakdown.nhil.rate}</Rate>
      <Output>${doc.filing.breakdown.nhil.output}</Output>
      <Input>${doc.filing.breakdown.nhil.input}</Input>
    </NHIL>
    <GETFL>
      <Rate>${doc.filing.breakdown.getfl.rate}</Rate>
      <Output>${doc.filing.breakdown.getfl.output}</Output>
      <Input>${doc.filing.breakdown.getfl.input}</Input>
    </GETFL>
    <VAT>
      <Rate>${doc.filing.breakdown.vat.rate}</Rate>
      <Output>${doc.filing.breakdown.vat.output}</Output>
      <Input>${doc.filing.breakdown.vat.input}</Input>
    </VAT>
  </Breakdown>
  <TransactionCounts>
    <Sales>${doc.filing.transactionCounts.sales}</Sales>
    <Purchases>${doc.filing.transactionCounts.purchases}</Purchases>
  </TransactionCounts>
  <GeneratedAt>${doc.filing.generatedAt}</GeneratedAt>
  <GeneratedBy>${escapeXml(doc.filing.generatedBy)}</GeneratedBy>
</GRA_VAT_Filing>`;

      return new NextResponse(xml, {
        headers: {
          "Content-Type": "application/xml; charset=utf-8",
          "Content-Disposition": `attachment; filename="gra-vat-${year}-${String(month).padStart(2, "0")}.xml"`,
        },
      });
    }

    // JSON
    return new NextResponse(JSON.stringify(doc, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="gra-vat-${year}-${String(month).padStart(2, "0")}.json"`,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
