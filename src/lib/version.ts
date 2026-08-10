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

export const APP_VERSION = "1.1.0";
export const BUILD_ID = "build-2026-08-10-v110-email-ai-pwa";
export const RELEASE_DATE = "August 10, 2026";
export const RELEASE_NAME = "Email AI PWA Update";

// Full version string for display
export const FULL_VERSION = `v${APP_VERSION} (${BUILD_ID})`;

// Changelog — keep last 5 versions
export const CHANGELOG: { version: string; date: string; changes: string[] }[] = [
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
