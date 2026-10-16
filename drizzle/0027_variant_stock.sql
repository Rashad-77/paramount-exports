-- How many of an option are in stock. Empty (NULL) means the business does not count this option.
ALTER TABLE "product_variants" ADD COLUMN "stock_quantity" integer;
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_stock_nonneg" CHECK ("stock_quantity" IS NULL OR "stock_quantity" >= 0);
