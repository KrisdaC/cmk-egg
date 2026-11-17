CREATE TABLE IF NOT EXISTS preliminary_shipment_plans (
  id serial PRIMARY KEY,
  delivery_date date NOT NULL,
  production_round integer CHECK (production_round BETWEEN 1 AND 4),
  label text NOT NULL,
  group_label text,
  order_ids jsonb NOT NULL,
  vehicle_id integer REFERENCES vehicles(id),
  load_in_date date,
  load_in_time text,
  deliver_plan_date date,
  deliver_plan_time text,
  created_at timestamptz DEFAULT now()
);
