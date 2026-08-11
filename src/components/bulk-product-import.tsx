"use client";

import { useState, useRef } from "react";
import { authedFetch } from "@/lib/client-auth";
import { Upload, Loader2, CheckCircle2, AlertTriangle, Download } from "lucide-react";
import { authedFetch } from "@/lib/client-auth";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { authedFetch } from "@/lib/client-auth";
import { Badge } from "@/components/ui/badge";
import { authedFetch } from "@/lib/client-auth";
import { useToast } from "@/hooks/use-toast";
import { authedFetch } from "@/lib/client-auth";
import { cn } from "@/lib/utils";
import { authedFetch } from "@/lib/client-auth";

interface BulkProductImportProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onImported?: () => void;
}

export function BulkProductImport({ open, onOpenChange, onImported }: BulkProductImportProps) {
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<{ success: number; failed: number; errors: string[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".csv")) {
      toast({ title: "Please select a CSV file", variant: "destructive" });
      return;
    }

    setImporting(true);
    setResults(null);
    try {
      const text = await file.text();
      const lines = text.split("\n").filter(l => l.trim());
      if (lines.length < 2) {
        toast({ title: "CSV is empty or has no data rows", variant: "destructive" });
        setImporting(false);
        return;
      }

      // Parse header
      const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
      const nameIdx = headers.indexOf("name");
      const skuIdx = headers.indexOf("sku");
      const priceIdx = headers.indexOf("price");
      const costIdx = headers.indexOf("cost");
      const qtyIdx = headers.indexOf("quantity");
      const barcodeIdx = headers.indexOf("barcode");
      const categoryIdx = headers.indexOf("category");
      const emojiIdx = headers.indexOf("emoji");

      if (nameIdx === -1) {
        toast({ title: "CSV must have a 'name' column", variant: "destructive" });
        setImporting(false);
        return;
      }

      let success = 0;
      let failed = 0;
      const errors: string[] = [];

      // Process each row
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(",").map(c => c.trim().replace(/^"|"$/g, ""));
        const name = cols[nameIdx];
        if (!name) { failed++; errors.push(`Row ${i + 1}: Missing name`); continue; }

        const productData: any = {
          name,
          sku: skuIdx >= 0 ? cols[skuIdx] : `SKU-${Date.now()}-${i}`,
          price: priceIdx >= 0 ? parseFloat(cols[priceIdx]) || 0 : 0,
          costPrice: costIdx >= 0 ? parseFloat(cols[costIdx]) || 0 : 0,
          quantity: qtyIdx >= 0 ? parseInt(cols[qtyIdx]) || 0 : 0,
          barcode: barcodeIdx >= 0 ? cols[barcodeIdx] : "",
          category: categoryIdx >= 0 ? cols[categoryIdx] : "other",
          emoji: emojiIdx >= 0 ? cols[emojiIdx] : "📦",
          unit: "each",
          reorderLevel: 5,
          taxable: true,
          active: true,
        };

        try {
          const res = await authedFetch("/api/products", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(productData),
          });
          if (res.ok) success++;
          else { failed++; const data = await res.json().catch(() => ({})); errors.push(`Row ${i + 1} (${name}): ${data.error || "Failed"}`); }
        } catch {
          failed++; errors.push(`Row ${i + 1} (${name}): Network error`);
        }
      }

      setResults({ success, failed, errors });
      if (success > 0) {
        toast({ title: `Imported ${success} products ✓`, description: failed > 0 ? `${failed} failed` : "All succeeded" });
        onImported?.();
      }
    } catch (e: any) {
      toast({ title: "Import failed", description: e?.message, variant: "destructive" });
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const downloadTemplate = () => {
    const csv = "name,sku,price,cost,quantity,barcode,category,emoji\nRed Apples,FR-001,5.00,3.50,50,1234567890123,Fresh Produce,🍎\nBananas,FR-002,2.00,1.10,30,2345678901234,Fresh Produce,🍌\n";
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "product-import-template.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg p-0 overflow-hidden">
        <div className="bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-600 text-white px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-white/20 ring-1 ring-white/30 flex items-center justify-center backdrop-blur-sm">
              <Upload className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight">Bulk Product Import</h2>
              <p className="text-[11px] opacity-85">Upload a CSV file to add multiple products at once</p>
            </div>
          </div>
        </div>

        <div className="px-6 py-5 space-y-4">
          <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} className="hidden" />
          <Button
            variant="outline"
            className="w-full h-20 border-dashed text-sm flex flex-col items-center justify-center gap-1"
            onClick={() => fileRef.current?.click()}
            disabled={importing}
          >
            {importing ? (
              <><Loader2 className="h-6 w-6 animate-spin mb-1" /> Importing products...</>
            ) : (
              <><Upload className="h-6 w-6 mb-1" /> Click to select a CSV file</>
            )}
          </Button>

          <div className="text-[11px] text-slate-500 bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3 space-y-1">
            <div className="font-bold text-slate-600 mb-1">CSV format (columns):</div>
            <div className="font-mono text-[10px]">name, sku, price, cost, quantity, barcode, category, emoji</div>
            <div className="mt-2">• <strong>name</strong> (required) — product name</div>
            <div>• <strong>sku</strong> — unique SKU (auto-generated if empty)</div>
            <div>• <strong>price</strong> — selling price in GHS</div>
            <div>• <strong>cost</strong> — cost price in GHS</div>
            <div>• <strong>quantity</strong> — opening stock quantity</div>
            <div>• <strong>barcode</strong> — product barcode</div>
            <div>• <strong>category</strong> — category name</div>
            <div>• <strong>emoji</strong> — emoji icon (e.g. 🍎)</div>
          </div>

          <Button size="sm" variant="ghost" onClick={downloadTemplate} className="w-full text-xs">
            <Download className="h-3.5 w-3.5 mr-1" /> Download CSV Template
          </Button>

          {results && (
            <div className="space-y-2">
              <div className="flex gap-2">
                <Badge className="bg-emerald-100 text-emerald-700">✓ {results.success} imported</Badge>
                {results.failed > 0 && <Badge className="bg-rose-100 text-rose-700">✗ {results.failed} failed</Badge>}
              </div>
              {results.errors.length > 0 && (
                <div className="max-h-32 overflow-y-auto space-y-1 border border-slate-200 dark:border-slate-700 rounded-lg p-2">
                  {results.errors.slice(0, 20).map((err, i) => (
                    <div key={i} className="text-[10px] text-rose-600 flex items-start gap-1">
                      <AlertTriangle className="h-2.5 w-2.5 mt-0.5 shrink-0" /> {err}
                    </div>
                  ))}
                  {results.errors.length > 20 && <div className="text-[10px] text-slate-400">...and {results.errors.length - 20} more</div>}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <Button variant="outline" className="w-full h-11" onClick={() => onOpenChange(false)}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
