import { NextResponse } from "next/server";
import { getFullUser, getSession } from "@/lib/auth";

// GET /api/auth/me — return current session user with permissions
export async function GET() {
  // Get the raw session first — works even when DB is unreachable.
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  // For synthetic emergency sessions (uid starts with "admin-" or
  // "admin-local-fallback" or "admin-emergency"), return the session
  // info directly without trying to hit the DB. This prevents /me from
  // returning 401 when the user logged in via emergency bypass.
  const isSyntheticAdmin = session.uid.startsWith('admin-') || session.uid === 'admin-local-fallback';
  if (isSyntheticAdmin) {
    return NextResponse.json({
      user: {
        uid: session.uid,
        username: session.username,
        role: session.role,
        fullName: 'System Administrator',
        permissions: {
          pos: true, sales: true, stock: true, purchase: true,
          accounts: true, telephone: true, maintenance: true,
          financeOps: true, canVoid: true, canDiscount: true,
          canAdjustStock: true, canDeleteProducts: true, canExport: true,
        },
      },
    });
  }

  // Normal flow: try to enrich with DB-stored fullName + permissions.
  try {
    const user = await getFullUser();
    if (!user) {
      // DB lookup failed but session is valid — return minimal user info
      return NextResponse.json({
        user: {
          uid: session.uid,
          username: session.username,
          role: session.role,
          fullName: session.username,
          permissions: {},
        },
      });
    }
    return NextResponse.json({
      user: {
        uid: user.uid,
        username: user.username,
        role: user.role,
        fullName: user.fullName,
        permissions: user.permissions,
      },
    });
  } catch {
    // DB error — return session-only info so the client doesn't log the user out
    return NextResponse.json({
      user: {
        uid: session.uid,
        username: session.username,
        role: session.role,
        fullName: session.username,
        permissions: {},
      },
    });
  }
}

