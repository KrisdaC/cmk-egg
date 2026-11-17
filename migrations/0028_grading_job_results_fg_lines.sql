ALTER TABLE grading_job_results ADD COLUMN IF NOT EXISTS fg_lines jsonb NOT NULL DEFAULT '[]';
