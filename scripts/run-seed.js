// Direct DB seed (bypasses the API which requires auth)
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
  // Wipe
  await p.stockHistory.deleteMany();
  await p.saleItem.deleteMany();
  await p.sale.deleteMany();
  await p.purchaseItem.deleteMany();
  await p.purchase.deleteMany();
  await p.product.deleteMany();
  await p.stockGroup.deleteMany();
  await p.supplier.deleteMany();
  await p.systemUser.deleteMany();
  await p.expense.deleteMany();
  await p.heldOrder.deleteMany();
  await p.auditLog.deleteMany();

  // Hashed users
  await p.systemUser.create({
    data: {
      username: "admin", password: hashPassword("admin123"),
      fullName: "System Administrator", role: "admin",
      phone: "+233592766044", email: "admin@sylhn.com",
      permissions: JSON.stringify({
        pos: true, sales: true, stock: true, purchase: true, accounts: true,
        telephone: true, maintenance: true, financeOps: true,
        canVoid: true, canDiscount: true, canAdjustStock: true,
        canDeleteProducts: true, canExport: true,
      }),
    },
  });
  await p.systemUser.create({
    data: {
      username: "manager", password: hashPassword("manager123"),
      fullName: "Store Manager", role: "manager",
      phone: "+233 24 111 2222", email: "manager@sylhn.com",
      permissions: JSON.stringify({
        pos: true, sales: true, stock: true, purchase: true, accounts: true,
        telephone: true, maintenance: false, financeOps: true,
        canVoid: true, canDiscount: true, canAdjustStock: true,
        canDeleteProducts: false, canExport: true,
      }),
    },
  });
  await p.systemUser.create({
    data: {
      username: "cashier", password: hashPassword("cashier123"),
      fullName: "Sarah Johnson", role: "cashier",
      phone: "+233 24 333 4444", email: "sarah@sylhn.com",
      permissions: JSON.stringify({
        pos: true, sales: true, stock: false, purchase: false, accounts: false,
        telephone: true, maintenance: false, financeOps: false,
        canVoid: false, canDiscount: true, canAdjustStock: false,
        canDeleteProducts: false, canExport: false,
      }),
    },
  });

  console.log("Seeded 3 users with hashed passwords.");
  await p.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
