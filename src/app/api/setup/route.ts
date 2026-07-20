import { NextRequest, NextResponse } from "next/server";
import { db, waitForDb, seedDefaultUsers } from "@/lib/db";

// POST /api/setup — one-time initial setup
// Creates default admin user with password "admin123" if no users exist.
// This runs WITHOUT authentication (it's the bootstrap endpoint).
//
// After first login, the admin should change their password immediately.
export async function POST(req: NextRequest) {
  await waitForDb();
  const userCount = await db.systemUser.count();
  if (userCount > 0) {
    return NextResponse.json({
      error: "Setup already completed. Users already exist.",
      userCount,
    }, { status: 409 });
  }

  try {
    await seedDefaultUsers();

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
  await waitForDb();
  const userCount = await db.systemUser.count();
  return NextResponse.json({ setupNeeded: userCount === 0, userCount });
}
