-- System-wide key-value settings table

CREATE TABLE IF NOT EXISTS system_settings (
  id         serial PRIMARY KEY,
  key        varchar(100) NOT NULL UNIQUE,
  value      text,
  label      varchar(255),
  description text,
  value_type varchar(20) DEFAULT 'string',
  updated_at timestamp DEFAULT now(),
  updated_by varchar(100)
);

-- Seed default production settings
INSERT INTO system_settings (key, value, label, description, value_type) VALUES
  ('trays_per_m3',  '500', 'จำนวนถาด / m³',  'จำนวนถาดที่บรรจุในพื้นที่ 1 ลูกบาศก์เมตร', 'integer'),
  ('num_rounds',    '3',   'จำนวนรอบ',        'จำนวนรอบการผลิตต่อวัน',                    'integer')
ON CONFLICT (key) DO NOTHING;
