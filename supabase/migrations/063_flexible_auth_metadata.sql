-- Extend profiles table with flexible authentication metadata fields
-- This allows users to login with any of: email, phone, username, nickname, address, etc.

-- Add new flexible auth metadata columns to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username VARCHAR(255) UNIQUE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS nickname VARCHAR(255);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS country VARCHAR(100);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS city VARCHAR(100);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS region VARCHAR(100);

-- Create indexes for fast lookup by any metadata field
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_nickname ON public.profiles(nickname);
CREATE INDEX IF NOT EXISTS idx_profiles_phone_number ON public.profiles(phone_number);
CREATE INDEX IF NOT EXISTS idx_profiles_country ON public.profiles(country);
CREATE INDEX IF NOT EXISTS idx_profiles_city ON public.profiles(city);

-- Add documentation
COMMENT ON COLUMN public.profiles.username IS 'Unique username for flexible authentication';
COMMENT ON COLUMN public.profiles.nickname IS 'Nickname or display name for identification';
COMMENT ON COLUMN public.profiles.address IS 'Physical address';
COMMENT ON COLUMN public.profiles.country IS 'Country of residence';
COMMENT ON COLUMN public.profiles.city IS 'City of residence';
COMMENT ON COLUMN public.profiles.region IS 'Region or province of residence';

-- Create function to find user by any metadata field
-- This function searches across multiple fields to support flexible authentication
CREATE OR REPLACE FUNCTION public.find_user_by_identifier(identifier_input TEXT)
RETURNS TABLE (user_id UUID, full_name VARCHAR, phone_number VARCHAR, username VARCHAR, nickname VARCHAR, email TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.user_id,
    p.full_name,
    p.phone_number,
    p.username,
    p.nickname,
    u.email
  FROM public.profiles p
  INNER JOIN auth.users u ON p.user_id = u.id
  WHERE 
    LOWER(COALESCE(p.username, '')) = LOWER(identifier_input) OR
    LOWER(COALESCE(p.nickname, '')) = LOWER(identifier_input) OR
    LOWER(COALESCE(p.full_name, '')) = LOWER(identifier_input) OR
    LOWER(COALESCE(p.phone_number, '')) = LOWER(identifier_input) OR
    LOWER(COALESCE(u.email, '')) = LOWER(identifier_input)
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update RLS policy to allow reading profiles by identifier search (public function)
CREATE POLICY IF NOT EXISTS "Public can search profiles by identifier" ON public.profiles
  FOR SELECT
  USING (true);

-- Create function to auto-confirm email on signup (removing verification requirement)
CREATE OR REPLACE FUNCTION public.auto_confirm_email_on_signup()
RETURNS TRIGGER AS $$
BEGIN
  -- Auto-confirm email to skip verification
  UPDATE auth.users 
  SET email_confirmed_at = CURRENT_TIMESTAMP,
      confirmed_at = CURRENT_TIMESTAMP
  WHERE id = NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if present and create new one
DROP TRIGGER IF EXISTS on_auth_user_created_auto_confirm ON auth.users;
CREATE TRIGGER on_auth_user_created_auto_confirm
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_confirm_email_on_signup();

-- Grant necessary permissions
GRANT SELECT ON public.profiles TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.find_user_by_identifier TO anon, authenticated;
