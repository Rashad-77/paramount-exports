import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { Actor, Role } from "@/lib/auth/permissions";
import { __setDbForTests } from "@/lib/db/client";
import { __setStorageForTests, getStorage } from "@/lib/storage";
import { createLocalProvider, writeLocalObject } from "@/lib/storage/local";
import { requestUpload, type PurposeName } from "@/server/files";
import { createTestDb, type TestDb } from "./db";

/** Wire the service layer to a fresh throwaway database + a temp-dir local storage driver. */
export async function setupApp(): Promise<TestDb & { storageDir: string; teardown(): Promise<void> }> {
  const storageDir = fs.mkdtempSync(path.join(os.tmpdir(), "furniture-test-storage-"));
  process.env.STORAGE_DRIVER = "local";
  process.env.LOCAL_STORAGE_DIR = storageDir;
  process.env.IP_HASH_SALT = "test-salt-test-salt-test-salt-1234";
  const t = await createTestDb();
  process.env.DATABASE_URL = t.url;
  __setDbForTests(t.db);
  __setStorageForTests(createLocalProvider());
  return {
    ...t,
    storageDir,
    async teardown() {
      __setDbForTests(undefined);
      __setStorageForTests(undefined);
      fs.rmSync(storageDir, { recursive: true, force: true });
      await t.close();
    },
  };
}

export async function makeActor(t: TestDb, roles: Role[], fullName = "Test Person", opts: { active?: boolean } = {}): Promise<Actor> {
  const id = randomUUID();
  await t.sql`INSERT INTO auth.users (id, email) VALUES (${id}, ${`${id}@example.test`})`;
  await t.sql`INSERT INTO profiles (id, full_name, is_active) VALUES (${id}, ${fullName}, ${opts.active ?? true})`;
  for (const role of roles) await t.sql`INSERT INTO user_roles (user_id, role) VALUES (${id}, ${role})`;
  return { id, fullName, roles, isActive: opts.active ?? true };
}

// Tiny valid headers for magic-byte sniffing (content after the header is irrelevant to the checks).
export const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0]);
export const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d, 0x49, 0x48, 0x44, 0x52]);
export const PDF = new TextEncoder().encode("%PDF-1.4\n%test\n");
export const NOT_AN_IMAGE = new TextEncoder().encode("<script>alert('hi')</script> this is not an image at all");

/** Full signed-upload round trip against the local driver: request → write bytes → return the file id. */
export async function uploadTestFile(
  purpose: PurposeName,
  bytes: Uint8Array,
  contentType: string,
  ctx: { actor?: Actor | null; ip?: string | null; fileName?: string } = {},
): Promise<string> {
  const { fileId, signed } = await requestUpload(
    { purpose, fileName: ctx.fileName ?? "photo.jpg", contentType, size: bytes.byteLength },
    { actor: ctx.actor ?? null, ip: ctx.ip ?? "203.0.113.9" },
  );
  await writeLocalObject(signed.bucket, signed.key, bytes);
  void getStorage;
  return fileId;
}
