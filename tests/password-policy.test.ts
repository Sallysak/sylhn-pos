/**
 * SYLHN POS — Password validation tests
 *
 * Tests the password policy in src/lib/validation.ts.
 */
import { describe, it, expect } from "vitest";
import { UserSchema, PasswordChangeSchema, validate } from "@/lib/validation";

describe("Password policy (UserSchema)", () => {
  it("rejects passwords shorter than 8 chars", () => {
    const result = validate(UserSchema, {
      username: "testuser",
      password: "Ab1",
      fullName: "Test User",
    });
    expect(result.success).toBe(false);
  });

  it("rejects passwords without a number", () => {
    const result = validate(UserSchema, {
      username: "testuser",
      password: "abcdefgh",
      fullName: "Test User",
    });
    expect(result.success).toBe(false);
  });

  it("rejects passwords without a letter", () => {
    const result = validate(UserSchema, {
      username: "testuser",
      password: "12345678",
      fullName: "Test User",
    });
    expect(result.success).toBe(false);
  });

  it("rejects common weak passwords (admin123, password1, etc.)", () => {
    const weakPasswords = ["admin123", "manager123", "cashier123", "password1", "12345678"];
    for (const pwd of weakPasswords) {
      const result = validate(UserSchema, {
        username: "testuser",
        password: pwd,
        fullName: "Test User",
      });
      expect(result.success, `expected "${pwd}" to be rejected`).toBe(false);
    }
  });

  it("accepts strong passwords (letter + number, 8+ chars, not common)", () => {
    const result = validate(UserSchema, {
      username: "testuser",
      password: "Str0ngP@ss!",
      fullName: "Test User",
    });
    expect(result.success).toBe(true);
  });

  it("accepts random 12-char passwords (8 letters + 4 digits)", () => {
    const result = validate(UserSchema, {
      username: "testuser",
      password: "xYkPmNqRst4256",
      fullName: "Test User",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid usernames (special chars)", () => {
    const result = validate(UserSchema, {
      username: "test user!",
      password: "Str0ngP@ss!",
      fullName: "Test User",
    });
    expect(result.success).toBe(false);
  });
});

describe("Password change schema", () => {
  it("requires both currentPassword and newPassword", () => {
    const result = validate(PasswordChangeSchema, { currentPassword: "x" });
    expect(result.success).toBe(false);
  });

  it("applies the same strong-password policy to newPassword", () => {
    const result = validate(PasswordChangeSchema, {
      currentPassword: "anything",
      newPassword: "weak",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a valid password change request", () => {
    const result = validate(PasswordChangeSchema, {
      currentPassword: "OldPass123",
      newPassword: "NewPass456",
    });
    expect(result.success).toBe(true);
  });
});
