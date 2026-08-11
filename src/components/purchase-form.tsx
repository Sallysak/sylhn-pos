"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Save, Printer, Mail, Trash2, CreditCard, X, Search,
  Plus, Check, Package, Calendar, User, Hash,
  ChevronUp, ChevronDown, Paperclip, PackageCheck, Shield, Keyboard,
  Image as ImageIcon, Tag, Ban,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { COMPANY, CURRENCY, formatGHS, type Product, type StockGroup } from "@/lib/pos-data";
import { computeGhanaTax, GHANA_TAX_RATES } from "@/lib/ghana-tax";
import { PopupWindow } from "@/components/popup-window";
import { PurchaseListPopup, type PurchaseListRow } from "@/components/purchase-list-popup";
import { PurchaseOrderListPopup, type PurchaseOrderListRow } from "@/components/purchase-order-list-popup";
import { PurchaseEmailDialog } from "@/components/purchase-email-dialog";
import { PurchasePaymentDialog } from "@/components/purchase-payment-dialog";
import { PurchaseReceiveDialog } from "@/components/purchase-receive-dialog";
import { PurchaseAttachmentsDialog } from "@/components/purchase-attachments-dialog";
import { ManagerApproval } from "@/components/manager-approval";
import { KeyboardShortcutsOverlay } from "@/components/keyboard-shortcuts-overlay";

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
  productId?: string;
  partNo: string;
  details: string;
  emoji: string;
  quantity: number;
  cost: number;
  expiry: string;
  tax: boolean;
  total: number;
  // Phase 2: per-line discount
  discountType?: "amount" | "percent" | null;
  discountValue?: number;
  // Phase 2: per-line tax rate (replaces simple tax boolean; tax bool kept for backwards compat)
  taxRate?: number; // 0.15 = 15%
  // Phase 2: batch + free quantity
  batchNumber?: string;
  freeQuantity?: number;
  // Phase 2: pricing markups
  retailPrice?: number;
  tradePrice?: number;
  wholesalePrice?: number;
}

interface PurchaseFormProps {
  onBack: () => void;
  products: Product[];
  groups: StockGroup[];
  /** Suppliers — accepts either simple {id, name} or full Supplier objects with tradingTerms, creditLimit, balance */
  suppliers: { id: string; name: string; code?: string; tradingTerms?: string; creditLimit?: number; balance?: number; taxInclusive?: boolean; email?: string; phone?: string }[];
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
  // Supplier's catalog (loaded when a supplier is selected) — drives the Find Part No search
  const [supplierCatalog, setSupplierCatalog] = useState<any[]>([]);
  const [bin, setBin] = useState("");
  const [showStockList, setShowStockList] = useState(false);
  const [listPopupMode, setListPopupMode] = useState<ListPopupMode>('none');
  const [paidAmount, setPaidAmount] = useState(0);
  const [saved, setSaved] = useState(false);
  const [showDraftBanner, setShowDraftBanner] = useState(false);
  // Track the saved purchase ID + refNo so Email/Payment/Delete buttons can call the right endpoints
  const [savedPurchaseId, setSavedPurchaseId] = useState<string | null>(null);
  const [savedRefNo, setSavedRefNo] = useState<string>("");
  // Premium dialog open states
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [showReceiveDialog, setShowReceiveDialog] = useState(false);
  const [showAttachmentsDialog, setShowAttachmentsDialog] = useState(false);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showShortcutsOverlay, setShowShortcutsOverlay] = useState(false);
  // Track the current PO status for the status badge
  const [purchaseStatus, setPurchaseStatus] = useState<string>("draft");
  // Phase 3: Form-level status (what status to save with). Defaults to "received"
  // for backwards compat — user can change to "draft" or "ordered" to use GRN workflow
  const [formStatus, setFormStatus] = useState<"draft" | "ordered" | "received">("received");
  // Phase 3: Approval threshold (POs over this amount need manager approval before receiving)
  const APPROVAL_THRESHOLD = 5000;
  // Phase 2: currency + landed costs
  const [currency, setCurrency] = useState<string>("GHS");
  const [exchangeRate, setExchangeRate] = useState<number>(1);
  const [freightCost, setFreightCost] = useState<number>(0);
  const [insuranceCost, setInsuranceCost] = useState<number>(0);
  const [customsDuty, setCustomsDuty] = useState<number>(0);
  const [otherLandedCosts, setOtherLandedCosts] = useState<number>(0);
  // Phase 2: which line is "expanded" to show batch/free-qty/prices
  const [expandedLine, setExpandedLine] = useState<string | null>(null);
  // Auto-save draft key (per-tab, per-form-instance)
  const draftKey = useMemo(() => `sylhn-po-draft-${typeof window !== 'undefined' ? window.location.pathname : 'default'}`, []);

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
    // ===== Phase 1: Restore auto-saved draft (if any) =====
    // We only restore if there are no lines yet (so we don't clobber a reorder
    // draft that was just loaded) and if the draft is less than 24 hours old.
    try {
      const autoDraftRaw = window.localStorage.getItem(draftKey);
      if (autoDraftRaw && lines.length === 0) {
        const draft = JSON.parse(autoDraftRaw);
        if (draft && Array.isArray(draft.lines) && draft.lines.length > 0) {
          const ageMs = Date.now() - (draft.savedAt || 0);
          if (ageMs < 24 * 60 * 60 * 1000) {
            // Restore the draft
            setLines(draft.lines.map((l: any) => ({
              id: l.id || `line-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              partNo: l.partNo || '',
              details: l.details || '',
              emoji: l.emoji || '',
              productId: l.productId,
              quantity: l.quantity || 1,
              cost: l.cost || 0,
              expiry: l.expiry || '',
              tax: l.tax ?? true,
              total: l.total || 0,
              // Phase 2: restore new per-line fields
              discountType: l.discountType || null,
              discountValue: l.discountValue || 0,
              taxRate: typeof l.taxRate === 'number' ? l.taxRate : undefined,
              batchNumber: l.batchNumber || '',
              freeQuantity: l.freeQuantity || 0,
              retailPrice: l.retailPrice || 0,
              tradePrice: l.tradePrice || 0,
              wholesalePrice: l.wholesalePrice || 0,
            })));
            if (draft.supplier) setSupplier(draft.supplier);
            if (draft.invoiceNo) setInvoiceNo(draft.invoiceNo);
            if (draft.refNo) setRefNo(draft.refNo);
            if (draft.terms) setTerms(draft.terms);
            if (typeof draft.paidAmount === 'number') setPaidAmount(draft.paidAmount);
            // Phase 2: restore currency + landed costs
            if (draft.currency) setCurrency(draft.currency);
            if (typeof draft.exchangeRate === 'number') setExchangeRate(draft.exchangeRate);
            if (typeof draft.freightCost === 'number') setFreightCost(draft.freightCost);
            if (typeof draft.insuranceCost === 'number') setInsuranceCost(draft.insuranceCost);
            if (typeof draft.customsDuty === 'number') setCustomsDuty(draft.customsDuty);
            if (typeof draft.otherLandedCosts === 'number') setOtherLandedCosts(draft.otherLandedCosts);
            toast({
              title: 'Draft restored',
              description: `${draft.lines.length} items from your last session · auto-saved ${new Date(draft.savedAt).toLocaleTimeString()}`,
            });
          } else {
            // Draft is stale — clear it
            window.localStorage.removeItem(draftKey);
          }
        }
      }
    } catch { /* ignore */ }
  }, []);

  // ===== Phase 1: Auto-save draft to localStorage every 30 seconds =====
  // Skipped if there are no lines (nothing worth saving) or if the purchase
  // has already been saved to the server (savedPurchaseId is set).
  useEffect(() => {
    if (lines.length === 0 || savedPurchaseId) return;
    const interval = setInterval(() => {
      try {
        const draft = {
          lines,
          supplier,
          invoiceNo,
          refNo,
          terms,
          paidAmount,
          // Phase 2: save currency + landed costs too
          currency,
          exchangeRate,
          freightCost,
          insuranceCost,
          customsDuty,
          otherLandedCosts,
          savedAt: Date.now(),
        };
        window.localStorage.setItem(draftKey, JSON.stringify(draft));
      } catch { /* ignore quota errors */ }
    }, 30000);
    return () => clearInterval(interval);
  }, [lines, supplier, invoiceNo, refNo, terms, paidAmount, savedPurchaseId, draftKey, currency, exchangeRate, freightCost, insuranceCost, customsDuty, otherLandedCosts]);

  // ===== Phase 1: Move line up/down (reorder) =====
  const moveLine = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === lines.length - 1) return;
    const newLines = [...lines];
    const swapWith = direction === 'up' ? index - 1 : index + 1;
    [newLines[index], newLines[swapWith]] = [newLines[swapWith], newLines[index]];
    setLines(newLines);
  };

  // ===== Phase 1: Handle successful GRN (receive) =====
  const handleReceived = () => {
    setPurchaseStatus('received');
    // Refresh the purchase from server
    if (savedPurchaseId) {
      authedFetch(`/api/purchases/${savedPurchaseId}`)
        .then(r => r.json())
        .then(data => {
          if (data.purchase) {
            setPurchaseStatus(data.purchase.status || 'received');
          }
        })
        .catch(() => {});
    }
  };

  // ===== Phase 1: Handle successful approval =====
  const handleApproved = (approver: any) => {
    setShowApproveDialog(false);
    toast({
      title: 'Purchase approved ✓',
      description: `Approved by ${approver.fullName} (${approver.role})`,
    });
  };

  // ===== Phase 1: Toggle shortcuts overlay via keyboard (handled in component) =====
  // The KeyboardShortcutsOverlay component listens for "?" itself.

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
    // Phase 2: per-line discount + tax rate calculation
    // Each line: gross = qty * cost; discount = computed from type+value;
    // net = gross - discount; tax = net * taxRate; lineTotal = net + tax
    let totalQty = 0;
    let totalGross = 0;
    let totalDiscount = 0;
    let totalTax = 0;
    let totalNet = 0;

    for (const l of lines) {
      const gross = l.quantity * l.cost;
      let discount = 0;
      if (l.discountType === "amount") {
        discount = Math.min(l.discountValue || 0, gross);
      } else if (l.discountType === "percent") {
        discount = (gross * Math.min(l.discountValue || 0, 100)) / 100;
      }
      const net = gross - discount;
      // Phase 2: use per-line taxRate if set, otherwise fall back to old behavior (15% if tax=true)
      const effectiveTaxRate = typeof l.taxRate === "number" ? l.taxRate : (l.tax ? 0.15 : 0);
      const tax = net * effectiveTaxRate;
      const lineTotal = taxInclusive ? net : net + tax;

      totalQty += l.quantity + (l.freeQuantity || 0);
      totalGross += gross;
      totalDiscount += discount;
      totalTax += tax;
      totalNet += lineTotal;
    }

    // Phase 2: landed costs (freight + insurance + customs + other) added to grand total
    const landedCosts = freightCost + insuranceCost + customsDuty + otherLandedCosts;
    const grandTotal = totalNet + landedCosts;
    const due = grandTotal - paidAmount;
    return { totalQty, totalGross, totalDiscount, totalTax, totalCost: totalNet, landedCosts, grandTotal, due };
  }, [lines, taxInclusive, paidAmount, currency, freightCost, insuranceCost, customsDuty, otherLandedCosts]);

  // Phase 3: Approval threshold check
  const requiresApproval = totals.grandTotal > APPROVAL_THRESHOLD && formStatus === "received" && !savedPurchaseId;

  // Phase 3: Ghana tax breakdown for the totals panel
  const taxBreakdown = useMemo(() => {
    const taxableAmount = totals.totalCost - totals.totalDiscount;
    return computeGhanaTax(taxableAmount);
  }, [totals.totalCost, totals.totalDiscount]);

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
      setLines(prev => [...prev, { id: `line-${Date.now()}`, partNo: product.sku, details: `${product.emoji} ${product.name}`, emoji: product.emoji, quantity: 1, cost: product.costPrice, expiry: product.expiryDate, tax: product.taxable, total: product.costPrice, productId: product.id }]);
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
  const handleSave = async () => {
    if (lines.length === 0) { toast({ title: "No items to save", variant: "destructive" }); return; }
    if (!supplier) { toast({ title: "Select a supplier first", variant: "destructive" }); return; }

    // Premium fix: actually POST the purchase to the server so it's persisted.
    // Previously this was a stub that only showed a toast — the purchase was
    // lost on refresh.
    const supplierObj = suppliers.find(s => s.name === supplier || `${s.code}-${s.name}` === supplier);
    const payload = {
      refNo: invoiceNo,
      type: 'purchase' as const,
      supplierId: supplierObj?.id || null,
      supplierName: supplier || '',
      status: formStatus,
      subtotal: totals.totalCost,
      discount: totals.totalDiscount,
      taxAmount: totals.totalTax,
      total: totals.grandTotal,
      amountPaid: paidAmount,
      notes: '',
      createdBy: salesperson,
      receivedAt: new Date().toISOString(),
      // Phase 2: currency + landed costs
      currency,
      exchangeRate,
      freightCost,
      insuranceCost,
      customsDuty,
      otherLandedCosts,
      items: lines.map(l => ({
        productId: l.productId || null,
        partNo: l.partNo,
        details: l.details,
        emoji: l.emoji,
        quantity: l.quantity,
        cost: l.cost,
        tax: l.tax,
        total: l.total,
        expiryDate: l.expiry || null,
        // Phase 2: per-line discount + tax rate + batch + free qty + prices
        discountType: l.discountType || null,
        discountValue: l.discountValue || 0,
        taxRate: typeof l.taxRate === "number" ? l.taxRate : (l.tax ? 0.15 : 0),
        batchNumber: l.batchNumber || null,
        freeQuantity: l.freeQuantity || 0,
        retailPrice: l.retailPrice || 0,
        tradePrice: l.tradePrice || 0,
        wholesalePrice: l.wholesalePrice || 0,
      })),
    };

    try {
      const res = await authedFetch('/api/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        // Surface FK errors with a friendly message — this is the fix for
        // "foreign key constraint violated on purchase_supplierid_fkey"
        const errMsg = data.code === "SUPPLIER_NOT_FOUND" || data.code === "FK_SUPPLIER"
          ? "Supplier not found. Please re-select the supplier from the dropdown."
          : data.code === "SUPPLIER_NOT_UUID"
          ? "The supplier value looks wrong. Please re-select the supplier from the dropdown."
          : data.code === "SUPPLIER_DEACTIVATED"
          ? "This supplier is deactivated. Reactivate them in the supplier master file first."
          : data.error || `HTTP ${res.status}`;
        throw new Error(errMsg);
      }
      setSaved(true);
      // Track the saved purchase ID + refNo so Email/Payment buttons work
      if (data.purchase?.id) setSavedPurchaseId(data.purchase.id);
      if (data.purchase?.refNo) {
        setSavedRefNo(data.purchase.refNo);
        setInvoiceNo(data.purchase.refNo);
      }
      if (data.purchase?.status) setPurchaseStatus(data.purchase.status);
      // Clear draft since the purchase is now saved
      try { window.localStorage.removeItem(draftKey); } catch {}
      toast({
        title: "Purchase saved to server",
        description: `${data.purchase.refNo} · ${lines.length} items · ${formatGHS(totals.grandTotal)} · stock updated`,
      });
    } catch (e: any) {
      toast({
        title: "Failed to save purchase",
        description: e?.message || "Network error",
        variant: "destructive",
      });
    }
  };

  const handlePrint = () => {
    if (lines.length === 0) { toast({ title: "Nothing to print", variant: "destructive" }); return; }
    // Phase 3: if the purchase is saved, open the branded PDF view
    if (savedPurchaseId) {
      window.open(`/api/purchases/${savedPurchaseId}/pdf`, "_blank");
      toast({ title: "Opening branded PDF (F3)", description: savedRefNo || invoiceNo });
      return;
    }
    // Fallback: inline print template for unsaved purchases
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
        <tr><td>Discount:</td><td style="text-align:right;color:#059669">−${totals.totalDiscount.toFixed(2)}</td></tr>
        <tr><td>Tax:</td><td style="text-align:right">${totals.totalTax.toFixed(2)}</td></tr>
        ${totals.landedCosts > 0 ? `<tr><td>Landed Costs:</td><td style="text-align:right">${totals.landedCosts.toFixed(2)}</td></tr>` : ''}
        <tr class="total-row"><td>Total:</td><td style="text-align:right">${totals.grandTotal.toFixed(2)}</td></tr>
        <tr><td>Paid:</td><td style="text-align:right">${paidAmount.toFixed(2)}</td></tr>
        <tr class="total-row"><td>Due:</td><td style="text-align:right;color:${totals.due > 0 ? '#D32F2F' : '#388E3C'}">${totals.due.toFixed(2)}</td></tr>
      </table>
      </body></html>`);
    printWin.document.close();
    setTimeout(() => { printWin.focus(); printWin.print(); }, 300);
    toast({ title: "Printing (F3)", description: `${lines.length} items` });
  };

  const handleEmail = () => {
    if (!supplier) { toast({ title: "Select a supplier first", variant: "destructive" }); return; }
    if (lines.length === 0) { toast({ title: "No items to email", variant: "destructive" }); return; }
    if (!savedPurchaseId) {
      toast({ title: "Save the purchase first", description: "You can only email a saved purchase order.", variant: "destructive" });
      return;
    }
    setShowEmailDialog(true);
  };

  const handleDelete = async () => {
    if (lines.length === 0) { toast({ title: "Nothing to delete" }); return; }
    // If the purchase has been saved to the server, cancel it server-side (soft delete)
    if (savedPurchaseId) {
      const reason = window.prompt("Reason for cancelling this purchase? (required)") || "";
      if (!reason.trim()) return;
      try {
        const res = await authedFetch(`/api/purchases/${savedPurchaseId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ action: 'cancel' }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || `HTTP ${res.status}`);
        }
        toast({ title: "Purchase cancelled (F4)", description: `${savedRefNo || invoiceNo} marked as cancelled — ${reason}` });
      } catch (e: any) {
        toast({ title: "Failed to cancel", description: e?.message, variant: "destructive" });
        return;
      }
    }
    // Clear local form state
    setLines([]); setSelectedLine(null); setPaidAmount(0); setSaved(false);
    setSavedPurchaseId(null); setSavedRefNo("");
    setInvoiceNo(`PUR-${Date.now().toString().slice(-6)}`);
    toast({ title: "Purchase deleted (F4)", description: "All lines cleared" });
  };

  const handlePayment = () => {
    if (lines.length === 0) { toast({ title: "No items", variant: "destructive" }); return; }
    const due = totals.due;
    if (due <= 0) { toast({ title: "Fully paid", description: "No balance due" }); return; }
    if (!savedPurchaseId) {
      toast({ title: "Save the purchase first", description: "You can only record a payment on a saved purchase.", variant: "destructive" });
      return;
    }
    const supplierObj = suppliers.find(s => s.name === supplier || `${s.code}-${s.name}` === supplier);
    if (!supplierObj) {
      toast({ title: "Invalid supplier", description: "Please re-select the supplier from the dropdown.", variant: "destructive" });
      return;
    }
    setShowPaymentDialog(true);
  };

  // Called after a successful payment — refresh local paid/due state
  const handlePaymentSuccess = () => {
    setPaidAmount(totals.grandTotal);
    setSaved(false); // allow re-save or refresh from server
    // Refresh the purchase from server to get the latest paidAmount
    if (savedPurchaseId) {
      authedFetch(`/api/purchases/${savedPurchaseId}`)
        .then(r => r.json())
        .then(data => {
          if (data.purchase) {
            setPaidAmount(Number(data.purchase.amountPaid) || 0);
          }
        })
        .catch(() => {});
    }
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
              {/* Phase 3: Status dropdown (GRN workflow) */}
              <select
                value={formStatus}
                onChange={(e) => setFormStatus(e.target.value as any)}
                disabled={!!savedPurchaseId}
                title={savedPurchaseId ? "Status is managed by the workflow (use Receive/Approve buttons)" : "Save status: Draft (no stock change), Ordered (PO sent, no stock yet), Received (stock increments now)"}
                className="bg-white/15 border border-white/20 rounded px-1.5 py-0.5 text-[10px] text-white font-bold outline-none disabled:opacity-60"
              >
                <option value="draft">Draft</option>
                <option value="ordered">Ordered</option>
                <option value="received">Received</option>
              </select>
              <Badge variant="secondary" className="bg-white/25 text-white text-[9px]">{invoiceNo}</Badge>
              {saved && <Badge variant="secondary" className="bg-green-200 text-green-800 text-[9px]">✓ Saved</Badge>}
              {requiresApproval && (
                <Badge className="bg-amber-400 text-amber-950 text-[9px] animate-pulse">
                  <Shield className="h-2.5 w-2.5 mr-0.5" /> Needs approval (₵{APPROVAL_THRESHOLD}+)
                </Badge>
              )}
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
                    // Load this supplier's catalog so Find Part No shows catalog items first
                    authedFetch(`/api/suppliers/${matched.id}/products`)
                      .then(r => r.json())
                      .then(data => {
                        if (data.catalog) {
                          setSupplierCatalog(data.catalog);
                          if (data.catalog.length > 0) {
                            toast({ title: "Catalog loaded", description: `${data.catalog.length} product(s) in ${matched.name}'s catalog` });
                          }
                        }
                      })
                      .catch(() => setSupplierCatalog([]));
                  } else {
                    setSupplierCatalog([]);
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
              <input value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} className="h-6 w-32 min-w-[100px] px-1.5 text-[10px] font-mono border border-slate-400 rounded bg-white outline-none" />
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

          {/* Tier 1.6 — Blacklist warning banner */}
          {supplier && (() => {
            const matched = suppliers.find(s => s.name === supplier);
            return matched && (matched as any).blacklist ? (
              <div className="flex-shrink-0 px-3 py-1.5 bg-rose-50 border-b border-rose-200 flex items-center gap-2 text-[10px] text-rose-800">
                <Ban className="h-3.5 w-3.5 shrink-0" />
                <span className="font-semibold">Blacklisted supplier:</span>
                <span>{matched.name} is on the blacklist{(matched as any).blacklistReason ? ` — ${(matched as any).blacklistReason}` : ""}. Proceed only with manager approval. Consider switching to another supplier.</span>
              </div>
            ) : null;
          })()}

          {/* Phase 3: Approval warning banner */}
          {requiresApproval && (
            <div className="flex-shrink-0 px-3 py-1.5 bg-amber-50 border-b border-amber-200 flex items-center gap-2 text-[10px] text-amber-800">
              <Shield className="h-3.5 w-3.5 shrink-0" />
              <span className="font-semibold">Approval required:</span>
              <span>This PO is over ₵{APPROVAL_THRESHOLD.toFixed(2)}. Save as <strong>Ordered</strong> instead of Received, then ask a manager to click <strong>Approve</strong> before receiving goods.</span>
            </div>
          )}

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
            <div className="flex-shrink-0 grid grid-cols-[40px_90px_1fr_45px_60px_55px_50px_45px_70px] gap-1 px-2 py-1 text-[9px] font-bold text-slate-700 border-b border-slate-400" style={{ backgroundColor: '#E0E0E0' }}>
              <div className="text-center">#</div><div>Part Number</div><div>Details</div><div className="text-right">Qty</div><div className="text-right">Cost</div><div className="text-right">Disc</div><div className="text-right">Tax%</div><div className="text-center">Expiry</div><div className="text-right">Total</div>
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
                    const isExpanded = expandedLine === line.id;
                    // Phase 2: compute per-line discount + tax for live display
                    const lineGross = line.quantity * line.cost;
                    let lineDiscount = 0;
                    if (line.discountType === "amount") lineDiscount = Math.min(line.discountValue || 0, lineGross);
                    else if (line.discountType === "percent") lineDiscount = (lineGross * Math.min(line.discountValue || 0, 100)) / 100;
                    const lineNet = lineGross - lineDiscount;
                    const effectiveTaxRate = typeof line.taxRate === "number" ? line.taxRate : (line.tax ? 0.15 : 0);
                    const lineTax = lineNet * effectiveTaxRate;
                    const lineTotal = taxInclusive ? lineNet : lineNet + lineTax;
                    return (
                      <div key={line.id}>
                        <div
                          onClick={() => setSelectedLine(idx)}
                          className="grid grid-cols-[40px_90px_1fr_45px_60px_55px_50px_45px_70px] gap-1 px-2 py-0.5 text-[9px] cursor-pointer border-b border-slate-100"
                          style={{ backgroundColor: isSelected ? '#E6F0FF' : (idx % 2 === 1 ? '#F8F8F8' : '#FFFFFF') }}
                        >
                          {/* # + reorder + expand */}
                          <div className="flex items-center justify-center gap-0.5 text-slate-500" onClick={(e) => e.stopPropagation()}>
                            <span className="text-[8px]">{idx + 1}</span>
                            <button
                              onClick={() => moveLine(idx, 'up')}
                              disabled={idx === 0}
                              title="Move up"
                              className={cn("h-3 w-3 rounded hover:bg-slate-200 flex items-center justify-center", idx === 0 && "opacity-30 cursor-not-allowed")}
                            >
                              <ChevronUp className="h-2 w-2" />
                            </button>
                            <button
                              onClick={() => moveLine(idx, 'down')}
                              disabled={idx === lines.length - 1}
                              title="Move down"
                              className={cn("h-3 w-3 rounded hover:bg-slate-200 flex items-center justify-center", idx === lines.length - 1 && "opacity-30 cursor-not-allowed")}
                            >
                              <ChevronDown className="h-2 w-2" />
                            </button>
                            <button
                              onClick={() => setExpandedLine(isExpanded ? null : line.id)}
                              title={isExpanded ? "Hide details (batch, free qty, prices)" : "Show details (batch, free qty, prices)"}
                              className="h-3 w-3 rounded hover:bg-slate-200 flex items-center justify-center"
                            >
                              <Hash className="h-2 w-2" />
                            </button>
                          </div>
                          <div className="font-mono truncate">{line.partNo}</div>
                          <div className="truncate">{line.details}</div>
                          {/* Qty */}
                          <div className="text-right">
                            <input type="number" value={line.quantity}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => updateLine(idx, 'quantity', parseFloat(e.target.value) || 0)}
                              className="w-full text-right font-mono bg-transparent border-b border-transparent hover:border-slate-300 focus:border-green-400 outline-none" />
                          </div>
                          {/* Cost */}
                          <div className="text-right">
                            <input type="number" step="0.01" value={line.cost}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => updateLine(idx, 'cost', parseFloat(e.target.value) || 0)}
                              className="w-full text-right font-mono bg-transparent border-b border-transparent hover:border-slate-300 focus:border-green-400 outline-none" />
                          </div>
                          {/* Phase 2: Discount (type + value) */}
                          <div className="text-right flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                            <select
                              value={line.discountType || ""}
                              onChange={(e) => updateLine(idx, 'discountType', (e.target.value || null) as any)}
                              className="text-[8px] px-0.5 h-4 rounded border border-slate-200 bg-white"
                              title="Discount type"
                            >
                              <option value="">—</option>
                              <option value="amount">₵</option>
                              <option value="percent">%</option>
                            </select>
                            <input
                              type="number" step="0.01" value={line.discountValue || 0}
                              onChange={(e) => updateLine(idx, 'discountValue', parseFloat(e.target.value) || 0)}
                              disabled={!line.discountType}
                              className="w-10 text-right font-mono bg-transparent border-b border-transparent hover:border-slate-300 focus:border-green-400 outline-none disabled:opacity-40"
                            />
                          </div>
                          {/* Phase 2: Tax rate (replaces simple checkbox) */}
                          <div className="text-right" onClick={(e) => e.stopPropagation()} title="Tax rate (0.15 = 15%)">
                            <input
                              type="number" step="0.005" min="0" max="1" value={effectiveTaxRate}
                              onChange={(e) => updateLine(idx, 'taxRate', parseFloat(e.target.value) || 0)}
                              className="w-full text-right font-mono bg-transparent border-b border-transparent hover:border-slate-300 focus:border-green-400 outline-none"
                            />
                          </div>
                          {/* Expiry */}
                          <div className="text-center text-slate-600">
                            <input
                              type="date"
                              value={line.expiry}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => updateLine(idx, 'expiry', e.target.value)}
                              className="w-full text-[8px] bg-transparent border-b border-transparent hover:border-slate-300 focus:border-green-400 outline-none"
                            />
                          </div>
                          {/* Total */}
                          <div className="text-right font-mono font-semibold">
                            {lineTotal.toFixed(2)}
                            {lineDiscount > 0 && (
                              <div className="text-[7px] text-emerald-600">−{lineDiscount.toFixed(2)}</div>
                            )}
                          </div>
                        </div>
                        {/* Phase 2: Expandable details row (batch, free qty, prices) */}
                        {isExpanded && (
                          <div className="px-2 py-1.5 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 grid grid-cols-6 gap-2 text-[9px]">
                            <div>
                              <label className="text-[8px] font-bold text-slate-500 uppercase block">Batch No</label>
                              <input
                                value={line.batchNumber || ""}
                                onChange={(e) => updateLine(idx, 'batchNumber', e.target.value)}
                                className="w-full h-5 px-1 text-[9px] border border-slate-200 rounded bg-white"
                                placeholder="B-001"
                              />
                            </div>
                            <div>
                              <label className="text-[8px] font-bold text-slate-500 uppercase block">Free Qty</label>
                              <input
                                type="number" min="0" value={line.freeQuantity || 0}
                                onChange={(e) => updateLine(idx, 'freeQuantity', parseInt(e.target.value) || 0)}
                                className="w-full h-5 px-1 text-[9px] font-mono border border-slate-200 rounded bg-white"
                                title="Free goods (e.g. buy 10 get 1 free → enter 1)"
                              />
                            </div>
                            <div>
                              <label className="text-[8px] font-bold text-slate-500 uppercase block">Retail ₵</label>
                              <input
                                type="number" step="0.01" value={line.retailPrice || 0}
                                onChange={(e) => updateLine(idx, 'retailPrice', parseFloat(e.target.value) || 0)}
                                className="w-full h-5 px-1 text-[9px] font-mono border border-slate-200 rounded bg-white"
                              />
                            </div>
                            <div>
                              <label className="text-[8px] font-bold text-slate-500 uppercase block">Trade ₵</label>
                              <input
                                type="number" step="0.01" value={line.tradePrice || 0}
                                onChange={(e) => updateLine(idx, 'tradePrice', parseFloat(e.target.value) || 0)}
                                className="w-full h-5 px-1 text-[9px] font-mono border border-slate-200 rounded bg-white"
                              />
                            </div>
                            <div>
                              <label className="text-[8px] font-bold text-slate-500 uppercase block">Wholesale ₵</label>
                              <input
                                type="number" step="0.01" value={line.wholesalePrice || 0}
                                onChange={(e) => updateLine(idx, 'wholesalePrice', parseFloat(e.target.value) || 0)}
                                className="w-full h-5 px-1 text-[9px] font-mono border border-slate-200 rounded bg-white"
                              />
                            </div>
                            <div className="flex items-end">
                              <div className="text-[8px] text-slate-500">
                                <div>Gross: <span className="font-mono font-bold">{lineGross.toFixed(2)}</span></div>
                                <div>Net: <span className="font-mono font-bold text-emerald-600">{lineNet.toFixed(2)}</span></div>
                                <div>Tax: <span className="font-mono font-bold">{lineTax.toFixed(2)}</span></div>
                              </div>
                            </div>
                          </div>
                        )}
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
                    className="w-full min-w-[120px] flex-1 h-6 px-1.5 text-[9px] font-mono border border-slate-400 rounded outline-none focus:ring-1 focus:ring-green-400"
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
              <div className="text-right"><label className="text-[8px] font-bold text-slate-600 block">Disc ₵</label><input value={totals.totalDiscount.toFixed(2)} readOnly className="w-14 h-5 px-1 text-[9px] font-mono border border-slate-300 rounded bg-emerald-50 outline-none text-right text-emerald-700" /></div>
              <div className="text-right" title={`VAT 15%: ₵${taxBreakdown.components.find(c=>c.name==='VAT')?.amount.toFixed(2) || '0.00'}\nNHIL 2.5%: ₵${taxBreakdown.components.find(c=>c.name==='NHIL')?.amount.toFixed(2) || '0.00'}\nGETFL 2.5%: ₵${taxBreakdown.components.find(c=>c.name==='GETFL')?.amount.toFixed(2) || '0.00'}`}>
                <label className="text-[8px] font-bold text-slate-600 block">Tax ₵</label>
                <input value={totals.totalTax.toFixed(2)} readOnly className="w-14 h-5 px-1 text-[9px] font-mono border border-slate-300 rounded bg-white outline-none text-right" />
              </div>
              <div className="text-right"><label className="text-[8px] font-bold text-slate-600 block">Landed ₵</label><input value={totals.landedCosts.toFixed(2)} readOnly className="w-14 h-5 px-1 text-[9px] font-mono border border-slate-300 rounded bg-white outline-none text-right" /></div>
              <div className="text-right"><label className="text-[8px] font-bold text-slate-600 block">Total</label><input value={totals.grandTotal.toFixed(2)} readOnly className="w-16 h-5 px-1 text-[9px] font-mono font-bold border border-slate-400 rounded outline-none text-right" style={{ backgroundColor: '#E6F0FF' }} /></div>
              <div className="text-right"><label className="text-[8px] font-bold text-slate-600 block">Paid ₵</label><input type="number" value={paidAmount || ''} onChange={(e) => setPaidAmount(parseFloat(e.target.value) || 0)} className="w-16 h-5 px-1 text-[9px] font-mono border border-slate-400 rounded bg-white outline-none text-right" placeholder="0.00" /></div>
              <div className="text-right"><label className="text-[8px] font-bold text-slate-600 block">Due ₵</label><input value={totals.due.toFixed(2)} readOnly className={cn("w-16 h-5 px-1 text-[9px] font-mono font-bold border border-slate-400 rounded outline-none text-right", totals.due > 0 ? "text-rose-600" : "text-emerald-600")} style={{ backgroundColor: '#FFF8E1' }} /></div>
            </div>
          </div>

          {/* Phase 2: Currency + landed costs row */}
          <div className="flex-shrink-0 px-3 py-1 bg-slate-50 border-t border-slate-200 flex items-center gap-2 flex-wrap text-[9px]">
            <div className="flex items-center gap-1">
              <label className="text-[8px] font-bold text-slate-600">Currency:</label>
              <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="h-5 px-1 text-[9px] border border-slate-300 rounded bg-white">
                <option value="GHS">GHS</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
                <option value="CNY">CNY</option>
              </select>
            </div>
            {currency !== "GHS" && (
              <div className="flex items-center gap-1">
                <label className="text-[8px] font-bold text-slate-600">FX Rate:</label>
                <input type="number" step="0.0001" min="0" value={exchangeRate} onChange={(e) => setExchangeRate(parseFloat(e.target.value) || 1)} className="w-16 h-5 px-1 text-[9px] font-mono border border-slate-300 rounded bg-white" />
              </div>
            )}
            <div className="flex items-center gap-1">
              <label className="text-[8px] font-bold text-slate-600">Freight ₵:</label>
              <input type="number" step="0.01" min="0" value={freightCost} onChange={(e) => setFreightCost(parseFloat(e.target.value) || 0)} className="w-14 h-5 px-1 text-[9px] font-mono border border-slate-300 rounded bg-white" />
            </div>
            <div className="flex items-center gap-1">
              <label className="text-[8px] font-bold text-slate-600">Insurance ₵:</label>
              <input type="number" step="0.01" min="0" value={insuranceCost} onChange={(e) => setInsuranceCost(parseFloat(e.target.value) || 0)} className="w-14 h-5 px-1 text-[9px] font-mono border border-slate-300 rounded bg-white" />
            </div>
            <div className="flex items-center gap-1">
              <label className="text-[8px] font-bold text-slate-600">Customs ₵:</label>
              <input type="number" step="0.01" min="0" value={customsDuty} onChange={(e) => setCustomsDuty(parseFloat(e.target.value) || 0)} className="w-14 h-5 px-1 text-[9px] font-mono border border-slate-300 rounded bg-white" />
            </div>
            <div className="flex items-center gap-1">
              <label className="text-[8px] font-bold text-slate-600">Other ₵:</label>
              <input type="number" step="0.01" min="0" value={otherLandedCosts} onChange={(e) => setOtherLandedCosts(parseFloat(e.target.value) || 0)} className="w-14 h-5 px-1 text-[9px] font-mono border border-slate-300 rounded bg-white" />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex-shrink-0 px-3 py-1.5 flex items-center gap-1.5 border-t border-slate-300 flex-wrap" style={{ backgroundColor: '#F0F0F0' }}>
            <button onClick={handleSave} className="h-7 px-3 rounded text-white text-[9px] font-semibold flex items-center gap-1 transition shadow-sm" style={{ backgroundColor: GREEN }}> <Save className="h-3 w-3" /> Save <kbd className="text-[7px] bg-white/20 px-0.5 rounded">F2</kbd></button>
            <button onClick={handlePrint} className="h-7 px-3 rounded text-white text-[9px] font-semibold flex items-center gap-1 transition shadow-sm" style={{ backgroundColor: GREEN }}> <Printer className="h-3 w-3" /> Print <kbd className="text-[7px] bg-white/20 px-0.5 rounded">F3</kbd></button>
            <button onClick={handleEmail} disabled={!savedPurchaseId} title={!savedPurchaseId ? "Save the purchase first to enable email" : "Email this purchase order to the supplier"} className={cn("h-7 px-3 rounded text-white text-[9px] font-semibold flex items-center gap-1 transition shadow-sm", !savedPurchaseId && "opacity-40 cursor-not-allowed")} style={{ backgroundColor: GREEN }}> <Mail className="h-3 w-3" /> Email</button>
            <button onClick={handleDelete} className="h-7 px-3 rounded text-white text-[9px] font-semibold flex items-center gap-1 transition shadow-sm" style={{ backgroundColor: GREEN }}> <Trash2 className="h-3 w-3" /> Delete <kbd className="text-[7px] bg-white/20 px-0.5 rounded">F4</kbd></button>
            <button onClick={handlePayment} disabled={!savedPurchaseId} title={!savedPurchaseId ? "Save the purchase first to enable payment" : "Record a supplier payment"} className={cn("h-7 px-3 rounded text-white text-[9px] font-semibold flex items-center gap-1 transition shadow-sm", !savedPurchaseId && "opacity-40 cursor-not-allowed")} style={{ backgroundColor: GREEN }}> <CreditCard className="h-3 w-3" /> Payment <kbd className="text-[7px] bg-white/20 px-0.5 rounded">F5</kbd></button>
            {/* Phase 1: Receive (GRN) button */}
            <button
              onClick={() => setShowReceiveDialog(true)}
              disabled={!savedPurchaseId}
              title={!savedPurchaseId ? "Save the purchase first to receive goods" : "Mark goods as received (GRN)"}
              className={cn("h-7 px-3 rounded text-white text-[9px] font-semibold flex items-center gap-1 transition shadow-sm", !savedPurchaseId && "opacity-40 cursor-not-allowed")}
              style={{ backgroundColor: '#3B82F6' }}
            > <PackageCheck className="h-3 w-3" /> Receive</button>
            {/* Phase 1: Attachments button */}
            <button
              onClick={() => setShowAttachmentsDialog(true)}
              disabled={!savedPurchaseId}
              title={!savedPurchaseId ? "Save the purchase first to attach files" : "Upload invoices, delivery notes, customs forms"}
              className={cn("h-7 px-3 rounded text-white text-[9px] font-semibold flex items-center gap-1 transition shadow-sm", !savedPurchaseId && "opacity-40 cursor-not-allowed")}
              style={{ backgroundColor: '#64748B' }}
            > <Paperclip className="h-3 w-3" /> Attach</button>
            {/* Phase 1: Approve button */}
            <button
              onClick={() => setShowApproveDialog(true)}
              disabled={!savedPurchaseId}
              title={!savedPurchaseId ? "Save the purchase first to approve" : "Manager approval"}
              className={cn("h-7 px-3 rounded text-white text-[9px] font-semibold flex items-center gap-1 transition shadow-sm", !savedPurchaseId && "opacity-40 cursor-not-allowed")}
              style={{ backgroundColor: '#F59E0B' }}
            > <Shield className="h-3 w-3" /> Approve</button>
            {/* Phase 1: Keyboard shortcuts overlay button */}
            <button
              onClick={() => setShowShortcutsOverlay(true)}
              title="Show keyboard shortcuts (or press ?)"
              className="h-7 px-2 rounded text-white text-[9px] font-semibold flex items-center gap-1 transition shadow-sm"
              style={{ backgroundColor: '#1E293B' }}
            > <Keyboard className="h-3 w-3" /> <kbd className="text-[7px] bg-white/20 px-0.5 rounded">?</kbd></button>
            {/* Phase 1: Status badge */}
            {savedPurchaseId && (
              <Badge className={cn(
                "ml-1 text-[9px] uppercase border-transparent",
                purchaseStatus === 'received' && "bg-emerald-500 text-white",
                purchaseStatus === 'cancelled' && "bg-rose-500 text-white",
                purchaseStatus === 'ordered' && "bg-indigo-500 text-white",
                purchaseStatus === 'draft' && "bg-slate-400 text-white",
              )}>
                {purchaseStatus}
              </Badge>
            )}
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
            <StockListMiniPopup
              products={(() => {
                // If supplier has a catalog, show catalog items first with supplier's cost
                if (supplierCatalog.length > 0) {
                  const catalogProductIds = new Set(supplierCatalog.map((c: any) => c.productId));
                  const catalogProducts = supplierCatalog.map((c: any) => ({
                    ...c.product,
                    costPrice: c.supplierCost,
                    sku: c.supplierSku || c.product.sku,
                  } as Product));
                  const otherProducts = products.filter(p => !catalogProductIds.has(p.id));
                  return [...catalogProducts, ...otherProducts];
                }
                return products;
              })()}
              searchText={findPartNo}
              onSelect={addProductToLine}
              onClose={() => setShowStockList(false)}
            />
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

      {/* ===== Premium Email Dialog ===== */}
      <PurchaseEmailDialog
        open={showEmailDialog}
        onOpenChange={setShowEmailDialog}
        purchaseId={savedPurchaseId}
        refNo={savedRefNo || invoiceNo}
        supplierName={supplier}
        supplierEmail={suppliers.find(s => s.name === supplier)?.email}
        totalAmount={totals.grandTotal}
      />

      {/* ===== Premium Payment Dialog ===== */}
      <PurchasePaymentDialog
        open={showPaymentDialog}
        onOpenChange={setShowPaymentDialog}
        purchaseId={savedPurchaseId}
        refNo={savedRefNo || invoiceNo}
        supplierId={suppliers.find(s => s.name === supplier)?.id}
        supplierName={supplier}
        totalAmount={totals.grandTotal}
        paidAmount={paidAmount}
        onPaid={handlePaymentSuccess}
      />

      {/* Phase 1: Receive (GRN) Dialog */}
      <PurchaseReceiveDialog
        open={showReceiveDialog}
        onOpenChange={setShowReceiveDialog}
        purchaseId={savedPurchaseId}
        refNo={savedRefNo || invoiceNo}
        supplierName={supplier}
        items={lines.map(l => ({
          id: l.id,
          partNo: l.partNo,
          details: l.details,
          emoji: l.emoji,
          quantity: l.quantity,
          cost: l.cost,
          receivedQty: 0,
        }))}
        onReceived={handleReceived}
      />

      {/* Phase 1: Attachments Dialog */}
      <PurchaseAttachmentsDialog
        open={showAttachmentsDialog}
        onOpenChange={setShowAttachmentsDialog}
        purchaseId={savedPurchaseId}
        refNo={savedRefNo || invoiceNo}
      />

      {/* Phase 1: Approve Dialog (manager approval) */}
      <ManagerApproval
        open={showApproveDialog}
        title="Approve Purchase Order"
        description={`Authorize ${savedRefNo || invoiceNo} for ${supplier} — total ${formatGHS(totals.grandTotal)}`}
        action="discount"
        amount={totals.grandTotal}
        onApproved={handleApproved}
        onClose={() => setShowApproveDialog(false)}
      />

      {/* Phase 1: Keyboard Shortcuts Overlay (toggle with ?) */}
      {showShortcutsOverlay && <KeyboardShortcutsOverlay />}
    </div>
  );
}

// ===== Mini Stock List Popup =====
// Redesigned to match ezi-solution reference: teal frame, dark green filter
// headers, 5-column grid (Part no / Details / Qty / Retail / Cost), 7 action
// buttons (Select/New/Picture/History/Labels/Qty/Close).
function StockListMiniPopup({ products, searchText, onSelect, onClose }: {
  products: Product[]; searchText: string; onSelect: (product: Product) => void; onClose: () => void;
}) {
  const { toast } = useToast();
  const [query, setQuery] = useState(searchText);
  const [typeFilter, setTypeFilter] = useState("");
  const [groupFilter, setGroupFilter] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { const t = setTimeout(() => inputRef.current?.focus(), 50); return () => clearTimeout(t); }, []);

  const filtered = useMemo(() => {
    const q = (query || searchText).toLowerCase().trim();
    let result = products;
    if (q) {
      result = result.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.barcode || '').toLowerCase().includes(q)
      );
    }
    if (typeFilter) {
      result = result.filter(p => (p.category || '').toLowerCase() === typeFilter.toLowerCase());
    }
    return [...result].sort((a, b) => a.name.localeCompare(b.name));
  }, [products, query, searchText, typeFilter, groupFilter]);

  const categories = useMemo(() => {
    const set = new Set(products.map(p => p.category || '').filter(Boolean));
    return Array.from(set).sort();
  }, [products]);

  const handleSelect = () => {
    const product = filtered[selectedIndex];
    if (!product) { toast({ title: 'No product selected', variant: 'destructive' }); return; }
    onSelect(product);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); handleSelect(); }
    if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex(i => Math.min(filtered.length - 1, i + 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex(i => Math.max(0, i - 1)); }
  };

  const IconButton = ({ icon, label, color, onClick, disabled, shortcut }: any) => (
    <button
      onClick={onClick}
      disabled={disabled}
      title={shortcut ? `${label} (${shortcut})` : label}
      className="flex flex-col items-center gap-0.5 p-1.5 rounded hover:bg-slate-100 transition disabled:opacity-40 disabled:cursor-not-allowed"
    >
      <div className="h-8 w-8 rounded border border-slate-300 bg-white flex items-center justify-center shadow-sm">
        {icon}
      </div>
      <span className="text-[8px] font-semibold text-slate-700 whitespace-nowrap">{label}</span>
    </button>
  );

  const selectedProduct = filtered[selectedIndex];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/40 flex items-start justify-center pt-4 sm:pt-10 z-50 p-4" onClick={onClose}>
      <motion.div
        initial={{ scale: 0.95, y: -20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: -20 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
        className="rounded-lg shadow-2xl overflow-hidden flex flex-col w-full"
        style={{ width: '100%', maxWidth: '900px', maxHeight: '90vh', backgroundColor: '#669999', fontFamily: 'Tahoma, Arial, Helvetica, sans-serif' }}
      >
        {/* ===== Header — "Stock List" title ===== */}
        <div className="px-3 pt-2 pb-1.5">
          <h2 className="text-base font-bold text-black">Stock List</h2>
        </div>

        {/* ===== Search & Filter Panel ===== */}
        <div className="mx-3 mb-2 bg-white border border-slate-400">
          <div className="grid grid-cols-[70px_1fr_70px_60px_140px] gap-1 p-1.5 items-center">
            <div className="px-1.5 py-0.5 text-[10px] font-bold text-white text-center" style={{ backgroundColor: '#2E5D4B' }}>Details</div>
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0); }}
              onKeyDown={handleKeyDown}
              placeholder="Type to search by name, SKU, or barcode..."
              className="h-6 px-2 text-[10px] border border-slate-500 rounded bg-white outline-none focus:ring-1 focus:ring-blue-500"
              style={{ boxShadow: 'inset 1px 1px 2px rgba(0,0,0,0.1)' }}
            />
            <button
              onClick={() => { setSelectedIndex(0); }}
              className="h-6 text-[10px] font-bold text-black rounded border border-slate-500 hover:bg-slate-200 transition"
              style={{ backgroundColor: '#E8E8E8' }}
            >
              Search
            </button>
            <div className="px-1.5 py-0.5 text-[10px] font-bold text-white text-center" style={{ backgroundColor: '#2E5D4B' }}>Type</div>
            <select
              value={typeFilter}
              onChange={(e) => { setTypeFilter(e.target.value); setSelectedIndex(0); }}
              className="h-6 px-1 text-[10px] border border-slate-500 rounded bg-white outline-none"
            >
              <option value="">All Types</option>
              {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-[70px_140px_70px_140px_70px_140px] gap-1 px-1.5 pb-1.5 items-center">
            <div className="px-1.5 py-0.5 text-[10px] font-bold text-white text-center" style={{ backgroundColor: '#2E5D4B' }}>Stock Group</div>
            <select className="h-6 px-1 text-[10px] border border-slate-500 rounded bg-white outline-none"><option value="">All Groups</option></select>
            <div className="px-1.5 py-0.5 text-[10px] font-bold text-white text-center" style={{ backgroundColor: '#2E5D4B' }}>Group1</div>
            <select className="h-6 px-1 text-[10px] border border-slate-500 rounded bg-white outline-none"><option value="">All</option></select>
            <div className="px-1.5 py-0.5 text-[10px] font-bold text-white text-center" style={{ backgroundColor: '#2E5D4B' }}>Group2</div>
            <select className="h-6 px-1 text-[10px] border border-slate-500 rounded bg-white outline-none"><option value="">All</option></select>
          </div>
        </div>

        {/* ===== Data Grid ===== */}
        <div className="mx-3 mb-2 flex-1 overflow-hidden flex flex-col min-h-0 bg-white border border-slate-400">
          <div
            className="flex-shrink-0 grid gap-0 px-1 py-1 text-[10px] font-bold text-black border-b border-slate-400"
            style={{ backgroundColor: '#E8E8E8', gridTemplateColumns: '24px 130px 1fr 70px 90px 90px' }}
          >
            <div></div>
            <div className="px-1">Part no.</div>
            <div className="px-1">Details</div>
            <div className="px-1 text-right">Qty</div>
            <div className="px-1 text-right">Retail</div>
            <div className="px-1 text-right">Cost</div>
          </div>

          <ScrollArea className="flex-1 min-h-0">
            <div>
              {filtered.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-xs">
                  <Package className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  No products found{query ? ` for "${query}"` : ''}
                </div>
              ) : (
                filtered.map((p, idx) => {
                  const isSelected = idx === selectedIndex;
                  const bg = isSelected ? '#CCE8FF' : '#FFFFFF';
                  return (
                    <div
                      key={p.id}
                      onClick={() => setSelectedIndex(idx)}
                      onDoubleClick={() => onSelect(p)}
                      className="grid gap-0 px-1 py-0.5 text-[10px] cursor-pointer border-b"
                      style={{ backgroundColor: bg, gridTemplateColumns: '24px 130px 1fr 70px 90px 90px', borderBottomColor: '#D4D4D4' }}
                    >
                      <div className="px-0.5 flex items-center justify-center">
                        {isSelected && <span className="text-black text-[12px] leading-none">▶</span>}
                      </div>
                      <div className="px-1 font-mono text-slate-700 truncate">{p.sku || p.barcode}</div>
                      <div className="px-1 truncate text-slate-900">{p.emoji} {p.name}</div>
                      <div className="px-1 text-right font-mono text-slate-700">{Number(p.stock || p.quantity || 0).toFixed(3)}</div>
                      <div className="px-1 text-right font-mono text-slate-700">{Number(p.price || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                      <div className="px-1 text-right font-mono text-slate-700">{Number(p.costPrice || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </div>

        {/* ===== Status Bar ===== */}
        <div className="mx-3 mb-1 px-2 py-0.5 text-[10px] text-black flex items-center justify-between" style={{ backgroundColor: '#E8E8E8', border: '1px solid #808080' }}>
          <span className="font-mono font-semibold">{filtered.length} of {products.length} products</span>
          <span className="font-mono">Total Qty: {filtered.reduce((s, p) => s + Number(p.stock || p.quantity || 0), 0).toFixed(3)}</span>
        </div>

        {/* ===== Action Toolbar — 7 icon buttons ===== */}
        <div className="mx-3 mb-2 px-2 py-2 flex items-center gap-1 bg-white border border-slate-300 overflow-x-auto">
          <IconButton label="Select" shortcut="Enter" color="#28A745" onClick={handleSelect} disabled={!selectedProduct} icon={<Check className="h-5 w-5" style={{ color: '#28A745' }} />} />
          <IconButton label="New" color="#0066CC" onClick={() => toast({ title: "New Product", description: "Use Stock File to add new products" })} icon={<Plus className="h-5 w-5 text-blue-600" />} />
          <IconButton label="Picture" color="#666" onClick={() => selectedProduct ? toast({ title: "Picture", description: `View image for ${selectedProduct.name}` }) : toast({ title: "Select a product first", variant: "destructive" })} disabled={!selectedProduct} icon={<ImageIcon className="h-5 w-5 text-slate-500" />} />
          <IconButton label="History" color="#0066CC" onClick={() => selectedProduct ? toast({ title: "History", description: `Stock history for ${selectedProduct.name}` }) : toast({ title: "Select a product first", variant: "destructive" })} disabled={!selectedProduct} icon={<Hash className="h-5 w-5 text-blue-600" />} />
          <IconButton label="Labels" color="#0066CC" onClick={() => toast({ title: "Labels", description: "Print price labels for selected product" })} disabled={!selectedProduct} icon={<Tag className="h-5 w-5 text-blue-600" />} />
          <IconButton label="Qty" color="#0066CC" onClick={() => selectedProduct ? toast({ title: "Qty", description: `${selectedProduct.name}: ${selectedProduct.stock || selectedProduct.quantity || 0} on hand` }) : toast({ title: "Select a product first", variant: "destructive" })} disabled={!selectedProduct} icon={<Hash className="h-5 w-5 text-blue-600" />} />
          <div className="flex-1" />
          <IconButton label="Close" shortcut="Esc" color="#DC3545" onClick={onClose} icon={<X className="h-5 w-5 text-red-600" />} />
        </div>
      </motion.div>
    </motion.div>
  );
}

