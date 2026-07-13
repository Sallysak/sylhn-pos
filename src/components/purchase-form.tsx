"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Save, Printer, Mail, Trash2, CreditCard, X, Search,
  Plus, Check, Package, Calendar, User, Hash,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { COMPANY, CURRENCY, formatGHS, type Product, type StockGroup } from "@/lib/pos-data";
import { PopupWindow } from "@/components/popup-window";
import { PurchaseListPopup, type PurchaseListRow } from "@/components/purchase-list-popup";
import { PurchaseOrderListPopup, type PurchaseOrderListRow } from "@/components/purchase-order-list-popup";

// ===== Sample existing purchase transactions (linked to Purchase List) =====
const existingPurchases: (PurchaseListRow & { items?: { sku: string; name: string; emoji: string; qty: number; cost: number; taxable: boolean }[]; supplier?: string; date?: string })[] = [
  {
    id: 'ep1', transactionType: '1-AgriCorp Ghana', invoiceNo: 'PUR-100231', date: '2026-07-01',
    reference: 'REF-001', amount: 540.00, paid: 540.00, due: 0, supplier: 'AgriCorp Ghana',
    items: [{ sku: 'FR-001', name: 'Red Apples', emoji: '🍎', qty: 10, cost: 24.00, taxable: false }, { sku: 'FR-002', name: 'Bananas', emoji: '🍌', qty: 20, cost: 11.00, taxable: false }],
  },
  {
    id: 'ep2', transactionType: '2-Global Foods GH', invoiceNo: 'PUR-100232', date: '2026-07-03',
    reference: 'REF-002', amount: 3200.00, paid: 0, due: 3200.00, supplier: 'Global Foods GH',
    items: [{ sku: 'GR-001', name: 'Rice 5kg', emoji: '🍚', qty: 40, cost: 72.00, taxable: true }],
  },
  {
    id: 'ep3', transactionType: '3-Fan Milk Ghana', invoiceNo: 'PUR-100233', date: '2026-07-05',
    reference: 'REF-003', amount: 850.50, paid: 0, due: 850.50, supplier: 'Fan Milk Ghana',
    items: [{ sku: 'DR-001', name: 'Whole Milk 1L', emoji: '🥛', qty: 65, cost: 13.00, taxable: true }],
  },
  {
    id: 'ep4', transactionType: '4-Darko Farms', invoiceNo: 'PUR-100234', date: '2026-07-06',
    reference: 'REF-004', amount: 420.00, paid: 0, due: 420.00, supplier: 'Darko Farms',
    items: [{ sku: 'VEG-001', name: 'Tomatoes', emoji: '🍅', qty: 30, cost: 14.00, taxable: false }],
  },
  {
    id: 'ep5', transactionType: '5-Unilever Ghana', invoiceNo: 'PUR-100235', date: '2026-07-07',
    reference: 'REF-005', amount: 5680.00, paid: 0, due: 5680.00, supplier: 'Unilever Ghana',
    items: [{ sku: 'HH-001', name: 'Soap Bar', emoji: '🧼', qty: 100, cost: 56.80, taxable: true }],
  },
];

// ===== Sample existing purchase orders (linked to Purchase Order List) =====
const existingOrders: (PurchaseOrderListRow & { items?: { sku: string; name: string; emoji: string; qty: number; cost: number; taxable: boolean }[]; supplier?: string; date?: string })[] = [
  {
    id: 'eo1', transactionType: '1-AgriCorp Ghana', invoiceNo: 'PO-2026-001', date: '2026-07-01',
    amount: 1250.00, paid: 1250.00, due: 0, status: 'received', supplier: 'AgriCorp Ghana',
    items: [{ sku: 'FR-001', name: 'Red Apples', emoji: '🍎', qty: 50, cost: 24.00, taxable: false }],
  },
  {
    id: 'eo2', transactionType: '2-Global Foods GH', invoiceNo: 'PO-2026-002', date: '2026-07-03',
    amount: 3200.00, paid: 0, due: 3200.00, status: 'partial', supplier: 'Global Foods GH',
    items: [{ sku: 'GR-001', name: 'Rice 5kg', emoji: '🍚', qty: 40, cost: 72.00, taxable: true }],
  },
  {
    id: 'eo3', transactionType: '3-Fan Milk Ghana', invoiceNo: 'PO-2026-003', date: '2026-07-05',
    amount: 850.50, paid: 0, due: 850.50, status: 'sent', supplier: 'Fan Milk Ghana',
    items: [{ sku: 'DR-001', name: 'Whole Milk 1L', emoji: '🥛', qty: 100, cost: 13.00, taxable: true }],
  },
  {
    id: 'eo4', transactionType: '4-Darko Farms', invoiceNo: 'PO-2026-004', date: '2026-07-06',
    amount: 420.00, paid: 0, due: 420.00, status: 'draft', supplier: 'Darko Farms',
    items: [{ sku: 'VEG-001', name: 'Tomatoes', emoji: '🍅', qty: 30, cost: 14.00, taxable: false }],
  },
];

type ListPopupMode = 'none' | 'purchase-list' | 'order-list';

interface PurchaseLine {
  id: string;
  partNo: string;
  details: string;
  emoji: string;
  quantity: number;
  cost: number;
  expiry: string;
  tax: boolean;
  total: number;
}

interface PurchaseFormProps {
  onBack: () => void;
  products: Product[];
  groups: StockGroup[];
  /** Suppliers — accepts either simple {id, name} or full Supplier objects with tradingTerms, creditLimit, balance */
  suppliers: { id: string; name: string; tradingTerms?: string; creditLimit?: number; balance?: number; taxInclusive?: boolean; email?: string; phone?: string }[];
}

const GREEN = '#4CAF50';
const GREEN_DARK = '#388E3C';

export function PurchaseForm({ onBack, products, groups, suppliers }: PurchaseFormProps) {
  const { toast } = useToast();
  const [invoiceNo, setInvoiceNo] = useState(`PUR-${Date.now().toString().slice(-6)}`);
  const [docType, setDocType] = useState("Purchase");
  const [supplier, setSupplier] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [refNo, setRefNo] = useState("");
  const [terms, setTerms] = useState("Net 30");
  const [salesperson, setSalesperson] = useState("Sarah Johnson");
  const [taxInclusive, setTaxInclusive] = useState(true);
  const [balance, setBalance] = useState(0);
  const [limit, setLimit] = useState(0);
  const [lines, setLines] = useState<PurchaseLine[]>([]);
  const [selectedLine, setSelectedLine] = useState<number | null>(null);
  const [findPartNo, setFindPartNo] = useState("");
  const [onHand, setOnHand] = useState(0);
  const [bin, setBin] = useState("");
  const [showStockList, setShowStockList] = useState(false);
  const [listPopupMode, setListPopupMode] = useState<ListPopupMode>('none');
  const [paidAmount, setPaidAmount] = useState(0);
  const [saved, setSaved] = useState(false);
  const [showDraftBanner, setShowDraftBanner] = useState(false);

  const findPartNoRef = useRef<HTMLInputElement>(null);

  // ===== Detect reorder-suggestions draft on mount =====
  // If the user clicked "Create Purchase Order" from the Stocktake Dashboard,
  // a draft is saved in localStorage under 'sylhn-po-draft-from-reorder'.
  // We show a banner offering to load it.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const draftRaw = window.localStorage.getItem('sylhn-po-draft-from-reorder');
      if (draftRaw) {
        const draft = JSON.parse(draftRaw);
        if (draft && Array.isArray(draft.lines) && draft.lines.length > 0) {
          setShowDraftBanner(true);
        }
      }
    } catch { /* ignore */ }
  }, []);

  // ===== Load the reorder draft into the form =====
  const loadReorderDraft = () => {
    try {
      const draftRaw = window.localStorage.getItem('sylhn-po-draft-from-reorder');
      if (!draftRaw) { toast({ title: 'No draft found', variant: 'destructive' }); return; }
      const draft = JSON.parse(draftRaw);
      // Load lines
      setLines(draft.lines.map((l: any) => ({
        id: l.id || `line-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        partNo: l.partNo,
        details: l.details,
        emoji: l.emoji || '',
        quantity: l.quantity,
        cost: l.cost,
        expiry: l.expiry || '',
        tax: l.tax ?? true,
        total: l.total,
      })));
      // Load supplier + look up trading terms / credit limit / balance from the supplier database
      if (draft.supplier) {
        setSupplier(draft.supplier);
        // Try to match the supplier in the suppliers prop to pull in trading terms, balance, etc.
        const matchedSupplier = suppliers.find(s => s.name === draft.supplier);
        if (matchedSupplier) {
          if (matchedSupplier.tradingTerms) setTerms(matchedSupplier.tradingTerms);
          if (typeof matchedSupplier.balance === 'number') setBalance(matchedSupplier.balance);
          if (typeof matchedSupplier.creditLimit === 'number') setLimit(matchedSupplier.creditLimit);
          if (typeof matchedSupplier.taxInclusive === 'boolean') setTaxInclusive(matchedSupplier.taxInclusive);
          toast({
            title: 'Reorder draft loaded',
            description: `${draft.lines.length} items · ${formatGHS(draft.totalCost || 0)} · Supplier: ${draft.supplier} (${matchedSupplier.tradingTerms || 'no terms'})`,
          });
        } else {
          toast({
            title: 'Reorder draft loaded',
            description: `${draft.lines.length} items · ${formatGHS(draft.totalCost || 0)} · Supplier "${draft.supplier}" not in database — terms not auto-filled`,
          });
        }
      } else {
        toast({
          title: 'Reorder draft loaded',
          description: `${draft.lines.length} items · ${formatGHS(draft.totalCost || 0)}`,
        });
      }
      if (draft.refNo) setRefNo(draft.refNo);
      // Clear the draft from localStorage (so it doesn't reappear next time)
      window.localStorage.removeItem('sylhn-po-draft-from-reorder');
      setShowDraftBanner(false);
      setSaved(false);
    } catch {
      toast({ title: 'Failed to load draft', variant: 'destructive' });
    }
  };

  // ===== Dismiss the draft banner without loading =====
  const dismissDraftBanner = () => {
    try { window.localStorage.removeItem('sylhn-po-draft-from-reorder'); } catch { /* ignore */ }
    setShowDraftBanner(false);
  };

  const totals = useMemo(() => {
    const totalQty = lines.reduce((s, l) => s + l.quantity, 0);
    const totalCost = lines.reduce((s, l) => s + l.total, 0);
    const taxAmount = lines.filter(l => l.tax).reduce((s, l) => s + l.total * 0.15, 0);
    const grandTotal = taxInclusive ? totalCost : totalCost + taxAmount;
    const due = grandTotal - paidAmount;
    return { totalQty, totalCost, taxAmount, grandTotal, due };
  }, [lines, taxInclusive, paidAmount]);

  const handleFindPartNo = (value: string) => {
    setFindPartNo(value);
    // When user types in Find Part No, open the appropriate list popup based on docType:
    //  - docType = "Order"  -> Purchase Order List
    //  - docType = "Purchase" or "Quote" -> Purchase List
    if (value.length > 0) {
      // Try to match by invoice / PO number for quick On Hand lookup
      const source = docType === 'Order' ? existingOrders : existingPurchases;
      const match = source.find(t => t.invoiceNo.toLowerCase() === value.toLowerCase());
      if (match) {
        setOnHand(match.items?.length || 0);
        setBin(match.invoiceNo);
      }
      // Open the correct popup based on docType
      setListPopupMode(docType === 'Order' ? 'order-list' : 'purchase-list');
      setShowStockList(false);
    } else {
      setListPopupMode('none');
      setShowStockList(false);
      setOnHand(0);
      setBin("");
    }
  };

  // ===== Load an existing purchase into the form =====
  const loadPurchaseIntoForm = (row: PurchaseListRow) => {
    // Always close the popup first so the form is visible immediately,
    // even if the lookup below fails for any reason.
    setListPopupMode('none');
    setFindPartNo('');
    setOnHand(0);
    setBin('');

    const found = existingPurchases.find(p => p.id === row.id);
    if (!found) {
      // Fallback: use the row data directly. The row itself may carry items
      // (since existingPurchases entries are passed as the transactions prop).
      const rowAny = row as any;
      setInvoiceNo(rowAny.invoiceNo || row.invoiceNo || `PUR-${Date.now().toString().slice(-6)}`);
      setSupplier(rowAny.supplier || rowAny.transactionType?.replace(/^\d+-/, '') || '');
      setDate(rowAny.date || new Date().toISOString().split('T')[0]);
      setRefNo(rowAny.reference || '');
      setPaidAmount(rowAny.paid || 0);
      const items = Array.isArray(rowAny.items) ? rowAny.items : [];
      setLines(items.map((it: any, i: number) => ({
        id: `line-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
        partNo: it.sku || it.partNo || '',
        details: `${it.emoji || '📦'} ${it.name || it.details || ''}`,
        emoji: it.emoji || '📦',
        quantity: it.qty || it.quantity || 1,
        cost: it.cost || 0,
        expiry: '',
        tax: it.taxable ?? it.tax ?? true,
        total: (it.qty || it.quantity || 1) * (it.cost || 0),
      })));
      setSaved(false);
      toast({ title: 'Purchase loaded', description: `${rowAny.invoiceNo || row.invoiceNo} · ${items.length} items` });
      return;
    }
    setInvoiceNo(found.invoiceNo);
    setSupplier(found.supplier || found.transactionType.replace(/^\d+-/, ''));
    setDate(found.date || new Date().toISOString().split('T')[0]);
    setRefNo(found.reference || '');
    setPaidAmount(found.paid);
    // Always set lines — even if found.items is undefined, set to [] so the
    // form reflects the loaded state (rather than keeping stale lines).
    const items = (found.items && found.items.length > 0) ? found.items : [];
    setLines(items.map((it, i) => ({
      id: `line-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
      partNo: it.sku,
      details: `${it.emoji} ${it.name}`,
      emoji: it.emoji,
      quantity: it.qty,
      cost: it.cost,
      expiry: '',
      tax: it.taxable,
      total: it.qty * it.cost,
    })));
    setSaved(false);
    toast({ title: 'Purchase loaded', description: `${found.invoiceNo} · ${items.length} items` });
  };

  // ===== Load an existing purchase order into the form =====
  const loadOrderIntoForm = (row: PurchaseOrderListRow) => {
    // Always close the popup first so the form is visible immediately.
    setListPopupMode('none');
    setFindPartNo('');
    setOnHand(0);
    setBin('');

    const found = existingOrders.find(o => o.id === row.id);
    if (!found) {
      // Fallback: use the row data directly.
      const rowAny = row as any;
      setInvoiceNo(rowAny.invoiceNo || row.invoiceNo || `PO-${Date.now().toString().slice(-6)}`);
      setSupplier(rowAny.supplier || rowAny.transactionType?.replace(/^\d+-/, '') || '');
      setDate(rowAny.date || new Date().toISOString().split('T')[0]);
      setPaidAmount(rowAny.paid || 0);
      const items = Array.isArray(rowAny.items) ? rowAny.items : [];
      setLines(items.map((it: any, i: number) => ({
        id: `line-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
        partNo: it.sku || it.partNo || '',
        details: `${it.emoji || '📦'} ${it.name || it.details || ''}`,
        emoji: it.emoji || '📦',
        quantity: it.qty || it.quantity || 1,
        cost: it.cost || 0,
        expiry: '',
        tax: it.taxable ?? it.tax ?? true,
        total: (it.qty || it.quantity || 1) * (it.cost || 0),
      })));
      setSaved(false);
      toast({ title: 'Purchase order loaded', description: `${rowAny.invoiceNo || row.invoiceNo} · ${items.length} items` });
      return;
    }
    setInvoiceNo(found.invoiceNo);
    setSupplier(found.supplier || found.transactionType.replace(/^\d+-/, ''));
    setDate(found.date || new Date().toISOString().split('T')[0]);
    setPaidAmount(found.paid);
    const items = (found.items && found.items.length > 0) ? found.items : [];
    setLines(items.map((it, i) => ({
      id: `line-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
      partNo: it.sku,
      details: `${it.emoji} ${it.name}`,
      emoji: it.emoji,
      quantity: it.qty,
      cost: it.cost,
      expiry: '',
      tax: it.taxable,
      total: it.qty * it.cost,
    })));
    setSaved(false);
    toast({ title: 'Purchase order loaded', description: `${found.invoiceNo} · ${items.length} items` });
  };

  const addProductToLine = (product: Product) => {
    const existingIdx = lines.findIndex(l => l.partNo === product.sku);
    if (existingIdx >= 0) {
      setLines(prev => prev.map((l, i) => i === existingIdx ? { ...l, quantity: l.quantity + 1, total: (l.quantity + 1) * l.cost } : l));
      toast({ title: "Quantity updated", description: `${product.emoji} ${product.name} qty +1` });
    } else {
      setLines(prev => [...prev, { id: `line-${Date.now()}`, partNo: product.sku, details: `${product.emoji} ${product.name}`, emoji: product.emoji, quantity: 1, cost: product.costPrice, expiry: product.expiryDate, tax: product.taxable, total: product.costPrice }]);
      toast({ title: "Product added", description: `${product.emoji} ${product.name}` });
    }
    setFindPartNo(""); setShowStockList(false); setOnHand(0); setBin(""); setSaved(false);
  };

  const updateLine = (idx: number, field: keyof PurchaseLine, value: any) => {
    setLines(prev => prev.map((l, i) => {
      if (i !== idx) return l;
      const updated = { ...l, [field]: value };
      if (field === 'quantity' || field === 'cost') updated.total = updated.quantity * updated.cost;
      return updated;
    }));
    setSaved(false);
  };

  const removeLine = (idx: number) => {
    setLines(prev => prev.filter((_, i) => i !== idx));
    setSelectedLine(null);
    setSaved(false);
    toast({ title: "Line removed" });
  };

  // ===== Working Action Handlers =====
  const handleSave = () => {
    if (lines.length === 0) { toast({ title: "No items to save", variant: "destructive" }); return; }
    if (!supplier) { toast({ title: "Select a supplier first", variant: "destructive" }); return; }
    setSaved(true);
    toast({ title: "Purchase saved (F2)", description: `${invoiceNo} · ${lines.length} items · ${formatGHS(totals.grandTotal)}` });
  };

  const handlePrint = () => {
    if (lines.length === 0) { toast({ title: "Nothing to print", variant: "destructive" }); return; }
    // Open a print window with only the report content
    const printWin = window.open('', '_blank', 'width=800,height=600');
    if (!printWin) { toast({ title: "Popup blocked", description: "Allow popups to print", variant: "destructive" }); return; }

    const rows = lines.map((l, i) => `
      <tr style="background:${i % 2 === 1 ? '#F8F8F8' : '#FFFFFF'}">
        <td style="border:1px solid #999;padding:3px 6px;text-align:center">${i + 1}</td>
        <td style="border:1px solid #999;padding:3px 6px;font-family:monospace">${l.partNo}</td>
        <td style="border:1px solid #999;padding:3px 6px">${l.details}</td>
        <td style="border:1px solid #999;padding:3px 6px;text-align:right">${l.quantity}</td>
        <td style="border:1px solid #999;padding:3px 6px;text-align:right">${l.cost.toFixed(2)}</td>
        <td style="border:1px solid #999;padding:3px 6px;text-align:center">${l.expiry}</td>
        <td style="border:1px solid #999;padding:3px 6px;text-align:center">${l.tax ? '✓' : ''}</td>
        <td style="border:1px solid #999;padding:3px 6px;text-align:right;font-weight:bold">${l.total.toFixed(2)}</td>
      </tr>`).join('');

    printWin.document.write(`<!DOCTYPE html><html><head><title>Purchase Order ${invoiceNo}</title>
      <style>
        body { font-family: Arial, Helvetica, sans-serif; margin: 20px; }
        .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 15px; }
        .header h1 { margin: 0; font-size: 18px; }
        .header div { font-size: 12px; color: #666; }
        .info { display: flex; justify-content: space-between; margin-bottom: 15px; font-size: 11px; }
        .info div { margin-right: 20px; }
        table { width: 100%; border-collapse: collapse; font-size: 11px; }
        th { background: #E0E0E0; border: 1px solid #999; padding: 4px 6px; font-weight: bold; text-align: left; }
        .totals { margin-top: 15px; margin-left: auto; width: 300px; font-size: 11px; }
        .totals td { padding: 3px 8px; }
        .totals .total-row { font-weight: bold; border-top: 2px solid #333; }
        @media print { body { margin: 10px; } }
      </style></head><body>
      <div class="header">
        <h1>${COMPANY.name}</h1>
        <div>Accra Warehouse · ${COMPANY.address} · ${COMPANY.contact}</div>
      </div>
      <h2 style="text-align:center;font-size:14px;margin:10px 0">Purchase Order</h2>
      <div class="info">
        <div><strong>Invoice:</strong> ${invoiceNo}</div>
        <div><strong>Supplier:</strong> ${supplier || 'N/A'}</div>
        <div><strong>Date:</strong> ${date}</div>
        <div><strong>Terms:</strong> ${terms}</div>
        <div><strong>Salesperson:</strong> ${salesperson}</div>
      </div>
      <table>
        <thead><tr>
          <th style="width:30px">#</th><th>Part Number</th><th>Details</th>
          <th style="text-align:right">Qty</th><th style="text-align:right">Cost GHC</th>
          <th style="text-align:center">Expiry</th><th style="text-align:center">TAX</th>
          <th style="text-align:right">Total GHC</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <table class="totals">
        <tr><td>Total Qty:</td><td style="text-align:right">${totals.totalQty}</td></tr>
        <tr><td>TAX GHC:</td><td style="text-align:right">${totals.taxAmount.toFixed(2)}</td></tr>
        <tr class="total-row"><td>Total GHC:</td><td style="text-align:right">${totals.grandTotal.toFixed(2)}</td></tr>
        <tr><td>Paid GHC:</td><td style="text-align:right">${paidAmount.toFixed(2)}</td></tr>
        <tr class="total-row"><td>Due GHC:</td><td style="text-align:right;color:${totals.due > 0 ? '#D32F2F' : '#388E3C'}">${totals.due.toFixed(2)}</td></tr>
      </table>
      </body></html>`);
    printWin.document.close();
    setTimeout(() => { printWin.focus(); printWin.print(); }, 300);
    toast({ title: "Printing (F3)", description: `${lines.length} items` });
  };

  const handleEmail = () => {
    if (!supplier) { toast({ title: "Select a supplier first", variant: "destructive" }); return; }
    if (lines.length === 0) { toast({ title: "No items to email", variant: "destructive" }); return; }
    toast({ title: "Email sent ✓", description: `Purchase order ${invoiceNo} emailed to ${supplier}` });
  };

  const handleDelete = () => {
    if (lines.length === 0) { toast({ title: "Nothing to delete" }); return; }
    setLines([]); setSelectedLine(null); setPaidAmount(0); setSaved(false);
    toast({ title: "Purchase deleted (F4)", description: "All lines cleared" });
  };

  const handlePayment = () => {
    if (lines.length === 0) { toast({ title: "No items", variant: "destructive" }); return; }
    const due = totals.due;
    if (due <= 0) { toast({ title: "Fully paid", description: "No balance due" }); return; }
    setPaidAmount(totals.grandTotal);
    toast({ title: "Payment recorded (F5)", description: `Paid ${formatGHS(totals.grandTotal)} · Due ${formatGHS(0)}` });
  };

  // ===== Keyboard shortcuts: F2/F3/F4/F5/F7/Esc =====
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Skip if user is typing in an input/textarea/select — except for F-keys and Esc
      const target = e.target as HTMLElement;
      const isTyping = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT');

      if (e.key === 'F7') {
        e.preventDefault();
        setListPopupMode(prev => prev !== 'none' ? 'none' : (docType === 'Order' ? 'order-list' : 'purchase-list'));
        return;
      }
      if (e.key === 'F2') { e.preventDefault(); handleSave(); return; }
      if (e.key === 'F3') { e.preventDefault(); handlePrint(); return; }
      if (e.key === 'F4') { e.preventDefault(); handleDelete(); return; }
      if (e.key === 'F5') { e.preventDefault(); handlePayment(); return; }
      if (e.key === 'Escape' && listPopupMode !== 'none' && !isTyping) {
        e.preventDefault();
        setListPopupMode('none');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [docType, lines, supplier, invoiceNo, listPopupMode, paidAmount, taxInclusive, totals]);

  return (
    <div className="h-screen flex flex-col bg-slate-100">
      <PopupWindow
        title="Purchase"
        titleBarColor={GREEN_DARK}
        initialWidth={920}
        initialHeight={650}
        minWidth={700}
        minHeight={500}
        onClose={onBack}
      >
        <div className="h-full flex flex-col bg-white" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
          {/* Green Header Bar */}
          <div className="flex-shrink-0 flex items-center justify-between px-3 py-1.5 text-white" style={{ backgroundColor: GREEN_DARK }}>
            <div className="flex items-center gap-2">
              <select value={docType} onChange={(e) => setDocType(e.target.value)} className="bg-white/15 border border-white/20 rounded px-1.5 py-0.5 text-[10px] text-white font-bold outline-none">
                <option value="Purchase">Purchase</option>
                <option value="Quote">Quote</option>
                <option value="Order">Order</option>
              </select>
              <Badge variant="secondary" className="bg-white/25 text-white text-[9px]">{invoiceNo}</Badge>
              {saved && <Badge variant="secondary" className="bg-green-200 text-green-800 text-[9px]">✓ Saved</Badge>}
            </div>
            <div className="flex items-center gap-2 text-[10px]">
              <div className="flex items-center gap-1">
                <span className="text-white/70 text-[9px]">Date:</span>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="bg-white/15 border border-white/20 rounded px-1 py-0.5 text-[9px] text-white outline-none" />
              </div>
              <div className="flex items-center gap-1">
                <span className="text-white/70 text-[9px]">Ref:</span>
                <input value={refNo} onChange={(e) => setRefNo(e.target.value)} placeholder="Ref No." className="w-16 bg-white/15 border border-white/20 rounded px-1 py-0.5 text-[9px] text-white placeholder:text-white/60 outline-none" />
              </div>
              <div className="flex items-center gap-1">
                <span className="text-white/70 text-[9px]">Terms:</span>
                <select value={terms} onChange={(e) => setTerms(e.target.value)} className="bg-white/15 border border-white/20 rounded px-1 py-0.5 text-[9px] text-white outline-none">
                  <option value="Net 15">Net 15</option><option value="Net 30">Net 30</option><option value="Net 60">Net 60</option><option value="COD">COD</option><option value="Prepaid">Prepaid</option>
                </select>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-white/70 text-[9px]">Salesperson:</span>
                <select value={salesperson} onChange={(e) => setSalesperson(e.target.value)} className="bg-white/15 border border-white/20 rounded px-1 py-0.5 text-[9px] text-white outline-none">
                  <option value="Sarah Johnson">Sarah Johnson</option>
                  <option value="Mike Mensah">Mike Mensah</option>
                  <option value="Grace Owusu">Grace Owusu</option>
                </select>
              </div>
            </div>
          </div>

          {/* ===== Reorder Draft Banner (shown when a draft from Stocktake Dashboard is detected) ===== */}
          <AnimatePresence>
            {showDraftBanner && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="flex-shrink-0 overflow-hidden"
              >
                <div className="px-3 py-2 bg-emerald-50 border-b border-emerald-200 flex items-center gap-3">
                  <Package className="h-5 w-5 text-emerald-600 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-bold text-emerald-800">Reorder Draft Available</div>
                    <div className="text-[10px] text-emerald-700">
                      A purchase order draft from the Stocktake Dashboard Reorder Suggestions was detected.
                      Click "Load Draft" to populate the form with suggested reorder quantities.
                    </div>
                  </div>
                  <button
                    onClick={loadReorderDraft}
                    className="h-7 px-3 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold flex items-center gap-1 transition shadow-sm"
                  >
                    <Package className="h-3 w-3" /> Load Draft
                  </button>
                  <button
                    onClick={dismissDraftBanner}
                    className="h-7 w-7 rounded bg-white hover:bg-emerald-100 text-emerald-700 flex items-center justify-center transition border border-emerald-300"
                    title="Dismiss"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Supplier Bar */}
          <div className="flex-shrink-0 px-3 py-1.5 bg-slate-50 border-b border-slate-300 flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <label className="text-[10px] font-bold text-slate-700">Supplier:</label>
              <select
                value={supplier}
                onChange={(e) => {
                  const selectedName = e.target.value;
                  setSupplier(selectedName);
                  setSaved(false);
                  // Auto-fill trading terms, balance, credit limit, tax inclusive from supplier database
                  const matched = suppliers.find(s => s.name === selectedName);
                  if (matched) {
                    if (matched.tradingTerms) setTerms(matched.tradingTerms);
                    if (typeof matched.balance === 'number') setBalance(matched.balance);
                    if (typeof matched.creditLimit === 'number') setLimit(matched.creditLimit);
                    if (typeof matched.taxInclusive === 'boolean') setTaxInclusive(matched.taxInclusive);
                  }
                }}
                className="h-6 px-1.5 text-[10px] border border-slate-400 rounded bg-white outline-none focus:ring-1 focus:ring-green-400 min-w-[140px]"
              >
                <option value="">Select supplier...</option>
                {suppliers.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-slate-700">Invoice:</span>
              <input value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} className="h-6 w-24 px-1.5 text-[10px] font-mono border border-slate-400 rounded bg-white outline-none" />
            </div>
            {/* Display supplier details when matched */}
            {supplier && (() => {
              const matched = suppliers.find(s => s.name === supplier);
              return matched && (matched.tradingTerms || typeof matched.balance === 'number') ? (
                <div className="flex items-center gap-2 text-[9px] text-slate-500 ml-auto">
                  {matched.tradingTerms && <span>Terms: <span className="font-mono font-semibold text-slate-700">{matched.tradingTerms}</span></span>}
                  {typeof matched.balance === 'number' && <span>Balance: <span className="font-mono font-semibold text-slate-700">{formatGHS(matched.balance)}</span></span>}
                  {typeof matched.creditLimit === 'number' && matched.creditLimit > 0 && <span>Limit: <span className="font-mono font-semibold text-slate-700">{formatGHS(matched.creditLimit)}</span></span>}
                </div>
              ) : null;
            })()}
          </div>

          {/* Order + Delivery Panels */}
          <div className="flex-shrink-0 px-3 py-1.5 flex items-start gap-3 border-b border-slate-200">
            <div className="flex-1 border border-slate-300 rounded p-1.5">
              <div className="text-[9px] font-bold text-slate-700 mb-0.5">Order Details</div>
              <textarea placeholder="Order notes..." rows={1} className="w-full text-[9px] border border-slate-200 rounded px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-green-400 resize-none" />
              <label className="flex items-center gap-1 mt-0.5 text-[9px] text-slate-700 cursor-pointer">
                <input type="checkbox" checked={taxInclusive} onChange={(e) => setTaxInclusive(e.target.checked)} className="h-2.5 w-2.5 accent-green-600" /> Tax Inclusive
              </label>
            </div>
            <div className="flex-1 border border-slate-300 rounded p-1.5">
              <div className="text-[9px] font-bold text-slate-700 mb-0.5">Delivery Details</div>
              <div className="grid grid-cols-3 gap-1.5">
                <div><label className="text-[8px] text-slate-500 font-semibold">Balance</label><input type="number" value={balance.toFixed(2)} readOnly className="w-full h-5 px-1 text-[9px] font-mono border border-slate-200 rounded bg-slate-50 outline-none" /></div>
                <div><label className="text-[8px] text-slate-500 font-semibold">Limit</label><input type="number" value={limit.toFixed(2)} readOnly className="w-full h-5 px-1 text-[9px] font-mono border border-slate-200 rounded bg-slate-50 outline-none" /></div>
                <div><label className="text-[8px] text-slate-500 font-semibold">Available</label><input type="number" value={(limit - balance).toFixed(2)} readOnly className="w-full h-5 px-1 text-[9px] font-mono border border-slate-200 rounded bg-slate-50 outline-none" /></div>
              </div>
            </div>
          </div>

          {/* Data Grid */}
          <div className="flex-1 overflow-hidden flex flex-col min-h-0">
            <div className="flex-shrink-0 grid grid-cols-[25px_100px_1fr_55px_70px_80px_30px_80px] gap-1 px-2 py-1 text-[9px] font-bold text-slate-700 border-b border-slate-400" style={{ backgroundColor: '#E0E0E0' }}>
              <div className="text-center">#</div><div>Part Number</div><div>Details</div><div className="text-right">Qty</div><div className="text-right">Cost GHC</div><div className="text-center">Expiry</div><div className="text-center">TAX</div><div className="text-right">Total GHC</div>
            </div>
            <ScrollArea className="flex-1 min-h-0">
              <div>
                {lines.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-slate-400">
                    <Package className="h-8 w-8 mb-1 opacity-40" />
                    <div className="text-[10px] font-medium">No items added yet</div>
                    <div className="text-[9px] mt-0.5">Type a Part No. below to search</div>
                  </div>
                ) : (
                  lines.map((line, idx) => {
                    const isSelected = selectedLine === idx;
                    return (
                      <div key={line.id} onClick={() => setSelectedLine(idx)}
                        className="grid grid-cols-[25px_100px_1fr_55px_70px_80px_30px_80px] gap-1 px-2 py-0.5 text-[9px] cursor-pointer border-b border-slate-100"
                        style={{ backgroundColor: isSelected ? '#E6F0FF' : (idx % 2 === 1 ? '#F8F8F8' : '#FFFFFF') }}>
                        <div className="text-center text-slate-500">{idx + 1}</div>
                        <div className="font-mono truncate">{line.partNo}</div>
                        <div className="truncate">{line.details}</div>
                        <div className="text-right"><input type="number" value={line.quantity} onClick={(e) => e.stopPropagation()} onChange={(e) => updateLine(idx, 'quantity', parseFloat(e.target.value) || 0)} className="w-full text-right font-mono bg-transparent border-b border-transparent hover:border-slate-300 focus:border-green-400 outline-none" /></div>
                        <div className="text-right"><input type="number" step="0.01" value={line.cost} onClick={(e) => e.stopPropagation()} onChange={(e) => updateLine(idx, 'cost', parseFloat(e.target.value) || 0)} className="w-full text-right font-mono bg-transparent border-b border-transparent hover:border-slate-300 focus:border-green-400 outline-none" /></div>
                        <div className="text-center text-slate-600">{line.expiry}</div>
                        <div className="text-center"><input type="checkbox" checked={line.tax} onClick={(e) => e.stopPropagation()} onChange={(e) => updateLine(idx, 'tax', e.target.checked)} className="h-2.5 w-2.5 accent-green-600" /></div>
                        <div className="text-right font-mono font-semibold">{line.total.toFixed(2)}</div>
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Bottom: Find Part No + Totals */}
          <div className="flex-shrink-0 px-3 py-1.5 bg-slate-50 border-t border-slate-300 flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5">
              <div>
                <label className="text-[8px] font-bold text-slate-600 block">
                  Find Part no <span className="text-[7px] font-normal text-blue-600">({docType === 'Order' ? 'Purchase Order List' : 'Purchases List'})</span>
                </label>
                <div className="flex items-center gap-0.5">
                  <input ref={findPartNoRef} value={findPartNo} onChange={(e) => handleFindPartNo(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        // Open the appropriate list popup based on docType
                        setListPopupMode(docType === 'Order' ? 'order-list' : 'purchase-list');
                      }
                      if (e.key === 'Escape') { setListPopupMode('none'); setShowStockList(false); }
                    }}
                    onFocus={() => {
                      // Show the appropriate list based on docType when input is focused
                      if (findPartNo) {
                        setListPopupMode(docType === 'Order' ? 'order-list' : 'purchase-list');
                      }
                    }}
                    placeholder="Type / Enter..."
                    className="w-24 h-5 px-1.5 text-[9px] font-mono border border-slate-400 rounded outline-none focus:ring-1 focus:ring-green-400"
                    style={{ backgroundColor: '#FFFFCC' }}
                  />
                  <button
                    type="button"
                    onClick={() => setListPopupMode(docType === 'Order' ? 'order-list' : 'purchase-list')}
                    className="h-5 px-1.5 rounded text-white text-[8px] font-bold flex items-center gap-0.5 transition"
                    style={{ backgroundColor: '#2196F3' }}
                    title={`Open ${docType === 'Order' ? 'Purchase Order List' : 'Purchases List'} (F7)`}
                  >
                    <Search className="h-2.5 w-2.5" /> F7
                  </button>
                </div>
              </div>
              <div><label className="text-[8px] font-bold text-slate-600 block">On Hand</label><input value={onHand} readOnly className="w-12 h-5 px-1 text-[9px] font-mono border border-slate-300 rounded bg-slate-100 outline-none text-center" /></div>
              <div><label className="text-[8px] font-bold text-slate-600 block">Bin</label><input value={bin} readOnly className="w-16 h-5 px-1 text-[9px] font-mono border border-slate-300 rounded bg-slate-100 outline-none" /></div>
            </div>
            <div className="flex-1 flex items-center justify-end gap-1.5 flex-wrap">
              <div className="text-right"><label className="text-[8px] font-bold text-slate-600 block">Total Qty</label><input value={totals.totalQty} readOnly className="w-12 h-5 px-1 text-[9px] font-mono border border-slate-300 rounded bg-white outline-none text-center" /></div>
              <div className="text-right"><label className="text-[8px] font-bold text-slate-600 block">TAX GHC</label><input value={totals.taxAmount.toFixed(2)} readOnly className="w-14 h-5 px-1 text-[9px] font-mono border border-slate-300 rounded bg-white outline-none text-right" /></div>
              <div className="text-right"><label className="text-[8px] font-bold text-slate-600 block">Retail %</label><input type="number" placeholder="0" className="w-10 h-5 px-1 text-[9px] font-mono border border-slate-300 rounded bg-white outline-none text-right" /></div>
              <div className="text-right"><label className="text-[8px] font-bold text-slate-600 block">Total GHC</label><input value={totals.grandTotal.toFixed(2)} readOnly className="w-16 h-5 px-1 text-[9px] font-mono font-bold border border-slate-400 rounded outline-none text-right" style={{ backgroundColor: '#E6F0FF' }} /></div>
              <div className="text-right"><label className="text-[8px] font-bold text-slate-600 block">Trade %</label><input type="number" placeholder="0" className="w-10 h-5 px-1 text-[9px] font-mono border border-slate-300 rounded bg-white outline-none text-right" /></div>
              <div className="text-right"><label className="text-[8px] font-bold text-slate-600 block">Paid GHC</label><input type="number" value={paidAmount || ''} onChange={(e) => setPaidAmount(parseFloat(e.target.value) || 0)} className="w-16 h-5 px-1 text-[9px] font-mono border border-slate-400 rounded bg-white outline-none text-right" placeholder="0.00" /></div>
              <div className="text-right"><label className="text-[8px] font-bold text-slate-600 block">WSale %</label><input type="number" placeholder="0" className="w-10 h-5 px-1 text-[9px] font-mono border border-slate-300 rounded bg-white outline-none text-right" /></div>
              <div className="text-right"><label className="text-[8px] font-bold text-slate-600 block">Due GHC</label><input value={totals.due.toFixed(2)} readOnly className={cn("w-16 h-5 px-1 text-[9px] font-mono font-bold border border-slate-400 rounded outline-none text-right", totals.due > 0 ? "text-rose-600" : "text-emerald-600")} style={{ backgroundColor: '#FFF8E1' }} /></div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex-shrink-0 px-3 py-1.5 flex items-center gap-1.5 border-t border-slate-300" style={{ backgroundColor: '#F0F0F0' }}>
            <button onClick={handleSave} className="h-7 px-3 rounded text-white text-[9px] font-semibold flex items-center gap-1 transition shadow-sm" style={{ backgroundColor: GREEN }}> <Save className="h-3 w-3" /> Save <kbd className="text-[7px] bg-white/20 px-0.5 rounded">F2</kbd></button>
            <button onClick={handlePrint} className="h-7 px-3 rounded text-white text-[9px] font-semibold flex items-center gap-1 transition shadow-sm" style={{ backgroundColor: GREEN }}> <Printer className="h-3 w-3" /> Print <kbd className="text-[7px] bg-white/20 px-0.5 rounded">F3</kbd></button>
            <button onClick={handleEmail} className="h-7 px-3 rounded text-white text-[9px] font-semibold flex items-center gap-1 transition shadow-sm" style={{ backgroundColor: GREEN }}> <Mail className="h-3 w-3" /> Email</button>
            <button onClick={handleDelete} className="h-7 px-3 rounded text-white text-[9px] font-semibold flex items-center gap-1 transition shadow-sm" style={{ backgroundColor: GREEN }}> <Trash2 className="h-3 w-3" /> Delete <kbd className="text-[7px] bg-white/20 px-0.5 rounded">F4</kbd></button>
            <button onClick={handlePayment} className="h-7 px-3 rounded text-white text-[9px] font-semibold flex items-center gap-1 transition shadow-sm" style={{ backgroundColor: GREEN }}> <CreditCard className="h-3 w-3" /> Payment <kbd className="text-[7px] bg-white/20 px-0.5 rounded">F5</kbd></button>
            <div className="flex-1" />
            {selectedLine !== null && <button onClick={() => removeLine(selectedLine)} className="h-7 px-2 rounded bg-rose-100 hover:bg-rose-200 text-rose-700 text-[9px] font-semibold flex items-center gap-1 transition"><Trash2 className="h-3 w-3" /> Remove Line</button>}
          </div>

          {/* Status Bar */}
          <div className="flex-shrink-0 px-3 py-0.5 text-[8px] text-white flex items-center gap-3" style={{ backgroundColor: '#808080' }}>
            <span><kbd className="bg-white/20 px-0.5 rounded mr-0.5">F7</kbd>Purchases List</span>
            <span><kbd className="bg-white/20 px-0.5 rounded mr-0.5">F9</kbd>Part No.</span>
            <span><kbd className="bg-white/20 px-0.5 rounded mr-0.5">F10</kbd>Details</span>
            <span><kbd className="bg-white/20 px-0.5 rounded mr-0.5">Shift+F12</kbd>Print Labels</span>
            <div className="flex-1" />
            <span>{lines.length} items · {formatGHS(totals.grandTotal)}</span>
          </div>
        </div>

        {/* Stock List Popup (legacy, kept for fallback) */}
        <AnimatePresence>
          {showStockList && (
            <StockListMiniPopup products={products} searchText={findPartNo} onSelect={addProductToLine} onClose={() => setShowStockList(false)} />
          )}
        </AnimatePresence>

        {/* ===== Purchase List Popup (when docType = Purchase/Quote) ===== */}
        <AnimatePresence>
          {listPopupMode === 'purchase-list' && (
            <PurchaseListPopup
              transactions={existingPurchases}
              onSelect={loadPurchaseIntoForm}
              onClose={() => setListPopupMode('none')}
              title="Purchases List"
            />
          )}
        </AnimatePresence>

        {/* ===== Purchase Order List Popup (when docType = Order) ===== */}
        <AnimatePresence>
          {listPopupMode === 'order-list' && (
            <PurchaseOrderListPopup
              orders={existingOrders}
              onSelect={loadOrderIntoForm}
              onClose={() => setListPopupMode('none')}
              title="Purchase Order List"
            />
          )}
        </AnimatePresence>
      </PopupWindow>
    </div>
  );
}

// ===== Mini Stock List Popup =====
function StockListMiniPopup({ products, searchText, onSelect, onClose }: {
  products: Product[]; searchText: string; onSelect: (product: Product) => void; onClose: () => void;
}) {
  const { toast } = useToast();
  const [query, setQuery] = useState(searchText);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, []);

  const filtered = useMemo(() => {
    const q = (query || searchText).toLowerCase().trim();
    if (!q) return products;
    return products.filter(p => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || p.barcode.includes(q));
  }, [products, query, searchText]);

  const handleSelect = () => { if (filtered[selectedIndex]) onSelect(filtered[selectedIndex]); };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/40 flex items-start justify-center pt-20 z-50" onClick={onClose}>
      <motion.div initial={{ scale: 0.95, y: -20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: -20 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }} onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-lg shadow-2xl overflow-hidden flex flex-col" style={{ width: '650px', maxHeight: '400px', fontFamily: 'Arial, Helvetica, sans-serif' }}>
        <div className="flex-shrink-0 flex items-center justify-between px-3 h-7 text-white" style={{ backgroundColor: '#5B9BD5' }}>
          <span className="text-xs font-bold">Stock List</span>
          <button onClick={onClose} className="h-5 w-5 rounded hover:bg-white/25 flex items-center justify-center transition"><X className="h-3.5 w-3.5" /></button>
        </div>
        <div className="flex-shrink-0 px-3 py-1.5 bg-white border-b border-slate-300 flex items-center gap-2">
          <label className="text-[10px] font-bold text-slate-700">Search:</label>
          <input ref={inputRef} value={query} onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0); }}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSelect(); if (e.key === 'Escape') onClose(); if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex(i => Math.min(filtered.length - 1, i + 1)); } if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex(i => Math.max(0, i - 1)); } }}
            placeholder="Type to search..." className="flex-1 h-7 px-2 text-xs border border-slate-400 rounded outline-none focus:ring-2 focus:ring-blue-400" />
          <button onClick={() => setSelectedIndex(0)} className="h-7 px-3 rounded border border-slate-400 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold">Search</button>
        </div>
        <div className="flex-shrink-0 px-3 py-1 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
          <label className="text-[10px] font-bold text-slate-700">Filter By:</label>
          <select className="h-6 px-1 text-[10px] border border-slate-300 rounded bg-white outline-none"><option>All Groups</option><option>Groceries</option><option>Confectionery</option><option>Soft Drinks</option><option>Hard Liquor</option><option>Households</option></select>
          <span className="text-[10px] text-slate-500 ml-auto font-mono">{filtered.length} of {products.length}</span>
        </div>
        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          <div className="flex-shrink-0 grid grid-cols-[120px_1fr_45px_80px_80px_80px] gap-1 px-2 py-1 text-[10px] font-bold text-white" style={{ backgroundColor: '#4A90E2' }}>
            <div>Part No</div><div>Item Details</div><div className="text-right">Qty</div><div className="text-right">Retail GHC</div><div className="text-right">Trade GHC</div><div className="text-right">Cost GHC</div>
          </div>
          <ScrollArea className="flex-1 min-h-0">
            <div>
              {filtered.length === 0 ? <div className="text-center py-6 text-slate-400 text-xs">No products found</div> : (
                filtered.map((p, idx) => {
                  const isSelected = idx === selectedIndex;
                  return (
                    <div key={p.id} onClick={() => setSelectedIndex(idx)} onDoubleClick={() => onSelect(p)}
                      className="grid grid-cols-[120px_1fr_45px_80px_80px_80px] gap-1 px-2 py-1 text-[10px] cursor-pointer border-b border-slate-100"
                      style={{ backgroundColor: isSelected ? '#D6E8FF' : (idx % 2 === 1 ? '#F8F8F8' : '#FFFFFF') }}>
                      <div className="font-mono truncate">{p.barcode}</div><div className="truncate">{p.emoji} {p.name}</div>
                      <div className="text-right font-mono">{p.stock}</div><div className="text-right font-mono">{p.price.toFixed(2)}</div>
                      <div className="text-right font-mono">{p.costPrice.toFixed(2)}</div><div className="text-right font-mono">{p.costPrice.toFixed(2)}</div>
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </div>
        <div className="flex-shrink-0 px-3 py-1.5 flex items-center gap-1.5 border-t border-slate-300" style={{ backgroundColor: '#E0F0E8' }}>
          <button onClick={handleSelect} className="h-7 px-3 rounded text-white text-[10px] font-semibold flex items-center gap-1" style={{ backgroundColor: '#4CAF50' }}><Check className="h-3 w-3" /> Select (Enter)</button>
          <button onClick={() => toast({ title: "New Product", description: "Use Stock File to add new products" })} className="h-7 px-3 rounded text-white text-[10px] font-semibold flex items-center gap-1" style={{ backgroundColor: '#2196F3' }}><Plus className="h-3 w-3" /> New</button>
          <button onClick={() => { if (!filtered[selectedIndex]) { toast({ title: "Select a product first", variant: "destructive" }); return; } toast({ title: "Product Picture", description: `${filtered[selectedIndex].emoji} ${filtered[selectedIndex].name}` }); }} className="h-7 px-3 rounded text-white text-[10px] font-semibold flex items-center gap-1" style={{ backgroundColor: '#9E9E9E' }}><Package className="h-3 w-3" /> Picture</button>
          <button onClick={() => { if (!filtered[selectedIndex]) { toast({ title: "Select a product first", variant: "destructive" }); return; } toast({ title: "Product History", description: `${filtered[selectedIndex].name} (${filtered[selectedIndex].sku})` }); }} className="h-7 px-3 rounded text-white text-[10px] font-semibold flex items-center gap-1" style={{ backgroundColor: '#FF9800' }}><Search className="h-3 w-3" /> History</button>
          <button onClick={() => { if (!filtered[selectedIndex]) { toast({ title: "Select a product first", variant: "destructive" }); return; } toast({ title: "Printing (F3)", description: `Printing label for ${filtered[selectedIndex].name}` }); }} className="h-7 px-3 rounded text-white text-[10px] font-semibold flex items-center gap-1" style={{ backgroundColor: '#9C27B0' }}><Printer className="h-3 w-3" /> Print (F3)</button>
          <div className="flex-1" />
          <button onClick={onClose} className="h-7 px-3 rounded text-white text-[10px] font-semibold flex items-center gap-1" style={{ backgroundColor: '#F44336' }}><X className="h-3 w-3" /> Close (Esc)</button>
        </div>
        <div className="flex-shrink-0 px-3 py-0.5 text-[9px] text-slate-600 flex items-center gap-3" style={{ backgroundColor: '#E0E0E0' }}>
          <span className="font-mono">{filtered.length} of {products.length}</span><span>Source: Main Store</span>
        </div>
      </motion.div>
    </motion.div>
  );
}
