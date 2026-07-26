"use client";

import { useState, useEffect } from "react";
import { Package, CreditCard, Loader2, Phone, Mail, MapPin, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { formatGHS } from "@/lib/pos-data";
import { cn } from "@/lib/utils";

export default function SupplierPortalPage() {
  const [accessCode, setAccessCode] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [supplier, setSupplier] = useState<any>(null);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    if (!accessCode.trim()) return;
    setLoading(true);
    setError("");
    try {
      // The access code is the supplier's code (e.g. "00010")
      const res = await fetch(`/api/suppliers?search=${encodeURIComponent(accessCode)}&limit=1`, { credentials: "include" });
      const data = await res.json();
      if (res.ok && data.suppliers?.length > 0) {
        const s = data.suppliers[0];
        if (s.code === accessCode.trim()) {
          setSupplier(s);
          // Fetch their purchases + payments
          const [purRes, payRes] = await Promise.all([
            fetch(`/api/purchases?supplierId=${s.id}&limit=50`, { credentials: "include" }).then(r => r.json()).catch(() => ({ purchases: [] })),
            fetch(`/api/supplier-payments?supplierId=${s.id}&limit=50`, { credentials: "include" }).then(r => r.json()).catch(() => ({ payments: [] })),
          ]);
          setPurchases(purRes.purchases || []);
          setPayments(payRes.payments || []);
          setAuthenticated(true);
        } else {
          setError("Invalid access code");
        }
      } else {
        setError("Supplier not found");
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-8 max-w-md w-full">
          <div className="text-center mb-6">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center mx-auto mb-4">
              <Package className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-xl font-bold">SYLHN POS — Supplier Portal</h1>
            <p className="text-sm text-slate-500 mt-1">Enter your supplier code to view your purchase orders + payment status</p>
          </div>
          <Input
            value={accessCode}
            onChange={(e) => setAccessCode(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleLogin(); }}
            placeholder="Enter supplier code (e.g. 00010)"
            className="h-12 text-center text-lg font-mono font-bold mb-3"
            autoFocus
          />
          {error && <p className="text-rose-600 text-sm text-center mb-3">{error}</p>}
          <button
            onClick={handleLogin}
            disabled={loading || !accessCode.trim()}
            className="w-full h-12 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold disabled:opacity-50 transition"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : "Access Portal"}
          </button>
          <p className="text-[10px] text-slate-400 text-center mt-4">Contact SYLHN Company Ltd if you don't know your supplier code.</p>
        </div>
      </div>
    );
  }

  const totalOutstanding = purchases.reduce((s, p) => s + (Number(p.total) - Number(p.amountPaid)), 0);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold">{supplier.name}</h1>
            <p className="text-xs opacity-80">Code: {supplier.code} · Supplier Portal</p>
          </div>
          <Badge className="bg-white/20 text-white border-white/30">
            Outstanding: {formatGHS(totalOutstanding)}
          </Badge>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-6 space-y-6">
        {/* Supplier info */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow p-5">
          <h2 className="text-sm font-bold uppercase text-slate-500 mb-3">Supplier Details</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-slate-400" /> {supplier.phone || "—"}</div>
            <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-slate-400" /> {supplier.email || "—"}</div>
            <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-slate-400" /> {[supplier.address, supplier.city].filter(Boolean).join(", ") || "—"}</div>
            <div className="flex items-center gap-2"><Package className="h-4 w-4 text-slate-400" /> Terms: {supplier.tradingTerms || "—"}</div>
          </div>
        </div>

        {/* Purchase Orders */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-700">
            <h2 className="text-sm font-bold uppercase text-slate-500">Purchase Orders ({purchases.length})</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2 text-left">Ref No</th>
                  <th className="px-4 py-2 text-left">Date</th>
                  <th className="px-4 py-2 text-right">Total</th>
                  <th className="px-4 py-2 text-right">Paid</th>
                  <th className="px-4 py-2 text-right">Due</th>
                  <th className="px-4 py-2 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {purchases.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-6 text-slate-400">No purchase orders yet.</td></tr>
                ) : purchases.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                    <td className="px-4 py-2 font-mono font-semibold">{p.refNo}</td>
                    <td className="px-4 py-2 text-slate-600">{new Date(p.createdAt).toLocaleDateString("en-GB")}</td>
                    <td className="px-4 py-2 text-right font-mono">{formatGHS(Number(p.total))}</td>
                    <td className="px-4 py-2 text-right font-mono text-emerald-600">{formatGHS(Number(p.amountPaid))}</td>
                    <td className="px-4 py-2 text-right font-mono font-bold text-rose-600">{formatGHS(Number(p.total) - Number(p.amountPaid))}</td>
                    <td className="px-4 py-2 text-center">
                      <Badge variant="outline" className="text-[10px] uppercase">{p.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Payment History */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-700">
            <h2 className="text-sm font-bold uppercase text-slate-500">Payment History ({payments.length})</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2 text-left">Date</th>
                  <th className="px-4 py-2 text-right">Amount</th>
                  <th className="px-4 py-2 text-left">Method</th>
                  <th className="px-4 py-2 text-left">Reference</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {payments.length === 0 ? (
                  <tr><td colSpan={4} className="text-center py-6 text-slate-400">No payments recorded yet.</td></tr>
                ) : payments.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                    <td className="px-4 py-2 text-slate-600">{new Date(p.paymentDate).toLocaleDateString("en-GB")}</td>
                    <td className="px-4 py-2 text-right font-mono font-bold text-emerald-600">{formatGHS(Number(p.amount))}</td>
                    <td className="px-4 py-2 text-slate-600">{p.paymentMode}</td>
                    <td className="px-4 py-2 font-mono text-slate-500">{p.reference || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <button onClick={() => { setAuthenticated(false); setAccessCode(""); setSupplier(null); }} className="w-full h-10 rounded-lg bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-sm font-bold transition">
          Logout
        </button>
      </div>
    </div>
  );
}
