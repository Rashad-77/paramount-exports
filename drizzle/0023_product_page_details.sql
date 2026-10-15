ALTER TABLE "products" ADD COLUMN "short_description" text;
--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "features" text;
--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "uses" text;
--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "wood_treatment" text;
--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "colour" text;
--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "other_specs" text;
--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "lead_time" text;
--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "care_instructions" text;
--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "customization" text[] DEFAULT '{}' NOT NULL;
--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "purchase_mode" text DEFAULT 'direct' NOT NULL;
--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_wood_treatment_known" CHECK ("wood_treatment" IS NULL OR "wood_treatment" IN ('treated', 'untreated'));
--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_purchase_mode_known" CHECK ("purchase_mode" IN ('direct', 'quote', 'both'));
--> statement-breakpoint
UPDATE "products" SET "purchase_mode" = 'quote' WHERE "kind" = 'made_to_order' OR NOT "show_price";
--> statement-breakpoint
SELECT enforce_rls();
