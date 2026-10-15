ALTER TABLE "gallery_projects" ADD COLUMN "category_id" uuid;
--> statement-breakpoint
ALTER TABLE "gallery_projects" ADD CONSTRAINT "gallery_projects_category_id_product_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."product_categories"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "gallery_projects_category_idx" ON "gallery_projects" USING btree ("category_id");
--> statement-breakpoint
SELECT enforce_rls();
