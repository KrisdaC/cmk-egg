ALTER TABLE grading_jobs ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'planned';
ALTER TABLE grading_jobs ADD COLUMN IF NOT EXISTS sent_to_floor_at timestamptz;
