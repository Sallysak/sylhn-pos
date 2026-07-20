import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requirePermission } from "@/lib/auth";
import { rateLimitApiWrite, rateLimitResponse, getClientIp } from "@/lib/rate-limit";
import { auditLog } from "@/lib/audit";

// POST /api/data-sync/push
// Pushes local data (products, stock history, held orders, expenses) to the server.
// Body: { products?: [], history?: [], heldOrders?: [], expenses?: [] }
// Returns: { pushed: { products, history, heldOrders, expenses }, errors: [] }
export async function POST(req: NextRequest) {
  let user;
  try { user = await requireAuth(); requirePermission(user.role, "canAdjustStock"); } catch (e) { return e as Response; }
  const ip = getClientIp(req);
  const rl = rateLimitApiWrite(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const result = { pushed: { products: 0, history: 0, heldOrders: 0, expenses: 0 }, errors: [] as string[] };

  try {
    // ===== Push products =====
    if (body.products && Array.isArray(body.products)) {
      for (const p of body.products) {
        try {
          // Try to find by SKU
          const existing = await db.product.findUnique({ where: { sku: p.sku } });
          if (existing) {
            // Update existing product
            await db.product.update({
              where: { id: existing.id },
              data: {
                name: p.name || existing.name,
                price: p.price ?? existing.price,
                costPrice: p.costPrice ?? existing.costPrice,
                quantity: (p.stock ?? p.quantity) || 0,
                barcode: p.barcode || existing.barcode,
                emoji: p.emoji || existing.emoji,
                category: p.category || existing.category,
                unit: p.unit || existing.unit,
                reorderLevel: p.reorderLevel ?? existing.reorderLevel,
                taxable: p.taxable ?? existing.taxable,
                expiryDate: p.expiryDate ? new Date(p.expiryDate) : existing.expiryDate,
                batchNumber: p.batchNumber || existing.batchNumber,
                active: p.active !== false,
              },
            });
          } else {
            // Create new product
            await db.product.create({
              data: {
                sku: p.sku,
                name: p.name || 'Unnamed',
                price: p.price || 0,
                costPrice: p.costPrice || 0,
                quantity: (p.stock ?? p.quantity) || 0,
                barcode: p.barcode || '',
                emoji: p.emoji || '📦',
                category: p.category || 'other',
                unit: p.unit || 'each',
                reorderLevel: p.reorderLevel || 5,
                taxable: p.taxable ?? true,
                expiryDate: p.expiryDate ? new Date(p.expiryDate) : null,
                batchNumber: p.batchNumber || '',
                active: true,
              },
            });
          }
          result.pushed.products++;
        } catch (e: any) {
          result.errors.push(`Product ${p.sku}: ${e?.message}`);
        }
      }
    }

    // ===== Push stock history =====
    if (body.history && Array.isArray(body.history)) {
      for (const h of body.history) {
        try {
          // Find the product by SKU
          const product = await db.product.findUnique({ where: { sku: h.sku } });
          if (product) {
            await db.stockHistory.create({
              data: {
                productId: product.id,
                action: h.action || 'adjusted',
                quantity: h.quantityChange ?? 0,
                reason: h.reason || 'Pushed from local',
                reference: h.reference || '',
                userId: user.uid,
              },
            });
            result.pushed.history++;
          }
        } catch (e: any) {
          result.errors.push(`History ${h.sku}: ${e?.message}`);
        }
      }
    }

    // ===== Push expenses =====
    if (body.expenses && Array.isArray(body.expenses)) {
      for (const exp of body.expenses) {
        try {
          await db.expense.create({
            data: {
              date: exp.date ? new Date(exp.date) : new Date(),
              category: exp.category || 'other',
              description: exp.description || '',
              amount: exp.amount || 0,
            },
          });
          result.pushed.expenses++;
        } catch (e: any) {
          result.errors.push(`Expense: ${e?.message}`);
        }
      }
    }

    // ===== Push held orders =====
    if (body.heldOrders && Array.isArray(body.heldOrders)) {
      for (const order of body.heldOrders) {
        try {
          // Create as a held order
          const orderTotal = order.items?.reduce((s: number, i: any) => s + (i.price * i.quantity), 0) || 0;
          await db.heldOrder.create({
            data: {
              invoiceNumber: order.invoice || `HELD-${Date.now()}`,
              customerName: order.customer || 'Walk-in',
              cashierName: user.username,
              cashierId: user.uid,
              items: JSON.stringify(order.items || []),
            },
          });
          result.pushed.heldOrders++;
        } catch (e: any) {
          result.errors.push(`Held order: ${e?.message}`);
        }
      }
    }

    await auditLog({
      userId: user.uid,
      user: user.username,
      action: "DATA_PUSH",
      module: "system",
      details: `Pushed to server: ${result.pushed.products} products, ${result.pushed.history} history, ${result.pushed.expenses} expenses, ${result.pushed.heldOrders} held orders`,
      severity: "info",
      ipAddress: ip,
      userAgent: req.headers.get("user-agent") || "",
    }).catch(() => {});

    return NextResponse.json({ success: true, ...result });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Push failed" }, { status: 500 });
  }
}
