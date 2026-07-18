"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Mail, Send, Inbox, Settings as SettingsIcon, Loader2,
  Check, AlertTriangle, X, Search, Trash2, RefreshCw, Save,
  Paperclip, Reply, Forward, Star, Archive,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { authedFetch } from "@/lib/client-auth";
import { formatGHS, COMPANY } from "@/lib/pos-data";
import { cn } from "@/lib/utils";

interface EmailLog {
  id: string;
  to: string;
  cc: string;
  subject: string;
  body: string;
  status: string;
  errorMessage: string;
  createdAt: string;
}

type EmailTab = "inbox" | "compose" | "settings";

export function EmailSystem({ onBack }: { onBack: () => void }) {
  const { toast } = useToast();
  const [tab, setTab] = useState<EmailTab>("inbox");
  const [emails, setEmails] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmail, setSelectedEmail] = useState<EmailLog | null>(null);

  // Compose form
  const [composeTo, setComposeTo] = useState("");
  const [composeCc, setComposeCc] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [sending, setSending] = useState(false);

  // Settings
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("587");
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPass, setSmtpPass] = useState("");
  const [smtpFrom, setSmtpFrom] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);
  const [testing, setTesting] = useState(false);

  const loadEmails = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authedFetch("/api/email?limit=100");
      if (res.ok) {
        const data = await res.json();
        setEmails(data.emails || []);
      }
    } catch (e: any) {
      toast({ title: "Failed to load emails", description: e?.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const loadSettings = useCallback(async () => {
    try {
      const res = await authedFetch("/api/email/settings");
      if (res.ok) {
        const data = await res.json();
        const s = data.settings || {};
        setSmtpHost(s["smtp.host"] || "");
        setSmtpPort(s["smtp.port"] || "587");
        setSmtpUser(s["smtp.user"] || "");
        setSmtpPass(s["smtp.password"] || "");
        setSmtpFrom(s["smtp.from"] || "");
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    loadEmails();
  }, [loadEmails]);

  useEffect(() => {
    if (tab === "settings") loadSettings();
  }, [tab, loadSettings]);

  const handleSend = async () => {
    if (!composeTo || !composeSubject || !composeBody) {
      toast({ title: "Missing fields", description: "To, Subject, and Body are required", variant: "destructive" });
      return;
    }
    setSending(true);
    try {
      const res = await authedFetch("/api/email", {
        method: "POST",
        body: JSON.stringify({
          to: composeTo,
          cc: composeCc,
          subject: composeSubject,
          body: composeBody,
          html: composeBody.replace(/\n/g, "<br>"),
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "Email sent!", description: `Message ID: ${data.messageId?.slice(0, 20)}...` });
        setComposeTo(""); setComposeCc(""); setComposeSubject(""); setComposeBody("");
        loadEmails();
        setTab("inbox");
      } else if (data.mailto) {
        // SMTP not configured — open mailto link
        window.open(data.mailto, "_blank");
        toast({ title: "SMTP not configured", description: "Opened your email client instead. Configure SMTP in Settings to send directly.", variant: "default" });
      } else {
        toast({ title: "Email failed", description: data.error, variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Network error", description: e?.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      const res = await authedFetch("/api/email/settings", {
        method: "POST",
        body: JSON.stringify({
          host: smtpHost,
          port: smtpPort,
          user: smtpUser,
          password: smtpPass,
          from: smtpFrom,
        }),
      });
      if (res.ok) {
        toast({ title: "Settings saved", description: "SMTP configuration updated" });
      } else {
        toast({ title: "Save failed", variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Network error", description: e?.message, variant: "destructive" });
    } finally {
      setSavingSettings(false);
    }
  };

  const handleTestEmail = async () => {
    setTesting(true);
    try {
      const res = await authedFetch("/api/email/test", {
        method: "POST",
        body: JSON.stringify({ to: smtpUser }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "Test email sent!", description: `Check ${smtpUser} inbox` });
      } else {
        toast({ title: "Test failed", description: data.error, variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Network error", description: e?.message, variant: "destructive" });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="flex-shrink-0 gradient-premium-emerald text-white shadow-lg sticky top-0 z-30">
        <div className="flex items-center justify-between px-4 py-3 safe-top">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="h-9 w-9 rounded-lg bg-white/15 hover:bg-white/25 flex items-center justify-center transition active:scale-90">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-base font-bold tracking-tight">📧 Email System</h1>
              <p className="text-[10px] text-emerald-50/90">{COMPANY.name}</p>
            </div>
          </div>
        </div>
        {/* Tab Bar */}
        <div className="flex px-2 pb-2 gap-1">
          <button
            onClick={() => setTab("inbox")}
            className={cn("flex-1 h-9 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition",
              tab === "inbox" ? "bg-white text-emerald-700" : "bg-white/10 text-white hover:bg-white/20")}
          >
            <Inbox className="h-3.5 w-3.5" /> Sent ({emails.length})
          </button>
          <button
            onClick={() => setTab("compose")}
            className={cn("flex-1 h-9 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition",
              tab === "compose" ? "bg-white text-emerald-700" : "bg-white/10 text-white hover:bg-white/20")}
          >
            <Send className="h-3.5 w-3.5" /> Compose
          </button>
          <button
            onClick={() => setTab("settings")}
            className={cn("flex-1 h-9 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition",
              tab === "settings" ? "bg-white text-emerald-700" : "bg-white/10 text-white hover:bg-white/20")}
          >
            <SettingsIcon className="h-3.5 w-3.5" /> Settings
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto p-4 max-w-3xl mx-auto w-full">
        {/* INBOX */}
        {tab === "inbox" && (
          <div className="space-y-2">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-bold text-slate-700">Sent Emails</h2>
              <button onClick={loadEmails} className="h-8 w-8 rounded-lg bg-white ring-1 ring-slate-200 hover:bg-slate-100 flex items-center justify-center transition">
                <RefreshCw className="h-3.5 w-3.5 text-slate-600" />
              </button>
            </div>
            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-emerald-500" /></div>
            ) : emails.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon"><Mail className="h-7 w-7 text-slate-400" /></div>
                <div className="text-sm font-semibold text-slate-600">No emails sent yet</div>
                <div className="text-xs text-slate-400 mt-1">Compose your first email to get started</div>
              </div>
            ) : (
              emails.map(email => (
                <div
                  key={email.id}
                  onClick={() => setSelectedEmail(email)}
                  className="card-premium p-3 cursor-pointer hover:ring-emerald-300 transition"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={cn("h-2 w-2 rounded-full flex-shrink-0",
                          email.status === "sent" ? "bg-emerald-500" : email.status === "failed" ? "bg-rose-500" : "bg-amber-500")} />
                        <span className="text-xs font-bold text-slate-700 truncate">{email.subject}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">To: {email.to}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{new Date(email.createdAt).toLocaleString('en-GB')}</div>
                    </div>
                    {email.status === "failed" && (
                      <span className="badge-premium bg-rose-100 text-rose-700">Failed</span>
                    )}
                    {email.status === "sent" && (
                      <span className="badge-premium bg-emerald-100 text-emerald-700">Sent</span>
                    )}
                    {email.status === "fallback" && (
                      <span className="badge-premium bg-amber-100 text-amber-700">Mailto</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* COMPOSE */}
        {tab === "compose" && (
          <div className="card-premium p-5 space-y-4">
            <div>
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">To</label>
              <input
                type="email"
                value={composeTo}
                onChange={(e) => setComposeTo(e.target.value)}
                placeholder="recipient@example.com"
                className="input-premium w-full h-11 px-4 text-sm"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">CC (optional)</label>
              <input
                type="email"
                value={composeCc}
                onChange={(e) => setComposeCc(e.target.value)}
                placeholder="cc@example.com"
                className="input-premium w-full h-11 px-4 text-sm"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Subject</label>
              <input
                type="text"
                value={composeSubject}
                onChange={(e) => setComposeSubject(e.target.value)}
                placeholder="Email subject"
                className="input-premium w-full h-11 px-4 text-sm"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Message</label>
              <textarea
                value={composeBody}
                onChange={(e) => setComposeBody(e.target.value)}
                placeholder="Write your email here..."
                rows={10}
                className="input-premium w-full px-4 py-3 text-sm resize-none"
              />
            </div>
            <button
              onClick={handleSend}
              disabled={sending || !composeTo || !composeSubject || !composeBody}
              className="btn-premium w-full h-12 rounded-xl gradient-premium-emerald hover:shadow-glow-emerald disabled:opacity-50 text-white text-sm font-bold flex items-center justify-center gap-2 transition"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {sending ? "Sending..." : "Send Email"}
            </button>
          </div>
        )}

        {/* SETTINGS */}
        {tab === "settings" && (
          <div className="card-premium p-5 space-y-4">
            <div className="bg-blue-50 rounded-xl p-3 ring-1 ring-blue-200">
              <div className="text-xs font-bold text-blue-800 mb-1">📧 SMTP Configuration</div>
              <div className="text-[11px] text-blue-600">
                Configure your SMTP server to send emails directly from the POS.
                For Gmail, use: host=smtp.gmail.com, port=587, user=your.email@gmail.com,
                password=your-app-password (enable 2FA and create an App Password).
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">SMTP Host</label>
                <input
                  type="text"
                  value={smtpHost}
                  onChange={(e) => setSmtpHost(e.target.value)}
                  placeholder="smtp.gmail.com"
                  className="input-premium w-full h-11 px-4 text-sm"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Port</label>
                <input
                  type="number"
                  value={smtpPort}
                  onChange={(e) => setSmtpPort(e.target.value)}
                  placeholder="587"
                  className="input-premium w-full h-11 px-4 text-sm"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">From Email</label>
                <input
                  type="email"
                  value={smtpFrom}
                  onChange={(e) => setSmtpFrom(e.target.value)}
                  placeholder="noreply@sylhn.com"
                  className="input-premium w-full h-11 px-4 text-sm"
                />
              </div>
              <div className="col-span-2">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Username</label>
                <input
                  type="text"
                  value={smtpUser}
                  onChange={(e) => setSmtpUser(e.target.value)}
                  placeholder="your.email@gmail.com"
                  className="input-premium w-full h-11 px-4 text-sm"
                />
              </div>
              <div className="col-span-2">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Password / App Password</label>
                <input
                  type="password"
                  value={smtpPass}
                  onChange={(e) => setSmtpPass(e.target.value)}
                  placeholder="••••••••"
                  className="input-premium w-full h-11 px-4 text-sm"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSaveSettings}
                disabled={savingSettings}
                className="btn-premium flex-1 h-11 rounded-xl gradient-premium-emerald hover:shadow-glow-emerald disabled:opacity-50 text-white text-sm font-bold flex items-center justify-center gap-2 transition"
              >
                {savingSettings ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save Settings
              </button>
              <button
                onClick={handleTestEmail}
                disabled={testing}
                className="btn-premium flex-1 h-11 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-bold flex items-center justify-center gap-2 transition"
              >
                {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Send Test
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Email detail modal */}
      <AnimatePresence>
        {selectedEmail && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedEmail(null)}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, y: 30 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 30 }}
              onClick={(e) => e.stopPropagation()}
              className="dialog-premium shadow-premium-xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden"
            >
              <div className="flex-shrink-0 gradient-premium-emerald text-white px-5 py-3 flex items-center justify-between">
                <div className="font-bold text-sm">{selectedEmail.subject}</div>
                <button onClick={() => setSelectedEmail(null)} className="h-7 w-7 rounded-lg bg-white/15 hover:bg-white/25 flex items-center justify-center">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-5 space-y-3">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><span className="text-slate-400 font-bold">To:</span> <span className="text-slate-700">{selectedEmail.to}</span></div>
                  <div><span className="text-slate-400 font-bold">Date:</span> <span className="text-slate-700">{new Date(selectedEmail.createdAt).toLocaleString('en-GB')}</span></div>
                  {selectedEmail.cc && <div><span className="text-slate-400 font-bold">CC:</span> <span className="text-slate-700">{selectedEmail.cc}</span></div>}
                  <div><span className="text-slate-400 font-bold">Status:</span>
                    <span className={cn("ml-1 font-bold",
                      selectedEmail.status === "sent" ? "text-emerald-600" :
                      selectedEmail.status === "failed" ? "text-rose-600" : "text-amber-600")}>
                      {selectedEmail.status}
                    </span>
                  </div>
                </div>
                {selectedEmail.errorMessage && (
                  <div className="p-2 rounded-lg bg-rose-50 text-xs text-rose-600">{selectedEmail.errorMessage}</div>
                )}
                <div className="border-t border-slate-200 pt-3">
                  <div className="text-xs text-slate-600 whitespace-pre-wrap">{selectedEmail.body}</div>
                </div>
              </div>
              <div className="flex-shrink-0 p-3 border-t border-slate-200 flex gap-2">
                <button
                  onClick={() => {
                    setTab("compose");
                    setComposeTo(selectedEmail.to);
                    setComposeSubject(`Re: ${selectedEmail.subject}`);
                    setSelectedEmail(null);
                  }}
                  className="btn-premium flex-1 h-10 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center justify-center gap-1.5"
                >
                  <Reply className="h-3.5 w-3.5" /> Reply
                </button>
                <button
                  onClick={() => {
                    setTab("compose");
                    setComposeSubject(`Fwd: ${selectedEmail.subject}`);
                    setComposeBody(`\n\n--- Forwarded ---\nFrom: ${selectedEmail.to}\nSubject: ${selectedEmail.subject}\n\n${selectedEmail.body}`);
                    setSelectedEmail(null);
                  }}
                  className="btn-premium flex-1 h-10 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center justify-center gap-1.5"
                >
                  <Forward className="h-3.5 w-3.5" /> Forward
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
