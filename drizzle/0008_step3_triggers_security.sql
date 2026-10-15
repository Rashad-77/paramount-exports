-- updated_at maintenance
CREATE TRIGGER quotations_set_updated_at BEFORE UPDATE ON "quotations" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint

-- Sent quotation revisions are immutable. "Do not silently alter accepted quotations": a change after sending
-- must be a NEW revision. Enforced here so no code path (or manual SQL) can edit a revision the customer has seen.
CREATE FUNCTION forbid_frozen_revision_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.frozen_at IS NOT NULL THEN
    RAISE EXCEPTION 'Quotation revision % is frozen (sent) and cannot be changed or deleted; create a new revision', OLD.revision_no
      USING ERRCODE = 'restrict_violation';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER quotation_revisions_frozen BEFORE UPDATE OR DELETE ON "quotation_revisions"
  FOR EACH ROW EXECUTE FUNCTION forbid_frozen_revision_change();
--> statement-breakpoint
CREATE FUNCTION forbid_frozen_item_change() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  rev uuid;
  frozen timestamptz;
BEGIN
  rev := CASE WHEN TG_OP = 'DELETE' THEN OLD.revision_id ELSE NEW.revision_id END;
  SELECT frozen_at INTO frozen FROM quotation_revisions WHERE id = rev;
  IF frozen IS NOT NULL THEN
    RAISE EXCEPTION 'Items of a sent quotation revision cannot be changed; create a new revision'
      USING ERRCODE = 'restrict_violation';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER quotation_items_frozen BEFORE INSERT OR UPDATE OR DELETE ON "quotation_items"
  FOR EACH ROW EXECUTE FUNCTION forbid_frozen_item_change();
--> statement-breakpoint
SELECT enforce_rls();
