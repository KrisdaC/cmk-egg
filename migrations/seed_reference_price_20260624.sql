-- Seed: item primary_size + sample orders for Reference Price page
-- Makro partner_id=4, CJ Express partner_id=7
-- Run: psql postgresql://appuser:CMK%402026%21@165.22.48.49:5432/cmk -f migrations/seed_reference_price_20260624.sql

BEGIN;

-- =============================================
-- 1. Set primary_size / secondary_size on items
-- =============================================
UPDATE items SET primary_size='0', secondary_size=NULL WHERE sku='30001';
UPDATE items SET primary_size='0', secondary_size=NULL WHERE sku='30002';
UPDATE items SET primary_size='0', secondary_size=NULL WHERE sku='30003';
UPDATE items SET primary_size='0', secondary_size=NULL WHERE sku='30004';
UPDATE items SET primary_size='1', secondary_size=NULL WHERE sku='30101';
UPDATE items SET primary_size='1', secondary_size=NULL WHERE sku='30102';
UPDATE items SET primary_size='1', secondary_size=NULL WHERE sku='30103';
UPDATE items SET primary_size='1', secondary_size=NULL WHERE sku='30104';
UPDATE items SET primary_size='2', secondary_size=NULL WHERE sku='30201';
UPDATE items SET primary_size='2', secondary_size=NULL WHERE sku='30202';
UPDATE items SET primary_size='2', secondary_size=NULL WHERE sku='30203';
UPDATE items SET primary_size='2', secondary_size=NULL WHERE sku='30204';
UPDATE items SET primary_size='3', secondary_size=NULL WHERE sku='30301';
UPDATE items SET primary_size='3', secondary_size=NULL WHERE sku='30302';
UPDATE items SET primary_size='3', secondary_size=NULL WHERE sku='30303';
UPDATE items SET primary_size='3', secondary_size=NULL WHERE sku='30304';
UPDATE items SET primary_size='4', secondary_size=NULL WHERE sku='30401';
UPDATE items SET primary_size='4', secondary_size=NULL WHERE sku='30402';
UPDATE items SET primary_size='4', secondary_size=NULL WHERE sku='30403';
UPDATE items SET primary_size='4', secondary_size=NULL WHERE sku='30404';
UPDATE items SET primary_size='5', secondary_size=NULL WHERE sku='30501';
UPDATE items SET primary_size='5', secondary_size=NULL WHERE sku='30502';
UPDATE items SET primary_size='5', secondary_size=NULL WHERE sku='30503';
UPDATE items SET primary_size='5', secondary_size=NULL WHERE sku='30504';
UPDATE items SET primary_size='6', secondary_size=NULL WHERE sku='30604';
UPDATE items SET primary_size='2', secondary_size='3'  WHERE sku='32304';
UPDATE items SET primary_size='3', secondary_size='4'  WHERE sku='33404';
-- BigC
UPDATE items SET primary_size='0', secondary_size=NULL  WHERE sku='B0005';
UPDATE items SET primary_size='1', secondary_size=NULL  WHERE sku='B0006';
UPDATE items SET primary_size='0', secondary_size=NULL  WHERE sku='B0007';
UPDATE items SET primary_size='0', secondary_size=NULL  WHERE sku='B0008';
UPDATE items SET primary_size='2', secondary_size=NULL  WHERE sku='B0009';
UPDATE items SET primary_size='2', secondary_size=NULL  WHERE sku='B0010';
UPDATE items SET primary_size='2', secondary_size='3'   WHERE sku='B0011';
UPDATE items SET primary_size='4', secondary_size=NULL  WHERE sku='B0013';
UPDATE items SET primary_size='0', secondary_size=NULL  WHERE sku='B0014';
UPDATE items SET primary_size='1', secondary_size=NULL  WHERE sku='B0015';
UPDATE items SET primary_size='3', secondary_size=NULL  WHERE sku='B0016';
UPDATE items SET primary_size='3', secondary_size=NULL  WHERE sku='B0017';
UPDATE items SET primary_size='3', secondary_size='4'   WHERE sku='B0003';
UPDATE items SET primary_size='2', secondary_size='3'   WHERE sku='B0004';
-- CJ Express
UPDATE items SET primary_size='4', secondary_size='5'   WHERE sku='C0001';
UPDATE items SET primary_size='3', secondary_size='4'   WHERE sku='C0002';
UPDATE items SET primary_size='1', secondary_size='2'   WHERE sku='C0003';
UPDATE items SET primary_size='2', secondary_size=NULL  WHERE sku='C0004';
-- Makro (ARO)
UPDATE items SET primary_size='3', secondary_size='4'   WHERE sku='M0001';
UPDATE items SET primary_size='3', secondary_size='4'   WHERE sku='M0002';
UPDATE items SET primary_size='0', secondary_size=NULL  WHERE sku='M0003';
UPDATE items SET primary_size='0', secondary_size=NULL  WHERE sku='M0004';
UPDATE items SET primary_size='1', secondary_size=NULL  WHERE sku='M0005';
UPDATE items SET primary_size='1', secondary_size=NULL  WHERE sku='M0006';
UPDATE items SET primary_size='1', secondary_size=NULL  WHERE sku='M0007';
UPDATE items SET primary_size='2', secondary_size=NULL  WHERE sku='M0008';
UPDATE items SET primary_size='2', secondary_size=NULL  WHERE sku='M0009';
UPDATE items SET primary_size='2', secondary_size=NULL  WHERE sku='M0010';
UPDATE items SET primary_size='2', secondary_size=NULL  WHERE sku='M0011';
UPDATE items SET primary_size='2', secondary_size=NULL  WHERE sku='M0012';
UPDATE items SET primary_size='3', secondary_size=NULL  WHERE sku='M0013';
UPDATE items SET primary_size='3', secondary_size=NULL  WHERE sku='M0014';
UPDATE items SET primary_size='3', secondary_size=NULL  WHERE sku='M0015';
UPDATE items SET primary_size='4', secondary_size=NULL  WHERE sku='M0016';
UPDATE items SET primary_size='4', secondary_size=NULL  WHERE sku='M0017';
UPDATE items SET primary_size='4', secondary_size=NULL  WHERE sku='M0018';
UPDATE items SET primary_size='5', secondary_size=NULL  WHERE sku='M0019';
UPDATE items SET primary_size='4', secondary_size=NULL  WHERE sku='M0020';
UPDATE items SET primary_size='3', secondary_size=NULL  WHERE sku='M0021';
UPDATE items SET primary_size='3', secondary_size=NULL  WHERE sku='M0022';
UPDATE items SET primary_size='3', secondary_size='4'   WHERE sku='M0023';

-- =============================================
-- 2. Sample orders + order_items for Makro (partner_id=4, site=5)
--    Prices reflect typical Thai retail egg prices (baht/pack or tray)
-- =============================================

-- Makro Order 1 — 2026-06-16
INSERT INTO orders (order_number, delivery_site_id, partner_id, order_date, delivery_date, status)
VALUES ('MKR-2026-0001', 5, 4, '2026-06-14', '2026-06-16', 'confirmed')
ON CONFLICT DO NOTHING;

WITH o AS (SELECT id FROM orders WHERE order_number='MKR-2026-0001')
INSERT INTO order_items (order_id, item_id, quantity, unit_price, total_price)
SELECT o.id, i.id,
  v.qty,
  v.unit_price,
  v.qty * v.unit_price
FROM o, (VALUES
  -- เบอร์ 0  30ฟอง  ฿115/ถาด  (=3.833฿/ฟอง)
  ('M0004', 200, 115.00::numeric),
  -- เบอร์ 1  10ฟอง  ฿37/แพ็ค  (=3.700฿/ฟอง)
  ('M0005', 500, 37.00::numeric),
  -- เบอร์ 1  15ฟอง  ฿55/แพ็ค  (=3.667฿/ฟอง)
  ('M0006', 400, 55.00::numeric),
  -- เบอร์ 2  10ฟอง  ฿34/แพ็ค  (=3.400฿/ฟอง)
  ('M0008', 600, 34.00::numeric),
  -- เบอร์ 2  30ฟอง  ฿100/ถาด (=3.333฿/ฟอง)
  ('M0010', 300, 100.00::numeric),
  -- เบอร์ 3  30ฟอง  ฿89/ถาด  (=2.967฿/ฟอง)
  ('M0014', 400, 89.00::numeric),
  -- เบอร์ 4  30ฟอง  ฿80/ถาด  (=2.667฿/ฟอง)
  ('M0017', 300, 80.00::numeric)
) AS v(sku, qty, unit_price)
JOIN items i ON i.sku = v.sku
ON CONFLICT DO NOTHING;

-- Makro Order 2 — 2026-06-18
INSERT INTO orders (order_number, delivery_site_id, partner_id, order_date, delivery_date, status)
VALUES ('MKR-2026-0002', 5, 4, '2026-06-16', '2026-06-18', 'confirmed')
ON CONFLICT DO NOTHING;

WITH o AS (SELECT id FROM orders WHERE order_number='MKR-2026-0002')
INSERT INTO order_items (order_id, item_id, quantity, unit_price, total_price)
SELECT o.id, i.id,
  v.qty,
  v.unit_price,
  v.qty * v.unit_price
FROM o, (VALUES
  -- เบอร์ 1  30ฟอง  ฿108/ถาด (=3.600฿/ฟอง)
  ('M0007', 350, 108.00::numeric),
  -- เบอร์ 2  30ฟอง x5  ฿495/ชุด (=495/150=3.300฿/ฟอง)
  ('M0012', 100, 495.00::numeric),
  -- เบอร์ 3  10ฟอง  ฿30/แพ็ค (=3.000฿/ฟอง)
  ('M0013', 400, 30.00::numeric),
  -- เบอร์ 3  30ฟอง x5 ฿445/ชุด (=445/150=2.967฿/ฟอง)
  ('M0015', 100, 445.00::numeric),
  -- เบอร์ 3-4 คละ  30ฟอง x5  ฿425/ชุด (=425/150=2.833฿/ฟอง)
  ('M0002', 150, 425.00::numeric),
  -- เบอร์ 4  30ฟอง x4  ฿300/ชุด (=300/120=2.500฿/ฟอง)
  ('M0018', 100, 300.00::numeric),
  -- เบอร์ 5  30ฟอง x4  ฿265/ชุด (=265/120=2.208฿/ฟอง)
  ('M0019', 80,  265.00::numeric)
) AS v(sku, qty, unit_price)
JOIN items i ON i.sku = v.sku
ON CONFLICT DO NOTHING;

-- Makro Order 3 — 2026-06-20
INSERT INTO orders (order_number, delivery_site_id, partner_id, order_date, delivery_date, status)
VALUES ('MKR-2026-0003', 5, 4, '2026-06-18', '2026-06-20', 'confirmed')
ON CONFLICT DO NOTHING;

WITH o AS (SELECT id FROM orders WHERE order_number='MKR-2026-0003')
INSERT INTO order_items (order_id, item_id, quantity, unit_price, total_price)
SELECT o.id, i.id,
  v.qty,
  v.unit_price,
  v.qty * v.unit_price
FROM o, (VALUES
  ('M0003', 600, 38.00::numeric),  -- เบอร์ 0  10ฟอง  ฿38/แพ็ค
  ('M0004', 250, 115.00::numeric), -- เบอร์ 0  30ฟอง  ฿115/ถาด
  ('M0006', 500, 55.00::numeric),  -- เบอร์ 1  15ฟอง  ฿55/แพ็ค
  ('M0009', 300, 51.00::numeric),  -- เบอร์ 2  15ฟอง  ฿51/แพ็ค
  ('M0011', 200, 99.00::numeric),  -- เบอร์ 2  30ฟอง  ฿99/ถาด
  ('M0021', 350, 89.00::numeric),  -- เบอร์ 3  30ฟอง  ฿89/ถาด
  ('M0022', 200, 36.00::numeric),  -- เบอร์ 3  12ฟอง  ฿36/แพ็ค
  ('M0020', 200, 80.00::numeric)   -- เบอร์ 4  30ฟอง  ฿80/ถาด
) AS v(sku, qty, unit_price)
JOIN items i ON i.sku = v.sku
ON CONFLICT DO NOTHING;

-- =============================================
-- 3. Sample orders + order_items for CJ Express (partner_id=7, site=76)
-- =============================================

-- CJ Express Order 1 — 2026-06-16
INSERT INTO orders (order_number, delivery_site_id, partner_id, order_date, delivery_date, status)
VALUES ('CJ-2026-0001', 76, 7, '2026-06-14', '2026-06-16', 'confirmed')
ON CONFLICT DO NOTHING;

WITH o AS (SELECT id FROM orders WHERE order_number='CJ-2026-0001')
INSERT INTO order_items (order_id, item_id, quantity, unit_price, total_price)
SELECT o.id, i.id,
  v.qty,
  v.unit_price,
  v.qty * v.unit_price
FROM o, (VALUES
  -- L (เบอร์1-2)  30ฟอง  ฿108/ถาด (=3.600฿/ฟอง)
  ('C0003', 300, 108.00::numeric),
  -- เบอร์ 2  30ฟอง  ฿100/ถาด (=3.333฿/ฟอง)
  ('C0004', 400, 100.00::numeric),
  -- M (เบอร์3-4)  30ฟอง  ฿87/ถาด  (=2.900฿/ฟอง)
  ('C0002', 500, 87.00::numeric),
  -- S (เบอร์4-5)  30ฟอง  ฿78/ถาด  (=2.600฿/ฟอง)
  ('C0001', 400, 78.00::numeric)
) AS v(sku, qty, unit_price)
JOIN items i ON i.sku = v.sku
ON CONFLICT DO NOTHING;

-- CJ Express Order 2 — 2026-06-19
INSERT INTO orders (order_number, delivery_site_id, partner_id, order_date, delivery_date, status)
VALUES ('CJ-2026-0002', 76, 7, '2026-06-17', '2026-06-19', 'confirmed')
ON CONFLICT DO NOTHING;

WITH o AS (SELECT id FROM orders WHERE order_number='CJ-2026-0002')
INSERT INTO order_items (order_id, item_id, quantity, unit_price, total_price)
SELECT o.id, i.id,
  v.qty,
  v.unit_price,
  v.qty * v.unit_price
FROM o, (VALUES
  ('C0003', 350, 108.00::numeric),
  ('C0004', 450, 100.00::numeric),
  ('C0002', 600, 87.00::numeric),
  ('C0001', 500, 78.00::numeric)
) AS v(sku, qty, unit_price)
JOIN items i ON i.sku = v.sku
ON CONFLICT DO NOTHING;

-- CJ Express Order 3 — 2026-06-21
INSERT INTO orders (order_number, delivery_site_id, partner_id, order_date, delivery_date, status)
VALUES ('CJ-2026-0003', 76, 7, '2026-06-19', '2026-06-21', 'confirmed')
ON CONFLICT DO NOTHING;

WITH o AS (SELECT id FROM orders WHERE order_number='CJ-2026-0003')
INSERT INTO order_items (order_id, item_id, quantity, unit_price, total_price)
SELECT o.id, i.id,
  v.qty,
  v.unit_price,
  v.qty * v.unit_price
FROM o, (VALUES
  ('C0003', 280, 108.00::numeric),
  ('C0004', 380, 100.00::numeric),
  ('C0002', 480, 87.00::numeric),
  ('C0001', 360, 78.00::numeric)
) AS v(sku, qty, unit_price)
JOIN items i ON i.sku = v.sku
ON CONFLICT DO NOTHING;

COMMIT;
