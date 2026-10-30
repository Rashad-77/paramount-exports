import "server-only";
import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb, withTx } from "@/lib/db/client";
import { customerAccounts, uploadedFiles } from "@/lib/db/schema";
import { getStorage, type BucketName } from "@/lib/storage";
import { linkUploads, publicFileUrl, verifyUploads } from "./files";

/** A customer's profile picture is a file linked to their account under this entity type: no column of its own, and a new picture replaces the old one. */
const ENTITY = "account-avatar";

async function dropOld(accountId: string, keepId?: string): Promise<void> {
  const db = getDb();
  const old = await db
    .select()
    .from(uploadedFiles)
    .where(
      and(
        eq(uploadedFiles.entityType, ENTITY),
        eq(uploadedFiles.entityId, accountId),
        eq(uploadedFiles.status, "linked"),
      ),
    );
  const storage = getStorage();
  for (const f of old) {
    if (f.id === keepId) continue;
    await storage
      .remove(f.bucket as BucketName, f.objectKey)
      .catch(() => undefined);
    await db
      .update(uploadedFiles)
      .set({ status: "purged" })
      .where(eq(uploadedFiles.id, f.id));
  }
}

/** Make an uploaded picture the customer's profile picture. */
export async function setAvatar(
  accountId: string,
  fileId: string,
): Promise<void> {
  const verified = await verifyUploads([fileId], "avatar", null);
  await withTx(async (tx) => {
    await linkUploads(tx, verified, { type: ENTITY, id: accountId });
  });
  await dropOld(accountId, fileId);
}

export async function removeAvatar(accountId: string): Promise<void> {
  await dropOld(accountId);
}

/** Whether this customer has uploaded a picture of their own (the one Google gave them does not count: there is nothing of theirs to remove). */
export async function hasUploadedAvatar(accountId: string): Promise<boolean> {
  const [row] = await getDb()
    .select({ id: uploadedFiles.id })
    .from(uploadedFiles)
    .where(and(eq(uploadedFiles.entityType, ENTITY), eq(uploadedFiles.status, "linked"), eq(uploadedFiles.entityId, accountId)))
    .limit(1);
  return Boolean(row);
}

/** The profile pictures of these accounts (those without one are left out). */
export async function avatarsFor(
  accountIds: string[],
): Promise<Map<string, string>> {
  const ids = [...new Set(accountIds)];
  const out = new Map<string, string>();
  if (ids.length === 0) return out;
  const rows = await getDb()
    .select()
    .from(uploadedFiles)
    .where(
      and(
        eq(uploadedFiles.entityType, ENTITY),
        eq(uploadedFiles.status, "linked"),
        inArray(uploadedFiles.entityId, ids),
      ),
    )
    .orderBy(desc(uploadedFiles.createdAt));
  for (const r of rows)
    if (r.entityId && !out.has(r.entityId))
      out.set(r.entityId, publicFileUrl(r));
  // Anyone without an uploaded picture shows the one Google gave them, if they signed in with Google.
  const missing = ids.filter((id) => !out.has(id));
  if (missing.length > 0) {
    const g = await getDb().select({ id: customerAccounts.id, url: customerAccounts.avatarUrl }).from(customerAccounts).where(inArray(customerAccounts.id, missing));
    for (const r of g) if (r.url) out.set(r.id, r.url);
  }
  return out;
}
