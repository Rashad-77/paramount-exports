import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { uploadedFiles } from "@/lib/db/schema";
import { getStorage, PUBLIC_BUCKET, SAFE_KEY } from "@/lib/storage";
import { localStorageAllowed } from "@/lib/storage/local";

export const dynamic = "force-dynamic";

/** Serves PUBLIC images when the local (dev/test) storage driver is active. With Supabase, public URLs go straight to the CDN. */
export async function GET(_req: Request, { params }: { params: Promise<{ key: string[] }> }) {
  if (!localStorageAllowed() || process.env.STORAGE_DRIVER !== "local") return new NextResponse(null, { status: 404 });
  const key = (await params).key.join("/");
  if (!SAFE_KEY.test(key)) return new NextResponse(null, { status: 404 });
  const [file] = await getDb()
    .select()
    .from(uploadedFiles)
    .where(and(eq(uploadedFiles.bucket, PUBLIC_BUCKET), eq(uploadedFiles.objectKey, key), eq(uploadedFiles.visibility, "public"), eq(uploadedFiles.status, "linked")))
    .limit(1);
  if (!file) return new NextResponse(null, { status: 404 });
  const d = await getStorage().download(PUBLIC_BUCKET, key, 60);
  if (d.type !== "bytes") return new NextResponse(null, { status: 404 });
  return new NextResponse(Buffer.from(d.body), {
    headers: { "Content-Type": file.contentType, "Cache-Control": "public, max-age=3600", "X-Content-Type-Options": "nosniff" },
  });
}
