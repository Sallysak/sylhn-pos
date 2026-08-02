import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { rateLimitApiRead, rateLimitResponse, getClientIp } from "@/lib/rate-limit";
import { auditLog } from "@/lib/audit";
import { qrSvg } from "@/lib/qr";

// GET /api/receipt/qr?saleId=xxx&format=svg|html
// Returns a QR code (as SVG or HTML) encoding the sale's invoice number + total.
// Premium feature: customers scan the QR to verify receipt authenticity or
// start a return. The QR encodes a compact text like "SYLHN|INV-1784297887297-0000|GHS 85.10".
export async function GET(req: NextRequest) {
  let user;
  try { user = await requireAuth(); } catch (e) { return e as Response; }

  const ip = getClientIp(req);
  const rl = rateLimitApiRead(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  try {
    const { searchParams } = new URL(req.url);
    const saleId = searchParams.get("saleId");
    const format = (searchParams.get("format") || "svg").toLowerCase();
    if (!saleId) {
      return NextResponse.json({ error: "saleId is required" }, { status: 400 });
    }

    const sale = await db.sale.findUnique({
      where: { id: saleId },
      select: { invoiceNumber: true, total: true, createdAt: true, customerName: true, id: true },
    });
    if (!sale) return NextResponse.json({ error: "Sale not found" }, { status: 404 });

    // Compact payload for the QR
    const payload = `SYLHN|${sale.invoiceNumber}|GHS${sale.total.toFixed(2)}|${new Date(sale.createdAt).toISOString().split("T")[0]}`;
    const svg = qrSvg(payload, { scale: 6, margin: 2 });

    // Audit (fire-and-forget)
    auditLog({
      userId: user.uid,
      user: user.username,
      action: "RECEIPT_QR",
      module: "sales",
      details: `QR code generated for sale ${sale.invoiceNumber}`,
      severity: "info",
      ipAddress: ip,
      userAgent: req.headers.get("user-agent") || "",
    }).catch(() => {});

    if (format === "svg") {
      return new NextResponse(svg, {
        headers: {
          "Content-Type": "image/svg+xml",
          "Cache-Control": "public, max-age=3600",
        },
      });
    }

    if (format === "html") {
      const html = `<!DOCTYPE html><html><head><title>Receipt QR — ${sale.invoiceNumber}</title><style>body{font-family:system-ui,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f9fafb}img{border:1px solid #e5e7eb;border-radius:8px;background:#fff}h1{font-size:14px;color:#475569;margin:8px 0 4px}p{font-size:12px;color:#94a3b8;margin:0}</style></head><body>${svg.replace('<svg ', '<svg role="img" aria-label="Receipt QR" ')}<h1>${sale.invoiceNumber}</h1><p>Scan to verify receipt</p></body></html>`;
      return new NextResponse(html, { headers: { "Content-Type": "text/html" } });
    }

    // JSON (default)
    return NextResponse.json({
      success: true,
      payload,
      svg,
      invoiceNumber: sale.invoiceNumber,
    });
  } catch (e) {
    console.error("GET /api/receipt/qr error:", e);
    return NextResponse.json({ error: "Failed to generate QR code" }, { status: 500 });
  }
}
