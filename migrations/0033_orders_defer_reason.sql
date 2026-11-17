ALTER TABLE orders ADD COLUMN IF NOT EXISTS defer_reason text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS defer_reason_note text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS deferred_from_round integer;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS deferred_at timestamptz;
