import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requirePermission } from "@/lib/auth";
import { ProductSchema, ProductBulkSchema, validate, validationError } from "@/lib/validation";
import { rateLimitApiRead, rateLimitApiWrite, rateLimitResponse, getClientIp } from "@/lib/rate-limit";

// GET /api/products — list all products (requires auth)
export async function GET(req: NextRequest) {
  try { await requireAuth(); } catch (e) { return e as Response; }

  const ip = getClientIp(req);
  const rl = rateLimitApiRead(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  try {
    const { searchParams } = new URL(req.url);
    const includeInactive = searchParams.get("includeInactive") === "true";
    const groupId = searchParams.get("groupId");
    const lowStock = searchParams.get("lowStock") === "true";

    const where: any = {};
    if (!includeInactive) where.active = true;
    if (groupId) where.groupId = groupId;
    if (lowStock) {
      // Products at or below reorder level
      where.quantity = { lte: 0 }; // Prisma can't do column-to-column compare directly; this is a simplified version
    }

    const products = await db.product.findMany({
      where,
      include: {
        group: true,
        suppliers: { include: { supplier: true } },
      },
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
        groupId: p.groupId || null,
      },
      include: { group: true, suppliers: { include: { supplier: true } } },
    });

    // Log audit
    await db.auditLog.create({
      data: {
        userId: user.uid,
        user: user.username,
        action: "CREATE",
        module: "stock",
        details: `Product ${product.sku} (${product.name}) created`,
        severity: "info",
      },
    });

    return NextResponse.json({ success: true, product });
  } catch (e) {
    console.error("POST /api/products error:", e);
    return NextResponse.json({ error: "Failed to create product" }, { status: 500 });
  }
}
