// Report Export Utilities - SYLHN COMPANY LTD
// PDF, Excel, CSV, and Print export functions

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { COMPANY, CURRENCY, formatGHS } from "./pos-data";
import type { ReportData } from "./pos-types";

export function exportReportToPDF(report: ReportData) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();

  // Company Header
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(16, 122, 87); // emerald-700
  doc.text(COMPANY.name, pageWidth / 2, 15, { align: "center" });

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80, 80, 80);
  doc.text(`Contact: ${COMPANY.contact}  |  Address: ${COMPANY.address}`, pageWidth / 2, 22, { align: "center" });

  // Separator line
  doc.setDrawColor(16, 122, 87);
  doc.setLineWidth(0.5);
  doc.line(14, 26, pageWidth - 14, 26);

  // Report title
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text(report.title, 14, 34);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text(report.subtitle, 14, 39);
  doc.text(`Generated: ${new Date().toLocaleString('en-GB')}`, pageWidth - 14, 39, { align: "right" });

  // Table
  const head = [report.columns.map(c => c.label)];
  const body = report.rows.map(row =>
    report.columns.map(col => {
      const val = row[col.key];
      if (col.format) return col.format(val, row);
      return val ?? "";
    })
  );

  autoTable(doc, {
    head,
    body,
    startY: 44,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [16, 122, 87], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [240, 252, 247] },
    margin: { left: 14, right: 14 },
  });

  // Summary box
  // @ts-ignore - lastAutoTable is added by the plugin
  const finalY = (doc as any).lastAutoTable?.finalY || 50;
  let sumY = finalY + 8;

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(16, 122, 87);
  doc.text("SUMMARY", 14, sumY);
  sumY += 5;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(0, 0, 0);
  report.summary.forEach(s => {
    doc.text(`${s.label}:`, 14, sumY);
    doc.text(s.value, 60, sumY);
    sumY += 5;
  });

  // Footer
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text(`${COMPANY.name} - ${COMPANY.address} - Tel: ${COMPANY.contact}`, pageWidth / 2, pageHeight - 8, { align: "center" });
  doc.text(`Page 1`, pageWidth - 14, pageHeight - 8, { align: "right" });

  doc.save(`${report.type}-${new Date().toISOString().split('T')[0]}.pdf`);
}

export function exportReportToExcel(report: ReportData) {
  // Build worksheet data with company header
  const data: (string | number)[][] = [];

  data.push([COMPANY.name]);
  data.push([`Contact: ${COMPANY.contact}  |  Address: ${COMPANY.address}`]);
  data.push([]);
  data.push([report.title]);
  data.push([report.subtitle]);
  data.push([`Generated: ${new Date().toLocaleString('en-GB')}`]);
  data.push([]);

  // Headers
  data.push(report.columns.map(c => c.label));

  // Rows
  report.rows.forEach(row => {
    data.push(report.columns.map(col => {
      const val = row[col.key];
      if (col.format) return col.format(val, row);
      return val ?? "";
    }));
  });

  data.push([]);
  data.push(["SUMMARY"]);
  report.summary.forEach(s => {
    data.push([s.label, s.value]);
  });

  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Report");

  // Set column widths
  const colWidths = report.columns.map(() => ({ wch: 18 }));
  ws['!cols'] = colWidths;

  XLSX.writeFile(wb, `${report.type}-${new Date().toISOString().split('T')[0]}.xlsx`);
}

export function exportReportToCSV(report: ReportData) {
  const data: string[][] = [];

  // Headers
  data.push(report.columns.map(c => c.label));

  // Rows
  report.rows.forEach(row => {
    data.push(report.columns.map(col => {
      const val = row[col.key];
      if (col.format) return col.format(val, row);
      return String(val ?? "");
    }));
  });

  const csv = data.map(row =>
    row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")
  ).join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${report.type}-${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function printReport(report: ReportData) {
  const printWindow = window.open('', '_blank', 'width=900,height=700');
  if (!printWindow) return;

  const tableHead = report.columns.map(c => `<th class="${c.align || 'left'}">${c.label}</th>`).join("");
  const tableBody = report.rows.map(row =>
    `<tr>${report.columns.map(col => {
      const val = row[col.key];
      const display = col.format ? col.format(val, row) : (val ?? "");
      return `<td class="${col.align || 'left'}">${display}</td>`;
    }).join("")}</tr>`
  ).join("");

  const summaryHtml = report.summary.map(s =>
    `<div class="summary-row"><span class="summary-label">${s.label}:</span><span class="summary-value">${s.value}</span></div>`
  ).join("");

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>${report.title} - ${COMPANY.name}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Arial, sans-serif; padding: 30px; color: #1a1a1a; }
        .company-header { text-align: center; border-bottom: 3px solid #107a57; padding-bottom: 15px; margin-bottom: 20px; }
        .company-name { font-size: 28px; font-weight: bold; color: #107a57; letter-spacing: 1px; }
        .company-info { font-size: 13px; color: #555; margin-top: 5px; }
        .report-header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 15px; }
        .report-title { font-size: 20px; font-weight: bold; }
        .report-subtitle { font-size: 12px; color: #666; margin-top: 3px; }
        .report-meta { text-align: right; font-size: 11px; color: #666; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th { background: #107a57; color: white; padding: 10px 8px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
        td { padding: 8px; border-bottom: 1px solid #e5e7eb; font-size: 12px; }
        tr:nth-child(even) { background: #f0fdf4; }
        tr:hover { background: #dcfce7; }
        .left { text-align: left; }
        .right { text-align: right; }
        .center { text-align: center; }
        .summary-box { margin-top: 25px; padding: 15px; background: #f0fdf4; border-left: 4px solid #107a57; border-radius: 4px; }
        .summary-title { font-size: 14px; font-weight: bold; color: #107a57; margin-bottom: 10px; text-transform: uppercase; }
        .summary-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px; }
        .summary-label { color: #555; }
        .summary-value { font-weight: bold; }
        .footer { margin-top: 40px; padding-top: 15px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 11px; color: #999; }
        @media print {
          body { padding: 15px; }
          th { background: #107a57 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          tr:nth-child(even) { background: #f0fdf4 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          thead { display: table-header-group; }
          tr { page-break-inside: avoid; }
          table { page-break-after: auto; }
        }
      </style>
    </head>
    <body>
      <div class="company-header">
        <div class="company-name">${COMPANY.name}</div>
        <div class="company-info">Contact: ${COMPANY.contact} &nbsp;|&nbsp; Address: ${COMPANY.address}</div>
      </div>
      <div class="report-header">
        <div>
          <div class="report-title">${report.title}</div>
          <div class="report-subtitle">${report.subtitle}</div>
        </div>
        <div class="report-meta">
          Generated: ${new Date().toLocaleString('en-GB')}<br>
          Records: ${report.rows.length}
        </div>
      </div>
      <table>
        <thead><tr>${tableHead}</tr></thead>
        <tbody>${tableBody}</tbody>
      </table>
      <div class="summary-box">
        <div class="summary-title">Summary</div>
        ${summaryHtml}
      </div>
      <div class="footer">
        ${COMPANY.name} &nbsp;|&nbsp; ${COMPANY.address} &nbsp;|&nbsp; Tel: ${COMPANY.contact}<br>
        This is a computer-generated report. All prices in Ghana Cedis (GHS).
      </div>
    </body>
    </html>
  `);
  printWindow.document.close();
  setTimeout(() => {
    printWindow.focus();
    printWindow.print();
  }, 300);
}

// Generate report data based on type
export function generateReport(type: string, products: any[], history: any[], groups: any[]): ReportData {
  const fmt = (v: number) => formatGHS(v);
  switch (type) {
    case "quantities":
      return {
        type: "quantities-report",
        title: "Stock Quantities Report",
        subtitle: "Current inventory levels for all products",
        columns: [
          { key: "sku", label: "SKU" },
          { key: "name", label: "Product Name" },
          { key: "group", label: "Group" },
          { key: "unit", label: "Unit", align: "center" as const },
          { key: "stock", label: "Quantity", align: "right" as const },
          { key: "reorderLevel", label: "Reorder Level", align: "right" as const },
          { key: "status", label: "Status", align: "center" as const },
        ],
        rows: products.map(p => ({
          sku: p.sku, name: `${p.emoji} ${p.name}`,
          group: groups.find(g => g.id === p.groupId)?.name || "-",
          unit: p.unit, stock: p.stock, reorderLevel: p.reorderLevel,
          status: p.stock === 0 ? "OUT OF STOCK" : p.stock <= p.reorderLevel ? "LOW STOCK" : "OK",
        })),
        summary: [
          { label: "Total Products", value: String(products.length) },
          { label: "Total Quantity", value: String(products.reduce((s, p) => s + p.stock, 0)) },
          { label: "Low Stock Items", value: String(products.filter(p => p.stock > 0 && p.stock <= p.reorderLevel).length) },
          { label: "Out of Stock", value: String(products.filter(p => p.stock === 0).length) },
        ],
      };

    case "selling-price":
      return {
        type: "selling-price-report",
        title: "Selling Price Report",
        subtitle: "Current selling prices for all products",
        columns: [
          { key: "sku", label: "SKU" },
          { key: "name", label: "Product Name" },
          { key: "group", label: "Group" },
          { key: "unit", label: "Unit", align: "center" as const },
          { key: "price", label: "Selling Price (GHS)", align: "right" as const, format: (_: any, r: any) => fmt(r.price) },
          { key: "taxable", label: "Taxable", align: "center" as const, format: (v: any) => v ? "Yes" : "No" },
        ],
        rows: products.map(p => ({
          sku: p.sku, name: `${p.emoji} ${p.name}`,
          group: groups.find(g => g.id === p.groupId)?.name || "-",
          unit: p.unit, price: p.price, taxable: p.taxable,
        })),
        summary: [
          { label: "Total Products", value: String(products.length) },
          { label: "Average Price", value: fmt(products.reduce((s, p) => s + p.price, 0) / products.length) },
          { label: "Highest Price", value: fmt(Math.max(...products.map(p => p.price))) },
          { label: "Lowest Price", value: fmt(Math.min(...products.map(p => p.price))) },
        ],
      };

    case "stock-batch":
      return {
        type: "stock-batch-report",
        title: "Stock Batch Report",
        subtitle: "Batch details for all inventory items",
        columns: [
          { key: "batchNumber", label: "Batch No." },
          { key: "sku", label: "SKU" },
          { key: "name", label: "Product Name" },
          { key: "supplier", label: "Supplier" },
          { key: "receivedDate", label: "Received Date", align: "center" as const },
          { key: "expiryDate", label: "Expiry Date", align: "center" as const },
          { key: "stock", label: "Qty in Batch", align: "right" as const },
        ],
        rows: products.map(p => ({
          batchNumber: p.batchNumber, sku: p.sku, name: `${p.emoji} ${p.name}`,
          supplier: p.supplier, receivedDate: p.receivedDate, expiryDate: p.expiryDate, stock: p.stock,
        })),
        summary: [
          { label: "Total Batches", value: String(products.length) },
          { label: "Total Quantity", value: String(products.reduce((s, p) => s + p.stock, 0)) },
          { label: "Unique Suppliers", value: String(new Set(products.map(p => p.supplier)).size) },
        ],
      };

    case "cost-price":
      return {
        type: "cost-price-report",
        title: "Cost Price Report",
        subtitle: "Cost prices and profit margins for all products",
        columns: [
          { key: "sku", label: "SKU" },
          { key: "name", label: "Product Name" },
          { key: "costPrice", label: "Cost Price (GHS)", align: "right" as const, format: (_: any, r: any) => fmt(r.costPrice) },
          { key: "price", label: "Selling Price (GHS)", align: "right" as const, format: (_: any, r: any) => fmt(r.price) },
          { key: "profit", label: "Profit (GHS)", align: "right" as const, format: (_: any, r: any) => fmt(r.price - r.costPrice) },
          { key: "margin", label: "Margin %", align: "right" as const, format: (_: any, r: any) => `${(((r.price - r.costPrice) / r.price) * 100).toFixed(1)}%` },
        ],
        rows: products.map(p => ({ ...p, name: `${p.emoji} ${p.name}` })),
        summary: [
          { label: "Total Cost Value", value: fmt(products.reduce((s, p) => s + p.costPrice * p.stock, 0)) },
          { label: "Total Selling Value", value: fmt(products.reduce((s, p) => s + p.price * p.stock, 0)) },
          { label: "Potential Profit", value: fmt(products.reduce((s, p) => s + (p.price - p.costPrice) * p.stock, 0)) },
          { label: "Avg Margin", value: `${(products.reduce((s, p) => s + ((p.price - p.costPrice) / p.price) * 100, 0) / products.length).toFixed(1)}%` },
        ],
      };

    case "stock-performance":
      return {
        type: "stock-performance-report",
        title: "Stock Performance Report",
        subtitle: "Inventory value and stock turnover analysis",
        columns: [
          { key: "sku", label: "SKU" },
          { key: "name", label: "Product Name" },
          { key: "stock", label: "Qty", align: "right" as const },
          { key: "costPrice", label: "Cost Value (GHS)", align: "right" as const, format: (_: any, r: any) => fmt(r.costPrice * r.stock) },
          { key: "price", label: "Sale Value (GHS)", align: "right" as const, format: (_: any, r: any) => fmt(r.price * r.stock) },
          { key: "potentialProfit", label: "Profit (GHS)", align: "right" as const, format: (_: any, r: any) => fmt((r.price - r.costPrice) * r.stock) },
          { key: "rating", label: "Performance", align: "center" as const },
        ],
        rows: products.map(p => {
          const value = p.price * p.stock;
          const rating = value > 3000 ? "⭐⭐⭐ Excellent" : value > 1000 ? "⭐⭐ Good" : value > 300 ? "⭐ Fair" : "Low";
          return { ...p, name: `${p.emoji} ${p.name}`, potentialProfit: (p.price - p.costPrice) * p.stock, rating };
        }),
        summary: [
          { label: "Total Inventory Value", value: fmt(products.reduce((s, p) => s + p.price * p.stock, 0)) },
          { label: "Total Cost Value", value: fmt(products.reduce((s, p) => s + p.costPrice * p.stock, 0)) },
          { label: "Potential Profit", value: fmt(products.reduce((s, p) => s + (p.price - p.costPrice) * p.stock, 0)) },
          { label: "Top Performer", value: products.reduce((max, p) => p.price * p.stock > max.price * max.stock ? p : max).name },
        ],
      };

    case "stock-reorder":
      const reorderItems = products.filter(p => p.stock <= p.reorderLevel);
      return {
        type: "stock-reorder-report",
        title: "Stock Reorder Report",
        subtitle: "Items that need to be reordered",
        columns: [
          { key: "sku", label: "SKU" },
          { key: "name", label: "Product Name" },
          { key: "supplier", label: "Supplier" },
          { key: "stock", label: "Current Qty", align: "right" as const },
          { key: "reorderLevel", label: "Reorder Level", align: "right" as const },
          { key: "suggestedQty", label: "Suggested Order Qty", align: "right" as const },
          { key: "priority", label: "Priority", align: "center" as const },
        ],
        rows: reorderItems.map(p => ({
          sku: p.sku, name: `${p.emoji} ${p.name}`, supplier: p.supplier,
          stock: p.stock, reorderLevel: p.reorderLevel,
          suggestedQty: Math.max(p.reorderLevel * 2 - p.stock, p.reorderLevel),
          priority: p.stock === 0 ? "🔴 CRITICAL" : p.stock <= p.reorderLevel / 2 ? "🟠 HIGH" : "🟡 MEDIUM",
        })),
        summary: [
          { label: "Items to Reorder", value: String(reorderItems.length) },
          { label: "Critical (Out of Stock)", value: String(reorderItems.filter(p => p.stock === 0).length) },
          { label: "High Priority", value: String(reorderItems.filter(p => p.stock > 0 && p.stock <= p.reorderLevel / 2).length) },
          { label: "Total Suggested Units", value: String(reorderItems.reduce((s, p) => s + Math.max(p.reorderLevel * 2 - p.stock, p.reorderLevel), 0)) },
        ],
      };

    case "stock-take":
      return {
        type: "stock-take-report",
        title: "Stock Take Report",
        subtitle: "Physical stock count verification sheet",
        columns: [
          { key: "sku", label: "SKU" },
          { key: "name", label: "Product Name" },
          { key: "unit", label: "Unit", align: "center" as const },
          { key: "systemQty", label: "System Qty", align: "right" as const },
          { key: "countedQty", label: "Counted Qty", align: "right" as const },
          { key: "variance", label: "Variance", align: "right" as const },
          { key: "notes", label: "Notes" },
        ],
        rows: products.map(p => ({
          sku: p.sku, name: `${p.emoji} ${p.name}`, unit: p.unit,
          systemQty: p.stock, countedQty: "", variance: "", notes: "",
        })),
        summary: [
          { label: "Total Items to Count", value: String(products.length) },
          { label: "Total System Qty", value: String(products.reduce((s, p) => s + p.stock, 0)) },
          { label: "Total System Value", value: fmt(products.reduce((s, p) => s + p.price * p.stock, 0)) },
        ],
      };

    case "stock-value":
      return {
        type: "stock-value-report",
        title: "Stock Value Report",
        subtitle: "Total inventory valuation by product and group",
        columns: [
          { key: "sku", label: "SKU" },
          { key: "name", label: "Product Name" },
          { key: "group", label: "Group" },
          { key: "stock", label: "Qty", align: "right" as const },
          { key: "costValue", label: "Cost Value (GHS)", align: "right" as const, format: (_: any, r: any) => fmt(r.costValue) },
          { key: "saleValue", label: "Sale Value (GHS)", align: "right" as const, format: (_: any, r: any) => fmt(r.saleValue) },
        ],
        rows: products.map(p => ({
          sku: p.sku, name: `${p.emoji} ${p.name}`,
          group: groups.find(g => g.id === p.groupId)?.name || "-",
          stock: p.stock,
          costValue: p.costPrice * p.stock,
          saleValue: p.price * p.stock,
        })),
        summary: [
          { label: "Total Cost Value", value: fmt(products.reduce((s, p) => s + p.costPrice * p.stock, 0)) },
          { label: "Total Sale Value", value: fmt(products.reduce((s, p) => s + p.price * p.stock, 0)) },
          { label: "Potential Profit", value: fmt(products.reduce((s, p) => s + (p.price - p.costPrice) * p.stock, 0)) },
          { label: "Total Items", value: String(products.length) },
        ],
      };

    case "out-of-stock":
      const oosItems = products.filter(p => p.stock === 0);
      return {
        type: "out-of-stock-report",
        title: "Out of Stock Report",
        subtitle: "Products currently out of stock",
        columns: [
          { key: "sku", label: "SKU" },
          { key: "name", label: "Product Name" },
          { key: "supplier", label: "Supplier" },
          { key: "reorderLevel", label: "Reorder Level", align: "right" as const },
          { key: "price", label: "Last Price (GHS)", align: "right" as const, format: (_: any, r: any) => fmt(r.price) },
          { key: "batchNumber", label: "Last Batch" },
        ],
        rows: oosItems.length > 0 ? oosItems.map(p => ({
          sku: p.sku, name: `${p.emoji} ${p.name}`, supplier: p.supplier,
          reorderLevel: p.reorderLevel, price: p.price, batchNumber: p.batchNumber,
        })) : [{ sku: "-", name: "No items out of stock", supplier: "-", reorderLevel: "-", price: "-", batchNumber: "-" }],
        summary: [
          { label: "Out of Stock Items", value: String(oosItems.length) },
          { label: "Lost Sale Value (est.)", value: fmt(oosItems.reduce((s, p) => s + p.price * p.reorderLevel, 0)) },
          { label: "Total Products", value: String(products.length) },
        ],
      };

    case "items-history":
      return {
        type: "items-history-report",
        title: "Items History Report",
        subtitle: "Stock movement history for all products",
        columns: [
          { key: "timestamp", label: "Date & Time" },
          { key: "sku", label: "SKU" },
          { key: "productName", label: "Product" },
          { key: "action", label: "Action", align: "center" as const, format: (v: any) => v.toUpperCase() },
          { key: "quantityChange", label: "Qty Change", align: "right" as const, format: (v: any) => v > 0 ? `+${v}` : String(v) },
          { key: "newQuantity", label: "New Qty", align: "right" as const },
          { key: "user", label: "User" },
          { key: "reason", label: "Reason" },
        ],
        rows: history.slice().reverse().map(h => ({ ...h })),
        summary: [
          { label: "Total Transactions", value: String(history.length) },
          { label: "Stock Received", value: String(history.filter(h => h.action === 'received').reduce((s, h) => s + h.quantityChange, 0)) },
          { label: "Adjustments Made", value: String(history.filter(h => h.action === 'adjusted').length) },
          { label: "Last Activity", value: history[history.length - 1]?.timestamp || "None" },
        ],
      };

    case "expiry-date":
      const today = new Date();
      return {
        type: "expiry-date-report",
        title: "Expiry Date Report",
        subtitle: "Products sorted by expiry date (soonest first)",
        columns: [
          { key: "sku", label: "SKU" },
          { key: "name", label: "Product Name" },
          { key: "batchNumber", label: "Batch No." },
          { key: "expiryDate", label: "Expiry Date", align: "center" as const },
          { key: "daysLeft", label: "Days Left", align: "right" as const },
          { key: "stock", label: "Qty", align: "right" as const },
          { key: "status", label: "Status", align: "center" as const },
        ],
        rows: products.map(p => {
          const exp = new Date(p.expiryDate);
          const daysLeft = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          let status = "✅ FRESH";
          if (daysLeft < 0) status = "🔴 EXPIRED";
          else if (daysLeft <= 3) status = "🟠 CRITICAL";
          else if (daysLeft <= 7) status = "🟡 WARNING";
          return { sku: p.sku, name: `${p.emoji} ${p.name}`, batchNumber: p.batchNumber, expiryDate: p.expiryDate, daysLeft, stock: p.stock, status };
        }).sort((a, b) => a.daysLeft - b.daysLeft),
        summary: [
          { label: "Expired Items", value: String(products.filter(p => new Date(p.expiryDate) < today).length) },
          { label: "Critical (≤3 days)", value: String(products.filter(p => { const d = Math.ceil((new Date(p.expiryDate).getTime() - today.getTime()) / 86400000); return d >= 0 && d <= 3; }).length) },
          { label: "Warning (≤7 days)", value: String(products.filter(p => { const d = Math.ceil((new Date(p.expiryDate).getTime() - today.getTime()) / 86400000); return d > 3 && d <= 7; }).length) },
          { label: "Fresh (>7 days)", value: String(products.filter(p => { const d = Math.ceil((new Date(p.expiryDate).getTime() - today.getTime()) / 86400000); return d > 7; }).length) },
        ],
      };

    case "stock-aging":
      const now = new Date();
      return {
        type: "stock-aging-report",
        title: "Stock Aging Report",
        subtitle: "How long inventory has been in stock",
        columns: [
          { key: "sku", label: "SKU" },
          { key: "name", label: "Product Name" },
          { key: "receivedDate", label: "Received Date", align: "center" as const },
          { key: "daysInStock", label: "Days in Stock", align: "right" as const },
          { key: "stock", label: "Qty", align: "right" as const },
          { key: "value", label: "Value (GHS)", align: "right" as const, format: (_: any, r: any) => fmt(r.value) },
          { key: "aging", label: "Aging Category", align: "center" as const },
        ],
        rows: products.map(p => {
          const days = Math.ceil((now.getTime() - new Date(p.receivedDate).getTime()) / 86400000);
          let aging = "🟢 FRESH (0-7d)";
          if (days > 30) aging = "🔴 OLD (>30d)";
          else if (days > 14) aging = "🟠 AGING (15-30d)";
          else if (days > 7) aging = "🟡 MEDIUM (8-14d)";
          return { sku: p.sku, name: `${p.emoji} ${p.name}`, receivedDate: p.receivedDate, daysInStock: days, stock: p.stock, value: p.price * p.stock, aging };
        }).sort((a, b) => b.daysInStock - a.daysInStock),
        summary: [
          { label: "Total Inventory Value", value: fmt(products.reduce((s, p) => s + p.price * p.stock, 0)) },
          { label: "Old Stock (>30 days)", value: String(products.filter(p => (now.getTime() - new Date(p.receivedDate).getTime()) / 86400000 > 30).length) },
          { label: "Aging Stock (15-30 days)", value: String(products.filter(p => { const d = (now.getTime() - new Date(p.receivedDate).getTime()) / 86400000; return d > 14 && d <= 30; }).length) },
          { label: "Fresh Stock (≤7 days)", value: String(products.filter(p => (now.getTime() - new Date(p.receivedDate).getTime()) / 86400000 <= 7).length) },
        ],
      };

    default:
      return {
        type: "unknown",
        title: "Unknown Report",
        subtitle: "",
        columns: [],
        rows: [],
        summary: [],
      };
  }
}

export const reportTypes = [
  { id: "quantities", name: "Quantities Report", icon: "📦", desc: "Current stock levels for all products" },
  { id: "selling-price", name: "Selling Price Report", icon: "🏷️", desc: "Selling prices of all products" },
  { id: "stock-batch", name: "Stock Batch Report", icon: "🧺", desc: "Batch details and tracking info" },
  { id: "cost-price", name: "Cost Price Report", icon: "💰", desc: "Cost prices and profit margins" },
  { id: "stock-performance", name: "Stock Performance Report", icon: "📈", desc: "Inventory performance analysis" },
  { id: "stock-reorder", name: "Stock Reorder Report", icon: "🔄", desc: "Items needing reorder" },
  { id: "stock-take", name: "Stock Take Report", icon: "📋", desc: "Physical count verification sheet" },
  { id: "stock-value", name: "Stock Value Report", icon: "💎", desc: "Total inventory valuation" },
  { id: "out-of-stock", name: "Out of Stock Report", icon: "🚫", desc: "Products currently unavailable" },
  { id: "items-history", name: "Items History Report", icon: "📜", desc: "Stock movement history" },
  { id: "expiry-date", name: "Expiry Date Report", icon: "⏰", desc: "Products by expiry date" },
  { id: "stock-aging", name: "Stock Aging Report", icon: "📆", desc: "Inventory age analysis" },
];
