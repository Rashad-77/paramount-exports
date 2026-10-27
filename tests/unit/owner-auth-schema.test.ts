import { describe, expect, it } from "vitest";
import { ownerForgotSchema, ownerResetSchema } from "@/lib/schemas/owner-auth";

describe("owner sign-in forms", () => {
  it("asks for a valid email when the password is forgotten", () => {
    expect(ownerForgotSchema.safeParse({ email: "owner@example.com" }).success).toBe(true);
    expect(ownerForgotSchema.safeParse({ email: "not an email" }).success).toBe(false);
  });

  it("wants a new password of at least 12 characters, typed twice the same", () => {
    expect(ownerResetSchema.safeParse({ newPassword: "short", confirmPassword: "short" }).success).toBe(false);
    expect(ownerResetSchema.safeParse({ newPassword: "a long passphrase", confirmPassword: "a different one" }).success).toBe(false);
    expect(ownerResetSchema.safeParse({ newPassword: "a long passphrase", confirmPassword: "a long passphrase" }).success).toBe(true);
  });
});
