ALTER TABLE "product_variants" ADD COLUMN "compare_price" numeric(14, 2);
--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_compare_price_higher" CHECK ("compare_price" IS NULL OR ("list_price" IS NOT NULL AND "compare_price" > "list_price"));
--> statement-breakpoint
SELECT enforce_rls();
