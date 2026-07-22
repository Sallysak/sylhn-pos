// POS System Types - SYLHN COMPANY LTD

export interface CartItem {
  id: string;
  productId: string;
  sku: string;
  name: string;
  price: number;
  quantity: number;
  unit: string;
  emoji: string;
  discount: number; // percentage
  taxable: boolean;
  stock: number;
  total?: number; // computed: price * quantity * (1 - discount/100)
}

export interface PaymentResult {
  method: string;
  amountPaid: number;
  change: number;
  total: number;
  subtotal: number;
  tax: number;
  discount: number;
  timestamp: Date;
  invoiceNumber: string;
  items: CartItem[];
  cashier: string;
  customer?: string;
  // Premium: server-side sale ID for receipt QR + WhatsApp delivery
  saleId?: string;
}

export type ViewMode = "login" | "pos" | "stock" | "reports" | "purchase" | "purchase-form" | "telephone" | "telephone-directory" | "maintenance" | "sold-items" | "sales-menu" | "daily-sales" | "sales-history" | "supplier-form" | "accounts-reports" | "finance-ops" | "admin-login" | "admin-panel" | "admin-hub" | "dashboard" | "receipt-archive" | "sync-settings" | "stock-history-pro" | "features-map" | "email-system" | "credit-management" | "auto-replenish" | "reports-center";

export type StockView = "add-modify" | "group-maintenance" | "quantity-adjustment" | "history" | "stock-file" | "stock-search";

export interface SavedReport {
  id: string;
  type: string;
  title: string;
  generatedAt: string;
  generatedBy: string;
  recordCount: number;
  summary: string;
}

export interface ReportColumn {
  key: string;
  label: string;
  align?: 'left' | 'right' | 'center';
  format?: (value: any, row: any) => string;
}

export interface ReportData {
  type: string;
  title: string;
  subtitle: string;
  columns: ReportColumn[];
  rows: Record<string, any>[];
  summary: { label: string; value: string }[];
}
