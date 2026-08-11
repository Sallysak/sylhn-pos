"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, CheckCircle2, ShoppingBag } from "lucide-react";

// Customer-Facing Display Page
// Visit: https://your-app.railway.app/customer-display?registerId=register-1
// Open this on a second monitor or a customer-facing tablet.

export default function CustomerDisplayPage() {
  const [state, setState] = useState<any>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    // Get registerId from URL query (default: register-1)
    const params = new URLSearchParams(window.location.search);
    const registerId = params.get("registerId") || "register-1";

    let pollInterval: any;

    const poll = async () => {
      try {
        const res = await fetch(`/api/customer-display?registerId=${registerId}`);
        if (res.ok) {
          const data = await res.json();
          setState(data);
          setConnected(true);
        } else {
          setConnected(false);
        }
      } catch {
        setConnected(false);
      }
    };

    poll(); // Initial fetch
    pollInterval = setInterval(poll, 1500); // Poll every 1.5s

    return () => clearInterval(pollInterval);
  }, []);

  const items = state?.items || [];
  const total = state?.total || 0;
  const subtotal = state?.subtotal || 0;
  const discount = state?.discount || 0;
  const tax = state?.tax || 0;
  const customerName = state?.customerName;
  const loyaltyPoints = state?.loyaltyPoints;
  const message = state?.message;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900 text-white flex flex-col overflow-hidden">
      {/* Top: Store brand + connection indicator */}
      <header className="flex-shrink-0 px-6 py-4 flex items-center justify-between border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center font-bold text-lg shadow-lg">
            S
          </div>
          <div>
            <div className="font-bold text-lg leading-tight">SYLHN POS</div>
            <div className="text-[11px] text-emerald-300/80 leading-tight">Thank you for shopping with us!</div>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[11px]">
          <span className={`h-2 w-2 rounded-full ${connected ? "bg-emerald-400 animate-pulse" : "bg-rose-400"}`} />
          <span className="opacity-70">{connected ? "Connected" : "Reconnecting..."}</span>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-hidden flex flex-col p-6">
        {/* Customer greeting */}
        {customerName && (
          <div className="mb-4 text-center">
            <div className="text-[11px] uppercase tracking-wider text-emerald-300/70 font-bold">Welcome</div>
            <div className="text-2xl font-bold">{customerName}</div>
          </div>
        )}

        {/* Items list (scrollable if many) */}
        <div className="flex-1 overflow-y-auto mb-4">
          {items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-emerald-300/40">
              <ShoppingBag className="h-20 w-20 mb-4 opacity-50" />
              <div className="text-lg font-semibold opacity-70">Ready when you are</div>
              <div className="text-xs mt-1">Items will appear here as they're scanned</div>
            </div>
          ) : (
            <div className="space-y-2">
              <AnimatePresence mode="popLayout">
                {items.map((item: any, i: number) => (
                  <motion.div
                    key={`${item.name}-${i}`}
                    layout
                    initial={{ opacity: 0, x: -30, scale: 0.95 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0, x: 30, scale: 0.95 }}
                    transition={{ type: "spring", damping: 25 }}
                    className="flex items-center gap-3 bg-white/5 backdrop-blur-sm rounded-2xl p-3 ring-1 ring-white/10"
                  >
                    <div className="h-12 w-12 rounded-xl bg-white/10 flex items-center justify-center text-2xl flex-shrink-0">
                      {item.emoji || "📦"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-base truncate">{item.name}</div>
                      <div className="text-xs text-emerald-300/70">
                        {item.quantity} × GHS {(item.price || 0).toFixed(2)}
                      </div>
                    </div>
                    <div className="font-bold text-lg tabular-nums">
                      GHS {(item.total || (item.quantity * item.price) || 0).toFixed(2)}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Totals */}
        {items.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex-shrink-0 bg-gradient-to-br from-emerald-600 to-teal-700 rounded-3xl p-5 shadow-2xl"
          >
            {discount > 0 && (
              <div className="flex justify-between text-sm opacity-90 mb-1">
                <span>Subtotal</span>
                <span className="tabular-nums">GHS {subtotal.toFixed(2)}</span>
              </div>
            )}
            {discount > 0 && (
              <div className="flex justify-between text-sm text-rose-200 mb-1">
                <span>Discount</span>
                <span className="tabular-nums">-GHS {discount.toFixed(2)}</span>
              </div>
            )}
            {tax > 0 && (
              <div className="flex justify-between text-sm opacity-90 mb-2">
                <span>Tax</span>
                <span className="tabular-nums">GHS {tax.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between items-end pt-2 border-t border-white/20">
              <div className="text-xs uppercase tracking-wider opacity-90 font-bold">Total Due</div>
              <motion.div
                key={total}
                initial={{ scale: 1.2, color: "#fde68a" }}
                animate={{ scale: 1, color: "#ffffff" }}
                className="text-4xl font-bold tabular-nums"
              >
                GHS {total.toFixed(2)}
              </motion.div>
            </div>
            {loyaltyPoints !== undefined && loyaltyPoints > 0 && (
              <div className="mt-3 pt-3 border-t border-white/20 flex items-center gap-2 text-sm">
                <Sparkles className="h-4 w-4 text-yellow-300" />
                <span className="text-yellow-100">Loyalty points: <strong>{loyaltyPoints}</strong></span>
              </div>
            )}
          </motion.div>
        )}

        {/* Special message (e.g., "Thank you!" after payment) */}
        <AnimatePresence>
          {message && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="fixed inset-0 flex items-center justify-center bg-emerald-600/95 backdrop-blur-md"
            >
              <div className="text-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", delay: 0.1 }}
                  className="h-24 w-24 rounded-full bg-white/20 mx-auto flex items-center justify-center mb-4"
                >
                  <CheckCircle2 className="h-14 w-14" />
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="text-4xl font-bold mb-2"
                >
                  {message}
                </motion.div>
                <div className="text-emerald-100">See you again soon!</div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
