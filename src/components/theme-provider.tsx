"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ReactNode } from "react";

/**
 * Theme provider for dark mode support across the app.
 * Uses next-themes which:
 *  - persists the user's preference in localStorage
 *  - hydrates the .dark class on <html> BEFORE first paint (via a script)
 *  - exposes a useTheme() hook for components to read/toggle the theme
 *
 * The provider is mounted once at the root layout. All children can use
 * Tailwind's `dark:` variants or shadcn semantic tokens (bg-background etc).
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false} // we want explicit user choice, not OS-follow
      storageKey="sylhn-theme"
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
