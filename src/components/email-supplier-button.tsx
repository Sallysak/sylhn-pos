"use client";

import { useState } from "react";
import { Mail, Loader2, X, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { authedFetch } from "@/lib/client-auth";

interface Props {
  supplierEmail: string;
  supplierName?: string;
  variant?: "button" | "icon";
}

export function EmailSupplierButton({ supplierEmail, supplierName, variant = "button" }: Props) {
  const [showModal, setShowModal] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const { toast } = useToast();

  const handleSend = async () => {
    if (!supplierEmail) {
      toast({ title: "No email", description: "This supplier doesn't have an email address", variant: "destructive" });
      return;
    }
    if (!subject || !message) {
      toast({ title: "Missing fields", description: "Subject and message are required", variant: "destructive" });
      return;
    }
    setSending(true);
    try {
      const res = await authedFetch("/api/email", {
        method: "POST",
        body: JSON.stringify({
          to: supplierEmail,
          subject,
          body: message,
          html: `<p>${message.replace(/\n/g, "<br/>")}</p>`,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "Email sent!", description: `Sent to ${supplierEmail}` });
        setShowModal(false);
        setSubject("");
        setMessage("");
      } else {
        toast({ title: "Email failed", description: data.error, variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Network error", description: e?.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  if (variant === "icon") {
    return (
      <>
        <button
          onClick={() => setShowModal(true)}
          disabled={!supplierEmail}
          className="h-8 w-8 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-600 disabled:opacity-40 flex items-center justify-center transition"
          title={supplierEmail ? `Email ${supplierName || supplierEmail}` : "No email address"}
        >
          <Mail className="h-4 w-4" />
        </button>
        {showModal && <EmailModal />}
      </>
    );
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        disabled={!supplierEmail}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-xs font-semibold transition"
      >
        <Mail className="h-3.5 w-3.5" />
        Email Supplier
      </button>
      {showModal && <EmailModal />}
    </>
  );

  function EmailModal() {
    return (
      <div
        className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-0 sm:p-4"
        onClick={() => setShowModal(false)}
      >
        <div
          className="dialog-premium shadow-premium-xl w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex-shrink-0 bg-indigo-600 text-white px-5 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              <span className="font-bold text-sm">Email {supplierName || "Supplier"}</span>
            </div>
            <button
              onClick={() => setShowModal(false)}
              className="h-7 w-7 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">To</label>
              <input
                type="email"
                value={supplierEmail}
                readOnly
                className="input-premium w-full h-11 px-4 text-sm bg-slate-50"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Subject *</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Email subject"
                className="input-premium w-full h-11 px-4 text-sm"
                autoFocus
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Message *</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={6}
                placeholder="Type your message here..."
                className="input-premium w-full px-4 py-3 text-sm resize-y"
              />
            </div>
          </div>
          <div className="flex-shrink-0 p-4 border-t border-slate-200">
            <button
              onClick={handleSend}
              disabled={sending || !subject || !message}
              className="w-full h-11 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-sm flex items-center justify-center gap-2"
            >
              {sending ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending...</> : <><Send className="h-4 w-4" /> Send Email</>}
            </button>
          </div>
        </div>
      </div>
    );
  }
}
