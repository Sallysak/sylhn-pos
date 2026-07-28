"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  X, Save, Loader2, Star, Ban, Shield, AlertTriangle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface Supplier {
  id: string;
  name: string;
  code: string;
  rating?: number;
  blacklist?: boolean;
  blacklistReason?: string;
  tin?: string;
  mobileMoneyProvider?: string;
  mobileMoneyNumber?: string;
  earlyPayDiscountPct?: number;
  earlyPayDays?: number;
  netDays?: number;
}

interface Props {
  suppliers: Supplier[];      // the selected suppliers to edit
  onClose: () => void;
  onSaved: () => void;
}

export function SupplierBulkEditDialog({ suppliers, onClose, onSaved }: Props) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  // Each field has a "toggle to enable" checkbox + value input.
  // Only enabled fields are sent in the bulk update.
  const [enabled, setEnabled] = useState<Record<string, boolean>>({
    rating: false, blacklist: false, blacklistReason: false, tin: false,
    earlyPayDiscountPct: false, earlyPayDays: false, netDays: false,
    mobileMoneyProvider: false, mobileMoneyNumber: false,
  });
  const [values, setValues] = useState<Record<string, any>>({
    rating: 0, blacklist: false, blacklistReason: "", tin: "",
    earlyPayDiscountPct: 0, earlyPayDays: 0, netDays: 30,
    mobileMoneyProvider: "", mobileMoneyNumber: "",
  });

  const toggle = (field: string) => setEnabled(s => ({ ...s, [field]: !s[field] }));
  const setVal = (field: string, val: any) => setValues(s => ({ ...s, [field]: val }));

  const handleSave = async () => {
    const updates: any = { supplierIds: suppliers.map(s => s.id) };
    Object.entries(enabled).forEach(([field, isOn]) => {
      if (isOn) updates[field] = values[field];
    });
    const updateCount = Object.values(enabled).filter(Boolean).length;
    if (updateCount === 0) {
      toast({ title: "No fields selected", description: "Tick at least one field to update", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/suppliers/bulk-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      toast({
        title: `Bulk updated ${data.updatedCount} supplier(s)`,
        description: `Fields changed: ${data.fieldsUpdated.join(", ")}`,
      });
      onSaved();
      onClose();
    } catch (e: any) {
      toast({ title: "Bulk update failed", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const enabledCount = Object.values(enabled).filter(Boolean).length;

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex-shrink-0 px-5 py-3 bg-gradient-to-r from-violet-600 to-indigo-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            <div>
              <h3 className="font-bold text-sm">Bulk Edit Suppliers</h3>
              <p className="text-[10px] text-violet-100">{suppliers.length} supplier(s) selected</p>
            </div>
          </div>
          <button onClick={onClose} className="h-7 w-7 rounded-lg bg-white/15 hover:bg-white/25 flex items-center justify-center">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-2">
          {/* Selected suppliers preview */}
          <div className="bg-slate-50 ring-1 ring-slate-200 rounded-lg p-2 max-h-24 overflow-y-auto">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Selected Suppliers</div>
            <div className="flex flex-wrap gap-1">
              {suppliers.slice(0, 10).map(s => (
                <span key={s.id} className="px-1.5 py-0.5 rounded bg-white ring-1 ring-slate-200 text-[10px] font-semibold text-slate-700">
                  {s.name}
                </span>
              ))}
              {suppliers.length > 10 && <span className="px-1.5 py-0.5 text-[10px] text-slate-500">+{suppliers.length - 10} more</span>}
            </div>
          </div>

          <div className="text-[10px] text-slate-500 bg-amber-50 ring-1 ring-amber-200 rounded p-2">
            💡 Tick the checkbox next to each field you want to update. Only ticked fields will be changed — other fields on the selected suppliers stay untouched.
          </div>

          {/* Rating */}
          <BulkRow
            label="Rating (1-5 stars)"
            icon={<Star className="h-3.5 w-3.5 text-amber-500" />}
            enabled={enabled.rating}
            onToggle={() => toggle("rating")}
          >
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map(i => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setVal("rating", values.rating === i ? 0 : i)}
                  className="text-lg leading-none hover:scale-110 transition"
                >
                  <span className={i <= (values.rating || 0) ? "text-amber-400" : "text-slate-300"}>★</span>
                </button>
              ))}
              <span className="text-[10px] text-slate-500 ml-2">{values.rating ? `${values.rating}/5` : "Unrated"}</span>
            </div>
          </BulkRow>

          {/* Blacklist */}
          <BulkRow
            label="Blacklist"
            icon={<Ban className="h-3.5 w-3.5 text-rose-500" />}
            enabled={enabled.blacklist}
            onToggle={() => toggle("blacklist")}
          >
            <label className="flex items-center gap-2 text-[11px] text-rose-900 font-semibold cursor-pointer">
              <input
                type="checkbox"
                checked={!!values.blacklist}
                onChange={(e) => setVal("blacklist", e.target.checked)}
                className="h-3.5 w-3.5 accent-rose-600"
              />
              ⚠️ Blacklist all selected suppliers
            </label>
          </BulkRow>

          {/* Blacklist reason (only shown if blacklist is enabled) */}
          {enabled.blacklist && values.blacklist && (
            <BulkRow
              label="Blacklist Reason"
              icon={<AlertTriangle className="h-3.5 w-3.5 text-rose-500" />}
              enabled={enabled.blacklistReason}
              onToggle={() => toggle("blacklistReason")}
            >
              <input
                value={values.blacklistReason}
                onChange={(e) => setVal("blacklistReason", e.target.value)}
                placeholder="e.g. 'Consistent late deliveries'"
                className="w-full h-7 px-2 text-[10px] border border-rose-300 rounded outline-none focus:ring-1 focus:ring-rose-400 bg-white"
              />
            </BulkRow>
          )}

          {/* TIN */}
          <BulkRow
            label="TIN (Tax ID)"
            icon={<Shield className="h-3.5 w-3.5 text-blue-500" />}
            enabled={enabled.tin}
            onToggle={() => toggle("tin")}
          >
            <input
              value={values.tin}
              onChange={(e) => setVal("tin", e.target.value.toUpperCase())}
              placeholder="C0001234567"
              className="w-full h-7 px-2 text-[10px] font-mono border border-slate-300 rounded outline-none focus:ring-1 focus:ring-blue-400"
            />
          </BulkRow>

          {/* Early-pay discount */}
          <BulkRow
            label="Early-Pay Discount %"
            icon={<Star className="h-3.5 w-3.5 text-amber-500" />}
            enabled={enabled.earlyPayDiscountPct}
            onToggle={() => toggle("earlyPayDiscountPct")}
          >
            <input
              type="number" step="0.1" min="0" max="100"
              value={values.earlyPayDiscountPct}
              onChange={(e) => setVal("earlyPayDiscountPct", parseFloat(e.target.value) || 0)}
              placeholder="2"
              className="w-full h-7 px-2 text-[10px] font-mono border border-slate-300 rounded outline-none focus:ring-1 focus:ring-blue-400"
            />
          </BulkRow>

          {/* Net days */}
          <BulkRow
            label="Net Days (full payment due)"
            icon={<Star className="h-3.5 w-3.5 text-amber-500" />}
            enabled={enabled.netDays}
            onToggle={() => toggle("netDays")}
          >
            <input
              type="number" min="0" max="365"
              value={values.netDays}
              onChange={(e) => setVal("netDays", parseInt(e.target.value) || 30)}
              placeholder="30"
              className="w-full h-7 px-2 text-[10px] font-mono border border-slate-300 rounded outline-none focus:ring-1 focus:ring-blue-400"
            />
          </BulkRow>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 p-4 border-t border-slate-200 flex items-center justify-between gap-2 bg-slate-50">
          <span className="text-[10px] text-slate-500">
            {enabledCount > 0
              ? `${enabledCount} field(s) will be updated on ${suppliers.length} supplier(s)`
              : "No fields selected yet"}
          </span>
          <div className="flex gap-2">
            <button onClick={onClose} className="h-9 px-4 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold">Cancel</button>
            <button
              onClick={handleSave}
              disabled={saving || enabledCount === 0}
              className="h-9 px-4 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white text-xs font-bold disabled:opacity-50 flex items-center gap-1.5"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Update {suppliers.length} Supplier(s)
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function BulkRow({ label, icon, enabled, onToggle, children }: {
  label: string;
  icon: React.ReactNode;
  enabled: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className={cn(
      "rounded-lg ring-1 p-2 transition",
      enabled ? "bg-violet-50 ring-violet-200" : "bg-slate-50 ring-slate-200 opacity-70"
    )}>
      <div className="flex items-center gap-2 mb-1">
        <input
          type="checkbox"
          checked={enabled}
          onChange={onToggle}
          className="h-3.5 w-3.5 accent-violet-600"
        />
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1">
          {icon} {label}
        </span>
      </div>
      {enabled && <div className="ml-6">{children}</div>}
    </div>
  );
}
