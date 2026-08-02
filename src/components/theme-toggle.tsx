"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Moon, Sun, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/**
 * Desktop dark mode toggle.
 *
 * - Renders a 3-item dropdown: Light / Dark / System
 * - Persists choice via next-themes (localStorage)
 * - Hydration-safe: only shows the icon after mount
 *
 * On mobile the same toggle is available in MobileNav; this component
 * is intended for desktop top bars / toolbars.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch: render a placeholder until mounted.
  // This is a legitimate use of setState-in-effect (mount-detection pattern);
  // the lint rule is overly strict here.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) {
    return <div className={cn("h-9 w-9", className)} />;
  }

  const isDark = (resolvedTheme || theme) === "dark";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn("h-9 w-9 rounded-lg", className)}
          title={isDark ? "Switch theme (currently Dark)" : "Switch theme (currently Light)"}
        >
          {isDark ? (
            <Moon className="h-4 w-4 text-violet-300" />
          ) : (
            <Sun className="h-4 w-4 text-amber-500" />
          )}
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuItem onClick={() => setTheme("light")} className="cursor-pointer">
          <Sun className="h-4 w-4 mr-2 text-amber-500" />
          <span className="flex-1">Light</span>
          {theme === "light" && <span className="text-emerald-600">●</span>}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")} className="cursor-pointer">
          <Moon className="h-4 w-4 mr-2 text-violet-400" />
          <span className="flex-1">Dark</span>
          {theme === "dark" && <span className="text-emerald-600">●</span>}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")} className="cursor-pointer">
          <Monitor className="h-4 w-4 mr-2 text-slate-500" />
          <span className="flex-1">System</span>
          {theme === "system" && <span className="text-emerald-600">●</span>}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
