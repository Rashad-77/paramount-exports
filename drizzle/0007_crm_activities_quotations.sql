CREATE TYPE "public"."activity_type" AS ENUM('call', 'meeting', 'showroom_visit', 'message', 'note', 'status_change');--> statement-breakpoint
CREATE TYPE "public"."quotation_item_kind" AS ENUM('ready_made', 'custom');--> statement-breakpoint
CREATE TYPE "public"."quotation_status" AS ENUM('draft', 'sent', 'accepted', 'rejected', 'expired', 'converted');--> statement-breakpoint
CREATE TABLE "follow_up_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid,
	"customer_id" uuid,
	"assigned_to" uuid NOT NULL,
	"title" text NOT NULL,
	"notes" text,
	"due_on" date NOT NULL,
	"completed_at" timestamp with time zone,
	"completed_by" uuid,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "follow_up_tasks_has_subject" CHECK ("follow_up_tasks"."lead_id" IS NOT NULL OR "follow_up_tasks"."customer_id" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "lead_activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid,
	"customer_id" uuid,
	"type" "activity_type" NOT NULL,
	"body" text NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lead_activities_has_subject" CHECK ("lead_activities"."lead_id" IS NOT NULL OR "lead_activities"."customer_id" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "quotation_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"revision_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"kind" "quotation_item_kind" NOT NULL,
	"variant_id" uuid,
	"description" text NOT NULL,
	"specification" jsonb,
	"quantity" numeric(14, 3) NOT NULL,
	"unit_price" numeric(14, 2) NOT NULL,
	"discount_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"line_total" numeric(14, 2) NOT NULL,
	CONSTRAINT "quotation_items_values" CHECK ("quotation_items"."quantity" > 0 AND "quotation_items"."unit_price" >= 0 AND "quotation_items"."discount_amount" >= 0 AND "quotation_items"."line_total" >= 0)
);
--> statement-breakpoint
CREATE TABLE "quotation_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quotation_id" uuid NOT NULL,
	"revision_no" integer NOT NULL,
	"valid_until" date NOT NULL,
	"delivery_charge" numeric(14, 2) DEFAULT '0' NOT NULL,
	"subtotal" numeric(14, 2) DEFAULT '0' NOT NULL,
	"discount_total" numeric(14, 2) DEFAULT '0' NOT NULL,
	"total" numeric(14, 2) DEFAULT '0' NOT NULL,
	"terms" text,
	"customer_notes" text,
	"internal_notes" text,
	"frozen_at" timestamp with time zone,
	"frozen_by" uuid,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quotation_revisions_unique" UNIQUE("quotation_id","revision_no"),
	CONSTRAINT "quotation_revisions_amounts_nonneg" CHECK ("quotation_revisions"."delivery_charge" >= 0 AND "quotation_revisions"."subtotal" >= 0 AND "quotation_revisions"."discount_total" >= 0 AND "quotation_revisions"."total" >= 0)
);
--> statement-breakpoint
CREATE TABLE "quotations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" text NOT NULL,
	"customer_id" uuid NOT NULL,
	"lead_id" uuid,
	"status" "quotation_status" DEFAULT 'draft' NOT NULL,
	"current_revision_no" integer DEFAULT 1 NOT NULL,
	"currency" text NOT NULL,
	"sent_at" timestamp with time zone,
	"decided_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quotations_reference_unique" UNIQUE("reference"),
	CONSTRAINT "quotations_currency_format" CHECK ("quotations"."currency" ~ '^[A-Z]{3}$')
);
--> statement-breakpoint
ALTER TABLE "follow_up_tasks" ADD CONSTRAINT "follow_up_tasks_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follow_up_tasks" ADD CONSTRAINT "follow_up_tasks_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follow_up_tasks" ADD CONSTRAINT "follow_up_tasks_assigned_to_profiles_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follow_up_tasks" ADD CONSTRAINT "follow_up_tasks_completed_by_profiles_id_fk" FOREIGN KEY ("completed_by") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follow_up_tasks" ADD CONSTRAINT "follow_up_tasks_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_activities" ADD CONSTRAINT "lead_activities_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_activities" ADD CONSTRAINT "lead_activities_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_activities" ADD CONSTRAINT "lead_activities_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotation_items" ADD CONSTRAINT "quotation_items_revision_id_quotation_revisions_id_fk" FOREIGN KEY ("revision_id") REFERENCES "public"."quotation_revisions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotation_items" ADD CONSTRAINT "quotation_items_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotation_revisions" ADD CONSTRAINT "quotation_revisions_quotation_id_quotations_id_fk" FOREIGN KEY ("quotation_id") REFERENCES "public"."quotations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotation_revisions" ADD CONSTRAINT "quotation_revisions_frozen_by_profiles_id_fk" FOREIGN KEY ("frozen_by") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotation_revisions" ADD CONSTRAINT "quotation_revisions_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "follow_up_tasks_assignee_due_idx" ON "follow_up_tasks" USING btree ("assigned_to","due_on");--> statement-breakpoint
CREATE INDEX "follow_up_tasks_lead_idx" ON "follow_up_tasks" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "follow_up_tasks_customer_idx" ON "follow_up_tasks" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "lead_activities_lead_idx" ON "lead_activities" USING btree ("lead_id","occurred_at");--> statement-breakpoint
CREATE INDEX "lead_activities_customer_idx" ON "lead_activities" USING btree ("customer_id","occurred_at");--> statement-breakpoint
CREATE INDEX "quotation_items_revision_idx" ON "quotation_items" USING btree ("revision_id","position");--> statement-breakpoint
CREATE INDEX "quotations_customer_idx" ON "quotations" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "quotations_status_idx" ON "quotations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "quotations_lead_idx" ON "quotations" USING btree ("lead_id");