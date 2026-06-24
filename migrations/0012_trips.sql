CREATE TABLE IF NOT EXISTS trips (
  id serial PRIMARY KEY,
  delivery_date date NOT NULL,
  production_round integer CHECK (production_round BETWEEN 1 AND 4),
  trip_number integer NOT NULL DEFAULT 1,
  name text,
  vehicle_id integer REFERENCES vehicles(id),
  driver_id integer REFERENCES drivers(id),
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE orders ADD COLUMN IF NOT EXISTS trip_id integer REFERENCES trips(id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS stop_order integer;
