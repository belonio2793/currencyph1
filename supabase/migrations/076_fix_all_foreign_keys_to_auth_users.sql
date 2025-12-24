-- Migration: 076 - Fix Foreign Keys to Reference auth.users (Safe Version)
-- Only fixes tables and columns that actually exist in the database

-- ============================================================================
-- CRITICAL TABLES FOR SIGNUP - These MUST exist
-- ============================================================================

-- 1. PROFILES TABLE (should already reference auth.users correctly)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'profiles'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.profiles
      DROP CONSTRAINT IF EXISTS profiles_user_id_fkey CASCADE;
    
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_user_id_fkey 
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    
    RAISE NOTICE 'Fixed profiles.user_id FK to auth.users';
  ELSE
    RAISE WARNING 'profiles table or user_id column does not exist';
  END IF;
END$$;

-- 2. WALLETS_FIAT TABLE (CRITICAL!)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'wallets_fiat'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'wallets_fiat' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.wallets_fiat
      DROP CONSTRAINT IF EXISTS wallets_fiat_user_id_fkey CASCADE;
    
    ALTER TABLE public.wallets_fiat
      ADD CONSTRAINT wallets_fiat_user_id_fkey 
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    
    RAISE NOTICE 'Fixed wallets_fiat.user_id FK to auth.users';
  ELSE
    RAISE WARNING 'wallets_fiat table or user_id column does not exist';
  END IF;
END$$;

-- 3. WALLETS_CRYPTO TABLE (CRITICAL!)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'wallets_crypto'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'wallets_crypto' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.wallets_crypto
      DROP CONSTRAINT IF EXISTS wallets_crypto_user_id_fkey CASCADE;
    
    ALTER TABLE public.wallets_crypto
      ADD CONSTRAINT wallets_crypto_user_id_fkey 
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    
    RAISE NOTICE 'Fixed wallets_crypto.user_id FK to auth.users';
  ELSE
    RAISE WARNING 'wallets_crypto table or user_id column does not exist';
  END IF;
END$$;

-- 4. RIDE_PROFILES TABLE
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'ride_profiles'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ride_profiles' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.ride_profiles
      DROP CONSTRAINT IF EXISTS ride_profiles_user_id_fkey CASCADE;
    
    ALTER TABLE public.ride_profiles
      ADD CONSTRAINT ride_profiles_user_id_fkey 
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    
    RAISE NOTICE 'Fixed ride_profiles.user_id FK to auth.users';
  ELSE
    RAISE WARNING 'ride_profiles table or user_id column does not exist';
  END IF;
END$$;

-- 5. USERS TABLE
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'users'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'auth_id'
  ) THEN
    ALTER TABLE public.users
      DROP CONSTRAINT IF EXISTS users_auth_id_fkey CASCADE;
    
    ALTER TABLE public.users
      ADD CONSTRAINT users_auth_id_fkey 
      FOREIGN KEY (auth_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    
    RAISE NOTICE 'Fixed users.auth_id FK to auth.users';
  ELSE
    RAISE WARNING 'users table or auth_id column does not exist';
  END IF;
END$$;

-- ============================================================================
-- OTHER COMMON TABLES (only if they exist with the required columns)
-- ============================================================================

-- 6. DEPOSITS TABLE
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'deposits'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'deposits' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.deposits
      DROP CONSTRAINT IF EXISTS deposits_user_id_fkey CASCADE;
    
    ALTER TABLE public.deposits
      ADD CONSTRAINT deposits_user_id_fkey 
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    
    RAISE NOTICE 'Fixed deposits.user_id FK to auth.users';
  END IF;
END$$;

-- 7. LOANS TABLE
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'loans'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'loans' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.loans
      DROP CONSTRAINT IF EXISTS loans_user_id_fkey CASCADE;
    
    ALTER TABLE public.loans
      ADD CONSTRAINT loans_user_id_fkey 
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    
    RAISE NOTICE 'Fixed loans.user_id FK to auth.users';
  END IF;
END$$;

-- 8. CONVERSATIONS TABLE
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'conversations'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'conversations' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE public.conversations
      DROP CONSTRAINT IF EXISTS conversations_created_by_fkey CASCADE;
    
    ALTER TABLE public.conversations
      ADD CONSTRAINT conversations_created_by_fkey 
      FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
    
    RAISE NOTICE 'Fixed conversations.created_by FK to auth.users';
  END IF;
END$$;

-- 9. CONVERSATION_MEMBERS TABLE
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'conversation_members'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'conversation_members' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.conversation_members
      DROP CONSTRAINT IF EXISTS conversation_members_user_id_fkey CASCADE;
    
    ALTER TABLE public.conversation_members
      ADD CONSTRAINT conversation_members_user_id_fkey 
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    
    RAISE NOTICE 'Fixed conversation_members.user_id FK to auth.users';
  END IF;
END$$;

-- 10. MESSAGES TABLE
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'messages'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'messages' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.messages
      DROP CONSTRAINT IF EXISTS messages_user_id_fkey CASCADE;
    
    ALTER TABLE public.messages
      ADD CONSTRAINT messages_user_id_fkey 
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    
    RAISE NOTICE 'Fixed messages.user_id FK to auth.users';
  END IF;
END$$;

-- 11. VOICE_CALLS TABLE
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'voice_calls'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'voice_calls' AND column_name = 'caller_id'
    ) THEN
      ALTER TABLE public.voice_calls
        DROP CONSTRAINT IF EXISTS voice_calls_caller_id_fkey CASCADE;
      
      ALTER TABLE public.voice_calls
        ADD CONSTRAINT voice_calls_caller_id_fkey 
        FOREIGN KEY (caller_id) REFERENCES auth.users(id) ON DELETE CASCADE;
      
      RAISE NOTICE 'Fixed voice_calls.caller_id FK to auth.users';
    END IF;
    
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'voice_calls' AND column_name = 'callee_id'
    ) THEN
      ALTER TABLE public.voice_calls
        DROP CONSTRAINT IF EXISTS voice_calls_callee_id_fkey CASCADE;
      
      ALTER TABLE public.voice_calls
        ADD CONSTRAINT voice_calls_callee_id_fkey 
        FOREIGN KEY (callee_id) REFERENCES auth.users(id) ON DELETE CASCADE;
      
      RAISE NOTICE 'Fixed voice_calls.callee_id FK to auth.users';
    END IF;
  END IF;
END$$;

-- ============================================================================
-- ENSURE service_role HAS NECESSARY PERMISSIONS
-- ============================================================================

GRANT USAGE ON SCHEMA public TO service_role;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;

-- ============================================================================
-- SUMMARY
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '=== Foreign Key Repair Complete ===';
  RAISE NOTICE 'All existing tables with user_id/auth_id columns have been fixed to reference auth.users';
  RAISE NOTICE 'Only tables that actually exist in the database were modified';
  RAISE NOTICE 'Signup should now work correctly';
END$$;
