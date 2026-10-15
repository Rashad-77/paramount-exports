-- Staff workflow: two more order steps (ready, out for delivery) with a planned date, quotations that can be "under review",
-- enquiries that can be "in progress", and showroom / workshop photographs kept apart from the public project gallery.
ALTER TYPE "online_order_status" ADD VALUE IF NOT EXISTS 'ready' AFTER 'in_progress';
--> statement-breakpoint
ALTER TYPE "online_order_status" ADD VALUE IF NOT EXISTS 'out_for_delivery' AFTER 'ready';
--> statement-breakpoint
ALTER TABLE "online_orders" ADD COLUMN "scheduled_for" date;
--> statement-breakpoint
ALTER TABLE "online_orders" ADD COLUMN "ready_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "online_orders" ADD COLUMN "out_for_delivery_at" timestamp with time zone;
--> statement-breakpoint
CREATE INDEX "online_orders_scheduled_idx" ON "online_orders" ("scheduled_for");
--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "in_progress" boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE "messages" DROP CONSTRAINT "messages_quote_status_known";
--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_quote_status_known" CHECK ("quote_status" IS NULL OR "quote_status" IN ('requested', 'under_review', 'quoted', 'accepted', 'declined', 'cancelled'));
--> statement-breakpoint
ALTER TABLE "gallery_projects" ADD COLUMN "area" text NOT NULL DEFAULT 'projects';
--> statement-breakpoint
ALTER TABLE "gallery_projects" ADD CONSTRAINT "gallery_projects_area_known" CHECK ("area" IN ('projects', 'showroom', 'workshop', 'workshop_gallery'));
--> statement-breakpoint
SELECT enforce_rls();
