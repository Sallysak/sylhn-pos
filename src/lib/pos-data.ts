// Modern Grocery Store POS - Product Catalog Data

export interface Product {
  id: string;
  sku: string;
  name: string;
  price: number;
  category: string;
  unit: string;
  stock: number;
  barcode: string;
  emoji: string;
  taxable: boolean;
  discount?: number; // percentage
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  gradient: string;
}

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

export const products: Product[] = [
  // Fruits
  { id: "p1", sku: "FR-001", name: "Red Apples", price: 3.49, category: "fruits", unit: "kg", stock: 124, barcode: "941563812092", emoji: "🍎", taxable: false },
  { id: "p2", sku: "FR-002", name: "Bananas", price: 1.89, category: "fruits", unit: "kg", stock: 89, barcode: "941563812093", emoji: "🍌", taxable: false },
  { id: "p3", sku: "FR-003", name: "Oranges", price: 4.20, category: "fruits", unit: "kg", stock: 76, barcode: "941563812094", emoji: "🍊", taxable: false },
  { id: "p4", sku: "FR-004", name: "Strawberries", price: 5.99, category: "fruits", unit: "box", stock: 32, barcode: "941563812095", emoji: "🍓", taxable: false },
  { id: "p5", sku: "FR-005", name: "Grapes - Green", price: 6.49, category: "fruits", unit: "kg", stock: 45, barcode: "941563812096", emoji: "🍇", taxable: false },
  { id: "p6", sku: "FR-006", name: "Watermelon", price: 7.99, category: "fruits", unit: "each", stock: 18, barcode: "941563812097", emoji: "🍉", taxable: false },
  { id: "p7", sku: "FR-007", name: "Pineapple", price: 4.50, category: "fruits", unit: "each", stock: 24, barcode: "941563812098", emoji: "🍍", taxable: false },
  { id: "p8", sku: "FR-008", name: "Mango", price: 2.99, category: "fruits", unit: "each", stock: 56, barcode: "941563812099", emoji: "🥭", taxable: false },
  { id: "p9", sku: "FR-009", name: "Avocado", price: 1.79, category: "fruits", unit: "each", stock: 78, barcode: "941563812100", emoji: "🥑", taxable: false },
  { id: "p10", sku: "FR-010", name: "Lemons", price: 0.79, category: "fruits", unit: "each", stock: 112, barcode: "941563812101", emoji: "🍋", taxable: false },
  { id: "p11", sku: "FR-011", name: "Blueberries", price: 4.99, category: "fruits", unit: "box", stock: 28, barcode: "941563812102", emoji: "🫐", taxable: false },
  { id: "p12", sku: "FR-012", name: "Peaches", price: 3.79, category: "fruits", unit: "kg", stock: 41, barcode: "941563812103", emoji: "🍑", taxable: false },

  // Vegetables
  { id: "p13", sku: "VG-001", name: "Carrots", price: 2.29, category: "vegetables", unit: "kg", stock: 95, barcode: "941563812104", emoji: "🥕", taxable: false },
  { id: "p14", sku: "VG-002", name: "Broccoli", price: 3.49, category: "vegetables", unit: "each", stock: 62, barcode: "941563812105", emoji: "🥦", taxable: false },
  { id: "p15", sku: "VG-003", name: "Tomatoes", price: 4.59, category: "vegetables", unit: "kg", stock: 87, barcode: "941563812106", emoji: "🍅", taxable: false },
  { id: "p16", sku: "VG-004", name: "Potatoes", price: 2.99, category: "vegetables", unit: "kg", stock: 134, barcode: "941563812107", emoji: "🥔", taxable: false },
  { id: "p17", sku: "VG-005", name: "Onions", price: 2.49, category: "vegetables", unit: "kg", stock: 98, barcode: "941563812108", emoji: "🧅", taxable: false },
  { id: "p18", sku: "VG-006", name: "Bell Peppers", price: 1.29, category: "vegetables", unit: "each", stock: 73, barcode: "941563812109", emoji: "🫑", taxable: false },
  { id: "p19", sku: "VG-007", name: "Cucumber", price: 0.99, category: "vegetables", unit: "each", stock: 65, barcode: "941563812110", emoji: "🥒", taxable: false },
  { id: "p20", sku: "VG-008", name: "Lettuce", price: 2.79, category: "vegetables", unit: "head", stock: 48, barcode: "941563812111", emoji: "🥬", taxable: false },
  { id: "p21", sku: "VG-009", name: "Corn", price: 0.69, category: "vegetables", unit: "each", stock: 84, barcode: "941563812112", emoji: "🌽", taxable: false },
  { id: "p22", sku: "VG-010", name: "Mushrooms", price: 3.99, category: "vegetables", unit: "box", stock: 36, barcode: "941563812113", emoji: "🍄", taxable: false },
  { id: "p23", sku: "VG-011", name: "Garlic", price: 0.50, category: "vegetables", unit: "each", stock: 120, barcode: "941563812114", emoji: "🧄", taxable: false },
  { id: "p24", sku: "VG-012", name: "Sweet Potato", price: 3.19, category: "vegetables", unit: "kg", stock: 79, barcode: "941563812115", emoji: "🍠", taxable: false },

  // Dairy & Eggs
  { id: "p25", sku: "DR-001", name: "Whole Milk 1L", price: 2.49, category: "dairy", unit: "btl", stock: 156, barcode: "941563812116", emoji: "🥛", taxable: false },
  { id: "p26", sku: "DR-002", name: "Skim Milk 1L", price: 2.59, category: "dairy", unit: "btl", stock: 142, barcode: "941563812117", emoji: "🥛", taxable: false },
  { id: "p27", sku: "DR-003", name: "Eggs (Dozen)", price: 4.99, category: "dairy", unit: "dz", stock: 88, barcode: "941563812118", emoji: "🥚", taxable: false },
  { id: "p28", sku: "DR-004", name: "Cheddar Cheese", price: 6.49, category: "dairy", unit: "block", stock: 54, barcode: "941563812119", emoji: "🧀", taxable: false },
  { id: "p29", sku: "DR-005", name: "Greek Yogurt", price: 3.79, category: "dairy", unit: "tub", stock: 67, barcode: "941563812120", emoji: "🥣", taxable: false },
  { id: "p30", sku: "DR-006", name: "Butter 250g", price: 4.29, category: "dairy", unit: "block", stock: 73, barcode: "941563812121", emoji: "🧈", taxable: false },
  { id: "p31", sku: "DR-007", name: "Cream Cheese", price: 3.49, category: "dairy", unit: "tub", stock: 45, barcode: "941563812122", emoji: "🧀", taxable: false },
  { id: "p32", sku: "DR-008", name: "Heavy Cream", price: 3.99, category: "dairy", unit: "btl", stock: 38, barcode: "941563812123", emoji: "🥛", taxable: false },

  // Meat & Poultry
  { id: "p33", sku: "MT-001", name: "Chicken Breast", price: 8.99, category: "meat", unit: "kg", stock: 42, barcode: "941563812124", emoji: "🍗", taxable: false },
  { id: "p34", sku: "MT-002", name: "Ground Beef", price: 11.49, category: "meat", unit: "kg", stock: 36, barcode: "941563812125", emoji: "🥩", taxable: false },
  { id: "p35", sku: "MT-003", name: "Pork Chops", price: 9.79, category: "meat", unit: "kg", stock: 28, barcode: "941563812126", emoji: "🥩", taxable: false },
  { id: "p36", sku: "MT-004", name: "Bacon 500g", price: 7.49, category: "meat", unit: "pack", stock: 51, barcode: "941563812127", emoji: "🥓", taxable: false },
  { id: "p37", sku: "MT-005", name: "Salmon Fillet", price: 15.99, category: "meat", unit: "kg", stock: 22, barcode: "941563812128", emoji: "🐟", taxable: false },
  { id: "p38", sku: "MT-006", name: "Shrimp", price: 13.49, category: "meat", unit: "kg", stock: 19, barcode: "941563812129", emoji: "🦐", taxable: false },
  { id: "p39", sku: "MT-007", name: "Sausages", price: 6.99, category: "meat", unit: "pack", stock: 47, barcode: "941563812130", emoji: "🌭", taxable: false },
  { id: "p40", sku: "MT-008", name: "Whole Chicken", price: 12.99, category: "meat", unit: "each", stock: 25, barcode: "941563812131", emoji: "🐔", taxable: false },

  // Bakery
  { id: "p41", sku: "BK-001", name: "White Bread", price: 2.99, category: "bakery", unit: "loaf", stock: 84, barcode: "941563812132", emoji: "🍞", taxable: false },
  { id: "p42", sku: "BK-002", name: "Croissants", price: 1.99, category: "bakery", unit: "each", stock: 56, barcode: "941563812133", emoji: "🥐", taxable: false },
  { id: "p43", sku: "BK-003", name: "Bagels (6pk)", price: 4.49, category: "bakery", unit: "pack", stock: 38, barcode: "941563812134", emoji: "🥯", taxable: false },
  { id: "p44", sku: "BK-004", name: "Donuts", price: 1.49, category: "bakery", unit: "each", stock: 72, barcode: "941563812135", emoji: "🍩", taxable: false },
  { id: "p45", sku: "BK-005", name: "Baguette", price: 3.29, category: "bakery", unit: "each", stock: 41, barcode: "941563812136", emoji: "🥖", taxable: false },
  { id: "p46", sku: "BK-006", name: "Muffins", price: 2.49, category: "bakery", unit: "each", stock: 58, barcode: "941563812137", emoji: "🧁", taxable: false },
  { id: "p47", sku: "BK-007", name: "Cinnamon Roll", price: 3.49, category: "bakery", unit: "each", stock: 34, barcode: "941563812138", emoji: "🥯", taxable: false },
  { id: "p48", sku: "BK-008", name: "Pancake Mix", price: 4.79, category: "bakery", unit: "box", stock: 49, barcode: "941563812139", emoji: "🥞", taxable: false },

  // Beverages
  { id: "p49", sku: "BV-001", name: "Coca-Cola 2L", price: 2.99, category: "beverages", unit: "btl", stock: 124, barcode: "941563812140", emoji: "🥤", taxable: true },
  { id: "p50", sku: "BV-002", name: "Orange Juice 1L", price: 3.49, category: "beverages", unit: "btl", stock: 89, barcode: "941563812141", emoji: "🧃", taxable: true },
  { id: "p51", sku: "BV-003", name: "Sparkling Water", price: 1.99, category: "beverages", unit: "btl", stock: 102, barcode: "941563812142", emoji: "💧", taxable: true },
  { id: "p52", sku: "BV-004", name: "Coffee Beans 250g", price: 8.99, category: "beverages", unit: "bag", stock: 47, barcode: "941563812143", emoji: "☕", taxable: true },
  { id: "p53", sku: "BV-005", name: "Green Tea", price: 5.49, category: "beverages", unit: "box", stock: 63, barcode: "941563812144", emoji: "🍵", taxable: true },
  { id: "p54", sku: "BV-006", name: "Red Bull", price: 3.49, category: "beverages", unit: "can", stock: 96, barcode: "941563812145", emoji: "⚡", taxable: true },
  { id: "p55", sku: "BV-007", name: "Bottled Water 24pk", price: 5.99, category: "beverages", unit: "pack", stock: 78, barcode: "941563812146", emoji: "💧", taxable: true },
  { id: "p56", sku: "BV-008", name: "Wine Bottle", price: 14.99, category: "beverages", unit: "btl", stock: 36, barcode: "941563812147", emoji: "🍷", taxable: true },

  // Snacks
  { id: "p57", sku: "SN-001", name: "Potato Chips", price: 3.49, category: "snacks", unit: "bag", stock: 134, barcode: "941563812148", emoji: "🍟", taxable: true },
  { id: "p58", sku: "SN-002", name: "Chocolate Bar", price: 1.99, category: "snacks", unit: "each", stock: 187, barcode: "941563812149", emoji: "🍫", taxable: true },
  { id: "p59", sku: "SN-003", name: "Cookies", price: 4.29, category: "snacks", unit: "box", stock: 92, barcode: "941563812150", emoji: "🍪", taxable: true },
  { id: "p60", sku: "SN-004", name: "Popcorn", price: 2.99, category: "snacks", unit: "bag", stock: 76, barcode: "941563812151", emoji: "🍿", taxable: true },
  { id: "p61", sku: "SN-005", name: "Pretzels", price: 3.79, category: "snacks", unit: "bag", stock: 65, barcode: "941563812152", emoji: "🥨", taxable: true },
  { id: "p62", sku: "SN-006", name: "Nuts Mix", price: 7.49, category: "snacks", unit: "jar", stock: 48, barcode: "941563812153", emoji: "🥜", taxable: true },
  { id: "p63", sku: "SN-007", name: "Crackers", price: 3.29, category: "snacks", unit: "box", stock: 84, barcode: "941563812154", emoji: "🍘", taxable: true },
  { id: "p64", sku: "SN-008", name: "Candy Pack", price: 2.49, category: "snacks", unit: "pack", stock: 156, barcode: "941563812155", emoji: "🍬", taxable: true },

  // Frozen Foods
  { id: "p65", sku: "FZ-001", name: "Pizza", price: 6.99, category: "frozen", unit: "each", stock: 67, barcode: "941563812156", emoji: "🍕", taxable: true },
  { id: "p66", sku: "FZ-002", name: "Ice Cream 1L", price: 5.49, category: "frozen", unit: "tub", stock: 54, barcode: "941563812157", emoji: "🍨", taxable: true },
  { id: "p67", sku: "FZ-003", name: "Frozen Berries", price: 4.99, category: "frozen", unit: "bag", stock: 38, barcode: "941563812158", emoji: "🫐", taxable: true },
  { id: "p68", sku: "FZ-004", name: "Frozen Fries", price: 3.99, category: "frozen", unit: "bag", stock: 89, barcode: "941563812159", emoji: "🍟", taxable: true },
  { id: "p69", sku: "FZ-005", name: "Fish Sticks", price: 7.49, category: "frozen", unit: "box", stock: 42, barcode: "941563812160", emoji: "🐟", taxable: true },
  { id: "p70", sku: "FZ-006", name: "Frozen Veggies", price: 2.99, category: "frozen", unit: "bag", stock: 76, barcode: "941563812161", emoji: "🥦", taxable: true },
  { id: "p71", sku: "FZ-007", name: "Frozen Meals", price: 5.99, category: "frozen", unit: "each", stock: 58, barcode: "941563812162", emoji: "🍱", taxable: true },
  { id: "p72", sku: "FZ-008", name: "Popsicles", price: 4.49, category: "frozen", unit: "box", stock: 45, barcode: "941563812163", emoji: "🍦", taxable: true },

  // Pantry
  { id: "p73", sku: "PT-001", name: "Rice 5kg", price: 12.99, category: "pantry", unit: "bag", stock: 64, barcode: "941563812164", emoji: "🍚", taxable: true },
  { id: "p74", sku: "PT-002", name: "Pasta 500g", price: 2.49, category: "pantry", unit: "box", stock: 124, barcode: "941563812165", emoji: "🍝", taxable: true },
  { id: "p75", sku: "PT-003", name: "Pasta Sauce", price: 3.99, category: "pantry", unit: "jar", stock: 89, barcode: "941563812166", emoji: "🥫", taxable: true },
  { id: "p76", sku: "PT-004", name: "Olive Oil 1L", price: 9.49, category: "pantry", unit: "btl", stock: 47, barcode: "941563812167", emoji: "🫒", taxable: true },
  { id: "p77", sku: "PT-005", name: "Flour 2kg", price: 3.49, category: "pantry", unit: "bag", stock: 92, barcode: "941563812168", emoji: "🌾", taxable: true },
  { id: "p78", sku: "PT-006", name: "Sugar 1kg", price: 2.29, category: "pantry", unit: "bag", stock: 108, barcode: "941563812169", emoji: "🧂", taxable: true },
  { id: "p79", sku: "PT-007", name: "Salt", price: 1.49, category: "pantry", unit: "box", stock: 156, barcode: "941563812170", emoji: "🧂", taxable: true },
  { id: "p80", sku: "PT-008", name: "Canned Tuna", price: 2.99, category: "pantry", unit: "can", stock: 134, barcode: "941563812171", emoji: "🐟", taxable: true },
  { id: "p81", sku: "PT-009", name: "Cereal Box", price: 5.49, category: "pantry", unit: "box", stock: 78, barcode: "941563812172", emoji: "🥣", taxable: true },
  { id: "p82", sku: "PT-010", name: "Peanut Butter", price: 6.49, category: "pantry", unit: "jar", stock: 65, barcode: "941563812173", emoji: "🥜", taxable: true },

  // Household
  { id: "p83", sku: "HH-001", name: "Dish Soap", price: 3.99, category: "household", unit: "btl", stock: 87, barcode: "941563812174", emoji: "🧴", taxable: true },
  { id: "p84", sku: "HH-002", name: "Laundry Detergent", price: 12.49, category: "household", unit: "btl", stock: 54, barcode: "941563812175", emoji: "🧺", taxable: true },
  { id: "p85", sku: "HH-003", name: "Paper Towels", price: 7.99, category: "household", unit: "pack", stock: 76, barcode: "941563812176", emoji: "🧻", taxable: true },
  { id: "p86", sku: "HH-004", name: "Toilet Paper 12pk", price: 9.99, category: "household", unit: "pack", stock: 92, barcode: "941563812177", emoji: "🧻", taxable: true },
  { id: "p87", sku: "HH-005", name: "Trash Bags", price: 5.49, category: "household", unit: "box", stock: 68, barcode: "941563812178", emoji: "🗑️", taxable: true },
  { id: "p88", sku: "HH-006", name: "All-Purpose Cleaner", price: 4.99, category: "household", unit: "btl", stock: 73, barcode: "941563812179", emoji: "🧴", taxable: true },
  { id: "p89", sku: "HH-007", name: "Sponges (3pk)", price: 2.99, category: "household", unit: "pack", stock: 112, barcode: "941563812180", emoji: "🧽", taxable: true },
  { id: "p90", sku: "HH-008", name: "Aluminum Foil", price: 3.49, category: "household", unit: "box", stock: 84, barcode: "941563812181", emoji: "📜", taxable: true },
];

export const paymentMethods = [
  { id: "cash", name: "Cash", icon: "💵", color: "emerald" },
  { id: "card", name: "Card", icon: "💳", color: "blue" },
  { id: "wallet", name: "Digital Wallet", icon: "📱", color: "purple" },
];

export const quickCashAmounts = [5, 10, 20, 50, 100];

export const TAX_RATE = 0.15; // 15% GST
export const STORE_NAME = "FreshMart Grocery";
export const STORE_ADDRESS = "123 Market Street, Accra Central";
export const STORE_PHONE = "+233 30 123 4567";
