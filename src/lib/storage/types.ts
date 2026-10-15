/** Storage buckets. Private: customer references, attachments, proofs. Public: catalogue + gallery images. */
export const PRIVATE_BUCKET = "private-files";
export const PUBLIC_BUCKET = "public-media";
export type BucketName = typeof PRIVATE_BUCKET | typeof PUBLIC_BUCKET;

export const IMAGE_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
export const DOCUMENT_TYPES: Record<string, string> = { "application/pdf": "pdf" };
export const MB = 1024 * 1024;

/** Object keys are generated server-side; this is also the allow-list used when resolving paths. */
export const SAFE_KEY = /^[a-z0-9_-]+(\/[a-z0-9_-]+)*\/[a-z0-9_-]+\.[a-z0-9]+$/;

export interface SignedUpload {
  driver: "supabase" | "local";
  bucket: BucketName;
  key: string;
  /** Supabase: token for uploadToSignedUrl. */
  token?: string;
  /** Local: URL to PUT the raw file body to. */
  url?: string;
}

export type Download = { type: "redirect"; url: string } | { type: "bytes"; body: Uint8Array; contentType: string };

export interface StorageProvider {
  createSignedUpload(bucket: BucketName, key: string, opts: { contentType: string; maxBytes: number }): Promise<SignedUpload>;
  head(bucket: BucketName, key: string): Promise<{ size: number; contentType: string | null } | null>;
  readHead(bucket: BucketName, key: string, bytes: number): Promise<Uint8Array | null>;
  download(bucket: BucketName, key: string, expiresInSeconds: number): Promise<Download>;
  publicUrl(bucket: BucketName, key: string): string;
  remove(bucket: BucketName, key: string): Promise<void>;
}

/** Identify a file by its first bytes so a renamed/spoofed upload is rejected regardless of the declared type. */
export function sniffContentType(head: Uint8Array): string | null {
  const b = head;
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return "image/png";
  if (b.length >= 12 && String.fromCharCode(...b.slice(0, 4)) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP") return "image/webp";
  if (b.length >= 5 && String.fromCharCode(...b.slice(0, 5)) === "%PDF-") return "application/pdf";
  return null;
}
