-- Marks a product as part of the premium range, shown on its own in the homepage section and the premium showroom as well as in the normal collection.
ALTER TABLE "products" ADD COLUMN "is_premium" boolean DEFAULT false NOT NULL;
