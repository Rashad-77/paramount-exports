-- Order numbers for new orders: nine digits, random (not a running count), the last digit a check digit (Luhn) so a mistyped
-- number is recognised before any lookup. Older numbers (ORD-000008) are untouched and keep working.
CREATE OR REPLACE FUNCTION luhn_check_digit(body text) RETURNS int LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  i int;
  d int;
  total int := 0;
  dbl boolean := true;
BEGIN
  FOR i IN REVERSE length(body)..1 LOOP
    d := substr(body, i, 1)::int;
    IF dbl THEN
      d := d * 2;
      IF d > 9 THEN d := d - 9; END IF;
    END IF;
    total := total + d;
    dbl := NOT dbl;
  END LOOP;
  RETURN (10 - total % 10) % 10;
END;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION next_reference(kind text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  body text;
  ref text;
BEGIN
  IF kind = 'order' THEN
    LOOP
      -- eight random digits that never start with 0 (gen_random_uuid is a secure random source), plus the check digit
      body := (10000000 + (('x' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))::bit(32)::bigint % 90000000))::text;
      ref := body || luhn_check_digit(body)::text;
      EXIT WHEN NOT EXISTS (SELECT 1 FROM online_orders WHERE reference = ref);
    END LOOP;
    RETURN ref;
  ELSIF kind = 'message' THEN RETURN 'MSG-' || lpad(nextval('seq_message')::text, 6, '0');
  END IF;
  RAISE EXCEPTION 'Unknown reference kind: %', kind USING ERRCODE = 'invalid_parameter_value';
END;
$$;
