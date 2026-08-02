"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Database, Download, Upload, Loader2, AlertTriangle,
  Check, FileText, Trash2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { authedFetch } from "@/lib/client-auth";

interface BackupRestoreDialogProps {
  open: boolean;
  onClose: () => void;
}

interface Backup {
  filename: string;
  sizeBytes: number;
  createdAt: string;
}

export function BackupRestoreDialog({ open, onClose }: BackupRestoreDialogProps) {
  const { toast } = useToast();
  const [backups, setBackups] = useState<Backup[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState<string | null>(null);
  const [submittingRestore, setSubmittingRestore] = useState(false);

  const loadBackups = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authedFetch("/api/backups");
      if (res.ok) {
        const data = await res.json();
        setBackups(data.backups || []);
      }
    } catch (e: any) {
      toast({ title: "Failed to load backups", description: e?.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (open) {
      loadBackups();
      setRestoreTarget(null);
    }
  }, [open, loadBackups]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const res = await authedFetch("/api/backups", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        toast({
          title: "Backup created",
          description: `Saved as ${data.backup.filename}`,
        });
        loadBackups();
      } else {
        toast({ title: "Backup failed", description: data.error, variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Network error", description: e?.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const handleRestore = async (filename: string) => {
    setSubmittingRestore(true);
    try {
      const res = await authedFetch("/api/backups/restore", {
        method: "POST",
        body: JSON.stringify({ filename }),
      });
      const data = await res.json();
      if (res.ok) {
        toast({
          title: "Restore successful",
          description: `Pre-restore backup: ${data.preRestoreBackup}. Restart server to apply.`,
        });
        setRestoreTarget(null);
        loadBackups();
      } else {
        toast({ title: "Restore failed", description: data.error, variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Network error", description: e?.message, variant: "destructive" });
    } finally {
      setSubmittingRestore(false);
    }
  };

  const handleDelete = async (filename: string) => {
    if (!confirm(`Delete backup ${filename}? This cannot be undone.`)) return;
    try {
      const res = await authedFetch(`/api/backups?filename=${encodeURIComponent(filename)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast({ title: "Backup deleted", description: filename });
        loadBackups();
      } else {
        const data = await res.json();
        toast({ title: "Delete failed", description: data.error, variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Network error", description: e?.message, variant: "destructive" });
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleString("en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-0 sm:p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, y: 30 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 30 }}
            onClick={(e) => e.stopPropagation()}
            className="dialog-premium shadow-premium-xl w-full max-w-2xl max-h-[92vh] sm:max-h-[90vh] flex flex-col"
          >
            {/* Header */}
            <div className="gradient-premium-violet text-white px-6 py-4 flex items-center justify-between relative overflow-hidden flex-shrink-0">
              <div className="pointer-events-none absolute -top-12 -right-12 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
              <div className="flex items-center gap-2 relative z-10">
                <div className="relative">
                  <div className="absolute inset-0 rounded-xl bg-white/25 blur-md scale-110" />
                  <div className="relative h-9 w-9 rounded-xl bg-white/15 ring-1 ring-white/30 flex items-center justify-center backdrop-blur-md">
                    <Database className="h-5 w-5" />
                  </div>
                </div>
                <h2 className="text-base font-bold tracking-tight">Backups & Restore</h2>
              </div>
              <button onClick={onClose} className="h-9 w-9 rounded-lg bg-white/15 hover:bg-white/25 flex items-center justify-center transition active:scale-90 relative z-10">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Actions bar */}
            <div className="flex-shrink-0 px-6 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="text-xs text-slate-500 font-medium">
                {backups.length} backup{backups.length !== 1 ? "s" : ""} available
              </div>
              <button
                onClick={handleCreate}
                disabled={creating}
                className="btn-premium h-9 px-3 rounded-lg gradient-premium-emerald hover:shadow-glow-emerald disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 transition"
              >
                {creating ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Download className="h-3.5 w-3.5" />
                    Create Backup
                  </>
                )}
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-4 scroll-premium">
              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
                </div>
              ) : backups.length === 0 ? (
                <div className="text-center py-12">
                  <Database className="h-12 w-12 mx-auto text-slate-300 mb-3" />
                  <div className="text-sm font-semibold text-slate-700">No backups yet</div>
                  <div className="text-xs text-slate-500 mt-1">Click "Create Backup" to make your first backup</div>
                </div>
              ) : (
                <div className="space-y-2">
                  {backups.map(backup => (
                    <div
                      key={backup.filename}
                      className="bg-white rounded-xl p-3 ring-1 ring-slate-200 hover:ring-violet-300 transition"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-violet-50 ring-1 ring-violet-200 flex items-center justify-center flex-shrink-0">
                          <FileText className="h-5 w-5 text-violet-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-mono font-bold text-slate-800 truncate">
                            {backup.filename}
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            {formatDate(backup.createdAt)} · {formatSize(backup.sizeBytes)}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            onClick={() => setRestoreTarget(backup.filename)}
                            className="h-8 px-2.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 text-[10px] font-bold flex items-center gap-1 transition active:scale-95"
                            title="Restore from this backup"
                          >
                            <Upload className="h-3 w-3" />
                            Restore
                          </button>
                          <button
                            onClick={() => handleDelete(backup.filename)}
                            className="h-8 w-8 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 flex items-center justify-center transition active:scale-95"
                            title="Delete backup"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Restore confirmation */}
                      {restoreTarget === backup.filename && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          className="mt-3 pt-3 border-t border-amber-200 bg-amber-50 rounded-lg p-3 -mb-1"
                        >
                          <div className="flex items-start gap-2 mb-2">
                            <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                            <div className="text-xs text-amber-800">
                              <strong>Restore from this backup?</strong> The current DB will be replaced.
                              A pre-restore safety backup will be created automatically. The server must be restarted after restore.
                            </div>
                          </div>
                          <div className="flex gap-2 justify-end">
                            <button
                              onClick={() => setRestoreTarget(null)}
                              disabled={submittingRestore}
                              className="h-8 px-3 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 text-[10px] font-bold transition"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => handleRestore(backup.filename)}
                              disabled={submittingRestore}
                              className="btn-premium h-8 px-3 rounded-lg gradient-premium-amber disabled:opacity-50 text-white text-[10px] font-bold transition flex items-center gap-1"
                            >
                              {submittingRestore ? (
                                <>
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                  Restoring...
                                </>
                              ) : (
                                <>
                                  <Check className="h-3 w-3" />
                                  Yes, Restore
                                </>
                              )}
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex-shrink-0 px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={onClose}
                className="h-10 px-4 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 text-sm font-bold transition"
              >
                Close
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
