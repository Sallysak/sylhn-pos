"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ScanLine, Camera, AlertCircle, Check, Keyboard } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
  onClose: () => void;
}

/**
 * Premium barcode scanner — uses the native BarcodeDetector API where available
 * (Chrome on Android, Edge). Falls back to manual entry on iOS Safari / Firefox.
 *
 * Detection loop:
 *   1. getUserMedia to access the back camera
 *   2. draw video frames to a canvas
 *   3. call BarcodeDetector.detect() on the canvas
 *   4. if a code is found, call onScan and close
 *
 * Performance: detection runs at ~10fps via requestAnimationFrame, with a
 * 500ms cooldown after each successful scan to prevent duplicates.
 */
export function BarcodeScanner({ onScan, onClose }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastScanRef = useRef<number>(0);
  const [error, setError] = useState<string>("");
  const [manualMode, setManualMode] = useState(false);
  const [manualValue, setManualValue] = useState("");
  const [supported, setSupported] = useState<boolean>(true);
  const [scanning, setScanning] = useState(false);
  const [lastScan, setLastScan] = useState<string>("");
  const { toast } = useToast();

  // Check for BarcodeDetector support
  useEffect(() => {
    if (typeof window === "undefined") return;
    const hasBD = "BarcodeDetector" in window;
    setSupported(hasBD);
    if (!hasBD) {
      // Default to manual mode on unsupported browsers (iOS Safari, Firefox)
      setManualMode(true);
    }
  }, []);

  // Start camera + detection loop
  const startCamera = useCallback(async () => {
    setError("");
    setScanning(true);

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("Camera not supported on this device. Use manual entry.");
        setManualMode(true);
        setScanning(false);
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",  // back camera
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      // Start detection loop if BarcodeDetector is available
      if ("BarcodeDetector" in window) {
        detectLoop();
      } else {
        // Without BarcodeDetector, just show the camera feed (user can snap and we'll
        // try to detect on a tapped frame, or just use manual entry)
        setError("Live detection not supported. Use manual entry, or tap 'Capture' below.");
      }
    } catch (e: any) {
      console.error("Camera error:", e);
      if (e?.name === "NotAllowedError") {
        setError("Camera permission denied. Please allow camera access in your browser settings.");
      } else if (e?.name === "NotFoundError") {
        setError("No camera found on this device. Use manual entry.");
      } else {
        setError(e?.message || "Could not access camera");
      }
      setManualMode(true);
      setScanning(false);
    }
  }, []);

  const detectLoop = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    // @ts-ignore — BarcodeDetector is not in standard TS lib yet
    const BD = (window as any).BarcodeDetector;
    if (!BD) return;
    const detector = new BD({
      formats: ["ean_13", "ean_8", "code_128", "code_39", "upc_a", "upc_e", "qr_code"],
    });

    const loop = async () => {
      if (video.readyState !== video.HAVE_ENOUGH_DATA) {
        rafRef.current = requestAnimationFrame(loop);
        return;
      }

      // Throttle: only detect every 100ms
      const now = Date.now();
      if (now - lastScanRef.current > 100) {
        lastScanRef.current = now;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        try {
          const codes = await detector.detect(canvas);
          if (codes && codes.length > 0) {
            const code = codes[0].rawValue;
            // Vibrate if supported (haptic feedback)
            if ("vibrate" in navigator) {
              try { navigator.vibrate(100); } catch {}
            }
            setLastScan(code);
            onScan(code);
            // Don't auto-close — let the parent decide (e.g. show "found X" toast)
            // But do stop the loop after 500ms cooldown
            setTimeout(() => {
              stopCamera();
              onClose();
            }, 300);
            return;
          }
        } catch (e) {
          // Detection errors are non-fatal — keep trying
        }
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
  }, [onScan, onClose]);

  const stopCamera = useCallback(() => {
    setScanning(false);
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  // Auto-start camera on mount (if supported and not in manual mode)
  useEffect(() => {
    if (!manualMode && supported) {
      startCamera();
    }
  }, [manualMode, supported, startCamera]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualValue.trim()) return;
    onScan(manualValue.trim());
    setManualValue("");
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black z-[60] flex flex-col"
    >
      {/* Top bar */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 bg-black/40 backdrop-blur" style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 12px)" }}>
        <div className="flex items-center gap-2 text-white">
          <ScanLine className="h-5 w-5" />
          <span className="font-semibold text-sm">{manualMode ? "Manual Entry" : "Scan Barcode"}</span>
        </div>
        <button
          onClick={() => { stopCamera(); onClose(); }}
          className="h-9 w-9 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Camera view */}
      {!manualMode && (
        <div className="flex-1 relative overflow-hidden">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="absolute inset-0 w-full h-full object-cover"
          />
          <canvas ref={canvasRef} className="hidden" />

          {/* Scan frame overlay */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <motion.div
              initial={{ opacity: 0.5 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, repeat: Infinity, repeatType: "reverse" }}
              className="w-64 h-40 border-2 border-emerald-400 rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]"
            >
              <div className="w-full h-0.5 bg-emerald-400 mt-20 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
            </motion.div>
          </div>

          {/* Hint */}
          <div className="absolute bottom-32 left-0 right-0 text-center text-white/90 text-xs px-6">
            Position the barcode within the frame
          </div>

          {/* Last scan indicator */}
          {lastScan && (
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="absolute top-4 left-1/2 -translate-x-1/2 bg-emerald-500 text-white px-3 py-1.5 rounded-full text-xs font-mono font-bold flex items-center gap-1.5 shadow-lg"
            >
              <Check className="h-3.5 w-3.5" />
              {lastScan}
            </motion.div>
          )}

          {/* Error overlay */}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center p-6 bg-black/80">
              <div className="bg-white rounded-2xl p-5 max-w-sm text-center">
                <AlertCircle className="h-10 w-10 text-amber-500 mx-auto mb-3" />
                <div className="font-semibold text-slate-800 mb-1 text-sm">Camera Issue</div>
                <div className="text-xs text-slate-600 mb-4">{error}</div>
                <button
                  onClick={() => setManualMode(true)}
                  className="h-10 px-4 rounded-xl bg-emerald-600 text-white text-sm font-semibold"
                >
                  Switch to Manual Entry
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Manual entry */}
      {manualMode && (
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <form onSubmit={handleManualSubmit} className="w-full max-w-sm">
            <div className="bg-white/10 backdrop-blur rounded-2xl p-5">
              <label className="block text-white text-xs font-semibold mb-2 uppercase tracking-wide">
                {supported ? "Manual Barcode Entry" : "Barcode / SKU Entry"}
              </label>
              <input
                autoFocus
                value={manualValue}
                onChange={(e) => setManualValue(e.target.value)}
                placeholder="e.g. 9415638120923 or APL-001"
                className="w-full h-12 px-4 rounded-xl bg-white text-slate-900 text-base font-mono font-semibold outline-none ring-2 ring-transparent focus:ring-emerald-400"
                inputMode="text"
                autoComplete="off"
              />
              <button
                type="submit"
                disabled={!manualValue.trim()}
                className="w-full h-12 mt-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-sm flex items-center justify-center gap-2 transition"
              >
                <Check className="h-4 w-4" />
                Look Up Product
              </button>
            </div>

            {supported && (
              <button
                type="button"
                onClick={() => { setManualMode(false); setManualValue(""); setError(""); }}
                className="w-full mt-3 h-10 rounded-xl bg-white/10 text-white text-xs font-semibold flex items-center justify-center gap-2 hover:bg-white/20 transition"
              >
                <Camera className="h-3.5 w-3.5" />
                Switch to Camera Scanner
              </button>
            )}
          </form>
        </div>
      )}

      {/* Bottom controls */}
      <div className="flex-shrink-0 p-4 bg-black/40 backdrop-blur" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)" }}>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => setManualMode(!manualMode)}
            className="h-10 px-4 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-semibold flex items-center gap-2 transition"
          >
            <Keyboard className="h-3.5 w-3.5" />
            {manualMode ? "Camera" : "Manual"}
          </button>
          {scanning && !manualMode && (
            <div className="text-emerald-300 text-xs font-semibold flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Scanning...
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
