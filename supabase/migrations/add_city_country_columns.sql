-- Migration: Add city and country columns to nearby_listings table
-- Purpose: Support filtering and organizing listings by city and country
-- Date: 2024

BEGIN;

-- Add city and country columns
ALTER TABLE nearby_listings
ADD COLUMN IF NOT EXISTS city VARCHAR(255),
ADD COLUMN IF NOT EXISTS country VARCHAR(255) DEFAULT 'Philippines';

-- Create indexes for city and country queries
CREATE INDEX IF NOT EXISTS idx_nearby_listings_city ON nearby_listings(city);
CREATE INDEX IF NOT EXISTS idx_nearby_listings_country ON nearby_listings(country);
CREATE INDEX IF NOT EXISTS idx_nearby_listings_city_country ON nearby_listings(city, country);

-- Add comment to document columns
COMMENT ON COLUMN nearby_listings.city IS 'City name where the listing is located';
COMMENT ON COLUMN nearby_listings.country IS 'Country where the listing is located';

COMMIT;
