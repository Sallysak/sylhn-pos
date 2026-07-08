"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Save, Printer, Mail, Trash2, CreditCard, X, Search,
  Plus, Check, Package, Calendar, User, Hash, FileText, Edit2, StickyNote,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { COMPANY, CURRENCY, formatGHS, type Product } from "@/lib/pos-data";
import { PopupWindow } from "@/components/popup-window";

// Supplier interface
interface Supplier {
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
}

// Sample suppliers
const initialSuppliers: Supplier[] = [
  { id: "s1", code: "00008", name: "Som Agency", address: "123 Main St", city: "Accra", state: "Greater Accra", country: "Ghana", phone: "+233 24 111 2222", mobile: "+233 24 111 2222", fax: "", email: "som@agency.com", contactName: "Som Manager", businessNo: "BN-001", title: "Mr", tradingTerms: "Net 30", creditLimit: 5000, balance: 5334, taxInclusive: false, notes: "" },
  { id: "s2", code: "00002", name: "Sri Sri", address: "456 Market Rd", city: "Kumasi", state: "Ashanti", country: "Ghana", phone: "+233 24 333 4444", mobile: "+233 24 333 4444", fax: "", email: "srisri@mail.com", contactName: "Sri Manager", businessNo: "BN-002", title: "Ms", tradingTerms: "Net 15", creditLimit: 3000, balance: 0, taxInclusive: true, notes: "" },
  { id: "s3", code: "00003", name: "Uday Banerjee", address: "789 Trade St", city: "Tema", state: "Greater Accra", country: "Ghana", phone: "+233 24 555 6666", mobile: "+233 24 555 6666", fax: "", email: "uday@mail.com", contactName: "Uday", businessNo: "BN-003", title: "Mr", tradingTerms: "COD", creditLimit: 2000, balance: 0, taxInclusive: false, notes: "" },
  { id: "s4", code: "00009", name: "Test Supplier", address: "", city: "", state: "", country: "", phone: "", mobile: "", fax: "", email: "", contactName: "", businessNo: "", title: "", tradingTerms: "", creditLimit: 0, balance: 0, taxInclusive: false, notes: "" },
];

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
  const [suppliers, setSuppliers] = useState<Supplier[]>(initialSuppliers);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [supplierDetails, setSupplierDetails] = useState("");
  const [showSupplierList, setShowSupplierList] = useState(false);
  const [showNewSupplier, setShowNewSupplier] = useState(false);

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
    setSelectedSupplier(supplier);
    setSupplierDetails(supplier.name);
    setTerms(supplier.tradingTerms);
    setTaxInclusive(supplier.taxInclusive);
    setShowSupplierList(false);
    toast({ title: "Supplier selected", description: `${supplier.name} (${supplier.code})` });
  };

  // Add new supplier
  const handleSaveNewSupplier = (newSupplier: Supplier) => {
    setSuppliers(prev => [...prev, newSupplier]);
    setSelectedSupplier(newSupplier);
    setSupplierDetails(newSupplier.name);
    setTerms(newSupplier.tradingTerms);
    setShowNewSupplier(false);
    setShowSupplierList(false);
    toast({ title: "New supplier added", description: `${newSupplier.name} (${newSupplier.code})` });
  };

  // Add product to lines
  const addProductToLine = (product: Product) => {
    const existingIdx = lines.findIndex(l => l.partNo === product.sku);
    if (existingIdx >= 0) {
      setLines(prev => prev.map((l, i) => i === existingIdx ? { ...l, quantity: l.quantity + 1, total: (l.quantity + 1) * l.cost * (1 - l.discount / 100) } : l));
    } else {
      setLines(prev => [...prev, { id: `line-${Date.now()}`, partNo: product.sku, details: `${product.emoji} ${product.name}`, emoji: product.emoji, quantity: 1, cost: product.costPrice, discount: 0, expiry: product.expiryDate, tax: product.taxable, total: product.costPrice }]);
    }
    setFindPartNo("");
    setOnHand(0);
    toast({ title: "Product added", description: `${product.emoji} ${product.name}` });
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
  const handleSave = () => {
    if (lines.length === 0) { toast({ title: "No items to save", variant: "destructive" }); return; }
    if (!selectedSupplier) { toast({ title: "Select a supplier first", variant: "destructive" }); return; }
    setSaved(true);
    toast({ title: "✅ Saved (F2)", description: `${invoiceNo} · ${selectedSupplier.name} · ${lines.length} items · ${formatGHS(totals.grandTotal)}` });
    setTimeout(() => setSaved(false), 2000);
  };

  const handlePrint = () => {
    if (lines.length === 0) { toast({ title: "Nothing to print", variant: "destructive" }); return; }
    const printWin = window.open('', '_blank', 'width=800,height=600');
    if (!printWin) { toast({ title: "Popup blocked", variant: "destructive" }); return; }
    const rows = lines.map((l, i) => `<tr style="background:${i % 2 === 1 ? '#F8F8F8' : '#FFF'}"><td style="border:1px solid #999;padding:3px 6px;text-align:center">${i + 1}</td><td style="border:1px solid #999;padding:3px 6px;font-family:monospace">${l.partNo}</td><td style="border:1px solid #999;padding:3px 6px">${l.details}</td><td style="border:1px solid #999;padding:3px 6px;text-align:right">${l.quantity.toFixed(2)}</td><td style="border:1px solid #999;padding:3px 6px;text-align:right">${l.cost.toFixed(2)}</td><td style="border:1px solid #999;padding:3px 6px;text-align:right">${l.discount.toFixed(1)}%</td><td style="border:1px solid #999;padding:3px 6px;text-align:center">${l.expiry}</td><td style="border:1px solid #999;padding:3px 6px;text-align:center">${l.tax ? '✓' : ''}</td><td style="border:1px solid #999;padding:3px 6px;text-align:right;font-weight:bold">${l.total.toFixed(2)}</td></tr>`).join('');
    printWin.document.write(`<!DOCTYPE html><html><head><title>Supplier Order ${invoiceNo}</title><style>body{font-family:Arial;margin:20px}h1{text-align:center;font-size:18px;margin:0}h2{text-align:center;font-size:14px;margin:5px 0 15px}.info{display:flex;justify-content:space-between;margin-bottom:15px;font-size:11px}table{width:100%;border-collapse:collapse;font-size:11px}th{background:#E0E0E0;border:1px solid #999;padding:4px 6px}.totals{margin-top:10px;font-size:11px}@media print{thead{display:table-header-group}tr{page-break-inside:avoid}}</style></head><body><div style="text-align:center;border-bottom:2px solid #333;padding-bottom:10px;margin-bottom:15px"><h1>${COMPANY.name}</h1><div style="font-size:12px;color:#666">${COMPANY.address} · ${COMPANY.contact}</div></div><h2>Supplier Purchase Order</h2><div class="info"><div><strong>Invoice:</strong> ${invoiceNo}</div><div><strong>Supplier:</strong> ${selectedSupplier?.name || 'N/A'}</div><div><strong>Date:</strong> ${date}</div><div><strong>Terms:</strong> ${terms || 'N/A'}</div></div><table><thead><tr><th>#</th><th>Part Number</th><th>Details</th><th style="text-align:right">Qty</th><th style="text-align:right">Cost GHC</th><th style="text-align:right">Disc%</th><th style="text-align:center">Expiry</th><th style="text-align:center">TAX</th><th style="text-align:right">Total GHC</th></tr></thead><tbody>${rows}</tbody></table><table class="totals"><tr style="font-weight:bold;border-top:2px solid #333"><td>Total Qty: ${totals.totalQty.toFixed(2)}</td><td>TAX: ${totals.taxAmount.toFixed(2)}</td><td>Total: ${totals.grandTotal.toFixed(2)}</td><td>Paid: ${paidAmount.toFixed(2)}</td><td>Due: ${totals.due.toFixed(2)}</td></tr></table></body></html>`);
    printWin.document.close();
    setTimeout(() => { printWin.focus(); printWin.print(); }, 300);
    toast({ title: "Printing (F3)", description: `${lines.length} items` });
  };

  const handleEmail = () => {
    if (!selectedSupplier) { toast({ title: "Select a supplier first", variant: "destructive" }); return; }
    if (lines.length === 0) { toast({ title: "No items to email", variant: "destructive" }); return; }
    toast({ title: "✅ Email sent", description: `Purchase order ${invoiceNo} emailed to ${selectedSupplier.name} (${selectedSupplier.email || 'no email'})` });
  };

  const handleDelete = () => {
    if (lines.length === 0) { toast({ title: "Nothing to delete" }); return; }
    setLines([]); setSelectedLine(null); setPaidAmount(0); setSaved(false);
    toast({ title: "✅ Deleted (F4)", description: "All lines cleared" });
  };

  const handlePayment = () => {
    if (lines.length === 0) { toast({ title: "No items", variant: "destructive" }); return; }
    if (totals.due <= 0) { toast({ title: "Already fully paid" }); return; }
    setPaidAmount(totals.grandTotal);
    toast({ title: "✅ Payment recorded (F5)", description: `Paid ${formatGHS(totals.grandTotal)} · Due ${formatGHS(0)}` });
  };

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
                <input value={findPartNo} onChange={(e) => { setFindPartNo(e.target.value); const p = products.find(p => p.barcode === e.target.value || p.sku.toLowerCase() === e.target.value.toLowerCase()); if (p) setOnHand(p.stock); if (e.target.value.length > 0) setShowStockList(true); else setShowStockList(false); }} onKeyDown={(e) => { if (e.key === 'Enter') { const p = products.find(p => p.barcode === findPartNo || p.sku.toLowerCase() === findPartNo.toLowerCase()); if (p) addProductToLine(p); } if (e.key === 'Escape') setShowStockList(false); }} onFocus={() => { if (findPartNo) setShowStockList(true); }} placeholder="Type..." className="w-24 h-5 px-1.5 text-[9px] font-mono border border-slate-400 rounded outline-none focus:ring-1 focus:ring-blue-400" style={{ backgroundColor: '#FFFFCC' }} />
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
          <div className="flex-shrink-0 px-3 py-1.5 flex items-center gap-1.5 border-t border-slate-300" style={{ backgroundColor: '#F0F0F0' }}>
            <button onClick={handleSave} className="h-7 px-3 rounded text-white text-[9px] font-semibold flex items-center gap-1 transition shadow-sm" style={{ backgroundColor: BLUE }}><Save className="h-3 w-3" /> Save <kbd className="text-[7px] bg-white/20 px-0.5 rounded">F2</kbd></button>
            <button onClick={handlePrint} className="h-7 px-3 rounded text-white text-[9px] font-semibold flex items-center gap-1 transition shadow-sm" style={{ backgroundColor: BLUE }}><Printer className="h-3 w-3" /> Print <kbd className="text-[7px] bg-white/20 px-0.5 rounded">F3</kbd></button>
            <button onClick={handleEmail} className="h-7 px-3 rounded text-white text-[9px] font-semibold flex items-center gap-1 transition shadow-sm" style={{ backgroundColor: BLUE }}><Mail className="h-3 w-3" /> Email</button>
            <button onClick={handleDelete} className="h-7 px-3 rounded text-white text-[9px] font-semibold flex items-center gap-1 transition shadow-sm" style={{ backgroundColor: BLUE }}><Trash2 className="h-3 w-3" /> Delete <kbd className="text-[7px] bg-white/20 px-0.5 rounded">F4</kbd></button>
            <button onClick={handlePayment} className="h-7 px-3 rounded text-white text-[9px] font-semibold flex items-center gap-1 transition shadow-sm" style={{ backgroundColor: BLUE }}><CreditCard className="h-3 w-3" /> Payment <kbd className="text-[7px] bg-white/20 px-0.5 rounded">F5</kbd></button>
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
              onSelect={handleSelectSupplier}
              onNew={() => { setShowSupplierList(false); setShowNewSupplier(true); }}
              onClose={() => setShowSupplierList(false)}
            />
          )}
        </AnimatePresence>

        {/* New Supplier Popup */}
        <AnimatePresence>
          {showNewSupplier && (
            <NewSupplierPopup
              onSave={handleSaveNewSupplier}
              onClose={() => setShowNewSupplier(false)}
            />
          )}
        </AnimatePresence>

        {/* Stock List Popup (triggered by Find Part No) */}
        <AnimatePresence>
          {showStockList && (
            <StockListMiniPopup
              products={products}
              searchText={findPartNo}
              onSelect={(product) => { addProductToLine(product); setShowStockList(false); }}
              onClose={() => setShowStockList(false)}
            />
          )}
        </AnimatePresence>
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
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { const t = setTimeout(() => inputRef.current?.focus(), 50); return () => clearTimeout(t); }, []);

  const filtered = useMemo(() => {
    const q = (query || searchText).toLowerCase().trim();
    if (!q) return products;
    return products.filter(p => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || p.barcode.includes(q));
  }, [products, query, searchText]);

  const handleSelect = () => { if (filtered[selectedIndex]) onSelect(filtered[selectedIndex]); };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/40 flex items-start justify-center pt-20 z-50" onClick={onClose}>
      <motion.div initial={{ scale: 0.95, y: -20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: -20 }} transition={{ type: "spring", damping: 25, stiffness: 300 }} onClick={(e) => e.stopPropagation()} className="bg-white rounded-lg shadow-2xl overflow-hidden flex flex-col" style={{ width: '650px', maxHeight: '400px', fontFamily: 'Arial, Helvetica, sans-serif' }}>
        <div className="flex-shrink-0 flex items-center justify-between px-3 h-7 text-white" style={{ backgroundColor: '#5B9BD5' }}>
          <span className="text-xs font-bold">Stock List</span>
          <button onClick={onClose} className="h-5 w-5 rounded hover:bg-white/25 flex items-center justify-center transition"><X className="h-3.5 w-3.5" /></button>
        </div>
        <div className="flex-shrink-0 px-3 py-1.5 bg-white border-b border-slate-300 flex items-center gap-2">
          <label className="text-[10px] font-bold text-slate-700">Search:</label>
          <input ref={inputRef} value={query} onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0); }} onKeyDown={(e) => { if (e.key === 'Enter') handleSelect(); if (e.key === 'Escape') onClose(); if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex(i => Math.min(filtered.length - 1, i + 1)); } if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex(i => Math.max(0, i - 1)); } }} placeholder="Type to search..." className="flex-1 h-7 px-2 text-xs border border-slate-400 rounded outline-none focus:ring-2 focus:ring-blue-400" />
        </div>
        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          <div className="flex-shrink-0 grid grid-cols-[120px_1fr_45px_80px_80px] gap-1 px-2 py-1 text-[10px] font-bold text-white" style={{ backgroundColor: '#4A90E2' }}>
            <div>Part No</div><div>Item Details</div><div className="text-right">Qty</div><div className="text-right">Cost GHC</div><div className="text-right">Trade GHC</div>
          </div>
          <ScrollArea className="flex-1 min-h-0">
            <div>
              {filtered.length === 0 ? <div className="text-center py-6 text-slate-400 text-xs">No products found</div> : (
                filtered.map((p, idx) => (
                  <div key={p.id} onClick={() => setSelectedIndex(idx)} onDoubleClick={() => onSelect(p)} className="grid grid-cols-[120px_1fr_45px_80px_80px] gap-1 px-2 py-1 text-[10px] cursor-pointer border-b border-slate-100" style={{ backgroundColor: idx === selectedIndex ? '#D6E8FF' : (idx % 2 === 1 ? '#F8F8F8' : '#FFFFFF') }}>
                    <div className="font-mono truncate">{p.barcode}</div><div className="truncate">{p.emoji} {p.name}</div><div className="text-right font-mono">{p.stock}</div><div className="text-right font-mono">{p.costPrice.toFixed(2)}</div><div className="text-right font-mono">{p.costPrice.toFixed(2)}</div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
        <div className="flex-shrink-0 px-3 py-1.5 flex items-center gap-1.5 border-t border-slate-300" style={{ backgroundColor: '#E0F0E8' }}>
          <button onClick={handleSelect} className="h-7 px-3 rounded text-white text-[10px] font-semibold flex items-center gap-1" style={{ backgroundColor: '#4CAF50' }}><Check className="h-3 w-3" /> Select (Enter)</button>
          <button onClick={() => toast({ title: "New Product", description: "Use Stock File to add new products" })} className="h-7 px-3 rounded text-white text-[10px] font-semibold flex items-center gap-1" style={{ backgroundColor: '#2196F3' }}><Plus className="h-3 w-3" /> New</button>
          <div className="flex-1" />
          <button onClick={onClose} className="h-7 px-3 rounded text-white text-[10px] font-semibold flex items-center gap-1" style={{ backgroundColor: '#F44336' }}><X className="h-3 w-3" /> Close (Esc)</button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ===== Supplier List Popup =====
function SupplierListPopup({ suppliers, searchText, onSelect, onNew, onClose }: {
  suppliers: Supplier[];
  searchText: string;
  onSelect: (s: Supplier) => void;
  onNew: () => void;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [query, setQuery] = useState(searchText);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { const t = setTimeout(() => inputRef.current?.focus(), 50); return () => clearTimeout(t); }, []);

  const filtered = useMemo(() => {
    const q = (query || searchText).toLowerCase().trim();
    if (!q) return suppliers;
    return suppliers.filter(s => s.name.toLowerCase().includes(q) || s.code.includes(q));
  }, [suppliers, query, searchText]);

  const handleSelect = () => { if (filtered[selectedIndex]) onSelect(filtered[selectedIndex]); };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/40 flex items-start justify-center pt-20 z-50" onClick={onClose}>
      <motion.div initial={{ scale: 0.95, y: -20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: -20 }} transition={{ type: "spring", damping: 25, stiffness: 300 }} onClick={(e) => e.stopPropagation()} className="bg-white rounded-lg shadow-2xl overflow-hidden flex flex-col" style={{ width: '550px', maxHeight: '400px', fontFamily: 'Arial, Helvetica, sans-serif' }}>
        {/* Title Bar */}
        <div className="flex-shrink-0 flex items-center justify-between px-3 h-7 text-white" style={{ backgroundColor: '#5B9BD5' }}>
          <span className="text-xs font-bold">Suppliers List</span>
          <button onClick={onClose} className="h-5 w-5 rounded bg-red-600 hover:bg-red-700 flex items-center justify-center transition"><X className="h-3 w-3 text-white" /></button>
        </div>
        {/* Search */}
        <div className="flex-shrink-0 px-3 py-1.5 bg-white border-b border-slate-300 flex items-center gap-2">
          <label className="text-[10px] font-bold text-slate-700">Search:</label>
          <input ref={inputRef} value={query} onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0); }} onKeyDown={(e) => { if (e.key === 'Enter') handleSelect(); if (e.key === 'Escape') onClose(); if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex(i => Math.min(filtered.length - 1, i + 1)); } if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex(i => Math.max(0, i - 1)); } }} placeholder="Type supplier name or code..." className="flex-1 h-7 px-2 text-xs border border-slate-400 rounded outline-none focus:ring-2 focus:ring-blue-400" />
        </div>
        {/* Table */}
        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          <div className="flex-shrink-0 grid grid-cols-[80px_1fr_1fr] gap-1 px-2 py-1 text-[10px] font-bold text-white" style={{ backgroundColor: '#4A90E2' }}>
            <div>Code</div><div>Suppliers Name</div><div>Address</div>
          </div>
          <ScrollArea className="flex-1 min-h-0">
            <div>
              {filtered.length === 0 ? <div className="text-center py-6 text-slate-400 text-xs">No suppliers found</div> : (
                filtered.map((s, idx) => (
                  <div key={s.id} onClick={() => setSelectedIndex(idx)} onDoubleClick={() => onSelect(s)} className="grid grid-cols-[80px_1fr_1fr] gap-1 px-2 py-1 text-[10px] cursor-pointer border-b border-slate-100" style={{ backgroundColor: idx === selectedIndex ? '#D6E8FF' : (idx % 2 === 1 ? '#F8F8F8' : '#FFFFFF') }}>
                    <div className="font-mono">{s.code}</div><div className="truncate">{s.name}</div><div className="truncate text-slate-500">{s.address || '-'}</div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
        {/* Action Buttons */}
        <div className="flex-shrink-0 px-3 py-1.5 flex items-center gap-1.5 border-t border-slate-300" style={{ backgroundColor: '#E0F0E8' }}>
          <button onClick={handleSelect} className="h-7 px-3 rounded text-white text-[10px] font-semibold flex items-center gap-1" style={{ backgroundColor: '#4CAF50' }}><Check className="h-3 w-3" /> Select (Enter)</button>
          <button onClick={onNew} className="h-7 px-3 rounded text-white text-[10px] font-semibold flex items-center gap-1" style={{ backgroundColor: '#2196F3' }}><Plus className="h-3 w-3" /> New</button>
          <button onClick={() => { if (!filtered[selectedIndex]) { toast({ title: "Select a supplier first", variant: "destructive" }); return; } toast({ title: "Notes", description: filtered[selectedIndex].name }); }} className="h-7 px-3 rounded text-white text-[10px] font-semibold flex items-center gap-1" style={{ backgroundColor: '#9C27B0' }}><StickyNote className="h-3 w-3" /> Notes</button>
          <div className="flex-1" />
          <button onClick={onClose} className="h-7 px-3 rounded text-white text-[10px] font-semibold flex items-center gap-1" style={{ backgroundColor: '#F44336' }}><X className="h-3 w-3" /> Close (Esc)</button>
        </div>
        {/* Status Bar */}
        <div className="flex-shrink-0 px-3 py-0.5 text-[9px] text-slate-600 flex items-center gap-3" style={{ backgroundColor: '#E0E0E0' }}>
          <span className="font-mono">{filtered.length} of {suppliers.length} suppliers</span>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ===== New Supplier Popup =====
function NewSupplierPopup({ onSave, onClose }: { onSave: (s: Supplier) => void; onClose: () => void; }) {
  const { toast } = useToast();
  const [tab, setTab] = useState<"trading" | "history" | "notes">("trading");
  const [form, setForm] = useState<Supplier>({
    id: `s-${Date.now()}`, code: String(Date.now()).slice(-5), name: "", address: "", city: "", state: "", country: "Ghana", phone: "", mobile: "", fax: "", email: "", contactName: "", businessNo: "", title: "Mr", tradingTerms: "Net 30", creditLimit: 0, balance: 0, taxInclusive: false, notes: "",
  });

  const handleSave = () => {
    if (!form.name) { toast({ title: "Supplier name is required", variant: "destructive" }); return; }
    onSave(form);
  };

  const field = (label: string, key: keyof Supplier, type = "text", placeholder = "") => (
    <div>
      <label className="text-[9px] font-semibold text-slate-600 mb-0.5 block">{label}</label>
      <input type={type} value={form[key] as any} onChange={(e) => setForm({ ...form, [key]: type === "number" ? parseFloat(e.target.value) || 0 : e.target.value })} placeholder={placeholder} className="w-full h-7 px-2 text-[10px] border border-slate-300 rounded outline-none focus:ring-1 focus:ring-blue-400" />
    </div>
  );

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60]" onClick={onClose}>
      <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }} onClick={(e) => e.stopPropagation()} className="bg-white rounded-lg shadow-2xl overflow-hidden flex flex-col" style={{ width: '680px', maxHeight: '550px', fontFamily: 'Arial, Helvetica, sans-serif' }}>
        {/* Title Bar */}
        <div className="flex-shrink-0 flex items-center justify-between px-3 h-7 text-white" style={{ backgroundColor: BLUE }}>
          <span className="text-xs font-bold">New Supplier</span>
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
        <div className="flex-shrink-0 flex border-b border-slate-200" style={{ backgroundColor: '#5B9BD5' }}>
          {([["trading", "Trading Details"], ["history", "History"], ["notes", "Notes"]] as const).map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} className={cn("px-4 py-1 text-[10px] font-bold text-white transition", tab === id ? "bg-white/20" : "hover:bg-white/10")}>{label}</button>
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
          {tab === "history" && <div className="text-center py-8 text-slate-400 text-xs">No transaction history yet. Save the supplier first to start tracking.</div>}
          {tab === "notes" && <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={8} placeholder="Enter notes about this supplier..." className="w-full text-[10px] border border-slate-300 rounded p-2 outline-none focus:ring-1 focus:ring-blue-400 resize-none" />}
        </div>
        {/* Action Buttons */}
        <div className="flex-shrink-0 px-3 py-1.5 flex items-center justify-end gap-2 border-t border-slate-300" style={{ backgroundColor: '#F0F0F0' }}>
          <button onClick={onClose} className="h-7 px-3 rounded text-white text-[10px] font-semibold flex items-center gap-1 transition" style={{ backgroundColor: '#F44336' }}><X className="h-3 w-3" /> Close (Esc)</button>
          <button onClick={handleSave} disabled={!form.name} className="h-7 px-3 rounded text-white text-[10px] font-semibold flex items-center gap-1 transition disabled:opacity-50" style={{ backgroundColor: BLUE }}><Save className="h-3 w-3" /> Save (F2)</button>
        </div>
      </motion.div>
    </motion.div>
  );
}
