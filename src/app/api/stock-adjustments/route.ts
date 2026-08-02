import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requirePermission } from "@/lib/auth";
import { rateLimitApiRead, rateLimitApiWrite, rateLimitResponse, getClientIp } from "@/lib/rate-limit";
import { auditLogTx, auditLog } from "@/lib/audit";

// GET /api/stock-adjustments
// List all stock adjustments with filters
export async function GET(req: NextRequest) {
  try { await requireAuth(); } catch (e) { return e as Response; }

  const ip = getClientIp(req);
  const rl = rateLimitApiRead(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  try {
    const { searchParams } = new URL(req.url);
    const productId = searchParams.get("productId");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const userId = searchParams.get("userId");
    const limit = Math.min(parseInt(searchParams.get("limit") || "200", 10), 1000);

    const where: any = { action: "adjusted" };
    if (productId) where.productId = productId;
    if (userId) where.userId = userId;
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }

    const adjustments = await db.stockHistory.findMany({
      where,
      include: {
        product: { select: { id: true, sku: true, name: true, emoji: true, unit: true, quantity: true, costPrice: true } },
        user: { select: { id: true, fullName: true, username: true, role: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return NextResponse.json({ adjustments, count: adjustments.length });
  } catch (e) {
    console.error("GET /api/stock-adjustments error:", e);
    return NextResponse.json({ error: "Failed to fetch adjustments" }, { status: 500 });
  }
}

// POST /api/stock-adjustments
// Premium: create a stock adjustment with manager approval flow.
//
// Body: {
//   productId: string,
//   newQuantity: number,          // the new counted quantity
//   reason: string,               // why the adjustment is being made
//   adjustmentType: "count" | "damage" | "loss" | "transfer" | "correction",
//   managerApproval?: {           // required if |change| > 5 units OR value > GHS 100
//     managerUsername: string,
//     managerPassword: string,
//   }
// }
export async function POST(req: NextRequest) {
  let user;
  try {
    user = await requireAuth();
    requirePermission(user.role, "canAdjustStock");
  } catch (e) { return e as Response; }

  const ip = getClientIp(req);
  const rl = rateLimitApiWrite(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { productId, newQuantity, reason, adjustmentType, managerApproval } = body;

  if (!productId || newQuantity === undefined || !reason) {
    return NextResponse.json({ error: "productId, newQuantity, and reason are required" }, { status: 400 });
  }

  try {
    // Fetch the product
    const product = await db.product.findUnique({
      where: { id: String(productId) },
      select: { id: true, sku: true, name: true, emoji: true, quantity: true, unit: true, costPrice: true, price: true },
    });
    if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

    const oldQuantity = product.quantity;
    const change = Number(newQuantity) - oldQuantity;
    const changeAbs = Math.abs(change);
    const valueAtStake = changeAbs * product.costPrice;

    // ===== Manager approval check =====
    // Required if: change > 5 units OR value > GHS 100
    const APPROVAL_UNIT_THRESHOLD = 5;
    const APPROVAL_VALUE_THRESHOLD = 100;
    const needsApproval = changeAbs > APPROVAL_UNIT_THRESHOLD || valueAtStake > APPROVAL_VALUE_THRESHOLD;

    if (needsApproval) {
      if (!managerApproval?.managerUsername || !managerApproval?.managerPassword) {
        return NextResponse.json({
          error: "Manager approval required",
          requiresApproval: true,
          threshold: {
            units: APPROVAL_UNIT_THRESHOLD,
            value: APPROVAL_VALUE_THRESHOLD,
            changeUnits: changeAbs,
            changeValue: valueAtStake,
          },
          message: `This adjustment changes ${changeAbs} units (GHS ${valueAtStake.toFixed(2)}) which exceeds the threshold of ${APPROVAL_UNIT_THRESHOLD} units or GHS ${APPROVAL_VALUE_THRESHOLD}. A manager must approve.`,
        }, { status: 403 });
      }

      // Verify manager credentials
      const { verifyPassword } = await import("@/lib/auth");
      const manager = await db.systemUser.findUnique({
        where: { username: String(managerApproval.managerUsername) },
        select: { id: true, username: true, fullName: true, role: true, password: true, active: true },
      });

      if (!manager || !manager.active) {
        return NextResponse.json({ error: "Invalid manager credentials" }, { status: 401 });
      }
      if (manager.role !== "manager" && manager.role !== "admin") {
        return NextResponse.json({ error: "Approver must be a manager or admin" }, { status: 403 });
      }

      let valid = false;
      if (manager.password.startsWith("pbkdf2$")) {
        valid = await verifyPassword(String(managerApproval.managerPassword), manager.password);
      } else {
        valid = manager.password === String(managerApproval.managerPassword);
      }
      if (!valid) {
        return NextResponse.json({ error: "Invalid manager credentials" }, { status: 401 });
      }

      // Audit the approval
      await auditLog({
        userId: user.uid,
        user: user.username,
        action: "APPROVE_GRANTED",
        module: "stock",
        details: `${manager.username} (${manager.role}) approved ${user.username}'s stock adjustment of ${product.name}: ${oldQuantity} → ${newQuantity} (${change > 0 ? "+" : ""}${change} units, GHS ${valueAtStake.toFixed(2)}) — reason: ${reason}`,
        severity: "warning",
        ipAddress: ip,
        userAgent: req.headers.get("user-agent") || "",
      });
    }

    // ===== Execute the adjustment (transactional) =====
    const result = await db.$transaction(async (tx) => {
      // Update product quantity
      const updatedProduct = await tx.product.update({
        where: { id: product.id },
        data: { quantity: Number(newQuantity) },
      });

      // Create stock history entry
      const actionMap: Record<string, string> = {
        count: "adjusted",
        damage: "damaged",
        loss: "adjusted",
        transfer: "transfer",
        correction: "adjusted",
      };
      const action = actionMap[adjustmentType] || "adjusted";

      const historyEntry = await tx.stockHistory.create({
        data: {
          productId: product.id,
          action,
          quantity: change,
          reason: `${adjustmentType.toUpperCase()}: ${reason}${needsApproval ? " (manager approved)" : ""}`,
          reference: `ADJ-${Date.now()}`,
          userId: user.uid,
        },
      });

      // Audit log
      await auditLogTx(tx, {
        userId: user.uid,
        user: user.username,
        action: "ADJUST",
        module: "stock",
        details: `Stock adjusted: ${product.name} (${product.sku}) — ${oldQuantity} → ${newQuantity} (${change > 0 ? "+" : ""}${change} ${product.unit}) — type: ${adjustmentType}, reason: ${reason}${needsApproval ? " [MANAGER APPROVED]" : ""}`,
        severity: changeAbs > APPROVAL_UNIT_THRESHOLD ? "warning" : "info",
        ipAddress: ip,
        userAgent: req.headers.get("user-agent") || "",
      });

      return { updatedProduct, historyEntry };
    });

    return NextResponse.json({
      success: true,
      product: result.updatedProduct,
      historyEntry: result.historyEntry,
      adjustment: {
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        oldQuantity,
        newQuantity: Number(newQuantity),
        change,
        changeValue: valueAtStake,
        reason,
        adjustmentType,
        managerApproved: needsApproval,
        adjustedBy: user.username,
        adjustedAt: new Date().toISOString(),
      },
    });
  } catch (e: any) {
    console.error("POST /api/stock-adjustments error:", e);
    return NextResponse.json({ error: e?.message || "Failed to create adjustment" }, { status: 500 });
  }
}
