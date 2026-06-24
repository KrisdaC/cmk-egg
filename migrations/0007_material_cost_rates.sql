-- Material cost rates: packaging/sticker purchase price list from suppliers
CREATE TABLE IF NOT EXISTS material_cost_rates (
  id SERIAL PRIMARY KEY,
  sku TEXT REFERENCES items(sku) ON DELETE SET NULL,
  effective_date DATE NOT NULL,
  supplier_name TEXT NOT NULL,
  partner TEXT NOT NULL DEFAULT 'ALL',
  item_description TEXT,
  tiered_prices JSONB NOT NULL DEFAULT '{}',
  notes TEXT,
  is_current BOOLEAN NOT NULL DEFAULT TRUE,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  uploaded_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_material_cost_rates_sku ON material_cost_rates(sku);
CREATE INDEX IF NOT EXISTS idx_material_cost_rates_effective_date ON material_cost_rates(effective_date);
CREATE INDEX IF NOT EXISTS idx_material_cost_rates_partner ON material_cost_rates(partner);
