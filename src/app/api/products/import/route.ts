import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requirePermission } from "@/lib/auth";
import { rateLimitApiWrite, rateLimitResponse, getClientIp } from "@/lib/rate-limit";
import { auditLog } from "@/lib/audit";

// POST /api/products/import
// Bulk import products from CSV text.
// Expected CSV format: name,sku,barcode,price,costPrice,stock,unit,category,emoji,taxable,supplier,reorderLevel
// Only `name` and `price` are required.
// Body: { csv: string, updateExisting?: boolean }
// Returns: { imported, skipped, errors, total }
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

  const csvText: string = body?.csv;
  if (!csvText || typeof csvText !== "string") {
    return NextResponse.json({ error: "csv field is required (string)" }, { status: 400 });
  }
  const updateExisting: boolean = Boolean(body?.updateExisting);

  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length < 2) {
    return NextResponse.json({ error: "CSV must have a header row and at least one data row" }, { status: 400 });
  }

  const headers = parseCsvLine(lines[0]).map(h => h.trim().toLowerCase());
  const nameIdx = headers.indexOf("name");
  const priceIdx = headers.indexOf("price");
  if (nameIdx === -1 || priceIdx === -1) {
    return NextResponse.json({ error: "CSV must have at least 'name' and 'price' columns" }, { status: 400 });
  }

  const colIdx = {
    sku: headers.indexOf("sku"),
    barcode: headers.indexOf("barcode"),
    costPrice: headers.indexOf("costprice") !== -1 ? headers.indexOf("costprice") : headers.indexOf("cost"),
    stock: headers.indexOf("stock") !== -1 ? headers.indexOf("stock") : headers.indexOf("quantity"),
    unit: headers.indexOf("unit"),
    category: headers.indexOf("category"),
    groupId: headers.indexOf("groupid") !== -1 ? headers.indexOf("groupid") : headers.indexOf("group"),
    emoji: headers.indexOf("emoji"),
    taxable: headers.indexOf("taxable"),
    supplier: headers.indexOf("supplier"),
    reorderLevel: headers.indexOf("reorderlevel") !== -1 ? headers.indexOf("reorderlevel") : headers.indexOf("reorder"),
    expiryDate: headers.indexOf("expirydate") !== -1 ? headers.indexOf("expirydate") : headers.indexOf("expiry"),
  };

  const results = { imported: 0, skipped: 0, errors: [] as string[], total: 0 };

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    results.total++;
    const cols = parseCsvLine(line);

    try {
      const name = cols[nameIdx]?.trim();
      const price = parseFloat(cols[priceIdx] || "0");
      if (!name || isNaN(price) || price < 0) {
        results.errors.push(`Row ${i + 1}: missing name or invalid price`);
        continue;
      }

      const sku = colIdx.sku !== -1 ? cols[colIdx.sku]?.trim() : undefined;
      const barcode = colIdx.barcode !== -1 ? cols[colIdx.barcode]?.trim() : undefined;

      if (sku) {
        const existing = await db.product.findUnique({ where: { sku } });
        if (existing) {
          if (updateExisting) {
            await db.product.update({
              where: { id: existing.id },
              data: {
                name,
                price,
                costPrice: colIdx.costPrice !== -1 ? parseFloat(cols[colIdx.costPrice] || "0") || 0 : existing.costPrice,
                quantity: colIdx.stock !== -1 ? parseInt(cols[colIdx.stock] || "0") || 0 : existing.quantity,
                barcode: barcode || existing.barcode,
                unit: colIdx.unit !== -1 ? cols[colIdx.unit]?.trim() || existing.unit : existing.unit,
                taxable: colIdx.taxable !== -1 ? parseBool(cols[colIdx.taxable]) : existing.taxable,
                reorderLevel: colIdx.reorderLevel !== -1 ? parseInt(cols[colIdx.reorderLevel] || "10") || 10 : existing.reorderLevel,
              },
            });
            results.imported++;
            continue;
          } else {
            results.skipped++;
            continue;
          }
        }
      }

      await db.product.create({
        data: {
          name,
          sku: sku || `IMP-${Date.now()}-${i}`,
          barcode: barcode || "",
          price,
          costPrice: colIdx.costPrice !== -1 ? parseFloat(cols[colIdx.costPrice] || "0") || 0 : 0,
          quantity: colIdx.stock !== -1 ? parseInt(cols[colIdx.stock] || "0") || 0 : 0,
          unit: colIdx.unit !== -1 ? cols[colIdx.unit]?.trim() || "each" : "each",
          category: colIdx.category !== -1 ? cols[colIdx.category]?.trim() || "general" : "general",
          groupId: colIdx.groupId !== -1 ? cols[colIdx.groupId]?.trim() || undefined : undefined,
          emoji: colIdx.emoji !== -1 ? cols[colIdx.emoji]?.trim() || "📦" : "📦",
          taxable: colIdx.taxable !== -1 ? parseBool(cols[colIdx.taxable]) : true,
          reorderLevel: colIdx.reorderLevel !== -1 ? parseInt(cols[colIdx.reorderLevel] || "10") || 10 : 10,
          expiryDate: colIdx.expiryDate !== -1 && cols[colIdx.expiryDate] ? new Date(cols[colIdx.expiryDate]) : null,
          active: true,
        },
      });
      results.imported++;
    } catch (e: any) {
      results.errors.push(`Row ${i + 1}: ${e?.message || "unknown error"}`);
    }
  }

  await auditLog({
    userId: user.uid,
    user: user.username,
    action: "PRODUCTS_IMPORT",
    module: "stock",
    details: `CSV import: ${results.imported} imported, ${results.skipped} skipped, ${results.errors.length} errors`,
    severity: "info",
    ipAddress: ip,
    userAgent: req.headers.get("user-agent") || "",
  }).catch(() => {});

  return NextResponse.json({ success: true, ...results });
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

function parseBool(v: string): boolean {
  const s = (v || "").trim().toLowerCase();
  return s === "true" || s === "yes" || s === "1" || s === "y";
}
