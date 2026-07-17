import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requirePermission } from "@/lib/auth";
import { SupplierSchema, validate, validationError } from "@/lib/validation";
import { rateLimitApiRead, rateLimitApiWrite, rateLimitResponse, getClientIp } from "@/lib/rate-limit";
import { auditLog } from "@/lib/audit";
import { generateSupplierCode } from "@/lib/identifiers";

export async function GET(req: NextRequest) {
  try { await requireAuth(); } catch (e) { return e as Response; }

  const ip = getClientIp(req);
  const rl = rateLimitApiRead(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  try {
    const { searchParams } = new URL(req.url);
    const active = searchParams.get("active");
    const limit = Math.min(parseInt(searchParams.get("limit") || "500", 10), 1000);

    const suppliers = await db.supplier.findMany({
      where: active === "true" ? { active: true } : active === "false" ? { active: false } : undefined,
      include: {
        products: { include: { product: { select: { id: true, sku: true, name: true, emoji: true } } } },
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
      take: limit,
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
          contactName: r.data.contactName || r.data.contact || "",
          phone: r.data.phone || "",
          mobile: r.data.mobile || "",
          email: r.data.email || "",
          fax: r.data.fax || "",
          address: r.data.address || "",
          city: r.data.city || "",
          state: r.data.state || "",
          country: r.data.country || "Ghana",
          businessNo: r.data.businessNo || "",
          tradingTerms: r.data.tradingTerms || "Net 30",
          creditLimit: Number(r.data.creditLimit) || 0,
          taxInclusive: Boolean(r.data.taxInclusive),
          notes: r.data.notes || "",
          balance: Number(r.data.balance) || 0,
          active: r.data.active !== false,
        };
        const existing = await db.supplier.findFirst({ where: { name: r.data.name } });
        if (existing) {
          results.push(await db.supplier.update({ where: { id: existing.id }, data }));
        } else {
          const code = await generateSupplierCode();
          results.push(await db.supplier.create({ data: { ...data, code } }));
        }
      }
      // Audit bulk upsert
      await auditLog({
        userId: user.uid,
        user: user.username,
        action: "BULK_UPSERT",
        module: "supplier",
        details: `Bulk upserted ${results.length} suppliers`,
        severity: "info",
        ipAddress: ip,
        userAgent: req.headers.get("user-agent") || "",
      });
      return NextResponse.json({ success: true, count: results.length });
    }

    const result = validate(SupplierSchema, body);
    if (!result.success) return validationError(result.error);
    const s = result.data;

    // Premium fix: accept the full supplier schema (was only saving 5 fields)
    const code = s.code || await generateSupplierCode();
    const supplier = await db.supplier.create({
      data: {
        code,
        name: s.name,
        contactName: s.contactName || s.contact || "",
        phone: s.phone || "",
        mobile: s.mobile || "",
        email: s.email || "",
        fax: s.fax || "",
        address: s.address || "",
        city: s.city || "",
        state: s.state || "",
        country: s.country || "Ghana",
        businessNo: s.businessNo || "",
        tradingTerms: s.tradingTerms || "Net 30",
        creditLimit: Number(s.creditLimit) || 0,
        taxInclusive: Boolean(s.taxInclusive),
        notes: s.notes || "",
        balance: Number(s.balance) || 0,
        active: s.active !== false,
      },
      include: { products: true, purchases: true },
    });

    await auditLog({
      userId: user.uid,
      user: user.username,
      action: "CREATE",
      module: "supplier",
      details: `Supplier ${supplier.code} (${supplier.name}) created — terms: ${supplier.tradingTerms}, credit limit: GHS ${supplier.creditLimit}`,
      severity: "info",
      ipAddress: ip,
      userAgent: req.headers.get("user-agent") || "",
    });

    return NextResponse.json({ success: true, supplier });
  } catch (e) {
    console.error("POST /api/suppliers error:", e);
    return NextResponse.json({ error: "Failed to create supplier" }, { status: 500 });
  }
}
