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
