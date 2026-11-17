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
