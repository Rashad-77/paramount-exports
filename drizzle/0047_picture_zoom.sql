-- Banner pictures and product photographs can be zoomed in (100 = fills the frame, up to 300).
ALTER TABLE product_categories ADD COLUMN IF NOT EXISTS banner_zoom integer DEFAULT 100 NOT NULL;--> statement-breakpoint
ALTER TABLE product_images ADD COLUMN IF NOT EXISTS focus_zoom integer DEFAULT 100 NOT NULL;
