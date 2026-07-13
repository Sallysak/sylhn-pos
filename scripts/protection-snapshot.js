#!/usr/bin/env node
/**
 * SYLHN POS — Protection Guard
 *
 * Creates a comprehensive backup snapshot of all source files AND generates
 * a file integrity manifest (SHA-256 checksums). Run this after every
 * significant change to create a restore point.
 *
 * Usage:
 *   node scripts/protection-snapshot.js          # Create snapshot
 *   node scripts/protection-snapshot.js --verify  # Verify against latest snapshot
 *   node scripts/protection-snapshot.js --restore # Restore missing/modified files
 *
 * Snapshots are stored in: backups/snapshot-YYYY-MM-DD-HHMMSS/
 * Manifest is stored in:   backups/manifest.json (latest)
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { execSync } = require("child_process");

const ROOT = "/home/z/my-project";
const BACKUP_DIR = path.join(ROOT, "backups");
const MANIFEST_PATH = path.join(BACKUP_DIR, "manifest.json");

// ===== Critical files & directories to protect =====
const PROTECT_PATTERNS = [
  "src/app/**/*.tsx",
  "src/app/**/*.ts",
  "src/components/**/*.tsx",
  "src/components/**/*.ts",
  "src/lib/**/*.ts",
  "src/hooks/**/*.ts",
  "src/proxy.ts",
  "prisma/schema.prisma",
  "public/manifest.json",
  "public/sw.js",
  "public/icon-192.png",
  "public/icon-512.png",
  "public/icon-maskable-512.png",
  "public/logo.svg",
  "public/robots.txt",
  "package.json",
  "tsconfig.json",
  "tailwind.config.ts",
  "postcss.config.mjs",
  "next.config.ts",
  "components.json",
  ".env",
];

// Files/directories to always exclude
const EXCLUDE = [
  "node_modules",
  ".next",
  "backups",
  "tool-results",
  "upload",
  "download",
  "scripts",
  "dev.log",
  "bun.lock",
  "package-lock.json",
];

function shouldExclude(relPath) {
  return EXCLUDE.some((e) => relPath.startsWith(e + "/") || relPath === e);
}

function glob(pattern) {
  try {
    const result = execSync(`find "${ROOT}" -path "${pattern}" -type f 2>/dev/null`, { encoding: "utf-8" });
    return result.trim().split("\n").filter(Boolean).map((p) => path.relative(ROOT, p));
  } catch {
    return [];
  }
}

function getAllFiles() {
  const allFiles = new Set();
  for (const pattern of PROTECT_PATTERNS) {
    // Convert glob to find pattern
    const findPattern = pattern.replace(/\*\*/g, "*").replace(/\*/g, "*");
    const fullPattern = path.join(ROOT, findPattern);
    try {
      const result = execSync(`find "${ROOT}/src" "${ROOT}/prisma" "${ROOT}/public" -type f 2>/dev/null`, { encoding: "utf-8" });
      result.trim().split("\n").filter(Boolean).forEach((p) => {
        const rel = path.relative(ROOT, p);
        if (!shouldExclude(rel)) allFiles.add(rel);
      });
    } catch {}
  }
  // Also add specific root files
  for (const f of ["package.json", "tsconfig.json", "tailwind.config.ts", "postcss.config.mjs", "next.config.ts", "components.json", ".env", "prisma/schema.prisma"]) {
    if (fs.existsSync(path.join(ROOT, f))) allFiles.add(f);
  }
  return Array.from(allFiles).sort();
}

function sha256(filePath) {
  const content = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(content).digest("hex");
}

function createSnapshot() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").split("T");
  const snapshotDir = path.join(BACKUP_DIR, `snapshot-${timestamp[0]}-${timestamp[1].substring(0, 6)}`);

  if (!fs.existsSync(snapshotDir)) {
    fs.mkdirSync(snapshotDir, { recursive: true });
  }

  const files = getAllFiles();
  const manifest = {
    createdAt: new Date().toISOString(),
    snapshotDir: path.basename(snapshotDir),
    fileCount: files.length,
    files: {},
  };

  let copied = 0;
  for (const rel of files) {
    const src = path.join(ROOT, rel);
    const dest = path.join(snapshotDir, rel);
    try {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(src, dest);
      manifest.files[rel] = {
        sha256: sha256(src),
        size: fs.statSync(src).size,
      };
      copied++;
    } catch (e) {
      console.warn(`  ⚠ Could not copy ${rel}: ${e.message}`);
    }
  }

  // Save manifest
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
  // Also save a copy in the snapshot dir
  fs.writeFileSync(path.join(snapshotDir, "manifest.json"), JSON.stringify(manifest, null, 2));

  console.log(`✓ Snapshot created: ${snapshotDir}`);
  console.log(`  Files: ${copied}`);
  console.log(`  Manifest: ${MANIFEST_PATH}`);
  return manifest;
}

function verifyIntegrity() {
  if (!fs.existsSync(MANIFEST_PATH)) {
    console.error("✗ No manifest found. Run with no args to create a snapshot first.");
    process.exit(1);
  }

  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf-8"));
  console.log(`Verifying against snapshot from ${manifest.createdAt} (${manifest.fileCount} files)\n`);

  const missing = [];
  const modified = [];
  let ok = 0;

  for (const [rel, info] of Object.entries(manifest.files)) {
    const fullPath = path.join(ROOT, rel);
    if (!fs.existsSync(fullPath)) {
      missing.push(rel);
    } else {
      const currentHash = sha256(fullPath);
      if (currentHash !== info.sha256) {
        modified.push(rel);
      } else {
        ok++;
      }
    }
  }

  console.log(`✓ OK: ${ok} files`);
  if (missing.length > 0) {
    console.log(`\n✗ MISSING (${missing.length}):`);
    missing.forEach((f) => console.log(`  - ${f}`));
  }
  if (modified.length > 0) {
    console.log(`\n⚠ MODIFIED (${modified.length}):`);
    modified.forEach((f) => console.log(`  - ${f}`));
  }

  if (missing.length === 0 && modified.length === 0) {
    console.log("\n✅ All files intact — no changes detected.");
    process.exit(0);
  } else {
    console.log(`\n⚠ ${missing.length} missing, ${modified.length} modified. Run with --restore to fix.`);
    process.exit(1);
  }
}

function restoreFromBackup() {
  if (!fs.existsSync(MANIFEST_PATH)) {
    console.error("✗ No manifest found. Cannot restore.");
    process.exit(1);
  }

  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf-8"));
  const snapshotDir = path.join(BACKUP_DIR, manifest.snapshotDir);
  console.log(`Restoring from snapshot: ${snapshotDir}\n`);

  let restored = 0;
  let skipped = 0;

  for (const [rel, info] of Object.entries(manifest.files)) {
    const fullPath = path.join(ROOT, rel);
    const backupPath = path.join(snapshotDir, rel);

    let needsRestore = false;
    if (!fs.existsSync(fullPath)) {
      needsRestore = true;
      console.log(`  + RESTORE (missing): ${rel}`);
    } else {
      const currentHash = sha256(fullPath);
      if (currentHash !== info.sha256) {
        needsRestore = true;
        console.log(`  ~ RESTORE (modified): ${rel}`);
      }
    }

    if (needsRestore) {
      try {
        fs.mkdirSync(path.dirname(fullPath), { recursive: true });
        fs.copyFileSync(backupPath, fullPath);
        restored++;
      } catch (e) {
        console.error(`  ✗ FAILED: ${rel}: ${e.message}`);
      }
    } else {
      skipped++;
    }
  }

  console.log(`\n✅ Restored ${restored} file(s), ${skipped} unchanged.`);
  if (restored > 0) {
    console.log("\n⚠ Important: Restart the dev server after restore to pick up changes.");
  }
}

// ===== Main =====
const cmd = process.argv[2];
if (cmd === "--verify") {
  verifyIntegrity();
} else if (cmd === "--restore") {
  restoreFromBackup();
} else {
  createSnapshot();
}
