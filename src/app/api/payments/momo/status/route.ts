import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { rateLimitApiRead, rateLimitResponse, getClientIp } from "@/lib/rate-limit";
import { getMomoPaymentStatus } from "@/lib/mtn-momo";

// GET /api/payments/momo/status?referenceId=xxx
// Returns the current status of a MoMo payment request. Use this to poll for
// updates when the webhook hasn't fired yet (or to verify webhook delivery).
export async function GET(req: NextRequest) {
  try { await requireAuth(); } catch (e) { return e as Response; }
  const ip = getClientIp(req);
  const rl = rateLimitApiRead(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  const { searchParams } = new URL(req.url);
  const referenceId = searchParams.get("referenceId");
  if (!referenceId) {
    return NextResponse.json({ error: "referenceId required" }, { status: 400 });
  }

  try {
    // First check our local DB
    const payment = await db.salePayment.findFirst({
      where: { method: "momo", reference: referenceId },
    });

    // If we don't have a record, return 404
    if (!payment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    // If payment is already terminal (completed/failed), return DB status
    if (payment.status === "completed" || payment.status === "failed") {
      return NextResponse.json({
        referenceId,
        status: payment.status,
        amount: payment.amount,
        source: "db",
      });
    }

    // Otherwise, poll MTN for the latest status
    try {
      const mtmStatus = await getMomoPaymentStatus(referenceId);
      // If MTN says terminal but our DB doesn't yet, update the DB
      if (mtmStatus.status === "approved" && payment.status !== "completed") {
        await db.salePayment.update({
          where: { id: payment.id },
          data: {
            status: "completed",
            metadata: JSON.stringify({
              ...(payment.metadata ? JSON.parse(payment.metadata) : {}),
              financialTransactionId: mtmStatus.financialTransactionId,
              polledAt: new Date().toISOString(),
            }),
          },
        });
        return NextResponse.json({
          referenceId,
          status: "completed",
          amount: payment.amount,
          source: "mtn-poll",
        });
      }
      if (mtmStatus.status === "rejected" || mtmStatus.status === "failed") {
        await db.salePayment.update({
          where: { id: payment.id },
          data: {
            status: "failed",
            metadata: JSON.stringify({
              ...(payment.metadata ? JSON.parse(payment.metadata) : {}),
              reason: mtmStatus.reason,
              polledAt: new Date().toISOString(),
            }),
          },
        });
        return NextResponse.json({
          referenceId,
          status: "failed",
          amount: payment.amount,
          reason: mtmStatus.reason,
          source: "mtn-poll",
        });
      }
      return NextResponse.json({
        referenceId,
        status: mtmStatus.status,
        amount: payment.amount,
        source: "mtn-poll",
      });
    } catch (e: any) {
      // MTN API failure — return what we have locally
      return NextResponse.json({
        referenceId,
        status: payment.status,
        amount: payment.amount,
        source: "db",
        warning: `MTN poll failed: ${e?.message}`,
      });
    }
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}
