-- Add avg_cost to nearby_listings
ALTER TABLE nearby_listings
ADD COLUMN IF NOT EXISTS avg_cost INTEGER;

-- Optional: add index for queries
CREATE INDEX IF NOT EXISTS idx_nearby_listings_avg_cost ON nearby_listings(avg_cost);
