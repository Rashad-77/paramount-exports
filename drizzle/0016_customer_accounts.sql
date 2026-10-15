-- Optional customer accounts. Customers are NOT staff: staff access still comes only from profiles + user_roles.
CREATE TABLE "customer_accounts" (
  "id" uuid PRIMARY KEY NOT NULL,
  "full_name" text NOT NULL,
  "email" text NOT NULL,
  "email_lower" text NOT NULL,
  "phone" text,
  "phone_key" text,
  "address" text,
  "local_password_hash" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "customer_accounts_email_lower_unique" UNIQUE("email_lower"),
  CONSTRAINT "customer_accounts_name_not_blank" CHECK (length(btrim("customer_accounts"."full_name")) > 0)
);
--> statement-breakpoint
CREATE TABLE "customer_carts" (
  "account_id" uuid PRIMARY KEY NOT NULL,
  "items" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "customer_carts" ADD CONSTRAINT "customer_carts_account_id_customer_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."customer_accounts"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "online_orders" ADD COLUMN "account_id" uuid;
--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "account_id" uuid;
--> statement-breakpoint
ALTER TABLE "online_orders" ADD CONSTRAINT "online_orders_account_id_customer_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."customer_accounts"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_account_id_customer_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."customer_accounts"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "customer_accounts_phone_key_idx" ON "customer_accounts" USING btree ("phone_key");
--> statement-breakpoint
CREATE INDEX "online_orders_account_idx" ON "online_orders" USING btree ("account_id","created_at");
--> statement-breakpoint
CREATE INDEX "messages_account_idx" ON "messages" USING btree ("account_id","created_at");
--> statement-breakpoint
SELECT enforce_rls();
