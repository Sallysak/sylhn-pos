"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, X, AlertTriangle, Loader2, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ManagerApprovalProps {
  open: boolean;
  title: string;
  description: string;
  action: "void" | "refund" | "discount" | "delete";
  amount?: number;
  reason?: string;
  onApproved: (approver: { id: string; username: string; fullName: string; role: string }) => void;
  onClose: () => void;
}

/**
 * Premium: Manager Approval Modal
 *
 * Used when a cashier wants to perform a sensitive action (void > GHS 100,
 * refund, large discount, product deletion). Requires a manager or admin
 * to enter their credentials.
 *
 * The approval is verified server-side at POST /api/auth/approve, and the
 * audit log captures who approved what for whom.
 */
export function ManagerApproval({
  open, title, description, action, amount, reason, onApproved, onClose,
}: ManagerApprovalProps) {
  const { toast } = useToast();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;
    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/auth/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action, amount, reason, managerUsername: username, managerPassword: password }),
      });
      const data = await res.json();
      if (res.ok && data.approved) {
        toast({
          title: "Approved",
          description: `${data.approver.fullName} (${data.approver.role}) approved this action`,
        });
        // Reset and close
        setUsername("");
        setPassword("");
        onApproved(data.approver);
      } else {
        setError(data.error || "Approval denied");
      }
    } catch (e: any) {
      setError(e?.message || "Network error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setUsername("");
    setPassword("");
    setError("");
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleClose}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex items-center justify-center p-0 sm:p-4"
        >
          <motion.div
            initial={{ scale: 0.9, y: 30 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 30 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-amber-600 to-rose-600 text-white px-6 py-5">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Shield className="h-6 w-6" />
                  <h2 className="text-lg font-bold">Manager Approval Required</h2>
                </div>
                <button
                  onClick={handleClose}
                  className="h-8 w-8 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center transition"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="text-sm font-semibold">{title}</div>
              <div className="text-xs opacity-90 mt-1">{description}</div>
              {amount !== undefined && (
                <div className="mt-3 inline-flex items-center gap-1.5 bg-white/15 px-3 py-1.5 rounded-lg">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <span className="text-xs font-bold">Amount: GHS {Number(amount).toFixed(2)}</span>
                </div>
              )}
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                  Manager Username
                </label>
                <input
                  autoFocus
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. manager"
                  className="w-full h-11 px-4 rounded-xl bg-slate-50 border border-slate-200 text-sm font-semibold outline-none focus:ring-2 focus:ring-amber-400 focus:bg-white transition"
                  autoComplete="off"
                  disabled={submitting}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full h-11 pl-10 pr-4 rounded-xl bg-slate-50 border border-slate-200 text-sm font-semibold outline-none focus:ring-2 focus:ring-amber-400 focus:bg-white transition"
                    autoComplete="current-password"
                    disabled={submitting}
                  />
                </div>
              </div>

              {error && (
                <div className="bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 text-xs text-rose-700 font-medium">
                  {error}
                </div>
              )}

              <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-[11px] text-amber-800">
                <div className="font-semibold mb-0.5">Default manager credentials:</div>
                <div className="font-mono">manager / manager123</div>
                <div className="font-mono">admin / admin123</div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={submitting}
                  className="flex-1 h-11 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm transition disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !username || !password}
                  className="flex-1 h-11 rounded-xl bg-gradient-to-r from-amber-600 to-rose-600 text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50 transition"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    <>
                      <Shield className="h-4 w-4" />
                      Approve
                    </>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
