"use client";

import { useState, useEffect } from "react";

/**
 * LiveClock — self-contained clock that updates every second.
 * CRITICAL: This is a SEPARATE component so it re-renders ITSELF,
 * not the entire POS page. The parent component never re-renders
 * when the time changes.
 *
 * Without this, the 6700-line POSPage would re-render every second
 * = massive lag.
 */

interface LiveClockProps {
  variant?: "header" | "stats";
  className?: string;
}

export function LiveClock({ variant = "stats", className = "" }: LiveClockProps) {
  const [time, setTime] = useState<Date | null>(null);

  useEffect(() => {
    setTime(new Date());
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  if (!time) {
    return variant === "header" ? (
      <>
        <div className="text-[9px] text-emerald-50/80 font-medium tracking-wide">--</div>
        <div className="text-xs font-mono font-bold tabular">--:--:--</div>
      </>
    ) : (
      <span className={className}>--:--:--</span>
    );
  }

  if (variant === "header") {
    return (
      <>
        <div className="text-[9px] text-emerald-50/80 font-medium tracking-wide">
          {time.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
        </div>
        <div className="text-xs font-mono font-bold tabular">
          {time.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </div>
      </>
    );
  }

  return (
    <span className={className}>
      {time.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
    </span>
  );
}
