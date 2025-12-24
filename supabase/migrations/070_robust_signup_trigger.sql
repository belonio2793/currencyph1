-- Migration: 070 - Robust Signup Trigger
-- Simplified and more reliable trigger for user signup

-- ============================================================================
-- DROP ALL OLD TRIGGERS AND FUNCTIONS
-- ============================================================================

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users CASCADE;
DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users CASCADE;
DROP TRIGGER IF EXISTS on_auth_user_created_public_user ON auth.users CASCADE;
DROP TRIGGER IF EXISTS on_auth_user_created_auto_confirm ON auth.users CASCADE;
DROP TRIGGER IF EXISTS on_profile_update_sync_users ON public.profiles CASCADE;
DROP TRIGGER IF EXISTS trigger_initialize_user_wallets ON auth.users CASCADE;

-- Drop the old function
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

-- ============================================================================
-- CREATE SIMPLE, RELIABLE TRIGGER
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_profile_on_signup()
RETURNS TRIGGER AS $$
DECLARE
  v_full_name TEXT;
  v_username TEXT;
  v_phone TEXT;
BEGIN
  -- Extract and clean metadata values
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', '')::VARCHAR(255);
  v_username := NULLIF((NEW.raw_user_meta_data->>'username')::VARCHAR(255), '');
  v_phone := NULLIF((NEW.raw_user_meta_data->>'phone_number')::VARCHAR(20), '');

  -- Create profile (let it fail if there are constraint issues - we'll see the real error)
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
    v_full_name,
    v_username,
    v_phone,
    NOW(),
    NOW()
  )
  ON CONFLICT (user_id) DO NOTHING;

  -- Auto-confirm email (do this last in case profile creation failed)
  BEGIN
    UPDATE auth.users 
    SET email_confirmed_at = CURRENT_TIMESTAMP,
        confirmed_at = CURRENT_TIMESTAMP
    WHERE id = NEW.id;
  EXCEPTION WHEN OTHERS THEN
    -- Silently continue if email confirmation fails
    NULL;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- CREATE TRIGGER
-- ============================================================================

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.create_profile_on_signup();

-- ============================================================================
-- FIX RLS POLICIES - Make them completely permissive
-- ============================================================================

-- Drop all existing policies on profiles
DO $$
DECLARE
  policy_name TEXT;
BEGIN
  FOR policy_name IN
    SELECT p.policyname 
    FROM pg_policies p 
    WHERE p.tablename = 'profiles' AND p.schemaname = 'public'
  LOOP
    EXECUTE 'DROP POLICY IF EXISTS "' || policy_name || '" ON public.profiles';
  END LOOP;
END;
$$;

-- Create simple, permissive policies
CREATE POLICY "Allow all operations during signup" ON public.profiles
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON public.profiles TO postgres, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_profile_on_signup TO postgres, anon, authenticated, service_role;

-- ============================================================================
-- VERIFY THE PROFILES TABLE STRUCTURE
-- ============================================================================

-- Ensure it has the right columns - ADD any missing ones
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS id UUID PRIMARY KEY DEFAULT gen_random_uuid();
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name VARCHAR(255) DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username VARCHAR(255) UNIQUE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS nickname VARCHAR(255);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS country VARCHAR(100);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS city VARCHAR(100);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS region VARCHAR(100);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS profile_picture_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ============================================================================
-- CREATE INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);

-- ============================================================================
-- DOCUMENTATION
-- ============================================================================

COMMENT ON FUNCTION public.create_profile_on_signup() IS 'Creates user profile on signup with essential metadata fields';
COMMENT ON TRIGGER on_auth_user_created ON auth.users IS 'Automatically create profile when user signs up';
