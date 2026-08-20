import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requirePermission } from "@/lib/auth";
import { rateLimitApiWrite, rateLimitResponse, getClientIp } from "@/lib/rate-limit";
import { auditLog } from "@/lib/audit";

// POST /api/products/[id]/image
// Upload a product image as a base64 data URL.
// Body: { image: string } (base64 data URL, max ~500KB)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let user;
  try { user = await requireAuth(); requirePermission(user.role, "stock"); } catch (e: any) { return e as Response; }
  const ip = getClientIp(req);
  const rl = rateLimitApiWrite(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  try {
    const { id } = await params;
    const body = await req.json();
    const image = body.image;
    if (!image || typeof image !== "string") {
      return NextResponse.json({ error: "Image data is required" }, { status: 400 });
    }
    // Limit to ~500KB base64
    if (image.length > 700000) {
      return NextResponse.json({ error: "Image too large (max 500KB). Use a smaller image." }, { status: 400 });
    }

    const product = await db.product.update({
      where: { id },
      data: { imageUrl: image },
      select: { id: true, name: true, imageUrl: true },
    });

    auditLog({
      userId: user.uid, user: user.username,
      action: "UPDATE", module: "stock",
      details: `Product image updated for ${product.name}`,
      severity: "info", ipAddress: ip,
      userAgent: req.headers.get("user-agent") || "",
    }).catch(() => {});

    return NextResponse.json({ success: true, product });
  } catch (e: any) {
    console.error("POST /api/products/[id]/image error:", e);
    return NextResponse.json({ error: e?.message || "Failed to upload image" }, { status: 500 });
  }
}

// DELETE — remove the product image
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let user;
  try { user = await requireAuth(); requirePermission(user.role, "stock"); } catch (e: any) { return e as Response; }
  const ip = getClientIp(req);
  const rl = rateLimitApiWrite(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  try {
    const { id } = await params;
    await db.product.update({ where: { id }, data: { imageUrl: "" } });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed to remove image" }, { status: 500 });
  }
}
