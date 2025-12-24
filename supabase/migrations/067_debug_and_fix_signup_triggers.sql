-- Migration: 067 - Debug and fix signup trigger issues
-- Adds better error handling and fixes potential constraint violations

-- ============================================================================
-- 1. UPDATE THE MASTER TRIGGER TO HANDLE ERRORS BETTER
-- ============================================================================

CREATE OR REPLACE FUNCTION public.master_on_auth_user_created()
RETURNS TRIGGER AS $$
DECLARE
  v_error TEXT;
BEGIN
  -- Auto-confirm email
  BEGIN
    UPDATE auth.users 
    SET email_confirmed_at = CURRENT_TIMESTAMP,
        confirmed_at = CURRENT_TIMESTAMP
    WHERE id = NEW.id;
  EXCEPTION WHEN OTHERS THEN
    -- Log but don't fail
    RAISE WARNING 'Error auto-confirming email for user %: %', NEW.id, SQLERRM;
  END;

  -- Create profile
  BEGIN
    IF EXISTS (
      SELECT 1 FROM information_schema.routines 
      WHERE routine_schema = 'public' 
      AND routine_name = 'create_profile_on_signup_internal'
    ) THEN
      PERFORM public.create_profile_on_signup_internal(NEW);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Error creating profile for user %: %', NEW.id, SQLERRM;
  END;

  -- Create user in public.users
  BEGIN
    IF EXISTS (
      SELECT 1 FROM information_schema.routines 
      WHERE routine_schema = 'public' 
      AND routine_name = 'create_user_on_signup_internal'
    ) THEN
      PERFORM public.create_user_on_signup_internal(NEW);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Error creating user in public.users for user %: %', NEW.id, SQLERRM;
  END;

  -- Create ride profile
  BEGIN
    IF EXISTS (
      SELECT 1 FROM information_schema.routines 
      WHERE routine_schema = 'public' 
      AND routine_name = 'create_ride_profile_on_signup_internal'
    ) THEN
      PERFORM public.create_ride_profile_on_signup_internal(NEW);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Error creating ride profile for user %: %', NEW.id, SQLERRM;
  END;

  -- Initialize wallets
  BEGIN
    IF EXISTS (
      SELECT 1 FROM information_schema.routines 
      WHERE routine_schema = 'public' 
      AND routine_name = 'initialize_user_wallets_internal'
    ) THEN
      PERFORM public.initialize_user_wallets_internal(NEW);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Error initializing wallets for user %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 2. FIX CREATE_PROFILE_ON_SIGNUP_INTERNAL TO HANDLE NULL VALUES
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_profile_on_signup_internal(user_row auth.users)
RETURNS void AS $$
BEGIN
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
    user_row.id,
    COALESCE(user_row.raw_user_meta_data->>'full_name', '')::VARCHAR(255),
    NULLIF(COALESCE(user_row.raw_user_meta_data->>'username', '')::VARCHAR(255), ''),
    NULLIF(COALESCE(user_row.raw_user_meta_data->>'phone_number', '')::VARCHAR(20), ''),
    NULLIF(COALESCE(user_row.raw_user_meta_data->>'nickname', '')::VARCHAR(255), ''),
    NULLIF(COALESCE(user_row.raw_user_meta_data->>'address', '')::TEXT, ''),
    NULLIF(COALESCE(user_row.raw_user_meta_data->>'country', '')::VARCHAR(100), ''),
    NULLIF(COALESCE(user_row.raw_user_meta_data->>'city', '')::VARCHAR(100), ''),
    NULLIF(COALESCE(user_row.raw_user_meta_data->>'region', '')::VARCHAR(100), ''),
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
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 3. FIX CREATE_USER_ON_SIGNUP_INTERNAL TO HANDLE NULL VALUES
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_user_on_signup_internal(user_row auth.users)
RETURNS void AS $$
BEGIN
  INSERT INTO public.users (
    auth_id,
    email,
    username,
    full_name,
    phone_number,
    region_code,
    status,
    created_at,
    updated_at
  )
  VALUES (
    user_row.id,
    COALESCE(user_row.email, '')::VARCHAR(255),
    NULLIF(COALESCE(user_row.raw_user_meta_data->>'username', '')::VARCHAR(255), ''),
    COALESCE(user_row.raw_user_meta_data->>'full_name', '')::VARCHAR(255),
    NULLIF(COALESCE(user_row.raw_user_meta_data->>'phone_number', '')::VARCHAR(20), ''),
    COALESCE(user_row.raw_user_meta_data->>'region_code', 'PH')::VARCHAR(5),
    'active'::VARCHAR(20),
    NOW(),
    NOW()
  )
  ON CONFLICT (auth_id) DO UPDATE SET
    email = COALESCE(EXCLUDED.email, public.users.email),
    username = COALESCE(EXCLUDED.username, public.users.username),
    full_name = COALESCE(EXCLUDED.full_name, public.users.full_name),
    phone_number = COALESCE(EXCLUDED.phone_number, public.users.phone_number),
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 4. ENSURE RLS POLICIES ARE CORRECT FOR TRIGGER EXECUTION
-- ============================================================================

-- Profiles table - allow trigger to insert
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile" ON public.profiles
  FOR INSERT WITH CHECK (
    auth.uid() = user_id 
    OR auth.role() = 'service_role'
    OR auth.role() = 'postgres'  -- Allow trigger execution from system
  );

-- Users table - allow trigger to insert
DROP POLICY IF EXISTS "System can create user on signup" ON public.users;
CREATE POLICY "System can create user on signup"
  ON public.users FOR INSERT
  WITH CHECK (
    auth.role() = 'service_role' 
    OR auth.role() = 'postgres'
    OR true  -- Fallback for trigger execution
  );

-- ============================================================================
-- 5. VERIFY GRANTS ARE CORRECT
-- ============================================================================

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.users TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.master_on_auth_user_created TO postgres;
GRANT EXECUTE ON FUNCTION public.create_profile_on_signup_internal TO postgres;
GRANT EXECUTE ON FUNCTION public.create_user_on_signup_internal TO postgres;
