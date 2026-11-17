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
