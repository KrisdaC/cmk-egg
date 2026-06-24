-- Order items: add planning_qty for daily plan round adjustments
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS planning_qty integer;
