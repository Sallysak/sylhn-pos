"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Mail, Send, Inbox, Settings as SettingsIcon, Loader2,
  Check, AlertTriangle, X, Search, Trash2, RefreshCw, Save,
  Paperclip, Reply, Forward, Star, Archive, FileText, BarChart3,
  Bold, Italic, Underline, List, ListOrdered, Link as LinkIcon,
  AlignLeft, AlignCenter, AlignRight, Smile, Image as ImageIcon,
  Mail as MailIcon, ChevronDown, Eye, Code,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { authedFetch } from "@/lib/client-auth";
import { COMPANY } from "@/lib/pos-data";
import { cn } from "@/lib/utils";
import { EmailSyncButton } from "./email-sync-button";

interface EmailLog {
  id: string;
  to: string;
  from?: string;
  cc: string;
  subject: string;
  body: string;
  status: string;
  direction?: "sent" | "received";
  errorMessage: string;
  createdAt: string;
}

interface Attachment {
  filename: string;
  content: string;
  contentType: string;
  size: number;
}

type EmailTab = "inbox" | "compose" | "templates" | "settings";

const SMTP_PRESETS = [
  { id: "gmail", name: "Gmail", icon: "📧", description: "Google Mail — requires App Password (2FA)", host: "smtp.gmail.com", port: "587", helpUrl: "https://myaccount.google.com/apppasswords", helpText: "Enable 2-Step Verification, then create an App Password" },
  { id: "outlook", name: "Outlook / Hotmail", icon: "📨", description: "Microsoft Outlook, Hotmail, Office 365", host: "smtp.office365.com", port: "587", helpUrl: "https://account.live.com/proofs/manage", helpText: "Use your regular password (enable 2FA recommended)" },
  { id: "yahoo", name: "Yahoo Mail", icon: "📬", description: "Yahoo Mail — requires App Password", host: "smtp.mail.yahoo.com", port: "587", helpUrl: "https://help.yahoo.com/kb/SLN15241.html", helpText: "Generate an App Password in Yahoo Account Security" },
  { id: "zoho", name: "Zoho Mail", icon: "📨", description: "Zoho Mail for business", host: "smtp.zoho.com", port: "587", helpUrl: "https://www.zoho.com/mail/help/zoho-smtp.html", helpText: "Use your Zoho Mail password" },
  { id: "custom", name: "Custom SMTP", icon: "⚙️", description: "Any other SMTP server", host: "", port: "587", helpUrl: "", helpText: "Enter your SMTP server details manually" },
];

export function EmailSystem({ onBack }: { onBack: () => void }) {
  const { toast } = useToast();
  const [tab, setTab] = useState<EmailTab>("inbox");
  const [emails, setEmails] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmail, setSelectedEmail] = useState<EmailLog | null>(null);
  const [composeTo, setComposeTo] = useState("");
  const [composeCc, setComposeCc] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeHtml, setComposeHtml] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [sending, setSending] = useState(false);
  const [showHtmlSource, setShowHtmlSource] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const [selectedPreset, setSelectedPreset] = useState("gmail");
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("587");
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPass, setSmtpPass] = useState("");
  const [smtpFrom, setSmtpFrom] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);
  const [testing, setTesting] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [sendingAlert, setSendingAlert] = useState(false);
  const [sendingSummary, setSendingSummary] = useState(false);

  const loadEmails = useCallback(async () => {
    setLoading(true);
    try {
      const [sentRes, receivedRes] = await Promise.all([
        authedFetch("/api/email?limit=100"),
        authedFetch("/api/email/received?limit=100"),
      ]);
      const sentEmails: EmailLog[] = [];
      const receivedEmails: EmailLog[] = [];
      if (sentRes.ok) {
        const data = await sentRes.json();
        (data.emails || []).forEach((e: any) => sentEmails.push({ ...e, direction: "sent" as const }));
      }
      if (receivedRes.ok) {
        const data = await receivedRes.json();
        (data.emails || []).forEach((e: any) => receivedEmails.push({ ...e, direction: "received" as const }));
      }
      const allEmails = [...receivedEmails, ...sentEmails].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setEmails(allEmails);
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
        setSmtpFrom(s["smtp.from"] || "");
        setSmtpPass(s["smtp.password"] ? "••••••••" : "");
        if (s["smtp.host"]?.includes("gmail")) setSelectedPreset("gmail");
        else if (s["smtp.host"]?.includes("office365") || s["smtp.host"]?.includes("outlook")) setSelectedPreset("outlook");
        else if (s["smtp.host"]?.includes("yahoo")) setSelectedPreset("yahoo");
        else if (s["smtp.host"]?.includes("zoho")) setSelectedPreset("zoho");
        else if (s["smtp.host"]) setSelectedPreset("custom");
        setSettingsLoaded(true);
      }
    } catch (e: any) {
      toast({ title: "Failed to load settings", description: e?.message, variant: "destructive" });
    }
  }, [toast]);

  useEffect(() => { loadEmails(); }, [loadEmails]);
  useEffect(() => { if (tab === "settings") loadSettings(); }, [tab, loadSettings]);

  const execCmd = (cmd: string, val?: string) => {
    document.execCommand(cmd, false, val);
    editorRef.current?.focus();
    setTimeout(() => setComposeHtml(editorRef.current?.innerHTML || ""), 0);
  };
  const insertLink = () => { const url = prompt("Enter URL:", "https://"); if (url) execCmd("createLink", url); };
  const insertEmoji = (emoji: string) => { execCmd("insertText", emoji); };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files: File[] = Array.from(e.target.files || []);
    for (const file of files) {
      if (file.size > 5 * 1024 * 1024) { toast({ title: "File too large", description: `${file.name} is over 5MB`, variant: "destructive" }); continue; }
      const base64 = await fileToBase64(file);
      setAttachments(prev => [...prev, { filename: file.name, content: base64, contentType: file.type || "application/octet-stream", size: file.size }]);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };
  const removeAttachment = (index: number) => setAttachments(prev => prev.filter((_, i) => i !== index));
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleSend = async () => {
    if (!composeTo || !composeSubject) { toast({ title: "Missing fields", description: "To and Subject are required", variant: "destructive" }); return; }
    const htmlContent = editorRef.current?.innerHTML || composeHtml;
    const textContent = editorRef.current?.innerText || "";
    if (!textContent.trim()) { toast({ title: "Empty message", description: "Please write a message", variant: "destructive" }); return; }
    setSending(true);
    try {
      const res = await authedFetch("/api/email", {
        method: "POST",
        body: JSON.stringify({ to: composeTo, cc: composeCc, subject: composeSubject, body: textContent, html: htmlContent, attachments: attachments.map(a => ({ filename: a.filename, content: a.content, contentType: a.contentType })) }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "Email sent!", description: `Message ID: ${data.messageId?.slice(0, 20)}...` });
        setComposeTo(""); setComposeCc(""); setComposeSubject(""); setComposeHtml(""); setAttachments([]);
        if (editorRef.current) editorRef.current.innerHTML = "";
        loadEmails(); setTab("inbox");
      } else if (data.mailto) {
        window.open(data.mailto, "_blank");
        toast({ title: "SMTP not configured", description: "Opened your email client instead. Configure SMTP in Settings.", variant: "default" });
      } else { toast({ title: "Email failed", description: data.error, variant: "destructive" }); }
    } catch (e: any) { toast({ title: "Network error", description: e?.message, variant: "destructive" }); } finally { setSending(false); }
  };

  const applyPreset = (presetId: string) => {
    const preset = SMTP_PRESETS.find(p => p.id === presetId);
    if (!preset) return;
    setSelectedPreset(presetId);
    if (presetId !== "custom") { setSmtpHost(preset.host); setSmtpPort(preset.port); }
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      const passwordToSend = smtpPass === "••••••••" ? undefined : smtpPass;
      const res = await authedFetch("/api/email/settings", {
        method: "POST",
        body: JSON.stringify({ host: smtpHost, port: smtpPort, user: smtpUser, password: passwordToSend, from: smtpFrom || smtpUser }),
      });
      if (res.ok) { toast({ title: "Settings saved", description: "SMTP configuration updated" }); if (passwordToSend) setSmtpPass("••••••••"); }
      else { const data = await res.json().catch(() => ({})); toast({ title: "Save failed", description: data.error, variant: "destructive" }); }
    } catch (e: any) { toast({ title: "Network error", description: e?.message, variant: "destructive" }); } finally { setSavingSettings(false); }
  };

  const handleTestEmail = async () => {
    setTesting(true);
    try {
      const res = await authedFetch("/api/email/test", { method: "POST", body: JSON.stringify({ to: smtpUser }) });
      const data = await res.json();
      if (data.success) toast({ title: "✅ Test email sent!", description: `Check ${data.sentTo} inbox` });
      else toast({ title: "Test failed", description: data.error, variant: "destructive" });
    } catch (e: any) { toast({ title: "Network error", description: e?.message, variant: "destructive" }); } finally { setTesting(false); }
  };

  const handleSendLowStockAlert = async () => {
    setSendingAlert(true);
    try {
      const res = await authedFetch("/api/email/low-stock-alert", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        if (data.lowStockCount === 0) {
          toast({ title: "No low-stock items", description: "All products are well-stocked — no alert needed" });
        } else {
          toast({ title: "✅ Alert sent!", description: `${data.lowStockCount} low-stock products reported to ${data.sentTo}` });
        }
      } else {
        toast({ title: "Alert failed", description: data.error, variant: "destructive" });
      }
    } catch (e: any) { toast({ title: "Network error", description: e?.message, variant: "destructive" }); } finally { setSendingAlert(false); }
  };

  const handleSendDailySummary = async () => {
    setSendingSummary(true);
    try {
      const res = await authedFetch("/api/email/daily-summary", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        toast({ title: "✅ Daily summary sent!", description: `Today: GHS ${data.today.total.toFixed(2)} (${data.today.count} sales) → ${data.sentTo}` });
      } else {
        toast({ title: "Summary failed", description: data.error, variant: "destructive" });
      }
    } catch (e: any) { toast({ title: "Network error", description: e?.message, variant: "destructive" }); } finally { setSendingSummary(false); }
  };

  return (
    <div className="min-h-[100dvh] bg-slate-50 flex flex-col lg:h-screen">
      <header className="flex-shrink-0 gradient-premium-emerald text-white shadow-lg sticky top-0 z-30">
        <div className="flex items-center justify-between px-3 sm:px-4 py-3 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={onBack} className="h-9 w-9 rounded-lg bg-white/15 hover:bg-white/25 flex items-center justify-center transition flex-shrink-0" aria-label="Back"><ArrowLeft className="h-5 w-5" /></button>
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="h-9 w-9 rounded-xl bg-white/15 ring-1 ring-white/30 flex items-center justify-center flex-shrink-0"><MailIcon className="h-5 w-5" /></div>
              <div className="min-w-0">
                <h1 className="text-base sm:text-lg font-bold tracking-tight truncate">Email System</h1>
                <p className="text-[10px] sm:text-xs text-emerald-50/90 truncate">{COMPANY.name}</p>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 px-3 sm:px-4 pb-2 overflow-x-auto scrollbar-hide">
          {([{ id: "inbox" as const, icon: Inbox, short: "Inbox" }, { id: "compose" as const, icon: Send, short: "Compose" }, { id: "templates" as const, icon: FileText, short: "Templates" }, { id: "settings" as const, icon: SettingsIcon, short: "Settings" }]).map(t => {
            const Icon = t.icon;
            return <button key={t.id} onClick={() => setTab(t.id)} className={cn("flex items-center gap-1.5 px-3 sm:px-4 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap flex-shrink-0", tab === t.id ? "bg-white text-emerald-700 shadow-md" : "bg-white/15 text-white hover:bg-white/25")}><Icon className="h-3.5 w-3.5" />{t.short}</button>;
          })}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-3 sm:p-4 max-w-4xl mx-auto w-full pb-24 lg:pb-4">
        {tab === "inbox" && (
          <div className="space-y-2">
            <div className="flex items-center justify-between mb-2 gap-2">
              <h2 className="text-sm font-bold text-slate-700">Inbox ({emails.length})</h2>
              <div className="flex items-center gap-2">
                <EmailSyncButton onSynced={loadEmails} />
                <button onClick={loadEmails} className="h-8 w-8 rounded-lg bg-white hover:bg-slate-100 text-slate-600 flex items-center justify-center transition ring-1 ring-slate-200" title="Refresh"><RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} /></button>
              </div>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-1 rounded-full bg-blue-100 text-blue-700"><span className="h-1.5 w-1.5 rounded-full bg-blue-500" />Received: {emails.filter(e => e.direction === "received").length}</span>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-1 rounded-full bg-emerald-100 text-emerald-700"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />Sent: {emails.filter(e => e.direction !== "received").length}</span>
            </div>
            {loading ? (
              <div className="text-center py-12"><Loader2 className="h-8 w-8 animate-spin text-emerald-500 mx-auto mb-2" /><p className="text-xs text-slate-400">Loading emails…</p></div>
            ) : emails.length === 0 ? (
              <div className="card-premium p-8 text-center"><Inbox className="h-10 w-10 text-slate-300 mx-auto mb-3" /><p className="text-sm text-slate-500 font-medium">No emails yet</p><p className="text-xs text-slate-400 mt-1">Click "Sync Now" to fetch emails from Gmail, or compose a new email</p></div>
            ) : (
              emails.map(email => {
                const isReceived = email.direction === "received";
                return (
                  <div key={email.id} onClick={() => setSelectedEmail(selectedEmail?.id === email.id ? null : email)} className={cn("card-premium p-3 cursor-pointer hover:shadow-md transition", isReceived && "ring-2 ring-blue-200")}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className={cn("h-2 w-2 rounded-full flex-shrink-0", isReceived ? "bg-blue-500" : email.status === "failed" ? "bg-rose-500" : "bg-emerald-500")} />
                          <span className="text-xs font-bold text-slate-700 truncate">{email.subject}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">{isReceived ? <>From: <span className="font-semibold text-slate-700">{email.from || "Unknown"}</span></> : <>To: <span className="font-semibold text-slate-700">{email.to}</span></>}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{new Date(email.createdAt).toLocaleString('en-GB')}</div>
                      </div>
                      <span className={cn("text-[9px] font-bold uppercase px-2 py-0.5 rounded-full flex-shrink-0", isReceived ? "bg-blue-100 text-blue-700" : email.status === "failed" ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700")}>{isReceived ? "Received" : email.status}</span>
                    </div>
                    {selectedEmail?.id === email.id && (
                      <div className="mt-3 pt-3 border-t border-slate-100">
                        {email.cc && <div className="text-[11px] text-slate-500 mb-1">CC: {email.cc}</div>}
                        {email.errorMessage && <div className="text-[11px] text-rose-600 mb-2 font-mono bg-rose-50 p-2 rounded">{email.errorMessage}</div>}
                        <div className="text-xs text-slate-600 whitespace-pre-wrap bg-slate-50 p-3 rounded-lg max-h-48 overflow-y-auto">{email.body}</div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {tab === "compose" && (
          <div className="card-premium p-4 sm:p-5 space-y-3">
            <div><label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">To *</label><input type="email" value={composeTo} onChange={(e) => setComposeTo(e.target.value)} placeholder="recipient@example.com" className="input-premium w-full h-11 px-4 text-sm" /></div>
            <div><label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">CC (optional)</label><input type="email" value={composeCc} onChange={(e) => setComposeCc(e.target.value)} placeholder="cc@example.com" className="input-premium w-full h-11 px-4 text-sm" /></div>
            <div><label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Subject *</label><input type="text" value={composeSubject} onChange={(e) => setComposeSubject(e.target.value)} placeholder="Email subject" className="input-premium w-full h-11 px-4 text-sm" /></div>
            <div>
              <div className="flex items-center justify-between mb-1.5"><label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Message</label><button onClick={() => setShowHtmlSource(!showHtmlSource)} className="text-[10px] font-semibold text-slate-500 hover:text-emerald-600 transition flex items-center gap-1">{showHtmlSource ? <><Eye className="h-3 w-3" /> Visual</> : <><Code className="h-3 w-3" /> HTML</>}</button></div>
              <div className="flex items-center gap-0.5 flex-wrap bg-slate-100 rounded-t-xl px-2 py-1.5 border border-b-0 border-slate-200">
                <ToolbarButton onClick={() => execCmd("bold")} title="Bold"><Bold className="h-4 w-4" /></ToolbarButton>
                <ToolbarButton onClick={() => execCmd("italic")} title="Italic"><Italic className="h-4 w-4" /></ToolbarButton>
                <ToolbarButton onClick={() => execCmd("underline")} title="Underline"><Underline className="h-4 w-4" /></ToolbarButton>
                <Divider />
                <ToolbarButton onClick={() => execCmd("insertUnorderedList")} title="Bullet List"><List className="h-4 w-4" /></ToolbarButton>
                <ToolbarButton onClick={() => execCmd("insertOrderedList")} title="Numbered List"><ListOrdered className="h-4 w-4" /></ToolbarButton>
                <Divider />
                <ToolbarButton onClick={() => execCmd("justifyLeft")} title="Align Left"><AlignLeft className="h-4 w-4" /></ToolbarButton>
                <ToolbarButton onClick={() => execCmd("justifyCenter")} title="Align Center"><AlignCenter className="h-4 w-4" /></ToolbarButton>
                <ToolbarButton onClick={() => execCmd("justifyRight")} title="Align Right"><AlignRight className="h-4 w-4" /></ToolbarButton>
                <Divider />
                <ToolbarButton onClick={insertLink} title="Insert Link"><LinkIcon className="h-4 w-4" /></ToolbarButton>
                <ToolbarButton onClick={() => execCmd("formatBlock", "<h3>")} title="Heading">H3</ToolbarButton>
                <ToolbarButton onClick={() => execCmd("formatBlock", "<p>")} title="Paragraph">P</ToolbarButton>
                <Divider />
                {["✅", "❌", "⚠️", "📊", "💰", "📦", "🙏", "📞"].map(emoji => <ToolbarButton key={emoji} onClick={() => insertEmoji(emoji)} title={emoji}><span className="text-sm">{emoji}</span></ToolbarButton>)}
              </div>
              {showHtmlSource ? (
                <textarea value={composeHtml} onChange={(e) => { setComposeHtml(e.target.value); if (editorRef.current) editorRef.current.innerHTML = e.target.value; }} rows={10} className="input-premium w-full px-4 py-3 text-xs font-mono resize-y rounded-t-none" placeholder="<p>Write HTML here…</p>" />
              ) : (
                <div ref={editorRef} contentEditable suppressContentEditableWarning onInput={() => setComposeHtml(editorRef.current?.innerHTML || "")} className="input-premium w-full px-4 py-3 text-sm min-h-[200px] rounded-t-none prose prose-sm max-w-none focus:outline-none" style={{ lineHeight: "1.6" }} data-placeholder="Write your email here…" />
              )}
            </div>
            <div>
              <input ref={fileInputRef} type="file" multiple onChange={handleFileSelect} className="hidden" accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip" />
              {attachments.length > 0 && (
                <div className="space-y-1.5 mb-2">
                  {attachments.map((att, i) => (
                    <div key={i} className="flex items-center gap-2 bg-slate-50 rounded-lg p-2 ring-1 ring-slate-200">
                      <Paperclip className="h-4 w-4 text-slate-400 flex-shrink-0" />
                      <div className="min-w-0 flex-1"><div className="text-xs font-medium text-slate-700 truncate">{att.filename}</div><div className="text-[10px] text-slate-400">{formatFileSize(att.size)}</div></div>
                      <button onClick={() => removeAttachment(i)} className="h-7 w-7 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 flex items-center justify-center transition flex-shrink-0"><X className="h-3.5 w-3.5" /></button>
                    </div>
                  ))}
                </div>
              )}
              <button onClick={() => fileInputRef.current?.click()} className="w-full h-10 rounded-xl border-2 border-dashed border-slate-300 hover:border-emerald-400 hover:bg-emerald-50/50 text-slate-500 hover:text-emerald-600 text-xs font-semibold transition flex items-center justify-center gap-2"><Paperclip className="h-4 w-4" /> Attach Files (max 5MB each)</button>
            </div>
            <button onClick={handleSend} disabled={sending || !composeTo || !composeSubject} className="btn-premium w-full h-12 rounded-xl gradient-premium-emerald hover:shadow-glow-emerald disabled:opacity-50 text-white text-sm font-bold flex items-center justify-center gap-2 transition">{sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}{sending ? "Sending…" : `Send Email${attachments.length > 0 ? ` (${attachments.length} attachment${attachments.length > 1 ? "s" : ""})` : ""}`}</button>
          </div>
        )}

        {tab === "templates" && <EmailTemplates onUseTemplate={(t) => {
          setComposeSubject(t.subject);
          setComposeHtml(t.body);
          setTab("compose");
          // Wait for the compose tab to render, then set the editor content
          setTimeout(() => {
            if (editorRef.current) {
              editorRef.current.innerHTML = t.body;
            }
          }, 100);
        }} />}

        {tab === "settings" && (
          <div className="space-y-4">
            <div className="card-premium p-4">
              <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2"><MailIcon className="h-4 w-4 text-emerald-600" /> Email Provider</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {SMTP_PRESETS.map(preset => (
                  <button key={preset.id} onClick={() => applyPreset(preset.id)} className={cn("flex flex-col items-start gap-1 p-3 rounded-xl text-left transition ring-1", selectedPreset === preset.id ? "bg-emerald-50 ring-2 ring-emerald-400 shadow-md" : "bg-white ring-slate-200 hover:ring-emerald-200 hover:bg-emerald-50/30")}>
                    <span className="text-xl">{preset.icon}</span><span className="text-xs font-bold text-slate-800">{preset.name}</span><span className="text-[10px] text-slate-500 leading-tight">{preset.description}</span>
                  </button>
                ))}
              </div>
              {selectedPreset !== "custom" && SMTP_PRESETS.find(p => p.id === selectedPreset)?.helpUrl && (
                <div className="mt-3 bg-blue-50 rounded-xl p-3 ring-1 ring-blue-200">
                  <div className="text-[11px] font-bold text-blue-800 mb-1">📋 Setup Instructions</div>
                  <div className="text-[11px] text-blue-600 mb-2">{SMTP_PRESETS.find(p => p.id === selectedPreset)?.helpText}</div>
                  <a href={SMTP_PRESETS.find(p => p.id === selectedPreset)?.helpUrl} target="_blank" rel="noopener noreferrer" className="text-[11px] text-blue-600 font-semibold hover:underline">Open setup page →</a>
                </div>
              )}
            </div>
            <div className="card-premium p-4 space-y-3">
              <h3 className="text-sm font-bold text-slate-800 mb-1 flex items-center gap-2"><SettingsIcon className="h-4 w-4 text-slate-600" /> SMTP Configuration</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2"><label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">SMTP Host</label><input type="text" value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} placeholder="smtp.gmail.com" className="input-premium w-full h-11 px-4 text-sm" /></div>
                <div><label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Port</label><input type="number" value={smtpPort} onChange={(e) => setSmtpPort(e.target.value)} placeholder="587" className="input-premium w-full h-11 px-4 text-sm" /></div>
                <div><label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Security</label><div className="h-11 px-4 rounded-xl bg-slate-100 text-slate-600 text-sm font-semibold flex items-center">{smtpPort === "465" ? "🔒 SSL/TLS" : smtpPort === "587" ? "🔐 STARTTLS" : "Custom"}</div></div>
                <div className="col-span-2"><label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">From Email</label><input type="email" value={smtpFrom} onChange={(e) => setSmtpFrom(e.target.value)} placeholder="noreply@yourdomain.com" className="input-premium w-full h-11 px-4 text-sm" /></div>
                <div className="col-span-2"><label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Username (usually your email)</label><input type="text" value={smtpUser} onChange={(e) => setSmtpUser(e.target.value)} placeholder="your.email@gmail.com" className="input-premium w-full h-11 px-4 text-sm" /></div>
                <div className="col-span-2"><label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Password / App Password</label><input type="password" value={smtpPass} onChange={(e) => setSmtpPass(e.target.value)} placeholder="••••••••" className="input-premium w-full h-11 px-4 text-sm" />{!settingsLoaded && <p className="text-[10px] text-slate-400 mt-1">Loading current settings…</p>}</div>
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={handleSaveSettings} disabled={savingSettings} className="btn-premium flex-1 h-11 rounded-xl gradient-premium-emerald hover:shadow-glow-emerald disabled:opacity-50 text-white text-sm font-bold flex items-center justify-center gap-2 transition">{savingSettings ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save</button>
                <button onClick={handleTestEmail} disabled={testing} className="btn-premium flex-1 h-11 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-bold flex items-center justify-center gap-2 transition">{testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send Test</button>
              </div>
            </div>

            {/* Quick Actions — Automated Email Alerts */}
            <div className="card-premium p-4">
              <h3 className="text-sm font-bold text-slate-800 mb-1 flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-500" /> Automated Email Alerts</h3>
              <p className="text-[11px] text-slate-500 mb-3">Send yourself instant alerts or daily summaries. Can also be triggered automatically via cron-job.org.</p>
              <div className="grid grid-cols-1 gap-2">
                <button
                  onClick={handleSendLowStockAlert}
                  disabled={sendingAlert}
                  className="btn-premium w-full h-11 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 disabled:opacity-50 text-white text-sm font-bold flex items-center justify-center gap-2 transition"
                >
                  {sendingAlert ? <Loader2 className="h-4 w-4 animate-spin" /> : <AlertTriangle className="h-4 w-4" />}
                  {sendingAlert ? "Sending..." : "Send Low-Stock Alert Now"}
                </button>
                <button
                  onClick={handleSendDailySummary}
                  disabled={sendingSummary}
                  className="btn-premium w-full h-11 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 disabled:opacity-50 text-white text-sm font-bold flex items-center justify-center gap-2 transition"
                >
                  {sendingSummary ? <Loader2 className="h-4 w-4 animate-spin" /> : <BarChart3 className="h-4 w-4" />}
                  {sendingSummary ? "Sending..." : "Send Daily Summary Now"}
                </button>
              </div>
              <p className="text-[10px] text-slate-400 mt-2 text-center">
                💡 Daily summary auto-sends at 9 PM (configure via cron-job.org with schedule "0 21 * * *")
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function ToolbarButton({ onClick, title, children }: { onClick: () => void; title: string; children: React.ReactNode; key?: string }) {
  return <button type="button" onClick={onClick} title={title} className="h-8 w-8 rounded-lg hover:bg-white text-slate-600 hover:text-emerald-600 flex items-center justify-center transition text-xs font-bold">{children}</button>;
}
function Divider() { return <div className="w-px h-5 bg-slate-300 mx-0.5" />; }
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => { const result = reader.result as string; const base64 = result.split(",")[1] || result; resolve(base64); };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ===== Email Templates Component =====
function EmailTemplates({ onUseTemplate }: { onUseTemplate: (t: any) => void }) {
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const { toast } = useToast();

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authedFetch("/api/email/templates");
      if (res.ok) {
        const data = await res.json();
        setTemplates(data.templates || []);
      }
    } catch (e: any) {
      toast({ title: "Failed to load templates", description: e?.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { loadTemplates(); }, [loadTemplates]);

  const categories = ["all", ...Array.from(new Set(templates.map(t => t.category || "custom")))];
  const filtered = filter === "all" ? templates : templates.filter(t => (t.category || "custom") === filter);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-bold text-slate-700">Email Templates ({templates.length})</h2>
        <button onClick={loadTemplates} className="h-8 w-8 rounded-lg bg-white hover:bg-slate-100 text-slate-600 flex items-center justify-center transition ring-1 ring-slate-200" title="Refresh">
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
        </button>
      </div>

      <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide pb-2">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap flex-shrink-0",
              filter === cat ? "bg-emerald-600 text-white shadow-md" : "bg-white text-slate-600 hover:bg-slate-100 ring-1 ring-slate-200"
            )}
          >
            {String(cat).charAt(0).toUpperCase() + String(cat).slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-500 mx-auto mb-2" />
          <p className="text-xs text-slate-400">Loading templates…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card-premium p-8 text-center">
          <FileText className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500 font-medium">No templates yet</p>
          <p className="text-xs text-slate-400 mt-1">Templates are pre-written emails for common scenarios</p>
        </div>
      ) : (
        filtered.map(t => (
          <div key={t.id} className="card-premium p-3">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className={cn("text-[9px] font-bold uppercase px-2 py-0.5 rounded-full",
                    t.category === "customer" ? "bg-blue-100 text-blue-700" :
                    t.category === "supplier" ? "bg-purple-100 text-purple-700" : "bg-slate-100 text-slate-600")}>
                    {t.category || "custom"}
                  </span>
                  <h3 className="text-xs font-bold text-slate-800 truncate">{t.name}</h3>
                </div>
                <p className="text-[11px] text-slate-600 font-medium truncate">{t.subject}</p>
              </div>
            </div>
            <div className="text-[10px] text-slate-500 bg-slate-50 p-2 rounded-lg max-h-24 overflow-y-auto mb-2"
                 dangerouslySetInnerHTML={{ __html: t.body.substring(0, 200) + (t.body.length > 200 ? "..." : "") }} />
            <button
              onClick={() => onUseTemplate(t)}
              className="w-full h-8 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-1 transition"
            >
              <Send className="h-3 w-3" /> Use Template
            </button>
          </div>
        ))
      )}
    </div>
  );
}
