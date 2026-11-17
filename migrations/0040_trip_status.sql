-- Trip-level workflow timestamps for the Delivery tab redesign: confirming
-- a trip's order composition, confirming its vehicle/driver assignment, and
-- checking it out (dispatch). Trip status itself is never stored — always
-- derived live from these plus real packing completeness (packing_target_
-- results) and orders.logistics_status, same derive-don't-duplicate pattern
-- as every other "status" in this app.
-- See /Users/krisdachugh/.claude/plans/scalable-hatching-moore.md.
ALTER TABLE trips ADD COLUMN IF NOT EXISTS confirmed_at timestamptz;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS vehicle_confirmed_at timestamptz;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS departed_at timestamptz;
