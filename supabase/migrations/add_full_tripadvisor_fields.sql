-- Add missing columns to nearby_listings for full TripAdvisor data
ALTER TABLE nearby_listings
ADD COLUMN IF NOT EXISTS web_url TEXT,
ADD COLUMN IF NOT EXISTS location_type VARCHAR(255),
ADD COLUMN IF NOT EXISTS phone_number VARCHAR(50),
ADD COLUMN IF NOT EXISTS website TEXT,
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS hours_of_operation JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS photo_count INTEGER,
ADD COLUMN IF NOT EXISTS rank_in_category VARCHAR(50),
ADD COLUMN IF NOT EXISTS awards JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS price_range VARCHAR(50),
ADD COLUMN IF NOT EXISTS duration VARCHAR(100),
ADD COLUMN IF NOT EXISTS traveler_type VARCHAR(255),
ADD COLUMN IF NOT EXISTS best_for_type VARCHAR(255),
ADD COLUMN IF NOT EXISTS visibility_score DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS slug VARCHAR(255) UNIQUE;

-- Create indexes for new searchable columns
CREATE INDEX IF NOT EXISTS idx_listings_location_type ON nearby_listings(location_type);
CREATE INDEX IF NOT EXISTS idx_listings_rank ON nearby_listings(rank_in_category);
CREATE INDEX IF NOT EXISTS idx_listings_price_range ON nearby_listings(price_range);
CREATE INDEX IF NOT EXISTS idx_listings_photo_count ON nearby_listings(photo_count DESC);
CREATE INDEX IF NOT EXISTS idx_listings_slug ON nearby_listings(slug);

-- Function to generate slug from listing name
CREATE OR REPLACE FUNCTION generate_slug(name TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN LOWER(TRIM(
    REGEXP_REPLACE(
      REGEXP_REPLACE(
        REGEXP_REPLACE(name, '[^a-zA-Z0-9\s-]', '', 'g'),
        '\s+', '-', 'g'
      ),
      '-+', '-', 'g'
    )
  ));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create trigger to auto-generate slug on insert/update
CREATE OR REPLACE FUNCTION set_listing_slug()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    NEW.slug := generate_slug(NEW.name);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_slug_trigger ON nearby_listings;
CREATE TRIGGER set_slug_trigger
BEFORE INSERT OR UPDATE ON nearby_listings
FOR EACH ROW
EXECUTE FUNCTION set_listing_slug();

-- Update existing records with slugs
UPDATE nearby_listings SET slug = generate_slug(name) WHERE slug IS NULL;

-- Add comments for documentation
COMMENT ON COLUMN nearby_listings.web_url IS 'Direct link to TripAdvisor listing page';
COMMENT ON COLUMN nearby_listings.location_type IS 'Attraction, Hotel, Restaurant, Church, Park, Museum, etc.';
COMMENT ON COLUMN nearby_listings.phone_number IS 'Business phone number';
COMMENT ON COLUMN nearby_listings.website IS 'Official website URL';
COMMENT ON COLUMN nearby_listings.description IS 'Detailed description of the location';
COMMENT ON COLUMN nearby_listings.hours_of_operation IS 'JSON object with day-based hours {mon: "8:00-18:00", ...}';
COMMENT ON COLUMN nearby_listings.photo_count IS 'Total number of photos available on TripAdvisor';
COMMENT ON COLUMN nearby_listings.rank_in_category IS 'Ranking within category (e.g., "7 of 182 things to do")';
COMMENT ON COLUMN nearby_listings.awards IS 'Array of award badges (e.g., Travelers Choice 2025)';
COMMENT ON COLUMN nearby_listings.price_range IS 'Price range indicator (e.g., "$", "$$", "$$$")';
COMMENT ON COLUMN nearby_listings.duration IS 'Recommended visit duration (e.g., "1-2 hours")';
COMMENT ON COLUMN nearby_listings.slug IS 'URL-friendly slug for detail page (auto-generated)';
