-- DESTRUCTIVE. Resets a database to "fresh": empties EVERY table except the lookup/login tables below.
-- Run only after a backup:
--   psql -v ON_ERROR_STOP=1 -v confirm=yes -f deploy/uat_reset.sql
-- Without -v confirm=yes it does nothing. One transaction: any error → nothing is deleted.
--
-- KEPT:  users, sessions            (logins)
--        system_settings            (rounds, trays per m3)
--        egg_sizes, stock_locations (lookup / dropdown values)
--        egg_grade_rules, fg_pack_type (lookup tables, empty today)
-- WIPED: everything else (partners, sites, items, drivers, vehicles, suppliers, orders, trips,
--        prices, proposals, pricing weeks, material costs, grading, packing, snapshots ...).
--        Ids restart at 1.

\if :{?confirm}
\else
  \echo 'Not confirmed. Re-run with -v confirm=yes. Nothing was changed.'
  \quit
\endif
SELECT :'confirm' = 'yes' AS ok \gset
\if :ok
\else
  \echo 'confirm must be exactly yes. Nothing was changed.'
  \quit
\endif

BEGIN;

DO $$
DECLARE
  keep text[] := ARRAY['users','sessions','system_settings','egg_sizes','stock_locations','egg_grade_rules','fg_pack_type'];
  wipe text;
BEGIN
  -- refuse if a kept table points at a wiped one (CASCADE would silently empty it)
  IF EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.contype = 'f'
      AND c.conrelid::regclass::text = ANY (keep)
      AND NOT (c.confrelid::regclass::text = ANY (keep))
  ) THEN
    RAISE EXCEPTION 'a kept table references a wiped table; aborting';
  END IF;

  SELECT string_agg(format('%I', table_name), ', ') INTO wipe
  FROM information_schema.tables
  WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND NOT (table_name = ANY (keep));

  EXECUTE 'TRUNCATE TABLE ' || wipe || ' RESTART IDENTITY CASCADE';
END $$;

\echo '== kept =='
SELECT 'users' t, count(*) FROM users UNION ALL SELECT 'sessions', count(*) FROM sessions
UNION ALL SELECT 'system_settings', count(*) FROM system_settings
UNION ALL SELECT 'egg_sizes', count(*) FROM egg_sizes UNION ALL SELECT 'stock_locations', count(*) FROM stock_locations;
\echo '== wiped (should be 0) =='
SELECT 'business_partners' t, count(*) FROM business_partners UNION ALL SELECT 'delivery_sites', count(*) FROM delivery_sites
UNION ALL SELECT 'items', count(*) FROM items UNION ALL SELECT 'orders', count(*) FROM orders
UNION ALL SELECT 'vehicles', count(*) FROM vehicles UNION ALL SELECT 'drivers', count(*) FROM drivers;

COMMIT;
