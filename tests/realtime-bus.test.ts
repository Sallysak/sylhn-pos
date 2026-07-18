/**
 * SYLHN POS — Realtime event bus tests
 *
 * Tests the in-process pub/sub used by SSE for live stock updates.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { publishRealtimeEvent, subscribeToRealtimeEvents, getRealtimeSubscriberCount } from "@/lib/realtime";

describe("Realtime event bus", () => {
  beforeEach(() => {
    // No global state to reset — subscribers are per-test
  });

  it("delivers events to a single subscriber", () => {
    const events: any[] = [];
    const unsub = subscribeToRealtimeEvents((e) => events.push(e));

    publishRealtimeEvent({
      type: "stock-update",
      productId: "p1",
      newQuantity: 5,
      source: "sale",
    });

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("stock-update");
    expect(events[0].productId).toBe("p1");
    expect(events[0].newQuantity).toBe(5);

    unsub();
  });

  it("delivers events to multiple subscribers", () => {
    const events1: any[] = [];
    const events2: any[] = [];
    const unsub1 = subscribeToRealtimeEvents((e) => events1.push(e));
    const unsub2 = subscribeToRealtimeEvents((e) => events2.push(e));

    publishRealtimeEvent({
      type: "sale-complete",
      saleId: "s1",
      invoiceNumber: "INV-001",
      total: 50,
      cashierName: "Test",
    });

    expect(events1).toHaveLength(1);
    expect(events2).toHaveLength(1);
    expect(events1[0]).toEqual(events2[0]);

    unsub1();
    unsub2();
  });

  it("stops delivering after unsubscribe", () => {
    const events: any[] = [];
    const unsub = subscribeToRealtimeEvents((e) => events.push(e));

    publishRealtimeEvent({ type: "stock-update", productId: "p1", newQuantity: 1, source: "sale" });
    expect(events).toHaveLength(1);

    unsub();

    publishRealtimeEvent({ type: "stock-update", productId: "p2", newQuantity: 2, source: "sale" });
    expect(events).toHaveLength(1);  // still 1 — no new event delivered
  });

  it("isolates subscriber errors", () => {
    const goodEvents: any[] = [];
    // First subscriber throws — should not affect the second
    const unsub1 = subscribeToRealtimeEvents(() => {
      throw new Error("subscriber 1 is broken");
    });
    const unsub2 = subscribeToRealtimeEvents((e) => goodEvents.push(e));

    // Should not throw — publishRealtimeEvent catches the error
    expect(() => {
      publishRealtimeEvent({ type: "stock-update", productId: "p1", newQuantity: 1, source: "sale" });
    }).not.toThrow();

    expect(goodEvents).toHaveLength(1);  // second subscriber still got the event

    unsub1();
    unsub2();
  });

  it("tracks subscriber count", () => {
    const initial = getRealtimeSubscriberCount();
    const unsub1 = subscribeToRealtimeEvents(() => {});
    expect(getRealtimeSubscriberCount()).toBe(initial + 1);

    const unsub2 = subscribeToRealtimeEvents(() => {});
    expect(getRealtimeSubscriberCount()).toBe(initial + 2);

    unsub1();
    expect(getRealtimeSubscriberCount()).toBe(initial + 1);

    unsub2();
    expect(getRealtimeSubscriberCount()).toBe(initial);
  });

  it("handles all event types", () => {
    const events: any[] = [];
    const unsub = subscribeToRealtimeEvents((e) => events.push(e));

    publishRealtimeEvent({ type: "stock-update", productId: "p1", newQuantity: 5, source: "sale" });
    publishRealtimeEvent({ type: "product-create", productId: "p2" });
    publishRealtimeEvent({ type: "product-update", productId: "p3" });
    publishRealtimeEvent({ type: "product-delete", productId: "p4" });
    publishRealtimeEvent({ type: "sale-complete", saleId: "s1", invoiceNumber: "INV-1", total: 50, cashierName: "Test" });
    publishRealtimeEvent({ type: "shift-update", shiftId: "sh1", action: "open" });

    expect(events).toHaveLength(6);
    expect(events.map(e => e.type)).toEqual([
      "stock-update", "product-create", "product-update",
      "product-delete", "sale-complete", "shift-update",
    ]);

    unsub();
  });

  it("no-op when no subscribers are connected", () => {
    // Should not throw
    expect(() => {
      publishRealtimeEvent({ type: "stock-update", productId: "p1", newQuantity: 1, source: "sale" });
    }).not.toThrow();
  });
});
