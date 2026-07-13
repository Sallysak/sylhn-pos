import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { rateLimitApiRead, rateLimitApiWrite, rateLimitResponse, getClientIp } from "@/lib/rate-limit";

// GET /api/telephone-directory — list directory entries
export async function GET(req: NextRequest) {
  try { await requireAuth(); } catch (e) { return e as Response; }

  const ip = getClientIp(req);
  const rl = rateLimitApiRead(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search");
    const group = searchParams.get("group");

    const where: any = {};
    if (group) where.group = group;
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { mobile: { contains: search } },
        { homePhone: { contains: search } },
        { workPhone: { contains: search } },
        { email: { contains: search } },
      ];
    }

    const entries = await db.telephoneDirectoryEntry.findMany({
      where,
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ entries });
  } catch (e) {
    console.error("GET /api/telephone-directory error:", e);
    return NextResponse.json({ error: "Failed to fetch directory" }, { status: 500 });
  }
}

// POST /api/telephone-directory — create a new entry
export async function POST(req: NextRequest) {
  let user;
  try { user = await requireAuth(); } catch (e) { return e as Response; }

  const ip = getClientIp(req);
  const rl = rateLimitApiWrite(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  try {
    const entry = await db.telephoneDirectoryEntry.create({
      data: {
        name: String(body.name || "").slice(0, 200),
        homePhone: String(body.homePhone || "").slice(0, 32),
        workPhone: String(body.workPhone || "").slice(0, 32),
        mobile: String(body.mobile || "").slice(0, 32),
        fax: String(body.fax || "").slice(0, 32),
        email: String(body.email || "").slice(0, 200),
        website: String(body.website || "").slice(0, 200),
        address: String(body.address || "").slice(0, 500),
        group: String(body.group || "general").slice(0, 50),
        notes: String(body.notes || "").slice(0, 2000),
        createdById: user.uid,
      },
    });

    await db.auditLog.create({
      data: {
        userId: user.uid,
        user: user.username,
        action: "CREATE",
        module: "telephone",
        details: `Directory entry ${entry.name} created`,
        severity: "info",
      },
    });

    return NextResponse.json({ success: true, entry });
  } catch (e) {
    console.error("POST /api/telephone-directory error:", e);
    return NextResponse.json({ error: "Failed to create entry" }, { status: 500 });
  }
}
