-- Add contact and social media fields to commitment_profiles table
ALTER TABLE commitment_profiles ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20);
ALTER TABLE commitment_profiles ADD COLUMN IF NOT EXISTS social_media JSONB DEFAULT '{}'::jsonb;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_commitment_profiles_phone ON commitment_profiles(phone_number);

-- Add comment for documentation
COMMENT ON COLUMN commitment_profiles.phone_number IS 'Optional phone number for contact';
COMMENT ON COLUMN commitment_profiles.social_media IS 'JSON object storing social media profiles: {twitter, linkedin, instagram, facebook, telegram, whatsapp, viber}';

-- Also update marketplace_listings to include phone and social media
ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(20);
ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS social_media JSONB DEFAULT '{}'::jsonb;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_phone ON marketplace_listings(contact_phone);

-- Add comments
COMMENT ON COLUMN marketplace_listings.contact_phone IS 'Optional phone number for contact';
COMMENT ON COLUMN marketplace_listings.social_media IS 'JSON object storing social media profiles: {twitter, linkedin, instagram, facebook, telegram, whatsapp, viber}';
