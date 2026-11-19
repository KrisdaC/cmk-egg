-- UAT migration: 0002 + 0018 → 0040 (consolidated, safe to re-run).
-- Generated from migrations/*.sql. Every statement is IF NOT EXISTS, except 0030
-- (data backfill) which is guarded so it only runs once. One transaction: all or nothing.
-- Run:  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f deploy/uat_migrate.sql

BEGIN;

-- ===== 0002_add_po_intake_fields.sql (never applied on UAT; found by schema diff 2026-11-19) =====
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

-- ===== 0018_preliminary_shipment_plans.sql =====
CREATE TABLE IF NOT EXISTS preliminary_shipment_plans (
  id serial PRIMARY KEY,
  delivery_date date NOT NULL,
  production_round integer CHECK (production_round BETWEEN 1 AND 4),
  label text NOT NULL,
  group_label text,
  order_ids jsonb NOT NULL,
  vehicle_id integer REFERENCES vehicles(id),
  load_in_date date,
  load_in_time text,
  deliver_plan_date date,
  deliver_plan_time text,
  created_at timestamptz DEFAULT now()
);

-- ===== 0019_grading_receiving_lots.sql =====
CREATE TABLE IF NOT EXISTS grading_receiving_lots (
  id serial PRIMARY KEY,
  lot_no text NOT NULL,
  recv_date date NOT NULL,
  farm text,
  material text NOT NULL CHECK (material IN ('raw', 'sized')),
  origin text CHECK (origin IN ('external', 'grading_return')),
  src_job_id integer,
  qty integer,
  avg_weight numeric(6, 3),
  divided boolean NOT NULL DEFAULT false,
  subs jsonb NOT NULL DEFAULT '[]',
  grade_lines jsonb NOT NULL DEFAULT '[]',
  note text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ===== 0020_grading_opening_stock.sql =====
CREATE TABLE IF NOT EXISTS grading_opening_stock (
  id serial PRIMARY KEY,
  grading_date date NOT NULL,
  size text NOT NULL,
  qty integer NOT NULL DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS grading_opening_stock_date_size_idx
  ON grading_opening_stock (grading_date, size);

-- ===== 0021_grading_yield_models.sql =====
CREATE TABLE IF NOT EXISTS grading_yield_models (
  id serial PRIMARY KEY,
  name text NOT NULL,
  predictor_unit text NOT NULL CHECK (predictor_unit IN ('g', 'kg')),
  rows jsonb NOT NULL,
  active boolean NOT NULL DEFAULT false,
  published_at timestamptz DEFAULT now()
);

-- ===== 0022_grading_jobs.sql =====
CREATE TABLE IF NOT EXISTS grading_jobs (
  id serial PRIMARY KEY,
  lot_id integer NOT NULL REFERENCES grading_receiving_lots(id),
  production_date date NOT NULL,
  machine text,
  note text,
  created_at timestamptz DEFAULT now()
);

-- ===== 0023_grading_jobs_qty.sql =====
ALTER TABLE grading_jobs ADD COLUMN IF NOT EXISTS qty integer NOT NULL DEFAULT 0;
ALTER TABLE grading_jobs ADD COLUMN IF NOT EXISTS planned_start text;
ALTER TABLE grading_jobs ADD COLUMN IF NOT EXISTS planned_end text;
ALTER TABLE grading_jobs ADD COLUMN IF NOT EXISTS mixed_egg_lane boolean NOT NULL DEFAULT true;

-- ===== 0024_grading_job_results.sql =====
CREATE TABLE IF NOT EXISTS grading_job_results (
  id serial PRIMARY KEY,
  job_id integer NOT NULL UNIQUE REFERENCES grading_jobs(id),
  actual_qty integer,
  input_note text,
  actual_start text,
  actual_end text,
  output jsonb NOT NULL DEFAULT '{}',
  defects jsonb NOT NULL DEFAULT '{}',
  weighing_loss integer,
  other_variance integer,
  variance_note text,
  status text NOT NULL DEFAULT 'draft',
  confirmed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ===== 0025_grading_print_events.sql =====
CREATE TABLE IF NOT EXISTS grading_print_events (
  id serial PRIMARY KEY,
  production_date date NOT NULL,
  scope text NOT NULL,
  revision integer NOT NULL,
  job_ids jsonb NOT NULL,
  snapshot jsonb NOT NULL,
  printed_by text,
  printed_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS grading_print_events_date_scope_idx
  ON grading_print_events (production_date, scope);

-- ===== 0026_grading_jobs_status.sql =====
ALTER TABLE grading_jobs ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'planned';
ALTER TABLE grading_jobs ADD COLUMN IF NOT EXISTS sent_to_floor_at timestamptz;

-- ===== 0027_grading_job_results_actual_by_sub.sql =====
ALTER TABLE grading_job_results ADD COLUMN IF NOT EXISTS actual_by_sub jsonb;

-- ===== 0028_grading_job_results_fg_lines.sql =====
ALTER TABLE grading_job_results ADD COLUMN IF NOT EXISTS fg_lines jsonb NOT NULL DEFAULT '[]';

-- ===== 0029_grading_receiving_lots_status.sql =====
ALTER TABLE grading_receiving_lots ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'received';
ALTER TABLE grading_receiving_lots ADD COLUMN IF NOT EXISTS rejected_reason text;
ALTER TABLE grading_receiving_lots ADD COLUMN IF NOT EXISTS rejected_at timestamptz;

-- ===== 0030_grading_yield_history.sql =====
DO $$
BEGIN
  -- Already applied if any yield-model row carries a "source" key. Re-running would
  -- overwrite later "actual" rows back to "seed", so skip in that case.
  IF NOT EXISTS (
    SELECT 1 FROM grading_yield_models m, jsonb_array_elements(m.rows) AS r
    WHERE r ? 'source'
  ) THEN
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
  END IF;
END $$;

-- ===== 0031_grading_job_results_mixed_lines.sql =====
ALTER TABLE grading_job_results ADD COLUMN IF NOT EXISTS mixed_lines jsonb NOT NULL DEFAULT '[]'::jsonb;

-- ===== 0032_grading_job_results_ungraded_qty.sql =====
ALTER TABLE grading_job_results ADD COLUMN IF NOT EXISTS ungraded_qty integer;

-- ===== 0033_orders_defer_reason.sql =====
ALTER TABLE orders ADD COLUMN IF NOT EXISTS defer_reason text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS defer_reason_note text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS deferred_from_round integer;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS deferred_at timestamptz;

-- ===== 0034_aq_snapshots.sql =====
-- AQ (whole-day forecast reference) snapshots: the AQ actually used for a
-- planning date, saved as a read-only version (AQ v1, v2, ...). Reference only —
-- never feeds OQ/PQ.
CREATE TABLE IF NOT EXISTS aq_snapshots (
  id serial PRIMARY KEY,
  planning_date date NOT NULL,
  version integer NOT NULL,
  method text NOT NULL,
  window_days integer NOT NULL,
  non_working jsonb NOT NULL DEFAULT '[]'::jsonb,
  holidays jsonb NOT NULL DEFAULT '[]'::jsonb,
  excluded_partner_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_eggs numeric NOT NULL DEFAULT 0,
  production_days integer NOT NULL DEFAULT 0,
  data_days integer NOT NULL DEFAULT 0,
  data jsonb NOT NULL,
  state text NOT NULL DEFAULT 'active', -- active | superseded
  created_by text,
  created_at timestamptz DEFAULT now(),
  UNIQUE (planning_date, version)
);
CREATE INDEX IF NOT EXISTS aq_snapshots_date_idx ON aq_snapshots (planning_date);

-- ===== 0035_grading_opening_stock_versions.sql =====
-- Versioned, day-aged opening-stock counts for Grading (Production > Grading,
-- Section 2 "Planning balance" — the "Opening count" popup). Replaces manual
-- per-size entry as the primary intake path; grading_opening_stock (the
-- simple size -> qty table) stays as the table the rest of the app reads
-- from (Planning Balance's COUNTED column, GradingPlanToday's `opening`
-- state) and gets synced from a version's lines whenever that version is
-- confirmed.
--
-- Each version's `lines` is a JSON array of per-product rows:
--   { itemId, sku, name, outcome, day1Qty, day2Qty, day3Qty, day4PlusQty, unit, unitEggs }
-- day*Qty is null = not counted for that age bucket ("whole-blank row =
-- unknown"), a number = a real count (0 = real zero). unitEggs converts the
-- entered quantity (in `unit`) to eggs.
CREATE TABLE IF NOT EXISTS grading_opening_stock_versions (
  id serial PRIMARY KEY,
  grading_date date NOT NULL,
  version integer NOT NULL,
  state text NOT NULL DEFAULT 'draft', -- draft | confirmed
  as_of_time text,
  lines jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  confirmed_at timestamptz,
  created_by text,
  UNIQUE (grading_date, version)
);
CREATE INDEX IF NOT EXISTS grading_opening_stock_versions_date_idx ON grading_opening_stock_versions (grading_date);

-- ===== 0036_pq_snapshots.sql =====
-- PQ (Planning Quantity) versioning per order round — "Send O-R{n}" now
-- freezes a real, immutable snapshot of that round's order-line quantities
-- instead of just toggling production_round_states.closed_at. Matches the
-- aq_snapshots pattern (same advisory-lock version-increment, same
-- active/superseded lifecycle) — see handover/261002/Header Stages.dc.html's
-- "PQ มีเมื่อเผยแพร่แล้วเท่านั้น" rule: a round's PQ total only exists once
-- published here; before that, the UI reads the live (unpublished) total and
-- labels it "ร่าง · ยังไม่เผยแพร่" instead.
CREATE TABLE IF NOT EXISTS pq_snapshots (
  id serial PRIMARY KEY,
  delivery_date date NOT NULL,
  round integer NOT NULL,
  version integer NOT NULL,
  total_eggs numeric NOT NULL DEFAULT 0,
  order_count integer NOT NULL DEFAULT 0,
  -- Per-order line snapshot at publish time: [{orderId, orderNumber, partnerId,
  -- partnerName, deliverySiteName, lines: [{itemId, sku, qty, eggsPerPack}]}]
  -- — frozen evidence, not re-derived later even if the live orders change.
  data jsonb NOT NULL DEFAULT '[]'::jsonb,
  state text NOT NULL DEFAULT 'active', -- active | superseded
  published_at timestamptz DEFAULT now(),
  published_by text,
  UNIQUE (delivery_date, round, version)
);
CREATE INDEX IF NOT EXISTS pq_snapshots_date_round_idx ON pq_snapshots (delivery_date, round);

-- ===== 0037_packing_targets.sql =====
-- Packing's real data model (Production > Packing). See
-- /Users/krisdachugh/.claude/plans/scalable-hatching-moore.md for the full
-- phased plan. Fresh tables, not the legacy packing_activities /
-- packing_material_usage / finished_goods_stock (unused by any route,
-- reference products/rawMaterials/eggSizes instead of items/orders).

-- Mirrors production_round_states, but with 3 sequential, lockable steps
-- (เป้าแพ็ก → แผนวัตถุดิบ → ใบสั่งงาน) instead of one open/closed flag.
CREATE TABLE IF NOT EXISTS packing_round_states (
  id serial PRIMARY KEY,
  delivery_date date NOT NULL,
  round integer NOT NULL,
  target_confirmed_at timestamptz,
  material_plan_confirmed_at timestamptz,
  work_order_sent_at timestamptz,
  closed_at timestamptz,
  UNIQUE (delivery_date, round)
);

-- One row per (date, round, item) — the packing target. No separate
-- customer column: a private-label item's customer is already items.partner_id.
CREATE TABLE IF NOT EXISTS packing_targets (
  id serial PRIMARY KEY,
  delivery_date date NOT NULL,
  round integer NOT NULL,
  item_id integer NOT NULL REFERENCES items(id),
  qty_eggs numeric NOT NULL, -- validated server-side: divisible by items.eggs_per_pack
  ready_by text, -- "HH:MM", nullable
  source text NOT NULL DEFAULT 'manual', -- 'aq' | 'manual'
  aq_snapshot_id integer REFERENCES aq_snapshots(id),
  adjust_reason text, -- required when qty overrides a pre-filled AQ value
  sent_at timestamptz, -- "ส่งงานแล้ว" — work order issued for this line (step 3)
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS packing_targets_date_round_idx ON packing_targets (delivery_date, round);
CREATE INDEX IF NOT EXISTS packing_targets_date_item_idx ON packing_targets (delivery_date, item_id);

-- ===== 0038_grading_special_tray_lines.sql =====
-- Special-tray usage on a grading job result — a PARTITION of that job's
-- already-recorded fgLines production (for a given WIP SKU), never added on
-- top of it. Tracks real cumulative usage of the actual tray/cover
-- component (e.g. C29999P301), not more egg output. See
-- /Users/krisdachugh/.claude/plans/scalable-hatching-moore.md.
ALTER TABLE grading_job_results
  ADD COLUMN IF NOT EXISTS special_tray_lines jsonb NOT NULL DEFAULT '[]'::jsonb;

-- ===== 0039_packing_target_results.sql =====
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

-- ===== 0040_trip_status.sql =====
-- Trip-level workflow timestamps for the Delivery tab redesign: confirming
-- a trip's order composition, confirming its vehicle/driver assignment, and
-- checking it out (dispatch). Trip status itself is never stored — always
-- derived live from these plus real packing completeness (packing_target_
-- results) and orders.logistics_status, same derive-don't-duplicate pattern
-- as every other "status" in this app.
-- See /Users/krisdachugh/.claude/plans/scalable-hatching-moore.md.
ALTER TABLE trips ADD COLUMN IF NOT EXISTS confirmed_at timestamptz;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS vehicle_confirmed_at timestamptz;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS departed_at timestamptz;

COMMIT;
