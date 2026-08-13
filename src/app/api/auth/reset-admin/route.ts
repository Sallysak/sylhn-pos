import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";

// POST /api/auth/reset-admin
// Resets the admin password to "admin123" and clears any lockout.
// This is an EMERGENCY endpoint — it works WITHOUT authentication
// so you can regain access if locked out.
//
// SECURITY: This should be disabled or password-protected in production
// after use. For now, it requires a secret key passed in the request body.
//
// Usage:
//   curl -X POST https://your-app.railway.app/api/auth/reset-admin \
//     -H "Content-Type: application/json" \
//     -d '{"secret": "sylhn-reset-2026"}'
//
// Or just visit this URL in your browser:
//   https://your-app.railway.app/api/auth/reset-admin?secret=sylhn-reset-2026

const RESET_SECRET = process.env.ADMIN_RESET_SECRET || "sylhn-reset-2026";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const secret = body.secret || req.nextUrl.searchParams.get("secret");

    if (secret !== RESET_SECRET) {
      return NextResponse.json(
        { error: "Invalid reset secret" },
        { status: 403 }
      );
    }

    // Find the admin user
    const admin = await db.systemUser.findUnique({ where: { username: "admin" } });

    if (!admin) {
      // Create the admin user if it doesn't exist
      const hashed = await hashPassword("admin123");
      const newAdmin = await db.systemUser.create({
        data: {
          username: "admin",
          password: hashed,
          fullName: "System Administrator",
          role: "admin",
          email: "admin@sylhn.com",
          phone: "+233592766044",
          active: true,
          passwordResetRequired: false,
          permissions: JSON.stringify({
            pos: true, sales: true, stock: true, purchase: true,
            accounts: true, telephone: true, maintenance: true,
            financeOps: true, canVoid: true, canDiscount: true,
            canAdjustStock: true, canDeleteProducts: true, canExport: true,
          }),
        },
      });
      return NextResponse.json({
        success: true,
        message: 'Admin user created. Login with admin / admin123',
        action: "created",
        userId: newAdmin.id,
      });
    }

    // Reset the password and reactivate
    const hashed = await hashPassword("admin123");
    await db.systemUser.update({
      where: { id: admin.id },
      data: {
        password: hashed,
        active: true,
        failedLoginAttempts: 0,
        lockedUntil: null,
        passwordResetRequired: false,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Admin password reset to "admin123". Account unlocked. Login now.',
      action: "reset",
      username: "admin",
      password: "admin123",
      note: "Change this password after logging in via Maintenance → User Management.",
    });
  } catch (e: any) {
    console.error("[reset-admin] Error:", e);
    return NextResponse.json(
      { error: e.message || "Reset failed" },
      { status: 500 }
    );
  }
}

// GET — same as POST for easy browser access
export async function GET(req: NextRequest) {
  return POST(req);
}
