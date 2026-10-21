import "server-only";
import { and, desc, eq, inArray } from "drizzle-orm";
import { requirePermission, type Actor } from "@/lib/auth/permissions";
import { getDb, withTx } from "@/lib/db/client";
import { customerReviews, uploadedFiles, type ReviewStatus } from "@/lib/db/schema";
import { notFound, rateLimited } from "@/lib/errors";
import { hitRateLimit } from "@/lib/rate-limit";
import type { ReviewInput } from "@/lib/schemas/reviews";
import { getStorage, type BucketName } from "@/lib/storage";
import { recordAudit } from "./audit";
import { avatarsFor } from "./avatars";
import { linkUploads, publicFileUrl, verifyUploads } from "./files";

export const REVIEW_LIMIT = { limit: 3, windowSeconds: 3600 } as const;

export interface SiteReview {
  id: string;
  name: string;
  city: string | null;
  stars: number;
  body: string;
  status: ReviewStatus;
  createdAt: Date;
  photos: string[];
  /** The reviewer's profile picture, when they wrote it signed in and have one. */
  avatar: string | null;
}

/** A review written in the pop-up. It shows on the homepage straight away. Callers must have passed the form guard already. */
export async function submitReview(input: ReviewInput, ctx: { ip: string | null; accountId?: string | null }): Promise<{ id: string }> {
  const db = getDb();
  const hit = await hitRateLimit(db, { scope: "review-ip", value: ctx.ip ?? "unknown", ...REVIEW_LIMIT });
  if (!hit.allowed) throw rateLimited("You have sent several reviews recently. Please try again later.");

  const verified = await verifyUploads(input.fileIds, "review", null);
  return withTx(async (tx) => {
    const [row] = await tx
      .insert(customerReviews)
      .values({ name: input.name, city: input.city, stars: input.stars, body: input.body, accountId: ctx.accountId ?? null })
      .returning({ id: customerReviews.id });
    await linkUploads(tx, verified, { type: "review", id: row!.id });
    return { id: row!.id };
  });
}

async function withPhotos(rows: Array<Omit<SiteReview, "photos" | "avatar"> & { accountId: string | null }>): Promise<SiteReview[]> {
  if (rows.length === 0) return [];
  const files = await getDb()
    .select()
    .from(uploadedFiles)
    .where(and(eq(uploadedFiles.entityType, "review"), eq(uploadedFiles.status, "linked"), inArray(uploadedFiles.entityId, rows.map((r) => r.id))))
    .orderBy(uploadedFiles.createdAt);
  const avatars = await avatarsFor(rows.flatMap((r) => (r.accountId ? [r.accountId] : [])));
  return rows.map(({ accountId, ...r }) => ({ ...r, photos: files.filter((f) => f.entityId === r.id).map((f) => publicFileUrl(f)), avatar: accountId ? (avatars.get(accountId) ?? null) : null }));
}

/** What the homepage shows: approved reviews, newest first. */
export async function listApprovedReviews(limit = 12): Promise<SiteReview[]> {
  const rows = await getDb().select().from(customerReviews).where(eq(customerReviews.status, "approved")).orderBy(desc(customerReviews.createdAt)).limit(limit);
  return withPhotos(rows);
}

/** Every review, for the dashboard, newest first. */
export async function listReviewsForStaff(actor: Actor): Promise<SiteReview[]> {
  requirePermission(actor, "website:manage");
  const rows = await getDb().select().from(customerReviews).orderBy(desc(customerReviews.createdAt)).limit(200);
  return withPhotos(rows);
}

export async function setReviewStatus(actor: Actor, id: string, status: ReviewStatus): Promise<void> {
  requirePermission(actor, "website:manage");
  await withTx(async (tx) => {
    const [before] = await tx.select({ status: customerReviews.status }).from(customerReviews).where(eq(customerReviews.id, id)).limit(1);
    if (!before) throw notFound();
    await tx.update(customerReviews).set({ status }).where(eq(customerReviews.id, id));
    await recordAudit(tx, actor, { action: "review.status", entityType: "customer_review", entityId: id, before: { status: before.status }, after: { status } });
  });
}

export async function deleteReview(actor: Actor, id: string): Promise<void> {
  requirePermission(actor, "website:manage");
  const db = getDb();
  const files = await db.select().from(uploadedFiles).where(and(eq(uploadedFiles.entityType, "review"), eq(uploadedFiles.entityId, id)));
  const storage = getStorage();
  for (const f of files) {
    await storage.remove(f.bucket as BucketName, f.objectKey).catch(() => undefined);
    await db.update(uploadedFiles).set({ status: "purged" }).where(eq(uploadedFiles.id, f.id));
  }
  await withTx(async (tx) => {
    const gone = await tx.delete(customerReviews).where(eq(customerReviews.id, id)).returning({ id: customerReviews.id });
    if (gone.length === 0) throw notFound();
    await recordAudit(tx, actor, { action: "review.delete", entityType: "customer_review", entityId: id });
  });
}
