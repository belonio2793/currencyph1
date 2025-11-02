-- Enhance pending_listings to mirror key columns of nearby_listings and support approval fees
BEGIN;

ALTER TABLE pending_listings 
  ADD COLUMN IF NOT EXISTS city VARCHAR(255),
  ADD COLUMN IF NOT EXISTS country VARCHAR(255),
  ADD COLUMN IF NOT EXISTS phone_number VARCHAR(50),
  ADD COLUMN IF NOT EXISTS website TEXT,
  ADD COLUMN IF NOT EXISTS web_url TEXT,
  ADD COLUMN IF NOT EXISTS location_type VARCHAR(255),
  ADD COLUMN IF NOT EXISTS price_range VARCHAR(50),
  ADD COLUMN IF NOT EXISTS hours_of_operation JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS photo_count INTEGER,
  ADD COLUMN IF NOT EXISTS image_urls TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS primary_image_url TEXT,
  ADD COLUMN IF NOT EXISTS awards JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS rank_in_category VARCHAR(50);

-- Approval fee requirements
ALTER TABLE pending_listings 
  ADD COLUMN IF NOT EXISTS approval_fee_amount NUMERIC DEFAULT 1000,
  ADD COLUMN IF NOT EXISTS approval_fee_currency VARCHAR(10) DEFAULT 'PHP',
  ADD COLUMN IF NOT EXISTS approval_fee_status VARCHAR(20) DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS approval_fee_tx_id UUID;

COMMIT;
