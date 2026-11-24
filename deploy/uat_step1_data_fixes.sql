-- Step 1 of the P0 fix plan (X3, X2, D1 data part). Idempotent.
--   psql -v ON_ERROR_STOP=1 -v commit=0 -f deploy/uat_step1_data_fixes.sql    # dry run
--   psql -v ON_ERROR_STOP=1 -f deploy/uat_step1_data_fixes.sql                # apply
-- Decisions (24 Nov): retire M0022/M0023; Makro 27 duplicate deactivated; Makro 161 kept on
-- 'Makro ขอนแก่น' only; Thaifood 9795 left as is; placeholder sites for plants 9629 and 9906.

\if :{?commit}
\else
  \set commit 1
\endif
BEGIN;

-- 1. Makro items with no Makro code (none in the sample POs): retire until Makro sends codes
UPDATE items SET is_active = 'inactive' WHERE sku IN ('M0022', 'M0023') AND is_active IS DISTINCT FROM 'inactive';

-- 2. Makro branch code 27: two identical 'Makro ภูเก็ต' sites (same address, no orders) -> keep DS-C001-0050
UPDATE delivery_sites SET is_active = false
WHERE site_code = 'DS-C001-0060' AND partner_branch_code = '27' AND is_active
  AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.delivery_site_id = delivery_sites.id);

-- 3. Makro branch code 161: keep on 'Makro ขอนแก่น'; 'Makro ขอนแก่น 3' (province ชลบุรี, postcode 20000) looks mis-keyed
UPDATE delivery_sites SET partner_branch_code = NULL WHERE site_code = 'DS-C001-0073' AND partner_branch_code = '161';

-- 4. Thaifood plants that order but have no site (9629, 9906): placeholders, names pending
INSERT INTO delivery_sites (partner_id, site_code, display_name, partner_branch_code, delivery_type,
                            country, acceptable_vehicles, is_active)
SELECT bp.id, v.site_code, v.display_name, v.plant, 'direct_to_store', 'Thailand',
       ARRAY['4_wheel','4_wheel_ext'], true
FROM business_partners bp
CROSS JOIN (VALUES ('DS-C004-0105', 'TF plant 9629 (name pending)', '9629'),
                   ('DS-C004-0106', 'TF plant 9906 (name pending)', '9906')) AS v(site_code, display_name, plant)
WHERE bp.nickname = 'Thaifood'
  AND NOT EXISTS (SELECT 1 FROM delivery_sites ds WHERE ds.partner_id = bp.id AND ds.partner_branch_code = v.plant)
  AND NOT EXISTS (SELECT 1 FROM delivery_sites ds WHERE ds.site_code = v.site_code);

-- 5. X3: Thaifood now orders เบอร์1/2/3 (30) under 2000001163/64/65 (confirmed by the files' own descriptions).
--    Bridge until the customer-codes table exists: new code in customer_item_number, old code kept in
--    barcode_label (the lookup matches both).
UPDATE item_business_partners ibp
SET customer_item_number = v.new_code, barcode_label = v.old_code
FROM items i, (VALUES ('T0001', '2000000524', '2000001163'),
                      ('T0002', '2000000525', '2000001164'),
                      ('T0003', '2000000526', '2000001165')) AS v(sku, old_code, new_code)
WHERE ibp.item_id = i.id AND i.sku = v.sku AND ibp.customer_item_number = v.old_code;

-- 6. X2: BigC [Direct] items are sold by the basket (ตะกร้า); packs per basket is already on the item
UPDATE items SET selling_unit = 'ตะกร้า'
WHERE sku LIKE 'B02%' AND name LIKE '%[Direct]%' AND basket_unit = 'ตะกร้า' AND pack_per_basket IS NOT NULL
  AND selling_unit IS DISTINCT FROM 'ตะกร้า';

\echo '== after =='
SELECT 'M0022/M0023 inactive' AS check, count(*) FROM items WHERE sku IN ('M0022','M0023') AND is_active = 'inactive'
UNION ALL SELECT 'Makro 27 active sites', count(*) FROM delivery_sites ds JOIN business_partners bp ON bp.id = ds.partner_id WHERE bp.nickname = 'Makro' AND ds.partner_branch_code = '27' AND ds.is_active
UNION ALL SELECT 'Makro 161 sites', count(*) FROM delivery_sites ds JOIN business_partners bp ON bp.id = ds.partner_id WHERE bp.nickname = 'Makro' AND ds.partner_branch_code = '161'
UNION ALL SELECT 'TF plants 9629/9906 sites', count(*) FROM delivery_sites WHERE partner_branch_code IN ('9629','9906')
UNION ALL SELECT 'T0001-3 new codes', count(*) FROM item_business_partners WHERE customer_item_number IN ('2000001163','2000001164','2000001165')
UNION ALL SELECT 'BigC [Direct] sold by ตะกร้า', count(*) FROM items WHERE sku LIKE 'B02%' AND name LIKE '%[Direct]%' AND selling_unit = 'ตะกร้า';
\echo '== duplicate branch codes still left (active sites, per customer) =='
SELECT bp.nickname, ds.partner_branch_code, count(*) FROM delivery_sites ds JOIN business_partners bp ON bp.id = ds.partner_id
WHERE ds.is_active AND ds.partner_branch_code IS NOT NULL GROUP BY 1, 2 HAVING count(*) > 1;

\if :commit
  COMMIT;
\else
  \echo 'DRY RUN: rolled back'
  ROLLBACK;
\endif
