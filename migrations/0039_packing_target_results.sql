-- Packing Section 3 "บันทึกผลแพ็กจริง" — real actual-vs-plan. A packing
-- target (packing_targets) is the plan; this is its real result, 1:1, same
-- draft/confirmed lifecycle grading_job_results already uses. No denormalized
-- variance column — always computed live (actual - target).
-- See /Users/krisdachugh/.claude/plans/scalable-hatching-moore.md.
CREATE TABLE IF NOT EXISTS packing_target_results (
  id serial PRIMARY KEY,
  target_id integer NOT NULL UNIQUE REFERENCES packing_targets(id),
  actual_qty_eggs numeric NOT NULL,
  station text,
  note text,
  status text NOT NULL DEFAULT 'draft',
  confirmed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
