-- Reusable security baseline. Call `SELECT enforce_rls();` at the END of every migration that adds tables
-- or functions. It is idempotent.
--
--  * RLS is enabled on every public table (deny-all: there are no policies for the API roles).
--  * anon / authenticated lose all table and sequence privileges.
--  * Functions are executable by NO ONE except their owner: Postgres grants EXECUTE to PUBLIC by default, and
--    `anon` inherits PUBLIC, so without this Supabase's REST API could call them as RPC endpoints.
--  * Default privileges are tightened so objects created later start locked down.
-- The application connects as the database owner, which is unaffected.
CREATE FUNCTION enforce_rls() RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  t record;
  r text;
BEGIN
  FOR t IN
    SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.relname);
  END LOOP;

  EXECUTE 'REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC';
  EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC';

  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM %I', r);
      EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM %I', r);
      EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM %I', r);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM %I', r);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM %I', r);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM %I', r);
    END IF;
  END LOOP;
END;
$$;
--> statement-breakpoint

-- More human-readable reference kinds, needed by later modules. Gaps are possible, duplicates are not.
CREATE SEQUENCE seq_lead START 1;
--> statement-breakpoint
CREATE SEQUENCE seq_delivery START 1;
--> statement-breakpoint
CREATE SEQUENCE seq_case START 1;
--> statement-breakpoint
CREATE SEQUENCE seq_receipt START 1;
--> statement-breakpoint
CREATE SEQUENCE seq_transfer START 1;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION next_reference(kind text) RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  IF kind = 'quotation' THEN RETURN 'QUO-' || lpad(nextval('seq_quotation')::text, 6, '0');
  ELSIF kind = 'order' THEN RETURN 'SO-' || lpad(nextval('seq_order')::text, 6, '0');
  ELSIF kind = 'job' THEN RETURN 'JOB-' || lpad(nextval('seq_job')::text, 6, '0');
  ELSIF kind = 'purchase_order' THEN RETURN 'PO-' || lpad(nextval('seq_purchase_order')::text, 6, '0');
  ELSIF kind = 'lead' THEN RETURN 'ENQ-' || lpad(nextval('seq_lead')::text, 6, '0');
  ELSIF kind = 'delivery' THEN RETURN 'DEL-' || lpad(nextval('seq_delivery')::text, 6, '0');
  ELSIF kind = 'case' THEN RETURN 'CASE-' || lpad(nextval('seq_case')::text, 6, '0');
  ELSIF kind = 'receipt' THEN RETURN 'GRN-' || lpad(nextval('seq_receipt')::text, 6, '0');
  ELSIF kind = 'transfer' THEN RETURN 'TRF-' || lpad(nextval('seq_transfer')::text, 6, '0');
  END IF;
  RAISE EXCEPTION 'Unknown reference kind: %', kind USING ERRCODE = 'invalid_parameter_value';
END;
$$;
--> statement-breakpoint
SELECT enforce_rls();
