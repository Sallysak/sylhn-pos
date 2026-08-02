import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requirePermission } from "@/lib/auth";
import { rateLimitApiRead, rateLimitResponse, getClientIp } from "@/lib/rate-limit";
import { auditLog } from "@/lib/audit";

// GET /api/data-sync/pull
// Pulls ALL server data to the client (for local storage sync).
// Returns: { products, groups, suppliers, customers, expenses, heldOrders, sales, settings }
export async function GET(req: NextRequest) {
  let user;
  try { user = await requireAuth(); requirePermission(user.role, "canAdjustStock"); } catch (e) { return e as Response; }
  const ip = getClientIp(req);
  const rl = rateLimitApiRead(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  try {
    const [
      products,
      groups,
      suppliers,
      customers,
      expenses,
      heldOrders,
      settings,
      recentSales,
    ] = await Promise.all([
      db.product.findMany({
        where: { active: true },
        select: {
          id: true, sku: true, barcode: true, name: true, emoji: true,
          category: true, price: true, costPrice: true, quantity: true,
          unit: true, reorderLevel: true, taxable: true,
          batchNumber: true,
          expiryDate: true, receivedDate: true, active: true,
          groupId: true,
        },
      }),
      db.stockGroup.findMany(),
      db.supplier.findMany({ select: { id: true, name: true, phone: true, email: true, address: true, balance: true } }),
      db.customer.findMany({ select: { id: true, name: true, phone: true, email: true, balance: true, pointsBalance: true, tier: true } }),
      db.expense.findMany({
        orderBy: { date: 'desc' },
        take: 100,
        select: { id: true, date: true, category: true, description: true, amount: true },
      }),
      db.heldOrder.findMany({
        select: { id: true, invoiceNumber: true, customerName: true, items: true, createdAt: true },
      }),
      db.systemSetting.findMany(),
      db.sale.findMany({
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          id: true, invoiceNumber: true, customerName: true, cashierName: true,
          subtotal: true, discount: true, taxAmount: true, total: true,
          amountPaid: true, change: true, paymentMethod: true,
          status: true, createdAt: true,
        },
      }),
    ]);

    // Transform products for client (quantity → stock)
    const clientProducts = products.map(p => ({
      ...p,
      stock: p.quantity,
      supplier: '',
      expiryDate: p.expiryDate?.toISOString() || null,
      receivedDate: p.receivedDate?.toISOString() || null,
    }));

    await auditLog({
      userId: user.uid,
      user: user.username,
      action: "DATA_PULL",
      module: "system",
      details: `Pulled from server: ${clientProducts.length} products, ${groups.length} groups, ${suppliers.length} suppliers, ${customers.length} customers, ${expenses.length} expenses, ${heldOrders.length} held orders, ${recentSales.length} recent sales`,
      severity: "info",
      ipAddress: ip,
      userAgent: req.headers.get("user-agent") || "",
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      products: clientProducts,
      groups,
      suppliers,
      customers,
      expenses,
      heldOrders,
      settings: settings.reduce((acc, s) => { acc[s.key] = s.value; return acc; }, {} as Record<string, string>),
      recentSales,
      pulledAt: new Date().toISOString(),
      counts: {
        products: clientProducts.length,
        groups: groups.length,
        suppliers: suppliers.length,
        customers: customers.length,
        expenses: expenses.length,
        heldOrders: heldOrders.length,
        sales: recentSales.length,
        settings: settings.length,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Pull failed" }, { status: 500 });
  }
}
