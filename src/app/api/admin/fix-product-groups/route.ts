import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { auditLog } from "@/lib/audit";

// POST /api/admin/fix-product-groups — one-time fix to set groupId on
// existing products that were imported/created before the v3.1.0 fix.
//
// What it does:
//   1. Fetches all products (with or without groupId)
//   2. Fetches all stock groups
//   3. For each product with no groupId (or groupId not matching any group):
//      - Tries to match the product's `category` string to a group's `name`
//        (case-insensitive) or to a group's `id`
//      - If matched, updates the product's groupId AND category to the group ID
//   4. Returns a report of what was fixed
//
// Access: admin only.
//
// Usage (browser console):
//   fetch('/api/admin/fix-product-groups', {
//     method: 'POST',
//     headers: {
//       'Content-Type': 'application/json',
//       'Authorization': 'Bearer ' + localStorage.getItem('sylhn-session-token')
//     },
//     credentials: 'include'
//   }).then(r => r.json()).then(console.log)

export async function POST(req: NextRequest) {
  let user;
  try {
    user = await requireAuth();
    if (user.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }
  } catch (e: any) { return e as Response; }

  try {
    // ===== STEP 0: Ensure default stock groups exist =====
    // After a DB wipe, stock groups are gone. We need to recreate them before
    // we can match products to groups.
    const defaultGroups = [
      { name: "Groceries", description: "Food items, fresh produce, dairy, meat, bakery, pantry, frozen", color: "emerald", icon: "🛒" },
      { name: "Confectionery", description: "Snacks, candy, chocolates, sweets", color: "purple", icon: "🍫" },
      { name: "Soft Drinks", description: "Non-alcoholic beverages, juices, water", color: "cyan", icon: "🥤" },
      { name: "Hard Liquor", description: "Wine, spirits, and alcoholic beverages", color: "red", icon: "🍷" },
      { name: "Households", description: "Household items, cleaning supplies, paper goods", color: "teal", icon: "🧴" },
    ];
    let groupsCreated = 0;
    for (const g of defaultGroups) {
      const existing = await db.stockGroup.findFirst({ where: { name: g.name } });
      if (!existing) {
        try {
          await db.stockGroup.create({ data: g });
          groupsCreated++;
        } catch (e: any) {
          console.warn(`[fix-product-groups] could not create group "${g.name}":`, e?.message);
        }
      }
    }

    // ===== STEP 1: Fetch all products + all stock groups in parallel =====
    const [products, groups] = await Promise.all([
      db.product.findMany({ select: { id: true, name: true, sku: true, category: true, groupId: true } }),
      db.stockGroup.findMany({ select: { id: true, name: true, icon: true } }),
    ]);

    // ===== STEP 2: Build a lookup map: name (lowercase) → group ID =====
    const nameToGroupId: Record<string, string> = {};
    for (const g of groups) {
      nameToGroupId[g.name.toLowerCase()] = g.id;
      nameToGroupId[g.id] = g.id; // also allow matching by ID directly
      // Common aliases
      if (g.name.toLowerCase().includes("grocer")) nameToGroupId["groceries"] = g.id;
      if (g.name.toLowerCase().includes("drink") || g.name.toLowerCase().includes("beverage")) nameToGroupId["soft-drinks"] = g.id;
      if (g.name.toLowerCase().includes("liquor") || g.name.toLowerCase().includes("alcohol")) nameToGroupId["hard-liquor"] = g.id;
      if (g.name.toLowerCase().includes("household") || g.name.toLowerCase().includes("home")) nameToGroupId["households"] = g.id;
      if (g.name.toLowerCase().includes("confect") || g.name.toLowerCase().includes("snack") || g.name.toLowerCase().includes("candy")) nameToGroupId["confectionery"] = g.id;
      if (g.name.toLowerCase().includes("produce") || g.name.toLowerCase().includes("fresh")) nameToGroupId["fresh-produce"] = g.id;
    }

    // 3. Find products that need fixing
    const validGroupIds = new Set(groups.map(g => g.id));
    const toFix: Array<{ id: string; name: string; sku: string; oldCategory: string; newGroupId: string; newGroupName: string }> = [];
    const unmatched: Array<{ id: string; name: string; sku: string; category: string }> = [];

    for (const p of products) {
      // Skip if groupId is already valid
      if (p.groupId && validGroupIds.has(p.groupId)) continue;

      // Try to match the product's category to a group
      const catLower = (p.category || "").toLowerCase().trim();
      const matchedGroupId = nameToGroupId[catLower];

      if (matchedGroupId) {
        const matchedGroup = groups.find(g => g.id === matchedGroupId)!;
        toFix.push({
          id: p.id,
          name: p.name,
          sku: p.sku,
          oldCategory: p.category || "(empty)",
          newGroupId: matchedGroupId,
          newGroupName: matchedGroup.name,
        });
      } else {
        unmatched.push({
          id: p.id,
          name: p.name,
          sku: p.sku,
          category: p.category || "(empty)",
        });
      }
    }

    // 4. Update the matched products in bulk
    let updated = 0;
    for (const fix of toFix) {
      try {
        await db.product.update({
          where: { id: fix.id },
          data: {
            groupId: fix.newGroupId,
            category: fix.newGroupId, // sync category = groupId so filters work
          },
        });
        updated++;
      } catch (e: any) {
        console.warn(`[fix-product-groups] failed to update ${fix.sku}:`, e?.message);
      }
    }

    // 5. Audit log
    auditLog({
      userId: user.uid,
      user: user.username,
      action: "FIX_PRODUCT_GROUPS",
      module: "admin",
      details: `Fixed groupId on ${updated}/${toFix.length} products. ${unmatched.length} unmatched. Total products: ${products.length}, Total groups: ${groups.length}.`,
      severity: "warning",
    });

    return NextResponse.json({
      success: true,
      message: `Created ${groupsCreated} default groups. Fixed ${updated} of ${toFix.length} products. ${unmatched.length} products had no matching group.`,
      summary: {
        groupsCreated,
        totalProducts: products.length,
        totalGroups: groups.length,
        productsAlreadyHadGroup: products.length - toFix.length - unmatched.length,
        productsFixed: updated,
        productsUnmatched: unmatched.length,
      },
      fixed: toFix.slice(0, 50), // first 50 for the response
      unmatched: unmatched.slice(0, 50), // first 50 unmatched
      availableGroups: groups.map(g => ({ id: g.id, name: g.name, icon: g.icon })),
    });
  } catch (e: any) {
    console.error("POST /api/admin/fix-product-groups error:", e);
    return NextResponse.json({
      error: "Failed to fix product groups",
      detail: e?.message || String(e),
    }, { status: 500 });
  }
}
