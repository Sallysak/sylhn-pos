import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requirePermission } from "@/lib/auth";
import { rateLimitApiRead, rateLimitApiWrite, rateLimitResponse, getClientIp } from "@/lib/rate-limit";
import { auditLog } from "@/lib/audit";

// ============================================================================
// GET /api/suppliers/[id]/products — list the supplier's product catalog
// ============================================================================
// Returns the supplier's linked products (from ProductSupplier join table),
// including the supplier-specific SKU + cost + lead time.
// ============================================================================
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { await requireAuth(); } catch (e) { return e as Response; }
  const ip = getClientIp(req);
  const rl = rateLimitApiRead(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  const { id } = await params;
  const supplier = await db.supplier.findUnique({ where: { id }, select: { id: true, name: true } });
  if (!supplier) return NextResponse.json({ error: "Supplier not found" }, { status: 404 });

  const catalog = await db.productSupplier.findMany({
    where: { supplierId: id },
    include: {
      product: {
        select: {
          id: true, sku: true, name: true, emoji: true,
          costPrice: true,
          quantity: true, barcode: true,
        },
      },
    },
    orderBy: { product: { name: "asc" } },
  });

  return NextResponse.json({
    supplier,
    catalog: catalog.map((c: any) => ({
      id: c.id,
      productId: c.productId,
      supplierSku: c.supplierSku,
      supplierCost: Number(c.supplierCost),
      leadTimeDays: c.leadTimeDays,
      preferred: c.preferred,
      product: c.product,
    })),
  });
}

// ============================================================================
// POST /api/suppliers/[id]/products — link a product to this supplier's catalog
// ============================================================================
// Body: { productId, supplierSku?, supplierCost?, leadTimeDays?, preferred? }
// ============================================================================
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let user;
  try { user = await requireAuth(); requirePermission(user.role, "purchase"); } catch (e) { return e as Response; }
  const ip = getClientIp(req);
  const rl = rateLimitApiWrite(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  const { id } = await params;
  let body: any;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.productId) {
    return NextResponse.json({ error: "productId is required" }, { status: 400 });
  }

  // Verify supplier + product both exist
  const supplier = await db.supplier.findUnique({ where: { id }, select: { id: true, name: true, code: true } });
  if (!supplier) return NextResponse.json({ error: "Supplier not found" }, { status: 404 });
  const product = await db.product.findUnique({ where: { id: String(body.productId) }, select: { id: true, sku: true, name: true } });
  if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

  // Upsert (productId + supplierId is unique)
  const existing = await db.productSupplier.findUnique({
    where: { productId_supplierId: { productId: String(body.productId), supplierId: id } },
  });

  let catalogEntry;
  if (existing) {
    catalogEntry = await db.productSupplier.update({
      where: { id: existing.id },
      data: {
        supplierSku: String(body.supplierSku || existing.supplierSku || ""),
        supplierCost: Number(body.supplierCost) || existing.supplierCost,
        leadTimeDays: Number(body.leadTimeDays) || existing.leadTimeDays,
        preferred: body.preferred !== undefined ? !!body.preferred : existing.preferred,
      },
      include: { product: { select: { id: true, sku: true, name: true, emoji: true } } },
    });
  } else {
    catalogEntry = await db.productSupplier.create({
      data: {
        supplierId: id,
        productId: String(body.productId),
        supplierSku: String(body.supplierSku || ""),
        supplierCost: Number(body.supplierCost) || 0,
        leadTimeDays: Number(body.leadTimeDays) || 0,
        preferred: !!body.preferred,
      },
      include: { product: { select: { id: true, sku: true, name: true, emoji: true } } },
    });
  }

  // If supplierCost is provided and higher than 0, also update the product's costPrice
  // (last-known cost) so the purchase form picks it up automatically
  if (Number(body.supplierCost) > 0) {
    await db.product.update({
      where: { id: String(body.productId) },
      data: { costPrice: Number(body.supplierCost) },
    }).catch(() => {});
  }

  await auditLog({
    userId: user.uid,
    user: user.username,
    action: existing ? "UPDATE" : "CREATE",
    module: "supplier",
    details: `${existing ? "Updated" : "Added"} catalog entry for ${supplier.name} (${supplier.code}): ${product.name} (${product.sku}) — ₵${Number(body.supplierCost || 0).toFixed(2)}`,
    severity: "info",
    ipAddress: ip,
    userAgent: req.headers.get("user-agent") || "",
  }).catch(() => {});

  return NextResponse.json({ success: true, catalogEntry }, { status: existing ? 200 : 201 });
}

// ============================================================================
// DELETE /api/suppliers/[id]/products?productId=xxx — unlink a product
// ============================================================================
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let user;
  try { user = await requireAuth(); requirePermission(user.role, "purchase"); } catch (e) { return e as Response; }
  const ip = getClientIp(req);
  const rl = rateLimitApiWrite(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const productId = searchParams.get("productId");
  if (!productId) {
    return NextResponse.json({ error: "productId query parameter required" }, { status: 400 });
  }

  await db.productSupplier.deleteMany({
    where: { supplierId: id, productId },
  });

  await auditLog({
    userId: user.uid,
    user: user.username,
    action: "DELETE",
    module: "supplier",
    details: `Removed product ${productId} from supplier ${id}'s catalog`,
    severity: "info",
    ipAddress: ip,
    userAgent: req.headers.get("user-agent") || "",
  }).catch(() => {});

  return NextResponse.json({ success: true });
}
