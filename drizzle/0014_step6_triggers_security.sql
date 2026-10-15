-- Append-only history.
CREATE TRIGGER delivery_events_append_only BEFORE UPDATE OR DELETE ON "delivery_events" FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
--> statement-breakpoint
CREATE TRIGGER after_sales_notes_append_only BEFORE UPDATE OR DELETE ON "after_sales_notes" FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
--> statement-breakpoint

-- Expenses are never edited or deleted. The ONLY allowed change is voiding one (once), with a reason.
CREATE FUNCTION guard_expense() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Expenses cannot be deleted; void the entry instead' USING ERRCODE = 'restrict_violation';
  END IF;
  IF OLD.voided_at IS NOT NULL THEN
    RAISE EXCEPTION 'A voided expense cannot be changed' USING ERRCODE = 'restrict_violation';
  END IF;
  IF NEW.voided_at IS NULL
     OR (to_jsonb(NEW) - 'voided_at' - 'voided_by' - 'void_reason') IS DISTINCT FROM (to_jsonb(OLD) - 'voided_at' - 'voided_by' - 'void_reason') THEN
    RAISE EXCEPTION 'An expense can only be voided, not edited' USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER expenses_guard BEFORE UPDATE OR DELETE ON "expenses" FOR EACH ROW EXECUTE FUNCTION guard_expense();
--> statement-breakpoint

-- A delivered delivery is final; a failed one is rescheduled as a new row.
CREATE FUNCTION guard_delivery() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status IN ('delivered', 'failed') AND NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'A % delivery cannot change status', OLD.status USING ERRCODE = 'restrict_violation';
  END IF;
  IF OLD.order_id IS DISTINCT FROM NEW.order_id THEN
    RAISE EXCEPTION 'A delivery cannot be moved to a different order' USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER deliveries_guard BEFORE UPDATE ON "deliveries" FOR EACH ROW EXECUTE FUNCTION guard_delivery();
--> statement-breakpoint
CREATE TRIGGER deliveries_set_updated_at BEFORE UPDATE ON "deliveries" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER after_sales_cases_set_updated_at BEFORE UPDATE ON "after_sales_cases" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint

-- Starter expense categories: configuration, not business data. Editable from the app.
INSERT INTO expense_categories (name) VALUES
  ('Materials and supplies'), ('Transport and fuel'), ('Utilities'), ('Rent'), ('Repairs and maintenance'),
  ('Tools and equipment'), ('Marketing'), ('Office and admin'), ('Other')
ON CONFLICT (name) DO NOTHING;
--> statement-breakpoint
SELECT enforce_rls();
