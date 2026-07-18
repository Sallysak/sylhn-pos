/**
 * SYLHN POS — Real-time event bus (in-process pub/sub)
 *
 * Used by Server-Sent Events (SSE) to broadcast stock changes to all connected
 * clients. When a sale/void/refund changes product stock, the API route
 * publishes an event here; the SSE endpoint subscribes and pushes the event
 * to every connected browser.
 *
 * LIMITATIONS:
 * - In-process only (single Node.js instance). For multi-instance deployments
 *   (e.g. PM2 cluster, Kubernetes), replace this with Redis Pub/Sub.
 * - No persistence — if no client is connected when an event fires, the event
 *   is dropped. That's OK because clients also do a 15s incremental poll as a
 *   fallback (so they'll see the change within 15s even if SSE misses it).
 *
 * EVENT TYPES:
 *   - "stock-update"   — { productId, newQuantity, source: "sale"|"void"|"refund"|"adjust" }
 *   - "product-create" — { productId }
 *   - "product-update" — { productId }
 *   - "product-delete" — { productId }
 *   - "sale-complete"  — { saleId, invoiceNumber, total, cashierName }
 *   - "shift-update"   — { shiftId, action: "open"|"close" }
 */

export type RealtimeEvent =
  | { type: "stock-update"; productId: string; newQuantity: number; source: string }
  | { type: "product-create"; productId: string }
  | { type: "product-update"; productId: string }
  | { type: "product-delete"; productId: string }
  | { type: "sale-complete"; saleId: string; invoiceNumber: string; total: number; cashierName: string }
  | { type: "shift-update"; shiftId: string; action: "open" | "close" };

type Subscriber = (event: RealtimeEvent) => void;

const subscribers = new Set<Subscriber>();

/**
 * Publish a realtime event to all connected subscribers (SSE clients).
 * Safe to call from any API route — if no clients are connected, this is a
 * no-op. Errors in subscribers are isolated (one bad subscriber doesn't
 * affect others).
 */
export function publishRealtimeEvent(event: RealtimeEvent): void {
  for (const sub of subscribers) {
    try {
      sub(event);
    } catch (e) {
      // Don't let one bad subscriber break the loop
      console.error("[realtime] subscriber error:", e);
    }
  }
}

/**
 * Subscribe to realtime events. Returns an unsubscribe function.
 * Used by the SSE endpoint to forward events to connected clients.
 */
export function subscribeToRealtimeEvents(sub: Subscriber): () => void {
  subscribers.add(sub);
  return () => {
    subscribers.delete(sub);
  };
}

/**
 * Get the current subscriber count (for monitoring/debugging).
 */
export function getRealtimeSubscriberCount(): number {
  return subscribers.size;
}
