-- When a product was last put on the website; the "New" tag counts from here. Products already on the site count from when they were added.
ALTER TABLE products ADD COLUMN IF NOT EXISTS published_at timestamp with time zone;--> statement-breakpoint
UPDATE products SET published_at = created_at WHERE is_published AND published_at IS NULL;
