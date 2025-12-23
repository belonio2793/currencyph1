-- Create marketplace_listings table with complete contact and social media support
-- This migration ensures the marketplace_listings table exists with all necessary fields
-- for storing opportunity listings with comprehensive contact information

-- Drop table if exists (only for clean setup, comment out in production)
-- DROP TABLE IF EXISTS marketplace_listings CASCADE;

-- Create marketplace_listings table
CREATE TABLE IF NOT EXISTS marketplace_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  commitment_profile_id UUID REFERENCES commitment_profiles(id) ON DELETE CASCADE,
  
  -- Contact Information
  contact_name TEXT,
  contact_email TEXT,
  contact_phone VARCHAR(20),
  
  -- Opportunity Details
  what_can_offer TEXT NOT NULL,
  what_need TEXT,
  notes TEXT,
  
  -- Social Media Profiles (JSON object with optional social handles)
  -- Structure: {twitter, linkedin, instagram, facebook, telegram, whatsapp, viber}
  social_media JSONB DEFAULT '{}'::jsonb,
  
  -- Status and Timestamps
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'matched', 'completed', 'archived')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_status ON marketplace_listings(status);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_user_id ON marketplace_listings(user_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_commitment_profile_id ON marketplace_listings(commitment_profile_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_created_at ON marketplace_listings(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_contact_phone ON marketplace_listings(contact_phone);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_contact_email ON marketplace_listings(contact_email);

-- Add documentation comments
COMMENT ON TABLE marketplace_listings IS 'Stores marketplace opportunities where users share what they can offer and what they need for partnership/business matching';
COMMENT ON COLUMN marketplace_listings.contact_name IS 'Name of the contact person (optional)';
COMMENT ON COLUMN marketplace_listings.contact_email IS 'Email address for contact (optional, but at least email or phone required)';
COMMENT ON COLUMN marketplace_listings.contact_phone IS 'Phone number for contact (optional, supports international formats like +63-9XX-XXX-XXXX)';
COMMENT ON COLUMN marketplace_listings.what_can_offer IS 'Description of products/services/resources the user can provide (required)';
COMMENT ON COLUMN marketplace_listings.what_need IS 'Description of what the user is looking for (optional)';
COMMENT ON COLUMN marketplace_listings.notes IS 'Additional details like location, timing, preferences, or constraints';
COMMENT ON COLUMN marketplace_listings.social_media IS 'JSON object containing optional social media profiles: {twitter, linkedin, instagram, facebook, telegram, whatsapp, viber}';
COMMENT ON COLUMN marketplace_listings.status IS 'Status of the listing: active (published), matched (found partners), completed (transaction done), archived (no longer active)';

-- Enable Row Level Security
ALTER TABLE marketplace_listings ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Anyone can view active listings
CREATE POLICY IF NOT EXISTS "Allow public to view active listings"
  ON marketplace_listings FOR SELECT
  USING (status = 'active');

-- RLS Policy: Users can view their own listings
CREATE POLICY IF NOT EXISTS "Users can view their own listings"
  ON marketplace_listings FOR SELECT
  USING (auth.uid() = user_id);

-- RLS Policy: Authenticated users can create listings
CREATE POLICY IF NOT EXISTS "Authenticated users can create listings"
  ON marketplace_listings FOR INSERT
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- RLS Policy: Users can update their own listings
CREATE POLICY IF NOT EXISTS "Users can update their own listings"
  ON marketplace_listings FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS Policy: Users can delete their own listings
CREATE POLICY IF NOT EXISTS "Users can delete their own listings"
  ON marketplace_listings FOR DELETE
  USING (auth.uid() = user_id);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_marketplace_listings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS marketplace_listings_updated_at_trigger ON marketplace_listings;
CREATE TRIGGER marketplace_listings_updated_at_trigger
  BEFORE UPDATE ON marketplace_listings
  FOR EACH ROW
  EXECUTE FUNCTION update_marketplace_listings_updated_at();

-- Grant appropriate permissions
GRANT SELECT ON marketplace_listings TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON marketplace_listings TO authenticated;
