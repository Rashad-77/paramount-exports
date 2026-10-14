UPDATE "product_categories" SET "sort_order" = 900 + "sort_order" WHERE "name" LIKE '[Sample]%' AND "sort_order" < 900;
