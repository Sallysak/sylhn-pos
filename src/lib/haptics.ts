/**
 * SYLHN POS — Haptic feedback utility
 *
 * Triggers device vibration on supported devices (Android, Chrome).
 * iOS Safari doesn't support the Vibration API, so on iOS this is a no-op.
 * The UI still feels responsive because of the CSS :active scale animation.
 *
 * Usage:
 *   import { haptic } from "@/lib/haptics";
 *   haptic.light();  // 10ms tap
 *   haptic.medium(); // 20ms press
 *   haptic.success(); // success pattern
 *   haptic.error();   // error pattern
 */

type HapticPattern = "light" | "medium" | "heavy" | "success" | "warning" | "error";

const patterns: Record<HapticPattern, number | number[]> = {
  light: 10,
  medium: 20,
  heavy: 40,
  success: [10, 30, 10],
  warning: [20, 50, 20],
  error: [40, 80, 40, 80, 40],
};

function vibrate(pattern: HapticPattern): void {
  if (typeof navigator === "undefined" || !navigator.vibrate) return;
  try {
    navigator.vibrate(patterns[pattern]);
  } catch {
    // Some browsers throw if the page isn't focused
  }
}

export const haptic = {
  light: () => vibrate("light"),
  medium: () => vibrate("medium"),
  heavy: () => vibrate("heavy"),
  success: () => vibrate("success"),
  warning: () => vibrate("warning"),
  error: () => vibrate("error"),
};
