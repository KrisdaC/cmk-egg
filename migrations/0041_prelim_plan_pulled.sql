-- Delivery tab pulls each preliminary shipment plan (of a closed round) into a
-- trip, once. pulled_at marks a plan as already converted, so deleting the
-- resulting trip never makes it come back.
ALTER TABLE preliminary_shipment_plans ADD COLUMN IF NOT EXISTS pulled_at timestamptz;
