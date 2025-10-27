-- Fix schema issues and ensure columns match UI layout

BEGIN;

-- Step 1: Drop UNIQUE constraint on slug if it exists
-- This allows multiple listings to have similar base slugs with ID suffixes
ALTER TABLE nearby_listings
DROP CONSTRAINT IF EXISTS nearby_listings_slug_key;

-- Step 2: Ensure all essential columns exist for UI rendering
ALTER TABLE nearby_listings
ADD COLUMN IF NOT EXISTS tripadvisor_id TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS name TEXT NOT NULL,
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8),
ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8),
ADD COLUMN IF NOT EXISTS rating NUMERIC(3, 1),
ADD COLUMN IF NOT EXISTS review_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS category TEXT,
ADD COLUMN IF NOT EXISTS image_url TEXT,
ADD COLUMN IF NOT EXISTS slug TEXT,
ADD COLUMN IF NOT EXISTS web_url TEXT,
ADD COLUMN IF NOT EXISTS phone_number TEXT,
ADD COLUMN IF NOT EXISTS website TEXT,
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS location_type TEXT,
ADD COLUMN IF NOT EXISTS photo_urls TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS hours_of_operation JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS amenities JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS highlights JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS best_for JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS awards JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS accessibility_info JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS nearby_attractions TEXT[],
ADD COLUMN IF NOT EXISTS review_details JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS price_level INTEGER,
ADD COLUMN IF NOT EXISTS ranking_in_city TEXT,
ADD COLUMN IF NOT EXISTS ranking_in_category INTEGER,
ADD COLUMN IF NOT EXISTS photo_count INTEGER,
ADD COLUMN IF NOT EXISTS featured_image_url TEXT,
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'tripadvisor',
ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS last_verified_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS fetch_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS fetch_error_message TEXT,
ADD COLUMN IF NOT EXISTS raw JSONB,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Step 3: Create indexes for performance (non-unique on slug)
DROP INDEX IF EXISTS idx_nearby_listings_slug;
CREATE INDEX IF NOT EXISTS idx_nearby_listings_slug ON nearby_listings(slug);
CREATE INDEX IF NOT EXISTS idx_nearby_listings_tripadvisor_id ON nearby_listings(tripadvisor_id);
CREATE INDEX IF NOT EXISTS idx_nearby_listings_rating ON nearby_listings(rating DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_nearby_listings_category ON nearby_listings(category);
CREATE INDEX IF NOT EXISTS idx_nearby_listings_location_type ON nearby_listings(location_type);
CREATE INDEX IF NOT EXISTS idx_nearby_listings_updated_at ON nearby_listings(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_nearby_listings_address ON nearby_listings(address);
CREATE INDEX IF NOT EXISTS idx_nearby_listings_review_count ON nearby_listings(review_count DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_nearby_listings_lat_lng ON nearby_listings(latitude, longitude);

-- Step 4: Full-text search index
CREATE INDEX IF NOT EXISTS idx_nearby_listings_fts 
ON nearby_listings USING GIN(to_tsvector('english', COALESCE(name, '') || ' ' || COALESCE(description, '') || ' ' || COALESCE(category, '')));

-- Step 5: Drop old views and recreate them
DROP MATERIALIZED VIEW IF EXISTS top_rated_listings CASCADE;
DROP MATERIALIZED VIEW IF EXISTS listings_by_city CASCADE;

-- Recreate views
CREATE MATERIALIZED VIEW top_rated_listings AS
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

CREATE INDEX idx_top_rated_listings_category ON top_rated_listings(category);

CREATE MATERIALIZED VIEW listings_by_city AS
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
  longitude,
  TRIM(SUBSTRING_INDEX(address, ',', -1)) as city
FROM nearby_listings
WHERE verified = true AND address IS NOT NULL
ORDER BY address;

CREATE INDEX idx_listings_by_city ON listings_by_city(city);

COMMIT;
