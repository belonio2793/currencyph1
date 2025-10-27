-- Comprehensive Listings Database Setup
-- This script sets up the complete nearby_listings table with all TripAdvisor fields
-- Run this in Supabase SQL Editor to update your database

BEGIN;

-- Step 1: Add all missing columns to nearby_listings table
ALTER TABLE nearby_listings
ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS highlights JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS best_for JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS hours_of_operation JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS admission_fee TEXT,
ADD COLUMN IF NOT EXISTS phone_number TEXT,
ADD COLUMN IF NOT EXISTS website TEXT,
ADD COLUMN IF NOT EXISTS web_url TEXT,
ADD COLUMN IF NOT EXISTS photo_count INTEGER,
ADD COLUMN IF NOT EXISTS photo_urls TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS review_count INTEGER,
ADD COLUMN IF NOT EXISTS review_details JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS awards JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS ranking_in_city TEXT,
ADD COLUMN IF NOT EXISTS ranking_in_category INTEGER,
ADD COLUMN IF NOT EXISTS location_type TEXT,
ADD COLUMN IF NOT EXISTS amenities JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS accessibility_info JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS nearby_attractions TEXT[],
ADD COLUMN IF NOT EXISTS price_level INTEGER,
ADD COLUMN IF NOT EXISTS lat DECIMAL(10, 8),
ADD COLUMN IF NOT EXISTS lng DECIMAL(11, 8),
ADD COLUMN IF NOT EXISTS image_url TEXT,
ADD COLUMN IF NOT EXISTS featured_image_url TEXT,
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'tripadvisor',
ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS last_verified_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS fetch_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS fetch_error_message TEXT;

-- Step 2: Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_nearby_listings_slug ON nearby_listings(slug);
CREATE INDEX IF NOT EXISTS idx_nearby_listings_rating ON nearby_listings(rating DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_nearby_listings_category ON nearby_listings(category);
CREATE INDEX IF NOT EXISTS idx_nearby_listings_location_type ON nearby_listings(location_type);
CREATE INDEX IF NOT EXISTS idx_nearby_listings_verified ON nearby_listings(verified);
CREATE INDEX IF NOT EXISTS idx_nearby_listings_updated_at ON nearby_listings(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_nearby_listings_address ON nearby_listings(address);
CREATE INDEX IF NOT EXISTS idx_nearby_listings_review_count ON nearby_listings(review_count DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_nearby_listings_lat_lng ON nearby_listings(lat, lng);

-- Step 3: Create full-text search index
CREATE INDEX IF NOT EXISTS idx_nearby_listings_fts 
ON nearby_listings USING GIN(to_tsvector('english', name || ' ' || COALESCE(description, '') || ' ' || COALESCE(category, '')));

-- Step 4: Create materialized view for top-rated listings
CREATE MATERIALIZED VIEW IF NOT EXISTS top_rated_listings AS
SELECT 
  tripadvisor_id,
  name,
  slug,
  rating,
  review_count,
  category,
  address,
  image_url,
  latitude,
  longitude
FROM nearby_listings
WHERE verified = true AND rating IS NOT NULL
ORDER BY rating DESC, review_count DESC
LIMIT 1000;

CREATE INDEX IF NOT EXISTS idx_top_rated_listings_category ON top_rated_listings(category);

-- Step 5: Create materialized view for listings by city
CREATE MATERIALIZED VIEW IF NOT EXISTS listings_by_city AS
SELECT 
  tripadvisor_id,
  name,
  slug,
  rating,
  review_count,
  category,
  address,
  image_url,
  SPLIT_PART(address, ',', -1) as city
FROM nearby_listings
WHERE verified = true
ORDER BY address;

CREATE INDEX IF NOT EXISTS idx_listings_by_city ON listings_by_city(city);

-- Step 6: Create functions for common queries

-- Function to search listings
CREATE OR REPLACE FUNCTION search_listings(search_query TEXT, limit_rows INT DEFAULT 20)
RETURNS TABLE (
  tripadvisor_id TEXT,
  name TEXT,
  slug TEXT,
  rating NUMERIC,
  review_count INTEGER,
  category TEXT,
  address TEXT,
  image_url TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    nl.tripadvisor_id,
    nl.name,
    nl.slug,
    nl.rating,
    nl.review_count,
    nl.category,
    nl.address,
    nl.image_url
  FROM nearby_listings nl
  WHERE nl.verified = true AND (
    nl.name ILIKE '%' || search_query || '%' OR
    nl.address ILIKE '%' || search_query || '%' OR
    nl.category ILIKE '%' || search_query || '%'
  )
  ORDER BY nl.rating DESC, nl.review_count DESC
  LIMIT limit_rows;
END;
$$ LANGUAGE plpgsql;

-- Function to get listings by category
CREATE OR REPLACE FUNCTION get_by_category(cat TEXT, limit_rows INT DEFAULT 20)
RETURNS TABLE (
  tripadvisor_id TEXT,
  name TEXT,
  slug TEXT,
  rating NUMERIC,
  review_count INTEGER,
  address TEXT,
  image_url TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    nl.tripadvisor_id,
    nl.name,
    nl.slug,
    nl.rating,
    nl.review_count,
    nl.address,
    nl.image_url
  FROM nearby_listings nl
  WHERE nl.verified = true AND nl.category ILIKE cat
  ORDER BY nl.rating DESC, nl.review_count DESC
  LIMIT limit_rows;
END;
$$ LANGUAGE plpgsql;

-- Function to get nearby listings by coordinates
CREATE OR REPLACE FUNCTION get_nearby_listings(lat DECIMAL, lng DECIMAL, radius_km INT DEFAULT 10, limit_rows INT DEFAULT 20)
RETURNS TABLE (
  tripadvisor_id TEXT,
  name TEXT,
  slug TEXT,
  rating NUMERIC,
  review_count INTEGER,
  address TEXT,
  image_url TEXT,
  distance_km FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    nl.tripadvisor_id,
    nl.name,
    nl.slug,
    nl.rating,
    nl.review_count,
    nl.address,
    nl.image_url,
    (
      6371 * acos(
        cos(radians(lat)) * cos(radians(nl.lat)) * cos(radians(nl.lng) - radians(lng)) +
        sin(radians(lat)) * sin(radians(nl.lat))
      )
    )::FLOAT AS distance
  FROM nearby_listings nl
  WHERE nl.verified = true AND nl.lat IS NOT NULL AND nl.lng IS NOT NULL
  HAVING (
    6371 * acos(
      cos(radians(lat)) * cos(radians(nl.lat)) * cos(radians(nl.lng) - radians(lng)) +
      sin(radians(lat)) * sin(radians(nl.lat))
    )
  ) <= radius_km
  ORDER BY distance
  LIMIT limit_rows;
END;
$$ LANGUAGE plpgsql;

-- Step 7: Update raw column structure for efficiency
-- Ensure raw column stores optimized data
COMMENT ON COLUMN nearby_listings.raw IS 'Full raw TripAdvisor API response data';
COMMENT ON COLUMN nearby_listings.slug IS 'URL-friendly slug for listing detail pages';
COMMENT ON COLUMN nearby_listings.description IS 'Full description of the listing';
COMMENT ON COLUMN nearby_listings.highlights IS 'Key highlights and features as JSON array';
COMMENT ON COLUMN nearby_listings.best_for IS 'Categories this listing is best for as JSON array';
COMMENT ON COLUMN nearby_listings.hours_of_operation IS 'Operating hours by day of week as JSON object';
COMMENT ON COLUMN nearby_listings.admission_fee IS 'Admission or pricing information';
COMMENT ON COLUMN nearby_listings.phone_number IS 'Contact phone number';
COMMENT ON COLUMN nearby_listings.website IS 'Official website URL';
COMMENT ON COLUMN nearby_listings.web_url IS 'TripAdvisor page URL';
COMMENT ON COLUMN nearby_listings.photo_count IS 'Number of available photos';
COMMENT ON COLUMN nearby_listings.photo_urls IS 'Array of photo URLs';
COMMENT ON COLUMN nearby_listings.review_details IS 'Sample reviews with ratings and text as JSON array';
COMMENT ON COLUMN nearby_listings.awards IS 'Awards and recognition as JSON array';
COMMENT ON COLUMN nearby_listings.ranking_in_city IS 'Ranking among attractions in the city';
COMMENT ON COLUMN nearby_listings.location_type IS 'Type of location (Historical Site, Restaurant, etc.)';
COMMENT ON COLUMN nearby_listings.amenities IS 'Available amenities as JSON array';
COMMENT ON COLUMN nearby_listings.accessibility_info IS 'Accessibility information as JSON object';
COMMENT ON COLUMN nearby_listings.nearby_attractions IS 'Nearby points of interest as text array';
COMMENT ON COLUMN nearby_listings.price_level IS 'Price level indicator (1-4)';
COMMENT ON COLUMN nearby_listings.verified IS 'Whether listing data has been verified from TripAdvisor';
COMMENT ON COLUMN nearby_listings.last_verified_at IS 'Timestamp of last verification from TripAdvisor';

COMMIT;

-- Display summary of changes
SELECT 
  'Database migration completed successfully!' as status,
  count(*) as total_listings,
  count(*) FILTER (WHERE verified = true) as verified_listings,
  count(DISTINCT category) as categories,
  round(avg(rating)::numeric, 2) as average_rating
FROM nearby_listings;
