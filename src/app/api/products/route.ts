import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requirePermission } from "@/lib/auth";
import { ProductSchema, ProductBulkSchema, validate, validationError } from "@/lib/validation";
import { rateLimitApiRead, rateLimitApiWrite, rateLimitResponse, getClientIp } from "@/lib/rate-limit";

// GET /api/products — list all products (requires auth + stock permission)
export async function GET(req: NextRequest) {
  try {
    await requireAuth();
  } catch (e) {
    return e as Response;
  }

  const ip = getClientIp(req);
  const rl = rateLimitApiRead(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

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

// POST /api/products — bulk upsert (sync) or single create
export async function POST(req: NextRequest) {
  let user;
  try {
    user = await requireAuth();
    requirePermission(user.role, "stock");
  } catch (e) {
    return e as Response;
  }

  const ip = getClientIp(req);
  const rl = rateLimitApiWrite(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return validationError("Invalid JSON body");
  }

  try {
    // Bulk upsert (sync from client localStorage)
    if (Array.isArray((body as any)?.products)) {
      const result = validate(ProductBulkSchema, body);
      if (!result.success) return validationError(result.error);

      const results: any[] = [];
      for (const p of result.data.products) {
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
          expiryDate: p.expiryDate ? new Date(p.expiryDate as string) : null,
          receivedDate: p.receivedDate ? new Date(p.receivedDate as string) : null,
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
    const result = validate(ProductSchema, body);
    if (!result.success) return validationError(result.error);
    const p = result.data;

    const product = await db.product.create({
      data: {
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
        supplier: p.supplier || "",
        groupId: p.groupId || null,
      },
    });
    return NextResponse.json({ success: true, product });
  } catch (e) {
    console.error("POST /api/products error:", e);
    return NextResponse.json({ error: "Failed to create product" }, { status: 500 });
  }
}
