"use client";

import { cn } from "@/lib/utils";
import { useCached } from "@/lib/cached-fetch";

interface Props {
  variant?: "absolute" | "inline";
  onClick?: () => void;
}

export function EmailNotificationBadge({ variant = "absolute", onClick }: Props) {
  // SWR: auto-fetches every 2 min, deduplicates, caches, instant from cache
  const { data } = useCached<{ count: number }>('/api/email/unread-count', {
    refreshInterval: 120000,
    dedupingInterval: 60000,
  });

  const count = data?.count || 0;

  if (count === 0) return null;

  if (variant === "inline") {
    return (
      <span
        onClick={onClick}
        className={cn(
          "inline-flex items-center justify-center",
          "min-w-[16px] h-[16px] px-1 ml-1",
          "bg-rose-500 text-white text-[9px] font-bold rounded-full",
          "ring-2 ring-white shadow-sm animate-pulse"
        )}
        title={`${count} unread email${count > 1 ? "s" : ""}`}
      >
        {count > 9 ? "9+" : count}
      </span>
    );
  }

  return (
    <span
      onClick={onClick}
      className={cn(
        "absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1",
        "bg-rose-500 text-white text-[10px] font-bold rounded-full",
        "flex items-center justify-center ring-2 ring-white shadow-md",
        "animate-pulse cursor-pointer"
      )}
      title={`${count} unread email${count > 1 ? "s" : ""}`}
    >
      {count > 9 ? "9+" : count}
    </span>
  );
}
