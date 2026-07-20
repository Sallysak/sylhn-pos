"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Keyboard, Command } from "lucide-react";

interface Shortcut {
  key: string;
  description: string;
  category: string;
}

const SHORTCUTS: Shortcut[] = [
  { key: "F1", description: "Find Product", category: "POS" },
  { key: "F2", description: "Save / Hold Order", category: "POS" },
  { key: "F3", description: "Print Receipt", category: "POS" },
  { key: "F4", description: "Void Transaction", category: "POS" },
  { key: "F5", description: "Pay Now", category: "POS" },
  { key: "F6", description: "Preview Cart", category: "POS" },
  { key: "F10", description: "Search by Part No.", category: "POS" },
  { key: "Ctrl+N", description: "New Sale (clear cart)", category: "POS" },
  { key: "Ctrl+P", description: "Go to POS Screen", category: "Navigation" },
  { key: "Esc", description: "Close dialog / Cancel", category: "Navigation" },
  { key: "?", description: "Show this shortcuts overlay", category: "Navigation" },
  { key: "Enter", description: "Confirm / Add to cart", category: "POS" },
  { key: "Del", description: "Delete selected cart line", category: "POS" },
];

export function KeyboardShortcutsOverlay() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't trigger when typing in an input
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "?" || (e.key === "/" && e.shiftKey)) {
        e.preventDefault();
        setOpen(prev => !prev);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const categories = [...new Set(SHORTCUTS.map(s => s.category))];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="compact-modal-overlay fixed inset-0 bg-black/60 backdrop-blur-md z-[200] flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <motion.div
            initial={{ scale: 0.92, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.92, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="compact-modal bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-violet-600 to-indigo-600 text-white flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-white/15 flex items-center justify-center">
                  <Keyboard className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold">Keyboard Shortcuts</h3>
                  <p className="text-[10px] opacity-80">Press ? to toggle this overlay</p>
                </div>
              </div>
              <button onClick={() => setOpen(false)} className="h-8 w-8 rounded-lg bg-white/15 hover:bg-white/25 flex items-center justify-center transition active:scale-90">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Shortcuts list */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {categories.map(cat => (
                <div key={cat}>
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">{cat}</h4>
                  <div className="space-y-1.5">
                    {SHORTCUTS.filter(s => s.category === cat).map(s => (
                      <div key={s.key} className="flex items-center justify-between py-1">
                        <span className="text-xs text-slate-600">{s.description}</span>
                        <kbd className="px-2 py-1 rounded-md bg-slate-100 border border-slate-200 text-[10px] font-mono font-bold text-slate-700 min-w-[32px] text-center">
                          {s.key}
                        </kbd>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="flex-shrink-0 px-5 py-3 border-t border-slate-200 bg-slate-50 text-center">
              <p className="text-[10px] text-slate-400 flex items-center justify-center gap-1">
                <Command className="h-3 w-3" /> SYLHN POS — Productivity at your fingertips
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
