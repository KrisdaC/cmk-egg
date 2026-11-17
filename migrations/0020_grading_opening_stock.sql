CREATE TABLE IF NOT EXISTS grading_opening_stock (
  id serial PRIMARY KEY,
  grading_date date NOT NULL,
  size text NOT NULL,
  qty integer NOT NULL DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS grading_opening_stock_date_size_idx
  ON grading_opening_stock (grading_date, size);
