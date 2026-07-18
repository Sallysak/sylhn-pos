import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requirePermission } from "@/lib/auth";
import { rateLimitApiRead, rateLimitApiWrite, rateLimitResponse, getClientIp } from "@/lib/rate-limit";
import { auditLog } from "@/lib/audit";
import { generatePurchaseRefNo } from "@/lib/identifiers";

// GET /api/recurring-pos — list all recurring PO schedules
export async function GET(req: NextRequest) {
  try { await requireAuth(); } catch (e) { return e as Response; }
  const ip = getClientIp(req);
  const rl = rateLimitApiRead(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  try {
    const recurringPOs = await db.recurringPO.findMany({
      include: { supplier: { select: { id: true, name: true, code: true } }, createdBy: { select: { fullName: true } } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ recurringPOs, count: recurringPOs.length });
  } catch (e) {
    return NextResponse.json({ error: "Failed to fetch recurring POs" }, { status: 500 });
  }
}

// POST /api/recurring-pos — create a recurring PO schedule
export async function POST(req: NextRequest) {
  let user;
  try { user = await requireAuth(); requirePermission(user.role, "purchase"); } catch (e) { return e as Response; }
  const ip = getClientIp(req);
  const rl = rateLimitApiWrite(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  if (!body.name || !body.frequency || !body.items) {
    return NextResponse.json({ error: "name, frequency, and items are required" }, { status: 400 });
  }

  try {
    // Compute next run date
    const now = new Date();
    let nextRun = new Date(now);
    if (body.frequency === "weekly") {
      const targetDay = body.dayOfWeek ?? 1; // Monday default
      nextRun.setDate(now.getDate() + ((7 + targetDay - now.getDay()) % 7 || 7));
    } else if (body.frequency === "biweekly") {
      nextRun.setDate(now.getDate() + 14);
    } else if (body.frequency === "monthly") {
      const targetDate = body.dayOfMonth ?? 1;
      nextRun.setMonth(now.getMonth() + 1, targetDate);
    }
    nextRun.setHours(8, 0, 0, 0); // 8 AM

    const recurring = await db.recurringPO.create({
      data: {
        name: String(body.name).slice(0, 200),
        supplierId: body.supplierId || null,
        supplierName: body.supplierName || "",
        frequency: body.frequency,
        dayOfWeek: body.dayOfWeek ?? null,
        dayOfMonth: body.dayOfMonth ?? null,
        items: JSON.stringify(body.items),
        isActive: body.isActive !== false,
        nextRunAt: nextRun,
        createdById: user.uid,
      },
    });

    await auditLog({ userId: user.uid, user: user.username, action: "CREATE", module: "purchase", details: `Recurring PO "${recurring.name}" created (${body.frequency}), next run: ${nextRun.toDateString()}`, severity: "info", ipAddress: ip });

    return NextResponse.json({ success: true, recurringPO: recurring });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}

// PUT /api/recurring-pos — toggle active or run now
export async function PUT(req: NextRequest) {
  let user;
  try { user = await requireAuth(); requirePermission(user.role, "purchase"); } catch (e) { return e as Response; }
  const ip = getClientIp(req);
  const rl = rateLimitApiWrite(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  if (body.action === "run" && body.id) {
    // Execute the recurring PO now — creates an actual Purchase
    try {
      const recurring = await db.recurringPO.findUnique({ where: { id: String(body.id) } });
      if (!recurring) return NextResponse.json({ error: "Not found" }, { status: 404 });

      const items = JSON.parse(recurring.items);
      const poItems = items.map((i: any) => ({
        productId: i.productId || null, partNo: i.sku || "", details: i.name || "",
        emoji: i.emoji || "📦", quantity: Number(i.quantity) || 1,
        cost: Number(i.cost) || 0, tax: false, total: Number(i.quantity) * Number(i.cost) || 0,
      }));
      const total = poItems.reduce((s: number, i: any) => s + i.total, 0);

      const purchase = await db.purchase.create({
        data: {
          refNo: generatePurchaseRefNo(), type: "purchase",
          supplierId: recurring.supplierId, supplierName: recurring.supplierName,
          status: "ordered", subtotal: total, taxAmount: 0, total, amountPaid: 0,
          notes: `Auto-generated from recurring PO: ${recurring.name}`,
          createdById: user.uid, items: { create: poItems },
        },
      });

      await db.recurringPO.update({ where: { id: recurring.id }, data: { lastRunAt: new Date(), runCount: { increment: 1 } } });
      await auditLog({ userId: user.uid, user: user.username, action: "RECURRING_RUN", module: "purchase", details: `Recurring PO "${recurring.name}" executed — created ${purchase.refNo} (${poItems.length} items, GHS ${total.toFixed(2)})`, severity: "warning", ipAddress: ip });

      return NextResponse.json({ success: true, purchase });
    } catch (e: any) {
      return NextResponse.json({ error: e?.message }, { status: 500 });
    }
  }

  if (body.action === "toggle" && body.id) {
    const updated = await db.recurringPO.update({ where: { id: String(body.id) }, data: { isActive: body.isActive } });
    return NextResponse.json({ success: true, recurringPO: updated });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
