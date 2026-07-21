"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, ScanLine, Camera, AlertCircle, Check, Keyboard, Loader2,
  Sparkles, Package, Search, Upload, Image as ImageIcon, Zap, AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { lookupBarcodeEverywhere, normalizeBarcode, isValidBarcode, type BarcodeLookupResult } from "@/lib/barcode-lookup";

interface ProductScannerProps {
  onResult: (result: ScannedProduct) => void;
  onClose: () => void;
}

export interface ScannedProduct {
  barcode: string;
  name?: string;
  emoji?: string;
  category?: string;
  description?: string;
  brand?: string;
  price?: number;
  imageUrl?: string;
  source: "openfoodfacts" | "upcitemdb" | "manual" | "unknown";
}

type ScanMode = "camera" | "manual" | "upload";
type EngineState = "idle" | "starting" | "scanning" | "looking" | "error";

/**
 * Premium multi-engine barcode scanner for ADDING NEW PRODUCTS.
 *
 * WHY MULTI-ENGINE:
 *   The native BarcodeDetector API only works on Chrome/Edge Android.
 *   Safari (desktop + iOS), Firefox, and older browsers don't support it.
 *   This scanner tries THREE engines in order until one works:
 *
 *   1. ZXing (z-ai-web-dev-sdk/@zxing/library) — pure JS, works on ALL
 *      browsers (Chrome, Safari, Firefox, Edge, iOS, Android, desktop).
 *      Supports: EAN-13, EAN-8, UPC-A, UPC-E, Code-128, Code-39, Code-93,
 *      Codabar, ITF, QR, DataMatrix, PDF417, RSS-14.
 *   2. Native BarcodeDetector (Chrome/Edge only) — faster + GPU-accelerated
 *      when available, used as a secondary engine for speed.
 *   3. Image upload fallback — user uploads a photo of the barcode, ZXing
 *      decodes it. Works even without a camera.
 *
 * LOOKUP DATABASES:
 *   Tries multiple databases in parallel:
 *   - OpenFoodFacts (2M+ food products)
 *   - UPCitemdb (6M+ general products)
 *   First match wins.
 */
export function ProductScanner({ onResult, onClose }: ProductScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const zxingReaderRef = useRef<any>(null);
  const zxingControlsRef = useRef<any>(null);
  const nativeRafRef = useRef<number | null>(null);
  const nativeDetectorRef = useRef<any>(null);
  const lastScanRef = useRef<string>(""); // last detected barcode (dedup)
  const lastScanTimeRef = useRef<number>(0);

  const [mode, setMode] = useState<ScanMode>("camera");
  const [engineState, setEngineState] = useState<EngineState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [manualBarcode, setManualBarcode] = useState("");
  const [activeEngine, setActiveEngine] = useState<string>("");
  const [supportedEngines, setSupportedEngines] = useState<string[]>([]);
  const { toast } = useToast();

  // ===== Detect which engines are available on mount =====
  useEffect(() => {
    const engines: string[] = [];
    // ZXing is pure JS — always available
    engines.push("zxing");
    // Native BarcodeDetector — Chrome/Edge only
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
      setError(null);

      try {
        // Request back camera
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        // Start ZXing engine (works on ALL browsers)
        // We try ZXing FIRST because it has wider format support.
        await startZxingEngine();
        // Also start native engine in parallel (for speed on Chrome/Edge)
        if (supportedEngines.includes("native") && !cancelled) {
          startNativeEngine();
        }
        if (!cancelled) {
          setEngineState("scanning");
        }
      } catch (e: any) {
        console.warn("Camera start error:", e);
        if (cancelled) return;
        let msg: string;
        if (e?.name === "NotAllowedError") {
          msg = "Camera access denied. Allow camera permission in your browser settings, or use manual entry / image upload.";
        } else if (e?.name === "NotFoundError") {
          msg = "No camera found on this device. Use manual entry or upload a photo of the barcode.";
        } else if (e?.name === "NotReadableError") {
          msg = "Camera is in use by another app. Close it and try again, or use manual entry.";
        } else if (e?.name === "OverconstrainedError") {
          msg = "No back camera available. Trying front camera… (or use manual entry)";
          // Retry with front camera
          try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
            if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
            streamRef.current = stream;
            if (videoRef.current) {
              videoRef.current.srcObject = stream;
              await videoRef.current.play();
            }
            await startZxingEngine();
            if (!cancelled) setEngineState("scanning");
            return;
          } catch (e2: any) {
            msg = "Could not start any camera. Use manual entry or image upload.";
          }
        } else {
          msg = e?.message || "Could not start camera. Use manual entry or image upload.";
        }
        setError(msg);
        setEngineState("error");
        // Auto-suggest manual mode
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
      const reader = new BrowserMultiFormatReader();
      zxingReaderRef.current = reader;

      // Hints: enable ALL barcode formats
      const { DecodeHintType, BarcodeFormat } = await import("@zxing/library");
      const hints = new Map();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [
        BarcodeFormat.EAN_13, BarcodeFormat.EAN_8,
        BarcodeFormat.UPC_A, BarcodeFormat.UPC_E,
        BarcodeFormat.CODE_128, BarcodeFormat.CODE_39, BarcodeFormat.CODE_93,
        BarcodeFormat.CODABAR, BarcodeFormat.ITF,
        BarcodeFormat.QR_CODE, BarcodeFormat.DATA_MATRIX, BarcodeFormat.PDF_417,
        BarcodeFormat.RSS_14, BarcodeFormat.RSS_EXPANDED,
      ]);
      hints.set(DecodeHintType.TRY_HARDER, true);
      reader.hints = hints;

      // Use video element directly (no canvas needed — ZXing reads from video)
      if (!videoRef.current) return;

      zxingControlsRef.current = await reader.decodeFromVideoDevice(
        undefined, // default (back) camera
        videoRef.current,
        (result: any, err: any) => {
          if (result) {
            const text = result.getText();
            if (text && text !== lastScanRef.current) {
              // Dedup: don't fire on the same code twice in a row
              lastScanRef.current = text;
              lastScanTimeRef.current = Date.now();
              handleBarcodeDetected(text, "zxing");
            }
          }
        }
      );
      setActiveEngine("ZXing");
      console.log("[scanner] ZXing engine started");
    } catch (e: any) {
      console.warn("[scanner] ZXing failed to start:", e?.message);
      // Don't throw — native engine might still work
    }
  };

  // ===== Native BarcodeDetector engine (Chrome/Edge only — for speed) =====
  const startNativeEngine = async () => {
    const BarcodeDetectorCtor = (window as any).BarcodeDetector;
    if (!BarcodeDetectorCtor) return;

    try {
      // Get supported formats (browser may not support all)
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
      if (!videoRef.current || !canvasRef.current) {
        nativeRafRef.current = requestAnimationFrame(tick);
        return;
      }
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video.readyState >= video.HAVE_CURRENT_DATA) {
        try {
          const codes = await detector.detect(video);
          if (codes && codes.length > 0) {
            const code = codes[0].rawValue;
            if (code && code !== lastScanRef.current) {
              lastScanRef.current = code;
              lastScanTimeRef.current = Date.now();
              handleBarcodeDetected(code, "native");
              return;
            }
          }
        } catch {
          // detection errors are non-fatal — ZXing will handle it
        }
      }
      nativeRafRef.current = requestAnimationFrame(tick);
    };
    nativeRafRef.current = requestAnimationFrame(tick);
    console.log("[scanner] Native engine started");
  };

  const stopAllEngines = () => {
    // Stop ZXing
    try { zxingControlsRef.current?.stop(); } catch {}
    zxingControlsRef.current = null;
    zxingReaderRef.current = null;
    // Stop native
    if (nativeRafRef.current) {
      cancelAnimationFrame(nativeRafRef.current);
      nativeRafRef.current = null;
    }
    nativeDetectorRef.current = null;
  };

  // ===== Barcode detected handler =====
  const handleBarcodeDetected = (barcode: string, engine: string) => {
    console.log(`[scanner] Detected by ${engine}: ${barcode}`);
    stopAllEngines();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    // Haptic feedback
    if (navigator.vibrate) navigator.vibrate(100);
    setEngineState("looking");
    doLookup(barcode);
  };

  // ===== Multi-database lookup =====
  const doLookup = async (rawBarcode: string) => {
    const barcode = normalizeBarcode(rawBarcode);
    if (!isValidBarcode(barcode)) {
      toast({ title: "Invalid barcode", description: "The scanned code doesn't look like a valid barcode. Try manual entry.", variant: "destructive" });
      setMode("manual");
      setEngineState("idle");
      return;
    }

    try {
      const result = await lookupBarcodeEverywhere(barcode);
      if (result) {
        toast({
          title: "Product found!",
          description: `${result.name} (via ${result.source})`,
        });
        onResult({
          barcode: result.barcode,
          name: result.name,
          emoji: result.emoji,
          category: result.category,
          description: result.description,
          brand: result.brand,
          imageUrl: result.imageUrl,
          source: result.source,
        });
      } else {
        // Not in any DB — return barcode for manual entry
        toast({
          title: "Barcode scanned successfully",
          description: "Not found in product databases — please fill product details manually.",
        });
        onResult({ barcode, source: "unknown" });
      }
    } catch (e: any) {
      console.error("[scanner] lookup failed:", e);
      toast({
        title: "Lookup failed",
        description: "Could not reach product databases. Please fill manually.",
        variant: "destructive",
      });
      onResult({ barcode, source: "unknown" });
    }
  };

  // ===== Manual entry =====
  const handleManualSubmit = () => {
    const code = manualBarcode.trim();
    if (!code) {
      toast({ title: "Enter a barcode", variant: "destructive" });
      return;
    }
    if (!isValidBarcode(code)) {
      toast({ title: "Invalid barcode", description: "Barcodes are 6-14 digits (EAN/UPC) or 4-30 alphanumeric chars (Code-128/39).", variant: "destructive" });
      return;
    }
    setEngineState("looking");
    doLookup(code);
  };

  // ===== Image upload scanning =====
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setEngineState("looking");
    setError(null);

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
      hints.set(DecodeHintType.TRY_HARDER, true);
      reader.hints = hints;

      const imageUrl = URL.createObjectURL(file);
      const result = await reader.decodeFromImageUrl(imageUrl);
      URL.revokeObjectURL(imageUrl);
      const text = result.getText();
      if (text) {
        toast({ title: "Barcode decoded from image", description: text });
        doLookup(text);
      } else {
        throw new Error("No text in result");
      }
    } catch (e: any) {
      console.error("[scanner] image decode failed:", e);
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
    setError(null);
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
        <div className="flex-shrink-0 flex items-center justify-between px-5 py-4 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-white/15 flex items-center justify-center">
              <ScanLine className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold">Scan Product Barcode</h3>
              <p className="text-[10px] opacity-90">
                {supportedEngines.length > 1 ? "Multi-engine + multi-database" : "ZXing engine + multi-database"}
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
            <span className="opacity-70">· Supports EAN/UPC/Code-128/39/93/Codabar/ITF/QR/DataMatrix/PDF417</span>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {engineState === "looking" ? (
            <div className="py-12 text-center">
              <Loader2 className="h-10 w-10 animate-spin mx-auto mb-3 text-violet-600" />
              <div className="font-semibold text-slate-900 dark:text-white">Looking up product…</div>
              <div className="text-xs text-slate-500 mt-1">Querying OpenFoodFacts + UPCitemdb</div>
            </div>
          ) : mode === "camera" ? (
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
                  <div className="w-3/4 h-1/3 border-2 border-violet-400 rounded-2xl relative">
                    <div className="absolute top-0 left-0 right-0 h-0.5 bg-violet-400 animate-pulse" />
                    <div className="absolute -top-1 -left-1 h-4 w-4 border-t-4 border-l-4 border-violet-500 rounded-tl-lg" />
                    <div className="absolute -top-1 -right-1 h-4 w-4 border-t-4 border-r-4 border-violet-500 rounded-tr-lg" />
                    <div className="absolute -bottom-1 -left-1 h-4 w-4 border-b-4 border-l-4 border-violet-500 rounded-bl-lg" />
                    <div className="absolute -bottom-1 -right-1 h-4 w-4 border-b-4 border-r-4 border-violet-500 rounded-br-lg" />
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
                <ImageIcon className="h-12 w-12 mx-auto mb-3 text-slate-400" />
                <div className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Upload a photo of the barcode</div>
                <div className="text-xs text-slate-500 mb-4">JPG, PNG, or WebP — ZXing will decode any barcode format</div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
                <Button onClick={() => fileInputRef.current?.click()} className="bg-violet-600 hover:bg-violet-700">
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
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5 block">Barcode Number</label>
                <Input
                  type="text"
                  inputMode="numeric"
                  autoFocus
                  value={manualBarcode}
                  onChange={(e) => setManualBarcode(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleManualSubmit()}
                  placeholder="e.g. 6034000181036 (EAN-13) or 012345678905 (UPC-A)"
                  className="text-lg font-mono"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Accepts: EAN-13 (13 digits), EAN-8 (8 digits), UPC-A (12 digits), UPC-E (6-7 digits), Code-128/39 (alphanumeric)
                </p>
              </div>
              <Button onClick={handleManualSubmit} className="w-full bg-violet-600 hover:bg-violet-700">
                <Search className="h-4 w-4 mr-2" /> Look up barcode
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
                We look up barcodes in <strong>OpenFoodFacts</strong> (2M+ food products) and <strong>UPCitemdb</strong> (6M+ general products).
                <br/>Works for food, drinks, groceries, electronics, books, household items, cosmetics, and more.
              </p>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
