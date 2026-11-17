ALTER TABLE grading_jobs ADD COLUMN IF NOT EXISTS qty integer NOT NULL DEFAULT 0;
ALTER TABLE grading_jobs ADD COLUMN IF NOT EXISTS planned_start text;
ALTER TABLE grading_jobs ADD COLUMN IF NOT EXISTS planned_end text;
ALTER TABLE grading_jobs ADD COLUMN IF NOT EXISTS mixed_egg_lane boolean NOT NULL DEFAULT true;
