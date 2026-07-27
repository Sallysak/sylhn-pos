import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requirePermission } from "@/lib/auth";
import { rateLimitApiRead, rateLimitApiWrite, rateLimitResponse, getClientIp } from "@/lib/rate-limit";
import { auditLogTx, auditLog } from "@/lib/audit";

// GET /api/supplier-invoices?supplierId=xxx&status=pending&limit=100
// List all supplier invoices with optional filters.
export async function GET(req: NextRequest) {
  try { await requireAuth(); } catch (e) { return e as Response; }

  const ip = getClientIp(req);
  const rl = rateLimitApiRead(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  try {
    const { searchParams } = new URL(req.url);
    const supplierId = searchParams.get("supplierId");
    const status = searchParams.get("status"); // pending | matched | variance | rejected
    const limit = Math.min(parseInt(searchParams.get("limit") || "200", 10), 1000);

    const where: any = {};
    if (supplierId) where.supplierId = supplierId;
    if (status) where.matchStatus = status;

    const invoices = await db.supplierInvoice.findMany({
      where,
      include: {
        supplier: { select: { id: true, name: true, code: true, tin: true } },
        purchase: { select: { id: true, refNo: true, total: true, status: true, receivedAt: true } },
        matchedBy: { select: { id: true, fullName: true, username: true } },
      },
      orderBy: { invoiceDate: "desc" },
      take: limit,
    });

    return NextResponse.json({ invoices });
  } catch (e) {
    console.error("GET /api/supplier-invoices error:", e);
    return NextResponse.json({ error: "Failed to fetch supplier invoices" }, { status: 500 });
  }
}

// POST /api/supplier-invoices
// Create a new supplier invoice and auto-compute variance vs the linked PO.
// Body: { supplierId, purchaseId?, invoiceNo, invoiceDate, invoiceTotal, notes?, attachmentUrl? }
export async function POST(req: NextRequest) {
  let user;
  try {
    user = await requireAuth();
    requirePermission(user.role, "purchase");
  } catch (e) { return e as Response; }

  const ip = getClientIp(req);
  const rl = rateLimitApiWrite(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  if (!body.supplierId || !body.invoiceNo || !body.invoiceDate || body.invoiceTotal === undefined) {
    return NextResponse.json({
      error: "supplierId, invoiceNo, invoiceDate, and invoiceTotal are required",
    }, { status: 400 });
  }

  try {
    const invoice = await db.$transaction(async (tx) => {
      // If purchaseId provided, compute variance vs PO total
      let varianceAmount = 0;
      let variancePct = 0;
      let matchStatus = "pending";
      let matchedAt: Date | null = null;
      let matchedById: string | null = null;

      if (body.purchaseId) {
        const purchase = await tx.purchase.findUnique({
          where: { id: body.purchaseId },
          select: { id: true, total: true, status: true },
        });
        if (!purchase) {
          throw new Error("Linked purchase not found");
        }
        varianceAmount = Number(body.invoiceTotal) - purchase.total;
        variancePct = purchase.total > 0 ? (varianceAmount / purchase.total) * 100 : 0;

        // Auto-match if variance is within ±1% (configurable later)
        if (Math.abs(variancePct) <= 1) {
          matchStatus = "matched";
          matchedAt = new Date();
          matchedById = user.uid;
        } else if (Math.abs(variancePct) <= 5) {
          matchStatus = "variance"; // small variance — needs review
        } else {
          matchStatus = "variance"; // large variance — needs review
        }
      }

      const newInvoice = await tx.supplierInvoice.create({
        data: {
          supplierId: body.supplierId,
          purchaseId: body.purchaseId || null,
          invoiceNo: String(body.invoiceNo).slice(0, 100),
          invoiceDate: new Date(body.invoiceDate),
          invoiceTotal: Number(body.invoiceTotal),
          matchStatus,
          matchedAt,
          matchedById,
          varianceAmount: Math.round(varianceAmount * 100) / 100,
          variancePct: Math.round(variancePct * 100) / 100,
          notes: String(body.notes || "").slice(0, 2000),
          attachmentUrl: String(body.attachmentUrl || "").slice(0, 500),
        },
        include: { supplier: { select: { name: true, code: true } }, purchase: { select: { refNo: true } } },
      });

      await auditLogTx(tx, {
        userId: user.uid,
        user: user.username,
        action: "CREATE",
        module: "purchase",
        details: `Supplier invoice ${newInvoice.invoiceNo} created — ${newInvoice.supplier?.name} · GHS ${newInvoice.invoiceTotal.toFixed(2)} · status: ${matchStatus}${newInvoice.purchase ? ` · linked PO: ${newInvoice.purchase.refNo}` : ""}${Math.abs(variancePct) > 1 ? ` · variance: ${variancePct.toFixed(1)}%` : ""}`,
        severity: Math.abs(variancePct) > 5 ? "warning" : "info",
        ipAddress: ip,
        userAgent: req.headers.get("user-agent") || "",
      });

      return newInvoice;
    });

    return NextResponse.json({ success: true, invoice });
  } catch (e: any) {
    console.error("POST /api/supplier-invoices error:", e);
    return NextResponse.json({ error: e?.message || "Failed to create supplier invoice" }, { status: 500 });
  }
}
