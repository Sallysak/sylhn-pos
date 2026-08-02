/**
 * SYLHN POS — Vitest configuration
 *
 * Runs unit + integration tests. Tests live in /tests and use the *.test.ts
 * convention. We use the Node environment (not jsdom) because most tests
 * exercise server-side logic (auth, sales, validation).
 */
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    exclude: ["node_modules/**", ".next/**"],
    globals: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      exclude: [
        "node_modules/**",
        ".next/**",
        "tests/**",
        "scripts/**",
        "prisma/**",
        "**/*.config.*",
      ],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
