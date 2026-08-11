"use client";

import { authedFetch } from "@/lib/client-auth";
import { useState, useRef, useEffect } from "react";
import { Paperclip, Loader2, FileText, Image as ImageIcon, Upload, Trash2, Download } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface Attachment {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  category: string;
  uploadedAt: string;
  url?: string;
}

interface PurchaseAttachmentsDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  purchaseId: string | null;
  refNo: string;
  onChanged?: () => void;
}

const CATEGORIES = [
  { value: "invoice", label: "Invoice", icon: "🧾" },
  { value: "delivery_note", label: "Delivery Note", icon: "📦" },
  { value: "customs", label: "Customs", icon: "🛃" },
  { value: "other", label: "Other", icon: "📄" },
];

export function PurchaseAttachmentsDialog({
  open, onOpenChange, purchaseId, refNo, onChanged,
}: PurchaseAttachmentsDialogProps) {
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [category, setCategory] = useState("invoice");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Load attachments whenever the dialog opens
  useEffect(() => {
    if (open && purchaseId) {
      loadAttachments();
    } else if (!open) {
      setAttachments([]);
    }
  }, [open, purchaseId]);

  const loadAttachments = async () => {
    if (!purchaseId) return;
    try {
      const res = await authedFetch(`/api/purchases/${purchaseId}/attachments`);
      const data = await res.json();
      if (res.ok) {
        setAttachments(data.attachments || []);
      }
    } catch {
      // swallow
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !purchaseId) return;

    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "File too large", description: "Max 10 MB", variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("category", category);
      const res = await authedFetch(`/api/purchases/${purchaseId}/attachments`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast({ title: "Uploaded ✓", description: file.name });
        if (fileInputRef.current) fileInputRef.current.value = "";
        loadAttachments();
        onChanged?.();
      } else {
        throw new Error(data.error || "Upload failed");
      }
    } catch (e: any) {
      toast({ title: "Upload failed", description: e?.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (attachment: Attachment) => {
    if (!purchaseId) return;
    if (!window.confirm(`Delete "${attachment.originalName}"?`)) return;
    setDeleting(attachment.id);
    try {
      const res = await fetch(
        `/api/purchases/${purchaseId}/attachments?file=${encodeURIComponent(attachment.filename)}`,
        { method: "DELETE", credentials: "include" }
      );
      if (res.ok) {
        toast({ title: "Deleted", description: attachment.originalName });
        loadAttachments();
        onChanged?.();
      } else {
        throw new Error("Failed to delete");
      }
    } catch (e: any) {
      toast({ title: "Delete failed", description: e?.message, variant: "destructive" });
    } finally {
      setDeleting(null);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg p-0 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900 text-white px-6 py-5 relative overflow-hidden">
          <div className="pointer-events-none absolute -top-12 -right-12 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
          <div className="relative z-10 flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-white/15 ring-1 ring-white/30 flex items-center justify-center backdrop-blur-sm">
              <Paperclip className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight">Attachments</h2>
              <p className="text-[11px] opacity-85">{refNo} · {attachments.length} file(s)</p>
            </div>
          </div>
        </div>

        <div className="px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* Category picker */}
          <div>
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Category</div>
            <div className="grid grid-cols-4 gap-2">
              {CATEGORIES.map(cat => (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => setCategory(cat.value)}
                  className={cn(
                    "flex flex-col items-center gap-0.5 py-2 rounded-lg ring-2 transition",
                    category === cat.value
                      ? "ring-slate-800 bg-slate-100 dark:bg-slate-800"
                      : "ring-slate-200 dark:ring-slate-700 hover:ring-slate-300"
                  )}
                >
                  <span className="text-base">{cat.icon}</span>
                  <span className="text-[10px] font-bold uppercase">{cat.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Upload button */}
          <div>
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleUpload}
              className="hidden"
              accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
            />
            <Button
              type="button"
              variant="outline"
              className="w-full h-12 border-dashed"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || !purchaseId}
            >
              {uploading ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Uploading…</>
              ) : (
                <><Upload className="h-4 w-4 mr-2" /> Click to upload (max 10 MB · PDF/JPG/PNG/DOC)</>
              )}
            </Button>
          </div>

          {/* Existing attachments */}
          <div className="space-y-1.5">
            {attachments.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-sm">No attachments yet.</div>
            ) : (
              attachments.map(att => (
                <div
                  key={att.id}
                  className="flex items-center gap-3 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  <div className="h-9 w-9 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0">
                    {att.mimeType.startsWith("image/") ? (
                      <ImageIcon className="h-4 w-4 text-blue-600" />
                    ) : (
                      <FileText className="h-4 w-4 text-rose-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate">{att.originalName}</div>
                    <div className="text-[10px] text-slate-500">
                      {formatSize(att.size)} · {new Date(att.uploadedAt).toLocaleDateString()}
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[10px] uppercase shrink-0">{att.category}</Badge>
                  <button
                    onClick={() => handleDelete(att)}
                    disabled={deleting === att.id}
                    className="h-7 w-7 rounded-md hover:bg-rose-100 dark:hover:bg-rose-900/30 flex items-center justify-center text-rose-600 transition shrink-0"
                    title="Delete"
                  >
                    {deleting === att.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <Button variant="outline" className="w-full h-11" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
