-- Add photo_urls column if it doesn't exist
ALTER TABLE nearby_listings
ADD COLUMN IF NOT EXISTS photo_urls TEXT[] DEFAULT '{}';

-- Create index for faster queries on listings with photos
CREATE INDEX IF NOT EXISTS idx_nearby_listings_has_photos 
ON nearby_listings (id) 
WHERE photo_urls IS NOT NULL AND array_length(photo_urls, 1) > 0;
