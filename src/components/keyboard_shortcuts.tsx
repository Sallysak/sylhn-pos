"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Keyboard, X } from "lucide-react";

// ============================================================
// Keyboard Shortcuts Component for SYLHN POS
// Drop-in: just add <KeyboardShortcuts /> anywhere in your app.
// Listens for key presses and dispatches custom events.
// ============================================================

const SHORTCUTS = [
  { key: "F1", description: "Focus search bar", eventName: "kb-focus-search" },
  { key: "F2", description: "Open cart (mobile) / focus cart", eventName: "kb-open-cart" },
  { key: "F3", description: "Print last receipt", eventName: "kb-print" },
  { key: "F4", description: "Apply quick discount", eventName: "kb-discount" },
  { key: "F5", description: "Hold current sale", eventName: "kb-hold-sale" },
  { key: "F6", description: "Recall held sale", eventName: "kb-recall-sale" },
  { key: "F7", description: "Open AI Assistant", eventName: "kb-ai-assistant" },
  { key: "F8", description: "Open calculator", eventName: "kb-calculator" },
  { key: "F9", description: "New sale / clear cart", eventName: "kb-new-sale" },
  { key: "F10", description: "Open Maintenance menu", eventName: "kb-maintenance" },
  { key: "/", description: "Quick search (Gmail-style)", eventName: "kb-quick-search" },
  { key: "?", description: "Show this help overlay", eventName: "kb-show-help" },
  { key: "Esc", description: "Close any open modal/popup", eventName: "kb-close-modal" },
  { key: "Ctrl+Enter", description: "Process payment (on payment screen)", eventName: "kb-process-payment" },
];

export function KeyboardShortcuts() {
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isTyping =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      // === ? — Show help overlay (works even when typing, requires Shift) ===
      if (e.key === "?" || (e.key === "/" && e.shiftKey)) {
        e.preventDefault();
        setShowHelp((s) => !s);
        return;
      }

      // === Esc — Close modal (works everywhere, even when typing) ===
      if (e.key === "Escape") {
        if (showHelp) {
          setShowHelp(false);
          return;
        }
        document.dispatchEvent(new CustomEvent("kb-close-modal"));
        return;
      }

      // === Skip remaining shortcuts if user is typing ===
      if (isTyping) return;

      // === / — Quick search focus ===
      if (e.key === "/" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        document.dispatchEvent(new CustomEvent("kb-quick-search"));
        return;
      }

      // === Ctrl/Cmd + Enter — Process payment ===
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        document.dispatchEvent(new CustomEvent("kb-process-payment"));
        return;
      }

      // === F1 — F10 function keys ===
      const fnMatch = e.key.match(/^F(\d+)$/);
      if (fnMatch) {
        const num = parseInt(fnMatch[1], 10);
        if (num >= 1 && num <= 10) {
          e.preventDefault();
          const shortcut = SHORTCUTS.find((s) => s.key === `F${num}`);
          if (shortcut) {
            document.dispatchEvent(new CustomEvent(shortcut.eventName));
          }
        }
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [showHelp]);

  return (
    <AnimatePresence>
      {showHelp && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[300] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowHelp(false)}
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-5 py-3">
              <div className="flex items-center gap-2">
                <Keyboard className="h-5 w-5" />
                <h3 className="font-bold">Keyboard Shortcuts</h3>
              </div>
              <button
                onClick={() => setShowHelp(false)}
                className="h-7 w-7 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center transition active:scale-90"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Shortcuts grid */}
            <div className="p-4 max-h-[60vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {SHORTCUTS.map((s) => (
                  <div
                    key={s.key}
                    className="flex items-center justify-between p-2 rounded-lg bg-slate-50 hover:bg-slate-100 transition"
                  >
                    <span className="text-xs text-slate-700">{s.description}</span>
                    <kbd className="text-[10px] font-mono font-bold bg-white px-2 py-1 rounded border border-slate-200 shadow-sm whitespace-nowrap">
                      {s.key}
                    </kbd>
                  </div>
                ))}
              </div>

              {/* Pro tip */}
              <div className="mt-4 p-3 rounded-lg bg-emerald-50 border border-emerald-100">
                <p className="text-[11px] text-emerald-700 leading-relaxed">
                  💡 <strong>Pro Tip:</strong> Press <kbd className="font-mono font-bold bg-white px-1.5 py-0.5 rounded border border-emerald-200">?</kbd> anywhere to show this help. Shortcuts are disabled while typing in input fields (except Esc and ?).
                </p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
