/**
 * SYLHN POS — Version Information
 *
 * Update these values after every significant change.
 * Version is displayed in:
 * - Login screen footer
 * - POS header (subtle, in stats bar)
 * - Maintenance → About SYLHN POS
 * - Help/keyboard shortcuts overlay
 *
 * Versioning convention (Semantic Versioning):
 *   MAJOR.MINOR.PATCH
 *   1.0.0 = initial release
 *   1.0.1 = bug fix
 *   1.1.0 = new feature (backward-compatible)
 *   2.0.0 = breaking change
 *
 * BUILD_ID format: build-YYYY-MM-DD-vXXX-short-description
 * Helps identify exact deploy when debugging
 */

export const APP_VERSION = "1.4.0";
export const BUILD_ID = "build-2026-08-10-v140-supplier-credit-purchase-batch";
export const RELEASE_DATE = "August 10, 2026";
export const RELEASE_NAME = "Supplier + Credit + Purchase System Batch";

// Full version string for display
export const FULL_VERSION = `v${APP_VERSION} (${BUILD_ID})`;

// Changelog — keep last 5 versions
export const CHANGELOG: { version: string; date: string; changes: string[] }[] = [
  {
    version: "1.3.0",
    date: "August 10, 2026",
    changes: [
      "FIX: White flash — added loading fallback to ALL 10 lazy components (was missing, showed blank white)",
      "FIX: Bounce — removed global 'button:active { transform: scale(0.97) }' (applied to EVERY button)",
      "FIX: Bounce — removed '.btn-premium:active { transform: scale(0.96) }'",
      "FIX: Bounce — removed '.gradient-premium-emerald:active { transform: scale(0.93) }'",
      "FIX: Bounce — removed grid button :active scale(0.95)",
      "FIX: Bounce — removed FAB button :active scale(0.92)",
      "FIX: Bounce — removed keypad button :active scale(0.94)",
      "FIX: Bounce — removed cart item :active scale(0.98)",
      "FIX: Bounce — replaced ALL 7 remaining 'transition: all' with specific properties",
      "FIX: Floating search — lowered customer search z-index from 100 to 30 (header dropdowns z-[120] now on top)",
    ],
  },
  {
    version: "1.2.3",
    date: "August 10, 2026",
    changes: [
      "FIX: Header dropdown z-index z-50 → z-[120] (fixes floating search bar overlapping Maintenance menu)",
      "FIX: All 3 header dropdowns (menu, live search, price check) now use z-[120]",
      "PERF: Converted 10 heavy components from eager imports to lazy dynamic imports",
      "PERF: LabelPrinter, ExpenseManager, StocktakeWizard, WhatsAppBroadcast now lazy-loaded",
      "PERF: AIForecastDashboard, ExpiryManager, AdvancedReportsDashboard now lazy-loaded",
      "PERF: VoiceSearch, RecurringPOManager, BulkProductImport now lazy-loaded",
      "PERF: Initial bundle size reduced significantly — these only load when needed",
    ],
  },
  {
    version: "1.2.2",
    date: "August 10, 2026",
    changes: [
      "FIX: Removed .btn-premium:hover { transform: translateY(-1px) } — THE main bounce cause",
      "FIX: Removed .btn-premium:active { transform: translateY(0) } — companion bounce cause",
      "FIX: Removed .mobile-tab:active { transform: scale(0.92) } — mobile tab bounce",
      "FIX: Removed .product-card-premium:hover { transform: translateY(-2px) } — card hover bounce",
      "FIX: Removed .product-card-premium:active { transform: scale(0.98) } — card click bounce",
      "FIX: Changed .btn-premium transition: all → specific properties (bg, color, shadow, border)",
      "FIX: Changed .cat-pill-premium transition: all → specific properties",
      "FIX: Changed .mobile-tab transition: all 0.32s → specific properties 0.2s",
      "REASON: translateY and scale transforms on hover/active shift element position → neighbors reflow → bounce",
    ],
  },
  {
    version: "1.2.1",
    date: "August 10, 2026",
    changes: [
      "REVERT: Restored original globals.css (removed body overflow:hidden, scrollbar-gutter, overscroll-behavior)",
      "REVERT: Restored viewport meta (maximumScale=5, userScalable=true)",
      "REVERT: Restored min-h-screen on main POS container (was h-screen overflow-hidden)",
      "REVERT: Restored sticky top-0 on category nav",
      "REVERT: Restored transition-all + scale-105 on category pills",
      "REVERT: Restored transition-all duration-300 on cart sidebar",
      "KEPT: active:scale removal (64+ instances) — this is a safe change",
      "KEPT: Schema sync improvements (DIRECT_URL, deep health check)",
      "KEPT: All new features (AI, email, PWA, etc.)",
    ],
  },
  {
    version: "1.2.0",
    date: "August 10, 2026",
    changes: [
      "NUCLEAR FIX: Removed ALL 'active:scale-95/90/98' from entire app (64+ instances)",
      "FIX: Removed 'whileTap' scale from product cards and speed dial",
      "FIX: Removed 'hover:scale-105' from speed dial buttons",
      "FIX: Removed 'transition-transform' + reduced 'scale-125' to 'scale-110' on category icons",
      "FIX: Removed 'transition-all' from payment change card",
      "REASON: Every 'active:scale' shrinks the button on tap → neighbors shift to fill gap → bounce",
      "This is the definitive fix. Buttons still change COLOR on tap/active, just no longer RESIZE.",
    ],
  },
  {
    version: "1.1.4",
    date: "August 10, 2026",
    changes: [
      "FIX: Removed 'scroll-behavior: smooth' from html (was causing bounce on tab switch — browser smoothly scrolled to new content position)",
      "FIX: Added 'scrollbar-gutter: stable' to ALL scroll containers (prevents horizontal content shift when scrollbar appears/disappears on tab switch)",
      "FIX: Replaced last 'transition-all' with 'transition-colors' in payment modal",
      "FIX: Added 'scroll-behavior: auto' explicitly to html to override any inherited smooth scrolling",
    ],
  },
  {
    version: "1.1.3",
    date: "August 10, 2026",
    changes: [
      "FIX: Real mobile bounce cause — viewport resizing when URL bar shows/hides",
      "FIX: Set body overflow:hidden + overscroll-behavior:none (prevents pull-to-refresh bounce)",
      "FIX: Changed min-h-screen to h-screen + overflow-hidden on main POS container",
      "FIX: Disabled user-scalable + maximumScale=1 (prevents iOS input-focus zoom bounce)",
      "FIX: Removed sticky positioning from email system header (was causing jumps)",
      "FIX: Email system container now uses h-screen + overflow-hidden",
    ],
  },
  {
    version: "1.1.2",
    date: "August 10, 2026",
    changes: [
      "FIX: Removed 'y: -5' transform from dropdown menu animations (was triggering header layout shift)",
      "FIX: Removed 'height: 0 → auto' animation from mobile dropdown (was causing bounce on expand)",
      "FIX: Replaced 'transition-all' with 'transition' on 37 header buttons (prevents unintended property animations)",
      "FIX: Schema sync now uses DIRECT_URL (session pooler, port 5432) — faster than transaction pooler",
      "FIX: Increased schema sync timeout from 120s to 180s",
    ],
  },
  {
    version: "1.1.1",
    date: "August 10, 2026",
    changes: [
      "FIX: Removed framer-motion 'layout' prop from product cards, cart items, mobile lists (eliminates bouncing)",
      "FIX: Removed 'y: -4' from product card hover animation (was triggering layout recalculation cascade)",
      "FIX: Removed 'sticky top-0' from category nav (was causing visual jumps on scroll)",
      "FIX: Removed 'transition-all' + 'scale-105' from category pills (was bouncing neighboring pills)",
      "FIX: Removed 'transition-all duration-300' from cart sidebar (was animating width changes)",
      "FIX: Deep schema health check (auto-syncs missing Product.imageUrl, Email table, EmailLog.cc)",
      "FEAT: Version numbering system (v1.1.1) — matches FastMaint pattern",
    ],
  },
  {
    version: "1.1.0",
    date: "August 10, 2026",
    changes: [
      "AI: Cashier Assistant upgraded to Groq Llama 3.3 70B",
      "AI: Business AI Dashboard for managers",
      "AI: Predictions & Forecast dashboard (7-day outlook)",
      "AI: Voice commands in AI Assistant (microphone)",
      "Email: IMAP sync from Gmail (received emails)",
      "Email: Email Receipts to customers",
      "Email: 6 pre-written templates",
      "Email: Low-stock alert + Daily summary auto-emails",
      "Email: Supplier email dialog",
      "PWA: Full installable app (home screen, offline)",
      "POS: Quick discount buttons (5/10/15/20%)",
      "POS: Live clock in header",
      "POS: Low-stock amber ring on product cards",
      "POS: Customer-facing display page",
      "POS: Keyboard shortcuts (press ?)",
      "Auth: Emergency admin password reset endpoint",
      "DB: Deep schema health check (auto-sync missing columns)",
    ],
  },
  {
    version: "1.0.0",
    date: "July 2026",
    changes: [
      "Initial release",
      "Core POS: sales, stock, customers, suppliers",
      "Purchase Hub with 3-way invoice matching",
      "Reports: daily, monthly, VAT, profit/loss",
      "Multi-location + multi-user with permissions",
      "PWA: offline mode, install to home screen",
    ],
  },
];
