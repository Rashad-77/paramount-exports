-- "Available on request" is now part of "Made to order".
UPDATE "products" SET "availability" = 'made_to_order' WHERE "availability" = 'on_request';
