ALTER TABLE "messages" ADD COLUMN "quote_status" text;
--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "quoted_amount" numeric(14, 2);
--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "quote_note" text;
--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "quote_valid_until" date;
--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "quoted_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "responded_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "decline_reason" text;
--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "order_id" uuid;
--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_order_id_online_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."online_orders"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_quote_status_known" CHECK ("quote_status" IS NULL OR "quote_status" IN ('requested', 'quoted', 'accepted', 'declined', 'cancelled'));
--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_quote_amount_nonneg" CHECK ("quoted_amount" IS NULL OR "quoted_amount" >= 0);
--> statement-breakpoint
UPDATE "messages" SET "quote_status" = 'requested' WHERE "kind" = 'custom' AND "quote_status" IS NULL;
--> statement-breakpoint
CREATE TABLE "customer_wishlist" (
	"account_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customer_wishlist_account_id_product_id_pk" PRIMARY KEY("account_id","product_id")
);
--> statement-breakpoint
ALTER TABLE "customer_wishlist" ADD CONSTRAINT "customer_wishlist_account_id_customer_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."customer_accounts"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "customer_wishlist" ADD CONSTRAINT "customer_wishlist_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE TABLE "customer_addresses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"label" text NOT NULL,
	"recipient" text NOT NULL,
	"phone" text,
	"address" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customer_addresses_not_blank" CHECK (length(btrim("address")) > 0 AND length(btrim("label")) > 0)
);
--> statement-breakpoint
ALTER TABLE "customer_addresses" ADD CONSTRAINT "customer_addresses_account_id_customer_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."customer_accounts"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "customer_addresses_account_idx" ON "customer_addresses" USING btree ("account_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "customer_addresses_one_default" ON "customer_addresses" USING btree ("account_id") WHERE "is_default";
--> statement-breakpoint
CREATE TABLE "customer_updates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"link" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "customer_updates" ADD CONSTRAINT "customer_updates_account_id_customer_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."customer_accounts"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "customer_updates_account_idx" ON "customer_updates" USING btree ("account_id","created_at");
--> statement-breakpoint
SELECT enforce_rls();
