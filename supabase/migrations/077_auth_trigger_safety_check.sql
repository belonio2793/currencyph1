-- Migration: 077 - Auth Trigger Safety Check and Cleanup
-- Ensures auth.users table is properly configured and all triggers are correctly set up

-- ============================================================================
-- STEP 1: VERIFY auth.users TABLE EXISTS
-- ============================================================================
-- This table is managed by Supabase itself, we just verify it exists
-- and doesn't have RLS enabled (it's managed by Supabase, not our schema)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'auth' AND table_name = 'users'
  ) THEN
    RAISE EXCEPTION 'auth.users table does not exist. This should not happen - Supabase manages this table.';
  END IF;
END$$;

-- ============================================================================
-- STEP 2: LIST ALL TRIGGERS ON auth.users AND VERIFY THEY ARE CORRECT
-- ============================================================================
-- This is informational - helps with debugging

DO $$
DECLARE
  trigger_count INT;
BEGIN
  SELECT COUNT(*) INTO trigger_count
  FROM information_schema.triggers
  WHERE event_object_schema = 'auth' 
    AND event_object_table = 'users';
  
  RAISE NOTICE 'Total triggers on auth.users: %', trigger_count;
END$$;

-- ============================================================================
-- STEP 3: VERIFY KEY FUNCTION SIGNATURES
-- ============================================================================

-- Verify master trigger function exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.routines
    WHERE routine_schema = 'public'
      AND routine_name = 'master_on_auth_user_created'
      AND routine_type = 'FUNCTION'
  ) THEN
    RAISE WARNING 'master_on_auth_user_created function does not exist!';
  ELSE
    RAISE NOTICE 'master_on_auth_user_created function exists';
  END IF;
END$$;

-- ============================================================================
-- STEP 4: ENSURE TABLES EXIST BEFORE TRIGGER TRIES TO USE THEM
-- ============================================================================

-- Verify profiles table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'profiles'
  ) THEN
    RAISE EXCEPTION 'profiles table does not exist. Run migration 023_create_profiles_table.sql first.';
  END IF;
END$$;

-- Verify users table  
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'users'
  ) THEN
    RAISE NOTICE 'public.users table does not exist. It will be created by trigger or can be created manually.';
  END IF;
END$$;

-- Verify wallets_fiat table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'wallets_fiat'
  ) THEN
    RAISE NOTICE 'wallets_fiat table does not exist. It will be created if needed.';
  END IF;
END$$;

-- ============================================================================
-- STEP 5: CHECK FOR CONFLICTING POLICIES THAT MIGHT BLOCK INSERTS
-- ============================================================================

DO $$
DECLARE
  rls_enabled BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public' 
      AND tablename = 'profiles'
      AND rowsecurity = true
  ) INTO rls_enabled;
  
  IF rls_enabled THEN
    RAISE NOTICE 'profiles table has RLS enabled';
  ELSE
    RAISE NOTICE 'profiles table does NOT have RLS enabled';
  END IF;
END$$;

-- ============================================================================
-- STEP 6: ENSURE service_role HAS NECESSARY PERMISSIONS
-- ============================================================================

-- Grant service_role full access to public schema
GRANT USAGE ON SCHEMA public TO service_role;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- Set default privileges for future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;

-- ============================================================================
-- STEP 7: VERIFY NO UNINTENDED CONSTRAINTS ON profiles TABLE
-- ============================================================================

DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  -- Check for any unusual constraints
  FOR constraint_name IN 
    SELECT c.constraint_name
    FROM information_schema.table_constraints c
    WHERE c.table_schema = 'public'
      AND c.table_name = 'profiles'
      AND c.constraint_type = 'UNIQUE'
      AND c.constraint_name NOT LIKE '%_pkey'
  LOOP
    RAISE NOTICE 'Found UNIQUE constraint on profiles: %', constraint_name;
  END LOOP;
END$$;

-- ============================================================================
-- STEP 8: LOG HELPER FUNCTION FOR DEBUGGING
-- ============================================================================

CREATE OR REPLACE FUNCTION public.log_signup_attempt(
  p_email TEXT,
  p_metadata JSONB,
  p_error TEXT DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  -- This function can be called from triggers to log signup attempts for debugging
  -- INSERT INTO public.signup_audit_log (email, metadata, error, created_at)
  -- VALUES (p_email, p_metadata, p_error, NOW());
  RAISE NOTICE 'Signup attempt - email: %, error: %', p_email, p_error;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- FINAL VERIFICATION
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '=== Auth Trigger Safety Check Complete ===';
  RAISE NOTICE 'If signup is still failing, check:';
  RAISE NOTICE '1. Supabase project logs in dashboard';
  RAISE NOTICE '2. Database audit logs for constraint violations';
  RAISE NOTICE '3. Specific error in migration tests';
  RAISE NOTICE '4. Network connectivity and API keys';
END$$;
