-- ============================================================
-- SYLHN POS — Tier 1 Purchase & Supplier Upgrade Migration
-- ============================================================
-- Apply this script in the Neon SQL editor (or psql) to add all
-- Tier 1 schema changes. All new fields are nullable/defaulted so
-- existing rows are unaffected.
--
-- After running this script, regenerate the Prisma client locally:
--   npx prisma generate
--
-- Models added:
--   SupplierInvoice          (Tier 1.3 — three-way matching)
--   SupplierCreditNote       (Tier 1.4 — credit notes)
--   SupplierReturn           (Tier 1.4 — returns to supplier)
--   SupplierReturnItem       (Tier 1.4 — return line items)
--   SupplierPriceHistory     (Tier 1.14 — append-only price history)
--
-- Fields added to existing tables:
--   Supplier: rating, blacklist, blacklistReason, blacklistedAt,
--             earlyPayDiscountPct, earlyPayDays, netDays, tin,
--             bankName, bankAccountName, bankAccountNo, bankBranchCode,
--             mobileMoneyProvider, mobileMoneyNumber
--   SupplierPayment: whtRate, whtAmount, whtCertificateNo,
--                    earlyPayDiscountApplied, earlyPayDiscountPctUsed
--   Purchase: landedCostAllocationMethod
--   PurchaseItem: landedCostPerUnit, totalLandedCost
-- ============================================================

BEGIN;

-- ============================================================
-- 1. ALTER EXISTING TABLES — add new columns
-- ============================================================

-- Supplier: rating + blacklist (Tier 1.6)
ALTER TABLE "Supplier"
  ADD COLUMN IF NOT EXISTS "rating" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "blacklist" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "blacklistReason" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "blacklistedAt" TIMESTAMP(3);

-- Supplier: structured early-payment terms (Tier 1.8)
ALTER TABLE "Supplier"
  ADD COLUMN IF NOT EXISTS "earlyPayDiscountPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "earlyPayDays" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "netDays" INTEGER NOT NULL DEFAULT 30;

-- Supplier: TIN (Tier 1.10)
ALTER TABLE "Supplier"
  ADD COLUMN IF NOT EXISTS "tin" TEXT NOT NULL DEFAULT '';

-- Supplier: bank details (Tier 1.15)
ALTER TABLE "Supplier"
  ADD COLUMN IF NOT EXISTS "bankName" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "bankAccountName" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "bankAccountNo" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "bankBranchCode" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "mobileMoneyProvider" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "mobileMoneyNumber" TEXT NOT NULL DEFAULT '';

-- New indexes on Supplier
CREATE INDEX IF NOT EXISTS "Supplier_blacklist_active_idx" ON "Supplier" ("blacklist", "active");
CREATE INDEX IF NOT EXISTS "Supplier_tin_idx" ON "Supplier" ("tin");

-- SupplierPayment: WHT fields (Tier 1.10) + early-pay discount capture (Tier 1.8)
ALTER TABLE "SupplierPayment"
  ADD COLUMN IF NOT EXISTS "whtRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "whtAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "whtCertificateNo" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "earlyPayDiscountApplied" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "earlyPayDiscountPctUsed" DOUBLE PRECISION NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS "SupplierPayment_whtCertificateNo_idx" ON "SupplierPayment" ("whtCertificateNo");

-- Purchase: landed-cost allocation method (Tier 1.2)
ALTER TABLE "Purchase"
  ADD COLUMN IF NOT EXISTS "landedCostAllocationMethod" TEXT NOT NULL DEFAULT 'none';

-- PurchaseItem: per-unit landed cost allocation (Tier 1.2)
ALTER TABLE "PurchaseItem"
  ADD COLUMN IF NOT EXISTS "landedCostPerUnit" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "totalLandedCost" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- ============================================================
-- 2. NEW TABLE — SupplierInvoice (Tier 1.3)
-- ============================================================
CREATE TABLE IF NOT EXISTS "SupplierInvoice" (
  "id" TEXT NOT NULL,
  "supplierId" TEXT NOT NULL,
  "purchaseId" TEXT,
  "invoiceNo" TEXT NOT NULL,
  "invoiceDate" TIMESTAMP(3) NOT NULL,
  "invoiceTotal" DOUBLE PRECISION NOT NULL,
  "matchStatus" TEXT NOT NULL DEFAULT 'pending',
  "matchedAt" TIMESTAMP(3),
  "matchedById" TEXT,
  "varianceAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "variancePct" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "notes" TEXT NOT NULL DEFAULT '',
  "attachmentUrl" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SupplierInvoice_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SupplierInvoice_supplierId_idx" ON "SupplierInvoice" ("supplierId");
CREATE INDEX IF NOT EXISTS "SupplierInvoice_purchaseId_idx" ON "SupplierInvoice" ("purchaseId");
CREATE INDEX IF NOT EXISTS "SupplierInvoice_matchStatus_idx" ON "SupplierInvoice" ("matchStatus");
CREATE INDEX IF NOT EXISTS "SupplierInvoice_invoiceDate_idx" ON "SupplierInvoice" ("invoiceDate");
CREATE UNIQUE INDEX IF NOT EXISTS "SupplierInvoice_supplierId_invoiceNo_key" ON "SupplierInvoice" ("supplierId", "invoiceNo");

ALTER TABLE "SupplierInvoice"
  ADD CONSTRAINT "SupplierInvoice_supplierId_fkey"
    FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupplierInvoice"
  ADD CONSTRAINT "SupplierInvoice_purchaseId_fkey"
    FOREIGN KEY ("purchaseId") REFERENCES "Purchase" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SupplierInvoice"
  ADD CONSTRAINT "SupplierInvoice_matchedById_fkey"
    FOREIGN KEY ("matchedById") REFERENCES "SystemUser" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================
-- 3. NEW TABLE — SupplierCreditNote (Tier 1.4)
-- ============================================================
CREATE TABLE IF NOT EXISTS "SupplierCreditNote" (
  "id" TEXT NOT NULL,
  "supplierId" TEXT NOT NULL,
  "purchaseId" TEXT,
  "creditNoteNo" TEXT NOT NULL,
  "creditDate" TIMESTAMP(3) NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "reason" TEXT NOT NULL DEFAULT '',
  "notes" TEXT NOT NULL DEFAULT '',
  "attachmentUrl" TEXT NOT NULL DEFAULT '',
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SupplierCreditNote_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SupplierCreditNote_supplierId_idx" ON "SupplierCreditNote" ("supplierId");
CREATE INDEX IF NOT EXISTS "SupplierCreditNote_purchaseId_idx" ON "SupplierCreditNote" ("purchaseId");
CREATE INDEX IF NOT EXISTS "SupplierCreditNote_creditDate_idx" ON "SupplierCreditNote" ("creditDate");
CREATE INDEX IF NOT EXISTS "SupplierCreditNote_reason_idx" ON "SupplierCreditNote" ("reason");
CREATE UNIQUE INDEX IF NOT EXISTS "SupplierCreditNote_supplierId_creditNoteNo_key" ON "SupplierCreditNote" ("supplierId", "creditNoteNo");

ALTER TABLE "SupplierCreditNote"
  ADD CONSTRAINT "SupplierCreditNote_supplierId_fkey"
    FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupplierCreditNote"
  ADD CONSTRAINT "SupplierCreditNote_purchaseId_fkey"
    FOREIGN KEY ("purchaseId") REFERENCES "Purchase" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SupplierCreditNote"
  ADD CONSTRAINT "SupplierCreditNote_createdBy_fkey"
    FOREIGN KEY ("createdBy") REFERENCES "SystemUser" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================
-- 4. NEW TABLE — SupplierReturn (Tier 1.4)
-- ============================================================
CREATE TABLE IF NOT EXISTS "SupplierReturn" (
  "id" TEXT NOT NULL,
  "returnNo" TEXT NOT NULL,
  "supplierId" TEXT NOT NULL,
  "purchaseId" TEXT,
  "returnType" TEXT NOT NULL DEFAULT 'damaged',
  "status" TEXT NOT NULL DEFAULT 'pending',
  "notes" TEXT NOT NULL DEFAULT '',
  "totalValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "shippedAt" TIMESTAMP(3),
  "receivedAt" TIMESTAMP(3),
  "creditNoteId" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SupplierReturn_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "SupplierReturn_returnNo_key" ON "SupplierReturn" ("returnNo");

CREATE INDEX IF NOT EXISTS "SupplierReturn_supplierId_idx" ON "SupplierReturn" ("supplierId");
CREATE INDEX IF NOT EXISTS "SupplierReturn_purchaseId_idx" ON "SupplierReturn" ("purchaseId");
CREATE INDEX IF NOT EXISTS "SupplierReturn_status_idx" ON "SupplierReturn" ("status");
CREATE INDEX IF NOT EXISTS "SupplierReturn_returnType_idx" ON "SupplierReturn" ("returnType");

ALTER TABLE "SupplierReturn"
  ADD CONSTRAINT "SupplierReturn_supplierId_fkey"
    FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupplierReturn"
  ADD CONSTRAINT "SupplierReturn_purchaseId_fkey"
    FOREIGN KEY ("purchaseId") REFERENCES "Purchase" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SupplierReturn"
  ADD CONSTRAINT "SupplierReturn_creditNoteId_fkey"
    FOREIGN KEY ("creditNoteId") REFERENCES "SupplierCreditNote" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SupplierReturn"
  ADD CONSTRAINT "SupplierReturn_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "SystemUser" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================
-- 5. NEW TABLE — SupplierReturnItem (Tier 1.4)
-- ============================================================
CREATE TABLE IF NOT EXISTS "SupplierReturnItem" (
  "id" TEXT NOT NULL,
  "supplierReturnId" TEXT NOT NULL,
  "productId" TEXT,
  "partNo" TEXT NOT NULL DEFAULT '',
  "details" TEXT NOT NULL DEFAULT '',
  "quantity" INTEGER NOT NULL,
  "cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "reason" TEXT NOT NULL DEFAULT '',

  CONSTRAINT "SupplierReturnItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SupplierReturnItem_supplierReturnId_idx" ON "SupplierReturnItem" ("supplierReturnId");
CREATE INDEX IF NOT EXISTS "SupplierReturnItem_productId_idx" ON "SupplierReturnItem" ("productId");

ALTER TABLE "SupplierReturnItem"
  ADD CONSTRAINT "SupplierReturnItem_supplierReturnId_fkey"
    FOREIGN KEY ("supplierReturnId") REFERENCES "SupplierReturn" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupplierReturnItem"
  ADD CONSTRAINT "SupplierReturnItem_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================
-- 6. NEW TABLE — SupplierPriceHistory (Tier 1.14)
-- ============================================================
CREATE TABLE IF NOT EXISTS "SupplierPriceHistory" (
  "id" TEXT NOT NULL,
  "supplierId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "unitCost" DOUBLE PRECISION NOT NULL,
  "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "changedById" TEXT,
  "previousCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "notes" TEXT NOT NULL DEFAULT '',

  CONSTRAINT "SupplierPriceHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SupplierPriceHistory_supplierId_productId_changedAt_idx"
  ON "SupplierPriceHistory" ("supplierId", "productId", "changedAt");
CREATE INDEX IF NOT EXISTS "SupplierPriceHistory_productId_idx" ON "SupplierPriceHistory" ("productId");

ALTER TABLE "SupplierPriceHistory"
  ADD CONSTRAINT "SupplierPriceHistory_supplierId_fkey"
    FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupplierPriceHistory"
  ADD CONSTRAINT "SupplierPriceHistory_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupplierPriceHistory"
  ADD CONSTRAINT "SupplierPriceHistory_changedById_fkey"
    FOREIGN KEY ("changedById") REFERENCES "SystemUser" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

COMMIT;

-- ============================================================
-- END OF MIGRATION
-- ============================================================
-- Verification queries (run after COMMIT):
--   SELECT COUNT(*) FROM "SupplierInvoice";        -- should be 0
--   SELECT COUNT(*) FROM "SupplierCreditNote";     -- should be 0
--   SELECT COUNT(*) FROM "SupplierReturn";         -- should be 0
--   SELECT COUNT(*) FROM "SupplierPriceHistory";   -- should be 0
--   SELECT "rating", "blacklist", "tin", "earlyPayDiscountPct"
--     FROM "Supplier" LIMIT 1;                     -- columns should exist
--   SELECT "whtRate", "whtAmount", "earlyPayDiscountApplied"
--     FROM "SupplierPayment" LIMIT 1;              -- columns should exist
--   SELECT "landedCostAllocationMethod" FROM "Purchase" LIMIT 1;
--   SELECT "landedCostPerUnit", "totalLandedCost" FROM "PurchaseItem" LIMIT 1;
