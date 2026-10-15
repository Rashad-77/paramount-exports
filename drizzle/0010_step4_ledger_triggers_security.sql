-- 1. Every movement must have a sensible shape for its type, so the ledger cannot describe something impossible.
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_shape" CHECK (
  CASE
    WHEN type = 'reserve' THEN on_hand_delta = 0 AND reserved_delta > 0
    WHEN type = 'release' THEN on_hand_delta = 0 AND reserved_delta < 0
    WHEN type = 'sale' THEN on_hand_delta < 0 AND (reserved_delta = 0 OR reserved_delta = on_hand_delta)
    WHEN type IN ('receipt', 'opening', 'production_output', 'transfer_in') THEN on_hand_delta > 0 AND reserved_delta = 0
    WHEN type IN ('transfer_out', 'production_consume', 'waste') THEN on_hand_delta < 0 AND reserved_delta = 0
    WHEN type = 'adjustment' THEN on_hand_delta <> 0 AND reserved_delta = 0
    ELSE false
  END
);
--> statement-breakpoint

-- 2. Balances are derived from the ledger by a trigger, in the same statement/transaction as the movement.
--    Concurrent movements for the same item+location serialise on the balance row; the CHECK constraints on
--    inventory_balances then reject anything that would go negative or over-reserve.
CREATE FUNCTION apply_inventory_movement() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- Make sure the row exists (at zero) first. A single "INSERT … ON CONFLICT DO UPDATE" is NOT safe here: Postgres
  -- checks CHECK constraints on the proposed INSERT row before it resolves the conflict, so a negative delta would be
  -- rejected even when the existing balance can absorb it.
  INSERT INTO inventory_balances (item_id, location_id) VALUES (NEW.item_id, NEW.location_id) ON CONFLICT DO NOTHING;
  UPDATE inventory_balances
     SET on_hand = on_hand + NEW.on_hand_delta,
         reserved = reserved + NEW.reserved_delta,
         updated_at = now()
   WHERE item_id = NEW.item_id AND location_id = NEW.location_id;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER inventory_movements_apply AFTER INSERT ON "inventory_movements"
  FOR EACH ROW EXECUTE FUNCTION apply_inventory_movement();
--> statement-breakpoint

-- 3. Append-only ledgers (forbid_mutation was created in 0001).
CREATE TRIGGER inventory_movements_append_only BEFORE UPDATE OR DELETE ON "inventory_movements"
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
--> statement-breakpoint
CREATE TRIGGER inventory_movements_no_truncate BEFORE TRUNCATE ON "inventory_movements"
  FOR EACH STATEMENT EXECUTE FUNCTION forbid_mutation();
--> statement-breakpoint
CREATE TRIGGER payments_append_only BEFORE UPDATE OR DELETE ON "payments"
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
--> statement-breakpoint
CREATE TRIGGER payments_no_truncate BEFORE TRUNCATE ON "payments"
  FOR EACH STATEMENT EXECUTE FUNCTION forbid_mutation();
--> statement-breakpoint

-- 4. Confirmed orders keep their lines and money; delivered/cancelled are final.
CREATE FUNCTION forbid_nondraft_order_item_change() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  st order_status;
BEGIN
  SELECT status INTO st FROM sales_orders WHERE id = (CASE WHEN TG_OP = 'DELETE' THEN OLD.order_id ELSE NEW.order_id END);
  IF st IS DISTINCT FROM 'draft' THEN
    RAISE EXCEPTION 'Lines of a confirmed order cannot be changed' USING ERRCODE = 'restrict_violation';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER sales_order_items_draft_only BEFORE INSERT OR UPDATE OR DELETE ON "sales_order_items"
  FOR EACH ROW EXECUTE FUNCTION forbid_nondraft_order_item_change();
--> statement-breakpoint
CREATE FUNCTION forbid_order_invalid_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status IN ('delivered', 'cancelled') AND NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'A % order is final and cannot change status', OLD.status USING ERRCODE = 'restrict_violation';
  END IF;
  IF OLD.status <> 'draft' AND (
       NEW.customer_id IS DISTINCT FROM OLD.customer_id OR NEW.type IS DISTINCT FROM OLD.type
    OR NEW.location_id IS DISTINCT FROM OLD.location_id OR NEW.currency IS DISTINCT FROM OLD.currency
    OR NEW.subtotal IS DISTINCT FROM OLD.subtotal OR NEW.discount_total IS DISTINCT FROM OLD.discount_total
    OR NEW.delivery_charge IS DISTINCT FROM OLD.delivery_charge OR NEW.total IS DISTINCT FROM OLD.total
  ) THEN
    RAISE EXCEPTION 'The customer, location and amounts of a confirmed order cannot be changed' USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER sales_orders_guard BEFORE UPDATE ON "sales_orders"
  FOR EACH ROW EXECUTE FUNCTION forbid_order_invalid_change();
--> statement-breakpoint

-- 5. updated_at maintenance
CREATE TRIGGER inventory_items_set_updated_at BEFORE UPDATE ON "inventory_items" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER sales_orders_set_updated_at BEFORE UPDATE ON "sales_orders" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER stock_reservations_set_updated_at BEFORE UPDATE ON "stock_reservations" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
SELECT enforce_rls();
