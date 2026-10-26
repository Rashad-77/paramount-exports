-- A main category can have a picture behind its band on the homepage, and a position for it (percent from the left and from the top).
ALTER TABLE product_categories ADD COLUMN IF NOT EXISTS banner_file_id uuid REFERENCES uploaded_files(id) ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE product_categories ADD COLUMN IF NOT EXISTS banner_x integer DEFAULT 50 NOT NULL;--> statement-breakpoint
ALTER TABLE product_categories ADD COLUMN IF NOT EXISTS banner_y integer DEFAULT 50 NOT NULL;
