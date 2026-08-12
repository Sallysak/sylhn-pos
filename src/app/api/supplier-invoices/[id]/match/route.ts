import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requirePermission } from "@/lib/auth";
import { rateLimitApiWrite, rateLimitResponse, getClientIp } from "@/lib/rate-limit";
import { auditLogTx } from "@/lib/audit";

// POST /api/supplier-invoices/[id]/match
// Manually resolve a supplier-invoice variance. Body: { action: "match" | "reject", notes? }
//   "match"  → mark as matched (auditor accepts the variance)
//   "reject" → mark as rejected (auditor disputes the invoice — go back to supplier)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let user;
  try {
    user = await requireAuth();
    requirePermission(user.role, "financeOps");
  } catch (e: any) { return e as Response; }

  const ip = getClientIp(req);
  const rl = rateLimitApiWrite(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  if (!body.action || !["match", "reject"].includes(body.action)) {
    return NextResponse.json({ error: "action must be 'match' or 'reject'" }, { status: 400 });
  }

  try {
    const { id } = await params;
    const existing = await db.supplierInvoice.findUnique({
      where: { id },
      include: { supplier: { select: { name: true } }, purchase: { select: { refNo: true } } },
    });
    if (!existing) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

    const updated = await db.$transaction(async (tx) => {
      const newStatus = body.action === "match" ? "matched" : "rejected";
      const updatedInvoice = await tx.supplierInvoice.update({
        where: { id },
        data: {
          matchStatus: newStatus,
          matchedAt: new Date(),
          matchedById: user.uid,
          notes: body.notes ? `${existing.notes}\n[${new Date().toISOString()}] ${body.notes}`.slice(0, 2000) : existing.notes,
        },
      });

      await auditLogTx(tx, {
        userId: user.uid,
        user: user.username,
        action: body.action === "match" ? "MATCH_INVOICE" : "REJECT_INVOICE",
        module: "purchase",
        details: `Supplier invoice ${existing.invoiceNo} (${existing.supplier?.name}) ${body.action === "match" ? "matched" : "REJECTED"}${existing.purchase ? ` — PO ${existing.purchase.refNo}` : ""}${body.notes ? ` — reason: ${body.notes}` : ""}`,
        severity: body.action === "reject" ? "warning" : "info",
        ipAddress: ip,
        userAgent: req.headers.get("user-agent") || "",
      });

      return updatedInvoice;
    });

    return NextResponse.json({ success: true, invoice: updated });
  } catch (e: any) {
    console.error("POST /api/supplier-invoices/[id]/match error:", e);
    return NextResponse.json({ error: e?.message || "Failed to resolve invoice" }, { status: 500 });
  }
}
