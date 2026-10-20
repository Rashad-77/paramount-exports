-- An order can be marked Refunded by the owner: the items go back in stock and the order shows a Refunded tag. The money itself is
-- returned outside the system; the date and the reason are kept on the order.
ALTER TYPE "online_order_status" ADD VALUE IF NOT EXISTS 'refunded' AFTER 'delivered';--> statement-breakpoint
ALTER TABLE "online_orders" ADD COLUMN "refunded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "online_orders" ADD COLUMN "refund_reason" text;
