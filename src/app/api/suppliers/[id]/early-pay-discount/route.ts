import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { rateLimitApiRead, rateLimitResponse, getClientIp } from "@/lib/rate-limit";

// GET /api/suppliers/[id]/early-pay-discount?amount=1000&invoiceDate=2026-01-15
// Returns the early-payment discount available for this supplier.
//
// Uses the supplier's structured terms:
//   earlyPayDiscountPct  e.g. 2 (means 2%)
//   earlyPayDays         e.g. 10 (pay within 10 days of invoice to get discount)
//   netDays              e.g. 30 (full payment due within 30 days)
//
// If the supplier has no early-pay terms (earlyPayDiscountPct = 0), returns
// { eligible: false }.
//
// Otherwise computes:
//   discountAmount = amount × (earlyPayDiscountPct / 100)
//   netPayable     = amount - discountAmount
//   discountDeadline = invoiceDate + earlyPayDays
//   netDueDate       = invoiceDate + netDays
//   daysRemaining    = discountDeadline - today (negative = expired)
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { await requireAuth(); } catch (e) { return e as Response; }

  const ip = getClientIp(req);
  const rl = rateLimitApiRead(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const amount = Number(searchParams.get("amount") || 0);
    const invoiceDateStr = searchParams.get("invoiceDate");

    const supplier = await db.supplier.findUnique({
      where: { id },
      select: {
        id: true, name: true, code: true,
        earlyPayDiscountPct: true, earlyPayDays: true, netDays: true,
        tradingTerms: true, balance: true,
      },
    });
    if (!supplier) return NextResponse.json({ error: "Supplier not found" }, { status: 404 });

    if (!supplier.earlyPayDiscountPct || supplier.earlyPayDiscountPct <= 0 || amount <= 0) {
      return NextResponse.json({
        supplierId: id,
        supplierName: supplier.name,
        amount,
        eligible: false,
        reason: !supplier.earlyPayDiscountPct
          ? "Supplier does not offer an early-payment discount"
          : "Amount must be greater than 0",
        tradingTerms: supplier.tradingTerms,
        netDays: supplier.netDays,
      });
    }

    const invoiceDate = invoiceDateStr ? new Date(invoiceDateStr) : new Date();
    const today = new Date();
    const discountDeadline = new Date(invoiceDate);
    discountDeadline.setDate(discountDeadline.getDate() + supplier.earlyPayDays);
    const netDueDate = new Date(invoiceDate);
    netDueDate.setDate(netDueDate.getDate() + supplier.netDays);

    const daysRemaining = Math.ceil((discountDeadline.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
    const discountAmount = Math.round(amount * (supplier.earlyPayDiscountPct / 100) * 100) / 100;
    const netPayable = Math.round((amount - discountAmount) * 100) / 100;

    return NextResponse.json({
      supplierId: id,
      supplierName: supplier.name,
      amount,
      eligible: daysRemaining >= 0,
      earlyPayDiscountPct: supplier.earlyPayDiscountPct,
      earlyPayDays: supplier.earlyPayDays,
      netDays: supplier.netDays,
      invoiceDate,
      discountDeadline,
      netDueDate,
      daysRemaining,
      discountAmount,
      netPayable,
      expired: daysRemaining < 0,
      message: daysRemaining >= 0
        ? `Pay GHS ${netPayable.toFixed(2)} today (save GHS ${discountAmount.toFixed(2)}) — discount expires in ${daysRemaining} day${daysRemaining === 1 ? "" : "s"}`
        : `Early-pay discount expired ${Math.abs(daysRemaining)} day${Math.abs(daysRemaining) === 1 ? "" : "s"} ago. Full GHS ${amount.toFixed(2)} due by ${netDueDate.toLocaleDateString("en-GB")}`,
    });
  } catch (e) {
    console.error("GET /api/suppliers/[id]/early-pay-discount error:", e);
    return NextResponse.json({ error: "Failed to compute early-pay discount" }, { status: 500 });
  }
}
