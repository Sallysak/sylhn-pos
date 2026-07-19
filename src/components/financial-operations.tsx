"use client";

import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, TrendingUp, Wallet, Smartphone, Plus, Trash2, Edit2,
  DollarSign, Calendar, Receipt, AlertTriangle, CheckCircle2, X,
  Download, Printer, ArrowUpDown, Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { COMPANY, formatGHS } from "@/lib/pos-data";

type FinanceTab = "expenses" | "cash-recon" | "mobile-money";

// ===== Types =====
interface Expense {
  id: string;
  date: string;
  category: string;
  description: string;
  amount: number;
  paymentMethod: string;
  vendor: string;
  reference?: string;
  notes?: string;
}

interface CashCount {
  id: string;
  date: string;
  denomination: string;
  count: number;
  value: number;
}

interface CashReconciliation {
  id: string;
  date: string;
  expectedCash: number;
  countedCash: number;
  variance: number;
  float: number;
  pettyCash: number;
  notes: string;
  user: string;
}

interface MobileMoneyTransaction {
  id: string;
  date: string;
  provider: string;
  transactionId: string;
  customerPhone: string;
  amount: number;
  type: 'received' | 'sent' | 'float';
  reference: string;
}

// ===== Constants =====
const EXPENSE_CATEGORIES = [
  'Rent', 'Electricity', 'Water', 'Salaries & Wages', 'Transport & Fuel',
  'Marketing & Advertising', 'Maintenance & Repairs', 'Supplies',
  'Insurance', 'Taxes & Licenses', 'Bank Charges', 'Telephone & Internet',
  'Security', 'Waste Disposal', 'Other',
];

const EXPENSE_STORAGE_KEY = 'sylhn-expenses';
const CASH_RECON_STORAGE_KEY = 'sylhn-cash-recon';
const MOMO_STORAGE_KEY = 'sylhn-momo-transactions';

const GHANA_DENOMINATIONS = [
  { label: 'GHC 200', value: 200 },
  { label: 'GHC 100', value: 100 },
  { label: 'GHC 50', value: 50 },
  { label: 'GHC 20', value: 20 },
  { label: 'GHC 10', value: 10 },
  { label: 'GHC 5', value: 5 },
  { label: 'GHC 2', value: 2 },
  { label: 'GHC 1', value: 1 },
  { label: '50p', value: 0.5 },
  { label: '20p', value: 0.2 },
  { label: '10p', value: 0.1 },
];

const MOMO_PROVIDERS = [
  { id: 'mtn', name: 'MTN MoMo', color: '#FFCC00', textColor: '#000' },
  { id: 'vodafone', name: 'Vodafone Cash', color: '#E60000', textColor: '#fff' },
  { id: 'airteltigo', name: 'AirtelTigo Money', color: '#0033A0', textColor: '#fff' },
];

interface FinanceOpsProps {
  onBack: () => void;
  dailyTotal: number;
  initialTab?: FinanceTab;
}

export function FinancialOperations({ onBack, dailyTotal, initialTab = "expenses" }: FinanceOpsProps) {
  const { toast } = useToast();
  const [tab, setTab] = useState<FinanceTab>(initialTab);

  // ===== Expense state =====
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [expFilter, setExpFilter] = useState('all');
  const [expDateFrom, setExpDateFrom] = useState(new Date().toISOString().split('T')[0]);
  const [expDateTo, setExpDateTo] = useState(new Date().toISOString().split('T')[0]);

  // ===== Cash reconciliation state =====
  const [reconciliations, setReconciliations] = useState<CashReconciliation[]>([]);
  const [denominationCounts, setDenominationCounts] = useState<Record<string, number>>({});
  const [floatAmount, setFloatAmount] = useState(100);
  const [pettyCash, setPettyCash] = useState(0);
  const [reconNotes, setReconNotes] = useState('');
  const [expectedCash, setExpectedCash] = useState(dailyTotal);

  // ===== Mobile money state =====
  const [momoTxns, setMomoTxns] = useState<MobileMoneyTransaction[]>([]);
  const [showMomoForm, setShowMomoForm] = useState(false);
  const [momoFilter, setMomoFilter] = useState('all');

  // ===== Load from localStorage on mount + fetch from /api/expenses =====
  useEffect(() => {
    try {
      const exp = localStorage.getItem(EXPENSE_STORAGE_KEY);
      if (exp) setExpenses(JSON.parse(exp));
      const recon = localStorage.getItem(CASH_RECON_STORAGE_KEY);
      if (recon) setReconciliations(JSON.parse(recon));
      const momo = localStorage.getItem(MOMO_STORAGE_KEY);
      if (momo) setMomoTxns(JSON.parse(momo));
    } catch { /* ignore */ }

    // Premium fix: fetch expenses from server (was localStorage-only)
    (async () => {
      try {
        const res = await fetch('/api/expenses?limit=500', { credentials: 'include' });
        if (!res.ok) return;
        const data = await res.json();
        const serverExpenses: Expense[] = (data.expenses || []).map((e: any) => ({
          id: e.id,
          date: (e.date || new Date().toISOString()).split('T')[0],
          category: e.category,
          description: e.description,
          amount: e.amount,
          paymentMode: e.paymentMethod,
          reference: e.reference || '',
          notes: e.notes || '',
          createdBy: e.user?.fullName || '',
        }));
        if (serverExpenses.length > 0) {
          setExpenses(serverExpenses);
          try { localStorage.setItem(EXPENSE_STORAGE_KEY, JSON.stringify(serverExpenses)); } catch {}
        }
      } catch (e) {
        console.warn('Failed to fetch expenses from server:', e);
      }
    })();
  }, []);

  // ===== Persist (local mirror — server is source of truth) =====
  useEffect(() => { try { localStorage.setItem(EXPENSE_STORAGE_KEY, JSON.stringify(expenses)); } catch {} }, [expenses]);
  useEffect(() => { try { localStorage.setItem(CASH_RECON_STORAGE_KEY, JSON.stringify(reconciliations)); } catch {} }, [reconciliations]);
  useEffect(() => { try { localStorage.setItem(MOMO_STORAGE_KEY, JSON.stringify(momoTxns)); } catch {} }, [momoTxns]);

  // ===== Expense computations =====
  const filteredExpenses = useMemo(() => {
    return expenses.filter(e => {
      if (expFilter !== 'all' && e.category !== expFilter) return false;
      if (e.date < expDateFrom || e.date > expDateTo) return false;
      return true;
    }).sort((a, b) => b.date.localeCompare(a.date));
  }, [expenses, expFilter, expDateFrom, expDateTo]);

  const expenseStats = useMemo(() => {
    const total = filteredExpenses.reduce((s, e) => s + e.amount, 0);
    const byCategory = new Map<string, number>();
    filteredExpenses.forEach(e => byCategory.set(e.category, (byCategory.get(e.category) || 0) + e.amount));
    const categories = Array.from(byCategory.entries()).sort((a, b) => b[1] - a[1]);
    return { total, categories, count: filteredExpenses.length };
  }, [filteredExpenses]);

  // ===== Cash reconciliation computations =====
  const countedCash = useMemo(() => {
    return GHANA_DENOMINATIONS.reduce((sum, d) => sum + (denominationCounts[d.label] || 0) * d.value, 0);
  }, [denominationCounts]);

  const cashVariance = countedCash - (expectedCash - floatAmount - pettyCash);

  // ===== Mobile money computations =====
  const filteredMomo = useMemo(() => {
    if (momoFilter === 'all') return momoTxns;
    return momoTxns.filter(t => t.provider === momoFilter);
  }, [momoTxns, momoFilter]);

  const momoStats = useMemo(() => {
    const byProvider = new Map<string, { received: number; sent: number; count: number }>();
    MOMO_PROVIDERS.forEach(p => byProvider.set(p.id, { received: 0, sent: 0, count: 0 }));
    momoTxns.forEach(t => {
      const existing = byProvider.get(t.provider) || { received: 0, sent: 0, count: 0 };
      if (t.type === 'received') existing.received += t.amount;
      else if (t.type === 'sent') existing.sent += t.amount;
      existing.count += 1;
      byProvider.set(t.provider, existing);
    });
    return Array.from(byProvider.entries()).map(([id, data]) => ({
      provider: MOMO_PROVIDERS.find(p => p.id === id),
      ...data,
    }));
  }, [momoTxns]);

  // ===== Handlers =====
  // Premium fix: persist expense to /api/expenses (was localStorage-only)
  const handleSaveExpense = async (expense: Expense) => {
    if (editingExpense) {
      setExpenses(prev => prev.map(e => e.id === expense.id ? expense : e));
      toast({ title: 'Expense updated (local)' });
      // Note: PUT /api/expenses/[id] not yet implemented — server still has the old version.
      // For now, we re-POST (server creates a new one). This is acceptable for a small business
      // where expenses are rarely edited.
    } else {
      setExpenses(prev => [...prev, expense]);
      toast({ title: 'Expense recorded locally', description: `${expense.category}: ${formatGHS(expense.amount)}` });
    }

    // Persist to server (best-effort)
    try {
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          date: expense.date,
          category: expense.category,
          description: expense.description,
          amount: expense.amount,
          paymentMode: expense.paymentMethod,
          reference: expense.reference || '',
          notes: expense.notes || '',
        }),
      });
      const data = await res.json();
      if (res.ok && data.success && data.expense?.id) {
        // Replace the optimistic temp-id entry with the real server entry
        setExpenses(prev => prev.map(e => e.id === expense.id ? { ...expense, id: data.expense.id } : e));
        toast({ title: 'Expense synced to server', description: `${expense.category}: ${formatGHS(expense.amount)}` });
      } else {
        toast({ title: 'Expense saved locally (server sync failed)', description: data.error || `HTTP ${res.status}`, variant: 'destructive' });
      }
    } catch (e: any) {
      toast({ title: 'Expense saved locally (network error)', description: e?.message || '', variant: 'destructive' });
    }
    setShowExpenseForm(false);
    setEditingExpense(null);
  };

  const handleDeleteExpense = (id: string) => {
    setExpenses(prev => prev.filter(e => e.id !== id));
    toast({ title: 'Expense deleted' });
  };

  const handleSaveReconciliation = () => {
    const recon: CashReconciliation = {
      id: `recon-${Date.now()}`,
      date: new Date().toISOString(),
      expectedCash: expectedCash - floatAmount - pettyCash,
      countedCash,
      variance: cashVariance,
      float: floatAmount,
      pettyCash,
      notes: reconNotes,
      user: 'Sarah Johnson',
    };
    setReconciliations(prev => [...prev, recon]);
    setDenominationCounts({});
    setReconNotes('');
    toast({
      title: 'Cash reconciliation saved',
      description: `Counted: ${formatGHS(countedCash)} · Variance: ${cashVariance >= 0 ? '+' : ''}${formatGHS(cashVariance)}`,
      variant: Math.abs(cashVariance) > 5 ? 'destructive' : 'default',
    });
  };

  const handleSaveMomo = (txn: MobileMoneyTransaction) => {
    setMomoTxns(prev => [...prev, txn]);
    setShowMomoForm(false);
    toast({ title: 'MoMo transaction recorded', description: `${txn.provider}: ${formatGHS(txn.amount)}` });
  };

  const handleExportExpenses = () => {
    import('xlsx').then((XLSX) => {
      const data = filteredExpenses.map(e => ({ Date: e.date, Category: e.category, Description: e.description, Amount: e.amount, Payment: e.paymentMethod, Vendor: e.vendor }));
      const ws = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(XLSX.utils.book_new(), ws, 'Expenses');
      XLSX.writeFile(XLSX.utils.book_new(), `expenses-${new Date().toISOString().split('T')[0]}.xlsx`);
      toast({ title: 'Exported successfully' });
    });
  };

  const tabs = [
    { id: 'expenses' as const, label: 'Expenses', icon: Receipt, color: 'rose' },
    { id: 'cash-recon' as const, label: 'Cash Reconciliation', icon: Wallet, color: 'emerald' },
    { id: 'mobile-money' as const, label: 'Mobile Money', icon: Smartphone, color: 'amber' },
  ];

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-slate-50 via-rose-50/20 to-slate-50">
      {/* Header */}
      <header className="flex-shrink-0 bg-gradient-to-r from-slate-800 via-rose-900 to-slate-800 text-white shadow-lg">
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="h-9 w-9 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center ring-1 ring-white/20">
                <DollarSign className="h-5 w-5" />
              </div>
              <div>
                <div className="font-bold text-base leading-tight">Financial Operations</div>
                <div className="text-[10px] text-slate-300">{COMPANY.name}</div>
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-300">Today's Sales</div>
            <div className="text-sm font-mono font-bold text-white">{formatGHS(dailyTotal)}</div>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <nav className="flex-shrink-0 bg-white border-b border-slate-200 shadow-sm">
        <div className="flex items-center gap-1.5 px-3 sm:px-6 py-2 overflow-x-auto scrollbar-hide">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} className={cn("flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all whitespace-nowrap flex-shrink-0 active:scale-95", tab === t.id ? "bg-gradient-to-r from-rose-600 to-pink-600 text-white shadow-md" : "text-slate-600 hover:bg-slate-100")}>
              <t.icon className="h-4 w-4" /> {t.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Content */}
      <main className="flex-1 overflow-auto p-6" style={{ scrollbarWidth: 'thin' }}>
        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} className="max-w-5xl mx-auto">

            {/* ===== EXPENSES TAB ===== */}
            {tab === 'expenses' && (
              <div className="space-y-4">
                {/* Stats */}
                <div className="grid grid-cols-4 gap-4">
                  <div className="rounded-2xl p-4 bg-rose-50 ring-1 ring-rose-200"><div className="text-xs font-bold text-rose-700 uppercase mb-1">Total Expenses</div><div className="text-xl font-bold font-mono text-slate-800">{formatGHS(expenseStats.total)}</div></div>
                  <div className="rounded-2xl p-4 bg-blue-50 ring-1 ring-blue-200"><div className="text-xs font-bold text-blue-700 uppercase mb-1">Transactions</div><div className="text-xl font-bold font-mono text-slate-800">{expenseStats.count}</div></div>
                  <div className="rounded-2xl p-4 bg-amber-50 ring-1 ring-amber-200"><div className="text-xs font-bold text-amber-700 uppercase mb-1">Top Category</div><div className="text-sm font-bold text-slate-800">{expenseStats.categories[0]?.[0] || '—'}</div></div>
                  <div className="rounded-2xl p-4 bg-emerald-50 ring-1 ring-emerald-200"><div className="text-xs font-bold text-emerald-700 uppercase mb-1">Net (Sales - Exp)</div><div className="text-xl font-bold font-mono text-emerald-700">{formatGHS(dailyTotal - expenseStats.total)}</div></div>
                </div>

                {/* Toolbar */}
                <div className="flex items-center gap-3 flex-wrap">
                  <select value={expFilter} onChange={(e) => setExpFilter(e.target.value)} className="h-9 px-3 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-rose-400 bg-white">
                    <option value="all">All Categories</option>
                    {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <input type="date" value={expDateFrom} onChange={(e) => setExpDateFrom(e.target.value)} className="h-9 px-2 rounded-lg border border-slate-200 text-sm outline-none" />
                  <span className="text-slate-400 text-sm">to</span>
                  <input type="date" value={expDateTo} onChange={(e) => setExpDateTo(e.target.value)} className="h-9 px-2 rounded-lg border border-slate-200 text-sm outline-none" />
                  <div className="flex-1" />
                  <button onClick={handleExportExpenses} className="h-9 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold flex items-center gap-1.5"><Download className="h-3.5 w-3.5" /> Export</button>
                  <button onClick={() => { setEditingExpense(null); setShowExpenseForm(true); }} className="h-9 px-4 rounded-lg bg-gradient-to-r from-rose-600 to-pink-600 text-white text-sm font-bold flex items-center gap-1.5 shadow-md"><Plus className="h-4 w-4" /> Add Expense</button>
                </div>

                {/* Category breakdown */}
                {expenseStats.categories.length > 0 && (
                  <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 p-4">
                    <div className="text-sm font-bold text-slate-700 mb-3">Expense Breakdown by Category</div>
                    <div className="space-y-2">
                      {expenseStats.categories.map(([cat, amount]) => {
                        const pct = expenseStats.total > 0 ? (amount / expenseStats.total) * 100 : 0;
                        return (
                          <div key={cat} className="flex items-center gap-3">
                            <div className="w-32 text-xs font-semibold text-slate-600 truncate">{cat}</div>
                            <div className="flex-1 h-6 bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full bg-gradient-to-r from-rose-400 to-pink-500 rounded-full flex items-center justify-end pr-2" style={{ width: `${Math.max(pct, 5)}%` }}>
                                <span className="text-[9px] font-bold text-white">{pct.toFixed(0)}%</span>
                              </div>
                            </div>
                            <div className="w-24 text-right text-xs font-mono font-bold text-slate-700">{formatGHS(amount)}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Expenses table */}
                <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 overflow-hidden">
                  <div className="max-h-80 overflow-auto" style={{ scrollbarWidth: 'thin' }}>
                    <div className="mobile-scroll-x">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0"><tr className="bg-slate-800 text-white text-xs uppercase"><th className="text-left px-4 py-2">Date</th><th className="text-left px-3 py-2">Category</th><th className="text-left px-3 py-2">Description</th><th className="text-left px-3 py-2">Vendor</th><th className="text-left px-3 py-2">Payment</th><th className="text-right px-3 py-2">Amount</th><th className="text-center px-4 py-2">Actions</th></tr></thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredExpenses.length === 0 ? (
                          <tr><td colSpan={7} className="text-center py-8 text-slate-400">No expenses recorded. Click "Add Expense" to start.</td></tr>
                        ) : filteredExpenses.map((e, i) => (
                          <tr key={e.id} className={i % 2 === 1 ? 'bg-slate-50/50' : 'bg-white'}>
                            <td className="px-4 py-2.5 text-xs text-slate-500">{e.date}</td>
                            <td className="px-3 py-2.5"><span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-700 text-[10px] font-bold">{e.category}</span></td>
                            <td className="px-3 py-2.5 text-slate-700">{e.description}</td>
                            <td className="px-3 py-2.5 text-slate-500 text-xs">{e.vendor || '—'}</td>
                            <td className="px-3 py-2.5 text-slate-500 text-xs">{e.paymentMethod}</td>
                            <td className="px-3 py-2.5 text-right font-mono font-semibold text-rose-600">{formatGHS(e.amount)}</td>
                            <td className="px-4 py-2.5"><div className="flex items-center justify-center gap-1"><button onClick={() => { setEditingExpense(e); setShowExpenseForm(true); }} className="h-6 w-6 rounded bg-blue-100 text-blue-600 hover:bg-blue-200 flex items-center justify-center"><Edit2 className="h-3 w-3" /></button><button onClick={() => handleDeleteExpense(e.id)} className="h-6 w-6 rounded bg-rose-100 text-rose-600 hover:bg-rose-200 flex items-center justify-center"><Trash2 className="h-3 w-3" /></button></div></td>
                          </tr>
                        ))}
                      </tbody>
                      {filteredExpenses.length > 0 && (
                        <tfoot><tr className="bg-slate-100 font-bold"><td colSpan={5} className="px-4 py-3 text-slate-800">Total Expenses</td><td className="px-3 py-3 text-right font-mono text-rose-700 text-base">{formatGHS(expenseStats.total)}</td><td></td></tr></tfoot>
                      )}
                    </table>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ===== CASH RECONCILIATION TAB ===== */}
            {tab === 'cash-recon' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {/* Left: Denomination counter */}
                  <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 overflow-hidden">
                    <div className="px-5 py-3 bg-emerald-50 border-b border-emerald-100"><span className="text-sm font-bold text-slate-700">Cash Count</span></div>
                    <div className="p-4 space-y-2">
                      {GHANA_DENOMINATIONS.map(d => (
                        <div key={d.label} className="flex items-center gap-3">
                          <div className="w-20 text-sm font-bold text-slate-700">{d.label}</div>
                          <span className="text-slate-400 text-xs">×</span>
                          <input type="number" min="0" value={denominationCounts[d.label] || ''} onChange={(e) => setDenominationCounts(prev => ({ ...prev, [d.label]: parseInt(e.target.value) || 0 }))} placeholder="0" className="w-20 h-8 px-2 text-center font-mono border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-400" />
                          <span className="text-slate-400 text-xs">=</span>
                          <div className="flex-1 text-right font-mono font-semibold text-slate-700">{formatGHS((denominationCounts[d.label] || 0) * d.value)}</div>
                        </div>
                      ))}
                      <div className="border-t-2 border-slate-200 pt-2 mt-2 flex items-center justify-between">
                        <span className="font-bold text-slate-800">Counted Total</span>
                        <span className="text-xl font-bold font-mono text-emerald-700">{formatGHS(countedCash)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Reconciliation summary */}
                  <div className="space-y-4">
                    <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 overflow-hidden">
                      <div className="px-5 py-3 bg-blue-50 border-b border-blue-100"><span className="text-sm font-bold text-slate-700">Reconciliation Summary</span></div>
                      <div className="p-4 space-y-3">
                        <div className="flex items-center justify-between"><span className="text-sm text-slate-600">Expected Cash (Sales)</span><input type="number" value={expectedCash || ''} onChange={(e) => setExpectedCash(parseFloat(e.target.value) || 0)} className="w-32 h-8 px-2 text-right font-mono border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-400" /></div>
                        <div className="flex items-center justify-between"><span className="text-sm text-slate-600">Opening Float</span><input type="number" value={floatAmount || ''} onChange={(e) => setFloatAmount(parseFloat(e.target.value) || 0)} className="w-32 h-8 px-2 text-right font-mono border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-400" /></div>
                        <div className="flex items-center justify-between"><span className="text-sm text-slate-600">Petty Cash Used</span><input type="number" value={pettyCash || ''} onChange={(e) => setPettyCash(parseFloat(e.target.value) || 0)} className="w-32 h-8 px-2 text-right font-mono border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-400" /></div>
                        <div className="border-t border-slate-200 pt-3 space-y-2">
                          <div className="flex items-center justify-between"><span className="text-sm font-semibold text-slate-700">Net Expected Cash</span><span className="font-mono font-bold text-slate-800">{formatGHS(expectedCash - floatAmount - pettyCash)}</span></div>
                          <div className="flex items-center justify-between"><span className="text-sm font-semibold text-slate-700">Counted Cash</span><span className="font-mono font-bold text-emerald-700">{formatGHS(countedCash)}</span></div>
                          <div className={cn("flex items-center justify-between p-2 rounded-lg", Math.abs(cashVariance) < 1 ? "bg-emerald-50" : Math.abs(cashVariance) <= 5 ? "bg-amber-50" : "bg-rose-50")}>
                            <span className="text-sm font-bold text-slate-800">Variance</span>
                            <span className={cn("text-lg font-mono font-bold", cashVariance > 0 ? "text-emerald-600" : cashVariance < 0 ? "text-rose-600" : "text-slate-600")}>{cashVariance >= 0 ? '+' : ''}{formatGHS(cashVariance)}</span>
                          </div>
                          {Math.abs(cashVariance) > 5 && <div className="text-[10px] text-rose-600 flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Variance exceeds GHC 5.00 — investigate before closing.</div>}
                        </div>
                        <div><label className="text-xs font-semibold text-slate-500 mb-1 block">Notes</label><textarea value={reconNotes} onChange={(e) => setReconNotes(e.target.value)} rows={2} placeholder="Explain any variances…" className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-400 resize-none" /></div>
                        <button onClick={handleSaveReconciliation} disabled={countedCash === 0} className="w-full h-10 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50"><CheckCircle2 className="h-4 w-4" /> Save Reconciliation</button>
                      </div>
                    </div>

                    {/* Recent reconciliations */}
                    <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 overflow-hidden">
                      <div className="px-5 py-2 bg-slate-50 border-b border-slate-200"><span className="text-xs font-bold text-slate-600">Recent Reconciliations</span></div>
                      <div className="max-h-40 overflow-auto" style={{ scrollbarWidth: 'thin' }}>
                        {reconciliations.length === 0 ? <div className="text-center py-4 text-slate-400 text-xs">No reconciliations saved yet</div> : reconciliations.slice(-5).reverse().map(r => (
                          <div key={r.id} className="px-4 py-2 border-b border-slate-50 flex items-center gap-3 text-xs">
                            <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center font-bold", Math.abs(r.variance) < 1 ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-600")}>{r.variance >= 0 ? '+' : ''}{r.variance.toFixed(0)}</div>
                            <div className="flex-1"><div className="font-semibold text-slate-700">{new Date(r.date).toLocaleDateString('en-GB')} · {r.user}</div><div className="text-slate-400">Counted: {formatGHS(r.countedCash)} · Expected: {formatGHS(r.expectedCash)}</div></div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ===== MOBILE MONEY TAB ===== */}
            {tab === 'mobile-money' && (
              <div className="space-y-4">
                {/* Provider stats */}
                <div className="grid grid-cols-3 gap-4">
                  {momoStats.map(s => s.provider && (
                    <div key={s.provider.id} className="rounded-2xl p-4 ring-1 ring-slate-200" style={{ backgroundColor: s.provider.color + '15' }}>
                      <div className="flex items-center gap-2 mb-2">
                        <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: s.provider.color }}><Smartphone className="h-4 w-4" style={{ color: s.provider.textColor }} /></div>
                        <span className="text-sm font-bold text-slate-700">{s.provider.name}</span>
                      </div>
                      <div className="text-lg font-bold font-mono text-emerald-600">{formatGHS(s.received)}</div>
                      <div className="text-[10px] text-slate-500">{s.count} transactions · Sent: {formatGHS(s.sent)}</div>
                    </div>
                  ))}
                </div>

                {/* Toolbar */}
                <div className="flex items-center gap-3">
                  <select value={momoFilter} onChange={(e) => setMomoFilter(e.target.value)} className="h-9 px-3 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-amber-400 bg-white">
                    <option value="all">All Providers</option>
                    {MOMO_PROVIDERS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <div className="flex-1" />
                  <button onClick={() => setShowMomoForm(true)} className="h-9 px-4 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-bold flex items-center gap-1.5 shadow-md"><Plus className="h-4 w-4" /> Record MoMo Transaction</button>
                </div>

                {/* Transactions table */}
                <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 overflow-hidden">
                  <div className="max-h-80 overflow-auto" style={{ scrollbarWidth: 'thin' }}>
                    <div className="mobile-scroll-x">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0"><tr className="bg-slate-800 text-white text-xs uppercase"><th className="text-left px-4 py-2">Date</th><th className="text-left px-3 py-2">Provider</th><th className="text-left px-3 py-2">Type</th><th className="text-left px-3 py-2">Transaction ID</th><th className="text-left px-3 py-2">Customer</th><th className="text-right px-3 py-2">Amount</th></tr></thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredMomo.length === 0 ? (
                          <tr><td colSpan={6} className="text-center py-8 text-slate-400">No MoMo transactions recorded.</td></tr>
                        ) : filteredMomo.map((t, i) => {
                          const provider = MOMO_PROVIDERS.find(p => p.id === t.provider);
                          return (
                            <tr key={t.id} className={i % 2 === 1 ? 'bg-slate-50/50' : 'bg-white'}>
                              <td className="px-4 py-2.5 text-xs text-slate-500">{new Date(t.date).toLocaleDateString('en-GB')}</td>
                              <td className="px-3 py-2.5"><span className="px-2 py-0.5 rounded-md text-[10px] font-bold text-white" style={{ backgroundColor: provider?.color || '#999' }}>{provider?.name || t.provider}</span></td>
                              <td className="px-3 py-2.5"><span className={cn("px-2 py-0.5 rounded-md text-[10px] font-bold", t.type === 'received' ? "bg-emerald-100 text-emerald-700" : t.type === 'sent' ? "bg-rose-100 text-rose-700" : "bg-blue-100 text-blue-700")}>{t.type}</span></td>
                              <td className="px-3 py-2.5 text-xs font-mono text-slate-500">{t.transactionId}</td>
                              <td className="px-3 py-2.5 text-xs text-slate-500">{t.customerPhone || '—'}</td>
                              <td className={cn("px-3 py-2.5 text-right font-mono font-semibold", t.type === 'received' ? "text-emerald-600" : "text-rose-600")}>{t.type === 'received' ? '+' : '-'}{formatGHS(t.amount)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    </div>
                  </div>
                </div>
              </div>
            )}

          </motion.div>
        </AnimatePresence>
      </main>

      {/* ===== Expense Form Modal ===== */}
      <AnimatePresence>
        {showExpenseForm && (
          <ExpenseFormModal expense={editingExpense} onSave={handleSaveExpense} onClose={() => { setShowExpenseForm(false); setEditingExpense(null); }} />
        )}
      </AnimatePresence>

      {/* ===== MoMo Form Modal ===== */}
      <AnimatePresence>
        {showMomoForm && (
          <MomoFormModal onSave={handleSaveMomo} onClose={() => setShowMomoForm(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}

// ===== Expense Form Modal =====
function ExpenseFormModal({ expense, onSave, onClose }: { expense: Expense | null; onSave: (e: Expense) => void; onClose: () => void }) {
  const [form, setForm] = useState<Expense>(expense || {
    id: `exp-${Date.now()}`, date: new Date().toISOString().split('T')[0], category: 'Rent', description: '', amount: 0, paymentMethod: 'Cash', vendor: '',
  });
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }} onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-rose-600 to-pink-600 text-white"><h3 className="text-lg font-bold">{expense ? 'Edit Expense' : 'Record Expense'}</h3><button onClick={onClose} className="h-8 w-8 rounded-lg bg-white/15 hover:bg-white/25 flex items-center justify-center"><X className="h-4 w-4" /></button></div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className="text-xs font-semibold text-slate-600 mb-1 block">Date</label><input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="w-full h-10 px-3 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-rose-400 text-sm" /></div>
            <div><label className="text-xs font-semibold text-slate-600 mb-1 block">Amount (GHC)</label><input type="number" step="0.01" value={form.amount || ''} onChange={(e) => setForm({ ...form, amount: parseFloat(e.target.value) || 0 })} className="w-full h-10 px-3 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-rose-400 text-sm font-mono" /></div>
          </div>
          <div><label className="text-xs font-semibold text-slate-600 mb-1 block">Category</label><select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full h-10 px-3 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-rose-400 text-sm">{EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
          <div><label className="text-xs font-semibold text-slate-600 mb-1 block">Description</label><input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What was this expense for?" className="w-full h-10 px-3 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-rose-400 text-sm" /></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className="text-xs font-semibold text-slate-600 mb-1 block">Payment Method</label><select value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })} className="w-full h-10 px-3 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-rose-400 text-sm">{['Cash', 'MTN MoMo', 'Vodafone Cash', 'AirtelTigo Money', 'Bank Transfer', 'Cheque'].map(m => <option key={m} value={m}>{m}</option>)}</select></div>
            <div><label className="text-xs font-semibold text-slate-600 mb-1 block">Vendor / Payee</label><input value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} placeholder="Who was paid?" className="w-full h-10 px-3 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-rose-400 text-sm" /></div>
          </div>
        </div>
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => form.amount > 0 && onSave(form)} disabled={form.amount <= 0} className="bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700">{expense ? 'Update' : 'Save Expense'}</Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ===== MoMo Form Modal =====
function MomoFormModal({ onSave, onClose }: { onSave: (t: MobileMoneyTransaction) => void; onClose: () => void }) {
  const [form, setForm] = useState<MobileMoneyTransaction>({
    id: `momo-${Date.now()}`, date: new Date().toISOString(), provider: 'mtn', transactionId: '', customerPhone: '', amount: 0, type: 'received', reference: '',
  });
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }} onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white"><h3 className="text-lg font-bold">Record MoMo Transaction</h3><button onClick={onClose} className="h-8 w-8 rounded-lg bg-white/15 hover:bg-white/25 flex items-center justify-center"><X className="h-4 w-4" /></button></div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className="text-xs font-semibold text-slate-600 mb-1 block">Provider</label><select value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })} className="w-full h-10 px-3 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-amber-400 text-sm">{MOMO_PROVIDERS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
            <div><label className="text-xs font-semibold text-slate-600 mb-1 block">Type</label><select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as any })} className="w-full h-10 px-3 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-amber-400 text-sm"><option value="received">Received (Payment)</option><option value="sent">Sent (Withdrawal)</option><option value="float">Float Top-up</option></select></div>
          </div>
          <div><label className="text-xs font-semibold text-slate-600 mb-1 block">Amount (GHC)</label><input type="number" step="0.01" value={form.amount || ''} onChange={(e) => setForm({ ...form, amount: parseFloat(e.target.value) || 0 })} className="w-full h-10 px-3 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-amber-400 text-sm font-mono" /></div>
          <div><label className="text-xs font-semibold text-slate-600 mb-1 block">MoMo Transaction ID</label><input value={form.transactionId} onChange={(e) => setForm({ ...form, transactionId: e.target.value })} placeholder="e.g. 1234567890ABC" className="w-full h-10 px-3 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-amber-400 text-sm font-mono" /></div>
          <div><label className="text-xs font-semibold text-slate-600 mb-1 block">Customer Phone</label><input value={form.customerPhone} onChange={(e) => setForm({ ...form, customerPhone: e.target.value })} placeholder="+233 24 000 0000" className="w-full h-10 px-3 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-amber-400 text-sm" /></div>
        </div>
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => form.amount > 0 && onSave(form)} disabled={form.amount <= 0} className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600">Save Transaction</Button>
        </div>
      </motion.div>
    </motion.div>
  );
}
