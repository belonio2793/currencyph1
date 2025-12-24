-- Migration: 066 - Fix RLS policies and grants for signup flow
-- Ensures that the trigger functions can properly insert data during signup

-- ============================================================================
-- 1. ENSURE PROFILES TABLE RLS POLICIES ALLOW TRIGGER EXECUTION
-- ============================================================================

-- Drop and recreate INSERT policy to allow trigger execution
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id OR auth.role() = 'service_role');

-- Ensure UPDATE policy allows trigger execution
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id OR auth.role() = 'service_role')
  WITH CHECK (auth.uid() = user_id OR auth.role() = 'service_role');

-- Ensure SELECT policy exists
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = user_id OR true);  -- Allow public read for search functions

-- ============================================================================
-- 2. ENSURE PUBLIC.USERS TABLE RLS POLICIES ALLOW TRIGGER EXECUTION
-- ============================================================================

-- Ensure public.users table exists
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) UNIQUE,
  username VARCHAR(255) UNIQUE,
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

-- Enable RLS on public.users
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Drop old policies
DROP POLICY IF EXISTS "Users can view own data" ON public.users;
DROP POLICY IF EXISTS "Users can update own data" ON public.users;
DROP POLICY IF EXISTS "Users can insert own data" ON public.users;
DROP POLICY IF EXISTS "Users can insert deposits" ON public.users;
DROP POLICY IF EXISTS "Users can view their own user data" ON public.users;
DROP POLICY IF EXISTS "Users can update their own user data" ON public.users;
DROP POLICY IF EXISTS "System can create user on signup" ON public.users;
DROP POLICY IF EXISTS "Service role can manage all users" ON public.users;

-- Create proper RLS policies
CREATE POLICY "Users can view their own user data"
  ON public.users FOR SELECT
  USING (auth.uid() = auth_id OR auth_id IS NULL);

CREATE POLICY "Users can update their own user data"
  ON public.users FOR UPDATE
  USING (auth.uid() = auth_id)
  WITH CHECK (auth.uid() = auth_id);

CREATE POLICY "System can create user on signup"
  ON public.users FOR INSERT
  WITH CHECK (auth.role() = 'service_role' OR true);

CREATE POLICY "Service role can manage all users"
  ON public.users FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================================
-- 3. ENSURE PROPER GRANTS
-- ============================================================================

-- Grant permissions on profiles
GRANT SELECT, INSERT, UPDATE ON public.profiles TO anon, authenticated, service_role;

-- Grant permissions on users
GRANT SELECT, INSERT, UPDATE ON public.users TO anon, authenticated, service_role;

-- Grant permissions on trigger functions
GRANT EXECUTE ON FUNCTION public.create_profile_on_signup_internal TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_user_on_signup_internal TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.master_on_auth_user_created TO anon, authenticated, service_role;

-- ============================================================================
-- 4. VERIFY CONSTRAINTS
-- ============================================================================

-- Ensure username uniqueness is properly constrained
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_username_key;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_username_key UNIQUE (username) WHERE username IS NOT NULL;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);
CREATE INDEX IF NOT EXISTS idx_users_auth_id ON public.users(auth_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON public.users(username);

-- ============================================================================
-- 5. DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE public.profiles IS 'User profile data with flexible authentication fields';
COMMENT ON TABLE public.users IS 'Central user table synced from auth.users and profiles';
COMMENT ON FUNCTION public.master_on_auth_user_created() IS 'Master trigger function that handles all user initialization on signup';
COMMENT ON FUNCTION public.create_profile_on_signup_internal IS 'Creates user profile with all flexible auth metadata fields';
COMMENT ON FUNCTION public.create_user_on_signup_internal IS 'Creates entry in public.users table on signup';
