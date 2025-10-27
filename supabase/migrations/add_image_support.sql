-- Add image-related columns to nearby_listings table
ALTER TABLE nearby_listings 
ADD COLUMN IF NOT EXISTS image_url TEXT,
ADD COLUMN IF NOT EXISTS stored_image_path TEXT,
ADD COLUMN IF NOT EXISTS image_downloaded_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS review_count INTEGER,
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'tripadvisor';

-- Update existing records to have source
UPDATE nearby_listings SET source = 'tripadvisor' WHERE source IS NULL;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_listings_source 
ON nearby_listings(source);

CREATE INDEX IF NOT EXISTS idx_listings_updated 
ON nearby_listings(updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_listings_rating 
ON nearby_listings(rating DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_listings_category 
ON nearby_listings(category);

CREATE INDEX IF NOT EXISTS idx_listings_coordinates 
ON nearby_listings USING GIST (ll_to_earth(latitude, longitude))
WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Add trigger to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_nearby_listings_timestamp ON nearby_listings;
CREATE TRIGGER update_nearby_listings_timestamp
BEFORE UPDATE ON nearby_listings
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

-- Enable full text search on name and address
CREATE INDEX IF NOT EXISTS idx_listings_name_search 
ON nearby_listings USING GIN(to_tsvector('english', name));

CREATE INDEX IF NOT EXISTS idx_listings_address_search 
ON nearby_listings USING GIN(to_tsvector('english', address));

-- Add helper function to get listings by distance
CREATE OR REPLACE FUNCTION get_nearby_listings(
  lat FLOAT8,
  lon FLOAT8,
  distance_km FLOAT8 DEFAULT 10,
  limit_count INT DEFAULT 50
)
RETURNS TABLE (
  id BIGINT,
  tripadvisor_id TEXT,
  name TEXT,
  address TEXT,
  latitude FLOAT,
  longitude FLOAT,
  rating FLOAT,
  category TEXT,
  stored_image_path TEXT,
  distance_km FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    nl.id,
    nl.tripadvisor_id,
    nl.name,
    nl.address,
    nl.latitude,
    nl.longitude,
    nl.rating,
    nl.category,
    nl.stored_image_path,
    (earth_distance(ll_to_earth(lat, lon), ll_to_earth(nl.latitude, nl.longitude)) * 1.609344)::FLOAT AS distance_km
  FROM nearby_listings nl
  WHERE nl.latitude IS NOT NULL 
    AND nl.longitude IS NOT NULL
    AND earth_distance(ll_to_earth(lat, lon), ll_to_earth(nl.latitude, nl.longitude)) < (distance_km / 1.609344)
  ORDER BY distance_km
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Add helper function to search listings
CREATE OR REPLACE FUNCTION search_listings(
  search_query TEXT,
  limit_count INT DEFAULT 50
)
RETURNS TABLE (
  id BIGINT,
  tripadvisor_id TEXT,
  name TEXT,
  address TEXT,
  latitude FLOAT,
  longitude FLOAT,
  rating FLOAT,
  category TEXT,
  stored_image_path TEXT,
  relevance FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    nl.id,
    nl.tripadvisor_id,
    nl.name,
    nl.address,
    nl.latitude,
    nl.longitude,
    nl.rating,
    nl.category,
    nl.stored_image_path,
    ts_rank(
      to_tsvector('english', nl.name || ' ' || COALESCE(nl.address, '')),
      plainto_tsquery('english', search_query)
    ) AS relevance
  FROM nearby_listings nl
  WHERE to_tsvector('english', nl.name || ' ' || COALESCE(nl.address, '')) @@ plainto_tsquery('english', search_query)
  ORDER BY relevance DESC, nl.rating DESC NULLS LAST
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Add comment to document schema
COMMENT ON TABLE nearby_listings IS 'TripAdvisor Philippines listings with images and ratings';
COMMENT ON COLUMN nearby_listings.stored_image_path IS 'Path to image stored in storage bucket (listing-images)';
COMMENT ON COLUMN nearby_listings.image_url IS 'Original image URL from TripAdvisor';
COMMENT ON COLUMN nearby_listings.image_downloaded_at IS 'Timestamp when image was downloaded and stored';
COMMENT ON COLUMN nearby_listings.source IS 'Data source (e.g., tripadvisor)';
