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
