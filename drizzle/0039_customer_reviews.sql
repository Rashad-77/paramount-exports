-- Reviews written in the "Review" pop-up on the website: the customer's stars and words, their name and city, and photographs (kept in uploaded_files with entity_type 'review'). A review shows on the homepage straight away; staff can hide or delete one.
CREATE TABLE "customer_reviews" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "city" text,
  "stars" integer NOT NULL,
  "body" text NOT NULL,
  "status" text DEFAULT 'approved' NOT NULL,
  "account_id" uuid REFERENCES "customer_accounts"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "customer_reviews_stars_range" CHECK ("stars" BETWEEN 1 AND 5),
  CONSTRAINT "customer_reviews_status_known" CHECK ("status" IN ('approved', 'hidden'))
);--> statement-breakpoint
CREATE INDEX "customer_reviews_status_idx" ON "customer_reviews" ("status", "created_at");--> statement-breakpoint
SELECT enforce_rls();
