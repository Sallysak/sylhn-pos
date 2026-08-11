"use client";

import { authedFetch } from "@/lib/client-auth";
import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Wallet, Plus, Loader2, Trash2, Download, TrendingDown,
  Calendar, FileText, AlertTriangle, CheckCircle2,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { formatGHS } from "@/lib/pos-data";

interface Expense {
  id: string;
  date: string;
  category: string;
  description: string;
  amount: number;
  paymentMode: string;
  reference: string;
  notes: string;
  createdBy?: string;
}

interface ExpenseManagerProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const CATEGORIES = [
  { value: "rent", label: "Rent", icon: "🏠", color: "#3B82F6" },
  { value: "utilities", label: "Utilities", icon: "💡", color: "#F59E0B" },
  { value: "salaries", label: "Salaries", icon: "👥", color: "#10B981" },
  { value: "marketing", label: "Marketing", icon: "📢", color: "#8B5CF6" },
  { value: "supplies", label: "Supplies", icon: "📦", color: "#EC4899" },
  { value: "transport", label: "Transport", icon: "🚚", color: "#06B6D4" },
  { value: "maintenance", label: "Maintenance", icon: "🔧", color: "#F97316" },
  { value: "other", label: "Other", icon: "📝", color: "#64748B" },
];

const PAYMENT_MODES = [
  { value: "cash", label: "Cash", icon: "💵" },
  { value: "mobile-money", label: "MoMo", icon: "📱" },
  { value: "bank", label: "Bank", icon: "🏦" },
  { value: "cheque", label: "Cheque", icon: "🧾" },
  { value: "card", label: "Card", icon: "💳" },
];

const APPROVAL_THRESHOLD = 1000;

export function ExpenseManager({ open, onOpenChange }: ExpenseManagerProps) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [filterCategory, setFilterCategory] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const { toast } = useToast();

  // Form state
  const [form, setForm] = useState({
    category: "supplies",
    description: "",
    amount: "",
    paymentMode: "cash",
    reference: "",
    notes: "",
  });

  useEffect(() => {
    if (open) {
      loadExpenses();
      setShowForm(false);
    }
  }, [open]);

  const loadExpenses = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterCategory !== "all") params.set("category", filterCategory);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      params.set("limit", "200");
      const res = await authedFetch(`/api/expenses?${params}`, { credentials: "include" });
      const data = await res.json();
      if (res.ok) setExpenses(data.expenses || []);
    } catch {
      // swallow
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    return expenses.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [expenses]);

  const totalAmount = filtered.reduce((s, e) => s + e.amount, 0);
  const byCategory = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach(e => { map[e.category] = (map[e.category] || 0) + e.amount; });
    return map;
  }, [filtered]);

  const requiresApproval = parseFloat(form.amount) > APPROVAL_THRESHOLD;

  const handleSubmit = async () => {
    const amount = parseFloat(form.amount);
    if (!amount || amount <= 0) {
      toast({ title: "Enter a valid amount", variant: "destructive" });
      return;
    }
    if (!form.description.trim()) {
      toast({ title: "Description is required", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const res = await authedFetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          category: form.category,
          description: form.description,
          amount,
          paymentMode: form.paymentMode,
          reference: form.reference,
          notes: form.notes,
        }),
      });
      const data = await res.json();
      if (res.ok && (data.success || data.expense)) {
        toast({
          title: "Expense recorded ✓",
          description: `${formatGHS(amount)} · ${form.category}${requiresApproval ? " (over ₵${APPROVAL_THRESHOLD} — needs manager approval)" : ""}`,
        });
        setForm({ category: "supplies", description: "", amount: "", paymentMode: "cash", reference: "", notes: "" });
        setShowForm(false);
        loadExpenses();
      } else {
        throw new Error(data.error || "Failed");
      }
    } catch (e: any) {
      toast({ title: "Failed to record expense", description: e?.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this expense record?")) return;
    setDeleting(id);
    try {
      const res = await authedFetch(`/api/expenses?id=${id}`, { method: "DELETE", credentials: "include" });
      if (res.ok) {
        toast({ title: "Deleted" });
        setExpenses(prev => prev.filter(e => e.id !== id));
      }
    } catch {
      toast({ title: "Failed to delete", variant: "destructive" });
    } finally {
      setDeleting(null);
    }
  };

  const handleExport = () => {
    const csv = "Date,Category,Description,Amount,Payment Mode,Reference,Notes\n" +
      filtered.map(e => `${new Date(e.date).toLocaleDateString("en-GB")},${e.category},"${e.description}",${e.amount.toFixed(2)},${e.paymentMode},${e.reference || ''},"${e.notes || ''}"`).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `expenses-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Exported ✓" });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl p-0 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-br from-rose-600 via-orange-600 to-amber-600 text-white px-6 py-5 relative overflow-hidden">
          <div className="pointer-events-none absolute -top-12 -right-12 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
          <div className="relative z-10 flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-white/20 ring-1 ring-white/30 flex items-center justify-center backdrop-blur-sm">
              <Wallet className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-bold tracking-tight">Expense Management</h2>
              <p className="text-[11px] opacity-85">{filtered.length} records · Total: {formatGHS(totalAmount)}</p>
            </div>
            <Button size="sm" variant="outline" onClick={handleExport} className="bg-white/20 border-white/30 text-white hover:bg-white/30">
              <Download className="h-3.5 w-3.5 mr-1" /> Export
            </Button>
          </div>
        </div>

        <div className="px-6 py-5 space-y-4 max-h-[65vh] overflow-y-auto">
          {/* Filters */}
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <Label className="text-[10px] font-bold uppercase text-slate-500 mb-1 block">Category</Label>
              <select value={filterCategory} onChange={(e) => { setFilterCategory(e.target.value); }} className="h-8 px-2 text-xs border border-slate-300 rounded bg-white">
                <option value="all">All Categories</option>
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.icon} {c.label}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-[10px] font-bold uppercase text-slate-500 mb-1 block">From</Label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-8 w-36 text-xs" />
            </div>
            <div>
              <Label className="text-[10px] font-bold uppercase text-slate-500 mb-1 block">To</Label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-8 w-36 text-xs" />
            </div>
            <Button size="sm" variant="outline" onClick={loadExpenses} disabled={loading}>
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Apply"}
            </Button>
            <div className="flex-1" />
            <Button size="sm" onClick={() => setShowForm(!showForm)} className="bg-rose-600 hover:bg-rose-700 text-white">
              <Plus className="h-3.5 w-3.5 mr-1" /> New Expense
            </Button>
          </div>

          {/* Category breakdown chips */}
          {filtered.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.filter(c => byCategory[c.value]).map(c => (
                <Badge key={c.value} variant="outline" className="text-[10px]" style={{ borderColor: c.color, color: c.color }}>
                  {c.icon} {c.label}: {formatGHS(byCategory[c.value])}
                </Badge>
              ))}
            </div>
          )}

          {/* New expense form */}
          {showForm && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 space-y-3 border border-slate-200 dark:border-slate-700">
              <div className="text-xs font-bold uppercase text-slate-500">New Expense</div>
              {/* Category picker */}
              <div>
                <Label className="text-[10px] font-bold uppercase text-slate-500 mb-1.5 block">Category</Label>
                <div className="grid grid-cols-4 gap-1.5">
                  {CATEGORIES.map(c => (
                    <button key={c.value} type="button" onClick={() => setForm({ ...form, category: c.value })}
                      className={cn("flex items-center gap-1 py-1.5 px-2 rounded-lg ring-2 transition text-xs",
                        form.category === c.value ? "ring-rose-400 bg-white dark:bg-slate-900 font-bold" : "ring-transparent hover:bg-white/50")}>
                      <span>{c.icon}</span> {c.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[10px] font-bold uppercase text-slate-500 mb-1 block">Description *</Label>
                  <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="e.g. Electricity bill July" className="h-8 text-xs" />
                </div>
                <div>
                  <Label className="text-[10px] font-bold uppercase text-slate-500 mb-1 block">Amount (GHS) *</Label>
                  <Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0.00" className="h-8 text-xs font-mono" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[10px] font-bold uppercase text-slate-500 mb-1 block">Payment Mode</Label>
                  <select value={form.paymentMode} onChange={(e) => setForm({ ...form, paymentMode: e.target.value })} className="h-8 w-full px-2 text-xs border border-slate-300 rounded bg-white">
                    {PAYMENT_MODES.map(p => <option key={p.value} value={p.value}>{p.icon} {p.label}</option>)}
                  </select>
                </div>
                <div>
                  <Label className="text-[10px] font-bold uppercase text-slate-500 mb-1 block">Reference</Label>
                  <Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} placeholder="Receipt no, cheque no" className="h-8 text-xs" />
                </div>
              </div>
              <div>
                <Label className="text-[10px] font-bold uppercase text-slate-500 mb-1 block">Notes</Label>
                <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className="text-xs" placeholder="Additional details..." />
              </div>
              {requiresApproval && (
                <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-lg px-3 py-2 text-[11px] text-amber-800 dark:text-amber-300">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  This expense exceeds ₵{APPROVAL_THRESHOLD.toFixed(2)} — a manager should approve before recording.
                </div>
              )}
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="flex-1" onClick={() => setShowForm(false)}>Cancel</Button>
                <Button size="sm" className="flex-1 bg-rose-600 hover:bg-rose-700 text-white" onClick={handleSubmit} disabled={submitting}>
                  {submitting ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5 mr-1" />}
                  Record Expense
                </Button>
              </div>
            </motion.div>
          )}

          {/* Expense list */}
          {loading ? (
            <div className="text-center py-8 text-slate-500">
              <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" /> Loading expenses…
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <Wallet className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm font-semibold">No expenses recorded</p>
              <p className="text-xs mt-1">Click "New Expense" to record one.</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {filtered.map(e => {
                const cat = CATEGORIES.find(c => c.value === e.category) || CATEGORIES[7];
                const pm = PAYMENT_MODES.find(p => p.value === e.paymentMode) || PAYMENT_MODES[0];
                return (
                  <div key={e.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition">
                    <div className="h-9 w-9 rounded-lg flex items-center justify-center text-base shrink-0" style={{ backgroundColor: cat.color + "20" }}>
                      {cat.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold truncate">{e.description}</div>
                      <div className="text-[10px] text-slate-500 flex items-center gap-2">
                        <span>{cat.label}</span>
                        <span>· {pm.icon} {pm.label}</span>
                        <span>· {new Date(e.date).toLocaleDateString("en-GB")}</span>
                        {e.reference && <span>· ref: {e.reference}</span>}
                      </div>
                    </div>
                    <div className="font-mono font-bold text-sm text-rose-600 shrink-0">{formatGHS(e.amount)}</div>
                    <button onClick={() => handleDelete(e.id)} disabled={deleting === e.id} className="h-7 w-7 rounded-md hover:bg-rose-100 dark:hover:bg-rose-900/30 flex items-center justify-center text-rose-600 transition shrink-0">
                      {deleting === e.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
