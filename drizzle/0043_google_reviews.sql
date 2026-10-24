-- Google reviews kept on the site: a daily job adds the ones not saved yet (key = Google's review id, unique), and the homepage shows these.
CREATE TABLE IF NOT EXISTS "google_reviews" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "key" text NOT NULL UNIQUE,
  "author" text NOT NULL,
  "rating" integer NOT NULL,
  "body" text NOT NULL,
  "photo_url" text,
  "published_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "google_reviews_rating_range" CHECK ("rating" BETWEEN 1 AND 5)
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "google_reviews_published_idx" ON "google_reviews" ("published_at");--> statement-breakpoint
SELECT enforce_rls();
