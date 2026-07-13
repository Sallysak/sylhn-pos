import { NextResponse } from "next/server";
import { setCsrfCookie } from "@/lib/auth";

// GET /api/auth/csrf — issue a new CSRF token (set as cookie; client reads + sends in header)
export async function GET() {
  const token = await setCsrfCookie();
  return NextResponse.json({ token });
}
