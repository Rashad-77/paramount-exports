ALTER TABLE "product_categories" ADD COLUMN "parent_id" uuid;
--> statement-breakpoint
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_parent_id_product_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."product_categories"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "product_categories_parent_idx" ON "product_categories" USING btree ("parent_id");
--> statement-breakpoint
INSERT INTO "product_categories" ("name", "slug", "sort_order") VALUES ('Timber and Wood Planks', 'timber-and-wood-planks', 0) ON CONFLICT ("slug") DO NOTHING;
--> statement-breakpoint
INSERT INTO "product_categories" ("name", "slug", "sort_order", "parent_id") SELECT 'Mahogany', 'mahogany', 0, "id" FROM "product_categories" WHERE "slug" = 'timber-and-wood-planks' ON CONFLICT ("slug") DO NOTHING;
--> statement-breakpoint
INSERT INTO "product_categories" ("name", "slug", "sort_order", "parent_id") SELECT 'Rubber', 'rubber', 1, "id" FROM "product_categories" WHERE "slug" = 'timber-and-wood-planks' ON CONFLICT ("slug") DO NOTHING;
--> statement-breakpoint
INSERT INTO "product_categories" ("name", "slug", "sort_order", "parent_id") SELECT 'Acacia', 'acacia', 2, "id" FROM "product_categories" WHERE "slug" = 'timber-and-wood-planks' ON CONFLICT ("slug") DO NOTHING;
--> statement-breakpoint
INSERT INTO "product_categories" ("name", "slug", "sort_order", "parent_id") SELECT 'Albezia', 'albezia', 3, "id" FROM "product_categories" WHERE "slug" = 'timber-and-wood-planks' ON CONFLICT ("slug") DO NOTHING;
--> statement-breakpoint
INSERT INTO "product_categories" ("name", "slug", "sort_order", "parent_id") SELECT 'Attonia', 'attonia', 4, "id" FROM "product_categories" WHERE "slug" = 'timber-and-wood-planks' ON CONFLICT ("slug") DO NOTHING;
--> statement-breakpoint
INSERT INTO "product_categories" ("name", "slug", "sort_order", "parent_id") SELECT 'Jack', 'jack', 5, "id" FROM "product_categories" WHERE "slug" = 'timber-and-wood-planks' ON CONFLICT ("slug") DO NOTHING;
--> statement-breakpoint
INSERT INTO "product_categories" ("name", "slug", "sort_order", "parent_id") SELECT 'Grandis', 'grandis', 6, "id" FROM "product_categories" WHERE "slug" = 'timber-and-wood-planks' ON CONFLICT ("slug") DO NOTHING;
--> statement-breakpoint
INSERT INTO "product_categories" ("name", "slug", "sort_order", "parent_id") SELECT 'Paremara', 'paremara', 7, "id" FROM "product_categories" WHERE "slug" = 'timber-and-wood-planks' ON CONFLICT ("slug") DO NOTHING;
--> statement-breakpoint
INSERT INTO "product_categories" ("name", "slug", "sort_order", "parent_id") SELECT 'Duriyan', 'duriyan', 8, "id" FROM "product_categories" WHERE "slug" = 'timber-and-wood-planks' ON CONFLICT ("slug") DO NOTHING;
--> statement-breakpoint
INSERT INTO "product_categories" ("name", "slug", "sort_order", "parent_id") SELECT 'Nadun', 'nadun', 9, "id" FROM "product_categories" WHERE "slug" = 'timber-and-wood-planks' ON CONFLICT ("slug") DO NOTHING;
--> statement-breakpoint
INSERT INTO "product_categories" ("name", "slug", "sort_order") VALUES ('Furniture', 'furniture', 10) ON CONFLICT ("slug") DO NOTHING;
--> statement-breakpoint
INSERT INTO "product_categories" ("name", "slug", "sort_order", "parent_id") SELECT 'Tables', 'tables', 0, "id" FROM "product_categories" WHERE "slug" = 'furniture' ON CONFLICT ("slug") DO NOTHING;
--> statement-breakpoint
INSERT INTO "product_categories" ("name", "slug", "sort_order", "parent_id") SELECT 'Chairs', 'chairs', 1, "id" FROM "product_categories" WHERE "slug" = 'furniture' ON CONFLICT ("slug") DO NOTHING;
--> statement-breakpoint
INSERT INTO "product_categories" ("name", "slug", "sort_order", "parent_id") SELECT 'Benches', 'benches', 2, "id" FROM "product_categories" WHERE "slug" = 'furniture' ON CONFLICT ("slug") DO NOTHING;
--> statement-breakpoint
INSERT INTO "product_categories" ("name", "slug", "sort_order", "parent_id") SELECT 'Pantry Cupboards', 'pantry-cupboards', 3, "id" FROM "product_categories" WHERE "slug" = 'furniture' ON CONFLICT ("slug") DO NOTHING;
--> statement-breakpoint
INSERT INTO "product_categories" ("name", "slug", "sort_order", "parent_id") SELECT 'Racks', 'racks', 4, "id" FROM "product_categories" WHERE "slug" = 'furniture' ON CONFLICT ("slug") DO NOTHING;
--> statement-breakpoint
INSERT INTO "product_categories" ("name", "slug", "sort_order") VALUES ('Doors, Windows and Frames', 'doors-windows-and-frames', 20) ON CONFLICT ("slug") DO NOTHING;
--> statement-breakpoint
INSERT INTO "product_categories" ("name", "slug", "sort_order", "parent_id") SELECT 'Doors', 'doors', 0, "id" FROM "product_categories" WHERE "slug" = 'doors-windows-and-frames' ON CONFLICT ("slug") DO NOTHING;
--> statement-breakpoint
INSERT INTO "product_categories" ("name", "slug", "sort_order", "parent_id") SELECT 'Door Frames', 'door-frames', 1, "id" FROM "product_categories" WHERE "slug" = 'doors-windows-and-frames' ON CONFLICT ("slug") DO NOTHING;
--> statement-breakpoint
INSERT INTO "product_categories" ("name", "slug", "sort_order", "parent_id") SELECT 'Windows', 'windows', 2, "id" FROM "product_categories" WHERE "slug" = 'doors-windows-and-frames' ON CONFLICT ("slug") DO NOTHING;
--> statement-breakpoint
INSERT INTO "product_categories" ("name", "slug", "sort_order", "parent_id") SELECT 'Window Frames', 'window-frames', 3, "id" FROM "product_categories" WHERE "slug" = 'doors-windows-and-frames' ON CONFLICT ("slug") DO NOTHING;
--> statement-breakpoint
INSERT INTO "product_categories" ("name", "slug", "sort_order") VALUES ('Wooden Panels', 'wooden-panels', 30) ON CONFLICT ("slug") DO NOTHING;
--> statement-breakpoint
INSERT INTO "product_categories" ("name", "slug", "sort_order", "parent_id") SELECT 'Flooring Panels', 'flooring-panels', 0, "id" FROM "product_categories" WHERE "slug" = 'wooden-panels' ON CONFLICT ("slug") DO NOTHING;
--> statement-breakpoint
INSERT INTO "product_categories" ("name", "slug", "sort_order", "parent_id") SELECT 'Roofing Panels', 'roofing-panels', 1, "id" FROM "product_categories" WHERE "slug" = 'wooden-panels' ON CONFLICT ("slug") DO NOTHING;
--> statement-breakpoint
INSERT INTO "product_categories" ("name", "slug", "sort_order", "parent_id") SELECT 'Decorative Wall Panels', 'decorative-wall-panels', 2, "id" FROM "product_categories" WHERE "slug" = 'wooden-panels' ON CONFLICT ("slug") DO NOTHING;
--> statement-breakpoint
INSERT INTO "product_categories" ("name", "slug", "sort_order") VALUES ('Kitchen and Dining Accessories', 'kitchen-and-dining-accessories', 40) ON CONFLICT ("slug") DO NOTHING;
--> statement-breakpoint
INSERT INTO "product_categories" ("name", "slug", "sort_order", "parent_id") SELECT 'Cutting Boards', 'cutting-boards', 0, "id" FROM "product_categories" WHERE "slug" = 'kitchen-and-dining-accessories' ON CONFLICT ("slug") DO NOTHING;
--> statement-breakpoint
INSERT INTO "product_categories" ("name", "slug", "sort_order", "parent_id") SELECT 'Rolling Pins', 'rolling-pins', 1, "id" FROM "product_categories" WHERE "slug" = 'kitchen-and-dining-accessories' ON CONFLICT ("slug") DO NOTHING;
--> statement-breakpoint
INSERT INTO "product_categories" ("name", "slug", "sort_order", "parent_id") SELECT 'Trays', 'trays', 2, "id" FROM "product_categories" WHERE "slug" = 'kitchen-and-dining-accessories' ON CONFLICT ("slug") DO NOTHING;
--> statement-breakpoint
INSERT INTO "product_categories" ("name", "slug", "sort_order") VALUES ('Customized Wooden Products', 'customized-wooden-products', 50) ON CONFLICT ("slug") DO NOTHING;
--> statement-breakpoint
INSERT INTO "product_categories" ("name", "slug", "sort_order", "parent_id") SELECT 'Wall Clocks', 'wall-clocks', 0, "id" FROM "product_categories" WHERE "slug" = 'customized-wooden-products' ON CONFLICT ("slug") DO NOTHING;
--> statement-breakpoint
INSERT INTO "product_categories" ("name", "slug", "sort_order", "parent_id") SELECT 'Sign Boards', 'sign-boards', 1, "id" FROM "product_categories" WHERE "slug" = 'customized-wooden-products' ON CONFLICT ("slug") DO NOTHING;
--> statement-breakpoint
INSERT INTO "product_categories" ("name", "slug", "sort_order", "parent_id") SELECT 'Address Boards', 'address-boards', 2, "id" FROM "product_categories" WHERE "slug" = 'customized-wooden-products' ON CONFLICT ("slug") DO NOTHING;
--> statement-breakpoint
INSERT INTO "product_categories" ("name", "slug", "sort_order", "parent_id") SELECT 'Boxes', 'boxes', 3, "id" FROM "product_categories" WHERE "slug" = 'customized-wooden-products' ON CONFLICT ("slug") DO NOTHING;
--> statement-breakpoint
INSERT INTO "product_categories" ("name", "slug", "sort_order", "parent_id") SELECT 'Carvings', 'carvings', 4, "id" FROM "product_categories" WHERE "slug" = 'customized-wooden-products' ON CONFLICT ("slug") DO NOTHING;
--> statement-breakpoint
INSERT INTO "product_categories" ("name", "slug", "sort_order") VALUES ('Custom Manufacturing', 'custom-manufacturing', 60) ON CONFLICT ("slug") DO NOTHING;
--> statement-breakpoint
SELECT enforce_rls();
