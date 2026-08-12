import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { rateLimitApiRead, rateLimitResponse, getClientIp } from "@/lib/rate-limit";
import { auditLog } from "@/lib/audit";
import { CURRENCY } from "@/lib/pos-data";

// GET /api/purchases/[id]/whatsapp?phone=+233...
// Returns a wa.me deep link with the purchase order text pre-filled.
// The buyer clicks the link → WhatsApp opens → supplier receives the PO.
// Ghanaian suppliers overwhelmingly prefer WhatsApp over email.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let user;
  try { user = await requireAuth(); } catch (e: any) { return e as Response; }

  const ip = getClientIp(req);
  const rl = rateLimitApiRead(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const phone = searchParams.get("phone") || "";

    const purchase = await db.purchase.findUnique({
      where: { id },
      include: {
        supplier: true,
        items: true,
        createdBy: { select: { fullName: true } },
      },
    });
    if (!purchase) return NextResponse.json({ error: "Purchase not found" }, { status: 404 });

    const date = new Date(purchase.createdAt).toLocaleString("en-GB", { timeZone: "Africa/Accra" });
    const lines: string[] = [
      `*SYLHN COMPANY LTD*`,
      `Purchase Order`,
      `East Legon, Accra · +233592766044`,
      ``,
      `*PO Ref:* ${purchase.refNo}`,
      `*Date:* ${date}`,
      `*Status:* ${purchase.status.toUpperCase()}`,
      purchase.supplier ? `*Supplier:* ${purchase.supplier.name}` : `*Supplier:* ${purchase.supplierName || "—"}`,
      purchase.expectedAt ? `*Expected Delivery:* ${new Date(purchase.expectedAt).toLocaleDateString("en-GB")}` : "",
      purchase.createdBy?.fullName ? `*Prepared By:* ${purchase.createdBy.fullName}` : "",
      ``,
      `*Items:*`,
    ].filter(Boolean);

    for (const item of purchase.items) {
      lines.push(`${item.emoji || "📦"} ${item.details}`);
      lines.push(`   ${item.quantity} × ${CURRENCY}${item.cost.toFixed(2)} = ${CURRENCY}${item.total.toFixed(2)}`);
      if (item.freeQuantity > 0) {
        lines.push(`   + ${item.freeQuantity} free`);
      }
    }

    lines.push(``);
    lines.push(`*Subtotal:* ${CURRENCY}${purchase.subtotal.toFixed(2)}`);
    if (purchase.discount > 0) lines.push(`*Discount:* -${CURRENCY}${purchase.discount.toFixed(2)}`);
    if (purchase.taxAmount > 0) lines.push(`*Tax:* ${CURRENCY}${purchase.taxAmount.toFixed(2)}`);

    // Landed costs (shown separately, not part of items subtotal)
    const landedTotal =
      (purchase.freightCost || 0) +
      (purchase.insuranceCost || 0) +
      (purchase.customsDuty || 0) +
      (purchase.otherLandedCosts || 0);
    if (landedTotal > 0) {
      lines.push(`*Landed Costs:* ${CURRENCY}${landedTotal.toFixed(2)}`);
    }

    lines.push(`*TOTAL: ${CURRENCY}${purchase.total.toFixed(2)}*`);

    if (purchase.currency && purchase.currency !== "GHS") {
      lines.push(``);
      lines.push(`*Currency:* ${purchase.currency} @ rate ${purchase.exchangeRate}`);
    }

    if (purchase.notes) {
      lines.push(``);
      lines.push(`*Notes:* ${purchase.notes}`);
    }

    lines.push(``);
    lines.push(`Please confirm receipt and expected delivery date. 🙏`);

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
      action: "PURCHASE_WHATSAPP",
      module: "purchase",
      details: `PO ${purchase.refNo} sent via WhatsApp${phone ? ` to ${phone}` : " (no phone)"}${purchase.supplier ? ` — supplier: ${purchase.supplier.name}` : ""}`,
      severity: "info",
      ipAddress: ip,
      userAgent: req.headers.get("user-agent") || "",
    });

    return NextResponse.json({
      success: true,
      waLink,
      text,
      refNo: purchase.refNo,
    });
  } catch (e: any) {
    console.error("GET /api/purchases/[id]/whatsapp error:", e);
    return NextResponse.json({ error: "Failed to generate WhatsApp PO link" }, { status: 500 });
  }
}
