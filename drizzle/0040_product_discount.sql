-- A product can carry one discount, given as an amount off or a percentage off. The selling price (the product's price line) already has the
-- discount taken off and its "original price" holds the regular price; these two columns only remember how the owner entered it, so the
-- sale label can say "LKR 5,000 off" or "20% off".
ALTER TABLE products ADD COLUMN discount_kind text;
--> statement-breakpoint
ALTER TABLE products ADD COLUMN discount_value numeric(14, 2);
--> statement-breakpoint
ALTER TABLE products ADD CONSTRAINT products_discount_known CHECK ((discount_kind IS NULL AND discount_value IS NULL) OR (discount_kind IN ('amount', 'percent') AND discount_value > 0));
