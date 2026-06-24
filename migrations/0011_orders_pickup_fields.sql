ALTER TABLE orders ADD COLUMN IF NOT EXISTS pickup_date date;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pickup_time text;
