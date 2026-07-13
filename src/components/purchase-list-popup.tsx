"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import {
  X, Check, Monitor, Printer, Mail, MessageSquare, CreditCard,
  Image as ImageIcon, Upload, Search as SearchIcon,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { formatGHS } from "@/lib/pos-data";

// ===== Types =====
export interface PurchaseListRow {
  id: string;
  transactionType: string; // e.g. "1-AgriCorp Ghana"
  invoiceNo: string;
  date: string; // ISO YYYY-MM-DD
  reference?: string;
  reference2?: string;
  amount: number;
  paid: number;
  due: number;
}

interface PurchaseListPopupProps {
  transactions: PurchaseListRow[];
  onSelect?: (row: PurchaseListRow) => void;
  onClose: () => void;
  /** When true, opens as a centered modal overlay (used inside other popups).
   *  When false, opens as its own PopupWindow (used standalone from Purchase Menu).
   */
  asOverlay?: boolean;
  title?: string;
}

// Light teal background matching reference image
const TEAL_BG = '#D6ECE5';
const TEAL_HEADER = '#5B9BD5'; // dark blue title bar
const BTN_BLUE = '#2196F3';
const BTN_RED = '#F44336';
const BTN_GREEN = '#4CAF50';

const fmtDate = (iso: string) => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${parseInt(m)}/${parseInt(d)}/${y}`;
};

const fmtNum = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function PurchaseListPopup({
  transactions,
  onSelect,
  onClose,
  asOverlay = true,
  title = 'Purchases List',
}: PurchaseListPopupProps) {
  const { toast } = useToast();
  const [supplierFilter, setSupplierFilter] = useState('');
  const [refFilter, setRefFilter] = useState('');
  const [ref2Filter, setRef2Filter] = useState('');
  const [fromDate, setFromDate] = useState('2026-01-01');
  const [toDate, setToDate] = useState('2026-12-31');
  const [typeFilter, setTypeFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => searchRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, []);

  // Unique supplier names for the dropdown
  const supplierNames = useMemo(() => {
    const set = new Set(transactions.map(t => t.transactionType));
    return Array.from(set).sort();
  }, [transactions]);

  const filtered = useMemo(() => {
    return transactions.filter(t => {
      if (supplierFilter && t.transactionType !== supplierFilter) return false;
      if (refFilter && !(t.reference || '').toLowerCase().includes(refFilter.toLowerCase())) return false;
      if (ref2Filter && !(t.reference2 || '').toLowerCase().includes(ref2Filter.toLowerCase())) return false;
      if (fromDate && t.date < fromDate) return false;
      if (toDate && t.date > toDate) return false;
      if (typeFilter !== 'All') {
        // Type filter: All / Paid / Unpaid / Partial
        if (typeFilter === 'Paid' && t.due > 0) return false;
        if (typeFilter === 'Unpaid' && t.paid > 0) return false;
        if (typeFilter === 'Partial' && (t.paid === 0 || t.due === 0)) return false;
      }
      if (search) {
        const q = search.toLowerCase();
        if (!t.transactionType.toLowerCase().includes(q) &&
            !t.invoiceNo.toLowerCase().includes(q) &&
            !fmtDate(t.date).includes(q)) return false;
      }
      return true;
    });
  }, [transactions, supplierFilter, refFilter, ref2Filter, fromDate, toDate, typeFilter, search]);

  // Keep selectedIndex in range
  useEffect(() => {
    if (selectedIndex >= filtered.length) setSelectedIndex(Math.max(0, filtered.length - 1));
  }, [filtered.length, selectedIndex]);

  const totals = useMemo(() => filtered.reduce((acc, t) => ({
    amount: acc.amount + t.amount, paid: acc.paid + t.paid, due: acc.due + t.due,
  }), { amount: 0, paid: 0, due: 0 }), [filtered]);

  const toggleCheck = (id: string) => {
    setCheckedIds(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const handleSelect = () => {
    const row = filtered[selectedIndex];
    if (!row) {
      toast({ title: 'No row selected', variant: 'destructive' });
      return;
    }
    if (onSelect) onSelect(row);
    else toast({ title: 'Selected', description: `${row.transactionType} · ${row.invoiceNo}` });
    // ALWAYS close the popup after Select — the parent's onSelect handler
    // may also close it, but this ensures the popup closes even if the
    // handler throws or returns early.
    onClose();
  };

  const handlePrint = () => {
    if (filtered.length === 0) { toast({ title: 'Nothing to print', variant: 'destructive' }); return; }
    toast({ title: 'Printing Purchases List', description: `${filtered.length} transactions sent to printer` });
    window.print();
  };

  const handleEmail = () => {
    toast({ title: 'Email Sent', description: `Purchases list emailed for ${checkedIds.size || 'all'} transactions` });
  };

  const handleSMS = () => {
    toast({ title: 'SMS Sent', description: 'Purchase notification sent via SMS' });
  };

  const handlePayments = () => {
    const row = filtered[selectedIndex];
    if (!row) { toast({ title: 'Select a row first', variant: 'destructive' }); return; }
    toast({ title: 'Payment Entry', description: `Recording payment for ${row.invoiceNo} — Due: ${formatGHS(row.due)}` });
  };

  const handlePicture = () => {
    const row = filtered[selectedIndex];
    if (!row) { toast({ title: 'Select a row first', variant: 'destructive' }); return; }
    toast({ title: 'Invoice Picture', description: `Viewing picture for invoice ${row.invoiceNo}` });
  };

  const handleExport = () => {
    if (filtered.length === 0) { toast({ title: 'Nothing to export', variant: 'destructive' }); return; }
    import('xlsx').then((XLSX) => {
      const data = filtered.map(t => ({
        'Transaction Type': t.transactionType,
        'Invoice #': t.invoiceNo,
        'Date': fmtDate(t.date),
        'Reference #': t.reference || '',
        'Reference #2': t.reference2 || '',
        'Amount GHC': t.amount,
        'Paid GHC': t.paid,
        'Due GHC': t.due,
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Purchases List');
      XLSX.writeFile(wb, `purchases-list-${new Date().toISOString().split('T')[0]}.xlsx`);
      toast({ title: 'Exported successfully', description: `${filtered.length} rows to Excel` });
    });
  };

  const handleScreen = () => {
    toast({ title: 'Screen Preview (F2)', description: 'Showing full screen report view' });
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex(i => Math.min(filtered.length - 1, i + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex(i => Math.max(0, i - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); handleSelect(); }
    else if (e.key === 'Escape') { e.preventDefault(); onClose(); }
  };

  const body = (
    <div className="h-full flex flex-col" style={{ fontFamily: 'Arial, Helvetica, sans-serif', backgroundColor: TEAL_BG }}>
      {/* Top Filter Row */}
      <div className="flex-shrink-0 px-3 py-2 flex items-center gap-3 flex-wrap" style={{ backgroundColor: TEAL_BG }}>
        <div className="flex items-center gap-1">
          <label className="text-[10px] font-bold text-slate-800">Supplier's Name:</label>
          <select value={supplierFilter} onChange={(e) => setSupplierFilter(e.target.value)} className="h-6 px-1 text-[10px] border border-slate-400 rounded bg-white outline-none min-w-[140px]">
            <option value="">All Suppliers</option>
            {supplierNames.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-1">
          <label className="text-[10px] font-bold text-slate-800">Reference:</label>
          <input value={refFilter} onChange={(e) => setRefFilter(e.target.value)} placeholder="" className="h-6 w-20 px-1 text-[10px] border border-slate-400 rounded bg-white outline-none" />
        </div>
        <div className="flex items-center gap-1">
          <label className="text-[10px] font-bold text-slate-800">Reference 2:</label>
          <input value={ref2Filter} onChange={(e) => setRef2Filter(e.target.value)} placeholder="" className="h-6 w-20 px-1 text-[10px] border border-slate-400 rounded bg-white outline-none" />
        </div>
        <div className="flex items-center gap-1 ml-auto">
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="h-6 px-1 text-[10px] border border-slate-400 rounded bg-white outline-none" />
          <span className="text-[10px] font-bold text-slate-800">to</span>
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="h-6 px-1 text-[10px] border border-slate-400 rounded bg-white outline-none" />
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="h-6 px-1 text-[10px] border border-slate-400 rounded bg-white outline-none">
            <option>All</option>
            <option>Paid</option>
            <option>Unpaid</option>
            <option>Partial</option>
          </select>
        </div>
      </div>

      {/* Search Row */}
      <div className="flex-shrink-0 px-3 py-1.5 flex items-center gap-2 border-b border-slate-300" style={{ backgroundColor: '#E8F4EE' }}>
        <SearchIcon className="h-3.5 w-3.5 text-slate-600" />
        <input
          ref={searchRef}
          value={search}
          onChange={(e) => { setSearch(e.target.value); setSelectedIndex(0); }}
          onKeyDown={handleKeyDown}
          placeholder="Search by supplier, invoice, or date..."
          className="flex-1 h-6 px-2 text-[10px] border border-slate-400 rounded bg-white outline-none focus:ring-1 focus:ring-blue-400"
        />
        <span className="text-[10px] text-slate-700 font-mono">{filtered.length} of {transactions.length} transactions</span>
      </div>

      {/* Table Header */}
      <div className="flex-shrink-0 grid grid-cols-[28px_1fr_70px_80px_70px_70px_80px_70px_70px] gap-0.5 px-2 py-1 text-[9px] font-bold text-slate-800 border-b border-slate-400" style={{ backgroundColor: '#B3D9CC' }}>
        <div className="text-center">✓</div>
        <div>Transaction Type</div>
        <div className="text-center">Invoice #</div>
        <div className="text-center">Date</div>
        <div className="text-center">Reference #</div>
        <div className="text-center">Reference #2</div>
        <div className="text-right">Amount GHC</div>
        <div className="text-right">Paid GHC</div>
        <div className="text-right">Due GHC ▲</div>
      </div>

      {/* Table Body */}
      <div className="flex-1 overflow-hidden min-h-0" onKeyDown={handleKeyDown} tabIndex={0}>
        <ScrollArea className="h-full">
          <div>
            {filtered.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-[11px]">No transactions match the current filters.</div>
            ) : (
              filtered.map((t, idx) => {
                const isSelected = idx === selectedIndex;
                const isChecked = checkedIds.has(t.id);
                return (
                  <div
                    key={t.id}
                    onClick={() => setSelectedIndex(idx)}
                    onDoubleClick={handleSelect}
                    className="grid grid-cols-[28px_1fr_70px_80px_70px_70px_80px_70px_70px] gap-0.5 px-2 py-0.5 text-[10px] cursor-pointer border-b border-slate-200"
                    style={{ backgroundColor: isSelected ? '#A8D8C8' : (isChecked ? '#C8E6C9' : (idx % 2 === 1 ? '#F0F8F4' : '#FFFFFF')) }}
                  >
                    <div className="text-center">
                      <input type="checkbox" checked={isChecked} onChange={(e) => { e.stopPropagation(); toggleCheck(t.id); }} className="h-3 w-3 accent-blue-600" />
                    </div>
                    <div className="truncate font-medium text-slate-800">{t.transactionType}</div>
                    <div className="text-center font-mono text-slate-700">{t.invoiceNo}</div>
                    <div className="text-center text-slate-700">{fmtDate(t.date)}</div>
                    <div className="text-center text-slate-600">{t.reference || ''}</div>
                    <div className="text-center text-slate-600">{t.reference2 || ''}</div>
                    <div className="text-right font-mono text-slate-800">{fmtNum(t.amount)}</div>
                    <div className="text-right font-mono text-emerald-700">{fmtNum(t.paid)}</div>
                    <div className={cn("text-right font-mono font-semibold", t.due > 0 ? "text-rose-700" : "text-slate-500")}>{fmtNum(t.due)}</div>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Totals Bar */}
      <div className="flex-shrink-0 px-3 py-1 flex items-center justify-between text-[10px] font-mono border-t border-slate-400" style={{ backgroundColor: '#B3D9CC' }}>
        <span className="font-bold text-slate-800">{filtered.length}</span>
        <div className="flex items-center gap-4">
          <span className="text-slate-700">Amount: <span className="font-bold text-slate-900">{fmtNum(totals.amount)}</span></span>
          <span className="text-slate-700">Paid: <span className="font-bold text-emerald-700">{fmtNum(totals.paid)}</span></span>
          <span className="text-slate-700">Due: <span className="font-bold text-rose-700">{fmtNum(totals.due)}</span></span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex-shrink-0 px-3 py-2 flex items-center gap-1.5 flex-wrap border-t border-slate-300" style={{ backgroundColor: '#E8F4EE' }}>
        <button onClick={handleSelect} className="h-7 px-2.5 rounded text-white text-[9px] font-semibold flex items-center gap-1 transition shadow-sm" style={{ backgroundColor: BTN_BLUE }}><Check className="h-3 w-3" /> Select <kbd className="text-[7px] bg-white/20 px-0.5 rounded">Enter</kbd></button>
        <button onClick={handleScreen} className="h-7 px-2.5 rounded text-white text-[9px] font-semibold flex items-center gap-1 transition shadow-sm" style={{ backgroundColor: BTN_BLUE }}><Monitor className="h-3 w-3" /> Screen <kbd className="text-[7px] bg-white/20 px-0.5 rounded">F2</kbd></button>
        <button onClick={handlePrint} className="h-7 px-2.5 rounded text-white text-[9px] font-semibold flex items-center gap-1 transition shadow-sm" style={{ backgroundColor: BTN_BLUE }}><Printer className="h-3 w-3" /> Print <kbd className="text-[7px] bg-white/20 px-0.5 rounded">F3</kbd></button>
        <button onClick={handleEmail} className="h-7 px-2.5 rounded text-white text-[9px] font-semibold flex items-center gap-1 transition shadow-sm" style={{ backgroundColor: BTN_BLUE }}><Mail className="h-3 w-3" /> Email</button>
        <button onClick={handleSMS} className="h-7 px-2.5 rounded text-white text-[9px] font-semibold flex items-center gap-1 transition shadow-sm" style={{ backgroundColor: BTN_BLUE }}><MessageSquare className="h-3 w-3" /> SMS</button>
        <button onClick={handlePayments} className="h-7 px-2.5 rounded text-white text-[9px] font-semibold flex items-center gap-1 transition shadow-sm" style={{ backgroundColor: BTN_BLUE }}><CreditCard className="h-3 w-3" /> Payments</button>
        <button onClick={handlePicture} className="h-7 px-2.5 rounded text-white text-[9px] font-semibold flex items-center gap-1 transition shadow-sm" style={{ backgroundColor: BTN_BLUE }}><ImageIcon className="h-3 w-3" /> Picture</button>
        <button onClick={handleExport} className="h-7 px-2.5 rounded text-white text-[9px] font-semibold flex items-center gap-1 transition shadow-sm" style={{ backgroundColor: BTN_BLUE }}><Upload className="h-3 w-3" /> Export</button>
        <div className="flex-1" />
        <button onClick={onClose} className="h-7 px-2.5 rounded text-white text-[9px] font-semibold flex items-center gap-1 transition shadow-sm" style={{ backgroundColor: BTN_RED }}><X className="h-3 w-3" /> Close <kbd className="text-[7px] bg-white/20 px-0.5 rounded">Esc</kbd></button>
      </div>

      {/* Status Bar */}
      <div className="flex-shrink-0 px-3 py-0.5 text-[8px] text-slate-700 flex items-center gap-3" style={{ backgroundColor: '#C8D8D0' }}>
        <span className="font-mono">Total: {fmtNum(totals.amount)} GHC</span>
        <span className="font-mono">· Checked: {checkedIds.size}</span>
        <div className="flex-1" />
        <span>Source: Main Store</span>
      </div>
    </div>
  );

  if (asOverlay) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60]"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.95, y: 20 }}
          onClick={(e) => e.stopPropagation()}
          className="rounded-lg shadow-2xl overflow-hidden flex flex-col w-full"
          style={{ width: '100%', maxWidth: '900px', maxHeight: '90vh', fontFamily: 'Arial, Helvetica, sans-serif' }}
        >
          {/* Title Bar */}
          <div className="flex-shrink-0 flex items-center justify-between px-3 h-7 text-white" style={{ backgroundColor: TEAL_HEADER }}>
            <span className="text-xs font-bold">{title}</span>
            <button onClick={onClose} className="h-5 w-5 rounded bg-red-600 hover:bg-red-700 flex items-center justify-center transition"><X className="h-3 w-3 text-white" /></button>
          </div>
          {body}
        </motion.div>
      </motion.div>
    );
  }

  // Standalone mode returns just the body — parent will wrap in its own PopupWindow
  return body;
}
