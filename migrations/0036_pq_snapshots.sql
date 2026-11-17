-- PQ (Planning Quantity) versioning per order round — "Send O-R{n}" now
-- freezes a real, immutable snapshot of that round's order-line quantities
-- instead of just toggling production_round_states.closed_at. Matches the
-- aq_snapshots pattern (same advisory-lock version-increment, same
-- active/superseded lifecycle) — see handover/261002/Header Stages.dc.html's
-- "PQ มีเมื่อเผยแพร่แล้วเท่านั้น" rule: a round's PQ total only exists once
-- published here; before that, the UI reads the live (unpublished) total and
-- labels it "ร่าง · ยังไม่เผยแพร่" instead.
CREATE TABLE IF NOT EXISTS pq_snapshots (
  id serial PRIMARY KEY,
  delivery_date date NOT NULL,
  round integer NOT NULL,
  version integer NOT NULL,
  total_eggs numeric NOT NULL DEFAULT 0,
  order_count integer NOT NULL DEFAULT 0,
  -- Per-order line snapshot at publish time: [{orderId, orderNumber, partnerId,
  -- partnerName, deliverySiteName, lines: [{itemId, sku, qty, eggsPerPack}]}]
  -- — frozen evidence, not re-derived later even if the live orders change.
  data jsonb NOT NULL DEFAULT '[]'::jsonb,
  state text NOT NULL DEFAULT 'active', -- active | superseded
  published_at timestamptz DEFAULT now(),
  published_by text,
  UNIQUE (delivery_date, round, version)
);
CREATE INDEX IF NOT EXISTS pq_snapshots_date_round_idx ON pq_snapshots (delivery_date, round);
