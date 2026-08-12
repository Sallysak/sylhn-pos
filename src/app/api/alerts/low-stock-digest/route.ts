import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { rateLimitApiRead, rateLimitResponse, getClientIp } from "@/lib/rate-limit";
import { auditLog } from "@/lib/audit";
import { formatGHS } from "@/lib/pos-data";

// GET /api/alerts/low-stock-digest
// Returns the current low-stock digest — all products at or below their
// reorder level, grouped by preferred supplier (so managers can create
// one PO per supplier).
//
// Optional: ?sendEmail=true  — also sends the digest via email to all
//                              managers/admins (best-effort, requires
//                              SMTP config). Audit-logged.
// Optional: ?format=whatsapp — returns a wa.me link with the digest
//                              pre-filled for sending via WhatsApp.
//
// Designed to be called:
//   1. Manually from the Operations Dashboard (preview)
//   2. By a daily cron job (Vercel Cron) — set ?sendEmail=true
//   3. By a manager wanting to send via WhatsApp — ?format=whatsapp
export async function GET(req: NextRequest) {
  let user;
  try { user = await requireAuth(); } catch (e: any) { return e as Response; }

  const ip = getClientIp(req);
  const rl = rateLimitApiRead(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  try {
    const { searchParams } = new URL(req.url);
    const sendEmail = searchParams.get("sendEmail") === "true";
    const format = searchParams.get("format") || "json"; // json | whatsapp | email-text

    // Fetch all low-stock products
    const lowStockProducts = await db.product.findMany({
      where: { active: true },
      include: {
        suppliers: {
          where: { preferred: true },
          take: 1,
          include: { supplier: { select: { id: true, name: true, code: true, phone: true, mobile: true } } },
        },
      },
    });

    const lowStock = lowStockProducts.filter(p => p.quantity <= p.reorderLevel);

    if (lowStock.length === 0) {
      return NextResponse.json({
        success: true,
        count: 0,
        message: "No low-stock items. All products are above their reorder levels.",
        products: [],
        bySupplier: [],
      });
    }

    // Group by preferred supplier
    const bySupplierMap = new Map<string, {
      supplierId: string;
      supplierName: string;
      supplierCode: string;
      phone: string;
      items: Array<{
        productId: string;
        sku: string;
        name: string;
        emoji: string;
        quantity: number;
        reorderLevel: number;
        suggestedQty: number;
        costPrice: number;
        estimatedCost: number;
      }>;
      totalEstimatedCost: number;
    }>();

    const allItems: any[] = [];
    for (const p of lowStock) {
      const preferredLink = p.suppliers[0];
      const supplierKey = preferredLink?.supplier?.id || "unassigned";
      const suggestedQty = Math.max((p.reorderLevel || 5) * 2 - p.quantity, 1);
      const item = {
        productId: p.id,
        sku: p.sku,
        name: p.name,
        emoji: p.emoji || "📦",
        quantity: p.quantity,
        reorderLevel: p.reorderLevel,
        suggestedQty,
        costPrice: p.costPrice,
        estimatedCost: suggestedQty * p.costPrice,
      };
      allItems.push({ ...item, supplierName: preferredLink?.supplier?.name || "Unassigned" });

      if (!bySupplierMap.has(supplierKey)) {
        bySupplierMap.set(supplierKey, {
          supplierId: preferredLink?.supplier?.id || "",
          supplierName: preferredLink?.supplier?.name || "Unassigned",
          supplierCode: preferredLink?.supplier?.code || "",
          phone: preferredLink?.supplier?.mobile || preferredLink?.supplier?.phone || "",
          items: [],
          totalEstimatedCost: 0,
        });
      }
      const entry = bySupplierMap.get(supplierKey)!;
      entry.items.push(item);
      entry.totalEstimatedCost += item.estimatedCost;
    }

    const bySupplier = Array.from(bySupplierMap.values());
    const totalEstimatedCost = allItems.reduce((s, i) => s + i.estimatedCost, 0);

    // Build text versions for email/WhatsApp
    const buildText = () => {
      const lines: string[] = [
        `*SYLHN POS — Low Stock Digest*`,
        `${new Date().toLocaleString("en-GB", { timeZone: "Africa/Accra" })}`,
        ``,
        `*${lowStock.length} product${lowStock.length === 1 ? "" : "s"} need reordering*`,
        `Total estimated cost: ${formatGHS(totalEstimatedCost)}`,
        ``,
      ];
      for (const sup of bySupplier) {
        lines.push(`━━━━━━━━━━━━━━━━━━━`);
        lines.push(`*${sup.supplierName}*${sup.phone ? ` (${sup.phone})` : ""}`);
        lines.push(`${sup.items.length} item${sup.items.length === 1 ? "" : "s"} · ${formatGHS(sup.totalEstimatedCost)}`);
        lines.push(``);
        for (const it of sup.items) {
          lines.push(`${it.emoji} ${it.name}`);
          lines.push(`   Stock: ${it.quantity} (reorder at ${it.reorderLevel})`);
          lines.push(`   Suggested: ${it.suggestedQty} × ${formatGHS(it.costPrice)} = ${formatGHS(it.estimatedCost)}`);
        }
        lines.push(``);
      }
      lines.push(`Open the POS → Operations Dashboard → Reorder tab to create POs.`);
      return lines.join("\n");
    };

    const text = buildText();

    // Send email if requested
    if (sendEmail) {
      try {
        // Fetch all managers + admins with email
        const managers = await db.systemUser.findMany({
          where: {
            active: true,
            role: { in: ["admin", "manager"] },
            email: { not: "" },
          },
          select: { email: true, fullName: true },
        });
        if (managers.length === 0) {
          return NextResponse.json({
            success: true,
            count: lowStock.length,
            products: allItems,
            bySupplier,
            totalEstimatedCost,
            text,
            emailSent: false,
            emailError: "No managers/admins have email addresses configured",
          });
        }
        // Send via the internal email API
        const sendRes = await fetch(new URL("/api/email", req.url), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            to: managers.map(m => m.email).join(","),
            subject: `[SYLHN POS] Low Stock Digest — ${lowStock.length} item${lowStock.length === 1 ? "" : "s"} need reordering`,
            body: text,
          }),
        });
        const sent = sendRes.ok;
        await auditLog({
          userId: user.uid,
          user: user.username,
          action: "LOW_STOCK_DIGEST_EMAIL",
          module: "stock",
          details: `Low-stock digest ${sent ? "sent" : "FAILED to send"} to ${managers.length} manager(s) — ${lowStock.length} items, est. cost ${formatGHS(totalEstimatedCost)}`,
          severity: sent ? "info" : "warning",
          ipAddress: ip,
          userAgent: req.headers.get("user-agent") || "",
        }).catch(() => {});
        return NextResponse.json({
          success: true,
          count: lowStock.length,
          products: allItems,
          bySupplier,
          totalEstimatedCost,
          text,
          emailSent: sent,
          emailRecipients: managers.length,
        });
      } catch (e: any) {
        return NextResponse.json({
          success: true,
          count: lowStock.length,
          products: allItems,
          bySupplier,
          totalEstimatedCost,
          text,
          emailSent: false,
          emailError: e?.message,
        });
      }
    }

    // WhatsApp format — return a wa.me link
    if (format === "whatsapp") {
      const waLink = `https://wa.me/?text=${encodeURIComponent(text)}`;
      return NextResponse.json({
        success: true,
        count: lowStock.length,
        products: allItems,
        bySupplier,
        totalEstimatedCost,
        text,
        waLink,
      });
    }

    // Default JSON response
    return NextResponse.json({
      success: true,
      count: lowStock.length,
      products: allItems,
      bySupplier,
      totalEstimatedCost,
      text,
    });
  } catch (e: any) {
    console.error("GET /api/alerts/low-stock-digest error:", e);
    return NextResponse.json({ error: "Failed to generate low-stock digest" }, { status: 500 });
  }
}
