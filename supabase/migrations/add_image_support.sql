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
-- This function is IMMUTABLE so it can be used in indexes
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
$$ LANGUAGE plpgsql IMMUTABLE STRICT;

-- Add helper function to get listings by distance
-- NOTE: Changed output column name from distance_km to calculated_distance_km to avoid parameter name conflict
CREATE OR REPLACE FUNCTION get_nearby_listings(
  lat_input FLOAT8,
  lon_input FLOAT8,
  distance_km FLOAT8 DEFAULT 10,
  limit_count INT DEFAULT 50
)
RETURNS TABLE (
  id BIGINT,
  tripadvisor_id TEXT,
  name TEXT,
  address TEXT,
  latitude FLOAT8,
  longitude FLOAT8,
  rating FLOAT8,
  category TEXT,
  stored_image_path TEXT,
  calculated_distance_km FLOAT8
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    nl.id,
    nl.tripadvisor_id::TEXT,
    nl.name::TEXT,
    nl.address::TEXT,
    nl.latitude::FLOAT8,
    nl.longitude::FLOAT8,
    nl.rating::FLOAT8,
    nl.category::TEXT,
    nl.stored_image_path::TEXT,
    haversine_distance(lat_input, lon_input, nl.latitude, nl.longitude)::FLOAT8
  FROM nearby_listings nl
  WHERE nl.latitude IS NOT NULL
    AND nl.longitude IS NOT NULL
    AND haversine_distance(lat_input, lon_input, nl.latitude, nl.longitude) <= distance_km
  ORDER BY haversine_distance(lat_input, lon_input, nl.latitude, nl.longitude)
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql STABLE;

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
  latitude FLOAT8,
  longitude FLOAT8,
  rating FLOAT8,
  category TEXT,
  stored_image_path TEXT,
  relevance FLOAT8
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    nl.id,
    nl.tripadvisor_id::TEXT,
    nl.name::TEXT,
    nl.address::TEXT,
    nl.latitude::FLOAT8,
    nl.longitude::FLOAT8,
    nl.rating::FLOAT8,
    nl.category::TEXT,
    nl.stored_image_path::TEXT,
    ts_rank(
      to_tsvector('english', nl.name || ' ' || COALESCE(nl.address, '')),
      plainto_tsquery('english', search_query)
    )::FLOAT8
  FROM nearby_listings nl
  WHERE to_tsvector('english', nl.name || ' ' || COALESCE(nl.address, '')) @@ plainto_tsquery('english', search_query)
  ORDER BY ts_rank(
      to_tsvector('english', nl.name || ' ' || COALESCE(nl.address, '')),
      plainto_tsquery('english', search_query)
    ) DESC,
    nl.rating DESC NULLS LAST
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql STABLE;

-- Add comment to document schema
COMMENT ON TABLE nearby_listings IS 'TripAdvisor Philippines listings with images and ratings';
COMMENT ON COLUMN nearby_listings.stored_image_path IS 'Path to image stored in storage bucket (listing-images)';
COMMENT ON COLUMN nearby_listings.image_url IS 'Original image URL from TripAdvisor';
COMMENT ON COLUMN nearby_listings.image_downloaded_at IS 'Timestamp when image was downloaded and stored';
COMMENT ON COLUMN nearby_listings.source IS 'Data source (e.g., tripadvisor)';
COMMENT ON FUNCTION haversine_distance(FLOAT8, FLOAT8, FLOAT8, FLOAT8) IS 'Calculate distance between two coordinates using Haversine formula (result in km)';
COMMENT ON FUNCTION get_nearby_listings(FLOAT8, FLOAT8, FLOAT8, INT) IS 'Get listings within a specified distance from coordinates';
COMMENT ON FUNCTION search_listings(TEXT, INT) IS 'Full-text search listings by name and address';
