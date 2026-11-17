-- DESTRUCTIVE. Wipes ALL items and everything that points at them, on UAT, so items can be re-imported.
-- Run AFTER deploy/uat_migrate.sql and AFTER a backup:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -v confirm=yes -f deploy/uat_clean_items.sql
-- Without -v confirm=yes it does nothing. One transaction: any error → nothing is deleted.
--
-- Deleted: items, order_items (all order lines), packing_target_results + packing_targets,
--          price_proposal_lines (+ line exceptions), active_prices, item_business_partners,
--          product_business_partners, partner_product_pack_specs, product_recipes,
--          price_adjustments, finished_goods_stock, packing_activities.
-- KEPT:    orders (headers; they will have NO lines until re-entered), trips, partners,
--          delivery sites, vehicles, drivers, price_proposals / pricing weeks (headers),
--          material_cost_rates (rows kept; their sku link is saved, see below).
-- material_cost_rates.sku is ON DELETE SET NULL, so the sku of each row is first saved in
-- table uat_mcr_sku_backup; after re-importing items run deploy/uat_relink_material_costs.sql.

\if :{?confirm}
\else
  \echo 'Not confirmed. Re-run with -v confirm=yes to wipe items. Nothing was changed.'
  \quit
\endif
SELECT :'confirm' = 'yes' AS ok \gset
\if :ok
\else
  \echo 'confirm must be exactly yes. Nothing was changed.'
  \quit
\endif

BEGIN;

\echo '== before =='
SELECT 'items' t, count(*) FROM items UNION ALL
SELECT 'order_items', count(*) FROM order_items UNION ALL
SELECT 'orders', count(*) FROM orders;

-- 1. keep the material-cost → sku mapping (table survives this script; used to re-link later)
DROP TABLE IF EXISTS uat_mcr_sku_backup;
CREATE TABLE uat_mcr_sku_backup AS
  SELECT id, sku FROM material_cost_rates WHERE sku IS NOT NULL;

-- 2. delete dependents first (children before parents); skip tables UAT doesn't have
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'packing_target_results', 'packing_targets',
    'price_proposal_line_exceptions', 'price_proposal_lines', 'active_prices',
    'order_items',
    'item_business_partners', 'product_business_partners', 'partner_product_pack_specs',
    'product_recipes', 'price_adjustments', 'finished_goods_stock', 'packing_activities'
  ] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('DELETE FROM %I', t);
    END IF;
  END LOOP;
END $$;

-- 3. items themselves
DELETE FROM items;
-- optional: restart ids from 1 for the re-import
SELECT setval(pg_get_serial_sequence('items', 'id'), 1, false);

\echo '== after =='
SELECT 'items' t, count(*) FROM items UNION ALL
SELECT 'order_items', count(*) FROM order_items UNION ALL
SELECT 'orders (now without lines)', count(*) FROM orders UNION ALL
SELECT 'material_cost_rates saved for re-link', count(*) FROM uat_mcr_sku_backup;

COMMIT;
