import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requireRole } from "@/lib/auth";
import { hashPassword } from "@/lib/auth";
import { UserSchema, validate, validationError } from "@/lib/validation";
import { rateLimitApiRead, rateLimitApiWrite, rateLimitResponse, getClientIp } from "@/lib/rate-limit";

export async function GET(req: NextRequest) {
  // Only admin/manager can list users
  try { await requireRole("admin", "manager"); } catch (e) { return e as Response; }

  const ip = getClientIp(req);
  const rl = rateLimitApiRead(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  try {
    const users = await db.systemUser.findMany({
      orderBy: { createdAt: "desc" },
    });
    // Strip passwords
    const safe = users.map(u => ({ ...u, password: undefined }));
    return NextResponse.json({ users: safe });
  } catch (e) {
    console.error("GET /api/users error:", e);
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  // Only admin can create/modify users
  try { await requireRole("admin"); } catch (e) { return e as Response; }

  const ip = getClientIp(req);
  const rl = rateLimitApiWrite(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  let body: unknown;
  try { body = await req.json(); } catch { return validationError("Invalid JSON body"); }

  try {
    if (Array.isArray((body as any)?.users)) {
      const arr = (body as any).users;
      const results: any[] = [];
      for (const u of arr.slice(0, 100)) {
        const r = validate(UserSchema, u);
        if (!r.success) continue;
        const hashed = await hashPassword(r.data.password);
        const data = {
          username: r.data.username,
          password: hashed,
          fullName: r.data.fullName,
          role: r.data.role || "cashier",
          phone: r.data.phone || "",
          email: r.data.email || "",
          active: r.data.active !== false,
          permissions: typeof r.data.permissions === "string" ? r.data.permissions : JSON.stringify(r.data.permissions || {}),
        };
        const existing = await db.systemUser.findUnique({ where: { username: r.data.username } });
        if (existing) {
          results.push(await db.systemUser.update({ where: { id: existing.id }, data: { ...data, password: hashed } }));
        } else {
          results.push(await db.systemUser.create({ data }));
        }
      }
      return NextResponse.json({ success: true, count: results.length });
    }

    const result = validate(UserSchema, body);
    if (!result.success) return validationError(result.error);
    const u = result.data;

    // Hash the password before storing
    const hashedPassword = await hashPassword(u.password);

    const user = await db.systemUser.create({
      data: {
        username: u.username,
        password: hashedPassword,
        fullName: u.fullName,
        role: u.role || "cashier",
        phone: u.phone || "",
        email: u.email || "",
        permissions: typeof u.permissions === "string" ? u.permissions : JSON.stringify(u.permissions || {}),
      },
    });
    return NextResponse.json({ success: true, user: { ...user, password: undefined } });
  } catch (e) {
    console.error("POST /api/users error:", e);
    return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
  }
}
