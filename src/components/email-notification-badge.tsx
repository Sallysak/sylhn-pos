"use client";

import { useState, useEffect } from "react";
import { authedFetch } from "@/lib/client-auth";
import { cn } from "@/lib/utils";

export function EmailNotificationBadge({ variant = "absolute", onClick }: { variant?: "absolute" | "inline"; onClick?: () => void }) {
  const [count, setCount] = useState(0);

  const fetchCount = async () => {
    try {
      const res = await authedFetch("/api/email/unread-count");
      if (res.ok) {
        const data = await res.json();
        setCount(data.count || 0);
      }
    } catch (e) {
      // Silent fail
    }
  };

  useEffect(() => {
    fetchCount();
    const interval = setInterval(fetchCount, 120000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleVisibility = () => {
      if (!document.hidden) fetchCount();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  if (count === 0) return null;

  if (variant === "inline") {
    return (
      <span
        onClick={(e) => { e.stopPropagation(); onClick?.(); }}
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
