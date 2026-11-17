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
