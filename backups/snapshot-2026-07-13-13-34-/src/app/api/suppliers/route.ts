import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requirePermission } from "@/lib/auth";
import { SupplierSchema, validate, validationError } from "@/lib/validation";
import { rateLimitApiRead, rateLimitApiWrite, rateLimitResponse, getClientIp } from "@/lib/rate-limit";

export async function GET(req: NextRequest) {
  try { await requireAuth(); } catch (e) { return e as Response; }

  const ip = getClientIp(req);
  const rl = rateLimitApiRead(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  try {
    const suppliers = await db.supplier.findMany({
      where: { active: true },
      include: {
        products: { include: { product: true } },
        purchases: {
          take: 10,
          orderBy: { createdAt: "desc" },
          select: { id: true, refNo: true, total: true, status: true, createdAt: true },
        },
        payments: {
          take: 10,
          orderBy: { paymentDate: "desc" },
        },
      },
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ suppliers });
  } catch (e) {
    console.error("GET /api/suppliers error:", e);
    return NextResponse.json({ error: "Failed to fetch suppliers" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let user;
  try {
    user = await requireAuth();
    requirePermission(user.role, "purchase");
  } catch (e) { return e as Response; }

  const ip = getClientIp(req);
  const rl = rateLimitApiWrite(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  let body: unknown;
  try { body = await req.json(); } catch { return validationError("Invalid JSON body"); }

  try {
    if (Array.isArray((body as any)?.suppliers)) {
      const arr = (body as any).suppliers;
      const results: any[] = [];
      for (const s of arr.slice(0, 500)) {
        const r = validate(SupplierSchema, s);
        if (!r.success) continue;
        const data = {
          name: r.data.name,
          contactName: r.data.contact || "",
          phone: r.data.phone || "",
          email: r.data.email || "",
          address: r.data.address || "",
          balance: Number(r.data.balance) || 0,
          active: r.data.active !== false,
        };
        const existing = await db.supplier.findFirst({ where: { name: r.data.name } });
        if (existing) {
          results.push(await db.supplier.update({ where: { id: existing.id }, data }));
        } else {
          results.push(await db.supplier.create({
            data: { ...data, code: `SUP-${Date.now().toString().slice(-5)}` },
          }));
        }
      }
      return NextResponse.json({ success: true, count: results.length });
    }

    const result = validate(SupplierSchema, body);
    if (!result.success) return validationError(result.error);
    const s = result.data;

    const supplier = await db.supplier.create({
      data: {
        code: `SUP-${Date.now().toString().slice(-5)}`,
        name: s.name,
        contactName: s.contact || "",
        phone: s.phone || "",
        email: s.email || "",
        address: s.address || "",
        balance: Number(s.balance) || 0,
      },
      include: { products: true, purchases: true },
    });

    await db.auditLog.create({
      data: {
        userId: user.uid,
        user: user.username,
        action: "CREATE",
        module: "supplier",
        details: `Supplier ${supplier.code} (${supplier.name}) created`,
        severity: "info",
      },
    });

    return NextResponse.json({ success: true, supplier });
  } catch (e) {
    console.error("POST /api/suppliers error:", e);
    return NextResponse.json({ error: "Failed to create supplier" }, { status: 500 });
  }
}
