-- Retire the CRM and ERP modules and replace them with online orders and website messages.
-- The "Retire" statements are DESTRUCTIVE: they drop the old CRM/ERP tables and their data. Products, categories, gallery,
-- files, settings, staff profiles and the audit log are kept.

-- Retire: tables (CASCADE removes their triggers, indexes and foreign keys)
DROP TABLE IF EXISTS
  "after_sales_notes", "after_sales_cases",
  "delivery_events", "deliveries",
  "expenses", "expense_categories",
  "payments", "stock_reservations", "sales_order_items", "sales_orders",
  "quotation_items", "quotation_revisions", "quotations",
  "lead_activities", "follow_up_tasks", "leads", "customers",
  "supplier_payments", "goods_receipt_items", "goods_receipts", "purchase_order_items", "purchase_orders", "suppliers",
  "production_job_files", "production_job_assignees", "production_stage_history", "production_issues", "labour_entries",
  "material_consumption", "job_materials", "production_jobs",
  "stock_transfer_items", "stock_transfers", "inventory_movements", "inventory_balances", "inventory_items",
  "locations"
CASCADE;
--> statement-breakpoint
ALTER TABLE "product_variants" DROP COLUMN IF EXISTS "inventory_item_id";
--> statement-breakpoint

-- Retire: functions, sequences and enum types that only the old modules used
DROP FUNCTION IF EXISTS apply_inventory_movement() CASCADE;
--> statement-breakpoint
DROP FUNCTION IF EXISTS forbid_frozen_item_change() CASCADE;
--> statement-breakpoint
DROP FUNCTION IF EXISTS forbid_frozen_revision_change() CASCADE;
--> statement-breakpoint
DROP FUNCTION IF EXISTS forbid_nondraft_order_item_change() CASCADE;
--> statement-breakpoint
DROP FUNCTION IF EXISTS forbid_order_invalid_change() CASCADE;
--> statement-breakpoint
DROP FUNCTION IF EXISTS forbid_nondraft_po_item_change() CASCADE;
--> statement-breakpoint
DROP FUNCTION IF EXISTS guard_production_job() CASCADE;
--> statement-breakpoint
DROP FUNCTION IF EXISTS guard_expense() CASCADE;
--> statement-breakpoint
DROP FUNCTION IF EXISTS guard_delivery() CASCADE;
--> statement-breakpoint
DROP SEQUENCE IF EXISTS seq_quotation, seq_order, seq_job, seq_purchase_order, seq_lead, seq_delivery, seq_case, seq_receipt, seq_transfer;
--> statement-breakpoint
DROP TYPE IF EXISTS
  activity_type, after_sales_status, after_sales_type, delivery_status, inventory_item_kind, issue_type, job_priority, job_stage,
  lead_kind, lead_source, lead_status, location_kind, movement_type, order_status, order_type, payment_method, po_status,
  quotation_item_kind, quotation_status, reservation_status;
--> statement-breakpoint

-- Roles: the app now has two, owner and staff. Rows for the retired roles are removed (those people must be given a role again).
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'staff';
--> statement-breakpoint
DELETE FROM "user_roles" WHERE "role" <> 'owner';
--> statement-breakpoint
DELETE FROM "site_settings" WHERE "key" IN ('crm', 'sales', 'production');
--> statement-breakpoint

-- New: online orders
CREATE TYPE online_order_status AS ENUM ('new', 'confirmed', 'in_progress', 'delivered', 'cancelled');
--> statement-breakpoint
CREATE TYPE online_order_payment AS ENUM ('on_delivery', 'bank_transfer', 'at_showroom');
--> statement-breakpoint
CREATE TYPE online_order_fulfilment AS ENUM ('delivery', 'pickup');
--> statement-breakpoint
CREATE TABLE "online_orders" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "reference" text NOT NULL,
  "status" online_order_status DEFAULT 'new' NOT NULL,
  "customer_name" text NOT NULL,
  "phone" text NOT NULL,
  "phone_key" text NOT NULL,
  "email" text,
  "email_lower" text,
  "fulfilment" online_order_fulfilment DEFAULT 'delivery' NOT NULL,
  "address" text,
  "payment_method" online_order_payment DEFAULT 'on_delivery' NOT NULL,
  "is_paid" boolean DEFAULT false NOT NULL,
  "paid_at" timestamp with time zone,
  "currency" text NOT NULL,
  "subtotal" numeric(14, 2) DEFAULT '0' NOT NULL,
  "delivery_charge" numeric(14, 2) DEFAULT '0' NOT NULL,
  "total" numeric(14, 2) DEFAULT '0' NOT NULL,
  "customer_note" text,
  "staff_note" text,
  "cancel_reason" text,
  "confirmed_at" timestamp with time zone,
  "delivered_at" timestamp with time zone,
  "cancelled_at" timestamp with time zone,
  "handled_by" uuid REFERENCES "profiles" ("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "online_orders_reference_unique" UNIQUE ("reference"),
  CONSTRAINT "online_orders_amounts_nonneg" CHECK ("subtotal" >= 0 AND "delivery_charge" >= 0 AND "total" >= 0),
  CONSTRAINT "online_orders_cancel_has_reason" CHECK ("status" <> 'cancelled' OR "cancel_reason" IS NOT NULL),
  CONSTRAINT "online_orders_delivery_has_address" CHECK ("fulfilment" <> 'delivery' OR "address" IS NOT NULL)
);
--> statement-breakpoint
CREATE INDEX "online_orders_status_idx" ON "online_orders" ("status");
--> statement-breakpoint
CREATE INDEX "online_orders_created_idx" ON "online_orders" ("created_at");
--> statement-breakpoint
CREATE INDEX "online_orders_phone_key_idx" ON "online_orders" ("phone_key");
--> statement-breakpoint
CREATE TABLE "online_order_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "order_id" uuid NOT NULL REFERENCES "online_orders" ("id") ON DELETE CASCADE,
  "position" integer NOT NULL,
  "product_id" uuid REFERENCES "products" ("id") ON DELETE SET NULL,
  "variant_id" uuid REFERENCES "product_variants" ("id") ON DELETE SET NULL,
  "product_name" text NOT NULL,
  "variant_label" text,
  "sku" text,
  "unit_price" numeric(14, 2) NOT NULL,
  "quantity" integer NOT NULL,
  "line_total" numeric(14, 2) NOT NULL,
  CONSTRAINT "online_order_items_values" CHECK ("quantity" > 0 AND "quantity" <= 99 AND "unit_price" >= 0 AND "line_total" >= 0)
);
--> statement-breakpoint
CREATE INDEX "online_order_items_order_idx" ON "online_order_items" ("order_id", "position");
--> statement-breakpoint

-- New: website messages (contact form, product enquiries, custom-furniture requests)
CREATE TABLE "messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "reference" text NOT NULL,
  "kind" text DEFAULT 'general' NOT NULL,
  "is_handled" boolean DEFAULT false NOT NULL,
  "handled_at" timestamp with time zone,
  "handled_by" uuid REFERENCES "profiles" ("id") ON DELETE SET NULL,
  "name" text NOT NULL,
  "phone" text NOT NULL,
  "phone_key" text NOT NULL,
  "email" text,
  "preferred_contact" contact_method,
  "message" text,
  "product_id" uuid REFERENCES "products" ("id") ON DELETE SET NULL,
  "variant_id" uuid REFERENCES "product_variants" ("id") ON DELETE SET NULL,
  "payload" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "messages_reference_unique" UNIQUE ("reference"),
  CONSTRAINT "messages_kind_known" CHECK ("kind" IN ('general', 'product_enquiry', 'custom'))
);
--> statement-breakpoint
CREATE INDEX "messages_handled_idx" ON "messages" ("is_handled", "created_at");
--> statement-breakpoint

-- References (ORD-000001, MSG-000001), updated_at maintenance, and the shared security baseline
CREATE SEQUENCE seq_online_order START 1;
--> statement-breakpoint
CREATE SEQUENCE seq_message START 1;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION next_reference(kind text) RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  IF kind = 'order' THEN RETURN 'ORD-' || lpad(nextval('seq_online_order')::text, 6, '0');
  ELSIF kind = 'message' THEN RETURN 'MSG-' || lpad(nextval('seq_message')::text, 6, '0');
  END IF;
  RAISE EXCEPTION 'Unknown reference kind: %', kind USING ERRCODE = 'invalid_parameter_value';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER online_orders_set_updated_at BEFORE UPDATE ON "online_orders" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
SELECT enforce_rls();
