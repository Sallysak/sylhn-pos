-- SYLHN POS — Product Images Migration
-- Run in Neon SQL editor on the sylhn-pos project

ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "imageUrl" TEXT NOT NULL DEFAULT '';

-- Verify:
-- SELECT "imageUrl" FROM "Product" LIMIT 1;
