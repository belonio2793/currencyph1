-- Drop existing functions that have issues (this will also drop dependent functions)
DROP FUNCTION IF EXISTS search_listings(TEXT, INT);
DROP FUNCTION IF EXISTS get_nearby_listings(FLOAT8, FLOAT8, FLOAT8, INT);
DROP FUNCTION IF EXISTS haversine_distance(FLOAT8, FLOAT8, FLOAT8, FLOAT8);

-- Make sure columns exist
ALTER TABLE nearby_listings 
ADD COLUMN IF NOT EXISTS image_url TEXT,
ADD COLUMN IF NOT EXISTS stored_image_path TEXT,
ADD COLUMN IF NOT EXISTS image_downloaded_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS review_count INTEGER,
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'tripadvisor';

-- Update existing records to have source
UPDATE nearby_listings SET source = 'tripadvisor' WHERE source IS NULL;

-- Helper function to calculate distance using Haversine formula
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

-- Function to get listings by distance
CREATE OR REPLACE FUNCTION get_nearby_listings(
  lat_input FLOAT8,
  lon_input FLOAT8,
  distance_km FLOAT8 DEFAULT 10,
  limit_count INT DEFAULT 50
)
RETURNS TABLE (
  id BIGINT,
  tripadvisor_id VARCHAR,
  name VARCHAR,
  address TEXT,
  latitude NUMERIC,
  longitude NUMERIC,
  rating NUMERIC,
  category VARCHAR,
  stored_image_path TEXT,
  calculated_distance_km FLOAT8
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
    haversine_distance(lat_input, lon_input, nl.latitude::FLOAT8, nl.longitude::FLOAT8)::FLOAT8 as calculated_distance_km
  FROM nearby_listings nl
  WHERE nl.latitude IS NOT NULL 
    AND nl.longitude IS NOT NULL
    AND haversine_distance(lat_input, lon_input, nl.latitude::FLOAT8, nl.longitude::FLOAT8) <= distance_km
  ORDER BY haversine_distance(lat_input, lon_input, nl.latitude::FLOAT8, nl.longitude::FLOAT8)
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to search listings by name and address
CREATE OR REPLACE FUNCTION search_listings(
  search_query TEXT,
  limit_count INT DEFAULT 50
)
RETURNS TABLE (
  id BIGINT,
  tripadvisor_id VARCHAR,
  name VARCHAR,
  address TEXT,
  latitude NUMERIC,
  longitude NUMERIC,
  rating NUMERIC,
  category VARCHAR,
  stored_image_path TEXT,
  relevance FLOAT8
) AS $$
DECLARE
  query_vec TSQUERY;
BEGIN
  query_vec := plainto_tsquery('english', search_query);
  
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
      to_tsvector('english', COALESCE(nl.name, '') || ' ' || COALESCE(nl.address, '')),
      query_vec
    )::FLOAT8 as relevance
  FROM nearby_listings nl
  WHERE to_tsvector('english', COALESCE(nl.name, '') || ' ' || COALESCE(nl.address, '')) @@ query_vec
  ORDER BY relevance DESC, 
    nl.rating DESC NULLS LAST
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql STABLE;

-- Add comments for documentation
COMMENT ON FUNCTION haversine_distance(FLOAT8, FLOAT8, FLOAT8, FLOAT8) IS 'Calculate distance between two coordinates using Haversine formula (result in km)';
COMMENT ON FUNCTION get_nearby_listings(FLOAT8, FLOAT8, FLOAT8, INT) IS 'Get listings within a specified distance from coordinates';
COMMENT ON FUNCTION search_listings(TEXT, INT) IS 'Full-text search listings by name and address';
