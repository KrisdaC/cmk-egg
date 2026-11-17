ALTER TABLE grading_receiving_lots ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'received';
ALTER TABLE grading_receiving_lots ADD COLUMN IF NOT EXISTS rejected_reason text;
ALTER TABLE grading_receiving_lots ADD COLUMN IF NOT EXISTS rejected_at timestamptz;
