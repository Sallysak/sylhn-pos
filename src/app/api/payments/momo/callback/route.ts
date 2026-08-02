import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auditLog } from "@/lib/audit";
import { logger } from "@/lib/logger";

// POST /api/payments/momo/callback
// MTN MoMo webhook — called when a payment request completes (approved/rejected/failed).
//
// Body: { referenceId, status, amount, currency, financialTransactionId, reason }
//
// SECURITY: In production, configure your reverse proxy to only allow MTN's
// IP ranges to reach this endpoint. MTN does not sign webhook payloads.
export async function POST(req: NextRequest) {
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const referenceId = String(body?.referenceId || "");
  const status = String(body?.status || "").toLowerCase();
  const financialTransactionId = body?.financialTransactionId ? String(body.financialTransactionId) : null;
  const reason = body?.reason ? String(body.reason) : null;

  if (!referenceId || !status) {
    return NextResponse.json({ error: "referenceId and status required" }, { status: 400 });
  }

  logger.info("MoMo callback received", { referenceId, status, financialTransactionId, reason });

  try {
    // Find the pending payment by MoMo reference ID
    const payment = await db.salePayment.findFirst({
      where: { method: "momo", reference: referenceId },
      include: { sale: true },
    });

    if (!payment) {
      logger.warn("MoMo callback for unknown reference", { referenceId });
      // Return 200 so MTN doesn't retry — we can't match it anyway
      return NextResponse.json({ received: true, matched: false });
    }

    if (payment.status === "completed") {
      // Already processed (MTN may retry callbacks) — idempotent response
      return NextResponse.json({ received: true, already: true });
    }

    // Map MTN status to our payment status
    let newStatus: "completed" | "failed" | "pending" = "pending";
    if (status === "success" || status === "approved") newStatus = "completed";
    else if (status === "rejected" || status === "failed") newStatus = "failed";
    else if (status === "ongoing" || status === "pending") newStatus = "pending";

    await db.salePayment.update({
      where: { id: payment.id },
      data: {
        status: newStatus,
        metadata: JSON.stringify({
          ...(payment.metadata ? JSON.parse(payment.metadata) : {}),
          financialTransactionId,
          reason,
          callbackReceivedAt: new Date().toISOString(),
        }),
      },
    });

    await auditLog({
      userId: payment.sale?.cashierId || "",
      user: payment.sale?.cashierName || "system",
      action: newStatus === "completed" ? "MOMO_PAID" : "MOMO_FAILED",
      module: "sales",
      details: `MoMo payment ${newStatus} for ${payment.sale?.invoiceNumber}: ${payment.amount} GHS (ref: ${referenceId})${reason ? ` — ${reason}` : ""}`,
      severity: newStatus === "completed" ? "info" : "warning",
      ipAddress: req.headers.get("x-forwarded-for") || "",
      userAgent: req.headers.get("user-agent") || "",
    }).catch(() => {});

    return NextResponse.json({ received: true, matched: true, newStatus });
  } catch (e: any) {
    logger.error("MoMo callback processing failed", { referenceId, error: e?.message });
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}
