CREATE TYPE "public"."issue_type" AS ENUM('delay', 'rework', 'issue');--> statement-breakpoint
CREATE TYPE "public"."job_priority" AS ENUM('low', 'normal', 'high', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."job_stage" AS ENUM('awaiting_materials', 'ready_to_start', 'cutting_preparation', 'assembly', 'sanding_finishing', 'quality_check', 'ready_for_delivery', 'on_hold', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."po_status" AS ENUM('draft', 'sent', 'partially_received', 'received', 'cancelled');--> statement-breakpoint
CREATE TABLE "job_materials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"planned_quantity" numeric(14, 3) NOT NULL,
	"estimated_unit_cost" numeric(14, 2),
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "job_materials_job_item" UNIQUE("job_id","item_id"),
	CONSTRAINT "job_materials_values" CHECK ("job_materials"."planned_quantity" > 0 AND ("job_materials"."estimated_unit_cost" IS NULL OR "job_materials"."estimated_unit_cost" >= 0))
);
--> statement-breakpoint
CREATE TABLE "labour_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"description" text NOT NULL,
	"hours" numeric(8, 2),
	"hourly_rate" numeric(14, 2),
	"amount" numeric(14, 2) NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "labour_entries_values" CHECK ("labour_entries"."amount" >= 0 AND ("labour_entries"."hours" IS NULL OR "labour_entries"."hours" >= 0))
);
--> statement-breakpoint
CREATE TABLE "material_consumption" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"quantity" numeric(14, 3) DEFAULT '0' NOT NULL,
	"waste_quantity" numeric(14, 3) DEFAULT '0' NOT NULL,
	"unit_cost" numeric(14, 2),
	"consume_movement_id" uuid,
	"waste_movement_id" uuid,
	"request_key" uuid,
	"note" text,
	"recorded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "material_consumption_consume_movement_id_unique" UNIQUE("consume_movement_id"),
	CONSTRAINT "material_consumption_waste_movement_id_unique" UNIQUE("waste_movement_id"),
	CONSTRAINT "material_consumption_request_key_unique" UNIQUE("request_key"),
	CONSTRAINT "material_consumption_values" CHECK ("material_consumption"."quantity" >= 0 AND "material_consumption"."waste_quantity" >= 0 AND ("material_consumption"."quantity" + "material_consumption"."waste_quantity") > 0)
);
--> statement-breakpoint
CREATE TABLE "production_issues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"type" "issue_type" NOT NULL,
	"note" text NOT NULL,
	"resolved_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "production_job_assignees" (
	"job_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "production_job_assignees_job_id_user_id_pk" PRIMARY KEY("job_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "production_job_files" (
	"job_id" uuid NOT NULL,
	"file_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "production_job_files_job_id_file_id_pk" PRIMARY KEY("job_id","file_id")
);
--> statement-breakpoint
CREATE TABLE "production_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" text NOT NULL,
	"order_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"description" text NOT NULL,
	"specification" jsonb,
	"priority" "job_priority" DEFAULT 'normal' NOT NULL,
	"target_date" date,
	"stage" "job_stage" DEFAULT 'awaiting_materials' NOT NULL,
	"stage_before_hold" "job_stage",
	"completed_at" timestamp with time zone,
	"output_item_id" uuid,
	"output_quantity" numeric(14, 3) DEFAULT '1' NOT NULL,
	"output_location_id" uuid,
	"output_recorded_at" timestamp with time zone,
	"output_sold_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "production_jobs_reference_unique" UNIQUE("reference"),
	CONSTRAINT "production_jobs_order_id_unique" UNIQUE("order_id"),
	CONSTRAINT "production_jobs_output_sold_needs_recorded" CHECK ("production_jobs"."output_sold_at" IS NULL OR "production_jobs"."output_recorded_at" IS NOT NULL),
	CONSTRAINT "production_jobs_output_qty_positive" CHECK ("production_jobs"."output_quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "production_stage_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"from_stage" "job_stage",
	"to_stage" "job_stage" NOT NULL,
	"note" text,
	"changed_by" uuid,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "goods_receipt_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"receipt_id" uuid NOT NULL,
	"purchase_order_item_id" uuid NOT NULL,
	"quantity" numeric(14, 3) NOT NULL,
	"movement_id" uuid NOT NULL,
	CONSTRAINT "goods_receipt_items_movement_id_unique" UNIQUE("movement_id"),
	CONSTRAINT "goods_receipt_items_qty_positive" CHECK ("goods_receipt_items"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "goods_receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" text NOT NULL,
	"purchase_order_id" uuid NOT NULL,
	"note" text,
	"received_by" uuid,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "goods_receipts_reference_unique" UNIQUE("reference")
);
--> statement-breakpoint
CREATE TABLE "purchase_order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"purchase_order_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"item_id" uuid NOT NULL,
	"quantity_ordered" numeric(14, 3) NOT NULL,
	"expected_unit_cost" numeric(14, 2) DEFAULT '0' NOT NULL,
	CONSTRAINT "purchase_order_items_position" UNIQUE("purchase_order_id","position"),
	CONSTRAINT "purchase_order_items_values" CHECK ("purchase_order_items"."quantity_ordered" > 0 AND "purchase_order_items"."expected_unit_cost" >= 0)
);
--> statement-breakpoint
CREATE TABLE "purchase_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" text NOT NULL,
	"supplier_id" uuid NOT NULL,
	"status" "po_status" DEFAULT 'draft' NOT NULL,
	"location_id" uuid NOT NULL,
	"currency" text NOT NULL,
	"expected_on" date,
	"notes" text,
	"supplier_invoice_ref" text,
	"supplier_invoice_amount" numeric(14, 2),
	"sent_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"cancel_reason" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "purchase_orders_reference_unique" UNIQUE("reference"),
	CONSTRAINT "purchase_orders_invoice_nonneg" CHECK ("purchase_orders"."supplier_invoice_amount" IS NULL OR "purchase_orders"."supplier_invoice_amount" >= 0),
	CONSTRAINT "purchase_orders_cancel_reason" CHECK ("purchase_orders"."status" <> 'cancelled' OR "purchase_orders"."cancel_reason" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "supplier_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"purchase_order_id" uuid NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"method" "payment_method" NOT NULL,
	"paid_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reference" text,
	"note" text,
	"recorded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "supplier_payments_positive" CHECK ("supplier_payments"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"contact_name" text,
	"phone" text,
	"email" text,
	"address" text,
	"supplied_materials" text,
	"notes" text,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "job_materials" ADD CONSTRAINT "job_materials_job_id_production_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."production_jobs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_materials" ADD CONSTRAINT "job_materials_item_id_inventory_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."inventory_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "labour_entries" ADD CONSTRAINT "labour_entries_job_id_production_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."production_jobs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "labour_entries" ADD CONSTRAINT "labour_entries_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_consumption" ADD CONSTRAINT "material_consumption_job_id_production_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."production_jobs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_consumption" ADD CONSTRAINT "material_consumption_item_id_inventory_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."inventory_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_consumption" ADD CONSTRAINT "material_consumption_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_consumption" ADD CONSTRAINT "material_consumption_consume_movement_id_inventory_movements_id_fk" FOREIGN KEY ("consume_movement_id") REFERENCES "public"."inventory_movements"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_consumption" ADD CONSTRAINT "material_consumption_waste_movement_id_inventory_movements_id_fk" FOREIGN KEY ("waste_movement_id") REFERENCES "public"."inventory_movements"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_consumption" ADD CONSTRAINT "material_consumption_recorded_by_profiles_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_issues" ADD CONSTRAINT "production_issues_job_id_production_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."production_jobs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_issues" ADD CONSTRAINT "production_issues_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_job_assignees" ADD CONSTRAINT "production_job_assignees_job_id_production_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."production_jobs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_job_assignees" ADD CONSTRAINT "production_job_assignees_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_job_files" ADD CONSTRAINT "production_job_files_job_id_production_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."production_jobs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_job_files" ADD CONSTRAINT "production_job_files_file_id_uploaded_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."uploaded_files"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_jobs" ADD CONSTRAINT "production_jobs_order_id_sales_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."sales_orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_jobs" ADD CONSTRAINT "production_jobs_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_jobs" ADD CONSTRAINT "production_jobs_output_item_id_inventory_items_id_fk" FOREIGN KEY ("output_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_jobs" ADD CONSTRAINT "production_jobs_output_location_id_locations_id_fk" FOREIGN KEY ("output_location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_jobs" ADD CONSTRAINT "production_jobs_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_stage_history" ADD CONSTRAINT "production_stage_history_job_id_production_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."production_jobs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_stage_history" ADD CONSTRAINT "production_stage_history_changed_by_profiles_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goods_receipt_items" ADD CONSTRAINT "goods_receipt_items_receipt_id_goods_receipts_id_fk" FOREIGN KEY ("receipt_id") REFERENCES "public"."goods_receipts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goods_receipt_items" ADD CONSTRAINT "goods_receipt_items_purchase_order_item_id_purchase_order_items_id_fk" FOREIGN KEY ("purchase_order_item_id") REFERENCES "public"."purchase_order_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goods_receipt_items" ADD CONSTRAINT "goods_receipt_items_movement_id_inventory_movements_id_fk" FOREIGN KEY ("movement_id") REFERENCES "public"."inventory_movements"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_purchase_order_id_purchase_orders_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_received_by_profiles_id_fk" FOREIGN KEY ("received_by") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_purchase_order_id_purchase_orders_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_item_id_inventory_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."inventory_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_purchase_order_id_purchase_orders_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_recorded_by_profiles_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "labour_entries_job_idx" ON "labour_entries" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "material_consumption_job_idx" ON "material_consumption" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "production_issues_job_idx" ON "production_issues" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "production_job_assignees_user_idx" ON "production_job_assignees" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "production_jobs_stage_idx" ON "production_jobs" USING btree ("stage");--> statement-breakpoint
CREATE INDEX "production_jobs_target_idx" ON "production_jobs" USING btree ("target_date");--> statement-breakpoint
CREATE INDEX "production_stage_history_job_idx" ON "production_stage_history" USING btree ("job_id","changed_at");--> statement-breakpoint
CREATE INDEX "goods_receipt_items_line_idx" ON "goods_receipt_items" USING btree ("purchase_order_item_id");--> statement-breakpoint
CREATE INDEX "goods_receipts_po_idx" ON "goods_receipts" USING btree ("purchase_order_id");--> statement-breakpoint
CREATE INDEX "purchase_orders_supplier_idx" ON "purchase_orders" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "purchase_orders_status_idx" ON "purchase_orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "supplier_payments_po_idx" ON "supplier_payments" USING btree ("purchase_order_id");--> statement-breakpoint
CREATE INDEX "suppliers_name_idx" ON "suppliers" USING btree ("name");