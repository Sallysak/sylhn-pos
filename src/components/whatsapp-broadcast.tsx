"use client";

import { useState, useEffect } from "react";
import { Send, Loader2, Users, MessageCircle } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface WhatsAppBroadcastProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function WhatsAppBroadcast({ open, onOpenChange }: WhatsAppBroadcastProps) {
  const [message, setMessage] = useState("");
  const [tier, setTier] = useState("all");
  const [sending, setSending] = useState(false);
  const [links, setLinks] = useState<any[]>([]);
  const [sentCount, setSentCount] = useState(0);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      setMessage("Dear valued customer, we have a special promotion just for you! Visit SYLHN Company Ltd today. Thank you for your loyalty.");
      setTier("all");
      setLinks([]);
      setSentCount(0);
    }
  }, [open]);

  const handleGenerate = async () => {
    if (!message.trim()) {
      toast({ title: "Message is required", variant: "destructive" });
      return;
    }
    setSending(true);
    try {
      const res = await authedFetch("/api/whatsapp/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ message, tier }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setLinks(data.links);
        toast({ title: "Ready to send ✓", description: `${data.count} customer(s) — click each to open WhatsApp` });
      } else {
        throw new Error(data.error);
      }
    } catch (e: any) {
      toast({ title: "Failed", description: e?.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const handleSendOne = (link: any) => {
    window.open(link.waLink, "_blank");
    setSentCount(prev => prev + 1);
  };

  const handleSendAll = () => {
    links.forEach((link, i) => {
      setTimeout(() => window.open(link.waLink, "_blank"), i * 500);
    });
    setSentCount(links.length);
    toast({ title: `Opening ${links.length} WhatsApp chats...`, description: "Check your browser for popup windows" });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl p-0 overflow-hidden">
        <div className="bg-gradient-to-br from-green-600 via-emerald-600 to-teal-600 text-white px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-white/20 ring-1 ring-white/30 flex items-center justify-center backdrop-blur-sm">
              <MessageCircle className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight">WhatsApp Broadcast</h2>
              <p className="text-[11px] opacity-85">Send promotional messages to customers via WhatsApp</p>
            </div>
          </div>
        </div>

        <div className="px-6 py-5 space-y-4 max-h-[65vh] overflow-y-auto">
          {/* Tier selector */}
          <div>
            <label className="text-[11px] font-bold uppercase text-slate-500 mb-1.5 block">Customer Tier</label>
            <div className="grid grid-cols-5 gap-2">
              {["all", "bronze", "silver", "gold", "platinum"].map(t => (
                <button key={t} onClick={() => setTier(t)}
                  className={cn("py-2 rounded-lg ring-2 transition text-xs font-bold capitalize",
                    tier === t ? "ring-green-500 bg-green-50 dark:bg-green-950/30" : "ring-slate-200 dark:ring-slate-700 hover:ring-slate-300")}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Message */}
          <div>
            <label className="text-[11px] font-bold uppercase text-slate-500 mb-1.5 block">Message</label>
            <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} className="text-sm" placeholder="Type your promotional message..." />
            <div className="text-[10px] text-slate-400 mt-1">{message.length} characters</div>
          </div>

          {/* Generate button */}
          <Button onClick={handleGenerate} disabled={sending} className="w-full h-11 bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 text-white font-bold">
            {sending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating links...</> : <><Users className="h-4 w-4 mr-2" /> Generate WhatsApp Links</>}
          </Button>

          {/* Results */}
          {links.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Badge className="bg-green-100 text-green-700">{links.length} customers</Badge>
                <Button size="sm" onClick={handleSendAll} className="bg-green-600 hover:bg-green-700 text-white">
                  <Send className="h-3.5 w-3.5 mr-1" /> Open All ({sentCount}/{links.length} sent)
                </Button>
              </div>
              <div className="max-h-48 overflow-y-auto space-y-1 border border-slate-200 dark:border-slate-700 rounded-lg p-1.5">
                {links.map((link, i) => (
                  <div key={link.customer.id} className="flex items-center gap-2 p-2 rounded-md hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold truncate">{link.customer.name}</div>
                      <div className="text-[10px] text-slate-500">{link.customer.phone} · {link.customer.tier} · {link.customer.points} pts</div>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => handleSendOne(link)} className="h-7 text-xs">
                      <MessageCircle className="h-3 w-3 mr-1" /> Send
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
