-- Fix slug unique constraint issue
-- Allow multiple listings to have similar names by using a composite identifier

BEGIN;

-- Step 1: Drop the old unique constraint on slug
ALTER TABLE nearby_listings
DROP CONSTRAINT IF EXISTS nearby_listings_slug_key;

-- Step 2: Keep the index for performance but make it non-unique
DROP INDEX IF EXISTS idx_nearby_listings_slug;
CREATE INDEX IF NOT EXISTS idx_nearby_listings_slug ON nearby_listings(slug);

-- Step 3: Create a new index that combines slug + tripadvisor_id for uniqueness
-- This allows multiple listings with same name but different IDs
CREATE UNIQUE INDEX IF NOT EXISTS idx_nearby_listings_slug_id 
ON nearby_listings(slug, tripadvisor_id);

COMMIT;
