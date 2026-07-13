import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/products/[id] — get one product
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const product = await db.product.findUnique({
      where: { id },
      include: { group: true, stockHistory: { take: 50, orderBy: { createdAt: "desc" } } },
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
  try {
    const { id } = await params;
    const body = await req.json();
    const product = await db.product.update({
      where: { id },
      data: {
        ...(body.sku && { sku: body.sku }),
        ...(body.barcode !== undefined && { barcode: body.barcode }),
        ...(body.name && { name: body.name }),
        ...(body.emoji && { emoji: body.emoji }),
        ...(body.category && { category: body.category }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.price !== undefined && { price: Number(body.price) }),
        ...(body.costPrice !== undefined && { costPrice: Number(body.costPrice) }),
        ...(body.quantity !== undefined && { quantity: Number(body.quantity) }),
        ...(body.unit && { unit: body.unit }),
        ...(body.reorderLevel !== undefined && { reorderLevel: Number(body.reorderLevel) }),
        ...(body.taxable !== undefined && { taxable: body.taxable }),
        ...(body.batchNumber !== undefined && { batchNumber: body.batchNumber }),
        ...(body.expiryDate !== undefined && { expiryDate: body.expiryDate ? new Date(body.expiryDate) : null }),
        ...(body.receivedDate !== undefined && { receivedDate: body.receivedDate ? new Date(body.receivedDate) : null }),
        ...(body.supplier !== undefined && { supplier: body.supplier }),
        ...(body.groupId !== undefined && { groupId: body.groupId || null }),
        ...(body.active !== undefined && { active: body.active }),
      },
    });
    return NextResponse.json({ success: true, product });
  } catch (e) {
    console.error("PUT /api/products/[id] error:", e);
    return NextResponse.json({ error: "Failed to update product" }, { status: 500 });
  }
}

// DELETE /api/products/[id] — soft delete (set active=false)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const force = req.nextUrl.searchParams.get("force") === "true";
    if (force) {
      await db.product.delete({ where: { id } });
    } else {
      await db.product.update({ where: { id }, data: { active: false } });
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("DELETE /api/products/[id] error:", e);
    return NextResponse.json({ error: "Failed to delete product" }, { status: 500 });
  }
}
