// SYLHN COMPANY LTD - Modern Grocery POS
// Product Catalog & Stock Data (All prices in Ghana Cedis - GHS)

export interface Product {
  id: string;
  sku: string;
  name: string;
  price: number;          // Selling price (GHS)
  costPrice: number;      // Cost price (GHS)
  category: string;
  groupId: string;
  unit: string;
  stock: number;
  reorderLevel: number;
  barcode: string;
  emoji: string;
  taxable: boolean;
  batchNumber: string;
  receivedDate: string;   // ISO date
  expiryDate: string;     // ISO date
  supplier: string;
  discount?: number;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  gradient: string;
}

export interface StockGroup {
  id: string;
  name: string;
  description: string;
  color: string;
  icon: string;
}

export interface StockHistoryEntry {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  action: 'added' | 'modified' | 'adjusted' | 'sold' | 'received' | 'removed' | 'reordered';
  quantityChange: number;
  newQuantity: number;
  timestamp: string;
  user: string;
  reason: string;
  reference?: string;
}

export const COMPANY = {
  name: "SYLHN COMPANY LTD",
  contact: "+233592766044",
  address: "East Legon, Accra",
  email: "info@sylhncompany.com",
  tagline: "Your Trusted Grocery Partner",
};

export const CURRENCY = "₵"; // Ghana Cedi symbol
export const CURRENCY_CODE = "GHS";

export const categories: Category[] = [
  { id: "all", name: "All Items", icon: "🛒", color: "slate", gradient: "from-slate-500 to-slate-600" },
  { id: "fruits", name: "Fruits", icon: "🍎", color: "rose", gradient: "from-rose-400 to-red-500" },
  { id: "vegetables", name: "Vegetables", icon: "🥕", color: "orange", gradient: "from-orange-400 to-amber-500" },
  { id: "dairy", name: "Dairy & Eggs", icon: "🥛", color: "yellow", gradient: "from-yellow-300 to-amber-400" },
  { id: "meat", name: "Meat & Poultry", icon: "🥩", color: "red", gradient: "from-red-500 to-rose-600" },
  { id: "bakery", name: "Bakery", icon: "🍞", color: "amber", gradient: "from-amber-400 to-orange-500" },
  { id: "beverages", name: "Beverages", icon: "🥤", color: "cyan", gradient: "from-cyan-400 to-blue-500" },
  { id: "snacks", name: "Snacks", icon: "🍫", color: "purple", gradient: "from-purple-400 to-violet-500" },
  { id: "frozen", name: "Frozen Foods", icon: "🧊", color: "sky", gradient: "from-sky-400 to-cyan-500" },
  { id: "pantry", name: "Pantry", icon: "🥫", color: "emerald", gradient: "from-emerald-400 to-green-500" },
  { id: "household", name: "Household", icon: "🧴", color: "teal", gradient: "from-teal-400 to-emerald-500" },
];

export const stockGroups: StockGroup[] = [
  { id: "g1", name: "Fresh Produce", description: "Fruits and vegetables", color: "emerald", icon: "🥬" },
  { id: "g2", name: "Chilled & Dairy", description: "Milk, cheese, eggs, chilled items", color: "blue", icon: "🥛" },
  { id: "g3", name: "Butchery", description: "Fresh and frozen meat products", color: "red", icon: "🥩" },
  { id: "g4", name: "Bakery Items", description: "Bread, pastries, baked goods", color: "amber", icon: "🍞" },
  { id: "g5", name: "Beverages & Drinks", description: "Soft drinks, juices, water, alcohol", color: "cyan", icon: "🥤" },
  { id: "g6", name: "Confectionery", description: "Snacks, candy, chocolates", color: "purple", icon: "🍫" },
  { id: "g7", name: "Frozen Foods", description: "Frozen meals, ice cream, frozen veg", color: "sky", icon: "🧊" },
  { id: "g8", name: "Dry Goods & Pantry", description: "Rice, pasta, canned goods, staples", color: "orange", icon: "🥫" },
  { id: "g9", name: "Household & Cleaning", description: "Cleaning supplies, paper goods", color: "teal", icon: "🧴" },
  { id: "g10", name: "Health & Beauty", description: "Personal care items", color: "pink", icon: "🧼" },
];

const groupIdMap: Record<string, string> = {
  fruits: "g1", vegetables: "g1",
  dairy: "g2",
  meat: "g3",
  bakery: "g4",
  beverages: "g5",
  snacks: "g6",
  frozen: "g7",
  pantry: "g8",
  household: "g9",
};

// Helper to generate dates
const daysFromNow = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
};

export const products: Product[] = [
  // Fruits (GHS pricing)
  { id: "p1", sku: "FR-001", name: "Red Apples", price: 35.00, costPrice: 24.00, category: "fruits", groupId: "g1", unit: "kg", stock: 124, reorderLevel: 30, barcode: "941563812092", emoji: "🍎", taxable: false, batchNumber: "B-APL-2401", receivedDate: daysFromNow(-5), expiryDate: daysFromNow(10), supplier: "AgriCorp Ghana" },
  { id: "p2", sku: "FR-002", name: "Bananas", price: 18.00, costPrice: 11.00, category: "fruits", groupId: "g1", unit: "kg", stock: 89, reorderLevel: 25, barcode: "941563812093", emoji: "🍌", taxable: false, batchNumber: "B-BAN-2402", receivedDate: daysFromNow(-3), expiryDate: daysFromNow(5), supplier: "AgriCorp Ghana" },
  { id: "p3", sku: "FR-003", name: "Oranges", price: 42.00, costPrice: 28.00, category: "fruits", groupId: "g1", unit: "kg", stock: 76, reorderLevel: 20, barcode: "941563812094", emoji: "🍊", taxable: false, batchNumber: "B-ORG-2401", receivedDate: daysFromNow(-7), expiryDate: daysFromNow(14), supplier: "Kumasi Farms" },
  { id: "p4", sku: "FR-004", name: "Strawberries", price: 60.00, costPrice: 42.00, category: "fruits", groupId: "g1", unit: "box", stock: 32, reorderLevel: 15, barcode: "941563812095", emoji: "🍓", taxable: false, batchNumber: "B-STR-2403", receivedDate: daysFromNow(-2), expiryDate: daysFromNow(4), supplier: "Fresh Imports" },
  { id: "p5", sku: "FR-005", name: "Grapes - Green", price: 65.00, costPrice: 48.00, category: "fruits", groupId: "g1", unit: "kg", stock: 45, reorderLevel: 15, barcode: "941563812096", emoji: "🍇", taxable: false, batchNumber: "B-GRP-2401", receivedDate: daysFromNow(-4), expiryDate: daysFromNow(8), supplier: "Fresh Imports" },
  { id: "p6", sku: "FR-006", name: "Watermelon", price: 80.00, costPrice: 55.00, category: "fruits", groupId: "g1", unit: "each", stock: 18, reorderLevel: 10, barcode: "941563812097", emoji: "🍉", taxable: false, batchNumber: "B-WML-2402", receivedDate: daysFromNow(-6), expiryDate: daysFromNow(12), supplier: "Kumasi Farms" },
  { id: "p7", sku: "FR-007", name: "Pineapple", price: 45.00, costPrice: 30.00, category: "fruits", groupId: "g1", unit: "each", stock: 24, reorderLevel: 12, barcode: "941563812098", emoji: "🍍", taxable: false, batchNumber: "B-PIN-2401", receivedDate: daysFromNow(-5), expiryDate: daysFromNow(15), supplier: "Kumasi Farms" },
  { id: "p8", sku: "FR-008", name: "Mango", price: 30.00, costPrice: 18.00, category: "fruits", groupId: "g1", unit: "each", stock: 56, reorderLevel: 20, barcode: "941563812099", emoji: "🥭", taxable: false, batchNumber: "B-MNG-2403", receivedDate: daysFromNow(-3), expiryDate: daysFromNow(7), supplier: "AgriCorp Ghana" },
  { id: "p9", sku: "FR-009", name: "Avocado", price: 18.00, costPrice: 10.00, category: "fruits", groupId: "g1", unit: "each", stock: 78, reorderLevel: 25, barcode: "941563812100", emoji: "🥑", taxable: false, batchNumber: "B-AVO-2402", receivedDate: daysFromNow(-4), expiryDate: daysFromNow(9), supplier: "AgriCorp Ghana" },
  { id: "p10", sku: "FR-010", name: "Lemons", price: 8.00, costPrice: 5.00, category: "fruits", groupId: "g1", unit: "each", stock: 112, reorderLevel: 30, barcode: "941563812101", emoji: "🍋", taxable: false, batchNumber: "B-LEM-2401", receivedDate: daysFromNow(-8), expiryDate: daysFromNow(20), supplier: "Kumasi Farms" },
  { id: "p11", sku: "FR-011", name: "Blueberries", price: 50.00, costPrice: 35.00, category: "fruits", groupId: "g1", unit: "box", stock: 28, reorderLevel: 12, barcode: "941563812102", emoji: "🫐", taxable: false, batchNumber: "B-BLU-2403", receivedDate: daysFromNow(-2), expiryDate: daysFromNow(6), supplier: "Fresh Imports" },
  { id: "p12", sku: "FR-012", name: "Peaches", price: 38.00, costPrice: 25.00, category: "fruits", groupId: "g1", unit: "kg", stock: 41, reorderLevel: 15, barcode: "941563812103", emoji: "🍑", taxable: false, batchNumber: "B-PCH-2401", receivedDate: daysFromNow(-6), expiryDate: daysFromNow(11), supplier: "Fresh Imports" },

  // Vegetables
  { id: "p13", sku: "VG-001", name: "Carrots", price: 23.00, costPrice: 14.00, category: "vegetables", groupId: "g1", unit: "kg", stock: 95, reorderLevel: 25, barcode: "941563812104", emoji: "🥕", taxable: false, batchNumber: "B-CAR-2402", receivedDate: daysFromNow(-5), expiryDate: daysFromNow(14), supplier: "Kumasi Farms" },
  { id: "p14", sku: "VG-002", name: "Broccoli", price: 35.00, costPrice: 22.00, category: "vegetables", groupId: "g1", unit: "each", stock: 62, reorderLevel: 20, barcode: "941563812105", emoji: "🥦", taxable: false, batchNumber: "B-BRO-2401", receivedDate: daysFromNow(-4), expiryDate: daysFromNow(7), supplier: "AgriCorp Ghana" },
  { id: "p15", sku: "VG-003", name: "Tomatoes", price: 46.00, costPrice: 30.00, category: "vegetables", groupId: "g1", unit: "kg", stock: 87, reorderLevel: 25, barcode: "941563812106", emoji: "🍅", taxable: false, batchNumber: "B-TOM-2403", receivedDate: daysFromNow(-3), expiryDate: daysFromNow(8), supplier: "Kumasi Farms" },
  { id: "p16", sku: "VG-004", name: "Potatoes", price: 30.00, costPrice: 18.00, category: "vegetables", groupId: "g1", unit: "kg", stock: 134, reorderLevel: 30, barcode: "941563812107", emoji: "🥔", taxable: false, batchNumber: "B-POT-2401", receivedDate: daysFromNow(-10), expiryDate: daysFromNow(30), supplier: "Kumasi Farms" },
  { id: "p17", sku: "VG-005", name: "Onions", price: 25.00, costPrice: 15.00, category: "vegetables", groupId: "g1", unit: "kg", stock: 98, reorderLevel: 30, barcode: "941563812108", emoji: "🧅", taxable: false, batchNumber: "B-ONI-2402", receivedDate: daysFromNow(-9), expiryDate: daysFromNow(25), supplier: "Kumasi Farms" },
  { id: "p18", sku: "VG-006", name: "Bell Peppers", price: 13.00, costPrice: 8.00, category: "vegetables", groupId: "g1", unit: "each", stock: 73, reorderLevel: 25, barcode: "941563812109", emoji: "🫑", taxable: false, batchNumber: "B-BEL-2401", receivedDate: daysFromNow(-5), expiryDate: daysFromNow(10), supplier: "AgriCorp Ghana" },
  { id: "p19", sku: "VG-007", name: "Cucumber", price: 10.00, costPrice: 6.00, category: "vegetables", groupId: "g1", unit: "each", stock: 65, reorderLevel: 20, barcode: "941563812110", emoji: "🥒", taxable: false, batchNumber: "B-CUC-2403", receivedDate: daysFromNow(-4), expiryDate: daysFromNow(9), supplier: "AgriCorp Ghana" },
  { id: "p20", sku: "VG-008", name: "Lettuce", price: 28.00, costPrice: 18.00, category: "vegetables", groupId: "g1", unit: "head", stock: 48, reorderLevel: 15, barcode: "941563812111", emoji: "🥬", taxable: false, batchNumber: "B-LET-2401", receivedDate: daysFromNow(-3), expiryDate: daysFromNow(5), supplier: "AgriCorp Ghana" },
  { id: "p21", sku: "VG-009", name: "Corn", price: 7.00, costPrice: 4.00, category: "vegetables", groupId: "g1", unit: "each", stock: 84, reorderLevel: 25, barcode: "941563812112", emoji: "🌽", taxable: false, batchNumber: "B-CRN-2402", receivedDate: daysFromNow(-6), expiryDate: daysFromNow(12), supplier: "Kumasi Farms" },
  { id: "p22", sku: "VG-010", name: "Mushrooms", price: 40.00, costPrice: 26.00, category: "vegetables", groupId: "g1", unit: "box", stock: 36, reorderLevel: 12, barcode: "941563812113", emoji: "🍄", taxable: false, batchNumber: "B-MSH-2401", receivedDate: daysFromNow(-2), expiryDate: daysFromNow(6), supplier: "Fresh Imports" },
  { id: "p23", sku: "VG-011", name: "Garlic", price: 5.00, costPrice: 3.00, category: "vegetables", groupId: "g1", unit: "each", stock: 120, reorderLevel: 30, barcode: "941563812114", emoji: "🧄", taxable: false, batchNumber: "B-GAR-2401", receivedDate: daysFromNow(-15), expiryDate: daysFromNow(45), supplier: "Kumasi Farms" },
  { id: "p24", sku: "VG-012", name: "Sweet Potato", price: 32.00, costPrice: 20.00, category: "vegetables", groupId: "g1", unit: "kg", stock: 79, reorderLevel: 20, barcode: "941563812115", emoji: "🍠", taxable: false, batchNumber: "B-SWP-2402", receivedDate: daysFromNow(-8), expiryDate: daysFromNow(30), supplier: "Kumasi Farms" },

  // Dairy & Eggs
  { id: "p25", sku: "DR-001", name: "Whole Milk 1L", price: 18.00, costPrice: 13.00, category: "dairy", groupId: "g2", unit: "btl", stock: 156, reorderLevel: 40, barcode: "941563812116", emoji: "🥛", taxable: false, batchNumber: "B-MLK-2403", receivedDate: daysFromNow(-2), expiryDate: daysFromNow(7), supplier: "Fan Milk Ghana" },
  { id: "p26", sku: "DR-002", name: "Skim Milk 1L", price: 19.00, costPrice: 14.00, category: "dairy", groupId: "g2", unit: "btl", stock: 142, reorderLevel: 35, barcode: "941563812117", emoji: "🥛", taxable: false, batchNumber: "B-SKM-2403", receivedDate: daysFromNow(-2), expiryDate: daysFromNow(7), supplier: "Fan Milk Ghana" },
  { id: "p27", sku: "DR-003", name: "Eggs (Dozen)", price: 45.00, costPrice: 32.00, category: "dairy", groupId: "g2", unit: "dz", stock: 88, reorderLevel: 30, barcode: "941563812118", emoji: "🥚", taxable: false, batchNumber: "B-EGG-2404", receivedDate: daysFromNow(-3), expiryDate: daysFromNow(21), supplier: "Akate Farms" },
  { id: "p28", sku: "DR-004", name: "Cheddar Cheese", price: 65.00, costPrice: 48.00, category: "dairy", groupId: "g2", unit: "block", stock: 54, reorderLevel: 15, barcode: "941563812119", emoji: "🧀", taxable: false, batchNumber: "B-CHS-2402", receivedDate: daysFromNow(-7), expiryDate: daysFromNow(60), supplier: "BellAqua Ghana" },
  { id: "p29", sku: "DR-005", name: "Greek Yogurt", price: 38.00, costPrice: 25.00, category: "dairy", groupId: "g2", unit: "tub", stock: 67, reorderLevel: 20, barcode: "941563812120", emoji: "🥣", taxable: false, batchNumber: "B-YGT-2403", receivedDate: daysFromNow(-3), expiryDate: daysFromNow(14), supplier: "Fan Milk Ghana" },
  { id: "p30", sku: "DR-006", name: "Butter 250g", price: 43.00, costPrice: 30.00, category: "dairy", groupId: "g2", unit: "block", stock: 73, reorderLevel: 20, barcode: "941563812121", emoji: "🧈", taxable: false, batchNumber: "B-BTR-2402", receivedDate: daysFromNow(-5), expiryDate: daysFromNow(45), supplier: "BellAqua Ghana" },
  { id: "p31", sku: "DR-007", name: "Cream Cheese", price: 35.00, costPrice: 24.00, category: "dairy", groupId: "g2", unit: "tub", stock: 45, reorderLevel: 15, barcode: "941563812122", emoji: "🧀", taxable: false, batchNumber: "B-CMC-2401", receivedDate: daysFromNow(-6), expiryDate: daysFromNow(30), supplier: "BellAqua Ghana" },
  { id: "p32", sku: "DR-008", name: "Heavy Cream", price: 40.00, costPrice: 28.00, category: "dairy", groupId: "g2", unit: "btl", stock: 38, reorderLevel: 12, barcode: "941563812123", emoji: "🥛", taxable: false, batchNumber: "B-HCR-2401", receivedDate: daysFromNow(-4), expiryDate: daysFromNow(18), supplier: "BellAqua Ghana" },

  // Meat & Poultry
  { id: "p33", sku: "MT-001", name: "Chicken Breast", price: 65.00, costPrice: 48.00, category: "meat", groupId: "g3", unit: "kg", stock: 42, reorderLevel: 15, barcode: "941563812124", emoji: "🍗", taxable: false, batchNumber: "B-CHB-2403", receivedDate: daysFromNow(-2), expiryDate: daysFromNow(5), supplier: "Darko Farms" },
  { id: "p34", sku: "MT-002", name: "Ground Beef", price: 85.00, costPrice: 62.00, category: "meat", groupId: "g3", unit: "kg", stock: 36, reorderLevel: 12, barcode: "941563812125", emoji: "🥩", taxable: false, batchNumber: "B-GBF-2402", receivedDate: daysFromNow(-3), expiryDate: daysFromNow(4), supplier: "Burma Farms" },
  { id: "p35", sku: "MT-003", name: "Pork Chops", price: 75.00, costPrice: 55.00, category: "meat", groupId: "g3", unit: "kg", stock: 28, reorderLevel: 10, barcode: "941563812126", emoji: "🥩", taxable: false, batchNumber: "B-PRK-2401", receivedDate: daysFromNow(-3), expiryDate: daysFromNow(5), supplier: "Burma Farms" },
  { id: "p36", sku: "MT-004", name: "Bacon 500g", price: 55.00, costPrice: 40.00, category: "meat", groupId: "g3", unit: "pack", stock: 51, reorderLevel: 15, barcode: "941563812127", emoji: "🥓", taxable: false, batchNumber: "B-BCN-2402", receivedDate: daysFromNow(-5), expiryDate: daysFromNow(20), supplier: "Burma Farms" },
  { id: "p37", sku: "MT-005", name: "Salmon Fillet", price: 120.00, costPrice: 90.00, category: "meat", groupId: "g3", unit: "kg", stock: 22, reorderLevel: 8, barcode: "941563812128", emoji: "🐟", taxable: false, batchNumber: "B-SAL-2403", receivedDate: daysFromNow(-2), expiryDate: daysFromNow(3), supplier: "Ocean Fresh Ltd" },
  { id: "p38", sku: "MT-006", name: "Shrimp", price: 100.00, costPrice: 75.00, category: "meat", groupId: "g3", unit: "kg", stock: 19, reorderLevel: 8, barcode: "941563812129", emoji: "🦐", taxable: false, batchNumber: "B-SHR-2402", receivedDate: daysFromNow(-2), expiryDate: daysFromNow(3), supplier: "Ocean Fresh Ltd" },
  { id: "p39", sku: "MT-007", name: "Sausages", price: 52.00, costPrice: 36.00, category: "meat", groupId: "g3", unit: "pack", stock: 47, reorderLevel: 15, barcode: "941563812130", emoji: "🌭", taxable: false, batchNumber: "B-SSG-2403", receivedDate: daysFromNow(-4), expiryDate: daysFromNow(12), supplier: "Darko Farms" },
  { id: "p40", sku: "MT-008", name: "Whole Chicken", price: 95.00, costPrice: 70.00, category: "meat", groupId: "g3", unit: "each", stock: 25, reorderLevel: 10, barcode: "941563812131", emoji: "🐔", taxable: false, batchNumber: "B-WCH-2402", receivedDate: daysFromNow(-2), expiryDate: daysFromNow(5), supplier: "Darko Farms" },

  // Bakery
  { id: "p41", sku: "BK-001", name: "White Bread", price: 20.00, costPrice: 12.00, category: "bakery", groupId: "g4", unit: "loaf", stock: 84, reorderLevel: 25, barcode: "941563812132", emoji: "🍞", taxable: false, batchNumber: "B-BRD-2404", receivedDate: daysFromNow(-1), expiryDate: daysFromNow(4), supplier: "Abeo Bakery" },
  { id: "p42", sku: "BK-002", name: "Croissants", price: 15.00, costPrice: 9.00, category: "bakery", groupId: "g4", unit: "each", stock: 56, reorderLevel: 20, barcode: "941563812133", emoji: "🥐", taxable: false, batchNumber: "B-CRS-2404", receivedDate: daysFromNow(-1), expiryDate: daysFromNow(3), supplier: "Abeo Bakery" },
  { id: "p43", sku: "BK-003", name: "Bagels (6pk)", price: 35.00, costPrice: 22.00, category: "bakery", groupId: "g4", unit: "pack", stock: 38, reorderLevel: 12, barcode: "941563812134", emoji: "🥯", taxable: false, batchNumber: "B-BGL-2402", receivedDate: daysFromNow(-2), expiryDate: daysFromNow(5), supplier: "Abeo Bakery" },
  { id: "p44", sku: "BK-004", name: "Donuts", price: 12.00, costPrice: 7.00, category: "bakery", groupId: "g4", unit: "each", stock: 72, reorderLevel: 25, barcode: "941563812135", emoji: "🍩", taxable: false, batchNumber: "B-DNT-2404", receivedDate: daysFromNow(-1), expiryDate: daysFromNow(3), supplier: "Abeo Bakery" },
  { id: "p45", sku: "BK-005", name: "Baguette", price: 25.00, costPrice: 16.00, category: "bakery", groupId: "g4", unit: "each", stock: 41, reorderLevel: 15, barcode: "941563812136", emoji: "🥖", taxable: false, batchNumber: "B-BGT-2403", receivedDate: daysFromNow(-1), expiryDate: daysFromNow(3), supplier: "Abeo Bakery" },
  { id: "p46", sku: "BK-006", name: "Muffins", price: 18.00, costPrice: 11.00, category: "bakery", groupId: "g4", unit: "each", stock: 58, reorderLevel: 20, barcode: "941563812137", emoji: "🧁", taxable: false, batchNumber: "B-MFF-2404", receivedDate: daysFromNow(-1), expiryDate: daysFromNow(4), supplier: "Abeo Bakery" },
  { id: "p47", sku: "BK-007", name: "Cinnamon Roll", price: 28.00, costPrice: 18.00, category: "bakery", groupId: "g4", unit: "each", stock: 34, reorderLevel: 12, barcode: "941563812138", emoji: "🥯", taxable: false, batchNumber: "B-CIN-2403", receivedDate: daysFromNow(-2), expiryDate: daysFromNow(4), supplier: "Abeo Bakery" },
  { id: "p48", sku: "BK-008", name: "Pancake Mix", price: 38.00, costPrice: 25.00, category: "bakery", groupId: "g4", unit: "box", stock: 49, reorderLevel: 15, barcode: "941563812139", emoji: "🥞", taxable: false, batchNumber: "B-PCK-2401", receivedDate: daysFromNow(-10), expiryDate: daysFromNow(180), supplier: "Global Foods GH" },

  // Beverages
  { id: "p49", sku: "BV-001", name: "Coca-Cola 2L", price: 22.00, costPrice: 15.00, category: "beverages", groupId: "g5", unit: "btl", stock: 124, reorderLevel: 40, barcode: "941563812140", emoji: "🥤", taxable: true, batchNumber: "B-COK-2403", receivedDate: daysFromNow(-7), expiryDate: daysFromNow(120), supplier: "Coca-Cola Ghana" },
  { id: "p50", sku: "BV-002", name: "Orange Juice 1L", price: 28.00, costPrice: 19.00, category: "beverages", groupId: "g5", unit: "btl", stock: 89, reorderLevel: 30, barcode: "941563812141", emoji: "🧃", taxable: true, batchNumber: "B-OJU-2403", receivedDate: daysFromNow(-5), expiryDate: daysFromNow(30), supplier: "Pulpy Juice GH" },
  { id: "p51", sku: "BV-003", name: "Sparkling Water", price: 15.00, costPrice: 9.00, category: "beverages", groupId: "g5", unit: "btl", stock: 102, reorderLevel: 30, barcode: "941563812142", emoji: "💧", taxable: true, batchNumber: "B-SKW-2402", receivedDate: daysFromNow(-8), expiryDate: daysFromNow(180), supplier: "Voltic Ghana" },
  { id: "p52", sku: "BV-004", name: "Coffee Beans 250g", price: 72.00, costPrice: 52.00, category: "beverages", groupId: "g5", unit: "bag", stock: 47, reorderLevel: 15, barcode: "941563812143", emoji: "☕", taxable: true, batchNumber: "B-COF-2402", receivedDate: daysFromNow(-12), expiryDate: daysFromNow(240), supplier: "Cafe Africa" },
  { id: "p53", sku: "BV-005", name: "Green Tea", price: 44.00, costPrice: 30.00, category: "beverages", groupId: "g5", unit: "box", stock: 63, reorderLevel: 20, barcode: "941563812144", emoji: "🍵", taxable: true, batchNumber: "B-GTE-2401", receivedDate: daysFromNow(-15), expiryDate: daysFromNow(365), supplier: "Global Foods GH" },
  { id: "p54", sku: "BV-006", name: "Red Bull", price: 28.00, costPrice: 20.00, category: "beverages", groupId: "g5", unit: "can", stock: 96, reorderLevel: 30, barcode: "941563812145", emoji: "⚡", taxable: true, batchNumber: "B-RDB-2403", receivedDate: daysFromNow(-6), expiryDate: daysFromNow(300), supplier: "Red Bull GH" },
  { id: "p55", sku: "BV-007", name: "Bottled Water 24pk", price: 48.00, costPrice: 32.00, category: "beverages", groupId: "g5", unit: "pack", stock: 78, reorderLevel: 25, barcode: "941563812146", emoji: "💧", taxable: true, batchNumber: "B-BWT-2403", receivedDate: daysFromNow(-5), expiryDate: daysFromNow(365), supplier: "Voltic Ghana" },
  { id: "p56", sku: "BV-008", name: "Wine Bottle", price: 120.00, costPrice: 85.00, category: "beverages", groupId: "g5", unit: "btl", stock: 36, reorderLevel: 12, barcode: "941563812147", emoji: "🍷", taxable: true, batchNumber: "B-WNE-2402", receivedDate: daysFromNow(-20), expiryDate: daysFromNow(720), supplier: "Dupaul Wines" },

  // Snacks
  { id: "p57", sku: "SN-001", name: "Potato Chips", price: 18.00, costPrice: 11.00, category: "snacks", groupId: "g6", unit: "bag", stock: 134, reorderLevel: 40, barcode: "941563812148", emoji: "🍟", taxable: true, batchNumber: "B-PCH-2403", receivedDate: daysFromNow(-10), expiryDate: daysFromNow(90), supplier: "Global Foods GH" },
  { id: "p58", sku: "SN-002", name: "Chocolate Bar", price: 12.00, costPrice: 7.00, category: "snacks", groupId: "g6", unit: "each", stock: 187, reorderLevel: 50, barcode: "941563812149", emoji: "🍫", taxable: true, batchNumber: "B-CHC-2403", receivedDate: daysFromNow(-8), expiryDate: daysFromNow(180), supplier: "Global Foods GH" },
  { id: "p59", sku: "SN-003", name: "Cookies", price: 25.00, costPrice: 16.00, category: "snacks", groupId: "g6", unit: "box", stock: 92, reorderLevel: 30, barcode: "941563812150", emoji: "🍪", taxable: true, batchNumber: "B-COK-2402", receivedDate: daysFromNow(-9), expiryDate: daysFromNow(120), supplier: "Global Foods GH" },
  { id: "p60", sku: "SN-004", name: "Popcorn", price: 18.00, costPrice: 11.00, category: "snacks", groupId: "g6", unit: "bag", stock: 76, reorderLevel: 25, barcode: "941563812151", emoji: "🍿", taxable: true, batchNumber: "B-PCR-2402", receivedDate: daysFromNow(-11), expiryDate: daysFromNow(150), supplier: "Global Foods GH" },
  { id: "p61", sku: "SN-005", name: "Pretzels", price: 22.00, costPrice: 14.00, category: "snacks", groupId: "g6", unit: "bag", stock: 65, reorderLevel: 20, barcode: "941563812152", emoji: "🥨", taxable: true, batchNumber: "B-PRT-2401", receivedDate: daysFromNow(-12), expiryDate: daysFromNow(180), supplier: "Global Foods GH" },
  { id: "p62", sku: "SN-006", name: "Nuts Mix", price: 55.00, costPrice: 38.00, category: "snacks", groupId: "g6", unit: "jar", stock: 48, reorderLevel: 15, barcode: "941563812153", emoji: "🥜", taxable: true, batchNumber: "B-NUT-2402", receivedDate: daysFromNow(-14), expiryDate: daysFromNow(240), supplier: "Global Foods GH" },
  { id: "p63", sku: "SN-007", name: "Crackers", price: 20.00, costPrice: 13.00, category: "snacks", groupId: "g6", unit: "box", stock: 84, reorderLevel: 25, barcode: "941563812154", emoji: "🍘", taxable: true, batchNumber: "B-CRK-2402", receivedDate: daysFromNow(-13), expiryDate: daysFromNow(200), supplier: "Global Foods GH" },
  { id: "p64", sku: "SN-008", name: "Candy Pack", price: 15.00, costPrice: 8.00, category: "snacks", groupId: "g6", unit: "pack", stock: 156, reorderLevel: 40, barcode: "941563812155", emoji: "🍬", taxable: true, batchNumber: "B-CND-2403", receivedDate: daysFromNow(-7), expiryDate: daysFromNow(300), supplier: "Global Foods GH" },

  // Frozen Foods
  { id: "p65", sku: "FZ-001", name: "Pizza", price: 55.00, costPrice: 38.00, category: "frozen", groupId: "g7", unit: "each", stock: 67, reorderLevel: 20, barcode: "941563812156", emoji: "🍕", taxable: true, batchNumber: "B-PZA-2403", receivedDate: daysFromNow(-7), expiryDate: daysFromNow(120), supplier: "Frozen Foods GH" },
  { id: "p66", sku: "FZ-002", name: "Ice Cream 1L", price: 42.00, costPrice: 28.00, category: "frozen", groupId: "g7", unit: "tub", stock: 54, reorderLevel: 18, barcode: "941563812157", emoji: "🍨", taxable: true, batchNumber: "B-ICR-2403", receivedDate: daysFromNow(-5), expiryDate: daysFromNow(180), supplier: "Fan Milk Ghana" },
  { id: "p67", sku: "FZ-003", name: "Frozen Berries", price: 40.00, costPrice: 28.00, category: "frozen", groupId: "g7", unit: "bag", stock: 38, reorderLevel: 12, barcode: "941563812158", emoji: "🫐", taxable: true, batchNumber: "B-FBR-2402", receivedDate: daysFromNow(-8), expiryDate: daysFromNow(240), supplier: "Fresh Imports" },
  { id: "p68", sku: "FZ-004", name: "Frozen Fries", price: 32.00, costPrice: 22.00, category: "frozen", groupId: "g7", unit: "bag", stock: 89, reorderLevel: 25, barcode: "941563812159", emoji: "🍟", taxable: true, batchNumber: "B-FFR-2403", receivedDate: daysFromNow(-6), expiryDate: daysFromNow(300), supplier: "Frozen Foods GH" },
  { id: "p69", sku: "FZ-005", name: "Fish Sticks", price: 58.00, costPrice: 42.00, category: "frozen", groupId: "g7", unit: "box", stock: 42, reorderLevel: 15, barcode: "941563812160", emoji: "🐟", taxable: true, batchNumber: "B-FST-2402", receivedDate: daysFromNow(-9), expiryDate: daysFromNow(240), supplier: "Ocean Fresh Ltd" },
  { id: "p70", sku: "FZ-006", name: "Frozen Veggies", price: 24.00, costPrice: 16.00, category: "frozen", groupId: "g7", unit: "bag", stock: 76, reorderLevel: 25, barcode: "941563812161", emoji: "🥦", taxable: true, batchNumber: "B-FVG-2403", receivedDate: daysFromNow(-7), expiryDate: daysFromNow(365), supplier: "Frozen Foods GH" },
  { id: "p71", sku: "FZ-007", name: "Frozen Meals", price: 48.00, costPrice: 32.00, category: "frozen", groupId: "g7", unit: "each", stock: 58, reorderLevel: 18, barcode: "941563812162", emoji: "🍱", taxable: true, batchNumber: "B-FML-2402", receivedDate: daysFromNow(-8), expiryDate: daysFromNow(180), supplier: "Frozen Foods GH" },
  { id: "p72", sku: "FZ-008", name: "Popsicles", price: 35.00, costPrice: 22.00, category: "frozen", groupId: "g7", unit: "box", stock: 45, reorderLevel: 15, barcode: "941563812163", emoji: "🍦", taxable: true, batchNumber: "B-POP-2403", receivedDate: daysFromNow(-4), expiryDate: daysFromNow(150), supplier: "Fan Milk Ghana" },

  // Pantry
  { id: "p73", sku: "PT-001", name: "Rice 5kg", price: 95.00, costPrice: 72.00, category: "pantry", groupId: "g8", unit: "bag", stock: 64, reorderLevel: 20, barcode: "941563812164", emoji: "🍚", taxable: true, batchNumber: "B-RIC-2403", receivedDate: daysFromNow(-15), expiryDate: daysFromNow(365), supplier: "Global Foods GH" },
  { id: "p74", sku: "PT-002", name: "Pasta 500g", price: 18.00, costPrice: 11.00, category: "pantry", groupId: "g8", unit: "box", stock: 124, reorderLevel: 40, barcode: "941563812165", emoji: "🍝", taxable: true, batchNumber: "B-PST-2403", receivedDate: daysFromNow(-12), expiryDate: daysFromNow(365), supplier: "Global Foods GH" },
  { id: "p75", sku: "PT-003", name: "Pasta Sauce", price: 32.00, costPrice: 22.00, category: "pantry", groupId: "g8", unit: "jar", stock: 89, reorderLevel: 25, barcode: "941563812166", emoji: "🥫", taxable: true, batchNumber: "B-PSA-2402", receivedDate: daysFromNow(-10), expiryDate: daysFromNow(300), supplier: "Global Foods GH" },
  { id: "p76", sku: "PT-004", name: "Olive Oil 1L", price: 75.00, costPrice: 55.00, category: "pantry", groupId: "g8", unit: "btl", stock: 47, reorderLevel: 15, barcode: "941563812167", emoji: "🫒", taxable: true, batchNumber: "B-OLV-2402", receivedDate: daysFromNow(-20), expiryDate: daysFromNow(540), supplier: "Global Foods GH" },
  { id: "p77", sku: "PT-005", name: "Flour 2kg", price: 28.00, costPrice: 18.00, category: "pantry", groupId: "g8", unit: "bag", stock: 92, reorderLevel: 30, barcode: "941563812168", emoji: "🌾", taxable: true, batchNumber: "B-FLR-2403", receivedDate: daysFromNow(-8), expiryDate: daysFromNow(240), supplier: "Irwin Foods GH" },
  { id: "p78", sku: "PT-006", name: "Sugar 1kg", price: 18.00, costPrice: 12.00, category: "pantry", groupId: "g8", unit: "bag", stock: 108, reorderLevel: 30, barcode: "941563812169", emoji: "🧂", taxable: true, batchNumber: "B-SGR-2403", receivedDate: daysFromNow(-10), expiryDate: daysFromNow(365), supplier: "Irwin Foods GH" },
  { id: "p79", sku: "PT-007", name: "Salt", price: 5.00, costPrice: 3.00, category: "pantry", groupId: "g8", unit: "box", stock: 156, reorderLevel: 40, barcode: "941563812170", emoji: "🧂", taxable: true, batchNumber: "B-SLT-2402", receivedDate: daysFromNow(-25), expiryDate: daysFromNow(730), supplier: "Irwin Foods GH" },
  { id: "p80", sku: "PT-008", name: "Canned Tuna", price: 22.00, costPrice: 14.00, category: "pantry", groupId: "g8", unit: "can", stock: 134, reorderLevel: 40, barcode: "941563812171", emoji: "🐟", taxable: true, batchNumber: "B-CTN-2403", receivedDate: daysFromNow(-14), expiryDate: daysFromNow(540), supplier: "Ocean Fresh Ltd" },
  { id: "p81", sku: "PT-009", name: "Cereal Box", price: 42.00, costPrice: 28.00, category: "pantry", groupId: "g8", unit: "box", stock: 78, reorderLevel: 25, barcode: "941563812172", emoji: "🥣", taxable: true, batchNumber: "B-CER-2402", receivedDate: daysFromNow(-9), expiryDate: daysFromNow(240), supplier: "Global Foods GH" },
  { id: "p82", sku: "PT-010", name: "Peanut Butter", price: 48.00, costPrice: 33.00, category: "pantry", groupId: "g8", unit: "jar", stock: 65, reorderLevel: 20, barcode: "941563812173", emoji: "🥜", taxable: true, batchNumber: "B-PBT-2402", receivedDate: daysFromNow(-11), expiryDate: daysFromNow(365), supplier: "Global Foods GH" },

  // Household
  { id: "p83", sku: "HH-001", name: "Dish Soap", price: 18.00, costPrice: 11.00, category: "household", groupId: "g9", unit: "btl", stock: 87, reorderLevel: 25, barcode: "941563812174", emoji: "🧴", taxable: true, batchNumber: "B-DSH-2403", receivedDate: daysFromNow(-12), expiryDate: daysFromNow(540), supplier: "Unilever Ghana" },
  { id: "p84", sku: "HH-002", name: "Laundry Detergent", price: 65.00, costPrice: 45.00, category: "household", groupId: "g9", unit: "btl", stock: 54, reorderLevel: 18, barcode: "941563812175", emoji: "🧺", taxable: true, batchNumber: "B-LDR-2402", receivedDate: daysFromNow(-10), expiryDate: daysFromNow(365), supplier: "Unilever Ghana" },
  { id: "p85", sku: "HH-003", name: "Paper Towels", price: 35.00, costPrice: 22.00, category: "household", groupId: "g9", unit: "pack", stock: 76, reorderLevel: 25, barcode: "941563812176", emoji: "🧻", taxable: true, batchNumber: "B-PTW-2403", receivedDate: daysFromNow(-8), expiryDate: daysFromNow(730), supplier: "Global Foods GH" },
  { id: "p86", sku: "HH-004", name: "Toilet Paper 12pk", price: 55.00, costPrice: 38.00, category: "household", groupId: "g9", unit: "pack", stock: 92, reorderLevel: 30, barcode: "941563812177", emoji: "🧻", taxable: true, batchNumber: "B-TPT-2403", receivedDate: daysFromNow(-9), expiryDate: daysFromNow(730), supplier: "Global Foods GH" },
  { id: "p87", sku: "HH-005", name: "Trash Bags", price: 28.00, costPrice: 18.00, category: "household", groupId: "g9", unit: "box", stock: 68, reorderLevel: 20, barcode: "941563812178", emoji: "🗑️", taxable: true, batchNumber: "B-TBG-2402", receivedDate: daysFromNow(-11), expiryDate: daysFromNow(730), supplier: "Global Foods GH" },
  { id: "p88", sku: "HH-006", name: "All-Purpose Cleaner", price: 32.00, costPrice: 21.00, category: "household", groupId: "g9", unit: "btl", stock: 73, reorderLevel: 22, barcode: "941563812179", emoji: "🧴", taxable: true, batchNumber: "B-APC-2402", receivedDate: daysFromNow(-10), expiryDate: daysFromNow(540), supplier: "Unilever Ghana" },
  { id: "p89", sku: "HH-007", name: "Sponges (3pk)", price: 15.00, costPrice: 9.00, category: "household", groupId: "g9", unit: "pack", stock: 112, reorderLevel: 30, barcode: "941563812180", emoji: "🧽", taxable: true, batchNumber: "B-SPG-2403", receivedDate: daysFromNow(-14), expiryDate: daysFromNow(730), supplier: "Global Foods GH" },
  { id: "p90", sku: "HH-008", name: "Aluminum Foil", price: 22.00, costPrice: 14.00, category: "household", groupId: "g9", unit: "box", stock: 84, reorderLevel: 25, barcode: "941563812181", emoji: "📜", taxable: true, batchNumber: "B-ALF-2402", receivedDate: daysFromNow(-13), expiryDate: daysFromNow(730), supplier: "Global Foods GH" },
];

// Seed stock history
export const initialStockHistory: StockHistoryEntry[] = [
  { id: "h1", productId: "p1", productName: "Red Apples", sku: "FR-001", action: 'received', quantityChange: 124, newQuantity: 124, timestamp: daysFromNow(-5) + "T08:30:00", user: "Sarah Johnson", reason: "Initial stock receipt", reference: "GRN-001" },
  { id: "h2", productId: "p25", productName: "Whole Milk 1L", sku: "DR-001", action: 'received', quantityChange: 156, newQuantity: 156, timestamp: daysFromNow(-2) + "T09:15:00", user: "Sarah Johnson", reason: "Stock delivery from Fan Milk", reference: "GRN-002" },
  { id: "h3", productId: "p27", productName: "Eggs (Dozen)", sku: "DR-003", action: 'received', quantityChange: 88, newQuantity: 88, timestamp: daysFromNow(-3) + "T10:00:00", user: "Mike Mensah", reason: "Fresh stock from Akate Farms", reference: "GRN-003" },
  { id: "h4", productId: "p41", productName: "White Bread", sku: "BK-001", action: 'received', quantityChange: 84, newQuantity: 84, timestamp: daysFromNow(-1) + "T06:45:00", user: "Sarah Johnson", reason: "Daily bakery delivery", reference: "GRN-004" },
  { id: "h5", productId: "p49", productName: "Coca-Cola 2L", sku: "BV-001", action: 'adjusted', quantityChange: -2, newQuantity: 124, timestamp: daysFromNow(-1) + "T14:20:00", user: "Sarah Johnson", reason: "Damaged bottles removed", reference: "ADJ-001" },
  { id: "h6", productId: "p34", productName: "Ground Beef", sku: "MT-002", action: 'modified', quantityChange: 0, newQuantity: 36, timestamp: daysFromNow(-3) + "T11:00:00", user: "Mike Mensah", reason: "Price updated from ₵80 to ₵85", reference: "MOD-001" },
  { id: "h7", productId: "p33", productName: "Chicken Breast", sku: "MT-001", action: 'received', quantityChange: 42, newQuantity: 42, timestamp: daysFromNow(-2) + "T07:30:00", user: "Sarah Johnson", reason: "Stock from Darko Farms", reference: "GRN-005" },
  { id: "h8", productId: "p73", productName: "Rice 5kg", sku: "PT-001", action: 'received', quantityChange: 64, newQuantity: 64, timestamp: daysFromNow(-15) + "T13:00:00", user: "Mike Mensah", reason: "Bulk purchase", reference: "GRN-006" },
];

export const paymentMethods = [
  { id: "cash", name: "Cash", icon: "💵", color: "emerald" },
  { id: "card", name: "Card", icon: "💳", color: "blue" },
  { id: "wallet", name: "Mobile Money", icon: "📱", color: "purple" },
];

export const quickCashAmounts = [5, 10, 20, 50, 100, 200];

export const TAX_RATE = 0.15; // 15% VAT
export const TAX_NAME = "VAT";

// Helper to format currency in GHS
export function formatGHS(amount: number): string {
  return `${CURRENCY}${amount.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
