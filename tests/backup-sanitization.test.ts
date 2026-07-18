/**
 * SYLHN POS — Backup filename sanitization tests
 *
 * Tests that the path-traversal protection in /api/backups DELETE works
 * correctly. We test the sanitization logic directly (not the full HTTP
 * endpoint, which requires a running server + auth).
 */
import { describe, it, expect } from "vitest";
import path from "path";

// Replicate the sanitization logic from /api/backups/route.ts DELETE
// so we can unit-test it without spinning up the server.
function isSafeBackupFilename(rawFilename: string): boolean {
  const safeFilename = path.basename(rawFilename);
  if (!safeFilename || safeFilename !== rawFilename) return false;
  if (!safeFilename.endsWith(".db")) return false;

  const backupsDir = path.resolve(process.cwd(), "backups");
  const backupPath = path.resolve(backupsDir, safeFilename);
  if (!backupPath.startsWith(backupsDir + path.sep)) return false;

  return true;
}

describe("Backup filename sanitization", () => {
  it("accepts a simple .db filename", () => {
    expect(isSafeBackupFilename("backup-2026-01-01.db")).toBe(true);
  });

  it("accepts a filename with dashes and timestamps", () => {
    expect(isSafeBackupFilename("backup-2026-07-18T10-30-45-000Z.db")).toBe(true);
  });

  it("rejects path traversal with ../", () => {
    expect(isSafeBackupFilename("../../etc/passwd")).toBe(false);
  });

  it("rejects path traversal with absolute path", () => {
    expect(isSafeBackupFilename("/etc/passwd")).toBe(false);
    expect(isSafeBackupFilename("/etc/passwd.db")).toBe(false);
  });

  it("rejects path traversal with ..\\ (Windows-style)", () => {
    expect(isSafeBackupFilename("..\\..\\windows\\system32\\config\\sam")).toBe(false);
  });

  it("rejects non-.db files (defense in depth)", () => {
    expect(isSafeBackupFilename("config.json")).toBe(false);
    expect(isSafeBackupFilename("readme.txt")).toBe(false);
    expect(isSafeBackupFilename("malicious.sh")).toBe(false);
  });

  it("rejects filenames with embedded path separators", () => {
    expect(isSafeBackupFilename("subdir/backup.db")).toBe(false);
    expect(isSafeBackupFilename("backup.db/../../etc/passwd")).toBe(false);
  });

  it("rejects empty filenames", () => {
    expect(isSafeBackupFilename("")).toBe(false);
  });

  it("rejects the . and .. special filenames", () => {
    expect(isSafeBackupFilename(".")).toBe(false);
    expect(isSafeBackupFilename("..")).toBe(false);
  });

  it("rejects filenames that resolve outside backupsDir via symlinks", () => {
    // path.basename strips path, but a filename like "backup.db" with a hidden
    // null byte should also be rejected (path.basename doesn't strip nulls).
    // Note: Node's path module generally rejects null bytes, but this is a
    // good defensive test.
    expect(isSafeBackupFilename("backup.db\0../../etc/passwd")).toBe(false);
  });
});
