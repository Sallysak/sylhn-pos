// POS System Types

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
}

export type ViewMode = "register" | "payment" | "receipt";
