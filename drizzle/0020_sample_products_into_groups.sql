UPDATE "products" SET "category_id" = (SELECT "id" FROM "product_categories" WHERE "slug" = 'tables') WHERE "category_id" IN (SELECT "id" FROM "product_categories" WHERE "name" = '[Sample] Dining Tables') AND EXISTS (SELECT 1 FROM "product_categories" WHERE "slug" = 'tables');
--> statement-breakpoint
UPDATE "products" SET "category_id" = (SELECT "id" FROM "product_categories" WHERE "slug" = 'chairs') WHERE "category_id" IN (SELECT "id" FROM "product_categories" WHERE "name" = '[Sample] Chairs') AND EXISTS (SELECT 1 FROM "product_categories" WHERE "slug" = 'chairs');
--> statement-breakpoint
UPDATE "products" SET "category_id" = (SELECT "id" FROM "product_categories" WHERE "slug" = 'pantry-cupboards') WHERE "category_id" IN (SELECT "id" FROM "product_categories" WHERE "name" = '[Sample] Storage') AND EXISTS (SELECT 1 FROM "product_categories" WHERE "slug" = 'pantry-cupboards');
--> statement-breakpoint
UPDATE "product_categories" SET "is_active" = false, "archived_at" = now() WHERE "name" LIKE '[Sample]%' AND "archived_at" IS NULL AND NOT EXISTS (SELECT 1 FROM "products" WHERE "products"."category_id" = "product_categories"."id");
