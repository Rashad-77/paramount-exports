/* eslint-disable no-console */
/**
 * Create the Supabase Storage buckets with size and type limits (idempotent).
 *   pnpm tsx scripts/setup-storage.ts
 * Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. `private-files` is private; `public-media` is public-read.
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local" });
config();

const BUCKETS = [
  { id: "private-files", public: false, fileSizeLimit: 10 * 1024 * 1024, allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "application/pdf"] },
  { id: "public-media", public: true, fileSizeLimit: 8 * 1024 * 1024, allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"] },
];

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY first.");
    process.exit(1);
  }
  const client = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  for (const b of BUCKETS) {
    const opts = { public: b.public, fileSizeLimit: b.fileSizeLimit, allowedMimeTypes: b.allowedMimeTypes };
    const { error } = await client.storage.createBucket(b.id, opts);
    if (error && /already exists/i.test(error.message)) {
      const upd = await client.storage.updateBucket(b.id, opts);
      if (upd.error) throw new Error(`Could not update bucket ${b.id}: ${upd.error.message}`);
      console.log(`Updated bucket ${b.id}`);
    } else if (error) {
      throw new Error(`Could not create bucket ${b.id}: ${error.message}`);
    } else {
      console.log(`Created bucket ${b.id}`);
    }
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
