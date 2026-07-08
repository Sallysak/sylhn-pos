"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Save, Printer, Trash2, Upload, Download, X, Search as SearchIcon,
  Package, AlertTriangle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  COMPANY, formatGHS, type Product, type StockGroup, type StockHistoryEntry,
} from "@/lib/pos-data";
import { PopupWindow } from "@/components/popup-window";

// ===== Light blue palette (matches reference image) =====
const HEADER_DARK_BLUE = '#1E5A8E';     // dark blue title bar
const BTN_BG = '#D6E6F5';               // light blue button background
const BTN_HOVER = '#B9D7EE';            // button hover
const ON_HAND_BG = '#FFF8DC';           // light yellow for On Hand column
const FIELD_BORDER = '#808080';
const GRID_LINE = '#999999';

export type AdjustmentType = 'stocktake' | 'adjustment';

export interface AdjustmentLine {
  id: string;
  partNo: string;        // SKU / barcode
  details: string;       // product name
  onHand: number;        // current stock
  counted: number;       // user-entered physical count
  qty: number;           // counted - onHand (variance, computed)
  cost: number;          // cost per unit
  total: number;         // qty * cost (computed)
  productId: string;     // for syncing back
  emoji: string;
}

interface StockQuantityAdjustmentProps {
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  setHistory: React.Dispatch<React.SetStateAction<StockHistoryEntry[]>>;
  groups: StockGroup[];
  onClose: () => void;
  /** When provided, opens as overlay inside another popup. When true (default), opens as its own PopupWindow. */
  asWindow?: boolean;
  /** Initial adjustment type for the dropdown */
  initialAdjustmentType?: AdjustmentType;
  /** Optional pre-selected product to add to the table (when launched from another view) */
  initialProductId?: string;
}

export function StockQuantityAdjustment({
  products,
  setProducts,
  setHistory,
  groups,
  onClose,
  asWindow = true,
  initialAdjustmentType = 'stocktake',
  initialProductId,
}: StockQuantityAdjustmentProps) {
  const { toast } = useToast();

  // ===== Form state =====
  const [adjNumber, setAdjNumber] = useState(`ADJ-${Date.now().toString().slice(-6)}`);
  const [adjType, setAdjType] = useState<AdjustmentType>(initialAdjustmentType);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [details, setDetails] = useState('');
  const [postToAC, setPostToAC] = useState('Inventory Adjustment');
  const [fromPartNo, setFromPartNo] = useState('');
  const [toPartNo, setToPartNo] = useState('');
  const [groupFilter, setGroupFilter] = useState('all');
  const [bin, setBin] = useState('');
  const [lines, setLines] = useState<AdjustmentLine[]>([]);
  const [selectedLine, setSelectedLine] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);

  // ===== Stock Search popup state =====
  const [showStockSearch, setShowStockSearch] = useState(false);
  const [findPartNo, setFindPartNo] = useState('');
  const findPartNoRef = useRef<HTMLInputElement>(null);

  // Auto-add initial product if provided
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

  // ===== Add product to adjustment table =====
  const addProductToLines = (product: Product) => {
    // Avoid duplicates
    if (lines.some(l => l.productId === product.id)) {
      toast({ title: 'Already in table', description: `${product.emoji} ${product.name}` });
      return;
    }
    const newLine: AdjustmentLine = {
      id: `line-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      partNo: product.sku,
      details: `${product.emoji} ${product.name}`,
      onHand: product.stock,
      counted: product.stock,    // default to current stock
      qty: 0,                     // variance = 0 initially
      cost: product.costPrice,
      total: 0,
      productId: product.id,
      emoji: product.emoji,
    };
    setLines(prev => [...prev, newLine]);
    setSelectedLine(lines.length); // select the newly added line
    setFindPartNo('');
    setSaved(false);
    toast({ title: 'Product added', description: `${product.emoji} ${product.name}` });
  };

  // ===== Update a line's counted value (recomputes qty and total) =====
  const updateLineCounted = (idx: number, counted: number) => {
    setLines(prev => prev.map((l, i) => {
      if (i !== idx) return l;
      const qty = counted - l.onHand; // positive = surplus, negative = shortage
      return { ...l, counted, qty, total: qty * l.cost };
    }));
    setSaved(false);
  };

  // ===== Update a line's cost (recomputes total) =====
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

  // ===== Find Part No handler — opens stock search =====
  const handleFindPartNo = (value: string) => {
    setFindPartNo(value);
    if (value.length > 0) {
      // Try direct match by SKU/barcode first
      const direct = products.find(p =>
        p.sku.toLowerCase() === value.toLowerCase() ||
        p.barcode === value
      );
      if (direct) {
        addProductToLines(direct);
        return;
      }
      // Otherwise open the search popup
      setShowStockSearch(true);
    } else {
      setShowStockSearch(false);
    }
  };

  // ===== Load all products in a range (From Part No → To Part No) =====
  const handleLoadRange = () => {
    if (!fromPartNo && !toPartNo && groupFilter === 'all') {
      toast({ title: 'Set a range or group filter first', variant: 'destructive' });
      return;
    }
    const matched = products.filter(p => {
      // Group filter
      if (groupFilter !== 'all' && p.groupId !== groupFilter) return false;
      // From Part No. range (alphabetical by SKU)
      if (fromPartNo && p.sku.toLowerCase() < fromPartNo.toLowerCase()) return false;
      if (toPartNo && p.sku.toLowerCase() > toPartNo.toLowerCase()) return false;
      // Bin filter
      if (bin && !p.batchNumber.toLowerCase().includes(bin.toLowerCase())) return false;
      return true;
    });
    if (matched.length === 0) {
      toast({ title: 'No products match the range', variant: 'destructive' });
      return;
    }
    // Add all matched products (skipping duplicates)
    const newLines: AdjustmentLine[] = [];
    matched.forEach(p => {
      if (lines.some(l => l.productId === p.id)) return;
      newLines.push({
        id: `line-${Date.now()}-${Math.random().toString(36).slice(2, 6)}-${p.id}`,
        partNo: p.sku,
        details: `${p.emoji} ${p.name}`,
        onHand: p.stock,
        counted: p.stock,
        qty: 0,
        cost: p.costPrice,
        total: 0,
        productId: p.id,
        emoji: p.emoji,
      });
    });
    if (newLines.length === 0) {
      toast({ title: 'All matching products already in table' });
      return;
    }
    setLines(prev => [...prev, ...newLines]);
    setSaved(false);
    toast({ title: `${newLines.length} products loaded`, description: `Total lines: ${lines.length + newLines.length}` });
  };

  // ===== Save: commit adjustments to product stock + log history =====
  const handleSave = () => {
    // Only lines with non-zero variance (qty != 0) are real adjustments
    const changedLines = lines.filter(l => l.qty !== 0);
    if (changedLines.length === 0) {
      toast({ title: 'No adjustments to save', description: 'All counted quantities match on-hand stock', variant: 'destructive' });
      return;
    }
    // Update product stock
    setProducts(prev => prev.map(p => {
      const line = changedLines.find(l => l.productId === p.id);
      if (!line) return p;
      return { ...p, stock: line.counted };
    }));
    // Log each adjustment to history
    const newHistory: StockHistoryEntry[] = changedLines.map(l => ({
      id: `h-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      productId: l.productId,
      productName: l.details,
      sku: l.partNo,
      action: 'adjusted',
      quantityChange: l.qty,
      newQuantity: l.counted,
      timestamp: new Date().toISOString(),
      user: 'Sarah Johnson',
      reason: details || `${adjType === 'stocktake' ? 'Stocktake' : 'Stock adjustment'} — variance ${l.qty > 0 ? '+' : ''}${l.qty}`,
      reference: adjNumber,
    }));
    setHistory(prev => [...prev, ...newHistory]);
    setSaved(true);
    toast({
      title: `Saved (F2) — ${adjType === 'stocktake' ? 'Stocktake' : 'Stock Adjustment'}`,
      description: `${changedLines.length} items adjusted · Variance total: ${totals.totalVariance > 0 ? '+' : ''}${totals.totalVariance} · ${formatGHS(Math.abs(totals.totalCost))}`,
    });
  };

  // ===== Print adjustment report =====
  const handlePrint = () => {
    if (lines.length === 0) { toast({ title: 'Nothing to print', variant: 'destructive' }); return; }
    const printWin = window.open('', '_blank', 'width=900,height=600');
    if (!printWin) { toast({ title: 'Popup blocked', variant: 'destructive' }); return; }
    const rows = lines.map((l, i) => `
      <tr style="background:${i % 2 === 1 ? '#F8F8F8' : '#FFFFFF'}">
        <td style="border:1px solid #999;padding:4px 6px;font-family:monospace">${l.partNo}</td>
        <td style="border:1px solid #999;padding:4px 6px">${l.details}</td>
        <td style="border:1px solid #999;padding:4px 6px;text-align:right;background:#FFF8DC">${l.onHand}</td>
        <td style="border:1px solid #999;padding:4px 6px;text-align:right">${l.counted}</td>
        <td style="border:1px solid #999;padding:4px 6px;text-align:right;color:${l.qty > 0 ? '#16A34A' : (l.qty < 0 ? '#DC2626' : '#666')}">${l.qty > 0 ? '+' : ''}${l.qty}</td>
        <td style="border:1px solid #999;padding:4px 6px;text-align:right">${l.cost.toFixed(4)}</td>
        <td style="border:1px solid #999;padding:4px 6px;text-align:right;font-weight:bold">${l.total.toFixed(3)}</td>
      </tr>`).join('');
    printWin.document.write(`<!DOCTYPE html><html><head><title>${adjType === 'stocktake' ? 'Stocktake' : 'Stock Adjustment'} — ${adjNumber}</title>
      <style>
        body { font-family: Arial, Helvetica, sans-serif; margin: 20px; }
        .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 15px; }
        .header h1 { margin: 0; font-size: 18px; }
        .header div { font-size: 12px; color: #666; }
        .info { display: flex; justify-content: space-between; margin-bottom: 15px; font-size: 11px; }
        table { width: 100%; border-collapse: collapse; font-size: 11px; }
        th { background: #1E5A8E; color: white; border: 1px solid #999; padding: 5px 6px; font-weight: bold; }
        .totals { margin-top: 15px; margin-left: auto; width: 320px; font-size: 11px; }
        .totals td { padding: 4px 8px; }
        .totals .total-row { font-weight: bold; border-top: 2px solid #333; }
        @media print { body { margin: 10px; } }
      </style></head><body>
      <div class="header">
        <h1>${COMPANY.name}</h1>
        <div>${COMPANY.address} · ${COMPANY.contact}</div>
      </div>
      <h2 style="text-align:center;font-size:14px;margin:10px 0">${adjType === 'stocktake' ? 'Stocktake Report' : 'Stock Adjustment Report'}</h2>
      <div class="info">
        <div><strong>Number:</strong> ${adjNumber}</div>
        <div><strong>Date:</strong> ${date}</div>
        <div><strong>Type:</strong> ${adjType === 'stocktake' ? 'Stocktake' : 'Stock Adjustment'}</div>
        <div><strong>Details:</strong> ${details || '—'}</div>
        <div><strong>Post To A/C:</strong> ${postToAC || '—'}</div>
      </div>
      <table>
        <thead><tr>
          <th style="text-align:left">Part Number</th>
          <th style="text-align:left">Details</th>
          <th style="text-align:right">On Hand</th>
          <th style="text-align:right">Counted</th>
          <th style="text-align:right">Qty</th>
          <th style="text-align:right">Cost GHC</th>
          <th style="text-align:right">Total GHC</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <table class="totals">
        <tr><td>Total Qty On Hand:</td><td style="text-align:right">${totals.totalQty}</td></tr>
        <tr><td>Total Variance:</td><td style="text-align:right;color:${totals.totalVariance > 0 ? '#16A34A' : (totals.totalVariance < 0 ? '#DC2626' : '#666')}">${totals.totalVariance > 0 ? '+' : ''}${totals.totalVariance}</td></tr>
        <tr class="total-row"><td>Total GHC:</td><td style="text-align:right">${formatGHS(totals.totalCost)}</td></tr>
      </table>
      </body></html>`);
    printWin.document.close();
    setTimeout(() => { printWin.focus(); printWin.print(); }, 300);
    toast({ title: 'Printing (F3)', description: `${lines.length} lines` });
  };

  // ===== Delete (clear all lines) =====
  const handleDelete = () => {
    if (lines.length === 0) { toast({ title: 'Nothing to delete' }); return; }
    setLines([]);
    setSelectedLine(null);
    setSaved(false);
    toast({ title: 'Deleted (F4)', description: 'All lines cleared' });
  };

  // ===== Export to Excel =====
  const handleExport = () => {
    if (lines.length === 0) { toast({ title: 'Nothing to export', variant: 'destructive' }); return; }
    import('xlsx').then((XLSX) => {
      type ExportRow = Record<string, string | number>;
      const data: ExportRow[] = lines.map((l, i) => ({
        '#': i + 1,
        'Part Number': l.partNo,
        'Details': l.details,
        'On Hand': l.onHand,
        'Counted': l.counted,
        'Qty (Variance)': l.qty,
        'Cost GHC': l.cost,
        'Total GHC': l.total,
      }));
      // Append totals row
      data.push({
        '#': '',
        'Part Number': '',
        'Details': 'TOTAL',
        'On Hand': totals.totalQty,
        'Counted': '',
        'Qty (Variance)': totals.totalVariance,
        'Cost GHC': '',
        'Total GHC': totals.totalCost,
      });
      const ws = XLSX.utils.json_to_sheet(data);
      ws['!cols'] = [{ wch: 5 }, { wch: 16 }, { wch: 30 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 12 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, adjType === 'stocktake' ? 'Stocktake' : 'Adjustment');
      XLSX.writeFile(wb, `${adjType === 'stocktake' ? 'stocktake' : 'stock-adjustment'}-${adjNumber}-${new Date().toISOString().split('T')[0]}.xlsx`);
      toast({ title: 'Exported successfully', description: `${lines.length} rows to Excel` });
    });
  };

  // ===== Import from Excel (basic CSV/XLSX picker) =====
  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx,.xls,.csv';
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
              const partNo = String(r['Part Number'] || r['PartNo'] || r['SKU'] || '').trim();
              const counted = Number(r['Counted'] || r['Qty'] || 0);
              if (!partNo) return;
              const product = products.find(p => p.sku.toLowerCase() === partNo.toLowerCase() || p.barcode === partNo);
              if (!product) return;
              if (lines.some(l => l.productId === product.id)) return;
              const qty = counted - product.stock;
              setLines(prev => [...prev, {
                id: `line-${Date.now()}-${Math.random().toString(36).slice(2, 6)}-${product.id}`,
                partNo: product.sku,
                details: `${product.emoji} ${product.name}`,
                onHand: product.stock,
                counted,
                qty,
                cost: product.costPrice,
                total: qty * product.costPrice,
                productId: product.id,
                emoji: product.emoji,
              }]);
              added++;
            });
            toast({ title: `Imported ${added} rows`, description: file.name });
          } catch (err) {
            toast({ title: 'Import failed', description: 'Invalid file format', variant: 'destructive' });
          }
        };
        reader.readAsBinaryString(file);
      });
    };
    input.click();
  };

  // ===== Keyboard shortcuts (F2/F3/F4/Esc) =====
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
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
  }, [lines, adjType, details, postToAC, date, adjNumber, showStockSearch]);

  // ===== Form body =====
  const body = (
    <div className="h-full flex flex-col bg-white" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
      {/* ===== Top: Header fields ===== */}
      <div className="flex-shrink-0 px-3 py-2 grid grid-cols-[1fr_1fr] gap-x-4 gap-y-1.5 bg-white border-b border-slate-300">
        {/* Left column */}
        <div className="flex items-center gap-2">
          <label className="text-[10px] font-bold text-slate-800 w-14">Number:</label>
          <input value={adjNumber} onChange={(e) => setAdjNumber(e.target.value)} className="h-6 w-32 px-2 text-[10px] border rounded bg-white outline-none focus:ring-1 focus:ring-blue-400 font-mono" style={{ borderColor: FIELD_BORDER }} />
          <select
            value={adjType}
            onChange={(e) => setAdjType(e.target.value as AdjustmentType)}
            className="h-6 px-2 text-[10px] font-bold border rounded bg-white outline-none focus:ring-1 focus:ring-blue-400"
            style={{ borderColor: FIELD_BORDER, color: HEADER_DARK_BLUE }}
          >
            <option value="stocktake">Stocktake</option>
            <option value="adjustment">Stock Adjustment</option>
          </select>
        </div>
        {/* Right column — From/To Part No range */}
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
          <select
            value={groupFilter}
            onChange={(e) => setGroupFilter(e.target.value)}
            className="h-6 px-2 text-[10px] border rounded bg-white outline-none focus:ring-1 focus:ring-blue-400"
            style={{ borderColor: FIELD_BORDER }}
          >
            <option value="all">All Groups</option>
            {groups.map(g => <option key={g.id} value={g.id}>{g.icon} {g.name}</option>)}
          </select>
          <label className="text-[10px] font-bold text-slate-800">Bin:</label>
          <input value={bin} onChange={(e) => setBin(e.target.value)} placeholder="Batch" className="h-6 w-20 px-2 text-[10px] font-mono border rounded bg-white outline-none focus:ring-1 focus:ring-blue-400" style={{ borderColor: FIELD_BORDER }} />
          <button
            onClick={handleLoadRange}
            className="h-6 px-2 rounded text-white text-[9px] font-bold transition"
            style={{ backgroundColor: HEADER_DARK_BLUE }}
            title="Load all products in the range/group/bin into the table"
          >
            Load Range
          </button>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-[10px] font-bold text-slate-800 w-14">Details:</label>
          <input value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Reason for adjustment..." className="h-6 flex-1 px-2 text-[10px] border rounded bg-white outline-none focus:ring-1 focus:ring-blue-400" style={{ borderColor: FIELD_BORDER }} />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-[10px] font-bold text-slate-800 w-20">Post To A/C:</label>
          <input value={postToAC} onChange={(e) => setPostToAC(e.target.value)} placeholder="e.g. Inventory Adjustment" className="h-6 flex-1 px-2 text-[10px] border rounded bg-white outline-none focus:ring-1 focus:ring-blue-400" style={{ borderColor: FIELD_BORDER }} />
        </div>
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
                const direct = products.find(p =>
                  p.sku.toLowerCase() === findPartNo.toLowerCase() ||
                  p.barcode === findPartNo
                );
                if (direct) addProductToLines(direct);
                else setShowStockSearch(true);
              }
            }
            if (e.key === 'Escape') setShowStockSearch(false);
          }}
          onFocus={() => { if (findPartNo && !lines.some(l => l.partNo === findPartNo)) setShowStockSearch(true); }}
          placeholder="Type SKU or barcode, press Enter to add..."
          className="h-6 w-56 px-2 text-[10px] font-mono border rounded outline-none focus:ring-1 focus:ring-blue-400"
          style={{ borderColor: FIELD_BORDER, backgroundColor: '#FFFFCC' }}
        />
        <button
          onClick={() => setShowStockSearch(true)}
          className="h-6 px-2 rounded text-white text-[9px] font-bold flex items-center gap-1 transition"
          style={{ backgroundColor: HEADER_DARK_BLUE }}
          title="Open Stock Search (F7)"
        >
          <SearchIcon className="h-3 w-3" /> Search
        </button>
        <div className="flex-1" />
        {saved && <span className="text-[10px] font-bold text-emerald-700">✓ Saved</span>}
        <span className="text-[10px] text-slate-600 font-mono">{lines.length} lines</span>
      </div>

      {/* ===== Data Grid ===== */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        {/* Table header */}
        <div className="flex-shrink-0 grid grid-cols-[40px_120px_1fr_70px_70px_70px_90px_90px] gap-0 px-2 py-1 text-[9px] font-bold text-slate-800 border-b" style={{ backgroundColor: '#E0E0E0', borderColor: GRID_LINE }}>
          <div className="text-center">#</div>
          <div>Part Number</div>
          <div>Details</div>
          <div className="text-right" style={{ backgroundColor: ON_HAND_BG }}>On Hand</div>
          <div className="text-right">Counted</div>
          <div className="text-right">Qty</div>
          <div className="text-right">Cost GHC</div>
          <div className="text-right">Total GHC</div>
        </div>
        {/* Table body */}
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
                <div
                  key={l.id}
                  onClick={() => setSelectedLine(idx)}
                  className="grid grid-cols-[40px_120px_1fr_70px_70px_70px_90px_90px] gap-0 px-2 py-0.5 text-[10px] cursor-pointer border-b"
                  style={{
                    backgroundColor: isSelected ? '#D6E6F5' : (idx % 2 === 1 ? '#F8F8F8' : '#FFFFFF'),
                    borderColor: '#E0E0E0',
                  }}
                >
                  <div className="text-center text-slate-500">{idx + 1}</div>
                  <div className="font-mono truncate text-slate-700">{l.partNo}</div>
                  <div className="truncate text-slate-800">{l.details}</div>
                  <div className="text-right font-mono text-slate-700" style={{ backgroundColor: ON_HAND_BG }}>{l.onHand}</div>
                  <div className="text-right" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="number"
                      value={l.counted}
                      onChange={(e) => updateLineCounted(idx, parseInt(e.target.value) || 0)}
                      className="w-full text-right font-mono bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-400 outline-none"
                    />
                  </div>
                  <div className={cn("text-right font-mono font-semibold", hasVariance ? (l.qty > 0 ? "text-emerald-700" : "text-rose-700") : "text-slate-500")}>
                    {l.qty > 0 ? '+' : ''}{l.qty}
                  </div>
                  <div className="text-right" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="number"
                      step="0.0001"
                      value={l.cost}
                      onChange={(e) => updateLineCost(idx, parseFloat(e.target.value) || 0)}
                      className="w-full text-right font-mono bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-400 outline-none"
                    />
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
        <div className="flex items-center gap-1">
          <label className="text-[10px] font-bold text-slate-700">Bin:</label>
          <input value={bin} readOnly className="h-5 w-20 px-1 text-[10px] font-mono border border-slate-300 rounded bg-white outline-none" />
        </div>
        <div className="flex items-center gap-1">
          <label className="text-[10px] font-bold text-slate-700">Qty On Hand:</label>
          <input value={totals.totalQty} readOnly className="h-5 w-16 px-1 text-[10px] font-mono border border-slate-300 rounded bg-white outline-none text-right" />
        </div>
        <div className="flex items-center gap-1">
          <label className="text-[10px] font-bold text-slate-700">Variance:</label>
          <input
            value={totals.totalVariance > 0 ? `+${totals.totalVariance}` : `${totals.totalVariance}`}
            readOnly
            className={cn("h-5 w-16 px-1 text-[10px] font-mono font-bold border border-slate-300 rounded bg-white outline-none text-right", totals.totalVariance > 0 ? "text-emerald-700" : totals.totalVariance < 0 ? "text-rose-700" : "text-slate-500")}
          />
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-1">
          <label className="text-[10px] font-bold text-slate-700">Total GHC:</label>
          <input value={totals.totalCost.toFixed(2)} readOnly className="h-5 w-24 px-1 text-[10px] font-mono font-bold border border-slate-400 rounded outline-none text-right" style={{ backgroundColor: '#E6F0FF' }} />
        </div>
      </div>

      {/* ===== Action buttons ===== */}
      <div className="flex-shrink-0 px-3 py-2 flex items-center gap-1.5 border-t" style={{ borderColor: FIELD_BORDER, backgroundColor: '#F0F4F8' }}>
        <button onClick={handleSave} className="h-7 px-3 rounded text-white text-[10px] font-semibold flex items-center gap-1 transition shadow-sm" style={{ backgroundColor: HEADER_DARK_BLUE }}>
          <Save className="h-3 w-3" /> Save <kbd className="text-[7px] bg-white/20 px-0.5 rounded">F2</kbd>
        </button>
        <button onClick={handlePrint} className="h-7 px-3 rounded text-white text-[10px] font-semibold flex items-center gap-1 transition shadow-sm" style={{ backgroundColor: HEADER_DARK_BLUE }}>
          <Printer className="h-3 w-3" /> Print <kbd className="text-[7px] bg-white/20 px-0.5 rounded">F3</kbd>
        </button>
        <button onClick={handleDelete} className="h-7 px-3 rounded text-white text-[10px] font-semibold flex items-center gap-1 transition shadow-sm" style={{ backgroundColor: HEADER_DARK_BLUE }}>
          <Trash2 className="h-3 w-3" /> Delete <kbd className="text-[7px] bg-white/20 px-0.5 rounded">F4</kbd>
        </button>
        <button onClick={handleImport} className="h-7 px-3 rounded text-white text-[10px] font-semibold flex items-center gap-1 transition shadow-sm" style={{ backgroundColor: HEADER_DARK_BLUE }}>
          <Upload className="h-3 w-3" style={{ color: '#4CAF50' }} /> Import
        </button>
        <button onClick={handleExport} className="h-7 px-3 rounded text-white text-[10px] font-semibold flex items-center gap-1 transition shadow-sm" style={{ backgroundColor: HEADER_DARK_BLUE }}>
          <Download className="h-3 w-3" style={{ color: '#4CAF50' }} /> Export
        </button>
        <div className="flex-1" />
        {selectedLine !== null && lines[selectedLine] && (
          <button
            onClick={() => removeLine(selectedLine)}
            className="h-7 px-2 rounded bg-rose-100 hover:bg-rose-200 text-rose-700 text-[10px] font-semibold flex items-center gap-1 transition"
          >
            <Trash2 className="h-3 w-3" /> Remove Line
          </button>
        )}
        <button onClick={onClose} className="h-7 px-3 rounded text-white text-[10px] font-semibold flex items-center gap-1 transition shadow-sm" style={{ backgroundColor: '#F44336' }}>
          <X className="h-3 w-3" /> Close <kbd className="text-[7px] bg-white/20 px-0.5 rounded">Esc</kbd>
        </button>
      </div>

      {/* ===== Status bar ===== */}
      <div className="flex-shrink-0 px-3 py-0.5 text-[8px] text-slate-600 flex items-center gap-3" style={{ backgroundColor: '#E0E0E0' }}>
        <span className="font-mono">{adjType === 'stocktake' ? 'Stocktake' : 'Stock Adjustment'} · {adjNumber}</span>
        <span className="font-mono">· {lines.length} lines</span>
        {totals.totalVariance !== 0 && (
          <span className={cn("font-mono font-bold flex items-center gap-0.5", totals.totalVariance > 0 ? "text-emerald-700" : "text-rose-700")}>
            <AlertTriangle className="h-2.5 w-2.5" />
            Variance: {totals.totalVariance > 0 ? '+' : ''}{totals.totalVariance}
          </span>
        )}
        <div className="flex-1" />
        <span>{COMPANY.name} · {COMPANY.address}</span>
      </div>

      {/* ===== Stock Search Popup ===== */}
      <AnimatePresence>
        {showStockSearch && (
          <StockSearchMiniPopup
            products={products}
            groups={groups}
            searchText={findPartNo}
            onSelect={(p) => {
              addProductToLines(p);
              setShowStockSearch(false);
            }}
            onClose={() => setShowStockSearch(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );

  if (asWindow) {
    return (
      <PopupWindow
        title="Stock Quantity Adjustment"
        titleBarColor={HEADER_DARK_BLUE}
        initialWidth={920}
        initialHeight={620}
        minWidth={720}
        minHeight={500}
        onClose={onClose}
      >
        {body}
      </PopupWindow>
    );
  }

  return body;
}

// ===== Mini Stock Search Popup (light blue/green, matches reference) =====
function StockSearchMiniPopup({
  products, groups, searchText, onSelect, onClose,
}: {
  products: Product[];
  groups: StockGroup[];
  searchText: string;
  onSelect: (p: Product) => void;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [query, setQuery] = useState(searchText);
  const [filterType, setFilterType] = useState('all');
  const [filterGroup, setFilterGroup] = useState('all');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, []);

  const filtered = useMemo(() => {
    return products.filter(p => {
      if (query.trim()) {
        const q = query.toLowerCase();
        if (!p.name.toLowerCase().includes(q) && !p.sku.toLowerCase().includes(q) && !p.barcode.includes(q) && !p.supplier.toLowerCase().includes(q)) return false;
      }
      if (filterType !== 'all') {
        if (filterType === 'taxable' && !p.taxable) return false;
        if (filterType === 'non-taxable' && p.taxable) return false;
        if (filterType === 'low-stock' && p.stock > p.reorderLevel) return false;
        if (filterType === 'out-of-stock' && p.stock > 0) return false;
      }
      if (filterGroup !== 'all' && p.groupId !== filterGroup) return false;
      return true;
    });
  }, [products, query, filterType, filterGroup]);

  useEffect(() => {
    if (selectedIndex >= filtered.length) setSelectedIndex(Math.max(0, filtered.length - 1));
  }, [filtered.length, selectedIndex]);

  const handleSelect = () => {
    if (!filtered[selectedIndex]) {
      toast({ title: 'No product selected', variant: 'destructive' });
      return;
    }
    onSelect(filtered[selectedIndex]);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 flex items-start justify-center pt-16 z-[60]"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: -20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: -20 }}
        onClick={(e) => e.stopPropagation()}
        className="rounded-lg shadow-2xl overflow-hidden flex flex-col"
        style={{ width: '780px', maxHeight: '560px', fontFamily: 'Arial, Helvetica, sans-serif' }}
      >
        {/* Title bar — light blue with dark blue text (matches reference) */}
        <div className="flex-shrink-0 flex items-center justify-between px-3 h-7" style={{ backgroundColor: '#5B9BD5' }}>
          <span className="text-xs font-bold text-white">Stock Search</span>
          <button onClick={onClose} className="h-5 w-5 rounded bg-red-600 hover:bg-red-700 flex items-center justify-center transition"><X className="h-3 w-3 text-white" /></button>
        </div>

        {/* Filter section — light green background (matches reference) */}
        <div className="flex-shrink-0 px-3 py-2 space-y-1.5" style={{ backgroundColor: '#E8F5E9' }}>
          {/* Filter By row */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-bold text-slate-700 uppercase">Filter By:</span>
            <select value={filterType} onChange={(e) => { setFilterType(e.target.value); setSelectedIndex(0); }} className="h-6 px-1 text-[10px] border border-slate-400 rounded bg-white outline-none">
              <option value="all">All Types</option>
              <option value="taxable">Taxable (VAT)</option>
              <option value="non-taxable">Non-Taxable</option>
              <option value="low-stock">Low Stock</option>
              <option value="out-of-stock">Out of Stock</option>
            </select>
            <select value={filterGroup} onChange={(e) => { setFilterGroup(e.target.value); setSelectedIndex(0); }} className="h-6 px-1 text-[10px] border border-slate-400 rounded bg-white outline-none">
              <option value="all">All Stock Groups</option>
              {groups.map(g => <option key={g.id} value={g.id}>{g.icon} {g.name}</option>)}
            </select>
            <select className="h-6 px-1 text-[10px] border border-slate-400 rounded bg-white outline-none" defaultValue="all">
              <option value="all">All Sub Groups</option>
              <option value="fresh">Fresh Items</option>
              <option value="packaged">Packaged</option>
              <option value="frozen">Frozen</option>
            </select>
            <select className="h-6 px-1 text-[10px] border border-slate-400 rounded bg-white outline-none" defaultValue="all">
              <option value="all">All Brands</option>
              <option value="local">Local</option>
              <option value="imported">Imported</option>
            </select>
            <select className="h-6 px-1 text-[10px] border border-slate-400 rounded bg-white outline-none" defaultValue="all">
              <option value="all">All Suppliers</option>
            </select>
          </div>
          {/* Search Text row */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-slate-700 uppercase">Search Text:</span>
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0); }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSelect();
                if (e.key === 'Escape') onClose();
                if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex(i => Math.min(filtered.length - 1, i + 1)); }
                if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex(i => Math.max(0, i - 1)); }
              }}
              placeholder="Details (name, SKU, barcode, supplier)"
              className="flex-1 h-6 px-2 text-[10px] border border-slate-400 rounded bg-white outline-none focus:ring-1 focus:ring-blue-400"
            />
            <button onClick={() => setSelectedIndex(0)} className="h-6 px-3 rounded border border-slate-400 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-semibold">Search</button>
          </div>
        </div>

        {/* Table — white background with column headers */}
        <div className="flex-shrink-0 grid grid-cols-[140px_1fr_50px_90px_90px] gap-0 px-2 py-1 text-[9px] font-bold text-white" style={{ backgroundColor: '#1E5A8E' }}>
          <div>Part no.</div>
          <div>Details</div>
          <div className="text-right">Qty</div>
          <div className="text-right">Retail GHC</div>
          <div className="text-right">Cost GHC</div>
        </div>

        {/* Table body */}
        <div className="flex-1 overflow-y-auto bg-white min-h-0" style={{ scrollbarWidth: 'thin' }}>
          {filtered.length === 0 ? (
            <div className="text-center py-6 text-slate-400 text-[11px]">No products match the filters</div>
          ) : (
            filtered.map((p, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={p.id}
                  onClick={() => setSelectedIndex(idx)}
                  onDoubleClick={() => onSelect(p)}
                  className="grid grid-cols-[140px_1fr_50px_90px_90px] gap-0 px-2 py-0.5 text-[10px] cursor-pointer border-b border-slate-100"
                  style={{ backgroundColor: isSelected ? '#D6E6F5' : (idx % 2 === 1 ? '#F8F8F8' : '#FFFFFF') }}
                >
                  <div className="font-mono truncate text-slate-700">{p.barcode}</div>
                  <div className="truncate text-slate-800">{p.emoji} {p.name}</div>
                  <div className="text-right font-mono text-slate-700">{p.stock}</div>
                  <div className="text-right font-mono text-slate-700">{p.price.toFixed(2)}</div>
                  <div className="text-right font-mono text-slate-700">{p.costPrice.toFixed(2)}</div>
                </div>
              );
            })
          )}
        </div>

        {/* Action buttons — bottom row matching reference */}
        <div className="flex-shrink-0 px-3 py-2 flex items-center gap-1.5 border-t" style={{ borderColor: '#808080', backgroundColor: '#E8F5E9' }}>
          <button onClick={handleSelect} className="h-7 px-3 rounded text-white text-[10px] font-semibold flex items-center gap-1 transition" style={{ backgroundColor: '#4CAF50' }}>
            <Save className="h-3 w-3" /> Select (Enter)
          </button>
          <button onClick={() => { if (filtered[selectedIndex]) onSelect(filtered[selectedIndex]); }} className="h-7 px-3 rounded text-white text-[10px] font-semibold flex items-center gap-1 transition" style={{ backgroundColor: '#2196F3' }}>
            <Package className="h-3 w-3" /> Modify
          </button>
          <button onClick={() => toast({ title: 'New Product', description: 'Use Stock File to add new products' })} className="h-7 px-3 rounded text-white text-[10px] font-semibold flex items-center gap-1 transition" style={{ backgroundColor: '#2196F3' }}>
            <Package className="h-3 w-3" /> New
          </button>
          <button onClick={() => { if (!filtered[selectedIndex]) { toast({ title: 'Select a product first', variant: 'destructive' }); return; } toast({ title: 'Product Picture', description: filtered[selectedIndex].name }); }} className="h-7 px-3 rounded text-white text-[10px] font-semibold flex items-center gap-1 transition" style={{ backgroundColor: '#9E9E9E' }}>
            <Package className="h-3 w-3" /> Picture
          </button>
          <button onClick={() => { if (!filtered[selectedIndex]) { toast({ title: 'Select a product first', variant: 'destructive' }); return; } toast({ title: 'Product History', description: filtered[selectedIndex].name }); }} className="h-7 px-3 rounded text-white text-[10px] font-semibold flex items-center gap-1 transition" style={{ backgroundColor: '#2196F3' }}>
            <SearchIcon className="h-3 w-3" /> History
          </button>
          <button onClick={() => { if (!filtered[selectedIndex]) { toast({ title: 'Select a product first', variant: 'destructive' }); return; } toast({ title: 'Print Labels', description: filtered[selectedIndex].name }); }} className="h-7 px-3 rounded text-white text-[10px] font-semibold flex items-center gap-1 transition" style={{ backgroundColor: '#9C27B0' }}>
            <Printer className="h-3 w-3" /> Labels
          </button>
          <button onClick={() => { if (!filtered[selectedIndex]) { toast({ title: 'Select a product first', variant: 'destructive' }); return; } toast({ title: 'Quantity Adjustment', description: filtered[selectedIndex].name }); }} className="h-7 px-3 rounded text-white text-[10px] font-semibold flex items-center gap-1 transition" style={{ backgroundColor: '#FF9800' }}>
            <AlertTriangle className="h-3 w-3" /> Qty
          </button>
          <div className="flex-1" />
          <button onClick={onClose} className="h-7 px-3 rounded text-white text-[10px] font-semibold flex items-center gap-1 transition" style={{ backgroundColor: '#F44336' }}>
            <X className="h-3 w-3" /> Close (Esc)
          </button>
        </div>
        <div className="flex-shrink-0 px-3 py-0.5 text-[9px] text-slate-600 flex items-center gap-3" style={{ backgroundColor: '#E0E0E0' }}>
          <span className="font-mono">{filtered.length} of {products.length} products</span>
          <div className="flex-1" />
          <span>↑↓ Navigate · Enter Select · Esc Close</span>
        </div>
      </motion.div>
    </motion.div>
  );
}
