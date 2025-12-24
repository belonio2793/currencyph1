-- Migration: Drop photo-related columns from nearby_listings table
-- This migration removes all photo and image columns to reduce database bloat
-- and simplify the listing template

BEGIN;

-- Drop columns related to photos and images
ALTER TABLE nearby_listings DROP COLUMN IF EXISTS photo_urls;
ALTER TABLE nearby_listings DROP COLUMN IF EXISTS image_urls;
ALTER TABLE nearby_listings DROP COLUMN IF EXISTS photo_count;
ALTER TABLE nearby_listings DROP COLUMN IF EXISTS image_url;
ALTER TABLE nearby_listings DROP COLUMN IF EXISTS featured_image_url;
ALTER TABLE nearby_listings DROP COLUMN IF EXISTS primary_image_url;
ALTER TABLE nearby_listings DROP COLUMN IF EXISTS stored_image_path;
ALTER TABLE nearby_listings DROP COLUMN IF EXISTS image_downloaded_at;

-- Update timestamp to track migration
UPDATE nearby_listings SET updated_at = NOW() WHERE updated_at IS NULL;

COMMIT;

-- Verify migration completed successfully
SELECT 
  'Migration completed successfully' as status,
  COUNT(*) as total_listings,
  NOW() as timestamp
FROM nearby_listings;
