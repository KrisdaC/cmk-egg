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
