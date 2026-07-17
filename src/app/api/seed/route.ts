import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole, hashPassword } from "@/lib/auth";
import { rateLimitSeed, rateLimitResponse } from "@/lib/rate-limit";
import { headers } from "next/headers";
import { auditLog } from "@/lib/audit";

// POST /api/seed — seed the database with initial demo data
// Admin-only + heavily rate-limited (3/hour) + requires explicit confirmation.
// CRITICAL SAFETY: caller must include `{ confirm: "WIPE_ALL_DATA" }` in the
// body — prevents accidental wipes via CSRF / XSS.
const REQUIRED_CONFIRMATION = "WIPE_ALL_DATA";

export async function POST(req: Request) {
  let user;
  try { user = await requireRole("admin"); } catch (e) { return e as Response; }

  // Rate limit
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  const ip = fwd ? fwd.split(",")[0].trim() : "127.0.0.1";
  const rl = rateLimitSeed(ip);
  if (!rl.allowed) return rateLimitResponse(rl, "Seed rate limit exceeded.");

  // Require explicit confirmation string
  let body: any = {};
  try { body = await req.json(); } catch { /* allow empty */ }
  if (body.confirm !== REQUIRED_CONFIRMATION) {
    return NextResponse.json({
      error: `Confirmation required. Pass { "confirm": "${REQUIRED_CONFIRMATION}" } in the body to wipe all data.`,
    }, { status: 400 });
  }

  try {
    // Audit the destructive action BEFORE wiping (so the audit log survives the wipe
    // — wait, no, the wipe deletes audit logs too. We audit AFTER seeding instead.)
    // Wipe in dependency order (children first, parents last)
    await db.stocktakeItem.deleteMany();
    await db.stocktake.deleteMany();
    await db.backupRecord.deleteMany();
    await db.supplierPayment.deleteMany();
    await db.salePayment.deleteMany();
    await db.loyaltyTransaction.deleteMany();
    await db.purchaseItem.deleteMany();
    await db.purchase.deleteMany();
    await db.stockHistory.deleteMany();
    await db.saleItem.deleteMany();
    await db.sale.deleteMany();
    await db.heldOrder.deleteMany();
    await db.cashierShift.deleteMany();
    await db.expense.deleteMany();
    await db.productSupplier.deleteMany();
    await db.product.deleteMany();
    await db.stockGroup.deleteMany();
    await db.telephoneDirectoryEntry.deleteMany();
    await db.customer.deleteMany();
    await db.supplier.deleteMany();
    await db.auditLog.deleteMany();
    await db.systemSetting.deleteMany();
    await db.systemUser.deleteMany();

    // ===== Hash the default passwords =====
    const [adminPwd, managerPwd, cashierPwd, stockkeeperPwd, accountantPwd] = await Promise.all([
      hashPassword("admin123"),
      hashPassword("manager123"),
      hashPassword("cashier123"),
      hashPassword("stockkeeper123"),
      hashPassword("accountant123"),
    ]);

    // ===== Users =====
    const admin = await db.systemUser.create({
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
    const manager = await db.systemUser.create({
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
    const cashier = await db.systemUser.create({
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
    await db.systemUser.create({
      data: {
        username: "stockkeeper", password: stockkeeperPwd, fullName: "Kwame Mensah",
        role: "stockkeeper", phone: "+233 24 555 7777", email: "kwame@sylhn.com",
        permissions: JSON.stringify({
          pos: true, sales: false, stock: true, purchase: true, accounts: false,
          telephone: false, maintenance: false, financeOps: false,
          canVoid: false, canDiscount: false, canAdjustStock: true,
          canDeleteProducts: false, canExport: true,
        }),
      },
    });
    await db.systemUser.create({
      data: {
        username: "accountant", password: accountantPwd, fullName: "Grace Owusu",
        role: "accountant", phone: "+233 24 999 8888", email: "grace@sylhn.com",
        permissions: JSON.stringify({
          pos: true, sales: false, stock: false, purchase: false, accounts: true,
          telephone: false, maintenance: false, financeOps: true,
          canVoid: false, canDiscount: false, canAdjustStock: false,
          canDeleteProducts: false, canExport: true,
        }),
      },
    });

    // ===== Stock Groups =====
    const groupData = [
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
      groupData.map(g => db.stockGroup.create({ data: g }))
    );

    // ===== Suppliers =====
    const agricorp = await db.supplier.create({
      data: { code: "SUP-00001", name: "AgriCorp Ghana", contactName: "Kofi Asante", phone: "+233 51 100 200", mobile: "+233 24 111 9999", email: "sales@agricorp.gh", address: "Kumasi, Ashanti Region", city: "Kumasi", state: "Ashanti", country: "Ghana", businessNo: "BN-004", tradingTerms: "Net 30", creditLimit: 8000, balance: 1250, taxInclusive: false, notes: "Primary fruit supplier" },
    });
    const globalFoods = await db.supplier.create({
      data: { code: "SUP-00002", name: "Global Foods GH", contactName: "Ama Boateng", phone: "+233 30 333 555", mobile: "+233 24 333 4444", email: "sales@globalfoods.gh", address: "Tema Industrial Area, Accra", city: "Tema", state: "Greater Accra", country: "Ghana", businessNo: "BN-005", tradingTerms: "Net 15", creditLimit: 10000, balance: 3200, taxInclusive: true, notes: "Packaged foods distributor" },
    });
    const fanMilk = await db.supplier.create({
      data: { code: "SUP-00003", name: "Fan Milk Ghana", contactName: "Yaw Mensah", phone: "+233 30 333 555", mobile: "+233 24 333 4444", email: "orders@fanmilk.gh", address: "Tema, Greater Accra", city: "Tema", state: "Greater Accra", country: "Ghana", businessNo: "BN-006", tradingTerms: "Net 30", creditLimit: 5000, balance: 850, taxInclusive: true, notes: "Dairy supplier" },
    });
    const darkoFarms = await db.supplier.create({
      data: { code: "SUP-00004", name: "Darko Farms", contactName: "Adwoa Darko", phone: "+233 24 555 6666", mobile: "+233 24 555 6666", email: "info@darkofarms.gh", address: "Dodowa, Eastern Region", city: "Dodowa", state: "Eastern", country: "Ghana", businessNo: "BN-007", tradingTerms: "COD", creditLimit: 2000, balance: 0, taxInclusive: false, notes: "Vegetable supplier" },
    });
    const unilever = await db.supplier.create({
      data: { code: "SUP-00005", name: "Unilever Ghana", contactName: "Kwesi Asare", phone: "+233 24 999 0000", mobile: "+233 24 999 0000", email: "orders@unilever.gh", address: "Spintex Road, Accra", city: "Accra", state: "Greater Accra", country: "Ghana", businessNo: "BN-008", tradingTerms: "Net 60", creditLimit: 15000, balance: 1800, taxInclusive: true, notes: "Household products supplier" },
    });

    // ===== Products =====
    const productData = [
      { sku: "APL-001", name: "Apples (Royal Gala)", emoji: "🍎", category: "fruits", price: 35, costPrice: 25, quantity: 80, unit: "kg", groupId: groups[0].id, taxable: true, reorderLevel: 20 },
      { sku: "BNB-001", name: "Bananas", emoji: "🍌", category: "fruits", price: 12, costPrice: 7, quantity: 120, unit: "kg", groupId: groups[0].id, taxable: true, reorderLevel: 30 },
      { sku: "TMT-001", name: "Tomatoes", emoji: "🍅", category: "vegetables", price: 18, costPrice: 12, quantity: 45, unit: "kg", groupId: groups[0].id, taxable: true, reorderLevel: 15 },
      { sku: "MLK-001", name: "Fresh Milk 1L", emoji: "🥛", category: "dairy", price: 18, costPrice: 13, quantity: 50, unit: "bottle", groupId: groups[1].id, taxable: true, reorderLevel: 10 },
      { sku: "EGG-001", name: "Eggs (Tray of 30)", emoji: "🥚", category: "dairy", price: 45, costPrice: 35, quantity: 30, unit: "tray", groupId: groups[1].id, taxable: true, reorderLevel: 8 },
      { sku: "CKN-001", name: "Chicken Breast", emoji: "🍗", category: "meat", price: 65, costPrice: 50, quantity: 25, unit: "kg", groupId: groups[2].id, taxable: true, reorderLevel: 10 },
      { sku: "BRD-001", name: "Sliced Bread", emoji: "🍞", category: "bakery", price: 15, costPrice: 9, quantity: 40, unit: "loaf", groupId: groups[3].id, taxable: true, reorderLevel: 10 },
      { sku: "COK-001", name: "Coca-Cola 500ml", emoji: "🥤", category: "beverages", price: 8, costPrice: 5, quantity: 200, unit: "bottle", groupId: groups[4].id, taxable: true, reorderLevel: 50 },
      { sku: "WTR-001", name: "Bottled Water 1.5L", emoji: "💧", category: "beverages", price: 5, costPrice: 3, quantity: 150, unit: "bottle", groupId: groups[4].id, taxable: true, reorderLevel: 40 },
      { sku: "RCE-001", name: "Rice 5kg Bag", emoji: "🍚", category: "pantry", price: 95, costPrice: 75, quantity: 35, unit: "bag", groupId: groups[7].id, taxable: true, reorderLevel: 10 },
      { sku: "OIL-001", name: "Cooking Oil 1L", emoji: "🫒", category: "pantry", price: 38, costPrice: 28, quantity: 60, unit: "bottle", groupId: groups[7].id, taxable: true, reorderLevel: 15 },
      { sku: "SOP-001", name: "Soap Bar", emoji: "🧼", category: "household", price: 5, costPrice: 3, quantity: 100, unit: "bar", groupId: groups[8].id, taxable: true, reorderLevel: 30 },
    ];
    const products = await Promise.all(productData.map(p => db.product.create({ data: p as any })));

    // ===== ProductSupplier junction (many-to-many) =====
    // Link products to their primary suppliers with cost info
    const productSupplierLinks = [
      { product: products[0], supplier: agricorp, cost: 25, preferred: true },    // Apples → AgriCorp
      { product: products[1], supplier: agricorp, cost: 7, preferred: true },     // Bananas → AgriCorp
      { product: products[2], supplier: darkoFarms, cost: 12, preferred: true },  // Tomatoes → Darko Farms
      { product: products[3], supplier: fanMilk, cost: 13, preferred: true },     // Milk → Fan Milk
      { product: products[4], supplier: fanMilk, cost: 35, preferred: true },     // Eggs → Fan Milk
      { product: products[5], supplier: darkoFarms, cost: 50, preferred: true },  // Chicken → Darko Farms
      { product: products[6], supplier: globalFoods, cost: 9, preferred: true },  // Bread → Global Foods
      { product: products[7], supplier: globalFoods, cost: 5, preferred: true },  // Coca-Cola → Global Foods
      { product: products[8], supplier: globalFoods, cost: 3, preferred: true },  // Water → Global Foods
      { product: products[9], supplier: globalFoods, cost: 75, preferred: true }, // Rice → Global Foods
      { product: products[10], supplier: globalFoods, cost: 28, preferred: true },// Oil → Global Foods
      { product: products[11], supplier: unilever, cost: 3, preferred: true },    // Soap → Unilever
    ];
    await Promise.all(productSupplierLinks.map(link =>
      db.productSupplier.create({
        data: {
          productId: link.product.id,
          supplierId: link.supplier.id,
          supplierCost: link.cost,
          preferred: link.preferred,
          leadTimeDays: 3,
        },
      })
    ));

    // ===== Customers =====
    const customer1 = await db.customer.create({
      data: { name: "John Dankwah", phone: "+233 24 123 4567", mobile: "+233 24 123 4567", email: "john@email.com", address: "Osu, Accra", city: "Accra", group: "regular", createdById: admin.id },
    });
    const customer2 = await db.customer.create({
      data: { name: "Mary Adjei", phone: "+233 24 765 4321", mobile: "+233 24 765 4321", email: "mary@email.com", address: "Adum, Kumasi", city: "Kumasi", group: "vip", creditLimit: 1000, createdById: admin.id },
    });

    // ===== Telephone Directory Entries =====
    const telEntries = [
      { name: "AgriCorp Ghana", mobile: "+233 24 111 9999", workPhone: "+233 51 100 200", email: "sales@agricorp.gh", group: "supplier", createdById: admin.id },
      { name: "Global Foods GH", mobile: "+233 24 333 4444", workPhone: "+233 30 333 555", email: "sales@globalfoods.gh", group: "supplier", createdById: admin.id },
      { name: "John Dankwah", mobile: "+233 24 123 4567", group: "customer", createdById: admin.id },
      { name: "Mary Adjei", mobile: "+233 24 765 4321", group: "customer", createdById: admin.id },
      { name: "Ghana Electricity Company", workPhone: "+233 30 200 0000", group: "vendor", createdById: admin.id },
      { name: "Water Company", workPhone: "+233 30 200 1111", group: "vendor", createdById: admin.id },
    ];
    await Promise.all(telEntries.map(e => db.telephoneDirectoryEntry.create({ data: e })));

    // ===== Sample Sale =====
    const shift = await db.cashierShift.create({
      data: { cashierId: cashier.id, cashierName: cashier.fullName, openingFloat: 200, status: "open" },
    });

    const sale1 = await db.sale.create({
      data: {
        invoiceNumber: `INV-${Date.now()}-001`,
        customerId: customer1.id,
        customerName: customer1.name,
        cashierId: cashier.id,
        cashierName: cashier.fullName,
        subtotal: 47, discount: 0, taxAmount: 7.05, total: 54.05,
        amountPaid: 55, change: 0.95, paymentMethod: "cash",
        status: "completed", shiftId: shift.id,
        items: {
          create: [
            { productId: products[0].id, sku: products[0].sku, name: products[0].name, emoji: products[0].emoji, price: 35, quantity: 1, total: 35, taxable: true },
            { productId: products[1].id, sku: products[1].sku, name: products[1].name, emoji: products[1].emoji, price: 12, quantity: 1, total: 12, taxable: true },
          ],
        },
      },
      include: { items: true },
    });
    // Decrement stock + link stock history
    for (const item of sale1.items) {
      await db.product.update({ where: { id: item.productId! }, data: { quantity: { decrement: item.quantity } } });
      await db.stockHistory.create({
        data: { productId: item.productId!, action: "sold", quantity: -item.quantity, reason: `Sale ${sale1.invoiceNumber}`, reference: sale1.invoiceNumber, saleId: sale1.id, userId: cashier.id },
      });
    }

    // ===== Sample Purchase =====
    const purchase1 = await db.purchase.create({
      data: {
        refNo: `PUR-${Date.now()}-001`,
        type: "purchase",
        supplierId: agricorp.id,
        supplierName: agricorp.name,
        status: "received",
        subtotal: 2400, taxAmount: 360, total: 2760, amountPaid: 2760,
        createdById: manager.id,
        receivedById: manager.id,
        receivedAt: new Date(),
        items: {
          create: [
            { productId: products[0].id, partNo: products[0].sku, details: products[0].name, emoji: products[0].emoji, quantity: 60, cost: 25, tax: false, total: 1500 },
            { productId: products[1].id, partNo: products[1].sku, details: products[1].name, emoji: products[1].emoji, quantity: 100, cost: 7, tax: false, total: 700 },
          ],
        },
      },
      include: { items: true },
    });
    for (const item of purchase1.items) {
      await db.stockHistory.create({
        data: { productId: item.productId!, action: "received", quantity: item.quantity, reason: `Purchase ${purchase1.refNo}`, reference: purchase1.refNo, purchaseId: purchase1.id, userId: manager.id },
      });
    }

    // ===== Sample Supplier Payment =====
    await db.supplierPayment.create({
      data: { supplierId: agricorp.id, purchaseId: purchase1.id, amount: 2760, paymentMode: "bank", reference: "BANK-TRF-001", createdBy: manager.id },
    });

    // ===== Sample Expense =====
    await db.expense.create({
      data: { date: new Date(), category: "utilities", description: "Electricity bill — July 2026", amount: 450, paymentMode: "bank", createdById: manager.id },
    });

    // ===== Sample Stocktake =====
    const stocktake = await db.stocktake.create({
      data: { refNo: `ST-${Date.now()}-001`, scheduledFor: new Date(), status: "completed", startedAt: new Date(Date.now() - 3600000), completedAt: new Date(), conductedById: stockkeeperPwd ? manager.id : manager.id, countMethod: "full", scope: "all" },
    });
    // Create stocktake items for a few products
    await Promise.all([
      db.stocktakeItem.create({ data: { stocktakeId: stocktake.id, productId: products[0].id, expectedQty: 80, countedQty: 79, variance: -1, reason: "1 damaged" } }),
      db.stocktakeItem.create({ data: { stocktakeId: stocktake.id, productId: products[1].id, expectedQty: 120, countedQty: 118, variance: -2, reason: "2 spoiled" } }),
    ]);

    // ===== Sample Backup Record =====
    await db.backupRecord.create({
      data: { type: "manual", filename: `backup-${new Date().toISOString().split("T")[0]}.db`, sizeBytes: 24576, status: "completed", createdById: admin.id },
    });

    // ===== System Settings =====
    await db.systemSetting.create({ data: { key: "companyName", value: "SYLHN COMPANY LTD" } });
    await db.systemSetting.create({ data: { key: "currency", value: "GHC" } });
    await db.systemSetting.create({ data: { key: "taxRate", value: "15" } });
    await db.systemSetting.create({ data: { key: "taxName", value: "VAT" } });

    // Loyalty config (premium defaults — admin can tune via /api/system-settings)
    await db.systemSetting.create({ data: { key: "loyalty.pointsPerCedi", value: "1" } });
    await db.systemSetting.create({ data: { key: "loyalty.redeemRate", value: "0.05" } });   // 1 pt = GHS 0.05
    await db.systemSetting.create({ data: { key: "loyalty.minRedeem", value: "100" } });      // min 100 pts to redeem

    // ===== Audit the seed itself (after re-creating admin user) =====
    await db.auditLog.create({
      data: {
        userId: admin.id,
        user: admin.username,
        action: "SEED",
        module: "maintenance",
        details: `Database re-seeded by ${user.username} — all tables wiped and demo data restored`,
        severity: "critical",
        ipAddress: ip,
        userAgent: h.get("user-agent") || "",
      },
    });

    return NextResponse.json({
      success: true,
      seeded: {
        users: 5,
        stockGroups: groups.length,
        suppliers: 5,
        products: products.length,
        productSupplierLinks: productSupplierLinks.length,
        customers: 2,
        telephoneEntries: telEntries.length,
        sales: 1,
        purchases: 1,
        supplierPayments: 1,
        expenses: 1,
        stocktakes: 1,
        shifts: 1,
        backups: 1,
        systemSettings: 7,
      },
    });
  } catch (e) {
    console.error("POST /api/seed error:", e);
    return NextResponse.json({ error: `Seed failed: ${(e as Error).message}` }, { status: 500 });
  }
}
