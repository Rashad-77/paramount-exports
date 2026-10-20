-- Orders: discounts, payment records with receipt numbers, invoice numbers, and a delivery-charge check.
-- Payments are rows (each with a receipt number); the order keeps the cached amount so lists and filters stay fast.
ALTER TABLE "online_orders" ADD COLUMN "discount" numeric(14,2) DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "online_orders" ADD COLUMN "discount_reason" text;--> statement-breakpoint
ALTER TABLE "online_orders" ADD COLUMN "paid_amount" numeric(14,2) DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "online_orders" ADD COLUMN "invoice_number" text;--> statement-breakpoint
ALTER TABLE "online_orders" ADD COLUMN "delivery_charge_set" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "online_orders" ADD CONSTRAINT "online_orders_invoice_number_unique" UNIQUE ("invoice_number");--> statement-breakpoint
ALTER TABLE "online_orders" ADD CONSTRAINT "online_orders_discount_valid" CHECK ("discount" >= 0 AND "discount" <= "subtotal");--> statement-breakpoint
UPDATE "online_orders" SET "delivery_charge_set" = true WHERE "fulfilment" = 'pickup' OR "status" <> 'new' OR "delivery_charge" <> 0;--> statement-breakpoint
UPDATE "online_orders" SET "paid_amount" = "total" WHERE "is_paid";--> statement-breakpoint
CREATE SEQUENCE IF NOT EXISTS seq_invoice;--> statement-breakpoint
CREATE SEQUENCE IF NOT EXISTS seq_receipt;--> statement-breakpoint
CREATE TABLE "online_order_payments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "order_id" uuid NOT NULL REFERENCES "online_orders"("id") ON DELETE CASCADE,
  "kind" text DEFAULT 'payment' NOT NULL,
  "amount" numeric(14,2) NOT NULL,
  "method" text NOT NULL,
  "reference" text,
  "note" text,
  "number" text NOT NULL,
  "paid_at" timestamp with time zone DEFAULT now() NOT NULL,
  "recorded_by" uuid REFERENCES "profiles"("id") ON DELETE SET NULL,
  "voided_at" timestamp with time zone,
  "voided_by" uuid REFERENCES "profiles"("id") ON DELETE SET NULL,
  "void_reason" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "online_order_payments_kind" CHECK ("kind" IN ('payment')),
  CONSTRAINT "online_order_payments_method" CHECK ("method" IN ('cash', 'bank_transfer', 'card', 'other')),
  CONSTRAINT "online_order_payments_amount" CHECK ("amount" > 0),
  CONSTRAINT "online_order_payments_number_unique" UNIQUE ("number")
);--> statement-breakpoint
CREATE INDEX "online_order_payments_order_idx" ON "online_order_payments" ("order_id", "created_at");--> statement-breakpoint
INSERT INTO "online_order_payments" ("order_id", "kind", "amount", "method", "number", "paid_at", "note")
  SELECT "id", 'payment', "total", CASE "payment_method" WHEN 'bank_transfer' THEN 'bank_transfer' ELSE 'cash' END,
         'RCP-' || lpad(nextval('seq_receipt')::text, 6, '0'), coalesce("paid_at", "updated_at"), 'Recorded before payments were tracked.'
  FROM "online_orders" WHERE "is_paid" AND "total" > 0;--> statement-breakpoint
CREATE OR REPLACE FUNCTION next_reference(kind text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  body text;
  ref text;
BEGIN
  IF kind = 'order' THEN
    LOOP
      body := (10000000 + (('x' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))::bit(32)::bigint % 90000000))::text;
      ref := body || luhn_check_digit(body)::text;
      EXIT WHEN NOT EXISTS (SELECT 1 FROM online_orders WHERE reference = ref);
    END LOOP;
    RETURN ref;
  ELSIF kind = 'message' THEN RETURN 'MSG-' || lpad(nextval('seq_message')::text, 6, '0');
  ELSIF kind = 'invoice' THEN RETURN 'INV-' || lpad(nextval('seq_invoice')::text, 6, '0');
  ELSIF kind = 'receipt' THEN RETURN 'RCP-' || lpad(nextval('seq_receipt')::text, 6, '0');
  END IF;
  RAISE EXCEPTION 'Unknown reference kind: %', kind USING ERRCODE = 'invalid_parameter_value';
END;
$$;
