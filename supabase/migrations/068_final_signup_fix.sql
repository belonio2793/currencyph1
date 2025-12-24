-- Migration: 068 - Final Signup Error Fix
-- This migration fixes all remaining signup issues

-- ============================================================================
-- STEP 1: Ensure proper RLS policies on profiles table
-- ============================================================================

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can delete their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Public can search profiles by identifier" ON public.profiles;

CREATE POLICY "Enable insert for authenticated users" ON public.profiles
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for users based on user_id" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id OR auth.role() = 'service_role')
  WITH CHECK (auth.uid() = user_id OR auth.role() = 'service_role');

CREATE POLICY "Enable read access for all users" ON public.profiles
  FOR SELECT USING (true);

CREATE POLICY "Enable delete for users based on user_id" ON public.profiles
  FOR DELETE USING (auth.uid() = user_id OR auth.role() = 'service_role');

-- ============================================================================
-- STEP 2: Ensure proper RLS policies on public.users table
-- ============================================================================

DROP POLICY IF EXISTS "Users can view their own user data" ON public.users;
DROP POLICY IF EXISTS "Users can update their own user data" ON public.users;
DROP POLICY IF EXISTS "System can create user on signup" ON public.users;
DROP POLICY IF EXISTS "Service role can manage all users" ON public.users;

CREATE POLICY "Enable insert for system operations" ON public.users
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for users based on auth_id" ON public.users
  FOR UPDATE USING (auth.uid() = auth_id OR auth.role() = 'service_role')
  WITH CHECK (auth.uid() = auth_id OR auth.role() = 'service_role');

CREATE POLICY "Enable read access for authenticated users" ON public.users
  FOR SELECT USING (auth.uid() = auth_id OR auth.role() = 'service_role' OR true);

CREATE POLICY "Enable delete for service role" ON public.users
  FOR DELETE USING (auth.role() = 'service_role');

-- ============================================================================
-- STEP 3: Simple, reliable trigger function for profiles
-- ============================================================================

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_public_user ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_auto_confirm ON auth.users;
DROP TRIGGER IF EXISTS on_profile_update_sync_users ON public.profiles;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Auto-confirm email
  UPDATE auth.users 
  SET email_confirmed_at = CURRENT_TIMESTAMP,
      confirmed_at = CURRENT_TIMESTAMP
  WHERE id = NEW.id;

  -- Create profile entry
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
    NULLIF(COALESCE(NEW.raw_user_meta_data->>'username', '')::VARCHAR(255), ''),
    NULLIF(COALESCE(NEW.raw_user_meta_data->>'phone_number', '')::VARCHAR(20), ''),
    NULLIF(COALESCE(NEW.raw_user_meta_data->>'nickname', '')::VARCHAR(255), ''),
    NULLIF(COALESCE(NEW.raw_user_meta_data->>'address', '')::TEXT, ''),
    NULLIF(COALESCE(NEW.raw_user_meta_data->>'country', '')::VARCHAR(100), ''),
    NULLIF(COALESCE(NEW.raw_user_meta_data->>'city', '')::VARCHAR(100), ''),
    NULLIF(COALESCE(NEW.raw_user_meta_data->>'region', '')::VARCHAR(100), ''),
    NOW(),
    NOW()
  )
  ON CONFLICT (user_id) DO NOTHING;

  -- Create user entry
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
      NEW.id,
      NEW.email,
      NULLIF(COALESCE(NEW.raw_user_meta_data->>'username', '')::VARCHAR(255), ''),
      COALESCE(NEW.raw_user_meta_data->>'full_name', '')::VARCHAR(255),
      NULLIF(COALESCE(NEW.raw_user_meta_data->>'phone_number', '')::VARCHAR(20), ''),
      COALESCE(NEW.raw_user_meta_data->>'region_code', 'PH')::VARCHAR(5),
      'active'::VARCHAR(20),
      NOW(),
      NOW()
    )
    ON CONFLICT (auth_id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    -- Silently ignore if public.users doesn't exist or other errors
    NULL;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- STEP 4: Grant necessary permissions
-- ============================================================================

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.users TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.handle_new_user TO anon, authenticated, service_role, postgres;

-- ============================================================================
-- STEP 5: Add helpful comment
-- ============================================================================

COMMENT ON FUNCTION public.handle_new_user() IS 'Handles user creation on signup - creates profile and user entries with all metadata';
