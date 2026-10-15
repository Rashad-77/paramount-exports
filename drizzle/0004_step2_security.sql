-- updated_at maintenance for the Step 2 tables, then the shared security baseline.
CREATE TRIGGER product_categories_set_updated_at BEFORE UPDATE ON "product_categories" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER products_set_updated_at BEFORE UPDATE ON "products" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER product_variants_set_updated_at BEFORE UPDATE ON "product_variants" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER gallery_projects_set_updated_at BEFORE UPDATE ON "gallery_projects" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER customers_set_updated_at BEFORE UPDATE ON "customers" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER leads_set_updated_at BEFORE UPDATE ON "leads" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
SELECT enforce_rls();
