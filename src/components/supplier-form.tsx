"use client";

import { authedFetch } from "@/lib/client-auth";
import { useState, useMemo, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Save, Printer, Mail, Trash2, CreditCard, X, Search,
  Plus, Check, Package, Calendar, User, Hash, FileText, Edit2, StickyNote,
  Image as ImageIcon, Tag, TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useSession } from "@/hooks/use-session";
import { getCachedUser } from "@/lib/session-data";
import { cn } from "@/lib/utils";
import { COMPANY, CURRENCY, formatGHS, type Product } from "@/lib/pos-data";
import { PopupWindow } from "@/components/popup-window";
import { SupplierEmailDialog } from "@/components/supplier-email-dialog";
import { SupplierCatalogDialog } from "@/components/supplier-catalog-dialog";
import { SupplierNotesDialog } from "@/components/supplier-notes-dialog";
import { SupplierHistoryDialog } from "@/components/supplier-history-dialog";
import { SupplierPriceHistoryDialog } from "@/components/supplier-price-history-dialog";
import { SupplierBulkEditDialog } from "@/components/supplier-bulk-edit-dialog";
import { PurchasePaymentDialog } from "@/components/purchase-payment-dialog";

// Supplier interface — exported so other components (e.g. PurchaseForm) can use real supplier data
export interface Supplier {
  id: string;
  code: string;
  name: string;
  address: string;
  city: string;
  state: string;
  country: string;
  phone: string;
  mobile: string;
  fax: string;
  email: string;
  contactName: string;
  businessNo: string;
  title: string;
  tradingTerms: string;
  creditLimit: number;
  balance: number;
  taxInclusive: boolean;
  notes: string;
  // Tier 1.6 — rating + blacklist
  rating?: number;            // 0-5 stars (0 = unrated)
  blacklist?: boolean;
  blacklistReason?: string;
  // Tier 1.10 — TIN (Ghana Taxpayer Identification Number)
  tin?: string;
  // Tier 1.15 — bank details
  bankName?: string;
  bankAccountName?: string;
  bankAccountNo?: string;
  bankBranchCode?: string;
  mobileMoneyProvider?: string;   // MTN | Telecel | AirtelTigo
  mobileMoneyNumber?: string;
  // Tier 1.8 — structured early-payment discount terms
  earlyPayDiscountPct?: number;   // e.g. 2 = 2%
  earlyPayDays?: number;          // pay within this many days to get the discount
  netDays?: number;               // full payment due within this many days
}

// Sample suppliers — exported so page.tsx can pass real supplier data to PurchaseForm
// Default suppliers removed — all suppliers are now loaded from the API.
// This ensures only real suppliers from the database appear in the forms.
export const initialSuppliers: Supplier[] = [];

// Purchase line item
interface PurchaseLine {
  id: string;
  partNo: string;
  details: string;
  emoji: string;
  quantity: number;
  cost: number;
  discount: number;
  expiry: string;
  tax: boolean;
  total: number;
}

interface SupplierFormProps {
  onBack: () => void;
  products: Product[];
}

const BLUE = "#0078D7";

export function SupplierForm({ onBack, products }: SupplierFormProps) {
  const { toast } = useToast();
  const { user: sessionUser } = useSession();
  // Only admins + managers can edit or delete supplier records.
  // Fallback to getCachedUser() (reads localStorage directly) in case
  // useSession hasn't loaded yet (timing issue with lazy-loaded components).
  const effectiveUser = sessionUser || getCachedUser();
  const canEditSupplier = effectiveUser?.role === "admin" || effectiveUser?.role === "manager";
  // Premium fix: start with bundled initialSuppliers for instant render,
  // then fetch from /api/suppliers on mount and replace the list.
  const [suppliers, setSuppliers] = useState<Supplier[]>(initialSuppliers);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [supplierDetails, setSupplierDetails] = useState("");
  const [showSupplierList, setShowSupplierList] = useState(false);
  const [showNewSupplier, setShowNewSupplier] = useState(false);

  // Premium fix: fetch suppliers from /api/suppliers on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await authedFetch('/api/suppliers');
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        const serverSuppliers: Supplier[] = (data.suppliers || []).map((s: any) => ({
          id: s.id,
          code: s.code,
          name: s.name,
          contactName: s.contactName || '',
          phone: s.phone || '',
          mobile: s.mobile || '',
          email: s.email || '',
          fax: s.fax || '',
          address: s.address || '',
          city: s.city || '',
          state: s.state || '',
          country: s.country || 'Ghana',
          businessNo: s.businessNo || '',
          tradingTerms: s.tradingTerms || 'Net 30',
          creditLimit: s.creditLimit || 0,
          balance: s.balance || 0,
          taxInclusive: s.taxInclusive || false,
          notes: s.notes || '',
          // Tier 1 fields
          rating: s.rating ?? 0,
          blacklist: s.blacklist ?? false,
          blacklistReason: s.blacklistReason || '',
          tin: s.tin || '',
          bankName: s.bankName || '',
          bankAccountName: s.bankAccountName || '',
          bankAccountNo: s.bankAccountNo || '',
          bankBranchCode: s.bankBranchCode || '',
          mobileMoneyProvider: s.mobileMoneyProvider || '',
          mobileMoneyNumber: s.mobileMoneyNumber || '',
          earlyPayDiscountPct: s.earlyPayDiscountPct ?? 0,
          earlyPayDays: s.earlyPayDays ?? 0,
          netDays: s.netDays ?? 30,
        }));
        if (serverSuppliers.length > 0) {
          setSuppliers(serverSuppliers);
        }
      } catch (e: any) {
        console.warn('Failed to fetch suppliers from server:', e);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Form fields
  const [invoiceNo, setInvoiceNo] = useState(`PUR-${Date.now().toString().slice(-6)}`);
  const [docType, setDocType] = useState("Purchase");
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [refNo, setRefNo] = useState("");
  const [terms, setTerms] = useState("Net 30");
  const [salesperson, setSalesperson] = useState("Sarah Johnson");
  const [taxInclusive, setTaxInclusive] = useState(false);
  const [lines, setLines] = useState<PurchaseLine[]>([]);
  const [selectedLine, setSelectedLine] = useState<number | null>(null);
  const [findPartNo, setFindPartNo] = useState("");
  const [onHand, setOnHand] = useState(0);
  const [paidAmount, setPaidAmount] = useState(0);
  const [showStockList, setShowStockList] = useState(false);
  const [saved, setSaved] = useState(false);
  // Track saved purchase ID + refNo so Email/Delete/Payment actually work
  const [savedPurchaseId, setSavedPurchaseId] = useState<string | null>(null);
  const [savedRefNo, setSavedRefNo] = useState<string>("");
  // Premium dialog open states
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [showCatalogDialog, setShowCatalogDialog] = useState(false);
  const [showNotesDialog, setShowNotesDialog] = useState(false);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  // Tier 2 #14 — Price History dialog
  const [showPriceHistoryDialog, setShowPriceHistoryDialog] = useState(false);
  // Bulk Edit dialog — apply rating/blacklist/TIN/etc. to many suppliers at once
  const [showBulkEditDialog, setShowBulkEditDialog] = useState(false);
  // Edit-supplier mode: when set, NewSupplierPopup opens pre-filled with this supplier's data
  const [editSupplier, setEditSupplier] = useState<Supplier | null>(null);
  // Supplier's catalog (loaded when a supplier is selected) — drives the "Find Part no" search
  const [supplierCatalog, setSupplierCatalog] = useState<any[]>([]);

  const totals = useMemo(() => {
    const totalQty = lines.reduce((s, l) => s + l.quantity, 0);
    const totalCost = lines.reduce((s, l) => s + l.total, 0);
    const taxAmount = lines.filter(l => l.tax).reduce((s, l) => s + l.total * 0.15, 0);
    const grandTotal = taxInclusive ? totalCost : totalCost + taxAmount;
    const due = grandTotal - paidAmount;
    return { totalQty, totalCost, taxAmount, grandTotal, due };
  }, [lines, taxInclusive, paidAmount]);

  // Handle typing in Supplier Details field
  const handleSupplierDetails = (value: string) => {
    setSupplierDetails(value);
    if (value.length > 0) {
      setShowSupplierList(true);
    } else {
      setShowSupplierList(false);
      setSelectedSupplier(null);
    }
  };

  // Select a supplier from the list
  const handleSelectSupplier = (supplier: Supplier) => {
    // Always close the popup first so the form is visible immediately,
    // even if setting state below throws for any reason.
    setShowSupplierList(false);
    setSelectedSupplier(supplier);
    setSupplierDetails(supplier.name);
    setTerms(supplier.tradingTerms);
    setTaxInclusive(supplier.taxInclusive);
    toast({ title: "Supplier selected", description: `${supplier.name} (${supplier.code})` });

    // Load this supplier's catalog so "Find Part no" searches the right products
    authedFetch(`/api/suppliers/${supplier.id}/products`)
      .then(r => r.json())
      .then(data => {
        if (data.catalog) {
          setSupplierCatalog(data.catalog);
          if (data.catalog.length > 0) {
            toast({
              title: "Catalog loaded",
              description: `${data.catalog.length} product(s) in ${supplier.name}'s catalog — search by part no to add them`,
            });
          }
        }
      })
      .catch(() => setSupplierCatalog([]));
  };

  // Add new supplier — Premium fix: persist to /api/suppliers
  const handleSaveNewSupplier = async (newSupplier: Supplier) => {
    // Always close the popups first.
    setShowNewSupplier(false);
    setShowSupplierList(false);
    setSuppliers(prev => [...prev, newSupplier]);
    setSelectedSupplier(newSupplier);
    setSupplierDetails(newSupplier.name);
    setTerms(newSupplier.tradingTerms);
    setTaxInclusive(newSupplier.taxInclusive);
    toast({ title: "New supplier added locally", description: `${newSupplier.name} (${newSupplier.code})` });

    // Persist to server (best-effort)
    try {
      const res = await authedFetch('/api/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: newSupplier.name,
          contactName: newSupplier.contactName || '',
          phone: newSupplier.phone || '',
          mobile: newSupplier.mobile || '',
          email: newSupplier.email || '',
          fax: newSupplier.fax || '',
          address: newSupplier.address || '',
          city: newSupplier.city || '',
          state: newSupplier.state || '',
          country: newSupplier.country || 'Ghana',
          businessNo: newSupplier.businessNo || '',
          tradingTerms: newSupplier.tradingTerms || 'Net 30',
          creditLimit: newSupplier.creditLimit || 0,
          taxInclusive: newSupplier.taxInclusive || false,
          notes: newSupplier.notes || '',
          // Tier 1 fields
          rating: newSupplier.rating ?? 0,
          blacklist: newSupplier.blacklist ?? false,
          blacklistReason: newSupplier.blacklistReason || '',
          tin: newSupplier.tin || '',
          bankName: newSupplier.bankName || '',
          bankAccountName: newSupplier.bankAccountName || '',
          bankAccountNo: newSupplier.bankAccountNo || '',
          bankBranchCode: newSupplier.bankBranchCode || '',
          mobileMoneyProvider: newSupplier.mobileMoneyProvider || '',
          mobileMoneyNumber: newSupplier.mobileMoneyNumber || '',
          earlyPayDiscountPct: newSupplier.earlyPayDiscountPct ?? 0,
          earlyPayDays: newSupplier.earlyPayDays ?? 0,
          netDays: newSupplier.netDays ?? 30,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success && data.supplier?.id) {
        // Replace the optimistic temp-id entry with the real server entry
        setSuppliers(prev => prev.map(s => s.id === newSupplier.id ? { ...newSupplier, id: data.supplier.id, code: data.supplier.code } : s));
        setSelectedSupplier({ ...newSupplier, id: data.supplier.id, code: data.supplier.code });
        toast({ title: "Supplier synced to server ✓", description: `${data.supplier.code} — ${data.supplier.name}` });
      } else {
        // Server sync failed — clear the selected supplier so the user can't
        // try to save a PO against a temp ID that the API will reject.
        setSelectedSupplier(null);
        setSupplierDetails("");
        toast({
          title: "Supplier sync failed — please try again",
          description: data.error || `HTTP ${res.status}`,
          variant: "destructive",
        });
      }
    } catch (e: any) {
      // Network error — same: clear the selected supplier
      setSelectedSupplier(null);
      setSupplierDetails("");
      toast({ title: "Supplier sync failed (network error)", description: e?.message || '', variant: "destructive" });
    }
  };

  // Add product to lines
  const addProductToLine = (product: Product) => {
    // If this product is in the supplier's catalog, prefer the supplier's cost
    const catalogEntry = supplierCatalog.find((c: any) => c.productId === product.id);
    const costToUse = catalogEntry ? catalogEntry.supplierCost : product.costPrice;

    const existingIdx = lines.findIndex(l => l.partNo === product.sku);
    if (existingIdx >= 0) {
      setLines(prev => prev.map((l, i) => i === existingIdx ? { ...l, quantity: l.quantity + 1, total: (l.quantity + 1) * l.cost * (1 - l.discount / 100) } : l));
    } else {
      setLines(prev => [...prev, { id: `line-${Date.now()}`, partNo: catalogEntry?.supplierSku || product.sku, details: `${product.emoji} ${product.name}`, emoji: product.emoji, quantity: 1, cost: costToUse, discount: 0, expiry: product.expiryDate, tax: product.taxable, total: costToUse, productId: product.id } as any]);
    }
    setFindPartNo("");
    setOnHand(0);
    toast({ title: "Product added", description: `${product.emoji} ${product.name}${catalogEntry ? ` · supplier cost ₵${catalogEntry.supplierCost.toFixed(2)}` : ""}` });
  };

  const updateLine = (idx: number, field: keyof PurchaseLine, value: any) => {
    setLines(prev => prev.map((l, i) => {
      if (i !== idx) return l;
      const updated = { ...l, [field]: value };
      if (field === 'quantity' || field === 'cost' || field === 'discount') {
        updated.total = updated.quantity * updated.cost * (1 - updated.discount / 100);
      }
      return updated;
    }));
  };

  const removeLine = (idx: number) => { setLines(prev => prev.filter((_, i) => i !== idx)); setSelectedLine(null); toast({ title: "Line removed" }); };

  // ===== Working Action Handlers =====
  // Save: persist the supplier PO to /api/purchases (so Email/Payment/Delete can operate on a real record)
  const handleSave = async () => {
    if (lines.length === 0) { toast({ title: "No items to save", variant: "destructive" }); return; }
    if (!selectedSupplier) { toast({ title: "Select a supplier first", variant: "destructive" }); return; }

    const payload = {
      refNo: invoiceNo,
      type: "purchase" as const,
      supplierId: selectedSupplier.id,
      supplierName: selectedSupplier.name,
      status: "received" as const,
      subtotal: totals.totalCost,
      taxAmount: totals.taxAmount,
      total: totals.grandTotal,
      amountPaid: paidAmount,
      notes: "",
      createdBy: salesperson || "system",  // FIX: zod PurchaseSchema requires createdBy (string)
      items: lines.map(l => ({
        productId: (l as any).productId || null,
        partNo: l.partNo,
        details: l.details,
        quantity: l.quantity,
        cost: l.cost,
        tax: l.tax,
        total: l.total,
        expiryDate: l.expiry || null,
      })),
    };

    try {
      const res = await authedFetch("/api/purchases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        const errMsg = data.code === "SUPPLIER_NOT_FOUND" || data.code === "FK_SUPPLIER"
          ? "Supplier not found. Please re-select the supplier."
          : data.error || `HTTP ${res.status}`;
        throw new Error(errMsg);
      }
      setSaved(true);
      if (data.purchase?.id) setSavedPurchaseId(data.purchase.id);
      if (data.purchase?.refNo) {
        setSavedRefNo(data.purchase.refNo);
      }
      toast({
        title: "Saved ✓ (F2)",
        description: `${data.purchase.refNo} · ${selectedSupplier.name} · ${lines.length} items · ${formatGHS(totals.grandTotal)}`,
      });
      // Reset the form to default for the next entry — but KEEP savedPurchaseId
      // + savedRefNo so Email/Payment/Print buttons still work on the just-saved PO.
      setTimeout(() => {
        setLines([]);
        setSelectedLine(null);
        setPaidAmount(0);
        setFindPartNo("");
        setOnHand(0);
        setInvoiceNo(`PUR-${Date.now().toString().slice(-6)}`);
        setRefNo("");
        setSaved(false);
        // Note: do NOT clear savedPurchaseId / savedRefNo / selectedSupplier —
        // the user may want to Email/Payment/Print the just-saved PO.
        toast({
          title: "Form reset",
          description: `Ready for next entry. Use Email/Payment/Print with ${data.purchase.refNo}.`,
        });
      }, 1500);
    } catch (e: any) {
      toast({ title: "Failed to save", description: e?.message, variant: "destructive" });
    }
  };

  const handlePrint = () => {
    if (lines.length === 0) { toast({ title: "Nothing to print", variant: "destructive" }); return; }
    // If saved, open the branded PDF view
    if (savedPurchaseId) {
      window.open(`/api/purchases/${savedPurchaseId}/pdf`, "_blank");
      toast({ title: "Opening branded PDF (F3)", description: savedRefNo || invoiceNo });
      return;
    }
    // Fallback: inline print for unsaved
    const printWin = window.open('', '_blank', 'width=800,height=600');
    if (!printWin) { toast({ title: "Popup blocked", description: "Allow popups to print", variant: "destructive" }); return; }
    const rows = lines.map((l, i) => `<tr style="background:${i % 2 === 1 ? '#F8F8F8' : '#FFF'}"><td style="border:1px solid #999;padding:3px 6px;text-align:center">${i + 1}</td><td style="border:1px solid #999;padding:3px 6px;font-family:monospace">${l.partNo}</td><td style="border:1px solid #999;padding:3px 6px">${l.details}</td><td style="border:1px solid #999;padding:3px 6px;text-align:right">${l.quantity.toFixed(2)}</td><td style="border:1px solid #999;padding:3px 6px;text-align:right">${l.cost.toFixed(2)}</td><td style="border:1px solid #999;padding:3px 6px;text-align:right">${l.discount.toFixed(1)}%</td><td style="border:1px solid #999;padding:3px 6px;text-align:center">${l.expiry}</td><td style="border:1px solid #999;padding:3px 6px;text-align:center">${l.tax ? '✓' : ''}</td><td style="border:1px solid #999;padding:3px 6px;text-align:right;font-weight:bold">${l.total.toFixed(2)}</td></tr>`).join('');
    printWin.document.write(`<!DOCTYPE html><html><head><title>Supplier Order ${invoiceNo}</title><style>body{font-family:Arial;margin:20px}h1{text-align:center;font-size:18px;margin:0}h2{text-align:center;font-size:14px;margin:5px 0 15px}.info{display:flex;justify-content:space-between;margin-bottom:15px;font-size:11px}table{width:100%;border-collapse:collapse;font-size:11px}th{background:#E0E0E0;border:1px solid #999;padding:4px 6px}.totals{margin-top:10px;font-size:11px}@media print{thead{display:table-header-group}tr{page-break-inside:avoid}}</style></head><body><div style="text-align:center;border-bottom:2px solid #333;padding-bottom:10px;margin-bottom:15px"><h1>${COMPANY.name}</h1><div style="font-size:12px;color:#666">${COMPANY.address} · ${COMPANY.contact}</div></div><h2>Supplier Purchase Order</h2><div class="info"><div><strong>Invoice:</strong> ${invoiceNo}</div><div><strong>Supplier:</strong> ${selectedSupplier?.name || 'N/A'}</div><div><strong>Date:</strong> ${date}</div><div><strong>Terms:</strong> ${terms || 'N/A'}</div></div><table><thead><tr><th>#</th><th>Part Number</th><th>Details</th><th style="text-align:right">Qty</th><th style="text-align:right">Cost GHC</th><th style="text-align:right">Disc%</th><th style="text-align:center">Expiry</th><th style="text-align:center">TAX</th><th style="text-align:right">Total GHC</th></tr></thead><tbody>${rows}</tbody></table><table class="totals"><tr style="font-weight:bold;border-top:2px solid #333"><td>Total Qty: ${totals.totalQty.toFixed(2)}</td><td>TAX: ${totals.taxAmount.toFixed(2)}</td><td>Total: ${totals.grandTotal.toFixed(2)}</td><td>Paid: ${paidAmount.toFixed(2)}</td><td>Due: ${totals.due.toFixed(2)}</td></tr></table></body></html>`);
    printWin.document.close();
    setTimeout(() => { printWin.focus(); printWin.print(); }, 300);
    toast({ title: "Printing (F3)", description: `${lines.length} items` });
  };

  // Email: open premium dialog
  const handleEmail = () => {
    if (!selectedSupplier) { toast({ title: "Select a supplier first", variant: "destructive" }); return; }
    setShowEmailDialog(true);
  };

  // Delete: cancel the saved purchase (if any) + clear the form
  const handleDelete = async () => {
    if (savedPurchaseId) {
      const reason = window.prompt("Reason for cancelling this purchase? (required)") || "";
      if (!reason.trim()) return;
      try {
        const res = await authedFetch(`/api/purchases/${savedPurchaseId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ action: "cancel" }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || `HTTP ${res.status}`);
        toast({ title: "Purchase cancelled (F4)", description: `${savedRefNo || invoiceNo} — ${reason}` });
      } catch (e: any) {
        toast({ title: "Failed to cancel", description: e?.message, variant: "destructive" });
        return;
      }
    } else if (lines.length === 0) {
      toast({ title: "Nothing to delete" });
      return;
    }
    setLines([]); setSelectedLine(null); setPaidAmount(0); setSaved(false);
    setSavedPurchaseId(null); setSavedRefNo("");
    setInvoiceNo(`PUR-${Date.now().toString().slice(-6)}`);
    toast({ title: "Form cleared (F4)" });
  };

  // Payment: open premium payment dialog
  const handlePayment = () => {
    if (lines.length === 0) { toast({ title: "No items", variant: "destructive" }); return; }
    if (totals.due <= 0) { toast({ title: "Already fully paid" }); return; }
    if (!selectedSupplier) { toast({ title: "Select a supplier first", variant: "destructive" }); return; }
    setShowPaymentDialog(true);
  };

  // After payment recorded — refresh paid/due from server
  const handlePaymentSuccess = () => {
    if (savedPurchaseId) {
      authedFetch(`/api/purchases/${savedPurchaseId}`)
        .then(r => r.json())
        .then(data => {
          if (data.purchase) setPaidAmount(Number(data.purchase.amountPaid) || 0);
        })
        .catch(() => {});
    } else {
      setPaidAmount(totals.grandTotal);
    }
  };

  // ===== Issue 1: Delete supplier (deactivates the supplier record — soft delete) =====
  const handleDeleteSupplier = async () => {
    if (!selectedSupplier) return;
    const reason = window.prompt(`Deactivate supplier "${selectedSupplier.name}"?\n\nReason (optional):`) ?? "";
    if (!window.confirm(`Are you sure? This will deactivate "${selectedSupplier.name}". Existing purchase + payment history is preserved. The supplier will no longer appear in dropdowns.`)) return;
    try {
      const res = await authedFetch(`/api/suppliers/${selectedSupplier.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast({ title: "Supplier deactivated", description: `${selectedSupplier.name} (${selectedSupplier.code})${reason ? ` — ${reason}` : ""}` });
        // Remove from local list + clear selection
        setSuppliers(prev => prev.filter(s => s.id !== selectedSupplier.id));
        setSelectedSupplier(null);
        setSupplierDetails("");
        setSupplierCatalog([]);
      } else {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
    } catch (e: any) {
      toast({ title: "Failed to delete supplier", description: e?.message, variant: "destructive" });
    }
  };

  // ===== Issue 1: Edit supplier — called from NewSupplierPopup when editSupplier is set =====
  const handleEditSupplierSave = async (updated: Supplier) => {
    if (!editSupplier) {
      // Not in edit mode — fall through to create-new flow
      handleSaveNewSupplier(updated);
      return;
    }
    setShowNewSupplier(false);
    setEditSupplier(null);
    try {
      const res = await authedFetch(`/api/suppliers/${editSupplier.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: updated.name,
          contactName: updated.contactName || '',
          phone: updated.phone || '',
          mobile: updated.mobile || '',
          email: updated.email || '',
          fax: updated.fax || '',
          address: updated.address || '',
          city: updated.city || '',
          state: updated.state || '',
          country: updated.country || 'Ghana',
          businessNo: updated.businessNo || '',
          tradingTerms: updated.tradingTerms || 'Net 30',
          creditLimit: updated.creditLimit || 0,
          taxInclusive: updated.taxInclusive || false,
          notes: updated.notes || '',
          // Tier 1 fields
          rating: updated.rating ?? 0,
          blacklist: updated.blacklist ?? false,
          blacklistReason: updated.blacklistReason || '',
          tin: updated.tin || '',
          bankName: updated.bankName || '',
          bankAccountName: updated.bankAccountName || '',
          bankAccountNo: updated.bankAccountNo || '',
          bankBranchCode: updated.bankBranchCode || '',
          mobileMoneyProvider: updated.mobileMoneyProvider || '',
          mobileMoneyNumber: updated.mobileMoneyNumber || '',
          earlyPayDiscountPct: updated.earlyPayDiscountPct ?? 0,
          earlyPayDays: updated.earlyPayDays ?? 0,
          netDays: updated.netDays ?? 30,
        }),
      });
      const data = await res.json();
      if (res.ok && (data.success || data.supplier)) {
        const updatedSupplier = { ...editSupplier, ...updated };
        setSuppliers(prev => prev.map(s => s.id === editSupplier.id ? updatedSupplier : s));
        setSelectedSupplier(updatedSupplier);
        setSupplierDetails(updatedSupplier.name);
        toast({ title: "Supplier updated ✓", description: `${updated.name} (${updated.code})` });
      } else {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
    } catch (e: any) {
      toast({ title: "Failed to update supplier", description: e?.message, variant: "destructive" });
    }
  };

  const handlePrint_old_removed = () => {};

  const supplierBalance = selectedSupplier?.balance || 0;
  const supplierLimit = selectedSupplier?.creditLimit || 0;
  const supplierAvailable = supplierLimit - supplierBalance;

  return (
    <div className="h-screen flex flex-col bg-slate-100">
      <PopupWindow title="Supplier Form" titleBarColor={BLUE} initialWidth={920} initialHeight={650} minWidth={700} minHeight={500} onClose={onBack}>
        <div className="h-full flex flex-col bg-white" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
          {/* Blue Header */}
          <div className="flex-shrink-0 flex items-center justify-between px-3 py-1.5 text-white" style={{ backgroundColor: BLUE }}>
            <div className="flex items-center gap-2">
              <select value={docType} onChange={(e) => setDocType(e.target.value)} className="bg-white/15 border border-white/20 rounded px-1.5 py-0.5 text-[10px] text-white font-bold outline-none">
                <option value="Purchase">Purchase</option>
                <option value="Quote">Quote</option>
                <option value="Order">Order</option>
              </select>
              <Badge variant="secondary" className="bg-white/25 text-white text-[9px]">{invoiceNo}</Badge>
            </div>
            <div className="flex items-center gap-2 text-[10px]">
              <div className="flex items-center gap-1"><span className="text-white/70 text-[9px]">Date:</span><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="bg-white/15 border border-white/20 rounded px-1 py-0.5 text-[9px] text-white outline-none" /></div>
              <div className="flex items-center gap-1"><span className="text-white/70 text-[9px]">Ref:</span><input value={refNo} onChange={(e) => setRefNo(e.target.value)} placeholder="Ref No." className="w-16 bg-white/15 border border-white/20 rounded px-1 py-0.5 text-[9px] text-white placeholder:text-white/60 outline-none" /></div>
              <div className="flex items-center gap-1"><span className="text-white/70 text-[9px]">Terms:</span>
                <select value={terms} onChange={(e) => setTerms(e.target.value)} className="bg-white/15 border border-white/20 rounded px-1 py-0.5 text-[9px] text-white outline-none"><option value="Net 15">Net 15</option><option value="Net 30">Net 30</option><option value="Net 60">Net 60</option><option value="COD">COD</option><option value="Prepaid">Prepaid</option></select>
              </div>
              <div className="flex items-center gap-1"><span className="text-white/70 text-[9px]">Salesperson:</span>
                <select value={salesperson} onChange={(e) => setSalesperson(e.target.value)} className="bg-white/15 border border-white/20 rounded px-1 py-0.5 text-[9px] text-white outline-none"><option value="Sarah Johnson">Sarah Johnson</option><option value="Mike Mensah">Mike Mensah</option><option value="Grace Owusu">Grace Owusu</option></select>
              </div>
            </div>
          </div>

          {/* Top Panels: Supplier Details + Delivery Details */}
          <div className="flex-shrink-0 px-3 py-1.5 flex items-start gap-2 border-b border-slate-200">
            {/* Supplier Details */}
            <div className="flex-1 border border-slate-300 rounded p-1.5">
              <div className="text-[9px] font-bold text-slate-700 mb-1">Supplier Details</div>
              <input
                value={supplierDetails}
                onChange={(e) => handleSupplierDetails(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Escape') setShowSupplierList(false); }}
                onFocus={() => { if (supplierDetails) setShowSupplierList(true); }}
                placeholder="Type supplier name to search..."
                className="w-full h-6 px-1.5 text-[10px] border border-slate-400 rounded bg-white outline-none focus:ring-1 focus:ring-blue-400"
              />
              {selectedSupplier && <div className="text-[8px] text-slate-500 mt-0.5">Code: {selectedSupplier.code} · {selectedSupplier.city}, {selectedSupplier.country}</div>}
              <label className="flex items-center gap-1 mt-1 text-[9px] text-slate-700 cursor-pointer">
                <input type="checkbox" checked={taxInclusive} onChange={(e) => setTaxInclusive(e.target.checked)} className="h-2.5 w-2.5 accent-blue-600" /> Tax Inclusive
              </label>
            </div>
            {/* Delivery Details */}
            <div className="flex-1 border border-slate-300 rounded p-1.5">
              <div className="text-[9px] font-bold text-slate-700 mb-1">Delivery Details</div>
              <textarea placeholder="Delivery notes..." rows={1} className="w-full text-[9px] border border-slate-200 rounded px-1 py-0.5 outline-none resize-none" />
              <div className="grid grid-cols-3 gap-1 mt-1">
                <div><label className="text-[8px] text-slate-500 font-semibold">Balance</label><input value={supplierBalance.toFixed(2)} readOnly className="w-full h-5 px-1 text-[9px] font-mono border border-slate-200 rounded bg-slate-50 outline-none" /></div>
                <div><label className="text-[8px] text-slate-500 font-semibold">Limit</label><input value={supplierLimit.toFixed(2)} readOnly className="w-full h-5 px-1 text-[9px] font-mono border border-slate-200 rounded bg-slate-50 outline-none" /></div>
                <div><label className="text-[8px] text-slate-500 font-semibold">Available</label><input value={supplierAvailable.toFixed(2)} readOnly className="w-full h-5 px-1 text-[9px] font-mono border border-slate-200 rounded bg-slate-50 outline-none" /></div>
              </div>
            </div>
          </div>

          {/* Data Grid */}
          <div className="flex-1 overflow-hidden flex flex-col min-h-0">
            <div className="flex-shrink-0 grid grid-cols-[25px_100px_1fr_50px_60px_40px_70px_30px_70px] gap-1 px-2 py-1 text-[9px] font-bold text-slate-700 border-b border-slate-400" style={{ backgroundColor: '#E0E0E0' }}>
              <div className="text-center">#</div><div>Part Number</div><div>Details</div><div className="text-right">Qty</div><div className="text-right">Cost GHC</div><div className="text-right">Disc%</div><div className="text-center">Expiry</div><div className="text-center">TAX</div><div className="text-right">Total GHC</div>
            </div>
            <ScrollArea className="flex-1 min-h-0">
              <div>
                {lines.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-slate-400"><Package className="h-8 w-8 mb-1 opacity-40" /><div className="text-[10px]">No items. Type a Part No. below to search.</div></div>
                ) : (
                  lines.map((line, idx) => (
                    <div key={line.id} onClick={() => setSelectedLine(idx)} className="grid grid-cols-[25px_100px_1fr_50px_60px_40px_70px_30px_70px] gap-1 px-2 py-0.5 text-[9px] cursor-pointer border-b border-slate-100" style={{ backgroundColor: selectedLine === idx ? '#E6F0FF' : (idx % 2 === 1 ? '#F8F8F8' : '#FFFFFF') }}>
                      <div className="text-center text-slate-500">{idx + 1}</div>
                      <div className="font-mono truncate">{line.partNo}</div>
                      <div className="truncate">{line.details}</div>
                      <div className="text-right"><input type="number" value={line.quantity} onClick={(e) => e.stopPropagation()} onChange={(e) => updateLine(idx, 'quantity', parseFloat(e.target.value) || 0)} className="w-full text-right font-mono bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-400 outline-none" /></div>
                      <div className="text-right"><input type="number" step="0.01" value={line.cost} onClick={(e) => e.stopPropagation()} onChange={(e) => updateLine(idx, 'cost', parseFloat(e.target.value) || 0)} className="w-full text-right font-mono bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-400 outline-none" /></div>
                      <div className="text-right"><input type="number" value={line.discount || ''} onClick={(e) => e.stopPropagation()} onChange={(e) => updateLine(idx, 'discount', parseFloat(e.target.value) || 0)} className="w-full text-right font-mono bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-400 outline-none" placeholder="0" /></div>
                      <div className="text-center text-slate-600">{line.expiry}</div>
                      <div className="text-center"><input type="checkbox" checked={line.tax} onClick={(e) => e.stopPropagation()} onChange={(e) => updateLine(idx, 'tax', e.target.checked)} className="h-2.5 w-2.5 accent-blue-600" /></div>
                      <div className="text-right font-mono font-semibold">{line.total.toFixed(2)}</div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Bottom: Find Part No + Totals */}
          <div className="flex-shrink-0 px-3 py-1.5 bg-slate-50 border-t border-slate-300 flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <div><label className="text-[8px] font-bold text-slate-600 block">Find Part no</label>
                <input value={findPartNo} onChange={(e) => { setFindPartNo(e.target.value); const p = products.find(p => p.barcode === e.target.value || p.sku.toLowerCase() === e.target.value.toLowerCase()); if (p) setOnHand(p.stock); if (e.target.value.length > 0) setShowStockList(true); else setShowStockList(false); }} onKeyDown={(e) => { if (e.key === 'Enter') { const p = products.find(p => p.barcode === findPartNo || p.sku.toLowerCase() === findPartNo.toLowerCase()); if (p) addProductToLine(p); } if (e.key === 'Escape') setShowStockList(false); }} onFocus={() => { if (findPartNo) setShowStockList(true); }} placeholder="Type..." className="w-full min-w-[100px] flex-1 h-5 px-1.5 text-[9px] font-mono border border-slate-400 rounded outline-none focus:ring-1 focus:ring-blue-400" style={{ backgroundColor: '#FFFFCC' }} />
              </div>
              <div><label className="text-[8px] font-bold text-slate-600 block">On Hand</label><input value={onHand} readOnly className="w-14 h-5 px-1 text-[9px] font-mono border border-slate-300 rounded bg-slate-100 outline-none text-center" /></div>
            </div>
            <div className="flex-1 flex items-center justify-end gap-2">
              <div className="text-right"><label className="text-[8px] font-bold text-slate-600 block">Total Qty</label><input value={totals.totalQty.toFixed(2)} readOnly className="w-14 h-5 px-1 text-[9px] font-mono border border-slate-300 rounded bg-white outline-none text-center" /></div>
              <div className="text-right"><label className="text-[8px] font-bold text-slate-600 block">TAX GHC</label><input value={totals.taxAmount.toFixed(2)} readOnly className="w-16 h-5 px-1 text-[9px] font-mono border border-slate-300 rounded bg-white outline-none text-right" /></div>
              <div className="text-right"><label className="text-[8px] font-bold text-slate-600 block">Total GHC</label><input value={totals.grandTotal.toFixed(2)} readOnly className="w-20 h-5 px-1 text-[9px] font-mono font-bold border border-slate-400 rounded outline-none text-right" style={{ backgroundColor: '#E6F0FF' }} /></div>
              <div className="text-right"><label className="text-[8px] font-bold text-slate-600 block">Paid GHC</label><input type="number" value={paidAmount || ''} onChange={(e) => setPaidAmount(parseFloat(e.target.value) || 0)} className="w-20 h-5 px-1 text-[9px] font-mono border border-slate-400 rounded bg-white outline-none text-right" placeholder="0.00" /></div>
              <div className="text-right"><label className="text-[8px] font-bold text-slate-600 block">Due GHC</label><input value={totals.due.toFixed(2)} readOnly className={cn("w-20 h-5 px-1 text-[9px] font-mono font-bold border border-slate-400 rounded outline-none text-right", totals.due > 0 ? "text-rose-600" : "text-emerald-600")} style={{ backgroundColor: '#FFF8E1' }} /></div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex-shrink-0 px-3 py-1.5 flex items-center gap-1.5 border-t border-slate-300 flex-wrap" style={{ backgroundColor: '#F0F0F0' }}>
            <button onClick={handleSave} className="h-7 px-3 rounded text-white text-[9px] font-semibold flex items-center gap-1 transition shadow-sm" style={{ backgroundColor: BLUE }}><Save className="h-3 w-3" /> Save <kbd className="text-[7px] bg-white/20 px-0.5 rounded">F2</kbd></button>
            <button onClick={handlePrint} disabled={!savedPurchaseId} title={!savedPurchaseId ? "Save the purchase first to print branded PDF" : "Print branded PDF"} className={cn("h-7 px-3 rounded text-white text-[9px] font-semibold flex items-center gap-1 transition shadow-sm", !savedPurchaseId && "opacity-40 cursor-not-allowed")} style={{ backgroundColor: BLUE }}><Printer className="h-3 w-3" /> Print <kbd className="text-[7px] bg-white/20 px-0.5 rounded">F3</kbd></button>
            <button onClick={handleEmail} disabled={!selectedSupplier} title={!selectedSupplier ? "Select a supplier first" : "Email this supplier"} className={cn("h-7 px-3 rounded text-white text-[9px] font-semibold flex items-center gap-1 transition shadow-sm", !selectedSupplier && "opacity-40 cursor-not-allowed")} style={{ backgroundColor: BLUE }}><Mail className="h-3 w-3" /> Email</button>
            <button onClick={handleDelete} className="h-7 px-3 rounded text-white text-[9px] font-semibold flex items-center gap-1 transition shadow-sm" style={{ backgroundColor: BLUE }}><Trash2 className="h-3 w-3" /> Delete <kbd className="text-[7px] bg-white/20 px-0.5 rounded">F4</kbd></button>
            <button onClick={handlePayment} disabled={!selectedSupplier || totals.due <= 0} title={!selectedSupplier ? "Select a supplier first" : totals.due <= 0 ? "Already fully paid" : "Record supplier payment"} className={cn("h-7 px-3 rounded text-white text-[9px] font-semibold flex items-center gap-1 transition shadow-sm", (!selectedSupplier || totals.due <= 0) && "opacity-40 cursor-not-allowed")} style={{ backgroundColor: BLUE }}><CreditCard className="h-3 w-3" /> Payment <kbd className="text-[7px] bg-white/20 px-0.5 rounded">F5</kbd></button>
            {/* Phase 4: New Supplier + Catalog buttons */}
            <button onClick={() => setShowNewSupplier(true)} title="Add a new supplier to the system" className="h-7 px-3 rounded text-white text-[9px] font-semibold flex items-center gap-1 transition shadow-sm" style={{ backgroundColor: '#16A34A' }}><Plus className="h-3 w-3" /> New Supplier</button>
            <button
              onClick={() => { if (selectedSupplier) { setEditSupplier(selectedSupplier); setShowNewSupplier(true); } else { toast({ title: "Select a supplier first", variant: "destructive" }); } }}
              disabled={!selectedSupplier || !canEditSupplier}
              title={!canEditSupplier ? "Admin/Manager only — you don't have permission to edit suppliers" : !selectedSupplier ? "Select a supplier first to edit their details" : "Edit the selected supplier's details (name, contact, address, etc.)"}
              className={cn("h-7 px-3 rounded text-white text-[9px] font-semibold flex items-center gap-1 transition shadow-sm", (!selectedSupplier || !canEditSupplier) && "opacity-40 cursor-not-allowed")}
              style={{ backgroundColor: '#EA580C' }}
            ><Edit2 className="h-3 w-3" /> Edit Supplier</button>
            <button
              onClick={handleDeleteSupplier}
              disabled={!selectedSupplier || !canEditSupplier}
              title={!canEditSupplier ? "Admin/Manager only — you don't have permission to delete suppliers" : !selectedSupplier ? "Select a supplier first to deactivate" : "Deactivate the selected supplier (soft delete — preserves history)"}
              className={cn("h-7 px-3 rounded text-white text-[9px] font-semibold flex items-center gap-1 transition shadow-sm", (!selectedSupplier || !canEditSupplier) && "opacity-40 cursor-not-allowed")}
              style={{ backgroundColor: '#DC2626' }}
            ><Trash2 className="h-3 w-3" /> Delete Supplier</button>
            <button
              onClick={() => setShowHistoryDialog(true)}
              disabled={!selectedSupplier}
              title={!selectedSupplier ? "Select a supplier first" : "View purchase + payment history for this supplier"}
              className={cn("h-7 px-3 rounded text-white text-[9px] font-semibold flex items-center gap-1 transition shadow-sm", !selectedSupplier && "opacity-40 cursor-not-allowed")}
              style={{ backgroundColor: '#0891B2' }}
            ><Hash className="h-3 w-3" /> History</button>
            <button onClick={() => setShowCatalogDialog(true)} disabled={!selectedSupplier} title={!selectedSupplier ? "Select a supplier first to manage their catalog" : "Manage this supplier's product catalog — products added here appear in the Find Part No search"} className={cn("h-7 px-3 rounded text-white text-[9px] font-semibold flex items-center gap-1 transition shadow-sm", !selectedSupplier && "opacity-40 cursor-not-allowed")} style={{ backgroundColor: '#9333EA' }}>
              <Package className="h-3 w-3" /> Catalog
              {supplierCatalog.length > 0 && <Badge className="ml-0.5 h-3 px-1 text-[8px] bg-white/30 text-white border-0">{supplierCatalog.length}</Badge>}
            </button>
            {savedPurchaseId && <Badge className="bg-emerald-500 text-white text-[9px] uppercase border-0">Saved · {savedRefNo}</Badge>}
            <div className="flex-1" />
            {selectedLine !== null && <button onClick={() => removeLine(selectedLine)} className="h-7 px-2 rounded bg-rose-100 hover:bg-rose-200 text-rose-700 text-[9px] font-semibold flex items-center gap-1 transition"><Trash2 className="h-3 w-3" /> Remove Line</button>}
          </div>

          {/* Status Bar */}
          <div className="flex-shrink-0 px-3 py-0.5 text-[8px] text-white flex items-center gap-3" style={{ backgroundColor: '#808080' }}>
            <span><kbd className="bg-white/20 px-0.5 rounded mr-0.5">F9</kbd>Part No.</span>
            <span><kbd className="bg-white/20 px-0.5 rounded mr-0.5">F10</kbd>Details</span>
            <span><kbd className="bg-white/20 px-0.5 rounded mr-0.5">Shift+F12</kbd>Print Labels</span>
            <div className="flex-1" />
            <span>{selectedSupplier ? selectedSupplier.name : "No supplier"} · {lines.length} items · {formatGHS(totals.grandTotal)}</span>
          </div>
        </div>

        {/* Supplier List Popup */}
        <AnimatePresence>
          {showSupplierList && (
            <SupplierListPopup
              suppliers={suppliers}
              searchText={supplierDetails}
              canEditSupplier={canEditSupplier}
              onSelect={handleSelectSupplier}
              onNew={() => { setShowSupplierList(false); setEditSupplier(null); setShowNewSupplier(true); }}
              onNotes={(s) => { setShowSupplierList(false); setSelectedSupplier(s); setSupplierDetails(s.name); setShowNotesDialog(true); }}
              onHistory={(s) => { setShowSupplierList(false); setSelectedSupplier(s); setSupplierDetails(s.name); setShowHistoryDialog(true); }}
              onPriceHistory={(s) => { setShowSupplierList(false); setSelectedSupplier(s); setSupplierDetails(s.name); setShowPriceHistoryDialog(true); }}
              onBulkEdit={() => { setShowSupplierList(false); setShowBulkEditDialog(true); }}
              onEmail={(s) => { setShowSupplierList(false); setSelectedSupplier(s); setSupplierDetails(s.name); setShowEmailDialog(true); }}
              onEdit={(s) => { setShowSupplierList(false); setSelectedSupplier(s); setSupplierDetails(s.name); setEditSupplier(s); setShowNewSupplier(true); }}
              onDelete={async (s) => {
                if (!window.confirm(`Deactivate supplier "${s.name}"?\n\nExisting purchase + payment history is preserved. The supplier will no longer appear in dropdowns.`)) return;
                try {
                  const res = await authedFetch(`/api/suppliers/${s.id}`, { method: "DELETE", credentials: "include" });
                  const data = await res.json();
                  if (res.ok && data.success) {
                    toast({ title: "Supplier deactivated", description: `${s.name} (${s.code})` });
                    setSuppliers(prev => prev.filter(x => x.id !== s.id));
                  } else {
                    throw new Error(data.error || `HTTP ${res.status}`);
                  }
                } catch (e: any) {
                  toast({ title: "Failed to delete", description: e?.message, variant: "destructive" });
                }
              }}
              onClose={() => setShowSupplierList(false)}
            />
          )}
        </AnimatePresence>

        {/* New / Edit Supplier Popup */}
        <AnimatePresence>
          {showNewSupplier && (
            <NewSupplierPopup
              editSupplier={editSupplier}
              onSave={editSupplier ? handleEditSupplierSave : handleSaveNewSupplier}
              onClose={() => { setShowNewSupplier(false); setEditSupplier(null); }}
            />
          )}
        </AnimatePresence>

        {/* Stock List Popup (triggered by Find Part No) */}
        <AnimatePresence>
          {showStockList && (
            <StockListMiniPopup
              products={(() => {
                // If supplier has a catalog, show catalog items first, then other products
                if (supplierCatalog.length > 0) {
                  const catalogProductIds = new Set(supplierCatalog.map((c: any) => c.productId));
                  const catalogProducts = supplierCatalog.map((c: any) => ({
                    ...c.product,
                    // Override costPrice with supplierCost so the search popup shows the right price
                    costPrice: c.supplierCost,
                    // Use supplierSku if set
                    sku: c.supplierSku || c.product.sku,
                  } as Product));
                  const otherProducts = products.filter(p => !catalogProductIds.has(p.id));
                  return [...catalogProducts, ...otherProducts];
                }
                return products;
              })()}
              searchText={findPartNo}
              onSelect={(product) => { addProductToLine(product); setShowStockList(false); }}
              onClose={() => setShowStockList(false)}
            />
          )}
        </AnimatePresence>

        {/* ===== Premium Dialogs ===== */}
        <SupplierEmailDialog
          open={showEmailDialog}
          onOpenChange={setShowEmailDialog}
          supplierId={selectedSupplier?.id || null}
          supplierName={selectedSupplier?.name || ""}
          supplierEmail={selectedSupplier?.email}
          supplierContactName={selectedSupplier?.contactName}
        />

        <SupplierNotesDialog
          open={showNotesDialog}
          onOpenChange={setShowNotesDialog}
          supplierId={selectedSupplier?.id || null}
          supplierName={selectedSupplier?.name || ""}
          initialNotes={selectedSupplier?.notes || ""}
          onSaved={() => {
            // Refresh the supplier's notes in local state
            if (selectedSupplier) {
              setSelectedSupplier({ ...selectedSupplier, notes: selectedSupplier.notes });
            }
          }}
        />

        <SupplierHistoryDialog
          open={showHistoryDialog}
          onOpenChange={setShowHistoryDialog}
          supplierId={selectedSupplier?.id || null}
          supplierName={selectedSupplier?.name || ""}
        />

        {/* Tier 2 #14 — Supplier Price History dialog */}
        {showPriceHistoryDialog && selectedSupplier && (
          <SupplierPriceHistoryDialog
            supplierId={selectedSupplier.id}
            supplierName={selectedSupplier.name}
            onClose={() => setShowPriceHistoryDialog(false)}
          />
        )}

        {/* Bulk Edit dialog — apply changes to all filtered suppliers */}
        {showBulkEditDialog && (
          <SupplierBulkEditDialog
            suppliers={suppliers}
            onClose={() => setShowBulkEditDialog(false)}
            onSaved={() => {
              // Refresh the supplier list from the API
              authedFetch('/api/suppliers')
                .then(r => r.json())
                .then(data => {
                  if (data.suppliers) {
                    setSuppliers(data.suppliers.map((s: any) => ({
                      id: s.id, code: s.code, name: s.name,
                      contactName: s.contactName || '', phone: s.phone || '',
                      mobile: s.mobile || '', email: s.email || '', fax: s.fax || '',
                      address: s.address || '', city: s.city || '', state: s.state || '',
                      country: s.country || 'Ghana', businessNo: s.businessNo || '',
                      tradingTerms: s.tradingTerms || 'Net 30', creditLimit: s.creditLimit || 0,
                      balance: s.balance || 0, taxInclusive: s.taxInclusive || false,
                      notes: s.notes || '',
                      rating: s.rating ?? 0, blacklist: s.blacklist ?? false,
                      blacklistReason: s.blacklistReason || '', tin: s.tin || '',
                      bankName: s.bankName || '', bankAccountName: s.bankAccountName || '',
                      bankAccountNo: s.bankAccountNo || '', bankBranchCode: s.bankBranchCode || '',
                      mobileMoneyProvider: s.mobileMoneyProvider || '',
                      mobileMoneyNumber: s.mobileMoneyNumber || '',
                      earlyPayDiscountPct: s.earlyPayDiscountPct ?? 0,
                      earlyPayDays: s.earlyPayDays ?? 0, netDays: s.netDays ?? 30,
                    })));
                  }
                })
                .catch(() => {});
            }}
          />
        )}

        <PurchasePaymentDialog
          open={showPaymentDialog}
          onOpenChange={setShowPaymentDialog}
          purchaseId={savedPurchaseId}
          refNo={savedRefNo || invoiceNo}
          supplierId={selectedSupplier?.id}
          supplierName={selectedSupplier?.name || ""}
          totalAmount={totals.grandTotal}
          paidAmount={paidAmount}
          onPaid={handlePaymentSuccess}
        />

        <SupplierCatalogDialog
          open={showCatalogDialog}
          onOpenChange={setShowCatalogDialog}
          supplierId={selectedSupplier?.id || null}
          supplierName={selectedSupplier?.name || ""}
          allProducts={products}
          onChanged={() => {
            // Reload the catalog state when dialog changes it
            if (selectedSupplier) {
              authedFetch(`/api/suppliers/${selectedSupplier.id}/products`)
                .then(r => r.json())
                .then(data => {
                  if (data.catalog) setSupplierCatalog(data.catalog);
                })
                .catch(() => {});
            }
          }}
        />
      </PopupWindow>
    </div>
  );
}

// ===== Stock List Mini Popup (reused from purchase-form pattern) =====
function StockListMiniPopup({ products, searchText, onSelect, onClose }: {
  products: Product[];
  searchText: string;
  onSelect: (product: Product) => void;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [query, setQuery] = useState(searchText);
  const [typeFilter, setTypeFilter] = useState("");
  const [groupFilter, setGroupFilter] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { const t = setTimeout(() => inputRef.current?.focus(), 50); return () => clearTimeout(t); }, []);

  // Filtered list — searches across name, sku, AND barcode
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
    if (groupFilter) {
      result = result.filter(p => (p.groupId || '') === groupFilter);
    }
    // Sort by name ascending (matches screenshot — alphabetical by product name)
    return [...result].sort((a, b) => a.name.localeCompare(b.name));
  }, [products, query, searchText, typeFilter, groupFilter]);

  // Unique categories for the Type dropdown
  const categories = useMemo(() => {
    const set = new Set(products.map(p => p.category || '').filter(Boolean));
    return Array.from(set).sort();
  }, [products]);

  const handleSelect = () => {
    const product = filtered[selectedIndex];
    if (!product) {
      toast({ title: 'No product selected', variant: "destructive" });
      return;
    }
    onSelect(product);
    onClose();
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); handleSelect(); }
    if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex(i => Math.min(filtered.length - 1, i + 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex(i => Math.max(0, i - 1)); }
  };

  // Icon button helper — matches the ezi-solution toolbar style (square icon + label below)
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
        {/* ===== Header — "Stock List" title (user requested to retain this name) ===== */}
        <div className="px-3 pt-2 pb-1.5">
          <h2 className="text-base font-bold text-black">Stock List</h2>
        </div>

        {/* ===== Search & Filter Panel — dark green headers + inputs ===== */}
        <div className="mx-3 mb-2 bg-white border border-slate-400">
          {/* Row 1: Details input + Search button + Type dropdown */}
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
          {/* Row 2: Stock Group filters (4 dropdowns) */}
          <div className="grid grid-cols-[70px_140px_70px_140px_70px_140px] gap-1 px-1.5 pb-1.5 items-center">
            <div className="px-1.5 py-0.5 text-[10px] font-bold text-white text-center" style={{ backgroundColor: '#2E5D4B' }}>Stock Group</div>
            <select
              value={groupFilter}
              onChange={(e) => { setGroupFilter(e.target.value); setSelectedIndex(0); }}
              className="h-6 px-1 text-[10px] border border-slate-500 rounded bg-white outline-none"
            >
              <option value="">All Groups</option>
            </select>
            <div className="px-1.5 py-0.5 text-[10px] font-bold text-white text-center" style={{ backgroundColor: '#2E5D4B' }}>Group1</div>
            <select className="h-6 px-1 text-[10px] border border-slate-500 rounded bg-white outline-none">
              <option value="">All</option>
            </select>
            <div className="px-1.5 py-0.5 text-[10px] font-bold text-white text-center" style={{ backgroundColor: '#2E5D4B' }}>Group2</div>
            <select className="h-6 px-1 text-[10px] border border-slate-500 rounded bg-white outline-none">
              <option value="">All</option>
            </select>
          </div>
        </div>

        {/* ===== Data Grid — white background, light grey header, 5 columns ===== */}
        <div className="mx-3 mb-2 flex-1 overflow-hidden flex flex-col min-h-0 bg-white border border-slate-400">
          {/* Column Headers — light grey background */}
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

          {/* Rows — scrollable */}
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
                      onDoubleClick={() => { onSelect(p); onClose(); }}
                      className="grid gap-0 px-1 py-0.5 text-[10px] cursor-pointer border-b"
                      style={{ backgroundColor: bg, gridTemplateColumns: '24px 130px 1fr 70px 90px 90px', borderBottomColor: '#D4D4D4' }}
                    >
                      {/* Row selector column — arrow indicator when selected */}
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

        {/* ===== Status Bar — showing count ===== */}
        <div className="mx-3 mb-1 px-2 py-0.5 text-[10px] text-black flex items-center justify-between" style={{ backgroundColor: '#E8E8E8', border: '1px solid #808080' }}>
          <span className="font-mono font-semibold">{filtered.length} of {products.length} products</span>
          <span className="font-mono">Total Qty: {filtered.reduce((s, p) => s + Number(p.stock || p.quantity || 0), 0).toFixed(3)}</span>
        </div>

        {/* ===== Action Toolbar — 7 icon buttons matching ezi-solution ===== */}
        <div className="mx-3 mb-2 px-2 py-2 flex items-center gap-1 bg-white border border-slate-300 overflow-x-auto">
          <IconButton label="Select" shortcut="Enter" color="#28A745" onClick={handleSelect} disabled={!selectedProduct} icon={<Check className="h-5 w-5" style={{ color: '#28A745' }} />} />
          <IconButton label="New" color="#0066CC" onClick={() => toast({ title: "New Product", description: "Use Stock File to add new products" })} icon={<><FileText className="h-5 w-5 text-blue-600" /><Plus className="h-3 w-3 text-green-600 absolute ml-3 -mt-2" /></>} />
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

// ===== Supplier List Popup =====
function SupplierListPopup({ suppliers, searchText, canEditSupplier, onSelect, onNew, onNotes, onHistory, onPriceHistory, onBulkEdit, onEmail, onEdit, onDelete, onClose }: {
  suppliers: Supplier[];
  searchText: string;
  canEditSupplier?: boolean;
  onSelect: (s: Supplier) => void;
  onNew: () => void;
  onNotes?: (s: Supplier) => void;
  onHistory?: (s: Supplier) => void;
  onPriceHistory?: (s: Supplier) => void;
  onBulkEdit?: () => void;
  onEmail?: (s: Supplier) => void;
  onEdit?: (s: Supplier) => void;
  onDelete?: (s: Supplier) => void;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [query, setQuery] = useState(searchText);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showDeleted, setShowDeleted] = useState(false);
  const [showOutstanding, setShowOutstanding] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { const t = setTimeout(() => inputRef.current?.focus(), 50); return () => clearTimeout(t); }, []);

  // Filtered list — applies search query + toggle filters
  const filtered = useMemo(() => {
    const q = (query || searchText).toLowerCase().trim();
    let result = suppliers;
    if (q) {
      result = result.filter(s =>
        s.name.toLowerCase().includes(q) ||
        s.code.toLowerCase().includes(q) ||
        (s.phone || '').toLowerCase().includes(q) ||
        (s.mobile || '').toLowerCase().includes(q) ||
        (s.address || '').toLowerCase().includes(q)
      );
    }
    if (showOutstanding) {
      // Outstanding = has a non-zero balance
      result = result.filter(s => Math.abs(s.balance || 0) > 0.01);
    }
    return result;
  }, [suppliers, query, searchText, showOutstanding, showDeleted]);

  // Sort by code ascending (matches screenshot)
  const sorted = useMemo(() => [...filtered].sort((a, b) => a.code.localeCompare(b.code)), [filtered]);

  // Stats for status bar
  const totalCount = suppliers.length;
  const filteredCount = sorted.length;
  const totalBalance = sorted.reduce((sum, s) => sum + (s.balance || 0), 0);
  const outstandingCount = sorted.filter(s => Math.abs(s.balance || 0) > 0.01).length;

  const handleSelect = () => {
    const supplier = sorted[selectedIndex];
    if (!supplier) {
      toast({ title: 'No supplier selected', variant: "destructive" });
      return;
    }
    onSelect(supplier);
    onClose();
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); handleSelect(); }
    if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex(i => Math.min(sorted.length - 1, i + 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex(i => Math.max(0, i - 1)); }
  };

  // Icon button helper — matches the ezi-solution toolbar style
  const IconButton = ({ icon, label, color, onClick, disabled, shortcut }: any) => (
    <button
      onClick={onClick}
      disabled={disabled}
      title={shortcut ? `${label} (${shortcut})` : label}
      className="flex flex-col items-center gap-0.5 p-1.5 rounded hover:bg-slate-100 transition disabled:opacity-40 disabled:cursor-not-allowed"
    >
      <div className="h-7 w-7 rounded flex items-center justify-center" style={{ backgroundColor: color }}>
        {icon}
      </div>
      <span className="text-[8px] font-semibold text-slate-700 whitespace-nowrap">{label}</span>
    </button>
  );

  const selectedSupplier = sorted[selectedIndex];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/40 flex items-start justify-center pt-4 sm:pt-10 z-50 p-4" onClick={onClose}>
      <motion.div
        initial={{ scale: 0.95, y: -20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: -20 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-lg shadow-2xl overflow-hidden flex flex-col w-full border-2"
        style={{ width: '100%', maxWidth: '1100px', maxHeight: '90vh', borderColor: '#003366', fontFamily: 'Arial, Helvetica, sans-serif' }}
      >
        {/* ===== Title Bar — dark blue gradient with count ===== */}
        <div className="flex-shrink-0 flex items-center justify-between px-3 h-8 text-white" style={{ background: 'linear-gradient(to bottom, #004488, #003366)' }}>
          <div className="flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5" />
            <span className="text-xs font-bold">Supplier List ({filteredCount === totalCount ? `${totalCount}` : `${filteredCount} of ${totalCount}`})</span>
          </div>
          <button onClick={onClose} className="h-5 w-5 rounded bg-red-600 hover:bg-red-700 flex items-center justify-center transition">
            <X className="h-3 w-3 text-white" />
          </button>
        </div>

        {/* ===== Search & Filters Bar — classic Windows gray ===== */}
        <div className="flex-shrink-0 px-2 py-1.5 flex items-center gap-2 border-b border-slate-300" style={{ backgroundColor: '#D4D0C8' }}>
          <label className="text-[10px] font-bold text-slate-700">Search:</label>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0); }}
            onKeyDown={handleKeyDown}
            placeholder="Type supplier name, code, phone, or address..."
            className="h-6 flex-1 max-w-xs px-2 text-[10px] border border-slate-500 rounded bg-white outline-none focus:ring-1 focus:ring-blue-500"
            style={{ boxShadow: 'inset 1px 1px 2px rgba(0,0,0,0.1)' }}
          />
          <button
            onClick={() => { setSelectedIndex(0); }}
            className="h-6 px-3 text-[10px] font-bold text-black rounded border border-slate-500 hover:bg-slate-200 transition"
            style={{ backgroundColor: '#E8E8E8' }}
          >
            search
          </button>
          <div className="flex-1" />
          <button
            onClick={() => { setShowDeleted(!showDeleted); setSelectedIndex(0); }}
            className={cn("h-6 px-2 text-[10px] font-bold rounded border transition", showDeleted ? "bg-blue-500 text-white border-blue-700" : "bg-slate-200 text-black border-slate-500 hover:bg-slate-300")}
          >
            Show deleted Records
          </button>
          <button
            onClick={() => { setShowOutstanding(!showOutstanding); setSelectedIndex(0); }}
            className={cn("h-6 px-2 text-[10px] font-bold rounded border transition", showOutstanding ? "bg-blue-500 text-white border-blue-700" : "bg-slate-200 text-black border-slate-500 hover:bg-slate-300")}
          >
            Show Outstanding
          </button>
        </div>

        {/* ===== Data Grid — 6 columns matching ezi-solution ===== */}
        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          {/* Column Headers — blue-grey background */}
          <div
            className="flex-shrink-0 grid gap-0 px-1 py-1 text-[10px] font-bold text-white"
            style={{ backgroundColor: '#7B8FA6', gridTemplateColumns: '70px 1fr 1.4fr 100px 100px 110px' }}
          >
            <div className="px-1">Code</div>
            <div className="px-1">Clients Name</div>
            <div className="px-1">Address</div>
            <div className="px-1">Mobile</div>
            <div className="px-1">Telephone</div>
            <div className="px-1 text-right">Balance</div>
          </div>

          {/* Rows — scrollable */}
          <ScrollArea className="flex-1 min-h-0">
            <div>
              {sorted.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-xs">
                  <FileText className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  No suppliers found{query ? ` for "${query}"` : ''}
                </div>
              ) : (
                sorted.map((s, idx) => {
                  const isSelected = idx === selectedIndex;
                  const isOutstanding = Math.abs(s.balance || 0) > 0.01;
                  const isNegative = (s.balance || 0) < 0;
                  const isBlacklisted = !!s.blacklist;
                  const bg = isSelected
                    ? '#D6E8FF'
                    : isBlacklisted
                    ? '#FECACA'  // light rose for blacklisted
                    : isOutstanding
                    ? '#FFE4E1'
                    : idx % 2 === 1
                    ? '#F0F0F0'
                    : '#FFFFFF';
                  return (
                    <div
                      key={s.id}
                      onClick={() => setSelectedIndex(idx)}
                      onDoubleClick={() => { onSelect(s); onClose(); }}
                      className="grid gap-0 px-1 py-0.5 text-[10px] cursor-pointer border-b border-slate-100"
                      style={{ backgroundColor: bg, gridTemplateColumns: '70px 1fr 1.4fr 100px 100px 110px' }}
                    >
                      <div className="px-1 font-mono text-slate-700">{s.code}</div>
                      <div className="px-1 truncate font-medium text-slate-900 flex items-center gap-1">
                        <span className="truncate">{s.name}</span>
                        {/* Rating stars (compact) */}
                        {(s.rating || 0) > 0 && (
                          <span className="text-amber-500 text-[9px] flex-shrink-0" title={`${s.rating}/5 stars`}>
                            {'★'.repeat(s.rating || 0)}
                          </span>
                        )}
                        {/* Blacklist pill */}
                        {isBlacklisted && (
                          <span className="px-1 py-0 rounded bg-rose-600 text-white text-[8px] font-bold flex-shrink-0" title={s.blacklistReason || 'Blacklisted'}>
                            BL
                          </span>
                        )}
                      </div>
                      <div className="px-1 truncate text-slate-600">{[s.address, s.city].filter(Boolean).join(', ') || '—'}</div>
                      <div className="px-1 font-mono text-slate-600">{s.mobile || s.phone || '—'}</div>
                      <div className="px-1 font-mono text-slate-600">{s.phone || '—'}</div>
                      <div className={cn("px-1 text-right font-mono font-semibold", isNegative ? "text-rose-700" : isOutstanding ? "text-rose-600" : "text-slate-700")}>
                        {(s.balance || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </div>

        {/* ===== Status Bar — dark blue, totals on left + balance sum on right ===== */}
        <div className="flex-shrink-0 px-3 py-1 text-[10px] text-white flex items-center justify-between" style={{ background: 'linear-gradient(to bottom, #004488, #003366)' }}>
          <div className="flex items-center gap-4 font-bold">
            <span>Total= {filteredCount}</span>
            <span>Outstanding= {outstandingCount}</span>
          </div>
          <div className="font-mono font-bold">
            {totalBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>

        {/* ===== Action Toolbar — 10 icon buttons matching ezi-solution ===== */}
        <div className="flex-shrink-0 px-2 py-2 flex items-center gap-1 border-t border-slate-300 bg-white overflow-x-auto">
          <IconButton label="Select" shortcut="Enter" color="#4CAF50" onClick={handleSelect} disabled={!selectedSupplier} icon={<Check className="h-4 w-4 text-white" />} />
          <IconButton label="New" color="#2196F3" onClick={onNew} icon={<Plus className="h-4 w-4 text-white" />} />
          <IconButton label="Notes" color="#9C27B0" onClick={() => selectedSupplier ? (onNotes ? onNotes(selectedSupplier) : toast({ title: "Notes", description: selectedSupplier.notes || 'No notes for this supplier' })) : toast({ title: "Select a supplier first", variant: "destructive" })} disabled={!selectedSupplier} icon={<StickyNote className="h-4 w-4 text-white" />} />
          <IconButton label="History" color="#2196F3" onClick={() => selectedSupplier ? (onHistory ? onHistory(selectedSupplier) : toast({ title: "History", description: `Transaction history for ${selectedSupplier.name}` })) : toast({ title: "Select a supplier first", variant: "destructive" })} disabled={!selectedSupplier} icon={<Hash className="h-4 w-4 text-white" />} />
          <IconButton label="Price History" color="#7C3AED" onClick={() => selectedSupplier ? (onPriceHistory ? onPriceHistory(selectedSupplier) : toast({ title: "Price History", description: `Cost trend for ${selectedSupplier.name}` })) : toast({ title: "Select a supplier first", variant: "destructive" })} disabled={!selectedSupplier} icon={<TrendingUp className="h-4 w-4 text-white" />} />
          <IconButton label="Edit" color="#EA580C" onClick={() => selectedSupplier ? (onEdit ? onEdit(selectedSupplier) : toast({ title: "Edit", description: `Edit ${selectedSupplier.name}` })) : toast({ title: "Select a supplier first", variant: "destructive" })} disabled={!selectedSupplier || !canEditSupplier} icon={<Edit2 className="h-4 w-4 text-white" />} />
          <IconButton label="Delete" color="#DC2626" onClick={() => selectedSupplier ? (onDelete ? onDelete(selectedSupplier) : toast({ title: "Delete", description: `Deactivate ${selectedSupplier.name}` })) : toast({ title: "Select a supplier first", variant: "destructive" })} disabled={!selectedSupplier || !canEditSupplier} icon={<Trash2 className="h-4 w-4 text-white" />} />
          <IconButton label="Mail" color="#2196F3" onClick={() => selectedSupplier ? (onEmail ? onEmail(selectedSupplier) : toast({ title: "Mail", description: `Compose email to ${selectedSupplier.name}` })) : toast({ title: "Select a supplier first", variant: "destructive" })} disabled={!selectedSupplier} icon={<Mail className="h-4 w-4 text-white" />} />
          <IconButton label="Email" color="#4CAF50" onClick={() => selectedSupplier ? (onEmail ? onEmail(selectedSupplier) : toast({ title: "Email", description: `Send email to ${selectedSupplier.email || '(no email on file)'}` })) : toast({ title: "Select a supplier first", variant: "destructive" })} disabled={!selectedSupplier} icon={<Mail className="h-4 w-4 text-white" />} />
          <IconButton label="Labels" color="#2196F3" onClick={() => selectedSupplier ? toast({ title: "Labels", description: `Print address labels for ${selectedSupplier.name}` }) : toast({ title: "Select a supplier first", variant: "destructive" })} disabled={!selectedSupplier} icon={<FileText className="h-4 w-4 text-white" />} />
          <IconButton label="Envelope" shortcut="F3" color="#2196F3" onClick={() => selectedSupplier ? toast({ title: "Envelope (F3)", description: `Print envelope for ${selectedSupplier.name}` }) : toast({ title: "Select a supplier first", variant: "destructive" })} disabled={!selectedSupplier} icon={<Printer className="h-4 w-4 text-white" />} />
          <div className="flex-1" />
          {/* Bulk Edit — admin/manager only. Applies changes to ALL filtered suppliers. */}
          {canEditSupplier && (
            <IconButton
              label="Bulk Edit"
              color="#7C3AED"
              onClick={() => onBulkEdit ? onBulkEdit() : toast({ title: "Bulk Edit", description: `Apply rating/blacklist/TIN to all ${sorted.length} filtered suppliers` })}
              disabled={sorted.length === 0}
              icon={<TrendingUp className="h-4 w-4 text-white" />}
            />
          )}
          <IconButton label="Close" shortcut="Esc" color="#F44336" onClick={onClose} icon={<X className="h-4 w-4 text-white" />} />
        </div>
      </motion.div>
    </motion.div>
  );
}
// ===== New / Edit Supplier Popup =====
function NewSupplierPopup({ onSave, onClose, editSupplier }: { onSave: (s: Supplier) => void; onClose: () => void; editSupplier?: Supplier | null; }) {
  const { toast } = useToast();
  const [tab, setTab] = useState<"trading" | "compliance" | "banking" | "payment" | "history" | "notes">("trading");
  const isEditMode = !!editSupplier;
  const [form, setForm] = useState<Supplier>(editSupplier || {
    id: `s-${Date.now()}`, code: String(Date.now()).slice(-5), name: "", address: "", city: "", state: "", country: "Ghana", phone: "", mobile: "", fax: "", email: "", contactName: "", businessNo: "", title: "Mr", tradingTerms: "Net 30", creditLimit: 0, balance: 0, taxInclusive: false, notes: "",
    // Tier 1 defaults
    rating: 0, blacklist: false, blacklistReason: "", tin: "",
    bankName: "", bankAccountName: "", bankAccountNo: "", bankBranchCode: "",
    mobileMoneyProvider: "", mobileMoneyNumber: "",
    earlyPayDiscountPct: 0, earlyPayDays: 0, netDays: 30,
  });

  const handleSave = () => {
    if (!form.name) { toast({ title: "Supplier name is required", variant: "destructive" }); return; }
    onSave(form);
    // ALWAYS close the popup after Save — the parent's onSave handler
    // may also close it, but this ensures the popup closes even if the
    // handler throws or returns early.
    onClose();
  };

  const field = (label: string, key: keyof Supplier, type = "text", placeholder = "") => (
    <div>
      <label className="text-[9px] font-semibold text-slate-600 mb-0.5 block">{label}</label>
      <input type={type} value={form[key] as any} onChange={(e) => setForm({ ...form, [key]: type === "number" ? parseFloat(e.target.value) || 0 : e.target.value })} placeholder={placeholder} className="w-full h-7 px-2 text-[10px] border border-slate-300 rounded outline-none focus:ring-1 focus:ring-blue-400" />
    </div>
  );

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60]" onClick={onClose}>
      <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }} onClick={(e) => e.stopPropagation()} className="bg-white rounded-lg shadow-2xl overflow-hidden flex flex-col w-full" style={{ width: '100%', maxWidth: '680px', maxHeight: '85vh', fontFamily: 'Arial, Helvetica, sans-serif' }}>
        {/* Title Bar */}
        <div className="flex-shrink-0 flex items-center justify-between px-3 h-7 text-white" style={{ backgroundColor: BLUE }}>
          <span className="text-xs font-bold">{isEditMode ? `Edit Supplier — ${editSupplier?.name}` : "New Supplier"}</span>
          <button onClick={onClose} className="h-5 w-5 rounded bg-red-600 hover:bg-red-700 flex items-center justify-center transition"><X className="h-3 w-3 text-white" /></button>
        </div>
        {/* Top Header Row */}
        <div className="flex-shrink-0 px-3 py-2 bg-slate-50 border-b border-slate-200 grid grid-cols-4 gap-2">
          <div><label className="text-[9px] font-semibold text-slate-600 mb-0.5 block">Supplier Code</label><input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className="w-full h-7 px-2 text-[10px] font-mono border border-slate-300 rounded outline-none focus:ring-1 focus:ring-blue-400" /></div>
          <div><label className="text-[9px] font-semibold text-slate-600 mb-0.5 block">Title</label><select value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full h-7 px-2 text-[10px] border border-slate-300 rounded outline-none focus:ring-1 focus:ring-blue-400"><option>Mr</option><option>Mrs</option><option>Ms</option><option>Dr</option><option>Company</option></select></div>
          <div><label className="text-[9px] font-semibold text-slate-600 mb-0.5 block">Supplier Name</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Enter name" className="w-full h-7 px-2 text-[10px] border border-slate-300 rounded outline-none focus:ring-1 focus:ring-blue-400" /></div>
          <div><label className="text-[9px] font-semibold text-slate-600 mb-0.5 block">Business No.</label><input value={form.businessNo} onChange={(e) => setForm({ ...form, businessNo: e.target.value })} placeholder="BN-XXX" className="w-full h-7 px-2 text-[10px] font-mono border border-slate-300 rounded outline-none focus:ring-1 focus:ring-blue-400" /></div>
        </div>
        {/* Tabs */}
        <div className="flex-shrink-0 flex border-b border-slate-200 overflow-x-auto scrollbar-hide" style={{ backgroundColor: '#5B9BD5' }}>
          {([
            ["trading", "Trading"],
            ["compliance", "Compliance"],
            ["banking", "Banking"],
            ["payment", "Payment Terms"],
            ["history", "History"],
            ["notes", "Notes"],
          ] as const).map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} className={cn("px-3 py-1 text-[10px] font-bold text-white transition whitespace-nowrap", tab === id ? "bg-white/25 text-white" : "bg-white/10 text-white/70 hover:bg-white/20 hover:text-white")}>{label}</button>
          ))}
        </div>
        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-3" style={{ scrollbarWidth: 'thin' }}>
          {tab === "trading" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                {field("Address", "address")}
                {field("City", "city")}
                {field("State / Code", "state")}
                {field("Country", "country")}
                {field("Delivery", "address", "text", "Same as address")}
                {field("Contact Name", "contactName")}
              </div>
              <div className="space-y-2">
                {field("Telephone", "phone", "tel")}
                {field("Mobile", "mobile", "tel")}
                {field("Fax", "fax")}
                {field("Email", "email", "email", "supplier@email.com")}
                {field("Trading Terms", "tradingTerms")}
                <div><label className="text-[9px] font-semibold text-slate-600 mb-0.5 block">Credit Limit (GHC)</label><input type="number" value={form.creditLimit || ''} onChange={(e) => setForm({ ...form, creditLimit: parseFloat(e.target.value) || 0 })} className="w-full h-7 px-2 text-[10px] font-mono border border-slate-300 rounded outline-none focus:ring-1 focus:ring-blue-400" placeholder="0" /></div>
                <label className="flex items-center gap-1.5 text-[10px] text-slate-700 cursor-pointer"><input type="checkbox" checked={form.taxInclusive} onChange={(e) => setForm({ ...form, taxInclusive: e.target.checked })} className="h-3 w-3 accent-blue-600" /> Tax Inclusive</label>
              </div>
            </div>
          )}
          {tab === "compliance" && (
            <div className="space-y-3">
              {/* Rating — interactive star picker */}
              <div>
                <label className="text-[9px] font-semibold text-slate-600 mb-1 block">Supplier Rating (1-5 stars)</label>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map(i => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setForm({ ...form, rating: form.rating === i ? 0 : i })}
                      className="text-lg leading-none transition hover:scale-110"
                      title={`${i} star${i > 1 ? "s" : ""}`}
                    >
                      <span className={i <= (form.rating || 0) ? "text-amber-400" : "text-slate-300"}>★</span>
                    </button>
                  ))}
                  <span className="text-[10px] text-slate-500 ml-2">
                    {form.rating ? `${form.rating}/5` : "Unrated"}
                  </span>
                </div>
                <div className="text-[9px] text-slate-400 mt-1">Used by the Performance scorecard. 0 = unrated (auto-computed from PO history).</div>
              </div>

              {/* TIN */}
              <div>
                <label className="text-[9px] font-semibold text-slate-600 mb-0.5 block">TIN (Taxpayer Identification Number) — GRA</label>
                <input
                  value={form.tin || ""}
                  onChange={(e) => setForm({ ...form, tin: e.target.value.toUpperCase() })}
                  placeholder="C0001234567"
                  className="w-full h-7 px-2 text-[10px] font-mono border border-slate-300 rounded outline-none focus:ring-1 focus:ring-blue-400"
                />
                <div className="text-[9px] text-slate-400 mt-0.5">11-character Ghana TIN. Required for WHT calculation and GRA e-VAT filing.</div>
              </div>

              {/* Blacklist toggle */}
              <div className="bg-rose-50 ring-1 ring-rose-200 rounded p-2">
                <label className="flex items-center gap-2 text-[10px] text-rose-900 font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.blacklist || false}
                    onChange={(e) => setForm({ ...form, blacklist: e.target.checked })}
                    className="h-3.5 w-3.5 accent-rose-600"
                  />
                  ⚠️ Blacklist this supplier
                </label>
                <div className="text-[9px] text-rose-700 mt-0.5">When enabled, a red warning banner appears in the Purchase Form when this supplier is selected.</div>
                {(form.blacklist) && (
                  <input
                    value={form.blacklistReason || ""}
                    onChange={(e) => setForm({ ...form, blacklistReason: e.target.value })}
                    placeholder="Reason for blacklisting (e.g. 'Consistent late deliveries', 'Quality issues')"
                    className="w-full h-7 px-2 text-[10px] border border-rose-300 rounded outline-none focus:ring-1 focus:ring-rose-400 mt-2 bg-white"
                  />
                )}
              </div>
            </div>
          )}
          {tab === "banking" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <div>
                  <label className="text-[9px] font-semibold text-slate-600 mb-0.5 block">Bank Name</label>
                  <input value={form.bankName || ""} onChange={(e) => setForm({ ...form, bankName: e.target.value })} placeholder="e.g. Ecobank Ghana" className="w-full h-7 px-2 text-[10px] border border-slate-300 rounded outline-none focus:ring-1 focus:ring-blue-400" />
                </div>
                <div>
                  <label className="text-[9px] font-semibold text-slate-600 mb-0.5 block">Account Name</label>
                  <input value={form.bankAccountName || ""} onChange={(e) => setForm({ ...form, bankAccountName: e.target.value })} placeholder="Account holder name" className="w-full h-7 px-2 text-[10px] border border-slate-300 rounded outline-none focus:ring-1 focus:ring-blue-400" />
                </div>
                <div>
                  <label className="text-[9px] font-semibold text-slate-600 mb-0.5 block">Account Number</label>
                  <input value={form.bankAccountNo || ""} onChange={(e) => setForm({ ...form, bankAccountNo: e.target.value })} placeholder="1234567890123" className="w-full h-7 px-2 text-[10px] font-mono border border-slate-300 rounded outline-none focus:ring-1 focus:ring-blue-400" />
                </div>
                <div>
                  <label className="text-[9px] font-semibold text-slate-600 mb-0.5 block">Branch Code</label>
                  <input value={form.bankBranchCode || ""} onChange={(e) => setForm({ ...form, bankBranchCode: e.target.value })} placeholder="BR-001" className="w-full h-7 px-2 text-[10px] font-mono border border-slate-300 rounded outline-none focus:ring-1 focus:ring-blue-400" />
                </div>
              </div>
              <div className="space-y-2">
                <div>
                  <label className="text-[9px] font-semibold text-slate-600 mb-0.5 block">Mobile Money Provider</label>
                  <select
                    value={form.mobileMoneyProvider || ""}
                    onChange={(e) => setForm({ ...form, mobileMoneyProvider: e.target.value })}
                    className="w-full h-7 px-2 text-[10px] border border-slate-300 rounded outline-none focus:ring-1 focus:ring-blue-400"
                  >
                    <option value="">— None —</option>
                    <option value="MTN">MTN MoMo</option>
                    <option value="Telecel">Telecel Cash</option>
                    <option value="AirtelTigo">AirtelTigo Money</option>
                  </select>
                </div>
                <div>
                  <label className="text-[9px] font-semibold text-slate-600 mb-0.5 block">MoMo Number</label>
                  <input
                    type="tel"
                    value={form.mobileMoneyNumber || ""}
                    onChange={(e) => setForm({ ...form, mobileMoneyNumber: e.target.value })}
                    placeholder="+233247075044"
                    className="w-full h-7 px-2 text-[10px] font-mono border border-slate-300 rounded outline-none focus:ring-1 focus:ring-blue-400"
                  />
                </div>
                <div className="text-[9px] text-slate-500 bg-blue-50 ring-1 ring-blue-200 rounded p-2 mt-2">
                  💡 Bank details are used by the Purchase Hub → Payments tab for one-tap payment reference. MoMo number is also used when sending POs via WhatsApp.
                </div>
              </div>
            </div>
          )}
          {tab === "payment" && (
            <div className="space-y-3">
              <div className="text-[10px] text-slate-600 bg-amber-50 ring-1 ring-amber-200 rounded p-2">
                💰 <strong>Early-Payment Discount Terms</strong> — If this supplier offers a discount for early payment (e.g. "2/10 net 30" = 2% off if paid within 10 days, otherwise full amount due in 30 days), enter the structured values below. The Purchase Hub → Payments tab auto-calculates the discount and shows how much you save by paying early.
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[9px] font-semibold text-slate-600 mb-0.5 block">Early-Pay Discount %</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={form.earlyPayDiscountPct ?? 0}
                    onChange={(e) => setForm({ ...form, earlyPayDiscountPct: parseFloat(e.target.value) || 0 })}
                    placeholder="2"
                    className="w-full h-7 px-2 text-[10px] font-mono border border-slate-300 rounded outline-none focus:ring-1 focus:ring-blue-400"
                  />
                  <div className="text-[9px] text-slate-400 mt-0.5">0 = no discount offered</div>
                </div>
                <div>
                  <label className="text-[9px] font-semibold text-slate-600 mb-0.5 block">Early-Pay Window (days)</label>
                  <input
                    type="number"
                    min="0"
                    max="365"
                    value={form.earlyPayDays ?? 0}
                    onChange={(e) => setForm({ ...form, earlyPayDays: parseInt(e.target.value) || 0 })}
                    placeholder="10"
                    className="w-full h-7 px-2 text-[10px] font-mono border border-slate-300 rounded outline-none focus:ring-1 focus:ring-blue-400"
                  />
                  <div className="text-[9px] text-slate-400 mt-0.5">Pay within this many days to get the discount</div>
                </div>
                <div>
                  <label className="text-[9px] font-semibold text-slate-600 mb-0.5 block">Net Days (full due)</label>
                  <input
                    type="number"
                    min="0"
                    max="365"
                    value={form.netDays ?? 30}
                    onChange={(e) => setForm({ ...form, netDays: parseInt(e.target.value) || 30 })}
                    placeholder="30"
                    className="w-full h-7 px-2 text-[10px] font-mono border border-slate-300 rounded outline-none focus:ring-1 focus:ring-blue-400"
                  />
                  <div className="text-[9px] text-slate-400 mt-0.5">Full payment due within this many days</div>
                </div>
              </div>
              {/* Live preview */}
              {(form.earlyPayDiscountPct ?? 0) > 0 && (form.earlyPayDays ?? 0) > 0 && (
                <div className="bg-gradient-to-br from-amber-50 to-yellow-50 ring-1 ring-amber-200 rounded p-2.5">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Example</div>
                  <div className="text-[10px] text-amber-900 mt-1">
                    On a ₵1,000 invoice: pay <strong>₵{(1000 * (1 - (form.earlyPayDiscountPct || 0) / 100)).toFixed(2)}</strong> within <strong>{form.earlyPayDays} days</strong> (save ₵{(1000 * (form.earlyPayDiscountPct || 0) / 100).toFixed(2)}), or pay full ₵1,000.00 within <strong>{form.netDays} days</strong>.
                  </div>
                </div>
              )}
              <div className="text-[9px] text-slate-500">
                ℹ️ The free-text "Trading Terms" field on the Trading tab is preserved for backward compatibility, but the structured values here drive the auto-calculation in the Payments tab.
              </div>
            </div>
          )}
          {tab === "history" && <div className="text-center py-8 text-slate-400 text-xs">No transaction history yet. Save the supplier first to start tracking.</div>}
          {tab === "notes" && <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={8} placeholder="Enter notes about this supplier..." className="w-full text-[10px] border border-slate-300 rounded p-2 outline-none focus:ring-1 focus:ring-blue-400 resize-none" />}
        </div>
        {/* Action Buttons */}
        <div className="flex-shrink-0 px-3 py-1.5 flex items-center justify-end gap-2 border-t border-slate-300" style={{ backgroundColor: '#F0F0F0' }}>
          <button onClick={onClose} className="h-7 px-3 rounded text-white text-[10px] font-semibold flex items-center gap-1 transition" style={{ backgroundColor: '#F44336' }}><X className="h-3 w-3" /> Close (Esc)</button>
          <button type="button" onClick={handleSave} disabled={!form.name} className="h-7 px-3 rounded text-white text-[10px] font-semibold flex items-center gap-1 transition disabled:opacity-50" style={{ backgroundColor: BLUE }}><Save className="h-3 w-3" /> {isEditMode ? "Update (F2)" : "Save (F2)"}</button>
        </div>
      </motion.div>
    </motion.div>
  );
}
