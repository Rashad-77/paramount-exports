import { NextResponse } from "next/server";
import { localStorageAllowed, verifyLocalUpload, writeLocalObject } from "@/lib/storage/local";

export const dynamic = "force-dynamic";

/** Receiving end of the DEV/TEST-only local storage driver. Never reachable in production. */
export async function PUT(req: Request) {
  if (!localStorageAllowed() || process.env.STORAGE_DRIVER !== "local") return new NextResponse(null, { status: 404 });
  const u = new URL(req.url);
  const bucket = u.searchParams.get("bucket") ?? "";
  const key = u.searchParams.get("key") ?? "";
  const exp = Number(u.searchParams.get("exp"));
  const max = Number(u.searchParams.get("max"));
  const sig = u.searchParams.get("sig") ?? "";
  if (!verifyLocalUpload({ bucket, key, exp, max, sig })) return NextResponse.json({ error: "Upload link is invalid or expired." }, { status: 403 });

  // Enforce the size limit while reading, so an oversized body is never held in memory.
  const reader = req.body?.getReader();
  if (!reader) return NextResponse.json({ error: "Empty upload." }, { status: 400 });
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel();
      return NextResponse.json({ error: "File too large." }, { status: 413 });
    }
    chunks.push(value);
  }
  const body = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    body.set(c, off);
    off += c.byteLength;
  }
  await writeLocalObject(bucket, key, body);
  return new NextResponse(null, { status: 200 });
}
