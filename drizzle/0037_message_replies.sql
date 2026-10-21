-- Replies staff send to a customer from the enquiry or quotation page. Each is kept with who sent it and how it reached the customer.
CREATE TABLE "message_replies" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "message_id" uuid NOT NULL REFERENCES "messages"("id") ON DELETE CASCADE,
  "body" text NOT NULL,
  "sent_by" uuid REFERENCES "profiles"("id") ON DELETE SET NULL,
  "emailed_to" text,
  "on_account" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX "message_replies_message_idx" ON "message_replies" ("message_id", "created_at");--> statement-breakpoint
SELECT enforce_rls();
