import { index, integer, pgTable, text, timestamp, uuid, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * Google reviews saved on the site. A daily job asks Google for the latest reviews and adds only the ones not saved yet;
 * the homepage shows these. Reviews are written on Google only, never here. `key` is Google's own review id (or, without one, a
 * fingerprint of author, stars and words) and is unique, so the same review is never saved twice.
 */
export const googleReviews = pgTable(
  "google_reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    key: text("key").notNull().unique(),
    author: text("author").notNull(),
    rating: integer("rating").notNull(),
    body: text("body").notNull(),
    photoUrl: text("photo_url"),
    /** When Google says it was posted. */
    publishedAt: timestamp("published_at", { withTimezone: true }),
    /** When the site first saved it. */
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("google_reviews_published_idx").on(t.publishedAt), check("google_reviews_rating_range", sql`${t.rating} BETWEEN 1 AND 5`)],
);
