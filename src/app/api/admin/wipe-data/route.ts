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
  } catch (e: any) { return e as Response; }

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

    // Helper to count (we count outside the tx — counting inside is fine but
    // we want the pre-wipe numbers, not the post-wipe zeros).
    const countOnly = async (model: any, name: string) => {
      try {
        counts[name] = await model.count();
      } catch (e: any) {
        console.warn(`[wipe-data] failed to count ${name}:`, e?.message);
        counts[name] = -1;
      }
    };

    // Count everything FIRST (so we have accurate pre-wipe numbers even if
    // the transaction rolls back).
    await countOnly(db.salePayment, "salePayments");
    await countOnly(db.saleItem, "saleItems");
    await countOnly(db.sale, "sales");
    await countOnly(db.heldOrder, "heldOrders");
    await countOnly(db.loyaltyTransaction, "loyaltyTransactions");
    await countOnly(db.stockHistory, "stockHistory");
    await countOnly(db.stocktakeItem, "stocktakeItems");
    await countOnly(db.stocktake, "stocktakes");
    await countOnly(db.stockTransferItem, "stockTransferItems");
    await countOnly(db.stockTransfer, "stockTransfers");
    await countOnly(db.locationStock, "locationStocks");
    await countOnly(db.purchaseItem, "purchaseItems");
    await countOnly(db.supplierPayment, "supplierPayments");
    await countOnly(db.purchase, "purchases");
    await countOnly(db.autoReplenishRule, "autoReplenishRules");
    await countOnly(db.recurringPO, "recurringPOs");
    await countOnly(db.forecastSnapshot, "forecastSnapshots");
    await countOnly(db.expense, "expenses");
    await countOnly(db.emailLog, "emailLogs");
    await countOnly(db.backupRecord, "backupRecords");
    await countOnly(db.productSupplier, "productSuppliers");
    await countOnly(db.product, "products");
    await countOnly(db.supplier, "suppliers");
    await countOnly(db.customer, "customers");
    await countOnly(db.telephoneDirectoryEntry, "telephoneDirectoryEntries");
    await countOnly(db.stockGroup, "stockGroups");
    await countOnly(db.cashierShift, "cashierShifts");
    await countOnly(db.auditLog, "auditLogs");
    await countOnly(db.systemSetting, "systemSettings");

    // Wrap all deletes in a SINGLE transaction so partial failure can't
    // leave the DB in a half-wiped corrupt state. Previously each deleteMany
    // was its own implicit transaction — a crash after step 15 of 28 would
    // leave sales gone but products still present with broken references.
    await db.$transaction([
      db.salePayment.deleteMany({}),
      db.saleItem.deleteMany({}),
      db.sale.deleteMany({}),
      db.heldOrder.deleteMany({}),
      db.loyaltyTransaction.deleteMany({}),
      db.stockHistory.deleteMany({}),
      db.stocktakeItem.deleteMany({}),
      db.stocktake.deleteMany({}),
      db.stockTransferItem.deleteMany({}),
      db.stockTransfer.deleteMany({}),
      db.locationStock.deleteMany({}),
      db.purchaseItem.deleteMany({}),
      db.supplierPayment.deleteMany({}),
      db.purchase.deleteMany({}),
      db.autoReplenishRule.deleteMany({}),
      db.recurringPO.deleteMany({}),
      db.forecastSnapshot.deleteMany({}),
      db.expense.deleteMany({}),
      db.emailLog.deleteMany({}),
      db.backupRecord.deleteMany({}),
      db.productSupplier.deleteMany({}),
      db.product.deleteMany({}),
      db.supplier.deleteMany({}),
      db.customer.deleteMany({}),
      db.telephoneDirectoryEntry.deleteMany({}),
      db.stockGroup.deleteMany({}),
      db.cashierShift.deleteMany({}),
      db.auditLog.deleteMany({}),
      db.systemSetting.deleteMany({}),
    ]);

    // Reset register state (preserve the rows themselves — they represent
    // physical hardware — but clear the cashier/shift references).
    try {
      await db.register.updateMany({
        data: { currentCashierId: null, currentShiftId: null, lastActivityAt: null },
      });
    } catch {}

    // Re-seed default system settings (so the app doesn't break after wipe)
    try {
      const settings = [
        { key: "companyName", value: "SYLHN COMPANY LTD" },
        { key: "taxRate", value: "0.15" },
        { key: "taxName", value: "VAT" },
        { key: "currency", value: "GHC" },
        { key: "loyalty.pointsPerCedi", value: "1" },
        { key: "loyalty.redeemRate", value: "0.05" },
        { key: "loyalty.minRedeem", value: "100" },
      ];
      for (const s of settings) {
        await db.systemSetting.upsert({ where: { key: s.key }, update: {}, create: s });
      }
    } catch (e: any) {
      console.warn("[wipe-data] failed to re-seed system settings:", e?.message);
    }

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
      message: "All business data wiped in a single transaction. User accounts, registers, and locations preserved. Default system settings re-seeded.",
      counts,
      preserved: ["SystemUser", "Register", "Location"],
      reseeded: ["SystemSetting"],
    });
  } catch (e: any) {
    console.error("POST /api/admin/wipe-data error:", e);
    return NextResponse.json({
      error: "Failed to wipe data — transaction rolled back, DB is unchanged",
      detail: e?.message || String(e),
    }, { status: 500 });
  }
}
