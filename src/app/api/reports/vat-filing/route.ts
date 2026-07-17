import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requirePermission } from "@/lib/auth";
import { rateLimitApiRead, rateLimitResponse, getClientIp } from "@/lib/rate-limit";
import { auditLog } from "@/lib/audit";

// GET /api/reports/vat-filing?year=2026&month=7
// Premium: Ghana GRA (Ghana Revenue Authority) VAT / NHIL compliance report
//
// Ghana VAT structure (current rates as of 2024-2026):
//   - Standard rate: 15% (VAT 12.5% + NHIL 2.5% + GETFL 1%)
//   - Some items are zero-rated (exports) or exempt (basic food, medicine)
//
// This report computes:
//   - Output VAT (VAT collected on taxable sales)
//   - Input VAT (VAT paid on taxable purchases)
//   - Net VAT payable = Output - Input
//   - NHIL/GETFL breakdown if applicable
//
// For a small grocery store, basic food items are often exempt; this report
// respects the Product.taxable flag and Sale.taxAmount captured at sale time.
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

    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
      return NextResponse.json({ error: "Invalid year/month" }, { status: 400 });
    }

    // Build date range for the month
    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);
    const monthName = startOfMonth.toLocaleString("en-GB", { month: "long" });

    // Fetch all completed sales in the period
    const sales = await db.sale.findMany({
      where: {
        status: "completed",
        createdAt: { gte: startOfMonth, lte: endOfMonth },
      },
      include: { items: true },
      orderBy: { createdAt: "asc" },
    });

    // Fetch all received purchases in the period
    const purchases = await db.purchase.findMany({
      where: {
        status: "received",
        createdAt: { gte: startOfMonth, lte: endOfMonth },
      },
      include: { items: true, supplier: { select: { code: true, name: true } } },
      orderBy: { createdAt: "asc" },
    });

    // ===== Compute Output VAT (from sales) =====
    let outputTaxableSales = 0;       // sales of taxable items (excludes exempt)
    let outputExemptSales = 0;        // sales of exempt items (basic food, etc.)
    let outputTaxCollected = 0;       // total taxAmount collected
    let totalSalesRevenue = 0;

    const salesBreakdown = sales.map(s => {
      let taxable = 0, exempt = 0;
      for (const item of s.items) {
        if (item.taxable) taxable += item.total;
        else exempt += item.total;
      }
      outputTaxableSales += taxable;
      outputExemptSales += exempt;
      outputTaxCollected += s.taxAmount;
      totalSalesRevenue += s.total;
      return {
        invoiceNumber: s.invoiceNumber,
        date: s.createdAt.toISOString(),
        customerName: s.customerName,
        taxableAmount: taxable,
        exemptAmount: exempt,
        taxAmount: s.taxAmount,
        total: s.total,
        status: s.status,
      };
    });

    // ===== Compute Input VAT (from purchases) =====
    let inputTaxablePurchases = 0;
    let inputTaxPaid = 0;
    let totalPurchaseCost = 0;

    const purchasesBreakdown = purchases.map(p => {
      let taxable = 0;
      for (const item of p.items) {
        if (item.tax) taxable += item.total;
      }
      inputTaxablePurchases += taxable;
      inputTaxPaid += p.taxAmount;
      totalPurchaseCost += p.total;
      return {
        refNo: p.refNo,
        date: p.createdAt.toISOString(),
        supplierCode: p.supplier?.code || "",
        supplierName: p.supplierName,
        taxableAmount: taxable,
        taxAmount: p.taxAmount,
        total: p.total,
        status: p.status,
      };
    });

    // ===== Net VAT payable =====
    const netVAT = outputTaxCollected - inputTaxPaid;

    // NHIL/GETFL breakdown (Ghana-specific): 15% = 12.5% VAT + 2.5% NHIL + ... (illustrative split)
    // In practice, consult GRA for exact split. Here we use the standard split.
    const standardRate = 0.15;
    const vatRate = 0.125;
    const nhilRate = 0.025;
    const getflRate = 0.00;  // GETFL was removed in 2023; kept for backward compat

    const outputVATComponent = outputTaxCollected * (vatRate / standardRate);
    const outputNHILComponent = outputTaxCollected * (nhilRate / standardRate);
    const inputVATComponent = inputTaxPaid * (vatRate / standardRate);
    const inputNHILComponent = inputTaxPaid * (nhilRate / standardRate);

    // Audit
    await auditLog({
      userId: user.uid,
      user: user.username,
      action: "REPORT",
      module: "accounts",
      details: `GRA VAT filing report generated for ${monthName} ${year} — output GHS ${outputTaxCollected.toFixed(2)}, input GHS ${inputTaxPaid.toFixed(2)}, net payable GHS ${netVAT.toFixed(2)}`,
      severity: "info",
      ipAddress: ip,
      userAgent: req.headers.get("user-agent") || "",
    }).catch(() => {});

    return NextResponse.json({
      period: {
        year,
        month,
        monthName,
        from: startOfMonth.toISOString(),
        to: endOfMonth.toISOString(),
      },
      summary: {
        totalSalesRevenue,
        totalPurchaseCost,
        outputTaxableSales,
        outputExemptSales,
        outputTaxCollected,
        inputTaxablePurchases,
        inputTaxPaid,
        netVATpayable: netVAT,
      },
      breakdown: {
        outputVAT: outputVATComponent,
        outputNHIL: outputNHILComponent,
        outputGETFL: 0,
        inputVAT: inputVATComponent,
        inputNHIL: inputNHILComponent,
        inputGETFL: 0,
        netVAT: outputVATComponent - inputVATComponent,
        netNHIL: outputNHILComponent - inputNHILComponent,
      },
      rates: {
        standard: standardRate,
        vat: vatRate,
        nhil: nhilRate,
        getfl: getflRate,
      },
      sales: salesBreakdown,
      purchases: purchasesBreakdown,
      filing: {
        taxpayerName: "SYLHN COMPANY LTD",
        preparedAt: new Date().toISOString(),
        preparedBy: user.username,
        // GRA contact info for filing
        graContact: "Ghana Revenue Authority — Domestic Tax Revenue Division",
        graFilingDeadline: "Last working day of the following month",
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error("GET /api/reports/vat-filing error:", e);
    return NextResponse.json({ error: "Failed to generate VAT filing report" }, { status: 500 });
  }
}
