/**
 * SYLHN POS — Input validation schemas (zod)
 *
 * All API request bodies are validated against these schemas before reaching
 * business logic. Rejects malformed / oversized / unexpected-field payloads.
 */

import { z } from "zod";

// ===== Auth =====
export const LoginSchema = z.object({
  username: z.string().min(1).max(64).regex(/^[a-zA-Z0-9_.-]+$/, "Invalid username"),
  password: z.string().min(1).max(256),
});

// ===== Products =====
export const ProductSchema = z.object({
  sku: z.string().min(1).max(64),
  barcode: z.string().max(128).optional().default(""),
  name: z.string().min(1).max(200),
  emoji: z.string().max(16).optional().default("📦"),
  category: z.string().max(64).optional().default("other"),
  description: z.string().max(1000).optional().default(""),
  price: z.number().min(0).max(1_000_000),
  costPrice: z.number().min(0).max(1_000_000).optional().default(0),
  quantity: z.number().int().min(-100000).max(1_000_000).optional().default(0),
  unit: z.string().max(32).optional().default("each"),
  reorderLevel: z.number().int().min(0).max(1_000_000).optional().default(5),
  taxable: z.boolean().optional().default(true),
  batchNumber: z.string().max(64).optional().default(""),
  expiryDate: z.union([z.string(), z.date(), z.null()]).optional(),
  receivedDate: z.union([z.string(), z.date(), z.null()]).optional(),
  supplier: z.string().max(200).optional().default(""),
  groupId: z.union([z.string(), z.null()]).optional(),
  active: z.boolean().optional().default(true),
});

export const ProductBulkSchema = z.object({
  products: z.array(ProductSchema).max(1000),
});

export const ProductUpdateSchema = ProductSchema.partial();

// ===== Sales =====
export const SaleItemSchema = z.object({
  productId: z.union([z.string(), z.null()]).optional(),
  sku: z.string().min(1).max(64),
  name: z.string().min(1).max(200),
  price: z.number().min(0).max(1_000_000),
  quantity: z.number().int().min(1).max(100000),
  unit: z.string().max(32).optional().default("each"),
  discount: z.number().min(0).max(100).optional().default(0),
  taxable: z.boolean().optional().default(true),
  total: z.number().min(0).max(10_000_000),
});

export const SaleSchema = z.object({
  invoiceNumber: z.string().max(64).optional(),
  customerName: z.string().max(200).optional().default(""),
  cashierName: z.string().min(1).max(200),
  subtotal: z.number().min(0).max(10_000_000),
  discount: z.number().min(0).max(10_000_000).optional().default(0),
  discountPct: z.number().min(0).max(100).optional().default(0),
  taxRate: z.number().min(0).max(100).optional().default(0),
  taxAmount: z.number().min(0).max(10_000_000).optional().default(0),
  total: z.number().min(0).max(10_000_000),
  amountPaid: z.number().min(0).max(10_000_000),
  change: z.number().min(0).max(10_000_000).optional().default(0),
  paymentMethod: z.string().max(32).optional().default("cash"),
  paymentRef: z.string().max(128).optional().default(""),
  status: z.enum(["completed", "voided", "held"]).optional().default("completed"),
  notes: z.string().max(2000).optional().default(""),
  items: z.array(SaleItemSchema).min(1).max(500),
});

// ===== Suppliers =====
export const SupplierSchema = z.object({
  name: z.string().min(1).max(200),
  contact: z.string().max(200).optional().default(""),
  phone: z.string().max(32).optional().default(""),
  email: z.string().max(200).optional().default("").or(z.literal("")),
  address: z.string().max(500).optional().default(""),
  balance: z.number().min(-1_000_000).max(1_000_000).optional().default(0),
  products: z.union([z.string(), z.array(z.any())]).optional(),
  active: z.boolean().optional().default(true),
});

// ===== Stock groups =====
export const StockGroupSchema = z.object({
  name: z.string().min(1).max(100),
  icon: z.string().max(16).optional().default("📦"),
  color: z.string().max(32).optional().default("#10b981"),
  description: z.string().max(500).optional().default(""),
});

// ===== Purchases =====
export const PurchaseItemSchema = z.object({
  productId: z.union([z.string(), z.null()]).optional(),
  partNo: z.string().min(1).max(64),
  details: z.string().max(500),
  quantity: z.number().int().min(1).max(100000),
  cost: z.number().min(0).max(1_000_000),
  tax: z.boolean().optional().default(true),
  total: z.number().min(0).max(10_000_000),
  expiryDate: z.union([z.string(), z.date(), z.null()]).optional(),
});

export const PurchaseSchema = z.object({
  refNo: z.string().max(64).optional(),
  type: z.enum(["purchase", "order"]).optional().default("purchase"),
  supplierId: z.union([z.string(), z.null()]).optional(),
  supplierName: z.string().max(200).optional().default(""),
  status: z.enum(["draft", "ordered", "received", "cancelled"]).optional().default("received"),
  subtotal: z.number().min(0).max(10_000_000).optional().default(0),
  discount: z.number().min(0).max(10_000_000).optional().default(0),
  taxAmount: z.number().min(0).max(10_000_000).optional().default(0),
  total: z.number().min(0).max(10_000_000).optional().default(0),
  amountPaid: z.number().min(0).max(10_000_000).optional().default(0),
  notes: z.string().max(2000).optional().default(""),
  createdBy: z.string().max(200),
  receivedAt: z.union([z.string(), z.date(), z.null()]).optional(),
  items: z.array(PurchaseItemSchema).min(1).max(500),
});

// ===== Users =====
export const UserSchema = z.object({
  username: z.string().min(1).max(64).regex(/^[a-zA-Z0-9_.-]+$/),
  password: z.string().min(4).max(256),
  fullName: z.string().min(1).max(200),
  role: z.enum(["admin", "manager", "cashier", "stockkeeper", "accountant"]).optional().default("cashier"),
  phone: z.string().max(32).optional().default(""),
  email: z.string().max(200).optional().default(""),
  permissions: z.union([z.string(), z.record(z.string(), z.any())]).optional(),
  active: z.boolean().optional().default(true),
});

// ===== Email =====
export const EmailSchema = z.object({
  to: z.string().max(500).email().or(z.string().max(500).regex(/^[^@\s]+@[^@\s]+\.[^@\s]+$/)),
  cc: z.string().max(500).optional(),
  bcc: z.string().max(500).optional(),
  subject: z.string().max(500),
  body: z.string().max(50_000),
  html: z.string().max(100_000).optional(),
  attachments: z.array(z.object({
    filename: z.string().max(256),
    content: z.string().max(1_000_000), // base64, ~750KB
    contentType: z.string().max(128),
  })).max(10).optional(),
  smtp: z.object({
    host: z.string().max(256),
    port: z.number().int().min(1).max(65535),
    secure: z.boolean().optional(),
    user: z.string().max(256),
    password: z.string().max(256),
    fromName: z.string().max(200).optional(),
    fromEmail: z.string().max(200).optional(),
  }).optional(),
});

// ===== Helpers =====
export function validate<T>(schema: z.ZodSchema<T>, data: unknown):
  { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(data);
  if (result.success) return { success: true, data: result.data };
  const firstError = result.error.issues[0];
  return {
    success: false,
    error: firstError
      ? `${firstError.path.join(".")}: ${firstError.message}`
      : "Validation failed",
  };
}

export function validationError(message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status: 422,
    headers: { "Content-Type": "application/json" },
  });
}
