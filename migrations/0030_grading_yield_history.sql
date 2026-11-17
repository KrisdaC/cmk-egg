-- Backfill existing rows with source/jobId so the shape matches what the
-- system will append going forward. All rows that exist today came from the
-- one-time historical spreadsheet, so they're all "seed".
UPDATE grading_yield_models
SET rows = (
  SELECT jsonb_agg(row || jsonb_build_object('source', 'seed', 'jobId', NULL))
  FROM jsonb_array_elements(rows) AS row
)
WHERE rows IS NOT NULL AND jsonb_array_length(rows) > 0;

-- The active model is no longer "a model you uploaded" — it's the system's
-- one continuously-growing yield history.
UPDATE grading_yield_models
SET name = 'Grading yield history'
WHERE active = true;
