import { NextResponse } from "next/server";
import { db, waitForDb } from "@/lib/db";

// GET /api/db-health — diagnostic endpoint for login issues.
// Returns: database driver, user count, list of usernames, and the
// DATABASE_URL (mask password if present). No auth required — used to
// debug "invalid credentials" errors on Vercel.
export async function GET() {
  const started = Date.now();
  try {
    await waitForDb();
    const userCount = await db.systemUser.count();
    const users = await db.systemUser.findMany({
      select: { username: true, role: true, active: true, lastLogin: true },
      take: 50,
    });

    const url = process.env.DATABASE_URL || "(not set)";
    const masked = url.replace(/:[^:@]+@/g, ":***@");

    return NextResponse.json({
      ok: true,
      driver: masked.startsWith("file:") ? "sqlite" : masked.startsWith("postgres") ? "postgresql" : "unknown",
      databaseUrl: masked,
      userCount,
      users,
      elapsedMs: Date.now() - started,
      defaultUsersPresent: ["admin", "manager", "cashier"].every(
        (u) => users.some((x) => x.username === u),
      ),
      hint:
        userCount === 0
          ? "No users in DB. Visit /api/setup (POST) to bootstrap, or simply retry login with admin/admin123 — the login route now self-heals."
          : "DB is healthy. If login still fails, verify the password (default admin123).",
    });
  } catch (e: any) {
    return NextResponse.json(
      {
        ok: false,
        error: e?.message || String(e),
        elapsedMs: Date.now() - started,
      },
      { status: 500 },
    );
  }
}
