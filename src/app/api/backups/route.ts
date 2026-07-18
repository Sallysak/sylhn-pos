import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requirePermission } from "@/lib/auth";
import { rateLimitApiWrite, rateLimitApiRead, rateLimitResponse, getClientIp } from "@/lib/rate-limit";
import { auditLog } from "@/lib/audit";
import { promises as fs } from "fs";
import path from "path";

// GET /api/backups — list all backups
export async function GET(req: NextRequest) {
  try { await requireAuth(); } catch (e) { return e as Response; }
  const ip = getClientIp(req);
  const rl = rateLimitApiRead(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  try {
    const backupsDir = path.join(process.cwd(), "backups");
    let files: any[] = [];
    try {
      const entries = await fs.readdir(backupsDir);
      for (const file of entries) {
        if (file.endsWith(".db")) {
          const stat = await fs.stat(path.join(backupsDir, file));
          files.push({ filename: file, sizeBytes: stat.size, createdAt: stat.mtime.toISOString() });
        }
      }
    } catch {}
    files.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    const dbRecords = await db.backupRecord.findMany({ orderBy: { createdAt: "desc" }, take: 50 });
    return NextResponse.json({ backups: files, dbRecords, total: files.length });
  } catch (e) {
    return NextResponse.json({ error: "Failed to list backups" }, { status: 500 });
  }
}

// POST /api/backups — create a manual backup
export async function POST(req: NextRequest) {
  let user;
  try { user = await requireAuth(); requirePermission(user.role, "maintenance"); } catch (e) { return e as Response; }
  const ip = getClientIp(req);
  const rl = rateLimitApiWrite(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  try {
    const dbPath = process.env.DATABASE_URL?.replace("file:", "") || "./db/custom.db";
    const backupsDir = path.join(process.cwd(), "backups");
    await fs.mkdir(backupsDir, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupFile = `backup-${timestamp}.db`;
    const backupPath = path.join(backupsDir, backupFile);

    // Copy the DB file
    await fs.copyFile(dbPath, backupPath);
    const stat = await fs.stat(backupPath);

    const record = await db.backupRecord.create({
      data: { type: "manual", filename: backupFile, sizeBytes: stat.size, status: "completed", createdById: user.uid },
    });

    await auditLog({ userId: user.uid, user: user.username, action: "BACKUP", module: "maintenance", details: `Manual backup created: ${backupFile} (${(stat.size / 1024).toFixed(1)} KB)`, severity: "warning", ipAddress: ip });

    return NextResponse.json({ success: true, backup: record });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Backup failed" }, { status: 500 });
  }
}

// DELETE /api/backups?filename=xxx — delete a backup
export async function DELETE(req: NextRequest) {
  let user;
  try { user = await requireAuth(); requirePermission(user.role, "maintenance"); } catch (e) { return e as Response; }
  const { searchParams } = new URL(req.url);
  const filename = searchParams.get("filename");
  if (!filename) return NextResponse.json({ error: "filename required" }, { status: 400 });

  try {
    const backupPath = path.join(process.cwd(), "backups", filename);
    await fs.unlink(backupPath).catch(() => {});
    await auditLog({ userId: user.uid, user: user.username, action: "DELETE", module: "maintenance", details: `Backup deleted: ${filename}`, severity: "warning", ipAddress: getClientIp(req) });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}
