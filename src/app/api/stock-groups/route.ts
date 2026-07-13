import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const groups = await db.stockGroup.findMany({
      include: { products: true },
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ groups });
  } catch (e) {
    console.error("GET /api/stock-groups error:", e);
    return NextResponse.json({ error: "Failed to fetch stock groups" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (Array.isArray(body.groups)) {
      const results: any[] = [];
      for (const g of body.groups) {
        const data = {
          name: g.name,
          icon: g.icon || "📦",
          color: g.color || "#10b981",
          description: g.description || "",
        };
        const existing = await db.stockGroup.findFirst({ where: { name: g.name } });
        if (existing) {
          results.push(await db.stockGroup.update({ where: { id: existing.id }, data }));
        } else {
          results.push(await db.stockGroup.create({ data }));
        }
      }
      return NextResponse.json({ success: true, count: results.length });
    }

    const group = await db.stockGroup.create({
      data: {
        name: body.name,
        icon: body.icon || "📦",
        color: body.color || "#10b981",
        description: body.description || "",
      },
    });
    return NextResponse.json({ success: true, group });
  } catch (e) {
    console.error("POST /api/stock-groups error:", e);
    return NextResponse.json({ error: "Failed to create stock group" }, { status: 500 });
  }
}
