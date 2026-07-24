import { NextResponse } from "next/server";
import { getFullUser } from "@/lib/auth";
import { waitForDb } from "@/lib/db";

// GET /api/auth/me — return current session user with permissions
export async function GET() {
  await waitForDb();
  const user = await getFullUser();
  if (!user) {
    return NextResponse.json({ user: null }, { status: 401 });
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
}
