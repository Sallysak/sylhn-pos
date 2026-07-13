"use client";

import { useState, useEffect } from "react";
import { Download, X, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface InstallButtonProps {
  className?: string;
  variant?: "compact" | "full";
}

/**
 * PWA Install Button
 *
 * Shows an "Install App" button when the browser supports PWA installation
 * (Chrome, Edge, Samsung Internet). On iOS Safari (which doesn't support
 * the beforeinstallprompt event), shows a hint to use "Add to Home Screen".
 *
 * Once installed (or dismissed), the button hides automatically.
 */
export function InstallButton({ className, variant = "compact" }: InstallButtonProps) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showIOSHint, setShowIOSHint] = useState(false);

  useEffect(() => {
    // Check if already running as an installed PWA
    /* eslint-disable react-hooks/set-state-in-effect */
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
      return;
    }
    // iOS Safari doesn't support beforeinstallprompt — check if iOS
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    const isSafari = /^((?!chrome|android|crios|fxios).)*safari/i.test(navigator.userAgent);

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("appinstalled", handleAppInstalled);

    // On iOS Safari, show the hint after 3 seconds (only on login page / first visit)
    if (isIOS && isSafari && !localStorage.getItem("sylhn-ios-hint-dismissed")) {
      const timer = setTimeout(() => setShowIOSHint(true), 3000);
      return () => {
        clearTimeout(timer);
        window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
        window.removeEventListener("appinstalled", handleAppInstalled);
      };
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === "accepted") {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
  };

  if (isInstalled) return null;

  // iOS hint (since iOS doesn't support beforeinstallprompt)
  if (showIOSHint) {
    return (
      <div className={cn("fixed bottom-4 left-4 right-4 z-[200] bg-slate-900 text-white rounded-2xl shadow-2xl p-4 max-w-sm mx-auto", className)}>
        <button
          onClick={() => { setShowIOSHint(false); localStorage.setItem("sylhn-ios-hint-dismissed", "1"); }}
          className="absolute top-2 right-2 h-6 w-6 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="flex items-start gap-3">
          <Smartphone className="h-6 w-6 text-emerald-400 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-bold text-sm mb-1">Install SYLHN POS</div>
            <div className="text-xs text-slate-300 mb-2">
              Tap the Share button <span className="font-bold">⬆️</span> in Safari, then select
              <span className="font-bold"> "Add to Home Screen" </span> to install the app.
            </div>
            <button
              onClick={() => { setShowIOSHint(false); localStorage.setItem("sylhn-ios-hint-dismissed", "1"); }}
              className="text-xs text-emerald-400 font-semibold hover:underline"
            >
              Got it
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Only show the install button if the browser has fired beforeinstallprompt
  if (!deferredPrompt) return null;

  if (variant === "full") {
    return (
      <button
        onClick={handleInstall}
        className={cn(
          "w-full h-11 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-sm font-bold transition shadow-lg flex items-center justify-center gap-2",
          className
        )}
      >
        <Download className="h-4 w-4" />
        Install App
      </button>
    );
  }

  return (
    <button
      onClick={handleInstall}
      className={cn(
        "h-8 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 transition",
        className
      )}
      title="Install SYLHN POS as an app"
    >
      <Download className="h-4 w-4" />
      <span className="hidden sm:inline">Install</span>
    </button>
  );
}
