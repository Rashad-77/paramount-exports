import type { CookieOptions } from "@supabase/ssr";

/**
 * How long the owner stays signed in to the staff area. Admin areas are held to a stricter standard than shop pages:
 *  - the sign-in cookie lasts only until the browser is closed (no "remembered for 30 days");
 *  - after IDLE_MS without opening a staff page the owner must enter the password again;
 *  - whatever happens, after MAX_MS the owner must enter the password again;
 *  - the cookies cannot be read by scripts on the page (HttpOnly) and are sent only over HTTPS.
 * The proxy enforces the two time limits on every /app and /print request; pages still check the owner role on the server as before.
 */
export const OWNER_IDLE_MS = 30 * 60 * 1000;
export const OWNER_SESSION_MAX_MS = 12 * 60 * 60 * 1000;
export const OWNER_SEEN_COOKIE = "pm_owner_seen";

export const ownerCookieBase = () => ({ httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/" });

/** Cookie options for the owner's sign-in cookies: a session cookie, HttpOnly, secure. Deleting a cookie (empty value or maxAge 0) is left alone. */
export function ownerCookieOptions(value: string, options: CookieOptions = {}): CookieOptions {
  if (!value || options.maxAge === 0) return options;
  const { maxAge: _maxAge, expires: _expires, ...rest } = options;
  void _maxAge;
  void _expires;
  return { ...rest, ...ownerCookieBase() };
}

/** True when the owner's session has been idle, or open, for longer than allowed. */
export function ownerSessionExpired(now: number, signedInAt: number | null, lastSeen: number | null): boolean {
  if (signedInAt !== null && now - signedInAt > OWNER_SESSION_MAX_MS) return true;
  if (lastSeen !== null && now - lastSeen > OWNER_IDLE_MS) return true;
  return false;
}
