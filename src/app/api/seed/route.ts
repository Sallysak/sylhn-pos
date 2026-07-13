import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole, hashPassword } from "@/lib/auth";
import { rateLimitSeed, rateLimitResponse } from "@/lib/rate-limit";
import { headers } from "next/headers";

// POST /api/seed — seed the database with initial demo data
// Admin-only + heavily rate-limited (3/hour) since it's destructive.
export async function POST(req: Request) {
  try { await requireRole("admin"); } catch (e) { return e as Response; }

  // Rate limit
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  const ip = fwd ? fwd.split(",")[0].trim() : "127.0.0.1";
  const rl = rateLimitSeed(ip);
  if (!rl.allowed) return rateLimitResponse(rl, "Seed rate limit exceeded.");

  try {
    // Wipe (order matters for FK constraints)
    await db.stockHistory.deleteMany();
    await db.saleItem.deleteMany();
    await db.sale.deleteMany();
    await db.purchaseItem.deleteMany();
    await db.purchase.deleteMany();
    await db.product.deleteMany();
    await db.stockGroup.deleteMany();
    await db.supplier.deleteMany();
    await db.systemUser.deleteMany();
    await db.expense.deleteMany();
    await db.heldOrder.deleteMany();
    await db.auditLog.deleteMany();

    // Hash the default passwords
    const [adminPwd, managerPwd, cashierPwd] = await Promise.all([
      hashPassword("admin123"),
      hashPassword("manager123"),
      hashPassword("cashier123"),
    ]);

    await db.systemUser.create({
      data: {
        username: "admin", password: adminPwd, fullName: "System Administrator",
        role: "admin", phone: "+233592766044", email: "admin@sylhn.com",
        permissions: JSON.stringify({
          pos: true, sales: true, stock: true, purchase: true, accounts: true,
          telephone: true, maintenance: true, financeOps: true,
          canVoid: true, canDiscount: true, canAdjustStock: true,
          canDeleteProducts: true, canExport: true,
        }),
      },
    });
    await db.systemUser.create({
      data: {
        username: "manager", password: managerPwd, fullName: "Store Manager",
        role: "manager", phone: "+233 24 111 2222", email: "manager@sylhn.com",
        permissions: JSON.stringify({
          pos: true, sales: true, stock: true, purchase: true, accounts: true,
          telephone: true, maintenance: false, financeOps: true,
          canVoid: true, canDiscount: true, canAdjustStock: true,
          canDeleteProducts: false, canExport: true,
        }),
      },
    });
    await db.systemUser.create({
      data: {
        username: "cashier", password: cashierPwd, fullName: "Sarah Johnson",
        role: "cashier", phone: "+233 24 333 4444", email: "sarah@sylhn.com",
        permissions: JSON.stringify({
          pos: true, sales: true, stock: false, purchase: false, accounts: false,
          telephone: true, maintenance: false, financeOps: false,
          canVoid: false, canDiscount: true, canAdjustStock: false,
          canDeleteProducts: false, canExport: false,
        }),
      },
    });

    // Stock groups
    const groupNames = [
      { name: "Fresh Produce", icon: "🥬", color: "#22c55e" },
      { name: "Chilled & Dairy", icon: "🥛", color: "#3b82f6" },
      { name: "Butchery", icon: "🥩", color: "#ef4444" },
      { name: "Bakery Items", icon: "🍞", color: "#f59e0b" },
      { name: "Beverages", icon: "🥤", color: "#06b6d4" },
      { name: "Confectionery", icon: "🍬", color: "#ec4899" },
      { name: "Frozen Foods", icon: "🧊", color: "#0ea5e9" },
      { name: "Dry Goods", icon: "🌾", color: "#a16207" },
      { name: "Household", icon: "🧴", color: "#8b5cf6" },
      { name: "Health & Beauty", icon: "💊", color: "#14b8a6" },
    ];
    const groups = await Promise.all(
      groupNames.map(g => db.stockGroup.create({ data: g }))
    );

    // Suppliers
    const suppliers = await Promise.all([
      db.supplier.create({ data: { name: "Accra Wholesale Ltd", phone: "+233 30 222 1111", email: "sales@accrawholesale.com", address: "Industrial Area, Accra" } }),
      db.supplier.create({ data: { name: "Kumasi Foods Distribution", phone: "+233 51 333 4444", email: "info@kumasifoods.com", address: "Adum, Kumasi" } }),
      db.supplier.create({ data: { name: "Fresh Produce Co.", phone: "+233 24 555 6666", email: "orders@freshproduce.com", address: "Tema, Greater Accra" } }),
    ]);

    // Products
    const sampleProducts = [
      { sku: "APL-001", name: "Apples (Royal Gala)", emoji: "🍎", category: "fruits", price: 35, costPrice: 25, quantity: 80, unit: "kg", groupId: groups[0].id, supplier: suppliers[2].id, taxable: true },
      { sku: "BNB-001", name: "Bananas", emoji: "🍌", category: "fruits", price: 12, costPrice: 7, quantity: 120, unit: "kg", groupId: groups[0].id, supplier: suppliers[2].id, taxable: true },
      { sku: "MLK-001", name: "Fresh Milk 1L", emoji: "🥛", category: "dairy", price: 18, costPrice: 13, quantity: 50, unit: "bottle", groupId: groups[1].id, supplier: suppliers[0].id, taxable: true },
      { sku: "EGG-001", name: "Eggs (Tray of 30)", emoji: "🥚", category: "dairy", price: 45, costPrice: 35, quantity: 30, unit: "tray", groupId: groups[1].id, supplier: suppliers[0].id, taxable: true },
      { sku: "CKN-001", name: "Chicken Breast", emoji: "🍗", category: "meat", price: 65, costPrice: 50, quantity: 25, unit: "kg", groupId: groups[2].id, supplier: suppliers[1].id, taxable: true },
      { sku: "BRD-001", name: "Sliced Bread", emoji: "🍞", category: "bakery", price: 15, costPrice: 9, quantity: 40, unit: "loaf", groupId: groups[3].id, supplier: suppliers[1].id, taxable: true },
      { sku: "COK-001", name: "Coca-Cola 500ml", emoji: "🥤", category: "beverages", price: 8, costPrice: 5, quantity: 200, unit: "bottle", groupId: groups[4].id, supplier: suppliers[0].id, taxable: true },
      { sku: "WTR-001", name: "Bottled Water 1.5L", emoji: "💧", category: "beverages", price: 5, costPrice: 3, quantity: 150, unit: "bottle", groupId: groups[4].id, supplier: suppliers[0].id, taxable: true },
      { sku: "RCE-001", name: "Rice 5kg Bag", emoji: "🍚", category: "pantry", price: 95, costPrice: 75, quantity: 35, unit: "bag", groupId: groups[7].id, supplier: suppliers[1].id, taxable: true },
      { sku: "OIL-001", name: "Cooking Oil 1L", emoji: "🫒", category: "pantry", price: 38, costPrice: 28, quantity: 60, unit: "bottle", groupId: groups[7].id, supplier: suppliers[0].id, taxable: true },
    ];
    await Promise.all(sampleProducts.map(p => db.product.create({ data: p as any })));

    return NextResponse.json({
      success: true,
      seeded: { users: 3, groups: groups.length, suppliers: suppliers.length, products: sampleProducts.length },
    });
  } catch (e) {
    console.error("POST /api/seed error:", e);
    return NextResponse.json({ error: `Seed failed: ${(e as Error).message}` }, { status: 500 });
  }
}
