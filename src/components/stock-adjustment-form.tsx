"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Save, Printer, Trash2, Upload, Download, X, Search as SearchIcon,
  Package, AlertTriangle, ScanLine, Plus, Minus, ArrowUpDown,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  COMPANY, formatGHS, type Product, type StockGroup, type StockHistoryEntry,
} from "@/lib/pos-data";
import { PopupWindow } from "@/components/popup-window";

// ===== Color palette (matching the reference image — dark blue professional theme) =====
const HEADER_DARK_BLUE = '#1E5A8E';
const BTN_BLUE = '#1E5A8E';
const BTN_BLUE_HOVER = '#164673';
const BTN_RED = '#F44336';
const ON_HAND_BG = '#FFF8DC';       // light yellow for On Hand column
const FIELD_BORDER = '#808080';
const GRID_LINE = '#999999';
const REASON_BAR_BG = '#FFF8E1';    // amber tint for reason bar

// ===== Adjustment line interface =====
interface AdjustLine {
  id: string;
  partNo: string;
  details: string;
  emoji: string;
  onHand: number;
  newQty: number;
  qty: number;          // variance = newQty - onHand
  cost: number;
  total: number;        // qty * cost
  productId: string;
}

// ===== Common adjustment reasons =====
const ADJUSTMENT_REASONS = [
  'Damaged goods',
  'Expired stock',
  'Theft / Loss',
  'Found stock',
  'Received stock (no PO)',
  'Initial count correction',
  'Sample / Display',
  'Staff error',
  'Stocktake correction',
  'Other (specify in Details)',
];

interface StockAdjustmentFormProps {
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  setHistory: React.Dispatch<React.SetStateAction<StockHistoryEntry[]>>;
  groups: StockGroup[];
  onClose: () => void;
  /** Optional pre-selected product ID */
  initialProductId?: string;
}

export function StockAdjustmentForm({
  products,
  setProducts,
  setHistory,
  groups,
  onClose,
  initialProductId,
}: StockAdjustmentFormProps) {
  const { toast } = useToast();

  // ===== Form state =====
  const [refNumber, setRefNumber] = useState(`ADJ-${Date.now().toString().slice(-6)}`);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [details, setDetails] = useState('');
  const [postToAC, setPostToAC] = useState('Inventory Adjustment');
  const [adjustReason, setAdjustReason] = useState('Damaged goods');
  const [fromPartNo, setFromPartNo] = useState('');
  const [toPartNo, setToPartNo] = useState('');
  const [groupFilter, setGroupFilter] = useState('all');
  const [bin, setBin] = useState('');
  const [lines, setLines] = useState<AdjustLine[]>([]);
  const [selectedLine, setSelectedLine] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);

  // ===== Find Part No state =====
  const [findPartNo, setFindPartNo] = useState('');
  const [showStockSearch, setShowStockSearch] = useState(false);
  const findPartNoRef = useRef<HTMLInputElement>(null);

  // ===== Scan mode state =====
  const [scanMode, setScanMode] = useState(false);
  const scanBufferRef = useRef('');
  const scanTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastKeyTimeRef = useRef(0);
  const [scanBuffer, setScanBuffer] = useState('');
  const [scanStats, setScanStats] = useState({ scanned: 0, added: 0, notFound: 0 });

  // ===== Auto-add initial product if provided =====
  useEffect(() => {
    if (initialProductId) {
      const p = products.find(p => p.id === initialProductId);
      if (p) addProductToLines(p);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialProductId]);

  // ===== Compute totals =====
  const totals = useMemo(() => {
    const totalQty = lines.reduce((s, l) => s + l.onHand, 0);
    const totalCost = lines.reduce((s, l) => s + l.total, 0);
    const totalVariance = lines.reduce((s, l) => s + l.qty, 0);
    return { totalQty, totalCost, totalVariance };
  }, [lines]);

  // ===== Add product to table =====
  const addProductToLines = (product: Product) => {
    if (lines.some(l => l.productId === product.id)) {
      toast({ title: 'Already in table', description: `${product.emoji} ${product.name}` });
      return;
    }
    const newLine: AdjustLine = {
      id: `line-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      partNo: product.sku,
      details: `${product.emoji} ${product.name}`,
      emoji: product.emoji,
      onHand: product.stock,
      newQty: product.stock,
      qty: 0,
      cost: product.costPrice,
      total: 0,
      productId: product.id,
    };
    setLines(prev => [...prev, newLine]);
    setSelectedLine(lines.length);
    setFindPartNo('');
    setSaved(false);
    toast({ title: 'Product added', description: `${product.emoji} ${product.name}` });
  };

  // ===== Update a line's new quantity =====
  const updateLineQty = (idx: number, newQty: number) => {
    setLines(prev => prev.map((l, i) => {
      if (i !== idx) return l;
      const qty = newQty - l.onHand;
      return { ...l, newQty, qty, total: qty * l.cost };
    }));
    setSaved(false);
  };

  // ===== Update a line's cost =====
  const updateLineCost = (idx: number, cost: number) => {
    setLines(prev => prev.map((l, i) => {
      if (i !== idx) return l;
      return { ...l, cost, total: l.qty * cost };
    }));
    setSaved(false);
  };

  // ===== Remove a line =====
  const removeLine = (idx: number) => {
    setLines(prev => prev.filter((_, i) => i !== idx));
    setSelectedLine(null);
    setSaved(false);
    toast({ title: 'Line removed' });
  };

  // ===== Find Part No handler =====
  const handleFindPartNo = (value: string) => {
    setFindPartNo(value);
    if (value.length > 0) {
      const direct = products.find(p =>
        p.sku.toLowerCase() === value.toLowerCase() || p.barcode === value
      );
      if (direct) { addProductToLines(direct); return; }
      setShowStockSearch(true);
    } else {
      setShowStockSearch(false);
    }
  };

  // ===== Load range =====
  const handleLoadRange = () => {
    const matched = products.filter(p => {
      if (groupFilter !== 'all' && p.groupId !== groupFilter) return false;
      if (fromPartNo && p.sku.toLowerCase() < fromPartNo.toLowerCase()) return false;
      if (toPartNo && p.sku.toLowerCase() > toPartNo.toLowerCase()) return false;
      if (bin && !p.batchNumber.toLowerCase().includes(bin.toLowerCase())) return false;
      return true;
    });
    if (matched.length === 0) {
      toast({ title: 'No products match the range', variant: 'destructive' });
      return;
    }
    const newLines: AdjustLine[] = [];
    matched.forEach(p => {
      if (lines.some(l => l.productId === p.id)) return;
      newLines.push({
        id: `line-${Date.now()}-${Math.random().toString(36).slice(2, 6)}-${p.id}`,
        partNo: p.sku, details: `${p.emoji} ${p.name}`, emoji: p.emoji,
        onHand: p.stock, newQty: p.stock, qty: 0, cost: p.costPrice, total: 0, productId: p.id,
      });
    });
    if (newLines.length === 0) { toast({ title: 'All matching products already in table' }); return; }
    setLines(prev => [...prev, ...newLines]);
    setSaved(false);
    toast({ title: `${newLines.length} products loaded`, description: `Total lines: ${lines.length + newLines.length}` });
  };

  // ===== Process scanned barcode =====
  const processScannedBarcode = (barcode: string) => {
    const trimmed = barcode.trim();
    if (!trimmed) return;
    setScanStats(prev => ({ ...prev, scanned: prev.scanned + 1 }));
    const product = products.find(p =>
      p.barcode === trimmed || p.sku.toLowerCase() === trimmed.toLowerCase() ||
      p.barcode === trimmed.padStart(13, '0')
    );
    if (!product) {
      setScanStats(prev => ({ ...prev, notFound: prev.notFound + 1 }));
      toast({ title: 'Barcode not found', description: `"${trimmed}"`, variant: 'destructive' });
      return;
    }
    const existingIdx = lines.findIndex(l => l.productId === product.id);
    if (existingIdx >= 0) {
      const newQty = lines[existingIdx].newQty + 1;
      updateLineQty(existingIdx, newQty);
    } else {
      const newLine: AdjustLine = {
        id: `line-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        partNo: product.sku, details: `${product.emoji} ${product.name}`, emoji: product.emoji,
        onHand: product.stock, newQty: product.stock + 1, qty: 1, cost: product.costPrice,
        total: product.costPrice, productId: product.id,
      };
      setLines(prev => [...prev, newLine]);
    }
    setScanStats(prev => ({ ...prev, added: prev.added + 1 }));
    setSaved(false);
  };

  // ===== Scanner keydown listener =====
  useEffect(() => {
    if (!scanMode) return;
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) return;
      const now = Date.now();
      if (e.key === 'Enter') {
        if (scanBufferRef.current.length > 0) {
          processScannedBarcode(scanBufferRef.current);
          scanBufferRef.current = '';
          setScanBuffer('');
          if (scanTimerRef.current) { clearTimeout(scanTimerRef.current); scanTimerRef.current = null; }
        }
        e.preventDefault();
        return;
      }
      if (e.key.length !== 1) return;
      if (now - lastKeyTimeRef.current > 100 && scanBufferRef.current.length > 0) scanBufferRef.current = '';
      lastKeyTimeRef.current = now;
      scanBufferRef.current += e.key;
      setScanBuffer(scanBufferRef.current);
      if (scanTimerRef.current) clearTimeout(scanTimerRef.current);
      scanTimerRef.current = setTimeout(() => {
        if (scanBufferRef.current.length >= 4) {
          processScannedBarcode(scanBufferRef.current);
          scanBufferRef.current = '';
          setScanBuffer('');
        }
      }, 150);
    };
    window.addEventListener('keydown', handler);
    return () => { window.removeEventListener('keydown', handler); if (scanTimerRef.current) clearTimeout(scanTimerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanMode, lines, products]);

  // ===== Save =====
  const handleSave = () => {
    const changedLines = lines.filter(l => l.qty !== 0);
    if (changedLines.length === 0) {
      toast({ title: 'No adjustments to save', description: 'All new quantities match on-hand stock', variant: 'destructive' });
      return;
    }
    setProducts(prev => prev.map(p => {
      const line = changedLines.find(l => l.productId === p.id);
      return line ? { ...p, stock: line.newQty } : p;
    }));
    const reason = adjustReason === 'Other (specify in Details)' && details ? details : adjustReason;
    const newHistory: StockHistoryEntry[] = changedLines.map(l => ({
      id: `h-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      productId: l.productId, productName: l.details, sku: l.partNo,
      action: 'adjusted', quantityChange: l.qty, newQuantity: l.newQty,
      timestamp: new Date().toISOString(), user: 'Sarah Johnson',
      reason: `${reason} — variance ${l.qty > 0 ? '+' : ''}${l.qty}`,
      reference: refNumber,
    }));
    setHistory(prev => [...prev, ...newHistory]);
    setSaved(true);
    toast({
      title: `Saved (F2) — Stock Adjustment`,
      description: `${changedLines.length} items adjusted · Reason: ${reason} · Variance: ${totals.totalVariance > 0 ? '+' : ''}${totals.totalVariance} · ${formatGHS(Math.abs(totals.totalCost))}`,
    });
  };

  // ===== Print =====
  const handlePrint = () => {
    if (lines.length === 0) { toast({ title: 'Nothing to print', variant: 'destructive' }); return; }
    const printWin = window.open('', '_blank', 'width=900,height=600');
    if (!printWin) { toast({ title: 'Popup blocked', variant: 'destructive' }); return; }
    const rows = lines.map((l, i) => `<tr style="background:${i % 2 === 1 ? '#F8F8F8' : '#FFFFFF'}">
      <td style="border:1px solid #999;padding:4px 6px;text-align:center">${i + 1}</td>
      <td style="border:1px solid #999;padding:4px 6px;font-family:monospace">${l.partNo}</td>
      <td style="border:1px solid #999;padding:4px 6px">${l.details}</td>
      <td style="border:1px solid #999;padding:4px 6px;text-align:right;background:#FFF8DC">${l.onHand}</td>
      <td style="border:1px solid #999;padding:4px 6px;text-align:right">${l.newQty}</td>
      <td style="border:1px solid #999;padding:4px 6px;text-align:right;color:${l.qty > 0 ? '#16A34A' : (l.qty < 0 ? '#DC2626' : '#666')}">${l.qty > 0 ? '+' : ''}${l.qty}</td>
      <td style="border:1px solid #999;padding:4px 6px;text-align:right">${l.cost.toFixed(4)}</td>
      <td style="border:1px solid #999;padding:4px 6px;text-align:right;font-weight:bold">${l.total.toFixed(3)}</td>
    </tr>`).join('');
    printWin.document.write(`<!DOCTYPE html><html><head><title>Stock Adjustment — ${refNumber}</title>
      <style>body{font-family:Arial,sans-serif;margin:20px}.header{text-align:center;border-bottom:2px solid #333;padding-bottom:10px;margin-bottom:15px}.header h1{margin:0;font-size:18px}.header div{font-size:12px;color:#666}table{width:100%;border-collapse:collapse;font-size:11px}th{background:#1E5A8E;color:white;border:1px solid #999;padding:5px 6px}.totals{margin-top:15px;margin-left:auto;width:320px;font-size:11px}.totals td{padding:4px 8px}.totals .total-row{font-weight:bold;border-top:2px solid #333}</style>
      </head><body><div class="header"><h1>${COMPANY.name}</h1><div>${COMPANY.address} · ${COMPANY.contact}</div></div>
      <h2 style="text-align:center;font-size:14px;margin:10px 0">Stock Adjustment Report</h2>
      <div style="display:flex;justify-content:space-between;margin-bottom:15px;font-size:11px">
        <div><strong>Reference:</strong> ${refNumber} · <strong>Date:</strong> ${date} · <strong>Reason:</strong> ${adjustReason}</div>
        <div><strong>Post To A/C:</strong> ${postToAC}</div>
      </div>
      <table><thead><tr><th>#</th><th>Part Number</th><th>Details</th><th>On Hand</th><th>New Qty</th><th>Qty</th><th>Cost GHC</th><th>Total GHC</th></tr></thead><tbody>${rows}</tbody></table>
      <table class="totals"><tr><td>Total Qty On Hand:</td><td style="text-align:right">${totals.totalQty}</td></tr><tr><td>Variance:</td><td style="text-align:right;color:${totals.totalVariance > 0 ? '#16A34A' : (totals.totalVariance < 0 ? '#DC2626' : '#666')}">${totals.totalVariance > 0 ? '+' : ''}${totals.totalVariance}</td></tr><tr class="total-row"><td>Total GHC:</td><td style="text-align:right">${formatGHS(totals.totalCost)}</td></tr></table>
      </body></html>`);
    printWin.document.close();
    setTimeout(() => { printWin.focus(); printWin.print(); }, 300);
    toast({ title: 'Printing (F3)', description: `${lines.length} lines` });
  };

  // ===== Delete (clear all) =====
  const handleDelete = () => {
    if (lines.length === 0) { toast({ title: 'Nothing to delete' }); return; }
    setLines([]); setSelectedLine(null); setSaved(false);
    toast({ title: 'Deleted (F4)', description: 'All lines cleared' });
  };

  // ===== Export =====
  const handleExport = () => {
    if (lines.length === 0) { toast({ title: 'Nothing to export', variant: 'destructive' }); return; }
    import('xlsx').then((XLSX) => {
      type Row = Record<string, string | number>;
      const data: Row[] = lines.map((l, i) => ({
        '#': i + 1, 'Part Number': l.partNo, 'Details': l.details,
        'On Hand': l.onHand, 'New Qty': l.newQty, 'Qty (Variance)': l.qty,
        'Cost GHC': l.cost, 'Total GHC': l.total,
      }));
      data.push({ '#': '', 'Part Number': '', 'Details': 'TOTAL', 'On Hand': totals.totalQty, 'New Qty': '', 'Qty (Variance)': totals.totalVariance, 'Cost GHC': '', 'Total GHC': totals.totalCost });
      const ws = XLSX.utils.json_to_sheet(data);
      ws['!cols'] = [{ wch: 5 }, { wch: 16 }, { wch: 30 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 12 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Stock Adjustment');
      XLSX.writeFile(wb, `stock-adjustment-${refNumber}-${new Date().toISOString().split('T')[0]}.xlsx`);
      toast({ title: 'Exported successfully', description: `${lines.length} rows` });
    });
  };

  // ===== Import =====
  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.xlsx,.xls,.csv';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      import('xlsx').then((XLSX) => {
        const reader = new FileReader();
        reader.onload = (ev) => {
          try {
            const wb = XLSX.read(ev.target?.result, { type: 'binary' });
            const ws = wb.Sheets[wb.SheetNames[0]];
            const rows: any[] = XLSX.utils.sheet_to_json(ws);
            let added = 0;
            rows.forEach((r) => {
              const partNo = String(r['Part Number'] || r['SKU'] || '').trim();
              const newQty = Number(r['New Qty'] || r['Counted'] || r['Qty'] || 0);
              if (!partNo) return;
              const product = products.find(p => p.sku.toLowerCase() === partNo.toLowerCase() || p.barcode === partNo);
              if (!product) return;
              if (lines.some(l => l.productId === product.id)) return;
              const qty = newQty - product.stock;
              setLines(prev => [...prev, {
                id: `line-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                partNo: product.sku, details: `${product.emoji} ${product.name}`, emoji: product.emoji,
                onHand: product.stock, newQty, qty, cost: product.costPrice, total: qty * product.costPrice, productId: product.id,
              }]);
              added++;
            });
            toast({ title: `Imported ${added} rows`, description: file.name });
          } catch { toast({ title: 'Import failed', variant: 'destructive' }); }
        };
        reader.readAsBinaryString(file);
      });
    };
    input.click();
  };

  // ===== Keyboard shortcuts =====
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (scanMode) return;
      const target = e.target as HTMLElement;
      const isTyping = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT');
      if (e.key === 'F2') { e.preventDefault(); handleSave(); }
      else if (e.key === 'F3') { e.preventDefault(); handlePrint(); }
      else if (e.key === 'F4') { e.preventDefault(); handleDelete(); }
      else if (e.key === 'Escape' && !isTyping && !showStockSearch) { e.preventDefault(); onClose(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines, adjustReason, details, postToAC, date, refNumber, showStockSearch, scanMode]);

  return (
    <PopupWindow
      title="Stock Adjustment"
      titleBarColor={HEADER_DARK_BLUE}
      initialWidth={920}
      initialHeight={640}
      minWidth={720}
      minHeight={520}
      onClose={onClose}
    >
      <div className="h-full flex flex-col bg-white" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
        {/* ===== Top: Header fields ===== */}
        <div className="flex-shrink-0 px-3 py-2 grid grid-cols-[1fr_1fr] gap-x-4 gap-y-1.5 bg-white border-b border-slate-300">
          {/* Left column */}
          <div className="flex items-center gap-2">
            <label className="text-[10px] font-bold text-slate-800 w-14">Reference:</label>
            <input value={refNumber} onChange={(e) => setRefNumber(e.target.value)} className="h-6 w-32 px-2 text-[10px] border rounded bg-white outline-none focus:ring-1 focus:ring-blue-400 font-mono" style={{ borderColor: FIELD_BORDER }} />
          </div>
          <div className="flex items-center gap-2 justify-end">
            <label className="text-[10px] font-bold text-slate-800">From Part No.:</label>
            <input value={fromPartNo} onChange={(e) => setFromPartNo(e.target.value)} placeholder="e.g. FR-001" className="h-6 w-24 px-2 text-[10px] font-mono border rounded bg-white outline-none focus:ring-1 focus:ring-blue-400" style={{ borderColor: FIELD_BORDER }} />
            <label className="text-[10px] font-bold text-slate-800">To Part No.:</label>
            <input value={toPartNo} onChange={(e) => setToPartNo(e.target.value)} placeholder="e.g. GR-999" className="h-6 w-24 px-2 text-[10px] font-mono border rounded bg-white outline-none focus:ring-1 focus:ring-blue-400" style={{ borderColor: FIELD_BORDER }} />
          </div>

          <div className="flex items-center gap-2">
            <label className="text-[10px] font-bold text-slate-800 w-14">Date:</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-6 w-32 px-2 text-[10px] border rounded bg-white outline-none focus:ring-1 focus:ring-blue-400" style={{ borderColor: FIELD_BORDER }} />
          </div>
          <div className="flex items-center gap-2 justify-end">
            <label className="text-[10px] font-bold text-slate-800">Group:</label>
            <select value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)} className="h-6 px-2 text-[10px] border rounded bg-white outline-none focus:ring-1 focus:ring-blue-400" style={{ borderColor: FIELD_BORDER }}>
              <option value="all">All Groups</option>
              {groups.map(g => <option key={g.id} value={g.id}>{g.icon} {g.name}</option>)}
            </select>
            <label className="text-[10px] font-bold text-slate-800">Bin:</label>
            <input value={bin} onChange={(e) => setBin(e.target.value)} placeholder="Batch" className="h-6 w-20 px-2 text-[10px] font-mono border rounded bg-white outline-none focus:ring-1 focus:ring-blue-400" style={{ borderColor: FIELD_BORDER }} />
            <button onClick={handleLoadRange} className="h-6 px-2 rounded text-white text-[9px] font-bold transition" style={{ backgroundColor: HEADER_DARK_BLUE }} title="Load all products in range">Load Range</button>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-[10px] font-bold text-slate-800 w-14">Details:</label>
            <input value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Reason for adjustment..." className="h-6 flex-1 px-2 text-[10px] border rounded bg-white outline-none focus:ring-1 focus:ring-blue-400" style={{ borderColor: FIELD_BORDER }} />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[10px] font-bold text-slate-800 w-20">Post To A/C:</label>
            <input value={postToAC} onChange={(e) => setPostToAC(e.target.value)} className="h-6 flex-1 px-2 text-[10px] border rounded bg-white outline-none focus:ring-1 focus:ring-blue-400" style={{ borderColor: FIELD_BORDER }} />
          </div>
        </div>

        {/* ===== Adjustment Reason bar (prominent, amber-themed) ===== */}
        <div className="flex-shrink-0 px-3 py-2 border-b flex items-center gap-3" style={{ backgroundColor: REASON_BAR_BG, borderColor: '#E0E0E0' }}>
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <label className="text-[10px] font-bold text-amber-800 uppercase">Adjustment Reason:</label>
            <select
              value={adjustReason}
              onChange={(e) => setAdjustReason(e.target.value)}
              className="h-7 px-2 text-[11px] font-semibold border border-amber-400 rounded bg-white outline-none focus:ring-2 focus:ring-amber-400 min-w-[180px]"
            >
              {ADJUSTMENT_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="flex-1" />
          <span className="text-[9px] text-amber-700 italic">Reason will be applied to all adjusted items when saved</span>
        </div>

        {/* ===== Find Part No bar ===== */}
        <div className="flex-shrink-0 px-3 py-1.5 flex items-center gap-2 bg-slate-50 border-b border-slate-300">
          <label className="text-[10px] font-bold text-slate-700">Find Part no:</label>
          <input
            ref={findPartNoRef}
            value={findPartNo}
            onChange={(e) => handleFindPartNo(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (findPartNo) {
                  const direct = products.find(p => p.sku.toLowerCase() === findPartNo.toLowerCase() || p.barcode === findPartNo);
                  if (direct) addProductToLines(direct);
                  else setShowStockSearch(true);
                }
              }
              if (e.key === 'Escape') setShowStockSearch(false);
            }}
            placeholder="Type SKU or barcode, press Enter to add..."
            className="h-6 w-56 px-2 text-[10px] font-mono border rounded outline-none focus:ring-1 focus:ring-blue-400"
            style={{ borderColor: FIELD_BORDER, backgroundColor: '#FFFFCC' }}
          />
          <button onClick={() => setShowStockSearch(true)} className="h-6 px-2 rounded text-white text-[9px] font-bold flex items-center gap-1 transition" style={{ backgroundColor: HEADER_DARK_BLUE }} title="Open Stock Search">
            <SearchIcon className="h-3 w-3" /> Search
          </button>
          <div className="flex-1" />
          {saved && <span className="text-[10px] font-bold text-emerald-700">✓ Saved</span>}
          <span className="text-[10px] text-slate-600 font-mono">{lines.length} lines</span>
        </div>

        {/* ===== Data Grid ===== */}
        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          <div className="flex-shrink-0 grid grid-cols-[30px_110px_1fr_60px_65px_60px_80px_85px] gap-0 px-2 py-1 text-[9px] font-bold text-slate-800 border-b" style={{ backgroundColor: '#E0E0E0', borderColor: GRID_LINE }}>
            <div className="text-center">#</div>
            <div>Part Number</div>
            <div>Details</div>
            <div className="text-right" style={{ backgroundColor: ON_HAND_BG }}>On Hand</div>
            <div className="text-right">New Qty</div>
            <div className="text-right">Qty</div>
            <div className="text-right">Cost GHC</div>
            <div className="text-right">Total GHC</div>
          </div>
          <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
            {lines.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                <Package className="h-8 w-8 mb-2 opacity-40" />
                <div className="text-[11px] font-medium">No items added yet</div>
                <div className="text-[9px] mt-0.5">Type a Part No. above or click "Load Range" to begin</div>
              </div>
            ) : (
              lines.map((l, idx) => {
                const isSelected = selectedLine === idx;
                const hasVariance = l.qty !== 0;
                return (
                  <div key={l.id} onClick={() => setSelectedLine(idx)}
                    className="grid grid-cols-[30px_110px_1fr_60px_65px_60px_80px_85px] gap-0 px-2 py-0.5 text-[10px] cursor-pointer border-b"
                    style={{ backgroundColor: isSelected ? '#D6E6F5' : (idx % 2 === 1 ? '#F8F8F8' : '#FFFFFF'), borderColor: '#E0E0E0' }}>
                    <div className="text-center text-slate-500">{idx + 1}</div>
                    <div className="font-mono truncate text-slate-700">{l.partNo}</div>
                    <div className="truncate text-slate-800">{l.details}</div>
                    <div className="text-right font-mono text-slate-700" style={{ backgroundColor: ON_HAND_BG }}>{l.onHand}</div>
                    <div className="text-right" onClick={(e) => e.stopPropagation()}>
                      <input type="number" value={l.newQty} onChange={(e) => updateLineQty(idx, parseInt(e.target.value) || 0)} className="w-full text-right font-mono bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-400 outline-none" />
                    </div>
                    <div className={cn("text-right font-mono font-semibold", hasVariance ? (l.qty > 0 ? "text-emerald-700" : "text-rose-700") : "text-slate-500")}>{l.qty > 0 ? '+' : ''}{l.qty}</div>
                    <div className="text-right" onClick={(e) => e.stopPropagation()}>
                      <input type="number" step="0.0001" value={l.cost} onChange={(e) => updateLineCost(idx, parseFloat(e.target.value) || 0)} className="w-full text-right font-mono bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-400 outline-none" />
                    </div>
                    <div className="text-right font-mono font-semibold text-slate-800">{l.total.toFixed(3)}</div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ===== Bottom summary bar ===== */}
        <div className="flex-shrink-0 px-3 py-1.5 flex items-center gap-4 border-t border-slate-300 bg-slate-50">
          <div className="flex items-center gap-1"><label className="text-[10px] font-bold text-slate-700">Bin:</label><input value={bin} readOnly className="h-5 w-20 px-1 text-[10px] font-mono border border-slate-300 rounded bg-white outline-none" /></div>
          <div className="flex items-center gap-1"><label className="text-[10px] font-bold text-slate-700">Qty On Hand:</label><input value={totals.totalQty} readOnly className="h-5 w-16 px-1 text-[10px] font-mono border border-slate-300 rounded bg-white outline-none text-right" /></div>
          <div className="flex items-center gap-1"><label className="text-[10px] font-bold text-slate-700">Variance:</label><input value={totals.totalVariance > 0 ? `+${totals.totalVariance}` : `${totals.totalVariance}`} readOnly className={cn("h-5 w-16 px-1 text-[10px] font-mono font-bold border border-slate-300 rounded bg-white outline-none text-right", totals.totalVariance > 0 ? "text-emerald-700" : totals.totalVariance < 0 ? "text-rose-700" : "text-slate-500")} /></div>
          <div className="flex-1" />
          <div className="flex items-center gap-1"><label className="text-[10px] font-bold text-slate-700">Total GHC:</label><input value={totals.totalCost.toFixed(2)} readOnly className="h-5 w-24 px-1 text-[10px] font-mono font-bold border border-slate-400 rounded outline-none text-right" style={{ backgroundColor: '#E6F0FF' }} /></div>
        </div>

        {/* ===== Action buttons ===== */}
        <div className="flex-shrink-0 px-3 py-2 flex items-center gap-1.5 border-t" style={{ borderColor: FIELD_BORDER, backgroundColor: '#F0F4F8' }}>
          <button onClick={handleSave} className="h-7 px-3 rounded text-white text-[10px] font-semibold flex items-center gap-1 transition shadow-sm" style={{ backgroundColor: BTN_BLUE }}><Save className="h-3 w-3" /> Save <kbd className="text-[7px] bg-white/20 px-0.5 rounded">F2</kbd></button>
          <button onClick={handlePrint} className="h-7 px-3 rounded text-white text-[10px] font-semibold flex items-center gap-1 transition shadow-sm" style={{ backgroundColor: BTN_BLUE }}><Printer className="h-3 w-3" /> Print <kbd className="text-[7px] bg-white/20 px-0.5 rounded">F3</kbd></button>
          <button onClick={handleDelete} className="h-7 px-3 rounded text-white text-[10px] font-semibold flex items-center gap-1 transition shadow-sm" style={{ backgroundColor: BTN_BLUE }}><Trash2 className="h-3 w-3" /> Delete <kbd className="text-[7px] bg-white/20 px-0.5 rounded">F4</kbd></button>
          <button onClick={handleImport} className="h-7 px-3 rounded text-white text-[10px] font-semibold flex items-center gap-1 transition shadow-sm" style={{ backgroundColor: BTN_BLUE }}><Upload className="h-3 w-3" style={{ color: '#4CAF50' }} /> Import</button>
          <button onClick={() => { setScanMode(!scanMode); if (!scanMode) { setScanStats({ scanned: 0, added: 0, notFound: 0 }); toast({ title: 'Scan mode ON', description: 'Each scan adds 1 unit to New Qty' }); } }} className={cn("h-7 px-3 rounded text-white text-[10px] font-semibold flex items-center gap-1 transition shadow-sm", scanMode && "animate-pulse")} style={{ backgroundColor: scanMode ? '#F44336' : BTN_BLUE }}><ScanLine className="h-3 w-3" style={{ color: scanMode ? '#FFC107' : '#4CAF50' }} /> {scanMode ? 'Scanning…' : 'Scan'}</button>
          <button onClick={handleExport} className="h-7 px-3 rounded text-white text-[10px] font-semibold flex items-center gap-1 transition shadow-sm" style={{ backgroundColor: BTN_BLUE }}><Download className="h-3 w-3" style={{ color: '#4CAF50' }} /> Export</button>
          <div className="flex-1" />
          {selectedLine !== null && lines[selectedLine] && (
            <button onClick={() => removeLine(selectedLine)} className="h-7 px-2 rounded bg-rose-100 hover:bg-rose-200 text-rose-700 text-[10px] font-semibold flex items-center gap-1 transition"><Trash2 className="h-3 w-3" /> Remove Line</button>
          )}
          <button onClick={onClose} className="h-7 px-3 rounded text-white text-[10px] font-semibold flex items-center gap-1 transition shadow-sm" style={{ backgroundColor: BTN_RED }}><X className="h-3 w-3" /> Close <kbd className="text-[7px] bg-white/20 px-0.5 rounded">Esc</kbd></button>
        </div>

        {/* ===== Status bar ===== */}
        <div className="flex-shrink-0 px-3 py-0.5 text-[8px] text-slate-600 flex items-center gap-3" style={{ backgroundColor: '#E0E0E0' }}>
          <span className="font-mono">Stock Adjustment · {refNumber}</span>
          <span className="font-mono">· {lines.length} lines</span>
          {totals.totalVariance !== 0 && <span className={cn("font-mono font-bold flex items-center gap-0.5", totals.totalVariance > 0 ? "text-emerald-700" : "text-rose-700")}><AlertTriangle className="h-2.5 w-2.5" /> Variance: {totals.totalVariance > 0 ? '+' : ''}{totals.totalVariance}</span>}
          <div className="flex-1" />
          <span>{COMPANY.name} · {COMPANY.address}</span>
        </div>

        {/* ===== Scanner overlay ===== */}
        <AnimatePresence>
          {scanMode && (
            <motion.div initial={{ opacity: 0, y: 50, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 50, scale: 0.9 }}
              className="fixed bottom-4 right-4 z-[80] bg-white rounded-xl shadow-2xl ring-2 ring-rose-400 overflow-hidden" style={{ width: '300px' }}>
              <div className="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-rose-600 to-rose-500 text-white">
                <div className="flex items-center gap-2"><ScanLine className="h-4 w-4 animate-pulse" /><span className="text-xs font-bold">Scanner Active</span></div>
                <button onClick={() => setScanMode(false)} className="h-5 w-5 rounded bg-white/20 hover:bg-white/30 flex items-center justify-center"><X className="h-3 w-3 text-white" /></button>
              </div>
              <div className="px-3 py-2 bg-slate-50 border-b border-slate-200">
                <div className="text-[9px] font-bold text-slate-500 uppercase mb-0.5">Current buffer</div>
                <div className="h-7 px-2 flex items-center bg-white border border-slate-300 rounded font-mono text-sm text-slate-800">{scanBuffer || <span className="text-slate-300">Waiting…</span>}<span className="ml-0.5 inline-block w-0.5 h-4 bg-rose-500 animate-pulse" /></div>
              </div>
              <div className="px-3 py-2 grid grid-cols-3 gap-2 bg-slate-50">
                <div className="text-center"><div className="text-base font-bold text-slate-800 font-mono">{scanStats.scanned}</div><div className="text-[8px] text-slate-500 uppercase">Scanned</div></div>
                <div className="text-center"><div className="text-base font-bold text-emerald-600 font-mono">{scanStats.added}</div><div className="text-[8px] text-slate-500 uppercase">Added</div></div>
                <div className="text-center"><div className="text-base font-bold text-rose-600 font-mono">{scanStats.notFound}</div><div className="text-[8px] text-slate-500 uppercase">Not Found</div></div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ===== Stock Search popup ===== */}
        <AnimatePresence>
          {showStockSearch && (
            <StockSearchPopup products={products} groups={groups} searchText={findPartNo} onSelect={(p) => { addProductToLines(p); setShowStockSearch(false); }} onClose={() => setShowStockSearch(false)} />
          )}
        </AnimatePresence>
      </div>
    </PopupWindow>
  );
}

// ===== Stock Search Popup =====
function StockSearchPopup({ products, groups, searchText, onSelect, onClose }: {
  products: Product[]; groups: StockGroup[]; searchText: string; onSelect: (p: Product) => void; onClose: () => void;
}) {
  const [query, setQuery] = useState(searchText);
  const [filterGroup, setFilterGroup] = useState('all');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { const t = setTimeout(() => inputRef.current?.focus(), 50); return () => clearTimeout(t); }, []);
  const filtered = useMemo(() => products.filter(p => {
    if (query.trim()) { const q = query.toLowerCase(); if (!p.name.toLowerCase().includes(q) && !p.sku.toLowerCase().includes(q) && !p.barcode.includes(q)) return false; }
    if (filterGroup !== 'all' && p.groupId !== filterGroup) return false;
    return true;
  }), [products, query, filterGroup]);
  useEffect(() => { if (selectedIndex >= filtered.length) setSelectedIndex(Math.max(0, filtered.length - 1)); }, [filtered.length, selectedIndex]);
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 flex items-start justify-center pt-16 z-[60]" onClick={onClose}>
      <motion.div initial={{ scale: 0.95, y: -20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: -20 }} onClick={(e) => e.stopPropagation()}
        className="rounded-lg shadow-2xl overflow-hidden flex flex-col" style={{ width: '680px', maxHeight: '480px', fontFamily: 'Arial, Helvetica, sans-serif' }}>
        <div className="flex-shrink-0 flex items-center justify-between px-3 h-7 text-white" style={{ backgroundColor: HEADER_DARK_BLUE }}>
          <span className="text-xs font-bold">Select Product to Adjust</span>
          <button onClick={onClose} className="h-5 w-5 rounded bg-red-600 hover:bg-red-700 flex items-center justify-center"><X className="h-3 w-3 text-white" /></button>
        </div>
        <div className="flex-shrink-0 px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
          <input ref={inputRef} value={query} onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0); }}
            onKeyDown={(e) => { if (e.key === 'Enter' && filtered[selectedIndex]) onSelect(filtered[selectedIndex]); if (e.key === 'Escape') onClose(); if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex(i => Math.min(filtered.length - 1, i + 1)); } if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex(i => Math.max(0, i - 1)); } }}
            placeholder="Search by name, SKU, or barcode…" className="flex-1 h-7 px-2 text-xs border border-slate-400 rounded bg-white outline-none focus:ring-1 focus:ring-blue-400" />
          <select value={filterGroup} onChange={(e) => { setFilterGroup(e.target.value); setSelectedIndex(0); }} className="h-7 px-1 text-[10px] border border-slate-400 rounded bg-white outline-none">
            <option value="all">All Groups</option>
            {groups.map(g => <option key={g.id} value={g.id}>{g.icon} {g.name}</option>)}
          </select>
        </div>
        <div className="flex-shrink-0 grid grid-cols-[120px_1fr_50px_80px_80px] gap-0 px-2 py-1 text-[9px] font-bold text-white" style={{ backgroundColor: HEADER_DARK_BLUE }}>
          <div>Part No.</div><div>Details</div><div className="text-right">Qty</div><div className="text-right">Retail</div><div className="text-right">Cost</div>
        </div>
        <div className="flex-1 overflow-y-auto bg-white min-h-0" style={{ scrollbarWidth: 'thin' }}>
          {filtered.length === 0 ? <div className="text-center py-6 text-slate-400 text-[11px]">No products found</div> : (
            filtered.map((p, idx) => (
              <div key={p.id} onClick={() => setSelectedIndex(idx)} onDoubleClick={() => onSelect(p)}
                className="grid grid-cols-[120px_1fr_50px_80px_80px] gap-0 px-2 py-1 text-[10px] cursor-pointer border-b border-slate-100"
                style={{ backgroundColor: idx === selectedIndex ? '#D6E6F5' : (idx % 2 === 1 ? '#F8FAFC' : '#FFFFFF') }}>
                <div className="font-mono truncate text-slate-700">{p.sku}</div>
                <div className="truncate text-slate-800">{p.emoji} {p.name}</div>
                <div className={cn("text-right font-mono font-bold", p.stock <= p.reorderLevel ? "text-rose-600" : "text-slate-700")}>{p.stock}</div>
                <div className="text-right font-mono text-slate-600">{p.price.toFixed(2)}</div>
                <div className="text-right font-mono text-slate-600">{p.costPrice.toFixed(2)}</div>
              </div>
            ))
          )}
        </div>
        <div className="flex-shrink-0 px-3 py-1.5 flex items-center gap-2 border-t border-slate-200" style={{ backgroundColor: '#F0F4F8' }}>
          <button onClick={() => filtered[selectedIndex] && onSelect(filtered[selectedIndex])} disabled={!filtered[selectedIndex]} className="h-7 px-3 rounded text-white text-[10px] font-bold flex items-center gap-1 disabled:opacity-50" style={{ backgroundColor: BTN_BLUE }}>Select (Enter)</button>
          <span className="text-[10px] text-slate-500 font-mono">{filtered.length} products</span>
          <div className="flex-1" />
          <button onClick={onClose} className="h-7 px-3 rounded text-white text-[10px] font-bold flex items-center gap-1" style={{ backgroundColor: BTN_RED }}><X className="h-3 w-3" /> Close (Esc)</button>
        </div>
      </motion.div>
    </motion.div>
  );
}
