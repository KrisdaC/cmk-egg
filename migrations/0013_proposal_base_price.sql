-- Simplify price proposals: add base_price (replaces proposed/counter/final flow)
-- + exception prices per site group

ALTER TABLE price_proposal_lines ADD COLUMN IF NOT EXISTS base_price numeric(10,2);

CREATE TABLE IF NOT EXISTS price_proposal_line_exceptions (
  id serial PRIMARY KEY,
  proposal_line_id integer NOT NULL REFERENCES price_proposal_lines(id) ON DELETE CASCADE,
  site_group_id integer NOT NULL REFERENCES delivery_site_groups(id) ON DELETE CASCADE,
  price numeric(10,2) NOT NULL,
  UNIQUE (proposal_line_id, site_group_id)
);

CREATE INDEX IF NOT EXISTS idx_pple_line ON price_proposal_line_exceptions(proposal_line_id);
