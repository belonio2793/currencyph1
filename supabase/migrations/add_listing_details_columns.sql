-- Migration: Add comprehensive listing detail columns to nearby_listings table
-- Purpose: Extend nearby_listings table with all TripAdvisor data fields
-- Date: 2024

BEGIN;

-- Add missing columns to nearby_listings table
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

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_nearby_listings_slug ON nearby_listings(slug);
CREATE INDEX IF NOT EXISTS idx_nearby_listings_rating ON nearby_listings(rating DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_nearby_listings_category ON nearby_listings(category);
CREATE INDEX IF NOT EXISTS idx_nearby_listings_location_type ON nearby_listings(location_type);
CREATE INDEX IF NOT EXISTS idx_nearby_listings_verified ON nearby_listings(verified);
CREATE INDEX IF NOT EXISTS idx_nearby_listings_updated_at ON nearby_listings(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_nearby_listings_address ON nearby_listings(address);

-- Create a full-text search index for better search performance
CREATE INDEX IF NOT EXISTS idx_nearby_listings_fts ON nearby_listings USING GIN(to_tsvector('english', name || ' ' || COALESCE(description, '') || ' ' || COALESCE(category, '')));

COMMIT;
