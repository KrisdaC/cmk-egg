CREATE TABLE IF NOT EXISTS production_round_states (
  id serial PRIMARY KEY,
  delivery_date date NOT NULL,
  round integer NOT NULL CHECK (round BETWEEN 1 AND 4),
  closed_at timestamptz,
  UNIQUE (delivery_date, round)
);
