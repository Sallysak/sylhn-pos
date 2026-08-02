"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Home, ShoppingCart, BarChart3, Package, Truck,
  FileText, Receipt, Clock, TrendingUp, Wallet, Phone, PhoneCall, Mail,
  Wrench, Shield, Settings, Sparkles, History, Users, Map as MapIcon,
  Smartphone, Printer, DollarSign, ScanLine, Calculator, Tags,
  CreditCard, Eye, Search, Plus, AlertCircle, Database, Lock,
  Brain, MessageCircle, AlertTriangle, ClipboardCheck, Upload,
  RefreshCw, Globe, BookOpen, FileBarChart, Clock3, Power, Sun, Moon,
  ChevronDown, ChevronRight, X, ArrowUpRight, Store, Zap, Layers,
  Key, Activity, Wifi, WifiOff, Bell, Calendar, BarChart2, PieChart,
  Filter, Star, Crown, Lightbulb, GraduationCap, AlertOctagon, RotateCcw,
} from "lucide-react";
import { COMPANY } from "@/lib/pos-data";

interface FeaturesMapProps {
  onBack: () => void;
  onNavigate: (view: string) => void;
}

type FeaturePhase = "core" | "phase1" | "phase2" | "phase3" | "phase4" | "phase5";
type AccessLevel = "all" | "admin" | "manager";

interface FeatureEntry {
  name: string;
  description: string;
  icon: any;
  location: string;        // exact place to find it
  locationLabel: string;   // short label for the location pill
  action?: string;         // view to navigate to
  href?: string;           // external URL
  color: string;
  bg: string;
  phase?: FeaturePhase;
  access?: AccessLevel;
  shortcut?: string;
  /** Practical, cashier-facing training note — how to use it, common mistakes, gotchas. */
  trainingNote?: string;
  /** Critical-onboarding flag — shown in the "New Cashier Quick Start" panel. */
  quickStart?: boolean;
}

interface FeatureCategory {
  category: string;
  icon: any;
  color: string;
  features: FeatureEntry[];
}

const PHASE_LABELS: Record<FeaturePhase, string> = {
  core: "Core",
  phase1: "Phase 1",
  phase2: "Phase 2",
  phase3: "Phase 3",
  phase4: "Phase 4",
  phase5: "Phase 5",
};

const PHASE_COLORS: Record<FeaturePhase, string> = {
  core: "bg-slate-100 text-slate-600",
  phase1: "bg-emerald-100 text-emerald-700",
  phase2: "bg-blue-100 text-blue-700",
  phase3: "bg-violet-100 text-violet-700",
  phase4: "bg-amber-100 text-amber-700",
  phase5: "bg-rose-100 text-rose-700",
};

const CATEGORIES: FeatureCategory[] = [
  {
    category: "Sales & Checkout",
    icon: ShoppingCart,
    color: "text-emerald-600",
    features: [
      {
        name: "POS Screen",
        description: "Main checkout screen — scan barcodes, add items to cart, take payment",
        icon: Home,
        location: "Bottom Nav → POS tab  ·  or Ctrl+P",
        locationLabel: "Bottom Nav",
        action: "pos",
        color: "text-emerald-600",
        bg: "bg-emerald-50",
        phase: "core",
        access: "all",
        shortcut: "Ctrl+P",
        quickStart: true,
        trainingNote:
          "TO START A SALE: (1) Tap a product tile, OR (2) scan a barcode into the search bar, OR (3) type the product name and press Enter. Adjust quantity with +/- buttons in the cart. Press F5 to open payment. " +
          "GOTCHA: If a product does not appear, check the Stock tab — its quantity may be 0 (out-of-stock items are hidden from the grid). " +
          "TIP: Use F2 to hold an order if a customer forgets their wallet — it stays in the Held Orders list until you recall it.",
      },
      {
        name: "View Cart",
        description: "See items in current sale, adjust quantities, apply discounts",
        icon: ShoppingCart,
        location: "Bottom Nav → Cart tab  ·  or click cart icon",
        locationLabel: "Bottom Nav",
        action: "pos",
        color: "text-emerald-600",
        bg: "bg-emerald-50",
        phase: "core",
        access: "all",
        trainingNote:
          "IN THE CART: tap any line to change quantity, apply a per-line discount, or remove the item. " +
          "DISCOUNTS: Use the percent or amount field at the top of the cart for whole-order discounts (manager approval required if > 10%). " +
          "GOTCHA: A held order does NOT auto-merge with your current cart — recalling it will replace your cart. Save your current sale first.",
      },
      {
        name: "Pay Now",
        description: "Open payment modal — cash, card, or mobile money",
        icon: CreditCard,
        location: "POS Screen → green PAY NOW button",
        locationLabel: "POS button",
        action: "pos",
        color: "text-emerald-600",
        bg: "bg-emerald-50",
        phase: "core",
        access: "all",
        shortcut: "F5",
        quickStart: true,
        trainingNote:
          "PAYMENT METHODS: Cash (default), Mobile Money (auto-detects MTN/Telecel/AirtelTigo from the phone number), Card (Paystack — only works if admin has configured keys), Credit (requires a customer to be selected first), Loyalty Points (slider appears if the customer has points). " +
          "CASH: Tap the quick-cash buttons (₵5, ₵10, ₵20, ₵50, ₵100) or type the exact amount — change is auto-calculated. " +
          "MOMO: Customer MUST approve the prompt on their phone. Wait for the success notification before closing the modal — closing early does NOT cancel the prompt. " +
          "GOTCHA: If Paystack tab shows 'Not configured', tell the manager — card payments will fail until keys are added to the env.",
      },
      {
        name: "Hold / Save Order",
        description: "Park current sale to resume later — perfect for waiting customers",
        icon: Receipt,
        location: "Sale menu → Save / Hold Order",
        locationLabel: "Sale menu",
        action: "pos",
        color: "text-emerald-600",
        bg: "bg-emerald-50",
        phase: "core",
        access: "all",
        shortcut: "F2",
        trainingNote:
          "USE CASE: Customer forgot their wallet, needs to grab one more item, or wants to pay after another customer. " +
          "TO RECALL: Sale menu → Held Orders → tap the order → it loads back into your cart. " +
          "GOTCHA: Held orders persist even after logout, but a NEW cashier logging in will see them too. Always confirm with the customer before recalling someone else's held order. " +
          "TIP: Held orders older than 24 hours should be voided — check the Held Orders list at the start of each shift.",
      },
      {
        name: "Sequential Invoice Numbers",
        description: "Auto-generated INV-YYYY-NNNNNN invoice numbers for GRA compliance — never reuse, never skip",
        icon: FileText,
        location: "Automatic — every receipt has one. Visible on receipts & Sales History.",
        locationLabel: "Automatic",
        color: "text-blue-600",
        bg: "bg-blue-50",
        phase: "phase2",
        access: "all",
        trainingNote:
          "WHAT TO KNOW: Every receipt gets a unique number like INV-2026-000123. The system NEVER reuses a number, even if a sale is voided. " +
          "WHY IT MATTERS: GRA auditors check for gaps in invoice sequences — a missing number suggests a deleted sale, which is a red flag. " +
          "IF A RECEIPT DIDN'T PRINT: Do NOT void and re-sell — that creates two invoice numbers. Instead, go to Receipt Archive and reprint the original. " +
          "VOIDED SALES: Still consume an invoice number. The void is logged with cashier name, timestamp, and reason in the audit log.",
      },
      {
        name: "Sales Menu",
        description: "All sales-related reports and history in one place",
        icon: FileText,
        location: "More → Sales → Sales Menu",
        locationLabel: "More drawer",
        action: "sales-menu",
        color: "text-blue-600",
        bg: "bg-blue-50",
        phase: "core",
        access: "all",
        trainingNote:
          "START HERE for any sales question. The Sales Menu is a hub linking to: Sales History, Sold Items Report, Daily Sales Report, and Receipt Archive. " +
          "TIP: Cashiers can view but not delete sales records. If a sale was recorded wrong, void it (F4, manager approval required) and re-enter it correctly — do NOT try to 'fix' it through the history screen.",
      },
      {
        name: "Sold Items Report",
        description: "Top-selling items grouped by category",
        icon: FileBarChart,
        location: "More → Sales → Sold Items Report",
        locationLabel: "More drawer",
        action: "sold-items",
        color: "text-emerald-600",
        bg: "bg-emerald-50",
        phase: "core",
        access: "all",
        trainingNote:
          "USE THIS to decide what to restock and what to promote. Filter by date range to compare weeks or months. " +
          "EXPORT: Click CSV to open in Excel — useful for sharing with the owner. " +
          "TIP: A product at the top of 'sold items' but with low stock in the Stock tab is a restock emergency.",
      },
      {
        name: "Sales History",
        description: "All past transactions with filter & export — date range filter included",
        icon: Clock,
        location: "More → Sales → Sales History",
        locationLabel: "More drawer",
        action: "sales-history",
        color: "text-teal-600",
        bg: "bg-teal-50",
        phase: "core",
        access: "all",
        trainingNote:
          "SEARCH BY: invoice number (e.g. INV-2026-000123), customer name, payment method, or date range. " +
          "REPRINT: Click any sale → 'Reprint Receipt' opens the receipt modal with print/WhatsApp/PDF buttons. " +
          "REFUND: Sales can be refunded (manager approval required) — the original invoice number is preserved and a refund entry is created. " +
          "GOTCHA: Voided sales still appear in history with a 'VOID' badge. They do not count toward daily totals.",
      },
      {
        name: "Daily Sales Report",
        description: "Today's sales summary with totals and breakdowns",
        icon: TrendingUp,
        location: "More → Sales → Daily Sales Report",
        locationLabel: "More drawer",
        action: "daily-sales",
        color: "text-cyan-600",
        bg: "bg-cyan-50",
        phase: "core",
        access: "all",
        trainingNote:
          "RUN AT END OF SHIFT. Shows total revenue, transaction count, average sale, payment method breakdown (cash vs MoMo vs card), and tax collected. " +
          "RECONCILE: Compare the 'Cash' total to the actual cash in your drawer (use the Cash Calculator for denomination counting). Any difference is your cash variance — record it in Finance Operations → Cash Reconciliation. " +
          "TIP: A variance over ±₵5 should be reported to the manager. Repeated variances suggest a training issue or theft.",
      },
      {
        name: "Receipt Archive",
        description: "Browse, reprint, or resend past receipts — search by invoice number or date",
        icon: FileText,
        location: "POS menu → 🧾 Receipt Archive  ·  or More → Sales",
        locationLabel: "POS menu",
        action: "receipt-archive",
        color: "text-slate-600",
        bg: "bg-slate-50",
        phase: "core",
        access: "all",
        trainingNote:
          "USE CASES: Customer lost their receipt (reprint), customer wants it on WhatsApp (resend), or you need to verify a disputed sale. " +
          "VERIFICATION: Every receipt has a unique URL — share it via SMS or any messenger. The customer can open it in any browser, no app needed. " +
          "GOTCHA: Reprinting a receipt does NOT create a new invoice number — it uses the original. This is the correct way to handle 'printer ran out of paper' situations.",
      },
      {
        name: "Customer Display Screen",
        description: "Dedicated customer-facing display — open on a second monitor or tablet",
        icon: Eye,
        location: "URL: /display  ·  open in browser on second screen",
        locationLabel: "Standalone URL",
        href: "/display",
        color: "text-violet-600",
        bg: "bg-violet-50",
        phase: "phase3",
        access: "all",
        trainingNote:
          "SETUP: Open /display in a browser on a second monitor or a tablet mounted facing the customer. It auto-syncs with the cashier's POS in real time. " +
          "WHAT IT SHOWS: Items as they're scanned, running total, tax, and a 'Please Pay' screen with the final amount. " +
          "TIP: Use Chrome's kiosk mode (right-click → Cast → kiosk) for a clean fullscreen display with no address bar. " +
          "GOTCHA: The display needs to be on the same network as the POS — it talks to the server over WiFi. If the display freezes, refresh the page.",
      },
    ],
  },
  {
    category: "Stock & Inventory",
    icon: Package,
    color: "text-blue-600",
    features: [
      {
        name: "Stock Management",
        description: "Add/modify products, group maintenance, quantity adjustments, stock history",
        icon: Package,
        location: "More → Stock → Stock Management",
        locationLabel: "More drawer",
        action: "stock",
        color: "text-blue-600",
        bg: "bg-blue-50",
        phase: "core",
        access: "all",
        trainingNote:
          "TABS: Stock File (list all products), Stock Search (popup), Add/Modify (edit products), Group Maintenance (categories), Quantity Adjustment (admin only), Stock History (movement log). " +
          "ADDING A PRODUCT: Required fields — name, SKU, price, cost, category. Optional but recommended — barcode, supplier, expiry date, reorder level. " +
          "GOTCHA: Cost price is HIDDEN from cashiers — only managers/admins see it. Don't discuss cost prices in front of customers. " +
          "TIP: Set a reorder level for every product. The Operations Dashboard flags low-stock items so you can reorder before running out.",
      },
      {
        name: "Stock Search",
        description: "Premium popup with 5-column grid, 7 action buttons — find any product fast",
        icon: Search,
        location: "POS Screen → FIND PRODUCT button",
        locationLabel: "POS button",
        action: "pos",
        color: "text-blue-600",
        bg: "bg-blue-50",
        phase: "core",
        access: "all",
        trainingNote:
          "SEARCH BY: name, SKU, barcode, or supplier. Type 3+ characters and results appear instantly. " +
          "7 ACTION BUTTONS per result: Add to cart, View details, Edit (admin), Print label, Print price tag, Adjust quantity (admin), View history. " +
          "TIP: Use this instead of scrolling the product grid when you know the name — much faster for stores with 100+ products.",
      },
      {
        name: "Barcode Scanner (Camera)",
        description: "Camera-based barcode scanner for fast product lookup",
        icon: ScanLine,
        location: "POS Screen → Scan button next to search  ·  or SpeedDial",
        locationLabel: "POS toolbar",
        action: "pos",
        color: "text-emerald-600",
        bg: "bg-emerald-50",
        phase: "core",
        access: "all",
        trainingNote:
          "REQUIRES: A device with a camera and HTTPS (the POS is HTTPS, so it works). Browser will ask for camera permission — click Allow. " +
          "TIP: Hold the barcode 10–15 cm from the camera in good light. The scanner auto-detects Code 128, EAN-13, UPC-A, and QR codes. " +
          "GOTCHA: If the scanner can't read a barcode, the product may not have one in the system. Add it via Stock Management → Edit. " +
          "ALTERNATIVE: Type the barcode number directly into the search bar and press Enter — works the same way.",
      },
      {
        name: "Stock History Pro",
        description: "Advanced stock movement analytics with charts and trends",
        icon: History,
        location: "More → Stock → Stock History Pro",
        locationLabel: "More drawer",
        action: "stock-history-pro",
        color: "text-indigo-600",
        bg: "bg-indigo-50",
        phase: "core",
        access: "all",
        trainingNote:
          "WHAT IT SHOWS: Every stock movement — sales, purchases, adjustments, transfers, stocktakes — with timestamps and responsible user. " +
          "USE CASE: A customer complains they were sold expired goods — search the product here to trace which batch it came from and when. " +
          "TIP: Filter by 'action: adjusted' to spot manual stock changes (potential shrinkage or theft).",
      },
      {
        name: "Expiry Management (FEFO)",
        description: "First-Expiry-First-Out management with 4 urgency levels and value-at-risk tracking",
        icon: AlertTriangle,
        location: "Top toolbar → Expiry button (orange)",
        locationLabel: "Top toolbar",
        action: "pos",
        color: "text-orange-600",
        bg: "bg-orange-50",
        phase: "phase3",
        access: "all",
        quickStart: true,
        trainingNote:
          "4 URGENCY LEVELS: Green (fresh, >30 days), Yellow (use soon, 7–30 days), Orange (urgent, 1–7 days), Red (expired — DO NOT SELL). " +
          "FEFO RULE: When stocking shelves, ALWAYS put the oldest stock at the front. New stock goes to the back. " +
          "RED ITEMS: Must be removed from shelves immediately. Selling expired goods is illegal in Ghana — fines start at ₵5,000. " +
          "GOTCHA: If a customer is sold an expired item by mistake, refund immediately and offer a replacement — a complaint to GRA is much worse. " +
          "TIP: Check this dashboard at the start of every shift. Takes 30 seconds and prevents 90% of expiry problems.",
      },
      {
        name: "Stocktake Wizard",
        description: "4-step physical count: Create → Count → Review variances → Post adjustments",
        icon: ClipboardCheck,
        location: "Top toolbar → Stocktake button (indigo, admin/manager only)",
        locationLabel: "Top toolbar",
        action: "pos",
        color: "text-indigo-600",
        bg: "bg-indigo-50",
        phase: "phase2",
        access: "manager",
        trainingNote:
          "WHEN TO RUN: Monthly minimum. Weekly for high-value or high-theft categories. Always run before a GRA audit. " +
          "4 STEPS: (1) Create — select which categories to count. (2) Count — physically count each item, enter actual quantity. (3) Review — system shows variances (expected vs actual). (4) Complete — adjustments post to stock with reason code. " +
          "GOTCHA: Do NOT make sales during a stocktake — pause the count, finish sales, then resume. Sales during counting cause phantom variances. " +
          "TIP: Count high-value items (electronics, alcohol) twice with two different counters. Compare results before posting.",
      },
      {
        name: "Bulk Product CSV Import",
        description: "Import hundreds of products from a CSV file — map columns automatically",
        icon: Upload,
        location: "Top toolbar → Import button (blue, admin/manager only)",
        locationLabel: "Top toolbar",
        action: "pos",
        color: "text-blue-600",
        bg: "bg-blue-50",
        phase: "phase5",
        access: "manager",
        trainingNote:
          "USE WHEN: Initial setup, or adding a new supplier's catalog (50+ products at once). " +
          "CSV FORMAT: Required columns — name, sku, price, cost. Optional — barcode, category, supplier, reorder_level, expiry_date. " +
          "DRY RUN: Always click 'Preview' first — it shows what will be imported without saving. Check for duplicates and wrong prices. " +
          "GOTCHA: Existing SKUs will be UPDATED, not skipped. If you import a CSV with an old price, it will overwrite the current price. " +
          "BACKUP FIRST: Run a database backup (Maintenance → Backup Database) before any bulk import. If something goes wrong, you can restore.",
      },
      {
        name: "Multi-Store Location Switcher",
        description: "Switch between multiple store locations from the header — per-location stock and reporting",
        icon: Store,
        location: "Header bar → location dropdown (next to logo, only shows if locations exist)",
        locationLabel: "Header bar",
        color: "text-purple-600",
        bg: "bg-purple-50",
        phase: "phase5",
        access: "all",
        trainingNote:
          "SETUP: Admin creates locations in Admin Panel → Locations. Once 2+ locations exist, the dropdown appears in the header. " +
          "WHAT CHANGES: Stock levels, sales totals, and reports all reflect the selected location. Held orders are per-location. " +
          "GOTCHA: Transferring stock between locations requires a Stock Transfer record (Stock → Transfers) — don't just adjust quantities, or the audit trail breaks. " +
          "TIP: Always confirm the location is correct at the start of your shift — a wrong location means wrong stock and wrong daily totals.",
      },
      {
        name: "Group Maintenance",
        description: "Organize products into groups/categories for easier management",
        icon: Layers,
        location: "More → Stock → Group Maintenance",
        locationLabel: "More drawer",
        action: "stock",
        color: "text-blue-600",
        bg: "bg-blue-50",
        phase: "core",
        access: "all",
        trainingNote:
          "EXAMPLES: 'Beverages', 'Snacks', 'Household', 'Fresh Produce'. Each group has a color and icon shown on the POS grid. " +
          "TIP: Keep groups broad (5–10 total). Too many groups make the POS harder to navigate. " +
          "GOTCHA: Deleting a group does NOT delete its products — they become 'uncategorized' and disappear from the POS grid. Reassign products first.",
      },
      {
        name: "Quantity Adjustment",
        description: "Adjust stock quantities with reason codes (admin/canAdjustStock only)",
        icon: TrendingUp,
        location: "More → Stock → Quantity Adjustment",
        locationLabel: "More drawer",
        action: "stock",
        color: "text-amber-600",
        bg: "bg-amber-50",
        phase: "core",
        access: "admin",
        trainingNote:
          "REASON CODES (mandatory): Damage, Theft, Found, Lost, Transfer In, Transfer Out, Initial Count, Other. Every adjustment is logged with cashier, time, and reason. " +
          "USE FOR: Correcting stock after a stocktake, recording damaged goods, or fixing a typo. " +
          "NEVER USE FOR: Sales (use the POS), receiving stock (use Purchase Orders → Receive), or moving stock between locations (use Stock Transfers). " +
          "GOTCHA: Adjustments affect cost-of-goods-sold calculations. Random adjustments without reasons will look like theft to an auditor.",
      },
      {
        name: "Stock Reports",
        description: "Stock quantity report, stock value, reorder report, expiry date report",
        icon: FileBarChart,
        location: "More → Stock → Stock Reports",
        locationLabel: "More drawer",
        action: "reports",
        color: "text-slate-600",
        bg: "bg-slate-50",
        phase: "core",
        access: "all",
        trainingNote:
          "REORDER REPORT: Lists every product at or below its reorder level. Send this to your supplier every Monday. " +
          "STOCK VALUE REPORT: Total value of current inventory at cost price. Owners check this monthly. " +
          "EXPIRY DATE REPORT: All products with expiry dates, sorted by soonest. The basis for the Expiry Manager dashboard. " +
          "TIP: All reports export to CSV — open in Excel to filter, sort, and format for printing.",
      },
    ],
  },
  {
    category: "Purchasing & Suppliers",
    icon: Truck,
    color: "text-purple-600",
    features: [
      {
        name: "New Purchase Order",
        description: "Create a purchase order — multi-currency, landed costs, batch numbers, expiry dates, line-level discounts and tax rates",
        icon: FileText,
        location: "More → Purchasing → New Purchase",
        locationLabel: "More drawer",
        action: "purchase-form",
        color: "text-purple-600",
        bg: "bg-purple-50",
        phase: "core",
        access: "all",
        trainingNote:
          "WORKFLOW: Select supplier → add products (or load from supplier catalog) → set quantities, unit cost, discount, tax → add landed costs (freight, customs) → save as Draft → submit for approval (if enabled) → send to supplier via WhatsApp/email. " +
          "MULTI-CURRENCY: Set the currency per PO — system auto-fetches exchange rates daily from open.er-api.com. " +
          "GOTCHA: A PO is just a request — stock does NOT update until you Receive it (Purchase Orders → Receive → GRN). " +
          "TIP: Use the supplier catalog (link icon next to supplier name) to import their full price list — saves typing.",
      },
      {
        name: "Purchase Orders",
        description: "View all purchase orders, receive stock (GRN), track payments, approval workflow",
        icon: Truck,
        location: "More → Purchasing → Purchase Orders",
        locationLabel: "More drawer",
        action: "purchase",
        color: "text-violet-600",
        bg: "bg-violet-50",
        phase: "core",
        access: "all",
        trainingNote:
          "STATUSES: Draft (not sent) → Sent (waiting for supplier) → Partial (some items received) → Received (complete) → Paid (payment recorded) → Closed. " +
          "RECEIVING STOCK: Click a PO → Receive → enter ACTUAL quantities received (not ordered) → save. This updates stock levels AND creates a GRN (Goods Received Note) for the audit trail. " +
          "GOTCHA: If supplier short-ships (sends less than ordered), enter the actual quantity. The PO stays 'Partial' so you can chase the missing items. " +
          "PAYMENTS: Record supplier payments via the Payment button — supports partial payments and tracks outstanding balance.",
      },
      {
        name: "Receive Stock (GRN)",
        description: "Goods Received Note workflow — verify quantities, inspect quality, update stock automatically",
        icon: Package,
        location: "More → Purchasing → Purchase Orders → Receive",
        locationLabel: "Purchase Orders",
        action: "purchase",
        color: "text-emerald-600",
        bg: "bg-emerald-50",
        phase: "core",
        access: "all",
        trainingNote:
          "BEST PRACTICE: Count every box BEFORE signing the supplier's delivery note. Once you sign, disputes are harder. " +
          "QUALITY CHECK: Inspect for damage, leaks, expired dates. Refuse damaged items — enter 0 for their quantity in the GRN. " +
          "BATCH & EXPIRY: For perishables (dairy, bread, medicine), enter the batch number and expiry date from the package. This powers the FEFO expiry system. " +
          "GOTCHA: A GRN is PERMANENT — once posted, it cannot be deleted. If you make a mistake, do a Quantity Adjustment to correct it. " +
          "TIP: Photograph any damaged goods before refusing them — evidence for supplier disputes.",
      },
      {
        name: "Supplier Directory",
        description: "Manage supplier contacts, balances, order history, catalog, notes — admin/manager can edit & delete",
        icon: Users,
        location: "More → Purchasing → Suppliers",
        locationLabel: "More drawer",
        action: "supplier-form",
        color: "text-indigo-600",
        bg: "bg-indigo-50",
        phase: "core",
        access: "all",
        trainingNote:
          "TABS: Directory (list), Catalog (products this supplier sells), Notes (free text — e.g. 'pays on 30-day terms'), History (all POs and payments with this supplier). " +
          "EDIT/DELETE: Admin/manager only. Deleting a supplier with active POs is BLOCKED — close or cancel the POs first. " +
          "PAYMENT BUTTON: Records a payment against this supplier's outstanding balance. " +
          "EMAIL BUTTON: Sends a statement (outstanding balance + last 5 POs) — requires SMTP config in Maintenance → Email System. " +
          "TIP: Keep supplier notes updated with payment terms, delivery schedule, and quality issues. Future you will thank present you.",
      },
      {
        name: "Supplier Payments",
        description: "Record payments to suppliers, track outstanding balances",
        icon: DollarSign,
        location: "More → Purchasing → Supplier Payments",
        locationLabel: "More drawer",
        action: "purchase",
        color: "text-rose-600",
        bg: "bg-rose-50",
        phase: "core",
        access: "all",
        trainingNote:
          "PAYMENT METHODS: Cash, Bank Transfer, Mobile Money, Cheque. Each is logged separately for reconciliation. " +
          "PARTIAL PAYMENTS: Supported — enter the amount you're paying now, the balance stays outstanding. " +
          "GOTCHA: Always record the supplier's receipt/invoice number in the 'reference' field — needed for audit. " +
          "TIP: Pay suppliers on their terms (e.g. 30 days) to maintain credit. Late payments damage relationships and may lose discounts.",
      },
      {
        name: "Recurring Purchase Orders",
        description: "Auto-generate weekly or monthly purchase orders — never run out of stock on routine items",
        icon: RefreshCw,
        location: "Top toolbar → Recurring button (admin/manager only)",
        locationLabel: "Top toolbar",
        action: "pos",
        color: "text-cyan-600",
        bg: "bg-cyan-50",
        phase: "phase4",
        access: "manager",
        trainingNote:
          "USE FOR: Standing orders for bread, milk, newspapers — anything you order the same quantity of every week/month. " +
          "SETUP: Create a rule with supplier, products, quantities, and frequency (weekly/monthly). System auto-creates a Draft PO on schedule. " +
          "REVIEW: A draft PO still needs to be reviewed and sent — it's not automatic. Check the Recurring panel every Monday. " +
          "GOTCHA: If a supplier changes prices, your recurring PO uses the OLD price. Edit before sending. " +
          "TIP: Pause recurring rules during slow seasons (e.g. Christmas week for a school-cafe supplier) to avoid overstocking.",
      },
      {
        name: "Supplier Portal",
        description: "Suppliers can view pending POs and submit quotes — standalone URL",
        icon: Globe,
        location: "URL: /supplier-portal  ·  share with suppliers",
        locationLabel: "Standalone URL",
        href: "/supplier-portal",
        color: "text-blue-600",
        bg: "bg-blue-50",
        phase: "phase5",
        access: "all",
        trainingNote:
          "WHAT SUPPLIERS SEE: Pending POs addressed to them, their outstanding balance, and a 'Submit Quote' form. " +
          "ACCESS: Suppliers need a login — admin creates accounts in Admin Panel → Supplier Users. " +
          "SECURITY: Suppliers see ONLY their own POs and balance — they cannot see other suppliers or your sales data. " +
          "TIP: Send the portal URL to your top 3 suppliers. They can submit quotes for new products without phone tag.",
      },
      {
        name: "Purchase Hub (Real-time)",
        description: "Real-time procurement dashboard — 6 tabs: Overview, POs, Invoice Matching, Returns, Performance, Payments",
        icon: TrendingUp,
        location: "Purchase menu → 📈 Purchase Hub (Real-time)  ·  or More → Purchasing → Purchase Hub (F4)",
        locationLabel: "Purchase menu",
        action: "purchase-hub",
        color: "text-amber-600",
        bg: "bg-amber-50",
        phase: "phase5",
        access: "all",
        trainingNote:
          "ONE-STOP SHOP for procurement. Replaces the old localStorage demo with real API data. " +
          "TABS: Overview (KPIs + alerts), Purchase Orders (searchable list + WhatsApp sending), Invoice Matching (three-way PO↔GRN↔Invoice), Returns (supplier returns workflow), Performance (per-supplier scorecard with star rating), Payments (WHT + early-pay discount tracking). " +
          "GOTCHA: 'Suppliers' and 'New PO' buttons navigate to those forms but remember to return to the Hub when you click Back. " +
          "TIP: Check the Overview tab daily — alerts show pending invoices, awaiting-credit returns, and blacklisted suppliers.",
      },
      {
        name: "WhatsApp PO Sending",
        description: "Send a purchase order to a supplier via WhatsApp — auto-fills PO text + items + totals",
        icon: MessageCircle,
        location: "Purchase Hub → Purchase Orders tab → green WhatsApp button per row",
        locationLabel: "Purchase Hub",
        action: "purchase-hub",
        color: "text-green-600",
        bg: "bg-green-50",
        phase: "phase5",
        access: "all",
        trainingNote:
          "FLOW: Click the WhatsApp icon on any PO row → modal opens with the supplier's phone pre-filled → click 'Open WhatsApp' → WhatsApp opens with the PO text pre-filled → supplier receives it instantly. " +
          "WHY: Ghanaian suppliers respond faster on WhatsApp than email. " +
          "GOTCHA: The supplier's mobile number must be in their profile. If blank, you'll need to type it manually. " +
          "TIP: Always confirm the supplier received the PO — WhatsApp delivery reports can be delayed.",
      },
      {
        name: "Supplier Invoice Matching (3-way)",
        description: "Three-way matching: PO ↔ GRN ↔ Supplier Invoice. Auto-flags variances for review.",
        icon: Receipt,
        location: "Purchase Hub → Invoice Matching tab",
        locationLabel: "Purchase Hub",
        action: "purchase-hub",
        color: "text-amber-600",
        bg: "bg-amber-50",
        phase: "phase5",
        access: "all",
        trainingNote:
          "WHY: GRA auditors require that the invoice you pay matches what you ordered AND what you received. " +
          "FLOW: Click 'New Invoice' → enter supplier + invoice # + total → link to a PO (optional) → save. " +
          "AUTO-MATCH: If variance ≤1% → status='matched'. 1-5% → 'variance' (needs review). >5% → 'variance' (large, needs review). " +
          "RESOLVE: Click 'Match' (accept the variance) or 'Reject' (dispute the invoice with the supplier). " +
          "GOTCHA: Always record the supplier invoice even if it matches — it's the audit trail that you paid the right amount.",
      },
      {
        name: "Supplier Returns (Debit Notes)",
        description: "Return damaged/expired/wrong goods to a supplier — auto-decrements stock + tracks the credit",
        icon: RotateCcw,
        location: "Purchase Hub → Returns tab → New Return button",
        locationLabel: "Purchase Hub",
        action: "purchase-hub",
        color: "text-rose-600",
        bg: "bg-rose-50",
        phase: "phase5",
        access: "all",
        trainingNote:
          "WHEN TO USE: Damaged goods, expired items, wrong products delivered, quality issues. " +
          "FLOW: New Return → select supplier + return type → add items (qty + cost) → save. Stock is decremented immediately. " +
          "STATUS PIPELINE: pending → shipped → received_by_supplier → credit_issued. " +
          "GOTCHA: The supplier's balance is NOT changed until they issue a credit note. The return just documents what you sent back. " +
          "TIP: Photograph damaged goods before returning — evidence for supplier disputes.",
      },
      {
        name: "Supplier Performance Scorecard",
        description: "1-5 star rating + on-time %, fill-rate %, rejection %, avg lead time, total spend per supplier",
        icon: Star,
        location: "Purchase Hub → Performance tab → pick supplier + window (30/90/180/365 days)",
        locationLabel: "Purchase Hub",
        action: "purchase-hub",
        color: "text-amber-600",
        bg: "bg-amber-50",
        phase: "phase5",
        access: "all",
        trainingNote:
          "STAR RATING: Auto-computed from PO history (40% on-time + 30% fill-rate + 30% quality). Override by setting a manual rating in the supplier form (Compliance tab). " +
          "ON-TIME %: # POs received on or before expectedAt / # POs received. " +
          "FILL RATE: units received / units ordered. " +
          "REJECTION %: # items short-shipped / # items total. " +
          "USE CASE: Shift volume to better suppliers. A 3-star supplier costs you more in stockouts + expiries than a 5-star one. " +
          "TIP: Run this monthly. Review 1-2 star suppliers — consider blacklisting.",
      },
      {
        name: "Quick Reorder Button",
        description: "One-click draft PO from the Operations Dashboard low-stock alert — uses preferred supplier + auto quantity",
        icon: Zap,
        location: "Operations Dashboard → Overview → Action Needed panel → ⚡ Reorder button per low-stock item",
        locationLabel: "Operations Dashboard",
        action: "dashboard",
        color: "text-violet-600",
        bg: "bg-violet-50",
        phase: "phase5",
        access: "all",
        trainingNote:
          "ONE-CLICK: Click ⚡ Reorder next to any low-stock item → a draft PO is created instantly with the preferred supplier + auto quantity (reorder level × 2). " +
          "REVIEW: The PO is created as 'draft' — review it in the Purchase Hub before sending. " +
          "GOTCHA: If no supplier is linked to the product, you'll get a 'No supplier linked' error. Add one via Suppliers → Catalog first. " +
          "TIP: Use this for fast-moving items you reorder often. For complex orders, use the full Purchase Form.",
      },
      {
        name: "Low-Stock Digest Alerts",
        description: "Email or WhatsApp the full low-stock list to all managers — grouped by preferred supplier",
        icon: AlertCircle,
        location: "Operations Dashboard → Reorder tab → 📧 Email Digest or WhatsApp button",
        locationLabel: "Operations Dashboard",
        action: "dashboard",
        color: "text-blue-600",
        bg: "bg-blue-50",
        phase: "phase5",
        access: "manager",
        trainingNote:
          "EMAIL DIGEST: Sends the complete low-stock list to ALL managers/admins with an email on file. Grouped by preferred supplier so you can create one PO per supplier. " +
          "WHATSAPP: Opens WhatsApp with the digest pre-filled — send to any contact (your own phone, a co-manager, the supplier). " +
          "DAILY CRON: Set up a Vercel Cron job to call /api/alerts/low-stock-digest?sendEmail=true every morning at 8 AM. " +
          "TIP: Don't ignore the digest — every day you delay reordering is a day of lost sales.",
      },
      {
        name: "Supplier Price History",
        description: "Track every cost change per supplier per product — sparkline chart + trend stats",
        icon: TrendingUp,
        location: "Supplier list → select supplier → violet 'Price History' button",
        locationLabel: "Supplier form",
        action: "supplier-form",
        color: "text-violet-600",
        bg: "bg-violet-50",
        phase: "phase5",
        access: "all",
        trainingNote:
          "AUTO-RECORDED: Every time you edit a supplier's cost in the Catalog dialog, a price-history entry is created. " +
          "TREND: Shows if the supplier is getting cheaper (green) or pricier (red) over time. " +
          "STATS: First cost, latest cost, total change %, # increases, # decreases. " +
          "USE CASE: Negotiate better prices — 'Your cost has gone up 15% in 6 months, can we lock in a rate?' " +
          "TIP: Review quarterly for your top 5 suppliers. Switch suppliers if one is consistently increasing while others are stable.",
      },
      {
        name: "Real Approval Workflow",
        description: "POs over the threshold get 'pending_approval' status — manager approves before the PO can be sent",
        icon: Shield,
        location: "Automatic — POs over ₵5,000 are saved as 'pending_approval'. Manager approves via the approve button.",
        locationLabel: "Automatic",
        color: "text-amber-600",
        bg: "bg-amber-50",
        phase: "phase5",
        access: "manager",
        trainingNote:
          "FLOW: Cashier creates a PO > ₵5,000 → status='pending_approval' (amber badge in Purchase Hub). " +
          "Manager reviews → enters credentials → status='approved' (violet badge). " +
          "Then the PO can be sent (status='ordered') and received. " +
          "GOTCHA: A pending_approval PO cannot be received until approved. The approve button requires manager credentials. " +
          "TIP: Set the approval threshold based on your business size. ₵5,000 is the default — adjust in the code if needed.",
      },
    ],
  },
  {
    category: "Payments & Checkout Methods",
    icon: CreditCard,
    color: "text-emerald-600",
    features: [
      {
        name: "Cash Payment",
        description: "Standard cash payment with auto-calculated change",
        icon: DollarSign,
        location: "Payment modal → Cash tab",
        locationLabel: "Payment modal",
        action: "pos",
        color: "text-emerald-600",
        bg: "bg-emerald-50",
        phase: "core",
        access: "all",
        quickStart: true,
        trainingNote:
          "FLOW: Enter amount customer gave you → system shows change due → open cash drawer (if connected) → give change → close. " +
          "QUICK CASH BUTTONS: ₵5, ₵10, ₵20, ₵50, ₵100 — tap for exact amount, change auto-calculated. " +
          "EXACT CHANGE: Tap 'Exact' button — no change due, faster checkout. " +
          "GOTCHA: Always say the change amount out loud when handing it to the customer. Prevents disputes. " +
          "END OF SHIFT: Count the drawer with the Cash Calculator and compare to the Daily Sales Report — record any variance.",
      },
      {
        name: "Mobile Money (MTN / Telecel / AirtelTigo)",
        description: "Multi-network MoMo — auto-detects network from phone number, generates payment prompt",
        icon: Smartphone,
        location: "Payment modal → MoMo tab  ·  enter customer phone number",
        locationLabel: "Payment modal",
        action: "pos",
        color: "text-yellow-600",
        bg: "bg-yellow-50",
        phase: "phase2",
        access: "all",
        quickStart: true,
        trainingNote:
          "FLOW: Enter customer's phone number (with country code, e.g. +233247075044) → system auto-detects network → click 'Send Prompt' → customer approves on their phone → success notification appears → close. " +
          "NETWORK DETECTION: 024/054/055 = MTN, 020/050 = Telecel (Vodafone), 026/056/027 = AirtelTigo. " +
          "GOTCHA: The customer MUST approve the prompt on their phone. Wait for the green success notification — do NOT close the modal early. Closing early does NOT cancel the prompt, but you won't know if it was approved. " +
          "FAILED PROMPT: If the customer says they didn't get it, click 'Resend'. If still no prompt, ask them to check their MoMo balance — they may not have enough. " +
          "GOTCHA: Refunding MoMo is slow (1–3 business days). Only refund when truly necessary — offer store credit instead.",
      },
      {
        name: "Paystack Card Payment",
        description: "Visa / Mastercard / Verve card payments via Paystack — secure online checkout",
        icon: CreditCard,
        location: "Payment modal → Card tab  ·  requires Paystack keys in env",
        locationLabel: "Payment modal",
        action: "pos",
        color: "text-blue-600",
        bg: "bg-blue-50",
        phase: "phase2",
        access: "all",
        trainingNote:
          "REQUIRES: Admin must add PAYSTACK_PUBLIC_KEY and PAYSTACK_SECRET_KEY to env. If the Card tab shows 'Not configured', tell the manager. " +
          "FLOW: Click 'Pay with Card' → a Paystack popup opens → customer enters card details or taps contactless → success → close. " +
          "GOTCHA: Card payments need internet. If offline, switch to Cash or MoMo. " +
          "REFUNDS: Card refunds must be processed from the Paystack dashboard (admin access) — they take 5–10 business days to reach the customer's bank. " +
          "TIP: For high-value sales (>₵500), prefer card over cash — less cash-handling risk.",
      },
      {
        name: "Loyalty Points Redemption",
        description: "Customers redeem loyalty points at checkout — slider for partial or full redemption, real-time discount",
        icon: Star,
        location: "Payment modal → Loyalty slider (visible if customer has points)",
        locationLabel: "Payment modal",
        action: "pos",
        color: "text-amber-600",
        bg: "bg-amber-50",
        phase: "phase4",
        access: "all",
        trainingNote:
          "REQUIRES: A customer must be attached to the sale (click the user icon in the cart header first). " +
          "RULES: 100 points = ₵1 (configurable in Admin Panel). Minimum 100 points to redeem. Points are earned at 1 point per ₵1 spent. " +
          "SLIDER: Drag to choose how many points to redeem. The discount updates live. Customer pays the balance with cash/card/MoMo. " +
          "GOTCHA: Points are deducted immediately when the sale completes — even if the sale is later voided, the points are NOT auto-restored. Manager must manually adjust in the customer profile. " +
          "TIP: Tell customers their points balance at checkout — encourages repeat visits.",
      },
      {
        name: "Credit Sales",
        description: "Sell on credit to trusted customers — track balances and payment history",
        icon: CreditCard,
        location: "Payment modal → Credit tab (requires customer)",
        locationLabel: "Payment modal",
        action: "pos",
        color: "text-rose-600",
        bg: "bg-rose-50",
        phase: "core",
        access: "all",
        trainingNote:
          "REQUIRES: A customer must be attached. Only customers with 'Credit Approved = Yes' (set by manager) can buy on credit. " +
          "TERMS: Standard terms are 14 days. Customer's outstanding balance is shown — refuse new credit if they're over their limit. " +
          "RECORDING PAYMENTS: When the customer pays later, go to Credit Management (Accounts menu) → find the customer → 'Record Payment'. " +
          "GOTCHA: A credit sale still generates a receipt and an invoice number. The customer owes the amount shown on the receipt. " +
          "TIP: Print 2 receipts for credit sales — one for the customer, one for your records. Both must be signed.",
      },
      {
        name: "Cash Calculator",
        description: "Denomination counter for fast cash reconciliation — counts notes & coins",
        icon: Calculator,
        location: "Top toolbar → Cash Calc button  ·  or SpeedDial",
        locationLabel: "Top toolbar",
        action: "pos",
        color: "text-amber-600",
        bg: "bg-amber-50",
        phase: "core",
        access: "all",
        trainingNote:
          "USE AT: End of shift, mid-shift if drawer seems off, before depositing cash at the bank. " +
          "FLOW: Enter how many of each denomination you have (₵100, ₵50, ₵20, ₵10, ₵5, ₵2, ₵1, 50p, 20p, 10p, 5p, 1p) → total auto-calculates → compare to expected (from Daily Sales Report). " +
          "TIP: Count twice — once for the system, once on paper. Discrepancies between the two counts = human error, not theft. " +
          "GOTCHA: Don't count tips or personal cash in the drawer — keep them separate.",
      },
    ],
  },
  {
    category: "Finance & Accounts",
    icon: Wallet,
    color: "text-rose-600",
    features: [
      {
        name: "Finance Operations Hub",
        description: "Central hub for expenses, cash reconciliation, mobile money tracking",
        icon: Wallet,
        location: "More → Finance & Accounts → Finance Operations",
        locationLabel: "More drawer",
        action: "finance-ops",
        color: "text-rose-600",
        bg: "bg-rose-50",
        phase: "core",
        access: "all",
        trainingNote:
          "3 TABS: Expenses (record money spent), Cash Reconciliation (count drawer vs expected), Mobile Money (track MoMo balances). " +
          "WHO USES WHAT: Cashiers can record expenses (with manager approval for >₵100). Managers do cash reconciliation. Admins see everything. " +
          "TIP: Spend 5 minutes here at the end of every shift — clean reconciliation prevents morning surprises.",
      },
      {
        name: "Expense Manager",
        description: "Record expenses across 8 categories (rent, utilities, salaries, etc.) — CSV export, approval warnings",
        icon: Wallet,
        location: "Top toolbar → Expenses button (rose)  ·  or Finance Operations → Expenses",
        locationLabel: "Top toolbar",
        action: "pos",
        color: "text-rose-600",
        bg: "bg-rose-50",
        phase: "phase2",
        access: "all",
        trainingNote:
          "8 CATEGORIES: Rent, Utilities (electricity, water, internet), Salaries, Transport, Supplies (bags, receipt rolls), Maintenance, Marketing, Misc. " +
          "APPROVAL: Expenses >₵100 trigger a manager-approval prompt. Expenses >₵500 require admin approval. " +
          "RECEIPTS: Always attach a photo of the receipt (paper clip icon). Auditors reject expenses without receipts. " +
          "GOTCHA: Don't record inventory purchases as expenses — they go through Purchase Orders (asset, not expense) until sold. " +
          "EXPORT: CSV for accounting — open in Excel and send to your accountant monthly.",
      },
      {
        name: "Accounts Reports",
        description: "P&L, VAT, trial balance, stock valuation, general ledger — full accounting suite",
        icon: TrendingUp,
        location: "More → Finance & Accounts → Accounts Reports",
        locationLabel: "More drawer",
        action: "accounts-reports",
        color: "text-amber-600",
        bg: "bg-amber-50",
        phase: "core",
        access: "all",
        trainingNote:
          "P&L (Profit & Loss): Revenue minus COGS minus Expenses = Net Profit. Run monthly for the owner. " +
          "TRIAL BALANCE: All accounts and their balances. Accountants use this for year-end. " +
          "GENERAL LEDGER: Every transaction in chronological order. The most detailed report. " +
          "STOCK VALUATION: Total inventory value at cost OR retail price. " +
          "TIP: Print P&L and Trial Balance monthly. Send to your accountant for tax filing. " +
          "GOTCHA: Reports reflect data entered into the POS. If you record expenses wrong, the P&L is wrong. Garbage in, garbage out.",
      },
      {
        name: "Credit Management",
        description: "Track customer credit balances, record payments, view aging report",
        icon: CreditCard,
        location: "Accounts menu → 💳 Credit Management",
        locationLabel: "Accounts menu",
        action: "credit-management",
        color: "text-rose-600",
        bg: "bg-rose-50",
        phase: "core",
        access: "all",
        trainingNote:
          "AGING REPORT: Shows customers grouped by how overdue their balance is (Current, 1–30 days, 31–60, 60+). " +
          "ACTION: Call customers in the 31–60 and 60+ buckets weekly. Send statements (Email button) to 1–30 bucket. " +
          "WRITE-OFF: After 90+ days with no payment, manager can write off the balance (bad debt). Don't extend new credit to written-off customers. " +
          "TIP: Don't be shy about collecting — customers respect businesses that follow up. A polite 'Your balance of ₵X is now 45 days overdue' works wonders.",
      },
      {
        name: "Auto Replenish Rules",
        description: "Set min/max levels — system auto-suggests reorder quantities",
        icon: RefreshCw,
        location: "Accounts menu → 🔄 Auto Replenish Rules",
        locationLabel: "Accounts menu",
        action: "auto-replenish",
        color: "text-cyan-600",
        bg: "bg-cyan-50",
        phase: "core",
        access: "all",
        trainingNote:
          "RULE: 'When stock of [product] falls below [min], suggest reorder of [max - current]'. " +
          "WHERE TO SEE: Operations Dashboard shows a 'Suggested Reorders' panel. AI Forecast also uses these levels. " +
          "TIP: Set min = 1 week of average sales. Set max = 4 weeks of average sales. Adjust seasonally. " +
          "GOTCHA: Don't set max too high for perishables — you'll waste stock to expiry.",
      },
      {
        name: "Multi-Currency Support",
        description: "Auto-fetch exchange rates from open.er-api.com — set purchase currency per PO",
        icon: Globe,
        location: "Purchase Form → Currency dropdown  ·  auto-updates daily",
        locationLabel: "Purchase Form",
        action: "purchase-form",
        color: "text-blue-600",
        bg: "bg-blue-50",
        phase: "phase4",
        access: "all",
        trainingNote:
          "SUPPORTED CURRENCIES: USD, EUR, GBP, GHS, NGN, CFA, ZAR, KES. Exchange rates auto-update daily. " +
          "USE CASE: Buying from a supplier in USD? Set the PO currency to USD. System records the cost in USD AND the GHS equivalent at the day's rate. " +
          "REPORTING: All reports display in GHS (your base currency). The PO shows both currencies for transparency. " +
          "GOTCHA: If you don't update the PO rate manually and the rate changes between PO creation and payment, there will be a small FX variance. This is normal.",
      },
      {
        name: "Accounting Export (Journal CSV)",
        description: "Export journal entries as CSV for import into QuickBooks, Xero, Sage, or any accounting software",
        icon: FileText,
        location: "Accounts Reports → General Ledger → Export CSV",
        locationLabel: "Accounts Reports",
        action: "accounts-reports",
        color: "text-slate-600",
        bg: "bg-slate-50",
        phase: "phase5",
        access: "all",
        trainingNote:
          "FORMAT: Standard double-entry journal — Date, Account, Debit, Credit, Memo, Reference. " +
          "COMPATIBLE WITH: QuickBooks, Xero, Sage, Tally, FreshBooks, and any system that supports CSV journal import. " +
          "EXPORT FREQUENCY: Monthly, before sending books to your accountant. " +
          "TIP: Map your POS accounts to your accounting software's chart of accounts ONCE — then monthly exports flow in automatically. " +
          "GOTCHA: Test with a small date range first. A wrong account mapping can mess up your books for a month.",
      },
      {
        name: "Cash Reconciliation",
        description: "End-of-shift cash count vs expected — variances flagged for review",
        icon: Calculator,
        location: "Finance Operations → Cash Reconciliation tab",
        locationLabel: "Finance Ops",
        action: "finance-ops",
        color: "text-amber-600",
        bg: "bg-amber-50",
        phase: "core",
        access: "all",
        trainingNote:
          "FLOW: (1) Click 'Start Reconciliation'. (2) Count cash with the Cash Calculator. (3) Enter cash sales from Daily Sales Report. (4) System shows variance = actual - expected. (5) If variance > ±₵5, manager must sign off. " +
          "GOTCHA: 'Expected' includes the float (starting cash). Don't forget to subtract the float when comparing to what's in the drawer. " +
          "TIP: A consistent small variance (always +₵2 or always -₵3) suggests rounding errors — usually fine. Random large variances suggest theft or training issues. " +
          "ALWAYS: Sign and date the reconciliation. Keep paper records for 6 months.",
      },
    ],
  },
  {
    category: "GRA Tax Compliance",
    icon: Shield,
    color: "text-rose-700",
    features: [
      {
        name: "Sequential Invoice Numbers",
        description: "INV-YYYY-NNNNNN format — never reuse, never skip. Required by GRA.",
        icon: FileText,
        location: "Automatic on every receipt",
        locationLabel: "Automatic",
        color: "text-rose-600",
        bg: "bg-rose-50",
        phase: "phase2",
        access: "all",
        trainingNote:
          "WHY IT MATTERS: GRA audits check for sequential invoice numbers. A gap = suspected unrecorded sale = fine + interest. " +
          "VOIDED SALES: Still consume a number. The void is logged. Show auditors both the void log and the gap — they'll accept it. " +
          "NEVER: Manually edit invoice numbers in the database. The sequence is the audit trail. " +
          "TIP: Once a month, list all invoice numbers for the month and verify no gaps. Report any unexplained gap to the manager immediately.",
      },
      {
        name: "VAT / NHIL / GETFL Breakdown",
        description: "Ghana tax breakdown on every receipt: VAT 15% + NHIL 2.5% + GETFL 2.5%",
        icon: Tags,
        location: "Automatic on every receipt & in Accounts Reports",
        locationLabel: "Automatic",
        color: "text-rose-600",
        bg: "bg-rose-50",
        phase: "phase2",
        access: "all",
        trainingNote:
          "TAX RATES (Ghana 2026): VAT 15%, NHIL 2.5%, GETFL 2.5%. Total = 20% on taxable items. Some items are zero-rated (basic food, medicine) or exempt. " +
          "WHAT'S TAXABLE: Most non-food items, electronics, household goods, prepared food. " +
          "WHAT'S EXEMPT: Raw agricultural produce, basic medicine, educational materials. " +
          "ON RECEIPT: Each tax shows separately so customers can claim input VAT if they're a business. " +
          "GOTCHA: If a customer asks 'why so much tax?' — explain it's 3 separate taxes combined, all required by GRA. Don't negotiate. " +
          "TIP: Train all cashiers on which items are taxable. Mis-classifying taxable as exempt = under-collected tax = penalty.",
      },
      {
        name: "GRA VAT Filing Report",
        description: "Generate the official GRA e-VAT filing report — view, print, or export",
        icon: FileText,
        location: "Accounts menu → 📊 GRA VAT Filing Report (View / Print)",
        locationLabel: "Accounts menu",
        action: "accounts-reports",
        color: "text-rose-700",
        bg: "bg-rose-50",
        phase: "phase2",
        access: "all",
        trainingNote:
          "WHEN TO FILE: Monthly, by the 14th of the following month. Late filing = penalty + interest. " +
          "FLOW: Select year + month → View (HTML preview) → verify totals match your records → Print (PDF for records) → Export JSON or XML → upload to GRA portal. " +
          "GOTCHA: The report uses the date the SALE was made, not when payment was received. A credit sale in January paid in February is filed in January. " +
          "TIP: Always cross-check the report total against your Daily Sales Reports for the same month. Discrepancies mean a missed sale or wrong date.",
      },
      {
        name: "GRA e-VAT Export (JSON / XML)",
        description: "Export e-VAT filing in JSON or XML format for direct upload to GRA portal",
        icon: FileText,
        location: "Accounts menu → GRA e-VAT Export (JSON / XML)",
        locationLabel: "Accounts menu",
        action: "accounts-reports",
        color: "text-rose-700",
        bg: "bg-rose-50",
        phase: "phase2",
        access: "all",
        trainingNote:
          "FORMATS: JSON (newer GRA portal) or XML (older format). Use what the portal accepts. " +
          "UPLOAD: Sign in to GRA portal → e-VAT filing → upload file → verify totals match → submit. " +
          "GOTCHA: Don't edit the exported file in a text editor — a single missing comma will cause upload failure. " +
          "TIP: Save the JSON/XML file with the month and year in the filename — e.g. 'vat-2026-01.json' — for your records.",
      },
      {
        name: "CSV Tax Export",
        description: "Export all VAT/NHIL/GETFL data as CSV for accounting or audit",
        icon: FileText,
        location: "Accounts Reports → VAT Tax Report → Export CSV",
        locationLabel: "Accounts Reports",
        action: "accounts-reports",
        color: "text-rose-600",
        bg: "bg-rose-50",
        phase: "phase2",
        access: "all",
        trainingNote:
          "USE FOR: Your accountant's records, internal audits, or if your accountant uses Excel instead of accounting software. " +
          "INCLUDES: Every sale, its tax breakdown, customer (if any), and invoice number. " +
          "TIP: Export monthly. Keep 6 years of CSVs (GRA retention requirement) on a backup drive.",
      },
    ],
  },
  {
    category: "Communication",
    icon: Phone,
    color: "text-cyan-600",
    features: [
      {
        name: "Telephone Directory",
        description: "Customer and supplier phone directory — searchable",
        icon: Phone,
        location: "More → Communication → Telephone Directory",
        locationLabel: "More drawer",
        action: "telephone-directory",
        color: "text-cyan-600",
        bg: "bg-cyan-50",
        phase: "core",
        access: "all",
        trainingNote:
          "SEARCH: By name, phone number, or category (customer/supplier/staff). " +
          "TIP: Always enter customers with country code (+233...) — needed for WhatsApp integration. " +
          "GOTCHA: Don't share customer phone numbers with third parties — Data Protection Act violation.",
      },
      {
        name: "Telephone Module",
        description: "Make and log phone calls to customers/suppliers",
        icon: PhoneCall,
        location: "More → Communication → Telephone Module",
        locationLabel: "More drawer",
        action: "telephone",
        color: "text-blue-600",
        bg: "bg-blue-50",
        phase: "core",
        access: "all",
        trainingNote:
          "CALL LOG: Every call is logged with timestamp, duration, and a notes field. " +
          "USE FOR: Following up on credit balances, confirming delivery, customer service. " +
          "TIP: Log the outcome of every call ('Customer will pay Friday', 'No answer'). Future calls show this history — you won't repeat yourself.",
      },
      {
        name: "Email System",
        description: "Send invoices, reports, and statements via email — SMTP-integrated",
        icon: Mail,
        location: "Maintenance menu → 📧 Email System",
        locationLabel: "Maintenance menu",
        action: "email-system",
        color: "text-blue-600",
        bg: "bg-blue-50",
        phase: "core",
        access: "all",
        trainingNote:
          "SETUP (admin only): Configure SMTP — Gmail App Password recommended. Without this, no emails can be sent. " +
          "TEMPLATES: Receipt, Statement, Custom. " +
          "USE FOR: Sending monthly statements to credit customers, emailing receipts (some customers prefer paperless), sending reports to the owner. " +
          "GOTCHA: Gmail has a 500-email/day limit on App Passwords. For high volume, use a paid SMTP service (SendGrid, Mailgun).",
      },
      {
        name: "WhatsApp Receipt Sender",
        description: "Send digital receipts via WhatsApp — auto-fills receipt text and link",
        icon: MessageCircle,
        location: "Receipt modal → WhatsApp button (green)",
        locationLabel: "Receipt modal",
        action: "pos",
        color: "text-green-600",
        bg: "bg-green-50",
        phase: "core",
        access: "all",
        trainingNote:
          "FLOW: Receipt modal → WhatsApp button → enter customer's phone number (with country code) → preview the message → 'Open WhatsApp' → WhatsApp opens with the prefilled message → customer taps send. " +
          "ALTERNATIVE: 'Copy Link' or 'View Receipt Online' — share via SMS or any messenger. The receipt opens in any browser, no WhatsApp needed. " +
          "GOTCHA: WhatsApp doesn't auto-send — the customer or you must tap send in WhatsApp. The POS just pre-fills the message. " +
          "TIP: Ask every customer 'Print or WhatsApp?' — many prefer WhatsApp (no paper to lose) and it saves receipt rolls.",
      },
      {
        name: "WhatsApp Broadcast Marketing",
        description: "Send bulk WhatsApp messages to customers — filter by tier, credit balance, or last visit",
        icon: MessageCircle,
        location: "Top toolbar → Broadcast button (green, admin/manager only)",
        locationLabel: "Top toolbar",
        action: "pos",
        color: "text-green-600",
        bg: "bg-green-50",
        phase: "phase3",
        access: "manager",
        trainingNote:
          "FILTERS: All customers, VIP tier, Credit customers (with balance), Inactive (no visit in 30/60/90 days), Birthday this month. " +
          "COMPLIANCE: WhatsApp bans accounts that send too many messages too fast. The system adds a 5-second delay between sends. Don't exceed 200 messages per day. " +
          "GOTCHA: Always include an 'opt out' option ('Reply STOP to unsubscribe'). Required by Ghana's Data Protection Act. " +
          "TIP: Personalize — 'Hi {name}, we miss you!' gets 3x more response than a generic blast. " +
          "DON'T: Spam. One broadcast per week max. Quality over quantity.",
      },
    ],
  },
  {
    category: "Print & Labels",
    icon: Printer,
    color: "text-purple-600",
    features: [
      {
        name: "Thermal Printer (ESC/POS)",
        description: "Bluetooth thermal printer integration — auto-pair, browser fallback for regular printers",
        icon: Printer,
        location: "SpeedDial → Pair Printer  ·  receipts auto-print after sale",
        locationLabel: "SpeedDial",
        action: "pos",
        color: "text-blue-600",
        bg: "bg-blue-50",
        phase: "phase1",
        access: "all",
        trainingNote:
          "PAIRING: SpeedDial → Pair Printer → select your Bluetooth printer from the list. PIN is usually 0000 or 1234. " +
          "TEST: After pairing, send a test print. If garbled, the printer may use a different ESC/POS dialect — try a different brand setting. " +
          "GOTCHA: Bluetooth printers disconnect when the device sleeps. If receipts stop printing, re-pair. " +
          "FALLBACK: If Bluetooth fails, the system falls back to the browser's print dialog (any connected printer works). " +
          "TIP: Keep a spare roll of thermal paper in the drawer. Running out mid-sale is embarrassing.",
      },
      {
        name: "Label Printer (4 sizes, Code 128 barcode)",
        description: "Print product labels with scannable Code 128 barcodes — 4 label sizes, multi-select",
        icon: Tags,
        location: "Top toolbar → Labels button (purple)",
        locationLabel: "Top toolbar",
        action: "pos",
        color: "text-purple-600",
        bg: "bg-purple-50",
        phase: "phase1",
        access: "all",
        trainingNote:
          "LABEL SIZES: 30×20mm (small), 50×30mm (medium), 70×50mm (large), 100×70mm (extra large). Choose based on product size. " +
          "MULTI-SELECT: Click checkboxes on multiple products, then 'Print Selected Labels' — prints one label per product. " +
          "BARCODE: Code 128 (most widely supported). Test scan with your barcode scanner before printing a batch. " +
          "GOTCHA: If the barcode doesn't scan, check the printer DPI — low-DPI printers can't render tiny barcodes. Use a larger label size. " +
          "TIP: Print a sheet of 50 labels for new stock arrivals in one go. Saves time vs. printing one at a time.",
      },
      {
        name: "Price Tags Printer",
        description: "Print simple shelf price tags for products",
        icon: Tags,
        location: "Top toolbar → Tags button",
        locationLabel: "Top toolbar",
        action: "pos",
        color: "text-purple-600",
        bg: "bg-purple-50",
        phase: "core",
        access: "all",
        trainingNote:
          "USE FOR: Shelf edge labels showing product name + price. No barcode — for shelf display, not for scanning. " +
          "WHEN TO REPRINT: Whenever you change a product's price. Old price tags mislead customers — GRA fines for price mismatches. " +
          "TIP: Walk the aisles weekly with a fresh printout of price changes. Replace tags systematically. " +
          "GOTCHA: Tags with crossed-out old prices look unprofessional. Always reprint, don't hand-correct.",
      },
      {
        name: "Receipt Print (PDF / Paper)",
        description: "Print receipt to any connected printer or save as PDF",
        icon: Printer,
        location: "Receipt modal → Print / PDF button",
        locationLabel: "Receipt modal",
        action: "pos",
        color: "text-slate-600",
        bg: "bg-slate-50",
        phase: "core",
        access: "all",
        shortcut: "F3",
        trainingNote:
          "PAPER: Sends to your default printer (thermal or regular). " +
          "PDF: Opens the browser's print dialog — choose 'Save as PDF' instead of a printer. Saves a digital copy. " +
          "REPRINT: Receipt Archive → find the sale → Reprint. Uses the ORIGINAL invoice number — does not create a new one. " +
          "GOTCHA: If the printer is offline, the receipt still 'completes' in the system — you just don't have paper proof. Reprint from Archive once the printer is back.",
      },
      {
        name: "Brand-able Purchase Order PDF",
        description: "Generate branded PDF purchase orders to send to suppliers",
        icon: FileText,
        location: "Purchase Orders → select PO → Download PDF",
        locationLabel: "Purchase Orders",
        action: "purchase",
        color: "text-violet-600",
        bg: "bg-violet-50",
        phase: "core",
        access: "all",
        trainingNote:
          "WHAT'S ON IT: Your logo, company info, supplier info, line items, totals, tax breakdown, payment terms, delivery instructions. " +
          "USE: Email to supplier (via Email System) or print and fax. " +
          "TIP: Set your logo and terms in Admin Panel → Settings once. Every PO uses the same branding. " +
          "GOTCHA: PDFs are non-editable. If you need to change a PO after sending, send a new one with 'REVISED' in the subject line.",
      },
    ],
  },
  {
    category: "AI Tools",
    icon: Sparkles,
    color: "text-violet-600",
    features: [
      {
        name: "AI Business Assistant",
        description: "Ask natural-language questions about your business — sales trends, stock advice, customer insights",
        icon: Sparkles,
        location: "Header bar → user avatar → AI Assistant  ·  or SpeedDial → AI",
        locationLabel: "User menu",
        action: "pos",
        color: "text-violet-600",
        bg: "bg-violet-50",
        phase: "core",
        access: "all",
        trainingNote:
          "EXAMPLE QUESTIONS: 'What were my top 5 products last week?', 'Which customers haven't visited in 30 days?', 'How much VAT did I collect in January?', 'Suggest reorder quantities for next week'. " +
          "RESPONSE: AI pulls live data from your POS, analyzes it, and gives a natural-language answer with charts/tables. " +
          "GOTCHA: The AI is only as good as your data. If you don't record expenses or skip stocktakes, its advice will be off. " +
          "TIP: Ask follow-up questions — 'Drill down to which day' or 'Show me the customers by name'. The AI remembers context within a conversation.",
      },
      {
        name: "AI Demand Forecast",
        description: "Predict future demand for products — 7/14/30/60/90-day forecasts with confidence scores and reorder suggestions",
        icon: Brain,
        location: "Top toolbar → AI Forecast button (violet, admin/manager only)",
        locationLabel: "Top toolbar",
        action: "pos",
        color: "text-violet-600",
        bg: "bg-violet-50",
        phase: "phase3",
        access: "manager",
        trainingNote:
          "HOW IT WORKS: AI analyzes your last 90 days of sales (seasonality, day-of-week, trend) and predicts demand for the next 7/14/30/60/90 days. " +
          "CONFIDENCE SCORE: 0–100%. Below 60% means limited data — trust the forecast less. New products need 30+ days of sales before forecasts are reliable. " +
          "REORDER SUGGESTIONS: Combines forecast with current stock and lead time. Tells you 'order X units of Y by Z date'. " +
          "TIP: Run weekly. Use 14-day forecast for perishables, 60-day for non-perishables. " +
          "GOTCHA: Forecasts don't account for promotions or one-off events (festivals, holidays). Manually adjust if you're running a sale.",
      },
      {
        name: "Voice Search",
        description: "Search products by speaking — Web Speech API integration",
        icon: Smartphone,
        location: "POS Screen → microphone icon next to search bar",
        locationLabel: "POS toolbar",
        action: "pos",
        color: "text-cyan-600",
        bg: "bg-cyan-50",
        phase: "phase5",
        access: "all",
        trainingNote:
          "REQUIRES: Chrome or Edge browser (Web Speech API). Mobile and desktop both supported. " +
          "FLOW: Tap mic icon → speak product name ('Coca Cola 500ml') → text appears in search bar → press Enter to search. " +
          "GOTCHA: Background noise affects accuracy. Use in a quiet environment or with a headset mic. " +
          "TIP: Great for hands-free operation when your hands are dirty (e.g. fresh produce section).",
      },
    ],
  },
  {
    category: "Reports & Analytics",
    icon: BarChart3,
    color: "text-amber-600",
    features: [
      {
        name: "Operations Dashboard",
        description: "Real-time KPIs: today's revenue, transactions, top products, low stock, expiry alerts, hourly chart",
        icon: BarChart3,
        location: "Bottom Nav → Dashboard tab",
        locationLabel: "Bottom Nav",
        action: "dashboard",
        color: "text-emerald-600",
        bg: "bg-emerald-50",
        phase: "core",
        access: "all",
        quickStart: true,
        trainingNote:
          "CHECK AT: Start of shift, mid-shift, end of shift. Takes 30 seconds. " +
          "WHAT TO WATCH: Today's revenue (is it on track?), Low Stock panel (reorder needed?), Expiry Alerts (remove from shelf?), Hourly chart (when are we busy?). " +
          "ACTION: If revenue is below 50% of usual by 2 PM, consider a promotion. If expiry alerts > 5 items, address immediately. " +
          "TIP: The dashboard updates every 30 seconds. No refresh needed.",
      },
      {
        name: "Advanced Reports Dashboard",
        description: "ABC analysis, profit margins, hourly traffic, employee performance — deep business analytics",
        icon: PieChart,
        location: "Top toolbar → Reports button (amber, admin/manager only)",
        locationLabel: "Top toolbar",
        action: "pos",
        color: "text-amber-600",
        bg: "bg-amber-50",
        phase: "phase4",
        access: "manager",
        trainingNote:
          "ABC ANALYSIS: A = top 20% of products (80% of revenue). B = next 30%. C = bottom 50%. Focus on A, consider discontinuing C. " +
          "PROFIT MARGINS: Per product, per category. Surprisingly low margins may indicate wrong pricing or supplier cost increases. " +
          "HOURLY TRAFFIC: When are you busy? Schedule staff accordingly. Most stores have 2 peaks (lunch + after-work). " +
          "EMPLOYEE PERFORMANCE: Sales per cashier, average sale, refund rate. High refund rate may indicate training issue or fraud. " +
          "TIP: Run this weekly. Print the ABC analysis and share with the owner — it informs buying decisions.",
      },
      {
        name: "Reports Center",
        description: "Central hub for all reports — sales, stock, finance, tax",
        icon: FileBarChart,
        location: "POS menu → 📋 Reports Center",
        locationLabel: "POS menu",
        action: "reports-center",
        color: "text-blue-600",
        bg: "bg-blue-50",
        phase: "core",
        access: "all",
        trainingNote:
          "ONE STOP SHOP for all reports. Categories: Sales, Stock, Finance, Tax, Custom. " +
          "TIP: Bookmark this page. Most cashier questions can be answered from here.",
      },
      {
        name: "Receipt Archive",
        description: "Browse, reprint, or resend past receipts",
        icon: FileText,
        location: "POS menu → 🧾 Receipt Archive",
        locationLabel: "POS menu",
        action: "receipt-archive",
        color: "text-slate-600",
        bg: "bg-slate-50",
        phase: "core",
        access: "all",
        trainingNote:
          "See full notes under Sales & Checkout → Receipt Archive. Quick tip: ALWAYS reprint from here (preserves invoice number) — never re-sell to get a new receipt.",
      },
      {
        name: "Profit Margin Report (Landed Cost)",
        description: "Per-product profit margins using true landed cost — identifies loss-making items + suggests prices",
        icon: TrendingUp,
        location: "Accounts menu → 📊 Profit Margin Report (landed cost)",
        locationLabel: "Accounts menu",
        action: "profit-margin-report",
        color: "text-emerald-600",
        bg: "bg-emerald-50",
        phase: "phase5",
        access: "all",
        trainingNote:
          "TRUE MARGIN: Uses the landed cost (raw supplier cost + freight/customs/insurance) when available, falling back to Product.costPrice. " +
          "LOSS ALERT: Red banner shows # of products selling at a loss. Sort by Margin % (low → high) to see them first. " +
          "SUGGESTED PRICE: cost × 1.25 markup. Shows 'raise ↑' in amber when your current price is below suggested. " +
          "FILTERS: Date range, category, sort (profit/margin/revenue/units), low-margin threshold (< 5/10/15/20%). " +
          "TIP: Run weekly. Products with margins < 10% need a price increase or supplier switch.",
      },
      {
        name: "Customer Statements (Credit)",
        description: "Monthly account statements for credit customers — printable PDF + email + aging breakdown",
        icon: FileText,
        location: "Accounts menu → 📄 Customer Statements (credit)",
        locationLabel: "Accounts menu",
        action: "customer-statements",
        color: "text-violet-600",
        bg: "bg-violet-50",
        phase: "phase5",
        access: "all",
        trainingNote:
          "USE FOR: Monthly statements to credit customers, collections follow-up, dispute resolution, GRA audit. " +
          "CONTENTS: Opening balance, all transactions in the period (credit sales + payments), running balance, closing balance, aging breakdown (current / 1-30 / 31-60 / 60+ days). " +
          "PRINT: Opens a printable HTML statement — use 'Save as PDF' from the print dialog. " +
          "EMAIL: Opens your email client with the summary pre-filled. Attach the PDF for the full transaction list. " +
          "TIP: Send monthly to all credit customers with a balance. Reduces disputes and speeds up collections.",
      },
      {
        name: "Employee Performance Report",
        description: "Per-cashier sales, refunds, voids, avg sale, sales/hour — with fraud-detection alerts",
        icon: Users,
        location: "Accounts menu → 👥 Employee Performance + 💰 Cash Flow → Employee Performance tab",
        locationLabel: "Accounts menu",
        action: "financial-reports",
        color: "text-amber-600",
        bg: "bg-amber-50",
        phase: "phase5",
        access: "manager",
        trainingNote:
          "STATS PER CASHIER: Total sales + revenue, avg sale value, refund count + rate, void count + rate, days worked, sales/hour, revenue/hour. " +
          "FRAUD DETECTION: Red alert when any cashier has refund or void rate > 10%. May indicate training issues, quality problems, or theft. " +
          "USE FOR: HR, payroll, bonus calculations, performance reviews. " +
          "TIP: Review weekly. Investigate any cashier with abnormally high void/refund rates — sit with them and watch a few transactions.",
      },
      {
        name: "Cash Flow Report",
        description: "Daily cash IN vs cash OUT — sales, supplier payments, expenses with running balance",
        icon: Wallet,
        location: "Accounts menu → 👥 Employee Performance + 💰 Cash Flow → Cash Flow tab",
        locationLabel: "Accounts menu",
        action: "financial-reports",
        color: "text-rose-600",
        bg: "bg-rose-50",
        phase: "phase5",
        access: "manager",
        trainingNote:
          "CASH IN: Sales by payment method (cash, MoMo, card, wallet). " +
          "CASH OUT: Supplier payments (minus WHT, since WHT goes to GRA) + expenses by category. " +
          "CHART: Daily bar chart — green = positive (more cash in), red = negative (more cash out). " +
          "BREAKDOWN: Source bars (where cash came from) + category bars (where it went). " +
          "USE FOR: Cash flow management, predicting shortfalls, bank deposit planning. " +
          "TIP: If running balance trends negative for several days, you're spending more than you're earning — cut expenses or boost sales.",
      },
    ],
  },
  {
    category: "Operations & Admin",
    icon: Shield,
    color: "text-purple-600",
    features: [
      {
        name: "Maintenance & Settings",
        description: "System maintenance tools, backups, data integrity checks, system settings",
        icon: Wrench,
        location: "Top menu → Maintenance",
        locationLabel: "Top menu",
        action: "maintenance",
        color: "text-orange-600",
        bg: "bg-orange-50",
        phase: "core",
        access: "all",
        trainingNote:
          "ADMIN TABS: System Settings, Backup Database, Email System, Features Map (admin guide), User Management, Security, Admin Panel, Cashier Shift. " +
          "BACKUP: Run before any major change (bulk import, schema migration, price updates). 30-day auto-rotation. " +
          "GOTCHA: Don't change System Settings without reading the documentation. Some settings (like tax rate) affect every past sale's display.",
      },
      {
        name: "Admin Panel",
        description: "User management, system settings, audit logs — admin only",
        icon: Shield,
        location: "Maintenance menu → Admin Panel  ·  requires admin credentials",
        locationLabel: "Maintenance menu",
        action: "admin-login",
        color: "text-purple-600",
        bg: "bg-purple-50",
        phase: "core",
        access: "admin",
        trainingNote:
          "ACCESS: Requires admin credentials. Re-authentication every 30 minutes (security). " +
          "WHAT'S HERE: User management (add/edit/delete users, reset passwords), System Settings (tax rate, company info, loyalty rules), Audit Log (every sensitive action), Backups, Locations. " +
          "GOTCHA: Don't delete users — DEACTIVATE them. Deleting loses their audit trail. " +
          "TIP: Review the Audit Log weekly. Look for after-hours actions, repeated voids, or unusual adjustments.",
      },
      {
        name: "User Management",
        description: "Add/edit users, assign roles (admin/manager/cashier), set granular permissions",
        icon: Users,
        location: "Maintenance → User Management  ·  or Admin Panel",
        locationLabel: "Admin Panel",
        action: "maintenance",
        color: "text-indigo-600",
        bg: "bg-indigo-50",
        phase: "core",
        access: "admin",
        trainingNote:
          "ROLES: Admin (full access), Manager (most things except user management & system settings), Cashier (POS + basic reports). " +
          "PERMISSIONS: Granular — canVoid, canAdjustStock, canExport, financeOps, etc. Set per user. " +
          "ONBOARDING: New user → set role → set permissions → temp password → user logs in → forced password change. " +
          "OFFBOARDING: Deactivate, don't delete. Their sales records stay linked to their name. " +
          "TIP: Quarterly review — remove permissions from users who don't need them anymore. Principle of least privilege.",
      },
      {
        name: "2FA (TOTP)",
        description: "Two-factor authentication using Google Authenticator / Authy — TOTP standard",
        icon: Lock,
        location: "Admin Panel → Security → 2FA Setup (admin only)",
        locationLabel: "Admin Panel",
        action: "admin-login",
        color: "text-rose-600",
        bg: "bg-rose-50",
        phase: "phase5",
        access: "admin",
        trainingNote:
          "SETUP: Admin Panel → Security → Enable 2FA → scan QR code with Google Authenticator (or Authy, 1Password) → enter 6-digit code to confirm. " +
          "BACKUP CODES: Save the 10 backup codes somewhere safe (printed, in a safe). Each can be used once if you lose your phone. " +
          "GOTCHA: If you lose your phone AND your backup codes, you're locked out. Contact support — recovery takes 24–48 hours. " +
          "TIP: Enable 2FA for ALL admin and manager accounts. Cashier accounts can skip 2FA (shared devices, would be impractical).",
      },
      {
        name: "Sync Settings",
        description: "Configure data sync, offline mode, and server connection",
        icon: Settings,
        location: "More → Admin → Sync Settings",
        locationLabel: "More drawer",
        action: "sync-settings",
        color: "text-slate-600",
        bg: "bg-slate-50",
        phase: "core",
        access: "admin",
        trainingNote:
          "OFFLINE MODE: When internet drops, sales queue locally (IndexedDB) and auto-sync when back online. Status shown in the header indicator. " +
          "CONFLICT RESOLUTION: If the same product is edited on two devices while offline, the last sync wins. Manual merge may be needed. " +
          "TIP: Test offline mode monthly — turn off WiFi, make a sale, turn it back on, verify the sale synced. " +
          "GOTCHA: Don't let offline sales queue grow > 50. Sync issues multiply. Find WiFi and sync.",
      },
      {
        name: "Cashier Shift Management",
        description: "Open/close cashier shifts, track shift totals, end-of-day reconciliation",
        icon: Clock3,
        location: "Maintenance menu → Cashier Shift",
        locationLabel: "Maintenance menu",
        action: "maintenance",
        color: "text-cyan-600",
        bg: "bg-cyan-50",
        phase: "core",
        access: "all",
        trainingNote:
          "OPEN SHIFT: Enter starting cash float (e.g. ₵100). Confirms you, the time, and the float. " +
          "CLOSE SHIFT: Count cash (Cash Calculator), record variance, sign off. Generates a shift report — print and file. " +
          "GOTCHA: ALWAYS close your shift before logging out. An open shift blocks the next cashier from starting cleanly. " +
          "TIP: One shift per cashier per day. Don't share logins — audits need to know WHO did WHAT.",
      },
      {
        name: "Email System Config",
        description: "Configure SMTP for sending emails (Gmail App Password or other provider)",
        icon: Mail,
        location: "Maintenance menu → 📧 Email System",
        locationLabel: "Maintenance menu",
        action: "email-system",
        color: "text-blue-600",
        bg: "bg-blue-50",
        phase: "core",
        access: "admin",
        trainingNote:
          "GMAIL SETUP: Google Account → Security → 2-Step Verification → App Passwords → Generate. Use this 16-char password in the SMTP settings (NOT your normal Gmail password). " +
          "SETTINGS: SMTP host = smtp.gmail.com, port = 587, encryption = TLS, user = your@gmail.com, password = App Password. " +
          "TEST: Always send a test email after configuring. If it fails, check the App Password is correct (no spaces). " +
          "GOTCHA: Less secure apps access was REMOVED by Google in 2022. Only App Passwords work now. " +
          "ALTERNATIVES: SendGrid (free up to 100/day), Mailgun, Amazon SES — for higher volume.",
      },
    ],
  },
  {
    category: "Data, Backup & Performance",
    icon: Database,
    color: "text-slate-600",
    features: [
      {
        name: "Database Backup Automation",
        description: "Automatic daily backups via cron API — 30-day retention, restore from Admin Panel",
        icon: Database,
        location: "Automatic (daily)  ·  manage in Admin Panel → Backups",
        locationLabel: "Automatic",
        color: "text-slate-600",
        bg: "bg-slate-50",
        phase: "phase1",
        access: "admin",
        trainingNote:
          "AUTOMATIC: Daily at 2 AM (low-traffic time). Stored for 30 days, then auto-deleted. " +
          "MANUAL: Admin Panel → Backups → 'Create Backup Now'. Use before any risky operation. " +
          "RESTORE: Admin Panel → Backups → select a snapshot → Restore. WARNING: Restore OVERWRITES current data — anything since the snapshot is lost. " +
          "TIP: Download a backup to your computer monthly. Off-site backup protects against server failure. " +
          "GOTCHA: Backups include EVERYTHING — products, sales, users, settings. Don't try to 'partially' restore.",
      },
      {
        name: "Offline Mode (IndexedDB)",
        description: "Continue selling during internet outages — sales queue locally and auto-sync when online",
        icon: WifiOff,
        location: "Automatic  ·  status indicator in header (left of user menu)",
        locationLabel: "Header indicator",
        color: "text-amber-600",
        bg: "bg-amber-50",
        phase: "phase1",
        access: "all",
        trainingNote:
          "WHEN IT ACTIVATES: Automatically when the POS can't reach the server for > 5 seconds. " +
          "WHAT WORKS OFFLINE: Making sales, accepting cash & MoMo (MoMo will sync later — but the customer's prompt happens live). " +
          "WHAT DOESN'T: Receiving stock (needs server), generating reports, adding new products. " +
          "INDICATOR: Yellow dot = syncing. Red dot = offline (sales queuing). Green dot = online. " +
          "GOTCHA: Don't make credit sales offline — the customer's balance can't update. Stick to cash & MoMo. " +
          "TIP: If offline > 30 minutes, find WiFi. Long offline periods risk sync conflicts.",
      },
      {
        name: "PWA Mobile App",
        description: "Install SYLHN POS as a Progressive Web App on any device — works offline, native-like experience",
        icon: Smartphone,
        location: "Header bar → Install button  ·  or browser → Install App",
        locationLabel: "Header button",
        color: "text-violet-600",
        bg: "bg-violet-50",
        phase: "phase5",
        access: "all",
        trainingNote:
          "INSTALL: Chrome/Edge → address bar → Install icon (or menu → Install SYLHN POS). On iPhone: Safari → Share → Add to Home Screen. " +
          "BENEFITS: Fullscreen (no browser chrome), app icon on home screen, faster startup, works offline. " +
          "TIP: Install on every cashier device and the owner's phone. Each device gets its own offline cache. " +
          "GOTCHA: PWA updates automatically — there's no 'update' button. If a feature seems missing, hard-refresh (Ctrl+Shift+R).",
      },
      {
        name: "Performance Optimizations",
        description: "7 database indexes + API caching + query optimization — fast on slow connections",
        icon: Zap,
        location: "Automatic  ·  applied via SQL script in /scripts/",
        locationLabel: "Automatic",
        color: "text-amber-600",
        bg: "bg-amber-50",
        phase: "phase5",
        access: "admin",
        trainingNote:
          "INDEXES: 7 indexes on hot columns (sales.date, sales.invoiceNumber, product.sku, etc.). Apply via scripts/performance-indexes.sql in Neon SQL editor. " +
          "CACHING: Top 100 products cached for 5 minutes — instant POS grid load. Cache invalidates on stock change. " +
          "TIP: If the POS feels slow, check (1) internet speed, (2) database size (> 100k sales = consider archiving), (3) apply indexes if not done.",
      },
      {
        name: "Data Integrity Protection",
        description: "3-layer protection: backup snapshots + SHA-256 manifest + auto-restore on startup",
        icon: Shield,
        location: "Automatic on dev server start  ·  scripts/protection-snapshot.js",
        locationLabel: "Automatic",
        color: "text-emerald-600",
        bg: "bg-emerald-50",
        phase: "phase5",
        access: "admin",
        trainingNote:
          "WHAT IT DOES: Every dev server start, the system checks all 133 source files against a SHA-256 manifest. If any are missing or modified, they're auto-restored from the latest backup snapshot. " +
          "WHY: Prevents accidental data loss from git issues, manual edits, or deployment problems. " +
          "MANUAL: Run `node scripts/protection-snapshot.js --verify` to check integrity, `--restore` to fix manually. " +
          "GOTCHA: This protects SOURCE FILES, not the DATABASE. Database backups are separate (see Database Backup Automation).",
      },
    ],
  },
  {
    category: "Security",
    icon: Lock,
    color: "text-rose-600",
    features: [
      {
        name: "Strong Password Validation",
        description: "Enforces strong passwords: min 8 chars, mix of upper/lower/numbers",
        icon: Key,
        location: "Automatic  ·  enforced on user creation & password change",
        locationLabel: "Automatic",
        color: "text-rose-600",
        bg: "bg-rose-50",
        phase: "phase5",
        access: "admin",
        trainingNote:
          "RULES: Min 8 chars, at least 1 uppercase, 1 lowercase, 1 number. Special chars recommended. " +
          "FORBIDDEN: 'password', '12345678', the user's name, the company name. " +
          "TIP: Use a passphrase — 'GreenApple42!' is easier to remember than 'X7q#zP9m' and just as strong. " +
          "DON'T: Reuse the same password across systems. Use a password manager (Bitwarden, 1Password).",
      },
      {
        name: "Force Password Change on First Login",
        description: "New users must change their password on first login — prevents default-password attacks",
        icon: RefreshCw,
        location: "Automatic  ·  triggered for new users",
        locationLabel: "Automatic",
        color: "text-rose-600",
        bg: "bg-rose-50",
        phase: "phase5",
        access: "admin",
        trainingNote:
          "WHY: When admin creates a new user with a temporary password, that password is shared knowledge. The new user MUST change it before accessing the system. " +
          "TIP: Generate temp passwords randomly (use a password manager's generator), not 'password123'. " +
          "GOTCHA: Don't bypass this for convenience. Even trusted staff should change their password — protects them as much as the business.",
      },
      {
        name: "Account Lockout",
        description: "Auto-lock account after repeated failed login attempts — protects against brute force",
        icon: Lock,
        location: "Automatic  ·  unlocks via admin",
        locationLabel: "Automatic",
        color: "text-rose-600",
        bg: "bg-rose-50",
        phase: "phase5",
        access: "admin",
        trainingNote:
          "RULES: 5 failed attempts = 15-minute lockout. 10 failed = 1-hour lockout. 20 failed = admin must unlock. " +
          "UNLOCK: Admin Panel → Users → find user → Unlock. " +
          "FALSE LOCKOUTS: Common causes — Caps Lock, wrong keyboard layout, password autofill with an old password. Check these before assuming attack. " +
          "TIP: If a user gets locked out repeatedly, sit with them and watch their login. May be a training issue.",
      },
      {
        name: "Manager Approval for Sensitive Actions",
        description: "Void transactions, returns, and stock adjustments require manager PIN",
        icon: Shield,
        location: "Automatic  ·  prompts when action requires approval",
        locationLabel: "Automatic",
        color: "text-purple-600",
        bg: "bg-purple-50",
        phase: "core",
        access: "manager",
        trainingNote:
          "TRIGGERS: Voids (F4), refunds, stock adjustments > ₵50, discounts > 10%, deleting a product, price changes > 20%. " +
          "FLOW: Cashier initiates action → manager PIN prompt → manager enters PIN → action completes. PIN is logged with the cashier name and manager name. " +
          "GOTCHA: Don't share your manager PIN with cashiers — defeats the purpose. If a cashier needs approval often, ask why. " +
          "AUDIT: Every approval is logged. Review weekly — patterns of approvals by the same manager for the same cashier may indicate collusion.",
      },
      {
        name: "Audit Log",
        description: "Every sensitive action is logged — who did what and when. View in Admin Panel.",
        icon: History,
        location: "Admin Panel → Audit Log",
        locationLabel: "Admin Panel",
        action: "admin-login",
        color: "text-slate-600",
        bg: "bg-slate-50",
        phase: "core",
        access: "admin",
        trainingNote:
          "LOGGED: Logins, logouts, voids, refunds, stock adjustments, price changes, user creations, settings changes, backups, restores. " +
          "RETENTION: 2 years (GRA requirement). " +
          "FILTER BY: User, action type, date range. Export to CSV for auditors. " +
          "RED FLAGS: After-hours actions, repeated voids by same cashier, settings changes by non-admins, logins from new devices. " +
          "TIP: Review weekly. 10 minutes of audit review prevents 10 hours of incident investigation.",
      },
    ],
  },
  {
    category: "Quick Actions (SpeedDial)",
    icon: Plus,
    color: "text-emerald-600",
    features: [
      {
        name: "AI Assistant",
        description: "Open AI business assistant chat",
        icon: Sparkles,
        location: "Floating + button (bottom-left) → AI Assistant",
        locationLabel: "SpeedDial",
        action: "pos",
        color: "text-violet-600",
        bg: "bg-violet-50",
        phase: "core",
        access: "all",
        trainingNote:
          "FLOATING BUTTON: Bottom-left, expands on tap to reveal 4 quick actions. " +
          "TIP: Use AI Assistant for 'how do I' questions — faster than searching the Features Map.",
      },
      {
        name: "Scan Barcode",
        description: "Camera barcode scanner",
        icon: ScanLine,
        location: "Floating + button → Scan Barcode",
        locationLabel: "SpeedDial",
        action: "pos",
        color: "text-emerald-600",
        bg: "bg-emerald-50",
        phase: "core",
        access: "all",
        trainingNote:
          "See full notes under Stock & Inventory → Barcode Scanner. Quick tip: good lighting is the #1 factor in scan reliability.",
      },
      {
        name: "Pair Thermal Printer",
        description: "Pair a Bluetooth thermal printer for receipt printing",
        icon: Printer,
        location: "Floating + button → Pair Printer",
        locationLabel: "SpeedDial",
        action: "pos",
        color: "text-blue-600",
        bg: "bg-blue-50",
        phase: "phase1",
        access: "all",
        trainingNote:
          "See full notes under Print & Labels → Thermal Printer. Quick tip: re-pair if receipts stop — Bluetooth sleeps.",
      },
      {
        name: "Cash Calculator",
        description: "Quick denomination counter",
        icon: Calculator,
        location: "Floating + button → Cash Calculator",
        locationLabel: "SpeedDial",
        action: "pos",
        color: "text-amber-600",
        bg: "bg-amber-50",
        phase: "core",
        access: "all",
        trainingNote:
          "See full notes under Payments → Cash Calculator. Quick tip: count twice, on paper and in the system.",
      },
    ],
  },
  {
    category: "Header Bar (top of screen)",
    icon: Store,
    color: "text-emerald-700",
    features: [
      {
        name: "User Menu (AI / Shortcuts / Logout)",
        description: "Click your avatar — opens menu with AI Assistant, Keyboard Shortcuts, Dark Mode, Features Map (admin), Logout",
        icon: Users,
        location: "Header bar → click your avatar (top-right)",
        locationLabel: "Header → Avatar",
        color: "text-emerald-600",
        bg: "bg-emerald-50",
        phase: "phase5",
        access: "all",
        quickStart: true,
        trainingNote:
          "ALWAYS-VISIBLE: Your avatar (top-right) is the one button that never gets pushed off-screen. Click it to open the user menu. " +
          "MENU CONTAINS: AI Assistant, Keyboard Shortcuts (?), Dark Mode toggle, Features Map (admin/manager only), Logout. " +
          "MOBILE: On phones, the user menu ALSO shows daily sales / transactions / date — these stats are hidden on small screens. " +
          "GOTCHA: Always use the Logout button here — don't just close the browser. Logout clears your session and frees up the license for the next cashier.",
      },
      {
        name: "Dark Mode Toggle",
        description: "Switch between light and dark themes",
        icon: Moon,
        location: "Header bar → moon/sun icon  ·  or User Menu",
        locationLabel: "Header bar",
        color: "text-slate-600",
        bg: "bg-slate-50",
        phase: "core",
        access: "all",
        trainingNote:
          "USE DARK MODE: In low-light environments (evening shifts, dimly-lit stockrooms). Reduces eye strain. " +
          "USE LIGHT MODE: In bright sunlight (outdoor markets). Better contrast. " +
          "PREFERENCE: Saved per device — each cashier can have their own setting.",
      },
      {
        name: "Install as App (PWA)",
        description: "Install SYLHN POS as a Progressive Web App",
        icon: Smartphone,
        location: "Header bar → Install button",
        locationLabel: "Header bar",
        color: "text-violet-600",
        bg: "bg-violet-50",
        phase: "phase5",
        access: "all",
        trainingNote:
          "See full notes under Data, Backup & Performance → PWA Mobile App. Quick tip: install on every cashier device for faster startup.",
      },
      {
        name: "Offline Sync Indicator",
        description: "Shows online/offline status + count of queued sales waiting to sync",
        icon: Activity,
        location: "Header bar → left of user avatar",
        locationLabel: "Header bar",
        color: "text-amber-600",
        bg: "bg-amber-50",
        phase: "phase1",
        access: "all",
        trainingNote:
          "GREEN DOT: Online, all synced. YELLOW: Syncing (wait a few seconds). RED: Offline (sales queuing locally). " +
          "NUMBER: If red, shows count of queued sales. > 10 = find WiFi urgently. " +
          "GOTCHA: Don't refresh the page while red with queued sales — you'll lose the queue. Wait for sync.",
      },
      {
        name: "Multi-Store Switcher",
        description: "Switch between store locations",
        icon: Store,
        location: "Header bar → location dropdown (next to logo)",
        locationLabel: "Header bar",
        color: "text-purple-600",
        bg: "bg-purple-50",
        phase: "phase5",
        access: "all",
        trainingNote:
          "See full notes under Stock & Inventory → Multi-Store Location Switcher. Quick tip: confirm the location at shift start.",
      },
      {
        name: "Keyboard Shortcuts (?)",
        description: "Press ? anywhere to toggle the shortcuts overlay — or open via User Menu",
        icon: Eye,
        location: "Press ? key  ·  or User Menu → Keyboard Shortcuts",
        locationLabel: "Press ? key",
        color: "text-emerald-600",
        bg: "bg-emerald-50",
        phase: "core",
        access: "all",
        shortcut: "?",
        quickStart: true,
        trainingNote:
          "MOST USED: Ctrl+P (POS), Ctrl+N (New Sale), F2 (Hold), F3 (Print), F4 (Void), F5 (Pay). " +
          "LEARN: Print the shortcuts overlay (open it, screenshot, print, tape to the register). New cashiers memorize them in a week. " +
          "TIP: Shortcuts work even when the search bar is focused — except ? (which opens this overlay).",
      },
    ],
  },
];

// Helper to render icons not imported above.
function Mic(props: any) { return <Smartphone {...props} />; }
function Percent(props: any) { return <Tags {...props} />; }

type FilterMode = "all" | "recent" | "admin" | "quick";

const QUICK_START_STEPS = [
  { step: 1, title: "Sign in & confirm location", detail: "Check the location dropdown in the header matches your store." },
  { step: 2, title: "Open the Operations Dashboard", detail: "Tap Dashboard in the bottom nav. Review today's revenue, low stock, and expiry alerts." },
  { step: 3, title: "Make your first sale", detail: "POS tab → tap a product → F5 to pay → choose Cash/MoMo/Card → done." },
  { step: 4, title: "Hold an order for a waiting customer", detail: "Press F2 to save the cart. Recall via Sale menu → Held Orders." },
  { step: 5, title: "Check the Expiry Manager", detail: "Top toolbar → Expiry. Remove any RED (expired) items from shelves immediately." },
  { step: 6, title: "End-of-shift: count cash & close shift", detail: "Cash Calculator (top toolbar) → count drawer → Maintenance → Cashier Shift → Close." },
];

export function FeaturesMap({ onBack, onNavigate }: FeaturesMapProps) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterMode>("all");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [trainingMode, setTrainingMode] = useState(false);
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({});
  const [showQuickStart, setShowQuickStart] = useState(true);

  const totalFeatures = useMemo(
    () => CATEGORIES.reduce((sum, c) => sum + c.features.length, 0),
    []
  );

  const recentCount = useMemo(
    () => CATEGORIES.reduce(
      (sum, c) => sum + c.features.filter(f => f.phase && f.phase !== "core").length,
      0
    ),
    []
  );

  const adminCount = useMemo(
    () => CATEGORIES.reduce(
      (sum, c) => sum + c.features.filter(f => f.access === "admin").length,
      0
    ),
    []
  );

  const notesCount = useMemo(
    () => CATEGORIES.reduce(
      (sum, c) => sum + c.features.filter(f => !!f.trainingNote).length,
      0
    ),
    []
  );

  const quickStartFeatures = useMemo(
    () => CATEGORIES.flatMap(c => c.features.filter(f => f.quickStart)),
    []
  );

  const filteredCategories = useMemo(() => {
    const q = search.toLowerCase().trim();
    return CATEGORIES.map(cat => ({
      ...cat,
      features: cat.features.filter(f => {
        if (filter === "recent" && (!f.phase || f.phase === "core")) return false;
        if (filter === "admin" && f.access !== "admin") return false;
        if (filter === "quick" && cat.category !== "Quick Actions (SpeedDial)") return false;
        if (!q) return true;
        return (
          f.name.toLowerCase().includes(q) ||
          f.description.toLowerCase().includes(q) ||
          f.location.toLowerCase().includes(q) ||
          (f.trainingNote || "").toLowerCase().includes(q) ||
          cat.category.toLowerCase().includes(q)
        );
      }),
    })).filter(cat => cat.features.length > 0);
  }, [search, filter]);

  const toggleCollapse = (cat: string) => {
    setCollapsed(s => ({ ...s, [cat]: !s[cat] }));
  };

  const toggleNote = (key: string) => {
    setExpandedNotes(s => ({ ...s, [key]: !s[key] }));
  };

  return (
    <div className="min-h-[100dvh] bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="flex-shrink-0 bg-gradient-to-r from-violet-700 via-purple-700 to-indigo-700 text-white shadow-lg sticky top-0 z-30">
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={onBack} className="h-9 w-9 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition active:scale-90 flex-shrink-0" aria-label="Back to POS">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="h-9 w-9 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center ring-1 ring-white/20 flex-shrink-0">
                <MapIcon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h1 className="text-base sm:text-lg font-bold truncate flex items-center gap-2">
                  Features Map
                  <span className="px-1.5 py-0.5 rounded-full bg-white/15 text-[9px] font-bold uppercase tracking-wider hidden sm:inline">Admin Guide</span>
                </h1>
                <p className="text-[10px] sm:text-xs text-violet-100/90 truncate">
                  {totalFeatures} features · {CATEGORIES.length} categories · {notesCount} training notes
                </p>
              </div>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-2">
            <div className="px-3 py-1.5 rounded-lg bg-white/10 ring-1 ring-white/20 text-xs font-bold">
              <span className="text-violet-200">Total:</span> {totalFeatures}
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-emerald-400/20 ring-1 ring-emerald-300/30 text-xs font-bold">
              <span className="text-emerald-100">Recent:</span> {recentCount}
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-rose-400/20 ring-1 ring-rose-300/30 text-xs font-bold">
              <span className="text-rose-100">Admin:</span> {adminCount}
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-amber-400/20 ring-1 ring-amber-300/30 text-xs font-bold flex items-center gap-1">
              <Lightbulb className="h-3 w-3" />
              <span className="text-amber-100">Notes:</span> {notesCount}
            </div>
          </div>
        </div>

        {/* Search + filter pills + training mode toggle */}
        <div className="px-4 sm:px-6 pb-3 flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/60" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search features, locations, training notes..."
              className="w-full h-10 pl-10 pr-10 rounded-xl bg-white/15 backdrop-blur text-white placeholder:text-white/60 text-sm outline-none ring-1 ring-white/20 focus:ring-white/40 transition"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 rounded-md bg-white/15 hover:bg-white/25 flex items-center justify-center"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
            {([
              { id: "all", label: `All (${totalFeatures})` },
              { id: "recent", label: `Recent (${recentCount})` },
              { id: "admin", label: `Admin-only (${adminCount})` },
              { id: "quick", label: "Quick Access" },
            ] as { id: FilterMode; label: string }[]).map(opt => (
              <button
                key={opt.id}
                onClick={() => setFilter(opt.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition flex-shrink-0 ${
                  filter === opt.id
                    ? "bg-white text-violet-700 shadow"
                    : "bg-white/10 text-white hover:bg-white/20 ring-1 ring-white/15"
                }`}
              >
                {opt.label}
              </button>
            ))}
            {/* Training Mode toggle */}
            <button
              onClick={() => setTrainingMode(s => !s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition flex-shrink-0 flex items-center gap-1.5 ${
                trainingMode
                  ? "bg-amber-400 text-amber-900 shadow ring-1 ring-amber-300"
                  : "bg-amber-400/20 text-amber-100 hover:bg-amber-400/30 ring-1 ring-amber-300/30"
              }`}
              title="Toggle to expand ALL training notes inline"
            >
              <GraduationCap className="h-3.5 w-3.5" />
              Training Mode
              {trainingMode && <span className="text-[9px] uppercase tracking-wider">ON</span>}
            </button>
          </div>
        </div>
      </header>

      {/* New Cashier Quick Start — collapsible banner */}
      {showQuickStart && (
        <div className="flex-shrink-0 bg-gradient-to-r from-emerald-50 via-teal-50 to-cyan-50 border-b border-emerald-200">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center flex-shrink-0 shadow-md">
                <GraduationCap className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-sm font-bold text-emerald-900">New Cashier Quick Start</h2>
                  <span className="px-1.5 py-0 rounded-full bg-emerald-200 text-emerald-800 text-[9px] font-bold uppercase tracking-wider">6 steps · 10 min</span>
                </div>
                <p className="text-[11px] text-emerald-800 mb-2">If you're new, do these 6 things first. They cover 80% of daily work.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {QUICK_START_STEPS.map(s => (
                    <div key={s.step} className="bg-white rounded-lg ring-1 ring-emerald-200 p-2.5 flex items-start gap-2">
                      <div className="h-6 w-6 rounded-full bg-emerald-600 text-white text-[11px] font-bold flex items-center justify-center flex-shrink-0">
                        {s.step}
                      </div>
                      <div className="min-w-0">
                        <div className="text-[12px] font-bold text-slate-800 leading-tight">{s.title}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5 leading-snug">{s.detail}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => setShowQuickStart(false)}
                    className="text-[10px] font-bold text-emerald-700 hover:text-emerald-900 underline"
                  >
                    Hide this guide
                  </button>
                  <span className="text-[10px] text-emerald-700">·</span>
                  <button
                    onClick={() => setTrainingMode(true)}
                    className="text-[10px] font-bold text-amber-700 hover:text-amber-900 underline flex items-center gap-1"
                  >
                    <Lightbulb className="h-3 w-3" /> Turn on Training Mode to see all notes
                  </button>
                </div>
              </div>
              <button
                onClick={() => setShowQuickStart(false)}
                className="h-6 w-6 rounded-md bg-white/60 hover:bg-white text-emerald-700 flex items-center justify-center flex-shrink-0"
                aria-label="Hide quick start"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Intro banner */}
      <div className="flex-shrink-0 px-4 sm:px-6 py-3 bg-gradient-to-r from-violet-50 to-indigo-50 border-b border-violet-100">
        <div className="max-w-5xl mx-auto flex items-start gap-2.5">
          <AlertCircle className="h-4 w-4 text-violet-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs sm:text-sm text-violet-900">
            <strong>How to use:</strong> Tap any feature card to jump straight to it. Cards with a <Lightbulb className="inline h-3 w-3 text-amber-500" /> icon have <strong>training notes</strong> — click the icon (or toggle <strong>Training Mode</strong> above) to see how-to steps, common mistakes, and pro tips. Phase 1–5 features are tagged with colored badges.
          </p>
        </div>
      </div>

      {/* Categorized feature list */}
      <main className="flex-1 overflow-y-auto p-3 sm:p-4 scroll-premium">
        <div className="max-w-5xl mx-auto space-y-5">
          {filteredCategories.length === 0 && (
            <div className="text-center py-16 text-slate-400">
              <Search className="h-12 w-12 mx-auto mb-3 opacity-40" />
              <p className="text-sm font-bold">No features match your search</p>
              <p className="text-xs mt-1">Try a different keyword or clear the filter</p>
            </div>
          )}
          {filteredCategories.map((section, si) => {
            const SectionIcon = section.icon;
            const isCollapsed = collapsed[section.category];
            return (
              <motion.div
                key={section.category}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: si * 0.04 }}
              >
                {/* Category header — clickable to collapse */}
                <button
                  onClick={() => toggleCollapse(section.category)}
                  className="w-full flex items-center gap-2 mb-2 px-1 group"
                >
                  <div className={`h-7 w-7 rounded-lg bg-white shadow-sm ring-1 ring-slate-200 flex items-center justify-center ${section.color} group-hover:ring-violet-300 transition`}>
                    <SectionIcon className="h-4 w-4" />
                  </div>
                  <h2 className="text-sm font-bold text-slate-800 group-hover:text-violet-700 transition">{section.category}</h2>
                  <span className="text-[10px] text-slate-400 ml-auto mr-1">{section.features.length} features</span>
                  <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${isCollapsed ? "" : "rotate-180"}`} />
                </button>

                <AnimatePresence initial={false}>
                  {!isCollapsed && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-1">
                        {section.features.map(feature => {
                          const Icon = feature.icon;
                          const noteKey = `${section.category}::${feature.name}`;
                          const hasNote = !!feature.trainingNote;
                          const isNoteExpanded = trainingMode || expandedNotes[noteKey];
                          return (
                            <div
                              key={feature.name}
                              className="bg-white rounded-xl shadow-sm ring-1 ring-slate-200 p-3 text-left hover:shadow-md hover:ring-violet-300 transition flex flex-col group"
                            >
                              <div className="flex items-start gap-3 flex-1">
                                {/* Icon */}
                                <div className={`h-10 w-10 rounded-lg ${feature.bg} flex items-center justify-center flex-shrink-0`}>
                                  <Icon className={`h-5 w-5 ${feature.color}`} />
                                </div>
                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                                    <span className="text-sm font-bold text-slate-800">{feature.name}</span>
                                    {feature.phase && feature.phase !== "core" && (
                                      <span className={`px-1.5 py-0 rounded-full text-[8px] font-bold uppercase tracking-wider ${PHASE_COLORS[feature.phase]}`}>
                                        {PHASE_LABELS[feature.phase]}
                                      </span>
                                    )}
                                    {feature.access === "admin" && (
                                      <span className="px-1.5 py-0 rounded-full bg-rose-100 text-rose-700 text-[8px] font-bold uppercase tracking-wider flex items-center gap-0.5">
                                        <Crown className="h-2.5 w-2.5" /> Admin
                                      </span>
                                    )}
                                    {feature.access === "manager" && (
                                      <span className="px-1.5 py-0 rounded-full bg-amber-100 text-amber-700 text-[8px] font-bold uppercase tracking-wider flex items-center gap-0.5">
                                        <Shield className="h-2.5 w-2.5" /> Mgr+
                                      </span>
                                    )}
                                    {feature.shortcut && (
                                      <span className="px-1.5 py-0 rounded-full bg-slate-100 text-slate-600 text-[8px] font-mono font-bold">
                                        {feature.shortcut}
                                      </span>
                                    )}
                                    {feature.quickStart && (
                                      <span className="px-1.5 py-0 rounded-full bg-emerald-100 text-emerald-700 text-[8px] font-bold uppercase tracking-wider flex items-center gap-0.5">
                                        <Star className="h-2.5 w-2.5" /> Quick Start
                                      </span>
                                    )}
                                    {hasNote && (
                                      <button
                                        onClick={(e) => { e.stopPropagation(); toggleNote(noteKey); }}
                                        className={`px-1.5 py-0 rounded-full text-[8px] font-bold uppercase tracking-wider flex items-center gap-0.5 transition ${
                                          isNoteExpanded
                                            ? "bg-amber-400 text-amber-900"
                                            : "bg-amber-100 text-amber-700 hover:bg-amber-200"
                                        }`}
                                        title={isNoteExpanded ? "Hide training note" : "Show training note"}
                                      >
                                        <Lightbulb className="h-2.5 w-2.5" /> {isNoteExpanded ? "Hide Note" : "Training"}
                                      </button>
                                    )}
                                  </div>
                                  <div className="text-[11px] text-slate-500 mb-2 leading-snug">{feature.description}</div>
                                  {/* Location pill */}
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 text-[10px] font-semibold">
                                      <MapIcon className="h-3 w-3" />
                                      {feature.locationLabel}
                                    </div>
                                    <button
                                      onClick={() => {
                                        if (feature.href) {
                                          window.location.href = feature.href;
                                        } else if (feature.action) {
                                          onNavigate(feature.action);
                                        }
                                      }}
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-semibold hover:bg-emerald-100 transition"
                                    >
                                      <ArrowUpRight className="h-3 w-3" /> Open
                                    </button>
                                  </div>
                                  {/* Full location detail */}
                                  <div className="text-[10px] text-slate-400 mt-1 leading-tight flex items-start gap-1">
                                    <ArrowUpRight className="h-3 w-3 flex-shrink-0 mt-0.5 text-slate-300 group-hover:text-violet-400 transition" />
                                    <span>{feature.location}</span>
                                  </div>
                                </div>
                              </div>

                              {/* Training note — expandable */}
                              {hasNote && isNoteExpanded && (
                                <motion.div
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: "auto" }}
                                  exit={{ opacity: 0, height: 0 }}
                                  transition={{ duration: 0.2 }}
                                  className="overflow-hidden mt-2"
                                >
                                  <div className="bg-gradient-to-br from-slate-800 via-slate-900 to-indigo-950 ring-1 ring-slate-700 rounded-lg p-3">
                                    <div className="flex items-center gap-1.5 mb-1.5">
                                      <Lightbulb className="h-3.5 w-3.5 text-amber-300 flex-shrink-0" />
                                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-200">Training Note</span>
                                    </div>
                                    <div className="text-[11px] text-white leading-relaxed whitespace-pre-line">
                                      {feature.trainingNote}
                                    </div>
                                  </div>
                                </motion.div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}

          {/* Footer note */}
          <div className="text-center py-6 text-[10px] text-slate-400">
            <p className="font-bold text-slate-500">{COMPANY.name}</p>
            <p className="mt-1">{totalFeatures} features · {CATEGORIES.length} categories · {notesCount} training notes · {recentCount} recent additions (Phase 1–5)</p>
            <p className="mt-1">All features accessible from the mobile bottom nav, the More drawer, the top toolbar, or the user menu.</p>
            <p className="mt-2 text-violet-500 font-semibold">Tip: Press <kbd className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-mono text-[9px]">?</kbd> anywhere to see keyboard shortcuts.</p>
            <p className="mt-1 text-amber-600 font-semibold">Training tip: Toggle <GraduationCap className="inline h-3 w-3" /> Training Mode (top-right) to see all training notes at once for printing.</p>
          </div>
        </div>
      </main>
    </div>
  );
}
