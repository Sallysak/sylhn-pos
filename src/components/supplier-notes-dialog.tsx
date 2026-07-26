"use client";

import { useState, useEffect } from "react";
import { StickyNote, Loader2, Save } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface SupplierNotesDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  supplierId: string | null;
  supplierName: string;
  initialNotes: string;
  onSaved?: () => void;
}

/**
 * Supplier Notes editor — opens a premium dialog where the user can edit
 * the supplier's `notes` field. Saves via PUT /api/suppliers/[id].
 */
export function SupplierNotesDialog({
  open, onOpenChange, supplierId, supplierName, initialNotes, onSaved,
}: SupplierNotesDialogProps) {
  const [notes, setNotes] = useState(initialNotes);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      setNotes(initialNotes);
      setSaving(false);
    }
  }, [open, initialNotes]);

  const handleSave = async () => {
    if (!supplierId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/suppliers/${supplierId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ notes }),
      });
      const data = await res.json();
      if (res.ok && (data.success || data.supplier)) {
        toast({ title: "Notes saved ✓", description: supplierName });
        onOpenChange(false);
        onSaved?.();
      } else {
        throw new Error(data.error || "Failed to save notes");
      }
    } catch (e: any) {
      toast({ title: "Failed to save", description: e?.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg p-0 overflow-hidden">
        {/* Premium gradient header */}
        <div className="bg-gradient-to-br from-purple-600 via-violet-600 to-fuchsia-600 text-white px-6 py-5 relative overflow-hidden">
          <div className="pointer-events-none absolute -top-12 -right-12 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
          <div className="relative z-10 flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-white/20 ring-1 ring-white/30 flex items-center justify-center backdrop-blur-sm">
              <StickyNote className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight">Supplier Notes</h2>
              <p className="text-[11px] opacity-85">{supplierName}</p>
            </div>
          </div>
        </div>

        <div className="px-6 py-5">
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={10}
            placeholder="Enter notes about this supplier — payment preferences, delivery instructions, special agreements, etc."
            className="text-sm"
            autoFocus
          />
          <p className="text-[10px] text-slate-500 mt-2">
            Notes are private to your business — the supplier cannot see them. Saved to the supplier master file.
          </p>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex gap-2">
          <Button variant="outline" className="flex-1 h-11" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !supplierId}
            className="flex-1 h-11 bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-700 hover:to-fuchsia-700 text-white font-bold"
          >
            {saving ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving…</>
            ) : (
              <><Save className="h-4 w-4 mr-2" /> Save Notes</>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
