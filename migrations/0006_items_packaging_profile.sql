-- Items: add packaging_profile and additional_materials as JSONB columns
ALTER TABLE items ADD COLUMN IF NOT EXISTS packaging_profile jsonb;
ALTER TABLE items ADD COLUMN IF NOT EXISTS additional_materials jsonb;
