-- Append-only records (forbid_mutation from 0001).
CREATE TRIGGER production_stage_history_append_only BEFORE UPDATE OR DELETE ON "production_stage_history" FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
--> statement-breakpoint
CREATE TRIGGER material_consumption_append_only BEFORE UPDATE OR DELETE ON "material_consumption" FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
--> statement-breakpoint
CREATE TRIGGER goods_receipts_append_only BEFORE UPDATE OR DELETE ON "goods_receipts" FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
--> statement-breakpoint
CREATE TRIGGER goods_receipt_items_append_only BEFORE UPDATE OR DELETE ON "goods_receipt_items" FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
--> statement-breakpoint
CREATE TRIGGER supplier_payments_append_only BEFORE UPDATE OR DELETE ON "supplier_payments" FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
--> statement-breakpoint

-- A job's finished-goods flags are one-way: once stock has been added (or taken out again on delivery) the flag
-- can never be cleared or rewritten, so finished stock cannot be counted twice. A cancelled job stays cancelled.
CREATE FUNCTION guard_production_job() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.output_recorded_at IS NOT NULL AND NEW.output_recorded_at IS DISTINCT FROM OLD.output_recorded_at THEN
    RAISE EXCEPTION 'Finished-goods stock was already recorded for this job' USING ERRCODE = 'restrict_violation';
  END IF;
  IF OLD.output_sold_at IS NOT NULL AND NEW.output_sold_at IS DISTINCT FROM OLD.output_sold_at THEN
    RAISE EXCEPTION 'The finished piece was already taken out of stock' USING ERRCODE = 'restrict_violation';
  END IF;
  IF OLD.stage = 'cancelled' AND NEW.stage IS DISTINCT FROM OLD.stage THEN
    RAISE EXCEPTION 'A cancelled job cannot be restarted' USING ERRCODE = 'restrict_violation';
  END IF;
  IF OLD.order_id IS DISTINCT FROM NEW.order_id THEN
    RAISE EXCEPTION 'A job cannot be moved to a different order' USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER production_jobs_guard BEFORE UPDATE ON "production_jobs" FOR EACH ROW EXECUTE FUNCTION guard_production_job();
--> statement-breakpoint

-- Purchase order lines can only change while the order is a draft.
CREATE FUNCTION forbid_nondraft_po_item_change() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  st po_status;
BEGIN
  SELECT status INTO st FROM purchase_orders WHERE id = (CASE WHEN TG_OP = 'DELETE' THEN OLD.purchase_order_id ELSE NEW.purchase_order_id END);
  IF st IS DISTINCT FROM 'draft' THEN
    RAISE EXCEPTION 'Lines of a purchase order that has been sent cannot be changed' USING ERRCODE = 'restrict_violation';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER purchase_order_items_draft_only BEFORE INSERT OR UPDATE OR DELETE ON "purchase_order_items" FOR EACH ROW EXECUTE FUNCTION forbid_nondraft_po_item_change();
--> statement-breakpoint
CREATE TRIGGER production_jobs_set_updated_at BEFORE UPDATE ON "production_jobs" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER suppliers_set_updated_at BEFORE UPDATE ON "suppliers" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER purchase_orders_set_updated_at BEFORE UPDATE ON "purchase_orders" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
SELECT enforce_rls();
