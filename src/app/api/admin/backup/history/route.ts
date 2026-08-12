import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

// GET /api/admin/backup/history — list all backup records
export async function GET(req: NextRequest) {
  try { await requireAuth(); } catch (e: any) { return e as Response; }

  try {
    const backups = await db.backupRecord.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    const formatted = backups.map(b => ({
      id: b.id,
      filename: b.filename,
      sizeBytes: b.sizeBytes,
      sizeFormatted: b.sizeBytes < 1024 ? `${b.sizeBytes} B` : b.sizeBytes < 1024 * 1024 ? `${(b.sizeBytes / 1024).toFixed(1)} KB` : `${(b.sizeBytes / 1024 / 1024).toFixed(2)} MB`,
      type: b.type,
      status: b.status,
      notes: b.notes,
      createdAt: b.createdAt.toISOString(),
    }));

    const totalSize = backups.reduce((s, b) => s + b.sizeBytes, 0);
    const autoCount = backups.filter(b => b.type === "auto").length;
    const manualCount = backups.filter(b => b.type === "manual").length;

    return NextResponse.json({
      backups: formatted,
      stats: {
        total: backups.length,
        auto: autoCount,
        manual: manualCount,
        totalSizeBytes: totalSize,
        totalSizeFormatted: totalSize < 1024 * 1024 ? `${(totalSize / 1024).toFixed(1)} KB` : `${(totalSize / 1024 / 1024).toFixed(2)} MB`,
      },
    });
  } catch (e: any) {
    console.error("GET /api/admin/backup/history error:", e);
    return NextResponse.json({ error: "Failed to fetch backup history" }, { status: 500 });
  }
}
