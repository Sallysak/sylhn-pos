"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, ScanLine, Printer, X, Plus,
} from "lucide-react";

interface SpeedDialAction {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  color: string;        // gradient classes e.g. "from-violet-600 to-indigo-600"
  onClick: () => void;
}

interface SpeedDialProps {
  actions: SpeedDialAction[];
}

/**
 * Premium: Expandable FAB (Speed Dial)
 *
 * A single floating button that expands into multiple labeled actions when tapped.
 * Inspired by Material Design's Speed Dial pattern (used by Gmail, Google Maps).
 *
 * Features:
 * - One clean button at rest (no clutter)
 * - Taps to expand → shows all actions with labels in a fan/stack
 * - Tap any action to execute + close
 * - Tap outside or X to close
 * - Backdrop overlay when expanded (dims the POS behind it)
 * - Smooth spring animations
 * - Safe-area aware (sits above bottom nav on mobile)
 */
export function SpeedDial({ actions }: SpeedDialProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [open]);

  const handleAction = (action: SpeedDialAction) => {
    action.onClick();
    setOpen(false);
  };

  return (
    <>
      {/* Liquid glass backdrop when expanded — premium blurry effect */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
            animate={{ opacity: 1, backdropFilter: "blur(16px)" }}
            exit={{ opacity: 0, backdropFilter: "blur(0px)" }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-40"
            style={{
              background: "rgba(15, 23, 42, 0.25)",
              backdropFilter: "blur(16px) saturate(180%)",
              WebkitBackdropFilter: "blur(16px) saturate(180%)",
            }}
            onClick={() => setOpen(false)}
          >
            {/* Liquid glass decorative blobs */}
            <div className="absolute -top-20 -left-20 h-72 w-72 rounded-full bg-emerald-400/20 blur-3xl" />
            <div className="absolute top-1/3 -right-20 h-80 w-80 rounded-full bg-violet-400/15 blur-3xl" />
            <div className="absolute -bottom-20 left-1/4 h-72 w-72 rounded-full bg-blue-400/15 blur-3xl" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Speed Dial container */}
      <div
        ref={containerRef}
        className="fixed flex flex-col items-start gap-2.5"
        style={{
          bottom: "calc(80px + env(safe-area-inset-bottom, 0px))",
          left: "16px",
          zIndex: 45,
        }}
      >
        {/* Expanded actions (reverse order so first action is on top) */}
        <AnimatePresence>
          {open && (
            <>
              {actions.map((action, i) => {
                const Icon = action.icon;
                return (
                  <motion.div
                    key={action.id}
                    initial={{ opacity: 0, scale: 0, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0, y: 20 }}
                    transition={{
                      type: "spring",
                      stiffness: 400,
                      damping: 25,
                      delay: i * 0.04,
                    }}
                    className="flex items-center gap-2.5"
                  >
                    {/* Action button — premium (on left, label on right) */}
                    <button
                      onClick={() => handleAction(action)}
                      className={`btn-premium h-12 w-12 rounded-full bg-gradient-to-br ${action.color} text-white flex items-center justify-center transition active:scale-90 hover:scale-105 ring-1 ring-white/30`}
                      title={action.label}
                    >
                      <Icon className="h-5 w-5" />
                    </button>
                    {/* Label — liquid glass pill */}
                    <div className="bg-white/20 backdrop-blur-xl text-white text-xs font-semibold px-3 py-1.5 rounded-lg whitespace-nowrap ring-1 ring-white/30 shadow-lg">
                      {action.label}
                    </div>
                  </motion.div>
                );
              })}
            </>
          )}
        </AnimatePresence>

        {/* Main FAB button — premium gradient with glow */}
        <motion.button
          onClick={() => setOpen(!open)}
          whileTap={{ scale: 0.9 }}
          animate={{ rotate: open ? 135 : 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          className={`btn-premium h-14 w-14 rounded-full flex items-center justify-center transition-colors ring-1 ring-white/30 ${
            open
              ? "bg-slate-700 text-white shadow-premium-lg"
              : "gradient-premium-emerald text-white shadow-glow-emerald"
          }`}
          title={open ? "Close menu" : "Quick actions"}
          aria-label={open ? "Close menu" : "Open quick actions"}
        >
          {open ? (
            <X className="h-6 w-6" />
          ) : (
            <Plus className="h-6 w-6" />
          )}
        </motion.button>
      </div>
    </>
  );
}
