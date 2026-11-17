-- Special-tray usage on a grading job result — a PARTITION of that job's
-- already-recorded fgLines production (for a given WIP SKU), never added on
-- top of it. Tracks real cumulative usage of the actual tray/cover
-- component (e.g. C29999P301), not more egg output. See
-- /Users/krisdachugh/.claude/plans/scalable-hatching-moore.md.
ALTER TABLE grading_job_results
  ADD COLUMN IF NOT EXISTS special_tray_lines jsonb NOT NULL DEFAULT '[]'::jsonb;
