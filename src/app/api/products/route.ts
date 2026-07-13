import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/products — list all products
export async function GET() {
  try {
    const products = await db.product.findMany({
      where: { active: true },
      include: { group: true },
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ products });
  } catch (e) {
    console.error("GET /api/products error:", e);
    return NextResponse.json({ error: "Failed to fetch products" }, { status: 500 });
  }
}

// POST /api/products — bulk upsert (for sync) or single create
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Bulk upsert (sync from client localStorage)
    if (Array.isArray(body.products)) {
      const results: any[] = [];
      for (const p of body.products) {
        const data = {
          sku: p.sku,
          barcode: p.barcode || "",
          name: p.name,
          emoji: p.emoji || "📦",
          category: p.category || "other",
          description: p.description || "",
          price: Number(p.price) || 0,
          costPrice: Number(p.costPrice) || 0,
          quantity: Number(p.quantity) || 0,
          unit: p.unit || "each",
          reorderLevel: Number(p.reorderLevel) || 5,
          taxable: p.taxable !== false,
          batchNumber: p.batchNumber || "",
          expiryDate: p.expiryDate ? new Date(p.expiryDate) : null,
          receivedDate: p.receivedDate ? new Date(p.receivedDate) : null,
          supplier: p.supplier || "",
          groupId: p.groupId || null,
          active: p.active !== false,
        };
        const record = await db.product.upsert({
          where: { sku: p.sku },
          create: data,
          update: data,
        });
        results.push(record);
      }
      return NextResponse.json({ success: true, count: results.length });
    }

    // Single create
    if (body.name && body.sku) {
      const product = await db.product.create({
        data: {
          sku: body.sku,
          barcode: body.barcode || "",
          name: body.name,
          emoji: body.emoji || "📦",
          category: body.category || "other",
          description: body.description || "",
          price: Number(body.price) || 0,
          costPrice: Number(body.costPrice) || 0,
          quantity: Number(body.quantity) || 0,
          unit: body.unit || "each",
          reorderLevel: Number(body.reorderLevel) || 5,
          taxable: body.taxable !== false,
          supplier: body.supplier || "",
          groupId: body.groupId || null,
        },
      });
      return NextResponse.json({ success: true, product });
    }

    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  } catch (e) {
    console.error("POST /api/products error:", e);
    return NextResponse.json({ error: "Failed to create product" }, { status: 500 });
  }
}
