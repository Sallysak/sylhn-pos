"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Save, Printer, Trash2, Upload, Download, X, Search as SearchIcon,
  Package, AlertTriangle, TrendingUp,
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
  /** Stock history (used by the "Compare with last Stocktake" report) */
  history?: StockHistoryEntry[];
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
  history = [],
  groups,
  onClose,
  asWindow = true,
  initialAdjustmentType = 'stocktake',
  initialProductId,
}: StockQuantityAdjustmentProps) {
  const { toast } = useToast();

  // ===== Draft persistence key (per browser) =====
  const DRAFT_KEY = 'sylhn-stock-adjustment-draft';

  // ===== Form state (with draft restore) =====
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
  const [draftRestored, setDraftRestored] = useState(false);

  // ===== Stock Search popup state =====
  const [showStockSearch, setShowStockSearch] = useState(false);
  const [findPartNo, setFindPartNo] = useState('');
  const findPartNoRef = useRef<HTMLInputElement>(null);

  // ===== Compare-with-last-Stocktake report state =====
  const [showCompareReport, setShowCompareReport] = useState(false);

  // ===== Restore draft from localStorage on first mount =====
  // Only restore if there's a draft AND no initialProductId was passed in
  // (initialProductId is a "jump to product" action that shouldn't be trumped by a stale draft)
  useEffect(() => {
    if (initialProductId) {
      const p = products.find(p => p.id === initialProductId);
      if (p) addProductToLines(p);
      return;
    }
    if (typeof window === 'undefined') return;
    try {
      const cached = window.localStorage.getItem(DRAFT_KEY);
      if (!cached) return;
      const draft = JSON.parse(cached);
      if (!draft || !Array.isArray(draft.lines) || draft.lines.length === 0) return;
      // Only restore if the draft is from the current session (within last 24h)
      const draftAge = Date.now() - (draft.savedAt || 0);
      if (draftAge > 24 * 60 * 60 * 1000) {
        // Draft is stale — clear it
        window.localStorage.removeItem(DRAFT_KEY);
        return;
      }
      // Restore all fields
      if (draft.adjNumber) setAdjNumber(draft.adjNumber);
      if (draft.adjType) setAdjType(draft.adjType);
      if (draft.date) setDate(draft.date);
      if (draft.details !== undefined) setDetails(draft.details);
      if (draft.postToAC !== undefined) setPostToAC(draft.postToAC);
      if (draft.fromPartNo !== undefined) setFromPartNo(draft.fromPartNo);
      if (draft.toPartNo !== undefined) setToPartNo(draft.toPartNo);
      if (draft.groupFilter !== undefined) setGroupFilter(draft.groupFilter);
      if (draft.bin !== undefined) setBin(draft.bin);
      // Rehydrate lines — refresh onHand from current product data so the displayed
      // current stock is fresh, but keep the user's counted value
      const restoredLines: AdjustmentLine[] = draft.lines
        .map((l: any) => {
          const product = products.find(p => p.id === l.productId);
          if (!product) return null; // product was deleted since draft was saved
          const freshOnHand = product.stock;
          const freshCost = product.costPrice;
          // Recompute variance against current on-hand (may differ from draft)
          const counted = l.counted ?? l.onHand ?? freshOnHand;
          const qty = counted - freshOnHand;
          return {
            id: l.id || `line-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            partNo: product.sku,
            details: `${product.emoji} ${product.name}`,
            onHand: freshOnHand,
            counted,
            qty,
            cost: freshCost,
            total: qty * freshCost,
            productId: product.id,
            emoji: product.emoji,
          };
        })
        .filter(Boolean);
      if (restoredLines.length > 0) {
        setLines(restoredLines);
        setDraftRestored(true);
        toast({
          title: 'Draft restored',
          description: `${restoredLines.length} lines from your previous session`,
        });
      }
    } catch {
      // ignore corrupt draft
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ===== Auto-save draft to localStorage whenever state changes =====
  // Skip saving when the form is empty (no lines) AND no draft has been restored —
  // this avoids creating a draft just from opening the form.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    // Don't save if the form is "fresh" (no lines, no details, no draft restored)
    if (lines.length === 0 && !details && !draftRestored && !saved) return;
    // Don't save after a successful save (saved drafts are cleared separately)
    if (saved) return;
    const draft = {
      adjNumber, adjType, date, details, postToAC,
      fromPartNo, toPartNo, groupFilter, bin,
      lines, savedAt: Date.now(),
    };
    try {
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch { /* storage full or unavailable */ }
  }, [adjNumber, adjType, date, details, postToAC, fromPartNo, toPartNo, groupFilter, bin, lines, saved, draftRestored]);

  // ===== Compute totals =====
  const totals = useMemo(() => {
    const totalQty = lines.reduce((s, l) => s + l.onHand, 0);
    const totalCost = lines.reduce((s, l) => s + l.total, 0);
    const totalVariance = lines.reduce((s, l) => s + l.qty, 0);
    return { totalQty, totalCost, totalVariance };
  }, [lines]);

  // ===== Find the most recent committed stocktake/adjustment for comparison =====
  // Looks through history for entries with action='adjusted' (i.e. previous stocktakes/adjustments),
  // groups them by reference, and picks the most recent reference (excluding the current adjNumber
  // if it has already been saved).
  const lastStocktakeData = useMemo(() => {
    // Group history entries by reference, keeping the latest timestamp per reference
    const groups = new Map<string, { reference: string; timestamp: string; entries: StockHistoryEntry[] }>();
    history.forEach(h => {
      if (h.action !== 'adjusted' || !h.reference) return;
      // Skip the current adjustment (in case it was already saved and the user is comparing again)
      if (h.reference === adjNumber) return;
      const existing = groups.get(h.reference);
      if (existing) {
        existing.entries.push(h);
        if (h.timestamp > existing.timestamp) existing.timestamp = h.timestamp;
      } else {
        groups.set(h.reference, { reference: h.reference, timestamp: h.timestamp, entries: [h] });
      }
    });
    if (groups.size === 0) return null;
    // Pick the most recent reference
    const sorted = Array.from(groups.values()).sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    const lastEvent = sorted[0];
    // Build a map of productId -> { counted, variance, productName, sku } from the last event
    const productMap = new Map<string, { counted: number; variance: number; productName: string; sku: string }>();
    lastEvent.entries.forEach(e => {
      productMap.set(e.productId, {
        counted: e.newQuantity,
        variance: e.quantityChange,
        productName: e.productName,
        sku: e.sku,
      });
    });
    return {
      reference: lastEvent.reference,
      timestamp: lastEvent.timestamp,
      entries: lastEvent.entries,
      productMap,
    };
  }, [history, adjNumber]);

  // ===== Build the comparison rows: current adjustment lines vs. last stocktake =====
  const comparisonRows = useMemo(() => {
    if (!lastStocktakeData) return [];
    return lines.map(l => {
      const prev = lastStocktakeData.productMap.get(l.productId);
      const prevCounted = prev?.counted ?? null;
      // Delta = current counted - previous counted
      // (positive means we have more than the last stocktake recorded)
      const delta = prevCounted !== null ? l.counted - prevCounted : null;
      return {
        productId: l.productId,
        partNo: l.partNo,
        details: l.details,
        currentOnHand: l.onHand,
        currentCounted: l.counted,
        previousCounted: prevCounted,
        previousReference: prev ? lastStocktakeData.reference : null,
        deltaFromLast: delta,
      };
    });
  }, [lines, lastStocktakeData]);

  // ===== Totals for comparison report =====
  const comparisonTotals = useMemo(() => {
    const totalCurrentCounted = comparisonRows.reduce((s, r) => s + r.currentCounted, 0);
    const totalPreviousCounted = comparisonRows.reduce((s, r) => s + (r.previousCounted ?? 0), 0);
    const totalDelta = comparisonRows.reduce((s, r) => s + (r.deltaFromLast ?? 0), 0);
    const matchedProducts = comparisonRows.filter(r => r.previousCounted !== null).length;
    const newProducts = comparisonRows.length - matchedProducts;
    return { totalCurrentCounted, totalPreviousCounted, totalDelta, matchedProducts, newProducts };
  }, [comparisonRows]);

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
    // Clear the in-progress draft (the adjustment has been committed)
    if (typeof window !== 'undefined') {
      try { window.localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
    }
    setDraftRestored(false);
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
    // Clear the in-progress draft as well
    if (typeof window !== 'undefined') {
      try { window.localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
    }
    setDraftRestored(false);
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
        {!saved && lines.length > 0 && (
          <span className="text-[10px] font-bold text-amber-700 flex items-center gap-0.5" title="Auto-saved to localStorage — restored if you refresh or close the form">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
            Draft auto-saved
          </span>
        )}
        {draftRestored && !saved && (
          <button
            onClick={() => {
              if (typeof window !== 'undefined') {
                try { window.localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
              }
              setLines([]);
              setDetails('');
              setFromPartNo('');
              setToPartNo('');
              setBin('');
              setGroupFilter('all');
              setAdjNumber(`ADJ-${Date.now().toString().slice(-6)}`);
              setDraftRestored(false);
              toast({ title: 'Draft discarded', description: 'Form reset to blank' });
            }}
            className="h-5 px-2 rounded bg-rose-100 hover:bg-rose-200 text-rose-700 text-[9px] font-semibold transition"
            title="Discard the restored draft and start fresh"
          >
            Discard draft
          </button>
        )}
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
        <button
          onClick={() => {
            if (lines.length === 0) { toast({ title: 'Add products first', description: 'Load the current adjustment before comparing', variant: 'destructive' }); return; }
            if (!lastStocktakeData) { toast({ title: 'No previous stocktake found', description: 'Save this stocktake first, then compare against future ones', variant: 'destructive' }); return; }
            setShowCompareReport(true);
          }}
          className="h-7 px-3 rounded text-white text-[10px] font-semibold flex items-center gap-1 transition shadow-sm"
          style={{ backgroundColor: HEADER_DARK_BLUE }}
          title="Compare the current adjustment with the most recent committed stocktake"
        >
          <TrendingUp className="h-3 w-3" style={{ color: '#FFC107' }} /> Compare
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

      {/* ===== Compare with last Stocktake Report Popup ===== */}
      <AnimatePresence>
        {showCompareReport && lastStocktakeData && (
          <CompareWithLastStocktakeReport
            currentAdjNumber={adjNumber}
            currentAdjType={adjType}
            currentDate={date}
            previousReference={lastStocktakeData.reference}
            previousTimestamp={lastStocktakeData.timestamp}
            rows={comparisonRows}
            totals={comparisonTotals}
            onClose={() => setShowCompareReport(false)}
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

// ===== Compare with last Stocktake Report Popup =====
// Shows a side-by-side comparison of the current adjustment's counted quantities
// against the most recent committed stocktake (or adjustment), highlighting
// items where the count has changed and items that are new since the last event.
interface ComparisonRow {
  productId: string;
  partNo: string;
  details: string;
  currentOnHand: number;
  currentCounted: number;
  previousCounted: number | null;
  previousReference: string | null;
  deltaFromLast: number | null;
}

interface ComparisonTotals {
  totalCurrentCounted: number;
  totalPreviousCounted: number;
  totalDelta: number;
  matchedProducts: number;
  newProducts: number;
}

interface CompareReportProps {
  currentAdjNumber: string;
  currentAdjType: 'stocktake' | 'adjustment';
  currentDate: string;
  previousReference: string;
  previousTimestamp: string;
  rows: ComparisonRow[];
  totals: ComparisonTotals;
  onClose: () => void;
}

function CompareWithLastStocktakeReport({
  currentAdjNumber,
  currentAdjType,
  currentDate,
  previousReference,
  previousTimestamp,
  rows,
  totals,
  onClose,
}: CompareReportProps) {
  const { toast } = useToast();

  // Format timestamp for display
  const fmtPrevDate = (() => {
    try {
      const d = new Date(previousTimestamp);
      return d.toLocaleDateString('en-GB') + ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return previousTimestamp;
    }
  })();

  // Sort rows: items with delta first (descending by abs delta), then matched items with no delta, then new items
  const sortedRows = [...rows].sort((a, b) => {
    const aDelta = a.deltaFromLast ?? -Infinity; // null = new item, push to end
    const bDelta = b.deltaFromLast ?? -Infinity;
    if (aDelta === null && bDelta === null) return 0;
    if (aDelta === null) return 1;
    if (bDelta === null) return -1;
    return Math.abs(bDelta) - Math.abs(aDelta);
  });

  const handlePrint = () => {
    const printWin = window.open('', '_blank', 'width=900,height=600');
    if (!printWin) { toast({ title: 'Popup blocked', variant: 'destructive' }); return; }
    const rowsHtml = sortedRows.map((r, i) => {
      const delta = r.deltaFromLast;
      const deltaColor = delta === null ? '#666' : (delta > 0 ? '#16A34A' : delta < 0 ? '#DC2626' : '#666');
      const deltaText = delta === null ? 'NEW' : (delta > 0 ? `+${delta}` : `${delta}`);
      return `
        <tr style="background:${i % 2 === 1 ? '#F8F8F8' : '#FFFFFF'}">
          <td style="border:1px solid #999;padding:4px 6px;text-align:center">${i + 1}</td>
          <td style="border:1px solid #999;padding:4px 6px;font-family:monospace">${r.partNo}</td>
          <td style="border:1px solid #999;padding:4px 6px">${r.details}</td>
          <td style="border:1px solid #999;padding:4px 6px;text-align:right;background:#FFF8DC">${r.currentOnHand}</td>
          <td style="border:1px solid #999;padding:4px 6px;text-align:right">${r.currentCounted}</td>
          <td style="border:1px solid #999;padding:4px 6px;text-align:right">${r.previousCounted ?? '—'}</td>
          <td style="border:1px solid #999;padding:4px 6px;text-align:right;color:${deltaColor};font-weight:bold">${deltaText}</td>
        </tr>`;
    }).join('');
    printWin.document.write(`<!DOCTYPE html><html><head><title>Compare with last Stocktake — ${currentAdjNumber}</title>
      <style>
        body { font-family: Arial, Helvetica, sans-serif; margin: 20px; }
        .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 15px; }
        .header h1 { margin: 0; font-size: 18px; }
        .header div { font-size: 12px; color: #666; }
        .compare-info { display: flex; justify-content: space-between; margin-bottom: 10px; padding: 10px; background: #E6F0FF; border-radius: 4px; font-size: 11px; }
        .compare-info strong { color: #1E5A8E; }
        table { width: 100%; border-collapse: collapse; font-size: 11px; }
        th { background: #1E5A8E; color: white; border: 1px solid #999; padding: 5px 6px; font-weight: bold; }
        .totals { margin-top: 15px; margin-left: auto; width: 380px; font-size: 11px; }
        .totals td { padding: 4px 8px; }
        .totals .total-row { font-weight: bold; border-top: 2px solid #333; }
        @media print { body { margin: 10px; } }
      </style></head><body>
      <div class="header">
        <h1>${COMPANY.name}</h1>
        <div>${COMPANY.address} · ${COMPANY.contact}</div>
      </div>
      <h2 style="text-align:center;font-size:14px;margin:10px 0">Compare with last Stocktake</h2>
      <div class="compare-info">
        <div><strong>Current:</strong> ${currentAdjType === 'stocktake' ? 'Stocktake' : 'Stock Adjustment'} ${currentAdjNumber} · ${currentDate}</div>
        <div><strong>Previous:</strong> ${previousReference} · ${fmtPrevDate}</div>
      </div>
      <table>
        <thead><tr>
          <th style="width:30px;text-align:center">#</th>
          <th style="text-align:left">Part Number</th>
          <th style="text-align:left">Details</th>
          <th style="text-align:right">On Hand</th>
          <th style="text-align:right">Current Counted</th>
          <th style="text-align:right">Previous Counted</th>
          <th style="text-align:right">Delta</th>
        </tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>
      <table class="totals">
        <tr><td>Matched items:</td><td style="text-align:right">${totals.matchedProducts}</td></tr>
        <tr><td>New items (not in previous):</td><td style="text-align:right">${totals.newProducts}</td></tr>
        <tr><td>Total current counted:</td><td style="text-align:right">${totals.totalCurrentCounted}</td></tr>
        <tr><td>Total previous counted:</td><td style="text-align:right">${totals.totalPreviousCounted}</td></tr>
        <tr class="total-row"><td>Net delta:</td><td style="text-align:right;color:${totals.totalDelta > 0 ? '#16A34A' : (totals.totalDelta < 0 ? '#DC2626' : '#666')}">${totals.totalDelta > 0 ? '+' : ''}${totals.totalDelta}</td></tr>
      </table>
      </body></html>`);
    printWin.document.close();
    setTimeout(() => { printWin.focus(); printWin.print(); }, 300);
    toast({ title: 'Printing comparison report' });
  };

  const handleExport = () => {
    import('xlsx').then((XLSX) => {
      type Row = Record<string, string | number>;
      const data: Row[] = sortedRows.map((r, i) => ({
        '#': i + 1,
        'Part Number': r.partNo,
        'Details': r.details,
        'On Hand': r.currentOnHand,
        'Current Counted': r.currentCounted,
        'Previous Counted': r.previousCounted ?? '',
        'Delta from Last': r.deltaFromLast ?? 'NEW',
      }));
      data.push({
        '#': '',
        'Part Number': '',
        'Details': 'TOTAL',
        'On Hand': '',
        'Current Counted': totals.totalCurrentCounted,
        'Previous Counted': totals.totalPreviousCounted,
        'Delta from Last': totals.totalDelta,
      });
      const ws = XLSX.utils.json_to_sheet(data);
      ws['!cols'] = [{ wch: 5 }, { wch: 16 }, { wch: 30 }, { wch: 10 }, { wch: 16 }, { wch: 16 }, { wch: 14 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Comparison');
      XLSX.writeFile(wb, `compare-stocktake-${currentAdjNumber}-${new Date().toISOString().split('T')[0]}.xlsx`);
      toast({ title: 'Exported successfully', description: `${sortedRows.length} rows` });
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-lg shadow-2xl overflow-hidden flex flex-col"
        style={{ width: '900px', maxHeight: '85vh', fontFamily: 'Arial, Helvetica, sans-serif' }}
      >
        {/* Title bar */}
        <div className="flex-shrink-0 flex items-center justify-between px-4 h-9 text-white" style={{ backgroundColor: HEADER_DARK_BLUE }}>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            <span className="text-sm font-bold">Compare with last Stocktake</span>
          </div>
          <button onClick={onClose} className="h-6 w-6 rounded bg-red-600 hover:bg-red-700 flex items-center justify-center transition"><X className="h-3.5 w-3.5 text-white" /></button>
        </div>

        {/* Comparison info banner */}
        <div className="flex-shrink-0 px-4 py-3 bg-blue-50 border-b border-blue-200 grid grid-cols-2 gap-4">
          <div>
            <div className="text-[10px] font-bold text-slate-500 uppercase">Current</div>
            <div className="text-sm font-bold text-slate-800">{currentAdjType === 'stocktake' ? 'Stocktake' : 'Stock Adjustment'} {currentAdjNumber}</div>
            <div className="text-[10px] text-slate-500">{currentDate} · {rows.length} items</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] font-bold text-slate-500 uppercase">Compared against</div>
            <div className="text-sm font-bold text-slate-800">{previousReference}</div>
            <div className="text-[10px] text-slate-500">{fmtPrevDate}</div>
          </div>
        </div>

        {/* Summary stats */}
        <div className="flex-shrink-0 px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center gap-4 text-[10px]">
          <div>
            <span className="text-slate-500">Matched items:</span>
            <span className="font-bold text-slate-800 ml-1">{totals.matchedProducts}</span>
          </div>
          <div>
            <span className="text-slate-500">New items:</span>
            <span className="font-bold text-blue-700 ml-1">{totals.newProducts}</span>
          </div>
          <div>
            <span className="text-slate-500">Current total:</span>
            <span className="font-bold text-slate-800 ml-1 font-mono">{totals.totalCurrentCounted}</span>
          </div>
          <div>
            <span className="text-slate-500">Previous total:</span>
            <span className="font-bold text-slate-800 ml-1 font-mono">{totals.totalPreviousCounted}</span>
          </div>
          <div>
            <span className="text-slate-500">Net delta:</span>
            <span className={cn("font-bold ml-1 font-mono", totals.totalDelta > 0 ? "text-emerald-700" : totals.totalDelta < 0 ? "text-rose-700" : "text-slate-600")}>
              {totals.totalDelta > 0 ? '+' : ''}{totals.totalDelta}
            </span>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          <div className="flex-shrink-0 grid grid-cols-[30px_120px_1fr_70px_90px_90px_80px] gap-0 px-3 py-1 text-[9px] font-bold text-white" style={{ backgroundColor: HEADER_DARK_BLUE }}>
            <div className="text-center">#</div>
            <div>Part Number</div>
            <div>Details</div>
            <div className="text-right">On Hand</div>
            <div className="text-right">Current Counted</div>
            <div className="text-right">Previous Counted</div>
            <div className="text-right">Delta</div>
          </div>
          <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
            {sortedRows.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-[11px]">No items to compare</div>
            ) : (
              sortedRows.map((r, idx) => {
                const delta = r.deltaFromLast;
                const isNew = delta === null;
                return (
                  <div
                    key={r.productId}
                    className="grid grid-cols-[30px_120px_1fr_70px_90px_90px_80px] gap-0 px-3 py-0.5 text-[10px] border-b border-slate-100"
                    style={{
                      backgroundColor: isNew ? '#E3F2FD' : (idx % 2 === 1 ? '#F8F8F8' : '#FFFFFF'),
                    }}
                  >
                    <div className="text-center text-slate-500">{idx + 1}</div>
                    <div className="font-mono truncate text-slate-700">{r.partNo}</div>
                    <div className="truncate text-slate-800">{r.details}</div>
                    <div className="text-right font-mono text-slate-700" style={{ backgroundColor: ON_HAND_BG }}>{r.currentOnHand}</div>
                    <div className="text-right font-mono font-semibold text-slate-800">{r.currentCounted}</div>
                    <div className="text-right font-mono text-slate-600">{r.previousCounted ?? '—'}</div>
                    <div className={cn(
                      "text-right font-mono font-bold",
                      isNew ? "text-blue-700" : (delta! > 0 ? "text-emerald-700" : delta! < 0 ? "text-rose-700" : "text-slate-500")
                    )}>
                      {isNew ? 'NEW' : (delta! > 0 ? `+${delta}` : `${delta}`)}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex-shrink-0 px-4 py-2 flex items-center gap-2 border-t" style={{ borderColor: FIELD_BORDER, backgroundColor: '#F0F4F8' }}>
          <button onClick={handlePrint} className="h-7 px-3 rounded text-white text-[10px] font-semibold flex items-center gap-1 transition" style={{ backgroundColor: HEADER_DARK_BLUE }}>
            <Printer className="h-3 w-3" /> Print
          </button>
          <button onClick={handleExport} className="h-7 px-3 rounded text-white text-[10px] font-semibold flex items-center gap-1 transition" style={{ backgroundColor: HEADER_DARK_BLUE }}>
            <Download className="h-3 w-3" style={{ color: '#4CAF50' }} /> Export
          </button>
          <div className="flex-1" />
          <span className="text-[9px] text-slate-500">
            Items in <span className="bg-blue-100 px-1 rounded">blue</span> are new since the previous stocktake ·
            Delta colors: <span className="text-emerald-700 font-bold">+</span> surplus · <span className="text-rose-700 font-bold">−</span> shortage
          </span>
          <button onClick={onClose} className="h-7 px-3 rounded text-white text-[10px] font-semibold flex items-center gap-1 transition" style={{ backgroundColor: '#F44336' }}>
            <X className="h-3 w-3" /> Close
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
