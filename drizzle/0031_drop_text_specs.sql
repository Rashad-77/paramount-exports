-- Features, uses, care instructions and lead time are no longer specification types. The old single-value columns are left as they are.
UPDATE "products" SET "specifications" = COALESCE((
  SELECT jsonb_agg(e)
  FROM jsonb_array_elements("specifications") AS e
  WHERE e->>'key' NOT IN ('features', 'uses', 'care', 'lead-time')
), '[]'::jsonb);
