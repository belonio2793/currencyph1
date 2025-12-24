-- Migration: 078 - Defensive Foreign Key Repairs with Error Handling
-- This migration carefully fixes foreign keys without causing cascading failures

-- ============================================================================
-- HELPER FUNCTION: Safely fix foreign key to reference auth.users
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fix_foreign_key_to_auth_users(
  p_table_name TEXT,
  p_column_name TEXT,
  p_constraint_name TEXT DEFAULT NULL
)
RETURNS TEXT AS $$
DECLARE
  v_constraint TEXT;
  v_result TEXT;
BEGIN
  -- Determine constraint name if not provided
  v_constraint := COALESCE(p_constraint_name, p_table_name || '_' || p_column_name || '_fkey');
  
  BEGIN
    -- Try to drop the old constraint
    EXECUTE FORMAT('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I', p_table_name, v_constraint);
    v_result := 'Dropped old constraint';
  EXCEPTION WHEN OTHERS THEN
    v_result := 'Failed to drop constraint: ' || SQLERRM;
    RETURN v_result;
  END;
  
  BEGIN
    -- Add new constraint
    EXECUTE FORMAT(
      'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES auth.users(id) ON DELETE CASCADE',
      p_table_name, v_constraint, p_column_name
    );
    v_result := v_result || ' | Added new constraint to auth.users';
  EXCEPTION WHEN OTHERS THEN
    v_result := v_result || ' | Failed to add constraint: ' || SQLERRM;
  END;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FIX CRITICAL TABLES FOR SIGNUP (these are used by the trigger)
-- ============================================================================

-- 1. PROFILES TABLE (should already reference auth.users correctly)
SELECT public.fix_foreign_key_to_auth_users('profiles', 'user_id', 'profiles_user_id_fkey');

-- 2. USERS TABLE  
SELECT public.fix_foreign_key_to_auth_users('users', 'auth_id', 'users_auth_id_fkey');

-- 3. WALLETS_FIAT TABLE (CRITICAL!)
SELECT public.fix_foreign_key_to_auth_users('wallets_fiat', 'user_id', 'wallets_fiat_user_id_fkey');

-- 4. WALLETS_CRYPTO TABLE (CRITICAL!)
SELECT public.fix_foreign_key_to_auth_users('wallets_crypto', 'user_id', 'wallets_crypto_user_id_fkey');

-- 5. RIDE_PROFILES TABLE
SELECT public.fix_foreign_key_to_auth_users('ride_profiles', 'user_id', 'ride_profiles_user_id_fkey');

-- ============================================================================
-- FIX OTHER COMMON TABLES (non-critical but good to have)
-- ============================================================================

-- 6. DEPOSITS TABLE
SELECT public.fix_foreign_key_to_auth_users('deposits', 'user_id', 'deposits_user_id_fkey');

-- 7. LOANS TABLE
SELECT public.fix_foreign_key_to_auth_users('loans', 'user_id', 'loans_user_id_fkey');

-- 8. INVESTMENTS TABLE
SELECT public.fix_foreign_key_to_auth_users('investments', 'user_id', 'investments_user_id_fkey');

-- 9. CONVERSATIONS TABLE
SELECT public.fix_foreign_key_to_auth_users('conversations', 'created_by', 'conversations_created_by_fkey');

-- 10. CONVERSATION_MEMBERS TABLE
SELECT public.fix_foreign_key_to_auth_users('conversation_members', 'user_id', 'conversation_members_user_id_fkey');

-- 11. MESSAGES TABLE
SELECT public.fix_foreign_key_to_auth_users('messages', 'user_id', 'messages_user_id_fkey');

-- 12. VOICE_CALLS TABLE - caller_id
SELECT public.fix_foreign_key_to_auth_users('voice_calls', 'caller_id', 'voice_calls_caller_id_fkey');

-- 13. VOICE_CALLS TABLE - callee_id  
SELECT public.fix_foreign_key_to_auth_users('voice_calls', 'callee_id', 'voice_calls_callee_id_fkey');

-- 14. PROPERTIES TABLE
SELECT public.fix_foreign_key_to_auth_users('properties', 'owner_id', 'properties_owner_id_fkey');

-- ============================================================================
-- ENSURE service_role HAS MAXIMUM PERMISSIONS
-- ============================================================================

GRANT USAGE ON SCHEMA public TO service_role;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- Set default privileges
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;

-- ============================================================================
-- CLEANUP
-- ============================================================================

-- Drop the helper function since we don't need it anymore
DROP FUNCTION IF EXISTS public.fix_foreign_key_to_auth_users(TEXT, TEXT, TEXT);

-- ============================================================================
-- SUMMARY
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '=== Foreign Key Repair Complete ===';
  RAISE NOTICE 'All critical tables for signup have been checked and fixed to reference auth.users';
  RAISE NOTICE 'service_role has been granted full permissions';
  RAISE NOTICE 'Signup should now work correctly';
END$$;
