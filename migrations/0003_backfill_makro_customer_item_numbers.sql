-- Backfill customer_item_number in item_business_partners for Makro items.
-- Makro's item code is the numeric prefix embedded in item names
-- (e.g. "198368 ARO ไข่ไก่ เบอร์ 2 มีฝา 30 ฟอง" → customer_item_number = '198368').
-- This is required for PO upload item matching to work.

UPDATE item_business_partners ibp
SET    customer_item_number = (REGEXP_MATCH(i.name, '^([0-9]+)'))[1]
FROM   items i
WHERE  ibp.item_id   = i.id
  AND  ibp.partner_id = (SELECT id FROM business_partners WHERE nickname = 'Makro' LIMIT 1)
  AND  ibp.customer_item_number IS NULL
  AND  i.name ~ '^[0-9]+';
