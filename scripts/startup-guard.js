#!/usr/bin/env node
/**
 * SYLHN POS — Startup Guard
 *
 * Lightweight check that runs when the dev server starts. Verifies that all
 * critical files exist. If any are missing, prints a warning with instructions
 * to restore from backup.
 *
 * This script is designed to be fast (< 100ms) so it can run on every startup.
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ROOT = "/home/z/my-project";
const MANIFEST_PATH = path.join(ROOT, "backups", "manifest.json");

// ===== Critical files that MUST exist for the app to function =====
const CRITICAL_FILES = [
  // Core app
  "src/app/page.tsx",
  "src/app/layout.tsx",
  "src/app/globals.css",
  // Security
  "src/proxy.ts",
  "src/lib/auth.ts",
  "src/lib/security.ts",
  "src/lib/rate-limit.ts",
  "src/lib/validation.ts",
  "src/lib/secure-fetch.ts",
  // Data layer
  "src/lib/db.ts",
  "src/lib/pos-data.ts",
  "src/lib/pos-types.ts",
  "src/lib/report-utils.ts",
  "src/lib/utils.ts",
  "src/lib/email.ts",
  "src/lib/file-protection.ts",
  "src/lib/sync.ts",
  "src/lib/purchase-store.ts",
  "src/lib/purchase-orders-store.ts",
  // Components (key ones)
  "src/components/operations-dashboard.tsx",
  "src/components/popup-window.tsx",
  "src/components/admin-panel.tsx",
  "src/components/stock-management.tsx",
  "src/components/purchase-form.tsx",
  "src/components/supplier-form.tsx",
  "src/components/purchase-menu.tsx",
  "src/components/sales-menu.tsx",
  "src/components/sales-reports.tsx",
  "src/components/sold-items-report.tsx",
  "src/components/accounts-reports.tsx",
  "src/components/financial-operations.tsx",
  "src/components/maintenance-module.tsx",
  "src/components/telephone-module.tsx",
  "src/components/telephone-directory.tsx",
  "src/components/add-telephone-form.tsx",
  "src/components/reports.tsx",
  "src/components/purchase-list-popup.tsx",
  "src/components/purchase-order-list-popup.tsx",
  "src/components/purchase-module.tsx",
  "src/components/stock-quantity-adjustment.tsx",
  "src/components/stock-adjustment-form.tsx",
  "src/components/quick-stock-adjustment.tsx",
  // Hooks
  "src/hooks/use-toast.ts",
  "src/hooks/use-mobile.ts",
  "src/hooks/use-products.ts",
  "src/hooks/use-session.ts",
  "src/hooks/use-purchases.ts",
  "src/hooks/use-purchase-orders.ts",
  // API routes
  "src/app/api/route.ts",
  "src/app/api/health/route.ts",
  "src/app/api/seed/route.ts",
  "src/app/api/auth/login/route.ts",
  "src/app/api/auth/logout/route.ts",
  "src/app/api/auth/me/route.ts",
  "src/app/api/auth/csrf/route.ts",
  "src/app/api/products/route.ts",
  "src/app/api/products/[id]/route.ts",
  "src/app/api/sales/route.ts",
  "src/app/api/sales/[id]/route.ts",
  "src/app/api/purchases/route.ts",
  "src/app/api/suppliers/route.ts",
  "src/app/api/stock-groups/route.ts",
  "src/app/api/users/route.ts",
  "src/app/api/email/route.ts",
  "src/app/api/customers/route.ts",
  "src/app/api/telephone-directory/route.ts",
  "src/app/api/stocktakes/route.ts",
  "src/app/api/shifts/route.ts",
  "src/app/api/supplier-payments/route.ts",
  "src/app/api/audit-logs/route.ts",
  // Prisma
  "prisma/schema.prisma",
  // PWA
  "public/manifest.json",
  "public/sw.js",
  "public/icon-192.png",
  "public/icon-512.png",
  // Config
  "package.json",
  "tsconfig.json",
  "tailwind.config.ts",
  "postcss.config.mjs",
  "next.config.ts",
  "components.json",
];

console.log("┌─────────────────────────────────────────────────┐");
console.log("│  SYLHN POS — Startup Guard                     │");
console.log("│  Checking " + CRITICAL_FILES.length + " critical files...                     │");
console.log("└─────────────────────────────────────────────────┘");

let missing = [];
let ok = 0;

for (const rel of CRITICAL_FILES) {
  const fullPath = path.join(ROOT, rel);
  if (fs.existsSync(fullPath)) {
    ok++;
  } else {
    missing.push(rel);
  }
}

if (missing.length === 0) {
  console.log("✅ All " + ok + " critical files present — app is intact.\n");
} else {
  console.log("⚠ WARNING: " + missing.length + " file(s) MISSING!");
  missing.forEach((f) => console.log("  ✗ " + f));
  console.log("");

  if (fs.existsSync(MANIFEST_PATH)) {
    console.log("💡 To restore missing files, run:");
    console.log("   node scripts/protection-snapshot.js --restore\n");
  } else {
    console.log("💡 No backup manifest found. Create one with:");
    console.log("   node scripts/protection-snapshot.js\n");
  }
}

// Also check if the manifest exists and is recent
if (fs.existsSync(MANIFEST_PATH)) {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf-8"));
  const age = Date.now() - new Date(manifest.createdAt).getTime();
  const daysOld = Math.floor(age / (1000 * 60 * 60 * 24));
  if (daysOld > 7) {
    console.log("ℹ Backup manifest is " + daysOld + " days old. Consider creating a fresh snapshot:");
    console.log("   node scripts/protection-snapshot.js\n");
  }
}

process.exit(0);
