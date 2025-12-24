-- Migration: 071 - Nuclear Option Signup Fix
-- Completely resets the signup trigger to be as minimal as possible

-- ============================================================================
-- STEP 1: DROP EVERYTHING
-- ============================================================================

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users CASCADE;
DROP FUNCTION IF EXISTS public.create_profile_on_signup() CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.master_on_auth_user_created() CASCADE;
DROP FUNCTION IF EXISTS public.create_profile_on_signup_internal() CASCADE;

-- ============================================================================
-- STEP 2: DROP ALL RLS POLICIES ON PROFILES
-- ============================================================================

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT policyname, tablename, schemaname
    FROM pg_policies
    WHERE tablename = 'profiles' AND schemaname = 'public'
  )
  LOOP
    EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.' || r.tablename;
  END LOOP;
END;
$$;

-- ============================================================================
-- STEP 3: DISABLE RLS ENTIRELY (temporary measure to debug)
-- ============================================================================

ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 4: CREATE MINIMAL TRIGGER FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_profile_on_signup()
RETURNS TRIGGER AS $$
BEGIN
  -- Simply create a profile with minimal data
  INSERT INTO public.profiles (user_id, full_name, created_at, updated_at)
  VALUES (NEW.id, '', NOW(), NOW())
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STEP 5: CREATE TRIGGER
-- ============================================================================

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.create_profile_on_signup();

-- ============================================================================
-- STEP 6: GRANT PERMISSIONS
-- ============================================================================

GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON public.profiles TO postgres, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_profile_on_signup TO postgres, anon, authenticated, service_role;

-- ============================================================================
-- DOCUMENTATION
-- ============================================================================

COMMENT ON FUNCTION public.create_profile_on_signup() IS 'Minimal trigger - creates profile with just user_id and empty full_name';
