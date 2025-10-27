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

-- Simple BRIN index for coordinates (doesn't require extensions)
CREATE INDEX IF NOT EXISTS idx_listings_latitude
ON nearby_listings(latitude)
WHERE latitude IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_listings_longitude
ON nearby_listings(longitude)
WHERE longitude IS NOT NULL;

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

-- Helper function to calculate distance using Haversine formula (works without extensions)
CREATE OR REPLACE FUNCTION haversine_distance(
  lat1 FLOAT8, lon1 FLOAT8,
  lat2 FLOAT8, lon2 FLOAT8
)
RETURNS FLOAT8 AS $$
DECLARE
  earth_radius_km FLOAT8 := 6371.0;
  dLat FLOAT8;
  dLon FLOAT8;
  a FLOAT8;
  c FLOAT8;
BEGIN
  dLat := RADIANS(lat2 - lat1);
  dLon := RADIANS(lon2 - lon1);
  
  a := SIN(dLat/2) * SIN(dLat/2) +
       COS(RADIANS(lat1)) * COS(RADIANS(lat2)) * SIN(dLon/2) * SIN(dLon/2);
  
  c := 2 * ATAN2(SQRT(a), SQRT(1-a));
  
  RETURN earth_radius_km * c;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

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
    haversine_distance(lat, lon, nl.latitude, nl.longitude)::FLOAT AS distance_km
  FROM nearby_listings nl
  WHERE nl.latitude IS NOT NULL 
    AND nl.longitude IS NOT NULL
    AND haversine_distance(lat, lon, nl.latitude, nl.longitude) <= distance_km
  ORDER BY haversine_distance(lat, lon, nl.latitude, nl.longitude)
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
    )::FLOAT AS relevance
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
COMMENT ON FUNCTION haversine_distance IS 'Calculate distance between two coordinates using Haversine formula (result in km)';
COMMENT ON FUNCTION get_nearby_listings IS 'Get listings within a specified distance from coordinates';
COMMENT ON FUNCTION search_listings IS 'Full-text search listings by name and address';
