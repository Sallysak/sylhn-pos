import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requirePermission } from "@/lib/auth";
import { rateLimitApiRead, rateLimitApiWrite, rateLimitResponse, getClientIp } from "@/lib/rate-limit";
import { auditLogTx } from "@/lib/audit";

// GET /api/supplier-credit-notes?supplierId=xxx&limit=100
export async function GET(req: NextRequest) {
  try { await requireAuth(); } catch (e: any) { return e as Response; }

  const ip = getClientIp(req);
  const rl = rateLimitApiRead(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  try {
    const { searchParams } = new URL(req.url);
    const supplierId = searchParams.get("supplierId");
    const limit = Math.min(parseInt(searchParams.get("limit") || "200", 10), 1000);

    const where: any = {};
    if (supplierId) where.supplierId = supplierId;

    const notes = await db.supplierCreditNote.findMany({
      where,
      include: {
        supplier: { select: { id: true, name: true, code: true } },
        purchase: { select: { id: true, refNo: true } },
        user: { select: { id: true, fullName: true, username: true } },
        returns: { select: { id: true, returnNo: true } },
      },
      orderBy: { creditDate: "desc" },
      take: limit,
    });

    return NextResponse.json({ creditNotes: notes });
  } catch (e: any) {
    console.error("GET /api/supplier-credit-notes error:", e);
    return NextResponse.json({ error: "Failed to fetch credit notes" }, { status: 500 });
  }
}

// POST /api/supplier-credit-notes
// Record a supplier credit note. Decrements the supplier balance.
// Body: { supplierId, purchaseId?, creditNoteNo, creditDate, amount, reason?, notes?, attachmentUrl? }
export async function POST(req: NextRequest) {
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

  if (!body.supplierId || !body.creditNoteNo || !body.creditDate || body.amount === undefined) {
    return NextResponse.json({
      error: "supplierId, creditNoteNo, creditDate, and amount are required",
    }, { status: 400 });
  }

  const amount = Number(body.amount);
  if (amount <= 0) {
    return NextResponse.json({ error: "Credit note amount must be positive" }, { status: 400 });
  }

  try {
    const creditNote = await db.$transaction(async (tx) => {
      // ===== ATOMIC UPDATE (race-condition-safe) =====
      // Previously: read supplier.balance, compute Math.max(0, balance - amount),
      // write fixed value. Two concurrent credit notes would both read the same
      // balance, both compute the same newBalance, and one would be silently lost.
      // The Math.max(0, ...) clamp also silently lost data — if balance went
      // negative (supplier owes the business a credit), it was set to 0 instead.
      //
      // Now: use Prisma's atomic `decrement`. Negative balance is semantically
      // correct (means the supplier owes the business a credit).
      const supplier = await tx.supplier.findUnique({
        where: { id: body.supplierId },
        select: { id: true, name: true, code: true },
      });
      if (!supplier) throw new Error("Supplier not found");

      await tx.supplier.update({
        where: { id: body.supplierId },
        data: { balance: { decrement: amount } },
      });

      const newNote = await tx.supplierCreditNote.create({
        data: {
          supplierId: body.supplierId,
          purchaseId: body.purchaseId || null,
          creditNoteNo: String(body.creditNoteNo).slice(0, 100),
          creditDate: new Date(body.creditDate),
          amount,
          reason: String(body.reason || "other").slice(0, 50),
          notes: String(body.notes || "").slice(0, 2000),
          attachmentUrl: String(body.attachmentUrl || "").slice(0, 500),
          createdBy: user.uid,
        },
        include: { supplier: { select: { name: true, code: true } } },
      });

      await auditLogTx(tx, {
        userId: user.uid,
        user: user.username,
        action: "CREATE",
        module: "accounts",
        details: `Credit note ${newNote.creditNoteNo} recorded — ${supplier.name} · GHS ${amount.toFixed(2)} · reason: ${newNote.reason || "other"} · new balance: GHS ${newBalance.toFixed(2)}`,
        severity: "info",
        ipAddress: ip,
        userAgent: req.headers.get("user-agent") || "",
      });

      return newNote;
    });

    return NextResponse.json({ success: true, creditNote });
  } catch (e: any) {
    console.error("POST /api/supplier-credit-notes error:", e);
    return NextResponse.json({ error: e?.message || "Failed to create credit note" }, { status: 500 });
  }
}
