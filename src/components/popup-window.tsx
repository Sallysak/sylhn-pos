"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import { Minus, Square, X, Copy as CopyIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface PopupWindowProps {
  title: string;
  titleBarColor?: string; // hex color for title bar
  children: React.ReactNode;
  onClose: () => void;
  initialWidth?: number;
  initialHeight?: number;
  initialX?: number;
  initialY?: number;
  minWidth?: number;
  minHeight?: number;
}

type WindowState = "normal" | "maximized" | "minimized";

/** Mobile breakpoint — below this width, render as full-screen overlay. */
const MOBILE_BREAKPOINT = 768;

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const update = () => setIsMobile(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);
  return isMobile;
}

export function PopupWindow({
  title,
  titleBarColor = "#5B9BD5",
  children,
  onClose,
  initialWidth = 900,
  initialHeight = 620,
  initialX,
  initialY,
  minWidth = 500,
  minHeight = 350,
}: PopupWindowProps) {
  const isMobile = useIsMobile();
  const [windowState, setWindowState] = useState<WindowState>("normal");
  const [position, setPosition] = useState({ x: initialX ?? -1, y: initialY ?? -1 });
  const [size, setSize] = useState({ width: initialWidth, height: initialHeight });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, posX: 0, posY: 0 });
  const resizeStart = useRef({ x: 0, y: 0, w: 0, h: 0 });

  // Center the window on mount if no position given.
  // This is client-only initialization (window dimensions not available during SSR).
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (position.x === -1 && position.y === -1) {
      const w = window.innerWidth;
      const h = window.innerHeight;
      setPosition({
        x: Math.max(20, (w - initialWidth) / 2),
        y: Math.max(20, (h - initialHeight) / 2),
      });
    }
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Drag handlers
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    if (windowState === "maximized") return;
    setIsDragging(true);
    dragStart.current = {
      x: e.clientX,
      y: e.clientY,
      posX: position.x,
      posY: position.y,
    };
  }, [position, windowState]);

  useEffect(() => {
    if (!isDragging) return;
    const handleMove = (e: MouseEvent) => {
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      setPosition({
        x: Math.max(0, Math.min(window.innerWidth - 100, dragStart.current.posX + dx)),
        y: Math.max(0, Math.min(window.innerHeight - 60, dragStart.current.posY + dy)),
      });
    };
    const handleUp = () => setIsDragging(false);
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [isDragging]);

  // Resize handlers
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (windowState === "maximized") return;
    setIsResizing(true);
    resizeStart.current = { x: e.clientX, y: e.clientY, w: size.width, h: size.height };
  }, [size, windowState]);

  useEffect(() => {
    if (!isResizing) return;
    const handleMove = (e: MouseEvent) => {
      const dx = e.clientX - resizeStart.current.x;
      const dy = e.clientY - resizeStart.current.y;
      setSize({
        width: Math.max(minWidth, resizeStart.current.w + dx),
        height: Math.max(minHeight, resizeStart.current.h + dy),
      });
    };
    const handleUp = () => setIsResizing(false);
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [isResizing, minWidth, minHeight]);

  const toggleMaximize = () => {
    setWindowState(prev => prev === "maximized" ? "normal" : "maximized");
  };

  const toggleMinimize = () => {
    setWindowState(prev => prev === "minimized" ? "normal" : "minimized");
  };

  // ============ MOBILE RENDER PATH ============
  // On mobile, render a bottom-sheet overlay with a sticky title bar + scrollable content.
  // Leaves the stock management header and tab bar visible at the top.
  if (isMobile) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-end justify-center"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 30, stiffness: 340 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white w-full max-h-[88vh] rounded-t-3xl shadow-2xl flex flex-col overflow-hidden"
        >
          {/* Grab handle */}
          <div className="flex-shrink-0 flex justify-center pt-2 pb-1">
            <div className="w-10 h-1 bg-slate-300 rounded-full" />
          </div>
          {/* Title bar */}
          <div
            className="flex items-center justify-between flex-shrink-0 h-11 px-4 text-white select-none rounded-t-xl"
            style={{ backgroundColor: titleBarColor }}
          >
            <div className="flex items-center gap-2 text-sm font-bold min-w-0">
              <span className="truncate">{title}</span>
            </div>
            <button
              onClick={onClose}
              className="h-8 w-8 hover:bg-white/25 active:bg-white/35 flex items-center justify-center text-white transition rounded-md flex-shrink-0"
              title="Close"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 overscroll-contain">
            {children}
          </div>
        </motion.div>
      </motion.div>
    );
  }

  if (windowState === "minimized") {
    return (
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="fixed bottom-4 right-4 z-50 rounded-lg shadow-xl flex items-center"
        style={{ backgroundColor: titleBarColor }}
      >
        <div className="flex items-center gap-2 px-3 py-2 text-white text-sm font-semibold">
          <span>{title}</span>
        </div>
        <button
          onClick={toggleMinimize}
          className="h-8 w-8 hover:bg-white/20 flex items-center justify-center text-white"
          title="Restore"
        >
          <Square className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={onClose}
          className="h-8 w-8 hover:bg-rose-600 flex items-center justify-center text-white rounded-r-lg"
          title="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </motion.div>
    );
  }

  const isMaximized = windowState === "maximized";
  const winStyle = isMaximized
    ? { left: 0, top: 0, width: "100vw", height: "100vh" }
    : { left: position.x, top: position.y, width: size.width, height: size.height };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.15 }}
      className={cn(
        "fixed z-50 flex flex-col bg-white shadow-2xl overflow-hidden",
        isMaximized ? "rounded-none" : "rounded-lg ring-1 ring-black/20",
        isDragging && "select-none cursor-moving"
      )}
      style={winStyle as React.CSSProperties}
    >
      {/* Title Bar */}
      <div
        className="flex items-center justify-between flex-shrink-0 h-8 px-3 cursor-default select-none"
        style={{ backgroundColor: titleBarColor }}
        onMouseDown={handleDragStart}
        onDoubleClick={toggleMaximize}
      >
        <div className="flex items-center gap-2 text-white text-sm font-bold">
          <span className="truncate">{title}</span>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            onClick={(e) => { e.stopPropagation(); toggleMinimize(); }}
            className="h-6 w-8 hover:bg-white/25 flex items-center justify-center text-white transition"
            title="Minimize"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); toggleMaximize(); }}
            className="h-6 w-8 hover:bg-white/25 flex items-center justify-center text-white transition"
            title={isMaximized ? "Restore Down" : "Maximize"}
          >
            {isMaximized ? (
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="2" y="4" width="6" height="6" rx="0.5" />
                <path d="M4 4 V2 H10 V8 H8" />
              </svg>
            ) : (
              <Square className="h-3 w-3" />
            )}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            className="h-6 w-8 hover:bg-rose-600 flex items-center justify-center text-white transition rounded-r"
            title="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Window Content */}
      <div className="flex-1 overflow-hidden min-h-0">
        {children}
      </div>

      {/* Resize Handle (bottom-right corner) */}
      {!isMaximized && (
        <div
          className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize"
          onMouseDown={handleResizeStart}
          style={{
            background: "linear-gradient(135deg, transparent 50%, rgba(0,0,0,0.2) 50%)",
          }}
        />
      )}
    </motion.div>
  );
}
