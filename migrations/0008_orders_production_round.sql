-- Orders: add production_round for daily plan round assignment (R1-R4)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS production_round integer;
