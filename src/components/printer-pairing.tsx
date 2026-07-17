"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Printer, Bluetooth, X, Check, AlertCircle, Loader2, Wifi, Printer as PrinterIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  isBluetoothSupported, connectPrinter, disconnectPrinter,
  isPrinterConnected, buildReceiptBytes, printBytes,
} from "@/lib/thermal-printer";

interface PrinterPairingProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Premium: Bluetooth Printer Pairing UI
 *
 * Lives in the maintenance module. Lets the cashier:
 *   1. Connect to a Bluetooth thermal printer (Web Bluetooth API)
 *   2. See connection status
 *   3. Print a test receipt
 *   4. Disconnect
 *
 * Requirements: Chrome/Edge on desktop or Android. iOS Safari doesn't support
 * Web Bluetooth — the UI shows a "not supported" message and falls back to
 * window.print() for receipts.
 */
export function PrinterPairing({ open, onClose }: PrinterPairingProps) {
  const { toast } = useToast();
  const [supported, setSupported] = useState<boolean>(false);
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [printerName, setPrinterName] = useState<string>("");
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    isBluetoothSupported().then(setSupported);
    setConnected(isPrinterConnected());
  }, [open]);

  const handleConnect = useCallback(async () => {
    setConnecting(true);
    try {
      const device = await connectPrinter();
      if (device) {
        setPrinterName(device.name);
        setConnected(true);
        toast({
          title: "Printer Connected",
          description: `${device.name} is ready to print receipts`,
        });
      }
    } catch (e: any) {
      // Silent — don't log to console. Show user-friendly message instead.
      let msg = "Could not connect to printer.";
      if (e?.name === "NotAllowedError" || e?.message?.includes("permissions policy")) {
        msg = "Bluetooth is blocked in this environment (iframe/preview). To pair a printer, open the app directly at its URL (not in an embedded preview). On mobile, use Chrome or Edge and tap the address bar to enable Bluetooth.";
      } else if (e?.name === "NotFoundError") {
        msg = "No Bluetooth printer found. Make sure it's powered on and in pairing mode.";
      } else if (e?.message?.includes("not supported")) {
        msg = "Web Bluetooth not supported. Use Chrome or Edge on desktop/Android.";
      } else {
        msg = e?.message || msg;
      }
      toast({
        title: "Connection Failed",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setConnecting(false);
    }
  }, [toast]);

  const handleDisconnect = useCallback(async () => {
    await disconnectPrinter();
    setConnected(false);
    setPrinterName("");
    toast({ title: "Printer Disconnected" });
  }, [toast]);

  const handleTestPrint = useCallback(async () => {
    if (!isPrinterConnected()) {
      toast({ title: "Printer not connected", variant: "destructive" });
      return;
    }
    setPrinting(true);
    try {
      const bytes = buildReceiptBytes({
        companyName: "SYLHN COMPANY LTD",
        companyAddress: "East Legon, Accra",
        companyPhone: "+233592766044",
        invoiceNumber: "TEST-001",
        cashierName: "Test Print",
        customerName: "Test Customer",
        timestamp: new Date(),
        items: [
          { name: "Test Item 1", emoji: "🛒", quantity: 2, price: 5.00, total: 10.00 },
          { name: "Test Item 2", emoji: "📦", quantity: 1, price: 15.00, total: 15.00 },
        ],
        subtotal: 25.00,
        discount: 0,
        taxAmount: 3.75,
        total: 28.75,
        amountPaid: 30.00,
        change: 1.25,
        paymentMethod: "cash",
        currencySymbol: "₵",
      }, 80);
      await printBytes(bytes);
      toast({
        title: "Test Receipt Printed",
        description: "Check your printer — a test receipt should be printing now.",
      });
    } catch (e: any) {
      toast({
        title: "Print Failed",
        description: e?.message || "Could not print test receipt",
        variant: "destructive",
      });
    } finally {
      setPrinting(false);
    }
  }, [toast]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ scale: 0.9, y: 30 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 30 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white px-6 py-5">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Printer className="h-6 w-6" />
                  <h2 className="text-lg font-bold">Thermal Printer</h2>
                </div>
                <button onClick={onClose} className="h-8 w-8 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center transition">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="text-xs opacity-90">Connect a Bluetooth ESC/POS thermal printer for instant receipt printing</div>
            </div>

            <div className="p-6 space-y-4">
              {/* Browser support check */}
              {!supported && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="font-semibold text-amber-800 text-sm">Bluetooth Not Supported</div>
                      <div className="text-xs text-amber-700 mt-1">
                        Your browser doesn't support Web Bluetooth. Use Chrome or Edge on desktop/Android.
                        On iOS, receipts will use the browser's print dialog instead.
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Connection status */}
              <div className={`rounded-xl p-4 ring-1 ${connected ? "bg-emerald-50 ring-emerald-200" : "bg-slate-50 ring-slate-200"}`}>
                <div className="flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center ${connected ? "bg-emerald-100" : "bg-slate-200"}`}>
                    {connected ? <Check className="h-5 w-5 text-emerald-600" /> : <Bluetooth className="h-5 w-5 text-slate-500" />}
                  </div>
                  <div className="flex-1">
                    <div className={`font-semibold text-sm ${connected ? "text-emerald-700" : "text-slate-700"}`}>
                      {connected ? "Connected" : "Not Connected"}
                    </div>
                    <div className="text-xs text-slate-500">
                      {connected ? (printerName || "Thermal Printer") : "No printer paired"}
                    </div>
                  </div>
                  {connected && (
                    <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  )}
                </div>
              </div>

              {/* Action buttons */}
              <div className="space-y-2">
                {!connected ? (
                  <button
                    onClick={handleConnect}
                    disabled={!supported || connecting}
                    className="w-full h-11 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-sm flex items-center justify-center gap-2 transition"
                  >
                    {connecting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Connecting...
                      </>
                    ) : (
                      <>
                        <Bluetooth className="h-4 w-4" />
                        Pair Printer
                      </>
                    )}
                  </button>
                ) : (
                  <>
                    <button
                      onClick={handleTestPrint}
                      disabled={printing}
                      className="w-full h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-sm flex items-center justify-center gap-2 transition"
                    >
                      {printing ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Printing...
                        </>
                      ) : (
                        <>
                          <PrinterIcon className="h-4 w-4" />
                          Print Test Receipt
                        </>
                      )}
                    </button>
                    <button
                      onClick={handleDisconnect}
                      className="w-full h-11 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold text-sm flex items-center justify-center gap-2 transition"
                    >
                      <X className="h-4 w-4" />
                      Disconnect
                    </button>
                  </>
                )}
              </div>

              {/* Compatible printers list */}
              <div className="bg-slate-50 rounded-lg p-3">
                <div className="text-xs font-semibold text-slate-600 mb-2">Compatible Printers:</div>
                <ul className="text-[11px] text-slate-600 space-y-1">
                  <li>• Xprinter XP-58IIH / XP-80IIH</li>
                  <li>• ZJ-5890K / ZJ-8090</li>
                  <li>• Epson TM-m30 / TM-T20III</li>
                  <li>• Star TSP100III / TSP143III</li>
                  <li>• Any ESC/POS-compatible Bluetooth printer</li>
                </ul>
              </div>

              {/* Tips */}
              <div className="text-[11px] text-slate-500 leading-relaxed">
                <strong>Tip:</strong> Put your printer in pairing mode before clicking "Pair Printer".
                Most printers enter pairing mode when held for 5+ seconds on the power button.
                The printer must be ESC/POS compatible (most thermal printers are).
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
