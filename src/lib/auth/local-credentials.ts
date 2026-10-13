import { randomBytes, scrypt as scryptCb, createHmac, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb) as (password: string, salt: Buffer, keylen: number) => Promise<Buffer>;

/**
 * Pieces of the DEVELOPMENT-ONLY customer sign-in (see customer.ts). Real deployments use Supabase and never touch this.
 * Passwords are stored as scrypt hashes with a random salt; sessions are signed, expiring cookies.
 */

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, 32);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string | null | undefined): Promise<boolean> {
  if (!stored) return false;
  const [kind, saltHex, hashHex] = stored.split("$");
  if (kind !== "scrypt" || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = await scrypt(password, Buffer.from(saltHex, "hex"), expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

const sign = (payload: string, secret: string) => createHmac("sha256", secret).update(payload).digest("base64url");

export function signSession(accountId: string, secret: string, ttlSeconds: number, now = Date.now()): string {
  const payload = `${accountId}.${Math.floor(now / 1000) + ttlSeconds}`;
  return `${payload}.${sign(payload, secret)}`;
}

/** The account id inside a valid, unexpired, untampered cookie value, or null. */
export function readSession(value: string | undefined, secret: string, now = Date.now()): string | null {
  if (!value) return null;
  const parts = value.split(".");
  if (parts.length !== 3) return null;
  const [id, exp, mac] = parts as [string, string, string];
  const good = Buffer.from(sign(`${id}.${exp}`, secret));
  const given = Buffer.from(mac);
  if (good.length !== given.length || !timingSafeEqual(good, given)) return null;
  if (!/^\d+$/.test(exp) || Number(exp) * 1000 < now) return null;
  return id;
}
