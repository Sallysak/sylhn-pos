"use client";

import { useState, useEffect } from "react";
import { Mail, X, Send, Loader2, Paperclip, AlertTriangle } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface PurchaseEmailDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  purchaseId: string | null;
  refNo: string;
  supplierName: string;
  supplierEmail?: string;
  totalAmount: number;
}

/**
 * Premium Email Purchase Order dialog.
 *
 * Sends the PO to the supplier via the /api/purchases/[id]/email endpoint.
 * The endpoint tries SMTP first and falls back to a mailto: link if SMTP
 * is not configured — so this dialog always "works" (worst case it opens
 * the user's email client with a pre-filled message).
 */
export function PurchaseEmailDialog({
  open, onOpenChange, purchaseId, refNo, supplierName, supplierEmail, totalAmount,
}: PurchaseEmailDialogProps) {
  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      setTo(supplierEmail || "");
      setCc("");
      setSubject(`Purchase Order ${refNo} — SYLHN COMPANY LTD`);
      setMessage(
        `Dear ${supplierName},\n\nPlease find our purchase order ${refNo} attached. Total value: ₵${totalAmount.toFixed(2)}.\n\nKindly confirm receipt and advise on delivery timeline.\n\nBest regards,\nSYLHN COMPANY LTD`
      );
    }
  }, [open, supplierEmail, supplierName, refNo, totalAmount]);

  const handleSend = async () => {
    if (!purchaseId) {
      toast({ title: "Save the purchase first", description: "You can only email a saved purchase order.", variant: "destructive" });
      return;
    }
    if (!to || !/.+@.+\..+/.test(to)) {
      toast({ title: "Valid recipient email required", variant: "destructive" });
      return;
    }

    setSending(true);
    try {
      const res = await authedFetch(`/api/purchases/${purchaseId}/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ to, cc, subject, message }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (data.delivery === "smtp") {
          toast({
            title: "Email sent ✓",
            description: `PO ${refNo} sent to ${to}`,
          });
        } else {
          toast({
            title: "Email client opened",
            description: "SMTP is not configured. We opened your email app with the message pre-filled — click Send there.",
          });
        }
        onOpenChange(false);
      } else {
        toast({ title: "Failed to send", description: data.error, variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Network error", description: e?.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg p-0 overflow-hidden">
        {/* Premium gradient header */}
        <div className="bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-600 text-white px-6 py-5 relative overflow-hidden">
          <div className="pointer-events-none absolute -top-12 -right-12 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
          <div className="relative z-10 flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-white/20 ring-1 ring-white/30 flex items-center justify-center backdrop-blur-sm">
              <Mail className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-bold tracking-tight">Email Purchase Order</h2>
              <p className="text-[11px] opacity-85">Send {refNo} to {supplierName}</p>
            </div>
          </div>
        </div>

        <div className="px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto">
          {!supplierEmail && (
            <div className="flex items-start gap-2 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 px-3 py-2.5">
              <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed">
                This supplier has no email on file. Enter a recipient address below — and consider adding one to the supplier master file for next time.
              </p>
            </div>
          )}

          <div>
            <Label htmlFor="email-to" className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">To *</Label>
            <Input id="email-to" value={to} onChange={(e) => setTo(e.target.value)} type="email" placeholder="supplier@example.com" className="h-10" />
          </div>
          <div>
            <Label htmlFor="email-cc" className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">CC</Label>
            <Input id="email-cc" value={cc} onChange={(e) => setCc(e.target.value)} type="email" placeholder="manager@sylhn.com" className="h-10" />
          </div>
          <div>
            <Label htmlFor="email-subject" className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Subject</Label>
            <Input id="email-subject" value={subject} onChange={(e) => setSubject(e.target.value)} className="h-10" />
          </div>
          <div>
            <Label htmlFor="email-message" className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Message</Label>
            <Textarea id="email-message" value={message} onChange={(e) => setMessage(e.target.value)} rows={8} className="text-sm" />
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 dark:bg-slate-800/50 rounded-lg px-3 py-2">
            <Paperclip className="h-3.5 w-3.5" />
            <span>The full PO details (items, totals, terms) will be included in the email body automatically.</span>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex gap-2">
          <Button variant="outline" className="flex-1 h-11" onClick={() => onOpenChange(false)} disabled={sending}>
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={sending || !to || !purchaseId}
            className="flex-1 h-11 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-white font-bold"
          >
            {sending ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Sending…</>
            ) : (
              <><Send className="h-4 w-4 mr-2" /> Send Email</>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
