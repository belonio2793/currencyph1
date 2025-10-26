-- Add image_urls column to nearby_listings table
ALTER TABLE nearby_listings 
ADD COLUMN IF NOT EXISTS image_urls TEXT[] DEFAULT '{}';

-- Add primary_image_url for quick access
ALTER TABLE nearby_listings 
ADD COLUMN IF NOT EXISTS primary_image_url TEXT;

-- Create index for image queries
CREATE INDEX IF NOT EXISTS idx_nearby_listings_has_images ON nearby_listings(image_urls) WHERE image_urls IS NOT NULL AND array_length(image_urls, 1) > 0;

-- Update trigger for updated_at timestamp
DROP TRIGGER IF EXISTS update_nearby_listings_timestamp ON nearby_listings;

CREATE OR REPLACE FUNCTION update_nearby_listings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_nearby_listings_timestamp
  BEFORE UPDATE ON nearby_listings
  FOR EACH ROW
  EXECUTE FUNCTION update_nearby_listings_updated_at();

-- Add pending_listings image support
ALTER TABLE pending_listings 
ADD COLUMN IF NOT EXISTS image_urls TEXT[] DEFAULT '{}';

-- Create trigger for pending_listings timestamp
DROP TRIGGER IF EXISTS update_pending_listings_timestamp ON pending_listings;

CREATE OR REPLACE FUNCTION update_pending_listings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_pending_listings_timestamp
  BEFORE UPDATE ON pending_listings
  FOR EACH ROW
  EXECUTE FUNCTION update_pending_listings_updated_at();
