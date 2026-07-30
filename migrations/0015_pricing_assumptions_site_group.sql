-- Add site_group_id to pricing_assumptions to allow per-group cost overrides
-- NULL = customer-level default; non-null = override for that delivery site group

ALTER TABLE pricing_assumptions
  ADD COLUMN IF NOT EXISTS site_group_id integer REFERENCES delivery_site_groups(id) ON DELETE CASCADE;
