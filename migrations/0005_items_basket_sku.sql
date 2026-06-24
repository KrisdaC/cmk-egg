-- Items: add basket_sku to link to a PACKAGING/basket item SKU
ALTER TABLE items ADD COLUMN IF NOT EXISTS basket_sku varchar;
