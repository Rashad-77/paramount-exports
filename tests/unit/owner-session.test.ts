import { describe, expect, it } from "vitest";
import { OWNER_IDLE_MS, OWNER_SESSION_MAX_MS, ownerCookieOptions, ownerSessionExpired } from "@/lib/auth/owner-session";

const MIN = 60 * 1000;

describe("owner session limits", () => {
  const now = Date.UTC(2026, 9, 21, 12, 0, 0);

  it("keeps a session that is recent and active", () => {
    expect(ownerSessionExpired(now, now - 5 * MIN, now - 1 * MIN)).toBe(false);
  });

  it("ends a session left idle for longer than the idle limit", () => {
    expect(ownerSessionExpired(now, now - 60 * MIN, now - OWNER_IDLE_MS - 1)).toBe(true);
    expect(ownerSessionExpired(now, now - 60 * MIN, now - OWNER_IDLE_MS + MIN)).toBe(false);
  });

  it("ends a session that has been open longer than a working day, even if it is busy", () => {
    expect(ownerSessionExpired(now, now - OWNER_SESSION_MAX_MS - 1, now - MIN)).toBe(true);
    expect(ownerSessionExpired(now, now - OWNER_SESSION_MAX_MS + MIN, now - MIN)).toBe(false);
  });

  it("does not end a session just because a timestamp is missing", () => {
    expect(ownerSessionExpired(now, null, null)).toBe(false);
    expect(ownerSessionExpired(now, now - MIN, null)).toBe(false);
  });
});

describe("owner cookie options", () => {
  it("makes the sign-in cookie a session cookie that scripts cannot read", () => {
    const o = ownerCookieOptions("token", { maxAge: 400 * 24 * 3600, expires: new Date(), sameSite: "none", path: "/x" });
    expect(o.maxAge).toBeUndefined();
    expect(o.expires).toBeUndefined();
    expect(o.httpOnly).toBe(true);
    expect(o.sameSite).toBe("lax");
    expect(o.path).toBe("/");
  });

  it("leaves a cookie that is being deleted alone", () => {
    expect(ownerCookieOptions("", { maxAge: 0 })).toEqual({ maxAge: 0 });
    expect(ownerCookieOptions("x", { maxAge: 0 })).toEqual({ maxAge: 0 });
  });
});
