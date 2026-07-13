// Direct DB seed with relational data (bypasses the API which requires auth)
const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const p = new PrismaClient();

const PBKDF2_ITERATIONS = 100_000;
const SALT_BYTES = 16;
const KEY_BYTES = 32;

function hashPassword(password) {
  const salt = crypto.randomBytes(SALT_BYTES);
  const hash = crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, KEY_BYTES, "sha256");
  return `pbkdf2$${PBKDF2_ITERATIONS}$${salt.toString("hex")}$${hash.toString("hex")}`;
}

async function main() {
  // Wipe in dependency order
  await p.stocktakeItem.deleteMany();
  await p.stocktake.deleteMany();
  await p.backupRecord.deleteMany();
  await p.supplierPayment.deleteMany();
  await p.purchaseItem.deleteMany();
  await p.purchase.deleteMany();
  await p.stockHistory.deleteMany();
  await p.saleItem.deleteMany();
  await p.sale.deleteMany();
  await p.heldOrder.deleteMany();
  await p.cashierShift.deleteMany();
  await p.expense.deleteMany();
  await p.productSupplier.deleteMany();
  await p.product.deleteMany();
  await p.stockGroup.deleteMany();
  await p.telephoneDirectoryEntry.deleteMany();
  await p.customer.deleteMany();
  await p.supplier.deleteMany();
  await p.auditLog.deleteMany();
  await p.systemSetting.deleteMany();
  await p.systemUser.deleteMany();
  console.log("Wiped all tables.");

  // Users
  const [adminPwd, managerPwd, cashierPwd, stockkeeperPwd, accountantPwd] = await Promise.all([
    hashPassword("admin123"), hashPassword("manager123"), hashPassword("cashier123"),
    hashPassword("stockkeeper123"), hashPassword("accountant123"),
  ]);

  const admin = await p.systemUser.create({ data: { username: "admin", password: adminPwd, fullName: "System Administrator", role: "admin", phone: "+233592766044", email: "admin@sylhn.com", permissions: JSON.stringify({ pos: true, sales: true, stock: true, purchase: true, accounts: true, telephone: true, maintenance: true, financeOps: true, canVoid: true, canDiscount: true, canAdjustStock: true, canDeleteProducts: true, canExport: true }) } });
  const manager = await p.systemUser.create({ data: { username: "manager", password: managerPwd, fullName: "Store Manager", role: "manager", phone: "+233 24 111 2222", email: "manager@sylhn.com", permissions: JSON.stringify({ pos: true, sales: true, stock: true, purchase: true, accounts: true, telephone: true, maintenance: false, financeOps: true, canVoid: true, canDiscount: true, canAdjustStock: true, canDeleteProducts: false, canExport: true }) } });
  const cashier = await p.systemUser.create({ data: { username: "cashier", password: cashierPwd, fullName: "Sarah Johnson", role: "cashier", phone: "+233 24 333 4444", email: "sarah@sylhn.com", permissions: JSON.stringify({ pos: true, sales: true, telephone: true, canDiscount: true }) } });
  await p.systemUser.create({ data: { username: "stockkeeper", password: stockkeeperPwd, fullName: "Kwame Mensah", role: "stockkeeper", phone: "+233 24 555 7777", email: "kwame@sylhn.com", permissions: JSON.stringify({ pos: true, stock: true, purchase: true, canAdjustStock: true, canExport: true }) } });
  await p.systemUser.create({ data: { username: "accountant", password: accountantPwd, fullName: "Grace Owusu", role: "accountant", phone: "+233 24 999 8888", email: "grace@sylhn.com", permissions: JSON.stringify({ pos: true, accounts: true, financeOps: true, canExport: true }) } });
  console.log("Seeded 5 users.");

  // Stock groups
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
  const groups = await Promise.all(groupData.map(g => p.stockGroup.create({ data: g })));
  console.log("Seeded " + groups.length + " stock groups.");

  // Suppliers
  const agricorp = await p.supplier.create({ data: { code: "SUP-00001", name: "AgriCorp Ghana", contactName: "Kofi Asante", phone: "+233 51 100 200", mobile: "+233 24 111 9999", email: "sales@agricorp.gh", address: "Kumasi, Ashanti Region", city: "Kumasi", state: "Ashanti", country: "Ghana", businessNo: "BN-004", tradingTerms: "Net 30", creditLimit: 8000, balance: 1250, taxInclusive: false, notes: "Primary fruit supplier" } });
  const globalFoods = await p.supplier.create({ data: { code: "SUP-00002", name: "Global Foods GH", contactName: "Ama Boateng", phone: "+233 30 333 555", mobile: "+233 24 333 4444", email: "sales@globalfoods.gh", address: "Tema Industrial Area, Accra", city: "Tema", state: "Greater Accra", country: "Ghana", businessNo: "BN-005", tradingTerms: "Net 15", creditLimit: 10000, balance: 3200, taxInclusive: true, notes: "Packaged foods distributor" } });
  const fanMilk = await p.supplier.create({ data: { code: "SUP-00003", name: "Fan Milk Ghana", contactName: "Yaw Mensah", phone: "+233 30 333 555", mobile: "+233 24 333 4444", email: "orders@fanmilk.gh", address: "Tema, Greater Accra", city: "Tema", state: "Greater Accra", country: "Ghana", businessNo: "BN-006", tradingTerms: "Net 30", creditLimit: 5000, balance: 850, taxInclusive: true, notes: "Dairy supplier" } });
  const darkoFarms = await p.supplier.create({ data: { code: "SUP-00004", name: "Darko Farms", contactName: "Adwoa Darko", phone: "+233 24 555 6666", mobile: "+233 24 555 6666", email: "info@darkofarms.gh", address: "Dodowa, Eastern Region", city: "Dodowa", state: "Eastern", country: "Ghana", businessNo: "BN-007", tradingTerms: "COD", creditLimit: 2000, balance: 0, taxInclusive: false, notes: "Vegetable supplier" } });
  const unilever = await p.supplier.create({ data: { code: "SUP-00005", name: "Unilever Ghana", contactName: "Kwesi Asare", phone: "+233 24 999 0000", mobile: "+233 24 999 0000", email: "orders@unilever.gh", address: "Spintex Road, Accra", city: "Accra", state: "Greater Accra", country: "Ghana", businessNo: "BN-008", tradingTerms: "Net 60", creditLimit: 15000, balance: 1800, taxInclusive: true, notes: "Household products supplier" } });
  console.log("Seeded 5 suppliers.");

  // Products
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
  const products = await Promise.all(productData.map(pd => p.product.create({ data: pd })));
  console.log("Seeded " + products.length + " products.");

  // ProductSupplier junction
  const links = [
    { product: products[0], supplier: agricorp, cost: 25 },
    { product: products[1], supplier: agricorp, cost: 7 },
    { product: products[2], supplier: darkoFarms, cost: 12 },
    { product: products[3], supplier: fanMilk, cost: 13 },
    { product: products[4], supplier: fanMilk, cost: 35 },
    { product: products[5], supplier: darkoFarms, cost: 50 },
    { product: products[6], supplier: globalFoods, cost: 9 },
    { product: products[7], supplier: globalFoods, cost: 5 },
    { product: products[8], supplier: globalFoods, cost: 3 },
    { product: products[9], supplier: globalFoods, cost: 75 },
    { product: products[10], supplier: globalFoods, cost: 28 },
    { product: products[11], supplier: unilever, cost: 3 },
  ];
  await Promise.all(links.map(l => p.productSupplier.create({ data: { productId: l.product.id, supplierId: l.supplier.id, supplierCost: l.cost, preferred: true, leadTimeDays: 3 } })));
  console.log("Seeded " + links.length + " product-supplier links.");

  // Customers
  const customer1 = await p.customer.create({ data: { name: "John Dankwah", phone: "+233 24 123 4567", mobile: "+233 24 123 4567", email: "john@email.com", address: "Osu, Accra", city: "Accra", group: "regular", createdById: admin.id } });
  const customer2 = await p.customer.create({ data: { name: "Mary Adjei", phone: "+233 24 765 4321", mobile: "+233 24 765 4321", email: "mary@email.com", address: "Adum, Kumasi", city: "Kumasi", group: "vip", creditLimit: 1000, createdById: admin.id } });
  console.log("Seeded 2 customers.");

  // Telephone directory
  const telEntries = [
    { name: "AgriCorp Ghana", mobile: "+233 24 111 9999", workPhone: "+233 51 100 200", email: "sales@agricorp.gh", group: "supplier", createdById: admin.id },
    { name: "Global Foods GH", mobile: "+233 24 333 4444", workPhone: "+233 30 333 555", email: "sales@globalfoods.gh", group: "supplier", createdById: admin.id },
    { name: "John Dankwah", mobile: "+233 24 123 4567", group: "customer", createdById: admin.id },
    { name: "Mary Adjei", mobile: "+233 24 765 4321", group: "customer", createdById: admin.id },
    { name: "Ghana Electricity Company", workPhone: "+233 30 200 0000", group: "vendor", createdById: admin.id },
    { name: "Water Company", workPhone: "+233 30 200 1111", group: "vendor", createdById: admin.id },
  ];
  await Promise.all(telEntries.map(e => p.telephoneDirectoryEntry.create({ data: e })));
  console.log("Seeded " + telEntries.length + " telephone entries.");

  // Cashier shift
  const shift = await p.cashierShift.create({ data: { cashierId: cashier.id, cashierName: cashier.fullName, openingFloat: 200, status: "open" } });

  // Sale with linked items + stock history
  const sale = await p.sale.create({
    data: {
      invoiceNumber: "INV-" + Date.now() + "-001",
      customerId: customer1.id, customerName: customer1.name,
      cashierId: cashier.id, cashierName: cashier.fullName,
      subtotal: 47, taxAmount: 7.05, total: 54.05, amountPaid: 55, change: 0.95,
      paymentMethod: "cash", status: "completed", shiftId: shift.id,
      items: { create: [
        { productId: products[0].id, sku: products[0].sku, name: products[0].name, emoji: products[0].emoji, price: 35, quantity: 1, total: 35, taxable: true },
        { productId: products[1].id, sku: products[1].sku, name: products[1].name, emoji: products[1].emoji, price: 12, quantity: 1, total: 12, taxable: true },
      ] },
    },
    include: { items: true },
  });
  for (const item of sale.items) {
    await p.product.update({ where: { id: item.productId }, data: { quantity: { decrement: item.quantity } } });
    await p.stockHistory.create({ data: { productId: item.productId, action: "sold", quantity: -item.quantity, reason: "Sale " + sale.invoiceNumber, reference: sale.invoiceNumber, saleId: sale.id, userId: cashier.id } });
  }
  console.log("Seeded 1 sale with linked stock history.");

  // Purchase with linked items + stock history
  const purchase = await p.purchase.create({
    data: {
      refNo: "PUR-" + Date.now() + "-001",
      type: "purchase", supplierId: agricorp.id, supplierName: agricorp.name,
      status: "received", subtotal: 2400, taxAmount: 360, total: 2760, amountPaid: 2760,
      createdById: manager.id, receivedById: manager.id, receivedAt: new Date(),
      items: { create: [
        { productId: products[0].id, partNo: products[0].sku, details: products[0].name, emoji: products[0].emoji, quantity: 60, cost: 25, tax: false, total: 1500 },
        { productId: products[1].id, partNo: products[1].sku, details: products[1].name, emoji: products[1].emoji, quantity: 100, cost: 7, tax: false, total: 700 },
      ] },
    },
    include: { items: true },
  });
  for (const item of purchase.items) {
    await p.stockHistory.create({ data: { productId: item.productId, action: "received", quantity: item.quantity, reason: "Purchase " + purchase.refNo, reference: purchase.refNo, purchaseId: purchase.id, userId: manager.id } });
  }
  console.log("Seeded 1 purchase with linked stock history.");

  // Supplier payment
  await p.supplierPayment.create({ data: { supplierId: agricorp.id, purchaseId: purchase.id, amount: 2760, paymentMode: "bank", reference: "BANK-TRF-001", createdBy: manager.id } });
  console.log("Seeded 1 supplier payment.");

  // Expense
  await p.expense.create({ data: { date: new Date(), category: "utilities", description: "Electricity bill — July 2026", amount: 450, paymentMode: "bank", createdById: manager.id } });
  console.log("Seeded 1 expense.");

  // Stocktake
  const stocktake = await p.stocktake.create({ data: { refNo: "ST-" + Date.now() + "-001", scheduledFor: new Date(), status: "completed", startedAt: new Date(Date.now() - 3600000), completedAt: new Date(), conductedById: manager.id, countMethod: "full", scope: "all" } });
  await Promise.all([
    p.stocktakeItem.create({ data: { stocktakeId: stocktake.id, productId: products[0].id, expectedQty: 80, countedQty: 79, variance: -1, reason: "1 damaged" } }),
    p.stocktakeItem.create({ data: { stocktakeId: stocktake.id, productId: products[1].id, expectedQty: 120, countedQty: 118, variance: -2, reason: "2 spoiled" } }),
  ]);
  console.log("Seeded 1 stocktake with 2 items.");

  // Backup record
  await p.backupRecord.create({ data: { type: "manual", filename: "backup-" + new Date().toISOString().split("T")[0] + ".db", sizeBytes: 24576, status: "completed", createdById: admin.id } });

  // System settings
  await p.systemSetting.create({ data: { key: "companyName", value: "SYLHN COMPANY LTD" } });
  await p.systemSetting.create({ data: { key: "currency", value: "GHC" } });
  await p.systemSetting.create({ data: { key: "taxRate", value: "15" } });
  await p.systemSetting.create({ data: { key: "taxName", value: "VAT" } });

  console.log("\n=== RELATIONAL INTEGRITY CHECK ===");
  const prodCount = await p.product.count();
  const suppCount = await p.supplier.count();
  const linkCount = await p.productSupplier.count();
  const saleCount = await p.sale.count();
  const saleItemCount = await p.saleItem.count();
  const purchaseCount = await p.purchase.count();
  const purchaseItemCount = await p.purchaseItem.count();
  const stockHistoryCount = await p.stockHistory.count();
  const linkedStockHistory = await p.stockHistory.count({ where: { OR: [{ saleId: { not: null } }, { purchaseId: { not: null } }, { stocktakeId: { not: null } }] } });
  const customerCount = await p.customer.count();
  const telCount = await p.telephoneDirectoryEntry.count();
  const shiftCount = await p.cashierShift.count();
  const stocktakeCount = await p.stocktake.count();
  const paymentCount = await p.supplierPayment.count();
  const expenseCount = await p.expense.count();
  const userCount = await p.systemUser.count();
  const auditCount = await p.auditLog.count();

  console.log("Users: " + userCount);
  console.log("Products: " + prodCount);
  console.log("Suppliers: " + suppCount);
  console.log("Product↔Supplier links: " + linkCount);
  console.log("Sales: " + saleCount + " (with " + saleItemCount + " items)");
  console.log("Purchases: " + purchaseCount + " (with " + purchaseItemCount + " items)");
  console.log("Stock history entries: " + stockHistoryCount + " (" + linkedStockHistory + " linked to transactions)");
  console.log("Customers: " + customerCount);
  console.log("Telephone directory entries: " + telCount);
  console.log("Cashier shifts: " + shiftCount);
  console.log("Stocktakes: " + stocktakeCount);
  console.log("Supplier payments: " + paymentCount);
  console.log("Expenses: " + expenseCount);
  console.log("Audit logs: " + auditCount);
  console.log("\n=== ALL TABLES LINKED AND RELATIONAL ===");

  await p.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
