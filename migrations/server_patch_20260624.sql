-- Patch server DB to match local schema (missing columns from migrations 0004-0012)

-- items: missing columns
ALTER TABLE items ADD COLUMN IF NOT EXISTS pack_per_basket     integer;
ALTER TABLE items ADD COLUMN IF NOT EXISTS basket_per_palette  integer;
ALTER TABLE items ADD COLUMN IF NOT EXISTS is_egg              boolean DEFAULT false;
ALTER TABLE items ADD COLUMN IF NOT EXISTS primary_size        varchar;
ALTER TABLE items ADD COLUMN IF NOT EXISTS secondary_size      varchar;
ALTER TABLE items ADD COLUMN IF NOT EXISTS min_primary         integer;
ALTER TABLE items ADD COLUMN IF NOT EXISTS storage_unit        varchar;
ALTER TABLE items ADD COLUMN IF NOT EXISTS base_per_storage    integer;
ALTER TABLE items ADD COLUMN IF NOT EXISTS basket_sku          varchar;
ALTER TABLE items ADD COLUMN IF NOT EXISTS packaging_profile   jsonb;
ALTER TABLE items ADD COLUMN IF NOT EXISTS additional_materials jsonb;

-- orders: missing columns
ALTER TABLE orders ADD COLUMN IF NOT EXISTS production_round   integer;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pickup_date        date;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pickup_time        text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS trip_id            integer REFERENCES trips(id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS stop_order         integer;

-- order_items: missing columns
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS planning_qty  integer;
