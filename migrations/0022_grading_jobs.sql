CREATE TABLE IF NOT EXISTS grading_jobs (
  id serial PRIMARY KEY,
  lot_id integer NOT NULL REFERENCES grading_receiving_lots(id),
  production_date date NOT NULL,
  machine text,
  note text,
  created_at timestamptz DEFAULT now()
);
