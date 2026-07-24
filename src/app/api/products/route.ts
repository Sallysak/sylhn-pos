import { NextRequest, NextResponse } from "next/server";
import { db, waitForDb } from "@/lib/db";
import { requireAuth, requirePermission } from "@/lib/auth";
import { ProductSchema, ProductBulkSchema, validate, validationError } from "@/lib/validation";
import { rateLimitApiRead, rateLimitApiWrite, rateLimitResponse, getClientIp } from "@/lib/rate-limit";
import crypto from "crypto";

// GET /api/products — list all products (requires auth)
//
// Query params:
//   includeInactive=true  — include soft-deleted products
//   groupId=<id>          — filter by stock group
//   lowStock=true         — only return products at or below reorderLevel
//   since=<ISO_DATE>      — INCREMENTAL SYNC: only return products updated
//                            after this timestamp. Returns a `cursor` field
//                            (current server time) that the client should
//                            pass as `since` on the next call.
//                            If the client passes the cursor from the last
//                            response, only changed products are returned.
//
// ETag support:
//   The response includes an `ETag` header (a hash of the products list).
//   Clients can send `If-None-Match: "<etag>"` on subsequent requests — if
//   nothing changed, the server returns 304 Not Modified (empty body).
//   This is most useful for non-incremental calls (no `since` param).
export async function GET(req: NextRequest) {
  try { await requireAuth(); } catch (e) { return e as Response; }
  await waitForDb();

  const ip = getClientIp(req);
  const rl = rateLimitApiRead(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  try {
    const { searchParams } = new URL(req.url);
    const includeInactive = searchParams.get("includeInactive") === "true";
    const groupId = searchParams.get("groupId");
    const lowStock = searchParams.get("lowStock") === "true";
    const since = searchParams.get("since");  // ISO date for incremental sync

    const where: any = {};
    if (!includeInactive) where.active = true;
    if (groupId) where.groupId = groupId;
    if (since) {
      // Incremental sync: only return products updated after `since`.
      // The client should pass the `cursor` from the previous response.
      try {
        const sinceDate = new Date(since);
        if (!isNaN(sinceDate.getTime())) {
          where.updatedAt = { gt: sinceDate };
        }
      } catch { /* invalid date — ignore, return full list */ }
    }
    // SQLite (Prisma) cannot do column-to-column comparisons in `where`.
    // For low-stock filtering, we fetch candidates and filter in JS:
    //   "low stock" = quantity <= reorderLevel (not just quantity <= 0)
    if (lowStock) {
      // No `where.quantity` filter — we'll filter after fetch
    }

    const products = await db.product.findMany({
      where,
      include: {
        group: true,
        suppliers: { include: { supplier: true } },
      },
      orderBy: { name: "asc" },
    });

    // Apply low-stock filter in JS (SQLite limitation workaround)
    const filtered = lowStock
      ? products.filter(p => p.quantity <= p.reorderLevel)
      : products;

    // Compute ETag (hash of product IDs + updatedAt timestamps).
    // This lets clients send If-None-Match on subsequent requests and get a
    // 304 Not Modified response if nothing changed.
    const etagSource = filtered.map(p => `${p.id}:${p.updatedAt.toISOString()}`).join("|");
    const etag = `"${crypto.createHash("sha1").update(etagSource).digest("hex").slice(0, 16)}"`;
    const ifNoneMatch = req.headers.get("if-none-match");
    if (ifNoneMatch === etag) {
      // 304 Not Modified — client's cache is still fresh.
      // Don't send a body — saves bandwidth.
      return new NextResponse(null, {
        status: 304,
        headers: {
          "ETag": etag,
          "Cache-Control": "no-cache",  // must revalidate every time
        },
      });
    }

    // The cursor is the current server time. Clients should pass it as `since`
    // on the next call. We use `gt` (not `gte`) so we don't return the same
    // record twice if it was updated at exactly the cursor time.
    const cursor = new Date().toISOString();

    return NextResponse.json({
      products: filtered,
      count: filtered.length,
      cursor,
      incremental: !!since,
    }, {
      headers: {
        "ETag": etag,
        "Cache-Control": "no-cache",  // must revalidate
        "X-Total-Products": String(filtered.length),
      },
    });
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

    // ===== Validate groupId exists before creating (foreign key constraint) =====
    // The form sometimes sends a stale groupId (e.g. "g1" from localStorage
    // cache) that no longer exists after a wipe. Prisma would throw a
    // foreign key error — we catch it here and return a helpful message.
    let validGroupId: string | null = null;
    if (p.groupId && typeof p.groupId === "string" && p.groupId !== "null") {
      try {
        const group = await db.stockGroup.findUnique({ where: { id: p.groupId }, select: { id: true } });
        if (group) {
          validGroupId = group.id;
        } else {
          // Group doesn't exist — silently fall back to null rather than
          // failing the whole product create. The product can be assigned
          // to a group later via the UI.
          console.warn(`[POST /api/products] groupId "${p.groupId}" not found — creating product without group`);
        }
      } catch (e) {
        console.warn(`[POST /api/products] could not look up groupId "${p.groupId}":`, e);
      }
    }

    let product;
    try {
      product = await db.product.create({
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
          batchNumber: p.batchNumber || "",
          expiryDate: p.expiryDate ? new Date(p.expiryDate as string) : null,
          receivedDate: p.receivedDate ? new Date(p.receivedDate as string) : null,
          groupId: validGroupId,
          active: p.active !== false,
        },
        include: { group: true, suppliers: { include: { supplier: true } } },
      });
    } catch (createErr: any) {
      // Handle common Prisma errors with helpful messages
      if (createErr?.code === "P2002") {
        return NextResponse.json({
          error: "A product with this SKU already exists. Use a different SKU.",
        }, { status: 409 });
      }
      console.error("POST /api/products create error:", createErr);
      return NextResponse.json({
        error: "Failed to create product",
        detail: createErr?.message || String(createErr),
      }, { status: 500 });
    }

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
