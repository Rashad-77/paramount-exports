import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { hashingSalt } from "@/lib/rate-limit";
import { SAFE_KEY, type BucketName, type Download, type SignedUpload, type StorageProvider } from "./types";

/**
 * Disk-backed storage for local development and automated tests ONLY (Vercel's filesystem is ephemeral).
 * Refused on Vercel always; refused in production builds unless ALLOW_LOCAL_STORAGE=e2e-only (set only by the
 * Playwright config, which runs `next start` against a throwaway database).
 */
export function localStorageAllowed(): boolean {
  if (process.env.VERCEL) return false;
  if (process.env.NODE_ENV !== "production") return true;
  return process.env.ALLOW_LOCAL_STORAGE === "e2e-only";
}

const root = () => process.env.LOCAL_STORAGE_DIR ?? path.join(process.cwd(), ".local-storage");

function resolve(bucket: string, key: string): string {
  if (!SAFE_KEY.test(key) || key.includes("..")) throw new Error("Unsafe storage key");
  const base = path.resolve(root(), bucket);
  const full = path.resolve(base, key);
  if (!full.startsWith(base + path.sep)) throw new Error("Unsafe storage path");
  return full;
}

const mac = (bucket: string, key: string, exp: number, max: number) =>
  createHmac("sha256", hashingSalt()).update(`local-upload|${bucket}|${key}|${exp}|${max}`).digest("base64url");

export function verifyLocalUpload(p: { bucket: string; key: string; exp: number; max: number; sig: string }): boolean {
  if (!Number.isFinite(p.exp) || p.exp < Date.now() / 1000) return false;
  const a = Buffer.from(mac(p.bucket, p.key, p.exp, p.max));
  const b = Buffer.from(p.sig);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function writeLocalObject(bucket: string, key: string, body: Uint8Array): Promise<void> {
  const full = resolve(bucket, key);
  await fs.mkdir(/*turbopackIgnore: true*/ path.dirname(full), { recursive: true });
  await fs.writeFile(/*turbopackIgnore: true*/ full, body);
}

export function createLocalProvider(): StorageProvider {
  if (!localStorageAllowed()) throw new Error("The local storage driver cannot be used in production");
  return {
    async createSignedUpload(bucket: BucketName, key: string, opts): Promise<SignedUpload> {
      resolve(bucket, key); // validates
      const exp = Math.floor(Date.now() / 1000) + 600;
      const q = new URLSearchParams({ bucket, key, exp: String(exp), max: String(opts.maxBytes), sig: mac(bucket, key, exp, opts.maxBytes) });
      return { driver: "local", bucket, key, url: `/api/uploads/local?${q}` };
    },
    async head(bucket, key) {
      try {
        const st = await fs.stat(/*turbopackIgnore: true*/ resolve(bucket, key));
        return { size: st.size, contentType: null };
      } catch {
        return null;
      }
    },
    async readHead(bucket, key, bytes) {
      try {
        const fh = await fs.open(/*turbopackIgnore: true*/ resolve(bucket, key), "r");
        try {
          const buf = new Uint8Array(bytes);
          const { bytesRead } = await fh.read(buf, 0, bytes, 0);
          return buf.slice(0, bytesRead);
        } finally {
          await fh.close();
        }
      } catch {
        return null;
      }
    },
    async download(bucket, key): Promise<Download> {
      const body = await fs.readFile(/*turbopackIgnore: true*/ resolve(bucket, key));
      return { type: "bytes", body: new Uint8Array(body), contentType: "application/octet-stream" };
    },
    publicUrl: (bucket, key) => `/api/files/public/${key}?b=${bucket}`,
    async remove(bucket, key) {
      await fs.rm(/*turbopackIgnore: true*/ resolve(bucket, key), { force: true });
    },
  };
}
