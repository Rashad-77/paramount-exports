CREATE TYPE "public"."inventory_item_kind" AS ENUM('finished_good', 'raw_material', 'consumable');--> statement-breakpoint
CREATE TYPE "public"."movement_type" AS ENUM('opening', 'receipt', 'sale', 'reserve', 'release', 'transfer_out', 'transfer_in', 'production_consume', 'production_output', 'waste', 'adjustment');--> statement-breakpoint
CREATE TYPE "public"."reservation_status" AS ENUM('active', 'fulfilled', 'released');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('draft', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."order_type" AS ENUM('ready_made', 'custom');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('cash', 'card', 'bank_transfer', 'cheque', 'other');--> statement-breakpoint
CREATE TABLE "inventory_balances" (
	"item_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"on_hand" numeric(14, 3) DEFAULT '0' NOT NULL,
	"reserved" numeric(14, 3) DEFAULT '0' NOT NULL,
	"low_stock_threshold" numeric(14, 3),
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inventory_balances_item_id_location_id_pk" PRIMARY KEY("item_id","location_id"),
	CONSTRAINT "inventory_balances_on_hand_nonneg" CHECK ("inventory_balances"."on_hand" >= 0),
	CONSTRAINT "inventory_balances_reserved_nonneg" CHECK ("inventory_balances"."reserved" >= 0),
	CONSTRAINT "inventory_balances_reserved_within_on_hand" CHECK ("inventory_balances"."reserved" <= "inventory_balances"."on_hand"),
	CONSTRAINT "inventory_balances_threshold_nonneg" CHECK ("inventory_balances"."low_stock_threshold" IS NULL OR "inventory_balances"."low_stock_threshold" >= 0)
);
--> statement-breakpoint
CREATE TABLE "inventory_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "inventory_item_kind" NOT NULL,
	"sku" text NOT NULL,
	"name" text NOT NULL,
	"unit" text DEFAULT 'pcs' NOT NULL,
	"cost_price" numeric(14, 2),
	"is_active" boolean DEFAULT true NOT NULL,
	"archived_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inventory_items_sku_unique" UNIQUE("sku"),
	CONSTRAINT "inventory_items_cost_nonneg" CHECK ("inventory_items"."cost_price" IS NULL OR "inventory_items"."cost_price" >= 0)
);
--> statement-breakpoint
CREATE TABLE "inventory_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"type" "movement_type" NOT NULL,
	"on_hand_delta" numeric(14, 3) NOT NULL,
	"reserved_delta" numeric(14, 3) DEFAULT '0' NOT NULL,
	"reason" text,
	"ref_type" text,
	"ref_id" uuid,
	"actor_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_transfer_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transfer_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"quantity" numeric(14, 3) NOT NULL,
	CONSTRAINT "stock_transfer_items_qty_positive" CHECK ("stock_transfer_items"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "stock_transfers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" text NOT NULL,
	"from_location_id" uuid NOT NULL,
	"to_location_id" uuid NOT NULL,
	"note" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stock_transfers_reference_unique" UNIQUE("reference"),
	CONSTRAINT "stock_transfers_different_locations" CHECK ("stock_transfers"."from_location_id" <> "stock_transfers"."to_location_id")
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"method" "payment_method" NOT NULL,
	"paid_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reference" text,
	"note" text,
	"voids_payment_id" uuid,
	"recorded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_one_void_per_payment" UNIQUE("voids_payment_id"),
	CONSTRAINT "payments_sign" CHECK (("payments"."voids_payment_id" IS NULL AND "payments"."amount" > 0) OR ("payments"."voids_payment_id" IS NOT NULL AND "payments"."amount" < 0))
);
--> statement-breakpoint
CREATE TABLE "sales_order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"variant_id" uuid,
	"inventory_item_id" uuid,
	"description" text NOT NULL,
	"specification" jsonb,
	"quantity" numeric(14, 3) NOT NULL,
	"unit_price" numeric(14, 2) NOT NULL,
	"discount_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"line_total" numeric(14, 2) NOT NULL,
	CONSTRAINT "sales_order_items_values" CHECK ("sales_order_items"."quantity" > 0 AND "sales_order_items"."unit_price" >= 0 AND "sales_order_items"."discount_amount" >= 0 AND "sales_order_items"."line_total" >= 0)
);
--> statement-breakpoint
CREATE TABLE "sales_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" text NOT NULL,
	"customer_id" uuid NOT NULL,
	"quotation_id" uuid,
	"quotation_revision_id" uuid,
	"type" "order_type" NOT NULL,
	"status" "order_status" DEFAULT 'draft' NOT NULL,
	"location_id" uuid,
	"currency" text NOT NULL,
	"subtotal" numeric(14, 2) DEFAULT '0' NOT NULL,
	"discount_total" numeric(14, 2) DEFAULT '0' NOT NULL,
	"delivery_charge" numeric(14, 2) DEFAULT '0' NOT NULL,
	"total" numeric(14, 2) DEFAULT '0' NOT NULL,
	"deposit_terms" text,
	"requested_completion_date" date,
	"notes" text,
	"confirmed_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"cancel_reason" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sales_orders_reference_unique" UNIQUE("reference"),
	CONSTRAINT "sales_orders_quotation_id_unique" UNIQUE("quotation_id"),
	CONSTRAINT "sales_orders_custom_needs_quotation" CHECK ("sales_orders"."type" <> 'custom' OR "sales_orders"."quotation_id" IS NOT NULL),
	CONSTRAINT "sales_orders_ready_made_needs_location" CHECK ("sales_orders"."type" <> 'ready_made' OR "sales_orders"."location_id" IS NOT NULL),
	CONSTRAINT "sales_orders_cancel_has_reason" CHECK ("sales_orders"."status" <> 'cancelled' OR "sales_orders"."cancel_reason" IS NOT NULL),
	CONSTRAINT "sales_orders_amounts_nonneg" CHECK ("sales_orders"."subtotal" >= 0 AND "sales_orders"."discount_total" >= 0 AND "sales_orders"."delivery_charge" >= 0 AND "sales_orders"."total" >= 0)
);
--> statement-breakpoint
CREATE TABLE "stock_reservations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_item_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"quantity" numeric(14, 3) NOT NULL,
	"status" "reservation_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stock_reservations_qty_positive" CHECK ("stock_reservations"."quantity" > 0)
);
--> statement-breakpoint
ALTER TABLE "product_variants" ADD COLUMN "inventory_item_id" uuid;--> statement-breakpoint
ALTER TABLE "inventory_balances" ADD CONSTRAINT "inventory_balances_item_id_inventory_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."inventory_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_balances" ADD CONSTRAINT "inventory_balances_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_item_id_inventory_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."inventory_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_actor_id_profiles_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transfer_items" ADD CONSTRAINT "stock_transfer_items_transfer_id_stock_transfers_id_fk" FOREIGN KEY ("transfer_id") REFERENCES "public"."stock_transfers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transfer_items" ADD CONSTRAINT "stock_transfer_items_item_id_inventory_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."inventory_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_from_location_id_locations_id_fk" FOREIGN KEY ("from_location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_to_location_id_locations_id_fk" FOREIGN KEY ("to_location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_sales_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."sales_orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_voids_payment_id_payments_id_fk" FOREIGN KEY ("voids_payment_id") REFERENCES "public"."payments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_recorded_by_profiles_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_order_items" ADD CONSTRAINT "sales_order_items_order_id_sales_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."sales_orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_order_items" ADD CONSTRAINT "sales_order_items_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_order_items" ADD CONSTRAINT "sales_order_items_inventory_item_id_inventory_items_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_quotation_id_quotations_id_fk" FOREIGN KEY ("quotation_id") REFERENCES "public"."quotations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_quotation_revision_id_quotation_revisions_id_fk" FOREIGN KEY ("quotation_revision_id") REFERENCES "public"."quotation_revisions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_order_item_id_sales_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."sales_order_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_item_id_inventory_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."inventory_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "inventory_items_kind_idx" ON "inventory_items" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "inventory_movements_item_idx" ON "inventory_movements" USING btree ("item_id","created_at");--> statement-breakpoint
CREATE INDEX "inventory_movements_ref_idx" ON "inventory_movements" USING btree ("ref_type","ref_id");--> statement-breakpoint
CREATE INDEX "inventory_movements_location_idx" ON "inventory_movements" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "stock_transfer_items_transfer_idx" ON "stock_transfer_items" USING btree ("transfer_id");--> statement-breakpoint
CREATE INDEX "payments_order_idx" ON "payments" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "payments_paid_at_idx" ON "payments" USING btree ("paid_at");--> statement-breakpoint
CREATE INDEX "sales_order_items_order_idx" ON "sales_order_items" USING btree ("order_id","position");--> statement-breakpoint
CREATE INDEX "sales_orders_customer_idx" ON "sales_orders" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "sales_orders_status_idx" ON "sales_orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "sales_orders_created_idx" ON "sales_orders" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "stock_reservations_order_item_idx" ON "stock_reservations" USING btree ("order_item_id");--> statement-breakpoint
CREATE INDEX "stock_reservations_status_idx" ON "stock_reservations" USING btree ("status");--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_inventory_item_id_inventory_items_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_inventory_item_id_unique" UNIQUE("inventory_item_id");