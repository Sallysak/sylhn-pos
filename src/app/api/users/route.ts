import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const users = await db.systemUser.findMany({
      orderBy: { createdAt: "desc" },
    });
    // Strip passwords before returning
    const safe = users.map(u => ({ ...u, password: undefined }));
    return NextResponse.json({ users: safe });
  } catch (e) {
    console.error("GET /api/users error:", e);
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (Array.isArray(body.users)) {
      const results: any[] = [];
      for (const u of body.users) {
        const data = {
          username: u.username,
          password: u.password,
          fullName: u.fullName,
          role: u.role || "cashier",
          phone: u.phone || "",
          email: u.email || "",
          active: u.active !== false,
          permissions: typeof u.permissions === "string" ? u.permissions : JSON.stringify(u.permissions || {}),
        };
        const existing = await db.systemUser.findUnique({ where: { username: u.username } });
        if (existing) {
          results.push(await db.systemUser.update({ where: { id: existing.id }, data }));
        } else {
          results.push(await db.systemUser.create({ data }));
        }
      }
      return NextResponse.json({ success: true, count: results.length });
    }

    const user = await db.systemUser.create({
      data: {
        username: body.username,
        password: body.password,
        fullName: body.fullName,
        role: body.role || "cashier",
        phone: body.phone || "",
        email: body.email || "",
        permissions: typeof body.permissions === "string" ? body.permissions : JSON.stringify(body.permissions || {}),
      },
    });
    return NextResponse.json({ success: true, user: { ...user, password: undefined } });
  } catch (e) {
    console.error("POST /api/users error:", e);
    return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
  }
}
