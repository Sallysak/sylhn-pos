/**
 * SYLHN POS — ESC/POS Thermal Printer Integration (Bluetooth)
 *
 * Premium: generates ESC/POS byte commands for thermal printers (58mm / 80mm)
 * and sends them via Web Bluetooth API. Common printer models supported:
 *   - Xprinter XP-58IIH
 *   - ZJ-5890K
 *   - Epson TM-m30
 *   - Star TSP100III
 *
 * For non-Bluetooth printers (USB), the browser falls back to window.print()
 * with a print-optimized receipt layout.
 *
 * ESC/POS reference: https://escpos.readthedocs.io/
 */

// ===== ESC/POS command bytes =====
const ESC = 0x1B;
const GS = 0x1D;
const LF = 0x0A;

// Initialize printer
export function initPrinter(): Uint8Array {
  return new Uint8Array([ESC, 0x40]);
}

// Set alignment: 0=left, 1=center, 2=right
export function setAlignment(align: 0 | 1 | 2): Uint8Array {
  return new Uint8Array([ESC, 0x61, align]);
}

// Set text size: 0=normal, 1=double-height, 2=double-width, 3=double both
export function textSize(size: 0 | 1 | 2 | 3): Uint8Array {
  return new Uint8Array([GS, 0x21, size]);
}

// Bold on/off
export function bold(on: boolean): Uint8Array {
  return new Uint8Array([ESC, 0x45, on ? 0x01 : 0x00]);
}

// Feed N lines
export function feed(lines: number): Uint8Array {
  return new Uint8Array([ESC, 0x64, lines]);
}

// Cut paper (full cut)
export function cutPaper(): Uint8Array {
  return new Uint8Array([GS, 0x56, 0x00]);
}

// Print text + newline
export function text(str: string): Uint8Array {
  const encoder = new TextEncoder();
  return encoder.encode(str + "\n");
}

// Print a horizontal line of dashes
export function dashLine(width = 32): Uint8Array {
  return text("-".repeat(width));
}

// Generate a barcode (CODE128)
export function barcode(data: string): Uint8Array {
  // GS k 73 4 ... = CODE128 with text below
  const encoder = new TextEncoder();
  const dataBytes = encoder.encode(data);
  const cmd = [GS, 0x6B, 73, dataBytes.length, ...dataBytes];
  return new Uint8Array(cmd);
}

// ===== Build a full receipt as a single byte array =====
export interface ReceiptData {
  companyName: string;
  companyAddress: string;
  companyPhone: string;
  invoiceNumber: string;
  cashierName: string;
  customerName?: string;
  timestamp: Date;
  items: Array<{
    name: string;
    emoji?: string;
    quantity: number;
    price: number;
    total: number;
  }>;
  subtotal: number;
  discount: number;
  taxAmount: number;
  total: number;
  amountPaid: number;
  change: number;
  paymentMethod: string;
  loyaltyPoints?: number;
  currencySymbol: string;
}

export function buildReceiptBytes(data: ReceiptData, paperWidth: 58 | 80 = 80): Uint8Array {
  const width = paperWidth === 58 ? 32 : 48;
  const parts: Uint8Array[] = [];

  parts.push(initPrinter());

  // Header — centered, bold, double-height
  parts.push(setAlignment(1));
  parts.push(bold(true));
  parts.push(textSize(1));
  parts.push(text(data.companyName));
  parts.push(textSize(0));
  parts.push(bold(false));
  parts.push(text(data.companyAddress));
  parts.push(text(data.companyPhone));
  parts.push(text(""));

  // Invoice info
  parts.push(setAlignment(0));
  parts.push(text(`Invoice: ${data.invoiceNumber}`));
  parts.push(text(`Date: ${data.timestamp.toLocaleString("en-GB")}`));
  parts.push(text(`Cashier: ${data.cashierName}`));
  if (data.customerName) parts.push(text(`Customer: ${data.customerName}`));
  parts.push(dashLine(width));

  // Items
  for (const item of data.items) {
    parts.push(text(`${item.name}`));
    const left = `  ${item.quantity} x ${data.currencySymbol}${item.price.toFixed(2)}`;
    const right = `${data.currencySymbol}${item.total.toFixed(2)}`;
    const padding = Math.max(1, width - left.length - right.length);
    parts.push(text(left + " ".repeat(padding) + right));
  }
  parts.push(dashLine(width));

  // Totals
  parts.push(setAlignment(2));
  parts.push(text(`Subtotal: ${data.currencySymbol}${data.subtotal.toFixed(2)}`));
  if (data.discount > 0) parts.push(text(`Discount: -${data.currencySymbol}${data.discount.toFixed(2)}`));
  if (data.taxAmount > 0) parts.push(text(`VAT: ${data.currencySymbol}${data.taxAmount.toFixed(2)}`));
  parts.push(bold(true));
  parts.push(textSize(1));
  parts.push(text(`TOTAL: ${data.currencySymbol}${data.total.toFixed(2)}`));
  parts.push(textSize(0));
  parts.push(bold(false));
  parts.push(text(""));
  parts.push(text(`Paid (${data.paymentMethod}): ${data.currencySymbol}${data.amountPaid.toFixed(2)}`));
  if (data.change > 0) parts.push(text(`Change: ${data.currencySymbol}${data.change.toFixed(2)}`));
  if (data.loyaltyPoints && data.loyaltyPoints > 0) {
    parts.push(text(`Loyalty earned: +${data.loyaltyPoints} pts`));
  }

  // Footer
  parts.push(setAlignment(1));
  parts.push(text(""));
  parts.push(text("Thank you for shopping!"));
  parts.push(text("Returns within 7 days with receipt"));
  parts.push(text(""));

  // Barcode (invoice number)
  parts.push(barcode(data.invoiceNumber));
  parts.push(feed(2));
  parts.push(cutPaper());

  // Concatenate all parts
  const totalLength = parts.reduce((s, p) => s + p.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const p of parts) {
    result.set(p, offset);
    offset += p.length;
  }
  return result;
}

// ===== Web Bluetooth connection =====

export interface PrinterDevice {
  name: string;
  id: string;
}

let connectedDevice: any = null;
let connectedCharacteristic: any = null;

const PRINTER_SERVICE_UUIDS = [
  "000018f0-0000-1000-8000-00805f9b34fb",  // common printer service
  "0000ff00-0000-1000-8000-00805f9b34fb",  // Xprinter
  "00001101-0000-1000-8000-00805f9b34fb",  // SPP
];

export async function isBluetoothSupported(): Promise<boolean> {
  return typeof navigator !== "undefined" && "bluetooth" in navigator;
}

export async function connectPrinter(): Promise<PrinterDevice | null> {
  if (!(await isBluetoothSupported())) {
    throw new Error("Web Bluetooth not supported in this browser. Use Chrome or Edge on desktop/Android.");
  }
  // @ts-ignore — Web Bluetooth types not in standard lib
  const device = await navigator.bluetooth.requestDevice({
    filters: [{ services: [PRINTER_SERVICE_UUIDS[0]] }, { services: [PRINTER_SERVICE_UUIDS[1]] }],
    optionalServices: PRINTER_SERVICE_UUIDS,
  });

  if (!device) return null;

  const server = await device.gatt!.connect();
  // Try each known service UUID until one works
  for (const uuid of PRINTER_SERVICE_UUIDS) {
    try {
      const service = await server.getPrimaryService(uuid);
      const characteristics = await service.getCharacteristics();
      const writable = characteristics.find((c: any) => c.properties.write || c.properties.writeWithoutResponse);
      if (writable) {
        connectedDevice = device;
        connectedCharacteristic = writable;
        return { name: device.name || "Thermal Printer", id: device.id };
      }
    } catch {
      // try next UUID
    }
  }
  throw new Error("Could not find a writable characteristic on the printer");
}

export async function disconnectPrinter(): Promise<void> {
  if (connectedDevice?.gatt?.connected) {
    connectedDevice.gatt.disconnect();
  }
  connectedDevice = null;
  connectedCharacteristic = null;
}

export async function printBytes(bytes: Uint8Array): Promise<void> {
  if (!connectedCharacteristic) {
    throw new Error("Printer not connected. Call connectPrinter() first.");
  }
  // BLE has a max MTU of ~20 bytes per write by default; chunk the data
  const CHUNK_SIZE = 180;
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    const chunk = bytes.slice(i, i + CHUNK_SIZE);
    if (connectedCharacteristic.properties.writeWithoutResponse) {
      await connectedCharacteristic.writeValueWithoutResponse(chunk);
    } else {
      await connectedCharacteristic.writeValueWithResponse(chunk);
    }
  }
}

export function isPrinterConnected(): boolean {
  return !!connectedCharacteristic;
}
