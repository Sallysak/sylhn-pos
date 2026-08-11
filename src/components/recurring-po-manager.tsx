"use client";

import { authedFetch } from "@/lib/client-auth";
import { useState, useEffect } from "react";
import { RefreshCw, Plus, Loader2, Trash2, Play, Calendar } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { formatGHS } from "@/lib/pos-data";

interface RecurringPO {
  id: string;
  name: string;
  supplierName: string;
  frequency: string;
  dayOfWeek: number | null;
  dayOfMonth: number | null;
  items: string;
  isActive: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
  runCount: number;
}

interface RecurringPOManagerProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  suppliers: any[];
  products: any[];
}

const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function RecurringPOManager({ open, onOpenChange, suppliers, products }: RecurringPOManagerProps) {
  const [loading, setLoading] = useState(false);
  const [rules, setRules] = useState<RecurringPO[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  // Form state
  const [form, setForm] = useState({
    name: "",
    supplierId: "",
    frequency: "weekly",
    dayOfWeek: 1,
    dayOfMonth: 1,
    items: [] as Array<{ productId: string; name: string; quantity: number; cost: number }>,
  });

  useEffect(() => {
    if (open) loadRules();
  }, [open]);

  const loadRules = async () => {
    setLoading(true);
    try {
      const res = await authedFetch("/api/recurring-pos");
      const data = await res.json();
      if (res.ok) setRules(data.rules || []);
    } catch {}
    setLoading(false);
  };

  const handleCreate = async () => {
    if (!form.name.trim()) { toast({ title: "Name is required", variant: "destructive" }); return; }
    if (form.items.length === 0) { toast({ title: "Add at least one item", variant: "destructive" }); return; }
    setSubmitting(true);
    try {
      const res = await authedFetch("/api/recurring-pos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: form.name,
          supplierId: form.supplierId || null,
          supplierName: suppliers.find(s => s.id === form.supplierId)?.name || "",
          frequency: form.frequency,
          dayOfWeek: form.frequency === "weekly" || form.frequency === "biweekly" ? form.dayOfWeek : null,
          dayOfMonth: form.frequency === "monthly" ? form.dayOfMonth : null,
          items: JSON.stringify(form.items),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast({ title: "Recurring PO created ✓", description: form.name });
        setShowForm(false);
        setForm({ name: "", supplierId: "", frequency: "weekly", dayOfWeek: 1, dayOfMonth: 1, items: [] });
        loadRules();
      } else throw new Error(data.error);
    } catch (e: any) {
      toast({ title: "Failed", description: e?.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this recurring PO rule?")) return;
    try {
      await authedFetch(`/api/recurring-pos/${id}`, { method: "DELETE", credentials: "include" });
      setRules(prev => prev.filter(r => r.id !== id));
      toast({ title: "Deleted" });
    } catch {}
  };

  const handleRunNow = async (id: string) => {
    try {
      const res = await authedFetch("/api/recurring-pos/run-due", { method: "POST", credentials: "include" });
      const data = await res.json();
      if (res.ok) {
        toast({ title: "Recurring POs processed", description: `${data.processed || 0} PO(s) created` });
        loadRules();
      }
    } catch {}
  };

  const addItem = () => {
    setForm({ ...form, items: [...form.items, { productId: "", name: "", quantity: 1, cost: 0 }] });
  };

  const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl p-0 overflow-hidden">
        <div className="bg-gradient-to-br from-teal-600 via-cyan-600 to-blue-600 text-white px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-white/20 ring-1 ring-white/30 flex items-center justify-center backdrop-blur-sm">
              <RefreshCw className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-bold tracking-tight">Recurring Purchase Orders</h2>
              <p className="text-[11px] opacity-85">Auto-generate POs on a schedule (weekly/monthly)</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => handleRunNow("all")} className="bg-white/20 border-white/30 text-white hover:bg-white/30">
              <Play className="h-3.5 w-3.5 mr-1" /> Run Due
            </Button>
          </div>
        </div>

        <div className="px-6 py-5 max-h-[65vh] overflow-y-auto">
          {loading ? (
            <div className="text-center py-8"><Loader2 className="h-8 w-8 animate-spin mx-auto mb-3 text-cyan-600" /><p className="text-sm text-slate-500">Loading...</p></div>
          ) : !showForm && rules.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <RefreshCw className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm font-semibold">No recurring POs yet</p>
              <p className="text-xs mt-1">Create a rule to auto-generate POs on a schedule.</p>
              <Button size="sm" className="mt-3 bg-cyan-600 hover:bg-cyan-700 text-white" onClick={() => setShowForm(true)}>
                <Plus className="h-4 w-4 mr-1" /> New Recurring PO
              </Button>
            </div>
          ) : showForm ? (
            <div className="space-y-4">
              <div>
                <Label className="text-[11px] font-bold uppercase text-slate-500 mb-1.5 block">Rule Name *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Weekly Milk Order" className="h-9 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-[11px] font-bold uppercase text-slate-500 mb-1.5 block">Supplier</Label>
                  <select value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })} className="h-9 w-full px-2 text-sm border border-slate-300 rounded bg-white">
                    <option value="">—</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <Label className="text-[11px] font-bold uppercase text-slate-500 mb-1.5 block">Frequency</Label>
                  <select value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })} className="h-9 w-full px-2 text-sm border border-slate-300 rounded bg-white">
                    <option value="weekly">Weekly</option>
                    <option value="biweekly">Bi-weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
              </div>
              {(form.frequency === "weekly" || form.frequency === "biweekly") && (
                <div>
                  <Label className="text-[11px] font-bold uppercase text-slate-500 mb-1.5 block">Day of Week</Label>
                  <div className="grid grid-cols-7 gap-1">
                    {DAYS.map((day, i) => (
                      <button key={i} onClick={() => setForm({ ...form, dayOfWeek: i })} className={cn("py-1.5 rounded-lg text-xs font-bold ring-2 transition", form.dayOfWeek === i ? "ring-cyan-500 bg-cyan-50 dark:bg-cyan-950/30 text-cyan-700" : "ring-slate-200 dark:ring-slate-700")}>{day}</button>
                    ))}
                  </div>
                </div>
              )}
              {form.frequency === "monthly" && (
                <div>
                  <Label className="text-[11px] font-bold uppercase text-slate-500 mb-1.5 block">Day of Month</Label>
                  <Input type="number" min={1} max={31} value={form.dayOfMonth} onChange={(e) => setForm({ ...form, dayOfMonth: parseInt(e.target.value) || 1 })} className="h-9 w-20 text-sm" />
                </div>
              )}
              {/* Items */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <Label className="text-[11px] font-bold uppercase text-slate-500">Items</Label>
                  <Button size="sm" variant="outline" onClick={addItem} className="h-7 text-xs"><Plus className="h-3 w-3 mr-1" /> Add Item</Button>
                </div>
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {form.items.map((item, i) => (
                    <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                      <select value={item.productId} onChange={(e) => { const p = products.find(p => p.id === e.target.value); const items = [...form.items]; items[i] = { ...item, productId: e.target.value, name: p?.name || "", cost: p?.costPrice || 0 }; setForm({ ...form, items }); }} className="h-8 flex-1 px-1.5 text-xs border border-slate-300 rounded bg-white">
                        <option value="">Select product...</option>
                        {products.slice(0, 100).map(p => <option key={p.id} value={p.id}>{p.emoji} {p.name}</option>)}
                      </select>
                      <Input type="number" min={1} value={item.quantity} onChange={(e) => { const items = [...form.items]; items[i] = { ...item, quantity: parseInt(e.target.value) || 1 }; setForm({ ...form, items }); }} className="h-8 w-16 text-xs text-center" />
                      <span className="text-xs font-mono text-slate-500 w-16 text-right">{formatGHS(item.cost * item.quantity)}</span>
                      <button onClick={() => setForm({ ...form, items: form.items.filter((_, j) => j !== i) })} className="h-6 w-6 rounded text-rose-600 hover:bg-rose-100"><Trash2 className="h-3 w-3 mx-auto" /></button>
                    </div>
                  ))}
                  {form.items.length === 0 && <div className="text-center py-3 text-slate-400 text-xs">No items yet. Click "Add Item".</div>}
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 h-10" onClick={() => setShowForm(false)}>Cancel</Button>
                <Button className="flex-1 h-10 bg-cyan-600 hover:bg-cyan-700 text-white" onClick={handleCreate} disabled={submitting}>{submitting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null} Create Rule</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {rules.map(rule => {
                const items = JSON.parse(rule.items || "[]");
                const totalCost = items.reduce((s: number, i: any) => s + (i.cost * i.quantity), 0);
                return (
                  <div key={rule.id} className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700">
                    <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0", rule.isActive ? "bg-cyan-100 dark:bg-cyan-950/40 text-cyan-600" : "bg-slate-200 text-slate-400")}>
                      <RefreshCw className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold truncate">{rule.name}</div>
                      <div className="text-[10px] text-slate-500 flex items-center gap-2">
                        <span>{rule.supplierName || "No supplier"}</span>
                        <span>· {rule.frequency}</span>
                        {rule.dayOfWeek !== null && <span>· {DAYS_OF_WEEK[rule.dayOfWeek]}</span>}
                        {rule.dayOfMonth !== null && <span>· day {rule.dayOfMonth}</span>}
                        <span>· {items.length} item(s)</span>
                        <span>· {formatGHS(totalCost)}</span>
                      </div>
                      {rule.nextRunAt && <div className="text-[9px] text-cyan-600">Next: {new Date(rule.nextRunAt).toLocaleDateString("en-GB")}</div>}
                    </div>
                    <Badge variant="outline" className="text-[9px] uppercase">{rule.isActive ? "Active" : "Paused"}</Badge>
                    <Badge variant="outline" className="text-[9px]">{rule.runCount} runs</Badge>
                    <button onClick={() => handleDelete(rule.id)} className="h-7 w-7 rounded text-rose-600 hover:bg-rose-100"><Trash2 className="h-3.5 w-3.5 mx-auto" /></button>
                  </div>
                );
              })}
              <Button size="sm" variant="outline" className="w-full mt-3" onClick={() => setShowForm(true)}>
                <Plus className="h-4 w-4 mr-1" /> New Recurring PO
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
