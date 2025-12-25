-- ============================================================================
-- QUICK START: Sync auth.users to public.users and public.profiles
-- ============================================================================
-- 
-- Option A: Copy the contents of this file into Supabase SQL Editor and run
-- Option B: Run the migration file: supabase/migrations/0119_sync_auth_users_to_public_with_backfill.sql
--
-- This creates automatic syncing so:
-- - New users in auth.users automatically populate public.users and public.profiles
-- - Profile updates automatically sync to public.users
-- - Existing users are backfilled
-- ============================================================================

-- Run this simplified version if you want just the core sync with no migration:

BEGIN;

-- ============================================================================
-- ENSURE TABLES EXIST
-- ============================================================================

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

-- ============================================================================
-- CREATE INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_users_auth_id ON public.users(auth_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON public.users(username);
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);

-- ============================================================================
-- DROP OLD TRIGGERS TO AVOID CONFLICTS
-- ============================================================================

DROP TRIGGER IF EXISTS on_auth_user_created_public_user ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
DROP TRIGGER IF EXISTS on_profile_update_sync_users ON public.profiles;

-- ============================================================================
-- CREATE MASTER TRIGGER FUNCTION (sync auth.users to both public tables)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.sync_auth_user_to_public()
RETURNS TRIGGER AS $$
DECLARE
  v_first_name TEXT;
  v_last_name TEXT;
  v_full_name TEXT;
  v_region_code TEXT;
BEGIN
  v_first_name := COALESCE(NEW.raw_user_meta_data->>'first_name', '');
  v_last_name := COALESCE(NEW.raw_user_meta_data->>'last_name', '');
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', '');
  v_region_code := COALESCE(NEW.raw_user_meta_data->>'region_code', 'PH');

  -- Insert/Update public.users
  INSERT INTO public.users (auth_id, email, first_name, last_name, full_name, region_code, status, created_at, updated_at)
  VALUES (NEW.id, NEW.email, v_first_name, v_last_name, v_full_name, v_region_code, 'active', NOW(), NOW())
  ON CONFLICT (auth_id) DO UPDATE SET
    email = EXCLUDED.email,
    first_name = COALESCE(EXCLUDED.first_name, public.users.first_name),
    last_name = COALESCE(EXCLUDED.last_name, public.users.last_name),
    full_name = COALESCE(EXCLUDED.full_name, public.users.full_name),
    updated_at = NOW();

  -- Insert/Update public.profiles
  INSERT INTO public.profiles (user_id, first_name, last_name, full_name, created_at, updated_at)
  VALUES (NEW.id, v_first_name, v_last_name, v_full_name, NOW(), NOW())
  ON CONFLICT (user_id) DO UPDATE SET
    first_name = COALESCE(EXCLUDED.first_name, public.profiles.first_name),
    last_name = COALESCE(EXCLUDED.last_name, public.profiles.last_name),
    full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- CREATE TRIGGER ON auth.users
-- ============================================================================

CREATE TRIGGER on_auth_user_created_sync_all
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_auth_user_to_public();

-- ============================================================================
-- CREATE FUNCTION TO SYNC PROFILE UPDATES BACK TO users TABLE
-- ============================================================================

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

-- ============================================================================
-- BACKFILL EXISTING auth.users
-- ============================================================================

DO $$
DECLARE
  v_count INTEGER := 0;
  v_auth_user RECORD;
  v_first_name TEXT;
  v_last_name TEXT;
  v_full_name TEXT;
  v_region_code TEXT;
BEGIN
  RAISE NOTICE 'Starting backfill...';

  FOR v_auth_user IN
    SELECT id, email, raw_user_meta_data, created_at, updated_at
    FROM auth.users
  LOOP
    v_first_name := COALESCE(v_auth_user.raw_user_meta_data->>'first_name', '');
    v_last_name := COALESCE(v_auth_user.raw_user_meta_data->>'last_name', '');
    v_full_name := COALESCE(v_auth_user.raw_user_meta_data->>'full_name', '');
    v_region_code := COALESCE(v_auth_user.raw_user_meta_data->>'region_code', 'PH');

    -- Insert/Update public.users
    INSERT INTO public.users (auth_id, email, first_name, last_name, full_name, region_code, status, created_at, updated_at)
    VALUES (v_auth_user.id, v_auth_user.email, v_first_name, v_last_name, v_full_name, v_region_code, 'active', v_auth_user.created_at, v_auth_user.updated_at)
    ON CONFLICT (auth_id) DO UPDATE SET email = EXCLUDED.email, first_name = COALESCE(EXCLUDED.first_name, public.users.first_name), last_name = COALESCE(EXCLUDED.last_name, public.users.last_name);

    -- Insert/Update public.profiles
    INSERT INTO public.profiles (user_id, first_name, last_name, full_name, created_at, updated_at)
    VALUES (v_auth_user.id, v_first_name, v_last_name, v_full_name, v_auth_user.created_at, v_auth_user.updated_at)
    ON CONFLICT (user_id) DO UPDATE SET first_name = COALESCE(EXCLUDED.first_name, public.profiles.first_name), last_name = COALESCE(EXCLUDED.last_name, public.profiles.last_name), full_name = EXCLUDED.full_name;

    v_count := v_count + 1;
  END LOOP;

  RAISE NOTICE 'Backfill complete: % users synced', v_count;
END $$;

-- ============================================================================
-- VERIFY SYNC COMPLETED
-- ============================================================================

DO $$
DECLARE
  v_auth_count INTEGER;
  v_users_count INTEGER;
  v_profiles_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_auth_count FROM auth.users;
  SELECT COUNT(*) INTO v_users_count FROM public.users;
  SELECT COUNT(*) INTO v_profiles_count FROM public.profiles;
  
  RAISE NOTICE '═══════════════════════════════════════════════════════';
  RAISE NOTICE 'SYNC VERIFICATION:';
  RAISE NOTICE '  auth.users:      % records', v_auth_count;
  RAISE NOTICE '  public.users:    % records', v_users_count;
  RAISE NOTICE '  public.profiles: % records', v_profiles_count;
  RAISE NOTICE '═══════════════════════════════════════════════════════';
END $$;

COMMIT;

-- ============================================================================
-- YOU'RE DONE! Now you can:
-- ============================================================================
-- 
-- 1. Query all users:
--    SELECT id, email, full_name, region_code FROM public.users;
--
-- 2. Query profiles:
--    SELECT user_id, full_name, username, bio FROM public.profiles;
--
-- 3. Join all three tables:
--    SELECT au.id, au.email, pu.full_name, pp.username, pp.bio
--    FROM auth.users au
--    LEFT JOIN public.users pu ON pu.auth_id = au.id
--    LEFT JOIN public.profiles pp ON pp.user_id = au.id;
--
-- 4. New users automatically sync when they sign up
-- 5. Profile updates automatically sync to public.users
-- ============================================================================
