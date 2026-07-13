import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requirePermission } from "@/lib/auth";
import { ProductUpdateSchema, validate, validationError } from "@/lib/validation";
import { rateLimitApiRead, rateLimitApiWrite, rateLimitResponse, getClientIp } from "@/lib/rate-limit";

// GET /api/products/[id] — get one product with full relations
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { await requireAuth(); } catch (e) { return e as Response; }

  const ip = getClientIp(req);
  const rl = rateLimitApiRead(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  try {
    const { id } = await params;
    const product = await db.product.findUnique({
      where: { id },
      include: {
        group: true,
        suppliers: { include: { supplier: true } },
        stockHistory: {
          take: 50,
          orderBy: { createdAt: "desc" },
          include: { user: { select: { fullName: true, username: true } } },
        },
        saleItems: {
          take: 20,
          orderBy: { sale: { createdAt: "desc" } },
          include: { sale: { select: { invoiceNumber: true, createdAt: true, status: true } } },
        },
      },
    });
    if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });
    return NextResponse.json({ product });
  } catch (e) {
    console.error("GET /api/products/[id] error:", e);
    return NextResponse.json({ error: "Failed to fetch product" }, { status: 500 });
  }
}

// PUT /api/products/[id] — update
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let user;
  try {
    user = await requireAuth();
    requirePermission(user.role, "stock");
  } catch (e) { return e as Response; }

  const ip = getClientIp(req);
  const rl = rateLimitApiWrite(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  let body: unknown;
  try { body = await req.json(); } catch { return validationError("Invalid JSON body"); }

  const result = validate(ProductUpdateSchema, body);
  if (!result.success) return validationError(result.error);

  try {
    const { id } = await params;
    const updates = result.data;

    // Capture previous quantity for stock history if quantity changed
    const previous = await db.product.findUnique({ where: { id }, select: { quantity: true, name: true, sku: true } });
    if (!previous) return NextResponse.json({ error: "Product not found" }, { status: 404 });

    const product = await db.product.update({
      where: { id },
      data: {
        ...(updates.sku !== undefined && { sku: updates.sku }),
        ...(updates.barcode !== undefined && { barcode: updates.barcode }),
        ...(updates.name !== undefined && { name: updates.name }),
        ...(updates.emoji !== undefined && { emoji: updates.emoji }),
        ...(updates.category !== undefined && { category: updates.category }),
        ...(updates.description !== undefined && { description: updates.description }),
        ...(updates.price !== undefined && { price: Number(updates.price) }),
        ...(updates.costPrice !== undefined && { costPrice: Number(updates.costPrice) }),
        ...(updates.quantity !== undefined && { quantity: Number(updates.quantity) }),
        ...(updates.unit !== undefined && { unit: updates.unit }),
        ...(updates.reorderLevel !== undefined && { reorderLevel: Number(updates.reorderLevel) }),
        ...(updates.taxable !== undefined && { taxable: updates.taxable }),
        ...(updates.batchNumber !== undefined && { batchNumber: updates.batchNumber }),
        ...(updates.expiryDate !== undefined && { expiryDate: updates.expiryDate ? new Date(updates.expiryDate as string) : null }),
        ...(updates.receivedDate !== undefined && { receivedDate: updates.receivedDate ? new Date(updates.receivedDate as string) : null }),
        ...(updates.groupId !== undefined && { groupId: updates.groupId || null }),
        ...(updates.active !== undefined && { active: updates.active }),
      },
      include: { group: true, suppliers: { include: { supplier: true } } },
    });

    // If quantity changed, log to stock history
    if (updates.quantity !== undefined && previous.quantity !== Number(updates.quantity)) {
      const diff = Number(updates.quantity) - previous.quantity;
      await db.stockHistory.create({
        data: {
          productId: id,
          action: "adjusted",
          quantity: diff,
          reason: `Manual adjustment by ${user.username}`,
          reference: `Product update`,
          userId: user.uid,
        },
      });
    }

    await db.auditLog.create({
      data: {
        userId: user.uid,
        user: user.username,
        action: "UPDATE",
        module: "stock",
        details: `Product ${previous.sku} (${previous.name}) updated`,
        severity: "info",
      },
    });

    return NextResponse.json({ success: true, product });
  } catch (e) {
    console.error("PUT /api/products/[id] error:", e);
    return NextResponse.json({ error: "Failed to update product" }, { status: 500 });
  }
}

// DELETE /api/products/[id] — soft delete (set active=false) or hard delete with ?force=true
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let user;
  try {
    user = await requireAuth();
    requirePermission(user.role, "canDeleteProducts");
  } catch (e) { return e as Response; }

  const ip = getClientIp(req);
  const rl = rateLimitApiWrite(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  try {
    const { id } = await params;
    const force = req.nextUrl.searchParams.get("force") === "true";

    const product = await db.product.findUnique({ where: { id }, select: { sku: true, name: true } });
    if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

    if (force) {
      await db.product.delete({ where: { id } });
    } else {
      await db.product.update({ where: { id }, data: { active: false } });
    }

    await db.auditLog.create({
      data: {
        userId: user.uid,
        user: user.username,
        action: "DELETE",
        module: "stock",
        details: `Product ${product.sku} (${product.name}) ${force ? "hard-deleted" : "deactivated"}`,
        severity: "warning",
      },
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("DELETE /api/products/[id] error:", e);
    return NextResponse.json({ error: "Failed to delete product" }, { status: 500 });
  }
}
