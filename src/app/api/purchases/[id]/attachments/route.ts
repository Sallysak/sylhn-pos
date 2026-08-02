import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requirePermission } from "@/lib/auth";
import { rateLimitApiRead, rateLimitApiWrite, rateLimitResponse, getClientIp } from "@/lib/rate-limit";
import { auditLog } from "@/lib/audit";
import { writeFile, mkdir, readdir, stat, unlink } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";

// ============================================================================
// GET /api/purchases/[id]/attachments — list attachments for a purchase
// ============================================================================
// Files are stored on disk under uploads/purchase-attachments/{purchaseId}/.
// Metadata is reconstructed from the filesystem (filename pattern:
// `{uuid}__{originalName}__{category}.{ext}`). No DB table needed — keeps
// this Phase-1 change schema-free.
// ============================================================================
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { await requireAuth(); } catch (e) { return e as Response; }
  const ip = getClientIp(req);
  const rl = rateLimitApiRead(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  const { id } = await params;
  const dir = join(process.cwd(), "uploads", "purchase-attachments", id);

  try {
    const files = await readdir(dir);
    const attachments = await Promise.all(
      files.map(async (filename) => {
        const filePath = join(dir, filename);
        const stats = await stat(filePath);
        // Parse filename: `{uuid}__{originalName}__{category}.{ext}`
        const match = filename.match(/^(.+?)__(.+?)__(.+?)\.([^.]+)$/);
        const originalName = match ? match[2] : filename;
        const category = match ? match[3] : "other";
        const ext = match ? match[4] : "";
        const mimeType = getMimeType(ext);
        return {
          id: match ? match[1] : filename,
          filename,
          originalName,
          mimeType,
          size: stats.size,
          category,
          uploadedAt: stats.mtime.toISOString(),
          url: `/api/purchases/${id}/attachments?file=${encodeURIComponent(filename)}`,
        };
      })
    );
    return NextResponse.json({ attachments });
  } catch (e: any) {
    // Directory doesn't exist yet — no attachments
    if (e?.code === "ENOENT") return NextResponse.json({ attachments: [] });
    return NextResponse.json({ error: "Failed to list attachments" }, { status: 500 });
  }
}

// ============================================================================
// POST /api/purchases/[id]/attachments — upload an attachment
// ============================================================================
// Multipart form data:
//   file: File (PDF/JPG/PNG/WEBP/DOC/DOCX, max 10 MB)
//   category: string ("invoice" | "delivery_note" | "customs" | "other")
// ============================================================================
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let user;
  try { user = await requireAuth(); requirePermission(user.role, "purchase"); } catch (e) { return e as Response; }
  const ip = getClientIp(req);
  const rl = rateLimitApiWrite(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  const { id } = await params;

  // Verify the purchase exists (allow lookup by id or refNo)
  let purchase = await db.purchase.findUnique({ where: { id }, select: { id: true, refNo: true } });
  if (!purchase) {
    purchase = await db.purchase.findUnique({ where: { refNo: id }, select: { id: true, refNo: true } });
  }
  if (!purchase) return NextResponse.json({ error: "Purchase not found" }, { status: 404 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const category = String(formData.get("category") || "invoice");

  if (!file) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }

  // Validate size (10 MB max)
  const MAX_SIZE = 10 * 1024 * 1024;
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "File too large", detail: "Max 10 MB" }, { status: 400 });
  }

  // Validate type
  const allowed = [
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ];
  if (!allowed.includes(file.type)) {
    return NextResponse.json(
      { error: "Unsupported file type", detail: `Allowed: PDF, JPG, PNG, WEBP, DOC, DOCX` },
      { status: 400 }
    );
  }

  // Save file to disk
  const uploadDir = join(process.cwd(), "uploads", "purchase-attachments", purchase.id);
  await mkdir(uploadDir, { recursive: true });

  const uuid = randomUUID();
  const ext = file.name.split(".").pop() || "bin";
  const safeOriginalName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const filename = `${uuid}__${safeOriginalName}__${category}.${ext}`;
  const storagePath = join(uploadDir, filename);

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(storagePath, buffer);

  await auditLog({
    userId: user.uid,
    user: user.username,
    action: "ATTACHMENT_UPLOAD",
    module: "purchase",
    details: `Uploaded ${file.name} (${file.size} bytes, ${category}) to PO ${purchase.refNo}`,
    severity: "info",
    ipAddress: ip,
    userAgent: req.headers.get("user-agent") || "",
  }).catch(() => {});

  return NextResponse.json({
    success: true,
    attachment: {
      id: uuid,
      filename,
      originalName: file.name,
      mimeType: file.type,
      size: file.size,
      category,
      uploadedAt: new Date().toISOString(),
    },
  }, { status: 201 });
}

// ============================================================================
// DELETE /api/purchases/[id]/attachments?file=filename — delete an attachment
// ============================================================================
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let user;
  try { user = await requireAuth(); requirePermission(user.role, "purchase"); } catch (e) { return e as Response; }
  const ip = getClientIp(req);
  const rl = rateLimitApiWrite(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const filename = searchParams.get("file");
  if (!filename) {
    return NextResponse.json({ error: "file parameter required" }, { status: 400 });
  }

  // Sanitize filename — only allow our naming pattern
  if (!/^[\w-]+__[\w._-]+__(invoice|delivery_note|customs|other)\.[a-zA-Z0-9]+$/.test(filename)) {
    return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
  }

  const filePath = join(process.cwd(), "uploads", "purchase-attachments", id, filename);
  try {
    await unlink(filePath);
  } catch (e: any) {
    if (e?.code === "ENOENT") {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to delete file" }, { status: 500 });
  }

  await auditLog({
    userId: user.uid,
    user: user.username,
    action: "ATTACHMENT_DELETE",
    module: "purchase",
    details: `Deleted attachment ${filename} from purchase ${id}`,
    severity: "info",
    ipAddress: ip,
    userAgent: req.headers.get("user-agent") || "",
  }).catch(() => {});

  return NextResponse.json({ success: true });
}

function getMimeType(ext: string): string {
  const map: Record<string, string> = {
    pdf: "application/pdf",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  };
  return map[ext.toLowerCase()] || "application/octet-stream";
}
