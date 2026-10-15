import { describe, expect, it } from "vitest";
import { hashPassword, readSession, signSession, verifyPassword } from "@/lib/auth/local-credentials";

const secret = "a-test-secret-of-sufficient-length";
const id = "11111111-1111-4111-8111-111111111111";

describe("local customer credentials (development sign-in)", () => {
  it("accepts the right password and rejects any other", async () => {
    const stored = await hashPassword("correct horse battery");
    expect(stored).not.toContain("correct horse");
    expect(await verifyPassword("correct horse battery", stored)).toBe(true);
    expect(await verifyPassword("correct horse batterx", stored)).toBe(false);
    expect(await verifyPassword("anything", null)).toBe(false);
    expect(await verifyPassword("anything", "not-a-hash")).toBe(false);
  });

  it("gives each password its own salt", async () => {
    expect(await hashPassword("same password")).not.toBe(await hashPassword("same password"));
  });

  it("reads back a valid session", () => {
    expect(readSession(signSession(id, secret, 60), secret)).toBe(id);
  });

  it("rejects an expired, tampered or foreign session", () => {
    const now = Date.now();
    expect(readSession(signSession(id, secret, 60, now - 120_000), secret, now)).toBeNull();
    const good = signSession(id, secret, 60);
    expect(readSession(good.replace(id, "22222222-2222-4222-8222-222222222222"), secret)).toBeNull();
    expect(readSession(good, "another-secret-another-secret")).toBeNull();
    expect(readSession("garbage", secret)).toBeNull();
    expect(readSession(undefined, secret)).toBeNull();
  });
});
