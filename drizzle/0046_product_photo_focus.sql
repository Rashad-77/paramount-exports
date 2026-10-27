-- Each product photograph can be placed in its 4:5 frame: percent from the left and from the top.
ALTER TABLE product_images ADD COLUMN IF NOT EXISTS focus_x integer DEFAULT 50 NOT NULL;--> statement-breakpoint
ALTER TABLE product_images ADD COLUMN IF NOT EXISTS focus_y integer DEFAULT 50 NOT NULL;
