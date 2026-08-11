"use client";

import { authedFetch } from "@/lib/client-auth";
import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, FileText, Loader2, Search, Printer, Mail, X,
  AlertCircle, User, Send,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { COMPANY, formatGHS } from "@/lib/pos-data";

interface Customer {
  id: string;
  name: string;
  phone: string;
  mobile: string;
  email: string;
  address: string;
  city: string;
  group: string;
  balance: number;
  creditLimit: number;
  active: boolean;
}

interface StatementTxn {
  date: string;
  type: "sale" | "payment";
  ref: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
  dueDate: string | null;
  notes: string;
}

interface StatementData {
  customer: Customer;
  period: { from: string; to: string };
  openingBalance: number;
  closingBalance: number;
  totalDebits: number;
  totalCredits: number;
  transactionCount: number;
  transactions: StatementTxn[];
  aging: {
    current: number;
    days1to30: number;
    days31to60: number;
    days60plus: number;
  };
}

interface Props {
  onBack: () => void;
}

export function CustomerStatements({ onBack }: Props) {
  const { toast } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [from, setFrom] = useState(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [statement, setStatement] = useState<StatementData | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingCustomers, setLoadingCustomers] = useState(true);
  const [search, setSearch] = useState("");
  const [showEmailModal, setShowEmailModal] = useState(false);

  // Fetch customer list
  useEffect(() => {
    authedFetch("/api/customers?limit=500", { credentials: "include" })
      .then(r => r.json())
      .then(data => {
        setCustomers(data.customers || []);
      })
      .catch(e => {
        console.error(e);
        toast({ title: "Failed to load customers", variant: "destructive" });
      })
      .finally(() => setLoadingCustomers(false));
  }, []);

  // Filter customers by search
  const filteredCustomers = useMemo(() => {
    if (!search) return customers;
    const q = search.toLowerCase();
    return customers.filter(c =>
      c.name.toLowerCase().includes(q) ||
      (c.phone || "").toLowerCase().includes(q) ||
      (c.mobile || "").toLowerCase().includes(q)
    );
  }, [customers, search]);

  // Generate statement
  const generateStatement = async (customerId?: string) => {
    const id = customerId || selectedCustomerId;
    if (!id) {
      toast({ title: "Select a customer first", variant: "destructive" });
      return;
    }
    setLoading(true);
    setStatement(null);
    try {
      const res = await fetch(
        `/api/reports/customer-statement?customerId=${id}&from=${from}&to=${to}`,
        { credentials: "include" }
      );
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.error || "Failed");
      }
      const data = await res.json();
      setStatement(data);
    } catch (e: any) {
      toast({ title: "Failed to generate statement", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // Print statement (opens print dialog)
  const handlePrint = () => {
    if (!statement) return;
    const html = buildPrintableHTML(statement);
    const w = window.open("", "_blank");
    if (!w) {
      toast({ title: "Pop-up blocked", description: "Allow pop-ups to print the statement", variant: "destructive" });
      return;
    }
    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 500);
  };

  const buildPrintableHTML = (s: StatementData): string => {
    const rows = s.transactions.map(t => `
      <tr>
        <td>${new Date(t.date).toLocaleDateString("en-GB")}</td>
        <td>${t.ref}</td>
        <td>${t.description}</td>
        <td style="text-align:right">${t.debit > 0 ? formatGHS(t.debit) : "—"}</td>
        <td style="text-align:right">${t.credit > 0 ? formatGHS(t.credit) : "—"}</td>
        <td style="text-align:right;font-weight:bold">${formatGHS(t.balance)}</td>
      </tr>
    `).join("");

    return `<!DOCTYPE html>
<html>
<head>
<title>Statement — ${s.customer.name}</title>
<style>
  body { font-family: Arial, Helvetica, sans-serif; padding: 40px; color: #1e293b; }
  .header { display: flex; justify-content: space-between; border-bottom: 2px solid #047857; padding-bottom: 12px; margin-bottom: 20px; }
  .company { font-size: 22px; font-weight: bold; color: #047857; }
  .meta { font-size: 10px; color: #64748b; text-align: right; }
  .customer-box { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 12px; margin-bottom: 16px; }
  .customer-name { font-size: 16px; font-weight: bold; }
  .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 16px; }
  .summary-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px; }
  .summary-label { font-size: 9px; color: #64748b; text-transform: uppercase; font-weight: bold; }
  .summary-value { font-size: 14px; font-weight: bold; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th { background: #047857; color: white; padding: 8px; text-align: left; font-size: 10px; text-transform: uppercase; }
  td { padding: 6px 8px; border-bottom: 1px solid #e2e8f0; }
  tr:nth-child(even) { background: #f8fafc; }
  .aging { margin-top: 16px; background: #fef3c7; border: 1px solid #fde68a; border-radius: 8px; padding: 12px; }
  .aging-title { font-weight: bold; font-size: 12px; margin-bottom: 8px; }
  .aging-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
  .footer { margin-top: 24px; font-size: 9px; color: #64748b; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 12px; }
  @media print { body { padding: 20px; } }
</style>
</head>
<body>
  <div class="header">
    <div>
      <div class="company">${COMPANY.name}</div>
      <div style="font-size: 10px; color: #64748b;">${COMPANY.address} · ${COMPANY.contact}</div>
    </div>
    <div class="meta">
      <div style="font-size: 14px; font-weight: bold; color: #1e293b;">ACCOUNT STATEMENT</div>
      <div>Period: ${new Date(s.period.from).toLocaleDateString("en-GB")} to ${new Date(s.period.to).toLocaleDateString("en-GB")}</div>
      <div>Generated: ${new Date().toLocaleString("en-GB")}</div>
    </div>
  </div>

  <div class="customer-box">
    <div class="customer-name">${s.customer.name}</div>
    <div style="font-size: 11px; color: #475569;">
      ${s.customer.address ? s.customer.address + " · " : ""}${s.customer.city || ""}
      ${s.customer.phone ? " · Tel: " + s.customer.phone : ""}
      ${s.customer.mobile ? " · Mobile: " + s.customer.mobile : ""}
      ${s.customer.email ? " · Email: " + s.customer.email : ""}
    </div>
  </div>

  <div class="summary">
    <div class="summary-card">
      <div class="summary-label">Opening Balance</div>
      <div class="summary-value">${formatGHS(s.openingBalance)}</div>
    </div>
    <div class="summary-card">
      <div class="summary-label">Total Invoiced</div>
      <div class="summary-value" style="color: #dc2626;">${formatGHS(s.totalDebits)}</div>
    </div>
    <div class="summary-card">
      <div class="summary-label">Total Paid</div>
      <div class="summary-value" style="color: #059669;">${formatGHS(s.totalCredits)}</div>
    </div>
    <div class="summary-card" style="background: #fef3c7; border-color: #fde68a;">
      <div class="summary-label">Closing Balance</div>
      <div class="summary-value" style="color: ${s.closingBalance > 0 ? "#dc2626" : "#059669"};">${formatGHS(s.closingBalance)}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Date</th>
        <th>Reference</th>
        <th>Description</th>
        <th style="text-align:right">Debit</th>
        <th style="text-align:right">Credit</th>
        <th style="text-align:right">Balance</th>
      </tr>
    </thead>
    <tbody>
      ${rows || '<tr><td colspan="6" style="text-align:center;color:#94a3b8;padding:20px;">No transactions in this period</td></tr>'}
    </tbody>
  </table>

  <div class="aging">
    <div class="aging-title">Aging Breakdown (Outstanding Balance)</div>
    <div class="aging-grid">
      <div class="summary-card" style="background:white;">
        <div class="summary-label">Current</div>
        <div class="summary-value">${formatGHS(s.aging.current)}</div>
      </div>
      <div class="summary-card" style="background:white;">
        <div class="summary-label">1-30 days</div>
        <div class="summary-value" style="color:#d97706;">${formatGHS(s.aging.days1to30)}</div>
      </div>
      <div class="summary-card" style="background:white;">
        <div class="summary-label">31-60 days</div>
        <div class="summary-value" style="color:#ea580c;">${formatGHS(s.aging.days31to60)}</div>
      </div>
      <div class="summary-card" style="background:white;">
        <div class="summary-label">60+ days</div>
        <div class="summary-value" style="color:#dc2626;">${formatGHS(s.aging.days60plus)}</div>
      </div>
    </div>
  </div>

  <div class="footer">
    ${COMPANY.name} · ${COMPANY.address} · ${COMPANY.contact}<br>
    This is a computer-generated statement. Please contact us if you have any questions about your account.
  </div>
</body>
</html>`;
  };

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-slate-50 to-violet-50/30">
      {/* Header */}
      <header className="flex-shrink-0 bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 text-white shadow-lg">
        <div className="flex items-center justify-between px-4 sm:px-6 py-3">
          <div className="flex items-center gap-4 min-w-0">
            <button onClick={onBack} className="h-9 w-9 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition flex-shrink-0">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="h-9 w-9 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center ring-1 ring-white/20 flex-shrink-0">
                <FileText className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="font-bold text-base leading-tight">Customer Statements</div>
                <div className="text-[10px] text-violet-100/90 truncate">{COMPANY.name} · Monthly account statements for credit customers</div>
              </div>
            </div>
          </div>
          {statement && (
            <div className="flex items-center gap-2">
              <button onClick={() => setShowEmailModal(true)} className="h-9 px-3 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-bold flex items-center gap-1.5">
                <Mail className="h-4 w-4" /> <span className="hidden sm:inline">Email</span>
              </button>
              <button onClick={handlePrint} className="h-9 px-3 rounded-lg bg-white text-violet-700 hover:bg-violet-50 text-xs font-bold flex items-center gap-1.5">
                <Printer className="h-4 w-4" /> <span className="hidden sm:inline">Print / PDF</span>
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Customer + date pickers */}
      <div className="flex-shrink-0 bg-white border-b border-slate-200 shadow-sm px-4 sm:px-6 py-2 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search customer by name or phone…"
            className="w-full h-8 pl-8 pr-3 rounded-lg bg-slate-100 text-xs outline-none focus:ring-2 focus:ring-violet-400"
          />
        </div>
        <select
          value={selectedCustomerId}
          onChange={(e) => {
            setSelectedCustomerId(e.target.value);
            if (e.target.value) generateStatement(e.target.value);
          }}
          className="h-8 px-2 rounded-lg bg-slate-100 text-xs outline-none min-w-[180px]"
        >
          <option value="">Select customer…</option>
          {filteredCustomers.map(c => (
            <option key={c.id} value={c.id}>
              {c.name}{c.balance > 0 ? ` · owes ${formatGHS(c.balance)}` : ""}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-1">
          <label className="text-[10px] font-bold text-slate-500">From:</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-8 px-2 rounded-lg bg-slate-100 text-xs outline-none" />
        </div>
        <div className="flex items-center gap-1">
          <label className="text-[10px] font-bold text-slate-500">To:</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-8 px-2 rounded-lg bg-slate-100 text-xs outline-none" />
        </div>
        <button
          onClick={() => generateStatement()}
          disabled={!selectedCustomerId || loading}
          className="h-8 px-3 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white text-xs font-bold disabled:opacity-50"
        >
          Generate
        </button>
      </div>

      {/* Content */}
      <main className="flex-1 overflow-hidden p-3 sm:p-6">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <Loader2 className="h-10 w-10 animate-spin text-violet-500" />
          </div>
        ) : !statement ? (
          <div className="h-full bg-white rounded-2xl shadow-lg ring-1 ring-slate-200/60 flex items-center justify-center">
            <div className="text-center">
              <FileText className="h-12 w-12 mx-auto mb-3 text-violet-400 opacity-60" />
              <p className="text-sm font-bold text-slate-700">Select a customer to generate a statement</p>
              <p className="text-xs text-slate-400 mt-1">Choose a customer from the dropdown above, then click Generate</p>
            </div>
          </div>
        ) : (
          <div className="h-full bg-white rounded-2xl shadow-lg ring-1 ring-slate-200/60 overflow-hidden flex flex-col">
            {/* Statement header */}
            <div className="flex-shrink-0 px-5 py-3 bg-gradient-to-r from-slate-50 to-white border-b border-slate-200">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-base font-bold text-slate-800">{statement.customer.name}</div>
                  <div className="text-[10px] text-slate-500">
                    {[statement.customer.address, statement.customer.city].filter(Boolean).join(", ")}
                    {statement.customer.phone && ` · ${statement.customer.phone}`}
                    {statement.customer.email && ` · ${statement.customer.email}`}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-slate-500 uppercase font-bold">Statement Period</div>
                  <div className="text-xs font-mono text-slate-700">
                    {new Date(statement.period.from).toLocaleDateString("en-GB")} → {new Date(statement.period.to).toLocaleDateString("en-GB")}
                  </div>
                </div>
              </div>
            </div>

            {/* Summary cards */}
            <div className="flex-shrink-0 grid grid-cols-2 sm:grid-cols-4 gap-2 p-4 bg-slate-50 border-b border-slate-200">
              <div className="bg-white rounded-lg ring-1 ring-slate-200 p-2">
                <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Opening Balance</div>
                <div className="text-sm font-bold text-slate-800">{formatGHS(statement.openingBalance)}</div>
              </div>
              <div className="bg-white rounded-lg ring-1 ring-slate-200 p-2">
                <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Total Invoiced</div>
                <div className="text-sm font-bold text-rose-600">+{formatGHS(statement.totalDebits)}</div>
              </div>
              <div className="bg-white rounded-lg ring-1 ring-slate-200 p-2">
                <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Total Paid</div>
                <div className="text-sm font-bold text-emerald-600">-{formatGHS(statement.totalCredits)}</div>
              </div>
              <div className={cn("rounded-lg ring-1 p-2", statement.closingBalance > 0 ? "bg-rose-50 ring-rose-200" : "bg-emerald-50 ring-emerald-200")}>
                <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Closing Balance</div>
                <div className={cn("text-sm font-bold", statement.closingBalance > 0 ? "text-rose-700" : "text-emerald-700")}>
                  {formatGHS(statement.closingBalance)}
                </div>
              </div>
            </div>

            {/* Aging breakdown */}
            <div className="flex-shrink-0 px-4 py-2 bg-amber-50 border-b border-amber-200">
              <div className="text-[10px] font-bold uppercase tracking-wider text-amber-700 mb-1">Aging Breakdown</div>
              <div className="grid grid-cols-4 gap-2">
                <div className="bg-white rounded px-2 py-1">
                  <div className="text-[9px] text-slate-500">Current</div>
                  <div className="text-xs font-mono font-bold text-slate-700">{formatGHS(statement.aging.current)}</div>
                </div>
                <div className="bg-white rounded px-2 py-1">
                  <div className="text-[9px] text-slate-500">1-30 days</div>
                  <div className="text-xs font-mono font-bold text-amber-600">{formatGHS(statement.aging.days1to30)}</div>
                </div>
                <div className="bg-white rounded px-2 py-1">
                  <div className="text-[9px] text-slate-500">31-60 days</div>
                  <div className="text-xs font-mono font-bold text-orange-600">{formatGHS(statement.aging.days31to60)}</div>
                </div>
                <div className="bg-white rounded px-2 py-1">
                  <div className="text-[9px] text-slate-500">60+ days</div>
                  <div className="text-xs font-mono font-bold text-rose-600">{formatGHS(statement.aging.days60plus)}</div>
                </div>
              </div>
            </div>

            {/* Transactions table */}
            <div className="flex-1 overflow-auto scroll-premium">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-slate-800 text-white text-[10px] uppercase tracking-wide z-10">
                  <tr>
                    <th className="text-left px-3 py-2.5 font-semibold">Date</th>
                    <th className="text-left px-2 py-2.5 font-semibold">Reference</th>
                    <th className="text-left px-2 py-2.5 font-semibold">Description</th>
                    <th className="text-right px-2 py-2.5 font-semibold">Debit</th>
                    <th className="text-right px-2 py-2.5 font-semibold">Credit</th>
                    <th className="text-right px-2 py-2.5 font-semibold">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {statement.transactions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                        No transactions in this period
                      </td>
                    </tr>
                  ) : statement.transactions.map((t, i) => (
                    <tr key={i} className={cn("hover:bg-slate-50", t.type === "payment" && "bg-emerald-50/30")}>
                      <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{new Date(t.date).toLocaleDateString("en-GB")}</td>
                      <td className="px-2 py-2 font-mono text-slate-700">{t.ref}</td>
                      <td className="px-2 py-2 text-slate-600">
                        {t.description}
                        {t.dueDate && <span className="text-[9px] text-rose-500 ml-1">(due {new Date(t.dueDate).toLocaleDateString("en-GB")})</span>}
                      </td>
                      <td className="px-2 py-2 text-right font-mono text-rose-600">{t.debit > 0 ? formatGHS(t.debit) : "—"}</td>
                      <td className="px-2 py-2 text-right font-mono text-emerald-600">{t.credit > 0 ? formatGHS(t.credit) : "—"}</td>
                      <td className={cn("px-2 py-2 text-right font-mono font-bold", t.balance > 0 ? "text-rose-700" : "text-slate-600")}>
                        {formatGHS(t.balance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="flex-shrink-0 px-4 py-2 bg-slate-50 border-t border-slate-200 text-[10px] text-slate-500 flex items-center justify-between">
              <span>{statement.transactionCount} transaction{statement.transactionCount === 1 ? "" : "s"} in period</span>
              {statement.closingBalance > 0 && (
                <span className="text-rose-600 font-bold">
                  Amount due: {formatGHS(statement.closingBalance)}
                </span>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Email modal */}
      {showEmailModal && statement && (
        <EmailModal
          customer={statement.customer}
          statement={statement}
          onClose={() => setShowEmailModal(false)}
        />
      )}
    </div>
  );
}

function EmailModal({ customer, statement, onClose }: { customer: Customer; statement: StatementData; onClose: () => void }) {
  const { toast } = useToast();
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!customer.email) {
      toast({ title: "No email on file", description: "Add an email to this customer first", variant: "destructive" });
      return;
    }
    setSending(true);
    // Use mailto: as a simple fallback — opens the user's email client
    const subject = `Account Statement — ${customer.name} — ${new Date(statement.period.from).toLocaleDateString("en-GB")} to ${new Date(statement.period.to).toLocaleDateString("en-GB")}`;
    const body = `Dear ${customer.name},

Please find your account statement below for the period ${new Date(statement.period.from).toLocaleDateString("en-GB")} to ${new Date(statement.period.to).toLocaleDateString("en-GB")}.

OPENING BALANCE: ${formatGHS(statement.openingBalance)}
TOTAL INVOICED: ${formatGHS(statement.totalDebits)}
TOTAL PAID: ${formatGHS(statement.totalCredits)}
CLOSING BALANCE: ${formatGHS(statement.closingBalance)}

Aging Breakdown:
  Current: ${formatGHS(statement.aging.current)}
  1-30 days: ${formatGHS(statement.aging.days1to30)}
  31-60 days: ${formatGHS(statement.aging.days31to60)}
  60+ days: ${formatGHS(statement.aging.days60plus)}

${statement.closingBalance > 0 ? `Please arrange payment of ${formatGHS(statement.closingBalance)} at your earliest convenience. If you have already paid, please disregard this notice.` : "Your account is fully settled. Thank you for your business!"}

Best regards,
${COMPANY.name}
${COMPANY.address} · ${COMPANY.contact}`;

    const mailto = `mailto:${customer.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailto;
    setSending(false);
    toast({ title: "Email client opened", description: `Draft email prepared for ${customer.email}` });
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
      >
        <div className="flex-shrink-0 px-5 py-3 bg-gradient-to-r from-violet-600 to-indigo-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            <h3 className="font-bold text-sm">Email Statement</h3>
          </div>
          <button onClick={onClose} className="h-7 w-7 rounded-lg bg-white/15 hover:bg-white/25 flex items-center justify-center"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 block">To</label>
            <input value={customer.email} readOnly className="w-full h-9 px-3 rounded-lg bg-slate-100 text-sm outline-none" />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 block">Subject</label>
            <input value={`Account Statement — ${customer.name}`} readOnly className="w-full h-9 px-3 rounded-lg bg-slate-100 text-sm outline-none" />
          </div>
          {!customer.email && (
            <div className="bg-rose-50 ring-1 ring-rose-200 rounded p-2 text-[10px] text-rose-700 flex items-start gap-1.5">
              <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
              <span>This customer has no email on file. Add one via the Customer management screen, or use Print instead.</span>
            </div>
          )}
          <div className="text-[10px] text-slate-500 bg-slate-50 rounded p-2">
            The statement summary (opening balance, total invoiced, total paid, closing balance, aging breakdown) will be pre-filled in your email client. Attach the printed PDF for the full transaction list.
          </div>
        </div>
        <div className="p-4 border-t border-slate-200 flex gap-2">
          <button onClick={onClose} className="flex-1 h-10 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold">Cancel</button>
          <button onClick={handleSend} disabled={sending || !customer.email} className="flex-1 h-10 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white text-xs font-bold disabled:opacity-50 flex items-center justify-center gap-1.5">
            <Send className="h-3.5 w-3.5" /> Open Email Client
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
