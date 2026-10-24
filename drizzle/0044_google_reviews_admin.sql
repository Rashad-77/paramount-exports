-- Staff can add Google reviews by hand and hide any review. "source" says who saved it; a hidden review stays saved so the daily job does not add it again.
ALTER TABLE google_reviews ADD COLUMN IF NOT EXISTS source text DEFAULT 'google' NOT NULL;--> statement-breakpoint
ALTER TABLE google_reviews ADD COLUMN IF NOT EXISTS hidden boolean DEFAULT false NOT NULL;
