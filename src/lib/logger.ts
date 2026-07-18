/**
 * SYLHN POS — Structured logger
 *
 * A minimal structured logger that outputs JSON to stdout. In production,
 * this is consumed by journald (systemd) or Docker logs.
 *
 * For more sophisticated logging (correlation IDs, sampling, transports),
 * replace this with pino: `bun add pino pino-pretty`
 *
 * Usage:
 *   import { logger } from "@/lib/logger";
 *   logger.info("Sale completed", { invoiceNumber, total });
 *   logger.error("DB error", e);
 *   logger.warn("Rate limit hit", { ip, endpoint });
 */

type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

// Minimum level to log (configure via env)
const MIN_LEVEL: LogLevel = (process.env.LOG_LEVEL as LogLevel) || "info";

function shouldLog(level: LogLevel): boolean {
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[MIN_LEVEL];
}

function formatLog(level: LogLevel, message: string, meta?: Record<string, any>): string {
  const entry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || "development",
    ...(meta && Object.keys(meta).length > 0 ? meta : {}),
  };
  return JSON.stringify(entry);
}

export const logger = {
  debug(message: string, meta?: Record<string, any>) {
    if (shouldLog("debug")) console.debug(formatLog("debug", message, meta));
  },

  info(message: string, meta?: Record<string, any>) {
    if (shouldLog("info")) console.info(formatLog("info", message, meta));
  },

  warn(message: string, meta?: Record<string, any>) {
    if (shouldLog("warn")) console.warn(formatLog("warn", message, meta));
  },

  error(message: string, meta?: Record<string, any>) {
    if (shouldLog("error")) console.error(formatLog("error", message, meta));
  },

  // Log an API request (used by middleware or route handlers)
  apiRequest(method: string, path: string, status: number, durationMs: number, meta?: Record<string, any>) {
    this.info("API request", { method, path, status, durationMs, ...meta });
  },
};
