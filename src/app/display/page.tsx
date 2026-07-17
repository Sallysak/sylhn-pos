"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShoppingBag, Sparkles } from "lucide-react";

/**
 * Customer-facing display — open on a second monitor / tablet at /display
 *
 * Polls /api/customer-display every 1.5s for the current cart state.
 * Shows: items being scanned, running subtotal, total, loyalty points,
 * and a welcome message when idle.
 *
 * The cashier's POS automatically updates this display via POST whenever
 * the cart changes (see page.tsx completePayment + addToCart integration).
 */
export default function CustomerDisplay() {
  const [state, setState] = useState<any>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch("/api/customer-display?registerId=register-1", { credentials: "include" });
        if (!res.ok) {
          setConnected(false);
          return;
        }
        const data = await res.json();
        if (!cancelled) {
          setState(data);
          setConnected(true);
        }
      } catch {
        if (!cancelled) setConnected(false);
      }
    };
    poll();
    const interval = setInterval(poll, 1500);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  const items = state?.items || [];
  const subtotal = state?.subtotal || 0;
  const discount = state?.discount || 0;
  const tax = state?.tax || 0;
  const total = state?.total || 0;
  const customerName = state?.customerName;
  const loyaltyPoints = state?.loyaltyPoints;
  const message = state?.message;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900 text-white flex flex-col">
      {/* Top bar */}
      <div className="flex-shrink-0 flex items-center justify-between px-8 py-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center font-bold text-xl shadow-lg">
            S
          </div>
          <div>
            <div className="font-bold text-xl tracking-tight">SYLHN COMPANY LTD</div>
            <div className="text-xs text-emerald-300/80">Your Trusted Grocery Partner</div>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <div className={`h-2 w-2 rounded-full ${connected ? "bg-emerald-400 animate-pulse" : "bg-rose-500"}`} />
          <span className="text-slate-400">{connected ? "Connected" : "Reconnecting..."}</span>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col px-8 py-6 overflow-hidden">
        {items.length === 0 ? (
          // Welcome screen
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5 }}
              className="mb-6"
            >
              <ShoppingBag className="h-24 w-24 text-emerald-400 mx-auto" strokeWidth={1.2} />
            </motion.div>
            <motion.h1
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-4xl font-bold mb-2"
            >
              Welcome!
            </motion.h1>
            <p className="text-emerald-300/80 text-lg">
              {message || "Bring your items to the counter to begin"}
            </p>
            {loyaltyPoints !== undefined && loyaltyPoints > 0 && (
              <div className="mt-6 inline-flex items-center gap-2 bg-emerald-500/15 backdrop-blur px-4 py-2 rounded-full ring-1 ring-emerald-400/30">
                <Sparkles className="h-4 w-4 text-emerald-300" />
                <span className="text-sm">You have <strong className="text-emerald-300">{loyaltyPoints} loyalty points</strong></span>
              </div>
            )}
          </div>
        ) : (
          // Cart display
          <div className="flex-1 flex flex-col overflow-hidden">
            {customerName && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-4 text-center"
              >
                <span className="text-emerald-300 text-sm">Welcome back,</span>{" "}
                <span className="font-bold text-lg">{customerName}</span>
              </motion.div>
            )}

            {/* Items list */}
            <div className="flex-1 overflow-y-auto mb-4 space-y-2">
              <AnimatePresence initial={false}>
                {items.map((item: any, i: number) => (
                  <motion.div
                    key={`${item.name}-${i}`}
                    initial={{ opacity: 0, x: -30 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 30 }}
                    transition={{ duration: 0.25 }}
                    className="flex items-center gap-4 bg-white/5 backdrop-blur rounded-2xl p-4 ring-1 ring-white/10"
                  >
                    <div className="text-3xl">{item.emoji}</div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-lg truncate">{item.name}</div>
                      <div className="text-sm text-slate-400">
                        {item.quantity} × ₵{item.price.toFixed(2)}
                      </div>
                    </div>
                    <div className="text-2xl font-bold font-mono text-emerald-300">
                      ₵{item.total.toFixed(2)}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {/* Totals */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex-shrink-0 bg-gradient-to-br from-emerald-600/20 to-teal-600/20 backdrop-blur rounded-3xl p-6 ring-1 ring-emerald-400/30"
            >
              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-slate-300 text-sm">
                  <span>Subtotal</span>
                  <span className="font-mono">₵{subtotal.toFixed(2)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-rose-300 text-sm">
                    <span>Discount</span>
                    <span className="font-mono">-₵{discount.toFixed(2)}</span>
                  </div>
                )}
                {tax > 0 && (
                  <div className="flex justify-between text-slate-300 text-sm">
                    <span>VAT</span>
                    <span className="font-mono">₵{tax.toFixed(2)}</span>
                  </div>
                )}
              </div>
              <div className="flex justify-between items-end pt-4 border-t border-white/10">
                <span className="text-xl font-semibold text-slate-200">Total</span>
                <motion.span
                  key={total}
                  initial={{ scale: 1.2 }}
                  animate={{ scale: 1 }}
                  className="text-5xl font-bold font-mono text-emerald-300"
                >
                  ₵{total.toFixed(2)}
                </motion.span>
              </div>
            </motion.div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 px-8 py-3 text-center text-xs text-slate-500 border-t border-white/5">
        Thank you for shopping with us · Returns within 7 days with receipt
      </div>
    </div>
  );
}
