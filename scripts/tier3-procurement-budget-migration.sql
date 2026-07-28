-- ============================================================
-- SYLHN POS — Tier 3 Procurement Budget Migration
-- ============================================================
-- Run this in the Neon SQL editor on the sylhn-pos project.
-- Creates the ProcurementBudget table for monthly budget tracking.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS "ProcurementBudget" (
  "id" TEXT NOT NULL,
  "month" TEXT NOT NULL,
  "supplierId" TEXT,
  "category" TEXT,
  "budgetAmount" DOUBLE PRECISION NOT NULL,
  "notes" TEXT NOT NULL DEFAULT '',
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ProcurementBudget_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ProcurementBudget_month_idx" ON "ProcurementBudget" ("month");
CREATE INDEX IF NOT EXISTS "ProcurementBudget_supplierId_idx" ON "ProcurementBudget" ("supplierId");
CREATE INDEX IF NOT EXISTS "ProcurementBudget_category_idx" ON "ProcurementBudget" ("category");
CREATE UNIQUE INDEX IF NOT EXISTS "ProcurementBudget_month_supplierId_category_key"
  ON "ProcurementBudget" ("month", "supplierId", "category");

ALTER TABLE "ProcurementBudget"
  ADD CONSTRAINT "ProcurementBudget_supplierId_fkey"
    FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProcurementBudget"
  ADD CONSTRAINT "ProcurementBudget_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "SystemUser" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

COMMIT;

-- Verify:
-- SELECT COUNT(*) FROM "ProcurementBudget";  -- should be 0
