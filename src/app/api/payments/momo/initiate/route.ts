import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { rateLimitApiWrite, rateLimitResponse, getClientIp } from "@/lib/rate-limit";
import { auditLog } from "@/lib/audit";
import { initiateMomoPayment } from "@/lib/mtn-momo";

// POST /api/payments/momo/initiate
// Body: { saleId: string, phoneNumber: string }
//
// Initiates a mobile money payment request via MTN MoMo. The customer will
// receive a prompt on their phone to approve the payment. The webhook at
// /api/payments/momo/callback will be called by MTN when the payment completes.
export async function POST(req: NextRequest) {
  let user;
  try { user = await requireAuth(); } catch (e) { return e as Response; }
  const ip = getClientIp(req);
  const rl = rateLimitApiWrite(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const saleId = String(body?.saleId || "");
  const phoneNumber = String(body?.phoneNumber || "");
  if (!saleId || !phoneNumber) {
    return NextResponse.json({ error: "saleId and phoneNumber required" }, { status: 400 });
  }

  try {
    // Fetch the sale
    const sale = await db.sale.findUnique({ where: { id: saleId } });
    if (!sale) return NextResponse.json({ error: "Sale not found" }, { status: 404 });
    if (sale.status !== "completed") {
      return NextResponse.json({ error: "Sale must be completed first" }, { status: 400 });
    }

    // Check if already paid
    const existingPayment = await db.salePayment.findFirst({
      where: { saleId, method: "momo", status: "completed" },
    });
    if (existingPayment) {
      return NextResponse.json({ error: "Sale already paid via MoMo" }, { status: 400 });
    }

    // Determine callback URL (must be publicly reachable in production)
    const host = req.headers.get("host") || "";
    const protocol = req.headers.get("x-forwarded-proto") || "https";
    const callbackUrl = `${protocol}://${host}/api/payments/momo/callback`;

    // Initiate MTN MoMo request-to-pay
    const result = await initiateMomoPayment({
      phoneNumber,
      amount: sale.total,
      externalId: sale.invoiceNumber,
      payerMessage: `Payment for ${sale.invoiceNumber}`,
      payeeNote: `SYLHN POS sale ${sale.invoiceNumber}`,
      callbackUrl,
    });

    // Record the pending payment
    await db.salePayment.create({
      data: {
        saleId,
        method: "momo",
        amount: sale.total,
        status: "pending",
        reference: result.referenceId,
        metadata: JSON.stringify({ momoReferenceId: result.referenceId, phoneNumber }),
      },
    });

    await auditLog({
      userId: user.uid,
      user: user.username,
      action: "MOMO_INITIATED",
      module: "sales",
      details: `MoMo payment initiated for ${sale.invoiceNumber}: ${sale.total} GHS from ${phoneNumber} (ref: ${result.referenceId})`,
      severity: "info",
      ipAddress: ip,
      userAgent: req.headers.get("user-agent") || "",
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      referenceId: result.referenceId,
      status: result.status,
      message: "Payment request sent. Ask the customer to approve the prompt on their phone.",
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "MoMo initiation failed" }, { status: 500 });
  }
}
