"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Truck, Users, X, Package, FileBarChart2, FileText,
  BookOpen, Calendar, RotateCcw, TrendingUp, DollarSign, Percent,
  History, CreditCard, Layers, Archive, ClipboardList,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { COMPANY, formatGHS, type Product } from "@/lib/pos-data";
import { PopupWindow } from "@/components/popup-window";
import { PurchaseListPopup, type PurchaseListRow } from "@/components/purchase-list-popup";
import { PurchaseOrderListPopup, type PurchaseOrderListRow } from "@/components/purchase-order-list-popup";

// ===== Light Blue Color Palette (matching reference image) =====
const LIGHT_BLUE_BG = '#D6E6F5';       // light blue main background
const HEADER_BLUE = '#1E5A8E';          // dark blue title bar / section header
const PANEL_BORDER = '#1E5A8E';         // dark blue borders
const ITEM_BG = '#F0F7FC';              // light item background
const ITEM_HOVER = '#B9D7EE';           // hover/selected state
const BTN_BLUE = '#2196F3';
const BTN_RED = '#F44336';

interface PurchaseMenuProps {
  onBack: () => void;
  products: Product[];
  onOpenPurchasingForm?: () => void;
  onOpenSupplierForm?: () => void;
}

// ===== Sample purchase transactions (linked to existing data) =====
const purchaseTransactions: PurchaseListRow[] = [
  { id: 'pt1', transactionType: '1-AgriCorp Ghana', invoiceNo: '1', date: '2026-01-02', amount: 540.00, paid: 540.00, due: 0 },
  { id: 'pt2', transactionType: '2-Global Foods GH', invoiceNo: '2', date: '2026-01-06', amount: 2436.00, paid: 2436.00, due: 0 },
  { id: 'pt3', transactionType: '3-Fan Milk Ghana', invoiceNo: '3', date: '2026-01-08', amount: 17415.00, paid: 16965.00, due: 450.00 },
  { id: 'pt4', transactionType: '4-Darko Farms', invoiceNo: '4', date: '2026-01-09', amount: 210.00, paid: 0, due: 210.00 },
  { id: 'pt5', transactionType: '5-Global Foods GH', invoiceNo: '5', date: '2026-01-12', amount: 1988.60, paid: 420.00, due: 1568.60 },
  { id: 'pt6', transactionType: '6-AgriCorp Ghana', invoiceNo: '6', date: '2026-01-13', amount: 100.00, paid: 0, due: 100.00 },
  { id: 'pt7', transactionType: '7-Unilever Ghana', invoiceNo: '7', date: '2026-01-14', amount: 24500.00, paid: 24500.00, due: 0 },
  { id: 'pt8', transactionType: '8-Global Foods GH', invoiceNo: '8', date: '2026-01-19', amount: 2300.00, paid: 0, due: 2300.00 },
  { id: 'pt9', transactionType: '9-Darko Farms', invoiceNo: '9', date: '2026-01-20', amount: 642.40, paid: 0, due: 642.40 },
  { id: 'pt10', transactionType: '10-AgriCorp Ghana', invoiceNo: '10', date: '2026-01-22', amount: 3295.80, paid: 0, due: 3295.80 },
  { id: 'pt11', transactionType: '11-Fan Milk Ghana', invoiceNo: '11', date: '2026-01-27', amount: 12519.10, paid: 11723.10, due: 796.00 },
  { id: 'pt12', transactionType: '12-Global Foods GH', invoiceNo: '12', date: '2026-01-28', amount: 1654.08, paid: 1555.20, due: 98.88 },
  { id: 'pt13', transactionType: '13-Unilever Ghana', invoiceNo: '13', date: '2026-01-29', amount: 2041.92, paid: 0, due: 2041.92 },
  { id: 'pt14', transactionType: '14-AgriCorp Ghana', invoiceNo: '14', date: '2026-01-30', amount: 2598.00, paid: 1128.00, due: 1470.00 },
  { id: 'pt15', transactionType: '15-Darko Farms', invoiceNo: '15', date: '2026-02-02', amount: 100.00, paid: 0, due: 100.00 },
  { id: 'pt16', transactionType: '16-Global Foods GH', invoiceNo: '16', date: '2026-02-03', amount: 1710.00, paid: 0, due: 1710.00 },
  { id: 'pt17', transactionType: '17-Fan Milk Ghana', invoiceNo: '17', date: '2026-02-09', amount: 4638.90, paid: 240.00, due: 4398.90 },
  { id: 'pt18', transactionType: '18-Unilever Ghana', invoiceNo: '18', date: '2026-02-10', amount: 2268.00, paid: 0, due: 2268.00 },
  { id: 'pt19', transactionType: '19-Global Foods GH', invoiceNo: '19', date: '2026-02-11', amount: 3470.00, paid: 3470.00, due: 0 },
  { id: 'pt20', transactionType: '20-AgriCorp Ghana', invoiceNo: '20', date: '2026-02-16', amount: 531.00, paid: 0, due: 531.00 },
];

// ===== Sample purchase order data =====
const purchaseOrders: PurchaseOrderListRow[] = [
  { id: 'po1', transactionType: '1-AgriCorp Ghana', invoiceNo: 'PO-2026-001', date: '2026-07-01', amount: 1250.00, paid: 1250.00, due: 0, status: 'received' },
  { id: 'po2', transactionType: '2-Global Foods GH', invoiceNo: 'PO-2026-002', date: '2026-07-03', amount: 3200.00, paid: 0, due: 3200.00, status: 'partial' },
  { id: 'po3', transactionType: '3-Fan Milk Ghana', invoiceNo: 'PO-2026-003', date: '2026-07-05', amount: 850.50, paid: 0, due: 850.50, status: 'sent' },
  { id: 'po4', transactionType: '4-Darko Farms', invoiceNo: 'PO-2026-004', date: '2026-07-06', amount: 420.00, paid: 0, due: 420.00, status: 'draft' },
  { id: 'po5', transactionType: '5-Unilever Ghana', invoiceNo: 'PO-2026-005', date: '2026-07-07', amount: 5680.00, paid: 0, due: 5680.00, status: 'sent' },
  { id: 'po6', transactionType: '6-AgriCorp Ghana', invoiceNo: 'PO-2026-006', date: '2026-07-08', amount: 920.00, paid: 0, due: 920.00, status: 'draft' },
];

export function PurchaseMenu({ onBack, products, onOpenPurchasingForm, onOpenSupplierForm }: PurchaseMenuProps) {
  const { toast } = useToast();
  const [showPurchaseList, setShowPurchaseList] = useState(false);
  const [showOrderList, setShowOrderList] = useState(false);

  // ===== Left panel: 3 menu items =====
  const menuItems = [
    {
      icon: Package,
      label: 'Purchasing',
      desc: 'Create new purchase invoices',
      shortcut: 'F2',
      action: () => {
        if (onOpenPurchasingForm) onOpenPurchasingForm();
        else toast({ title: 'Opening Purchasing Form', description: 'Create a new purchase invoice' });
      },
    },
    {
      icon: Users,
      label: 'Add/Modify Suppliers',
      desc: 'Manage supplier database',
      shortcut: 'F3',
      action: () => {
        if (onOpenSupplierForm) onOpenSupplierForm();
        else toast({ title: 'Opening Supplier Form', description: 'Add or modify supplier records' });
      },
    },
    {
      icon: X,
      label: 'Close (Esc)',
      desc: 'Return to main POS screen',
      shortcut: 'Esc',
      action: onBack,
    },
  ];

  // ===== Right panel: 13 reports (matches reference image exactly) =====
  const reports = [
    { num: '1', label: 'List of Suppliers', icon: Users, color: '#2196F3', action: () => toast({ title: 'List of Suppliers', description: 'Generating supplier list report...' }) },
    { num: '2', label: 'Purchases List Report', icon: ClipboardList, color: '#4CAF50', action: () => setShowPurchaseList(true) },
    { num: '3', label: 'Purchase Orders Report', icon: Archive, color: '#FF9800', action: () => setShowOrderList(true) },
    { num: '4', label: 'Summary Purchases', icon: FileBarChart2, color: '#9C27B0', action: () => toast({ title: 'Summary Purchases', description: 'Generating summary purchase report...' }) },
    { num: '5', label: 'Aged Suppliers Report', icon: History, color: '#00BCD4', action: () => toast({ title: 'Aged Suppliers Report', description: 'Generating aged suppliers report...' }) },
    { num: '6', label: "Supplier's Statements", icon: FileText, color: '#3F51B5', action: () => toast({ title: "Supplier's Statements", description: 'Generating supplier statements...' }) },
    { num: '7', label: 'Purchase Analysis Report', icon: TrendingUp, color: '#E91E63', action: () => toast({ title: 'Purchase Analysis Report', description: 'Generating purchase analysis...' }) },
    { num: '8', label: 'Back Orders Report', icon: RotateCcw, color: '#795548', action: () => toast({ title: 'Back Orders Report', description: 'Generating back orders report...' }) },
    { num: '9', label: 'Stock On Order Report', icon: Package, color: '#009688', action: () => toast({ title: 'Stock On Order Report', description: 'Generating stock on order report...' }) },
    { num: 'a', label: 'Purchases Tax Report', icon: Percent, color: '#673AB7', action: () => toast({ title: 'Purchases Tax Report', description: 'Generating purchases tax report (VAT 15%)...' }) },
    { num: 'b', label: 'Purchase Payments Report', icon: CreditCard, color: '#FF5722', action: () => toast({ title: 'Purchase Payments Report', description: 'Generating payments report...' }) },
    { num: 'c', label: 'Equivalent Part Numbers', icon: Layers, color: '#607D8B', action: () => toast({ title: 'Equivalent Part Numbers', description: 'Generating equivalent parts report...' }) },
    { num: 'y', label: 'Staff Invoice Report', icon: BookOpen, color: '#8BC34A', action: () => toast({ title: 'Staff Invoice Report', description: 'Generating staff invoice report...' }) },
    { num: 'd', label: 'Trading Terms Report', icon: Calendar, color: '#FFC107', action: () => toast({ title: 'Trading Terms Report', description: 'Generating trading terms report...' }) },
  ];

  return (
    <div className="h-screen flex flex-col bg-slate-100">
      <PopupWindow
        title="POS - Purchase Menu"
        titleBarColor={HEADER_BLUE}
        initialWidth={760}
        initialHeight={520}
        minWidth={680}
        minHeight={460}
        onClose={onBack}
      >
        <div className="h-full flex flex-col" style={{ fontFamily: 'Arial, Helvetica, sans-serif', backgroundColor: LIGHT_BLUE_BG }}>
          {/* Main two-panel layout */}
          <div className="flex-1 flex gap-3 p-3 min-h-0">
            {/* Left Panel: Purchase Menu */}
            <div className="w-[260px] flex flex-col rounded-md overflow-hidden border-2" style={{ borderColor: PANEL_BORDER, backgroundColor: '#FFFFFF' }}>
              <div className="px-3 py-2 text-white text-xs font-bold uppercase tracking-wide" style={{ backgroundColor: HEADER_BLUE }}>
                Purchase Menu
              </div>
              <div className="flex-1 p-2 space-y-2 overflow-y-auto">
                {menuItems.map((item, idx) => (
                  <motion.button
                    key={idx}
                    whileHover={{ x: 2 }}
                    onClick={item.action}
                    className="w-full text-left rounded-md border-2 p-2.5 transition-all group"
                    style={{ borderColor: PANEL_BORDER, backgroundColor: ITEM_BG }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = ITEM_HOVER)}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = ITEM_BG)}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="h-9 w-9 rounded-md flex items-center justify-center flex-shrink-0" style={{ backgroundColor: HEADER_BLUE }}>
                        <item.icon className="h-5 w-5 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold text-slate-800 truncate">{item.label}</div>
                        <div className="text-[10px] text-slate-500 truncate">{item.desc}</div>
                      </div>
                      <kbd className="text-[8px] bg-white px-1 py-0.5 rounded border border-slate-300 font-mono text-slate-600 flex-shrink-0">{item.shortcut}</kbd>
                    </div>
                  </motion.button>
                ))}

                {/* Quick stats at bottom */}
                <div className="pt-2 mt-2 border-t border-slate-200 space-y-1">
                  <div className="text-[9px] font-bold text-slate-500 uppercase">Quick Stats</div>
                  <div className="text-[10px] text-slate-700 flex justify-between"><span>Purchases (YTD):</span><span className="font-mono font-bold">{purchaseTransactions.length}</span></div>
                  <div className="text-[10px] text-slate-700 flex justify-between"><span>Open POs:</span><span className="font-mono font-bold">{purchaseOrders.length}</span></div>
                  <div className="text-[10px] text-slate-700 flex justify-between"><span>Outstanding Due:</span><span className="font-mono font-bold text-rose-700">{formatGHS(purchaseTransactions.reduce((s, t) => s + t.due, 0))}</span></div>
                </div>
              </div>
            </div>

            {/* Right Panel: Purchase Reports */}
            <div className="flex-1 flex flex-col rounded-md overflow-hidden border-2" style={{ borderColor: PANEL_BORDER, backgroundColor: '#FFFFFF' }}>
              <div className="px-3 py-2 text-white text-xs font-bold uppercase tracking-wide flex items-center justify-between" style={{ backgroundColor: HEADER_BLUE }}>
                <span>Purchase Reports</span>
                <Badge variant="secondary" className="bg-white/20 text-white text-[9px] font-mono">{reports.length} reports</Badge>
              </div>
              <div className="flex-1 p-2 overflow-y-auto">
                <div className="grid grid-cols-2 gap-1.5">
                  {reports.map((r) => (
                    <motion.button
                      key={r.num}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={r.action}
                      className="text-left rounded-md border p-2 transition-all group flex items-center gap-2"
                      style={{ borderColor: '#B9D7EE', backgroundColor: ITEM_BG }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = ITEM_HOVER)}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = ITEM_BG)}
                    >
                      <div className="h-7 w-7 rounded-md flex items-center justify-center flex-shrink-0 text-white" style={{ backgroundColor: r.color }}>
                        <r.icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-mono font-bold text-slate-700">{r.num}.</span>
                          <span className="text-[10px] font-semibold text-slate-800 truncate">{r.label}</span>
                        </div>
                      </div>
                    </motion.button>
                  ))}
                </div>

                {/* Footer hint */}
                <div className="mt-3 pt-2 border-t border-slate-200 text-[9px] text-slate-500">
                  Click any report to view · Press <kbd className="bg-slate-200 px-1 rounded font-mono">Esc</kbd> to close
                </div>
              </div>
            </div>
          </div>

          {/* Bottom action bar */}
          <div className="flex-shrink-0 px-3 py-2 flex items-center gap-2 border-t-2" style={{ borderColor: PANEL_BORDER, backgroundColor: '#FFFFFF' }}>
            <button
              onClick={() => setShowPurchaseList(true)}
              className="h-7 px-3 rounded text-white text-[10px] font-semibold flex items-center gap-1.5 transition shadow-sm"
              style={{ backgroundColor: BTN_BLUE }}
            >
              <ClipboardList className="h-3.5 w-3.5" /> Open Purchases List
            </button>
            <button
              onClick={() => setShowOrderList(true)}
              className="h-7 px-3 rounded text-white text-[10px] font-semibold flex items-center gap-1.5 transition shadow-sm"
              style={{ backgroundColor: BTN_BLUE }}
            >
              <Archive className="h-3.5 w-3.5" /> Open Purchase Orders
            </button>
            <div className="flex-1" />
            <span className="text-[9px] text-slate-500 font-mono hidden sm:inline">{COMPANY.name} · {COMPANY.address}</span>
            <button
              onClick={onBack}
              className="h-7 px-3 rounded text-white text-[10px] font-semibold flex items-center gap-1.5 transition shadow-sm"
              style={{ backgroundColor: BTN_RED }}
            >
              <X className="h-3.5 w-3.5" /> Close <kbd className="text-[7px] bg-white/20 px-0.5 rounded">Esc</kbd>
            </button>
          </div>
        </div>
      </PopupWindow>

      {/* ===== Nested Popups ===== */}
      <AnimatePresence>
        {showPurchaseList && (
          <PurchaseListPopup
            transactions={purchaseTransactions}
            onClose={() => setShowPurchaseList(false)}
            onSelect={(row) => {
              toast({ title: 'Purchase Selected', description: `${row.transactionType} · Invoice ${row.invoiceNo}` });
              setShowPurchaseList(false);
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showOrderList && (
          <PurchaseOrderListPopup
            orders={purchaseOrders}
            onClose={() => setShowOrderList(false)}
            onSelect={(row) => {
              toast({ title: 'PO Selected', description: `${row.transactionType} · ${row.invoiceNo}` });
              setShowOrderList(false);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
