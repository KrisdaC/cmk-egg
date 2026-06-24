-- PO Intake: additional fields on orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS po_number        text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS source           text DEFAULT 'manual';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS adjustment_reason      text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS adjustment_approved    boolean DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS adjustment_approved_by text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS adjustment_approved_at timestamp;

-- PO Intake: additional fields on order_items
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS accepted_qty       integer;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS po_price           decimal(10,2);
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS price_status       text;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS customer_item_code text;
