import "server-only";
import { createHash } from "node:crypto";
import { desc, eq, sql } from "drizzle-orm";
import type { Actor } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/permissions";
import { getDb } from "@/lib/db/client";
import { conflict, notFound } from "@/lib/errors";
import { recordAudit } from "./audit";
import { googleReviews } from "@/lib/db/schema";
import { formatReviewDate, type GoogleReview } from "@/lib/google-reviews";

/** The saved copy of a review is recognised by Google's id for it, or, when Google gives none, by who wrote it, the stars and the words. */
export function reviewKey(r: Pick<GoogleReview, "id" | "author" | "rating" | "text">): string {
  if (r.id) return r.id;
  return "h:" + createHash("sha256").update(`${r.author.toLowerCase()}|${r.rating}|${r.text.replace(/\s+/g, " ").toLowerCase()}`).digest("hex");
}

/** Same words from the same person count as the same review even if Google's id or the stars changed. */
const sameWords = (author: string, body: string) => `${author.toLowerCase()}|${body.replace(/\s+/g, " ").toLowerCase()}`;

/** The saved Google reviews, newest first. Empty when none are saved yet. */
export async function listSavedGoogleReviews(limit = 200): Promise<GoogleReview[]> {
  const rows = await getDb()
    .select()
    .from(googleReviews)
    .where(eq(googleReviews.hidden, false))
    .orderBy(sql`${googleReviews.publishedAt} desc nulls last`, desc(googleReviews.createdAt))
    .limit(limit);
  return rows.map((r) => ({
    id: r.key,
    author: r.author,
    rating: r.rating,
    text: r.body,
    when: null,
    url: null,
    photo: r.photoUrl,
    date: formatReviewDate((r.publishedAt ?? r.createdAt).toISOString()),
    published: r.publishedAt ? r.publishedAt.toISOString() : null,
  }));
}

/** Every saved review, hidden ones included, for the dashboard. */
export async function listGoogleReviewsAdmin(actor: Actor) {
  requirePermission(actor, "website:manage");
  return getDb().select().from(googleReviews).orderBy(sql`${googleReviews.publishedAt} desc nulls last`, desc(googleReviews.createdAt));
}

/** Saves a review typed in by staff, copied from Google. Refused when the same words from the same person are already saved. */
export async function addManualGoogleReview(actor: Actor, input: { author: string; rating: number; body: string; postedOn: string }): Promise<void> {
  requirePermission(actor, "website:manage");
  const db = getDb();
  const key = reviewKey({ id: null, author: input.author, rating: input.rating, text: input.body });
  const w = sameWords(input.author, input.body);
  const existing = await db.select({ key: googleReviews.key, author: googleReviews.author, body: googleReviews.body }).from(googleReviews);
  if (existing.some((e) => e.key === key || sameWords(e.author, e.body) === w)) throw conflict("That review is already saved.");
  await db.insert(googleReviews).values({ key, author: input.author, rating: input.rating, body: input.body, source: "manual", publishedAt: new Date(`${input.postedOn}T12:00:00+05:30`) });
  await recordAudit(db, actor, { action: "review.added", entityType: "google_review", entityId: key });
}

export async function setGoogleReviewHidden(actor: Actor, id: string, hidden: boolean): Promise<void> {
  requirePermission(actor, "website:manage");
  const db = getDb();
  const rows = await db.update(googleReviews).set({ hidden }).where(eq(googleReviews.id, id)).returning({ id: googleReviews.id });
  if (rows.length === 0) throw notFound("That review could not be found.");
  await recordAudit(db, actor, { action: hidden ? "review.hidden" : "review.shown", entityType: "google_review", entityId: id });
}

/** Deletes a saved review for good. Hide it instead to keep it saved but off the website. */
export async function deleteGoogleReview(actor: Actor, id: string): Promise<void> {
  requirePermission(actor, "website:manage");
  const db = getDb();
  const rows = await db.delete(googleReviews).where(eq(googleReviews.id, id)).returning({ id: googleReviews.id });
  if (rows.length === 0) throw notFound("That review could not be found.");
  await recordAudit(db, actor, { action: "review.deleted", entityType: "google_review", entityId: id });
}
