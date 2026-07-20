import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";

// POST /api/setup — one-time initial setup
// Creates default admin user with password "admin123" if no users exist.
// This runs WITHOUT authentication (it's the bootstrap endpoint).
//
// After first login, the admin should change their password immediately.
export async function POST(req: NextRequest) {
  const userCount = await db.systemUser.count();
  if (userCount > 0) {
    return NextResponse.json({
      error: "Setup already completed. Users already exist.",
      userCount,
    }, { status: 409 });
  }

  try {
    const adminHash = await hashPassword("admin123");
    const managerHash = await hashPassword("manager123");
    const cashierHash = await hashPassword("cashier123");

    const allPerms = JSON.stringify({
      pos: true, sales: true, stock: true, purchase: true, accounts: true,
      telephone: true, maintenance: true, financeOps: true,
      canVoid: true, canDiscount: true, canAdjustStock: true,
      canDeleteProducts: true, canExport: true,
    });
    const managerPerms = JSON.stringify({
      pos: true, sales: true, stock: true, purchase: true, accounts: true,
      telephone: true, maintenance: false, financeOps: true,
      canVoid: true, canDiscount: true, canAdjustStock: true,
      canDeleteProducts: false, canExport: true,
    });
    const cashierPerms = JSON.stringify({
      pos: true, sales: true, stock: false, purchase: false, accounts: false,
      telephone: true, maintenance: false, financeOps: false,
      canVoid: false, canDiscount: true, canAdjustStock: false,
      canDeleteProducts: false, canExport: false,
    });

    await db.systemUser.createMany({
      data: [
        { username: "admin", password: adminHash, fullName: "System Administrator", role: "admin", phone: "+233592766044", email: "admin@sylhn.com", permissions: allPerms, active: true },
        { username: "manager", password: managerHash, fullName: "Store Manager", role: "manager", phone: "+233 24 111 2222", email: "manager@sylhn.com", permissions: managerPerms, active: true },
        { username: "cashier", password: cashierHash, fullName: "Sarah Johnson", role: "cashier", phone: "+233 24 333 4444", email: "sarah@sylhn.com", permissions: cashierPerms, active: true },
      ],
    });

    // Default system settings
    const settings = [
      { key: "companyName", value: "SYLHN COMPANY LTD" },
      { key: "taxRate", value: "0.15" },
      { key: "taxName", value: "VAT" },
      { key: "currency", value: "GHC" },
      { key: "loyalty.pointsPerCedi", value: "1" },
      { key: "loyalty.redeemRate", value: "0.05" },
      { key: "loyalty.minRedeem", value: "100" },
    ];
    for (const s of settings) {
      await db.systemSetting.upsert({ where: { key: s.key }, update: {}, create: s });
    }

    return NextResponse.json({
      success: true,
      message: "Setup complete. Login with admin/admin123",
      users: [
        { username: "admin", password: "admin123", role: "Administrator" },
        { username: "manager", password: "manager123", role: "Manager" },
        { username: "cashier", password: "cashier123", role: "Cashier" },
      ],
    });
  } catch (e: any) {
    return NextResponse.json({ error: "Setup failed: " + (e?.message || "Unknown") }, { status: 500 });
  }
}

// GET /api/setup — check if setup is needed
export async function GET() {
  const userCount = await db.systemUser.count();
  return NextResponse.json({ setupNeeded: userCount === 0, userCount });
}
