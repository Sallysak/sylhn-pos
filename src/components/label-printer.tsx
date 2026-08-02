"use client";

import { useState } from "react";
import { Printer, Package, Loader2, Tag, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { formatGHS, type Product } from "@/lib/pos-data";
import { generateCode128Barcode, formatBarcodeText } from "@/lib/barcode-generator";

interface LabelPrinterProps {
  products: Product[];
  onClose?: () => void;
}

const LABEL_SIZES = [
  { value: "30x20", label: "30×20mm", desc: "Small shelf", width: "30mm", height: "20mm" },
  { value: "40x30", label: "40×30mm", desc: "Medium shelf", width: "40mm", height: "30mm" },
  { value: "50x30", label: "50×30mm", desc: "Large shelf", width: "50mm", height: "30mm" },
  { value: "70x40", label: "70×40mm", desc: "Price tag", width: "70mm", height: "40mm" },
];

export function LabelPrinter({ products, onClose }: LabelPrinterProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [labelSize, setLabelSize] = useState(LABEL_SIZES[1]);
  const [search, setSearch] = useState("");
  const [printing, setPrinting] = useState(false);
  const { toast } = useToast();

  const filtered = products.filter(p =>
    !search || p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.sku.toLowerCase().includes(search.toLowerCase()) || (p.barcode || "").includes(search)
  );
  const toggleProduct = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  };
  const selectAll = () => setSelectedIds(new Set(filtered.map(p => p.id)));
  const selectNone = () => setSelectedIds(new Set());
  const selectedProducts = products.filter(p => selectedIds.has(p.id));

  const handlePrint = () => {
    if (selectedProducts.length === 0) { toast({ title: "Select at least one product", variant: "destructive" }); return; }
    setPrinting(true);
    const size = labelSize;
    const labelsHtml = selectedProducts.map(p => {
      const barcodeData = (p.sku || p.barcode || p.id.slice(-12)).replace(/[^a-zA-Z0-9]/g, "");
      const barcodeBars = generateCode128Barcode(barcodeData, 8, 0.18);
      const nameMaxLen = size.value === "30x20" ? 18 : size.value === "40x30" ? 25 : 35;
      const displayName = p.name.length > nameMaxLen ? p.name.slice(0, nameMaxLen) + "…" : p.name;
      return `<div class="label" style="width:${size.width};height:${size.height};"><div class="label-name">${p.emoji || ""} ${escapeHtml(displayName)}</div><div class="label-price">${formatGHS(p.price)}</div><div class="label-barcode">${barcodeBars}<div class="barcode-text">${formatBarcodeText(barcodeData)}</div></div><div class="label-sku">SKU: ${p.sku}</div></div>`;
    }).join("");
    const html = `<!DOCTYPE html><html><head><title>Print Labels — ${selectedProducts.length} items</title><style>@page { size: ${size.width} ${size.height}; margin: 0; } * { margin:0; padding:0; box-sizing:border-box; } body { font-family: Arial, sans-serif; display: flex; flex-wrap: wrap; } .label { width:${size.width}; height:${size.height}; padding:1mm; display:flex; flex-direction:column; justify-content:space-between; overflow:hidden; page-break-after:always; border:0.5px dashed #ccc; } .label-name { font-size:7pt; font-weight:bold; line-height:1.1; overflow:hidden; } .label-price { font-size:${size.value === "30x20" ? "11pt" : "14pt"}; font-weight:bold; text-align:center; } .label-barcode { text-align:center; } .barcode-text { font-size:6pt; font-family:monospace; letter-spacing:1px; margin-top:0.5mm; } .label-sku { font-size:5pt; color:#666; text-align:center; } @media print { .label { border:none; } }</style></head><body>${labelsHtml}</body></html>`;
    const printWin = window.open("", "_blank", "width=800,height=600");
    if (!printWin) { toast({ title: "Popup blocked", description: "Allow popups to print labels", variant: "destructive" }); setPrinting(false); return; }
    printWin.document.write(html);
    printWin.document.close();
    setTimeout(() => { printWin.focus(); printWin.print(); setPrinting(false); toast({ title: "Labels sent to printer ✓", description: `${selectedProducts.length} label(s) — Code 128 barcode, scannable` }); }, 300);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2"><Tag className="h-5 w-5 text-violet-600" /><h2 className="text-lg font-bold">Label Printer</h2><Badge variant="outline">{selectedIds.size} selected</Badge></div>
        <div className="flex gap-2"><Button size="sm" variant="outline" onClick={selectAll}>Select All</Button><Button size="sm" variant="outline" onClick={selectNone}>Clear</Button><Button size="sm" onClick={handlePrint} disabled={printing || selectedIds.size === 0} className="bg-violet-600 hover:bg-violet-700 text-white">{printing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Printer className="h-4 w-4 mr-1" />}Print {selectedIds.size > 0 ? `(${selectedIds.size})` : ""}</Button></div>
      </div>
      <div><Label className="text-xs font-bold mb-1.5 block">Label Size</Label><div className="grid grid-cols-4 gap-2">{LABEL_SIZES.map(size => (<button key={size.value} onClick={() => setLabelSize(size)} className={cn("p-2 rounded-lg ring-2 transition text-center", labelSize.value === size.value ? "ring-violet-500 bg-violet-50 dark:bg-violet-950/30" : "ring-slate-200 dark:ring-slate-700 hover:ring-slate-300")}><div className="text-xs font-bold">{size.label}</div><div className="text-[10px] text-slate-500">{size.desc}</div></button>))}</div></div>
      <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" /><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search products by name, SKU, or barcode..." className="h-9 pl-9" /></div>
      <div className="max-h-80 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-lg">{filtered.length === 0 ? (<div className="text-center py-8 text-slate-400"><Package className="h-8 w-8 mx-auto mb-2 opacity-30" />No products found</div>) : (<div className="divide-y divide-slate-100 dark:divide-slate-800">{filtered.map(p => (<label key={p.id} className="flex items-center gap-3 p-2 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer"><input type="checkbox" checked={selectedIds.has(p.id)} onChange={() => toggleProduct(p.id)} className="h-4 w-4 rounded accent-violet-600" /><span className="text-lg">{p.emoji}</span><div className="flex-1 min-w-0"><div className="text-sm font-semibold truncate">{p.name}</div><div className="text-[10px] text-slate-500 font-mono">{p.sku} · {p.barcode}</div></div><div className="text-sm font-bold font-mono">{formatGHS(p.price)}</div></label>))}</div>)}</div>
      <div className="text-[11px] text-slate-500 bg-violet-50 dark:bg-violet-950/30 rounded-lg p-2.5">💡 <strong>Print tip:</strong> In the print dialog, set paper size to {labelSize.width} × {labelSize.height} and disable margins. Barcodes are Code 128 — scannable by standard USB/laser scanners.</div>
    </div>
  );
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
