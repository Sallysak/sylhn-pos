import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { rateLimitApiRead, rateLimitResponse, getClientIp } from "@/lib/rate-limit";
import { auditLog } from "@/lib/audit";
import { CURRENCY } from "@/lib/pos-data";

// GET /api/receipt/whatsapp?saleId=xxx&phone=+233...
// Returns a wa.me deep link with the receipt text pre-filled.
// The cashier clicks the link → WhatsApp opens → customer receives the receipt.
// Premium feature for Ghana — WhatsApp is more common than email for receipts.
export async function GET(req: NextRequest) {
  let user;
  try { user = await requireAuth(); } catch (e) { return e as Response; }

  const ip = getClientIp(req);
  const rl = rateLimitApiRead(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  try {
    const { searchParams } = new URL(req.url);
    const saleId = searchParams.get("saleId");
    const phone = searchParams.get("phone") || "";
    if (!saleId) {
      return NextResponse.json({ error: "saleId is required" }, { status: 400 });
    }

    const sale = await db.sale.findUnique({
      where: { id: saleId },
      include: {
        items: true,
        payments: true,
        customer: true,
        cashier: { select: { fullName: true } },
      },
    });
    if (!sale) return NextResponse.json({ error: "Sale not found" }, { status: 404 });

    // Build the receipt text
    const date = new Date(sale.createdAt).toLocaleString("en-GB", { timeZone: "Africa/Accra" });
    const lines: string[] = [
      `*SYLHN COMPANY LTD*`,
      `Grocery Store Point of Sale`,
      `East Legon, Accra · +233592766044`,
      ``,
      `*Invoice:* ${sale.invoiceNumber}`,
      `*Date:* ${date}`,
      `*Cashier:* ${sale.cashier?.fullName || sale.cashierName}`,
      sale.customerName ? `*Customer:* ${sale.customerName}` : "",
      ``,
      `*Items:*`,
    ].filter(Boolean);

    for (const item of sale.items) {
      lines.push(`${item.emoji || "📦"} ${item.name}`);
      lines.push(`   ${item.quantity} ${item.unit} × ${CURRENCY}${item.price.toFixed(2)} = ${CURRENCY}${item.total.toFixed(2)}`);
    }

    lines.push(``);
    lines.push(`*Subtotal:* ${CURRENCY}${sale.subtotal.toFixed(2)}`);
    if (sale.discount > 0) lines.push(`*Discount:* -${CURRENCY}${sale.discount.toFixed(2)}`);
    if (sale.taxAmount > 0) lines.push(`*VAT:* ${CURRENCY}${sale.taxAmount.toFixed(2)}`);
    if (sale.pointsRedeemed > 0) lines.push(`*Loyalty Redeemed:* -${CURRENCY}${(sale.pointsRedeemed * 0.05).toFixed(2)} (${sale.pointsRedeemed} pts)`);
    lines.push(`*TOTAL: ${CURRENCY}${sale.total.toFixed(2)}*`);
    lines.push(``);
    lines.push(`*Paid:* ${CURRENCY}${sale.amountPaid.toFixed(2)} (${sale.paymentMethod})`);
    lines.push(`*Change:* ${CURRENCY}${sale.change.toFixed(2)}`);

    if (sale.payments && sale.payments.length > 1) {
      lines.push(``);
      lines.push(`*Payment Split:*`);
      for (const p of sale.payments) {
        lines.push(`   ${p.method}: ${CURRENCY}${p.amount.toFixed(2)}${p.reference ? ` (${p.reference})` : ""}`);
      }
    }

    if (sale.pointsEarned > 0) {
      lines.push(``);
      lines.push(`*Loyalty Earned:* +${sale.pointsEarned} pts`);
    }

    lines.push(``);
    lines.push(`Thank you for shopping with us! 🙏`);
    lines.push(`Please save this message for returns/exchanges.`);

    const text = lines.join("\n");

    // Normalize phone (strip spaces, +, dashes for wa.me)
    const normalizedPhone = phone.replace(/[\s+\-()]/g, "");
    const waLink = normalizedPhone
      ? `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;

    // Audit the action
    await auditLog({
      userId: user.uid,
      user: user.username,
      action: "RECEIPT_WHATSAPP",
      module: "sales",
      details: `Receipt ${sale.invoiceNumber} sent via WhatsApp${phone ? ` to ${phone}` : " (no phone)"}`,
      severity: "info",
      ipAddress: ip,
      userAgent: req.headers.get("user-agent") || "",
    });

    // Mark receipt as "emailed" (using existing field as receipt-sent flag)
    if (!sale.receiptEmailedAt) {
      await db.sale.update({
        where: { id: sale.id },
        data: { receiptEmailedAt: new Date() },
      });
    }

    return NextResponse.json({
      success: true,
      waLink,
      text,
      invoiceNumber: sale.invoiceNumber,
    });
  } catch (e) {
    console.error("GET /api/receipt/whatsapp error:", e);
    return NextResponse.json({ error: "Failed to generate WhatsApp receipt" }, { status: 500 });
  }
}
