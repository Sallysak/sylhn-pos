import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

// GET /api/auth/me — return current session user
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ user: null }, { status: 401 });
  }
  return NextResponse.json({
    user: {
      uid: session.uid,
      username: session.username,
      role: session.role,
    },
  });
}
