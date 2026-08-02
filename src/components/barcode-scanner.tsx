"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, ScanLine, Camera, AlertCircle, Check, Keyboard, Loader2,
  Upload, Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
  onClose: () => void;
}

type ScanMode = "camera" | "manual" | "upload";
type EngineState = "idle" | "starting" | "scanning" | "error";

/**
 * Premium multi-engine barcode scanner for the POS main interface.
 *
 * Used to look up EXISTING products by their barcode (for quick POS entry).
 * Calls onScan(barcode) — the parent component handles the product lookup.
 *
 * WHY MULTI-ENGINE:
 *   The native BarcodeDetector API only works on Chrome/Edge Android.
 *   This scanner tries TWO engines in parallel:
 *
 *   1. ZXing (z-ai-web-dev-sdk/@zxing/library) — pure JS, works on ALL
 *      browsers (Chrome, Safari, Firefox, Edge, iOS, Android, desktop).
 *      Supports: EAN-13, EAN-8, UPC-A, UPC-E, Code-128, Code-39, Code-93,
 *      Codabar, ITF, QR, DataMatrix, PDF417, RSS-14.
 *   2. Native BarcodeDetector (Chrome/Edge only) — GPU-accelerated, used
 *      in parallel for speed.
 *
 *   Also supports image upload — user uploads a photo of a barcode.
 *
 * Same engine as ProductScanner, but calls onScan(barcode) instead of
 * doing a database lookup (the parent POS screen does the lookup in the
 * local product catalog).
 */
export function BarcodeScanner({ onScan, onClose }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const zxingReaderRef = useRef<any>(null);
  const zxingControlsRef = useRef<any>(null);
  const nativeRafRef = useRef<number | null>(null);
  const nativeDetectorRef = useRef<any>(null);
  const lastScanRef = useRef<string>("");
  const lastScanTimeRef = useRef<number>(0);

  const [mode, setMode] = useState<ScanMode>("camera");
  const [engineState, setEngineState] = useState<EngineState>("idle");
  const [error, setError] = useState<string>("");
  const [manualValue, setManualValue] = useState("");
  const [activeEngine, setActiveEngine] = useState<string>("");
  const [supportedEngines, setSupportedEngines] = useState<string[]>([]);
  const { toast } = useToast();

  // ===== Detect which engines are available on mount =====
  useEffect(() => {
    const engines: string[] = [];
    engines.push("zxing");
    if (typeof window !== "undefined" && "BarcodeDetector" in window) {
      engines.push("native");
    }
    setSupportedEngines(engines);
  }, []);

  // ===== Camera + scanning logic (runs when mode === "camera") =====
  useEffect(() => {
    if (mode !== "camera") return;
    let cancelled = false;

    const startCamera = async () => {
      setEngineState("starting");
      setError("");

      try {
        // Lower resolution for faster startup (640x480 is enough for barcodes)
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {}); // don't await — start ASAP
        }

        // Show camera feed immediately while engine loads
        if (!cancelled) setEngineState("scanning");

        // Prefer native (faster) when available, ZXing as fallback
        if (supportedEngines.includes("native") && !cancelled) {
          startNativeEngine();
        } else {
          startZxingEngine();
        }
      } catch (e: any) {
        console.warn("Camera start error:", e);
        if (cancelled) return;
        let msg: string;
        if (e?.name === "NotAllowedError") {
          msg = "Camera access denied. Allow camera permission, or use manual entry / image upload.";
        } else if (e?.name === "NotFoundError") {
          msg = "No camera found. Use manual entry or upload a photo.";
        } else if (e?.name === "NotReadableError") {
          msg = "Camera is in use by another app. Close it and try again.";
        } else if (e?.name === "OverconstrainedError") {
          msg = "No back camera available. Use manual entry or upload.";
        } else {
          msg = e?.message || "Could not start camera. Use manual entry or upload.";
        }
        setError(msg);
        setEngineState("error");
        setMode("manual");
      }
    };

    startCamera();

    return () => {
      cancelled = true;
      stopAllEngines();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, supportedEngines]);

  // ===== ZXing engine (pure JS — works everywhere) =====
  const startZxingEngine = async () => {
    try {
      const { BrowserMultiFormatReader } = await import("@zxing/browser");
      const { DecodeHintType, BarcodeFormat } = await import("@zxing/library");
      const reader = new BrowserMultiFormatReader();
      const hints = new Map();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [
        BarcodeFormat.EAN_13, BarcodeFormat.EAN_8,
        BarcodeFormat.UPC_A, BarcodeFormat.UPC_E,
        BarcodeFormat.CODE_128, BarcodeFormat.CODE_39, BarcodeFormat.CODE_93,
        BarcodeFormat.CODABAR, BarcodeFormat.ITF,
        BarcodeFormat.QR_CODE, BarcodeFormat.DATA_MATRIX, BarcodeFormat.PDF_417,
        BarcodeFormat.RSS_14, BarcodeFormat.RSS_EXPANDED,
      ]);
      // TRY_HARDER omitted for speed — 640x480 + common formats is sufficient
      reader.hints = hints;
      zxingReaderRef.current = reader;

      if (!videoRef.current) return;

      zxingControlsRef.current = await reader.decodeFromVideoDevice(
        undefined,
        videoRef.current,
        (result: any, err: any) => {
          if (result) {
            const text = result.getText();
            if (text && text !== lastScanRef.current) {
              // Dedup: don't fire on the same code twice in a row
              const now = Date.now();
              if (now - lastScanTimeRef.current > 500) { // 500ms cooldown
                lastScanRef.current = text;
                lastScanTimeRef.current = now;
                handleBarcodeDetected(text);
              }
            }
          }
        }
      );
      setActiveEngine("ZXing");
      console.log("[pos-scanner] ZXing engine started");
    } catch (e: any) {
      console.warn("[pos-scanner] ZXing failed to start:", e?.message);
    }
  };

  // ===== Native BarcodeDetector engine (Chrome/Edge only — for speed) =====
  const startNativeEngine = async () => {
    const BarcodeDetectorCtor = (window as any).BarcodeDetector;
    if (!BarcodeDetectorCtor) return;

    try {
      let formats: string[] = ["ean_13", "ean_8", "code_128", "code_39", "upc_a", "upc_e", "qr_code"];
      try {
        const supported = await BarcodeDetectorCtor.getSupportedFormats();
        if (supported && supported.length > 0) {
          formats = supported;
        }
      } catch {}
      nativeDetectorRef.current = new BarcodeDetectorCtor({ formats });
    } catch {
      try { nativeDetectorRef.current = new BarcodeDetectorCtor(); } catch { return; }
    }

    const detector = nativeDetectorRef.current;
    if (!detector) return;

    const tick = async () => {
      if (!videoRef.current) {
        nativeRafRef.current = requestAnimationFrame(tick);
        return;
      }
      const video = videoRef.current;
      if (video.readyState >= video.HAVE_CURRENT_DATA) {
        try {
          const codes = await detector.detect(video);
          if (codes && codes.length > 0) {
            const code = codes[0].rawValue;
            if (code && code !== lastScanRef.current) {
              const now = Date.now();
              if (now - lastScanTimeRef.current > 500) {
                lastScanRef.current = code;
                lastScanTimeRef.current = now;
                handleBarcodeDetected(code);
                return;
              }
            }
          }
        } catch {
          // detection errors are non-fatal
        }
      }
      nativeRafRef.current = requestAnimationFrame(tick);
    };
    nativeRafRef.current = requestAnimationFrame(tick);
    console.log("[pos-scanner] Native engine started");
  };

  const stopAllEngines = () => {
    try { zxingControlsRef.current?.stop(); } catch {}
    zxingControlsRef.current = null;
    zxingReaderRef.current = null;
    if (nativeRafRef.current) {
      cancelAnimationFrame(nativeRafRef.current);
      nativeRafRef.current = null;
    }
    nativeDetectorRef.current = null;
  };

  // ===== Barcode detected handler =====
  const handleBarcodeDetected = (barcode: string) => {
    console.log(`[pos-scanner] Detected: ${barcode}`);
    // Haptic feedback
    if (navigator.vibrate) navigator.vibrate(100);
    stopAllEngines();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    onScan(barcode);
  };

  // ===== Manual entry =====
  const handleManualSubmit = () => {
    const code = manualValue.trim();
    if (!code) {
      toast({ title: "Enter a barcode or SKU", variant: "destructive" });
      return;
    }
    onScan(code);
  };

  // ===== Image upload scanning =====
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setEngineState("starting");
    setError("");

    try {
      const { BrowserMultiFormatReader } = await import("@zxing/browser");
      const { DecodeHintType, BarcodeFormat } = await import("@zxing/library");
      const reader = new BrowserMultiFormatReader();
      const hints = new Map();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [
        BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E,
        BarcodeFormat.CODE_128, BarcodeFormat.CODE_39, BarcodeFormat.CODE_93,
        BarcodeFormat.CODABAR, BarcodeFormat.ITF, BarcodeFormat.QR_CODE,
        BarcodeFormat.DATA_MATRIX, BarcodeFormat.PDF_417,
      ]);
      // TRY_HARDER omitted for speed — 640x480 + common formats is sufficient
      reader.hints = hints;

      const imageUrl = URL.createObjectURL(file);
      const result = await reader.decodeFromImageUrl(imageUrl);
      URL.revokeObjectURL(imageUrl);
      const text = result.getText();
      if (text) {
        toast({ title: "Barcode decoded from image", description: text });
        onScan(text);
      } else {
        throw new Error("No text in result");
      }
    } catch (e: any) {
      console.error("[pos-scanner] image decode failed:", e);
      setError("Could not decode a barcode from that image. Try a clearer photo with the barcode centered and well-lit.");
      setEngineState("error");
      setMode("manual");
    }
  };

  const switchMode = (newMode: ScanMode) => {
    stopAllEngines();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    lastScanRef.current = "";
    setError("");
    setEngineState("idle");
    setMode(newMode);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-5 py-4 bg-gradient-to-r from-emerald-600 to-teal-600 text-white">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-white/15 flex items-center justify-center">
              <ScanLine className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold">Scan to Find Product</h3>
              <p className="text-[10px] opacity-90">
                {supportedEngines.length > 1 ? "Multi-engine scanner" : "ZXing scanner"}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="h-8 w-8 rounded-lg bg-white/15 hover:bg-white/25 flex items-center justify-center">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Engine status badge */}
        {engineState === "scanning" && (
          <div className="flex-shrink-0 px-5 py-2 bg-emerald-50 dark:bg-emerald-900/20 border-b border-emerald-200 dark:border-emerald-800 flex items-center gap-2 text-[10px] text-emerald-700 dark:text-emerald-300">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <Zap className="h-3 w-3" />
            <span className="font-semibold">{activeEngine} engine active</span>
            <span className="opacity-70">· EAN/UPC/Code-128/39/93/Codabar/ITF/QR/DataMatrix/PDF417</span>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {mode === "camera" ? (
            <div className="space-y-3">
              {/* Camera viewport */}
              <div className="relative aspect-square bg-slate-900 rounded-2xl overflow-hidden ring-1 ring-slate-200 dark:ring-slate-800">
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  muted
                  playsInline
                />
                <canvas ref={canvasRef} className="hidden" />
                {/* Scanning frame overlay */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="w-3/4 h-1/3 border-2 border-emerald-400 rounded-2xl relative">
                    <div className="absolute top-0 left-0 right-0 h-0.5 bg-emerald-400 animate-pulse" />
                    <div className="absolute -top-1 -left-1 h-4 w-4 border-t-4 border-l-4 border-emerald-500 rounded-tl-lg" />
                    <div className="absolute -top-1 -right-1 h-4 w-4 border-t-4 border-r-4 border-emerald-500 rounded-tr-lg" />
                    <div className="absolute -bottom-1 -left-1 h-4 w-4 border-b-4 border-l-4 border-emerald-500 rounded-bl-lg" />
                    <div className="absolute -bottom-1 -right-1 h-4 w-4 border-b-4 border-r-4 border-emerald-500 rounded-br-lg" />
                  </div>
                </div>
                {/* Scan tip */}
                <div className="absolute bottom-2 left-2 right-2 text-center text-[10px] text-white/80 bg-black/40 rounded-lg py-1.5 px-2">
                  {engineState === "starting" ? "Starting camera…" : "Point camera at any barcode"}
                </div>
              </div>
              {error && (
                <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 text-xs flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" className="w-full" onClick={() => switchMode("manual")}>
                  <Keyboard className="h-4 w-4 mr-2" /> Manual
                </Button>
                <Button variant="outline" className="w-full" onClick={() => switchMode("upload")}>
                  <Upload className="h-4 w-4 mr-2" /> Upload
                </Button>
              </div>
            </div>
          ) : mode === "upload" ? (
            <div className="space-y-3">
              <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-8 text-center bg-slate-50 dark:bg-slate-800/50">
                <Camera className="h-12 w-12 mx-auto mb-3 text-slate-400" />
                <div className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Upload a photo of the barcode</div>
                <div className="text-xs text-slate-500 mb-4">JPG, PNG, or WebP — ZXing will decode any barcode format</div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
                <Button onClick={() => fileInputRef.current?.click()} className="bg-emerald-600 hover:bg-emerald-700">
                  <Upload className="h-4 w-4 mr-2" /> Choose photo
                </Button>
              </div>
              {error && (
                <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 text-xs flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" className="w-full" onClick={() => switchMode("camera")}>
                  <Camera className="h-4 w-4 mr-2" /> Camera
                </Button>
                <Button variant="outline" className="w-full" onClick={() => switchMode("manual")}>
                  <Keyboard className="h-4 w-4 mr-2" /> Manual
                </Button>
              </div>
            </div>
          ) : (
            /* Manual mode */
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5 block">Barcode or SKU</label>
                <Input
                  type="text"
                  autoFocus
                  value={manualValue}
                  onChange={(e) => setManualValue(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleManualSubmit()}
                  placeholder="e.g. 6034000181036 or COKE-500"
                  className="text-lg font-mono"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Accepts: EAN-13, EAN-8, UPC-A, UPC-E, Code-128/39 (alphanumeric), QR, or product SKU
                </p>
              </div>
              <Button onClick={handleManualSubmit} className="w-full bg-emerald-600 hover:bg-emerald-700">
                <ScanLine className="h-4 w-4 mr-2" /> Find product
              </Button>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" className="w-full" onClick={() => switchMode("camera")}>
                  <Camera className="h-4 w-4 mr-2" /> Camera
                </Button>
                <Button variant="outline" className="w-full" onClick={() => switchMode("upload")}>
                  <Upload className="h-4 w-4 mr-2" /> Upload
                </Button>
              </div>
              <p className="text-[10px] text-slate-500 text-center">
                Scans your local product catalog by barcode or SKU. Make sure products have barcodes set in Stock → Add/Modify.
              </p>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
