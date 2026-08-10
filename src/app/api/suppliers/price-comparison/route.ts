import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'

// GET /api/suppliers/price-comparison?productId=xxx
// Compares prices for the same product across multiple suppliers

export async function GET(req: NextRequest) {
  try { await requireAuth(); } catch (e) { return e as Response; }

  const productId = req.nextUrl.searchParams.get('productId')

  if (productId) {
    // Compare prices for a single product
    const suppliers = await db.productSupplier.findMany({
      where: { productId },
      include: { supplier: { select: { id: true, name: true, code: true, active: true, tradingTerms: true } } },
      orderBy: { supplierCost: 'asc' },
    })

    if (suppliers.length === 0) {
      return NextResponse.json({ success: true, comparisons: [], message: 'No suppliers for this product' })
    }

    const cheapest = suppliers[0]
    const comparisons = suppliers.map(s => ({
      supplierId: s.supplierId,
      supplierName: s.supplier?.name,
      supplierCode: s.supplier?.code,
      cost: s.supplierCost,
      isPreferred: s.preferred,
      isCheapest: s.id === cheapest.id,
      savings: s.supplierCost > 0 ? Math.round((1 - s.supplierCost / cheapest.supplierCost) * 100) : 0,
      tradingTerms: s.supplier?.tradingTerms,
    }))

    return NextResponse.json({ success: true, comparisons, cheapestSupplier: comparisons[0] })
  }

  // List ALL products with multiple suppliers (for overview)
  const products = await db.product.findMany({
    where: { active: true },
    include: {
      suppliers: {
        include: { supplier: { select: { name: true, code: true } } },
        orderBy: { supplierCost: 'asc' },
      },
    },
  })

  const multiSupplier = products
    .filter(p => p.suppliers.length > 1)
    .map(p => {
      const costs = p.suppliers.map(s => s.supplierCost)
      const min = Math.min(...costs)
      const max = Math.max(...costs)
      const savings = max > 0 ? Math.round((1 - min / max) * 100) : 0
      return {
        productId: p.id,
        productName: p.name,
        sku: p.sku,
        emoji: p.emoji,
        supplierCount: p.suppliers.length,
        minCost: min,
        maxCost: max,
        potentialSavings: savings,
        cheapestSupplier: p.suppliers[0]?.supplier?.name,
      }
    })
    .sort((a, b) => b.potentialSavings - a.potentialSavings)

  return NextResponse.json({ success: true, products: multiSupplier, count: multiSupplier.length })
}
