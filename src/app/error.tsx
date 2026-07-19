"use client";
import { useEffect } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import Link from "next/link";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    console.error("App error:", error);
  }, [error]);

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl ring-1 ring-slate-200 overflow-hidden">
        <div className="bg-gradient-to-r from-rose-500 to-red-500 text-white px-6 py-8 text-center">
          <div className="h-16 w-16 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-3">
            <AlertTriangle className="h-8 w-8" />
          </div>
          <h1 className="text-xl font-bold">Something went wrong</h1>
          <p className="text-xs opacity-90 mt-1">An unexpected error occurred</p>
        </div>
        <div className="p-6">
          <div className="bg-slate-50 rounded-xl p-3 mb-4 overflow-x-auto">
            <code className="text-[11px] text-rose-600 font-mono">{error?.message || "Unknown error"}</code>
          </div>
          <p className="text-sm text-slate-600 mb-5 text-center">
            Your data is safe. Try refreshing the page, or go back to the home screen.
          </p>
          <div className="flex gap-2 justify-center">
            <button onClick={reset} className="h-11 px-5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-sm font-bold flex items-center gap-2 hover:shadow-lg transition active:scale-95">
              <RefreshCw className="h-4 w-4" /> Try Again
            </button>
            <Link href="/" className="h-11 px-5 rounded-xl bg-slate-100 text-slate-700 text-sm font-bold flex items-center gap-2 hover:bg-slate-200 transition active:scale-95">
              <Home className="h-4 w-4" /> Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
