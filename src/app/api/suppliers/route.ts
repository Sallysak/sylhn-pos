import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const suppliers = await db.supplier.findMany({
      where: { active: true },
      include: { purchases: { take: 5, orderBy: { createdAt: "desc" } } },
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ suppliers });
  } catch (e) {
    console.error("GET /api/suppliers error:", e);
    return NextResponse.json({ error: "Failed to fetch suppliers" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (Array.isArray(body.suppliers)) {
      // Bulk upsert (sync)
      const results: any[] = [];
      for (const s of body.suppliers) {
        const data = {
          name: s.name,
          contact: s.contact || "",
          phone: s.phone || "",
          email: s.email || "",
          address: s.address || "",
          balance: Number(s.balance) || 0,
          products: typeof s.products === "string" ? s.products : JSON.stringify(s.products || []),
          active: s.active !== false,
        };
        // Try update by name (suppliers don't always have IDs from client)
        const existing = await db.supplier.findFirst({ where: { name: s.name } });
        if (existing) {
          results.push(await db.supplier.update({ where: { id: existing.id }, data }));
        } else {
          results.push(await db.supplier.create({ data }));
        }
      }
      return NextResponse.json({ success: true, count: results.length });
    }

    const supplier = await db.supplier.create({
      data: {
        name: body.name,
        contact: body.contact || "",
        phone: body.phone || "",
        email: body.email || "",
        address: body.address || "",
        balance: Number(body.balance) || 0,
        products: typeof body.products === "string" ? body.products : JSON.stringify(body.products || []),
      },
    });
    return NextResponse.json({ success: true, supplier });
  } catch (e) {
    console.error("POST /api/suppliers error:", e);
    return NextResponse.json({ error: "Failed to create supplier" }, { status: 500 });
  }
}
