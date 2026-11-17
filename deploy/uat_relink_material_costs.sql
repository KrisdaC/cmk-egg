-- Run AFTER the items re-import: restores material_cost_rates.sku links that were cleared
-- when items were deleted. Only re-links SKUs that exist again in items.
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f deploy/uat_relink_material_costs.sql
BEGIN;
UPDATE material_cost_rates m
SET sku = b.sku
FROM uat_mcr_sku_backup b
WHERE m.id = b.id AND m.sku IS NULL AND EXISTS (SELECT 1 FROM items i WHERE i.sku = b.sku);

\echo '== SKUs in the backup still missing from items (add them to the import, then re-run) =='
SELECT b.sku, count(*) AS rows FROM uat_mcr_sku_backup b
WHERE NOT EXISTS (SELECT 1 FROM items i WHERE i.sku = b.sku) GROUP BY b.sku ORDER BY b.sku;
COMMIT;
