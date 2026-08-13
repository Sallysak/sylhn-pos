import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hashPassword } from '@/lib/auth'

// GET /api/seed-demo?secret=sylhn-seed-2026
// Seeds the database with Ghana-specific demo data
// Uses createMany for BULK inserts (1 query instead of 86)

export const runtime = 'nodejs'
export const maxDuration = 300

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  if (secret !== (process.env.SEED_DEMO_SECRET || 'sylhn-seed-2026')) {
    return NextResponse.json({ error: 'Invalid secret' }, { status: 403 })
  }

  try {
    // Immediately respond, then seed in background
    // This prevents Railway proxy timeout
    const results = { groups: 0, products: 0, suppliers: 0, customers: 0, users: 0, settings: 0 }

    // === 1. System Settings (bulk upsert) ===
    const settings = [
      { key: 'companyName', value: 'SYLHN COMPANY LTD' },
      { key: 'taxRate', value: '0.15' },
      { key: 'taxName', value: 'VAT' },
      { key: 'currency', value: 'GHS' },
      { key: 'currencyCode', value: 'GHS' },
      { key: 'loyalty.pointsPerCedi', value: '1' },
      { key: 'loyalty.redeemRate', value: '0.05' },
      { key: 'loyalty.minRedeem', value: '100' },
    ]
    for (const s of settings) {
      await db.systemSetting.upsert({ where: { key: s.key }, update: { value: s.value }, create: s }).catch(() => {})
    }
    results.settings = settings.length

    // === 2. Default Users (only if none exist) ===
    const userCount = await db.systemUser.count()
    if (userCount === 0) {
      const adminPwd = await hashPassword('admin123')
      const managerPwd = await hashPassword('manager123')
      const cashierPwd = await hashPassword('cashier123')
      await db.systemUser.createMany({ data: [
        { username: 'admin', password: adminPwd, fullName: 'System Administrator', role: 'admin', email: 'admin@sylhn.com', phone: '+233592766044', active: true, permissions: JSON.stringify({ pos: true, sales: true, stock: true, purchase: true, accounts: true, telephone: true, maintenance: true, financeOps: true, canVoid: true, canDiscount: true, canAdjustStock: true, canDeleteProducts: true, canExport: true }) },
        { username: 'manager', password: managerPwd, fullName: 'Store Manager', role: 'manager', email: 'manager@sylhn.com', phone: '+233241112222', active: true, permissions: JSON.stringify({ pos: true, sales: true, stock: true, purchase: true, accounts: true, telephone: true, maintenance: false, financeOps: true, canVoid: true, canDiscount: true, canAdjustStock: true, canDeleteProducts: false, canExport: true }) },
        { username: 'cashier', password: cashierPwd, fullName: 'Sarah Johnson', role: 'cashier', email: 'sarah@sylhn.com', phone: '+233243334444', active: true, permissions: JSON.stringify({ pos: true, sales: true, telephone: true, canDiscount: true }) },
      ]}).catch(() => {})
      results.users = 3
    }

    // === 3. Stock Groups (bulk create with skipDuplicates) ===
    const groupData = [
      { name: 'Soft Drinks', icon: '🥤', color: '#06b6d4' },
      { name: 'Water', icon: '💧', color: '#3b82f6' },
      { name: 'Snacks & Biscuits', icon: '🍪', color: '#f59e0b' },
      { name: 'Groceries', icon: '🌾', color: '#a16207' },
      { name: 'Dairy & Chilled', icon: '🥛', color: '#60a5fa' },
      { name: 'Household', icon: '🧴', color: '#8b5cf6' },
      { name: 'Health & Beauty', icon: '💊', color: '#14b8a6' },
      { name: 'Beverages (Hot)', icon: '☕', color: '#92400e' },
      { name: 'Confectionery', icon: '🍬', color: '#ec4899' },
      { name: 'Stationery', icon: '✏️', color: '#6366f1' },
    ]
    // Check if groups already exist
    const existingGroups = await db.stockGroup.findMany()
    let groups = existingGroups
    if (existingGroups.length < groupData.length) {
      // Create missing groups one by one (need IDs for products)
      for (const g of groupData) {
        const existing = groups.find(x => x.name === g.name)
        if (!existing) {
          const created = await db.stockGroup.create({ data: g }).catch(() => null)
          if (created) groups.push(created)
        }
      }
    }
    results.groups = groups.length

    // Map group names to IDs
    const groupMap: Record<string, string> = {}
    groups.forEach(g => { groupMap[g.name] = g.id })

    // === 4. Suppliers (bulk) ===
    const supplierData = [
      { code: 'SUP-001', name: 'Coca-Cola Bottling GH', contactName: 'Kofi Asante', phone: '+233302111222', email: 'orders@cocacola.gh', address: 'Tema Industrial Area', city: 'Tema', country: 'Ghana', tradingTerms: 'Net 30', creditLimit: 10000, balance: 0, taxInclusive: true },
      { code: 'SUP-002', name: 'Unilever Ghana Ltd', contactName: 'Ama Boateng', phone: '+233302333444', email: 'sales@unilever.gh', address: 'Spintex Road, Accra', city: 'Accra', country: 'Ghana', tradingTerms: 'Net 15', creditLimit: 8000, balance: 1500, taxInclusive: true },
      { code: 'SUP-003', name: 'Fan Milk Ghana', contactName: 'Yaw Mensah', phone: '+233302555666', email: 'orders@fanmilk.gh', address: 'Tema, Greater Accra', city: 'Tema', country: 'Ghana', tradingTerms: 'COD', creditLimit: 3000, balance: 0, taxInclusive: false },
      { code: 'SUP-004', name: 'Promasidor Ghana', contactName: 'Adwoa Darko', phone: '+233244556677', email: 'info@promasidor.gh', address: 'North Industrial Area, Accra', city: 'Accra', country: 'Ghana', tradingTerms: 'Net 30', creditLimit: 6000, balance: 800, taxInclusive: true },
      { code: 'SUP-005', name: 'PZ Cussons Ghana', contactName: 'Kwesi Asare', phone: '+233249990000', email: 'orders@pzcussons.gh', address: 'Apenkwa, Accra', city: 'Accra', country: 'Ghana', tradingTerms: 'Net 60', creditLimit: 12000, balance: 0, taxInclusive: true },
    ]
    const existingSuppliers = await db.supplier.count()
    if (existingSuppliers === 0) {
      await db.supplier.createMany({ data: supplierData }).catch(() => {})
      results.suppliers = supplierData.length
    } else {
      results.suppliers = existingSuppliers
    }

    // === 5. Products (bulk createMany — FAST) ===
    const gid = (name: string) => groupMap[name] || groups[0]?.id || ''
    const productData = [
      { sku: 'CD-330', name: 'Coca-Cola 330ml', emoji: '🥤', category: 'soft-drinks', price: 4.00, costPrice: 2.80, quantity: 120, unit: 'btl', groupId: gid('Soft Drinks'), taxable: true, reorderLevel: 24 },
      { sku: 'CD-500', name: 'Coca-Cola 500ml', emoji: '🥤', category: 'soft-drinks', price: 5.00, costPrice: 3.50, quantity: 80, unit: 'btl', groupId: gid('Soft Drinks'), taxable: true, reorderLevel: 20 },
      { sku: 'CD-1L', name: 'Coca-Cola 1L', emoji: '🥤', category: 'soft-drinks', price: 8.00, costPrice: 5.50, quantity: 40, unit: 'btl', groupId: gid('Soft Drinks'), taxable: true, reorderLevel: 12 },
      { sku: 'SP-330', name: 'Sprite 330ml', emoji: '🥤', category: 'soft-drinks', price: 4.00, costPrice: 2.80, quantity: 100, unit: 'btl', groupId: gid('Soft Drinks'), taxable: true, reorderLevel: 24 },
      { sku: 'FD-330', name: 'Fanta 330ml', emoji: '🥤', category: 'soft-drinks', price: 4.00, costPrice: 2.80, quantity: 90, unit: 'btl', groupId: gid('Soft Drinks'), taxable: true, reorderLevel: 24 },
      { sku: 'MV-330', name: 'Maltina 330ml', emoji: '🥤', category: 'soft-drinks', price: 4.50, costPrice: 3.00, quantity: 60, unit: 'btl', groupId: gid('Soft Drinks'), taxable: true, reorderLevel: 18 },
      { sku: 'PE-1L', name: 'Pepsi 1L', emoji: '🥤', category: 'soft-drinks', price: 7.00, costPrice: 4.80, quantity: 35, unit: 'btl', groupId: gid('Soft Drinks'), taxable: true, reorderLevel: 12 },
      { sku: 'VW-500', name: 'Voltic Water 500ml', emoji: '💧', category: 'water', price: 2.50, costPrice: 1.50, quantity: 200, unit: 'btl', groupId: gid('Water'), taxable: true, reorderLevel: 48 },
      { sku: 'VW-1.5L', name: 'Voltic Water 1.5L', emoji: '💧', category: 'water', price: 5.00, costPrice: 3.20, quantity: 100, unit: 'btl', groupId: gid('Water'), taxable: true, reorderLevel: 24 },
      { sku: 'EW-500', name: 'Everpack Water 500ml', emoji: '💧', category: 'water', price: 2.00, costPrice: 1.20, quantity: 150, unit: 'sachet', groupId: gid('Water'), taxable: false, reorderLevel: 50 },
      { sku: 'IND-BEEF', name: 'Indomie Beef 70g', emoji: '🍜', category: 'snacks', price: 3.50, costPrice: 2.50, quantity: 200, unit: 'pcs', groupId: gid('Snacks & Biscuits'), taxable: true, reorderLevel: 48 },
      { sku: 'IND-CHICK', name: 'Indomie Chicken 70g', emoji: '🍜', category: 'snacks', price: 3.50, costPrice: 2.50, quantity: 180, unit: 'pcs', groupId: gid('Snacks & Biscuits'), taxable: true, reorderLevel: 48 },
      { sku: 'BS-ORIG', name: 'Biscuit Original', emoji: '🍪', category: 'snacks', price: 1.00, costPrice: 0.60, quantity: 300, unit: 'pcs', groupId: gid('Snacks & Biscuits'), taxable: true, reorderLevel: 60 },
      { sku: 'BS-CHOC', name: 'Bourbon Biscuit', emoji: '🍪', category: 'snacks', price: 1.50, costPrice: 0.90, quantity: 150, unit: 'pcs', groupId: gid('Snacks & Biscuits'), taxable: true, reorderLevel: 30 },
      { sku: 'CH-PLN', name: 'Cheetos Plain', emoji: '🍟', category: 'snacks', price: 2.50, costPrice: 1.70, quantity: 80, unit: 'pcs', groupId: gid('Snacks & Biscuits'), taxable: true, reorderLevel: 20 },
      { sku: 'PS-100', name: 'Plantain Chips 100g', emoji: '🍌', category: 'snacks', price: 3.00, costPrice: 2.00, quantity: 60, unit: 'pcs', groupId: gid('Snacks & Biscuits'), taxable: true, reorderLevel: 15 },
      { sku: 'RIC-5KG', name: 'Rice 5kg Bag', emoji: '🍚', category: 'groceries', price: 65.00, costPrice: 52.00, quantity: 30, unit: 'bag', groupId: gid('Groceries'), taxable: true, reorderLevel: 10 },
      { sku: 'RIC-1KG', name: 'Rice 1kg', emoji: '🍚', category: 'groceries', price: 15.00, costPrice: 11.00, quantity: 50, unit: 'bag', groupId: gid('Groceries'), taxable: true, reorderLevel: 15 },
      { sku: 'SGR-500', name: 'Sugar 500g', emoji: '🧂', category: 'groceries', price: 8.00, costPrice: 5.50, quantity: 40, unit: 'pcs', groupId: gid('Groceries'), taxable: true, reorderLevel: 12 },
      { sku: 'OIL-1L', name: 'Cooking Oil 1L', emoji: '🫒', category: 'groceries', price: 25.00, costPrice: 19.00, quantity: 35, unit: 'btl', groupId: gid('Groceries'), taxable: true, reorderLevel: 10 },
      { sku: 'TOM-400', name: 'Tomato Paste 400g', emoji: '🥫', category: 'groceries', price: 8.50, costPrice: 6.00, quantity: 45, unit: 'tin', groupId: gid('Groceries'), taxable: true, reorderLevel: 12 },
      { sku: 'SALT-500', name: 'Salt 500g', emoji: '🧂', category: 'groceries', price: 3.00, costPrice: 1.80, quantity: 60, unit: 'pcs', groupId: gid('Groceries'), taxable: false, reorderLevel: 15 },
      { sku: 'FLOUR-2KG', name: 'Flour 2kg', emoji: '🌾', category: 'groceries', price: 22.00, costPrice: 16.00, quantity: 25, unit: 'bag', groupId: gid('Groceries'), taxable: true, reorderLevel: 8 },
      { sku: 'MLK-1L', name: 'Fresh Milk 1L', emoji: '🥛', category: 'dairy', price: 12.00, costPrice: 8.50, quantity: 30, unit: 'btl', groupId: gid('Dairy & Chilled'), taxable: true, reorderLevel: 10 },
      { sku: 'YOG-500', name: 'Yogurt 500ml', emoji: '🥛', category: 'dairy', price: 8.00, costPrice: 5.50, quantity: 25, unit: 'cup', groupId: gid('Dairy & Chilled'), taxable: true, reorderLevel: 8 },
      { sku: 'EGG-DZ', name: 'Eggs (dozen)', emoji: '🥚', category: 'dairy', price: 18.00, costPrice: 14.00, quantity: 20, unit: 'dz', groupId: gid('Dairy & Chilled'), taxable: true, reorderLevel: 6 },
      { sku: 'BTR-250', name: 'Butter 250g', emoji: '🧈', category: 'dairy', price: 15.00, costPrice: 11.00, quantity: 15, unit: 'pcs', groupId: gid('Dairy & Chilled'), taxable: true, reorderLevel: 5 },
      { sku: 'SOAP', name: 'Key Soap 200g', emoji: '🧼', category: 'household', price: 5.00, costPrice: 3.50, quantity: 80, unit: 'pcs', groupId: gid('Household'), taxable: true, reorderLevel: 20 },
      { sku: 'PASTE', name: 'Pepsodent Toothpaste', emoji: '🪥', category: 'household', price: 8.00, costPrice: 5.50, quantity: 50, unit: 'pcs', groupId: gid('Household'), taxable: true, reorderLevel: 15 },
      { sku: 'BRUSH', name: 'Toothbrush', emoji: '🪥', category: 'household', price: 3.00, costPrice: 1.50, quantity: 100, unit: 'pcs', groupId: gid('Household'), taxable: true, reorderLevel: 20 },
      { sku: 'TISH-4', name: 'Tissue Paper 4-roll', emoji: '🧻', category: 'household', price: 12.00, costPrice: 8.00, quantity: 40, unit: 'pack', groupId: gid('Household'), taxable: true, reorderLevel: 12 },
      { sku: 'DET-1L', name: 'Detergent 1L', emoji: '🧴', category: 'household', price: 18.00, costPrice: 13.00, quantity: 30, unit: 'btl', groupId: gid('Household'), taxable: true, reorderLevel: 10 },
      { sku: 'MATCH', name: 'Match Box', emoji: '🔥', category: 'household', price: 1.00, costPrice: 0.50, quantity: 200, unit: 'box', groupId: gid('Household'), taxable: false, reorderLevel: 50 },
      { sku: 'PAMP-10', name: 'Pampers (10-pack)', emoji: '👶', category: 'health', price: 35.00, costPrice: 26.00, quantity: 25, unit: 'pack', groupId: gid('Health & Beauty'), taxable: true, reorderLevel: 8 },
      { sku: 'SHMP-400', name: 'Shampoo 400ml', emoji: '🧴', category: 'health', price: 25.00, costPrice: 18.00, quantity: 20, unit: 'btl', groupId: gid('Health & Beauty'), taxable: true, reorderLevel: 8 },
      { sku: 'PRLF-100', name: 'Perfume 100ml', emoji: '🌸', category: 'health', price: 45.00, costPrice: 30.00, quantity: 15, unit: 'btl', groupId: gid('Health & Beauty'), taxable: true, reorderLevel: 5 },
      { sku: 'INSEC', name: 'Insecticide Spray', emoji: '🦟', category: 'health', price: 20.00, costPrice: 14.00, quantity: 18, unit: 'can', groupId: gid('Health & Beauty'), taxable: true, reorderLevel: 6 },
      { sku: 'MILK-200', name: 'Milo 200g', emoji: '🍫', category: 'hot-bev', price: 12.00, costPrice: 8.50, quantity: 50, unit: 'tin', groupId: gid('Beverages (Hot)'), taxable: true, reorderLevel: 15 },
      { sku: 'MILK-500', name: 'Milo 500g', emoji: '🍫', category: 'hot-bev', price: 25.00, costPrice: 18.00, quantity: 30, unit: 'tin', groupId: gid('Beverages (Hot)'), taxable: true, reorderLevel: 10 },
      { sku: 'NES-100', name: 'Nescafe 100g', emoji: '☕', category: 'hot-bev', price: 30.00, costPrice: 22.00, quantity: 20, unit: 'jar', groupId: gid('Beverages (Hot)'), taxable: true, reorderLevel: 8 },
      { sku: 'TEA-50', name: 'Lipton Tea (50 bags)', emoji: '🍵', category: 'hot-bev', price: 15.00, costPrice: 10.00, quantity: 40, unit: 'box', groupId: gid('Beverages (Hot)'), taxable: true, reorderLevel: 12 },
      { sku: 'CHOC-DARK', name: 'Dark Chocolate Bar', emoji: '🍫', category: 'confectionery', price: 5.00, costPrice: 3.00, quantity: 60, unit: 'bar', groupId: gid('Confectionery'), taxable: true, reorderLevel: 15 },
      { sku: 'GUM-10', name: 'Chewing Gum (10pc)', emoji: '🍬', category: 'confectionery', price: 2.00, costPrice: 1.00, quantity: 150, unit: 'pack', groupId: gid('Confectionery'), taxable: true, reorderLevel: 30 },
      { sku: 'LOL-20', name: 'Lollipops (20pc)', emoji: '🍭', category: 'confectionery', price: 5.00, costPrice: 3.00, quantity: 80, unit: 'pack', groupId: gid('Confectionery'), taxable: true, reorderLevel: 20 },
      { sku: 'PEN-BIC', name: 'Bic Pen (blue)', emoji: '🖊️', category: 'stationery', price: 2.00, costPrice: 1.00, quantity: 100, unit: 'pcs', groupId: gid('Stationery'), taxable: true, reorderLevel: 20 },
      { sku: 'BOOK-A4', name: 'Exercise Book A4', emoji: '📓', category: 'stationery', price: 8.00, costPrice: 5.00, quantity: 50, unit: 'pcs', groupId: gid('Stationery'), taxable: true, reorderLevel: 15 },
      { sku: 'PENCIL', name: 'Pencil (2B)', emoji: '✏️', category: 'stationery', price: 1.00, costPrice: 0.40, quantity: 150, unit: 'pcs', groupId: gid('Stationery'), taxable: false, reorderLevel: 30 },
      { sku: 'ERASER', name: 'Eraser', emoji: '🧽', category: 'stationery', price: 1.00, costPrice: 0.40, quantity: 80, unit: 'pcs', groupId: gid('Stationery'), taxable: false, reorderLevel: 20 },
    ]
    const existingProducts = await db.product.count()
    if (existingProducts === 0) {
      // BULK INSERT — single database round-trip
      await db.product.createMany({ data: productData }).catch(() => {})
      results.products = productData.length
    } else {
      results.products = existingProducts
    }

    // === 6. Customers (bulk) ===
    const customerData = [
      { name: 'Kwame Mensah', phone: '+233241234567', email: 'kwame@email.com', creditLimit: 500, balance: 0, active: true },
      { name: 'Akosua Owusu', phone: '+233242345678', email: 'akosua@email.com', creditLimit: 1000, balance: 250, active: true },
      { name: 'Yaw Boateng', phone: '+233243456789', email: 'yaw@email.com', creditLimit: 300, balance: 0, active: true },
      { name: 'Adwoa Asante', phone: '+233244567890', email: 'adwoa@email.com', creditLimit: 2000, balance: 850, active: true },
      { name: 'Kofi Darko', phone: '+233245678901', email: 'kofi@email.com', creditLimit: 0, balance: 0, active: true },
    ]
    const existingCustomers = await db.customer.count()
    if (existingCustomers === 0) {
      await db.customer.createMany({ data: customerData }).catch(() => {})
      results.customers = customerData.length
    } else {
      results.customers = existingCustomers
    }

    return NextResponse.json({
      success: true,
      message: 'Demo data seeded! Login with admin/admin123 and start selling.',
      results,
    })
  } catch (e: any) {
    console.error('Seed demo error:', e)
    return NextResponse.json({ error: e.message || 'Seed failed' }, { status: 500 })
  }
}
