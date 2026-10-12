import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { hashingSalt } from "@/lib/rate-limit";

/**
 * Anti-spam for public forms. Layers (none is sufficient alone):
 *  1. honeypot field that humans never fill;
 *  2. signed, time-stamped token: rejects instant submissions and stale/forged tokens;
 *  3. optional Cloudflare Turnstile when keys are configured;
 *  4. per-IP / per-contact rate limits (see rate-limit.ts, applied in the service).
 */

import { HONEYPOT_FIELD as HP } from "./form-guard-constants";
export const HONEYPOT_FIELD = HP;
export const MIN_FILL_SECONDS = 3;
export const MAX_TOKEN_AGE_SECONDS = 2 * 60 * 60;

const sign = (ts: string) => createHmac("sha256", hashingSalt()).update(`form|${ts}`).digest("base64url");

export function issueFormToken(now: number = Date.now()): string {
  const ts = String(Math.floor(now / 1000));
  return `${ts}.${sign(ts)}`;
}

export type TokenCheck = "ok" | "missing" | "forged" | "too-fast" | "expired";

export function checkFormToken(token: string | null | undefined, now: number = Date.now()): TokenCheck {
  if (!token) return "missing";
  const [ts, mac] = token.split(".");
  if (!ts || !mac || !/^\d{9,12}$/.test(ts)) return "forged";
  const expected = Buffer.from(sign(ts));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return "forged";
  const age = Math.floor(now / 1000) - Number(ts);
  if (age < MIN_FILL_SECONDS) return "too-fast";
  if (age > MAX_TOKEN_AGE_SECONDS) return "expired";
  return "ok";
}

export async function verifyTurnstile(token: string | null | undefined, ip: string | null): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true; // not configured: layer disabled
  if (!token) return false;
  try {
    const body = new URLSearchParams({ secret, response: token });
    if (ip) body.set("remoteip", ip);
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body,
      signal: AbortSignal.timeout(5000),
    });
    const json = (await res.json()) as { success?: boolean };
    return json.success === true;
  } catch {
    return false; // fail closed
  }
}
