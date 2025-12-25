-- ============================================================================
-- MIGRATION: Sync auth.users → public.users → public.profiles
-- ============================================================================
-- Purpose: Ensure all three tables stay in sync automatically
-- - When auth.users is created, populate public.users AND public.profiles
-- - Includes backfill of existing auth.users records
-- 
-- Tables involved:
-- - auth.users (source of truth from Supabase auth)
-- - public.users (main user table)
-- - public.profiles (detailed profile information)
-- ============================================================================

BEGIN;

-- ============================================================================
-- Step 1: Ensure all tables exist with proper structure
-- ============================================================================

-- Ensure public.users exists
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) UNIQUE,
  username VARCHAR(255) UNIQUE,
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  full_name VARCHAR(255),
  phone_number VARCHAR(20),
  profile_picture_url TEXT,
  wallet_address VARCHAR(255) UNIQUE,
  dog_balance DECIMAL(15, 2) DEFAULT 0,
  region_code VARCHAR(5) DEFAULT 'PH',
  bio TEXT,
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add columns if they don't already exist
ALTER TABLE IF EXISTS public.users
ADD COLUMN IF NOT EXISTS first_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS last_name VARCHAR(255);

-- Ensure public.profiles exists
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  username VARCHAR(255) UNIQUE,
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  full_name VARCHAR(255),
  phone_number VARCHAR(20),
  profile_picture_url TEXT,
  bio TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add columns if they don't already exist
ALTER TABLE IF EXISTS public.profiles
ADD COLUMN IF NOT EXISTS first_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS last_name VARCHAR(255);

-- ============================================================================
-- Step 2: Create indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_users_auth_id ON public.users(auth_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON public.users(username);
CREATE INDEX IF NOT EXISTS idx_users_phone ON public.users(phone_number);
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);

-- ============================================================================
-- Step 3: Drop old triggers to prevent conflicts
-- ============================================================================

DROP TRIGGER IF EXISTS on_auth_user_created_public_user ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
DROP TRIGGER IF EXISTS on_profile_update_sync_users ON public.profiles;

-- ============================================================================
-- Step 4: Create MASTER trigger function that syncs all three tables
-- ============================================================================

CREATE OR REPLACE FUNCTION public.sync_auth_user_to_public()
RETURNS TRIGGER AS $$
DECLARE
  v_first_name TEXT;
  v_last_name TEXT;
  v_full_name TEXT;
  v_region_code TEXT;
BEGIN
  -- Extract metadata from auth.users raw_user_meta_data
  v_first_name := COALESCE(NEW.raw_user_meta_data->>'first_name', NEW.user_metadata->>'first_name', '');
  v_last_name := COALESCE(NEW.raw_user_meta_data->>'last_name', NEW.user_metadata->>'last_name', '');
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.user_metadata->>'full_name', '');
  v_region_code := COALESCE(NEW.raw_user_meta_data->>'region_code', NEW.user_metadata->>'region_code', 'PH');

  -- ========================================================================
  -- Insert/Update public.users
  -- ========================================================================
  INSERT INTO public.users (
    auth_id,
    email,
    first_name,
    last_name,
    full_name,
    region_code,
    status,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    v_first_name,
    v_last_name,
    v_full_name,
    v_region_code,
    'active',
    NOW(),
    NOW()
  )
  ON CONFLICT (auth_id) DO UPDATE SET
    email = EXCLUDED.email,
    first_name = COALESCE(EXCLUDED.first_name, public.users.first_name),
    last_name = COALESCE(EXCLUDED.last_name, public.users.last_name),
    full_name = COALESCE(EXCLUDED.full_name, public.users.full_name),
    region_code = COALESCE(EXCLUDED.region_code, public.users.region_code),
    updated_at = NOW();

  -- ========================================================================
  -- Insert/Update public.profiles
  -- ========================================================================
  INSERT INTO public.profiles (
    user_id,
    first_name,
    last_name,
    full_name,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    v_first_name,
    v_last_name,
    v_full_name,
    NOW(),
    NOW()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    first_name = COALESCE(EXCLUDED.first_name, public.profiles.first_name),
    last_name = COALESCE(EXCLUDED.last_name, public.profiles.last_name),
    full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================================================
-- Step 5: Create the trigger on auth.users
-- ========================================================================

CREATE TRIGGER on_auth_user_created_sync_all
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_auth_user_to_public();

-- ========================================================================
-- Step 6: Create function to sync profiles → public.users
-- ========================================================================

CREATE OR REPLACE FUNCTION public.sync_profile_to_users()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update username if it's not null AND not used by another user
  IF NEW.username IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE username = NEW.username AND auth_id <> NEW.user_id
  ) THEN
    UPDATE public.users
    SET username = NEW.username
    WHERE auth_id = NEW.user_id;
  END IF;

  -- Update other fields safely
  UPDATE public.users
  SET
    first_name = COALESCE(NEW.first_name, first_name),
    last_name = COALESCE(NEW.last_name, last_name),
    full_name = COALESCE(NEW.full_name, full_name),
    phone_number = COALESCE(NEW.phone_number, phone_number),
    profile_picture_url = COALESCE(NEW.profile_picture_url, profile_picture_url),
    bio = COALESCE(NEW.bio, bio),
    updated_at = NOW()
  WHERE auth_id = NEW.user_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_profile_update_sync_to_users
  AFTER INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_profile_to_users();

-- ========================================================================
-- Step 7: Enable RLS
-- ========================================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ========================================================================
-- Step 8: Drop old RLS policies
-- ========================================================================

DROP POLICY IF EXISTS "Users can view own data" ON public.users;
DROP POLICY IF EXISTS "Users can update own data" ON public.users;
DROP POLICY IF EXISTS "Users can insert own data" ON public.users;
DROP POLICY IF EXISTS "Users can insert deposits" ON public.users;
DROP POLICY IF EXISTS "Users can view their own user data" ON public.users;
DROP POLICY IF EXISTS "Users can update their own user data" ON public.users;
DROP POLICY IF EXISTS "System can create user on signup" ON public.users;
DROP POLICY IF EXISTS "Service role can manage all users" ON public.users;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can delete their own profile" ON public.profiles;

-- ========================================================================
-- Step 9: Create comprehensive RLS policies
-- ========================================================================

-- public.users RLS policies
CREATE POLICY "users_select_own" ON public.users
  FOR SELECT USING (auth.uid() = auth_id OR auth.role() = 'service_role');

CREATE POLICY "users_update_own" ON public.users
  FOR UPDATE USING (auth.uid() = auth_id OR auth.role() = 'service_role')
  WITH CHECK (auth.uid() = auth_id OR auth.role() = 'service_role');

CREATE POLICY "users_insert_system" ON public.users
  FOR INSERT WITH CHECK (auth.role() = 'service_role' OR true);

CREATE POLICY "users_delete_system" ON public.users
  FOR DELETE USING (auth.role() = 'service_role');

-- public.profiles RLS policies
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING (auth.uid() = user_id OR auth.role() = 'service_role' OR true);

CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id OR auth.role() = 'service_role')
  WITH CHECK (auth.uid() = user_id OR auth.role() = 'service_role');

CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id OR auth.role() = 'service_role' OR true);

CREATE POLICY "profiles_delete_own" ON public.profiles
  FOR DELETE USING (auth.uid() = user_id OR auth.role() = 'service_role');

-- ========================================================================
-- Step 10: Grant permissions
-- ========================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.users TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sync_auth_user_to_public TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sync_profile_to_users TO authenticated, service_role;

-- ========================================================================
-- Step 11: BACKFILL - Sync existing auth.users to public.users and profiles
-- ========================================================================

DO $$
DECLARE
  v_count INTEGER := 0;
  v_auth_user RECORD;
  v_full_name TEXT;
  v_region_code TEXT;
BEGIN
  RAISE NOTICE 'Starting backfill of auth.users to public.users and public.profiles...';

  FOR v_auth_user IN 
    SELECT 
      id,
      email,
      raw_user_meta_data,
      user_metadata,
      created_at,
      updated_at
    FROM auth.users
    WHERE COALESCE(raw_user_meta_data->>'synced', 'false') = 'false'
      OR (
        id NOT IN (SELECT auth_id FROM public.users WHERE auth_id IS NOT NULL)
        OR id NOT IN (SELECT user_id FROM public.profiles WHERE user_id IS NOT NULL)
      )
  LOOP
    v_full_name := COALESCE(
      v_auth_user.raw_user_meta_data->>'full_name',
      v_auth_user.user_metadata->>'full_name',
      ''
    );
    
    v_region_code := COALESCE(
      v_auth_user.raw_user_meta_data->>'region_code',
      v_auth_user.user_metadata->>'region_code',
      'PH'
    );

    -- Insert/Update public.users
    INSERT INTO public.users (
      auth_id,
      email,
      full_name,
      region_code,
      status,
      created_at,
      updated_at
    )
    VALUES (
      v_auth_user.id,
      v_auth_user.email,
      v_full_name,
      v_region_code,
      'active',
      v_auth_user.created_at,
      v_auth_user.updated_at
    )
    ON CONFLICT (auth_id) DO UPDATE SET
      email = EXCLUDED.email,
      updated_at = NOW();

    -- Insert/Update public.profiles
    INSERT INTO public.profiles (
      user_id,
      full_name,
      created_at,
      updated_at
    )
    VALUES (
      v_auth_user.id,
      v_full_name,
      v_auth_user.created_at,
      v_auth_user.updated_at
    )
    ON CONFLICT (user_id) DO UPDATE SET
      full_name = EXCLUDED.full_name,
      updated_at = NOW();

    v_count := v_count + 1;
  END LOOP;

  RAISE NOTICE 'Backfill complete: % users synced', v_count;
END $$;

-- ========================================================================
-- Step 12: Add comments for documentation
-- ========================================================================

COMMENT ON TABLE public.users IS 'Central user table synced from auth.users and profiles';
COMMENT ON TABLE public.profiles IS 'User profile data synced from auth.users';
COMMENT ON FUNCTION public.sync_auth_user_to_public() IS 'Master trigger that syncs auth.users to both public.users and public.profiles';
COMMENT ON FUNCTION public.sync_profile_to_users() IS 'Syncs updates from profiles back to public.users';

COMMIT;

-- ============================================================================
-- VERIFICATION QUERIES (run after applying migration)
-- ============================================================================
-- 
-- Check all three tables are populated:
-- SELECT COUNT(*) as auth_users_count FROM auth.users;
-- SELECT COUNT(*) as public_users_count FROM public.users;
-- SELECT COUNT(*) as profiles_count FROM public.profiles;
--
-- Check for missing syncs (should be 0):
-- SELECT COUNT(*) as unsynced_auth_users
-- FROM auth.users au
-- WHERE NOT EXISTS (SELECT 1 FROM public.users pu WHERE pu.auth_id = au.id);
--
-- Check for missing profiles (should be 0):
-- SELECT COUNT(*) as unsynced_profiles
-- FROM auth.users au
-- WHERE NOT EXISTS (SELECT 1 FROM public.profiles pp WHERE pp.user_id = au.id);
--
-- Sample select to verify sync:
-- SELECT 
--   au.id,
--   au.email,
--   pu.full_name,
--   pp.user_id
-- FROM auth.users au
-- LEFT JOIN public.users pu ON pu.auth_id = au.id
-- LEFT JOIN public.profiles pp ON pp.user_id = au.id
-- LIMIT 10;
-- ============================================================================
