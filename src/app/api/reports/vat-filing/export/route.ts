import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { generateVATReturn } from "@/lib/gra-compliance";

// GET /api/reports/vat-filing/export?from=2026-01-01&to=2026-12-31&format=json|csv
//
// Generates a GRA-compliant VAT return export for the given period.
// Used for monthly/quarterly/annual filings.
export async function GET(req: NextRequest) {
  try { await requireAuth(); } catch (e) { return e as Response; }

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const format = searchParams.get("format") || "json";

  if (!from || !to) {
    return NextResponse.json({ error: "from and to query params required (YYYY-MM-DD)" }, { status: 400 });
  }

  const dateFrom = new Date(from + "T00:00:00");
  const dateTo = new Date(to + "T23:59:59");

  try {
    const vatReturn = await generateVATReturn(dateFrom, dateTo);

    if (format === "csv") {
      // Generate CSV
      const header = "Invoice Number,Date,Customer,Taxable Amount,NHIL (2.5%),GETFL (2.5%),VAT (15%),Total Tax,Total Amount\n";
      const rows = vatReturn.entries.map(e =>
        `${e.invoiceNumber},${new Date(e.date).toLocaleDateString("en-GB")},"${e.customerName}",${e.taxableAmount.toFixed(2)},${e.nhil.toFixed(2)},${e.getfl.toFixed(2)},${e.vat.toFixed(2)},${e.totalTax.toFixed(2)},${e.totalAmount.toFixed(2)}`
      ).join("\n");
      const summary = `\n\nSUMMARY\nTotal Invoices,${vatReturn.totalInvoices}\nTotal Taxable Amount,${vatReturn.totalTaxableAmount.toFixed(2)}\nTotal NHIL,${vatReturn.totalNHIL.toFixed(2)}\nTotal GETFL,${vatReturn.totalGETFL.toFixed(2)}\nTotal VAT,${vatReturn.totalVAT.toFixed(2)}\nTotal Tax,${vatReturn.totalTax.toFixed(2)}\nTotal Revenue,${vatReturn.totalRevenue.toFixed(2)}\nPeriod,${from} to ${to}`;
      const csv = header + rows + summary;

      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="vat-return-${from}-to-${to}.csv"`,
        },
      });
    }

    return NextResponse.json(vatReturn);
  } catch (e: any) {
    console.error("VAT export error:", e);
    return NextResponse.json({ error: "Failed to generate VAT return", detail: e?.message }, { status: 500 });
  }
}
