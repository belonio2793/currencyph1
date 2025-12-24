-- Migration: 075 - Fix RLS Policies for Signup Trigger
-- Ensure all tables have RLS policies that allow service_role to insert during triggers

-- ============================================================================
-- 1. PROFILES TABLE - ENABLE RLS WITH PROPER POLICIES
-- ============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can delete their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;

-- Create policies that allow service_role for trigger execution
CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = user_id OR auth.role() = 'service_role');

CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id OR auth.role() = 'service_role')
  WITH CHECK (auth.uid() = user_id OR auth.role() = 'service_role');

CREATE POLICY "Users can insert their own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.role() = 'service_role' OR auth.uid() = user_id);

CREATE POLICY "Service role can manage profiles" ON public.profiles
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================================
-- 2. USERS TABLE - ENABLE RLS WITH PROPER POLICIES
-- ============================================================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies
DROP POLICY IF EXISTS "Users can view their own user data" ON public.users;
DROP POLICY IF EXISTS "Users can update their own user data" ON public.users;
DROP POLICY IF EXISTS "System can create user on signup" ON public.users;
DROP POLICY IF EXISTS "Service role can manage all users" ON public.users;

-- Create policies that allow service_role for trigger execution
CREATE POLICY "Users can view their own user data" ON public.users
  FOR SELECT USING (auth.uid() = auth_id OR auth.role() = 'service_role');

CREATE POLICY "Users can update their own user data" ON public.users
  FOR UPDATE USING (auth.uid() = auth_id OR auth.role() = 'service_role')
  WITH CHECK (auth.uid() = auth_id OR auth.role() = 'service_role');

CREATE POLICY "Service role can insert users on signup" ON public.users
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role can manage all users" ON public.users
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================================
-- 3. WALLETS_FIAT TABLE - ENSURE PROPER RLS FOR TRIGGER
-- ============================================================================
ALTER TABLE public.wallets_fiat ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies
DROP POLICY IF EXISTS "Users can view own fiat wallets" ON public.wallets_fiat;
DROP POLICY IF EXISTS "Users can insert own fiat wallets" ON public.wallets_fiat;
DROP POLICY IF EXISTS "Users can update own fiat wallets" ON public.wallets_fiat;

-- Create policies that allow service_role
CREATE POLICY "Users can view own fiat wallets" ON public.wallets_fiat
  FOR SELECT USING (auth.uid() = user_id OR auth.role() = 'service_role');

CREATE POLICY "Service role can create wallets on signup" ON public.wallets_fiat
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Users can update own fiat wallets" ON public.wallets_fiat
  FOR UPDATE USING (auth.uid() = user_id OR auth.role() = 'service_role')
  WITH CHECK (auth.uid() = user_id OR auth.role() = 'service_role');

-- ============================================================================
-- 4. WALLETS_CRYPTO TABLE - ENSURE PROPER RLS FOR TRIGGER
-- ============================================================================
ALTER TABLE public.wallets_crypto ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies
DROP POLICY IF EXISTS "Users can view own crypto wallets" ON public.wallets_crypto;
DROP POLICY IF EXISTS "Users can insert own crypto wallets" ON public.wallets_crypto;
DROP POLICY IF EXISTS "Users can update own crypto wallets" ON public.wallets_crypto;

-- Create policies that allow service_role
CREATE POLICY "Users can view own crypto wallets" ON public.wallets_crypto
  FOR SELECT USING (auth.uid() = user_id OR auth.role() = 'service_role');

CREATE POLICY "Service role can create wallets on signup" ON public.wallets_crypto
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Users can update own crypto wallets" ON public.wallets_crypto
  FOR UPDATE USING (auth.uid() = user_id OR auth.role() = 'service_role')
  WITH CHECK (auth.uid() = user_id OR auth.role() = 'service_role');

-- ============================================================================
-- 5. RIDE_PROFILES TABLE - ENSURE PROPER RLS FOR TRIGGER
-- ============================================================================
ALTER TABLE public.ride_profiles ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies
DROP POLICY IF EXISTS "Users can view own ride profile" ON public.ride_profiles;
DROP POLICY IF EXISTS "Users can insert own ride profile" ON public.ride_profiles;

-- Create policies that allow service_role
CREATE POLICY "Users can view own ride profile" ON public.ride_profiles
  FOR SELECT USING (auth.uid() = user_id OR auth.role() = 'service_role');

CREATE POLICY "Service role can create ride profile on signup" ON public.ride_profiles
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Users can update own ride profile" ON public.ride_profiles
  FOR UPDATE USING (auth.uid() = user_id OR auth.role() = 'service_role');

-- ============================================================================
-- 6. GRANT PERMISSIONS
-- ============================================================================

-- Ensure service_role has all necessary permissions
GRANT USAGE ON SCHEMA public TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- Grant anon and authenticated users basic permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON public.profiles TO anon, authenticated;
GRANT SELECT ON public.users TO anon, authenticated;
GRANT SELECT ON public.wallets_fiat TO authenticated;
GRANT SELECT ON public.wallets_crypto TO authenticated;
GRANT SELECT ON public.ride_profiles TO authenticated;

-- ============================================================================
-- 7. ENSURE TRIGGER FUNCTIONS CAN EXECUTE
-- ============================================================================

-- Grant execute on all trigger functions
GRANT EXECUTE ON FUNCTION public.master_on_auth_user_created TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_profile_on_signup_internal TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_user_on_signup_internal TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.initialize_user_wallets_internal TO anon, authenticated, service_role;

-- Grant execute on optional functions if they exist
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.routines
    WHERE routine_schema = 'public'
    AND routine_name = 'create_ride_profile_on_signup_internal'
  ) THEN
    GRANT EXECUTE ON FUNCTION public.create_ride_profile_on_signup_internal TO anon, authenticated, service_role;
  END IF;
END$$;

-- ============================================================================
-- DOCUMENTATION
-- ============================================================================
COMMENT ON TABLE public.profiles IS 'User profile data, allows service_role to insert on signup';
COMMENT ON TABLE public.users IS 'Central user table, allows service_role to insert on signup';
COMMENT ON TABLE public.wallets_fiat IS 'Fiat wallets, allows service_role to insert on signup';
COMMENT ON TABLE public.wallets_crypto IS 'Crypto wallets, allows service_role to insert on signup';
