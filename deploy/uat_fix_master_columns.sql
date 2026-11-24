-- K1 data fix. Run:  psql -v ON_ERROR_STOP=1 -f deploy/uat_fix_master_columns.sql   (dry run: add -v commit=0)
-- Idempotent. Two column mix-ups left by the first master-data import:
--  1. business_partners: the edit form reads business_type (Individual / Corporation) and
--     customer_type (Traditional / Modern Trade). The import had put Corporation/Individual in
--     customer_type and Modern Trade in customer_tier, so the form showed them empty.
--  2. items: the item form reads primary_grade / secondary_grade / min_primary_grade / is_egg_item,
--     which the import left empty while the size columns held the values.

\if :{?commit}
\else
  \set commit 1
\endif

BEGIN;

\echo '== partners before =='
SELECT business_type, customer_type, customer_tier, count(*) FROM business_partners GROUP BY 1,2,3 ORDER BY 4 DESC;

UPDATE business_partners SET
  business_type = CASE WHEN business_type IS NULL AND customer_type IN ('Corporation','Individual')
                       THEN customer_type ELSE business_type END,
  customer_type = CASE WHEN customer_type IN ('Corporation','Individual')
                       THEN (CASE WHEN customer_tier IN ('Modern Trade','Traditional Trade') THEN customer_tier END)
                       ELSE customer_type END,
  customer_tier = CASE WHEN customer_type IN ('Corporation','Individual')
                        AND customer_tier IN ('Modern Trade','Traditional Trade') THEN NULL
                       ELSE customer_tier END
WHERE customer_type IN ('Corporation','Individual');

\echo '== partners after =='
SELECT business_type, customer_type, customer_tier, count(*) FROM business_partners GROUP BY 1,2,3 ORDER BY 4 DESC;

\echo '== items before: eggs missing grade / flag =='
SELECT count(*) FILTER (WHERE is_egg AND primary_grade IS NULL AND primary_size ~ '^[0-9]+$') AS missing_primary_grade,
       count(*) FILTER (WHERE is_egg AND is_egg_item IS NOT TRUE) AS missing_is_egg_item FROM items;

UPDATE items SET
  is_egg_item       = COALESCE(is_egg_item, is_egg),
  primary_grade     = COALESCE(primary_grade, CASE WHEN primary_size ~ '^[0-9]+$' THEN primary_size::int END),
  secondary_grade   = COALESCE(secondary_grade, CASE WHEN secondary_size ~ '^[0-9]+$' THEN secondary_size::int END),
  min_primary_grade = COALESCE(min_primary_grade, min_primary)
WHERE is_egg;

\echo '== items after =='
SELECT count(*) FILTER (WHERE is_egg AND primary_grade IS NULL AND primary_size ~ '^[0-9]+$') AS missing_primary_grade,
       count(*) FILTER (WHERE is_egg AND is_egg_item IS NOT TRUE) AS missing_is_egg_item FROM items;

\if :commit
  COMMIT;
\else
  \echo 'DRY RUN: rolled back'
  ROLLBACK;
\endif
