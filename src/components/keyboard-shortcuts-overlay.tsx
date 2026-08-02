"use client";

import { useState, useEffect } from "react";
import { Keyboard, X } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";

interface ShortcutGroup {
  title: string;
  shortcuts: { keys: string; description: string }[];
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: "Purchase Form",
    shortcuts: [
      { keys: "F2", description: "Save purchase" },
      { keys: "F3", description: "Print purchase order" },
      { keys: "F4", description: "Delete / cancel purchase" },
      { keys: "F5", description: "Record supplier payment" },
      { keys: "F7", description: "Open purchases list" },
      { keys: "F9", description: "Find part number" },
      { keys: "F10", description: "Edit line details" },
      { keys: "Shift + F12", description: "Print price labels" },
      { keys: "Esc", description: "Close any open popup" },
    ],
  },
  {
    title: "POS / Cart",
    shortcuts: [
      { keys: "F1", description: "Search products" },
      { keys: "F2", description: "Add to cart / checkout" },
      { keys: "F8", description: "Process payment" },
      { keys: "F12", description: "Hold order" },
    ],
  },
  {
    title: "Navigation",
    shortcuts: [
      { keys: "?",
        description: "Show this shortcuts overlay (works anywhere in the app)" },
      { keys: "Esc", description: "Close dialog / overlay" },
    ],
  },
];

export function KeyboardShortcutsOverlay() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Trigger on "?" (Shift + /) — but skip if user is typing in an input
      const target = e.target as HTMLElement;
      const isTyping = target && (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable
      );
      if (isTyping) return;

      if (e.key === "?" || (e.shiftKey && e.key === "/")) {
        e.preventDefault();
        setOpen(prev => !prev);
      } else if (e.key === "Escape" && open) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-2xl p-0 overflow-hidden">
        {/* Premium gradient header */}
        <div className="bg-gradient-to-br from-slate-800 via-slate-900 to-black text-white px-6 py-5 relative overflow-hidden">
          <div className="pointer-events-none absolute -top-12 -right-12 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
          <div className="relative z-10 flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-white/15 ring-1 ring-white/30 flex items-center justify-center backdrop-blur-sm">
              <Keyboard className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight">Keyboard Shortcuts</h2>
              <p className="text-[11px] opacity-85">Press <kbd className="px-1.5 py-0.5 bg-white/20 rounded text-[10px] font-mono">?</kbd> anywhere to toggle this overlay</p>
            </div>
          </div>
        </div>

        <div className="px-6 py-5 grid grid-cols-1 md:grid-cols-3 gap-5 max-h-[60vh] overflow-y-auto">
          {SHORTCUT_GROUPS.map(group => (
            <div key={group.title}>
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2 border-b border-slate-100 dark:border-slate-800 pb-1.5">
                {group.title}
              </h3>
              <ul className="space-y-1.5">
                {group.shortcuts.map((s, i) => (
                  <li key={i} className="flex items-center justify-between gap-2 text-sm">
                    <span className="text-slate-600 dark:text-slate-300">{s.description}</span>
                    <kbd className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[10px] font-mono font-bold shrink-0">
                      {s.keys}
                    </kbd>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="px-6 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 text-center text-[11px] text-slate-500">
          Tip: shortcuts work even when an input is focused — except <kbd className="px-1 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-[10px] font-mono">?</kbd>, <kbd className="px-1 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-[10px] font-mono">Esc</kbd>, and the F-keys.
        </div>
      </DialogContent>
    </Dialog>
  );
}
