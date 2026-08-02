/**
 * SYLHN POS — Session token tests
 *
 * Tests the JWT-like session token signing + verification in src/lib/auth.ts.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createSessionToken, verifySessionToken } from "@/lib/auth";

describe("Session token (JWT-like)", () => {
  it("creates a token with 3 parts (header.body.signature)", () => {
    const token = createSessionToken({
      uid: "test-uid",
      username: "admin",
      role: "admin",
    });
    expect(token.split(".")).toHaveLength(3);
  });

  it("verifies a token it created", () => {
    const token = createSessionToken({
      uid: "test-uid",
      username: "admin",
      role: "admin",
    });
    const payload = verifySessionToken(token);
    expect(payload).not.toBeNull();
    expect(payload?.uid).toBe("test-uid");
    expect(payload?.username).toBe("admin");
    expect(payload?.role).toBe("admin");
    expect(payload?.exp).toBeGreaterThan(payload!.iat);
  });

  it("rejects a tampered token (modified payload)", () => {
    const token = createSessionToken({
      uid: "test-uid",
      username: "admin",
      role: "admin",
    });
    // Flip a character in the body
    const parts = token.split(".");
    const tamperedBody = parts[1].slice(0, -1) + (parts[1].slice(-1) === "a" ? "b" : "a");
    const tamperedToken = `${parts[0]}.${tamperedBody}.${parts[2]}`;
    const payload = verifySessionToken(tamperedToken);
    expect(payload).toBeNull();
  });

  it("rejects a token with a bogus signature", () => {
    const token = createSessionToken({
      uid: "test-uid",
      username: "admin",
      role: "admin",
    });
    const parts = token.split(".");
    const tamperedToken = `${parts[0]}.${parts[1]}.bogus-signature`;
    const payload = verifySessionToken(tamperedToken);
    expect(payload).toBeNull();
  });

  it("rejects malformed tokens", () => {
    expect(verifySessionToken("")).toBeNull();
    expect(verifySessionToken("not-a-token")).toBeNull();
    expect(verifySessionToken("a.b")).toBeNull();
    expect(verifySessionToken("a.b.c.d")).toBeNull();
  });
});

describe("Password hashing (PBKDF2)", () => {
  let hashPassword: (p: string) => Promise<string>;
  let verifyPassword: (p: string, h: string) => Promise<boolean>;

  beforeAll(async () => {
    const auth = await import("@/lib/auth");
    hashPassword = auth.hashPassword;
    verifyPassword = auth.verifyPassword;
  });

  it("hashes a password and verifies it", async () => {
    const hash = await hashPassword("TestPass123");
    expect(hash).toMatch(/^pbkdf2\$100000\$/);
    expect(await verifyPassword("TestPass123", hash)).toBe(true);
  });

  it("rejects the wrong password", async () => {
    const hash = await hashPassword("CorrectPass123");
    expect(await verifyPassword("WrongPass456", hash)).toBe(false);
  });

  it("produces different hashes for the same password (random salt)", async () => {
    const h1 = await hashPassword("SamePassword123");
    const h2 = await hashPassword("SamePassword123");
    expect(h1).not.toBe(h2);
    // Both should verify
    expect(await verifyPassword("SamePassword123", h1)).toBe(true);
    expect(await verifyPassword("SamePassword123", h2)).toBe(true);
  });
});
