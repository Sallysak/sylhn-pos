import { NextResponse } from "next/server";
import { getFullUser } from "@/lib/auth";

// GET /api/auth/me — return current session user with permissions
// Premium fix: previously returned only uid/username/role, so the frontend
// had to fall back to localStorage-stored permissions (client-editable).
// Now we return the server-side permissions too.
export async function GET() {
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
