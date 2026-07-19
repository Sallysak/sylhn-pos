import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requirePermission } from "@/lib/auth";
import { rateLimitApiWrite, rateLimitResponse, getClientIp } from "@/lib/rate-limit";
import { z } from "zod";

// POST /api/sales/[id]/refund
// Process a refund for a completed sale. Marks the sale as 'refunded',
// returns items to inventory (optional), and records an audit log entry.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let user;
  try {
    user = await requireAuth();
    requirePermission(user.role, "canVoid");
  } catch (e) { return e as Response; }

  const ip = getClientIp(req);
  const rl = rateLimitApiWrite(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  const { id: saleId } = await params;
  if (!saleId) return NextResponse.json({ error: "Sale ID is required" }, { status: 400 });

  const schema = z.object({
    reason: z.enum(["damaged", "wrong_item", "customer_request", "other"]),
    notes: z.string().max(500).optional(),
    restockItems: z.boolean().optional().default(true),
    managerApprovedBy: z.string().optional(),
  });

  let body: z.infer<typeof schema>;
  try {
    body = schema.parse(await req.json());
  } catch (e: any) {
    return NextResponse.json({ error: "Invalid request", details: e?.errors || e?.message }, { status: 422 });
  }

  try {
    const result = await db.$transaction(async (tx) => {
      const sale = await tx.sale.findUnique({ where: { id: saleId }, include: { items: true } });
      if (!sale) throw new Error("Sale not found");
      if (sale.status !== "completed") {
        throw new Error(`Cannot refund a sale with status '${sale.status}'. Only completed sales can be refunded.`);
      }

      const REFUND_THRESHOLD = 100;
      if (Number(sale.total) > REFUND_THRESHOLD && !body.managerApprovedBy) {
        throw new Error(`Refunds over GHS ${REFUND_THRESHOLD} require manager approval.`);
      }

      const updatedSale = await tx.sale.update({
        where: { id: saleId },
        data: {
          status: "refunded",
          refundedAt: new Date(),
          notes: body.notes ? `${sale.notes || ""}\n[REFUND] ${body.notes}`.trim() : sale.notes,
        },
      });

      if (body.restockItems) {
        for (const item of sale.items) {
          if (item.productId) {
            await tx.product.update({
              where: { id: item.productId },
              data: { quantity: { increment: item.quantity } },
            });
            await tx.stockHistory.create({
              data: {
                productId: item.productId,
                action: "returned",
                quantity: item.quantity,
                reason: `Refund for sale ${sale.invoiceNumber}: ${body.reason}`,
                reference: `REFUND-${sale.invoiceNumber}`,
                saleId: sale.id,
                userId: user.uid,
              },
            });
          }
        }
      }

      if (sale.customerId) {
        const loyaltyTx = await tx.loyaltyTransaction.findFirst({
          where: { saleId: sale.id, type: "earn" },
        });
        if (loyaltyTx) {
          // Calculate new balance after reversal
          const currentBalance = await tx.loyaltyTransaction.aggregate({
            where: { customerId: sale.customerId },
            _sum: { points: true },
          });
          const newBalance = (currentBalance._sum.points || 0) - loyaltyTx.points;
          await tx.loyaltyTransaction.create({
            data: {
              customerId: sale.customerId,
              saleId: sale.id,
              type: "redeem",
              points: -loyaltyTx.points,
              balanceAfter: Math.max(0, newBalance),
              description: `Points reversed due to refund of ${sale.invoiceNumber}`,
            },
          });
        }
      }

      await tx.auditLog.create({
        data: {
          userId: user.uid,
          user: user.username,
          action: "SALE_REFUND",
          module: "sales",
          details: `Refunded sale ${sale.invoiceNumber} (GHS ${sale.total.toFixed(2)}) — reason: ${body.reason}`,
          severity: "warning",
          ipAddress: ip,
          userAgent: req.headers.get("user-agent") || "",
        },
      });

      return { sale: updatedSale, refundedAmount: Number(sale.total), itemsRestocked: body.restockItems ? sale.items.length : 0 };
    });

    return NextResponse.json({
      success: true,
      ...result,
      message: `Refund processed. GHS ${result.refundedAmount.toFixed(2)} returned to customer.`,
    });
  } catch (e: any) {
    console.error("POST /api/sales/[id]/refund error:", e);
    const status = e?.message?.includes("not found") || e?.message?.includes("Cannot refund") || e?.message?.includes("manager approval") ? 400 : 500;
    return NextResponse.json({ error: e?.message || "Failed to process refund" }, { status });
  }
}
