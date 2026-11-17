ALTER TABLE grading_job_results ADD COLUMN IF NOT EXISTS mixed_lines jsonb NOT NULL DEFAULT '[]'::jsonb;
