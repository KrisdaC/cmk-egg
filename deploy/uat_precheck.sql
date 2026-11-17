-- READ-ONLY. Run on the UAT database BEFORE deploying:
--   psql "$DATABASE_URL" -f deploy/uat_precheck.sql
-- Shows which hand-applied migrations are already on UAT, and current row counts.
-- (The repo's migrations 0002+ are plain SQL applied by hand; there is no migrations table.)

\echo '== 1. Migration checkpoints (present = already applied) =='
SELECT m.mig, CASE WHEN m.present THEN 'present' ELSE 'MISSING' END AS state FROM (VALUES
 ('0012 trips table',                 to_regclass('public.trips') IS NOT NULL),
 ('0014 system_settings',             to_regclass('public.system_settings') IS NOT NULL),
 ('0016 vehicles.capacity_eggs',      EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vehicles' AND column_name='capacity_eggs')),
 ('0017 price_proposals.effective_date', EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='price_proposals' AND column_name='effective_date')),
 ('0018 preliminary_shipment_plans',  to_regclass('public.preliminary_shipment_plans') IS NOT NULL),
 ('0019 grading_receiving_lots',      to_regclass('public.grading_receiving_lots') IS NOT NULL),
 ('0021 grading_yield_models',        to_regclass('public.grading_yield_models') IS NOT NULL),
 ('0022 grading_jobs',                to_regclass('public.grading_jobs') IS NOT NULL),
 ('0024 grading_job_results',         to_regclass('public.grading_job_results') IS NOT NULL),
 ('0025 grading_print_events',        to_regclass('public.grading_print_events') IS NOT NULL),
 ('0033 orders.defer_reason',         EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='defer_reason')),
 ('0034 aq_snapshots',                to_regclass('public.aq_snapshots') IS NOT NULL),
 ('0035 grading_opening_stock_versions', to_regclass('public.grading_opening_stock_versions') IS NOT NULL),
 ('0036 pq_snapshots',                to_regclass('public.pq_snapshots') IS NOT NULL),
 ('0037 packing_targets',             to_regclass('public.packing_targets') IS NOT NULL),
 ('0039 packing_target_results',      to_regclass('public.packing_target_results') IS NOT NULL),
 ('0040 trips.departed_at',           EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='trips' AND column_name='departed_at'))
) AS m(mig, present);

\echo '== 2. Row counts (data you must not lose) =='
SELECT 'business_partners' t, count(*) FROM business_partners UNION ALL
SELECT 'delivery_sites', count(*) FROM delivery_sites UNION ALL
SELECT 'items', count(*) FROM items UNION ALL
SELECT 'orders', count(*) FROM orders UNION ALL
SELECT 'trips', count(*) FROM trips UNION ALL
SELECT 'users', count(*) FROM users;

\echo '== 3. Latest order date on UAT (how far the data goes) =='
SELECT max(delivery_date) AS latest_delivery_date, max(created_at) AS latest_created FROM orders;
