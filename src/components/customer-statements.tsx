"use client";

import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, FileText, Loader2, Download, Search, Printer,
  Mail, Send, X, AlertCircle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { COMPANY, formatGHS } from "@/lib/pos-data";

// Placeholder component — built in next commit
export function CustomerStatements({ onBack }: { onBack: () => void }) {
  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-slate-50 to-violet-50/30">
      <header className="flex-shrink-0 bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 text-white shadow-lg">
        <div className="flex items-center justify-between px-4 sm:px-6 py-3">
          <div className="flex items-center gap-4 min-w-0">
            <button onClick={onBack} className="h-9 w-9 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition flex-shrink-0">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="h-9 w-9 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center ring-1 ring-white/20 flex-shrink-0">
                <FileText className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="font-bold text-base leading-tight">Customer Statements</div>
                <div className="text-[10px] text-violet-100/90 truncate">{COMPANY.name} · Monthly account statements for credit customers</div>
              </div>
            </div>
          </div>
        </div>
      </header>
      <main className="flex-1 overflow-hidden p-3 sm:p-6">
        <div className="h-full bg-white rounded-2xl shadow-lg ring-1 ring-slate-200/60 flex items-center justify-center">
          <div className="text-center">
            <FileText className="h-12 w-12 mx-auto mb-3 text-violet-400 opacity-60" />
            <p className="text-sm font-bold text-slate-700">Customer Statements module loaded</p>
            <p className="text-xs text-slate-400 mt-1">Coming in the next commit</p>
          </div>
        </div>
      </main>
    </div>
  );
}
