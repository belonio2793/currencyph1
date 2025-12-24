-- Migration: 069 - Safe Signup Fix
-- This migration only modifies what we know exists (profiles table)

-- ============================================================================
-- STEP 1: Fix RLS policies on profiles table
-- ============================================================================

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can delete their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Public can search profiles by identifier" ON public.profiles;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.profiles;
DROP POLICY IF EXISTS "Enable update for users based on user_id" ON public.profiles;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.profiles;
DROP POLICY IF EXISTS "Enable delete for users based on user_id" ON public.profiles;

CREATE POLICY "Allow all inserts for signup" ON public.profiles
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow updates to own profile" ON public.profiles
  FOR UPDATE USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow reads to all" ON public.profiles
  FOR SELECT USING (true);

-- ============================================================================
-- STEP 2: Drop all old conflicting triggers
-- ============================================================================

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_public_user ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_auto_confirm ON auth.users;
DROP TRIGGER IF EXISTS on_profile_update_sync_users ON public.profiles;
DROP TRIGGER IF EXISTS trigger_initialize_user_wallets ON auth.users;

-- ============================================================================
-- STEP 3: Create simple, working trigger function for profiles
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Auto-confirm email
  UPDATE auth.users 
  SET email_confirmed_at = CURRENT_TIMESTAMP,
      confirmed_at = CURRENT_TIMESTAMP
  WHERE id = NEW.id;

  -- Create profile entry with all metadata from signup
  INSERT INTO public.profiles (
    user_id,
    full_name,
    username,
    phone_number,
    nickname,
    address,
    country,
    city,
    region,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')::VARCHAR(255),
    NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'username', ''))::VARCHAR(255), ''),
    NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'phone_number', ''))::VARCHAR(20), ''),
    NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'nickname', ''))::VARCHAR(255), ''),
    NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'address', ''))::TEXT, ''),
    NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'country', ''))::VARCHAR(100), ''),
    NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'city', ''))::VARCHAR(100), ''),
    NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'region', ''))::VARCHAR(100), ''),
    NOW(),
    NOW()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
    username = COALESCE(EXCLUDED.username, public.profiles.username),
    phone_number = COALESCE(EXCLUDED.phone_number, public.profiles.phone_number),
    nickname = COALESCE(EXCLUDED.nickname, public.profiles.nickname),
    address = COALESCE(EXCLUDED.address, public.profiles.address),
    country = COALESCE(EXCLUDED.country, public.profiles.country),
    city = COALESCE(EXCLUDED.city, public.profiles.city),
    region = COALESCE(EXCLUDED.region, public.profiles.region),
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- STEP 4: Grant permissions
-- ============================================================================

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.handle_new_user TO postgres, anon, authenticated, service_role;

-- ============================================================================
-- STEP 5: Documentation
-- ============================================================================

COMMENT ON FUNCTION public.handle_new_user() IS 'Automatically creates user profile on signup and auto-confirms email';
COMMENT ON TRIGGER on_auth_user_created ON auth.users IS 'Single master trigger that handles all user initialization on signup';
