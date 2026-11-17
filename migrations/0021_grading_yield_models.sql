CREATE TABLE IF NOT EXISTS grading_yield_models (
  id serial PRIMARY KEY,
  name text NOT NULL,
  predictor_unit text NOT NULL CHECK (predictor_unit IN ('g', 'kg')),
  rows jsonb NOT NULL,
  active boolean NOT NULL DEFAULT false,
  published_at timestamptz DEFAULT now()
);
