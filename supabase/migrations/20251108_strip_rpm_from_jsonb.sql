-- Strip 'rpm' key from all JSONB columns in public schema (destructive)
-- WARNING: This will remove any nested 'rpm' keys found in JSONB columns. BACKUP before running.

BEGIN;

-- Create a backup schema snapshot for safety
CREATE TABLE IF NOT EXISTS db_jsonb_rpm_backups AS
SELECT table_name, column_name, (SELECT jsonb_agg(t) FROM (SELECT * FROM (
  SELECT * FROM information_schema.columns WHERE data_type='jsonb' AND table_schema='public'
) s LIMIT 0) sub) as placeholder
;

-- Iterate over jsonb columns and remove 'rpm' key where present
DO $$
DECLARE
  rec RECORD;
  q TEXT;
BEGIN
  FOR rec IN SELECT table_name, column_name FROM information_schema.columns WHERE table_schema='public' AND data_type='jsonb'
  LOOP
    RAISE NOTICE 'Processing %.%', rec.table_name, rec.column_name;
    q := format(
      'UPDATE %I SET %I = (%I || jsonb_build_object(''thumbnail'', (%I->''rpm''->>''thumbnail''))) - ''rpm'' WHERE %I ? ''rpm''',
      rec.table_name, rec.column_name, rec.column_name, rec.column_name, rec.column_name
    );
    EXECUTE q;
  END LOOP;
END$$;

COMMIT;

-- Review changes before removing backups.
