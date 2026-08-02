import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { rateLimitApiWrite, rateLimitResponse, getClientIp } from "@/lib/rate-limit";
import { auditLog } from "@/lib/audit";

// POST /api/admin/wipe-data — wipe all business data (products, sales, customers,
// suppliers, purchases, etc.) but PRESERVE user accounts (SystemUser) so the
// admin can still log in afterwards.
//
// Body: { confirm: "WIPE_ALL_DATA" } — must match exactly to prevent accidents.
//
// Access: admin role only.
//
// Tables wiped (in dependency order — children first):
//   - SalePayment, SaleItem, HeldOrder, LoyaltyTransaction
//   - StockHistory, StockTransferItem, StockTransfer, StocktakeItem, Stocktake
//   - PurchaseItem, SupplierPayment, Purchase
//   - AutoReplenishRule, RecurringPO, ForecastSnapshot, LocationStock
//   - Expense, EmailLog, BackupRecord
//   - ProductSupplier, Product, Supplier, Customer, TelephoneDirectoryEntry
//   - StockGroup, CashierShift, Register, AuditLog
//   - SystemSetting (resets to defaults)
//
// Tables PRESERVED:
//   - SystemUser (so admin can still log in)
//   - Location (store layout config)
export async function POST(req: NextRequest) {
  let user;
  try {
    user = await requireAuth();
    if (user.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }
  } catch (e) { return e as Response; }

  const ip = getClientIp(req);
  const rl = rateLimitApiWrite(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  let body: any;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (body.confirm !== "WIPE_ALL_DATA") {
    return NextResponse.json({
      error: "Confirmation required",
      hint: 'Send { "confirm": "WIPE_ALL_DATA" } to confirm. This action is irreversible.',
    }, { status: 400 });
  }

  try {
    const counts: Record<string, number> = {};

    // Helper to count + delete
    const wipe = async (model: any, name: string) => {
      try {
        const start = await model.count();
        await model.deleteMany({});
        counts[name] = start;
      } catch (e: any) {
        console.warn(`[wipe-data] failed to wipe ${name}:`, e?.message);
        counts[name] = -1;
      }
    };

    // ===== Wipe in dependency order =====
    // 1. Child tables (foreign keys to others)
    await wipe(db.salePayment, "salePayments");
    await wipe(db.saleItem, "saleItems");
    await wipe(db.sale, "sales");
    await wipe(db.heldOrder, "heldOrders");
    await wipe(db.loyaltyTransaction, "loyaltyTransactions");

    await wipe(db.stockHistory, "stockHistory");
    await wipe(db.stocktakeItem, "stocktakeItems");
    await wipe(db.stocktake, "stocktakes");
    await wipe(db.stockTransferItem, "stockTransferItems");
    await wipe(db.stockTransfer, "stockTransfers");
    await wipe(db.locationStock, "locationStocks");

    await wipe(db.purchaseItem, "purchaseItems");
    await wipe(db.supplierPayment, "supplierPayments");
    await wipe(db.purchase, "purchases");

    await wipe(db.autoReplenishRule, "autoReplenishRules");
    await wipe(db.recurringPO, "recurringPOs");
    await wipe(db.forecastSnapshot, "forecastSnapshots");

    await wipe(db.expense, "expenses");
    await wipe(db.emailLog, "emailLogs");
    await wipe(db.backupRecord, "backupRecords");

    // 2. Top-level business entities
    await wipe(db.productSupplier, "productSuppliers");
    await wipe(db.product, "products");
    await wipe(db.supplier, "suppliers");
    await wipe(db.customer, "customers");
    await wipe(db.telephoneDirectoryEntry, "telephoneDirectoryEntries");
    await wipe(db.stockGroup, "stockGroups");

    // 3. Shifts and registers (keep Location for store layout)
    await wipe(db.cashierShift, "cashierShifts");
    // Note: Register table kept — it represents physical hardware
    // (clear currentCashierId / currentShiftId instead)
    try {
      await db.register.updateMany({
        data: { currentCashierId: null, currentShiftId: null, lastActivityAt: null },
      });
    } catch {}

    // 4. Audit logs (wipe so the only remaining entry is the wipe itself)
    await wipe(db.auditLog, "auditLogs");

    // 5. System settings (reset to defaults — SystemUser preserved)
    await wipe(db.systemSetting, "systemSettings");

    // Record this momentous event in the audit log (re-created after wipe)
    try {
      await auditLog({
        userId: user.uid,
        user: user.username,
        action: "WIPE_ALL_DATA",
        module: "admin",
        details: `Admin ${user.username} wiped all business data. Counts: ${JSON.stringify(counts)}`,
        severity: "critical",
        ipAddress: ip,
        userAgent: req.headers.get("user-agent") || "",
      });
    } catch (e: any) {
      console.warn("[wipe-data] failed to write audit log:", e?.message);
    }

    return NextResponse.json({
      success: true,
      message: "All business data wiped. User accounts preserved.",
      counts,
      preserved: ["SystemUser", "Register", "Location"],
    });
  } catch (e: any) {
    console.error("POST /api/admin/wipe-data error:", e);
    return NextResponse.json({
      error: "Failed to wipe data",
      detail: e?.message || String(e),
    }, { status: 500 });
  }
}
