import { describe, expect, it, beforeAll } from "vitest";

beforeAll(() => {
  process.env.IP_HASH_SALT = "unit-test-salt-unit-test-salt-1234";
});

describe("form token", () => {
  it("accepts a token after the minimum fill time and rejects instant, stale, forged and missing tokens", async () => {
    const { checkFormToken, issueFormToken, MAX_TOKEN_AGE_SECONDS, MIN_FILL_SECONDS } = await import("@/lib/form-guard");
    const t0 = 1_800_000_000_000;
    const token = issueFormToken(t0);
    expect(checkFormToken(token, t0 + 500)).toBe("too-fast");
    expect(checkFormToken(token, t0 + MIN_FILL_SECONDS * 1000 + 1)).toBe("ok");
    expect(checkFormToken(token, t0 + (MAX_TOKEN_AGE_SECONDS + 5) * 1000)).toBe("expired");
    expect(checkFormToken(undefined, t0)).toBe("missing");
    expect(checkFormToken("123456789012.AAAA", t0 + 10_000)).toBe("forged");
    const [ts] = token.split(".");
    expect(checkFormToken(`${Number(ts) - 100}.${token.split(".")[1]}`, t0 + 10_000)).toBe("forged");
  });
});

describe("contact normalisation", () => {
  it("matches the same Sri Lankan number however it is typed", async () => {
    const { phoneKey, isPlausiblePhone, whatsappLink } = await import("@/lib/contact");
    expect(new Set(["+94 77 123 4567", "0771234567", "94771234567", "077-123-4567"].map(phoneKey)).size).toBe(1);
    expect(isPlausiblePhone("12")).toBe(false);
    expect(isPlausiblePhone("call me")).toBe(false);
    expect(whatsappLink("077 123 4567")).toBe("https://wa.me/94771234567");
    expect(whatsappLink("+44 7700 900123")).toBe("https://wa.me/447700900123");
  });
});
