import { describe, expect, it } from "vitest";
import { needsSecondStep } from "@/lib/auth/owner-session";
import { ownerCodeSchema, ownerEnrollSchema, ownerForgotSchema, ownerResetSchema } from "@/lib/schemas/owner-auth";

describe("owner sign-in forms", () => {
  it("accepts a six-digit code, with or without a space in the middle", () => {
    expect(ownerCodeSchema.parse({ code: "123456" }).code).toBe("123456");
    expect(ownerCodeSchema.parse({ code: "123 456" }).code).toBe("123456");
  });

  it("rejects anything that is not six digits", () => {
    for (const code of ["", "12345", "1234567", "abcdef", "12 34 5a"]) expect(ownerCodeSchema.safeParse({ code }).success, code).toBe(false);
  });

  it("needs a real factor id to finish set-up", () => {
    expect(ownerEnrollSchema.safeParse({ factorId: "nope", code: "123456" }).success).toBe(false);
    expect(ownerEnrollSchema.safeParse({ factorId: "00000000-0000-4000-8000-000000000001", code: "123456" }).success).toBe(true);
  });

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

describe("second step", () => {
  it("is needed only when the account has a verified code and this session has not given it", () => {
    expect(needsSecondStep("aal1", "aal2")).toBe(true);
    expect(needsSecondStep("aal2", "aal2")).toBe(false);
    expect(needsSecondStep("aal1", "aal1")).toBe(false);
    expect(needsSecondStep(undefined, undefined)).toBe(false);
  });
});
