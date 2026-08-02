import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requirePermission } from "@/lib/auth";
import { rateLimitApiWrite, rateLimitResponse, getClientIp } from "@/lib/rate-limit";
import { auditLogTx } from "@/lib/audit";
import { generatePurchaseRefNo } from "@/lib/identifiers";

// POST /api/products/[id]/quick-reorder
// One-click draft PO creation. Looks up the product's PREFERRED supplier
// (ProductSupplier.preferred = true), uses the supplier's last cost, and
// creates a draft PO with quantity = max(reorderLevel × 2, 10).
//
// Body (optional): { quantity?: number, supplierId?: string }
//   - quantity: override the default reorder quantity
//   - supplierId: override the preferred supplier
//
// Returns the created Purchase object so the client can navigate to
// the PO form or Purchase Hub to review/edit.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let user;
  try {
    user = await requireAuth();
    requirePermission(user.role, "purchase");
  } catch (e) { return e as Response; }

  const ip = getClientIp(req);
  const rl = rateLimitApiWrite(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  let body: any = {};
  try { body = await req.json(); } catch { /* empty body is fine */ }

  try {
    const { id } = await params;
    const product = await db.product.findUnique({
      where: { id },
      select: {
        id: true, sku: true, name: true, emoji: true,
        costPrice: true, quantity: true, reorderLevel: true,
        active: true,
      },
    });
    if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

    // Find the preferred supplier (or the override)
    let supplierLink: any = null;
    if (body.supplierId) {
      supplierLink = await db.productSupplier.findUnique({
        where: {
          productId_supplierId: { productId: id, supplierId: body.supplierId },
        },
        include: { supplier: { select: { id: true, name: true, code: true, active: true } } },
      });
    } else {
      // Find preferred supplier, fall back to any supplier
      supplierLink = await db.productSupplier.findFirst({
        where: { productId: id, preferred: true, supplier: { active: true } },
        include: { supplier: { select: { id: true, name: true, code: true, active: true } } },
      });
      if (!supplierLink) {
        supplierLink = await db.productSupplier.findFirst({
          where: { productId: id, supplier: { active: true } },
          include: { supplier: { select: { id: true, name: true, code: true, active: true } } },
        });
      }
    }

    if (!supplierLink) {
      return NextResponse.json({
        error: "No supplier linked",
        detail: `No supplier is linked to "${product.name}". Add one via Suppliers → Catalog first.`,
        code: "NO_SUPPLIER",
      }, { status: 400 });
    }

    // Compute reorder quantity: default = max(reorderLevel × 2, 10)
    const reorderQty = Math.max(
      parseInt(body.quantity, 10) || Math.max((product.reorderLevel || 5) * 2, 10),
      1
    );
    const unitCost = supplierLink.supplierCost || product.costPrice || 0;
    const lineGross = reorderQty * unitCost;

    // Create a draft PO
    const refNo = generatePurchaseRefNo();
    const purchase = await db.$transaction(async (tx) => {
      const newPurchase = await tx.purchase.create({
        data: {
          refNo,
          type: "order",
          supplierId: supplierLink.supplier.id,
          supplierName: supplierLink.supplier.name,
          status: "draft",          // draft — user reviews before sending
          subtotal: lineGross,
          discount: 0,
          taxAmount: 0,
          total: lineGross,
          amountPaid: 0,
          notes: `Quick reorder for ${product.name} (stock: ${product.quantity}, reorder level: ${product.reorderLevel})`,
          createdById: user.uid,
          expectedAt: null,
          items: {
            create: [{
              productId: product.id,
              partNo: product.sku,
              details: product.name,
              emoji: product.emoji || "📦",
              quantity: reorderQty,
              cost: unitCost,
              tax: false,
              total: lineGross,
              taxRate: 0,
              taxAmount: 0,
              discountAmount: 0,
              freeQuantity: 0,
              retailPrice: 0,
              tradePrice: 0,
              wholesalePrice: 0,
              landedCostPerUnit: 0,
              totalLandedCost: 0,
            }],
          },
        },
        include: { items: true, supplier: true },
      });

      await auditLogTx(tx, {
        userId: user.uid,
        user: user.username,
        action: "QUICK_REORDER",
        module: "purchase",
        details: `Quick reorder draft ${refNo} created — ${product.name} × ${reorderQty} @ ${unitCost.toFixed(2)} = ${lineGross.toFixed(2)} from ${supplierLink.supplier.name} (stock was ${product.quantity})`,
        severity: "info",
        ipAddress: ip,
        userAgent: req.headers.get("user-agent") || "",
      });

      return newPurchase;
    });

    return NextResponse.json({
      success: true,
      purchase,
      message: `Draft PO ${refNo} created — ${reorderQty} × ${product.name} from ${supplierLink.supplier.name}. Review and send when ready.`,
    });
  } catch (e: any) {
    console.error("POST /api/products/[id]/quick-reorder error:", e);
    return NextResponse.json({ error: e?.message || "Failed to create quick reorder" }, { status: 500 });
  }
}
