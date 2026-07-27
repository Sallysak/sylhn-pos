-- ============================================================================
-- SYLHN POS — Performance Index Migration
-- ============================================================================
-- Run this in the Neon SQL Editor to add missing database indexes.
-- These indexes speed up queries on Phase 2 fields + common lookups.
-- All use CREATE INDEX IF NOT EXISTS — safe to run multiple times.
-- ============================================================================

-- Purchase: speed up filtering by currency, approval status, cancellation
CREATE INDEX IF NOT EXISTS "Purchase_currency_idx" ON "Purchase"("currency");
CREATE INDEX IF NOT EXISTS "Purchase_approvedById_idx" ON "Purchase"("approvedById");
CREATE INDEX IF NOT EXISTS "Purchase_cancelledAt_idx" ON "Purchase"("cancelledAt");

-- PurchaseItem: speed up batch + expiry queries (FEFO, expiry alerts)
CREATE INDEX IF NOT EXISTS "PurchaseItem_batchNumber_idx" ON "PurchaseItem"("batchNumber");
CREATE INDEX IF NOT EXISTS "PurchaseItem_expiryDate_idx" ON "PurchaseItem"("expiryDate");

-- Product: speed up barcode scanning + category filtering
CREATE INDEX IF NOT EXISTS "Product_barcode_idx" ON "Product"("barcode");
CREATE INDEX IF NOT EXISTS "Product_category_idx" ON "Product"("category");
CREATE INDEX IF NOT EXISTS "Product_active_idx" ON "Product"("active");

-- Sale: speed up cashier performance reports
CREATE INDEX IF NOT EXISTS "Sale_cashierId_idx" ON "Sale"("cashierId");

-- SupplierPayment: speed up payment history queries
CREATE INDEX IF NOT EXISTS "SupplierPayment_paymentDate_idx" ON "SupplierPayment"("paymentDate");

-- Done! ✅
