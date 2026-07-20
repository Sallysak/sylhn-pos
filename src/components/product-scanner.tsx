"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, ScanLine, Camera, AlertCircle, Check, Keyboard, Loader2,
  Sparkles, Package, Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

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
  price?: number;
  imageUrl?: string;
  source: "openfoodfacts" | "manual" | "unknown";
}

/**
 * Premium barcode scanner for ADDING NEW PRODUCTS.
 *
 * Flow:
 *   1. User opens scanner
 *   2. Camera scans barcode (or user types it manually)
 *   3. We look up the barcode on OpenFoodFacts API (free, no auth)
 *   4. If found, pre-fill the product form with name, category, image
 *   5. If not found, return just the barcode and let user fill the rest
 *
 * Uses the native BarcodeDetector API (Chrome/Edge) with manual fallback.
 */
export function ProductScanner({ onResult, onClose }: ProductScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastScanRef = useRef<number>(0);
  const [mode, setMode] = useState<"camera" | "manual">("camera");
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(true);
  const [manualBarcode, setManualBarcode] = useState("");
  const [looking, setLooking] = useState(false);
  const [supported, setSupported] = useState(false);
  const { toast } = useToast();

  // ===== Camera setup + detection =====
  useEffect(() => {
    if (mode !== "camera") return;
    if (typeof window === "undefined") return;
    if (!("BarcodeDetector" in window)) {
      setSupported(false);
      setError("BarcodeDetector API not supported in this browser. Use manual entry below.");
      setMode("manual");
      return;
    }
    setSupported(true);

    let cancelled = false;

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
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
        startDetection();
      } catch (e: any) {
        console.warn("Camera error:", e);
        const msg = e?.name === "NotAllowedError"
          ? "Camera access denied. Allow camera permission or use manual entry."
          : e?.name === "NotFoundError"
          ? "No camera found on this device."
          : e?.message || "Could not start camera";
        setError(msg);
        setMode("manual");
      }
    })();

    return () => {
      cancelled = true;
      stopDetection();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
    };
  }, [mode]);

  const startDetection = useCallback(async () => {
    const BarcodeDetectorCtor = (window as any).BarcodeDetector;
    if (!BarcodeDetectorCtor) return;

    let detector: any;
    try {
      detector = new BarcodeDetectorCtor({
        formats: ["ean_13", "ean_8", "code_128", "code_39", "upc_a", "upc_e", "qr_code"],
      });
    } catch {
      detector = new BarcodeDetectorCtor();
    }

    const tick = async () => {
      if (!scanning || !videoRef.current || !canvasRef.current) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          try {
            const codes = await detector.detect(canvas);
            if (codes && codes.length > 0) {
              const now = Date.now();
              if (now - lastScanRef.current > 500) { // 500ms cooldown
                lastScanRef.current = now;
                const code = codes[0].rawValue || codes[0].boundingBox;
                if (code) {
                  handleBarcodeDetected(String(code));
                  return;
                }
              }
            }
          } catch (e) {
            // detection errors are non-fatal
          }
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [scanning]);

  const stopDetection = () => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  };

  // ===== Barcode lookup (OpenFoodFacts) =====
  const lookupBarcode = async (barcode: string) => {
    setLooking(true);
    setError(null);
    try {
      const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json`);
      const data = await res.json();
      if (data.status === 1 && data.product) {
        const p = data.product;
        const result: ScannedProduct = {
          barcode,
          name: p.product_name || p.generic_name || undefined,
          emoji: "📦",
          category: p.categories_tags?.[0]?.replace(/^[^:]+:/, "") || p.compared_to_category?.replace(/^[^:]+:/, "") || undefined,
          description: [p.generic_name, p.brands, p.quantity].filter(Boolean).join(" · ") || undefined,
          imageUrl: p.image_front_small_url || p.image_thumb_url || undefined,
          source: "openfoodfacts",
        };
        if (navigator.vibrate) navigator.vibrate(100);
        toast({
          title: "Product found!",
          description: result.name || "Recognized in OpenFoodFacts database",
        });
        onResult(result);
      } else {
        // Barcode valid but not in DB
        if (navigator.vibrate) navigator.vibrate([50, 50, 50]);
        toast({
          title: "Not in database",
          description: "Barcode scanned but not found in OpenFoodFacts. Please fill product details manually.",
        });
        onResult({ barcode, source: "unknown" });
      }
    } catch (e: any) {
      // Network error — still return barcode for manual entry
      toast({
        title: "Lookup failed",
        description: "Could not reach product database. Please fill manually.",
        variant: "destructive",
      });
      onResult({ barcode, source: "unknown" });
    } finally {
      setLooking(false);
    }
  };

  const handleBarcodeDetected = (barcode: string) => {
    setScanning(false);
    stopDetection();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    lookupBarcode(barcode);
  };

  const handleManualSubmit = () => {
    const code = manualBarcode.trim();
    if (!/^\d{6,14}$/.test(code) && !/^[A-Z0-9-]{4,30}$/i.test(code)) {
      toast({ title: "Invalid barcode", description: "Enter 6-14 digits", variant: "destructive" });
      return;
    }
    lookupBarcode(code);
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
        className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-white/15 flex items-center justify-center">
              <ScanLine className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold">Scan Product Barcode</h3>
              <p className="text-[10px] opacity-90">Auto-fills details from OpenFoodFacts</p>
            </div>
          </div>
          <button onClick={onClose} className="h-8 w-8 rounded-lg bg-white/15 hover:bg-white/25 flex items-center justify-center">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5">
          {looking ? (
            <div className="py-12 text-center">
              <Loader2 className="h-10 w-10 animate-spin mx-auto mb-3 text-violet-600" />
              <div className="font-semibold text-slate-900 dark:text-white">Looking up product…</div>
              <div className="text-xs text-slate-500 mt-1">Querying OpenFoodFacts database</div>
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
                  Point camera at product barcode
                </div>
              </div>
              {error && (
                <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 text-xs flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}
              <Button variant="outline" className="w-full" onClick={() => setMode("manual")}>
                <Keyboard className="h-4 w-4 mr-2" /> Type barcode manually
              </Button>
            </div>
          ) : (
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
                  placeholder="e.g. 6034000181036"
                  className="text-lg font-mono"
                />
              </div>
              {supported && (
                <Button variant="outline" className="w-full" onClick={() => { setMode("camera"); setScanning(true); setError(null); }}>
                  <Camera className="h-4 w-4 mr-2" /> Use camera instead
                </Button>
              )}
              <Button onClick={handleManualSubmit} className="w-full bg-violet-600 hover:bg-violet-700">
                <Search className="h-4 w-4 mr-2" /> Look up barcode
              </Button>
              <p className="text-[10px] text-slate-500 text-center">
                We look up barcodes in <strong>OpenFoodFacts</strong> — a free database of 2M+ products.
                <br/>Works for food, drinks, groceries, household items.
              </p>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
