-- Items: add behavior flags and storage unit fields matching handover schema
ALTER TABLE items ADD COLUMN IF NOT EXISTS is_producable  boolean DEFAULT false;
ALTER TABLE items ADD COLUMN IF NOT EXISTS is_consumable  boolean DEFAULT false;
ALTER TABLE items ADD COLUMN IF NOT EXISTS storage_unit   varchar;
ALTER TABLE items ADD COLUMN IF NOT EXISTS base_per_storage integer;
