-- Migration: 065 - Fix registration metadata insertion
-- Ensures that when users signup, their metadata (username, phone, etc) is properly stored
-- This fixes the "Database error saving new user" issue

-- Step 1: Improve the create_profile_on_signup function to handle all metadata
CREATE OR REPLACE FUNCTION public.create_profile_on_signup()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (
    user_id,
    full_name,
    username,
    phone_number,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'username', NULL),
    COALESCE(NEW.raw_user_meta_data->>'phone_number', NULL),
    NOW(),
    NOW()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
    username = COALESCE(EXCLUDED.username, public.profiles.username),
    phone_number = COALESCE(EXCLUDED.phone_number, public.profiles.phone_number),
    updated_at = NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 2: Update RLS policies for profiles to allow users to insert/update their own
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id OR auth.role() = 'service_role');

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id OR auth.role() = 'service_role')
  WITH CHECK (auth.uid() = user_id OR auth.role() = 'service_role');

-- Step 3: Ensure username uniqueness is handled at constraint level with proper error messaging
-- This constraint already exists from migration 063, but we verify it
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_username_key;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_username_key UNIQUE (username) WHERE username IS NOT NULL;

-- Step 4: Add missing grants for the trigger function
GRANT EXECUTE ON FUNCTION public.create_profile_on_signup TO anon, authenticated, service_role;

-- Step 5: Document the changes
COMMENT ON FUNCTION public.create_profile_on_signup() IS 'Auto-creates profile on signup with all metadata fields including username and phone_number';
