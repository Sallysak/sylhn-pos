import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { subscribeToRealtimeEvents, type RealtimeEvent } from "@/lib/realtime";
import { logger } from "@/lib/logger";

// GET /api/realtime/stream — Server-Sent Events (SSE) endpoint
//
// Opens a long-lived HTTP connection. The server pushes realtime events to
// the client as they happen (stock updates, sale completions, shift changes).
//
// Client usage:
//   const es = new EventSource("/api/realtime/stream");
//   es.addEventListener("stock-update", (e) => {
//     const data = JSON.parse(e.data);
//     // data: { productId, newQuantity, source }
//   });
//   es.addEventListener("sale-complete", (e) => { ... });
//
// The browser automatically reconnects if the connection drops (default 3s).
// We send a heartbeat comment every 30s to keep the connection alive through
// proxies that might otherwise close idle connections.
//
// AUTH: Requires a valid session cookie. The connection is closed if the
// session expires (client must reconnect after re-authenticating).
//
// LIMITATIONS:
// - One connection per browser tab. Multiple tabs = multiple connections.
// - In-process only (single Node.js instance). For multi-instance deployments,
//   replace the realtime bus with Redis Pub/Sub.
// - Max 6 connections per browser (HTTP/1.1 limit). Most POS setups use 1-2.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  // Auth check — close the connection if not authenticated
  let user;
  try {
    user = await requireAuth();
  } catch (e) {
    return new Response("Authentication required", { status: 401 });
  }

  logger.info("SSE client connected", { user: user.username });

  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream({
    start(controller) {
      // Send an initial "connected" event so the client knows we're live
      const connectEvent = `event: connected\ndata: ${JSON.stringify({ user: user.username, at: new Date().toISOString() })}\n\n`;
      controller.enqueue(encoder.encode(connectEvent));

      // Subscribe to realtime events and forward them to the client
      const unsubscribe = subscribeToRealtimeEvents((event: RealtimeEvent) => {
        if (closed) return;
        try {
          const eventTypeName = event.type;
          const payload = `event: ${eventTypeName}\ndata: ${JSON.stringify(event)}\n\n`;
          controller.enqueue(encoder.encode(payload));
        } catch (e) {
          // Connection probably closed — unsubscribe will happen in cancel()
          logger.warn("SSE send failed", { error: e instanceof Error ? e.message : String(e) });
        }
      });

      // Heartbeat every 30s — keeps the connection alive through proxies
      // and lets us detect dead connections (enqueue throws if closed).
      const heartbeat = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`: heartbeat ${Date.now()}\n\n`));
        } catch {
          // Connection closed — stop the heartbeat
          clearInterval(heartbeat);
        }
      }, 30_000);

      // Cleanup on close (client disconnects or cancels the stream)
      const cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        unsubscribe();
        logger.info("SSE client disconnected", { user: user.username });
        try { controller.close(); } catch { /* already closed */ }
      };

      // The `req.signal` fires when the client disconnects
      req.signal.addEventListener("abort", cleanup);
    },
    cancel() {
      closed = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      // Disable buffering (important for realtime)
      "X-Accel-Buffering": "no",
      // CORS — allow same-origin only (CSP frame-ancestors 'self' in prod)
      "Access-Control-Allow-Origin": "same-origin",
    },
  });
}
