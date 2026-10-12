import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicEnv, serverEnv } from "@/lib/env";
import type { BucketName, Download, SignedUpload, StorageProvider } from "./types";

/** Supabase Storage via the service-role key (server only). Buckets are created by `scripts/setup-storage.ts`. */
export function createSupabaseProvider(): StorageProvider {
  const url = publicEnv().NEXT_PUBLIC_SUPABASE_URL;
  const key = serverEnv().SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase Storage needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  const client = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const bucket = (b: BucketName) => client.storage.from(b);

  return {
    async createSignedUpload(b, objectKey): Promise<SignedUpload> {
      const { data, error } = await bucket(b).createSignedUploadUrl(objectKey);
      if (error || !data) throw new Error("Could not prepare the upload");
      return { driver: "supabase", bucket: b, key: objectKey, token: data.token };
    },
    async head(b, objectKey) {
      const { data, error } = await bucket(b).info(objectKey);
      if (error || !data) return null;
      return { size: Number(data.size ?? 0), contentType: data.contentType ?? null };
    },
    async readHead(b, objectKey, bytes) {
      const { data, error } = await bucket(b).createSignedUrl(objectKey, 60);
      if (error || !data) return null;
      const res = await fetch(data.signedUrl, { headers: { Range: `bytes=0-${bytes - 1}` }, signal: AbortSignal.timeout(10_000) });
      if (!res.ok) return null;
      return new Uint8Array(await res.arrayBuffer()).slice(0, bytes);
    },
    async download(b, objectKey, expiresInSeconds): Promise<Download> {
      const { data, error } = await bucket(b).createSignedUrl(objectKey, expiresInSeconds);
      if (error || !data) throw new Error("Could not create a download link");
      return { type: "redirect", url: data.signedUrl };
    },
    publicUrl: (b, objectKey) => bucket(b).getPublicUrl(objectKey).data.publicUrl,
    async remove(b, objectKey) {
      await bucket(b).remove([objectKey]);
    },
  };
}
