import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requirePermission } from "@/lib/auth";
import { rateLimitApiRead, rateLimitApiWrite, rateLimitResponse, getClientIp } from "@/lib/rate-limit";
import { auditLog, auditLogTx } from "@/lib/audit";
import { generatePurchaseRefNo } from "@/lib/identifiers";

// GET /api/auto-replenish — list all rules (with current stock vs trigger level)
export async function GET(req: NextRequest) {
  try { await requireAuth(); } catch (e) { return e as Response; }

  const ip = getClientIp(req);
  const rl = rateLimitApiRead(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  try {
    const rules = await db.autoReplenishRule.findMany({
      include: {
        product: { select: { id: true, sku: true, name: true, emoji: true, quantity: true, reorderLevel: true, costPrice: true } },
        supplier: { select: { id: true, code: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    // Annotate each rule with "shouldTrigger" (current stock <= triggerLevel AND cooldown elapsed)
    const now = Date.now();
    const annotated = rules.map(r => {
      const currentStock = r.product.quantity;
      const shouldTrigger = r.isActive && currentStock <= r.triggerLevel && (
        !r.lastTriggeredAt || (now - r.lastTriggeredAt.getTime()) > r.cooldownHours * 3600 * 1000
      );
      return {
        ...r,
        currentStock,
        shouldTrigger,
        cooldownElapsed: !r.lastTriggeredAt || (now - r.lastTriggeredAt.getTime()) > r.cooldownHours * 3600 * 1000,
      };
    });

    return NextResponse.json({
      rules: annotated,
      summary: {
        total: rules.length,
        active: rules.filter(r => r.isActive).length,
        triggeredToday: rules.filter(r => r.lastTriggeredAt && r.lastTriggeredAt.toDateString() === new Date().toDateString()).length,
        pendingTrigger: annotated.filter(r => r.shouldTrigger).length,
      },
    });
  } catch (e) {
    console.error("GET /api/auto-replenish error:", e);
    return NextResponse.json({ error: "Failed to fetch rules" }, { status: 500 });
  }
}

// POST /api/auto-replenish — create a rule OR run the auto-replenish scan
// Body for create: { productId, triggerLevel, reorderQty, supplierId?, cooldownHours? }
// Body for scan: { action: "scan" } — scans all rules and creates POs for triggered ones
export async function POST(req: NextRequest) {
  let user;
  try { user = await requireAuth(); requirePermission(user.role, "purchase"); } catch (e) { return e as Response; }

  const ip = getClientIp(req);
  const rl = rateLimitApiWrite(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  // ===== Run the scan =====
  if (body.action === "scan") {
    try {
      const now = new Date();
      const rules = await db.autoReplenishRule.findMany({
        where: { isActive: true },
        include: {
          product: { include: { suppliers: { where: { preferred: true }, include: { supplier: true }, take: 1 } } },
        },
      });

      const triggered: any[] = [];
      const skipped: any[] = [];

      // Group triggered rules by supplier so we can create one PO per supplier
      const bySupplier: Record<string, any[]> = {};

      for (const rule of rules) {
        const currentStock = rule.product.quantity;
        const cooldownElapsed = !rule.lastTriggeredAt || (now.getTime() - rule.lastTriggeredAt.getTime()) > rule.cooldownHours * 3600 * 1000;
        if (currentStock > rule.triggerLevel || !cooldownElapsed) {
          skipped.push({ ruleId: rule.id, product: rule.product.name, currentStock, triggerLevel: rule.triggerLevel, reason: !cooldownElapsed ? "cooldown" : "above trigger" });
          continue;
        }

        // Determine supplier: rule.supplierId > product's preferred > null
        let supplierId = rule.supplierId;
        let supplierName = "Unassigned";
        let supplierCost = rule.product.costPrice;
        if (!supplierId && rule.product.suppliers[0]) {
          supplierId = rule.product.suppliers[0].supplier.id;
          supplierName = rule.product.suppliers[0].supplier.name;
          supplierCost = rule.product.suppliers[0].supplierCost;
        } else if (supplierId) {
          // Look up supplier name
          const supp = await db.supplier.findUnique({ where: { id: supplierId }, select: { name: true } });
          supplierName = supp?.name || "Unassigned";
        }

        const key = supplierId || "unassigned";
        if (!bySupplier[key]) bySupplier[key] = [];
        bySupplier[key].push({
          rule, supplierId, supplierName, supplierCost,
          product: rule.product, reorderQty: rule.reorderQty,
        });
      }

      // Create one PO per supplier
      for (const [suppKey, items] of Object.entries(bySupplier)) {
        const first = items[0];
        const supplierId = first.supplierId;
        const supplierName = first.supplierName;
        const poItems = items.map(it => ({
          productId: it.product.id,
          partNo: it.product.sku,
          details: it.product.name,
          emoji: it.product.emoji,
          quantity: it.reorderQty,
          cost: it.supplierCost,
          tax: false,
          total: +(it.supplierCost * it.reorderQty).toFixed(2),
        }));
        const poTotal = poItems.reduce((s, i) => s + i.total, 0);

        const purchase = await db.$transaction(async (tx) => {
          const refNo = generatePurchaseRefNo();
          const newPurchase = await tx.purchase.create({
            data: {
              refNo,
              type: "purchase",
              supplierId: supplierId || null,
              supplierName,
              status: "ordered",  // auto-replenish creates an ORDER, not received
              subtotal: poTotal,
              taxAmount: 0,
              total: poTotal,
              amountPaid: 0,
              notes: `Auto-replenish PO — ${items.length} product(s) below trigger level`,
              createdById: user.uid,
              expectedAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),  // 3 days lead time
              items: { create: poItems },
            },
            include: { items: true },
          });

          // Update each rule: set lastTriggeredAt, increment triggerCount
          for (const item of items) {
            await tx.autoReplenishRule.update({
              where: { id: item.rule.id },
              data: {
                lastTriggeredAt: now,
                triggerCount: { increment: 1 },
              },
            });
          }

          await auditLogTx(tx, {
            userId: user.uid,
            user: user.username,
            action: "AUTO_REPLENISH",
            module: "purchase",
            details: `Auto-replenish PO ${refNo} created for ${supplierName} — ${items.length} items, total GHS ${poTotal.toFixed(2)}`,
            severity: "warning",
            ipAddress: ip,
            userAgent: req.headers.get("user-agent") || "",
          });

          return newPurchase;
        });

        triggered.push({
          purchaseId: purchase.id,
          refNo: purchase.refNo,
          supplierName,
          itemCount: items.length,
          total: poTotal,
        });
      }

      return NextResponse.json({
        success: true,
        scanned: rules.length,
        triggered: triggered.length,
        skipped: skipped.length,
        triggeredPos: triggered,
        skipped,
      });
    } catch (e: any) {
      console.error("POST /api/auto-replenish scan error:", e);
      return NextResponse.json({ error: e?.message || "Failed to run scan" }, { status: 500 });
    }
  }

  // ===== Create a rule =====
  if (!body.productId || body.triggerLevel === undefined || body.reorderQty === undefined) {
    return NextResponse.json({ error: "productId, triggerLevel, reorderQty are required" }, { status: 400 });
  }

  try {
    const rule = await db.autoReplenishRule.create({
      data: {
        productId: String(body.productId),
        triggerLevel: Number(body.triggerLevel),
        reorderQty: Number(body.reorderQty),
        supplierId: body.supplierId || null,
        cooldownHours: Number(body.cooldownHours) || 24,
        isActive: body.isActive !== false,
        createdBy: user.uid,
      },
      include: { product: true, supplier: true },
    });

    await auditLog({
      userId: user.uid,
      user: user.username,
      action: "CREATE",
      module: "stock",
      details: `Auto-replenish rule created for ${rule.product.name}: trigger at ${rule.triggerLevel}, order ${rule.reorderQty}`,
      severity: "info",
      ipAddress: ip,
      userAgent: req.headers.get("user-agent") || "",
    });

    return NextResponse.json({ success: true, rule });
  } catch (e: any) {
    if (e?.code === "P2002") {
      return NextResponse.json({ error: "Rule already exists for this product (use PUT to update)" }, { status: 409 });
    }
    console.error("POST /api/auto-replenish error:", e);
    return NextResponse.json({ error: "Failed to create rule" }, { status: 500 });
  }
}

// PUT /api/auto-replenish — update a rule
// Body: { id, ...updates }
export async function PUT(req: NextRequest) {
  let user;
  try { user = await requireAuth(); requirePermission(user.role, "purchase"); } catch (e) { return e as Response; }

  const ip = getClientIp(req);
  const rl = rateLimitApiWrite(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  if (!body.id) {
    return NextResponse.json({ error: "Rule id is required" }, { status: 400 });
  }

  try {
    const rule = await db.autoReplenishRule.update({
      where: { id: String(body.id) },
      data: {
        ...(body.triggerLevel !== undefined && { triggerLevel: Number(body.triggerLevel) }),
        ...(body.reorderQty !== undefined && { reorderQty: Number(body.reorderQty) }),
        ...(body.supplierId !== undefined && { supplierId: body.supplierId || null }),
        ...(body.cooldownHours !== undefined && { cooldownHours: Number(body.cooldownHours) }),
        ...(body.isActive !== undefined && { isActive: Boolean(body.isActive) }),
      },
      include: { product: true, supplier: true },
    });

    await auditLog({
      userId: user.uid,
      user: user.username,
      action: "UPDATE",
      module: "stock",
      details: `Auto-replenish rule updated for ${rule.product.name}: trigger=${rule.triggerLevel}, order=${rule.reorderQty}`,
      severity: "info",
      ipAddress: ip,
      userAgent: req.headers.get("user-agent") || "",
    });

    return NextResponse.json({ success: true, rule });
  } catch (e) {
    console.error("PUT /api/auto-replenish error:", e);
    return NextResponse.json({ error: "Failed to update rule" }, { status: 500 });
  }
}
