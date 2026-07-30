ALTER TABLE price_proposals ADD COLUMN IF NOT EXISTS effective_date date;
ALTER TABLE price_proposals ADD COLUMN IF NOT EXISTS effective_date_to date;
ALTER TABLE price_proposals ADD COLUMN IF NOT EXISTS reviewed_by text;
