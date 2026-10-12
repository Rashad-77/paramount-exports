CREATE TYPE "public"."after_sales_status" AS ENUM('open', 'in_progress', 'resolved', 'closed');--> statement-breakpoint
CREATE TYPE "public"."after_sales_type" AS ENUM('warranty', 'repair', 'complaint');--> statement-breakpoint
CREATE TYPE "public"."delivery_status" AS ENUM('planned', 'out_for_delivery', 'delivered', 'failed');--> statement-breakpoint
CREATE TABLE "after_sales_cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" text NOT NULL,
	"customer_id" uuid NOT NULL,
	"order_id" uuid,
	"type" "after_sales_type" NOT NULL,
	"status" "after_sales_status" DEFAULT 'open' NOT NULL,
	"subject" text NOT NULL,
	"description" text,
	"resolution" text,
	"assignee_id" uuid,
	"due_on" date,
	"resolved_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "after_sales_cases_reference_unique" UNIQUE("reference"),
	CONSTRAINT "after_sales_resolved_has_resolution" CHECK ("after_sales_cases"."status" NOT IN ('resolved', 'closed') OR "after_sales_cases"."resolution" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "after_sales_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"from_status" "after_sales_status",
	"to_status" "after_sales_status",
	"body" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" text NOT NULL,
	"order_id" uuid NOT NULL,
	"status" "delivery_status" DEFAULT 'planned' NOT NULL,
	"scheduled_on" date NOT NULL,
	"window_start" time,
	"window_end" time,
	"address_line" text NOT NULL,
	"contact_name" text NOT NULL,
	"contact_phone" text NOT NULL,
	"fee" numeric(14, 2) DEFAULT '0' NOT NULL,
	"assignee_id" uuid,
	"notes" text,
	"proof_note" text,
	"proof_file_id" uuid,
	"delivered_at" timestamp with time zone,
	"failed_reason" text,
	"rescheduled_from_id" uuid,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "deliveries_reference_unique" UNIQUE("reference"),
	CONSTRAINT "deliveries_fee_nonneg" CHECK ("deliveries"."fee" >= 0),
	CONSTRAINT "deliveries_delivered_has_time" CHECK ("deliveries"."status" <> 'delivered' OR "deliveries"."delivered_at" IS NOT NULL),
	CONSTRAINT "deliveries_failed_has_reason" CHECK ("deliveries"."status" <> 'failed' OR "deliveries"."failed_reason" IS NOT NULL),
	CONSTRAINT "deliveries_window_order" CHECK ("deliveries"."window_start" IS NULL OR "deliveries"."window_end" IS NULL OR "deliveries"."window_start" < "deliveries"."window_end")
);
--> statement-breakpoint
CREATE TABLE "delivery_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"delivery_id" uuid NOT NULL,
	"from_status" "delivery_status",
	"to_status" "delivery_status" NOT NULL,
	"note" text,
	"changed_by" uuid,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expense_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "expense_categories_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"spent_on" date NOT NULL,
	"category_id" uuid NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"description" text NOT NULL,
	"payee" text,
	"method" "payment_method" DEFAULT 'cash' NOT NULL,
	"reference" text,
	"supplier_id" uuid,
	"order_id" uuid,
	"job_id" uuid,
	"voided_at" timestamp with time zone,
	"voided_by" uuid,
	"void_reason" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "expenses_amount_positive" CHECK ("expenses"."amount" > 0),
	CONSTRAINT "expenses_void_has_reason" CHECK ("expenses"."voided_at" IS NULL OR ("expenses"."void_reason" IS NOT NULL AND "expenses"."voided_by" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "after_sales_cases" ADD CONSTRAINT "after_sales_cases_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "after_sales_cases" ADD CONSTRAINT "after_sales_cases_order_id_sales_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."sales_orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "after_sales_cases" ADD CONSTRAINT "after_sales_cases_assignee_id_profiles_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "after_sales_cases" ADD CONSTRAINT "after_sales_cases_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "after_sales_notes" ADD CONSTRAINT "after_sales_notes_case_id_after_sales_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."after_sales_cases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "after_sales_notes" ADD CONSTRAINT "after_sales_notes_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_order_id_sales_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."sales_orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_assignee_id_profiles_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_proof_file_id_uploaded_files_id_fk" FOREIGN KEY ("proof_file_id") REFERENCES "public"."uploaded_files"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_rescheduled_from_id_deliveries_id_fk" FOREIGN KEY ("rescheduled_from_id") REFERENCES "public"."deliveries"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_events" ADD CONSTRAINT "delivery_events_delivery_id_deliveries_id_fk" FOREIGN KEY ("delivery_id") REFERENCES "public"."deliveries"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_events" ADD CONSTRAINT "delivery_events_changed_by_profiles_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_category_id_expense_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."expense_categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_order_id_sales_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."sales_orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_job_id_production_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."production_jobs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_voided_by_profiles_id_fk" FOREIGN KEY ("voided_by") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "after_sales_customer_idx" ON "after_sales_cases" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "after_sales_status_idx" ON "after_sales_cases" USING btree ("status");--> statement-breakpoint
CREATE INDEX "after_sales_notes_case_idx" ON "after_sales_notes" USING btree ("case_id","created_at");--> statement-breakpoint
CREATE INDEX "deliveries_order_idx" ON "deliveries" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "deliveries_scheduled_idx" ON "deliveries" USING btree ("scheduled_on");--> statement-breakpoint
CREATE INDEX "deliveries_assignee_idx" ON "deliveries" USING btree ("assignee_id");--> statement-breakpoint
CREATE UNIQUE INDEX "deliveries_one_open_per_order" ON "deliveries" USING btree ("order_id") WHERE "deliveries"."status" IN ('planned', 'out_for_delivery');--> statement-breakpoint
CREATE INDEX "delivery_events_delivery_idx" ON "delivery_events" USING btree ("delivery_id","changed_at");--> statement-breakpoint
CREATE INDEX "expenses_spent_idx" ON "expenses" USING btree ("spent_on");--> statement-breakpoint
CREATE INDEX "expenses_category_idx" ON "expenses" USING btree ("category_id");