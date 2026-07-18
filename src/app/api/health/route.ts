import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/health — liveness + readiness check
//
// Returns 200 if the app AND database are both reachable.
// Returns 503 if the database is unreachable (kubernetes/docker will
// restart the container).
//
// Used by:
// - Docker HEALTHCHECK
// - Kubernetes readiness/liveness probes
// - External monitors (UptimeRobot, Pingdom)
// - Load balancers (Caddy, nginx)
export async function GET() {
  const start = Date.now();
  const uptime = process.uptime ? process.uptime() : 0;
  const env = process.env.NODE_ENV || "development";

  // ===== Check 1: DB connectivity =====
  // We use $queryRaw`SELECT 1` instead of a real query to minimize overhead.
  // If the DB is locked or unreachable, this will throw.
  let dbStatus: "ok" | "error" = "ok";
  let dbError: string | undefined;
  try {
    await db.$queryRaw`SELECT 1`;
  } catch (e: any) {
    dbStatus = "error";
    dbError = e?.message || String(e);
  }

  const latencyMs = Date.now() - start;
  const isHealthy = dbStatus === "ok";

  // 503 if unhealthy — tells the load balancer to stop sending traffic
  const status = isHealthy ? 200 : 503;

  return NextResponse.json({
    status: isHealthy ? "ok" : "degraded",
    timestamp: new Date().toISOString(),
    uptime,
    env,
    latencyMs,
    checks: {
      db: dbStatus,
      ...(dbError ? { dbError } : {}),
    },
    // Helpful for monitoring — version identifier (set in CI if desired)
    version: process.env.APP_VERSION || "dev",
  }, { status });
}
